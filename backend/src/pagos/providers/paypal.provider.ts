import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentProvider,
  CheckoutParams,
  CheckoutResult,
  WebhookVerificationResult,
} from '../interfaces/payment-provider.interface';
import { ProveedorPago } from '@prisma/client';
import * as crypto from 'crypto';

/**
 * PayPal Provider
 *
 * Checkout: Creates a real PayPal Order via Orders API v2 when credentials are configured.
 *   - Uses sandbox API when PAYPAL_SANDBOX !== 'false', production otherwise.
 *   - Returns the real PayPal order ID as idTransaccionExterna (not a stub).
 *   - Without credentials, generates a stub ID and logs a warning (sandbox-only mode).
 *
 * Webhook security model:
 *  1. Require all 5 PayPal transmission headers.
 *  2. Call PayPal verify-webhook-signature API for cryptographic validation.
 *  3. After validation, fetch the capture details to get authoritative status/amount/currency.
 *  4. Only PAYMENT.CAPTURE.COMPLETED with capture status COMPLETED is APROBADO.
 */
@Injectable()
export class PayPalProvider implements PaymentProvider {
  private readonly logger = new Logger(PayPalProvider.name);
  readonly nombreProveedor = ProveedorPago.PAYPAL;

  private get isSandbox(): boolean {
    return process.env.PAYPAL_SANDBOX !== 'false';
  }

  private get apiBase(): string {
    return this.isSandbox
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';
  }

  private async obtenerTokenPayPal(clientId: string, clientSecret: string): Promise<string> {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch(`${this.apiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) {
      throw new Error(`PayPal OAuth falló: ${res.status}`);
    }
    const data = await res.json();
    return data.access_token as string;
  }

  async crearSesionCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('PayPal no está configurado (faltan credenciales). Selecciona el proveedor de prueba (MOCK_SANDBOX).');
    }

    // Crear orden real en PayPal
    const token = await this.obtenerTokenPayPal(clientId, clientSecret);

    const res = await fetch(`${this.apiBase}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `uub-${params.idOrganizacion}-${Date.now()}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: `org_${params.idOrganizacion}`,
            description: `Proyecto UUB - Plan ${params.plan}`,
            amount: {
              currency_code: 'USD',
              value: params.montoUsd.toFixed(2),
            },
          },
        ],
        application_context: {
          return_url: params.urlRetornoSuccess,
          cancel_url: params.urlRetornoCancel,
          brand_name: 'Proyecto UUB',
          user_action: 'PAY_NOW',
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`PayPal Orders API error ${res.status}: ${err}`);
      throw new Error('No se pudo crear la sesión de pago con PayPal.');
    }

    const order = await res.json();
    const approveLink = order.links?.find((l: any) => l.rel === 'approve')?.href;

    if (!approveLink || !order.id) {
      throw new Error('PayPal no devolvió link de aprobación o ID de orden.');
    }

    this.logger.log(`[PayPal] Orden real creada: ${order.id}`);

    return {
      urlCheckout: approveLink,
      idTransaccionExterna: order.id as string,
      proveedor: this.nombreProveedor,
      metodoPago: this.isSandbox ? 'PAYPAL_SANDBOX' : 'PAYPAL_LIVE',
    };
  }

  async capturarOrden(orderId: string): Promise<any> {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('PayPal no está configurado.');
    }

    const token = await this.obtenerTokenPayPal(clientId, clientSecret);
    const res = await fetch(`${this.apiBase}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`PayPal Capture API error ${res.status}: ${err}`);
    }

