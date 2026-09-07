import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('docente/registro')
  async registrarDocente(@Body() body: { nombre: string; apellido?: string; email: string; password: string }) {
    return this.authService.registrarDocente(body.nombre, body.apellido || '', body.email, body.password);
  }

  @Post('docente/login')
  async loginDocente(@Body() body: { email: string; password: string }) {
    return this.authService.loginDocente(body.email, body.password);
  }

  @Post('estudiante/registro')
  async registrarEstudiante(@Body() body: { nombre: string; apellido: string; email: string; password: string }) {
    return this.authService.registrarEstudiante(body.nombre, body.apellido, body.email, body.password);
  }

  @Post('estudiante/login')
  async loginEstudiante(@Body() body: { email: string; password: string }) {
    return this.authService.loginEstudiante(body.email, body.password);
  }
}
