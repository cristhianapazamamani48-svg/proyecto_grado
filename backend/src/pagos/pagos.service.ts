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

    const checkoutResult = await provider.crearSesionCheckout(params);

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

    // Buscar transacción existente
    let tx = await this.prisma.transaccionPago.findFirst({
      where: {
        OR: [
          { idTransaccionExterna: verificacion.idTransaccionExterna },
          ...(verificacion.idTransaccionExterna
            ? [{ idTransaccionExterna: { contains: verificacion.idTransaccionExterna } }]
            : []),
        ],
      },
    });

    if (!tx) {
      // Buscar la última transacción pendiente si no coincide por ID externo
      tx = await this.prisma.transaccionPago.findFirst({
        where: { estado: EstadoPagoTransaccion.PENDIENTE },
        orderBy: { fechaTransaccion: 'desc' },
      });
    }

    if (!tx) {
      this.logger.warn('No se encontró transacción correspondiente al webhook.');
      return { recibido: true, estado: 'DESCONOCIDO' };
    }

    if (verificacion.estadoPago === 'APROBADO') {
      // Actualizar transacción a APROBADO
      await this.prisma.transaccionPago.update({
        where: { idTransaccion: tx.idTransaccion },
        data: {
          estado: EstadoPagoTransaccion.APROBADO,
          firmaWebhook: JSON.stringify(headers || {}).slice(0, 250),
        },
      });

      // Actualizar la suscripción de la institución al Plan Maestro Pro (50 Bs) o al plan comprado
      const fechaInicio = new Date();
      const fechaFinPeriodo = new Date();
      fechaFinPeriodo.setFullYear(fechaFinPeriodo.getFullYear() + 1); // 1 año de vigencia

      await this.prisma.$transaction([
        this.prisma.suscripcionOrganizacion.upsert({
          where: { idOrganizacion: tx.idOrganizacion },
          create: {
            idOrganizacion: tx.idOrganizacion,
            plan: TipoPlan.MAESTRO_PRO,
            estado: EstadoSuscripcion.ACTIVA,
            proveedor: proveedorNombre,
            idSuscripcionExterna: verificacion.idSuscripcionExterna || tx.idTransaccionExterna,
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
            idSuscripcionExterna: verificacion.idSuscripcionExterna || tx.idTransaccionExterna,
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
            diasCaducidadEvaluacion: 99999, // Sin caducidad
            esContenidoPrivado: true,
            iaHabilitada: true,
          },
        }),
      ]);

      this.logger.log(
        `[Suscripción Activada] Institución ${tx.idOrganizacion} actualizada a Plan MAESTRO_PRO.`,
      );

      return { recibido: true, estado: 'APROBADO', idOrganizacion: tx.idOrganizacion };
    }

    if (verificacion.estadoPago === 'RECHAZADO') {
      await this.prisma.transaccionPago.update({
        where: { idTransaccion: tx.idTransaccion },
        data: {
          estado: EstadoPagoTransaccion.RECHAZADO,
          detalleError: verificacion.motivoFallo || 'Pago rechazado por el procesador',
        },
      });

      // Pasar a período de gracia por 7 días
      const fechaFinGracia = new Date();
      fechaFinGracia.setDate(fechaFinGracia.getDate() + 7);

      await this.prisma.suscripcionOrganizacion.update({
        where: { idOrganizacion: tx.idOrganizacion },
        data: {
          estado: EstadoSuscripcion.EN_PERIODO_GRACIA,
          fechaFinGracia,
        },
      });

      return { recibido: true, estado: 'RECHAZADO', idOrganizacion: tx.idOrganizacion };
    }

    return { recibido: true, estado: verificacion.estadoPago };
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
