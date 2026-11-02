'use client';

import { useState } from 'react';

export interface ConfiguracionEvaluacion {
  tiempoTotal: number | null;
  tiempoPorPregunta: number | null;
  permitirRetroceder: boolean;
  permitirModificar: boolean;
  permitirDejarEnBlanco: boolean;
  aleatorizarPreguntas: boolean;
  aleatorizarOpciones: boolean;
  detectarCambioPestana: boolean;
  detectarClickDerecho: boolean;
  detectarCopiar: boolean;
  detectarPegar: boolean;
  detectarRedimensionar: boolean;
}

export type EvaluacionConConfiguracion = Record<string, unknown> & {
  idEvaluacion: number;
};

export const CONFIGURACION_EVALUACION_PREDETERMINADA: ConfiguracionEvaluacion = {
  tiempoTotal: null,
  tiempoPorPregunta: null,
  permitirRetroceder: true,
  permitirModificar: true,
  permitirDejarEnBlanco: true,
  aleatorizarPreguntas: false,
  aleatorizarOpciones: false,
  detectarCambioPestana: false,
  detectarClickDerecho: false,
  detectarCopiar: false,
  detectarPegar: false,
  detectarRedimensionar: false,
};

export function obtenerConfiguracionEvaluacion(evaluacion: Record<string, unknown>): ConfiguracionEvaluacion {
  const numeroOConfiguracionNula = (valor: unknown) => {
    if (valor === null || valor === undefined || valor === '') return null;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
  };

  return {
    tiempoTotal: numeroOConfiguracionNula(evaluacion.tiempoTotal),
    tiempoPorPregunta: numeroOConfiguracionNula(evaluacion.tiempoPorPregunta),
    permitirRetroceder: typeof evaluacion.permitirRetroceder === 'boolean' ? evaluacion.permitirRetroceder : CONFIGURACION_EVALUACION_PREDETERMINADA.permitirRetroceder,
    permitirModificar: typeof evaluacion.permitirModificar === 'boolean' ? evaluacion.permitirModificar : CONFIGURACION_EVALUACION_PREDETERMINADA.permitirModificar,
    permitirDejarEnBlanco: typeof evaluacion.permitirDejarEnBlanco === 'boolean' ? evaluacion.permitirDejarEnBlanco : CONFIGURACION_EVALUACION_PREDETERMINADA.permitirDejarEnBlanco,
    aleatorizarPreguntas: typeof evaluacion.aleatorizarPreguntas === 'boolean' ? evaluacion.aleatorizarPreguntas : CONFIGURACION_EVALUACION_PREDETERMINADA.aleatorizarPreguntas,
    aleatorizarOpciones: typeof evaluacion.aleatorizarOpciones === 'boolean' ? evaluacion.aleatorizarOpciones : CONFIGURACION_EVALUACION_PREDETERMINADA.aleatorizarOpciones,
    detectarCambioPestana: typeof evaluacion.detectarCambioPestana === 'boolean' ? evaluacion.detectarCambioPestana : CONFIGURACION_EVALUACION_PREDETERMINADA.detectarCambioPestana,
    detectarClickDerecho: typeof evaluacion.detectarClickDerecho === 'boolean' ? evaluacion.detectarClickDerecho : CONFIGURACION_EVALUACION_PREDETERMINADA.detectarClickDerecho,
    detectarCopiar: typeof evaluacion.detectarCopiar === 'boolean' ? evaluacion.detectarCopiar : CONFIGURACION_EVALUACION_PREDETERMINADA.detectarCopiar,
    detectarPegar: typeof evaluacion.detectarPegar === 'boolean' ? evaluacion.detectarPegar : CONFIGURACION_EVALUACION_PREDETERMINADA.detectarPegar,
    detectarRedimensionar: typeof evaluacion.detectarRedimensionar === 'boolean' ? evaluacion.detectarRedimensionar : CONFIGURACION_EVALUACION_PREDETERMINADA.detectarRedimensionar,
  };
}

interface ConfiguracionEvaluacionModalProps {
  accion: 'publicar' | 'lanzar';
  configuracionInicial: ConfiguracionEvaluacion;
  guardando: boolean;
  error?: string;
  onCancelar: () => void;
  onConfirmar: (configuracion: ConfiguracionEvaluacion) => void;
}

