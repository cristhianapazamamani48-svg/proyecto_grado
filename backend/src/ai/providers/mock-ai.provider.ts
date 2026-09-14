import { Injectable, Logger } from '@nestjs/common';
import { AiProvider, AiAnalysisParams, AiAnalysisResult } from '../interfaces/ai-provider.interface';

@Injectable()
export class MockAIProvider implements AiProvider {
  readonly nombreProveedor = 'mock';
  private readonly logger = new Logger(MockAIProvider.name);

  async analyzeOpenResponse(params: AiAnalysisParams): Promise<AiAnalysisResult> {
    this.logger.log(`[MockAIProvider] Analizando respuesta abierta de ${params.respuestaEstudiante.length} caracteres.`);

    const resp = (params.respuestaEstudiante || '').trim();
    const maxScore = Number(params.puntajeMaximo) || 10;

    // Validación básica de respuesta vacía o extremadamente corta
    if (!resp || resp.length < 3) {
      return {
        puntajeSugerido: 0,
        puntajeMaximo: maxScore,
        nivelConfianza: 0.95,
        esCorrecta: false,
        justificacion: 'El estudiante no proporcionó una respuesta adecuada o la respuesta es demasiado breve.',
        fortalezas: [],
        faltantes: ['Respuesta completa', 'Argumentación principal'],
        retroalimentacion: 'Por favor, fundamenta tu respuesta con más detalle.',
        requiereRevisionHumana: true,
      };
    }

    // Aislamiento contra inyección de prompts en respuestas
    const respuestaLimpia = resp.replace(/system|prompt|override|ignore previous/gi, '[filtrado]');

    // Heurística simulada realista basada en longitud y palabras clave
    const palabras = respuestaLimpia.split(/\s+/).length;
    let factorCalidad = Math.min(palabras / 15, 1.0);

    if (params.respuestaEsperada) {
      const palabrasEsperadas = params.respuestaEsperada.toLowerCase().split(/\s+/);
      const coincidentes = palabrasEsperadas.filter(p => p.length > 3 && respuestaLimpia.toLowerCase().includes(p));
      const ratioCoincidencia = palabrasEsperadas.length > 0 ? coincidentes.length / palabrasEsperadas.length : 0.5;
      factorCalidad = (factorCalidad + ratioCoincidencia) / 2;
    }

    const puntajeCalculado = Math.min(Math.max(Number((maxScore * factorCalidad).toFixed(2)), 0), maxScore);
    const esCorrecta = puntajeCalculado >= maxScore * 0.6;
    const nivelConfianza = Number((0.75 + Math.random() * 0.2).toFixed(2));

    const fortalezas: string[] = [];
    const faltantes: string[] = [];

    if (palabras >= 10) fortalezas.push('Desarrollo adecuado y extensión apropiada');
    if (respuestaLimpia.includes('por ejemplo') || respuestaLimpia.includes('debido a')) fortalezas.push('Uso de argumentación estructurada');

    if (puntajeCalculado < maxScore) {
      faltantes.push('Profundización en conceptos clave');
      if (palabras < 12) faltantes.push('Mayor extensión en la respuesta');
    }

    return {
      puntajeSugerido: puntajeCalculado,
      puntajeMaximo: maxScore,
      nivelConfianza,
      esCorrecta,
      justificacion: `Sugerencia basada en la correspondencia del contenido con la rúbrica (${(factorCalidad * 100).toFixed(0)}% de alineación estimada).`,
      fortalezas: fortalezas.length > 0 ? fortalezas : ['Respuesta registrada correctamente'],
      faltantes,
      retroalimentacion: esCorrecta
        ? 'Buena respuesta. Identificaste adecuadamente los aspectos solicitados.'
        : 'La respuesta contiene elementos relevantes pero requiere mayor desarrollo para alcanzar la puntuación máxima.',
      requiereRevisionHumana: true,
    };
  }

  async generateFeedback(params: AiAnalysisParams): Promise<string> {
    const analysis = await this.analyzeOpenResponse(params);
    return analysis.retroalimentacion;
  }

  async suggestScore(params: AiAnalysisParams): Promise<number> {
    const analysis = await this.analyzeOpenResponse(params);
    return analysis.puntajeSugerido;
  }
}
