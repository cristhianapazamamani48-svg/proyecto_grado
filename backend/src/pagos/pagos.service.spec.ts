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
          transaccionPago: { findFirst: jest.fn(), update: jest.fn() },
          suscripcionOrganizacion: { upsert: jest.fn(), update: jest.fn() },
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
      where: { proveedor: ProveedorPago.MOCK_SANDBOX, idTransaccionExterna: 'no_existe' },
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
    expect(r.evento).toBe('missing_payment_id');
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

  it('rechaza si no hay resource.id (capture ID) en el body tras validar firma', async () => {
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

    const r = await provider.verificarWebhooks({ event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: {} }, headers);
    expect(r.valido).toBe(false);
    expect(r.evento).toBe('missing_capture_id');
  });

  it('devuelve APROBADO con monto USD desde la API de captures', async () => {
    process.env.PAYPAL_WEBHOOK_ID = 'wid';
    process.env.PAYPAL_CLIENT_ID = 'cid';
    process.env.PAYPAL_CLIENT_SECRET = 'csecret';

    const mockFetch = jest.fn()
      // OAuth token
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      // verify-webhook-signature
      .mockResolvedValueOnce({ ok: true, json: async () => ({ verification_status: 'SUCCESS' }) })
      // OAuth token (segunda vez para capture)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      // capture details
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'COMPLETED', amount: { value: '7.25', currency_code: 'USD' } }),
      });

    global.fetch = mockFetch as any;

    const headers = {
      'paypal-transmission-id': 'tid',
      'paypal-transmission-time': 'ttime',
      'paypal-cert-url': 'https://certs.paypal.com/cert.pem',
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-transmission-sig': 'sig',
    };

    const body = { event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'cap_123' } };
    const r = await provider.verificarWebhooks(body, headers);

    expect(r.valido).toBe(true);
    expect(r.estadoPago).toBe('APROBADO');
    expect(r.monto).toBe(7.25);
    expect(r.moneda).toBe('USD');
    expect(r.idTransaccionExterna).toBe('cap_123');
  });

  it('devuelve RECHAZADO para evento PAYMENT.CAPTURE.DENIED', async () => {
    process.env.PAYPAL_WEBHOOK_ID = 'wid';
    process.env.PAYPAL_CLIENT_ID = 'cid';
    process.env.PAYPAL_CLIENT_SECRET = 'csecret';

    const mockFetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ verification_status: 'SUCCESS' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'DECLINED', amount: { value: '7.25' }, status_details: { reason: 'DECLINED_BY_PROCESSOR' } }),
      });

    global.fetch = mockFetch as any;

    const headers = {
      'paypal-transmission-id': 'tid',
      'paypal-transmission-time': 'ttime',
      'paypal-cert-url': 'https://certs.paypal.com/cert.pem',
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-transmission-sig': 'sig',
    };

    const body = { event_type: 'PAYMENT.CAPTURE.DENIED', resource: { id: 'cap_456' } };
    const r = await provider.verificarWebhooks(body, headers);

    expect(r.valido).toBe(true);
    expect(r.estadoPago).toBe('RECHAZADO');
    expect(r.motivoFallo).toBe('DECLINED_BY_PROCESSOR');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Suite 5: PayPal — Captura Real (capturarPagoPayPal)
// ──────────────────────────────────────────────────────────────────────────────

describe('PagosService — capturarPagoPayPal', () => {
  let service: PagosService;
  let prisma: PrismaService;
  let ppProv: PayPalProvider;
  let module: TestingModule;

  beforeEach(async () => {
    module = await buildModule();
    service = module.get(PagosService);
    prisma = module.get(PrismaService);
    ppProv = module.get(PayPalProvider);
  });

  it('captura exitosamente y activa suscripción', async () => {
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(makeTx({ proveedor: ProveedorPago.PAYPAL }));
    // 1. Mock de consultar
    ppProv.consultarOrden = jest.fn().mockResolvedValueOnce({ status: 'APPROVED' });
    // 2. Mock de capturar
    ppProv.capturarOrden = jest.fn().mockResolvedValueOnce({
      status: 'COMPLETED',
      purchase_units: [{ payments: { captures: [{ id: 'cap_123', amount: { value: '7.25', currency_code: 'USD' } }] } }]
    });

    const result = await service.capturarPagoPayPal(10, 'tx_123');
    expect(result.mensaje).toContain('éxito');
    expect(ppProv.capturarOrden).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('recupera orden atascada (ya estaba COMPLETED en la API)', async () => {
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(makeTx({ proveedor: ProveedorPago.PAYPAL }));
    // Si la orden ya está COMPLETED, evitamos llamar a capturarOrden otra vez
    ppProv.consultarOrden = jest.fn().mockResolvedValueOnce({ 
      status: 'COMPLETED',
      purchase_units: [{ payments: { captures: [{ id: 'cap_999', amount: { value: '7.25', currency_code: 'USD' } }] } }]
    });
    ppProv.capturarOrden = jest.fn(); // No debería llamarse

    const result = await service.capturarPagoPayPal(10, 'tx_123');
    expect(result.mensaje).toContain('éxito');
    expect(ppProv.capturarOrden).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rechaza si el status no es COMPLETED tras capturar', async () => {
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(makeTx({ proveedor: ProveedorPago.PAYPAL }));
    ppProv.consultarOrden = jest.fn().mockResolvedValueOnce({ status: 'APPROVED' });
    ppProv.capturarOrden = jest.fn().mockResolvedValueOnce({
      status: 'DECLINED',
    });

    await expect(service.capturarPagoPayPal(10, 'tx_123')).rejects.toThrow(/COMPLETED/);
  });

  it('rechaza si hay discrepancia de moneda o monto', async () => {
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(makeTx({ proveedor: ProveedorPago.PAYPAL }));
    ppProv.consultarOrden = jest.fn().mockResolvedValueOnce({ status: 'APPROVED' });
    ppProv.capturarOrden = jest.fn().mockResolvedValueOnce({
      status: 'COMPLETED',
      purchase_units: [{ payments: { captures: [{ id: 'cap_123', amount: { value: '1.00', currency_code: 'USD' } }] } }]
    });

    await expect(service.capturarPagoPayPal(10, 'tx_123')).rejects.toThrow(/Discrepancia/);
  });

  it('ignora duplicados si ya está APROBADO', async () => {
    (prisma.transaccionPago.findFirst as jest.Mock).mockResolvedValueOnce(makeTx({ proveedor: ProveedorPago.PAYPAL, estado: EstadoPagoTransaccion.APROBADO }));
    ppProv.capturarOrden = jest.fn();
    ppProv.consultarOrden = jest.fn();
    const result = await service.capturarPagoPayPal(10, 'tx_123');
    expect(result.mensaje).toContain('ya fue procesado');
    expect(ppProv.consultarOrden).not.toHaveBeenCalled();
    expect(ppProv.capturarOrden).not.toHaveBeenCalled();
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
