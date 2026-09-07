'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DocenteDashboardPage() {
  const router = useRouter();
  const [nombreDocente, setNombreDocente] = useState('');
  const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sesionModal, setSesionModal] = useState<any>(null);
  const [codigoSesionCreada, setCodigoSesionCreada] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('uub_docente_token');
    const nombre = localStorage.getItem('uub_docente_nombre');

    if (!token) {
      router.push('/docente/login');
      return;
    }

    setNombreDocente(nombre || 'Docente');

    const cargarEvaluaciones = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/evaluaciones`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setEvaluaciones(data || []);
        }
      } catch (e) {
        console.error('Error al cargar evaluaciones:', e);
      } finally {
        setCargando(false);
      }
    };

    cargarEvaluaciones();
  }, [router]);

  const handleCrearSesion = async (evaluacionId: string) => {
    const token = localStorage.getItem('uub_docente_token');
    if (!token) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/sesiones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ evaluacionId, modoInicio: 'INMEDIATO' }),
      });

      const data = await res.json();
      if (res.ok) {
        setCodigoSesionCreada(data.codigo);
      } else {
        alert(data.message || 'Error al lanzar sesión');
      }
    } catch (e) {
      alert('Error de conexión');
    }
  };

  const cerrarSesion = () => {
    localStorage.removeItem('uub_docente_token');
    localStorage.removeItem('uub_docente_nombre');
    router.push('/docente/login');
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-950 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold">
            🎓
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Panel Docente</h1>
            <p className="text-xs text-slate-400">Bienvenido, {nombreDocente}</p>
          </div>
        </div>

        <button
          onClick={cerrarSesion}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-xl transition-colors"
        >
          Cerrar Sesión
        </button>
      </header>

      <div className="flex-1 max-w-6xl w-full mx-auto p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Mis Evaluaciones</h2>
            <p className="text-sm text-slate-400">Gestiona tus exámenes, preguntas y sesiones de prueba</p>
          </div>

          <Link
            href="/docente/evaluacion/nueva"
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-sm rounded-xl shadow-lg transition-all flex items-center space-x-2"
          >
            <span>+ Nueva Evaluación</span>
          </Link>
        </div>

        {codigoSesionCreada && (
          <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-400 font-semibold uppercase">Sesión de Evaluación Activa</p>
              <h3 className="text-2xl font-mono font-extrabold text-white mt-1">Código: {codigoSesionCreada}</h3>
              <p className="text-xs text-slate-400 mt-1">Comparte este código con tus estudiantes para ingresar.</p>
            </div>
            <button
              onClick={() => setCodigoSesionCreada('')}
              className="px-4 py-2 bg-emerald-600 text-white font-semibold text-xs rounded-xl"
            >
              Cerrar Aviso
            </button>
          </div>
        )}

        {cargando ? (
          <div className="py-12 text-center text-slate-400 animate-pulse">Cargando evaluaciones...</div>
        ) : evaluaciones.length === 0 ? (
          <div className="p-12 bg-slate-800/50 border border-slate-700/60 rounded-2xl text-center space-y-4">
            <div className="text-4xl">📋</div>
            <h3 className="text-lg font-bold text-white">No tienes evaluaciones creadas aún</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              Crea tu primera evaluación académica para configurar preguntas de opción múltiple, desarrollo e imágenes.
            </p>
            <Link
              href="/docente/evaluacion/nueva"
              className="inline-block px-4 py-2 bg-emerald-600 text-white font-bold text-sm rounded-xl"
            >
              Crear Evaluación
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {evaluaciones.map((ev) => (
              <div
                key={ev.id}
                className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4 hover:border-slate-600 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded border border-indigo-500/30">
                      v{ev.versiones?.[0]?.version || 1}
                    </span>
                    <span className="text-xs text-slate-400">{ev._count?.sesiones || 0} Sesiones</span>
                  </div>
                  <h3 className="text-xl font-bold text-white leading-tight">{ev.titulo}</h3>
                  {ev.descripcion && <p className="text-sm text-slate-400 line-clamp-2">{ev.descripcion}</p>}
                </div>

                <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
                  <button
                    onClick={() => handleCrearSesion(ev.id)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    🚀 Lanzar Sesión
                  </button>
                  <span className="text-xs text-slate-400 font-mono">ID: {ev.id.substring(0, 8)}...</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
