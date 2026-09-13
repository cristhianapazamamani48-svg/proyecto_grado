import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalificacionService } from '../calificacion/calificacion.service';
import { JwtService } from '@nestjs/jwt';
import { EvaluacionGateway } from '../realtime/evaluacion.gateway';
import {
  EstadoSesion,
  EstadoParticipante,
  TipoPregunta,
  EstadoEvaluacion,
  TipoEventoMonitoreo,
} from '@prisma/client';

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
    private readonly gateway: EvaluacionGateway,
  ) {}

  private generarCodigoUnico(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Deterministic shuffle using a numeric seed (Linear Congruential Generator)
  private shuffleDeterministic<T>(array: T[], seed: number): T[] {
    const arr = [...array];
    let currentSeed = Math.abs(seed) || 1234567;
    const random = () => {
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      return currentSeed / 233280;
    };

    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
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

    // Validar ventana de fechas de la evaluación si está configurada
    const now = new Date();
    if (sesion.evaluacion.fechaInicio && now < sesion.evaluacion.fechaInicio) {
      throw new BadRequestException(
        `La evaluación aún no ha comenzado. Fecha de inicio: ${sesion.evaluacion.fechaInicio.toLocaleString('es-BO')}`,
      );
    }
    if (sesion.evaluacion.fechaFin && now > sesion.evaluacion.fechaFin) {
      throw new BadRequestException('El plazo para realizar esta evaluación ha concluido.');
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

    // Notificar al docente que se unió un nuevo participante
    this.gateway.notificarParticipanteActualizado(sesion.codigo, {
      idParticipante: participante.idParticipante,
      nombre: participante.nombre,
      estado: participante.estado,
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
      select: {
        idParticipante: true,
        nombre: true,
        estado: true,
        fechaIngreso: true,
        sesion: {
          select: {
            idSesion: true,
            codigo: true,
            estado: true,
            evaluacion: {
              select: {
                tiempoTotal: true,
                tiempoPorPregunta: true,
                fechaInicio: true,
                fechaFin: true,
              },
            },
          },
        },
      },
    });

    if (!participante) throw new NotFoundException('Participante no encontrado.');

    const evaluacion = participante.sesion.evaluacion;
    let tiempoRestanteTotal: number | null = null;
    if (evaluacion.tiempoTotal && participante.fechaIngreso) {
      const elapsedSec = Math.floor((Date.now() - new Date(participante.fechaIngreso).getTime()) / 1000);
      tiempoRestanteTotal = Math.max(0, evaluacion.tiempoTotal * 60 - elapsedSec);
    }

    return {
      estadoSesion: participante.sesion.estado,
      estadoParticipante: participante.estado,
      servidorTimestamp: Date.now(),
      fechaIngreso: participante.fechaIngreso,
      tiempoTotal: evaluacion.tiempoTotal ? evaluacion.tiempoTotal * 60 : null,
      tiempoPorPregunta: evaluacion.tiempoPorPregunta || null,
      tiempoRestanteTotal,
    };
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

    const actualizada = await this.prisma.sesion.update({
      where: { idSesion },
      data: { estado: EstadoSesion.ACTIVA, fechaInicio: new Date() },
    });

    // Notificar a todos los estudiantes en la sala Socket.IO
    this.gateway.notificarAvanzarPregunta(sesion.codigo, 0);

    return actualizada;
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

      await tx.sesion.update({
        where: { idSesion },
        data: { estado: EstadoSesion.FINALIZADA, fechaFin: new Date() },
      });
    });

    // Notificar cierre a la sala Socket.IO
    this.gateway.notificarSesionFinalizada(sesion.codigo);

    return { mensaje: 'Sesión finalizada correctamente.', idSesion };
  }

  async obtenerSesion(idUsuario: number, idSesion: number) {
    const sesion = await this.prisma.sesion.findUnique({
      where: { idSesion },
      include: {
        evaluacion: { select: { idEvaluacion: true, nombre: true, idUsuario: true, tiempoTotal: true, tiempoPorPregunta: true } },
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
            eventosMonitoreo: {
              orderBy: { fechaEvento: 'desc' },
              select: {
                idEvento: true,
                tipo: true,
                detalle: true,
                fechaEvento: true,
              },
            },
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

    // Calcular estadísticas de infracciones
    const participantesConInfracciones = sesion.participantes.map((p) => ({
      ...p,
      totalInfracciones: p.eventosMonitoreo.length,
      nivelRiesgo:
        p.eventosMonitoreo.length === 0
          ? 'NORMAL'
          : p.eventosMonitoreo.length <= 2
          ? 'ADVERTENCIA'
          : 'ALTO',
    }));

    return {
      idSesion: sesion.idSesion,
      codigo: sesion.codigo,
      estado: sesion.estado,
      fechaInicio: sesion.fechaInicio,
      fechaFin: sesion.fechaFin,
      evaluacion: sesion.evaluacion,
      resumen: { totalParticipantes, enProgreso, finalizados },
      participantes: participantesConInfracciones,
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
            eventosMonitoreo: {
              orderBy: { fechaEvento: 'asc' },
            },
            respuestas: {
              include: {
                opcionesSeleccionadas: { include: { opcion: true } },
                usuarioCorrector: { select: { nombre: true, apellido: true } },
              },
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

    let totalAbiertasPendientes = 0;

    const participantesConRespuestas = sesion.participantes.map((p) => {
      const respuestasPorPregunta = new Map(p.respuestas.map((r) => [r.idPregunta, r]));

      const detalleRespuestas = preguntas.map((pregunta) => {
        const respuesta = respuestasPorPregunta.get(pregunta.idPregunta);

        if (pregunta.tipo === TipoPregunta.ABIERTA && respuesta && !respuesta.corregidoDocente) {
          totalAbiertasPendientes++;
        }

        return {
          idRespuesta: respuesta ? respuesta.idRespuesta : null,
          idPregunta: pregunta.idPregunta,
          enunciado: pregunta.enunciado,
          tipo: pregunta.tipo,
          puntajeMaximo: Number(pregunta.puntaje),
          puntajeObtenido: respuesta && respuesta.puntaje !== null ? Number(respuesta.puntaje) : null,
          esCorrecta: respuesta ? respuesta.esCorrecta : null,
          respuestaTexto: respuesta ? respuesta.respuestaTexto : null,
          comentarioDocente: respuesta ? respuesta.comentarioIa : null,
          corregidoDocente: respuesta ? respuesta.corregidoDocente : false,
          fechaCorreccion: respuesta ? respuesta.fechaCorreccion : null,
          correctorNombre: respuesta?.usuarioCorrector
            ? `${respuesta.usuarioCorrector.nombre} ${respuesta.usuarioCorrector.apellido}`
            : null,
          opcionesSeleccionadas: respuesta
            ? respuesta.opcionesSeleccionadas.map((os) => os.opcion.texto)
            : [],
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
        totalInfracciones: p.eventosMonitoreo.length,
        eventosMonitoreo: p.eventosMonitoreo,
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
        idEvaluacion: sesion.evaluacion.idEvaluacion,
        nombre: sesion.evaluacion.nombre,
        descripcion: sesion.evaluacion.descripcion,
        puntajeMaximoPosible,
        tiempoTotal: sesion.evaluacion.tiempoTotal,
        tiempoPorPregunta: sesion.evaluacion.tiempoPorPregunta,
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
        totalAbiertasPendientes,
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

    if (
      !participante ||
      participante.estado !== EstadoParticipante.EN_PROGRESO ||
      participante.sesion.estado !== EstadoSesion.ACTIVA
    ) {
      throw new NotFoundException('No existe un intento activo para este participante.');
    }

    const evaluacion = participante.sesion.evaluacion;

    // Calcular cronómetro y tiempo restante
    const now = Date.now();
    const tiempoTotalSegundos = evaluacion.tiempoTotal ? evaluacion.tiempoTotal * 60 : null;
    let tiempoRestanteTotal: number | null = null;

    if (tiempoTotalSegundos && participante.fechaIngreso) {
      const elapsed = Math.floor((now - new Date(participante.fechaIngreso).getTime()) / 1000);
      tiempoRestanteTotal = Math.max(0, tiempoTotalSegundos - elapsed);
    }

    // Preparar preguntas con aleatorización si corresponde
    let preguntas = evaluacion.preguntas;
    if (evaluacion.aleatorizarPreguntas) {
      preguntas = this.shuffleDeterministic(preguntas, participante.idParticipante * 31);
    }

    const preguntasFormateadas = preguntas.map((pregunta) => {
      let opciones = pregunta.opciones;
      if (evaluacion.aleatorizarOpciones && (pregunta.tipo === TipoPregunta.OPCION_MULTIPLE || pregunta.tipo === TipoPregunta.SELECCION_MULTIPLE)) {
        opciones = this.shuffleDeterministic(opciones, participante.idParticipante * 37 + pregunta.idPregunta);
      }

      return {
        id: String(pregunta.idPregunta),
        tipo: this.tipoParaFrontend(pregunta.tipo),
        enunciado: pregunta.enunciado,
        imagenUrl: pregunta.imagen,
        puntaje: Number(pregunta.puntaje),
        opciones: opciones.map((opcion) => ({ id: String(opcion.idOpcion), texto: opcion.texto })),
        espacios: pregunta.espacios.map((espacio) => ({ id: String(espacio.idEspacio), posicion: espacio.numeroEspacio })),
      };
    });

    return {
      intentoId: String(participante.idParticipante),
      nombreParticipante: participante.nombre,
      codigoSesion: participante.sesion.codigo,
      nombreEvaluacion: evaluacion.nombre,
      descripcionEvaluacion: evaluacion.descripcion,
      servidorTimestamp: now,
      fechaIngreso: participante.fechaIngreso,
      tiempoTotal: tiempoTotalSegundos,
      tiempoPorPregunta: evaluacion.tiempoPorPregunta || null,
      tiempoRestanteTotal,
      reglas: {
        permitirRetroceder: evaluacion.permitirRetroceder,
        permitirModificar: evaluacion.permitirModificar,
        permitirDejarEnBlanco: evaluacion.permitirDejarEnBlanco,
        mostrarResultados: evaluacion.mostrarResultados,
        mostrarRespuestas: evaluacion.mostrarRespuestas,
        permitirRevision: evaluacion.permitirRevision,
        detectarCambioPestana: evaluacion.detectarCambioPestana,
        detectarClickDerecho: evaluacion.detectarClickDerecho,
        detectarCopiar: evaluacion.detectarCopiar,
        detectarPegar: evaluacion.detectarPegar,
        detectarRedimensionar: evaluacion.detectarRedimensionar,
      },
      preguntas: preguntasFormateadas,
      respuestasGuardadas: participante.respuestas.map((respuesta) => ({
        preguntaId: String(respuesta.idPregunta),
        opcionesSeleccionadas: respuesta.opcionesSeleccionadas.map((opcion) => String(opcion.idOpcion)),
        textoRespuesta: this.esJson(respuesta.respuestaTexto) ? '' : respuesta.respuestaTexto || '',
        espaciosRespuestas: this.parsearEspacios(respuesta.respuestaTexto),
      })),
    };
  }

  async guardarRespuesta(
    idParticipante: number,
    body: {
      intentoId: string;
      preguntaId: string;
      opcionesSeleccionadas?: string[];
      textoRespuesta?: string;
      espaciosRespuestas?: Record<string, string>;
    },
  ) {
    const intentoId = Number(body.intentoId);
    const idPregunta = Number(body.preguntaId);
    if (!Number.isInteger(intentoId) || !Number.isInteger(idPregunta) || intentoId !== idParticipante) {
      throw new BadRequestException('El intento o la pregunta no son válidos.');
    }

    const participante = await this.prisma.participante.findUnique({
      where: { idParticipante },
      include: { sesion: { include: { evaluacion: true } } },
    });
    if (!participante || participante.estado !== EstadoParticipante.EN_PROGRESO) {
      throw new BadRequestException('El intento ya no está disponible para guardar respuestas.');
    }

    if (participante.sesion.estado === EstadoSesion.FINALIZADA) {
      throw new BadRequestException('La sesión ha finalizado. No se pueden guardar más respuestas.');
    }

    const evaluacion = participante.sesion.evaluacion;

    // Validación estricta de tiempo límite en backend
    const now = Date.now();
    if (evaluacion.tiempoTotal && participante.fechaIngreso) {
      const maxAllowed = new Date(participante.fechaIngreso).getTime() + evaluacion.tiempoTotal * 60 * 1000 + 10000;
      if (now > maxAllowed) {
        throw new BadRequestException('El tiempo límite del examen ha expirado.');
      }
    }

    if (evaluacion.fechaFin && now > new Date(evaluacion.fechaFin).getTime() + 10000) {
      throw new BadRequestException('La evaluación ha cerrado por fecha límite.');
    }

    // Validación de regla permitirModificar
    if (!evaluacion.permitirModificar) {
      const respuestaExistente = await this.prisma.respuesta.findUnique({
        where: { idParticipante_idPregunta: { idParticipante, idPregunta } },
        include: { opcionesSeleccionadas: true },
      });
      if (
        respuestaExistente &&
        (respuestaExistente.respuestaTexto || respuestaExistente.opcionesSeleccionadas.length > 0)
      ) {
        throw new BadRequestException('La evaluación no permite modificar respuestas ya enviadas.');
      }
    }

    const pregunta = await this.prisma.pregunta.findFirst({
      where: { idPregunta, idEvaluacion: participante.sesion.idEvaluacion },
      include: { opciones: { select: { idOpcion: true } } },
    });
    if (!pregunta) throw new NotFoundException('La pregunta no pertenece a esta evaluación.');

    const opcionesSeleccionadas = [...new Set((body.opcionesSeleccionadas || []).map(Number))];
    if (
      opcionesSeleccionadas.some((id) => !Number.isInteger(id)) ||
      opcionesSeleccionadas.some((id) => !pregunta.opciones.some((opcion) => opcion.idOpcion === id))
    ) {
      throw new BadRequestException('Una o más opciones no pertenecen a la pregunta.');
    }

    const respuestaTexto =
      pregunta.tipo === TipoPregunta.COMPLETAR
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
                    opciones: { select: { idOpcion: true, texto: true, esCorrecta: true } },
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

    const evaluacion = participante.sesion.evaluacion;
    const porcentajeObtenido =
      puntajeMaximoPosible === 0 ? 0 : Math.round((puntajeTotalObtenido / puntajeMaximoPosible) * 100);

    // Notificar actualización al panel docente vía Socket.IO
    this.gateway.notificarParticipanteActualizado(participante.sesion.codigo, {
      idParticipante: participante.idParticipante,
      nombre: participante.nombre,
      estado: EstadoParticipante.FINALIZADO,
      puntajeTotal: puntajeTotalObtenido,
      porcentaje: porcentajeObtenido,
    });

    // Construir respuestas correctas solo si mostrarRespuestas está activado
    let detalleRespuestasCorrectas: any = null;
    if (evaluacion.mostrarRespuestas) {
      detalleRespuestasCorrectas = preguntas.map((preg) => ({
        idPregunta: preg.idPregunta,
        enunciado: preg.enunciado,
        tipo: preg.tipo,
        opcionesCorrectas: preg.opciones.filter((o) => o.esCorrecta).map((o) => o.texto),
        espaciosValidos: preg.espacios.map((e) => ({
          numeroEspacio: e.numeroEspacio,
          respuestas: e.respuestasValidas.map((rv) => rv.respuesta),
        })),
      }));
    }

    return {
      notaFinal: porcentajeObtenido,
      puntajeTotalObtenido,
      puntajeMaximoPosible,
      mostrarResultados: evaluacion.mostrarResultados,
      mostrarRespuestas: evaluacion.mostrarRespuestas,
      permitirRevision: evaluacion.permitirRevision,
      respuestasCorrectas: detalleRespuestasCorrectas,
    };
  }

  // --- Monitoreo de Infracciones ---
  async registrarEventoMonitoreo(
    idParticipante: number,
    body: { tipo: TipoEventoMonitoreo; detalle?: string },
  ) {
    const participante = await this.prisma.participante.findUnique({
      where: { idParticipante },
      include: { sesion: true },
    });

    if (!participante || participante.estado !== EstadoParticipante.EN_PROGRESO) {
      throw new BadRequestException('El participante no tiene un intento en progreso.');
    }

    if (participante.sesion.estado !== EstadoSesion.ACTIVA) {
      throw new BadRequestException('La sesión de evaluación no está activa.');
    }

    // Rate limiting básico / deduplicación: verificar si hubo un evento idéntico en los últimos 2 segundos
    const dosSegundosAtras = new Date(Date.now() - 2000);
    const eventoReciente = await this.prisma.eventoMonitoreo.findFirst({
      where: {
        idParticipante,
        tipo: body.tipo,
        fechaEvento: { gte: dosSegundosAtras },
      },
    });

    if (eventoReciente) {
      return { idEvento: eventoReciente.idEvento, dedup: true };
    }

    const evento = await this.prisma.eventoMonitoreo.create({
      data: {
        idParticipante,
        tipo: body.tipo,
        detalle: body.detalle || null,
        fechaEvento: new Date(),
      },
    });

    // Emitir en tiempo real a la sala Socket.IO de la sesión
    this.gateway.notificarEventoMonitoreo(participante.sesion.codigo, {
      idEvento: evento.idEvento,
      idParticipante: participante.idParticipante,
      nombreParticipante: participante.nombre,
      tipo: evento.tipo,
      detalle: evento.detalle,
      fechaEvento: evento.fechaEvento,
    });

    return evento;
  }

  // --- Corrección Manual de Respuestas Abiertas ---
  async calificarRespuestaAbierta(
    idUsuarioDocente: number,
    idRespuesta: number,
    body: { puntaje: number; comentario?: string },
  ) {
    const respuesta = await this.prisma.respuesta.findUnique({
      where: { idRespuesta },
      include: {
        pregunta: { include: { evaluacion: true } },
        participante: { include: { respuestas: true, sesion: { include: { evaluacion: { include: { preguntas: true } } } } } },
      },
    });

    if (!respuesta) {
      throw new NotFoundException('Respuesta no encontrada.');
    }

    if (respuesta.pregunta.evaluacion.idUsuario !== idUsuarioDocente) {
      throw new ForbiddenException('No tienes permisos para calificar esta evaluación.');
    }

    const puntajeMax = Number(respuesta.pregunta.puntaje);
    const puntajeAsignado = Math.max(0, Math.min(puntajeMax, Number(body.puntaje)));

    const actualizada = await this.prisma.$transaction(async (tx) => {
      const respActualizada = await tx.respuesta.update({
        where: { idRespuesta },
        data: {
          puntaje: puntajeAsignado,
          comentarioIa: body.comentario?.trim() || null,
          corregidoDocente: true,
          idUsuarioCorrector: idUsuarioDocente,
          fechaCorreccion: new Date(),
          esCorrecta: puntajeAsignado > 0,
        },
      });

      // Recalcular el puntaje total del participante
      const todasLasRespuestas = await tx.respuesta.findMany({
        where: { idParticipante: respuesta.idParticipante },
      });

      const nuevoPuntajeTotal = todasLasRespuestas.reduce(
        (sum, r) => sum + (r.puntaje ? Number(r.puntaje) : 0),
        0,
      );

      const todasLasPreguntas = respuesta.participante.sesion.evaluacion.preguntas;
      const puntajeMaxTotal = todasLasPreguntas.reduce(
        (sum, p) => sum + Number(p.puntaje),
        0,
      );

      const nuevoPorcentaje =
        puntajeMaxTotal === 0 ? 0 : (nuevoPuntajeTotal / puntajeMaxTotal) * 100;

      const partActualizado = await tx.participante.update({
        where: { idParticipante: respuesta.idParticipante },
        data: {
          puntajeTotal: nuevoPuntajeTotal,
          porcentaje: nuevoPorcentaje,
        },
      });

      return { respuesta: respActualizada, participante: partActualizado };
    });

    return actualizada;
  }

  // --- Helpers ---
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
