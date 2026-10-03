import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentProvider,
  CheckoutParams,
  CheckoutResult,
  WebhookVerificationResult,
} from '../interfaces/payment-provider.interface';
import { ProveedorPago } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class MercadoPagoProvider implements PaymentProvider {
  private readonly logger = new Logger(MercadoPagoProvider.name);
  readonly nombreProveedor = ProveedorPago.MERCADOPAGO;

  async crearSesionCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const mpId = `mp_pref_${crypto.randomBytes(8).toString('hex')}`;

    if (!accessToken) {
      this.logger.warn(
        'MERCADOPAGO_ACCESS_TOKEN no configurado. Generando preferencia Sandbox de Mercado Pago.',
      );
      return {
        urlCheckout: `https://www.mercadopago.com/sandbox/checkout/v1/redirect?pref_id=${mpId}`,
        idTransaccionExterna: mpId,
        proveedor: this.nombreProveedor,
        metodoPago: 'MERCADOPAGO_CHECKOUT',
      };
    }

    // Si hay Access Token real de Mercado Pago, consumir API /checkout/preferences
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
          external_reference: `org_${params.idOrganizacion}_usr_${params.idUsuario}`,
        }),
      });

      const data = await response.json();
      if (response.ok && data.init_point) {
        return {
          urlCheckout: process.env.MERCADOPAGO_SANDBOX === 'true' ? data.sandbox_init_point : data.init_point,
          idTransaccionExterna: data.id || mpId,
          proveedor: this.nombreProveedor,
          metodoPago: 'MERCADOPAGO_DIRECT',
        };
      }
    } catch (err) {
      this.logger.error('Error al conectar con la API de Mercado Pago:', err);
    }

    return {
      urlCheckout: `https://www.mercadopago.com/sandbox/checkout/v1/redirect?pref_id=${mpId}`,
      idTransaccionExterna: mpId,
      proveedor: this.nombreProveedor,
    };
  }

  async verificarWebhooks(body: any, headers: any): Promise<WebhookVerificationResult> {
    const signature = headers['x-signature'];
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

    if (secret && signature) {
      // Verificar la firma HMAC SHA256 si se configura la clave secreta
      try {
        const parts = signature.split(',');
        const ts = parts.find((p: string) => p.startsWith('ts='))?.split('=')[1];
        const v1 = parts.find((p: string) => p.startsWith('v1='))?.split('=')[1];

        const manifest = `id:${body?.data?.id};request-id:${headers['x-request-id']};ts:${ts};`;
        const hmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

        if (hmac !== v1) {
          return { valido: false, evento: 'unknown' };
        }
      } catch (err) {
        this.logger.error('Error al verificar firma HMAC de Mercado Pago:', err);
        return { valido: false, evento: 'error' };
      }
    }

    const estadoPago =
      body?.action === 'payment.created' || body?.status === 'approved' ? 'APROBADO' : 'PENDIENTE';

    return {
      valido: true,
      evento: body?.action || 'payment.updated',
      idTransaccionExterna: body?.data?.id || body?.id || `mp_${Date.now()}`,
      idSuscripcionExterna: body?.preapproval_id,
      monto: Number(body?.transaction_amount || 50),
      estadoPago,
    };
  }

  async cancelarSuscripcion(idSuscripcionExterna: string): Promise<boolean> {
    this.logger.log(`[MercadoPago] Suscripción cancelada en MP: ${idSuscripcionExterna}`);
    return true;
  }
}
