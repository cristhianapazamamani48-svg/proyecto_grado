import { Module } from '@nestjs/common';
import { EvaluacionesService } from './evaluaciones.service';
import { EvaluacionesController } from './evaluaciones.controller';

@Module({
  providers: [EvaluacionesService],
  controllers: [EvaluacionesController],
  exports: [EvaluacionesService],
})
export class EvaluacionesModule {}
