'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('uub_docente_token') : null;
}

const ESTADO_PARTICIPANTE: Record<string, { label: string; color: string }> = {
  EN_PROGRESO: { label: 'En progreso', color: 'bg-blue-50 text-blue-700 border border-blue-200' },
  FINALIZADO: { label: 'Finalizado', color: 'bg-green-50 text-green-700 border border-green-200' },
  VENCIDO: { label: 'Vencido', color: 'bg-slate-100 text-slate-500' },
};

const ESTADO_SESION: Record<string, { label: string; color: string }> = {
  PENDIENTE: { label: 'Sala de espera', color: 'bg-amber-50 text-amber-700 border border-amber-200' },
  ACTIVA: { label: 'En curso', color: 'bg-green-50 text-green-700 border border-green-200' },
  FINALIZADA: { label: 'Finalizada', color: 'bg-slate-100 text-slate-500' },
};

const TIPO_EVENTO_LABEL: Record<string, { label: string; icon: string }> = {
  CAMBIO_PESTANA: { label: 'Cambio de pestaña', icon: '📑' },
  PERDIDA_FOCO: { label: 'Pérdida de foco', icon: '👁️' },
  CLICK_DERECHO: { label: 'Clic derecho', icon: '🖱️' },
  COPIAR: { label: 'Copia de texto', icon: '📋' },
  PEGAR: { label: 'Pegado de texto', icon: '📌' },
  REDIMENSIONAR: { label: 'Redimensionamiento', icon: '📐' },
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

  // Monitoreo en tiempo real
  const [infraccionesEnVivo, setInfraccionesEnVivo] = useState<any[]>([]);
  const [filtroEstudiante, setFiltroEstudiante] = useState<string>('TODOS');
  const [filtroTipoEvento, setFiltroTipoEvento] = useState<string>('TODOS');
  const socketRef = useRef<Socket | null>(null);

  const eventosDeParticipantes = (participantes: any[] = []) => participantes.flatMap((participante) =>
    (participante.eventosMonitoreo || []).map((evento: any) => ({
      ...evento,
      idParticipante: participante.idParticipante,
      nombreParticipante: participante.nombre,
    })),
  ).sort((a, b) => new Date(b.fechaEvento).getTime() - new Date(a.fechaEvento).getTime());

  const cargar = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.push('/docente/login');
      return;
    }
    try {
      const res = await fetch(`${API}/sesiones/${idSesion}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError('No se pudo cargar la sesión.');
        return;
      }
      const data = await res.json();
      setSesion(data);
      setInfraccionesEnVivo((actuales) => {
        const historicas = eventosDeParticipantes(data.participantes);
        const combinadas = [...actuales, ...historicas];
        const unicas = new Map(combinadas.map((evento) => [evento.idEvento, evento]));
        return Array.from(unicas.values())
          .sort((a, b) => new Date(b.fechaEvento).getTime() - new Date(a.fechaEvento).getTime())
          .slice(0, 50);
      });
    } catch {
      setError('Error de conexión con el servidor.');
    } finally {
      setCargando(false);
    }
  }, [idSesion, router]);

  useEffect(() => {
    cargar();
    const intervalo = setInterval(() => {
      cargar();
    }, 6000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  // Conexión Socket.IO para eventos en vivo
  useEffect(() => {
    if (!sesion?.codigo) return;

    const socketUrl = API.startsWith('http') ? API : window.location.origin;
    const socket = io(socketUrl, {
      path: API.includes('/api') ? '/socket.io' : undefined,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.emit('unirseASesion', { codigoSesion: sesion.codigo });

    socket.on('eventoMonitoreo', (evento: any) => {
      setInfraccionesEnVivo((prev) => [evento, ...prev].slice(0, 50));
      // Actualizar conteo en tabla de participantes
      setSesion((prevSesion: any) => {
        if (!prevSesion) return prevSesion;
        const parts = prevSesion.participantes.map((p: any) => {
          if (p.idParticipante === evento.idParticipante) {
            const nuevoTotal = (p.totalInfracciones || 0) + 1;
            return {
              ...p,
              totalInfracciones: nuevoTotal,
              nivelRiesgo: nuevoTotal <= 2 ? 'ADVERTENCIA' : 'ALTO',
            };
          }
          return p;
        });
        return { ...prevSesion, participantes: parts };
      });
    });

    socket.on('participanteActualizado', (part: any) => {
      cargar();
    });

    return () => {
      socket.disconnect();
    };
  }, [sesion?.codigo, cargar]);

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
        setError(d.message || 'Error al iniciar la sesión.');
      } else {
        await cargar();
      }
    } catch {
      setError('Error de conexión.');
    } finally {
      setAccionando(false);
    }
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
        setError(d.message || 'Error al finalizar la sesión.');
      } else {
        await cargar();
      }
    } catch {
      setError('Error de conexión.');
    } finally {
      setAccionando(false);
    }
  };

  if (cargando) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-slate-400 font-semibold text-sm animate-pulse">Cargando sesión...</p>
      </main>
    );
  }

  if (error && !sesion) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-red-200 p-8 rounded-3xl max-w-md text-center space-y-4 shadow-sm">
          <p className="text-red-600 font-bold text-sm">{error}</p>
          <Link href="/docente/dashboard" className="text-blue-600 hover:underline text-xs font-bold">
            ← Volver al Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const estadoSesionInfo = ESTADO_SESION[sesion?.estado] || {
    label: sesion?.estado,
    color: 'bg-slate-100 text-slate-500',
  };
  const enProgreso = sesion?.resumen?.enProgreso ?? 0;
  const finalizados = sesion?.resumen?.finalizados ?? 0;
  const total = sesion?.resumen?.totalParticipantes ?? 0;

  // Filtrar infracciones en vivo
  const infraccionesFiltradas = infraccionesEnVivo.filter((inf) => {
    if (filtroEstudiante !== 'TODOS' && inf.nombreParticipante !== filtroEstudiante) return false;
    if (filtroTipoEvento !== 'TODOS' && inf.tipo !== filtroTipoEvento) return false;
    return true;
  });

  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            href="/docente/dashboard"
            className="text-slate-400 hover:text-slate-700 text-sm font-semibold transition-colors"
          >
            ← Dashboard
          </Link>
          <span className="text-slate-200">|</span>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-none">Panel de Control de Sesión</h1>
            <p className="text-xs text-slate-400 mt-0.5">{sesion?.evaluacion?.nombre}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${estadoSesionInfo.color}`}>
            {estadoSesionInfo.label}
          </span>
          <Link
            href={`/docente/sesion/${idSesion}/reporte`}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-full shadow-sm transition-colors"
          >
            📊 Ver Reporte Completo
          </Link>
        </div>
      </header>

      <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 space-y-8">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl">
            {error}
          </div>
        )}

        {/* Tarjeta Código + Acciones */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Código de Acceso</span>
            <div className="text-6xl font-mono font-black text-blue-600 tracking-[0.2em]">
              {sesion?.codigo}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Los estudiantes deben ingresar a <strong className="text-slate-800">/unirse</strong> y escribir este código.
            </p>
          </div>

          <div className="flex flex-col gap-3 min-w-[220px]">
            {sesion?.estado === 'PENDIENTE' && (
              <button
                type="button"
                onClick={handleIniciar}
                disabled={accionando}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-lg shadow-blue-500/25 transition-colors disabled:opacity-50 text-sm"
              >
                {accionando ? 'Iniciando...' : '▶ Iniciar Examen Ahora'}
              </button>
            )}

            {sesion?.estado === 'ACTIVA' && (
              <button
                type="button"
                onClick={() => setConfirmFinalizar(true)}
                disabled={accionando}
                className="w-full py-4 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-full border border-red-200 transition-colors disabled:opacity-50 text-sm"
              >
                {accionando ? 'Finalizando...' : '■ Finalizar Sesión'}
              </button>
            )}

            {sesion?.estado === 'FINALIZADA' && (
              <div className="text-center py-3 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-500 font-bold">
                Sesión Concluida
              </div>
            )}
          </div>
        </div>

        {/* Tarjetas de Resumen */}
        <div className="grid grid-cols-3 gap-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm">
            <p className="text-4xl font-black text-slate-900">{total}</p>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Total Registrados</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm">
            <p className="text-4xl font-black text-blue-600">{enProgreso}</p>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">En Progreso</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm">
            <p className="text-4xl font-black text-green-600">{finalizados}</p>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Finalizados</p>
          </div>
        </div>

        {/* Sección de Monitoreo de Infracciones en Tiempo Real */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                Monitoreo de Integridad en Vivo
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Recepción instantánea de eventos sospechosos mediante Socket.IO
              </p>
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-3">
              <select
                value={filtroEstudiante}
                onChange={(e) => setFiltroEstudiante(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold"
              >
                <option value="TODOS">Todos los estudiantes</option>
                {sesion?.participantes?.map((p: any) => (
                  <option key={p.idParticipante} value={p.nombre}>
                    {p.nombre}
                  </option>
                ))}
              </select>

              <select
                value={filtroTipoEvento}
                onChange={(e) => setFiltroTipoEvento(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold"
              >
                <option value="TODOS">Todos los eventos</option>
                {Object.keys(TIPO_EVENTO_LABEL).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {TIPO_EVENTO_LABEL[tipo].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Feed en tiempo real */}
          {infraccionesFiltradas.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Sin infracciones registradas en esta sesión.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {infraccionesFiltradas.map((inf, i) => {
                const info = TIPO_EVENTO_LABEL[inf.tipo] || { label: inf.tipo, icon: '⚠️' };
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{info.icon}</span>
                      <div>
                        <span className="font-bold text-slate-800">{inf.nombreParticipante}</span>
                        <span className="text-slate-400 mx-1.5">·</span>
                        <span className="font-semibold text-red-600">{info.label}</span>
                        {inf.detalle && <span className="text-slate-400 text-[11px] ml-2">({inf.detalle})</span>}
                      </div>
                    </div>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {inf.fechaEvento ? new Date(inf.fechaEvento).toLocaleTimeString('es-BO') : 'En vivo'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tabla de Participantes con Semáforo de Riesgo */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-sm">Lista de Estudiantes y Estado de Examen</h2>
            <span className="text-xs text-slate-400">Actualización en vivo</span>
          </div>

          {total === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              Aún no hay participantes en esta sesión. Comparte el código para que ingresen.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sesion?.participantes?.map((p: any) => {
                const info = ESTADO_PARTICIPANTE[p.estado] || {
                  label: p.estado,
                  color: 'bg-slate-100 text-slate-500',
                };
                const totalInf = p.totalInfracciones || 0;

                return (
                  <div
                    key={p.idParticipante}
                    className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                        {p.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{p.nombre}</p>
                        <p className="text-xs text-slate-400">
                          Ingresó:{' '}
                          {p.fechaIngreso
                            ? new Date(p.fechaIngreso).toLocaleTimeString('es-BO', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Badge de Nivel de Riesgo */}
                      <span
                        className={`px-3 py-1 text-xs font-bold rounded-full ${
                          totalInf === 0
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : totalInf <= 2
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-red-50 text-red-700 border border-red-200 animate-pulse'
                        }`}
                      >
                        {totalInf === 0
                          ? '✓ Normal (0)'
                          : totalInf <= 2
                          ? `⚠️ Advertencia (${totalInf})`
                          : `🚨 Riesgo Alto (${totalInf})`}
                      </span>

                      {/* Puntaje Final si terminó */}
                      {p.porcentaje !== null && p.estado === 'FINALIZADO' && (
                        <span className="text-sm font-black text-slate-900">{Math.round(Number(p.porcentaje))}%</span>
                      )}

                      {/* Estado */}
                      <span className={`px-3 py-1 text-xs font-bold rounded-full ${info.color}`}>
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

      {/* Modal de Confirmación de Cierre */}
      {confirmFinalizar && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-md w-full space-y-4">
            <h3 className="text-xl font-bold text-slate-900">¿Finalizar la sesión de evaluación?</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Todos los estudiantes que aún se encuentren respondiendo serán calificados con las respuestas registradas hasta este momento y la sesión quedará cerrada para nuevos ingresos.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleFinalizar}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-full transition-colors"
              >
                Sí, Finalizar Sesión
              </button>
              <button
                type="button"
                onClick={() => setConfirmFinalizar(false)}
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
