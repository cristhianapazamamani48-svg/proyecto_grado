'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('uub_docente_token') : null;
}

export default function SuperadminInstitucionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [inst, setInst] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState<'info' | 'miembros' | 'evaluaciones' | 'ia'>('info');

  // Formulario de Límites
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
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

  const cargarDetalle = async () => {
    const token = getToken();
    if (!token) {
      router.push('/superadmin/login');
      return;
    }

    setCargando(true);
    try {
      const res = await fetch(`${API}/superadmin/instituciones/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setInst(data);
        setNombre(data.nombre);
        setSlug(data.slug);
        setLimiteDocentes(data.limiteDocentes);
        setLimiteEstudiantes(data.limiteEstudiantes);
        setLimiteEvaluaciones(data.limiteEvaluaciones);
        setLimiteCorreccionesIaMes(data.limiteCorreccionesIaMes);
        setIaHabilitada(data.iaHabilitada);
        setCodigoAccesoActivo(data.codigoAccesoActivo ?? false);
        setAprobacionRequerida(data.aprobacionRequerida ?? true);
      } else {
        mostrarMensaje('error', 'No se pudo cargar el detalle de la institución.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDetalle();
  }, [id]);

  const handleGuardarConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    try {
      const res = await fetch(`${API}/superadmin/instituciones/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombre,
          slug,
          limiteDocentes: Number(limiteDocentes),
          limiteEstudiantes: Number(limiteEstudiantes),
          limiteEvaluaciones: Number(limiteEvaluaciones),
          limiteCorreccionesIaMes: Number(limiteCorreccionesIaMes),
          iaHabilitada,
          codigoAccesoActivo,
          aprobacionRequerida,
        }),
      });

      if (res.ok) {
        mostrarMensaje('ok', 'Configuración de la institución actualizada.');
        cargarDetalle();
      } else {
        mostrarMensaje('error', 'Error al guardar cambios.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    }
  };

  const handleCambiarPlan = async (nuevoPlan: string) => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/superadmin/instituciones/${id}/plan`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: nuevoPlan, ajustarLimitesDefault: true }),
      });

      if (res.ok) {
        mostrarMensaje('ok', `Plan cambiado a ${nuevoPlan} y límites actualizados.`);
        cargarDetalle();
      } else {
        mostrarMensaje('error', 'Error al cambiar plan.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    }
  };

  const handleToggleEstado = async () => {
    const nuevoEstado = inst.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
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
        mostrarMensaje('ok', `Institución ${nuevoEstado === 'ACTIVO' ? 'activada' : 'suspendida'}.`);
        cargarDetalle();
      } else {
        mostrarMensaje('error', 'Error al cambiar estado.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    }
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/superadmin/instituciones" className="text-slate-400 hover:text-slate-600 text-sm font-bold">
              ← Volver
            </Link>
            <span className="text-slate-300">|</span>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              🏛️ {inst?.nombre}
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800 uppercase">
                {inst?.plan}
              </span>
              <span
                className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                  inst?.estado === 'ACTIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {inst?.estado === 'ACTIVO' ? 'ACTIVA' : 'SUSPENDIDA'}
              </span>
            </h1>
          </div>
          <button
            onClick={handleToggleEstado}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
              inst?.estado === 'ACTIVO'
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'bg-green-50 text-green-600 hover:bg-green-100'
            }`}
          >
            {inst?.estado === 'ACTIVO' ? 'Suspender Institución' : 'Reactivar Institución'}
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
        {/* Sub-Navegación por Tabs */}
        <div className="flex space-x-2 border-b border-slate-200 pb-2">
          {[
            { id: 'info', label: '⚙️ Configuración & Límites' },
            { id: 'miembros', label: `👥 Miembros (${inst?.membresias?.length || 0})` },
            { id: 'evaluaciones', label: `📝 Evaluaciones (${inst?.evaluaciones?.length || 0})` },
            { id: 'ia', label: '🤖 Consumo de IA' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id as any)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
                tab === item.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* TAB 1: CONFIGURACIÓN & LÍMITES */}
        {tab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <h3 className="text-base font-bold text-slate-900">Editar Parámetros y Cuotas</h3>
              <form onSubmit={handleGuardarConfig} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Nombre</label>
                    <input
                      type="text"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Slug</label>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
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
                    <label className="block text-xs font-bold text-slate-600 mb-1">Límite Correcciones IA / Mes</label>
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
                    <span className="text-xs font-bold text-slate-700">Módulo de IA Habilitado</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={codigoAccesoActivo}
                      onChange={(e) => setCodigoAccesoActivo(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-700">Código de Acceso Activo</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aprobacionRequerida}
                      onChange={(e) => setAprobacionRequerida(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-700">Requerir Aprobación de Docentes Nuevos</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition shadow-md shadow-blue-600/20"
                >
                  Guardar Cambios
                </button>
              </form>
            </div>

            {/* Selector de Plan SaaS */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit">
              <h3 className="text-base font-bold text-slate-900">Cambiar Plan SaaS</h3>
              <p className="text-xs text-slate-500">
                Al seleccionar un nuevo plan se reajustarán automáticamente los límites predeterminados.
              </p>
              <div className="space-y-2">
                {['GRATUITO', 'BASICO', 'INSTITUCIONAL'].map((p) => (
                  <button
                    key={p}
                    onClick={() => handleCambiarPlan(p)}
                    className={`w-full py-3 px-4 rounded-xl border text-left text-xs font-bold transition flex items-center justify-between ${
                      inst?.plan === p
                        ? 'bg-blue-50 border-blue-600 text-blue-700'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span>PLAN {p}</span>
                    {inst?.plan === p && <span>✓ Activo</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MIEMBROS */}
        {tab === 'miembros' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-4">Usuario</th>
                  <th className="p-4">Correo</th>
                  <th className="p-4">Rol</th>
                  <th className="p-4">Método Ingreso</th>
                  <th className="p-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inst?.membresias?.map((m: any) => (
                  <tr key={m.idMembresia} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-bold text-slate-900">
                      {m.usuario?.nombre} {m.usuario?.apellido}
                    </td>
                    <td className="p-4 text-slate-600 text-xs">{m.usuario?.correo}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700">
                        {m.rol}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-500">{m.metodoIngreso || 'REGISTRO'}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                          m.estado === 'ACTIVO' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {m.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: EVALUACIONES */}
        {tab === 'evaluaciones' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-4">Nombre de Evaluación</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Fecha Creación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inst?.evaluaciones?.map((e: any) => (
                  <tr key={e.idEvaluacion} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-bold text-slate-900">{e.nombre}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-50 text-blue-700">
                        {e.estado}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-500">
                      {new Date(e.fechaCreacion).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: IA */}
        {tab === 'ia' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900">Uso de IA en esta Institución</h3>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Correcciones Consumidas</p>
                <p className="text-2xl font-black text-indigo-600 mt-1">
                  {inst?.usoIa?.usadas || 0} / <span className="text-slate-400">{inst?.usoIa?.limite}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-400 uppercase">Disponibles</p>
                <p className="text-2xl font-black text-green-600 mt-1">{inst?.usoIa?.disponibles || 0}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
