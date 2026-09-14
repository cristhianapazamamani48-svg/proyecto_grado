'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('uub_docente_token') : null;
}

export default function SuperadminInstitucionesPage() {
  const router = useRouter();
  const [instituciones, setInstituciones] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [planFiltro, setPlanFiltro] = useState('');

  // Modal Crear
  const [modalCrear, setModalCrear] = useState(false);
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [plan, setPlan] = useState('GRATUITO');
  const [limiteDocentes, setLimiteDocentes] = useState(5);
  const [limiteEstudiantes, setLimiteEstudiantes] = useState(100);
  const [limiteEvaluaciones, setLimiteEvaluaciones] = useState(20);
  const [limiteCorreccionesIaMes, setLimiteCorreccionesIaMes] = useState(50);
  const [iaHabilitada, setIaHabilitada] = useState(true);
  const [codigoAccesoActivo, setCodigoAccesoActivo] = useState(false);
  const [aprobacionRequerida, setAprobacionRequerida] = useState(true);

  // Feedback
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const mostrarMensaje = (tipo: 'ok' | 'error', texto: string) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 5000);
  };

  const cargarInstituciones = async () => {
    const token = getToken();
    if (!token) {
      router.push('/superadmin/login');
      return;
    }

    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (q) params.append('q', q);
      if (estadoFiltro) params.append('estado', estadoFiltro);
      if (planFiltro) params.append('plan', planFiltro);

      const res = await fetch(`${API}/superadmin/instituciones?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setInstituciones(await res.json());
      } else {
        mostrarMensaje('error', 'Error al cargar listado de instituciones educativas.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarInstituciones();
  }, [q, estadoFiltro, planFiltro]);

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    try {
      const res = await fetch(`${API}/superadmin/instituciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombre,
          slug,
          plan,
          limiteDocentes: Number(limiteDocentes),
          limiteEstudiantes: Number(limiteEstudiantes),
          limiteEvaluaciones: Number(limiteEvaluaciones),
          limiteCorreccionesIaMes: Number(limiteCorreccionesIaMes),
          iaHabilitada,
          codigoAccesoActivo,
          aprobacionRequerida,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        mostrarMensaje('ok', `Institución "${nombre}" creada exitosamente.`);
        setModalCrear(false);
        setNombre('');
        setSlug('');
        cargarInstituciones();
      } else {
        mostrarMensaje('error', data.message || 'Error al crear institución.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    }
  };

  const handleToggleEstado = async (id: number, estadoActual: string) => {
    const nuevoEstado = estadoActual === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    const accionTexto = nuevoEstado === 'INACTIVO' ? 'suspender' : 'activar';

    if (!confirm(`¿Estás seguro de que deseas ${accionTexto} esta institución educativa?`)) {
      return;
    }

    const token = getToken();
    try {
      const res = await fetch(`${API}/superadmin/instituciones/${id}/estado`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ estado: nuevoEstado }),
      });

      if (res.ok) {
        mostrarMensaje('ok', `Institución ${nuevoEstado === 'ACTIVO' ? 'activada' : 'suspendida'} correctamente.`);
        cargarInstituciones();
      } else {
        mostrarMensaje('error', 'Error al cambiar estado.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              🏛️ Instituciones Educativas
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Administración global de universidades, institutos y centros educativos.
            </p>
          </div>
          <button
            onClick={() => setModalCrear(true)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition"
          >
            ➕ Crear Institución
          </button>
        </div>
      </header>

      {/* Alerta de notificación */}
      {mensaje && (
        <div className="max-w-7xl mx-auto px-8 mt-4">
          <div
            className={`p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between ${
              mensaje.tipo === 'ok'
                ? 'bg-green-50 text-green-800 border-green-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            <span>{mensaje.texto}</span>
            <button onClick={() => setMensaje(null)} className="text-xs font-bold uppercase opacity-60">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-8 space-y-6">
        {/* Barra de Búsqueda y Filtros */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
          <div className="flex-1 min-w-[260px]">
            <input
              type="text"
              placeholder="🔍 Buscar por nombre o slug..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white outline-none"
            >
              <option value="">Todos los estados</option>
              <option value="ACTIVO">Activas</option>
              <option value="INACTIVO">Suspendidas</option>
            </select>
            <select
              value={planFiltro}
              onChange={(e) => setPlanFiltro(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white outline-none"
            >
              <option value="">Todos los planes</option>
              <option value="GRATUITO">Gratuito</option>
              <option value="BASICO">Básico</option>
              <option value="INSTITUCIONAL">Institucional</option>
            </select>
          </div>
        </div>

        {/* Tabla de Instituciones */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {cargando ? (
            <div className="p-12 text-center text-slate-400 font-semibold text-sm">
              Cargando instituciones...
            </div>
          ) : instituciones.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              No se encontraron instituciones educativas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Institución</th>
                    <th className="p-4">Plan SaaS</th>
                    <th className="p-4">Docentes</th>
                    <th className="p-4">Estudiantes</th>
                    <th className="p-4">Evaluaciones</th>
                    <th className="p-4">IA (Mes Actual)</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {instituciones.map((inst) => (
                    <tr key={inst.idOrganizacion} className="hover:bg-slate-50/80 transition">
                      <td className="p-4">
                        <Link
                          href={`/superadmin/instituciones/${inst.idOrganizacion}`}
                          className="font-bold text-slate-900 hover:text-blue-600 transition block"
                        >
                          {inst.nombre}
                        </Link>
                        <span className="text-xs text-slate-400 font-mono">{inst.slug}</span>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 uppercase">
                          {inst.plan}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-700">
                        {inst.totalDocentes} / <span className="text-slate-400">{inst.limiteDocentes}</span>
                      </td>
                      <td className="p-4 font-semibold text-slate-700">
                        {inst.totalEstudiantes} / <span className="text-slate-400">{inst.limiteEstudiantes}</span>
                      </td>
                      <td className="p-4 font-semibold text-slate-700">
                        {inst.totalEvaluaciones} / <span className="text-slate-400">{inst.limiteEvaluaciones}</span>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-indigo-600">{inst.usoIaMes}</span>
                        <span className="text-xs text-slate-400"> / {inst.limiteCorreccionesIaMes}</span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                            inst.estado === 'ACTIVO'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {inst.estado === 'ACTIVO' ? 'ACTIVA' : 'SUSPENDIDA'}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <Link
                          href={`/superadmin/instituciones/${inst.idOrganizacion}`}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition inline-block"
                        >
                          Ver Detalle
                        </Link>
                        <button
                          onClick={() => handleToggleEstado(inst.idOrganizacion, inst.estado)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                            inst.estado === 'ACTIVO'
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
                        >
                          {inst.estado === 'ACTIVO' ? 'Suspender' : 'Reactivar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal Crear Institución */}
      {modalCrear && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900">Crear Institución Educativa</h3>
              <button
                onClick={() => setModalCrear(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCrear} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nombre de Institución</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Universidad UUB Central"
                  value={nombre}
                  onChange={(e) => {
                    setNombre(e.target.value);
                    if (!slug) {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Slug Único</label>
                <input
                  type="text"
                  required
                  placeholder="uub-central"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 outline-none font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Plan Inicial</label>
                <select
                  value={plan}
                  onChange={(e) => {
                    const p = e.target.value;
                    setPlan(p);
                    if (p === 'GRATUITO') {
                      setLimiteDocentes(5);
                      setLimiteEstudiantes(100);
                      setLimiteEvaluaciones(20);
                      setLimiteCorreccionesIaMes(50);
                    } else if (p === 'BASICO') {
                      setLimiteDocentes(25);
                      setLimiteEstudiantes(500);
                      setLimiteEvaluaciones(200);
                      setLimiteCorreccionesIaMes(500);
                    } else {
                      setLimiteDocentes(500);
                      setLimiteEstudiantes(10000);
                      setLimiteEvaluaciones(9999);
                      setLimiteCorreccionesIaMes(9999);
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 outline-none font-semibold"
                >
                  <option value="GRATUITO">Gratuito</option>
                  <option value="BASICO">Básico</option>
                  <option value="INSTITUCIONAL">Institucional</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Límite Docentes</label>
                  <input
                    type="number"
                    value={limiteDocentes}
                    onChange={(e) => setLimiteDocentes(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Límite Estudiantes</label>
                  <input
                    type="number"
                    value={limiteEstudiantes}
                    onChange={(e) => setLimiteEstudiantes(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Límite Evaluaciones</label>
                  <input
                    type="number"
                    value={limiteEvaluaciones}
                    onChange={(e) => setLimiteEvaluaciones(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Límite IA / Mes</label>
                  <input
                    type="number"
                    value={limiteCorreccionesIaMes}
                    onChange={(e) => setLimiteCorreccionesIaMes(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={iaHabilitada}
                    onChange={(e) => setIaHabilitada(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-700">IA Habilitada</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aprobacionRequerida}
                    onChange={(e) => setAprobacionRequerida(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-700">Requerir Aprobación de Docentes</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalCrear(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 shadow-md shadow-blue-600/20"
                >
                  Crear Institución
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
