import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerHttpGuard } from './common/guards/throttler-http.guard';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EvaluacionesModule } from './evaluaciones/evaluaciones.module';
import { SesionesModule } from './sesiones/sesiones.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AiModule } from './ai/ai.module';
import { OrganizacionModule } from './organizacion/organizacion.module';
import { SuperadminModule } from './superadmin/superadmin.module';
import { PagosModule } from './pagos/pagos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Límite global de respaldo (300 req/min por IP). Las rutas sensibles
    // (auth, unirse a sesión, reanudar, códigos institucionales) aplican
    // límites más estrictos con @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 300 }]),
    PrismaModule,
    AuthModule,
    EvaluacionesModule,
    SesionesModule,
    RealtimeModule,
    AiModule,
    OrganizacionModule,
    SuperadminModule,
    PagosModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerHttpGuard }],
})
export class AppModule {}
