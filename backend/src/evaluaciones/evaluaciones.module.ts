import { Module } from '@nestjs/common';
import { EvaluacionesService } from './evaluaciones.service';
import { EvaluacionesController } from './evaluaciones.controller';
import { PagosModule } from '../pagos/pagos.module';

@Module({
  imports: [PagosModule],
  providers: [EvaluacionesService],
  controllers: [EvaluacionesController],
  exports: [EvaluacionesService],
})
export class EvaluacionesModule {}
