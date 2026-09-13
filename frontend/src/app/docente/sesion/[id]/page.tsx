'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('uub_docente_token') : null;
}

const ESTADO_PARTICIPANTE: Record<string, { label: string; color: string }> = {
  EN_PROGRESO: { label: 'En progreso', color: 'bg-blue-100 text-blue-700' },
  FINALIZADO: { label: 'Finalizado', color: 'bg-green-100 text-green-700' },
  RETIRADO: { label: 'Retirado', color: 'bg-slate-100 text-slate-500' },
};

const ESTADO_SESION: Record<string, { label: string; color: string }> = {
  PENDIENTE: { label: 'Sala de espera', color: 'bg-amber-100 text-amber-700' },
  ACTIVA: { label: 'En curso', color: 'bg-green-100 text-green-700' },
  FINALIZADA: { label: 'Finalizada', color: 'bg-slate-100 text-slate-500' },
};

export default function SesionControlPage() {
  const router = useRouter();
  const params = useParams();
  const idSesion = Number(params.id);

  const [sesion, setSesion] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [accionando, setAccionando] = useState(false);
  const [confirmFinalizar, setConfirmFinalizar] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/docente/login'); return; }
    try {
      const res = await fetch(`${API}/sesiones/${idSesion}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setError('No se pudo cargar la sesión.'); return; }
      setSesion(await res.json());
    } catch {
      setError('Error de conexión.');
    } finally {
      setCargando(false);
    }
  }, [idSesion, router]);

  useEffect(() => {
    cargar();
    // Polling cada 5 segundos si la sesión no ha finalizado
    const intervalo = setInterval(() => {
      cargar();
    }, 5000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  // Detener polling si finalizada
  useEffect(() => {
    if (sesion?.estado === 'FINALIZADA') return;
  }, [sesion]);

  const handleIniciar = async () => {
    setAccionando(true);
    const token = getToken();
    try {
      const res = await fetch(`${API}/sesiones/${idSesion}/iniciar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.message || 'Error al iniciar.');
      } else {
        await cargar();
      }
    } catch { setError('Error de conexión.'); }
    setAccionando(false);
  };

  const handleFinalizar = async () => {
    setConfirmFinalizar(false);
    setAccionando(true);
    const token = getToken();
    try {
      const res = await fetch(`${API}/sesiones/${idSesion}/finalizar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.message || 'Error al finalizar.');
      } else {
        await cargar();
      }
    } catch { setError('Error de conexión.'); }
    setAccionando(false);
  };

  if (cargando) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 animate-pulse">Cargando sesión...</p>
      </main>
    );
  }

  if (error && !sesion) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-600 font-medium">{error}</p>
          <Link href="/docente/dashboard" className="text-blue-600 hover:underline text-sm">← Volver al dashboard</Link>
        </div>
      </main>
    );
  }

  const estadoSesionInfo = ESTADO_SESION[sesion?.estado] || { label: sesion?.estado, color: 'bg-slate-100 text-slate-500' };
  const enProgreso = sesion?.resumen?.enProgreso ?? 0;
  const finalizados = sesion?.resumen?.finalizados ?? 0;
  const total = sesion?.resumen?.totalParticipantes ?? 0;

  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/docente/dashboard" className="text-slate-400 hover:text-slate-700 text-sm font-medium transition-colors">
            ← Dashboard
          </Link>
          <span className="text-slate-200">|</span>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-none">Control de Sesión</h1>
            <p className="text-xs text-slate-400 mt-0.5">{sesion?.evaluacion?.nombre}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wide ${estadoSesionInfo.color}`}>
            {estadoSesionInfo.label}
          </span>
          {sesion?.estado !== 'FINALIZADA' && (
            <Link
              href={`/docente/sesion/${idSesion}/reporte`}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-full transition-colors"
            >
              Ver Reporte
            </Link>
          )}
          {sesion?.estado === 'FINALIZADA' && (
            <Link
              href={`/docente/sesion/${idSesion}/reporte`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-full transition-colors"
            >
              Ver Reporte
            </Link>
          )}
        </div>
      </header>

      <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-8">
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
            {error}
          </div>
        )}

        {/* Código + acciones */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col md:flex-row items-center gap-8">
          <div className="text-center flex-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Código de sesión</p>
            <div className="text-7xl font-mono font-black text-slate-900 tracking-[0.2em]">
              {sesion?.codigo}
            </div>
            <p className="text-xs text-slate-400 mt-3">Comparte este código con tus estudiantes</p>
          </div>

          <div className="flex flex-col gap-3 min-w-[200px]">
            {sesion?.estado === 'PENDIENTE' && (
              <button
                onClick={handleIniciar}
                disabled={accionando}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-lg shadow-blue-500/25 transition-colors disabled:opacity-50"
              >
                {accionando ? 'Iniciando...' : '▶ Iniciar Evaluación'}
              </button>
            )}

            {sesion?.estado === 'ACTIVA' && (
              <button
                onClick={() => setConfirmFinalizar(true)}
                disabled={accionando}
                className="w-full py-4 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-full border border-red-200 transition-colors disabled:opacity-50"
              >
                {accionando ? 'Finalizando...' : '■ Finalizar Sesión'}
              </button>
            )}

            {sesion?.estado === 'FINALIZADA' && (
              <div className="text-center py-3 text-sm text-slate-500 font-medium">
                Sesión cerrada
              </div>
            )}
          </div>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total', value: total, color: 'text-slate-700' },
            { label: 'En progreso', value: enProgreso, color: 'text-blue-600' },
            { label: 'Finalizados', value: finalizados, color: 'text-green-600' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm">
              <p className={`text-4xl font-black ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-wide">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Lista de participantes */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Participantes</h2>
            <span className="text-xs text-slate-400">Se actualiza cada 5 seg.</span>
          </div>
          {total === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              Aún no hay participantes. Comparte el código para que ingresen.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sesion?.participantes?.map((p: any) => {
                const info = ESTADO_PARTICIPANTE[p.estado] || { label: p.estado, color: 'bg-slate-100 text-slate-500' };
                return (
                  <div key={p.idParticipante} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{p.nombre}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Ingresó: {p.fechaIngreso ? new Date(p.fechaIngreso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      {p.porcentaje !== null && p.estado === 'FINALIZADO' && (
                        <span className="text-sm font-bold text-green-700">{Math.round(Number(p.porcentaje))}%</span>
                      )}
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${info.color}`}>
                        {info.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal confirmación finalizar */}
      {confirmFinalizar && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-xl font-bold text-slate-900">¿Finalizar la sesión?</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Los estudiantes que aún estén respondiendo serán calificados con las respuestas que tienen hasta este momento. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleFinalizar}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-full transition-colors"
              >
                Sí, finalizar
              </button>
              <button
                onClick={() => setConfirmFinalizar(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-full transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
