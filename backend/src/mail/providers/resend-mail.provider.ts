import { Injectable } from '@nestjs/common';
import { MailMessage, MailProvider } from '../interfaces/mail-provider.interface';

@Injectable()
export class ResendMailProvider implements MailProvider {
  readonly nombreProveedor = 'resend' as const;

  async send(message: MailMessage): Promise<void> {
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
    });

    if (!response.ok) {
      throw new Error(`Resend rechazo el correo con HTTP ${response.status}.`);
    }
  }
}
