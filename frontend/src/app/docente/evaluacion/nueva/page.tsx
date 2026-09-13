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

export default function NuevaEvaluacionPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState('Nueva Evaluación Académica');
  const [descripcion, setDescripcion] = useState('');
  
  // Configuraciones de Evaluación
  const [tiempoTotal, setTiempoTotal] = useState<number | ''>('');
  const [tiempoPorPregunta, setTiempoPorPregunta] = useState<number | ''>('');
  const [permitirRetroceder, setPermitirRetroceder] = useState(true);
  const [permitirModificar, setPermitirModificar] = useState(true);
  const [permitirDejarEnBlanco, setPermitirDejarEnBlanco] = useState(true);
  
  const [mostrarResultados, setMostrarResultados] = useState(true);
  const [mostrarRespuestas, setMostrarRespuestas] = useState(false);
  const [permitirRevision, setPermitirRevision] = useState(false);

  const [aleatorizarPreguntas, setAleatorizarPreguntas] = useState(false);
  const [aleatorizarOpciones, setAleatorizarOpciones] = useState(false);

  // Monitoreo
  const [detectarCambioPestana, setDetectarCambioPestana] = useState(false);
  const [detectarClickDerecho, setDetectarClickDerecho] = useState(false);
  const [detectarCopiar, setDetectarCopiar] = useState(false);
  const [detectarPegar, setDetectarPegar] = useState(false);
  const [detectarRedimensionar, setDetectarRedimensionar] = useState(false);

  // Acordeones abiertos/cerrados en la columna izquierda
  const [acordeonAbierto, setAcordeonAbierto] = useState<Record<string, boolean>>({
    elementos: true,
    tiempo: false,
    navegacion: false,
    monitoreo: false,
  });

  const [preguntas, setPreguntas] = useState<PreguntaForm[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    const token = localStorage.getItem('uub_docente_token');
    if (!token) router.push('/docente/login');
  }, [router]);

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

  const handlePreguntaChange = (index: number, field: string, value: any) => {
    const copia = [...preguntas];
    (copia[index] as any)[field] = value;
    setPreguntas(copia);
  };

  const handleOpcionChange = (pIndex: number, oIndex: number, field: string, value: any) => {
    const copia = [...preguntas];
    const opcs = [...copia[pIndex].opciones];

    if (field === 'esCorrecta' && (copia[pIndex].tipo === 'OPCION_MULTIPLE' || copia[pIndex].tipo === 'VERDADERO_FALSO')) {
      opcs.forEach((o, i) => (o.esCorrecta = i === oIndex));
    } else {
      (opcs[oIndex] as any)[field] = value;
    }

    copia[pIndex].opciones = opcs;
    setPreguntas(copia);
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

  const handleEspacioPropChange = (pIndex: number, eIndex: number, field: keyof EspacioForm, value: any) => {
    const copia = [...preguntas];
    (copia[pIndex].espacios[eIndex] as any)[field] = value;
    setPreguntas(copia);
  };

  const guardarEvaluacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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
        tiempoTotal: tiempoTotal !== '' ? Number(tiempoTotal) : undefined,
        tiempoPorPregunta: tiempoPorPregunta !== '' ? Number(tiempoPorPregunta) : undefined,
        permitirRetroceder,
        permitirModificar,
        permitirDejarEnBlanco,
        mostrarResultados,
        mostrarRespuestas,
        permitirRevision,
        aleatorizarPreguntas,
        aleatorizarOpciones,
        detectarCambioPestana,
        detectarClickDerecho,
        detectarCopiar,
        detectarPegar,
        detectarRedimensionar,
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

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/evaluaciones`, {
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
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al guardar.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <div className="flex items-center space-x-4">
          <Link href="/docente/dashboard" className="text-slate-400 hover:text-slate-700 text-sm font-medium transition-colors">
            ← Volver al Dashboard
          </Link>
          <span className="text-slate-200">|</span>
          <h1 className="text-lg font-bold text-slate-900">Diseñador de Evaluaciones</h1>
        </div>

        <button
          onClick={guardarEvaluacion}
          disabled={cargando}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-full shadow-lg shadow-blue-500/25 transition-colors disabled:opacity-50"
        >
          {cargando ? 'Guardando...' : 'Guardar Evaluación'}
        </button>
      </header>

      {/* Main 2-Column Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMNA IZQUIERDA: Añadir Elementos y Ajustes */}
        <aside className="lg:col-span-4 space-y-4">
          <h2 className="text-base font-bold text-slate-900 mb-2">Configuración y Elementos</h2>

          {/* Acordeón 1: Tipos de Pregunta */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAcordeon('elementos')}
              className="w-full px-5 py-3.5 bg-slate-50 hover:bg-slate-100 font-bold text-slate-800 text-left flex items-center justify-between text-sm border-b border-slate-200 transition-colors"
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
                    className="w-full text-left px-3.5 py-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-slate-700 hover:text-blue-700 transition-all flex items-center justify-between"
                  >
                    <span>🔘 Opción Múltiple</span>
                    <span className="text-slate-400 font-normal text-[11px]">Única respuesta</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => agregarPregunta('SELECCION_MULTIPLE')}
                    className="w-full text-left px-3.5 py-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-slate-700 hover:text-blue-700 transition-all flex items-center justify-between"
                  >
                    <span>☑️ Selección Múltiple</span>
                    <span className="text-slate-400 font-normal text-[11px]">Varias respuestas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => agregarPregunta('VERDADERO_FALSO')}
                    className="w-full text-left px-3.5 py-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-slate-700 hover:text-blue-700 transition-all flex items-center justify-between"
                  >
                    <span>⚖️ Verdadero / Falso</span>
                    <span className="text-slate-400 font-normal text-[11px]">Booleana</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => agregarPregunta('COMPLETAR')}
                    className="w-full text-left px-3.5 py-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-slate-700 hover:text-blue-700 transition-all flex items-center justify-between"
                  >
                    <span>✏️ Completar Espacios</span>
                    <span className="text-blue-600 font-semibold text-[11px]">Frase con tokens</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => agregarPregunta('ABIERTA')}
                    className="w-full text-left px-3.5 py-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-slate-700 hover:text-blue-700 transition-all flex items-center justify-between"
                  >
                    <span>📝 Respuesta Abierta</span>
                    <span className="text-slate-400 font-normal text-[11px]">Desarrollo</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Acordeón 2: Configuración de Tiempo */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAcordeon('tiempo')}
              className="w-full px-5 py-3.5 bg-slate-50 hover:bg-slate-100 font-bold text-slate-800 text-left flex items-center justify-between text-sm border-b border-slate-200 transition-colors"
            >
              <span>⏱️ Control de Tiempo</span>
              <span className="text-xs text-slate-400">{acordeonAbierto.tiempo ? '▲' : '▼'}</span>
            </button>
            {acordeonAbierto.tiempo && (
              <div className="p-4 space-y-4 text-xs bg-white">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tiempo Total (Minutos)</label>
                  <input
                    type="number"
                    min="1"
                    value={tiempoTotal}
                    disabled={tiempoPorPregunta !== ''}
                    onChange={(e) => setTiempoTotal(e.target.value !== '' ? Number(e.target.value) : '')}
                    placeholder="Ej: 60 (Excluyente)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tiempo por Pregunta (Segundos)</label>
                  <input
                    type="number"
                    min="5"
                    value={tiempoPorPregunta}
                    disabled={tiempoTotal !== ''}
                    onChange={(e) => setTiempoPorPregunta(e.target.value !== '' ? Number(e.target.value) : '')}
                    placeholder="Ej: 90 (Excluyente)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Acordeón 3: Reglas de Navegación y Aleatorización */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAcordeon('navegacion')}
              className="w-full px-5 py-3.5 bg-slate-50 hover:bg-slate-100 font-bold text-slate-800 text-left flex items-center justify-between text-sm border-b border-slate-200 transition-colors"
            >
              <span>🧭 Reglas de Navegación</span>
              <span className="text-xs text-slate-400">{acordeonAbierto.navegacion ? '▲' : '▼'}</span>
            </button>
            {acordeonAbierto.navegacion && (
              <div className="p-4 space-y-3 text-xs bg-white text-slate-700">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={permitirRetroceder} onChange={(e) => setPermitirRetroceder(e.target.checked)} className="rounded text-blue-600" />
                  <span>Permitir retroceder preguntas</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={permitirModificar} onChange={(e) => setPermitirModificar(e.target.checked)} className="rounded text-blue-600" />
                  <span>Permitir modificar respuestas</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={permitirDejarEnBlanco} onChange={(e) => setPermitirDejarEnBlanco(e.target.checked)} className="rounded text-blue-600" />
                  <span>Permitir dejar en blanco</span>
                </label>
                <hr className="border-slate-100 my-2" />
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={aleatorizarPreguntas} onChange={(e) => setAleatorizarPreguntas(e.target.checked)} className="rounded text-blue-600" />
                  <span>Aleatorizar preguntas</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={aleatorizarOpciones} onChange={(e) => setAleatorizarOpciones(e.target.checked)} className="rounded text-blue-600" />
                  <span>Aleatorizar opciones</span>
                </label>
              </div>
            )}
          </div>

          {/* Acordeón 4: Monitoreo */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAcordeon('monitoreo')}
              className="w-full px-5 py-3.5 bg-slate-50 hover:bg-slate-100 font-bold text-slate-800 text-left flex items-center justify-between text-sm border-b border-slate-200 transition-colors"
            >
              <span>🛡️ Monitoreo e Integridad</span>
              <span className="text-xs text-slate-400">{acordeonAbierto.monitoreo ? '▲' : '▼'}</span>
            </button>
            {acordeonAbierto.monitoreo && (
              <div className="p-4 space-y-3 text-xs bg-white text-slate-700">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={detectarCambioPestana} onChange={(e) => setDetectarCambioPestana(e.target.checked)} className="rounded text-blue-600" />
                  <span>Detectar cambio de pestaña / foco</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={detectarClickDerecho} onChange={(e) => setDetectarClickDerecho(e.target.checked)} className="rounded text-blue-600" />
                  <span>Detectar clic derecho</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={detectarCopiar} onChange={(e) => setDetectarCopiar(e.target.checked)} className="rounded text-blue-600" />
                  <span>Detectar copia de texto</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={detectarPegar} onChange={(e) => setDetectarPegar(e.target.checked)} className="rounded text-blue-600" />
                  <span>Detectar pegado de texto</span>
                </label>
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
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 font-bold text-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Descripción o Instrucciones Generales</label>
              <textarea
                rows={2}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Instrucciones para el estudiante..."
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all"
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
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
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
                          onChange={(e) => handlePreguntaChange(pIdx, 'puntaje', e.target.value)}
                          className="w-16 px-2.5 py-1 border border-slate-200 rounded-lg text-center text-xs text-slate-800 font-bold focus:outline-none focus:border-blue-500"
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
                          className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition-colors border border-blue-200"
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
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all font-normal"
                    />

                    {p.tipo === 'COMPLETAR' && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        💡 Tip: Escribe tu frase completa, selecciona con el ratón la palabra que debe adivinar el estudiante y pulsa <strong>"Marcar texto seleccionado como espacio"</strong>.
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
                            className="text-xs text-blue-600 font-bold hover:underline"
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
                            className="w-4 h-4 text-blue-600 accent-blue-600 rounded"
                          />
                          <input
                            type="text"
                            required
                            value={opc.texto}
                            onChange={(e) => handleOpcionChange(pIdx, oIdx, 'texto', e.target.value)}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
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
                          className="text-xs text-blue-600 font-bold hover:underline"
                        >
                          + Añadir espacio [_N_]
                        </button>
                      </div>

                      {p.espacios.length === 0 ? (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 text-center">
                          Aún no has definido ningún espacio. Selecciona una palabra del enunciado o haz clic en "+ Añadir espacio".
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {p.espacios.map((esp, eIdx) => (
                            <div key={eIdx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-blue-600 text-xs uppercase tracking-wide">
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
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-blue-500"
                                />
                              </div>

                              <div className="flex flex-wrap items-center gap-4 text-slate-600 pt-1">
                                <label className="flex items-center space-x-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={esp.ignorarMayusculas}
                                    onChange={(e) => handleEspacioPropChange(pIdx, eIdx, 'ignorarMayusculas', e.target.checked)}
                                    className="rounded text-blue-600 accent-blue-600"
                                  />
                                  <span>Ignorar mayúsculas y minúsculas</span>
                                </label>

                                <div className="flex items-center space-x-2">
                                  <span>Modo de calificación:</span>
                                  <select
                                    value={esp.modoCalificacion}
                                    onChange={(e) => handleEspacioPropChange(pIdx, eIdx, 'modoCalificacion', e.target.value)}
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
    </main>
  );
}
