'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('uub_docente_token') : null;
}

const TIPO_LABEL: Record<string, string> = {
  OPCION_MULTIPLE: 'Opción múltiple',
  SELECCION_MULTIPLE: 'Selección múltiple',
  VERDADERO_FALSO: 'Verdadero/Falso',
  COMPLETAR: 'Completar',
  ABIERTA: 'Respuesta abierta',
};

export default function ReporteSesionPage() {
  const router = useRouter();
  const params = useParams();
  const idSesion = Number(params.id);

  const [reporte, setReporte] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [participanteExpandido, setParticipanteExpandido] = useState<number | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/docente/login'); return; }

    const cargar = async () => {
      try {
        const res = await fetch(`${API}/sesiones/${idSesion}/reporte`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { setError('No se pudo cargar el reporte.'); return; }
        setReporte(await res.json());
      } catch {
        setError('Error de conexión.');
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [idSesion, router]);

  if (cargando) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 animate-pulse">Generando reporte...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-600 font-medium">{error}</p>
          <Link href="/docente/dashboard" className="text-blue-600 hover:underline text-sm">← Dashboard</Link>
        </div>
      </main>
    );
  }

  const { sesion, evaluacion, resumen, participantes } = reporte;

  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href={`/docente/sesion/${idSesion}`} className="text-slate-400 hover:text-slate-700 text-sm font-medium transition-colors">
            ← Control de sesión
          </Link>
          <span className="text-slate-200">|</span>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-none">Reporte de Sesión</h1>
            <p className="text-xs text-slate-400 mt-0.5">{evaluacion?.nombre}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
            {sesion?.codigo}
          </span>
          <button
            disabled
            title="Exportación disponible próximamente"
            className="px-4 py-2 text-xs font-semibold rounded-full bg-slate-100 text-slate-400 cursor-not-allowed"
          >
            Exportar (próximamente)
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {/* Info de sesión */}
        <div className="bg-white border border-slate-200 rounded-2xl px-6 py-5 shadow-sm flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Estado</p>
            <p className="font-bold mt-1 text-slate-800">{sesion?.estado}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Inicio</p>
            <p className="font-medium mt-1 text-slate-700">
              {sesion?.fechaInicio ? new Date(sesion.fechaInicio).toLocaleString('es-BO') : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Cierre</p>
            <p className="font-medium mt-1 text-slate-700">
              {sesion?.fechaFin ? new Date(sesion.fechaFin).toLocaleString('es-BO') : 'Activa'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Puntaje máximo</p>
            <p className="font-medium mt-1 text-slate-700">{evaluacion?.puntajeMaximoPosible} pts</p>
          </div>
        </div>

        {/* Tarjetas de resumen */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Participantes', value: resumen?.totalParticipantes, suffix: '', color: 'text-slate-700' },
            { label: 'En progreso', value: resumen?.enProgreso, suffix: '', color: 'text-blue-600' },
            { label: 'Finalizados', value: resumen?.finalizados, suffix: '', color: 'text-green-600' },
            { label: 'Puntaje promedio', value: resumen?.puntajePromedio?.toFixed(1), suffix: ' pts', color: 'text-slate-700' },
            { label: '% Promedio', value: resumen?.porcentajePromedio?.toFixed(1), suffix: '%', color: 'text-slate-700' },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
              <p className={`text-3xl font-black ${s.color}`}>{s.value}{s.suffix}</p>
              <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-wide leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabla de participantes */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-900">Resultados por participante</h2>
            <p className="text-xs text-slate-400 mt-0.5">Haz clic en una fila para ver el detalle de respuestas</p>
          </div>

          {participantes?.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No hay participantes registrados.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {participantes?.map((p: any) => (
                <div key={p.idParticipante}>
                  {/* Fila resumen */}
                  <button
                    onClick={() => setParticipanteExpandido(participanteExpandido === p.idParticipante ? null : p.idParticipante)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold text-sm flex items-center justify-center flex-shrink-0">
                        {p.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{p.nombre}</p>
                        <p className="text-xs text-slate-400">
                          {p.fechaFinalizacion
                            ? `Finalizado: ${new Date(p.fechaFinalizacion).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`
                            : 'En progreso'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xl font-black text-slate-900">
                          {p.puntajeTotal !== null ? Number(p.puntajeTotal).toFixed(1) : '—'}
                          <span className="text-xs font-normal text-slate-400"> / {evaluacion?.puntajeMaximoPosible}</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          {p.porcentaje !== null ? `${Math.round(Number(p.porcentaje))}%` : '—'}
                        </p>
                      </div>
                      <div className={`w-2.5 h-2.5 rounded-full ${p.estado === 'FINALIZADO' ? 'bg-green-500' : p.estado === 'EN_PROGRESO' ? 'bg-blue-400' : 'bg-slate-300'}`} />
                      <span className="text-slate-300 text-lg">{participanteExpandido === p.idParticipante ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {/* Detalle respuestas */}
                  {participanteExpandido === p.idParticipante && (
                    <div className="px-6 pb-6 bg-slate-50 border-t border-slate-100">
                      <div className="space-y-3 pt-4">
                        {p.respuestas?.map((r: any, idx: number) => (
                          <div key={r.idPregunta} className={`bg-white border rounded-2xl p-4 shadow-sm ${r.esCorrecta === true ? 'border-green-200' : r.esCorrecta === false ? 'border-red-200' : 'border-slate-200'}`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-bold text-slate-400 uppercase">#{idx + 1} {TIPO_LABEL[r.tipo] || r.tipo}</span>
                                  {r.tipo === 'ABIERTA' && !r.corregidoDocente && (
                                    <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">Pendiente corrección</span>
                                  )}
                                </div>
                                <p className="text-sm text-slate-700 font-medium">{r.enunciado}</p>
                                <div className="mt-2 text-xs text-slate-500">
                                  {r.respuestaTexto && <p>Respuesta: <span className="font-medium text-slate-700">{r.respuestaTexto}</span></p>}
                                  {r.opcionesSeleccionadas?.length > 0 && (
                                    <p>Seleccionó: <span className="font-medium text-slate-700">{r.opcionesSeleccionadas.join(', ')}</span></p>
                                  )}
                                  {!r.respuestaTexto && r.opcionesSeleccionadas?.length === 0 && (
                                    <p className="italic text-slate-400">Sin respuesta</p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className={`text-lg font-black ${r.esCorrecta === true ? 'text-green-600' : r.esCorrecta === false ? 'text-red-500' : 'text-slate-400'}`}>
                                  {r.puntajeObtenido !== null ? Number(r.puntajeObtenido).toFixed(1) : '—'}
                                </p>
                                <p className="text-xs text-slate-400">/ {r.puntajeMaximo}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
