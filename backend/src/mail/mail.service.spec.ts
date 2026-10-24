import { MailService } from './mail.service';
import { plantillaReciboPago, plantillaRecuperacionPassword } from './mail.templates';

describe('MailService', () => {
  const environment = { ...process.env };

  afterEach(() => {
    process.env = { ...environment };
  });

  it('selecciona el proveedor console fuera de produccion', () => {
    process.env.MAIL_PROVIDER = 'console';
    process.env.NODE_ENV = 'test';
    const service = new MailService(
      { nombreProveedor: 'console', send: jest.fn() } as any,
      { nombreProveedor: 'resend', send: jest.fn() } as any,
    );

    expect(service.nombreProveedor).toBe('console');
  });

  it('selecciona Resend cuando esta configurado', () => {
    process.env.MAIL_PROVIDER = 'resend';
    process.env.MAIL_API_KEY = 'test-key';
    process.env.MAIL_FROM = 'no-reply@example.test';
    const service = new MailService(
      { nombreProveedor: 'console', send: jest.fn() } as any,
      { nombreProveedor: 'resend', send: jest.fn() } as any,
    );

    expect(service.nombreProveedor).toBe('resend');
  });

  it('absorbe un fallo del proveedor', async () => {
    process.env.MAIL_PROVIDER = 'console';
    process.env.NODE_ENV = 'test';
    const service = new MailService(
      { nombreProveedor: 'console', send: jest.fn().mockRejectedValue(new Error('sin red')) } as any,
      { nombreProveedor: 'resend', send: jest.fn() } as any,
    );

    await expect(service.enviar({ to: 'docente@example.test', subject: 'Prueba', html: '<p>Prueba</p>', text: 'Prueba' })).resolves.toBe(false);
  });
});

describe('plantillas de correo', () => {
  it('escapa datos variables en HTML', () => {
    const recibo = plantillaReciboPago({
      nombre: '<img src=x>',
      plan: 'Plan <Pro>',
      monto: 10,
      moneda: 'BOB',
      periodoCubierto: 'Mayo',
      numeroComprobante: '"123"',
    });
    const recuperacion = plantillaRecuperacionPassword({
      nombre: '<script>alert(1)</script>',
      enlace: 'https://example.test/?token=<token>',
    });

    expect(recibo.html).not.toContain('<img src=x>');
    expect(recibo.html).toContain('&lt;img src=x&gt;');
    expect(recuperacion.html).not.toContain('<script>');
    expect(recuperacion.html).toContain('token=&lt;token&gt;');
  });
});
