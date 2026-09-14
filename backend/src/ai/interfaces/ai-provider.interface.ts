export interface AiAnalysisParams {
  enunciado: string;
  respuestaEstudiante: string;
  puntajeMaximo: number;
  rubrica?: string;
  respuestaEsperada?: string;
}

export interface AiAnalysisResult {
  puntajeSugerido: number;
  puntajeMaximo: number;
  nivelConfianza: number; // 0.0 a 1.0
  esCorrecta: boolean;
  justificacion: string;
  fortalezas: string[];
  faltantes: string[];
  retroalimentacion: string;
  requiereRevisionHumana: boolean;
}

export interface AiProvider {
  nombreProveedor: string;
  analyzeOpenResponse(params: AiAnalysisParams): Promise<AiAnalysisResult>;
  generateFeedback(params: AiAnalysisParams): Promise<string>;
  suggestScore(params: AiAnalysisParams): Promise<number>;
}
