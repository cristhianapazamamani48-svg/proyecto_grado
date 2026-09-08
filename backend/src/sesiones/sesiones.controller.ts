import { Controller, Get, Post, Body, UseGuards, Request, ForbiddenException, Patch, Param } from '@nestjs/common';
import { SesionesService } from './sesiones.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('sesiones')
export class SesionesController {
  constructor(private readonly sesionesService: SesionesService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async crearSesion(@Request() req: any, @Body() body: { idEvaluacion: number }) {
    this.requiereDocente(req.user);
    return this.sesionesService.crearSesion(req.user.sub, body.idEvaluacion);
  }

  @Post('unirse')
  async unirse(@Body() body: { codigo: string; nombreCompleto: string }) {
    return this.sesionesService.unirseASesion(body.codigo, body.nombreCompleto);
  }

  @Post('reanudar')
  async reanudar(@Body() body: { tokenAcceso: string }) {
    return this.sesionesService.reanudarSesion(body.tokenAcceso);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/iniciar')
  async iniciarSesion(@Request() req: any, @Param('id') id: string) {
    this.requiereDocente(req.user);
    return this.sesionesService.iniciarSesion(Number(req.user.sub), Number(id));
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('intento/estado')
  async estadoIntento(@Request() req: any) {
    this.requiereParticipante(req.user);
    return this.sesionesService.obtenerEstadoIntento(Number(req.user.sub));
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('examen/obtener')
  async obtenerExamen(@Request() req: any) {
    this.requiereParticipante(req.user);
    return this.sesionesService.obtenerExamenParaEstudiante(req.user.sub);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('intento/iniciar')
  async iniciarIntento(@Request() req: any) {
    this.requiereParticipante(req.user);
    return this.sesionesService.iniciarIntento(Number(req.user.sub));
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('intento/respuesta')
  async guardarRespuesta(@Request() req: any, @Body() body: { intentoId: string; preguntaId: string; opcionesSeleccionadas?: string[]; textoRespuesta?: string; espaciosRespuestas?: Record<string, string> }) {
    this.requiereParticipante(req.user);
    return this.sesionesService.guardarRespuesta(Number(req.user.sub), body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('intento/finalizar')
  async finalizarIntento(@Request() req: any, @Body() body: { intentoId: string }) {
    this.requiereParticipante(req.user);
    return this.sesionesService.finalizarIntento(Number(req.user.sub), body.intentoId);
  }

  private requiereDocente(user: { tipo?: string }) {
    if (user.tipo !== 'USUARIO') throw new ForbiddenException('Esta acción requiere una cuenta docente.');
  }

  private requiereParticipante(user: { tipo?: string }) {
    if (user.tipo !== 'PARTICIPANTE_GUEST') throw new ForbiddenException('Esta acción requiere un token de participante.');
  }
}
