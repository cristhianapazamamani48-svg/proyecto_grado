import { Injectable, Logger } from '@nestjs/common';
import { AiProvider, AiAnalysisParams, AiAnalysisResult } from '../interfaces/ai-provider.interface';

@Injectable()
export class OpenAIProvider implements AiProvider {
  readonly nombreProveedor = 'openai';
  private readonly logger = new Logger(OpenAIProvider.name);

  async analyzeOpenResponse(params: AiAnalysisParams): Promise<AiAnalysisResult> {
    this.logger.warn('[OpenAIProvider] Proveedor configurado como preparado. Usando fallback seguro.');
    throw new Error('El proveedor OpenAI no tiene una API key configurada. Seleccione AI_PROVIDER=mock para pruebas locales.');
  }

  async generateFeedback(params: AiAnalysisParams): Promise<string> {
    const res = await this.analyzeOpenResponse(params);
    return res.retroalimentacion;
  }

  async suggestScore(params: AiAnalysisParams): Promise<number> {
    const res = await this.analyzeOpenResponse(params);
    return res.puntajeSugerido;
  }
}
