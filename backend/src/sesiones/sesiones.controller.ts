import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { SesionesService } from './sesiones.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('sesiones')
export class SesionesController {
  constructor(private readonly sesionesService: SesionesService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async crearSesion(@Request() req: any, @Body() body: { idEvaluacion: number }) {
    return this.sesionesService.crearSesion(req.user.sub, body.idEvaluacion);
  }

  @Post('unirse')
  async unirse(@Body() body: { codigo: string; nombreCompleto: string; idEstudiante?: number }) {
    return this.sesionesService.unirseASesion(body.codigo, body.nombreCompleto, body.idEstudiante);
  }

  @Post('reanudar')
  async reanudar(@Body() body: { tokenAcceso: string }) {
    return this.sesionesService.reanudarSesion(body.tokenAcceso);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('examen/obtener')
  async obtenerExamen(@Request() req: any) {
    return this.sesionesService.obtenerExamenParaEstudiante(req.user.sub);
  }
}
