import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiProvider, AiAnalysisResult } from './interfaces/ai-provider.interface';
import { MockAIProvider } from './providers/mock-ai.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { EstadoRevisionIa } from '@prisma/client';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private provider: AiProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mockProvider: MockAIProvider,
    private readonly openAIProvider: OpenAIProvider,
    private readonly geminiProvider: GeminiProvider,
    private readonly claudeProvider: ClaudeProvider,
  ) {
    const providerName = (process.env.AI_PROVIDER || 'mock').toLowerCase();
    this.setProvider(providerName);
  }

  setProvider(name: string) {
    switch (name) {
      case 'openai':
        this.provider = this.openAIProvider;
        break;
      case 'gemini':
        this.provider = this.geminiProvider;
        break;
      case 'claude':
        this.provider = this.claudeProvider;
        break;
      case 'mock':
      default:
        this.provider = this.mockProvider;
        break;
    }
    this.logger.log(`Proveedor de IA inicializado: ${this.provider.nombreProveedor}`);
  }

  async analizarRespuestaAbierta(idRespuesta: number, idUsuario: number): Promise<AiAnalysisResult> {
    const respuesta = await this.prisma.respuesta.findUnique({
      where: { idRespuesta },
      include: {
        pregunta: {
          include: {
            evaluacion: {
              include: { organizacion: true },
            },
          },
        },
        participante: {
          include: { sesion: true },
        },
      },
    });

    if (!respuesta) {
      throw new NotFoundException(`La respuesta ${idRespuesta} no fue encontrada.`);
    }

    const organizacion = respuesta.pregunta.evaluacion.organizacion;
    if (organizacion && !organizacion.iaHabilitada) {
      throw new ForbiddenException('La función de inteligencia artificial está desactivada para esta organización.');
    }

    // Verificar límites mensuales de correcciones IA
    if (organizacion) {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const usoMes = await this.prisma.usoIaLog.count({
        where: {
          idOrganizacion: organizacion.idOrganizacion,
          fecha: { gte: inicioMes },
        },
      });

      if (usoMes >= organizacion.limiteCorreccionesIaMes) {
        throw new ForbiddenException(`Límite mensual de correcciones asistidas por IA alcanzado (${usoMes}/${organizacion.limiteCorreccionesIaMes}). Actualice su plan.`);
      }
    }

    const maxScore = Number(respuesta.pregunta.puntaje) || 10;
    const enunciado = respuesta.pregunta.enunciado;
    const respEstudiante = respuesta.respuestaTexto || '';

    // Ejecutar análisis mediante el proveedor abstracto
    const resultado = await this.provider.analyzeOpenResponse({
      enunciado,
      respuestaEstudiante: respEstudiante,
      puntajeMaximo: maxScore,
    });

    // Guardar sugerencia de IA en base de datos sin alterar la calificación del docente
    await this.prisma.respuesta.update({
      where: { idRespuesta },
      data: {
        puntajeSugeridoIa: resultado.puntajeSugerido,
        comentarioIa: resultado.retroalimentacion,
        confianzaIa: resultado.nivelConfianza,
        justificacionIa: resultado.justificacion,
        fortalezasIa: JSON.stringify(resultado.fortalezas),
        faltantesIa: JSON.stringify(resultado.faltantes),
        modeloIa: process.env.AI_MODEL || this.provider.nombreProveedor,
        fechaAnalisisIa: new Date(),
        estadoRevisionIa: EstadoRevisionIa.SUGERIDA,
        versionPrompt: 'v1.0',
      },
    });

    // Registrar consumo en auditoría de uso de IA
    if (organizacion) {
      await this.prisma.usoIaLog.create({
        data: {
          idOrganizacion: organizacion.idOrganizacion,
          idUsuario,
          proveedor: this.provider.nombreProveedor,
          tokensUtilizados: Math.ceil((enunciado.length + respEstudiante.length) / 4) + 150,
        },
      });
    }

    return resultado;
  }
}
