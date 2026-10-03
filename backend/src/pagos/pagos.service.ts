import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { MercadoPagoProvider } from './providers/mercadopago.provider';
import { PayPalProvider } from './providers/paypal.provider';
import { PaymentProvider, CheckoutParams } from './interfaces/payment-provider.interface';
import {
  ProveedorPago,
  TipoPlan,
  EstadoSuscripcion,
  EstadoPagoTransaccion,
} from '@prisma/client';

const PRECIOS_PLANES: Record<TipoPlan, { usd: number; bob: number }> = {
  GRATUITO: { usd: 0, bob: 0 },
  MAESTRO_PRO: { usd: 7.25, bob: 50 },
  BASICO: { usd: 29, bob: 200 },
  INSTITUCIONAL: { usd: 99, bob: 690 },
};

@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);
  private providers: Map<ProveedorPago, PaymentProvider> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mockProvider: MockPaymentProvider,
    private readonly mpProvider: MercadoPagoProvider,
    private readonly paypalProvider: PayPalProvider,
  ) {
    this.providers.set(ProveedorPago.MOCK_SANDBOX, this.mockProvider);
    this.providers.set(ProveedorPago.MERCADOPAGO, this.mpProvider);
    this.providers.set(ProveedorPago.PAYPAL, this.paypalProvider);
  }

  private getProvider(nombre?: ProveedorPago): PaymentProvider {
    const prov = process.env.PAYMENT_PROVIDER as ProveedorPago || nombre || ProveedorPago.MOCK_SANDBOX;
    return this.providers.get(prov) || this.mockProvider;
  }

  // ─────────────────────────────────────────────────────────────────
  // CREAR SESIÓN DE CHECKOUT (MOCK / MERCADOPAGO / PAYPAL)
  // ─────────────────────────────────────────────────────────────────
  async crearCheckout(
    idUsuario: number,
    idOrganizacion: number,
    planDeseado: TipoPlan,
    proveedorDeseado: ProveedorPago = ProveedorPago.MOCK_SANDBOX,
  ) {
    if (planDeseado === TipoPlan.GRATUITO) {
      throw new BadRequestException('El Plan Gratuito no requiere pago.');
    }

    const usuario = await this.prisma.usuario.findUnique({ where: { idUsuario } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');

    const org = await this.prisma.organizacion.findUnique({ where: { idOrganizacion } });
    if (!org) throw new NotFoundException('Institución no encontrada.');

    const precios = PRECIOS_PLANES[planDeseado] || PRECIOS_PLANES.MAESTRO_PRO;
    const provider = this.getProvider(proveedorDeseado);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
    const params: CheckoutParams = {
      idOrganizacion,
      idUsuario,
      plan: planDeseado,
      montoUsd: precios.usd,
      montoLocal: precios.bob,
      monedaLocal: 'BOB',
      correoUsuario: usuario.correo,
      nombreUsuario: `${usuario.nombre} ${usuario.apellido}`,
      urlRetornoSuccess: `${frontendUrl}/docente/organizacion?tab=suscripcion&pago=exito`,
      urlRetornoCancel: `${frontendUrl}/docente/organizacion?tab=suscripcion&pago=cancelado`,
    };

    let checkoutResult;
    try {
      checkoutResult = await provider.crearSesionCheckout(params);
    } catch (e: any) {
      this.logger.error(`Error al iniciar checkout con ${provider.nombreProveedor}:`, e);
      throw new BadRequestException(e.message || 'Error al iniciar la sesión de pago. Verifica que las credenciales estén configuradas.');
    }

    // Registrar transacción pendiente
    const transaccion = await this.prisma.transaccionPago.create({
      data: {
        idOrganizacion,
        monto: precios.usd,
        moneda: 'USD',
        montoLocal: precios.bob,
        monedaLocal: 'BOB',
        estado: EstadoPagoTransaccion.PENDIENTE,
        proveedor: provider.nombreProveedor,
        idTransaccionExterna: checkoutResult.idTransaccionExterna,
        metodoPago: checkoutResult.metodoPago,
        urlCheckout: checkoutResult.urlCheckout,
      },
    });

    return {
      urlCheckout: checkoutResult.urlCheckout,
      idTransaccion: transaccion.idTransaccion,
      idTransaccionExterna: checkoutResult.idTransaccionExterna,
      proveedor: provider.nombreProveedor,
      plan: planDeseado,
      montoLocal: precios.bob,
      monedaLocal: 'BOB',
    };
  }

  async aprobarPagoSandbox(idOrganizacion: number, idTransaccion: number) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Los pagos de prueba (Sandbox) están deshabilitados en el entorno de producción.');
    }

    const transaccion = await this.prisma.transaccionPago.findFirst({
      where: {
        idTransaccion,
        idOrganizacion,
        proveedor: ProveedorPago.MOCK_SANDBOX,
      },
    });

    if (!transaccion) {
      throw new NotFoundException('No se encontró el pago de prueba para esta institución.');
    }
    if (transaccion.estado !== EstadoPagoTransaccion.PENDIENTE) {
      throw new BadRequestException('Este pago de prueba ya fue procesado.');
    }

    // Operación interna autenticada: evitamos verificarWebhooks y activamos directamente
    const idSuscripcionExterna = `mock_sub_${transaccion.idTransaccion}`;
    
    await this.aprobarTransaccionAtomica(transaccion, ProveedorPago.MOCK_SANDBOX, idSuscripcionExterna);
    
    return { 
      recibido: true, 
      estado: 'APROBADO', 
      idOrganizacion: transaccion.idOrganizacion,
      mensaje: 'Pago Sandbox aprobado manualmente.'
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // PROCESAR WEBHOOK DE PASARELA (IDEMPOTENTE & VERIFICADO)
  // ─────────────────────────────────────────────────────────────────
  async procesarWebhook(proveedorNombre: ProveedorPago, body: any, headers: any) {
    const provider = this.providers.get(proveedorNombre) || this.mockProvider;
    const verificacion = await provider.verificarWebhooks(body, headers);

    if (!verificacion.valido) {
      throw new BadRequestException('Firma de webhook no válida o ausente.');
    }

    this.logger.log(
      `[Webhook ${proveedorNombre}] Evento: ${verificacion.evento}, TX: ${verificacion.idTransaccionExterna}`,
    );

    if (!verificacion.idTransaccionExterna) {
      throw new BadRequestException('El webhook no proporcionó un ID de transacción externa válido.');
    }

    // Buscar transacción existente exigiendo coincidencia exacta de proveedor e ID
    const tx = await this.prisma.transaccionPago.findFirst({
      where: {
        proveedor: proveedorNombre,
        idTransaccionExterna: verificacion.idTransaccionExterna,
      },
    });

    if (!tx) {
      this.logger.warn(
        `No se encontró transacción correspondiente al webhook. Proveedor: ${proveedorNombre}, ID Externa: ${verificacion.idTransaccionExterna}`,
      );
      // Los proveedores esperan HTTP 200/2xx aunque no encontremos el ID,
      // para no reintentar indefinidamente con el mismo webhook desconocido.
      return { recibido: true, estado: 'DESCONOCIDO' };
    }

    // ── Idempotencia ─────────────────────────────────────────────────
    if (tx.estado === EstadoPagoTransaccion.APROBADO && verificacion.estadoPago === 'APROBADO') {
      this.logger.log(`TX ${tx.idTransaccionExterna} ya aprobada previamente. Ignorando evento.`);
      return { recibido: true, estado: 'APROBADO', idOrganizacion: tx.idOrganizacion };
    }
    if (tx.estado === EstadoPagoTransaccion.RECHAZADO && verificacion.estadoPago === 'RECHAZADO') {
      this.logger.log(`TX ${tx.idTransaccionExterna} ya rechazada previamente. Ignorando evento.`);
      return { recibido: true, estado: 'RECHAZADO', idOrganizacion: tx.idOrganizacion };
    }

    // ── Protección contra eventos tardíos/fuera de orden ────────────
    // Un pago ya APROBADO nunca puede degradarse a RECHAZADO por un evento tardío.
    if (tx.estado === EstadoPagoTransaccion.APROBADO && verificacion.estadoPago === 'RECHAZADO') {
      this.logger.warn(
        `[Orden Temporal] TX ${tx.idTransaccionExterna} ya APROBADA recibió evento RECHAZADO tardío. Ignorado.`,
      );
      return { recibido: true, estado: 'APROBADO', idOrganizacion: tx.idOrganizacion };
    }

    // ── Validaciones de monto y moneda ───────────────────────────────
    // Para una aprobación, monto Y moneda son OBLIGATORIOS — nunca se asumen.
    if (verificacion.estadoPago === 'APROBADO') {
      if (verificacion.monto === undefined || verificacion.monto === null || !verificacion.moneda) {
        this.logger.error(
          `[Webhook ${proveedorNombre}] Aprobación sin monto o moneda para TX ${tx.idTransaccionExterna}. Rechazando.`,
        );
        throw new BadRequestException(
          'El proveedor aprobó el pago sin reportar monto o moneda. No se puede activar la suscripción.',
        );
      }
    }

    // Comparación de monto con conciencia de moneda
    if (verificacion.monto !== undefined && verificacion.monto !== null && verificacion.moneda) {
      const monedaWebhook = verificacion.moneda.toUpperCase();
      // PayPal reporta USD; MercadoPago y Mock reportan moneda local (BOB).
      const montoEsperado = monedaWebhook === 'USD'
        ? Number(tx.monto) || 0
        : Number(tx.montoLocal) || 0;
      const montoRecibido = Number(verificacion.monto);

      if (montoEsperado === 0 || Math.abs(montoRecibido - montoEsperado) > 0.1) {
        this.logger.error(
          `Discrepancia de monto para TX ${tx.idTransaccionExterna}. ` +
          `Moneda: ${monedaWebhook}. Esperado: ${montoEsperado}, Recibido: ${montoRecibido}`,
        );
        throw new BadRequestException('Monto del webhook no coincide con el monto esperado.');
      }
    }

    // ── Activación atómica de suscripción ────────────────────────────
    if (verificacion.estadoPago === 'APROBADO') {
      await this.aprobarTransaccionAtomica(tx, proveedorNombre, verificacion.idSuscripcionExterna);
      return { recibido: true, estado: 'APROBADO', idOrganizacion: tx.idOrganizacion };
    }

    if (verificacion.estadoPago === 'RECHAZADO') {
      await this.rechazarTransaccionAtomica(tx, verificacion.motivoFallo);
      return { recibido: true, estado: 'RECHAZADO', idOrganizacion: tx.idOrganizacion };
    }

    return { recibido: true, estado: verificacion.estadoPago };
  }

  // ─────────────────────────────────────────────────────────────────
  // CAPTURAR ORDEN DE PAYPAL (Acción del usuario al regresar del checkout)
  // ─────────────────────────────────────────────────────────────────
  async capturarPagoPayPal(idOrganizacion: number, idTransaccionExterna: string) {
    const tx = await this.prisma.transaccionPago.findFirst({
      where: {
        idTransaccionExterna,
        idOrganizacion,
        proveedor: ProveedorPago.PAYPAL,
      },
    });

    if (!tx) {
      throw new NotFoundException('Transacción de PayPal no encontrada o no pertenece a la institución.');
    }

    if (tx.estado === EstadoPagoTransaccion.APROBADO) {
      return { mensaje: 'El pago ya fue procesado y la suscripción está activa.' };
    }
    if (tx.estado === EstadoPagoTransaccion.RECHAZADO) {
      throw new BadRequestException('El pago ya fue rechazado anteriormente.');
    }

    let order;
    try {
      order = await this.paypalProvider.consultarOrden(idTransaccionExterna);
    } catch (e: any) {
      this.logger.error('Error al consultar estado de orden PayPal:', e);
      throw new BadRequestException('No se pudo verificar el estado actual de la orden en PayPal.');
    }

    let captureDetails;

    if (order.status === 'COMPLETED') {
      // Ya había sido capturada (quizás un intento local falló a la mitad), recuperamos sus detalles
      captureDetails = order.purchase_units?.[0]?.payments?.captures?.[0];
      this.logger.log(`[PayPal] La orden ${idTransaccionExterna} ya estaba COMPLETED, reanudando activación local.`);
    } else if (order.status === 'APPROVED') {
      // El usuario aprobó el pago, lista para capturar remota y localmente
      try {
        const capture = await this.paypalProvider.capturarOrden(idTransaccionExterna);
        if (capture.status !== 'COMPLETED') {
          throw new BadRequestException(`El estado de la captura es ${capture.status}, se esperaba COMPLETED.`);
        }
        captureDetails = capture.purchase_units?.[0]?.payments?.captures?.[0];
      } catch (e: any) {
        this.logger.error('Error al capturar orden PayPal:', e);
        throw new BadRequestException(e.message || 'No se pudo capturar la orden en PayPal.');
      }
    } else {
      throw new BadRequestException(`La orden no está en estado APPROVED ni COMPLETED. Estado actual: ${order.status}`);
    }

    if (!captureDetails) {
      throw new BadRequestException('PayPal no devolvió detalles de la captura.');
    }

    const monto = Number(captureDetails.amount?.value);
    const moneda = captureDetails.amount?.currency_code?.toUpperCase();

    if (!moneda || isNaN(monto)) {
      throw new BadRequestException('PayPal no reportó monto o moneda válidos.');
    }

    const montoEsperado = Number(tx.monto) || 0; // En DB se guarda en USD
    if (moneda !== 'USD' || Math.abs(monto - montoEsperado) > 0.1) {
      throw new BadRequestException(
        `Discrepancia de monto/moneda. Esperado: ${montoEsperado} USD. Recibido: ${monto} ${moneda}`,
      );
    }

    await this.aprobarTransaccionAtomica(tx, ProveedorPago.PAYPAL, captureDetails.id);

    return { mensaje: 'Pago capturado y suscripción activada con éxito.' };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS ATÓMICOS
  // ─────────────────────────────────────────────────────────────────
  private async aprobarTransaccionAtomica(tx: any, proveedorNombre: ProveedorPago, idSuscripcionExterna?: string) {
    const fechaInicio = new Date();
    const fechaFinPeriodo = new Date();
    fechaFinPeriodo.setFullYear(fechaFinPeriodo.getFullYear() + 1);

    await this.prisma.$transaction([
      this.prisma.transaccionPago.update({
        where: { idTransaccion: tx.idTransaccion },
        data: {
          estado: EstadoPagoTransaccion.APROBADO,
          firmaWebhook: `${proveedorNombre}:${tx.idTransaccionExterna}`.slice(0, 250),
        },
      }),
      this.prisma.suscripcionOrganizacion.upsert({
        where: { idOrganizacion: tx.idOrganizacion },
        create: {
          idOrganizacion: tx.idOrganizacion,
          plan: TipoPlan.MAESTRO_PRO,
          estado: EstadoSuscripcion.ACTIVA,
          proveedor: proveedorNombre,
          idSuscripcionExterna: idSuscripcionExterna || tx.idTransaccionExterna,
          monto: tx.monto,
          moneda: tx.moneda,
          montoLocal: tx.montoLocal,
          monedaLocal: tx.monedaLocal,
          fechaInicio,
          fechaFinPeriodo,
          fechaProximoCobro: fechaFinPeriodo,
          autoRenovar: true,
        },
        update: {
          plan: TipoPlan.MAESTRO_PRO,
          estado: EstadoSuscripcion.ACTIVA,
          proveedor: proveedorNombre,
          idSuscripcionExterna: idSuscripcionExterna || tx.idTransaccionExterna,
          fechaFinPeriodo,
          fechaProximoCobro: fechaFinPeriodo,
          fechaFinGracia: null,
        },
      }),
      this.prisma.organizacion.update({
        where: { idOrganizacion: tx.idOrganizacion },
        data: {
          plan: TipoPlan.MAESTRO_PRO,
          limiteEvaluaciones: 99999,
          limiteCorreccionesIaMes: 99999,
          diasCaducidadEvaluacion: 99999,
          esContenidoPrivado: true,
          iaHabilitada: true,
        },
      }),
    ]);

    this.logger.log(`[Suscripción Activada] Institución ${tx.idOrganizacion} actualizada a Plan MAESTRO_PRO.`);
  }

  private async rechazarTransaccionAtomica(tx: any, motivoFallo?: string) {
    const fechaFinGracia = new Date();
    fechaFinGracia.setDate(fechaFinGracia.getDate() + 7);

    await this.prisma.$transaction([
      this.prisma.transaccionPago.update({
        where: { idTransaccion: tx.idTransaccion },
        data: {
          estado: EstadoPagoTransaccion.RECHAZADO,
          detalleError: motivoFallo || 'Pago rechazado por el procesador',
        },
      }),
      this.prisma.suscripcionOrganizacion.updateMany({
        where: { idOrganizacion: tx.idOrganizacion },
        data: {
          estado: EstadoSuscripcion.EN_PERIODO_GRACIA,
          fechaFinGracia,
        },
      }),
    ]);
  }



  // ─────────────────────────────────────────────────────────────────
  // OBTENER ESTADO DE SUSCRIPCIÓN DE LA INSTITUCIÓN
  // ─────────────────────────────────────────────────────────────────
  async obtenerSuscripcionOrg(idOrganizacion: number) {
    const org = await this.prisma.organizacion.findUnique({
      where: { idOrganizacion },
      include: {
        suscripcion: true,
        transacciones: {
          take: 5,
          orderBy: { fechaTransaccion: 'desc' },
        },
        _count: {
          select: { evaluaciones: true, estudiantes: true, membresias: true },
        },
      },
    });

    if (!org) throw new NotFoundException('Institución no encontrada.');

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const usoIaMes = await this.prisma.usoIaLog.count({
      where: { idOrganizacion, fecha: { gte: inicioMes } },
    });

    return {
      plan: org.plan,
      estadoSuscripcion: org.suscripcion?.estado || 'ACTIVA',
      proveedor: org.suscripcion?.proveedor || 'MOCK_SANDBOX',
      montoLocal: org.suscripcion?.montoLocal || 0,
      monedaLocal: org.suscripcion?.monedaLocal || 'BOB',
      fechaInicio: org.suscripcion?.fechaInicio,
      fechaFinPeriodo: org.suscripcion?.fechaFinPeriodo,
      fechaProximoCobro: org.suscripcion?.fechaProximoCobro,
      fechaFinGracia: org.suscripcion?.fechaFinGracia,
      autoRenovar: org.suscripcion?.autoRenovar ?? true,
      limites: {
        evaluacionesTotal: org._count.evaluaciones,
        evaluacionesLimite: org.limiteEvaluaciones,
        diasCaducidadEvaluacion: org.diasCaducidadEvaluacion,
        esContenidoPrivado: org.esContenidoPrivado,
        iaUsadasMes: usoIaMes,
        iaLimiteMes: org.limiteCorreccionesIaMes,
      },
      historialTransacciones: org.transacciones,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // CANCELAR RENOVACIÓN AUTOMÁTICA
  // ─────────────────────────────────────────────────────────────────
  async cancelarSuscripcion(idUsuario: number, idOrganizacion: number) {
    const sub = await this.prisma.suscripcionOrganizacion.findUnique({
      where: { idOrganizacion },
    });

    if (!sub) throw new NotFoundException('Suscripción no encontrada.');

    if (sub.idSuscripcionExterna) {
      const provider = this.providers.get(sub.proveedor) || this.mockProvider;
      await provider.cancelarSuscripcion(sub.idSuscripcionExterna);
    }

    const subActualizada = await this.prisma.suscripcionOrganizacion.update({
      where: { idOrganizacion },
      data: {
        autoRenovar: false,
        estado: EstadoSuscripcion.CANCELADA,
      },
    });

    return {
      mensaje: 'La renovación automática ha sido cancelada. Mantendrás el acceso hasta el final de tu ciclo actual.',
      fechaFinPeriodo: subActualizada.fechaFinPeriodo,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // VERIFICACIÓN ESTRICTA DE CUOTAS Y LÍMITES EN BACKEND
  // ─────────────────────────────────────────────────────────────────
  async verificarPermisosYCuotas(
    idOrganizacion: number,
    accion: 'CREAR_EVALUACION' | 'SOLICITAR_IA' | 'PRIVACIDAD',
  ) {
    const org = await this.prisma.organizacion.findUnique({
      where: { idOrganizacion },
      include: { suscripcion: true },
    });

    if (!org) throw new NotFoundException('Institución no encontrada.');

    if (org.suscripcion?.estado === EstadoSuscripcion.SUSPENDIDA_POR_PAGO) {
      throw new ForbiddenException(
        'La suscripción de tu institución está suspendida por falta de pago. Por favor regulariza tu pago para continuar.',
      );
    }

    if (accion === 'CREAR_EVALUACION') {
      const totalEvaluaciones = await this.prisma.evaluacion.count({
        where: { idOrganizacion },
      });

      if (totalEvaluaciones >= org.limiteEvaluaciones) {
        throw new ForbiddenException(
          `Has alcanzado el límite de ${org.limiteEvaluaciones} evaluaciones de tu plan actual (${org.plan}). Actualiza al Plan Maestro Pro (50 Bs) para almacenamiento ilimitado.`,
        );
      }
    }

    if (accion === 'SOLICITAR_IA') {
      if (!org.iaHabilitada) {
        throw new ForbiddenException('El módulo de IA no está habilitado para tu institución.');
      }

      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const usosIa = await this.prisma.usoIaLog.count({
        where: { idOrganizacion, fecha: { gte: inicioMes } },
      });

      if (usosIa >= org.limiteCorreccionesIaMes) {
        throw new ForbiddenException(
          `Has alcanzado el límite de ${org.limiteCorreccionesIaMes} créditos de IA este mes. Actualiza al Plan Maestro Pro (50 Bs) para créditos de IA ilimitados.`,
        );
      }
    }

    if (accion === 'PRIVACIDAD') {
      if (org.plan === TipoPlan.GRATUITO) {
        throw new ForbiddenException('Hacer contenido privado requiere el Plan Maestro Pro.');
      }
    }

    return true;
  }
}
