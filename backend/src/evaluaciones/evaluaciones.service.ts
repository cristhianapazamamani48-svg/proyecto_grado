import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoEvaluacion, TipoPregunta, ModoCalificacionEspacio, ModoInicioSesion } from '@prisma/client';

export interface CrearPreguntaDto {
  tipo: TipoPregunta;
  enunciado: string;
  imagen?: string;
  puntaje: number;
  orden: number;
  opciones?: { texto: string; esCorrecta: boolean }[];
  espacios?: { numeroEspacio: number; ignorarMayusculas: boolean; modoCalificacion: ModoCalificacionEspacio; respuestasValidas: string[] }[];
}

export interface CrearEvaluacionDto {
  nombre: string;
  descripcion?: string;
  tiempoTotal?: number;
  tiempoPorPregunta?: number;
  permitirRetroceder?: boolean;
  permitirModificar?: boolean;
  permitirDejarEnBlanco?: boolean;
  mostrarResultados?: boolean;
  mostrarRespuestas?: boolean;
  permitirRevision?: boolean;
  aleatorizarPreguntas?: boolean;
  aleatorizarOpciones?: boolean;
  detectarCambioPestana?: boolean;
  detectarClickDerecho?: boolean;
  detectarCopiar?: boolean;
  detectarPegar?: boolean;
  detectarRedimensionar?: boolean;
  modoInicio?: ModoInicioSesion;
  fechaInicio?: string;
  fechaFin?: string;
  preguntas: CrearPreguntaDto[];
}

@Injectable()
export class EvaluacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async listarPorDocente(idUsuario: number) {
    return this.prisma.evaluacion.findMany({
      where: { idUsuario },
      include: {
        preguntas: { orderBy: { orden: 'asc' } },
        _count: { select: { sesiones: true } },
      },
      orderBy: { fechaActualizacion: 'desc' },
    });
  }

  async obtenerPorId(idEvaluacion: number, idUsuario: number) {
    const evaluacion = await this.prisma.evaluacion.findUnique({
      where: { idEvaluacion },
      include: {
        preguntas: {
          orderBy: { orden: 'asc' },
          include: {
            opciones: true,
            espacios: { include: { respuestasValidas: true } },
          },
        },
      },
    });

    if (!evaluacion || evaluacion.idUsuario !== idUsuario) {
      throw new NotFoundException('Evaluación no encontrada.');
    }

    return evaluacion;
  }

  async crearEvaluacion(idUsuario: number, dto: CrearEvaluacionDto) {
    return this.prisma.$transaction(async (tx) => {
      const evaluacion = await tx.evaluacion.create({
        data: {
          idUsuario,
          nombre: dto.nombre,
          descripcion: dto.descripcion,
          estado: EstadoEvaluacion.BORRADOR,
          tiempoTotal: dto.tiempoTotal || null,
          tiempoPorPregunta: dto.tiempoPorPregunta || null,
          permitirRetroceder: dto.permitirRetroceder ?? true,
          permitirModificar: dto.permitirModificar ?? true,
          permitirDejarEnBlanco: dto.permitirDejarEnBlanco ?? true,
          mostrarResultados: dto.mostrarResultados ?? true,
          mostrarRespuestas: dto.mostrarRespuestas ?? false,
          permitirRevision: dto.permitirRevision ?? false,
          aleatorizarPreguntas: dto.aleatorizarPreguntas ?? false,
          aleatorizarOpciones: dto.aleatorizarOpciones ?? false,
          detectarCambioPestana: dto.detectarCambioPestana ?? false,
          detectarClickDerecho: dto.detectarClickDerecho ?? false,
          detectarCopiar: dto.detectarCopiar ?? false,
          detectarPegar: dto.detectarPegar ?? false,
          detectarRedimensionar: dto.detectarRedimensionar ?? false,
          modoInicio: dto.modoInicio || ModoInicioSesion.INMEDIATO,
          fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : null,
          fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
        },
      });

      if (dto.preguntas && dto.preguntas.length > 0) {
        for (const preg of dto.preguntas) {
          const creada = await tx.pregunta.create({
            data: {
              idEvaluacion: evaluacion.idEvaluacion,
              tipo: preg.tipo,
              enunciado: preg.enunciado,
              imagen: preg.imagen,
              puntaje: preg.puntaje,
              orden: preg.orden,
            },
          });

          if (preg.opciones && preg.opciones.length > 0) {
            await tx.opcionRespuesta.createMany({
              data: preg.opciones.map((opc) => ({
                idPregunta: creada.idPregunta,
                texto: opc.texto,
                esCorrecta: opc.esCorrecta,
              })),
            });
          }

          if (preg.espacios && preg.espacios.length > 0) {
            for (const esp of preg.espacios) {
              const espacioCreado = await tx.espacioCompletar.create({
                data: {
                  idPregunta: creada.idPregunta,
                  numeroEspacio: esp.numeroEspacio,
                  ignorarMayusculas: esp.ignorarMayusculas ?? true,
                  modoCalificacion: esp.modoCalificacion || ModoCalificacionEspacio.EXACTA,
                },
              });

              if (esp.respuestasValidas && esp.respuestasValidas.length > 0) {
                await tx.respuestaValida.createMany({
                  data: esp.respuestasValidas.map((rv) => ({
                    idEspacio: espacioCreado.idEspacio,
                    respuesta: rv,
                  })),
                });
              }
            }
          }
        }
      }

      return evaluacion;
    });
  }
}
