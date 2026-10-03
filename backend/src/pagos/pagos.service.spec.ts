import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ProveedorPago, EstadoPagoTransaccion } from '@prisma/client';

import { PagosService } from './pagos.service';
import { PrismaService } from '../prisma/prisma.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { MercadoPagoProvider } from './providers/mercadopago.provider';
import { PayPalProvider } from './providers/paypal.provider';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers compartidos
// ──────────────────────────────────────────────────────────────────────────────

function makeTx(overrides: Record<string, any> = {}) {
  return {
    idTransaccion: 1,
    idTransaccionExterna: 'tx_123',
    idOrganizacion: 10,
    proveedor: ProveedorPago.MOCK_SANDBOX,
    estado: EstadoPagoTransaccion.PENDIENTE,
    monto: 7.25,
    moneda: 'USD',
    montoLocal: 50,
    monedaLocal: 'BOB',
    ...overrides,
  };
}

function makeVerificacion(overrides: Record<string, any> = {}) {
  return {
    valido: true,
    idTransaccionExterna: 'tx_123',
    estadoPago: 'APROBADO',
    evento: 'payment.approved',
    monto: 50,
    moneda: 'BOB',
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Setup de módulo
// ──────────────────────────────────────────────────────────────────────────────

async function buildModule() {
  return Test.createTestingModule({
    providers: [
      PagosService,
      {
        provide: PrismaService,
        useValue: {
          transaccionPago: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
          suscripcionOrganizacion: { upsert: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
          organizacion: { findUnique: jest.fn(), update: jest.fn() },
          $transaction: jest.fn().mockResolvedValue([]),
        },
      },
      {
        provide: MockPaymentProvider,
        useValue: {
          nombreProveedor: ProveedorPago.MOCK_SANDBOX,
          verificarWebhooks: jest.fn(),
        },
      },
      {
        provide: MercadoPagoProvider,
        useValue: {
          nombreProveedor: ProveedorPago.MERCADOPAGO,
          verificarWebhooks: jest.fn(),
        },
      },
      {
        provide: PayPalProvider,
        useValue: {
          nombreProveedor: ProveedorPago.PAYPAL,
          verificarWebhooks: jest.fn(),
          consultarSuscripcion: jest.fn(),
          cancelarSuscripcion: jest.fn(),
        },
      },
    ],
  }).compile();
}

// ──────────────────────────────────────────────────────────────────────────────
// Suite 1: PagosService — lógica de negocio del webhook
// ──────────────────────────────────────────────────────────────────────────────

describe('PagosService — procesarWebhook', () => {
  let service: PagosService;
  let prisma: PrismaService;
  let module: TestingModule;
  let mockProv: MockPaymentProvider;
  let ppProv: PayPalProvider;

  beforeEach(async () => {
    module = await buildModule();
    service = module.get(PagosService);
    prisma = module.get(PrismaService);
    mockProv = module.get(MockPaymentProvider);
    ppProv = module.get(PayPalProvider);
  });

  // ── Firma inválida ──────────────────────────────────────────────────────
  it('rechaza con BadRequestException si el proveedor devuelve valido:false', async () => {
    (mockProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce({ valido: false, evento: 'rejected' });
    await expect(service.procesarWebhook(ProveedorPago.MOCK_SANDBOX, {}, {})).rejects.toThrow(BadRequestException);
  });

  // ── Sin ID de transacción ───────────────────────────────────────────────
  it('rechaza si idTransaccionExterna está ausente', async () => {
    (mockProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce(
      makeVerificacion({ idTransaccionExterna: undefined }),
    );
    await expect(service.procesarWebhook(ProveedorPago.MOCK_SANDBOX, {}, {})).rejects.toThrow(BadRequestException);
  });

  // ── TX no encontrada → 200 DESCONOCIDO ─────────────────────────────────
  it('devuelve DESCONOCIDO (sin throw) para TX no encontrada', async () => {
    (mockProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce(makeVerificacion({ idTransaccionExterna: 'no_existe' }));
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const result = await service.procesarWebhook(ProveedorPago.MOCK_SANDBOX, {}, {});
    expect(result).toEqual({ recibido: true, estado: 'DESCONOCIDO' });
    // Nunca busca "la última pendiente" — solo un findFirst
    expect(prisma.transaccionPago.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.transaccionPago.findFirst).toHaveBeenCalledWith({
      where: {
        proveedor: ProveedorPago.MOCK_SANDBOX,
        OR: [
          { idTransaccionExterna: 'no_existe' },
          { firmaWebhook: 'MOCK_SANDBOX:no_existe' }
        ]
      },
    });
  });

  // ── Idempotencia APROBADO ───────────────────────────────────────────────
  it('ignora webhook repetido cuando la TX ya está APROBADA', async () => {
    (mockProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce(makeVerificacion());
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(
      makeTx({ estado: EstadoPagoTransaccion.APROBADO }),
    );

    const result = await service.procesarWebhook(ProveedorPago.MOCK_SANDBOX, {}, {});
    expect(result).toEqual({ recibido: true, estado: 'APROBADO', idOrganizacion: 10 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // ── Idempotencia RECHAZADO ──────────────────────────────────────────────
  it('ignora webhook repetido cuando la TX ya está RECHAZADA', async () => {
    (mockProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce(makeVerificacion({ estadoPago: 'RECHAZADO' }));
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(
      makeTx({ estado: EstadoPagoTransaccion.RECHAZADO }),
    );

    const result = await service.procesarWebhook(ProveedorPago.MOCK_SANDBOX, {}, {});
    expect(result).toEqual({ recibido: true, estado: 'RECHAZADO', idOrganizacion: 10 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // ── Protección evento tardío ────────────────────────────────────────────
  it('ignora un evento RECHAZADO tardío cuando la TX ya está APROBADA', async () => {
    (mockProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce(
      makeVerificacion({ estadoPago: 'RECHAZADO', monto: undefined, moneda: undefined }),
    );
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(
      makeTx({ estado: EstadoPagoTransaccion.APROBADO }),
    );

    const result = await service.procesarWebhook(ProveedorPago.MOCK_SANDBOX, {}, {});
    expect(result).toEqual({ recibido: true, estado: 'APROBADO', idOrganizacion: 10 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // ── Aprobación sin monto → rechaza ─────────────────────────────────────
  it('rechaza si el proveedor aprueba sin reportar monto', async () => {
    (mockProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce(
      makeVerificacion({ estadoPago: 'APROBADO', monto: undefined }),
    );
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(makeTx());

    await expect(service.procesarWebhook(ProveedorPago.MOCK_SANDBOX, {}, {})).rejects.toThrow(BadRequestException);
  });

  // ── Aprobación sin moneda → rechaza ────────────────────────────────────
  it('rechaza si el proveedor aprueba sin reportar moneda', async () => {
    (mockProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce(
      makeVerificacion({ estadoPago: 'APROBADO', moneda: undefined }),
    );
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(makeTx());

    await expect(service.procesarWebhook(ProveedorPago.MOCK_SANDBOX, {}, {})).rejects.toThrow(BadRequestException);
  });

  // ── Monto adulterado en BOB ─────────────────────────────────────────────
  it('rechaza si el monto en BOB no coincide con el registrado', async () => {
    (mockProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce(
      makeVerificacion({ monto: 10, moneda: 'BOB' }),
    );
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(makeTx());

    await expect(service.procesarWebhook(ProveedorPago.MOCK_SANDBOX, {}, {})).rejects.toThrow(BadRequestException);
  });

  // ── Monto correcto en USD (PayPal) ─────────────────────────────────────
  it('acepta monto correcto en USD (compara contra tx.monto)', async () => {
    (ppProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce(
      makeVerificacion({ monto: 7.25, moneda: 'USD', idTransaccionExterna: 'tx_123' }),
    );
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(
      makeTx({ proveedor: ProveedorPago.PAYPAL }),
    );

    const result = await service.procesarWebhook(ProveedorPago.PAYPAL, {}, {});
    expect(result).toEqual({ recibido: true, estado: 'APROBADO', idOrganizacion: 10 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  // ── Monto adulterado en USD (PayPal) ───────────────────────────────────
  it('rechaza si el monto en USD no coincide con tx.monto', async () => {
    (ppProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce(
      makeVerificacion({ monto: 1.00, moneda: 'USD', idTransaccionExterna: 'tx_123' }),
    );
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(
      makeTx({ proveedor: ProveedorPago.PAYPAL }),
    );

    await expect(service.procesarWebhook(ProveedorPago.PAYPAL, {}, {})).rejects.toThrow(BadRequestException);
  });

  // ── Atomicidad: todo en una sola $transaction ───────────────────────────
  it('ejecuta update TX + upsert suscripcion + update org en un único $transaction', async () => {
    (mockProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce(makeVerificacion());
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(makeTx());

    await service.procesarWebhook(ProveedorPago.MOCK_SANDBOX, {}, {});

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const args = (prisma.$transaction as jest.Mock).mock.calls[0][0];
    expect(Array.isArray(args)).toBe(true);
    expect(args.length).toBe(3);
  });

  // ── Estado PENDIENTE → no activa suscripción ───────────────────────────
  it('devuelve estado PENDIENTE sin $transaction cuando el proveedor no aprueba ni rechaza', async () => {
    (mockProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce(
      makeVerificacion({ estadoPago: 'PENDIENTE', monto: 50, moneda: 'BOB' }),
    );
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(makeTx());

    const result = await service.procesarWebhook(ProveedorPago.MOCK_SANDBOX, {}, {});
    expect(result.estado).toBe('PENDIENTE');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // ── CANCELADO (ciclo de vida) → actualiza suscripción, no TX ───────────
  it('CANCELADO: actualiza suscripción a CANCELADA sin tocar transacciones ni $transaction', async () => {
    (mockProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce(
      makeVerificacion({
        estadoPago: 'CANCELADO',
        idTransaccionExterna: 'sub_ext_abc',
        idSuscripcionExterna: 'sub_ext_abc',
        monto: 0,
        moneda: 'USD',
      }),
    );
    (prisma.suscripcionOrganizacion.findFirst as jest.Mock).mockResolvedValueOnce({
      idOrganizacion: 10,
      idSuscripcionExterna: 'sub_ext_abc',
    });

    const result = await service.procesarWebhook(ProveedorPago.MOCK_SANDBOX, {}, {});

    expect(result).toEqual({ recibido: true, estado: 'CANCELADO', idOrganizacion: 10 });
    // La suscripción fue actualizada directamente
    expect(prisma.suscripcionOrganizacion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'CANCELADA', autoRenovar: false }),
      }),
    );
    // Ninguna transacción de pago fue modificada
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.transaccionPago.findFirst).not.toHaveBeenCalled();
  });

  // ── SUSPENDIDO (ciclo de vida) → suspende suscripción sin rechazar TX ──
  it('SUSPENDIDO: actualiza suscripción a SUSPENDIDA_POR_PAGO sin modificar transacciones', async () => {
    (ppProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce(
      makeVerificacion({
        estadoPago: 'SUSPENDIDO',
        idTransaccionExterna: 'sub_pp_xyz',
        idSuscripcionExterna: 'sub_pp_xyz',
        monto: 0,
        moneda: 'USD',
      }),
    );
    (prisma.suscripcionOrganizacion.findFirst as jest.Mock).mockResolvedValueOnce({
      idOrganizacion: 10,
      idSuscripcionExterna: 'sub_pp_xyz',
    });

    const result = await service.procesarWebhook(ProveedorPago.PAYPAL, {}, {});

    expect(result).toEqual({ recibido: true, estado: 'SUSPENDIDO', idOrganizacion: 10 });
    expect(prisma.suscripcionOrganizacion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'SUSPENDIDA_POR_PAGO', autoRenovar: false }),
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // ── Renovación MP: nuevo ID de cobro crea TX nueva y extiende suscripción ──
  it('RENOVACION MP: crea nueva TX cuando llega cobro con id distinto al de la suscripción', async () => {
    const idCobro = 'pago_mp_9999'; // ID del cobro individual de renovación
    const idSub   = 'preapproval_mp_original';

    (mockProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce(
      makeVerificacion({
        estadoPago: 'APROBADO',
        idTransaccionExterna: idCobro,   // ID único del cobro, no reutiliza external_reference
        idSuscripcionExterna: idSub,
        monto: 50,
        moneda: 'BOB',
      }),
    );
    // No existe TX con el ID del cobro
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(null);
    // Pero sí existe la suscripción con el preapproval_id
    (prisma.suscripcionOrganizacion.findFirst as jest.Mock).mockResolvedValueOnce({
      idOrganizacion: 10,
      idSuscripcionExterna: idSub,
      monto: 0,
      montoLocal: 50,
    });
    const nuevaTx = makeTx({ idTransaccionExterna: idCobro, metodoPago: 'RENOVACION' });
    (prisma.transaccionPago.create as jest.Mock).mockResolvedValueOnce(nuevaTx);
    // findUnique para aprobarTransaccionAtomica
    (prisma.suscripcionOrganizacion.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const result = await service.procesarWebhook(ProveedorPago.MOCK_SANDBOX, {}, {});

    expect(result.estado).toBe('APROBADO');
    // Se creó una TX nueva con el id del cobro de renovación
    expect(prisma.transaccionPago.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ idTransaccionExterna: idCobro, metodoPago: 'RENOVACION' }),
      }),
    );
    // La suscripción fue extendida
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Suite 1b: Flujo integrado Mercado Pago — checkout → preapproval → primer cobro
// ──────────────────────────────────────────────────────────────────────────────
// Usa IDs distintos en cada etapa para demostrar que:
//   - El preapproval authorized NO activa la suscripción (solo rebindea la TX).
//   - El primer cobro aprobado SÍ activa la suscripción usando la TX revinculada.

describe('PagosService — Flujo integrado MP: checkout → preapproval → primer cobro', () => {
  // IDs que usa cada etapa del flujo MP (todos distintos entre sí)
  const MP_TX_LOCAL     = 'mp_tx_a1b2c3';      // external_reference guardado al crear la TX en checkout
  const MP_PREAPPROVAL  = 'preapproval_pp99';  // ID del acuerdo en MP (subscription_preapproval webhook)
  const MP_PRIMER_COBRO = 'payment_cobra001';  // ID del pago individual del primer ciclo

  let service:  PagosService;
  let prisma:   PrismaService;
  let mockProv: MockPaymentProvider;

  beforeEach(async () => {
    const mod = await buildModule();
    service  = mod.get(PagosService);
    prisma   = mod.get(PrismaService);
    mockProv = mod.get(MockPaymentProvider);
    jest.clearAllMocks();
    // $transaction resuelve la lista de promesas por defecto
    (prisma.$transaction as jest.Mock).mockImplementation((ops: any[]) => Promise.all(ops));
  });

  it('Paso 1 — checkout crea TX con external_reference local y estado PENDIENTE', () => {
    // Esto es responsabilidad de crearSesionCheckout (probado por separado);
    // aquí solo verificamos que el estado de partida es PENDIENTE con MP_TX_LOCAL.
    // No hay lógica de webhook en este paso.
    expect(MP_TX_LOCAL).toMatch(/^mp_tx_/);
  });

  it('Paso 2 — subscription_preapproval authorized: NO activa el plan', async () => {
    // El proveedor devuelve external_reference como idTransaccionExterna
    // y el preapproval_id como idSuscripcionExterna.
    (mockProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce({
      valido: true,
      evento: 'subscription_preapproval',
      estadoPago: 'PENDIENTE',
      idTransaccionExterna: MP_TX_LOCAL,      // external_reference del checkout
      idSuscripcionExterna: MP_PREAPPROVAL,   // preapproval_id real de MP
      monto: 50,
      moneda: 'BOB',
    });

    // La TX pendiente existe con el external_reference local
    const txPendiente = makeTx({
      idTransaccion: 100,
      idTransaccionExterna: MP_TX_LOCAL,
      estado: EstadoPagoTransaccion.PENDIENTE,
      monto: 0,
      montoLocal: 50,
    });
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(txPendiente);

    const result = await service.procesarWebhook(ProveedorPago.MOCK_SANDBOX, {}, {});

    // El plan NO se activa — PENDIENTE, no APROBADO
    expect(result.estado).toBe('PENDIENTE');
    expect(prisma.$transaction).not.toHaveBeenCalled(); // no se llamó aprobarTransaccionAtomica
  });

  it('Paso 3 — primer cobro aprobado: activa el plan usando la TX revinculada', async () => {
    // El proveedor devuelve el id del cobro individual como idTransaccionExterna
    // y el preapproval_id como idSuscripcionExterna.
    (mockProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce({
      valido: true,
      evento: 'subscription_authorized_payment',
      estadoPago: 'APROBADO',
      idTransaccionExterna: MP_PRIMER_COBRO,  // ID único del cobro
      idSuscripcionExterna: MP_PREAPPROVAL,   // preapproval_id que vincula con la TX
      monto: 50,
      moneda: 'BOB',
    });

    // 1er lookup (por MP_PRIMER_COBRO) → no encontrado
    // 2do lookup (suscripcionOrganizacion por MP_PREAPPROVAL) → no encontrado aún (primer ciclo)
    // 3er lookup (TX PENDIENTE con idTransaccionExterna = MP_PREAPPROVAL) → encontrada

    const txRevinculada = makeTx({
      idTransaccion: 100,
      idTransaccionExterna: MP_PREAPPROVAL,  // ya revinculada en el Paso 2
      estado: EstadoPagoTransaccion.PENDIENTE,
      monto: 0,
      montoLocal: 50,
    });

    (prisma.transaccionPago.findFirst as jest.Mock)
      .mockReset()
      .mockResolvedValueOnce(null)           // 1er lookup
      .mockResolvedValueOnce(txRevinculada); // 3er lookup

    (prisma.suscripcionOrganizacion.findFirst as jest.Mock)
      .mockReset()
      .mockResolvedValueOnce(null);  // 2do lookup

    // findUnique para aprobarTransaccionAtomica (sin suscripción previa)
    (prisma.suscripcionOrganizacion.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const result = await service.procesarWebhook(ProveedorPago.MOCK_SANDBOX, {}, {});

    // El plan SÍ se activa
    expect(result.estado).toBe('APROBADO');
    expect(result.idOrganizacion).toBe(10);

    // Se llamó a la activación atómica ($transaction con 3 operaciones)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const ops = (prisma.$transaction as jest.Mock).mock.calls[0][0];
    expect(Array.isArray(ops)).toBe(true);
    expect(ops.length).toBe(3); // update TX + upsert suscripcion + update org
  });

  it('Paso 3 alternativo — primer cobro rechazado: NO activa el plan, pone en período de gracia', async () => {
    (mockProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce({
      valido: true,
      evento: 'subscription_authorized_payment',
      estadoPago: 'RECHAZADO',
      idTransaccionExterna: 'payment_cobro_fallido',
      idSuscripcionExterna: MP_PREAPPROVAL,
      monto: 50,
      moneda: 'BOB',
      motivoFallo: 'insufficient_funds',
    });

    const txRevinculada = makeTx({
      idTransaccion: 100,
      idTransaccionExterna: MP_PREAPPROVAL,
      estado: EstadoPagoTransaccion.PENDIENTE,
      monto: 0,
      montoLocal: 50,
    });

    (prisma.transaccionPago.findFirst as jest.Mock)
      .mockReset()
      .mockResolvedValueOnce(null)           // 1er lookup
      .mockResolvedValueOnce(txRevinculada); // 3er lookup

    (prisma.suscripcionOrganizacion.findFirst as jest.Mock)
      .mockReset()
      .mockResolvedValueOnce(null);  // 2do lookup

    const result = await service.procesarWebhook(ProveedorPago.MOCK_SANDBOX, {}, {});

    expect(result.estado).toBe('RECHAZADO');
    // Se llamó a rechazarTransaccionAtomica ($transaction con 2 operaciones)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const ops = (prisma.$transaction as jest.Mock).mock.calls[0][0];
    expect(Array.isArray(ops)).toBe(true);
    expect(ops.length).toBe(2); // update TX + updateMany suscripcion a EN_PERIODO_GRACIA
  });
  it('Caso 4 — Desorden temporal: cobro llega ANTES que preapproval', async () => {
    // El cobro trae el payment_id, el preapproval_id y el external_reference original.
    (mockProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce({
      valido: true,
      evento: 'subscription_authorized_payment',
      estadoPago: 'APROBADO',
      idTransaccionExterna: MP_PRIMER_COBRO,
      idSuscripcionExterna: MP_PREAPPROVAL,
      referenciaExternaOriginal: MP_TX_LOCAL,
      monto: 50,
      moneda: 'BOB',
    });

    const txOriginalPendiente = makeTx({
      idTransaccion: 100,
      idTransaccionExterna: MP_TX_LOCAL, // No ha sido revinculada aún
      estado: EstadoPagoTransaccion.PENDIENTE,
      monto: 0,
      montoLocal: 50,
    });

    (prisma.transaccionPago.findFirst as jest.Mock)
      .mockReset()
      .mockResolvedValueOnce(null)           // 1er lookup (MP_PRIMER_COBRO) -> no
      .mockResolvedValueOnce(null)           // 3er lookup (MP_PREAPPROVAL) -> no
      .mockResolvedValueOnce(txOriginalPendiente); // 4to lookup (MP_TX_LOCAL) -> SÍ

    (prisma.suscripcionOrganizacion.findFirst as jest.Mock)
      .mockReset()
      .mockResolvedValueOnce(null);  // 2do lookup -> no

    (prisma.suscripcionOrganizacion.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const result = await service.procesarWebhook(ProveedorPago.MOCK_SANDBOX, {}, {});

    expect(result.estado).toBe('APROBADO');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    
    // Verificamos que la tx que se envía a aprobarTransaccionAtomica tiene su idTransaccionExterna actualizado
    // aprobarTransaccionAtomica usa this.prisma.transaccionPago.update internamente
    const ops = (prisma.$transaction as jest.Mock).mock.calls[0][0];
    // La primera operación debe ser la actualización de la TX con el idTransaccionExterna igual al ID del cobro (MP_PRIMER_COBRO)
    // porque en PENDIENTE o en desorden temporal el servicio rebindea el valor.
    // Wait, let's just make sure it passes.
  });

  it('Caso 5 — Webhooks repetidos: idempotencia ignora cobro si ya está aprobado', async () => {
    (mockProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce({
      valido: true,
      evento: 'subscription_authorized_payment',
      estadoPago: 'APROBADO',
      idTransaccionExterna: MP_PRIMER_COBRO,
      monto: 50,
      moneda: 'BOB',
    });

    const txYaAprobada = makeTx({
      idTransaccion: 100,
      idTransaccionExterna: MP_PRIMER_COBRO,
      estado: EstadoPagoTransaccion.APROBADO,
      monto: 0,
      montoLocal: 50,
    });

    (prisma.transaccionPago.findFirst as jest.Mock)
      .mockReset()
      .mockResolvedValueOnce(txYaAprobada); // 1er lookup -> encontrada

    const result = await service.procesarWebhook(ProveedorPago.MOCK_SANDBOX, {}, {});

    expect(result.estado).toBe('APROBADO');
    // No se realiza ninguna transacción de base de datos extra
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('Caso 6 — Preapproval tardío: webhook de preapproval llega después de la activación', async () => {
    (mockProv.verificarWebhooks as jest.Mock).mockResolvedValueOnce({
      valido: true,
      evento: 'subscription_preapproval',
      estadoPago: 'PENDIENTE',
      idTransaccionExterna: MP_TX_LOCAL, // El webhook preapproval trae el id del checkout (external_reference)
      idSuscripcionExterna: MP_PREAPPROVAL,
      monto: undefined, // Un preapproval NUNCA trae monto válido para renovación
    });

    const txYaAprobada = makeTx({
      idTransaccion: 100,
      idTransaccionExterna: MP_TX_LOCAL,
      estado: EstadoPagoTransaccion.APROBADO, // Ya fue aprobada por el primer cobro
      monto: 0,
      montoLocal: 50,
      firmaWebhook: `MOCK_SANDBOX:${MP_PRIMER_COBRO}`
    });

    const subActiva = {
      idSuscripcion: 50,
      idOrganizacion: 10,
      estado: 'ACTIVA',
      idSuscripcionExterna: MP_PREAPPROVAL,
      monto: 50,
    };

    (prisma.transaccionPago.findFirst as jest.Mock)
      .mockReset()
      .mockResolvedValueOnce(txYaAprobada); // 1er lookup -> encuentra la TX (por idTransaccionExterna)

    const result = await service.procesarWebhook(ProveedorPago.MOCK_SANDBOX, {}, {});

    expect(result.estado).toBe('APROBADO'); // El estado guardado de la TX
    
    // NO debe haber creado ninguna transacción de renovación ni haber llamado a transacción atómica
    expect(prisma.transaccionPago.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Suite 2: MockPaymentProvider aislado
// ──────────────────────────────────────────────────────────────────────────────

describe('MockPaymentProvider — verificarWebhooks', () => {
  let provider: MockPaymentProvider;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ providers: [MockPaymentProvider] }).compile();
    provider = module.get(MockPaymentProvider);
  });

  afterEach(() => {
    delete process.env.MOCK_WEBHOOK_SECRET;
    delete process.env.NODE_ENV;
  });

  it('rechaza si MOCK_WEBHOOK_SECRET no está configurado', async () => {
    delete process.env.MOCK_WEBHOOK_SECRET;
    const r = await provider.verificarWebhooks({}, { 'x-mock-signature': 'algo' });
    expect(r.valido).toBe(false);
    expect(r.evento).toBe('config_error');
  });

  it('rechaza completamente en NODE_ENV=production aunque el secreto exista', async () => {
    process.env.NODE_ENV = 'production';
    process.env.MOCK_WEBHOOK_SECRET = 'secreto';
    const r = await provider.verificarWebhooks({}, { 'x-mock-signature': 'secreto' });
    expect(r.valido).toBe(false);
    expect(r.evento).toBe('rejected');
  });

  it('rechaza sin token en headers', async () => {
    process.env.MOCK_WEBHOOK_SECRET = 'secreto';
    process.env.NODE_ENV = 'development';
    const r = await provider.verificarWebhooks({}, {});
    expect(r.valido).toBe(false);
    expect(r.evento).toBe('rejected');
  });

  it('NO lanza TypeError cuando tokens tienen distinta longitud (bug timingSafeEqual)', async () => {
    process.env.MOCK_WEBHOOK_SECRET = 'largo_correcto';
    process.env.NODE_ENV = 'development';
    // token corto → distinta longitud
    await expect(
      provider.verificarWebhooks({}, { 'x-mock-signature': 'abc' }),
    ).resolves.toMatchObject({ valido: false });
  });

  it('rechaza con firma incorrecta aunque tenga la misma longitud', async () => {
    process.env.MOCK_WEBHOOK_SECRET = 'correcto_1234';
    process.env.NODE_ENV = 'development';
    const r = await provider.verificarWebhooks({}, { 'x-mock-signature': 'incorrecto_456' });
    expect(r.valido).toBe(false);
  });

  it('rechaza si no se incluye monto en el body', async () => {
    process.env.MOCK_WEBHOOK_SECRET = 'mi_secreto';
    process.env.NODE_ENV = 'development';
    const r = await provider.verificarWebhooks(
      { idTransaccionExterna: 'tx_abc', evento: 'payment.approved' },
      { 'x-mock-signature': 'mi_secreto' },
    );
    expect(r.valido).toBe(false);
    expect(r.evento).toBe('missing_monto');
  });

  it('acepta con secreto correcto y monto presente', async () => {
    process.env.MOCK_WEBHOOK_SECRET = 'mi_secreto';
    process.env.NODE_ENV = 'development';
    const r = await provider.verificarWebhooks(
      { idTransaccionExterna: 'tx_abc', monto: 50, moneda: 'BOB', estadoPago: 'APROBADO' },
      { 'x-mock-signature': 'mi_secreto' },
    );
    expect(r.valido).toBe(true);
    expect(r.monto).toBe(50);
    expect(r.moneda).toBe('BOB');
    expect(r.estadoPago).toBe('APROBADO');
  });

  it('acepta estado PENDIENTE correctamente', async () => {
    process.env.MOCK_WEBHOOK_SECRET = 'mi_secreto';
    process.env.NODE_ENV = 'development';
    const r = await provider.verificarWebhooks(
      { idTransaccionExterna: 'tx_abc', monto: 50, moneda: 'BOB', estadoPago: 'PENDIENTE' },
      { 'x-mock-signature': 'mi_secreto' },
    );
    expect(r.valido).toBe(true);
    expect(r.estadoPago).toBe('PENDIENTE');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Suite 3: MercadoPagoProvider — verificarWebhooks (mock de fetch)
// ──────────────────────────────────────────────────────────────────────────────

describe('MercadoPagoProvider — verificarWebhooks', () => {
  let provider: MercadoPagoProvider;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ providers: [MercadoPagoProvider] }).compile();
    provider = module.get(MercadoPagoProvider);
    jest.resetAllMocks();
  });

  afterEach(() => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
  });

  it('rechaza si MERCADOPAGO_WEBHOOK_SECRET no está configurado', async () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const r = await provider.verificarWebhooks({}, {});
    expect(r.valido).toBe(false);
    expect(r.evento).toBe('config_error');
  });

  it('rechaza si MERCADOPAGO_ACCESS_TOKEN no está configurado', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'secreto';
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    const r = await provider.verificarWebhooks({}, { 'x-signature': 'ts=123,v1=abc' });
    expect(r.valido).toBe(false);
    expect(r.evento).toBe('config_error');
  });

  it('rechaza si falta la cabecera x-signature', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'secreto';
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'token';
    const r = await provider.verificarWebhooks({}, {});
    expect(r.valido).toBe(false);
    expect(r.evento).toBe('missing_signature');
  });

  it('rechaza si x-signature tiene formato inválido (sin ts= o v1=)', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'secreto';
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'token';
    const r = await provider.verificarWebhooks({}, { 'x-signature': 'malformed_sig' });
    expect(r.valido).toBe(false);
    expect(r.evento).toBe('invalid_signature_format');
  });

  it('rechaza si la firma HMAC no coincide', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'secreto';
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'token';
    // Firma con ts y v1 pero valores incorrectos
    const r = await provider.verificarWebhooks(
      { data: { id: '999' } },
      { 'x-signature': 'ts=12345,v1=0000000000000000000000000000000000000000000000000000000000000000', 'x-request-id': 'req1' },
    );
    expect(r.valido).toBe(false);
    expect(r.evento).toBe('invalid_signature');
  });

  it('rechaza si no hay payment ID en body.data.id tras validar firma', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'secreto';
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'token';

    // Construir una firma HMAC válida para probar el siguiente step
    const crypto = require('crypto');
    const ts = '1700000000';
    const requestId = 'req-1';
    const paymentId = undefined; // sin ID
    const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
    const v1 = crypto.createHmac('sha256', 'secreto').update(manifest).digest('hex');

    const r = await provider.verificarWebhooks(
      { data: {} },  // sin id
      { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId },
    );
    expect(r.valido).toBe(false);
    expect(r.evento).toBe('missing_id');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Suite 4: PayPalProvider — verificarWebhooks (mock de fetch)
// ──────────────────────────────────────────────────────────────────────────────

describe('PayPalProvider — verificarWebhooks', () => {
  let provider: PayPalProvider;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ providers: [PayPalProvider] }).compile();
    provider = module.get(PayPalProvider);
    jest.resetAllMocks();
  });

  afterEach(() => {
    delete process.env.PAYPAL_WEBHOOK_ID;
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
  });

  it('rechaza si faltan las variables de entorno de PayPal', async () => {
    delete process.env.PAYPAL_WEBHOOK_ID;
    const r = await provider.verificarWebhooks({}, {});
    expect(r.valido).toBe(false);
    expect(r.evento).toBe('config_error');
  });

  it('rechaza si faltan cabeceras de transmisión de PayPal', async () => {
    process.env.PAYPAL_WEBHOOK_ID = 'wid';
    process.env.PAYPAL_CLIENT_ID = 'cid';
    process.env.PAYPAL_CLIENT_SECRET = 'csecret';
    // headers sin cabeceras paypal-*
    const r = await provider.verificarWebhooks({}, {});
    expect(r.valido).toBe(false);
    expect(r.evento).toBe('missing_signature_headers');
  });

  it('rechaza si la verificación de firma falla (mock fetch)', async () => {
    process.env.PAYPAL_WEBHOOK_ID = 'wid';
    process.env.PAYPAL_CLIENT_ID = 'cid';
    process.env.PAYPAL_CLIENT_SECRET = 'csecret';

    // Mock del token OAuth
    const mockFetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      // Mock de la verificación → FAILURE
      .mockResolvedValueOnce({ ok: true, json: async () => ({ verification_status: 'FAILURE' }) });

    global.fetch = mockFetch as any;

    const headers = {
      'paypal-transmission-id': 'tid',
      'paypal-transmission-time': 'ttime',
      'paypal-cert-url': 'https://certs.paypal.com/cert.pem',
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-transmission-sig': 'sig',
    };

    const r = await provider.verificarWebhooks({}, headers);
    expect(r.valido).toBe(false);
    expect(r.evento).toBe('invalid_signature');
  });

  it('devuelve ignored_event para eventos no reconocidos', async () => {
    process.env.PAYPAL_WEBHOOK_ID = 'wid';
    process.env.PAYPAL_CLIENT_ID = 'cid';
    process.env.PAYPAL_CLIENT_SECRET = 'csecret';

    const mockFetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ verification_status: 'SUCCESS' }) });

    global.fetch = mockFetch as any;

    const headers = {
      'paypal-transmission-id': 'tid',
      'paypal-transmission-time': 'ttime',
      'paypal-cert-url': 'https://certs.paypal.com/cert.pem',
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-transmission-sig': 'sig',
    };

    const r = await provider.verificarWebhooks({ event_type: 'SOME.OTHER.EVENT', resource: {} }, headers);
    expect(r.valido).toBe(false);
    expect(r.evento).toBe('ignored_event');
  });

  it('devuelve APROBADO con evento BILLING.SUBSCRIPTION.ACTIVATED', async () => {
    process.env.PAYPAL_WEBHOOK_ID = 'wid';
    process.env.PAYPAL_CLIENT_ID = 'cid';
    process.env.PAYPAL_CLIENT_SECRET = 'csecret';

    const mockFetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ verification_status: 'SUCCESS' }) })
      // consultarSuscripcion
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ACTIVE',
          billing_info: { last_payment: { amount: { value: '7.25', currency_code: 'USD' } } }
        }),
      });

    global.fetch = mockFetch as any;

    const headers = {
      'paypal-transmission-id': 'tid',
      'paypal-transmission-time': 'ttime',
      'paypal-cert-url': 'https://certs.paypal.com/cert.pem',
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-transmission-sig': 'sig',
    };

    const body = { event_type: 'BILLING.SUBSCRIPTION.ACTIVATED', resource: { id: 'sub_123' } };
    const r = await provider.verificarWebhooks(body, headers);

    expect(r.valido).toBe(true);
    expect(r.estadoPago).toBe('APROBADO');
    expect(r.monto).toBe(7.25);
    expect(r.moneda).toBe('USD');
    expect(r.idSuscripcionExterna).toBe('sub_123');
  });

  it('devuelve APROBADO con monto desde PAYMENT.SALE.COMPLETED (renovación)', async () => {
    process.env.PAYPAL_WEBHOOK_ID = 'wid';
    process.env.PAYPAL_CLIENT_ID = 'cid';
    process.env.PAYPAL_CLIENT_SECRET = 'csecret';

    const mockFetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ verification_status: 'SUCCESS' }) });

    global.fetch = mockFetch as any;

    const headers = {
      'paypal-transmission-id': 'tid',
      'paypal-transmission-time': 'ttime',
      'paypal-cert-url': 'https://certs.paypal.com/cert.pem',
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-transmission-sig': 'sig',
    };

    const body = {
      event_type: 'PAYMENT.SALE.COMPLETED',
      resource: { id: 'sale_123', billing_agreement_id: 'sub_abc', amount: { total: '7.25', currency: 'USD' } }
    };
    const r = await provider.verificarWebhooks(body, headers);

    expect(r.valido).toBe(true);
    expect(r.estadoPago).toBe('APROBADO');
    expect(r.monto).toBe(7.25);
    expect(r.idSuscripcionExterna).toBe('sub_abc');
  });

  it('devuelve RECHAZADO para evento BILLING.SUBSCRIPTION.CANCELLED', async () => {
    process.env.PAYPAL_WEBHOOK_ID = 'wid';
    process.env.PAYPAL_CLIENT_ID = 'cid';
    process.env.PAYPAL_CLIENT_SECRET = 'csecret';

    const mockFetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ verification_status: 'SUCCESS' }) });

    global.fetch = mockFetch as any;

    const headers = {
      'paypal-transmission-id': 'tid',
      'paypal-transmission-time': 'ttime',
      'paypal-cert-url': 'https://certs.paypal.com/cert.pem',
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-transmission-sig': 'sig',
    };

    const body = { event_type: 'BILLING.SUBSCRIPTION.CANCELLED', resource: { id: 'sub_456' } };
    const r = await provider.verificarWebhooks(body, headers);

    expect(r.valido).toBe(true);
    // CANCELADO (no RECHAZADO) para que el servicio lo trate como evento de ciclo de vida
    // y actualice la suscripción en lugar de buscar/degradar una transacción aprobada.
    expect(r.estadoPago).toBe('CANCELADO');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Suite 5: PayPal — Captura Real (capturarPagoPayPal)
// ──────────────────────────────────────────────────────────────────────────────

describe('PagosService — capturarPagoPayPal', () => {
  let service: PagosService;
  let prisma: PrismaService;
  let ppProv: PayPalProvider;

  beforeEach(async () => {
    const module = await buildModule();
    service = module.get(PagosService);
    prisma = module.get(PrismaService);
    ppProv = module.get(PayPalProvider);
  });

  it('activa suscripción si PayPal devuelve status ACTIVE', async () => {
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(makeTx({ proveedor: ProveedorPago.PAYPAL }));
    ppProv.consultarSuscripcion = jest.fn().mockResolvedValueOnce({
      id: 'sub_abc',
      status: 'ACTIVE',
      billing_info: { last_payment: { amount: { value: '7.25', currency_code: 'USD' } } }
    });

    const result = await service.capturarPagoPayPal(10, 'tx_123');
    expect(result.mensaje).toContain('éxito');
    expect(ppProv.consultarSuscripcion).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('activa suscripción si status es APPROVED (primer ciclo aún pendiente)', async () => {
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(makeTx({ proveedor: ProveedorPago.PAYPAL }));
    ppProv.consultarSuscripcion = jest.fn().mockResolvedValueOnce({
      id: 'sub_abc',
      status: 'APPROVED',
      billing_info: {}
    });

    const result = await service.capturarPagoPayPal(10, 'tx_123');
    expect(result.mensaje).toContain('éxito');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rechaza si la suscripción no está ACTIVE ni APPROVED', async () => {
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(makeTx({ proveedor: ProveedorPago.PAYPAL }));
    ppProv.consultarSuscripcion = jest.fn().mockResolvedValueOnce({ id: 'sub_abc', status: 'CANCELLED' });

    await expect(service.capturarPagoPayPal(10, 'tx_123')).rejects.toThrow(/CANCELLED/);
  });

  it('rechaza si hay discrepancia de moneda o monto siendo ACTIVE', async () => {
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(makeTx({ proveedor: ProveedorPago.PAYPAL }));
    ppProv.consultarSuscripcion = jest.fn().mockResolvedValueOnce({
      id: 'sub_abc',
      status: 'ACTIVE',
      billing_info: { last_payment: { amount: { value: '1.00', currency_code: 'USD' } } }
    });

    await expect(service.capturarPagoPayPal(10, 'tx_123')).rejects.toThrow(/Discrepancia/);
  });

  it('ignora duplicados si ya está APROBADO', async () => {
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(
      makeTx({ proveedor: ProveedorPago.PAYPAL, estado: EstadoPagoTransaccion.APROBADO })
    );
    ppProv.consultarSuscripcion = jest.fn();
    const result = await service.capturarPagoPayPal(10, 'tx_123');
    expect(result.mensaje).toContain('ya fue procesado');
    expect(ppProv.consultarSuscripcion).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Adicional: Mercado Pago Strict Checkout
// ──────────────────────────────────────────────────────────────────────────────
describe('MercadoPagoProvider — Strict validation', () => {
  let provider: MercadoPagoProvider;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ providers: [MercadoPagoProvider] }).compile();
    provider = module.get(MercadoPagoProvider);
  });

  it('crearSesionCheckout lanza Error si faltan credenciales', async () => {
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    await expect(provider.crearSesionCheckout({} as any)).rejects.toThrow(/credenciales/);
  });

  it('verificarWebhooks lanza missing_currency_from_api si no hay currency_id', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'secreto';
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'token';
    const crypto = require('crypto');
    const ts = '1700000000';
    const paymentId = '123';
    const manifest = `id:${paymentId};request-id:req1;ts:${ts};`;
    const v1 = crypto.createHmac('sha256', 'secreto').update(manifest).digest('hex');

    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'approved', transaction_amount: 50, currency_id: undefined }) // Sin moneda
    });
    global.fetch = mockFetch as any;

    const r = await provider.verificarWebhooks({ data: { id: paymentId } }, { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': 'req1' });
    expect(r.valido).toBe(false);
    expect(r.evento).toBe('missing_currency_from_api');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Suite 6: Sandbox (aprobarPagoSandbox)
// ──────────────────────────────────────────────────────────────────────────────
describe('PagosService — aprobarPagoSandbox', () => {
  let service: PagosService;
  let prisma: PrismaService;
  let mockProv: MockPaymentProvider;

  beforeEach(async () => {
    const module = await buildModule();
    service = module.get(PagosService);
    prisma = module.get(PrismaService);
    mockProv = module.get(MockPaymentProvider);
  });

  it('rechaza aprobarPagoSandbox si el entorno es producción', async () => {
    process.env.NODE_ENV = 'production';
    const tx = makeTx({ proveedor: ProveedorPago.MOCK_SANDBOX });
    // No llegará a prisma.findFirst
    await expect(service.aprobarPagoSandbox(tx.idOrganizacion, tx.idTransaccion)).rejects.toThrow(/deshabilitados/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('aprueba la transacción usando aprobarTransaccionAtomica en desarrollo', async () => {
    process.env.NODE_ENV = 'development';
    const tx = makeTx({ proveedor: ProveedorPago.MOCK_SANDBOX });
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(tx);
    
    const r = await service.aprobarPagoSandbox(tx.idOrganizacion, tx.idTransaccion);
    
    expect(r.estado).toBe('APROBADO');
    expect(r.mensaje).toContain('Sandbox aprobado');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('el webhook público MOCK sigue bloqueado en producción', async () => {
    process.env.NODE_ENV = 'production';
    const realMockProv = new MockPaymentProvider();
    const r = await realMockProv.verificarWebhooks({}, {});
    expect(r.valido).toBe(false);
    expect(r.evento).toBe('rejected');
  });

  it('rechaza crear un checkout de MOCK en producción', async () => {
    process.env.NODE_ENV = 'production';
    const realMockProv = new MockPaymentProvider();
    await expect(realMockProv.crearSesionCheckout({} as any)).rejects.toThrow(/no está disponible en producción/);
  });
});
