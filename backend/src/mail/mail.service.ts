import { Injectable, Logger } from '@nestjs/common';
import { ConsoleMailProvider } from './providers/console-mail.provider';
import { ResendMailProvider } from './providers/resend-mail.provider';
import { MailMessage, MailProvider } from './interfaces/mail-provider.interface';
import {
  plantillaAvisoVencimiento,
  plantillaReciboPago,
  plantillaRecuperacionPassword,
} from './mail.templates';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly provider: MailProvider;

  constructor(
    consoleProvider: ConsoleMailProvider,
    resendProvider: ResendMailProvider,
  ) {
    const proveedor = (process.env.MAIL_PROVIDER || 'console').toLowerCase();

    if (proveedor === 'console') {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('MAIL_PROVIDER=console no esta permitido en produccion. Configura Resend.');
      }
      this.provider = consoleProvider;
      return;
    }

    if (proveedor === 'resend') {
      if (!process.env.MAIL_API_KEY || !process.env.MAIL_FROM) {
        throw new Error('MAIL_PROVIDER=resend requiere MAIL_API_KEY y MAIL_FROM.');
      }
      this.provider = resendProvider;
      return;
    }

    throw new Error('MAIL_PROVIDER debe ser console o resend.');
  }

  get nombreProveedor(): string {
    return this.provider.nombreProveedor;
  }

  async enviar(message: MailMessage): Promise<boolean> {
    try {
      await this.provider.send(message);
      return true;
    } catch (error) {
      this.logger.error(`No se pudo enviar correo a ${message.to}.`, error);
      return false;
    }
  }

  async enviarReciboPago(datos: Parameters<typeof plantillaReciboPago>[0] & { to: string }): Promise<boolean> {
    const { to, ...plantilla } = datos;
    return this.enviar({ to, ...plantillaReciboPago(plantilla) });
  }

  async enviarAvisoVencimiento(datos: Parameters<typeof plantillaAvisoVencimiento>[0] & { to: string }): Promise<boolean> {
    const { to, ...plantilla } = datos;
    return this.enviar({ to, ...plantillaAvisoVencimiento(plantilla) });
  }

  async enviarRecuperacionPassword(datos: { to: string; nombre: string; enlace: string }): Promise<boolean> {
    const { to, ...plantilla } = datos;
    return this.enviar({ to, ...plantillaRecuperacionPassword(plantilla) });
  }
}
