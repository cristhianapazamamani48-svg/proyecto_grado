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
export class MockPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);
  readonly nombreProveedor = ProveedorPago.MOCK_SANDBOX;

  async crearSesionCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const mockId = `mock_tx_${crypto.randomBytes(8).toString('hex')}`;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
    const urlCheckout = `${frontendUrl}/docente/organizacion?tab=suscripcion&mock_checkout=${mockId}&plan=${params.plan}`;

    this.logger.log(
      `[MockPaymentSandbox] Sesión de checkout simulada generada para Org ${params.idOrganizacion} (${params.plan}) -> ID: ${mockId}`,
    );

    return {
      urlCheckout,
      idTransaccionExterna: mockId,
      proveedor: this.nombreProveedor,
      metodoPago: 'MOCK_SANDBOX_CARD',
    };
  }

  async verificarWebhooks(body: any, headers: any): Promise<WebhookVerificationResult> {
    const isProd = process.env.NODE_ENV === 'production';

    // MOCK_SANDBOX completamente deshabilitado en producción
    if (isProd) {
      this.logger.error('[MockPaymentSandbox] Intento de webhook mock en PRODUCCIÓN. Rechazado.');
      return { valido: false, evento: 'rejected' };
    }

    const tokenEsperado = process.env.MOCK_WEBHOOK_SECRET;

    // En cualquier entorno no-producción, el secreto sigue siendo obligatorio.
    if (!tokenEsperado) {
      this.logger.error('[MockPaymentSandbox] MOCK_WEBHOOK_SECRET no está configurado. Rechazando webhook.');
      return { valido: false, evento: 'config_error' };
    }

    const tokenPrueba: string | undefined = headers['x-mock-signature'] ?? body?.tokenSimulacion;

    // No registrar el valor recibido para evitar exposición en logs
    if (!tokenPrueba) {
      this.logger.warn('[MockPaymentSandbox] Firma/token ausente.');
      return { valido: false, evento: 'rejected' };
    }

    // timingSafeEqual REQUIERE que ambos buffers tengan la misma longitud.
    // Si difieren, la firma ya es inválida — no lanzar TypeError (error 500).
    const bufEsperado = Buffer.from(tokenEsperado);
    const bufPrueba = Buffer.from(tokenPrueba);

    if (bufEsperado.length !== bufPrueba.length || !crypto.timingSafeEqual(bufEsperado, bufPrueba)) {
      this.logger.warn('[MockPaymentSandbox] Firma/token inválido.');
      return { valido: false, evento: 'rejected' };
    }

    // Para el Mock, el monto y moneda DEBEN estar presentes en el body;
    // nunca se asumen valores por defecto que podrían enmascarar errores.
    if (body?.monto === undefined || body?.monto === null) {
      this.logger.warn('[MockPaymentSandbox] Webhook mock sin campo monto. Rechazando.');
      return { valido: false, evento: 'missing_monto' };
    }

    return {
      valido: true,
      evento: body?.evento || 'payment.approved',
      idTransaccionExterna: body?.idTransaccionExterna,
      idSuscripcionExterna: body?.idSuscripcionExterna || `mock_sub_${Date.now()}`,
      monto: Number(body.monto),
      moneda: (body?.moneda as string | undefined) || 'BOB',
      estadoPago: body?.estadoPago || 'APROBADO',
      motivoFallo: body?.motivoFallo,
    };
  }

  async cancelarSuscripcion(idSuscripcionExterna: string): Promise<boolean> {
    this.logger.log(`[MockPaymentSandbox] Suscripción simulada cancelada: ${idSuscripcionExterna}`);
    return true;
  }
}
