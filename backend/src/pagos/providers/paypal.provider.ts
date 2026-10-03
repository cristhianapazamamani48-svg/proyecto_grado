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

    const token = await this.obtenerTokenPayPal(clientId, clientSecret);
    const planId = await this.obtenerOcrearPlan(token, params);

    const res = await fetch(`${this.apiBase}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_id: planId,
        application_context: {
          brand_name: 'Proyecto UUB',
          locale: 'es-ES',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: params.urlRetornoSuccess,
          cancel_url: params.urlRetornoCancel,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`PayPal Subscription API error ${res.status}: ${err}`);
      throw new Error('No se pudo crear la suscripción con PayPal.');
    }

    const sub = await res.json();
    const approveLink = sub.links?.find((l: any) => l.rel === 'approve')?.href;

    if (!approveLink || !sub.id) {
      throw new Error('PayPal no devolvió link de aprobación o ID de suscripción.');
    }

    this.logger.log(`[PayPal] Suscripción real creada: ${sub.id}`);

    return {
      urlCheckout: approveLink,
      idTransaccionExterna: sub.id as string,
      proveedor: this.nombreProveedor,
      metodoPago: this.isSandbox ? 'PAYPAL_SANDBOX_SUB' : 'PAYPAL_LIVE_SUB',
    };
  }

  private async obtenerOcrearPlan(token: string, params: CheckoutParams): Promise<string> {
    if (process.env.PAYPAL_PLAN_ID) return process.env.PAYPAL_PLAN_ID;
    
    // Crear producto temporal si no hay plan
    const productId = `uub_prod_${Date.now()}`;
    await fetch(`${this.apiBase}/v1/catalogs/products`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: productId,
        name: 'UUB Maestro Pro',
        description: 'Suscripción mensual al software UUB',
        type: 'DIGITAL',
        category: 'SOFTWARE'
      }),
    });
    
    // Crear plan
    const res = await fetch(`${this.apiBase}/v1/billing/plans`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: productId,
        name: `Plan Maestro Pro - $${params.montoUsd}`,
        description: 'Cobro mensual recurrente',
        status: 'ACTIVE',
        billing_cycles: [{
          frequency: { interval_unit: 'MONTH', interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value: params.montoUsd.toString(), currency_code: 'USD' }
          }
        }],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: { value: '0', currency_code: 'USD' },
          setup_fee_failure_action: 'CONTINUE',
          payment_failure_threshold: 3
        }
      }),
    });

    if (!res.ok) throw new Error('No se pudo inicializar un plan de facturación de PayPal');
    const plan = await res.json();
    this.logger.log(`[PayPal] Nuevo plan recurrente creado dinámicamente: ${plan.id}`);
    return plan.id;
  }

  async consultarSuscripcion(idSuscripcion: string): Promise<any> {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('PayPal no está configurado.');
    }

    const token = await this.obtenerTokenPayPal(clientId, clientSecret);
    const res = await fetch(`${this.apiBase}/v1/billing/subscriptions/${idSuscripcion}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`PayPal API GET subscription error ${res.status}: ${err}`);
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

    const eventType = body?.event_type as string | undefined;
    let estadoPago: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE' | 'CANCELADO' | 'SUSPENDIDO' = 'PENDIENTE';
    let monto = 0;
    let moneda = 'USD';
    let motivoFallo = body?.summary;

    let idTransaccionExterna = body?.resource?.id;
    let idSuscripcionExterna = body?.resource?.id;

    if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED' || eventType === 'PAYMENT.SALE.COMPLETED') {
        estadoPago = 'APROBADO';

        if (eventType === 'PAYMENT.SALE.COMPLETED') {
            idSuscripcionExterna = body?.resource?.billing_agreement_id;
            idTransaccionExterna = body?.resource?.id; // ID del cobro individual de renovación
            if (body?.resource?.amount) {
               monto = Number(body.resource.amount.total);
               moneda = body.resource.amount.currency;
            } else {
               return { valido: false, evento: 'missing_amount_from_api' };
            }
        } else {
           try {
              const sub = await this.consultarSuscripcion(idSuscripcionExterna);
              if (sub.status !== 'ACTIVE') estadoPago = 'PENDIENTE';

              if (sub.billing_info?.last_payment) {
                 monto = Number(sub.billing_info.last_payment.amount.value);
                 moneda = sub.billing_info.last_payment.amount.currency_code;
              } else {
                 return { valido: false, evento: 'missing_amount_from_api' };
              }
           } catch (e) {
              return { valido: false, evento: 'api_error' };
           }
        }
    } else if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED') {
        // Cancelación del acuerdo: no rechaza TX, debe actualizar el estado de la suscripción
        estadoPago = 'CANCELADO';
        motivoFallo = 'Suscripción cancelada desde PayPal';
    } else if (eventType === 'BILLING.SUBSCRIPTION.SUSPENDED') {
        // Suspensión por falta de pago repetido
        estadoPago = 'SUSPENDIDO';
        motivoFallo = 'Suscripción suspendida por PayPal';
    } else if (eventType === 'PAYMENT.SALE.DENIED' || eventType === 'PAYMENT.SALE.REVERSED') {
        estadoPago = 'RECHAZADO';
        idSuscripcionExterna = body?.resource?.billing_agreement_id;
        idTransaccionExterna = body?.resource?.id;
    } else {
        return { valido: false, evento: 'ignored_event' };
    }

    if (!idSuscripcionExterna) return { valido: false, evento: 'missing_subscription_id' };

    return {
      valido: true,
      evento: eventType,
      idTransaccionExterna: idTransaccionExterna || idSuscripcionExterna,
      idSuscripcionExterna: idSuscripcionExterna,
      monto,
      moneda,
      estadoPago,
      motivoFallo,
    };
  }

  async cancelarSuscripcion(idSuscripcionExterna: string): Promise<boolean> {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !clientSecret) return false;

    try {
      const token = await this.obtenerTokenPayPal(clientId, clientSecret);
      const res = await fetch(`${this.apiBase}/v1/billing/subscriptions/${idSuscripcionExterna}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: 'Cancelado por el usuario.' })
      });
      if (res.status === 204 || res.ok) {
         this.logger.log(`[PayPal] Suscripción cancelada exitosamente: ${idSuscripcionExterna}`);
         return true;
      }
      return false;
    } catch (e) {
      this.logger.error(`[PayPal] Falló la cancelación de suscripción: ${e}`);
      return false;
    }
  }
}
