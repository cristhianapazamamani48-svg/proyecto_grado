'use client';

import { useState, useEffect } from 'react';
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

export default function NuevaEvaluacionWordPressStylePage() {
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
    visualizacion: false,
  });

  const [preguntas, setPreguntas] = useState<PreguntaForm[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

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
      enunciado: '',
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
          ? [{ numeroEspacio: 1, ignorarMayusculas: true, modoCalificacion: 'EXACTA', respuestasValidas: ['Respuesta'] }]
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
    <main className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          <Link href="/docente/dashboard" className="text-slate-500 hover:text-slate-900 text-sm font-medium">
            &larr; Volver
          </Link>
          <span className="text-slate-300">|</span>
          <h1 className="text-xl font-bold text-slate-900">Diseñador de Evaluaciones</h1>
        </div>

        <button
          onClick={guardarEvaluacion}
          disabled={cargando}
          className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm rounded-lg shadow transition-colors disabled:opacity-50"
        >
          {cargando ? 'Guardando...' : 'Guardar Evaluación'}
        </button>
      </header>

      {/* Main 2-Column Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMNA IZQUIERDA: Añadir Elementos y Ajustes (WordPress Style Sidebar) */}
        <aside className="lg:col-span-4 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 mb-2">Añadir elementos</h2>

          {/* Acordeón 1: Tipos de Pregunta */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAcordeon('elementos')}
              className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 text-left flex items-center justify-between text-sm border-b border-slate-200"
            >
              <span>Tipos de Pregunta</span>
              <span>{acordeonAbierto.elementos ? '▲' : '▼'}</span>
            </button>
            {acordeonAbierto.elementos && (
              <div className="p-4 space-y-2 bg-white">
                <p className="text-xs text-slate-500 mb-3">Haz clic para añadir una pregunta al lienzo:</p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => agregarPregunta('OPCION_MULTIPLE')}
                    className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded text-xs font-semibold text-slate-700 transition-colors flex items-center justify-between"
                  >
                    <span>+ Opción Múltiple</span>
                    <span className="text-slate-400 font-normal text-[10px]">Única respuesta</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => agregarPregunta('SELECCION_MULTIPLE')}
                    className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded text-xs font-semibold text-slate-700 transition-colors flex items-center justify-between"
                  >
                    <span>+ Selección Múltiple</span>
                    <span className="text-slate-400 font-normal text-[10px]">Varias respuestas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => agregarPregunta('VERDADERO_FALSO')}
                    className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded text-xs font-semibold text-slate-700 transition-colors flex items-center justify-between"
                  >
                    <span>+ Verdadero / Falso</span>
                    <span className="text-slate-400 font-normal text-[10px]">Booleana</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => agregarPregunta('COMPLETAR')}
                    className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded text-xs font-semibold text-slate-700 transition-colors flex items-center justify-between"
                  >
                    <span>+ Completar Espacios</span>
                    <span className="text-slate-400 font-normal text-[10px]">Texto corto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => agregarPregunta('ABIERTA')}
                    className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded text-xs font-semibold text-slate-700 transition-colors flex items-center justify-between"
                  >
                    <span>+ Respuesta Abierta</span>
                    <span className="text-slate-400 font-normal text-[10px]">Desarrollo / IA</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Acordeón 2: Configuración de Tiempo */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAcordeon('tiempo')}
              className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 text-left flex items-center justify-between text-sm border-b border-slate-200"
            >
              <span>Tiempo del Examen</span>
              <span>{acordeonAbierto.tiempo ? '▲' : '▼'}</span>
            </button>
            {acordeonAbierto.tiempo && (
              <div className="p-4 space-y-4 text-xs bg-white">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tiempo Total (Minutos)</label>
                  <input
                    type="number"
                    min="1"
                    value={tiempoTotal}
                    disabled={tiempoPorPregunta !== ''}
                    onChange={(e) => setTiempoTotal(e.target.value !== '' ? Number(e.target.value) : '')}
                    placeholder="Ej: 60 (Excluyente)"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tiempo por Pregunta (Segundos)</label>
                  <input
                    type="number"
                    min="5"
                    value={tiempoPorPregunta}
                    disabled={tiempoTotal !== ''}
                    onChange={(e) => setTiempoPorPregunta(e.target.value !== '' ? Number(e.target.value) : '')}
                    placeholder="Ej: 90 (Excluyente)"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-slate-800"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Acordeón 3: Reglas de Navegación y Aleatorización */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAcordeon('navegacion')}
              className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 text-left flex items-center justify-between text-sm border-b border-slate-200"
            >
              <span>Reglas de Navegación</span>
              <span>{acordeonAbierto.navegacion ? '▲' : '▼'}</span>
            </button>
            {acordeonAbierto.navegacion && (
              <div className="p-4 space-y-3 text-xs bg-white">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={permitirRetroceder} onChange={(e) => setPermitirRetroceder(e.target.checked)} />
                  <span>Permitir retroceder a preguntas anteriores</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={permitirModificar} onChange={(e) => setPermitirModificar(e.target.checked)} />
                  <span>Permitir modificar respuestas guardadas</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={permitirDejarEnBlanco} onChange={(e) => setPermitirDejarEnBlanco(e.target.checked)} />
                  <span>Permitir dejar preguntas en blanco</span>
                </label>
                <hr className="border-slate-100 my-2" />
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={aleatorizarPreguntas} onChange={(e) => setAleatorizarPreguntas(e.target.checked)} />
                  <span>Aleatorizar orden de preguntas</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={aleatorizarOpciones} onChange={(e) => setAleatorizarOpciones(e.target.checked)} />
                  <span>Aleatorizar opciones de respuesta</span>
                </label>
              </div>
            )}
          </div>

          {/* Acordeón 4: Monitoreo y Seguridad */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAcordeon('monitoreo')}
              className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 text-left flex items-center justify-between text-sm border-b border-slate-200"
            >
              <span>Monitoreo e Integridad</span>
              <span>{acordeonAbierto.monitoreo ? '▲' : '▼'}</span>
            </button>
            {acordeonAbierto.monitoreo && (
              <div className="p-4 space-y-3 text-xs bg-white">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={detectarCambioPestana} onChange={(e) => setDetectarCambioPestana(e.target.checked)} />
                  <span>Detectar cambio de pestaña / foco</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={detectarClickDerecho} onChange={(e) => setDetectarClickDerecho(e.target.checked)} />
                  <span>Bloquear / detectar menú contextual (click derecho)</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={detectarCopiar} onChange={(e) => setDetectarCopiar(e.target.checked)} />
                  <span>Bloquear acción de copiar texto</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={detectarPegar} onChange={(e) => setDetectarPegar(e.target.checked)} />
                  <span>Bloquear acción de pegar texto</span>
                </label>
              </div>
            )}
          </div>
        </aside>

        {/* COLUMNA DERECHA: Estructura de la Evaluación (WordPress Style Menu Canvas) */}
        <section className="lg:col-span-8 space-y-6">
          <h2 className="text-lg font-bold text-slate-900 mb-2">Estructura de la evaluación</h2>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Formulario Principal de Evaluación */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 shadow-sm">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nombre de la Evaluación</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del examen o parcial..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Descripción / Instrucciones</label>
              <textarea
                rows={2}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Instrucciones generales para el estudiante..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Lienzo de Preguntas (Menu Items List) */}
          <div className="space-y-4">
            <p className="text-xs text-slate-500 italic">
              Arrastra o añade preguntas desde el panel izquierdo para construir el examen.
            </p>

            {preguntas.length === 0 ? (
              <div className="p-12 border-2 border-dashed border-slate-300 rounded-lg text-center text-slate-400 space-y-2 bg-white">
                <div className="text-3xl">📄</div>
                <p className="font-semibold text-slate-600">La evaluación está vacía</p>
                <p className="text-xs">Usa el menú "Tipos de Pregunta" a la izquierda para comenzar a añadir preguntas.</p>
              </div>
            ) : (
              preguntas.map((p, pIdx) => (
                <div key={pIdx} className="bg-white border border-slate-300 rounded-lg shadow-sm p-5 space-y-4 transition-all hover:border-slate-400">
                  {/* Pregunta Item Header */}
                  <div className="flex items-center justify-between bg-slate-50 p-3 -mx-5 -mt-5 border-b border-slate-200 rounded-t-lg">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      {pIdx + 1}. {p.tipo.replace('_', ' ')}
                    </span>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1 text-xs">
                        <span className="text-slate-500 font-medium">Pts:</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={p.puntaje}
                          onChange={(e) => handlePreguntaChange(pIdx, 'puntaje', e.target.value)}
                          className="w-14 px-2 py-1 border border-slate-300 rounded text-center text-xs text-slate-800 font-semibold"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => eliminarPregunta(pIdx)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {/* Enunciado */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Enunciado de la pregunta</label>
                    <textarea
                      rows={2}
                      required
                      value={p.enunciado}
                      onChange={(e) => handlePreguntaChange(pIdx, 'enunciado', e.target.value)}
                      placeholder="Redacta la pregunta aquí..."
                      className="w-full p-3 border border-slate-300 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  {/* Opciones o Respuestas Válidas */}
                  {(p.tipo === 'OPCION_MULTIPLE' || p.tipo === 'SELECCION_MULTIPLE' || p.tipo === 'VERDADERO_FALSO') && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase">Alternativas</span>
                        {p.tipo !== 'VERDADERO_FALSO' && (
                          <button
                            type="button"
                            onClick={() => agregarOpcion(pIdx)}
                            className="text-xs text-sky-600 font-semibold hover:underline"
                          >
                            + Añadir alternativa
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
                            className="w-4 h-4 accent-sky-600"
                          />
                          <input
                            type="text"
                            required
                            value={opc.texto}
                            onChange={(e) => handleOpcionChange(pIdx, oIdx, 'texto', e.target.value)}
                            className="flex-1 px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-800"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {p.tipo === 'COMPLETAR' && (
                    <div className="space-y-2 pt-1">
                      <span className="text-xs font-bold text-slate-700 uppercase">Respuestas válidas por espacio</span>
                      {p.espacios.map((esp, eIdx) => (
                        <div key={eIdx} className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                          <p className="font-semibold text-slate-700">Espacio #{esp.numeroEspacio}</p>
                          <input
                            type="text"
                            placeholder="Escribe respuestas separadas por coma"
                            value={esp.respuestasValidas.join(', ')}
                            onChange={(e) => {
                              const copia = [...preguntas];
                              copia[pIdx].espacios[eIdx].respuestasValidas = e.target.value.split(',').map((s) => s.trim());
                              setPreguntas(copia);
                            }}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-800"
                          />
                        </div>
                      ))}
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
