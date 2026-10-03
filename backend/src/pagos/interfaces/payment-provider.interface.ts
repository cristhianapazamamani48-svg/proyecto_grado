import { ProveedorPago, TipoPlan } from '@prisma/client';

export interface CheckoutParams {
  idOrganizacion: number;
  idUsuario: number;
  plan: TipoPlan;
  montoUsd: number;
  montoLocal?: number;
  monedaLocal?: string;
  correoUsuario: string;
  nombreUsuario: string;
  urlRetornoSuccess: string;
  urlRetornoCancel: string;
}

export interface CheckoutResult {
  urlCheckout: string;
  idTransaccionExterna: string;
  proveedor: ProveedorPago;
  metodoPago?: string;
}

export interface WebhookVerificationResult {
  valido: boolean;
  evento: string;
  idTransaccionExterna?: string;
  idSuscripcionExterna?: string;
  /** Monto reportado por el proveedor. SIEMPRE acompañado de 'moneda'. */
  monto?: number;
  /** Moneda ISO-4217 del monto reportado (USD, BOB, etc.). Requerido si monto está presente. */
  moneda?: string;
  estadoPago?: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE';
  motivoFallo?: string;
}

export interface PaymentProvider {
  nombreProveedor: ProveedorPago;
  crearSesionCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  verificarWebhooks(body: any, headers: any): Promise<WebhookVerificationResult>;
  cancelarSuscripcion(idSuscripcionExterna: string): Promise<boolean>;
}
