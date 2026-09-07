import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EvaluacionesModule } from './evaluaciones/evaluaciones.module';
import { SesionesModule } from './sesiones/sesiones.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    EvaluacionesModule,
    SesionesModule,
    RealtimeModule,
  ],
})
export class AppModule {}
