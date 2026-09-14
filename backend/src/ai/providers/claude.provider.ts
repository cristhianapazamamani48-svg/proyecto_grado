import { Injectable, Logger } from '@nestjs/common';
import { AiProvider, AiAnalysisParams, AiAnalysisResult } from '../interfaces/ai-provider.interface';

@Injectable()
export class ClaudeProvider implements AiProvider {
  readonly nombreProveedor = 'claude';
  private readonly logger = new Logger(ClaudeProvider.name);

  async analyzeOpenResponse(params: AiAnalysisParams): Promise<AiAnalysisResult> {
    this.logger.warn('[ClaudeProvider] Proveedor configurado como preparado. Usando fallback seguro.');
    throw new Error('El proveedor Claude no tiene una API key configurada. Seleccione AI_PROVIDER=mock para pruebas locales.');
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
