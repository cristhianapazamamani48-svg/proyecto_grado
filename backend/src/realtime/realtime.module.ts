import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EvaluacionGateway } from './evaluacion.gateway';
import { obtenerJwtSecret } from '../common/config/secretos';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: obtenerJwtSecret(configService),
      }),
    }),
  ],
  providers: [EvaluacionGateway],
  exports: [EvaluacionGateway],
})
export class RealtimeModule {}
