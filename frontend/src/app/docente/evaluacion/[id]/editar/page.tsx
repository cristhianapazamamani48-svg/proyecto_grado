'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Pregunta = {
  idPregunta?: number;
  tipo: 'OPCION_MULTIPLE' | 'SELECCION_MULTIPLE' | 'VERDADERO_FALSO' | 'COMPLETAR' | 'ABIERTA';
  enunciado: string;
  imagen?: string | null;
  puntaje: number;
  orden: number;
  opciones: { texto: string; esCorrecta: boolean }[];
  espacios: { numeroEspacio: number; ignorarMayusculas: boolean; modoCalificacion: 'EXACTA' | 'CONTIENE'; respuestasValidas: string[] }[];
};

export default function EditarEvaluacionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [configuracion, setConfiguracion] = useState<Record<string, unknown>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    const token = localStorage.getItem('uub_docente_token');
    if (!token) {
      router.push('/docente/login');
      return;
    }
    fetch(`${API}/evaluaciones/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'No se pudo cargar la evaluación.');
        setNombre(data.nombre);
        setDescripcion(data.descripcion || '');
        setConfiguracion({
          tiempoTotal: data.tiempoTotal,
          tiempoPorPregunta: data.tiempoPorPregunta,
          permitirRetroceder: data.permitirRetroceder,
          permitirModificar: data.permitirModificar,
          permitirDejarEnBlanco: data.permitirDejarEnBlanco,
          mostrarResultados: data.mostrarResultados,
          mostrarRespuestas: data.mostrarRespuestas,
          permitirRevision: data.permitirRevision,
          aleatorizarPreguntas: data.aleatorizarPreguntas,
          aleatorizarOpciones: data.aleatorizarOpciones,
          detectarCambioPestana: data.detectarCambioPestana,
          detectarClickDerecho: data.detectarClickDerecho,
          detectarCopiar: data.detectarCopiar,
          detectarPegar: data.detectarPegar,
          detectarRedimensionar: data.detectarRedimensionar,
          modoInicio: data.modoInicio,
          fechaInicio: data.fechaInicio,
          fechaFin: data.fechaFin,
        });
        setPreguntas(data.preguntas.map((pregunta: any) => ({
          ...pregunta,
          puntaje: Number(pregunta.puntaje),
          opciones: pregunta.opciones.map((opcion: any) => ({ texto: opcion.texto, esCorrecta: opcion.esCorrecta })),
          espacios: (pregunta.espacios || []).map((espacio: any) => ({
            numeroEspacio: espacio.numeroEspacio,
            ignorarMayusculas: espacio.ignorarMayusculas ?? true,
            modoCalificacion: espacio.modoCalificacion || 'EXACTA',
            respuestasValidas: (espacio.respuestasValidas || []).map((respuesta: any) => respuesta.respuesta || respuesta),
          })),
        })));
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [id, router]);

  const actualizarPregunta = (index: number, cambios: Partial<Pregunta>) => {
    setPreguntas((actuales) => actuales.map((pregunta, i) => i === index ? { ...pregunta, ...cambios } : pregunta));
  };

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

    const nuevoEspacio = {
      numeroEspacio: nuevoNum,
      ignorarMayusculas: true,
      modoCalificacion: 'EXACTA' as const,
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
    const tokenRegex = new RegExp(`\\[_${espacioEliminado.numeroEspacio}_\\]`, 'g');
    copia[pIndex].enunciado = copia[pIndex].enunciado.replace(tokenRegex, '');
    setPreguntas(copia);
  };

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const token = localStorage.getItem('uub_docente_token');
      const res = await fetch(`${API}/evaluaciones/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nombre,
          descripcion,
          ...configuracion,
          preguntas: preguntas.map((pregunta, index) => ({ ...pregunta, orden: index + 1 })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'No se pudo guardar la evaluación.');
      router.push('/docente/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 animate-pulse">Cargando evaluación...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="bg-white border border-slate-200 rounded-2xl px-6 py-4 flex items-center justify-between shadow-sm sticky top-4 z-20">
          <div className="flex items-center gap-3">
            <Link href="/docente/dashboard" className="text-sm font-semibold text-slate-400 hover:text-slate-700 transition-colors">
              ← Volver al Dashboard
            </Link>
            <span className="text-slate-200">|</span>
            <span className="text-sm font-bold text-slate-900">Editar Evaluación</span>
          </div>
          <button
            onClick={guardar}
            disabled={guardando}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-sm shadow-md shadow-blue-500/25 transition-colors disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </header>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm">
            {error}
          </div>
        )}

        <form onSubmit={guardar} className="space-y-6">
          <section className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Nombre de la Evaluación</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className="w-full text-xl font-bold border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Descripción</label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
                placeholder="Descripción general..."
                className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-500 text-slate-800"
              />
            </div>
          </section>

          {preguntas.map((pregunta, index) => (
            <section key={index} className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="font-bold text-slate-800 text-sm">
                  Pregunta {index + 1} · <span className="text-blue-600">{pregunta.tipo.replace(/_/g, ' ')}</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Puntos:</span>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={pregunta.puntaje}
                    onChange={(e) => actualizarPregunta(index, { puntaje: Number(e.target.value) })}
                    className="w-16 border border-slate-200 rounded-lg p-1 text-center text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase">
                    {pregunta.tipo === 'COMPLETAR' ? 'Frase con espacios' : 'Enunciado'}
                  </label>
                  {pregunta.tipo === 'COMPLETAR' && (
                    <button
                      type="button"
                      onClick={() => insertarEspacioEnTexto(index)}
                      className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition-colors border border-blue-200"
                    >
                      + Marcar texto seleccionado como espacio
                    </button>
                  )}
                </div>

                <textarea
                  ref={(el) => { textareaRefs.current[index] = el; }}
                  value={pregunta.enunciado}
                  onChange={(e) => actualizarPregunta(index, { enunciado: e.target.value })}
                  required
                  rows={pregunta.tipo === 'COMPLETAR' ? 3 : 2}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {(pregunta.tipo === 'OPCION_MULTIPLE' || pregunta.tipo === 'SELECCION_MULTIPLE' || pregunta.tipo === 'VERDADERO_FALSO') && (
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-bold text-slate-600 uppercase">Alternativas</span>
                  {pregunta.opciones.map((opcion, opcionIndex) => (
                    <div key={opcionIndex} className="flex gap-3 items-center">
                      <input
                        type={pregunta.tipo === 'SELECCION_MULTIPLE' ? 'checkbox' : 'radio'}
                        checked={opcion.esCorrecta}
                        onChange={() =>
                          actualizarPregunta(index, {
                            opciones: pregunta.opciones.map((actual, i) => ({
                              ...actual,
                              esCorrecta: pregunta.tipo === 'SELECCION_MULTIPLE' ? (i === opcionIndex ? !actual.esCorrecta : actual.esCorrecta) : i === opcionIndex,
                            })),
                          })
                        }
                        className="w-4 h-4 text-blue-600 accent-blue-600"
                      />
                      <input
                        value={opcion.texto}
                        onChange={(e) =>
                          actualizarPregunta(index, {
                            opciones: pregunta.opciones.map((actual, i) => (i === opcionIndex ? { ...actual, texto: e.target.value } : actual)),
                          })
                        }
                        className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
              )}

              {pregunta.tipo === 'COMPLETAR' && (
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold text-slate-700 uppercase">Respuestas válidas por espacio</span>
                  {pregunta.espacios.map((espacio, espacioIndex) => (
                    <div key={espacioIndex} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-blue-600 uppercase">Espacio [_{espacio.numeroEspacio}_]</span>
                        <button
                          type="button"
                          onClick={() => eliminarEspacio(index, espacioIndex)}
                          className="text-red-500 hover:text-red-700 font-semibold"
                        >
                          Eliminar
                        </button>
                      </div>
                      <input
                        value={espacio.respuestasValidas.join(', ')}
                        onChange={(e) =>
                          actualizarPregunta(index, {
                            espacios: pregunta.espacios.map((actual, i) =>
                              i === espacioIndex ? { ...actual, respuestasValidas: e.target.value.split(',').map((item) => item.trim()) } : actual,
                            ),
                          })
                        }
                        placeholder="Respuestas separadas por coma"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </form>
      </div>
    </main>
  );
}
