import { ProveedorPago, TipoPlan } from '@prisma/client';
import { LibelulaProvider } from './libelula.provider';

describe('LibelulaProvider', () => {
  const originalFetch = global.fetch;
  const originalAppkey = process.env.LIBELULA_APPKEY;

  beforeEach(() => {
    process.env.LIBELULA_APPKEY = 'test-key';
    process.env.LIBELULA_API_URL = 'https://libelula.test';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.LIBELULA_APPKEY = originalAppkey;
    delete process.env.LIBELULA_API_URL;
  });

  it('registra una deuda y devuelve pasarela y QR sin exponer el appkey', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: 0, id_transaccion: 'lib-tx-1', url_pasarela_pagos: 'https://pay.test/1', qr_simple_url: 'https://pay.test/qr.png' }),
    }) as any;
    const provider = new LibelulaProvider();
    const result = await provider.crearSesionCheckout({
      idOrganizacion: 1, idUsuario: 2, plan: TipoPlan.MAESTRO_PRO, montoUsd: 7.25, montoLocal: 150,
      correoUsuario: 'admin@example.test', nombreUsuario: 'Ana Admin', urlRetornoSuccess: 'https://app.test/ok', urlRetornoCancel: 'https://app.test/no',
      identificadorDeuda: 'UUB-1', callbackUrl: 'https://api.test/pagos/webhook/libelula?ref=token', periodoMeses: 3,
    });
    expect(result).toEqual(expect.objectContaining({ proveedor: ProveedorPago.LIBELULA, idTransaccionExterna: 'lib-tx-1', qrSimpleUrl: 'https://pay.test/qr.png' }));
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual(expect.objectContaining({ identificador_deuda: 'UUB-1', identificador: 'UUB-1', moneda: 'BOB', emite_factura: false }));
  });

  it('convierte un error de Libélula en un error controlado', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ error: 1, mensaje: 'Deuda inválida' }) }) as any;
    const provider = new LibelulaProvider();
    await expect(provider.crearSesionCheckout({
      idOrganizacion: 1, idUsuario: 2, plan: TipoPlan.MAESTRO_PRO, montoUsd: 7.25, montoLocal: 50,
      correoUsuario: 'admin@example.test', nombreUsuario: 'Ana', urlRetornoSuccess: 'https://app.test/ok', urlRetornoCancel: 'https://app.test/no', identificadorDeuda: 'UUB-1', callbackUrl: 'https://api.test/cb',
    })).rejects.toThrow('Deuda inválida');
  });
});
