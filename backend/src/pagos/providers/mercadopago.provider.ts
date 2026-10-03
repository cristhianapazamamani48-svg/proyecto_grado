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
 * MercadoPago Provider
 *
 * Webhook security model:
 *  1. Validate HMAC-SHA256 signature (x-signature header) against MERCADOPAGO_WEBHOOK_SECRET.
 *  2. Extract the payment ID from the webhook body.
 *  3. Call the MP Payments API to get authoritative status, amount, and currency.
 *  4. Return estado/monto/moneda from the API — never trust optional webhook body fields.
 *
 * No real payments are enabled until MERCADOPAGO_ACCESS_TOKEN is set.
 */
@Injectable()
export class MercadoPagoProvider implements PaymentProvider {
  private readonly logger = new Logger(MercadoPagoProvider.name);
  readonly nombreProveedor = ProveedorPago.MERCADOPAGO;

  async crearSesionCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    // Generar un ID único que usaremos como external_reference y idTransaccionExterna local
    const mpId = `mp_tx_${crypto.randomBytes(8).toString('hex')}`;

    if (!accessToken) {
      throw new Error('MercadoPago no está configurado (faltan credenciales). Selecciona el proveedor de prueba (MOCK_SANDBOX).');
    }

    try {
      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          items: [
            {
              title: `Proyecto UUB - Plan ${params.plan}`,
              quantity: 1,
              unit_price: params.montoLocal || params.montoUsd,
              currency_id: params.monedaLocal || 'BOB',
            },
          ],
          payer: {
            email: params.correoUsuario,
            name: params.nombreUsuario,
          },
          back_urls: {
            success: params.urlRetornoSuccess,
            failure: params.urlRetornoCancel,
            pending: params.urlRetornoSuccess,
          },
          auto_return: 'approved',
          external_reference: mpId, // Pasar nuestro ID como referencia externa
        }),
      });

      const data = await response.json();
      if (response.ok && data.init_point) {
        return {
          urlCheckout: process.env.MERCADOPAGO_SANDBOX === 'true' ? data.sandbox_init_point : data.init_point,
          idTransaccionExterna: mpId, // Usar nuestro ID, no el de la preferencia (data.id)
          proveedor: this.nombreProveedor,
          metodoPago: 'MERCADOPAGO_DIRECT',
        };
      } else {
        throw new Error(`La API de Mercado Pago devolvió un error: ${JSON.stringify(data)}`);
      }
    } catch (err: any) {
      this.logger.error('Error al conectar con la API de Mercado Pago:', err);
      throw new Error(`Fallo al crear la preferencia de Mercado Pago: ${err.message}`);
    }
  }

  async verificarWebhooks(body: any, headers: any): Promise<WebhookVerificationResult> {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const signature = headers['x-signature'] as string | undefined;

    // Tanto el secreto de webhook como el token de acceso son obligatorios
    if (!secret) {
      this.logger.error('[MercadoPago] MERCADOPAGO_WEBHOOK_SECRET no configurado. Rechazando webhook.');
      return { valido: false, evento: 'config_error' };
    }
    if (!accessToken) {
      this.logger.error('[MercadoPago] MERCADOPAGO_ACCESS_TOKEN no configurado. No se puede consultar la API para verificar. Rechazando webhook.');
      return { valido: false, evento: 'config_error' };
    }

    // La firma x-signature es siempre obligatoria
    if (!signature) {
      this.logger.warn('[MercadoPago] Webhook recibido sin cabecera x-signature. Rechazando.');
      return { valido: false, evento: 'missing_signature' };
    }

    // Verificar la firma HMAC SHA256
    try {
      const parts = signature.split(',');
      const ts = parts.find((p) => p.startsWith('ts='))?.split('=')[1];
      const v1 = parts.find((p) => p.startsWith('v1='))?.split('=')[1];

      if (!ts || !v1) {
        this.logger.warn('[MercadoPago] Formato de x-signature inválido. Rechazando.');
        return { valido: false, evento: 'invalid_signature_format' };
      }

      const manifest = `id:${body?.data?.id};request-id:${headers['x-request-id']};ts:${ts};`;
      const hmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

      // timingSafeEqual requiere igual longitud — v1 siempre es hex de 64 chars,
      // hmac también; si difieren en longitud ya es inválido
      const bufHmac = Buffer.from(hmac, 'hex');
      const bufV1 = Buffer.from(v1, 'hex');
      if (bufHmac.length !== bufV1.length || !crypto.timingSafeEqual(bufHmac, bufV1)) {
        this.logger.warn('[MercadoPago] Firma HMAC no coincide. Webhook rechazado.');
        return { valido: false, evento: 'invalid_signature' };
      }
    } catch (err) {
      this.logger.error('[MercadoPago] Error al verificar firma HMAC:', err);
      return { valido: false, evento: 'signature_error' };
    }

    // ── Consultar la API oficial de MP para obtener estado autoritativo ──
    const pagoId = body?.data?.id;
    if (!pagoId) {
      this.logger.warn('[MercadoPago] Webhook sin ID de pago en body.data.id. Rechazando.');
      return { valido: false, evento: 'missing_payment_id' };
    }

    let estadoPago: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE';
    let monto: number;
    let moneda: string;
    let motivoFallo: string | undefined;

    try {
      const apiRes = await fetch(`https://api.mercadopago.com/v1/payments/${pagoId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!apiRes.ok) {
        this.logger.error(`[MercadoPago] API de pagos devolvió ${apiRes.status} para pago ${pagoId}.`);
        return { valido: false, evento: 'api_error' };
      }

      const pago = await apiRes.json();

      // Determinar estado solo desde la API — nunca del body del webhook
      if (pago.status === 'approved') {
        estadoPago = 'APROBADO';
      } else if (pago.status === 'rejected' || pago.status === 'cancelled') {
        estadoPago = 'RECHAZADO';
        motivoFallo = pago.status_detail || pago.status;
      } else {
        estadoPago = 'PENDIENTE';
      }

      // Monto y moneda de la API (obligatorios para aprobar)
      if (pago.transaction_amount === undefined || pago.transaction_amount === null) {
        this.logger.error(`[MercadoPago] API no devolvió transaction_amount para pago ${pagoId}.`);
        return { valido: false, evento: 'missing_amount_from_api' };
      }
      if (!pago.currency_id) {
        this.logger.error(`[MercadoPago] API no devolvió currency_id para pago ${pagoId}.`);
        return { valido: false, evento: 'missing_currency_from_api' };
      }
      monto = Number(pago.transaction_amount);
      moneda = pago.currency_id as string;
      
      return {
        valido: true,
        evento: body?.action || 'payment.updated',
        idTransaccionExterna: pago.external_reference || String(pagoId),
        idSuscripcionExterna: body?.preapproval_id,
        monto,
        moneda,
        estadoPago,
        motivoFallo,
      };
    } catch (err) {
      this.logger.error('[MercadoPago] Error al consultar API de pagos:', err);
      return { valido: false, evento: 'api_error' };
    }
  }

  async cancelarSuscripcion(idSuscripcionExterna: string): Promise<boolean> {
    this.logger.log(`[MercadoPago] Suscripción cancelada en MP: ${idSuscripcionExterna}`);
    return true;
  }
}
