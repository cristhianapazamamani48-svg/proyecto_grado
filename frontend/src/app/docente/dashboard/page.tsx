'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('uub_docente_token') : null;
}

const ESTADO_BADGE: Record<string, string> = {
  BORRADOR: 'bg-amber-100 text-amber-700',
  PUBLICADA: 'bg-green-100 text-green-700',
  ARCHIVADA: 'bg-slate-100 text-slate-500',
};

export default function DocenteDashboardPage() {
  const router = useRouter();
  const [nombreDocente, setNombreDocente] = useState('');
  const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [codigoSesion, setCodigoSesion] = useState('');
  const [idSesion, setIdSesion] = useState<number | null>(null);
  const [sesionIniciada, setSesionIniciada] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState<number | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = getToken();
    const nombre = localStorage.getItem('uub_docente_nombre');
    if (!token) { router.push('/docente/login'); return; }
    setNombreDocente(nombre || 'Docente');
    cargarEvaluaciones();
  }, [router]);

  // Cerrar menú al hacer click fuera
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
    } catch { /* silent */ } finally { setCargando(false); }
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
      // Redirigir directamente a la página de control de la sesión
      router.push(`/docente/sesion/${data.idSesion}`);
    } catch (e: any) { mostrarMensaje('error', e.message); }
  };

  const handleIniciarSesion = async () => {
    if (!idSesion) return;
    try {
      await accion(`/sesiones/${idSesion}/iniciar`, 'PATCH');
      setSesionIniciada(true);
      mostrarMensaje('ok', 'La evaluación ha comenzado para los estudiantes en espera.');
    } catch (e: any) { mostrarMensaje('error', e.message); }
  };

  const handleCambiarEstado = async (idEvaluacion: number, estado: string) => {
    setMenuAbierto(null);
    try {
      await accion(`/evaluaciones/${idEvaluacion}/estado`, 'PATCH', { estado });
      mostrarMensaje('ok', `Evaluación actualizada a: ${estado}`);
      cargarEvaluaciones();
    } catch (e: any) { mostrarMensaje('error', e.message); }
  };

  const handleDuplicar = async (idEvaluacion: number) => {
    setMenuAbierto(null);
    try {
      await accion(`/evaluaciones/${idEvaluacion}/duplicar`, 'POST');
      mostrarMensaje('ok', 'Evaluación duplicada correctamente');
      cargarEvaluaciones();
    } catch (e: any) { mostrarMensaje('error', e.message); }
  };

  const handleEliminar = async (idEvaluacion: number) => {
    setConfirmEliminar(null);
    try {
      await accion(`/evaluaciones/${idEvaluacion}`, 'DELETE');
      mostrarMensaje('ok', 'Evaluación eliminada');
      cargarEvaluaciones();
    } catch (e: any) { mostrarMensaje('error', e.message); }
  };

  const cerrarSesion = () => {
    localStorage.removeItem('uub_docente_token');
    localStorage.removeItem('uub_docente_nombre');
    router.push('/docente/login');
  };

  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md shadow-blue-500/20">U</div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none">Panel Docente</h1>
            <p className="text-xs text-slate-400 mt-0.5">Hola, {nombreDocente}</p>
          </div>
        </div>
        <button onClick={cerrarSesion} className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-sm font-semibold text-slate-600 rounded-full transition-colors">
          Cerrar Sesión
        </button>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 space-y-8">
        {/* Título + botón nueva */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Mis Evaluaciones</h2>
            <p className="text-slate-500 mt-1 text-sm">Gestiona, edita y lanza tus exámenes desde aquí.</p>
          </div>
          <Link href="/docente/evaluacion/nueva" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-full shadow-lg shadow-blue-500/25 transition-colors w-max">
            <span>+</span> Nueva Evaluación
          </Link>
        </div>

        {/* Toast */}
        {mensaje && (
          <div className={`px-5 py-4 rounded-2xl text-sm font-medium flex items-center gap-3 shadow-sm ${mensaje.tipo === 'ok' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            <span>{mensaje.tipo === 'ok' ? '✓' : '✕'}</span>
            {mensaje.texto}
          </div>
        )}

        {/* Banner código de sesión */}
        {codigoSesion && (
          <div className="p-6 bg-blue-50 border border-blue-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-blue-600 font-bold uppercase tracking-widest">{sesionIniciada ? 'Evaluación iniciada' : 'Sala de espera'}</p>
              <h3 className="text-4xl font-mono font-black text-slate-900 tracking-widest mt-1">{codigoSesion}</h3>
              <p className="text-sm text-slate-500 mt-1">Comparte este código con tus estudiantes.</p>
            </div>
            <div className="flex gap-3">
              {!sesionIniciada && <button onClick={handleIniciarSesion} className="px-5 py-2 bg-blue-600 text-white font-bold text-sm rounded-full hover:bg-blue-700 transition-colors">Iniciar evaluación</button>}
              <button onClick={() => { setCodigoSesion(''); setIdSesion(null); }} className="px-5 py-2 bg-white border border-slate-200 text-slate-600 font-medium text-sm rounded-full hover:bg-slate-50 transition-colors">Cerrar</button>
            </div>
          </div>
        )}

        {/* Modal confirmación eliminar */}
        {confirmEliminar !== null && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full mx-4 space-y-4">
              <h3 className="text-xl font-bold text-slate-900">¿Eliminar evaluación?</h3>
              <p className="text-sm text-slate-500">Esta acción es irreversible. Solo se pueden eliminar evaluaciones en borrador o publicadas sin sesiones.</p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => handleEliminar(confirmEliminar)} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-full transition-colors">
                  Eliminar
                </button>
                <button onClick={() => setConfirmEliminar(null)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-full transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista evaluaciones */}
        {cargando ? (
          <div className="py-24 text-center text-slate-400 animate-pulse text-sm font-medium">Cargando evaluaciones...</div>
        ) : evaluaciones.length === 0 ? (
          <div className="py-24 bg-white border border-slate-200 rounded-3xl text-center space-y-5 shadow-sm">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-4xl">📝</div>
            <h3 className="text-2xl font-bold text-slate-900">Aún no tienes evaluaciones</h3>
            <p className="text-slate-500 max-w-sm mx-auto text-sm leading-relaxed">Comienza creando tu primera evaluación académica con preguntas de distintos tipos.</p>
            <Link href="/docente/evaluacion/nueva" className="inline-block px-8 py-3 bg-blue-600 text-white font-bold text-sm rounded-full shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-colors mt-2">
              Crear Evaluación
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5" ref={menuRef}>
            {evaluaciones.map((ev) => (
              <div key={ev.idEvaluacion} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-5 group">
                {/* Info */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide ${ESTADO_BADGE[ev.estado] || 'bg-slate-100 text-slate-500'}`}>
                      {ev.estado || 'BORRADOR'}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{ev._count?.sesiones || 0} sesión{ev._count?.sesiones !== 1 ? 'es' : ''}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{ev.nombre}</h3>
                    {ev.descripcion && <p className="text-sm text-slate-400 line-clamp-2 mt-1">{ev.descripcion}</p>}
                  </div>
                  <p className="text-xs text-slate-300">{ev.preguntas?.length || 0} pregunta{ev.preguntas?.length !== 1 ? 's' : ''}</p>
                </div>

                {/* Acciones */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 relative">
                    {/* Editar */}
                    <Link
                      href={`/docente/evaluacion/${ev.idEvaluacion}/editar`}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      Editar
                    </Link>

                    {/* Menú desplegable */}
                    <div className="relative">
                      <button
                        onClick={() => setMenuAbierto(menuAbierto === ev.idEvaluacion ? null : ev.idEvaluacion)}
                        className="px-2 py-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-lg leading-none"
                      >
                        ···
                      </button>

                      {menuAbierto === ev.idEvaluacion && (
                        <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 w-52 py-2 overflow-hidden">
                          <button onClick={() => handleDuplicar(ev.idEvaluacion)} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                            <span>📋</span> Duplicar
                          </button>

                          {ev.estado === 'BORRADOR' && (
                            <button onClick={() => handleCambiarEstado(ev.idEvaluacion, 'PUBLICADA')} className="w-full text-left px-4 py-2.5 text-sm text-green-700 hover:bg-green-50 flex items-center gap-2">
                              <span>✓</span> Publicar
                            </button>
                          )}

                          {ev.estado === 'PUBLICADA' && (
                            <button onClick={() => handleCambiarEstado(ev.idEvaluacion, 'ARCHIVADA')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                              <span>📦</span> Archivar
                            </button>
                          )}

                          {ev.estado === 'ARCHIVADA' && (
                            <button onClick={() => handleCambiarEstado(ev.idEvaluacion, 'BORRADOR')} className="w-full text-left px-4 py-2.5 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-2">
                              <span>↩</span> Mover a Borrador
                            </button>
                          )}

                          <div className="border-t border-slate-100 mt-1 pt-1">
                            <button
                              onClick={() => { setMenuAbierto(null); setConfirmEliminar(ev.idEvaluacion); }}
                              className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <span>🗑</span> Eliminar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleLanzarSesion(ev.idEvaluacion)}
                    disabled={ev.estado !== 'PUBLICADA'}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm shadow-blue-500/20"
                    title={ev.estado !== 'PUBLICADA' ? 'Publica la evaluación para poder lanzar sesiones' : 'Lanzar sesión'}
                  >
                    Lanzar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
