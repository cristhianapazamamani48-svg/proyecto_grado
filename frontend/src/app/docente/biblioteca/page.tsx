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

export default function MiBibliotecaPage() {
  const router = useRouter();
  const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [menuAbierto, setMenuAbierto] = useState<number | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/docente/login');
      return;
    }
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
    setError('');
    try {
      const res = await fetch(`${API}/evaluaciones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'No se pudieron cargar las evaluaciones.');
      setEvaluaciones(data || []);
    } catch (err: any) {
      setError(err.message || 'Error de conexión con el servidor.');
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
    if (!res.ok) throw new Error(data.message || 'Error al procesar la solicitud.');
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
      mostrarMensaje('ok', `Estado cambiado a: ${estado}`);
      cargarEvaluaciones();
    } catch (e: any) {
      mostrarMensaje('error', e.message);
    }
  };

  const handleDuplicar = async (idEvaluacion: number) => {
    setMenuAbierto(null);
    try {
      await accion(`/evaluaciones/${idEvaluacion}/duplicar`, 'POST');
      mostrarMensaje('ok', 'Evaluación duplicada exitosamente');
      cargarEvaluaciones();
    } catch (e: any) {
      mostrarMensaje('error', e.message);
    }
  };

  const handleEliminar = async (idEvaluacion: number) => {
    setConfirmEliminar(null);
    try {
      await accion(`/evaluaciones/${idEvaluacion}`, 'DELETE');
      mostrarMensaje('ok', 'Evaluación eliminada correctamente');
      cargarEvaluaciones();
    } catch (e: any) {
      mostrarMensaje('error', e.message);
    }
  };

  // Filtrado de evaluaciones
  const evaluacionesFiltradas = evaluaciones.filter((e) => {
    const coincideTexto =
      e.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (e.descripcion && e.descripcion.toLowerCase().includes(busqueda.toLowerCase()));
    if (!coincideTexto) return false;

    if (filtroEstado !== 'TODOS' && e.estado !== filtroEstado) return false;
    return true;
  });

  return (
    <main className="flex-1 min-h-screen bg-slate-50 font-sans text-slate-800 p-8 space-y-8">
      {/* Header del Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Mi Biblioteca</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Gestión completa y repositorio de tus evaluaciones creadas.
          </p>
        </div>
        <Link
          href="/docente/evaluacion/nueva"
          className="inline-flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-full shadow-lg shadow-blue-500/25 transition-colors w-max"
        >
          <span>➕</span> Crear Nueva Evaluación
        </Link>
      </div>

      {/* Toast Notificación */}
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

      {/* Barra de Búsqueda y Filtros */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:w-96">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o descripción..."
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="text-xs font-bold text-slate-400 uppercase">Estado:</span>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="TODOS">Todas las evaluaciones</option>
            <option value="PUBLICADA">Publicadas</option>
            <option value="BORRADOR">Borradores</option>
            <option value="ARCHIVADA">Archivadas</option>
          </select>
        </div>
      </div>

      {/* Lista / Grid de Evaluaciones */}
      {cargando ? (
        <div className="py-20 text-center text-slate-400 text-xs font-semibold animate-pulse">
          Cargando biblioteca de evaluaciones...
        </div>
      ) : error ? (
        <div className="bg-white border border-red-200 p-8 rounded-3xl text-center text-red-600 text-sm font-bold shadow-sm">
          {error}
        </div>
      ) : evaluacionesFiltradas.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center space-y-3 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center text-3xl mx-auto font-bold">
            📚
          </div>
          <p className="font-bold text-slate-800 text-base">No se encontraron evaluaciones</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {busqueda || filtroEstado !== 'TODOS'
              ? 'Intenta ajustar los criterios de búsqueda o filtro.'
              : 'Empieza creando tu primera evaluación para estructurar preguntas y sesiones.'}
          </p>
          <Link
            href="/docente/evaluacion/nueva"
            className="inline-block px-5 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-full shadow-md mt-2"
          >
            + Crear Evaluación
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {evaluacionesFiltradas.map((e) => (
            <div
              key={e.idEvaluacion}
              className="bg-white border border-slate-200 hover:border-blue-300 rounded-3xl p-6 flex flex-col justify-between space-y-4 shadow-sm transition-all relative"
            >
              {/* Top Header Card */}
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`px-3 py-1 text-[11px] font-bold rounded-full uppercase border ${
                    ESTADO_BADGE[e.estado] || 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {e.estado}
                </span>

                {/* Menú Tres Puntos */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuAbierto(menuAbierto === e.idEvaluacion ? null : e.idEvaluacion)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-bold"
                  >
                    ···
                  </button>

                  {menuAbierto === e.idEvaluacion && (
                    <div
                      ref={menuRef}
                      className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden text-xs py-1 space-y-0.5"
                    >
                      <Link
                        href={`/docente/evaluacion/${e.idEvaluacion}/editar`}
                        className="block px-4 py-2 hover:bg-slate-50 font-medium text-slate-700"
                      >
                        ✏️ Editar Estructura
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDuplicar(e.idEvaluacion)}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 font-medium text-slate-700"
                      >
                        📋 Duplicar Evaluación
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
                      {e.estado !== 'BORRADOR' && (
                        <button
                          type="button"
                          onClick={() => handleCambiarEstado(e.idEvaluacion, 'BORRADOR')}
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 font-medium text-amber-700"
                        >
                          📝 Cambiar a Borrador
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

              {/* Título y Descripción */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-slate-900 text-base leading-snug">{e.nombre}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {e.descripcion || 'Sin descripción asignada'}
                </p>
              </div>

              {/* Metadatos adicionales */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <div>
                  <span className="font-semibold text-slate-400 block">Preguntas:</span>
                  <span className="font-bold text-slate-800">{e.preguntas?.length || 0}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400 block">Sesiones Lanzadas:</span>
                  <span className="font-bold text-slate-800">{e._count?.sesiones ?? 0}</span>
                </div>
                <div className="col-span-2 text-[10px] text-slate-400 pt-1">
                  Actualizada:{' '}
                  {e.fechaActualizacion ? new Date(e.fechaActualizacion).toLocaleDateString('es-BO') : '—'}
                </div>
              </div>

              {/* Botón Lanzar */}
              <div className="pt-2">
                {e.estado === 'PUBLICADA' ? (
                  <button
                    type="button"
                    onClick={() => handleLanzarSesion(e.idEvaluacion)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-md shadow-blue-500/20 transition-colors text-xs text-center"
                  >
                    ▶ Lanzar Nueva Sesión
                  </button>
                ) : (
                  <div className="w-full py-2 bg-slate-50 border border-slate-200 text-slate-400 font-medium text-[11px] text-center rounded-full">
                    Publica para habilitar lanzamiento
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Confirmar Eliminar */}
      {confirmEliminar !== null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">¿Eliminar esta evaluación?</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Esta acción eliminará permanentemente la evaluación y sus preguntas. No se puede deshacer.
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
