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

  async unirseASesion(codigo: string, nombreCompleto: string) {
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
        idEstudiante: null,
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
  async iniciarIntento(idParticipante: number) {
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
                    opciones: { select: { idOpcion: true, texto: true } },
                    espacios: { select: { idEspacio: true, numeroEspacio: true } },
                  },
                },
              },
            },
          },
        },
        respuestas: { include: { opcionesSeleccionadas: true } },
      },
    });

    if (!participante || participante.estado !== EstadoParticipante.EN_PROGRESO) {
      throw new NotFoundException('No existe un intento activo para este participante.');
    }

    return {
      intentoId: String(participante.idParticipante),
      preguntas: participante.sesion.evaluacion.preguntas.map((pregunta) => ({
        id: String(pregunta.idPregunta),
        tipo: this.tipoParaFrontend(pregunta.tipo),
        enunciado: pregunta.enunciado,
        imagenUrl: pregunta.imagen,
        puntaje: Number(pregunta.puntaje),
        opciones: pregunta.opciones.map((opcion) => ({ id: String(opcion.idOpcion), texto: opcion.texto })),
        espacios: pregunta.espacios.map((espacio) => ({ id: String(espacio.idEspacio), posicion: espacio.numeroEspacio })),
      })),
      respuestasGuardadas: participante.respuestas.map((respuesta) => ({
        preguntaId: String(respuesta.idPregunta),
        opcionesSeleccionadas: respuesta.opcionesSeleccionadas.map((opcion) => String(opcion.idOpcion)),
        textoRespuesta: this.esJson(respuesta.respuestaTexto) ? '' : respuesta.respuestaTexto || '',
        espaciosRespuestas: this.parsearEspacios(respuesta.respuestaTexto),
      })),
    };
  }

  async guardarRespuesta(idParticipante: number, body: { intentoId: string; preguntaId: string; opcionesSeleccionadas?: string[]; textoRespuesta?: string; espaciosRespuestas?: Record<string, string> }) {
    const intentoId = Number(body.intentoId);
    const idPregunta = Number(body.preguntaId);
    if (!Number.isInteger(intentoId) || !Number.isInteger(idPregunta) || intentoId !== idParticipante) {
      throw new BadRequestException('El intento o la pregunta no son válidos.');
    }

    const participante = await this.prisma.participante.findUnique({
      where: { idParticipante },
      include: { sesion: true },
    });
    if (!participante || participante.estado !== EstadoParticipante.EN_PROGRESO) {
      throw new BadRequestException('El intento ya no está disponible para guardar respuestas.');
    }

    const pregunta = await this.prisma.pregunta.findFirst({
      where: { idPregunta, idEvaluacion: participante.sesion.idEvaluacion },
      include: { opciones: { select: { idOpcion: true } } },
    });
    if (!pregunta) throw new NotFoundException('La pregunta no pertenece a esta evaluación.');

    const opcionesSeleccionadas = [...new Set((body.opcionesSeleccionadas || []).map(Number))];
    if (opcionesSeleccionadas.some((id) => !Number.isInteger(id)) || opcionesSeleccionadas.some((id) => !pregunta.opciones.some((opcion) => opcion.idOpcion === id))) {
      throw new BadRequestException('Una o más opciones no pertenecen a la pregunta.');
    }

    const respuestaTexto = pregunta.tipo === TipoPregunta.COMPLETAR
      ? JSON.stringify(body.espaciosRespuestas || {})
      : body.textoRespuesta?.trim() || null;

    return this.prisma.respuesta.upsert({
      where: { idParticipante_idPregunta: { idParticipante, idPregunta } },
      create: {
        idParticipante,
        idPregunta,
        respuestaTexto,
        opcionesSeleccionadas: { create: opcionesSeleccionadas.map((idOpcion) => ({ idOpcion })) },
      },
      update: {
        respuestaTexto,
        opcionesSeleccionadas: {
          deleteMany: {},
          create: opcionesSeleccionadas.map((idOpcion) => ({ idOpcion })),
        },
      },
    });
  }

  async finalizarIntento(idParticipante: number, intentoId: string) {
    if (Number(intentoId) !== idParticipante) {
      throw new BadRequestException('El intento no corresponde al participante autenticado.');
    }

    const participante = await this.prisma.participante.findUnique({
      where: { idParticipante },
      include: {
        respuestas: { include: { opcionesSeleccionadas: true } },
        sesion: {
          include: {
            evaluacion: {
              include: {
                preguntas: {
                  include: {
                    opciones: { select: { idOpcion: true, esCorrecta: true } },
                    espacios: { include: { respuestasValidas: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!participante || participante.estado !== EstadoParticipante.EN_PROGRESO) {
      throw new BadRequestException('El intento ya fue finalizado o no existe.');
    }

    const preguntas = participante.sesion.evaluacion.preguntas;
    const respuestasPorPregunta = new Map(participante.respuestas.map((respuesta) => [respuesta.idPregunta, respuesta]));
    const puntajeMaximoPosible = preguntas.reduce((total, pregunta) => total + Number(pregunta.puntaje), 0);
    let puntajeTotalObtenido = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const pregunta of preguntas) {
        const respuesta = respuestasPorPregunta.get(pregunta.idPregunta);
        if (!respuesta) continue;

        const calificacion = this.calificacionService.calificarRespuestaObjetiva(
          pregunta.tipo,
          Number(pregunta.puntaje),
          pregunta.opciones,
          respuesta.opcionesSeleccionadas.map((opcion) => opcion.idOpcion),
          pregunta.espacios.map((espacio) => ({
            numeroEspacio: espacio.numeroEspacio,
            respuestasValidas: espacio.respuestasValidas.map((valida) => valida.respuesta),
            modoCalificacion: espacio.modoCalificacion,
            ignorarMayusculas: espacio.ignorarMayusculas,
          })),
          this.parsearEspacios(respuesta.respuestaTexto),
        );

        puntajeTotalObtenido += calificacion.puntaje;
        await tx.respuesta.update({
          where: { idRespuesta: respuesta.idRespuesta },
          data: { puntaje: calificacion.puntaje, esCorrecta: calificacion.esCorrecta },
        });
      }

      await tx.participante.update({
        where: { idParticipante },
        data: {
          estado: EstadoParticipante.FINALIZADO,
          fechaFinalizacion: new Date(),
          puntajeTotal: puntajeTotalObtenido,
          porcentaje: puntajeMaximoPosible === 0 ? 0 : (puntajeTotalObtenido / puntajeMaximoPosible) * 100,
        },
      });
    });

    return {
      notaFinal: puntajeMaximoPosible === 0 ? 0 : Math.round((puntajeTotalObtenido / puntajeMaximoPosible) * 100),
      puntajeTotalObtenido,
      puntajeMaximoPosible,
    };
  }

  private tipoParaFrontend(tipo: TipoPregunta) {
    if (tipo === TipoPregunta.COMPLETAR) return 'ESPACIO_COMPLETAR';
    if (tipo === TipoPregunta.ABIERTA) return 'RESPUESTA_ABIERTA';
    return tipo;
  }

  private parsearEspacios(valor: string | null): Record<string, string> {
    if (!this.esJson(valor)) return {};
    try {
      const resultado = JSON.parse(valor as string);
      return resultado && typeof resultado === 'object' && !Array.isArray(resultado) ? resultado : {};
    } catch {
      return {};
    }
  }

  private esJson(valor: string | null): boolean {
    return Boolean(valor && valor.trim().startsWith('{'));
  }
}
