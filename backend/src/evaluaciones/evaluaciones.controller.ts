import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { EvaluacionesService } from './evaluaciones.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('evaluaciones')
@UseGuards(AuthGuard('jwt'))
export class EvaluacionesController {
  constructor(private readonly evaluacionesService: EvaluacionesService) {}

  @Get()
  async listar(@Request() req: any) {
    return this.evaluacionesService.listarPorDocente(Number(req.user.sub));
  }

  @Get(':id')
  async obtenerPorId(@Param('id') id: string, @Request() req: any) {
    return this.evaluacionesService.obtenerPorId(Number(id), Number(req.user.sub));
  }

  @Post()
  async crear(@Request() req: any, @Body() dto: any) {
    return this.evaluacionesService.crearEvaluacion(Number(req.user.sub), dto);
  }
}
