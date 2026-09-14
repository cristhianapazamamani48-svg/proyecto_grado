'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('uub_docente_token') : null;
}

const ESTADO_BADGE: Record<string, string> = {
  BORRADOR: 'bg-amber-50 text-amber-700 border-amber-200',
  PUBLICADA: 'bg-green-50 text-green-700 border-green-200',
  ARCHIVADA: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function DocenteDashboardPage() {
  const router = useRouter();
  const [nombreDocente, setNombreDocente] = useState('');
  const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [menuAbierto, setMenuAbierto] = useState<number | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = getToken();
    const nombre = localStorage.getItem('uub_docente_nombre');
    if (!token) {
      router.push('/docente/login');
      return;
    }
    setNombreDocente(nombre || 'Docente');
    cargarEvaluaciones();
  }, [router]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const mostrarMensaje = (tipo: 'ok' | 'error', texto: string) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 4000);
  };

  const cargarEvaluaciones = async () => {
    const token = getToken();
    setCargando(true);
    try {
      const res = await fetch(`${API}/evaluaciones`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setEvaluaciones(data || []);
    } catch {
      /* silent */
    } finally {
      setCargando(false);
    }
  };

  const accion = async (url: string, method: string, body?: object) => {
    const token = getToken();
    const res = await fetch(`${API}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al procesar la solicitud');
    return data;
  };

  const handleLanzarSesion = async (idEvaluacion: number) => {
    try {
      const data = await accion('/sesiones', 'POST', { idEvaluacion });
      router.push(`/docente/sesion/${data.idSesion}`);
    } catch (e: any) {
      mostrarMensaje('error', e.message);
    }
  };

  const handleCambiarEstado = async (idEvaluacion: number, estado: string) => {
    setMenuAbierto(null);
    try {
      await accion(`/evaluaciones/${idEvaluacion}/estado`, 'PATCH', { estado });
      mostrarMensaje('ok', `Evaluación actualizada a: ${estado}`);
      cargarEvaluaciones();
    } catch (e: any) {
      mostrarMensaje('error', e.message);
    }
  };

  const handleDuplicar = async (idEvaluacion: number) => {
    setMenuAbierto(null);
    try {
      await accion(`/evaluaciones/${idEvaluacion}/duplicar`, 'POST');
      mostrarMensaje('ok', 'Evaluación duplicada correctamente');
      cargarEvaluaciones();
    } catch (e: any) {
      mostrarMensaje('error', e.message);
    }
  };

  const handleEliminar = async (idEvaluacion: number) => {
    setConfirmEliminar(null);
    try {
      await accion(`/evaluaciones/${idEvaluacion}`, 'DELETE');
      mostrarMensaje('ok', 'Evaluación eliminada');
      cargarEvaluaciones();
    } catch (e: any) {
      mostrarMensaje('error', e.message);
    }
  };

  // Métricas agregadas
  const totalEvaluaciones = evaluaciones.length;
  const publicadas = evaluaciones.filter((e) => e.estado === 'PUBLICADA').length;
  const borradores = evaluaciones.filter((e) => e.estado === 'BORRADOR').length;

  return (
    <main className="flex-1 min-h-screen bg-slate-50 font-sans text-slate-800 p-8 space-y-8">
      {/* Saludo principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">¡Bienvenido, {nombreDocente}!</h1>
          <p className="text-slate-500 mt-1 text-sm">Resumen general de tu plataforma de evaluaciones.</p>
        </div>
        <Link
          href="/docente/evaluacion/nueva"
          className="inline-flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-full shadow-lg shadow-blue-500/25 transition-colors w-max"
        >
          <span>➕</span> Nueva Evaluación
        </Link>
      </div>

      {/* Toast de Notificaciones */}
      {mensaje && (
        <div
          className={`px-5 py-4 rounded-2xl text-xs font-bold flex items-center gap-3 shadow-sm ${
            mensaje.tipo === 'ok'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          <span>{mensaje.tipo === 'ok' ? '✓' : '✕'}</span>
          {mensaje.texto}
        </div>
      )}

      {/* Tarjetas resumen métrico */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <p className="text-3xl font-black text-slate-900">{totalEvaluaciones}</p>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Evaluaciones Totales</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <p className="text-3xl font-black text-green-600">{publicadas}</p>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Publicadas (Listas para lanzar)</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <p className="text-3xl font-black text-amber-600">{borradores}</p>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Borradores en Edición</p>
        </div>
        <Link
          href="/docente/reportes"
          className="bg-blue-600 hover:bg-blue-700 text-white border border-blue-500 rounded-3xl p-6 shadow-md shadow-blue-500/20 flex flex-col justify-between transition-colors"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-blue-200">Informes</p>
          <div>
            <p className="text-xl font-bold">Ver Reportes Generales →</p>
            <p className="text-[11px] text-blue-100 mt-1">Estadísticas por sesión y participante</p>
          </div>
        </Link>
      </div>

      {/* Sección Evaluaciones Recientes */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Evaluaciones Recientes</h2>
            <p className="text-xs text-slate-400 mt-0.5">Acciones rápidas para editar, publicar o lanzar sesión</p>
          </div>
          <Link href="/docente/biblioteca" className="text-xs font-bold text-blue-600 hover:underline">
            Ver todas en Mi Biblioteca →
          </Link>
        </div>

        {cargando ? (
          <div className="py-12 text-center text-slate-400 text-xs animate-pulse">Cargando evaluaciones...</div>
        ) : evaluaciones.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <p className="font-bold text-slate-700 text-sm">Aún no has creado ninguna evaluación</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Comienza creando tu primera evaluación para configurar preguntas y lanzar sesiones de examen.
            </p>
            <Link
              href="/docente/evaluacion/nueva"
              className="inline-block px-5 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-full shadow-md"
            >
              + Crear Evaluación
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {evaluaciones.slice(0, 6).map((e) => (
              <div
                key={e.idEvaluacion}
                className="bg-slate-50 border border-slate-200 hover:border-blue-300 rounded-3xl p-6 flex flex-col justify-between space-y-4 transition-all relative"
              >
                {/* Header Tarjeta */}
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`px-3 py-1 text-[11px] font-bold rounded-full uppercase border ${
                      ESTADO_BADGE[e.estado] || 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {e.estado}
                  </span>

                  {/* Menú de acciones */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuAbierto(menuAbierto === e.idEvaluacion ? null : e.idEvaluacion)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      ···
                    </button>

                    {menuAbierto === e.idEvaluacion && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden text-xs py-1 space-y-0.5"
                      >
                        <Link
                          href={`/docente/evaluacion/${e.idEvaluacion}/editar`}
                          className="block px-4 py-2 hover:bg-slate-50 font-medium text-slate-700"
                        >
                          ✏️ Editar
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDuplicar(e.idEvaluacion)}
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 font-medium text-slate-700"
                        >
                          📋 Duplicar
                        </button>
                        {e.estado !== 'PUBLICADA' && (
                          <button
                            type="button"
                            onClick={() => handleCambiarEstado(e.idEvaluacion, 'PUBLICADA')}
                            className="w-full text-left px-4 py-2 hover:bg-slate-50 font-medium text-green-700"
                          >
                            🚀 Publicar
                          </button>
                        )}
                        {e.estado !== 'ARCHIVADA' && (
                          <button
                            type="button"
                            onClick={() => handleCambiarEstado(e.idEvaluacion, 'ARCHIVADA')}
                            className="w-full text-left px-4 py-2 hover:bg-slate-50 font-medium text-slate-600"
                          >
                            📦 Archivar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setConfirmEliminar(e.idEvaluacion)}
                          className="w-full text-left px-4 py-2 hover:bg-red-50 font-medium text-red-600 border-t border-slate-100"
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info Principal */}
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-base leading-tight">{e.nombre}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2">
                    {e.descripcion || 'Sin descripción'}
                  </p>
                </div>

                {/* Footer Tarjeta */}
                <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-400">
                  <span>{e.preguntas?.length || 0} preguntas</span>

                  {e.estado === 'PUBLICADA' ? (
                    <button
                      type="button"
                      onClick={() => handleLanzarSesion(e.idEvaluacion)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-sm transition-colors text-xs"
                    >
                      ▶ Lanzar Sesión
                    </button>
                  ) : (
                    <span className="text-[11px] italic text-slate-400">Publica para lanzar</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Confirmar Eliminar */}
      {confirmEliminar !== null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">¿Eliminar evaluación?</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Esta acción eliminará la evaluación y sus preguntas permanentemente. No se puede deshacer.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleEliminar(confirmEliminar)}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-full transition-colors"
              >
                Sí, Eliminar
              </button>
              <button
                type="button"
                onClick={() => setConfirmEliminar(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-full transition-colors"
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
