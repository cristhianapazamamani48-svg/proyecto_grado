import { Module } from '@nestjs/common';
import { EvaluacionGateway } from './evaluacion.gateway';

@Module({
  providers: [EvaluacionGateway],
  exports: [EvaluacionGateway],
})
export class RealtimeModule {}
