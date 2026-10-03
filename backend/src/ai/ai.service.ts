import { Injectable, Logger, ForbiddenException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PagosService } from '../pagos/pagos.service';
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
    @Inject(forwardRef(() => PagosService))
    private readonly pagosService: PagosService,
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

    const idOrganizacion = respuesta.pregunta.evaluacion.idOrganizacion;
    if (idOrganizacion) {
      await this.pagosService.verificarPermisosYCuotas(idOrganizacion, 'SOLICITAR_IA');
    }

    // La verificación de cuotas ya la realizó pagosService.verificarPermisosYCuotas arriba.
    // Ejecutar análisis mediante el proveedor abstracto

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
    if (idOrganizacion) {
      await this.prisma.usoIaLog.create({
        data: {
          idOrganizacion,
          idUsuario,
          proveedor: this.provider.nombreProveedor,
          tokensUtilizados: Math.ceil((enunciado.length + respEstudiante.length) / 4) + 150,
        },
      });
    }

    return resultado;
  }
}
