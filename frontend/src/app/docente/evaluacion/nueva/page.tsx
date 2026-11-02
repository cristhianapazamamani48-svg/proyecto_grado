'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface OpcionForm {
  texto: string;
  esCorrecta: boolean;
}

interface EspacioForm {
  numeroEspacio: number;
  ignorarMayusculas: boolean;
  modoCalificacion: 'EXACTA' | 'CONTIENE';
  respuestasValidas: string[];
}

interface PreguntaForm {
  tipo: 'OPCION_MULTIPLE' | 'SELECCION_MULTIPLE' | 'VERDADERO_FALSO' | 'COMPLETAR' | 'ABIERTA';
  enunciado: string;
  imagen?: string;
  puntaje: number;
  opciones: OpcionForm[];
  espacios: EspacioForm[];
}

type ModoCreacion = 'MANUAL' | 'PDF' | 'TEMA';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const TIPOS_PREGUNTA_GENERACION: { tipo: PreguntaForm['tipo']; etiqueta: string }[] = [
  { tipo: 'OPCION_MULTIPLE', etiqueta: 'Opción múltiple' },
  { tipo: 'SELECCION_MULTIPLE', etiqueta: 'Selección múltiple' },
  { tipo: 'VERDADERO_FALSO', etiqueta: 'Verdadero / falso' },
  { tipo: 'COMPLETAR', etiqueta: 'Completar espacios' },
  { tipo: 'ABIERTA', etiqueta: 'Respuesta abierta' },
];

