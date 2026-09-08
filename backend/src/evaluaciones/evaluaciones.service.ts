import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
          ...this.mapConfiguracion(dto)
        },
      });

      await this.insertarPreguntas(tx, evaluacion.idEvaluacion, dto.preguntas);
      return evaluacion;
    });
  }

  async actualizarEvaluacion(idEvaluacion: number, idUsuario: number, dto: CrearEvaluacionDto) {
    const evaluacion = await this.prisma.evaluacion.findUnique({
      where: { idEvaluacion },
      include: { sesiones: { include: { participantes: { select: { idParticipante: true } } } } }
    });

    if (!evaluacion || evaluacion.idUsuario !== idUsuario) {
      throw new NotFoundException('Evaluación no encontrada.');
    }

    if (evaluacion.estado === EstadoEvaluacion.PUBLICADA) {
      const tieneParticipantes = evaluacion.sesiones.some(s => s.participantes.length > 0);
      if (tieneParticipantes) {
        throw new BadRequestException('No se puede editar una evaluación publicada que ya tiene respuestas. Por favor, duplica la evaluación.');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.evaluacion.update({
        where: { idEvaluacion },
        data: {
          nombre: dto.nombre,
          descripcion: dto.descripcion,
          ...this.mapConfiguracion(dto)
        },
      });

      await tx.pregunta.deleteMany({ where: { idEvaluacion } });
      await this.insertarPreguntas(tx, idEvaluacion, dto.preguntas);

      return actualizada;
    });
  }

  async duplicarEvaluacion(idEvaluacion: number, idUsuario: number) {
    const original = await this.obtenerPorId(idEvaluacion, idUsuario);
    
    const preguntasDto: CrearPreguntaDto[] = original.preguntas.map(p => ({
      tipo: p.tipo,
      enunciado: p.enunciado,
      imagen: p.imagen || undefined,
      puntaje: Number(p.puntaje),
      orden: p.orden,
      opciones: p.opciones?.map(o => ({ texto: o.texto, esCorrecta: o.esCorrecta })),
      espacios: p.espacios?.map(e => ({
        numeroEspacio: e.numeroEspacio,
        ignorarMayusculas: e.ignorarMayusculas,
        modoCalificacion: e.modoCalificacion,
        respuestasValidas: e.respuestasValidas.map(rv => rv.respuesta)
      }))
    }));

    const dto: CrearEvaluacionDto = {
      nombre: original.nombre + ' (Copia)',
      descripcion: original.descripcion || undefined,
      tiempoTotal: original.tiempoTotal || undefined,
      tiempoPorPregunta: original.tiempoPorPregunta || undefined,
      permitirRetroceder: original.permitirRetroceder,
      permitirModificar: original.permitirModificar,
      permitirDejarEnBlanco: original.permitirDejarEnBlanco,
      mostrarResultados: original.mostrarResultados,
      mostrarRespuestas: original.mostrarRespuestas,
      permitirRevision: original.permitirRevision,
      aleatorizarPreguntas: original.aleatorizarPreguntas,
      aleatorizarOpciones: original.aleatorizarOpciones,
      detectarCambioPestana: original.detectarCambioPestana,
      detectarClickDerecho: original.detectarClickDerecho,
      detectarCopiar: original.detectarCopiar,
      detectarPegar: original.detectarPegar,
      detectarRedimensionar: original.detectarRedimensionar,
      modoInicio: original.modoInicio,
      fechaInicio: original.fechaInicio ? original.fechaInicio.toISOString() : undefined,
      fechaFin: original.fechaFin ? original.fechaFin.toISOString() : undefined,
      preguntas: preguntasDto
    };

    return this.crearEvaluacion(idUsuario, dto);
  }

  async cambiarEstado(idEvaluacion: number, idUsuario: number, estado: EstadoEvaluacion) {
    const evaluacion = await this.prisma.evaluacion.findUnique({ where: { idEvaluacion } });
    if (!evaluacion || evaluacion.idUsuario !== idUsuario) throw new NotFoundException('Evaluación no encontrada.');

    return this.prisma.evaluacion.update({
      where: { idEvaluacion },
      data: { estado }
    });
  }

  async eliminarEvaluacion(idEvaluacion: number, idUsuario: number) {
    const evaluacion = await this.prisma.evaluacion.findUnique({
      where: { idEvaluacion },
      include: { _count: { select: { sesiones: true } } }
    });
    
    if (!evaluacion || evaluacion.idUsuario !== idUsuario) throw new NotFoundException('Evaluación no encontrada.');
    
    if (evaluacion.estado === EstadoEvaluacion.PUBLICADA && evaluacion._count.sesiones > 0) {
       throw new BadRequestException('No se puede eliminar una evaluación publicada con sesiones. Archívala en su lugar.');
    }

    return this.prisma.evaluacion.delete({ where: { idEvaluacion } });
  }

  private mapConfiguracion(dto: CrearEvaluacionDto) {
    return {
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
    };
  }

  private async insertarPreguntas(tx: any, idEvaluacion: number, preguntas: CrearPreguntaDto[]) {
    if (!preguntas || preguntas.length === 0) return;

    for (const preg of preguntas) {
      const creada = await tx.pregunta.create({
        data: {
          idEvaluacion,
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
}
