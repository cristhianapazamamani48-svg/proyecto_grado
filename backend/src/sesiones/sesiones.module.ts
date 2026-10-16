import { Module } from '@nestjs/common';
import { SesionesService } from './sesiones.service';
import { SesionesController } from './sesiones.controller';
import { CalificacionService } from '../calificacion/calificacion.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RealtimeModule } from '../realtime/realtime.module';
import { AiModule } from '../ai/ai.module';
import { obtenerJwtSecret } from '../common/config/secretos';

@Module({
  imports: [
    RealtimeModule,
    AiModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: obtenerJwtSecret(configService),
        signOptions: { expiresIn: '1d' },
      }),
    }),
  ],
  providers: [SesionesService, CalificacionService],
  controllers: [SesionesController],
  exports: [SesionesService],
})
export class SesionesModule {}
