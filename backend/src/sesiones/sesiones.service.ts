import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalificacionService } from '../calificacion/calificacion.service';
import { JwtService } from '@nestjs/jwt';
import { ModoInicioSesion, EstadoSesion, EstadoParticipante, TipoPregunta, EstadoEvaluacion } from '@prisma/client';

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

    if (evaluacion.estado !== EstadoEvaluacion.PUBLICADA) {
      throw new BadRequestException('Solo se pueden lanzar sesiones de evaluaciones publicadas.');
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
        estado: EstadoSesion.PENDIENTE,
      },
    });
  }

  async unirseASesion(codigo: string, nombreCompleto: string) {
    const sesion = await this.prisma.sesion.findUnique({
      where: { codigo: codigo.trim().toUpperCase() },
      include: { evaluacion: true },
    });

    if (!sesion) {
      throw new NotFoundException('La sesión de evaluación no existe.');
    }

    if (sesion.estado === EstadoSesion.FINALIZADA) {
      throw new BadRequestException('Esta sesión ya ha finalizado. No se aceptan nuevos ingresos.');
    }

    if (sesion.estado !== EstadoSesion.PENDIENTE && sesion.estado !== EstadoSesion.ACTIVA) {
      throw new NotFoundException('La sesión de evaluación no está disponible.');
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
      estado: sesion.estado,
      sesion: {
        idSesion: sesion.idSesion,
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

  async obtenerEstadoIntento(idParticipante: number) {
    const participante = await this.prisma.participante.findUnique({
      where: { idParticipante },
      select: { idParticipante: true, estado: true, sesion: { select: { estado: true } } },
    });

    if (!participante) throw new NotFoundException('Participante no encontrado.');
    return { estadoSesion: participante.sesion.estado, estadoParticipante: participante.estado };
  }

  async iniciarSesion(idUsuario: number, idSesion: number) {
    const sesion = await this.prisma.sesion.findUnique({
      where: { idSesion },
      include: { evaluacion: true },
    });

    if (!sesion || sesion.evaluacion.idUsuario !== idUsuario) {
      throw new NotFoundException('Sesión no encontrada.');
    }
    if (sesion.estado !== EstadoSesion.PENDIENTE) {
      throw new BadRequestException('La sesión ya fue iniciada o finalizada.');
    }

    return this.prisma.sesion.update({
      where: { idSesion },
      data: { estado: EstadoSesion.ACTIVA, fechaInicio: new Date() },
    });
  }

  async finalizarSesion(idUsuario: number, idSesion: number) {
    const sesion = await this.prisma.sesion.findUnique({
      where: { idSesion },
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
        participantes: {
          where: { estado: EstadoParticipante.EN_PROGRESO },
          include: {
            respuestas: { include: { opcionesSeleccionadas: true } },
          },
        },
      },
    });

    if (!sesion || sesion.evaluacion.idUsuario !== idUsuario) {
      throw new NotFoundException('Sesión no encontrada.');
    }
    if (sesion.estado === EstadoSesion.FINALIZADA) {
      throw new BadRequestException('La sesión ya está finalizada.');
    }

    const preguntas = sesion.evaluacion.preguntas;
    const puntajeMaximoPosible = preguntas.reduce((sum, p) => sum + Number(p.puntaje), 0);

    await this.prisma.$transaction(async (tx) => {
      // Calificar y cerrar a todos los participantes EN_PROGRESO
      for (const participante of sesion.participantes) {
        const respuestasPorPregunta = new Map(
          participante.respuestas.map((r) => [r.idPregunta, r]),
        );
        let puntajeTotalObtenido = 0;

        for (const pregunta of preguntas) {
          const respuesta = respuestasPorPregunta.get(pregunta.idPregunta);
          if (!respuesta) continue;

          const calificacion = this.calificacionService.calificarRespuestaObjetiva(
            pregunta.tipo,
            Number(pregunta.puntaje),
            pregunta.opciones,
            respuesta.opcionesSeleccionadas.map((o) => o.idOpcion),
            pregunta.espacios.map((e) => ({
              numeroEspacio: e.numeroEspacio,
              respuestasValidas: e.respuestasValidas.map((rv) => rv.respuesta),
              modoCalificacion: e.modoCalificacion,
              ignorarMayusculas: e.ignorarMayusculas,
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
          where: { idParticipante: participante.idParticipante },
          data: {
            estado: EstadoParticipante.FINALIZADO,
            fechaFinalizacion: new Date(),
            puntajeTotal: puntajeTotalObtenido,
            porcentaje:
              puntajeMaximoPosible === 0
                ? 0
                : (puntajeTotalObtenido / puntajeMaximoPosible) * 100,
          },
        });
      }

      // Cerrar la sesión
      await tx.sesion.update({
        where: { idSesion },
        data: { estado: EstadoSesion.FINALIZADA, fechaFin: new Date() },
      });
    });

    return { mensaje: 'Sesión finalizada correctamente.', idSesion };
  }

  async obtenerSesion(idUsuario: number, idSesion: number) {
    const sesion = await this.prisma.sesion.findUnique({
      where: { idSesion },
      include: {
        evaluacion: { select: { idEvaluacion: true, nombre: true, idUsuario: true } },
        participantes: {
          orderBy: { fechaIngreso: 'asc' },
          select: {
            idParticipante: true,
            nombre: true,
            estado: true,
            puntajeTotal: true,
            porcentaje: true,
            fechaIngreso: true,
            fechaFinalizacion: true,
          },
        },
      },
    });

    if (!sesion || sesion.evaluacion.idUsuario !== idUsuario) {
      throw new NotFoundException('Sesión no encontrada.');
    }

    const totalParticipantes = sesion.participantes.length;
    const enProgreso = sesion.participantes.filter(
      (p) => p.estado === EstadoParticipante.EN_PROGRESO,
    ).length;
    const finalizados = sesion.participantes.filter(
      (p) => p.estado === EstadoParticipante.FINALIZADO,
    ).length;

    return {
      idSesion: sesion.idSesion,
      codigo: sesion.codigo,
      estado: sesion.estado,
      fechaInicio: sesion.fechaInicio,
      fechaFin: sesion.fechaFin,
      evaluacion: sesion.evaluacion,
      resumen: { totalParticipantes, enProgreso, finalizados },
      participantes: sesion.participantes,
    };
  }

  async obtenerReporteSesion(idUsuario: number, idSesion: number) {
    const sesion = await this.prisma.sesion.findUnique({
      where: { idSesion },
      include: {
        evaluacion: {
          include: {
            preguntas: {
              orderBy: { orden: 'asc' },
              include: { opciones: true, espacios: true },
            },
          },
        },
        participantes: {
          orderBy: { fechaIngreso: 'asc' },
          include: {
            respuestas: {
              include: { opcionesSeleccionadas: { include: { opcion: true } } },
            },
          },
        },
      },
    });

    if (!sesion || sesion.evaluacion.idUsuario !== idUsuario) {
      throw new NotFoundException('Sesión no encontrada.');
    }

    const preguntas = sesion.evaluacion.preguntas;
    const puntajeMaximoPosible = preguntas.reduce((sum, p) => sum + Number(p.puntaje), 0);

    const participantesConRespuestas = sesion.participantes.map((p) => {
      const respuestasPorPregunta = new Map(p.respuestas.map((r) => [r.idPregunta, r]));

      const detalleRespuestas = preguntas.map((pregunta) => {
        const respuesta = respuestasPorPregunta.get(pregunta.idPregunta);
        return {
          idPregunta: pregunta.idPregunta,
          enunciado: pregunta.enunciado,
          tipo: pregunta.tipo,
          puntajeMaximo: Number(pregunta.puntaje),
          puntajeObtenido: respuesta ? Number(respuesta.puntaje) : null,
          esCorrecta: respuesta ? respuesta.esCorrecta : null,
          respuestaTexto: respuesta ? respuesta.respuestaTexto : null,
          opcionesSeleccionadas: respuesta
            ? respuesta.opcionesSeleccionadas.map((os) => os.opcion.texto)
            : [],
          corregidoDocente: respuesta ? respuesta.corregidoDocente : false,
        };
      });

      return {
        idParticipante: p.idParticipante,
        nombre: p.nombre,
        estado: p.estado,
        puntajeTotal: p.puntajeTotal ? Number(p.puntajeTotal) : null,
        porcentaje: p.porcentaje ? Number(p.porcentaje) : null,
        fechaIngreso: p.fechaIngreso,
        fechaFinalizacion: p.fechaFinalizacion,
        respuestas: detalleRespuestas,
      };
    });

    const finalizados = participantesConRespuestas.filter((p) => p.estado === EstadoParticipante.FINALIZADO);
    const puntajePromedio =
      finalizados.length > 0
        ? finalizados.reduce((sum, p) => sum + (p.puntajeTotal || 0), 0) / finalizados.length
        : 0;

    return {
      sesion: {
        idSesion: sesion.idSesion,
        codigo: sesion.codigo,
        estado: sesion.estado,
        fechaInicio: sesion.fechaInicio,
        fechaFin: sesion.fechaFin,
      },
      evaluacion: {
        nombre: sesion.evaluacion.nombre,
        descripcion: sesion.evaluacion.descripcion,
        puntajeMaximoPosible,
      },
      resumen: {
        totalParticipantes: sesion.participantes.length,
        enProgreso: sesion.participantes.filter((p) => p.estado === EstadoParticipante.EN_PROGRESO).length,
        finalizados: finalizados.length,
        puntajePromedio: Math.round(puntajePromedio * 100) / 100,
        porcentajePromedio:
          puntajeMaximoPosible > 0 && finalizados.length > 0
            ? Math.round((puntajePromedio / puntajeMaximoPosible) * 10000) / 100
            : 0,
      },
      participantes: participantesConRespuestas,
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

    if (!participante || participante.estado !== EstadoParticipante.EN_PROGRESO || participante.sesion.estado !== EstadoSesion.ACTIVA) {
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

    // Si la sesión fue finalizada por el docente, no permitir guardar
    if (participante.sesion.estado === EstadoSesion.FINALIZADA) {
      throw new BadRequestException('La sesión ha finalizado. No se pueden guardar más respuestas.');
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