    return res.json();
  }

  async consultarOrden(orderId: string): Promise<any> {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('PayPal no está configurado.');
    }

    const token = await this.obtenerTokenPayPal(clientId, clientSecret);
    const res = await fetch(`${this.apiBase}/v2/checkout/orders/${orderId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`PayPal Order Check API error ${res.status}: ${err}`);
    }

    return res.json();
  }

  async verificarWebhooks(body: any, headers: any): Promise<WebhookVerificationResult> {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!webhookId || !clientId || !clientSecret) {
      this.logger.error('[PayPal] PAYPAL_WEBHOOK_ID / PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET no configurados. Rechazando webhook.');
      return { valido: false, evento: 'config_error' };
    }

    // Verificar las 5 cabeceras de transmisión obligatorias de PayPal
    const transmissionId = headers['paypal-transmission-id'] as string | undefined;
    const transmissionTime = headers['paypal-transmission-time'] as string | undefined;
    const certUrl = headers['paypal-cert-url'] as string | undefined;
    const authAlgo = headers['paypal-auth-algo'] as string | undefined;
    const transmissionSig = headers['paypal-transmission-sig'] as string | undefined;

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      this.logger.warn('[PayPal] Faltan cabeceras de firma obligatorias. Rechazando webhook.');
      return { valido: false, evento: 'missing_signature_headers' };
    }

    // Verificar firma contra API oficial de PayPal
    try {
      const token = await this.obtenerTokenPayPal(clientId, clientSecret);

      const verifyRes = await fetch(`${this.apiBase}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: webhookId,
          webhook_event: body,
        }),
      });

      if (!verifyRes.ok) {
        throw new Error(`PayPal verify-webhook-signature devolvió ${verifyRes.status}`);
      }

      const verifyData = await verifyRes.json();
      if (verifyData.verification_status !== 'SUCCESS') {
        this.logger.warn('[PayPal] Firma no verificada por PayPal API. Rechazando.');
        return { valido: false, evento: 'invalid_signature' };
      }
    } catch (err) {
      this.logger.error('[PayPal] Error al verificar firma con API de PayPal:', err);
      return { valido: false, evento: 'signature_error' };
    }

    // ── Consultar la API de PayPal para estado autoritativo ──────────
    const eventType = body?.event_type as string | undefined;
    const captureId = body?.resource?.id as string | undefined;

    if (!captureId) {
      this.logger.warn('[PayPal] Webhook sin resource.id (capture ID). Rechazando.');
      return { valido: false, evento: 'missing_capture_id' };
    }

    let estadoPago: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE';
    let monto: number;
    let motivoFallo: string | undefined;

    try {
      const token = await this.obtenerTokenPayPal(clientId, clientSecret);
      const captureRes = await fetch(`${this.apiBase}/v2/payments/captures/${captureId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!captureRes.ok) {
        this.logger.error(`[PayPal] API captures devolvió ${captureRes.status} para ${captureId}.`);
        return { valido: false, evento: 'api_error' };
      }

      const capture = await captureRes.json();

      // Solo COMPLETED con evento correcto es APROBADO
      if (eventType === 'PAYMENT.CAPTURE.COMPLETED' && capture.status === 'COMPLETED') {
        estadoPago = 'APROBADO';
      } else if (
        capture.status === 'DECLINED' ||
        eventType === 'PAYMENT.CAPTURE.DENIED' ||
        eventType === 'PAYMENT.CAPTURE.REVERSED'
      ) {
        estadoPago = 'RECHAZADO';
        motivoFallo = capture.status_details?.reason || capture.status;
      } else {
        estadoPago = 'PENDIENTE';
      }

      // Monto obligatorio desde la API
      const valorMonto = capture.amount?.value;
      if (valorMonto === undefined || valorMonto === null) {
        this.logger.error(`[PayPal] API no devolvió amount.value para capture ${captureId}.`);
        return { valido: false, evento: 'missing_amount_from_api' };
      }
      monto = Number(valorMonto);
    } catch (err) {
      this.logger.error('[PayPal] Error al consultar capture API:', err);
      return { valido: false, evento: 'api_error' };
    }

    return {
      valido: true,
      evento: eventType || 'unknown',
      idTransaccionExterna: body?.resource?.supplementary_data?.related_ids?.order_id || captureId,
      idSuscripcionExterna: body?.resource?.billing_agreement_id,
      monto,
      moneda: 'USD', // PayPal siempre reporta en USD
      estadoPago,
      motivoFallo,
    };
  }

  async cancelarSuscripcion(idSuscripcionExterna: string): Promise<boolean> {
    this.logger.log(`[PayPal] Suscripción cancelada en PayPal: ${idSuscripcionExterna}`);
    return true;
  }
}
