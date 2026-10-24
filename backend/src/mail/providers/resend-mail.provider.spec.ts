import { ResendMailProvider } from './resend-mail.provider';

describe('ResendMailProvider', () => {
  const environment = { ...process.env };

  afterEach(() => {
    process.env = { ...environment };
    jest.restoreAllMocks();
  });

  it('configura AbortSignal con el timeout de correo', async () => {
    process.env.MAIL_TIMEOUT_MS = '1234';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
    const provider = new ResendMailProvider();

    await provider.send({ to: 'docente@example.test', subject: 'Prueba', html: '<p>Prueba</p>', text: 'Prueba' });

    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
  });
});
