export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailProvider {
  readonly nombreProveedor: 'console' | 'resend';
  send(message: MailMessage): Promise<void>;
}
