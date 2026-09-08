import { Controller, Get, Post, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { EvaluacionesService } from './evaluaciones.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('evaluaciones')
@UseGuards(AuthGuard('jwt'))
export class EvaluacionesController {
  constructor(private readonly evaluacionesService: EvaluacionesService) {}

  private requiereDocente(user: { tipo?: string }) {
    if (user.tipo !== 'USUARIO') throw new ForbiddenException('Esta acción requiere una cuenta docente.');
  }

  @Get()
  async listar(@Request() req: any) {
    this.requiereDocente(req.user);
    return this.evaluacionesService.listarPorDocente(Number(req.user.sub));
  }

  @Get(':id')
  async obtenerPorId(@Param('id') id: string, @Request() req: any) {
    this.requiereDocente(req.user);
    return this.evaluacionesService.obtenerPorId(Number(id), Number(req.user.sub));
  }

  @Post()
  async crear(@Request() req: any, @Body() dto: any) {
    this.requiereDocente(req.user);
    return this.evaluacionesService.crearEvaluacion(Number(req.user.sub), dto);
  }
}
