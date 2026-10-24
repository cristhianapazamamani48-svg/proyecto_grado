import { Injectable, UnauthorizedException, ConflictException, ForbiddenException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RolUsuario, TipoPlan, EstadoSuscripcion, ProveedorPago } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async asegurarEspacioPersonalDocente(usuario: { idUsuario: number; nombre: string; idOrganizacionActual?: number | null }) {
    if (usuario.idOrganizacionActual) {
      return usuario.idOrganizacionActual;
    }

    const slug = `docente-${usuario.idUsuario}-${Date.now().toString(36)}`;
    const org = await this.prisma.organizacion.create({
      data: {
        nombre: `Espacio de ${usuario.nombre.trim()}`,
        slug,
        plan: TipoPlan.GRATUITO,
        limiteDocentes: 1,
        limiteEstudiantes: 100,
        limiteEvaluaciones: 20,
        limiteCorreccionesIaMes: 10,
        iaHabilitada: true,
      },
    });

    await this.prisma.membresia.create({
      data: {
        idUsuario: usuario.idUsuario,
        idOrganizacion: org.idOrganizacion,
        rol: RolUsuario.ADMIN_ORGANIZACION,
        metodoIngreso: 'REGISTRO',
      },
    });

    await this.prisma.suscripcionOrganizacion.create({
      data: {
        idOrganizacion: org.idOrganizacion,
        plan: TipoPlan.GRATUITO,
        estado: EstadoSuscripcion.ACTIVA,
        proveedor: ProveedorPago.MOCK_SANDBOX,
        monto: 0,
        moneda: 'USD',
        montoLocal: 0,
        monedaLocal: 'BOB',
      },
    });

    await this.prisma.usuario.update({
      where: { idUsuario: usuario.idUsuario },
      data: { idOrganizacionActual: org.idOrganizacion },
    });

    return org.idOrganizacion;
  }

  private async verificarInstitucionActiva(usuario: { rol: RolUsuario; idOrganizacionActual?: number | null }) {
    if (usuario.rol === RolUsuario.SUPER_ADMIN || !usuario.idOrganizacionActual) {
      return;
    }

    const org = await this.prisma.organizacion.findUnique({
      where: { idOrganizacion: usuario.idOrganizacionActual },
      select: { estado: true, nombre: true },
    });

    if (org?.estado === 'INACTIVO') {
      throw new ForbiddenException(
        `La institución educativa "${org.nombre}" se encuentra suspendida temporalmente. Contacte al administrador.`,
      );
    }
  }

  private async verificarTokenGoogle(idToken: string): Promise<any> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new ServiceUnavailableException('El inicio de sesión con Google no está configurado.');
    }

    try {
      const { OAuth2Client } = await import('google-auth-library');
      const client = new OAuth2Client(clientId);
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });

      return ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Token de Google inválido o expirado.');
    }
  }

  async registrarDocente(nombre: string, apellido: string, correo: string, password: string) {
    const existe = await this.prisma.usuario.findUnique({ where: { correo } });
    if (existe) {
      throw new ConflictException('El correo ya está registrado.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const docente = await this.prisma.usuario.create({
      data: {
        nombre,
        apellido: apellido || '',
        correo,
        password: passwordHash,
        rol: RolUsuario.DOCENTE,
      },
    });

    // Auto-crear y asociar su espacio personal individual para que tenga plan y suscripción directa
    await this.asegurarEspacioPersonalDocente(docente);

    const token = this.jwtService.sign({
      sub: docente.idUsuario,
      correo: docente.correo,
      rol: docente.rol,
      tipo: 'USUARIO',
    });

    return {
      usuario: { idUsuario: docente.idUsuario, nombre: docente.nombre, apellido: docente.apellido, correo: docente.correo, rol: docente.rol },
      token,
    };
  }

  async loginDocente(correo: string, password: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { correo } });
    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (usuario.estado === 'INACTIVO') {
      throw new UnauthorizedException('Tu cuenta de usuario ha sido desactivada por el administrador.');
    }

    const valido = await bcrypt.compare(password, usuario.password);
    if (!valido) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (usuario.rol === RolUsuario.DOCENTE && !usuario.idOrganizacionActual) {
      usuario.idOrganizacionActual = await this.asegurarEspacioPersonalDocente(usuario);
    }

    await this.verificarInstitucionActiva(usuario);

    const token = this.jwtService.sign({
      sub: usuario.idUsuario,
      correo: usuario.correo,
      rol: usuario.rol,
      tipo: 'USUARIO',
    });

    return {
      usuario: { idUsuario: usuario.idUsuario, nombre: usuario.nombre, apellido: usuario.apellido, correo: usuario.correo, rol: usuario.rol },
      token,
    };
  }

  async loginConGoogle(idToken: string) {
    if (!idToken) {
      throw new BadRequestException('El token de Google es obligatorio.');
    }

    const payload = await this.verificarTokenGoogle(idToken);

    if (!payload?.email) {
      throw new UnauthorizedException('No se pudo obtener el correo de la cuenta de Google.');
    }

    if (payload.email_verified !== true) {
      throw new UnauthorizedException('El correo de Google no está verificado.');
    }

    const correo = payload.email.toLowerCase().trim();
    let usuario = await this.prisma.usuario.findUnique({
      where: { correo },
    });

    if (usuario) {
      if (usuario.estado === 'INACTIVO') {
        throw new UnauthorizedException('Tu cuenta de usuario ha sido desactivada por el administrador.');
      }

      if (usuario.rol === RolUsuario.SUPER_ADMIN) {
        throw new ForbiddenException('Esta cuenta debe iniciar sesión con contraseña.');
      }

      if (usuario.rol === RolUsuario.DOCENTE && !usuario.idOrganizacionActual) {
        usuario.idOrganizacionActual = await this.asegurarEspacioPersonalDocente(usuario);
      }
    } else {
      const nombre = payload.given_name || payload.name?.split(' ')[0] || 'Docente';
      const apellido = payload.family_name || payload.name?.split(' ').slice(1).join(' ') || '';
      
      const randomPassword = crypto.randomBytes(24).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      usuario = await this.prisma.usuario.create({
        data: {
          nombre,
          apellido,
          correo,
          password: passwordHash,
          rol: RolUsuario.DOCENTE,
        },
      });

      usuario.idOrganizacionActual = await this.asegurarEspacioPersonalDocente(usuario);
    }

    await this.verificarInstitucionActiva(usuario);

    const token = this.jwtService.sign({
      sub: usuario.idUsuario,
      correo: usuario.correo,
      rol: usuario.rol,
      tipo: 'USUARIO',
    });

    return {
      usuario: {
        idUsuario: usuario.idUsuario,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol,
      },
      token,
    };
  }

  async registrarEstudiante(nombre: string, apellido: string, correo: string, password: string) {
    const existe = await this.prisma.estudiante.findUnique({ where: { correo } });
    if (existe) {
      throw new ConflictException('El correo de estudiante ya está registrado.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const estudiante = await this.prisma.estudiante.create({
      data: {
        nombre,
        apellido,
        correo,
        password: passwordHash,
      },
    });

    const token = this.jwtService.sign({
      sub: estudiante.idEstudiante,
      correo: estudiante.correo,
      rol: 'ESTUDIANTE',
      tipo: 'ESTUDIANTE',
    });

    return {
      estudiante: { idEstudiante: estudiante.idEstudiante, nombre: estudiante.nombre, apellido: estudiante.apellido, correo: estudiante.correo },
      token,
    };
  }

  async loginEstudiante(correo: string, password: string) {
    const estudiante = await this.prisma.estudiante.findUnique({ where: { correo } });
    if (!estudiante) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const valido = await bcrypt.compare(password, estudiante.password);
    if (!valido) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const token = this.jwtService.sign({
      sub: estudiante.idEstudiante,
      correo: estudiante.correo,
      rol: 'ESTUDIANTE',
      tipo: 'ESTUDIANTE',
    });

    return {
      estudiante: { idEstudiante: estudiante.idEstudiante, nombre: estudiante.nombre, apellido: estudiante.apellido, correo: estudiante.correo },
      token,
    };
  }
}
