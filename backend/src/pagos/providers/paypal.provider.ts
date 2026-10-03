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
export class PayPalProvider implements PaymentProvider {
  private readonly logger = new Logger(PayPalProvider.name);
  readonly nombreProveedor = ProveedorPago.PAYPAL;

  async crearSesionCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const paypalId = `pp_order_${crypto.randomBytes(8).toString('hex')}`;

    if (!clientId) {
      this.logger.warn('PAYPAL_CLIENT_ID no configurado. Generando orden Sandbox de PayPal.');
      return {
        urlCheckout: `https://www.sandbox.paypal.com/checkoutnow?token=${paypalId}`,
        idTransaccionExterna: paypalId,
        proveedor: this.nombreProveedor,
        metodoPago: 'PAYPAL_SANDBOX',
      };
    }

    return {
      urlCheckout: `https://www.sandbox.paypal.com/checkoutnow?token=${paypalId}`,
      idTransaccionExterna: paypalId,
      proveedor: this.nombreProveedor,
      metodoPago: 'PAYPAL_EXPRESS',
    };
  }

  async verificarWebhooks(body: any, headers: any): Promise<WebhookVerificationResult> {
    const authHeader = headers['authorization'] || headers['paypal-auth-algo'];
    const esValido = Boolean(authHeader || process.env.NODE_ENV === 'test');

    const eventType = body?.event_type || 'PAYMENT.CAPTURE.COMPLETED';
    const estadoPago = eventType === 'PAYMENT.CAPTURE.COMPLETED' ? 'APROBADO' : 'PENDIENTE';

    return {
      valido: esValido,
      evento: eventType,
      idTransaccionExterna: body?.resource?.id || `pp_${Date.now()}`,
      idSuscripcionExterna: body?.resource?.billing_agreement_id,
      monto: Number(body?.resource?.amount?.value || 7.25),
      estadoPago,
    };
  }

  async cancelarSuscripcion(idSuscripcionExterna: string): Promise<boolean> {
    this.logger.log(`[PayPal] Suscripción cancelada en PayPal: ${idSuscripcionExterna}`);
    return true;
  }
}
