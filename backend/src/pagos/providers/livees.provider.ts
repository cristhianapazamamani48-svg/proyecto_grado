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
 * Proveedor de Pagos Livees Checkout para Bolivia.
 *
 * Soporta cobros en Bolivianos (BOB) mediante:
 * - QR Simple interoperable (Banco Unión, BCP, BNB, Ganadero, Mercantil Santa Cruz, etc.)
 * - Billeteras móviles y aplicaciones (Yape BCP, Yolo Pago Banco Ganadero, Altoke Banco Sol, Tigo Money)
 * - Tarjetas de débito y crédito nacionales e internacionales (Visa, Mastercard, Amex)
 *
 * Configuración requerida en variables de entorno:
 * - LIVEES_MERCHANT_TOKEN: Token de comercio provisto por Livees.
 * - LIVEES_RESOURCE_KEY: Clave de recurso o API Key de Livees.
 * - LIVEES_WEBHOOK_SECRET: Secreto para validar firma criptográfica HMAC de notificaciones entrantes.
 * - LIVEES_API_URL: (Opcional) URL base de API Livees (default: https://api.livees.net/v1).
 */
@Injectable()
export class LiveesProvider implements PaymentProvider {
  private readonly logger = new Logger(LiveesProvider.name);
  readonly nombreProveedor = ProveedorPago.LIVEES;

  private get apiUrl(): string {
    return process.env.LIVEES_API_URL || 'https://api.livees.net/v1';
  }

  async crearSesionCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const merchantToken = process.env.LIVEES_MERCHANT_TOKEN;
    const resourceKey = process.env.LIVEES_RESOURCE_KEY;
    const isProd = process.env.NODE_ENV === 'production';

    // Generar ID único local para correlación de checkout en Bolivia
    const liveesRef = `livees_${params.idOrganizacion}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const montoBob = params.montoLocal ?? 50.0;

    // Si faltan credenciales
    if (!merchantToken || !resourceKey) {
      if (isProd) {
        throw new Error(
          'Livees Checkout no está configurado (faltan LIVEES_MERCHANT_TOKEN o LIVEES_RESOURCE_KEY en producción).'
        );
      }

      // En desarrollo / staging sin credenciales aún negociadas, simulamos la pasarela con fallback guiado
      this.logger.warn(
        `[Livees Checkout] Credenciales no configuradas. Generando sesión de checkout demostrativa para Org ${params.idOrganizacion} en BOB.`
      );

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
      return {
        urlCheckout: `${frontendUrl}/docente/organizacion?tab=suscripcion&livees_ref=${liveesRef}&monto=${montoBob}`,
        idTransaccionExterna: liveesRef,
        proveedor: this.nombreProveedor,
        metodoPago: 'LIVEES_QR_BOLIVIA',
      };
    }

    try {
      // Iniciar sesión con la API de Livees Checkout
      const res = await fetch(`${this.apiUrl}/checkout/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
          'X-Resource-Key': resourceKey,
        },
        body: JSON.stringify({
          external_reference: liveesRef,
          amount: montoBob,
          currency: 'BOB',
          description: `Suscripción Mensual Plan Maestro Pro - Proyecto UUB (Org ${params.idOrganizacion})`,
          customer: {
            name: params.nombreUsuario,
            email: params.correoUsuario,
          },
          supported_methods: ['QR_SIMPLE', 'YAPE', 'YOLO', 'ALTOKE', 'CREDIT_DEBIT_CARD'],
          success_url: params.urlRetornoSuccess,
          cancel_url: params.urlRetornoCancel,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        this.logger.error(`Livees API error HTTP ${res.status}: ${errorText}`);
        throw new Error(`Error en pasarela Livees (${res.status}): No se pudo iniciar el checkout.`);
      }

      const data = await res.json();
      const checkoutUrl = data.checkout_url || data.payment_url || data.url;
      const transaccionId = data.session_id || data.id || liveesRef;

      if (!checkoutUrl) {
        throw new Error('Livees Checkout no retornó la URL de pago.');
      }

      this.logger.log(`[Livees Checkout] Sesión creada con éxito: ${transaccionId}`);

      return {
        urlCheckout: checkoutUrl,
        idTransaccionExterna: String(transaccionId),
        proveedor: this.nombreProveedor,
        metodoPago: data.payment_method || 'LIVEES_BOLIVIA_MULTI',
      };
    } catch (err: any) {
      this.logger.error(`Error al conectar con Livees Checkout: ${err.message}`);
      throw err;
    }
  }

  async verificarWebhooks(body: any, headers: any, rawBody?: Buffer | string): Promise<WebhookVerificationResult> {
    const webhookSecret = process.env.LIVEES_WEBHOOK_SECRET;

    if (!webhookSecret) {
      this.logger.error('[Livees Checkout] LIVEES_WEBHOOK_SECRET no configurado. Rechazando webhook.');
      return { valido: false, evento: 'config_error' };
    }

    // Validación de firma HMAC: OBLIGATORIA (evita bypass de firma omitiendo la cabecera)
    const firmaRecibida = headers['x-livees-signature'] || headers['x-signature'] || body?.signature;

    if (!firmaRecibida) {
      this.logger.warn('[Livees Checkout] Webhook recibido sin firma requerida. Rechazado.');
      return { valido: false, evento: 'missing_signature' };
    }

    try {
      // Priorizar el rawBody (Buffer/string original sin re-parsear)
      let payloadParaFirma: Buffer | string;
      if (rawBody) {
        payloadParaFirma = rawBody;
      } else if (typeof body === 'string') {
        payloadParaFirma = body;
      } else {
        payloadParaFirma = JSON.stringify(body);
      }

      const hmacEsperado = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadParaFirma)
        .digest('hex');

      const bufEsperado = Buffer.from(hmacEsperado);
      const bufRecibido = Buffer.from(firmaRecibida);

      if (bufEsperado.length !== bufRecibido.length || !crypto.timingSafeEqual(bufEsperado, bufRecibido)) {
        this.logger.warn('[Livees Checkout] Firma de webhook inválida.');
        return { valido: false, evento: 'invalid_signature' };
      }
    } catch (err) {
      this.logger.warn('[Livees Checkout] Error al verificar firma HMAC:', err);
      return { valido: false, evento: 'invalid_signature' };
    }

    // Normalizar evento y estado
    // Livees envía eventos tipo: 'payment.completed', 'payment.success', 'payment.failed', 'qr.paid'
    const evento = body?.event || body?.type || 'payment.updated';
    const status = (body?.status || body?.data?.status || '').toUpperCase();
    const idTransaccion = String(body?.transaction_id || body?.data?.id || body?.id || '');
    const referenciaOriginal = body?.external_reference || body?.data?.external_reference;

    // Importes
    const rawMonto = body?.amount ?? body?.data?.amount;
    const monto = rawMonto !== undefined ? Number(rawMonto) : undefined;
    const moneda = (body?.currency || body?.data?.currency || 'BOB').toUpperCase();

    let estadoPago: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE' | 'CANCELADO' | 'SUSPENDIDO' = 'PENDIENTE';

    if (['COMPLETED', 'PAID', 'SUCCESS', 'APROBADO'].includes(status) || evento === 'qr.paid' || evento === 'payment.completed') {
      estadoPago = 'APROBADO';
    } else if (['FAILED', 'REJECTED', 'RECHAZADO', 'EXPIRED'].includes(status)) {
      estadoPago = 'RECHAZADO';
    } else if (['CANCELLED', 'CANCELED'].includes(status)) {
      estadoPago = 'CANCELADO';
    }

    return {
      valido: true,
      evento,
      idTransaccionExterna: idTransaccion || referenciaOriginal,
      idSuscripcionExterna: body?.subscription_id || body?.data?.subscription_id,
      referenciaExternaOriginal: referenciaOriginal,
      monto,
      moneda,
      estadoPago,
      motivoFallo: body?.error_message || body?.data?.failure_reason,
    };
  }

  async cancelarSuscripcion(idSuscripcionExterna: string): Promise<boolean> {
    const merchantToken = process.env.LIVEES_MERCHANT_TOKEN;
    if (!merchantToken) {
      this.logger.warn('[Livees Checkout] Sin credenciales para cancelar remotamente en Livees. Marcando local.');
      return true;
    }

    try {
      const res = await fetch(`${this.apiUrl}/subscriptions/${idSuscripcionExterna}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${merchantToken}`,
        },
      });
      return res.ok;
    } catch (err: any) {
      this.logger.error(`Error al cancelar en Livees Checkout: ${err.message}`);
      return false;
    }
  }
}
