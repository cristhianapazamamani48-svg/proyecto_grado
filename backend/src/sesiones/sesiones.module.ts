import { Module } from '@nestjs/common';
import { SesionesService } from './sesiones.service';
import { SesionesController } from './sesiones.controller';
import { CalificacionService } from '../calificacion/calificacion.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    RealtimeModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'super-secreto-uub-evaluaciones-jwt-key-2026',
        signOptions: { expiresIn: '1d' },
      }),
    }),
  ],
  providers: [SesionesService, CalificacionService],
  controllers: [SesionesController],
  exports: [SesionesService],
})
export class SesionesModule {}
