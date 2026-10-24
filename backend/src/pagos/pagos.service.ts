import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { MercadoPagoProvider } from './providers/mercadopago.provider';
import { PayPalProvider } from './providers/paypal.provider';
import { LiveesProvider } from './providers/livees.provider';
import { PaymentProvider, CheckoutParams } from './interfaces/payment-provider.interface';
import { LIMITES_PREDETERMINADOS } from '../superadmin/superadmin.service';
import {
  ProveedorPago,
  TipoPlan,
  EstadoSuscripcion,
  EstadoPagoTransaccion,
  EstadoGeneral,
  Prisma,
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
    private readonly liveesProvider: LiveesProvider,
  ) {
    this.providers.set(ProveedorPago.MOCK_SANDBOX, this.mockProvider);
    this.providers.set(ProveedorPago.MERCADOPAGO, this.mpProvider);
    this.providers.set(ProveedorPago.PAYPAL, this.paypalProvider);
    this.providers.set(ProveedorPago.LIVEES, this.liveesProvider);
  }

  private getProvider(nombre?: ProveedorPago): PaymentProvider {
    const prov = nombre || (process.env.PAYMENT_PROVIDER as ProveedorPago) || ProveedorPago.MOCK_SANDBOX;
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
        plan: planDeseado,
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
  async procesarWebhook(proveedorNombre: ProveedorPago, body: any, headers: any, rawBody?: Buffer | string) {
    // Bloquear el webhook Sandbox en producción para evitar activaciones gratuitas.
    // El endpoint de aprobación manual (aprobarPagoSandbox) ya tiene su propio guard de NODE_ENV.
    if (proveedorNombre === ProveedorPago.MOCK_SANDBOX && process.env.NODE_ENV === 'production') {
      throw new BadRequestException('El webhook Sandbox está deshabilitado en el entorno de producción.');
    }

    const provider = this.providers.get(proveedorNombre) || this.mockProvider;
    const verificacion = await provider.verificarWebhooks(body, headers, rawBody);

    if (!verificacion.valido) {
      throw new BadRequestException('Firma de webhook no válida o ausente.');
    }

    this.logger.log(
      `[Webhook ${proveedorNombre}] Evento: ${verificacion.evento}, TX: ${verificacion.idTransaccionExterna}`,
    );

    // ── Eventos de ciclo de vida de suscripción ───────────────────────
    // CANCELADO y SUSPENDIDO actúan sobre la suscripción, NO sobre una transacción.
    // Se procesan antes del lookup de TX para evitar la protección anti-degradación.
    if (verificacion.estadoPago === 'CANCELADO' || verificacion.estadoPago === 'SUSPENDIDO') {
      const nuevoEstado = verificacion.estadoPago === 'CANCELADO'
        ? EstadoSuscripcion.CANCELADA
        : EstadoSuscripcion.SUSPENDIDA_POR_PAGO;

      const sub = await this.prisma.suscripcionOrganizacion.findFirst({
        where: {
          idSuscripcionExterna: verificacion.idSuscripcionExterna,
          proveedor: proveedorNombre,
        },
      });

      if (!sub) {
        this.logger.warn(
          `[Ciclo vida ${verificacion.estadoPago}] No se encontró suscripción con ID externo ${verificacion.idSuscripcionExterna}. Ignorando.`,
        );
        return { recibido: true, estado: verificacion.estadoPago };
      }

      this.logger.log(
        `[Ciclo vida] Suscripción ${sub.idSuscripcionExterna} → ${nuevoEstado} (org ${sub.idOrganizacion})`,
      );

      await this.prisma.suscripcionOrganizacion.update({
        where: { idOrganizacion: sub.idOrganizacion },
        data: {
          estado: nuevoEstado,
          autoRenovar: false,
        },
      });

      return { recibido: true, estado: verificacion.estadoPago, idOrganizacion: sub.idOrganizacion };
    }

    if (!verificacion.idTransaccionExterna) {
      throw new BadRequestException('El webhook no proporcionó un ID de transacción externa válido.');
    }

    // Buscar transacción existente exigiendo coincidencia exacta de proveedor e ID.
    // También buscamos en firmaWebhook para identificar cobros recurrentes previamente aprobados 
    // sin perder el ID de checkout original en idTransaccionExterna.
    let tx = await this.prisma.transaccionPago.findFirst({
      where: {
        proveedor: proveedorNombre,
        OR: [
          { idTransaccionExterna: verificacion.idTransaccionExterna },
          { firmaWebhook: `${proveedorNombre}:${verificacion.idTransaccionExterna}`.slice(0, 250) }
        ]
      },
    });

    if (!tx && verificacion.idSuscripcionExterna) {
      // Es posible que sea un webhook de renovación (nuevo ID de transacción pero ID de suscripción existente)
      const sub = await this.prisma.suscripcionOrganizacion.findFirst({
        where: {
          idSuscripcionExterna: verificacion.idSuscripcionExterna,
          proveedor: proveedorNombre,
        },
      });

      if (sub && verificacion.monto !== undefined && verificacion.estadoPago !== 'PENDIENTE') {
         // Crear transacción de renovación
         this.logger.log(`[Renovación] Creando transacción para suscripción ${sub.idSuscripcionExterna}`);
         tx = await this.prisma.transaccionPago.create({
            data: {
               idOrganizacion: sub.idOrganizacion,
               monto: verificacion.moneda === 'USD' ? verificacion.monto : (sub.monto || 0),
               moneda: 'USD',
               montoLocal: verificacion.moneda !== 'USD' ? verificacion.monto : (sub.montoLocal || 0),
               monedaLocal: 'BOB',
               plan: sub.plan,   // Propagar el plan de la suscripción a la TX de renovación
               estado: EstadoPagoTransaccion.PENDIENTE,
               proveedor: proveedorNombre,
               idTransaccionExterna: verificacion.idTransaccionExterna,
               metodoPago: 'RENOVACION',
            }
         });
      }
    }

    // ── 3er intento: TX PENDIENTE revinculada al preapproval ID (primer cobro MP) ───
    // Flujo: subscription_preapproval authorized actualizó la TX cambiando su
    // idTransaccionExterna de 'mp_tx_...' al preapproval_id real de MP.
    // El primer cobro llega con idSuscripcionExterna = preapproval_id y un cobro id nuevo.
    // Como la suscripcionOrganizacion todavía no existe, el 2do intento no la encuentra.
    // Aquí buscamos la TX PENDIENTE cuyo idTransaccionExterna ya es el preapproval_id.
    if (!tx && verificacion.idSuscripcionExterna) {
      tx = await this.prisma.transaccionPago.findFirst({
        where: {
          proveedor: proveedorNombre,
          idTransaccionExterna: verificacion.idSuscripcionExterna,
          estado: EstadoPagoTransaccion.PENDIENTE,
        },
      });
      if (tx) {
        this.logger.log(
          `[Primer cobro MP] TX ${tx.idTransaccion} encontrada por suscripción revinculada (${verificacion.idSuscripcionExterna}).`,
        );
      }
    }

    // ── 4to intento: TX PENDIENTE por referencia externa original (desorden temporal MP) ───
    // Si el primer cobro llega antes que el preapproval, el preapproval ID no existe en la DB.
    // Usamos el external_reference del pago (que es el mp_tx_... original) para encontrarla.
    if (!tx && verificacion.referenciaExternaOriginal) {
      tx = await this.prisma.transaccionPago.findFirst({
        where: {
          proveedor: proveedorNombre,
          idTransaccionExterna: verificacion.referenciaExternaOriginal,
          estado: EstadoPagoTransaccion.PENDIENTE,
        },
      });
      if (tx) {
        this.logger.log(
          `[Desorden temporal MP] TX ${tx.idTransaccion} encontrada por referencia original (${verificacion.referenciaExternaOriginal}).`,
        );
      }
    }

    if (!tx) {
      this.logger.warn(
        `No se encontró transacción correspondiente al webhook ni suscripción activa. Proveedor: ${proveedorNombre}, ID Externa: ${verificacion.idTransaccionExterna}`,
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
    // Nota: CANCELADO/SUSPENDIDO ya fueron manejados arriba y nunca llegan aquí.
    if (tx.estado === EstadoPagoTransaccion.APROBADO && verificacion.estadoPago === 'RECHAZADO') {
      this.logger.warn(
        `[Orden Temporal] TX ${tx.idTransaccionExterna} ya APROBADA recibió evento RECHAZADO tardío. Ignorado.`,
      );
      return { recibido: true, estado: 'APROBADO', idOrganizacion: tx.idOrganizacion };
    }

    if (tx.estado === EstadoPagoTransaccion.APROBADO && verificacion.estadoPago === 'PENDIENTE') {
      this.logger.log(
        `[Orden Temporal] TX ${tx.idTransaccionExterna} ya APROBADA recibió evento PENDIENTE tardío. Ignorado.`,
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
      await this.aprobarTransaccionAtomica(
        tx,
        proveedorNombre,
        verificacion.idSuscripcionExterna,
        verificacion.idTransaccionExterna
      );
      return { recibido: true, estado: 'APROBADO', idOrganizacion: tx.idOrganizacion };
    }

    if (verificacion.estadoPago === 'RECHAZADO') {
      await this.rechazarTransaccionAtomica(tx, verificacion.motivoFallo, verificacion.idTransaccionExterna);
      return { recibido: true, estado: 'RECHAZADO', idOrganizacion: tx.idOrganizacion };
    }

    return { recibido: true, estado: verificacion.estadoPago, idOrganizacion: tx.idOrganizacion };
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

    // Con el modelo de suscripciones PayPal no se "captura" — se verifica el estado
    let sub;
    try {
      sub = await this.paypalProvider.consultarSuscripcion(idTransaccionExterna);
    } catch (e: any) {
      this.logger.error('Error al consultar suscripción PayPal:', e);
      throw new BadRequestException('No se pudo verificar el estado actual de la suscripción en PayPal.');
    }

    if (sub.status !== 'ACTIVE' && sub.status !== 'APPROVED') {
      throw new BadRequestException(`La suscripción no está activa. Estado actual en PayPal: ${sub.status}`);
    }

    // Extraer monto del último pago o del plan
    const lastPayment = sub.billing_info?.last_payment;
    let monto: number;
    let moneda: string;

    if (lastPayment) {
      monto = Number(lastPayment.amount.value);
      moneda = lastPayment.amount.currency_code?.toUpperCase();
    } else {
      // Si aún no hubo un cobro (suscripción APPROVED pero primer ciclo pendiente), usamos el monto esperado del plan
      monto = Number(tx.monto);
      moneda = tx.moneda?.toUpperCase() || 'USD';
    }

    if (!moneda || isNaN(monto)) {
      throw new BadRequestException('PayPal no reportó monto o moneda válidos.');
    }

    const montoEsperado = Number(tx.monto) || 0;
    if (moneda !== 'USD' || Math.abs(monto - montoEsperado) > 0.1) {
      // Si la suscripción está APPROVED (primer ciclo pendiente), permitir con monto 0 del plan
      if (sub.status !== 'APPROVED') {
        throw new BadRequestException(
          `Discrepancia de monto/moneda. Esperado: ${montoEsperado} USD. Recibido: ${monto} ${moneda}`,
        );
      }
    }

    await this.aprobarTransaccionAtomica(tx, ProveedorPago.PAYPAL, sub.id);

    return { mensaje: 'Suscripción de PayPal activada con éxito.' };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS ATÓMICOS
  // ─────────────────────────────────────────────────────────────────
  private async aprobarTransaccionAtomica(tx: any, proveedorNombre: ProveedorPago, idSuscripcionExterna?: string, idCobroRecibido?: string) {
    const subActual = await this.prisma.suscripcionOrganizacion.findUnique({
      where: { idOrganizacion: tx.idOrganizacion },
    });

    const fechaInicio = new Date();
    const fechaFinPeriodo = new Date();

    if (subActual?.estado === EstadoSuscripcion.ACTIVA && subActual.fechaFinPeriodo && subActual.fechaFinPeriodo > new Date()) {
      // Extender 30 días exactos desde la fecha de expiración actual si aún está activa
      fechaFinPeriodo.setTime(subActual.fechaFinPeriodo.getTime());
      fechaFinPeriodo.setDate(fechaFinPeriodo.getDate() + 30);
    } else {
      // Si estaba vencida, cancelada o en gracia, extender 30 días desde hoy
      fechaFinPeriodo.setDate(fechaFinPeriodo.getDate() + 30);
    }

    const planAprobado: TipoPlan = tx.plan || TipoPlan.MAESTRO_PRO;
    const limitesPlan = LIMITES_PREDETERMINADOS[planAprobado] || LIMITES_PREDETERMINADOS.MAESTRO_PRO;

    await this.prisma.$transaction([
      this.prisma.transaccionPago.update({
        where: { idTransaccion: tx.idTransaccion },
        data: {
          estado: EstadoPagoTransaccion.APROBADO,
          firmaWebhook: `${proveedorNombre}:${idCobroRecibido || tx.idTransaccionExterna}`.slice(0, 250),
        },
      }),
      this.prisma.suscripcionOrganizacion.upsert({
        where: { idOrganizacion: tx.idOrganizacion },
        create: {
          idOrganizacion: tx.idOrganizacion,
          plan: planAprobado,
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
          plan: planAprobado,
          estado: EstadoSuscripcion.ACTIVA,
          proveedor: proveedorNombre,
          idSuscripcionExterna: idSuscripcionExterna || tx.idTransaccionExterna,
          fechaFinPeriodo,
          fechaProximoCobro: fechaFinPeriodo,
          fechaFinGracia: null,
          autoRenovar: true,
        },
      }),
      this.prisma.organizacion.update({
        where: { idOrganizacion: tx.idOrganizacion },
        data: {
          plan: planAprobado,
          limiteDocentes: limitesPlan.limiteDocentes,
          limiteEstudiantes: limitesPlan.limiteEstudiantes,
          limiteEvaluaciones: limitesPlan.limiteEvaluaciones,
          limiteCorreccionesIaMes: limitesPlan.limiteCorreccionesIaMes,
          diasCaducidadEvaluacion: planAprobado === TipoPlan.GRATUITO ? 7 : 99999,
          esContenidoPrivado: planAprobado !== TipoPlan.GRATUITO,
          iaHabilitada: true,
        },
      }),
    ]);

    this.logger.log(`[Suscripción Activada] Institución ${tx.idOrganizacion} actualizada a Plan ${planAprobado}.`);
  }

  private async rechazarTransaccionAtomica(tx: any, motivoFallo?: string, idCobroRecibido?: string) {
    const cobroParaIdempotencia = idCobroRecibido || tx.idTransaccionExterna;

    const subActual = await this.prisma.suscripcionOrganizacion.findUnique({
      where: { idOrganizacion: tx.idOrganizacion },
    });

    const operaciones: any[] = [
      this.prisma.transaccionPago.update({
        where: { idTransaccion: tx.idTransaccion },
        data: {
          estado: EstadoPagoTransaccion.RECHAZADO,
          firmaWebhook: `${tx.proveedor}:${cobroParaIdempotencia}`.slice(0, 250),
          detalleError: motivoFallo || 'Pago rechazado por el procesador',
        },
      }),
    ];

    // Solo se concede período de gracia de 7 días si la suscripción estaba ACTIVA.
    // Si ya estaba CANCELADA o SUSPENDIDA_POR_PAGO, no otorgar días adicionales de gracia.
    if (subActual && subActual.estado === EstadoSuscripcion.ACTIVA) {
      const fechaFinGracia = new Date();
      fechaFinGracia.setDate(fechaFinGracia.getDate() + 7);

      operaciones.push(
        this.prisma.suscripcionOrganizacion.update({
          where: { idOrganizacion: tx.idOrganizacion },
          data: {
            estado: EstadoSuscripcion.EN_PERIODO_GRACIA,
            fechaFinGracia,
          },
        }),
      );
    }

    await this.prisma.$transaction(operaciones);
  }

  private async degradarOrganizacionAGratuito(
    tx: Pick<Prisma.TransactionClient, 'organizacion' | 'suscripcionOrganizacion'>,
    idOrganizacion: number,
  ) {
    const limitesGratuito = LIMITES_PREDETERMINADOS[TipoPlan.GRATUITO];
    const organizacion = await tx.organizacion.update({
      where: { idOrganizacion },
      data: {
        plan: TipoPlan.GRATUITO,
        estado: EstadoGeneral.ACTIVO,
        limiteDocentes: limitesGratuito.limiteDocentes,
        limiteEstudiantes: limitesGratuito.limiteEstudiantes,
        limiteEvaluaciones: limitesGratuito.limiteEvaluaciones,
        limiteCorreccionesIaMes: limitesGratuito.limiteCorreccionesIaMes,
        diasCaducidadEvaluacion: 7,
        esContenidoPrivado: false,
      },
    });

    // Se conservan plan, monto e idSuscripcionExterna para que un webhook tardío
    // del proveedor no pueda interpretar la suscripción gratuita como una renovación.
    await tx.suscripcionOrganizacion.update({
      where: { idOrganizacion },
      data: {
        estado: EstadoSuscripcion.ACTIVA,
        autoRenovar: false,
        fechaFinPeriodo: null,
        fechaFinGracia: null,
      },
    });

    return organizacion;
  }

  // ─────────────────────────────────────────────────────────────────
  // TAREA PROGRAMADA: DEGRADACIÓN DE PLANES Y SUSPENSIONES VENCIDAS
  // ─────────────────────────────────────────────────────────────────
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { timeZone: 'America/La_Paz' })
  async degradarSuscripcionesVencidas() {
    this.logger.log('[Cron Degradación] Ejecutando revisión de suscripciones vencidas...');
    const ahora = new Date();

    // 1. Período pagado vencido -> 7 días de gracia para planes de pago.
    const fechaFinGracia = new Date(ahora);
    fechaFinGracia.setDate(fechaFinGracia.getDate() + 7);
    const enGracia = await this.prisma.suscripcionOrganizacion.updateMany({
      where: {
        estado: EstadoSuscripcion.ACTIVA,
        plan: { not: TipoPlan.GRATUITO },
        fechaFinPeriodo: { lt: ahora },
      },
      data: {
        estado: EstadoSuscripcion.EN_PERIODO_GRACIA,
        fechaFinGracia,
      },
    });

    if (enGracia.count > 0) {
      this.logger.warn(`[Cron Degradación] ${enGracia.count} suscripciones ingresaron al período de gracia.`);
    }

    // 2. Período de gracia expirado -> SUSPENDIDA_POR_PAGO
    const suspendidas = await this.prisma.suscripcionOrganizacion.updateMany({
      where: {
        estado: EstadoSuscripcion.EN_PERIODO_GRACIA,
        fechaFinGracia: { lt: ahora },
      },
      data: {
        estado: EstadoSuscripcion.SUSPENDIDA_POR_PAGO,
      },
    });

    if (suspendidas.count > 0) {
      this.logger.warn(`[Cron Degradación] ${suspendidas.count} suscripciones suspendidas por expiración de gracia.`);
    }

    // 3. Suscripciones vencidas de forma definitiva -> degradar la organización a GRATUITO.
    const haceTreintaDias = new Date(ahora);
    haceTreintaDias.setDate(haceTreintaDias.getDate() - 30);
    const suscripcionesParaDegradar = await this.prisma.suscripcionOrganizacion.findMany({
      where: {
        OR: [
          {
            estado: EstadoSuscripcion.CANCELADA,
            fechaFinPeriodo: { lt: ahora },
          },
          {
            estado: EstadoSuscripcion.SUSPENDIDA_POR_PAGO,
            fechaFinPeriodo: { lt: haceTreintaDias },
          },
        ],
      },
      include: {
        organizacion: true,
      },
    });

    for (const sub of suscripcionesParaDegradar) {
      if (sub.organizacion && sub.organizacion.plan !== TipoPlan.GRATUITO) {
        try {
          await this.prisma.$transaction(async (tx) => {
            await this.degradarOrganizacionAGratuito(tx, sub.idOrganizacion);
          });
          this.logger.log(`[Cron Degradación] Institución ${sub.idOrganizacion} degradada a Plan GRATUITO.`);
        } catch (error) {
          this.logger.error(`[Cron Degradación] No se pudo degradar la institución ${sub.idOrganizacion}.`, error);
        }
      }
    }
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
      historialTransacciones: org.transacciones.map((t) => ({
        ...t,
        planContratado: t.plan,
        montoUsd: t.monto,
      })),
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
      const exito = await provider.cancelarSuscripcion(sub.idSuscripcionExterna);
      if (!exito) {
         throw new BadRequestException('El proveedor de pago no pudo procesar la cancelación. Inténtalo de nuevo más tarde.');
      }
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

    if (org.suscripcion?.estado === EstadoSuscripcion.EN_PERIODO_GRACIA && org.suscripcion.fechaFinGracia) {
      if (new Date() > org.suscripcion.fechaFinGracia) {
        await this.prisma.suscripcionOrganizacion.update({
          where: { idOrganizacion: org.idOrganizacion },
          data: { estado: EstadoSuscripcion.SUSPENDIDA_POR_PAGO },
        });
        throw new ForbiddenException('El período de gracia ha expirado. Por favor regulariza tu pago para continuar.');
      }
    }

    if (org.suscripcion?.estado === EstadoSuscripcion.CANCELADA && org.suscripcion.fechaFinPeriodo) {
      if (new Date() > org.suscripcion.fechaFinPeriodo) {
        const orgActualizada = await this.prisma.$transaction((tx) =>
          this.degradarOrganizacionAGratuito(tx, org.idOrganizacion),
        );
        // Refrescar entidad en memoria para que los checks subsecuentes utilicen las cuotas degradadas
        org.plan = orgActualizada.plan;
        org.limiteDocentes = orgActualizada.limiteDocentes;
        org.limiteEstudiantes = orgActualizada.limiteEstudiantes;
        org.limiteEvaluaciones = orgActualizada.limiteEvaluaciones;
        org.limiteCorreccionesIaMes = orgActualizada.limiteCorreccionesIaMes;
        org.diasCaducidadEvaluacion = orgActualizada.diasCaducidadEvaluacion;
        org.esContenidoPrivado = orgActualizada.esContenidoPrivado;
        org.suscripcion.estado = EstadoSuscripcion.ACTIVA;
        org.suscripcion.autoRenovar = false;
        org.suscripcion.fechaFinPeriodo = null;
        org.suscripcion.fechaFinGracia = null;
      }
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