export default function ConfiguracionEvaluacionModal({ accion, configuracionInicial, guardando, error, onCancelar, onConfirmar }: ConfiguracionEvaluacionModalProps) {
  const [configuracion, setConfiguracion] = useState(configuracionInicial);
  const titulo = accion === 'publicar' ? 'Configurar y publicar evaluación' : 'Configurar y lanzar sesión';

  const actualizar = <K extends keyof ConfiguracionEvaluacion>(campo: K, valor: ConfiguracionEvaluacion[K]) => setConfiguracion((actual) => ({ ...actual, [campo]: valor }));

  const opcionesBooleanas: {
    seccion: string;
    opciones: { campo: keyof ConfiguracionEvaluacion; etiqueta: string }[];
  }[] = [
    {
      seccion: 'Reglas de navegación',
      opciones: [
        {
          campo: 'permitirRetroceder',
          etiqueta: 'Permitir retroceder preguntas',
        },
        {
          campo: 'permitirModificar',
          etiqueta: 'Permitir modificar respuestas',
        },
        {
          campo: 'permitirDejarEnBlanco',
          etiqueta: 'Permitir dejar respuestas en blanco',
        },
        { campo: 'aleatorizarPreguntas', etiqueta: 'Aleatorizar preguntas' },
        { campo: 'aleatorizarOpciones', etiqueta: 'Aleatorizar opciones' },
      ],
    },
    {
      seccion: 'Monitoreo e integridad',
      opciones: [
        {
          campo: 'detectarCambioPestana',
          etiqueta: 'Detectar cambio de pestaña o pérdida de foco',
        },
        { campo: 'detectarClickDerecho', etiqueta: 'Detectar clic derecho' },
        { campo: 'detectarCopiar', etiqueta: 'Detectar copia de texto' },
        { campo: 'detectarPegar', etiqueta: 'Detectar pegado de texto' },
        {
          campo: 'detectarRedimensionar',
          etiqueta: 'Detectar cambio de tamaño de ventana',
        },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="configuracion-evaluacion-titulo"
        className="max-h-[90vh] w-full max-w-xl space-y-5 overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
      >
        <header>
          <h2 id="configuracion-evaluacion-titulo" className="text-xl font-bold text-slate-900">
            {titulo}
          </h2>
          <p className="mt-1 text-sm text-slate-500">Ajusta estas opciones antes de continuar. Se guardarán en la evaluación y se aplicarán a la sesión.</p>
        </header>

        <fieldset className="space-y-3 rounded-2xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-bold text-slate-800">Control de tiempo</legend>
          <label className="block text-xs font-semibold text-slate-700" htmlFor="tiempo-total-modal">
            Tiempo total (minutos)
          </label>
          <input
            id="tiempo-total-modal"
            type="number"
            min={1}
            max={1440}
            value={configuracion.tiempoTotal ?? ''}
            disabled={configuracion.tiempoPorPregunta !== null || guardando}
            onChange={(event) => actualizar('tiempoTotal', event.target.value ? Number(event.target.value) : null)}
            placeholder="Sin límite"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 disabled:bg-slate-100"
          />
          <label className="block text-xs font-semibold text-slate-700" htmlFor="tiempo-pregunta-modal">
            Tiempo por pregunta (segundos)
          </label>
          <input
            id="tiempo-pregunta-modal"
            type="number"
            min={5}
            max={86400}
            value={configuracion.tiempoPorPregunta ?? ''}
            disabled={configuracion.tiempoTotal !== null || guardando}
            onChange={(event) => actualizar('tiempoPorPregunta', event.target.value ? Number(event.target.value) : null)}
            placeholder="Sin límite"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 disabled:bg-slate-100"
          />
        </fieldset>

        {opcionesBooleanas.map(({ seccion, opciones }) => (
          <fieldset key={seccion} className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-bold text-slate-800">{seccion}</legend>
            {opciones.map(({ campo, etiqueta }) => (
              <label key={campo} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(configuracion[campo])}
                  disabled={guardando}
                  onChange={(event) => actualizar(campo, event.target.checked)}
                  className="accent-blue-600"
                />
                {etiqueta}
              </label>
            ))}
          </fieldset>
        ))}

        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <footer className="flex justify-end gap-3">
          <button
            type="button"
            disabled={guardando}
            onClick={onCancelar}
            className="rounded-full bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={() => onConfirmar(configuracion)}
            className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : accion === 'publicar' ? 'Guardar y publicar' : 'Guardar y lanzar'}
          </button>
        </footer>
      </section>
    </div>
  );
}
