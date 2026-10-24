import { Injectable, Logger } from '@nestjs/common';
import { MailMessage, MailProvider } from '../interfaces/mail-provider.interface';

@Injectable()
export class ConsoleMailProvider implements MailProvider {
  private readonly logger = new Logger(ConsoleMailProvider.name);
  readonly nombreProveedor = 'console' as const;

  async send(message: MailMessage): Promise<void> {
    // Nunca registramos el cuerpo: puede contener enlaces o tokens de recuperación.
    this.logger.log(`[Correo simulado] Destinatario: ${message.to}; asunto: ${message.subject}`);
  }
}
