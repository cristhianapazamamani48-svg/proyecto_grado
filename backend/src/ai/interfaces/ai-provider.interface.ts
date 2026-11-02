import { TipoPregunta } from '@prisma/client';

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

export interface GeneratedEvaluationQuestion {
  tipo: TipoPregunta;
  enunciado: string;
  puntaje: number;
  opciones: { texto: string; esCorrecta: boolean }[];
  espacios: {
    numeroEspacio: number;
    ignorarMayusculas: boolean;
    modoCalificacion: 'EXACTA' | 'CONTIENE';
    respuestasValidas: string[];
  }[];
}

export interface GeneratedEvaluation {
  nombre: string;
  descripcion: string;
  idioma: string;
  requiereConfirmacionIdioma: boolean;
  preguntas: GeneratedEvaluationQuestion[];
}

export interface GenerateEvaluationParams {
  contenido: string;
  tema?: string;
  tiposPregunta: TipoPregunta[];
  cantidadPreguntas: number;
  idiomaConfirmado?: string;
}

export interface AiProvider {
  nombreProveedor: string;
  analyzeOpenResponse(params: AiAnalysisParams): Promise<AiAnalysisResult>;
  generateFeedback(params: AiAnalysisParams): Promise<string>;
  suggestScore(params: AiAnalysisParams): Promise<number>;
  generateEvaluation?(
    params: GenerateEvaluationParams,
  ): Promise<GeneratedEvaluation>;
}
