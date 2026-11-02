import { Module } from '@nestjs/common';
import { EvaluacionesService } from './evaluaciones.service';
import { EvaluacionesController } from './evaluaciones.controller';
import { PagosModule } from '../pagos/pagos.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PagosModule, AiModule],
  providers: [EvaluacionesService],
  controllers: [EvaluacionesController],
  exports: [EvaluacionesService],
})
export class EvaluacionesModule {}
