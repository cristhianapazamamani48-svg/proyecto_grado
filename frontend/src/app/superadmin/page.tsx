'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('uub_docente_token') : null;
}

export default function SuperadminDashboardPage() {
  const router = useRouter();
  const [resumen, setResumen] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cargarResumen();
  }, []);

  const cargarResumen = async () => {
    const token = getToken();
    if (!token) {
      router.push('/superadmin/login');
      return;
    }

    setCargando(true);
    try {
      const res = await fetch(`${API}/superadmin/resumen`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Acceso denegado: Se requieren permisos de Superusuario.');
        }
        throw new Error('Error al cargar métricas del sistema.');
      }

      const data = await res.json();
      setResumen(data);
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setCargando(false);
    }
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl border border-red-200 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
            ⚠️
          </div>
          <h2 className="text-lg font-bold text-slate-800">{error}</h2>
          <button
            onClick={() => router.push('/superadmin/login')}
            className="px-6 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition"
          >
            Ir al Login Superadmin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              ⚡ Panel Principal de Superusuario
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Visión global de instituciones educativas, usuarios, evaluaciones y consumo de IA.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/superadmin/instituciones"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition"
            >
              ➕ Nueva Institución Educativa
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-8 space-y-8">
        {/* Banner de Alertas */}
        {resumen?.alertas && resumen.alertas.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
              <span>⚠️</span>
              <span>Instituciones Próximas a Superar sus Límites (≥80%)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resumen.alertas.map((a: any) => (
                <div key={a.idOrganizacion} className="bg-white p-4 rounded-xl border border-amber-200 text-xs space-y-1">
                  <p className="font-bold text-slate-800">{a.nombre}</p>
                  <p className="text-slate-500">Plan: <span className="font-semibold">{a.plan}</span></p>
                  <div className="flex justify-between text-slate-600 pt-1">
                    <span>Docentes: {a.pctDocentes}%</span>
                    <span>Evaluaciones: {a.pctEvaluaciones}%</span>
                    <span>IA: {a.pctIa}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Métricas Principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Instituciones Educativas</p>
            <p className="text-3xl font-black text-slate-900">{resumen?.instituciones?.total || 0}</p>
            <div className="flex items-center gap-3 text-xs pt-1">
              <span className="text-green-600 font-semibold">● {resumen?.instituciones?.activas || 0} Activas</span>
              <span className="text-red-500 font-semibold">● {resumen?.instituciones?.suspendidas || 0} Suspendidas</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Usuarios Registrados</p>
            <p className="text-3xl font-black text-slate-900">{resumen?.usuarios?.total || 0}</p>
            <div className="flex items-center gap-3 text-xs pt-1">
              <span className="text-slate-600 font-semibold">{resumen?.usuarios?.docentes || 0} Docentes</span>
              <span className="text-slate-400 font-semibold">•</span>
              <span className="text-slate-600 font-semibold">{resumen?.usuarios?.estudiantes || 0} Estudiantes</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Evaluaciones Creadas</p>
            <p className="text-3xl font-black text-slate-900">{resumen?.evaluaciones?.total || 0}</p>
            <div className="flex items-center gap-2 text-xs pt-1 text-blue-600 font-semibold">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              <span>{resumen?.evaluaciones?.sesionesActivas || 0} Sesiones en Vivo</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Correcciones IA (Este Mes)</p>
            <p className="text-3xl font-black text-indigo-600">{resumen?.ia?.correccionesEsteMes || 0}</p>
            <p className="text-xs text-slate-500 pt-1">
              Proveedor: <span className="font-bold uppercase text-slate-700">{resumen?.ia?.proveedorActual}</span>
            </p>
          </div>
        </div>

        {/* Accesos Rápidos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/superadmin/instituciones"
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-400 hover:shadow-md transition space-y-2 group"
          >
            <div className="text-2xl">🏛️</div>
            <h3 className="text-base font-bold text-slate-800 group-hover:text-blue-600 transition">
              Gestión de Instituciones Educativas →
            </h3>
            <p className="text-xs text-slate-500">
              Crear instituciones, cambiar de plan SaaS, ajustar límites y gestionar suspensiones.
            </p>
          </Link>

          <Link
            href="/superadmin/usuarios"
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-400 hover:shadow-md transition space-y-2 group"
          >
            <div className="text-2xl">👤</div>
            <h3 className="text-base font-bold text-slate-800 group-hover:text-blue-600 transition">
              Directorio Global de Usuarios →
            </h3>
            <p className="text-xs text-slate-500">
              Administrar docentes, cambiar roles globales y gestionar membresías institucionales.
            </p>
          </Link>

          <Link
            href="/superadmin/ia"
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-400 hover:shadow-md transition space-y-2 group"
          >
            <div className="text-2xl">🤖</div>
            <h3 className="text-base font-bold text-slate-800 group-hover:text-blue-600 transition">
              Consumo y Métricas de IA →
            </h3>
            <p className="text-xs text-slate-500">
              Analizar el consumo mensual de IA por institución educativa y estado del proveedor.
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
