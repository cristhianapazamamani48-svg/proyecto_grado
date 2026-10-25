import { Module } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { PagosController } from './pagos.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { MercadoPagoProvider } from './providers/mercadopago.provider';
import { PayPalProvider } from './providers/paypal.provider';
import { LiveesProvider } from './providers/livees.provider';
import { LibelulaProvider } from './providers/libelula.provider';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [PrismaModule, MailModule],
  providers: [
    PagosService,
    MockPaymentProvider,
    MercadoPagoProvider,
    PayPalProvider,
    LiveesProvider,
    LibelulaProvider,
  ],
  controllers: [PagosController],
  exports: [PagosService, LiveesProvider, LibelulaProvider],
})
export class PagosModule {}
