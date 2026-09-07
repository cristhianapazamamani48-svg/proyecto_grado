import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RolUsuario } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

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

    const valido = await bcrypt.compare(password, usuario.password);
    if (!valido) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

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
