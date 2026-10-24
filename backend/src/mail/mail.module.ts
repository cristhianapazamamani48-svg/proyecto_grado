import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { ConsoleMailProvider } from './providers/console-mail.provider';
import { ResendMailProvider } from './providers/resend-mail.provider';

@Module({
  providers: [MailService, ConsoleMailProvider, ResendMailProvider],
  exports: [MailService],
})
export class MailModule {}
