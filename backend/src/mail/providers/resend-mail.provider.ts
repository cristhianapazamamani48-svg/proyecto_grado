import { Injectable } from '@nestjs/common';
import { MailMessage, MailProvider } from '../interfaces/mail-provider.interface';

@Injectable()
export class ResendMailProvider implements MailProvider {
  readonly nombreProveedor = 'resend' as const;

  async send(message: MailMessage): Promise<void> {
    const configuredTimeout = Number(process.env.MAIL_TIMEOUT_MS || 10_000);
    const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 10_000;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MAIL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Resend rechazo el correo con HTTP ${response.status}.`);
    }
  }
}
