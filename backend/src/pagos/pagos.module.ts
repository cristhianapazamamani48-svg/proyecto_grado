import { Module } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { PagosController } from './pagos.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { MercadoPagoProvider } from './providers/mercadopago.provider';
import { PayPalProvider } from './providers/paypal.provider';

@Module({
  imports: [PrismaModule],
  providers: [
    PagosService,
    MockPaymentProvider,
    MercadoPagoProvider,
    PayPalProvider,
  ],
  controllers: [PagosController],
  exports: [PagosService],
})
export class PagosModule {}
