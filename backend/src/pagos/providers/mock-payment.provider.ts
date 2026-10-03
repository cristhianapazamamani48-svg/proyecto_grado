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
    const tokenPrueba = headers['x-mock-signature'] || body?.tokenSimulacion;
    const esValido = tokenPrueba !== 'INVALID';

    return {
      valido: esValido,
      evento: body?.evento || 'payment.approved',
      idTransaccionExterna: body?.idTransaccionExterna || `mock_tx_${Date.now()}`,
      idSuscripcionExterna: body?.idSuscripcionExterna || `mock_sub_${Date.now()}`,
      monto: body?.monto || 50,
      estadoPago: body?.estadoPago || 'APROBADO',
      motivoFallo: body?.motivoFallo,
    };
  }

  async cancelarSuscripcion(idSuscripcionExterna: string): Promise<boolean> {
    this.logger.log(`[MockPaymentSandbox] Suscripción simulada cancelada: ${idSuscripcionExterna}`);
    return true;
  }
}
