import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ProveedorPago } from '@prisma/client';
import {
  CheckoutParams,
  CheckoutResult,
  PaymentProvider,
  WebhookVerificationResult,
} from '../interfaces/payment-provider.interface';

type DeudaLibelula = {
  pagado?: boolean;
  valor_total?: string | number;
  moneda?: string;
  deuda_expirada?: boolean;
  facturas?: Array<{ numero_factura?: string; url?: string; invoice_id?: string }>;
};

@Injectable()
export class LibelulaProvider implements PaymentProvider, OnModuleInit {
  private readonly logger = new Logger(LibelulaProvider.name);
  readonly nombreProveedor = ProveedorPago.LIBELULA;

  private get apiUrl() {
    return (process.env.LIBELULA_API_URL || 'https://api.libelula.bo').replace(/\/$/, '');
  }

  onModuleInit() {
    if ((process.env.PAYMENT_PROVIDER || '').toUpperCase() === ProveedorPago.LIBELULA && !process.env.LIBELULA_APPKEY) {
      throw new Error('PAYMENT_PROVIDER=LIBELULA requiere LIBELULA_APPKEY.');
    }
  }

  private appkey(): string {
    if (!process.env.LIBELULA_APPKEY) {
      throw new Error('Libélula no está configurado: falta LIBELULA_APPKEY.');
    }
    return process.env.LIBELULA_APPKEY;
  }

  async crearSesionCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    if (!params.identificadorDeuda || !params.callbackUrl) {
      throw new Error('No se pudo preparar la referencia segura para el cobro Libélula.');
    }
    const dias = Number(process.env.LIBELULA_DEUDA_DIAS || 3);
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + (Number.isFinite(dias) && dias > 0 ? dias : 3));
    const fechaVencimiento = fecha.toISOString().slice(0, 10);
    const payload: Record<string, unknown> = {
      appkey: this.appkey(),
      email_cliente: params.correoUsuario,
      identificador_deuda: params.identificadorDeuda,
      // El manual muestra ambos nombres; se mandan iguales hasta confirmación del proveedor.
      identificador: params.identificadorDeuda,
      fecha_vencimiento: fechaVencimiento,
      descripcion: `Evalúa UUB - ${params.plan}`,
      callback_url: params.callbackUrl,
      url_retorno: params.urlRetornoSuccess,
      nombre_cliente: params.nombreUsuario,
      moneda: 'BOB',
      lineas_detalle_deuda: [{
        concepto: `Evalúa UUB - ${params.plan} (${params.periodoMeses || 1} mes(es))`,
        cantidad: 1,
        costo_unitario: params.montoLocal,
      }],
      emite_factura: params.emiteFactura === true,
    };
    if (params.emiteFactura) payload.tipo_factura = 'Servicios';

    let response: Response;
    try {
      response = await fetch(`${this.apiUrl}/rest/deuda/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error('No se pudo conectar con Libélula para registrar la deuda.');
    }
    if (!response.ok) throw new Error(`Libélula no pudo registrar la deuda (HTTP ${response.status}).`);
    const data: any = await response.json();
    if (data?.error !== 0 && data?.error !== false) {
      throw new Error(data?.mensaje || 'Libélula rechazó el registro de la deuda.');
    }
    if (!data?.id_transaccion || !data?.url_pasarela_pagos) {
      throw new Error('Libélula no devolvió los datos necesarios para el pago.');
    }
    return {
      urlCheckout: String(data.url_pasarela_pagos),
      idTransaccionExterna: String(data.id_transaccion),
      proveedor: this.nombreProveedor,
      metodoPago: 'LIBELULA',
      qrSimpleUrl: data.qr_simple_url ? String(data.qr_simple_url) : undefined,
    };
  }

  async consultarDeuda(identificador: string): Promise<DeudaLibelula> {
    let response: Response;
    try {
      response = await fetch(`${this.apiUrl}/rest/deuda/consultar_deudas/por_identificador`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appkey: this.appkey(), identificador }),
      });
    } catch {
      throw new Error('No se pudo consultar el estado de la deuda en Libélula.');
    }
    if (!response.ok) throw new Error(`Libélula no pudo consultar la deuda (HTTP ${response.status}).`);
    const data: any = await response.json();
    if (data?.error !== 0 && data?.error !== false) throw new Error(data?.mensaje || 'Libélula rechazó la consulta de deuda.');
    return data?.datos || {};
  }

  async verificarWebhooks(_body: any, _headers: any, _rawBody?: Buffer | string): Promise<WebhookVerificationResult> {
    // Libélula usa un callback GET sin firma. El servicio verifica la deuda por API
    // y exige el token aleatorio local antes de invocar el pipeline de pago.
    return { valido: false, evento: 'libelula_requires_debt_verification' };
  }

  async cancelarSuscripcion(_idSuscripcionExterna: string): Promise<boolean> {
    this.logger.warn('Libélula registra deudas de pago único; no hay suscripción remota que cancelar.');
    return true;
  }
}
