import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, ForbiddenException, Patch } from '@nestjs/common';
import { EvaluacionesService } from './evaluaciones.service';
import { AuthGuard } from '@nestjs/passport';
import { EstadoEvaluacion } from '@prisma/client';

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

  @Put(':id')
  async actualizar(@Param('id') id: string, @Request() req: any, @Body() dto: any) {
    this.requiereDocente(req.user);
    return this.evaluacionesService.actualizarEvaluacion(Number(id), Number(req.user.sub), dto);
  }

  @Post(':id/duplicar')
  async duplicar(@Param('id') id: string, @Request() req: any) {
    this.requiereDocente(req.user);
    return this.evaluacionesService.duplicarEvaluacion(Number(id), Number(req.user.sub));
  }

  @Patch(':id/estado')
  async cambiarEstado(@Param('id') id: string, @Request() req: any, @Body('estado') estado: EstadoEvaluacion) {
    this.requiereDocente(req.user);
    return this.evaluacionesService.cambiarEstado(Number(id), Number(req.user.sub), estado);
  }

  @Delete(':id')
  async eliminar(@Param('id') id: string, @Request() req: any) {
    this.requiereDocente(req.user);
    return this.evaluacionesService.eliminarEvaluacion(Number(id), Number(req.user.sub));
  }
}
