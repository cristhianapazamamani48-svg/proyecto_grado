import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';

// Límite estricto contra fuerza bruta y creación masiva de cuentas.
// 20/min por IP: suficiente para un aula/logins simultáneos tras un NAT.
@Throttle({ default: { limit: 20, ttl: 60000 } })
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

  @Post('google')
  async loginGoogle(@Body() body: { idToken: string }) {
    return this.authService.loginConGoogle(body.idToken);
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
