'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Copy,
  Rocket,
  Archive,
  Trash2,
  Play,
  FileQuestion,
  Users,
  Calendar,
} from 'lucide-react';
import ConfiguracionEvaluacionModal, {
  obtenerConfiguracionEvaluacion,
  type ConfiguracionEvaluacion,
  type EvaluacionConConfiguracion,
} from '@/components/ConfiguracionEvaluacionModal';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('uub_docente_token') : null;
}

const ESTADO_BADGE: Record<string, string> = {
  BORRADOR: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
  PUBLICADA: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
  ARCHIVADA: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
};

interface EvaluacionBiblioteca extends EvaluacionConConfiguracion {
  nombre: string;
  descripcion: string | null;
  estado: string;
  preguntas?: unknown[];
  _count?: { sesiones?: number };
  fechaActualizacion?: string | Date | null;
}

export default function MiBibliotecaPage() {
  const router = useRouter();
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionBiblioteca[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [menuAbierto, setMenuAbierto] = useState<number | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [configuracionPendiente, setConfiguracionPendiente] = useState<{
    evaluacion: EvaluacionBiblioteca;
    accion: 'publicar' | 'lanzar';
  } | null>(null);
  const [guardandoConfiguracion, setGuardandoConfiguracion] = useState(false);
  const [errorConfiguracion, setErrorConfiguracion] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const cargarEvaluaciones = useCallback(async () => {
    const token = getToken();
    setCargando(true);
    setError('');
    try {
      const res = await fetch(`${API}/evaluaciones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          typeof data === 'object' && data !== null && 'message' in data
            ? data.message
            : null;
        throw new Error(
          typeof message === 'string'
            ? message
            : 'No se pudieron cargar las evaluaciones.',
        );
      }
      if (!Array.isArray(data)) {
        throw new Error('El servidor devolvió una respuesta inválida al cargar evaluaciones.');
      }
      setEvaluaciones(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/docente/login');
      return;
    }
    queueMicrotask(() => void cargarEvaluaciones());
  }, [router, cargarEvaluaciones]);

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

  const handleDuplicar = async (id: number) => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/evaluaciones/${id}/duplicar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Error al duplicar');
      mostrarMensaje('ok', 'Evaluación duplicada exitosamente');
      setMenuAbierto(null);
      cargarEvaluaciones();
    } catch (err: unknown) {
      mostrarMensaje('error', err instanceof Error ? err.message : 'Error al duplicar');
    }
  };

  const handleCambiarEstado = async (id: number, nuevoEstado: string) => {
    const evaluacion = evaluaciones.find((item) => item.idEvaluacion === id);
    if (!evaluacion) return;

    if (nuevoEstado === 'PUBLICADA') {
      prepararConfiguracion(evaluacion, 'publicar');
      return;
    }

    await aplicarCambioEstado(evaluacion, nuevoEstado);
  };

  const aplicarCambioEstado = async (
    evaluacion: EvaluacionBiblioteca,
    nuevoEstado: string,
    configuracion?: ConfiguracionEvaluacion,
  ) => {
    const token = getToken();
    try {
      const body: Record<string, unknown> = {
        nombre: evaluacion.nombre,
        descripcion: evaluacion.descripcion,
        estado: nuevoEstado,
      };

      if (configuracion) {
        Object.assign(body, configuracion);
      }

      const res = await fetch(`${API}/evaluaciones/${evaluacion.idEvaluacion}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Error al actualizar estado');
      }

      mostrarMensaje('ok', `Evaluación cambiada a ${nuevoEstado}`);
      setMenuAbierto(null);
      cargarEvaluaciones();
      return true;
    } catch (err: unknown) {
      mostrarMensaje('error', err instanceof Error ? err.message : 'Error al actualizar estado');
      return false;
    }
  };

  const handleEliminar = async (id: number) => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/evaluaciones/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Error al eliminar');
      mostrarMensaje('ok', 'Evaluación eliminada');
      setConfirmEliminar(null);
      cargarEvaluaciones();
    } catch (err: unknown) {
      mostrarMensaje('error', err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const prepararConfiguracion = (evaluacion: EvaluacionBiblioteca, accion: 'publicar' | 'lanzar') => {
    setErrorConfiguracion('');
    setConfiguracionPendiente({
      evaluacion,
      accion,
    });
    setMenuAbierto(null);
  };

  const guardarConfiguracionYProceder = async (configuracion: ConfiguracionEvaluacion) => {
    if (!configuracionPendiente) return;

    const { evaluacion, accion } = configuracionPendiente;
    const token = getToken();
    setGuardandoConfiguracion(true);
    setErrorConfiguracion('');

    try {
      if (accion === 'publicar') {
        const ok = await aplicarCambioEstado(evaluacion, 'PUBLICADA', configuracion);
        if (!ok) return;
        setConfiguracionPendiente(null);
        return;
      }

      const resConfig = await fetch(`${API}/evaluaciones/${evaluacion.idEvaluacion}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombre: evaluacion.nombre,
          descripcion: evaluacion.descripcion,
          estado: evaluacion.estado,
          ...configuracion,
        }),
      });

      if (!resConfig.ok) {
        const errorData = await resConfig.json().catch(() => ({}));
        throw new Error(errorData.message || 'No se pudo guardar la configuración antes de lanzar la sesión');
      }

      const resSesion = await fetch(`${API}/sesiones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ idEvaluacion: evaluacion.idEvaluacion }),
      });

      if (!resSesion.ok) {
        const err = await resSesion.json().catch(() => ({}));
        throw new Error(err.message || 'Error al crear la sesión');
      }

      const sesion = await resSesion.json();
      setConfiguracionPendiente(null);
      router.push(`/docente/sesion/${sesion.idSesion}`);
    } catch (err: unknown) {
      setErrorConfiguracion(
        err instanceof Error ? err.message : 'Ocurrió un error al procesar la solicitud',
      );
    } finally {
      setGuardandoConfiguracion(false);
    }
  };

  const evaluacionesFiltradas = evaluaciones.filter((e) => {
    const matchBusqueda =
      e.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      e.descripcion?.toLowerCase().includes(busqueda.toLowerCase());
    if (!matchBusqueda) return false;
    if (filtroEstado !== 'TODOS' && e.estado !== filtroEstado) return false;
    return true;
  });

  const totalEvaluaciones = evaluaciones.length;
  const publicadas = evaluaciones.filter((e) => e.estado === 'PUBLICADA').length;
  const borradores = evaluaciones.filter((e) => e.estado === 'BORRADOR').length;

  return (
    <main className="flex-1 min-h-screen bg-[#fafafc] dark:bg-[#0d0b14] font-sans text-slate-800 dark:text-slate-100 p-8 space-y-8 transition-colors">
      {/* Header del Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Mi Biblioteca</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Gestión completa y repositorio de tus evaluaciones creadas.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/docente/reportes"
            className="inline-flex items-center gap-2 rounded-full border border-[#e8e3f2] dark:border-[#26203a] bg-white dark:bg-[#171424] px-5 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs transition-colors hover:bg-purple-50/60 dark:hover:bg-[#1f1a30]"
          >
            <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" /> Reportes e informes
          </Link>
          <Link
            href="/docente/dashboard"
            className="inline-flex items-center gap-2 rounded-full bg-purple-600 hover:bg-purple-700 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-purple-500/25 transition-colors"
          >
            <Plus className="w-4 h-4" /> Crear Nueva Evaluación
          </Link>
        </div>
      </div>

      {/* Toast Notificación */}
      {mensaje && (
        <div
          className={`px-5 py-4 rounded-2xl text-xs font-bold flex items-center gap-3 shadow-xs ${
            mensaje.tipo === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300'
          }`}
        >
          <span>{mensaje.tipo === 'ok' ? '✓' : '✕'}</span>
          {mensaje.texto}
        </div>
      )}

      {/* Resumen con Paleta Combinada de Colores Pasteles */}
      <section aria-label="Resumen de evaluaciones" className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {/* Total: Púrpura Pastel Claro */}
        <div className="rounded-3xl border border-purple-200/90 dark:border-purple-900/50 bg-purple-50/70 dark:bg-purple-950/25 p-6 shadow-xs">
          <p className="text-3xl font-black text-purple-950 dark:text-purple-100">{cargando ? '—' : totalEvaluaciones}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">Evaluaciones totales</p>
        </div>
        {/* Publicadas: Menta / Esmeralda Pastel */}
        <div className="rounded-3xl border border-emerald-200/90 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/25 p-6 shadow-xs">
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{cargando ? '—' : publicadas}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Publicadas</p>
        </div>
        {/* Borradores: Ámbar / Miel Pastel */}
        <div className="rounded-3xl border border-amber-200/90 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/25 p-6 shadow-xs">
          <p className="text-3xl font-black text-amber-600 dark:text-amber-400">{cargando ? '—' : borradores}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Borradores</p>
        </div>
      </section>

      {/* Barra de Búsqueda y Filtros en Blanco Web Puro */}
      <div className="bg-white dark:bg-[#171424] border border-[#e8e3f2] dark:border-[#26203a] rounded-3xl p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o descripción..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#fafafc] dark:bg-[#110f1a] border border-[#e8e3f2] dark:border-[#26203a] rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-purple-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="text-xs font-bold text-slate-400 uppercase">Estado:</span>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="bg-[#fafafc] dark:bg-[#110f1a] border border-[#e8e3f2] dark:border-[#26203a] rounded-xl px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="TODOS">Todas las evaluaciones</option>
            <option value="PUBLICADA">Publicadas</option>
            <option value="BORRADOR">Borradores</option>
            <option value="ARCHIVADA">Archivadas</option>
          </select>
        </div>
      </div>

      {/* Lista / Grid de Evaluaciones en Blanco Web Puro */}
      {cargando ? (
        <div className="py-20 text-center text-slate-400 text-xs font-semibold animate-pulse">
          Cargando biblioteca de evaluaciones...
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-[#171424] border border-rose-200 dark:border-rose-800 p-8 rounded-3xl text-center text-rose-600 dark:text-rose-400 text-sm font-bold shadow-xs">
          {error}
        </div>
      ) : evaluacionesFiltradas.length === 0 ? (
        <div className="bg-white dark:bg-[#171424] border border-[#e8e3f2] dark:border-[#26203a] rounded-3xl p-16 text-center space-y-3 shadow-xs">
          <div className="w-16 h-16 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mx-auto">
            <FileQuestion className="w-8 h-8" />
          </div>
          <p className="font-bold text-slate-800 dark:text-slate-100 text-base">No se encontraron evaluaciones</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {busqueda || filtroEstado !== 'TODOS'
              ? 'Intenta ajustar los criterios de búsqueda o filtro.'
              : 'Empieza creando tu primera evaluación para estructurar preguntas y sesiones.'}
          </p>
          <Link
            href="/docente/evaluacion/nueva"
            className="inline-block px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-full shadow-md mt-2"
          >
            + Crear Evaluación
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {evaluacionesFiltradas.map((e) => (
            <div
              key={e.idEvaluacion}
              className="bg-white dark:bg-[#171424] border border-[#e8e3f2] dark:border-[#26203a] hover:border-purple-400 dark:hover:border-purple-500 rounded-3xl p-6 flex flex-col justify-between space-y-4 shadow-xs hover:shadow-xl transition-all relative group"
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
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-purple-50 dark:hover:bg-[#1f1a30] transition-colors cursor-pointer"
                    aria-label="Opciones"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {menuAbierto === e.idEvaluacion && (
                    <div
                      ref={menuRef}
                      className="absolute right-0 mt-1 w-48 bg-white dark:bg-[#171424] border border-[#e8e3f2] dark:border-[#26203a] rounded-2xl shadow-xl z-20 overflow-hidden text-xs py-1 space-y-0.5"
                    >
                      <Link
                        href={`/docente/evaluacion/${e.idEvaluacion}/editar`}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-purple-50 dark:hover:bg-[#1f1a30] font-medium text-slate-700 dark:text-slate-200"
                      >
                        <Pencil className="w-3.5 h-3.5 text-purple-600" /> Editar Estructura
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDuplicar(e.idEvaluacion)}
                        className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-purple-50 dark:hover:bg-[#1f1a30] font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-violet-600" /> Duplicar Evaluación
                      </button>
                      {e.estado !== 'PUBLICADA' && (
                        <button
                          type="button"
                          onClick={() => handleCambiarEstado(e.idEvaluacion, 'PUBLICADA')}
                          className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-medium text-emerald-700 dark:text-emerald-400 cursor-pointer"
                        >
                          <Rocket className="w-3.5 h-3.5 text-emerald-600" /> Publicar
                        </button>
                      )}
                      {e.estado !== 'BORRADOR' && (
                        <button
                          type="button"
                          onClick={() => handleCambiarEstado(e.idEvaluacion, 'BORRADOR')}
                          className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-amber-50 dark:hover:bg-amber-950/40 font-medium text-amber-700 dark:text-amber-400 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 text-amber-600" /> Cambiar a Borrador
                        </button>
                      )}
                      {e.estado !== 'ARCHIVADA' && (
                        <button
                          type="button"
                          onClick={() => handleCambiarEstado(e.idEvaluacion, 'ARCHIVADA')}
                          className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-[#1f1a30] font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5 text-slate-400" /> Archivar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmEliminar(e.idEvaluacion)}
                        className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium text-rose-600 dark:text-rose-400 border-t border-[#e8e3f2] dark:border-[#26203a] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Título y Descripción */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  {e.nombre}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {e.descripcion || 'Sin descripción asignada'}
                </p>
              </div>

              {/* Metadatos adicionales */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-[#e8e3f2] dark:border-[#26203a]">
                <div className="flex items-center gap-1.5">
                  <FileQuestion className="w-3.5 h-3.5 text-purple-400" />
                  <div>
                    <span className="font-semibold text-slate-400 block text-[10px]">Preguntas:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{e.preguntas?.length || 0}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                  <div>
                    <span className="font-semibold text-slate-400 block text-[10px]">Sesiones:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{e._count?.sesiones ?? 0}</span>
                  </div>
                </div>
                <div className="col-span-2 text-[10px] text-slate-400 pt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-purple-400" />
                  Actualizada:{' '}
                  {e.fechaActualizacion ? new Date(e.fechaActualizacion).toLocaleDateString('es-BO') : '—'}
                </div>
              </div>

              {/* Botón Lanzar */}
              <div className="pt-2">
                {e.estado === 'PUBLICADA' ? (
                  <button
                    type="button"
                    onClick={() => prepararConfiguracion(e, 'lanzar')}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-full shadow-md shadow-purple-500/20 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> Lanzar Nueva Sesión
                  </button>
                ) : (
                  <div className="w-full py-2 bg-[#fafafc] dark:bg-[#110f1a] border border-[#e8e3f2] dark:border-[#26203a] text-slate-400 dark:text-slate-500 font-medium text-[11px] text-center rounded-full">
                    Publica para habilitar lanzamiento
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Configuración */}
      {configuracionPendiente && (
        <ConfiguracionEvaluacionModal
          accion={configuracionPendiente.accion}
          configuracionInicial={obtenerConfiguracionEvaluacion(configuracionPendiente.evaluacion)}
          guardando={guardandoConfiguracion}
          error={errorConfiguracion}
          onCancelar={() => {
            if (guardandoConfiguracion) return;
            setConfiguracionPendiente(null);
            setErrorConfiguracion('');
          }}
          onConfirmar={guardarConfiguracionYProceder}
        />
      )}

      {/* Modal Confirmar Eliminar */}
      {confirmEliminar !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#171424] border border-[#e8e3f2] dark:border-[#26203a] rounded-3xl p-8 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">¿Eliminar esta evaluación?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-300 leading-relaxed">
              Esta acción eliminará permanentemente la evaluación y sus preguntas. No se puede deshacer.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleEliminar(confirmEliminar)}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-full transition-colors cursor-pointer"
              >
                Sí, Eliminar
              </button>
              <button
                type="button"
                onClick={() => setConfirmEliminar(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-[#1f1a30] text-slate-700 dark:text-slate-200 font-bold text-xs rounded-full hover:bg-slate-200 dark:hover:bg-[#292340] transition-colors cursor-pointer"
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