export default function NuevaEvaluacionPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState('Nueva Evaluación Académica');
  const [descripcion, setDescripcion] = useState('');
  const [modoCreacion, setModoCreacion] = useState<ModoCreacion | null>(null);
  const [archivoPdf, setArchivoPdf] = useState<File | null>(null);
  const [temaGeneracion, setTemaGeneracion] = useState('');
  const [tiposPreguntaGeneracion, setTiposPreguntaGeneracion] = useState<PreguntaForm['tipo'][]>([]);
  const [cantidadPreguntasGeneracion, setCantidadPreguntasGeneracion] = useState(10);
  const [estadoGeneracion, setEstadoGeneracion] = useState<{ disponible: boolean; mensaje: string } | null>(null);
  const [generando, setGenerando] = useState(false);
  const [idiomaPendiente, setIdiomaPendiente] = useState<string | null>(null);
  const [idiomaConfirmado, setIdiomaConfirmado] = useState('');
  
  const mostrarResultados = true;
  const mostrarRespuestas = false;
  const permitirRevision = false;

  const [preguntas, setPreguntas] = useState<PreguntaForm[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const [acordeonAbierto, setAcordeonAbierto] = useState<Record<string, boolean>>({
    elementos: true,
  });

  useEffect(() => {
    const modoSolicitado = new URLSearchParams(window.location.search).get('modo');
    if (modoSolicitado === 'MANUAL' || modoSolicitado === 'PDF' || modoSolicitado === 'TEMA') {
      queueMicrotask(() => setModoCreacion(modoSolicitado));
    }

    const token = localStorage.getItem('uub_docente_token');
    if (!token) {
      router.push('/docente/login');
      return;
    }

    const controller = new AbortController();
    const consultarDisponibilidad = async () => {
      try {
        const response = await fetch(`${API}/evaluaciones/generacion/estado`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'No se pudo consultar la disponibilidad de Claude.');
        setEstadoGeneracion(data);
      } catch (err) {
        if (!controller.signal.aborted) {
          setEstadoGeneracion({
            disponible: false,
            mensaje: err instanceof Error ? err.message : 'No se pudo consultar la disponibilidad de Claude.',
          });
        }
      }
    };

    void consultarDisponibilidad();
    return () => controller.abort();
  }, [router]);

  const toggleTipoPreguntaGeneracion = (tipo: PreguntaForm['tipo']) => {
    setTiposPreguntaGeneracion((actuales) =>
      actuales.includes(tipo) ? actuales.filter((item) => item !== tipo) : [...actuales, tipo],
    );
  };

  const toggleAcordeon = (key: string) => {
    setAcordeonAbierto((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const agregarPregunta = (tipo: PreguntaForm['tipo']) => {
    const nueva: PreguntaForm = {
      tipo,
      enunciado: tipo === 'COMPLETAR' ? 'La capital de Francia es [_1_] y la de Italia es [_2_].' : '',
      puntaje: 1.0,
      opciones:
        tipo === 'OPCION_MULTIPLE' || tipo === 'SELECCION_MULTIPLE'
          ? [
              { texto: 'Opción 1', esCorrecta: true },
              { texto: 'Opción 2', esCorrecta: false },
            ]
          : tipo === 'VERDADERO_FALSO'
          ? [
              { texto: 'Verdadero', esCorrecta: true },
              { texto: 'Falso', esCorrecta: false },
            ]
          : [],
      espacios:
        tipo === 'COMPLETAR'
          ? [
              { numeroEspacio: 1, ignorarMayusculas: true, modoCalificacion: 'EXACTA', respuestasValidas: ['París', 'Paris'] },
              { numeroEspacio: 2, ignorarMayusculas: true, modoCalificacion: 'EXACTA', respuestasValidas: ['Roma'] },
            ]
          : [],
    };
    setPreguntas([...preguntas, nueva]);
  };

  const eliminarPregunta = (index: number) => {
    setPreguntas(preguntas.filter((_, i) => i !== index));
  };

  const handlePreguntaChange = <K extends keyof PreguntaForm>(
    index: number,
    field: K,
    value: PreguntaForm[K],
  ) => {
    setPreguntas((actuales) =>
      actuales.map((pregunta, preguntaIndex) =>
        preguntaIndex === index ? { ...pregunta, [field]: value } : pregunta,
      ),
    );
  };

  const handleOpcionChange = <K extends keyof OpcionForm>(
    pIndex: number,
    oIndex: number,
    field: K,
    value: OpcionForm[K],
  ) => {
    setPreguntas((actuales) =>
      actuales.map((pregunta, preguntaIndex) => {
        if (preguntaIndex !== pIndex) return pregunta;
        const esRespuestaUnica =
          pregunta.tipo === 'OPCION_MULTIPLE' || pregunta.tipo === 'VERDADERO_FALSO';
        const opciones = pregunta.opciones.map((opcion, opcionIndex) => {
          if (field === 'esCorrecta' && esRespuestaUnica) {
            return { ...opcion, esCorrecta: opcionIndex === oIndex };
          }
          return opcionIndex === oIndex ? { ...opcion, [field]: value } : opcion;
        });
        return { ...pregunta, opciones };
      }),
    );
  };

  const agregarOpcion = (pIndex: number) => {
    const copia = [...preguntas];
    copia[pIndex].opciones.push({ texto: `Opción ${copia[pIndex].opciones.length + 1}`, esCorrecta: false });
    setPreguntas(copia);
  };

  const eliminarOpcion = (pIndex: number, oIndex: number) => {
    const copia = [...preguntas];
    copia[pIndex].opciones = copia[pIndex].opciones.filter((_, i) => i !== oIndex);
    setPreguntas(copia);
  };

  // Funciones especializadas para COMPLETAR ESPACIOS
  const insertarEspacioEnTexto = (pIndex: number) => {
    const textarea = textareaRefs.current[pIndex];
    const preg = preguntas[pIndex];
    const espaciosActuales = preg.espacios || [];
    const maxNum = espaciosActuales.reduce((max, e) => Math.max(max, e.numeroEspacio), 0);
    const nuevoNum = maxNum + 1;
    const token = `[_${nuevoNum}_]`;

    let nuevoEnunciado = preg.enunciado;
    let textoSeleccionado = '';

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textoSeleccionado = preg.enunciado.substring(start, end).trim();
      nuevoEnunciado = preg.enunciado.substring(0, start) + token + preg.enunciado.substring(end);
    } else {
      nuevoEnunciado = preg.enunciado ? `${preg.enunciado} ${token}` : token;
    }

    const nuevoEspacio: EspacioForm = {
      numeroEspacio: nuevoNum,
      ignorarMayusculas: true,
      modoCalificacion: 'EXACTA',
      respuestasValidas: textoSeleccionado ? [textoSeleccionado] : ['Respuesta'],
    };

    const copia = [...preguntas];
    copia[pIndex].enunciado = nuevoEnunciado;
    copia[pIndex].espacios = [...espaciosActuales, nuevoEspacio];
    setPreguntas(copia);
  };

  const eliminarEspacio = (pIndex: number, eIndex: number) => {
    const copia = [...preguntas];
    const espacioEliminado = copia[pIndex].espacios[eIndex];
    copia[pIndex].espacios = copia[pIndex].espacios.filter((_, i) => i !== eIndex);
    // Remover token del enunciado si existe
    const tokenRegex = new RegExp(`\\[_${espacioEliminado.numeroEspacio}_\\]`, 'g');
    copia[pIndex].enunciado = copia[pIndex].enunciado.replace(tokenRegex, '');
    setPreguntas(copia);
  };

  const handleEspacioPropChange = <K extends keyof EspacioForm>(
    pIndex: number,
    eIndex: number,
    field: K,
    value: EspacioForm[K],
  ) => {
    setPreguntas((actuales) =>
      actuales.map((pregunta, preguntaIndex) => {
        if (preguntaIndex !== pIndex) return pregunta;
        const espacios = pregunta.espacios.map((espacio, espacioIndex) =>
          espacioIndex === eIndex ? { ...espacio, [field]: value } : espacio,
        );
        return { ...pregunta, espacios };
      }),
    );
  };

  const generarEvaluacion = async (idioma?: string) => {
    setError('');
    if (!estadoGeneracion?.disponible) {
      setError(estadoGeneracion?.mensaje || 'La generación con Claude no está configurada.');
      return;
    }
    if (!tiposPreguntaGeneracion.length) {
      setError('Selecciona al menos un tipo de pregunta.');
      return;
    }
    if (!Number.isInteger(cantidadPreguntasGeneracion) || cantidadPreguntasGeneracion < 1 || cantidadPreguntasGeneracion > 30) {
      setError('La cantidad debe estar entre 1 y 30 preguntas.');
      return;
    }
    if (modoCreacion === 'PDF' && !archivoPdf) {
      setError('Selecciona un archivo PDF antes de generar la evaluación.');
      return;
    }
    if (idiomaPendiente && !idioma?.trim()) {
      setError('Confirma el idioma detectado o indica el idioma correcto.');
      return;
    }

    const token = localStorage.getItem('uub_docente_token');
    if (!token) {
      router.push('/docente/login');
      return;
    }

    setGenerando(true);
    try {
      const esPdf = modoCreacion === 'PDF';
      const endpoint = esPdf ? 'pdf' : 'tema';
      let body: BodyInit;
      const encabezados: HeadersInit = { Authorization: `Bearer ${token}` };
      const datosGeneracion = {
        tiposPregunta: tiposPreguntaGeneracion,
        cantidadPreguntas: cantidadPreguntasGeneracion,
        idiomaConfirmado: idioma?.trim() || undefined,
      };

      if (esPdf) {
        const formData = new FormData();
        formData.append('archivo', archivoPdf!);
        formData.append('tiposPregunta', JSON.stringify(datosGeneracion.tiposPregunta));
        formData.append('cantidadPreguntas', String(datosGeneracion.cantidadPreguntas));
        if (datosGeneracion.idiomaConfirmado) formData.append('idiomaConfirmado', datosGeneracion.idiomaConfirmado);
        body = formData;
      } else {
        if (temaGeneracion.trim().length < 3) {
          setError('Escribe un tema de al menos 3 caracteres.');
          return;
        }
        encabezados['Content-Type'] = 'application/json';
        body = JSON.stringify({ ...datosGeneracion, tema: temaGeneracion.trim() });
      }

      const response = await fetch(`${API}/evaluaciones/generacion/${endpoint}`, {
        method: 'POST',
        headers: encabezados,
        body,
      });
      const data = await response.json();
      if (!response.ok) {
        const message = Array.isArray(data.message) ? data.message.join(' ') : data.message;
        throw new Error(message || 'No se pudo generar la evaluación.');
      }

      if (data.requiereConfirmacionIdioma && !idioma) {
        setIdiomaPendiente(data.idioma || 'el idioma detectado');
        setIdiomaConfirmado(data.idioma || '');
        return;
      }

      setNombre(data.nombre);
      setDescripcion(data.descripcion || '');
      setPreguntas(
        data.preguntas.map((pregunta: PreguntaForm) => ({
          tipo: pregunta.tipo,
          enunciado: pregunta.enunciado,
          puntaje: pregunta.puntaje,
          opciones: pregunta.opciones || [],
          espacios: pregunta.espacios || [],
        })),
      );
      setIdiomaPendiente(null);
      setModoCreacion('MANUAL');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar la evaluación.');
    } finally {
      setGenerando(false);
    }
  };

  const guardarEvaluacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (modoCreacion !== 'MANUAL') {
      setError('Selecciona "Crear manualmente" o genera primero una evaluación.');
      return;
    }

    if (!nombre.trim()) {
      setError('El nombre de la evaluación es requerido.');
      return;
    }

    const token = localStorage.getItem('uub_docente_token');
    if (!token) return;

    setCargando(true);
    try {
      const dto = {
        nombre,
        descripcion,
        mostrarResultados,
        mostrarRespuestas,
        permitirRevision,
        preguntas: preguntas.map((p, idx) => ({
          tipo: p.tipo,
          enunciado: p.enunciado,
          imagen: p.imagen,
          puntaje: Number(p.puntaje),
          orden: idx + 1,
          opciones: p.opciones,
          espacios: p.espacios,
        })),
      };

      const res = await fetch(`${API}/evaluaciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dto),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al guardar la evaluación.');

      router.push('/docente/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error al guardar.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fafafc] dark:bg-[#0d0b14] text-slate-800 dark:text-slate-100 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="bg-white dark:bg-[#171424] border-b border-slate-200 dark:border-slate-800 px-8 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <div className="flex items-center space-x-4">
          <Link href="/docente/dashboard" className="text-slate-400 hover:text-slate-700 text-sm font-medium transition-colors">
            ← Volver al Dashboard
          </Link>
          <span className="text-slate-200">|</span>
          <h1 className="text-lg font-bold text-slate-900">Diseñador de Evaluaciones</h1>
        </div>

        {modoCreacion === 'MANUAL' && (
          <button
            onClick={guardarEvaluacion}
            disabled={cargando}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-full shadow-lg shadow-purple-500/25 transition-colors disabled:opacity-50"
          >
            {cargando ? 'Guardando...' : 'Guardar Evaluación'}
          </button>
        )}
      </header>

      <section className="max-w-7xl w-full mx-auto px-8 pt-6" aria-labelledby="modo-creacion-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="modo-creacion-heading" className="text-base font-bold text-slate-900">
              ¿Cómo quieres crear tu evaluación?
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Puedes diseñarla manualmente o preparar una evaluación desde un documento o un tema.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              estadoGeneracion?.disponible
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-amber-50 text-amber-800'
            }`}
          >
            {estadoGeneracion === null
              ? 'Comprobando Claude...'
              : estadoGeneracion.disponible
                ? 'Claude listo'
                : 'Claude pendiente de configuración'}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-3" role="group" aria-label="Modo de creación">
          {([
            ['MANUAL', '✍️', 'Crear manualmente'],
            ['PDF', '📄', 'Usar un PDF'],
            ['TEMA', '💡', 'Generar por tema'],
          ] as const).map(([modo, icono, etiqueta]) => (
            <button
              key={modo}
              type="button"
              aria-pressed={modoCreacion === modo}
              onClick={() => setModoCreacion(modo)}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                modoCreacion === modo
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 ring-2 ring-blue-100 dark:ring-blue-900 text-purple-900 dark:text-blue-100'
                  : 'border-slate-200 bg-white hover:border-purple-300 dark:hover:border-purple-700'
              }`}
            >
              <span className="text-lg" aria-hidden="true">{icono}</span>
              <span className="ml-2 text-sm font-bold text-slate-800">{etiqueta}</span>
            </button>
          ))}
        </div>

        {modoCreacion === 'PDF' && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-bold text-slate-900">Preparar evaluación desde PDF</h3>
            <p className="mt-1 text-xs text-slate-600">
              Se extraerá el texto del PDF y se enviará a Claude para proponer preguntas. El archivo no se conserva
              en el servidor; revisa el borrador antes de guardar.
            </p>
            <label className="mt-4 block text-xs font-semibold text-slate-700" htmlFor="archivo-evaluacion-pdf">
              Seleccionar documento PDF
            </label>
            <input
              id="archivo-evaluacion-pdf"
              type="file"
              accept=".pdf,application/pdf"
              disabled={generando}
              onChange={(event) => setArchivoPdf(event.target.files?.[0] ?? null)}
              className="mt-2 block w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold"
            />
            {archivoPdf && <p className="mt-2 text-xs text-slate-600">Documento seleccionado: {archivoPdf.name}</p>}
            <p className="mt-2 text-xs text-slate-500">Límite: 10 MB. Los PDF escaneados sin texto seleccionable no son compatibles.</p>
          </div>
        )}

        {modoCreacion === 'TEMA' && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-bold text-slate-900">Preparar evaluación por tema</h3>
            <p className="mt-1 text-xs text-slate-600">
              Indica un tema. Claude preparará un borrador editable que podrás revisar antes de guardarlo.
            </p>
            <label className="mt-4 block text-xs font-semibold text-slate-700" htmlFor="tema-evaluacion">
              Tema de la evaluación
            </label>
            <textarea
              id="tema-evaluacion"
              value={temaGeneracion}
              onChange={(event) => setTemaGeneracion(event.target.value)}
              rows={2}
              placeholder="Ej.: La fotosíntesis y sus etapas"
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-purple-500 focus:outline-none"
            />
          </div>
        )}

        {modoCreacion !== 'MANUAL' && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold text-slate-700">Tipos de pregunta</p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {TIPOS_PREGUNTA_GENERACION.map(({ tipo, etiqueta }) => (
                <label key={tipo} className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={tiposPreguntaGeneracion.includes(tipo)}
                    disabled={generando}
                    onChange={() => toggleTipoPreguntaGeneracion(tipo)}
                    className="accent-purple-600"
                  />
                  {etiqueta}
                </label>
              ))}
            </div>
            <label className="mt-4 block text-xs font-semibold text-slate-700" htmlFor="cantidad-preguntas-generacion">
              Cantidad de preguntas
            </label>
            <input
              id="cantidad-preguntas-generacion"
              type="number"
              min={1}
              max={30}
              value={cantidadPreguntasGeneracion}
              disabled={generando}
              onChange={(event) => setCantidadPreguntasGeneracion(Number(event.target.value))}
              className="mt-2 w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-purple-500 focus:outline-none"
            />
            <p className="mt-3 text-xs text-slate-500">
              Se conservará el idioma del material. El tema o texto extraído del PDF se enviará a Claude para generar las preguntas.
            </p>
            {idiomaPendiente !== null && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <label htmlFor="idioma-confirmado" className="block text-xs font-semibold text-amber-900">
                  Claude no identificó con seguridad el idioma ({idiomaPendiente}). Confirma o indica el idioma correcto:
                </label>
                <input
                  id="idioma-confirmado"
                  value={idiomaConfirmado}
                  onChange={(event) => setIdiomaConfirmado(event.target.value)}
                  disabled={generando}
                  maxLength={80}
                  placeholder="Ej.: español"
                  className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-800"
                />
              </div>
            )}
            <p className="mt-3 text-xs text-slate-500">
              {estadoGeneracion?.mensaje || 'Consultando la configuración del proveedor de IA...'}
            </p>
            <button
              type="button"
              disabled={!estadoGeneracion?.disponible || generando}
              onClick={() => void generarEvaluacion(idiomaPendiente !== null ? idiomaConfirmado : undefined)}
              className="mt-4 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 shadow-md shadow-purple-500/20"
            >
              {generando
                ? 'Generando...'
                : idiomaPendiente !== null
                  ? 'Confirmar idioma y generar'
                  : modoCreacion === 'PDF'
                    ? 'Generar preguntas desde el PDF'
                    : 'Generar evaluación por tema'}
            </button>
          </div>
        )}
      </section>

      {modoCreacion === 'MANUAL' && (
      <>
      {/* Main 2-Column Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMNA IZQUIERDA: Añadir Elementos y Ajustes */}
        <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-[65px] lg:self-start lg:max-h-[calc(100vh-81px)] lg:overflow-y-auto">
          <h2 className="text-base font-bold text-slate-900 mb-2">Configuración y Elementos</h2>

          {/* Acordeón 1: Tipos de Pregunta */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAcordeon('elementos')}
              className="w-full px-5 py-3.5 bg-[#fafafc] hover:bg-slate-100 font-bold text-slate-800 text-left flex items-center justify-between text-sm border-b border-slate-200 transition-colors"
            >
              <span>+ Añadir Preguntas</span>
              <span className="text-xs text-slate-400">{acordeonAbierto.elementos ? '▲' : '▼'}</span>
            </button>
            {acordeonAbierto.elementos && (
              <div className="p-4 space-y-2 bg-white">
                <p className="text-xs text-slate-500 mb-3">Haz clic para agregar una pregunta a la evaluación:</p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => agregarPregunta('OPCION_MULTIPLE')}
                    className="w-full text-left px-3.5 py-2.5 bg-[#fafafc] dark:bg-slate-800/60 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-purple-700 dark:hover:text-purple-300 transition-all flex items-center justify-between"
                  >
                    <span>🔘 Opción Múltiple</span>
                    <span className="text-slate-400 font-normal text-[11px]">Única respuesta</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => agregarPregunta('SELECCION_MULTIPLE')}
                    className="w-full text-left px-3.5 py-2.5 bg-[#fafafc] dark:bg-slate-800/60 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-purple-700 dark:hover:text-purple-300 transition-all flex items-center justify-between"
                  >
                    <span>☑️ Selección Múltiple</span>
                    <span className="text-slate-400 font-normal text-[11px]">Varias respuestas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => agregarPregunta('VERDADERO_FALSO')}
                    className="w-full text-left px-3.5 py-2.5 bg-[#fafafc] dark:bg-slate-800/60 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-purple-700 dark:hover:text-purple-300 transition-all flex items-center justify-between"
                  >
                    <span>⚖️ Verdadero / Falso</span>
                    <span className="text-slate-400 font-normal text-[11px]">Booleana</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => agregarPregunta('COMPLETAR')}
                    className="w-full text-left px-3.5 py-2.5 bg-[#fafafc] dark:bg-slate-800/60 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-purple-700 dark:hover:text-purple-300 transition-all flex items-center justify-between"
                  >
                    <span>✏️ Completar Espacios</span>
                    <span className="text-purple-600 dark:text-purple-400 font-semibold text-[11px]">Frase con tokens</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => agregarPregunta('ABIERTA')}
                    className="w-full text-left px-3.5 py-2.5 bg-[#fafafc] dark:bg-slate-800/60 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-purple-700 dark:hover:text-purple-300 transition-all flex items-center justify-between"
                  >
                    <span>📝 Respuesta Abierta</span>
                    <span className="text-slate-400 font-normal text-[11px]">Desarrollo</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </aside>

        {/* COLUMNA DERECHA: Estructura de la Evaluación */}
        <section className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Estructura del Examen</h2>
            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
              {preguntas.length} {preguntas.length === 1 ? 'pregunta' : 'preguntas'} · Total: {preguntas.reduce((acc, p) => acc + Number(p.puntaje || 0), 0)} pts
            </span>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl">
              {error}
            </div>
          )}

          {/* Formulario Principal de Evaluación */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Nombre de la Evaluación</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Examen Parcial de Historia"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 font-bold text-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Descripción o Instrucciones Generales</label>
              <textarea
                rows={2}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Instrucciones para el estudiante..."
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Lienzo de Preguntas */}
          <div className="space-y-5">
            {preguntas.length === 0 ? (
              <div className="py-20 border-2 border-dashed border-slate-200 rounded-3xl text-center text-slate-400 space-y-3 bg-white">
                <div className="text-4xl">📄</div>
                <p className="font-bold text-slate-700 text-base">La evaluación está vacía</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Selecciona uno de los tipos de pregunta en el panel izquierdo para comenzar a armar el examen.
                </p>
              </div>
            ) : (
              preguntas.map((p, pIdx) => (
                <div key={pIdx} className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 space-y-5 transition-all hover:border-slate-300">
                  {/* Pregunta Item Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center">
                        {pIdx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        {p.tipo.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1 text-xs">
                        <span className="text-slate-400 font-medium">Puntos:</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={p.puntaje}
                          onChange={(e) => handlePreguntaChange(pIdx, 'puntaje', Number(e.target.value))}
                          className="w-16 px-2.5 py-1 border border-slate-200 rounded-lg text-center text-xs text-slate-800 font-bold focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => eliminarPregunta(pIdx)}
                        className="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {/* Enunciado */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-600 uppercase">
                        {p.tipo === 'COMPLETAR' ? 'Frase o Párrafo con espacios' : 'Enunciado de la pregunta'}
                      </label>
                      {p.tipo === 'COMPLETAR' && (
                        <button
                          type="button"
                          onClick={() => insertarEspacioEnTexto(pIdx)}
                          className="px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:text-purple-200 text-xs font-bold rounded-lg transition-colors border border-purple-200 dark:border-purple-800 dark:bg-purple-950/30"
                          title="Selecciona una palabra en el texto y haz clic aquí para convertirla en un espacio para completar"
                        >
                          + Marcar texto seleccionado como espacio
                        </button>
                      )}
                    </div>

                    <textarea
                      ref={(el) => { textareaRefs.current[pIdx] = el; }}
                      rows={p.tipo === 'COMPLETAR' ? 3 : 2}
                      required
                      value={p.enunciado}
                      onChange={(e) => handlePreguntaChange(pIdx, 'enunciado', e.target.value)}
                      placeholder={
                        p.tipo === 'COMPLETAR'
                          ? 'Ej: La capital de Francia es [_1_] y la de Italia es [_2_].'
                          : 'Redacta la pregunta aquí...'
                      }
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:outline-none transition-all font-normal"
                    />

                    {p.tipo === 'COMPLETAR' && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        💡 Tip: Escribe tu frase completa, selecciona con el ratón la palabra que debe adivinar el estudiante y pulsa <strong>&quot;Marcar texto seleccionado como espacio&quot;</strong>.
                      </p>
                    )}
                  </div>

                  {/* Alternativas para Opción Múltiple / VF */}
                  {(p.tipo === 'OPCION_MULTIPLE' || p.tipo === 'SELECCION_MULTIPLE' || p.tipo === 'VERDADERO_FALSO') && (
                    <div className="space-y-2.5 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-600 uppercase">Opciones de respuesta</span>
                        {p.tipo !== 'VERDADERO_FALSO' && (
                          <button
                            type="button"
                            onClick={() => agregarOpcion(pIdx)}
                            className="text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline"
                          >
                            + Añadir opción
                          </button>
                        )}
                      </div>
                      {p.opciones.map((opc, oIdx) => (
                        <div key={oIdx} className="flex items-center space-x-3">
                          <input
                            type={p.tipo === 'SELECCION_MULTIPLE' ? 'checkbox' : 'radio'}
                            name={`correcta_${pIdx}`}
                            checked={opc.esCorrecta}
                            onChange={(e) => handleOpcionChange(pIdx, oIdx, 'esCorrecta', e.target.checked)}
                            className="w-4 h-4 text-purple-600 dark:text-purple-400 accent-purple-600 rounded"
                          />
                          <input
                            type="text"
                            required
                            value={opc.texto}
                            onChange={(e) => handleOpcionChange(pIdx, oIdx, 'texto', e.target.value)}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-500"
                            placeholder={`Opción ${oIdx + 1}`}
                          />
                          {p.tipo !== 'VERDADERO_FALSO' && p.opciones.length > 2 && (
                            <button
                              type="button"
                              onClick={() => eliminarOpcion(pIdx, oIdx)}
                              className="text-slate-300 hover:text-red-500 text-sm font-bold"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Configuración de Espacios para COMPLETAR */}
                  {p.tipo === 'COMPLETAR' && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                          Configuración de Respuestas Válidas
                        </span>
                        <button
                          type="button"
                          onClick={() => insertarEspacioEnTexto(pIdx)}
                          className="text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline"
                        >
                          + Añadir espacio [_N_]
                        </button>
                      </div>

                      {p.espacios.length === 0 ? (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 text-center">
                          Aún no has definido ningún espacio. Selecciona una palabra del enunciado o haz clic en &quot;+ Añadir espacio&quot;.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {p.espacios.map((esp, eIdx) => (
                            <div key={eIdx} className="p-4 bg-[#fafafc] border border-slate-200 rounded-2xl space-y-3 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-purple-600 dark:text-purple-400 text-xs uppercase tracking-wide">
                                  Espacio [_{esp.numeroEspacio}_]
                                </span>
                                <button
                                  type="button"
                                  onClick={() => eliminarEspacio(pIdx, eIdx)}
                                  className="text-red-500 hover:text-red-700 font-semibold"
                                >
                                  Eliminar espacio
                                </button>
                              </div>

                              <div>
                                <label className="block font-semibold text-slate-700 mb-1">
                                  Respuestas correctas aceptadas (separadas por coma):
                                </label>
                                <input
                                  type="text"
                                  placeholder="Ej: París, Paris, la ciudad de parís"
                                  value={esp.respuestasValidas.join(', ')}
                                  onChange={(e) => {
                                    const array = e.target.value.split(',').map((s) => s.trim());
                                    handleEspacioPropChange(pIdx, eIdx, 'respuestasValidas', array);
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-purple-500"
                                />
                              </div>

                              <div className="flex flex-wrap items-center gap-4 text-slate-600 pt-1">
                                <label className="flex items-center space-x-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={esp.ignorarMayusculas}
                                    onChange={(e) => handleEspacioPropChange(pIdx, eIdx, 'ignorarMayusculas', e.target.checked)}
                                    className="rounded text-purple-600 dark:text-purple-400 accent-purple-600"
                                  />
                                  <span>Ignorar mayúsculas y minúsculas</span>
                                </label>

                                <div className="flex items-center space-x-2">
                                  <span>Modo de calificación:</span>
                                  <select
                                    value={esp.modoCalificacion}
                                    onChange={(e) => {
                                      if (e.target.value === 'EXACTA' || e.target.value === 'CONTIENE') {
                                        handleEspacioPropChange(pIdx, eIdx, 'modoCalificacion', e.target.value);
                                      }
                                    }}
                                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 font-medium"
                                  >
                                    <option value="EXACTA">Coincidencia Exacta</option>
                                    <option value="CONTIENE">Contiene la respuesta</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
      </>
      )}
    </main>
  );
}
