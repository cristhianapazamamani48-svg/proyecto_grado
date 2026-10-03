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
    const mpId = `mp_tx_${crypto.randomBytes(8).toString('hex')}`;

    if (!accessToken) {
      throw new Error('MercadoPago no está configurado (faltan credenciales). Selecciona el proveedor de prueba (MOCK_SANDBOX).');
    }

    try {
      const response = await fetch('https://api.mercadopago.com/preapproval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          reason: `Proyecto UUB - Plan ${params.plan}`,
          external_reference: mpId,
          payer_email: params.correoUsuario,
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: params.montoLocal || params.montoUsd,
            currency_id: params.monedaLocal || 'BOB',
          },
          back_url: params.urlRetornoSuccess,
          status: 'pending',
        }),
      });

      const data = await response.json();
      if (response.ok && data.init_point) {
        return {
          urlCheckout: process.env.MERCADOPAGO_SANDBOX === 'true' ? data.sandbox_init_point : data.init_point,
          idTransaccionExterna: mpId,
          proveedor: this.nombreProveedor,
          metodoPago: 'MERCADOPAGO_SUBSCRIPTION',
        };
      } else {
        throw new Error(`La API de Mercado Pago devolvió un error: ${JSON.stringify(data)}`);
      }
    } catch (err: any) {
      this.logger.error('Error al conectar con la API de Mercado Pago (preapproval):', err);
      throw new Error(`Fallo al crear la suscripción de Mercado Pago: ${err.message}`);
    }
  }

  async verificarWebhooks(body: any, headers: any): Promise<WebhookVerificationResult> {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const signature = headers['x-signature'] as string | undefined;

    if (!secret || !accessToken) {
      this.logger.error('[MercadoPago] Credenciales incompletas. Rechazando webhook.');
      return { valido: false, evento: 'config_error' };
    }
    if (!signature) {
      return { valido: false, evento: 'missing_signature' };
    }

    try {
      const parts = signature.split(',');
      const ts = parts.find((p) => p.startsWith('ts='))?.split('=')[1];
      const v1 = parts.find((p) => p.startsWith('v1='))?.split('=')[1];

      if (!ts || !v1) return { valido: false, evento: 'invalid_signature_format' };

      const manifest = `id:${body?.data?.id};request-id:${headers['x-request-id']};ts:${ts};`;
      const hmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
      const bufHmac = Buffer.from(hmac, 'hex');
      const bufV1 = Buffer.from(v1, 'hex');
      if (bufHmac.length !== bufV1.length || !crypto.timingSafeEqual(bufHmac, bufV1)) {
        return { valido: false, evento: 'invalid_signature' };
      }
    } catch (err) {
      return { valido: false, evento: 'signature_error' };
    }

    // El evento puede ser de pago o de suscripción. MP distingue entre:
    //   - type="subscription_preapproval": evento del acuerdo de suscripción (autorizado/cancelado)
    //   - type="subscription_authorized_payment" o type="payment": cobro individual (aprobado/rechazado)
    const id = body?.data?.id;
    if (!id) return { valido: false, evento: 'missing_id' };

    let estadoPago: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE' | 'CANCELADO' | 'SUSPENDIDO' = 'PENDIENTE';
    let monto: number = 0;
    let moneda: string = '';
    let motivoFallo: string | undefined;
    let idTransaccionExterna = String(id);
    let idSuscripcionExterna = String(id);
    let referenciaExternaOriginal: string | undefined;

    try {
      if (body?.type === 'subscription_preapproval') {
        // Evento del acuerdo de suscripción: creación o cancelación del acuerdo
        const apiRes = await fetch(`https://api.mercadopago.com/preapproval/${id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!apiRes.ok) return { valido: false, evento: 'api_error' };

        const sub = await apiRes.json();
        // "authorized" = acuerdo creado pero aún no hay cobro exitoso → PENDIENTE
        // "cancelled"  = suscripción cancelada externamente → CANCELADO (no rechaza TX, actualiza sub)
        if (sub.status === 'authorized') {
          estadoPago = 'PENDIENTE';
          // CRÍTICO: idTransaccionExterna = external_reference (el mp_tx_... guardado al crear la TX)
          // para que el servicio encuentre la TX pendiente del checkout y la rebindee.
          // idSuscripcionExterna = ID real del preapproval MP, que se usará como nuevo vínculo.
          idTransaccionExterna = sub.external_reference || String(id);
          idSuscripcionExterna  = String(id);
        } else if (sub.status === 'cancelled') {
          estadoPago = 'CANCELADO';
          motivoFallo = 'Suscripción cancelada desde Mercado Pago';
          // Para CANCELADO el servicio solo necesita idSuscripcionExterna para hallar suscripcionOrganizacion.
          idTransaccionExterna = String(id);
          idSuscripcionExterna  = String(id);
        }

        if (sub.auto_recurring) {
          monto = Number(sub.auto_recurring.transaction_amount);
          moneda = sub.auto_recurring.currency_id;
        } else {
          return { valido: false, evento: 'missing_amount_from_api' };
        }

      } else {
        // Cobro individual: puede ser subscription_authorized_payment o un pago regular
        const esCobroSuscripcion = body?.type === 'subscription_authorized_payment';
        const endpoint = esCobroSuscripcion
          ? `https://api.mercadopago.com/authorized_payments/${id}`
          : `https://api.mercadopago.com/v1/payments/${id}`;

        const apiRes = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!apiRes.ok) return { valido: false, evento: 'api_error' };

        const pago = await apiRes.json();

        if (pago.status === 'approved') estadoPago = 'APROBADO';
        else if (pago.status === 'rejected' || pago.status === 'cancelled') {
          estadoPago = 'RECHAZADO';
          motivoFallo = pago.status_detail || pago.status;
        }

        if (pago.transaction_amount === undefined || pago.transaction_amount === null) {
          return { valido: false, evento: 'missing_amount_from_api' };
        }
        if (!pago.currency_id) return { valido: false, evento: 'missing_currency_from_api' };

        monto = Number(pago.transaction_amount);
        moneda = pago.currency_id;

        // CRÍTICO: idTransaccionExterna = ID del cobro individual
        idTransaccionExterna = String(id);

        // idSuscripcionExterna = preapproval_id del cobro (enlaza con la suscripción maestra)
        idSuscripcionExterna = pago.preapproval_id || body?.preapproval_id || String(id);
        
        // Referencia original para solucionar desorden temporal (si el cobro llega antes que el preapproval)
        referenciaExternaOriginal = pago.external_reference;
      }

      return {
        valido: true,
        evento: body?.action || body?.type || 'payment.updated',
        idTransaccionExterna,
        idSuscripcionExterna,
        monto,
        moneda,
        estadoPago,
        motivoFallo,
        referenciaExternaOriginal,
      };
    } catch (err) {
      this.logger.error('[MercadoPago] Error al consultar API:', err);
      return { valido: false, evento: 'api_error' };
    }
  }

  async cancelarSuscripcion(idSuscripcionExterna: string): Promise<boolean> {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) return false;

    try {
      const response = await fetch(`https://api.mercadopago.com/preapproval/${idSuscripcionExterna}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      return response.ok;
    } catch (err) {
      this.logger.error(`[MercadoPago] Error cancelando suscripción ${idSuscripcionExterna}:`, err);
      return false;
    }
  }
}
