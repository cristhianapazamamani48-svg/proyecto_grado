'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('uub_docente_token') : null;
}

const TIPO_LABEL: Record<string, string> = {
  OPCION_MULTIPLE: 'Opción múltiple',
  SELECCION_MULTIPLE: 'Selección múltiple',
  VERDADERO_FALSO: 'Verdadero / Falso',
  COMPLETAR: 'Completar espacios',
  ABIERTA: 'Respuesta abierta',
};

const TIPO_EVENTO_LABEL: Record<string, { label: string; icon: string }> = {
  CAMBIO_PESTANA: { label: 'Cambio de pestaña', icon: '📑' },
  PERDIDA_FOCO: { label: 'Pérdida de foco', icon: '👁️' },
  CLICK_DERECHO: { label: 'Clic derecho', icon: '🖱️' },
  COPIAR: { label: 'Copia de texto', icon: '📋' },
  PEGAR: { label: 'Pegado de texto', icon: '📌' },
  REDIMENSIONAR: { label: 'Redimensionamiento', icon: '📐' },
};

export default function ReporteSesionPage() {
  const router = useRouter();
  const params = useParams();
  const idSesion = Number(params.id);

  const [reporte, setReporte] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [tabActiva, setTabActiva] = useState<'RESULTADOS' | 'ABIERTAS' | 'MONITOREO'>('RESULTADOS');
  const [participanteExpandido, setParticipanteExpandido] = useState<number | null>(null);

  // Estados para corrección manual
  const [calificacionesForm, setCalificacionesForm] = useState<
    Record<number, { puntaje: number | ''; comentario: string; guardando?: boolean; exito?: boolean }>
  >({});

  // Filtros de monitoreo
  const [filtroMonitoreoEstudiante, setFiltroMonitoreoEstudiante] = useState('TODOS');
  const [filtroMonitoreoTipo, setFiltroMonitoreoTipo] = useState('TODOS');

  const cargar = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.push('/docente/login');
      return;
    }

    try {
      const res = await fetch(`${API}/sesiones/${idSesion}/reporte`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError('No se pudo cargar el reporte.');
        return;
      }
      const data = await res.json();
      setReporte(data);

      // Pre-cargar valores de respuestas abiertas
      const forms: Record<number, any> = {};
      data.participantes?.forEach((p: any) => {
        p.respuestas?.forEach((r: any) => {
          if (r.tipo === 'ABIERTA' && r.idRespuesta) {
            forms[r.idRespuesta] = {
              puntaje: r.puntajeObtenido !== null ? r.puntajeObtenido : '',
              comentario: r.comentarioDocente || '',
            };
          }
        });
      });
      setCalificacionesForm(forms);
    } catch {
      setError('Error de conexión.');
    } finally {
      setCargando(false);
    }
  }, [idSesion, router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleGuardarCalificacion = async (idRespuesta: number) => {
    const form = calificacionesForm[idRespuesta];
    if (!form || form.puntaje === '') return;

    const token = getToken();
    if (!token) return;

    setCalificacionesForm((prev) => ({
      ...prev,
      [idRespuesta]: { ...prev[idRespuesta], guardando: true },
    }));

    try {
      const res = await fetch(`${API}/sesiones/respuestas/${idRespuesta}/calificar`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          puntaje: Number(form.puntaje),
          comentario: form.comentario,
        }),
      });

      if (!res.ok) {
        alert('Error al guardar la calificación.');
        return;
      }

      setCalificacionesForm((prev) => ({
        ...prev,
        [idRespuesta]: { ...prev[idRespuesta], guardando: false, exito: true },
      }));

      // Recargar reporte para actualizar promedios y notas
      await cargar();
    } catch {
      alert('Error de conexión.');
      setCalificacionesForm((prev) => ({
        ...prev,
        [idRespuesta]: { ...prev[idRespuesta], guardando: false },
      }));
    }
  };

  if (cargando) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-slate-400 font-semibold text-sm animate-pulse">Generando reporte de sesión...</p>
      </main>
    );
  }

  if (error || !reporte) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-red-200 p-8 rounded-3xl max-w-md text-center space-y-4 shadow-sm">
          <p className="text-red-600 font-bold text-sm">{error || 'No se encontró la sesión.'}</p>
          <Link href="/docente/dashboard" className="text-blue-600 hover:underline text-xs font-bold">
            ← Volver al Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const { sesion, evaluacion, resumen, participantes } = reporte;

  // Extraer todas las respuestas abiertas
  const listaRespuestasAbiertas: any[] = [];
  participantes?.forEach((p: any) => {
    p.respuestas?.forEach((r: any) => {
      if (r.tipo === 'ABIERTA' && r.idRespuesta) {
        listaRespuestasAbiertas.push({
          ...r,
          idParticipante: p.idParticipante,
          nombreParticipante: p.nombre,
        });
      }
    });
  });

  // Extraer todos los eventos de monitoreo
  const todosLosEventos: any[] = [];
  participantes?.forEach((p: any) => {
    p.eventosMonitoreo?.forEach((e: any) => {
      todosLosEventos.push({
        ...e,
        nombreParticipante: p.nombre,
      });
    });
  });
  todosLosEventos.sort((a, b) => new Date(b.fechaEvento).getTime() - new Date(a.fechaEvento).getTime());

  const eventosFiltrados = todosLosEventos.filter((ev) => {
    if (filtroMonitoreoEstudiante !== 'TODOS' && ev.nombreParticipante !== filtroMonitoreoEstudiante) return false;
    if (filtroMonitoreoTipo !== 'TODOS' && ev.tipo !== filtroMonitoreoTipo) return false;
    return true;
  });

  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            href={`/docente/sesion/${idSesion}`}
            className="text-slate-400 hover:text-slate-700 text-sm font-semibold transition-colors"
          >
            ← Control de Sesión
          </Link>
          <span className="text-slate-200">|</span>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-none">Reporte de Evaluación</h1>
            <p className="text-xs text-slate-400 mt-0.5">{evaluacion?.nombre}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
            Sesión: {sesion?.codigo}
          </span>
        </div>
      </header>

      <div className="max-w-6xl w-full mx-auto px-6 py-8 space-y-8">
        {/* Metadatos de Sesión */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-wrap gap-8 text-xs">
          <div>
            <p className="text-slate-400 font-bold uppercase tracking-wider">Estado</p>
            <p className="font-bold text-slate-900 text-sm mt-1">{sesion?.estado}</p>
          </div>
          <div>
            <p className="text-slate-400 font-bold uppercase tracking-wider">Inicio</p>
            <p className="font-semibold text-slate-700 text-sm mt-1">
              {sesion?.fechaInicio ? new Date(sesion.fechaInicio).toLocaleString('es-BO') : '—'}
            </p>
          </div>
          <div>
            <p className="text-slate-400 font-bold uppercase tracking-wider">Cierre</p>
            <p className="font-semibold text-slate-700 text-sm mt-1">
              {sesion?.fechaFin ? new Date(sesion.fechaFin).toLocaleString('es-BO') : 'En curso'}
            </p>
          </div>
          <div>
            <p className="text-slate-400 font-bold uppercase tracking-wider">Puntaje Máximo</p>
            <p className="font-semibold text-slate-700 text-sm mt-1">{evaluacion?.puntajeMaximoPosible} pts</p>
          </div>
          {resumen?.totalAbiertasPendientes > 0 && (
            <div className="ml-auto">
              <span className="px-3.5 py-1.5 bg-amber-50 text-amber-700 font-bold rounded-full border border-amber-200">
                ⚠️ {resumen.totalAbiertasPendientes} respuesta(s) abierta(s) por corregir
              </span>
            </div>
          )}
        </div>

        {/* Tarjetas de Métricas Resumen */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center shadow-sm">
            <p className="text-3xl font-black text-slate-900">{resumen?.totalParticipantes}</p>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Total Estudiantes</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center shadow-sm">
            <p className="text-3xl font-black text-blue-600">{resumen?.enProgreso}</p>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">En Progreso</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center shadow-sm">
            <p className="text-3xl font-black text-green-600">{resumen?.finalizados}</p>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Finalizados</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center shadow-sm">
            <p className="text-3xl font-black text-slate-900">{resumen?.puntajePromedio?.toFixed(1)}</p>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Puntaje Promedio</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center shadow-sm">
            <p className="text-3xl font-black text-blue-600">{resumen?.porcentajePromedio?.toFixed(1)}%</p>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">% Promedio</p>
          </div>
        </div>

        {/* Pestañas de Navegación */}
        <div className="flex border-b border-slate-200 gap-6 text-sm font-bold">
          <button
            onClick={() => setTabActiva('RESULTADOS')}
            className={`pb-3 transition-colors border-b-2 ${
              tabActiva === 'RESULTADOS'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            👥 Resultados por Estudiante
          </button>
          <button
            onClick={() => setTabActiva('ABIERTAS')}
            className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
              tabActiva === 'ABIERTAS'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <span>📝 Corrección de Respuestas Abiertas</span>
            {resumen?.totalAbiertasPendientes > 0 && (
              <span className="w-5 h-5 bg-amber-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                {resumen.totalAbiertasPendientes}
              </span>
            )}
          </button>
          <button
            onClick={() => setTabActiva('MONITOREO')}
            className={`pb-3 transition-colors border-b-2 ${
              tabActiva === 'MONITOREO'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            🛡️ Registro de Monitoreo e Integridad ({todosLosEventos.length})
          </button>
        </div>

        {/* TAB 1: RESULTADOS POR ESTUDIANTE */}
        {tabActiva === 'RESULTADOS' && (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 text-sm">Desglose de Calificaciones</h2>
              <p className="text-xs text-slate-400">Haz clic en un estudiante para ver el detalle de sus respuestas</p>
            </div>

            {participantes?.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">No hay participantes registrados.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {participantes?.map((p: any) => (
                  <div key={p.idParticipante}>
                    <button
                      type="button"
                      onClick={() =>
                        setParticipanteExpandido(
                          participanteExpandido === p.idParticipante ? null : p.idParticipante,
                        )
                      }
                      className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 font-bold text-sm flex items-center justify-center">
                          {p.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{p.nombre}</p>
                          <p className="text-xs text-slate-400">
                            {p.fechaFinalizacion
                              ? `Finalizado a las ${new Date(p.fechaFinalizacion).toLocaleTimeString('es-BO')}`
                              : 'En progreso'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-lg font-black text-slate-900">
                            {p.puntajeTotal !== null ? Number(p.puntajeTotal).toFixed(1) : '—'}
                            <span className="text-xs font-normal text-slate-400"> / {evaluacion?.puntajeMaximoPosible}</span>
                          </p>
                          <p className="text-xs font-semibold text-blue-600">
                            {p.porcentaje !== null ? `${Math.round(Number(p.porcentaje))}%` : '—'}
                          </p>
                        </div>
                        <span className="text-slate-300 text-sm">
                          {participanteExpandido === p.idParticipante ? '▲' : '▼'}
                        </span>
                      </div>
                    </button>

                    {/* Detalle Desplegable */}
                    {participanteExpandido === p.idParticipante && (
                      <div className="px-6 pb-6 bg-slate-50 border-t border-slate-100 space-y-3 pt-4">
                        {p.respuestas?.map((r: any, idx: number) => (
                          <div
                            key={r.idPregunta}
                            className={`bg-white border rounded-2xl p-4 shadow-sm ${
                              r.esCorrecta === true
                                ? 'border-green-200'
                                : r.esCorrecta === false
                                ? 'border-red-200'
                                : 'border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-400 uppercase">
                                    Pregunta #{idx + 1} · {TIPO_LABEL[r.tipo] || r.tipo}
                                  </span>
                                  {r.tipo === 'ABIERTA' && !r.corregidoDocente && (
                                    <span className="text-[11px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                                      Pendiente de corrección
                                    </span>
                                  )}
                                  {r.tipo === 'ABIERTA' && r.corregidoDocente && (
                                    <span className="text-[11px] bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full border border-green-200">
                                      Corregida por {r.correctorNombre || 'docente'}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm font-semibold text-slate-800">{r.enunciado}</p>

                                <div className="text-xs text-slate-600 pt-1">
                                  {r.respuestaTexto && (
                                    <p>
                                      <strong>Respuesta del estudiante:</strong> {r.respuestaTexto}
                                    </p>
                                  )}
                                  {r.opcionesSeleccionadas?.length > 0 && (
                                    <p>
                                      <strong>Opciones elegidas:</strong> {r.opcionesSeleccionadas.join(', ')}
                                    </p>
                                  )}
                                  {r.comentarioDocente && (
                                    <p className="text-blue-700 mt-1">
                                      <strong>Comentario del docente:</strong> {r.comentarioDocente}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="text-right flex-shrink-0">
                                <p
                                  className={`text-lg font-black ${
                                    r.esCorrecta === true
                                      ? 'text-green-600'
                                      : r.esCorrecta === false
                                      ? 'text-red-500'
                                      : 'text-slate-600'
                                  }`}
                                >
                                  {r.puntajeObtenido !== null ? Number(r.puntajeObtenido).toFixed(1) : '—'}
                                </p>
                                <p className="text-xs text-slate-400">/ {r.puntajeMaximo} pts</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CORRECCIÓN DE RESPUESTAS ABIERTAS */}
        {tabActiva === 'ABIERTAS' && (
          <div className="space-y-4">
            {listaRespuestasAbiertas.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 text-xs">
                Esta evaluación no incluye preguntas de respuesta abierta.
              </div>
            ) : (
              listaRespuestasAbiertas.map((item) => {
                const form = calificacionesForm[item.idRespuesta] || { puntaje: '', comentario: '' };

                return (
                  <div
                    key={item.idRespuesta}
                    className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <span className="font-bold text-slate-900 text-sm">{item.nombreParticipante}</span>
                        <span className="text-slate-400 mx-2">·</span>
                        <span className="text-xs font-semibold text-slate-500">
                          Puntaje máximo: {item.puntajeMaximo} pts
                        </span>
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-bold rounded-full ${
                          item.corregidoDocente
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {item.corregidoDocente ? '✓ Corregida' : '⏳ Pendiente'}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Pregunta</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{item.enunciado}</p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                        Respuesta del Estudiante
                      </p>
                      <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {item.respuestaTexto || <span className="italic text-slate-400">Sin respuesta enviada</span>}
                      </p>
                    </div>

                    {/* Formulario de Calificación */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end pt-2">
                      <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                          Puntaje Asignado (0 a {item.puntajeMaximo})
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max={item.puntajeMaximo}
                          value={form.puntaje}
                          onChange={(e) =>
                            setCalificacionesForm((prev) => ({
                              ...prev,
                              [item.idRespuesta]: {
                                ...prev[item.idRespuesta],
                                puntaje: e.target.value !== '' ? Number(e.target.value) : '',
                              },
                            }))
                          }
                          placeholder={`0 - ${item.puntajeMaximo}`}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="md:col-span-6">
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                          Comentario / Retroalimentación
                        </label>
                        <input
                          type="text"
                          value={form.comentario}
                          onChange={(e) =>
                            setCalificacionesForm((prev) => ({
                              ...prev,
                              [item.idRespuesta]: { ...prev[item.idRespuesta], comentario: e.target.value },
                            }))
                          }
                          placeholder="Observaciones o correcciones para el estudiante..."
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <button
                          type="button"
                          disabled={form.guardando || form.puntaje === ''}
                          onClick={() => handleGuardarCalificacion(item.idRespuesta)}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/25 transition-colors disabled:opacity-40"
                        >
                          {form.guardando ? 'Guardando...' : form.exito ? '✓ Calificado' : 'Guardar Calificación'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 3: REGISTRO DE MONITOREO E INTEGRIDAD */}
        {tabActiva === 'MONITOREO' && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-900 text-sm">Historial de Eventos de Integridad</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Registro cronológico de todas las infracciones capturadas durante la sesión
                </p>
              </div>

              {/* Filtros */}
              <div className="flex items-center gap-3">
                <select
                  value={filtroMonitoreoEstudiante}
                  onChange={(e) => setFiltroMonitoreoEstudiante(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold"
                >
                  <option value="TODOS">Todos los estudiantes</option>
                  {participantes?.map((p: any) => (
                    <option key={p.idParticipante} value={p.nombre}>
                      {p.nombre}
                    </option>
                  ))}
                </select>

                <select
                  value={filtroMonitoreoTipo}
                  onChange={(e) => setFiltroMonitoreoTipo(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold"
                >
                  <option value="TODOS">Todos los tipos de evento</option>
                  {Object.keys(TIPO_EVENTO_LABEL).map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {TIPO_EVENTO_LABEL[tipo].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {eventosFiltrados.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No se registraron eventos de monitoreo con los filtros seleccionados.
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {eventosFiltrados.map((ev, i) => {
                  const info = TIPO_EVENTO_LABEL[ev.tipo] || { label: ev.tipo, icon: '⚠️' };
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{info.icon}</span>
                        <div>
                          <span className="font-bold text-slate-900">{ev.nombreParticipante}</span>
                          <span className="text-slate-400 mx-2">·</span>
                          <span className="font-semibold text-red-600">{info.label}</span>
                          {ev.detalle && <span className="text-slate-500 text-[11px] ml-2">({ev.detalle})</span>}
                        </div>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {ev.fechaEvento ? new Date(ev.fechaEvento).toLocaleString('es-BO') : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
