import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalificacionService } from '../calificacion/calificacion.service';
import { JwtService } from '@nestjs/jwt';
import { ModoInicioSesion, EstadoSesion, EstadoParticipante, TipoPregunta } from '@prisma/client';

export interface CrearSesionDto {
  evaluacionId: number;
  codigo?: string;
  fechaInicio?: string;
  fechaFin?: string;
}

@Injectable()
export class SesionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calificacionService: CalificacionService,
    private readonly jwtService: JwtService,
  ) {}

  private generarCodigoUnico(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async crearSesion(idUsuario: number, idEvaluacion: number) {
    const evaluacion = await this.prisma.evaluacion.findUnique({
      where: { idEvaluacion },
    });

    if (!evaluacion || evaluacion.idUsuario !== idUsuario) {
      throw new NotFoundException('Evaluación no encontrada.');
    }

    let codigo = this.generarCodigoUnico();
    let existe = await this.prisma.sesion.findUnique({ where: { codigo } });
    while (existe) {
      codigo = this.generarCodigoUnico();
      existe = await this.prisma.sesion.findUnique({ where: { codigo } });
    }

    return this.prisma.sesion.create({
      data: {
        idEvaluacion,
        codigo,
        estado: EstadoSesion.ACTIVA,
        fechaInicio: new Date(),
      },
    });
  }

  async unirseASesion(codigo: string, nombreCompleto: string, idEstudiante?: number) {
    const sesion = await this.prisma.sesion.findUnique({
      where: { codigo: codigo.trim().toUpperCase() },
      include: { evaluacion: true },
    });

    if (!sesion || sesion.estado !== EstadoSesion.ACTIVA) {
      throw new NotFoundException('La sesión de evaluación no existe o no está activa.');
    }

    const tokenAcceso = this.generarCodigoUnico() + Date.now().toString(36);

    const participante = await this.prisma.participante.create({
      data: {
        idSesion: sesion.idSesion,
        idEstudiante: idEstudiante || null,
        nombre: nombreCompleto,
        tokenAcceso,
        fechaIngreso: new Date(),
        estado: EstadoParticipante.EN_PROGRESO,
      },
    });

    const token = this.jwtService.sign({
      sub: participante.idParticipante,
      nombre: participante.nombre,
      idSesion: sesion.idSesion,
      tipo: 'PARTICIPANTE_GUEST',
    });

    return {
      idParticipante: participante.idParticipante,
      tokenAcceso: participante.tokenAcceso,
      token,
      sesion: {
        codigo: sesion.codigo,
        nombreEvaluacion: sesion.evaluacion.nombre,
        tiempoTotal: sesion.evaluacion.tiempoTotal,
        tiempoPorPregunta: sesion.evaluacion.tiempoPorPregunta,
      },
    };
  }

  async reanudarSesion(tokenAcceso: string) {
    const participante = await this.prisma.participante.findFirst({
      where: { tokenAcceso },
      include: {
        sesion: { include: { evaluacion: true } },
        respuestas: true,
      },
    });

    if (!participante) {
      throw new NotFoundException('Token de acceso inválido.');
    }

    const token = this.jwtService.sign({
      sub: participante.idParticipante,
      nombre: participante.nombre,
      idSesion: participante.idSesion,
      tipo: 'PARTICIPANTE_GUEST',
    });

    return {
      idParticipante: participante.idParticipante,
      nombre: participante.nombre,
      token,
      sesion: participante.sesion,
    };
  }

  async obtenerExamenParaEstudiante(idParticipante: number) {
    const participante = await this.prisma.participante.findUnique({
      where: { idParticipante },
      include: {
        sesion: {
          include: {
            evaluacion: {
              include: {
                preguntas: {
                  orderBy: { orden: 'asc' },
                  include: {
                    opciones: {
                      select: { idOpcion: true, texto: true },
                    },
                    espacios: {
                      select: { idEspacio: true, numeroEspacio: true, modoCalificacion: true },
                    },
                  },
                },
              },
            },
          },
        },
        respuestas: {
          include: { opcionesSeleccionadas: true },
        },
      },
    });

    if (!participante) {
      throw new NotFoundException('Participante no encontrado.');
    }

    return {
      idParticipante: participante.idParticipante,
      evaluacionConfig: participante.sesion.evaluacion,
      preguntas: participante.sesion.evaluacion.preguntas,
      respuestasGuardadas: participante.respuestas,
    };
  }
}
