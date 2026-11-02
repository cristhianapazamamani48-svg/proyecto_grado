'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import AnimatedCounter from '@/components/rare-ui/AnimatedCounter';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface SesionDocente {
  idSesion: number;
  codigo: string;
  estado: 'PENDIENTE' | 'ACTIVA' | 'FINALIZADA';
  fechaInicio: string | null;
  fechaFin: string | null;
  evaluacion: { idEvaluacion: number; nombre: string };
  _count: { participantes: number };
}

const ESTADOS: Record<SesionDocente['estado'], { etiqueta: string; estilo: string }> = {
  PENDIENTE: { etiqueta: 'Sala de espera', estilo: 'border-amber-200 bg-amber-50 text-amber-700' },
  ACTIVA: { etiqueta: 'En curso', estilo: 'border-green-200 bg-green-50 text-green-700' },
  FINALIZADA: { etiqueta: 'Finalizada', estilo: 'border-slate-200 bg-slate-100 text-slate-600' },
};

function formatoFecha(fecha: string | null) {
  if (!fecha) return 'Aún no iniciada';
  return new Date(fecha).toLocaleString('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function SesionesDocentePage() {
  const router = useRouter();
  const [sesiones, setSesiones] = useState<SesionDocente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');

  useEffect(() => {
    const token = localStorage.getItem('uub_docente_token');
    if (!token) {
      router.push('/docente/login');
      return;
    }

    const cargarSesiones = async () => {
      try {
        const respuesta = await fetch(`${API}/sesiones`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) {
          throw new Error(datos.message || 'No se pudieron cargar las sesiones.');
        }
        setSesiones(datos);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Error de conexión con el servidor.');
      } finally {
        setCargando(false);
      }
    };

    void cargarSesiones();
  }, [router]);

  const sesionesFiltradas = useMemo(
    () =>
      sesiones.filter((sesion) => {
        const coincideBusqueda =
          sesion.evaluacion.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          sesion.codigo.toLowerCase().includes(busqueda.toLowerCase());
        return coincideBusqueda && (filtroEstado === 'TODOS' || sesion.estado === filtroEstado);
      }),
    [busqueda, filtroEstado, sesiones],
  );

  const sesionesActivas = sesiones.filter((sesion) => sesion.estado !== 'FINALIZADA').length;

  return (
    <main className="min-h-screen flex-1 space-y-8 bg-[#fafafc] p-6 font-sans text-slate-800 md:p-8">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Sesiones</h1>
          <p className="mt-1 text-sm text-slate-500">Consulta y administra las sesiones de tus evaluaciones.</p>
        </div>
        <Link
          href="/docente/biblioteca"
          className="w-fit rounded-full border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
        >
          <span className="inline-flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Ir a Mi biblioteca</span>
        </Link>
      </header>

      <section className="grid gap-5 sm:grid-cols-3" aria-label="Resumen de sesiones">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-3xl font-black text-slate-900">{cargando ? '—' : <AnimatedCounter value={sesiones.length} />}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">Sesiones totales</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-3xl font-black text-green-600">{cargando ? '—' : <AnimatedCounter value={sesionesActivas} />}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">Pendientes o en curso</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-3xl font-black text-slate-600">
            {cargando ? '—' : <AnimatedCounter value={sesiones.filter((sesion) => sesion.estado === 'FINALIZADA').length} />}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">Finalizadas</p>
        </div>
      </section>

      <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por evaluación o código..."
            aria-label="Buscar sesiones"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-[#fafafc] px-4 py-2.5 text-sm text-slate-800 focus:border-purple-500 focus:outline-none"
          />
          <select
            value={filtroEstado}
            onChange={(event) => setFiltroEstado(event.target.value)}
            aria-label="Filtrar por estado"
            className="rounded-xl border border-slate-200 bg-[#fafafc] px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-purple-500 focus:outline-none"
          >
            <option value="TODOS">Todos los estados</option>
            <option value="PENDIENTE">Sala de espera</option>
            <option value="ACTIVA">En curso</option>
            <option value="FINALIZADA">Finalizadas</option>
          </select>
        </div>

        {cargando ? (
          <p className="py-16 text-center text-sm text-slate-400">Cargando sesiones...</p>
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : sesionesFiltradas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-16 text-center">
            <p className="font-bold text-slate-700">
              {sesiones.length === 0 ? 'Todavía no has lanzado sesiones' : 'No se encontraron sesiones'}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {sesiones.length === 0
                ? 'Publica una evaluación desde Mi biblioteca y lánzala para que aparezca aquí.'
                : 'Prueba con otro término de búsqueda o filtro.'}
            </p>
            {sesiones.length === 0 && (
              <Link
                href="/docente/biblioteca"
                className="mt-5 inline-flex rounded-full bg-purple-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-purple-700"
              >
                Abrir Mi biblioteca
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {sesionesFiltradas.map((sesion) => (
              <article key={sesion.idSesion} className="rounded-2xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-bold text-slate-900">{sesion.evaluacion.nombre}</h2>
                    <p className="mt-1 text-xs text-slate-500">Sesión #{sesion.idSesion}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${ESTADOS[sesion.estado].estilo}`}>
                    {ESTADOS[sesion.estado].etiqueta}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-[#fafafc] p-4 text-xs">
                  <div>
                    <p className="font-semibold uppercase tracking-wide text-slate-400">Código de acceso</p>
                    <p className="mt-1 font-mono text-lg font-black tracking-widest text-purple-700 dark:text-purple-400">{sesion.codigo}</p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-wide text-slate-400">Participantes</p>
                    <p className="mt-2 text-base font-bold text-slate-800">{sesion._count.participantes}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="font-semibold uppercase tracking-wide text-slate-400">Inicio</p>
                    <p className="mt-1 text-slate-700">{formatoFecha(sesion.fechaInicio)}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/docente/sesion/${sesion.idSesion}`}
                    className="rounded-full bg-purple-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-purple-700"
                  >
                    {sesion.estado === 'FINALIZADA' ? 'Ver sesión' : 'Administrar sesión'}
                  </Link>
                  <Link
                    href={`/docente/sesion/${sesion.idSesion}/reporte`}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-[#fafafc]"
                  >
                    Ver reporte
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
