'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Pregunta = {
  idPregunta: number;
  tipo: string;
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
          espacios: pregunta.espacios.map((espacio: any) => ({
            numeroEspacio: espacio.numeroEspacio,
            ignorarMayusculas: espacio.ignorarMayusculas,
            modoCalificacion: espacio.modoCalificacion,
            respuestasValidas: espacio.respuestasValidas.map((respuesta: any) => respuesta.respuesta),
          })),
        })));
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [id, router]);

  const actualizarPregunta = (index: number, cambios: Partial<Pregunta>) => {
    setPreguntas((actuales) => actuales.map((pregunta, i) => i === index ? { ...pregunta, ...cambios } : pregunta));
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
        body: JSON.stringify({ nombre, descripcion, ...configuracion, preguntas: preguntas.map((pregunta, index) => ({ ...pregunta, orden: index + 1 })) }),
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

  if (cargando) return <main className="min-h-screen p-8 text-slate-600">Cargando evaluación...</main>;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-800 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <Link href="/docente/dashboard" className="text-sm text-slate-500 hover:text-blue-600">&larr; Volver</Link>
          <button onClick={guardar} disabled={guardando} className="px-6 py-3 bg-blue-600 text-white rounded-full font-bold disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </header>

        {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">{error}</div>}

        <form onSubmit={guardar} className="space-y-5">
          <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required className="w-full text-2xl font-bold border-b border-slate-200 pb-2 outline-none" />
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} placeholder="Descripción" className="w-full border border-slate-200 rounded-xl p-3 outline-none" />
          </section>

          {preguntas.map((pregunta, index) => (
            <section key={pregunta.idPregunta} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex justify-between text-sm font-bold text-slate-500">Pregunta {index + 1}<span>{pregunta.tipo}</span></div>
              <textarea value={pregunta.enunciado} onChange={(e) => actualizarPregunta(index, { enunciado: e.target.value })} required rows={3} className="w-full border border-slate-200 rounded-xl p-3" />
              <input type="number" min="0.5" step="0.5" value={pregunta.puntaje} onChange={(e) => actualizarPregunta(index, { puntaje: Number(e.target.value) })} className="w-24 border border-slate-200 rounded-lg p-2" />

              {(pregunta.tipo === 'OPCION_MULTIPLE' || pregunta.tipo === 'SELECCION_MULTIPLE' || pregunta.tipo === 'VERDADERO_FALSO') && pregunta.opciones.map((opcion, opcionIndex) => (
                <div key={opcionIndex} className="flex gap-3 items-center">
                  <input type={pregunta.tipo === 'SELECCION_MULTIPLE' ? 'checkbox' : 'radio'} checked={opcion.esCorrecta} onChange={() => actualizarPregunta(index, { opciones: pregunta.opciones.map((actual, i) => ({ ...actual, esCorrecta: pregunta.tipo === 'SELECCION_MULTIPLE' ? i === opcionIndex ? !actual.esCorrecta : actual.esCorrecta : i === opcionIndex })) })} />
                  <input value={opcion.texto} onChange={(e) => actualizarPregunta(index, { opciones: pregunta.opciones.map((actual, i) => i === opcionIndex ? { ...actual, texto: e.target.value } : actual) })} className="flex-1 border border-slate-200 rounded-lg p-2" />
                </div>
              ))}

              {pregunta.tipo === 'COMPLETAR' && pregunta.espacios.map((espacio, espacioIndex) => (
                <input key={espacioIndex} value={espacio.respuestasValidas.join(', ')} onChange={(e) => actualizarPregunta(index, { espacios: pregunta.espacios.map((actual, i) => i === espacioIndex ? { ...actual, respuestasValidas: e.target.value.split(',').map((item) => item.trim()) } : actual) })} placeholder={`Respuestas del espacio ${espacio.numeroEspacio}`} className="w-full border border-slate-200 rounded-lg p-2" />
              ))}
            </section>
          ))}
        </form>
      </div>
    </main>
  );
}
