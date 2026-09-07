import { Injectable } from '@nestjs/common';
import { TipoPregunta, ModoCalificacionEspacio } from '@prisma/client';

export interface EvaluacionResultadoPregunta {
  idPregunta: number;
  esCorrecta: boolean | null;
  puntaje: number;
  autoCalificada: boolean;
  comentarioIa?: string;
  puntajeSugeridoIa?: number;
}

@Injectable()
export class CalificacionService {
  /**
   * Auto-califica respuestas objetivas según su tipo y configuración.
   */
  calificarRespuestaObjetiva(
    tipo: TipoPregunta,
    puntajeMaximo: number,
    opcionesValidas: { idOpcion: number; esCorrecta: boolean }[],
    opcionesSeleccionadas: number[],
    espaciosValidos: { numeroEspacio: number; respuestasValidas: string[]; modoCalificacion: ModoCalificacionEspacio; ignorarMayusculas: boolean }[],
    espaciosRespuestas?: Record<string, string> | null,
  ): EvaluacionResultadoPregunta {
    if (tipo === TipoPregunta.ABIERTA) {
      return {
        idPregunta: 0,
        esCorrecta: null,
        puntaje: 0,
        autoCalificada: false,
      };
    }

    if (tipo === TipoPregunta.OPCION_MULTIPLE || tipo === TipoPregunta.VERDADERO_FALSO) {
      const opcionCorrecta = opcionesValidas.find((o) => o.esCorrecta);
      const seleccionada = opcionesSeleccionadas[0];
      const esCorrecta = Boolean(opcionCorrecta && seleccionada === opcionCorrecta.idOpcion);
      return {
        idPregunta: 0,
        esCorrecta,
        puntaje: esCorrecta ? puntajeMaximo : 0,
        autoCalificada: true,
      };
    }

    if (tipo === TipoPregunta.SELECCION_MULTIPLE) {
      const correctasIds = new Set(opcionesValidas.filter((o) => o.esCorrecta).map((o) => o.idOpcion));
      const seleccionadasSet = new Set(opcionesSeleccionadas);

      const sonIguales =
        correctasIds.size === seleccionadasSet.size &&
        [...correctasIds].every((id) => seleccionadasSet.has(id));

      return {
        idPregunta: 0,
        esCorrecta: sonIguales,
        puntaje: sonIguales ? puntajeMaximo : 0,
        autoCalificada: true,
      };
    }

    if (tipo === TipoPregunta.COMPLETAR) {
      if (!espaciosRespuestas || espaciosValidos.length === 0) {
        return { idPregunta: 0, esCorrecta: false, puntaje: 0, autoCalificada: true };
      }

      let aciertos = 0;
      for (const esp of espaciosValidos) {
        const respUsuario = (espaciosRespuestas[esp.numeroEspacio.toString()] || '').trim();
        let esAcierto = false;

        for (const valida of esp.respuestasValidas) {
          const v = esp.ignorarMayusculas ? valida.trim().toLowerCase() : valida.trim();
          const u = esp.ignorarMayusculas ? respUsuario.toLowerCase() : respUsuario;

          if (esp.modoCalificacion === ModoCalificacionEspacio.EXACTA && u === v) {
            esAcierto = true;
            break;
          } else if (esp.modoCalificacion === ModoCalificacionEspacio.CONTIENE && u.includes(v)) {
            esAcierto = true;
            break;
          }
        }
        if (esAcierto) aciertos++;
      }

      const esCorrecta = aciertos === espaciosValidos.length;
      const proporcion = aciertos / espaciosValidos.length;
      const puntajeObtenido = Math.round(puntajeMaximo * proporcion * 100) / 100;

      return {
        idPregunta: 0,
        esCorrecta,
        puntaje: puntajeObtenido,
        autoCalificada: true,
      };
    }

    return { idPregunta: 0, esCorrecta: false, puntaje: 0, autoCalificada: false };
  }

  async generarSugerenciaIA(
    enunciado: string,
    textoRespuesta: string,
    puntajeMaximo: number,
  ): Promise<{ puntajeSugeridoIa: number; comentarioIa: string }> {
    if (!textoRespuesta || textoRespuesta.trim().length === 0) {
      return {
        puntajeSugeridoIa: 0,
        comentarioIa: 'Respuesta vacía.',
      };
    }

    const palabras = textoRespuesta.trim().split(/\s+/).length;
    let notaSugerida = puntajeMaximo;
    let comentario = 'Respuesta completa y desarrollada.';

    if (palabras < 5) {
      notaSugerida = Math.round(puntajeMaximo * 0.4 * 10) / 10;
      comentario = 'Respuesta demasiado breve. Se requiere mayor fundamentación.';
    } else if (palabras < 15) {
      notaSugerida = Math.round(puntajeMaximo * 0.75 * 10) / 10;
      comentario = 'Respuesta concisa pero válida.';
    }

    return {
      puntajeSugeridoIa: notaSugerida,
      comentarioIa: comentario,
    };
  }
}
