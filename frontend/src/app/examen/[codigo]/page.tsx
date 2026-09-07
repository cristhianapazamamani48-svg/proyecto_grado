'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ExamenPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const codigo = params.codigo as string;

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intentoId, setIntentoId] = useState('');
  const [preguntas, setPreguntas] = useState<any[]>([]);
  const [indexPreguntaActual, setIndexPreguntaActual] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, { opciones: string[]; texto?: string; espacios?: Record<string, string> }>>({});
  const [finalizado, setFinalizado] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('uub_guest_token');
    if (!token) {
      router.push('/unirse');
      return;
    }

    const cargarExamen = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/sesiones/intento/iniciar`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Error al iniciar intento de examen');

        setIntentoId(data.intentoId);
        setPreguntas(data.preguntas || []);

        // Cargar respuestas ya guardadas previa desconexión
        const mapResp: Record<string, any> = {};
        if (data.respuestasGuardadas) {
          data.respuestasGuardadas.forEach((r: any) => {
            mapResp[r.preguntaId] = {
              opciones: r.opcionesSeleccionadas || [],
              texto: r.textoRespuesta || '',
              espacios: r.espaciosRespuestas || {},
            };
          });
        }
        setRespuestas(mapResp);
      } catch (err: any) {
        setError(err.message || 'Ocurrió un error al cargar la evaluación.');
      } finally {
        setCargando(false);
      }
    };

    cargarExamen();
  }, [codigo, router]);

  const guardarRespuestaServidor = async (preguntaId: string, opc: string[], texto?: string, espacios?: Record<string, string>) => {
    const token = localStorage.getItem('uub_guest_token');
    if (!token || !intentoId) return;

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/sesiones/intento/respuesta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          intentoId,
          preguntaId,
          opcionesSeleccionadas: opc,
          textoRespuesta: texto,
          espaciosRespuestas: espacios,
        }),
      });
    } catch (e) {
      console.error('Error al guardar avance:', e);
    }
  };

  const handleSeleccionarOpcion = (preguntaId: string, opcionId: string, esMultiple: boolean) => {
    const actual = respuestas[preguntaId] || { opciones: [] };
    let nuevasOpciones: string[] = [];

    if (esMultiple) {
      if (actual.opciones.includes(opcionId)) {
        nuevasOpciones = actual.opciones.filter((id) => id !== opcionId);
      } else {
        nuevasOpciones = [...actual.opciones, opcionId];
      }
    } else {
      nuevasOpciones = [opcionId];
    }

    const nuevaMap = {
      ...respuestas,
      [preguntaId]: { ...actual, opciones: nuevasOpciones },
    };
    setRespuestas(nuevaMap);
    guardarRespuestaServidor(preguntaId, nuevasOpciones, actual.texto, actual.espacios);
  };

  const handleTextoAbierto = (preguntaId: string, texto: string) => {
    const actual = respuestas[preguntaId] || { opciones: [] };
    const nuevaMap = {
      ...respuestas,
      [preguntaId]: { ...actual, texto },
    };
    setRespuestas(nuevaMap);
    guardarRespuestaServidor(preguntaId, actual.opciones, texto, actual.espacios);
  };

  const handleEspacioCompletar = (preguntaId: string, posicion: number, valor: string) => {
    const actual = respuestas[preguntaId] || { opciones: [], espacios: {} };
    const nuevosEspacios = { ...(actual.espacios || {}), [posicion]: valor };

    const nuevaMap = {
      ...respuestas,
      [preguntaId]: { ...actual, espacios: nuevosEspacios },
    };
    setRespuestas(nuevaMap);
    guardarRespuestaServidor(preguntaId, actual.opciones, actual.texto, nuevosEspacios);
  };

  const handleFinalizarExamen = async () => {
    if (!confirm('¿Estás seguro de que deseas finalizar la evaluación?')) return;

    const token = localStorage.getItem('uub_guest_token');
    if (!token || !intentoId) return;

    setCargando(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/sesiones/intento/finalizar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ intentoId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al finalizar evaluación');

      setResultado(data);
      setFinalizado(true);
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al entregar la evaluación.');
    } finally {
      setCargando(false);
    }
  };

  if (cargando) {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
        <div className="animate-pulse text-indigo-400 font-semibold text-lg">Cargando evaluación...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
        <div className="bg-rose-500/10 border border-rose-500/30 p-6 rounded-2xl max-w-md text-center">
          <p className="text-rose-400 font-medium mb-4">{error}</p>
          <button onClick={() => router.push('/unirse')} className="px-4 py-2 bg-slate-800 text-white rounded-xl">
            Volver a intentar
          </button>
        </div>
      </main>
    );
  }

  if (finalizado && resultado) {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
        <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl max-w-md w-full text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
            ✓
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Evaluación Finalizada</h1>
            <p className="text-sm text-slate-400 mt-1">Tus respuestas se han guardado con éxito.</p>
          </div>

          <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-700 space-y-2">
            <p className="text-xs text-slate-400 uppercase font-semibold">Nota Obtenida</p>
            <p className="text-4xl font-extrabold text-indigo-400">{resultado.notaFinal} / 100</p>
            <p className="text-xs text-slate-400">
              Puntaje: {resultado.puntajeTotalObtenido} / {resultado.puntajeMaximoPosible} pts
            </p>
          </div>

          <button
            onClick={() => router.push('/')}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 font-bold text-white rounded-xl transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </main>
    );
  }

  const pregActual = preguntas[indexPreguntaActual];
  const respActual = pregActual ? respuestas[pregActual.id] || { opciones: [], texto: '', espacios: {} } : null;

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950 px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-mono bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded border border-indigo-500/30">
            Sesión: {codigo}
          </span>
          <h1 className="text-lg font-bold text-white mt-1">Evaluación Académica</h1>
        </div>

        <button
          onClick={handleFinalizarExamen}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm rounded-xl transition-colors"
        >
          Entregar Evaluación
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6 flex flex-col justify-between">
        {pregActual && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
            {/* Header Pregunta */}
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-4">
              <span className="text-xs font-semibold uppercase text-indigo-400 tracking-wider">
                Pregunta {indexPreguntaActual + 1} de {preguntas.length}
              </span>
              <span className="text-xs font-medium text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-700">
                Puntaje: {pregActual.puntaje} pts
              </span>
            </div>

            {/* Enunciado e Imagen */}
            <div className="space-y-4">
              <h2 className="text-xl font-medium text-white leading-relaxed">{pregActual.enunciado}</h2>
              {pregActual.imagenUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900 max-h-64 flex justify-center">
                  <img src={pregActual.imagenUrl} alt="Imagen de pregunta" className="object-contain h-full" />
                </div>
              )}
            </div>

            {/* Tipos de Pregunta */}
            <div className="pt-2">
              {(pregActual.tipo === 'OPCION_MULTIPLE' || pregActual.tipo === 'VERDADERO_FALSO') && (
                <div className="space-y-3">
                  {pregActual.opciones.map((opc: any) => {
                    const seleccionada = respActual?.opciones.includes(opc.id);
                    return (
                      <button
                        key={opc.id}
                        onClick={() => handleSeleccionarOpcion(pregActual.id, opc.id, false)}
                        className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all ${
                          seleccionada
                            ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                            : 'bg-slate-900 border-slate-700 hover:border-slate-600 text-slate-300'
                        }`}
                      >
                        <span className="text-base font-medium">{opc.texto}</span>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            seleccionada ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-600'
                          }`}
                        >
                          {seleccionada && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {pregActual.tipo === 'SELECCION_MULTIPLE' && (
                <div className="space-y-3">
                  <p className="text-xs text-indigo-400 font-semibold mb-2">Selecciona todas las opciones correctas:</p>
                  {pregActual.opciones.map((opc: any) => {
                    const seleccionada = respActual?.opciones.includes(opc.id);
                    return (
                      <button
                        key={opc.id}
                        onClick={() => handleSeleccionarOpcion(pregActual.id, opc.id, true)}
                        className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all ${
                          seleccionada
                            ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                            : 'bg-slate-900 border-slate-700 hover:border-slate-600 text-slate-300'
                        }`}
                      >
                        <span className="text-base font-medium">{opc.texto}</span>
                        <div
                          className={`w-5 h-5 rounded border flex items-center justify-center ${
                            seleccionada ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-600'
                          }`}
                        >
                          {seleccionada && <span className="text-xs font-bold">✓</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {pregActual.tipo === 'ESPACIO_COMPLETAR' && (
                <div className="space-y-4">
                  <p className="text-xs text-indigo-400 font-semibold">Completa los espacios requeridos:</p>
                  {pregActual.espacios.map((esp: any) => (
                    <div key={esp.id} className="space-y-1">
                      <label className="block text-xs text-slate-400">Espacio #{esp.posicion}</label>
                      <input
                        type="text"
                        value={respActual?.espacios?.[esp.posicion] || ''}
                        onChange={(e) => handleEspacioCompletar(pregActual.id, esp.posicion, e.target.value)}
                        placeholder="Escribe tu respuesta..."
                        className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              )}

              {pregActual.tipo === 'RESPUESTA_ABIERTA' && (
                <div className="space-y-2">
                  <label className="block text-xs text-indigo-400 font-semibold">Escribe tu respuesta explicativa:</label>
                  <textarea
                    rows={5}
                    value={respActual?.texto || ''}
                    onChange={(e) => handleTextoAbierto(pregActual.id, e.target.value)}
                    placeholder="Desarrolla tu respuesta aquí..."
                    className="w-full p-4 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 resize-y"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation Footer */}
        <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
          <button
            disabled={indexPreguntaActual === 0}
            onClick={() => setIndexPreguntaActual((prev) => prev - 1)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl disabled:opacity-30 text-sm font-medium transition-colors"
          >
            &larr; Anterior
          </button>

          <span className="text-xs text-slate-400 font-mono">
            {indexPreguntaActual + 1} / {preguntas.length}
          </span>

          <button
            disabled={indexPreguntaActual === preguntas.length - 1}
            onClick={() => setIndexPreguntaActual((prev) => prev + 1)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:opacity-30 text-sm font-semibold transition-colors"
          >
            Siguiente &rarr;
          </button>
        </div>
      </div>
    </main>
  );
}
