'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('uub_docente_token') : null;
}

const ESTADO_SESION_BADGE: Record<string, string> = {
  PENDIENTE: 'bg-amber-50 text-amber-700 border-amber-200',
  ACTIVA: 'bg-green-50 text-green-700 border-green-200',
  FINALIZADA: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function ReportesGeneralesPage() {
  const router = useRouter();
  const [reportes, setReportes] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [evaluacionExpandida, setEvaluacionExpandida] = useState<number | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/docente/login');
      return;
    }

    const cargarReportes = async () => {
      try {
        const res = await fetch(`${API}/evaluaciones/reportes/general`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'No se pudieron cargar los reportes.');
        setReportes(data || []);
      } catch (err: any) {
        setError(err.message || 'Error de conexión.');
      } finally {
        setCargando(false);
      }
    };

    cargarReportes();
  }, [router]);

  // Cálculos consolidados globales
  const totalEvaluaciones = reportes.length;
  const totalSesiones = reportes.reduce((acc, ev) => acc + (ev.totalSesiones || 0), 0);
  const totalParticipantes = reportes.reduce((acc, ev) => acc + (ev.totalParticipantes || 0), 0);
  const totalFinalizados = reportes.reduce((acc, ev) => acc + (ev.finalizados || 0), 0);

  const promediosValidos = reportes
    .filter((ev) => ev.finalizados > 0)
    .map((ev) => ev.promedioGeneral);

  const promedioGlobal =
    promediosValidos.length > 0
      ? Math.round((promediosValidos.reduce((a, b) => a + b, 0) / promediosValidos.length) * 10) / 10
      : 0;

  // Filtrado de evaluaciones
  const reportesFiltrados = reportes.filter((ev) => {
    const coincideTexto = ev.nombre.toLowerCase().includes(busqueda.toLowerCase());
    if (!coincideTexto) return false;
    if (filtroEstado !== 'TODOS' && ev.estado !== filtroEstado) return false;
    return true;
  });

  return (
    <main className="flex-1 min-h-screen bg-slate-50 font-sans text-slate-800 p-8 space-y-8">
      {/* Header del Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Reportes e Informes Generales</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Consolidado estadístico del rendimiento académico por evaluación y sesión.
          </p>
        </div>

        {/* Botones Preparados para Exportaciones Futuras */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            title="Exportación CSV próximamente"
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-400 font-bold text-xs rounded-xl cursor-not-allowed shadow-sm"
          >
            📄 Exportar CSV
          </button>
          <button
            type="button"
            disabled
            title="Exportación Excel próximamente"
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-400 font-bold text-xs rounded-xl cursor-not-allowed shadow-sm"
          >
            📊 Exportar Excel
          </button>
          <button
            type="button"
            disabled
            title="Exportación PDF próximamente"
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-400 font-bold text-xs rounded-xl cursor-not-allowed shadow-sm"
          >
            📕 Exportar PDF
          </button>
        </div>
      </div>

      {/* Métricas Generales Consolidadas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <p className="text-3xl font-black text-slate-900">{totalEvaluaciones}</p>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Evaluaciones Totales</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <p className="text-3xl font-black text-blue-600">{totalSesiones}</p>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Sesiones Lanzadas</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <p className="text-3xl font-black text-green-600">{totalFinalizados}</p>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Exámenes Finalizados</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <p className="text-3xl font-black text-slate-900">{promedioGlobal}%</p>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Promedio Global %</p>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:w-96">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Filtrar reporte por nombre de evaluación..."
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

      {/* Listado Consolidado por Evaluación */}
      {cargando ? (
        <div className="py-20 text-center text-slate-400 text-xs font-semibold animate-pulse">
          Calculando estadísticas e informes...
        </div>
      ) : error ? (
        <div className="bg-white border border-red-200 p-8 rounded-3xl text-center text-red-600 text-sm font-bold shadow-sm">
          {error}
        </div>
      ) : reportesFiltrados.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center text-slate-400 text-xs shadow-sm">
          No hay evaluaciones ni sesiones para mostrar con los filtros aplicados.
        </div>
      ) : (
        <div className="space-y-6">
          {reportesFiltrados.map((ev) => (
            <div
              key={ev.idEvaluacion}
              className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6"
            >
              {/* Header Evaluacion */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900">{ev.nombre}</h2>
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                      {ev.estado}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {ev.totalPreguntas} preguntas · Puntaje máx: {ev.puntajeMaximo} pts
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setEvaluacionExpandida(evaluacionExpandida === ev.idEvaluacion ? null : ev.idEvaluacion)
                  }
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors w-max"
                >
                  {evaluacionExpandida === ev.idEvaluacion
                    ? '▲ Ocultar sesiones'
                    : `▼ Ver sesiones (${ev.totalSesiones})`}
                </button>
              </div>

              {/* Tarjetas resumen de la evaluación */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-slate-900">{ev.totalSesiones}</p>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">Sesiones</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-slate-900">{ev.totalParticipantes}</p>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">Estudiantes</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-blue-600">{ev.promedioGeneral}%</p>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">Promedio %</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-green-600">
                    {ev.mejorResultado !== null ? `${Math.round(ev.mejorResultado)}%` : '—'}
                  </p>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">Mejor Nota</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-amber-600">
                    {ev.menorResultado !== null ? `${Math.round(ev.menorResultado)}%` : '—'}
                  </p>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">Menor Nota</p>
                </div>
              </div>

              {/* Lista Desplegable de Sesiones Relacionadas */}
              {evaluacionExpandida === ev.idEvaluacion && (
                <div className="pt-2 space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Historial de Sesiones Lanzadas ({ev.sesiones.length})
                  </h3>

                  {ev.sesiones.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No se han lanzado sesiones para esta evaluación aún.</p>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                      {ev.sesiones.map((s: any) => (
                        <div
                          key={s.idSesion}
                          className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-black text-blue-600 text-sm">{s.codigo}</span>
                              <span
                                className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase border ${
                                  ESTADO_SESION_BADGE[s.estado] || 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {s.estado}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              Inicio:{' '}
                              {s.fechaInicio
                                ? new Date(s.fechaInicio).toLocaleString('es-BO')
                                : 'No iniciada'}
                            </p>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="text-right text-xs">
                              <p className="font-bold text-slate-900">
                                {s.totalParticipantes} estudiantes ({s.finalizados} finalizados)
                              </p>
                              <p className="text-blue-600 font-semibold">Promedio: {s.promedioPorcentaje}%</p>
                            </div>

                            <Link
                              href={`/docente/sesion/${s.idSesion}/reporte`}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-full shadow-sm transition-colors"
                            >
                              Ver Detalle 📊
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
