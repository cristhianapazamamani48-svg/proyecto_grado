'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('uub_docente_token') : null;
}

export default function DocenteOrganizacionPage() {
  const router = useRouter();
  const [org, setOrg] = useState<any>(null);
  const [miembros, setMiembros] = useState<any[]>([]);
  const [invitaciones, setInvitaciones] = useState<any[]>([]);
  const [usoIa, setUsoIa] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState<'resumen' | 'miembros' | 'invitaciones' | 'codigo' | 'ia'>('resumen');

  // Formularios
  const [correoInvitar, setCorreoInvitar] = useState('');
  const [rolInvitar, setRolInvitar] = useState('DOCENTE');
  const [invitacionCreada, setInvitacionCreada] = useState<any>(null);

  // Código de acceso config
  const [codigoActivo, setCodigoActivo] = useState(false);
  const [aprobacionRequerida, setAprobacionRequerida] = useState(true);

  // Feedback
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const mostrarMensaje = (tipo: 'ok' | 'error', texto: string) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 5000);
  };

  const cargarDatos = async () => {
    const token = getToken();
    if (!token) {
      router.push('/docente/login');
      return;
    }
    setCargando(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [resOrg, resMiembros, resInv, resIa] = await Promise.all([
        fetch(`${API}/organizaciones/mi-organizacion`, { headers }),
        fetch(`${API}/organizaciones/mi-organizacion/miembros`, { headers }),
        fetch(`${API}/organizaciones/mi-organizacion/invitaciones`, { headers }),
        fetch(`${API}/organizaciones/mi-organizacion/uso-ia`, { headers }),
      ]);

      if (resOrg.ok) {
        const dataOrg = await resOrg.json();
        setOrg(dataOrg);
        setCodigoActivo(dataOrg.codigoAccesoActivo ?? false);
        setAprobacionRequerida(dataOrg.aprobacionRequerida ?? true);
      }
      if (resMiembros.ok) setMiembros(await resMiembros.json());
      if (resInv.ok) setInvitaciones(await resInv.json());
      if (resIa.ok) setUsoIa(await resIa.json());
    } catch (err) {
      mostrarMensaje('error', 'Error al cargar información de la organización.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleInvitar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correoInvitar.trim()) return;

    const token = getToken();
    try {
      const res = await fetch(`${API}/organizaciones/mi-organizacion/invitar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ correo: correoInvitar, rol: rolInvitar }),
      });
      const data = await res.json();
      if (res.ok) {
        mostrarMensaje('ok', `Invitación creada exitosamente para ${correoInvitar}`);
        setInvitacionCreada(data);
        setCorreoInvitar('');
        cargarDatos();
      } else {
        mostrarMensaje('error', data.message || 'Error al enviar invitación.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    }
  };

  const handleRevocarInvitacion = async (id: number) => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/organizaciones/mi-organizacion/invitaciones/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        mostrarMensaje('ok', 'Invitación revocada.');
        cargarDatos();
      } else {
        mostrarMensaje('error', 'No se pudo revocar la invitación.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    }
  };

  const handleAprobarMembresia = async (idMembresia: number) => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/organizaciones/mi-organizacion/miembros/${idMembresia}/aprobar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        mostrarMensaje('ok', 'Membresía aprobada.');
        cargarDatos();
      } else {
        mostrarMensaje('error', 'Error al aprobar membresía.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    }
  };

  const handleRechazarMembresia = async (idMembresia: number) => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/organizaciones/mi-organizacion/miembros/${idMembresia}/rechazar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        mostrarMensaje('ok', 'Membresía rechazada.');
        cargarDatos();
      } else {
        mostrarMensaje('error', 'Error al rechazar membresía.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    }
  };

  const handleGenerarCodigo = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/organizaciones/mi-organizacion/codigo-acceso`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        mostrarMensaje('ok', 'Nuevo código generado.');
        cargarDatos();
      } else {
        mostrarMensaje('error', 'Error al generar código.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    }
  };

  const handleGuardarConfigCodigo = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/organizaciones/mi-organizacion/codigo-acceso`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          activo: codigoActivo,
          aprobacionRequerida,
        }),
      });
      if (res.ok) {
        mostrarMensaje('ok', 'Configuración de código actualizada.');
        cargarDatos();
      } else {
        mostrarMensaje('error', 'Error al actualizar configuración.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    }
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/docente/dashboard" className="text-slate-400 hover:text-slate-600 font-medium text-sm">
              ← Dashboard
            </Link>
            <span className="text-slate-300">|</span>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              🏢 {org?.nombre || 'Mi Organización'}
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 uppercase">
                Plan {org?.plan || 'GRATUITO'}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/docente/dashboard"
              className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-medium rounded-lg transition"
            >
              Volver al Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Alerta de notificación */}
      {mensaje && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div
            className={`p-4 rounded-xl border text-sm font-medium flex items-center justify-between ${
              mensaje.tipo === 'ok'
                ? 'bg-green-50 text-green-800 border-green-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            <span>{mensaje.texto}</span>
            <button onClick={() => setMensaje(null)} className="text-xs font-bold uppercase tracking-wider opacity-60 hover:opacity-100">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Sub-Navegación por Tabs */}
        <div className="flex space-x-2 border-b border-slate-200 pb-2">
          {[
            { id: 'resumen', label: '📊 Resumen & Límites' },
            { id: 'miembros', label: `👥 Miembros (${miembros.length})` },
            { id: 'invitaciones', label: `✉️ Invitaciones (${invitaciones.filter(i => i.estado === 'PENDIENTE').length})` },
            { id: 'codigo', label: '🔑 Código de Organización' },
            { id: 'ia', label: '🤖 Consumo de IA' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id as any)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
                tab === item.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* TAB 1: RESUMEN Y LÍMITES */}
        {tab === 'resumen' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-400">Docentes Permitidos</p>
                <p className="text-3xl font-extrabold text-slate-800 mt-2">
                  {org?._count?.membresias || 0} / <span className="text-slate-400">{org?.limiteDocentes}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">Límite por plan actual</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-400">Evaluaciones Creadas</p>
                <p className="text-3xl font-extrabold text-slate-800 mt-2">
                  {org?._count?.evaluaciones || 0} / <span className="text-slate-400">{org?.limiteEvaluaciones}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">En la organización</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-400">Correcciones IA Mes</p>
                <p className="text-3xl font-extrabold text-indigo-600 mt-2">
                  {usoIa?.usadas || 0} / <span className="text-slate-400">{usoIa?.limite || 50}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Disponibles: <strong className="text-green-600">{usoIa?.disponibles || 0}</strong>
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-400">Estado de Cuenta</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-lg font-bold text-slate-800">Activo</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Reinicio IA: {usoIa?.reiniciaPeriodo ? new Date(usoIa.reiniciaPeriodo).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>

            {/* Barra de progreso de IA */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Consumo de Créditos de IA (Mes Actual)</h3>
                  <p className="text-xs text-slate-500">Solo cuentan las evaluaciones procesadas exitosamente.</p>
                </div>
                <span className="text-sm font-bold text-indigo-600">
                  {usoIa?.porcentajeUsado || 0}% consumido
                </span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, usoIa?.porcentajeUsado || 0)}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MIEMBROS Y APROBACIONES */}
        {tab === 'miembros' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Miembros de la Organización</h3>
                <p className="text-xs text-slate-500">Administra accesos y aprueba docentes pendientes.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Usuario</th>
                    <th className="p-4">Correo</th>
                    <th className="p-4">Rol</th>
                    <th className="p-4">Método Ingreso</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {miembros.map((m) => (
                    <tr key={m.idMembresia} className="hover:bg-slate-50/80 transition">
                      <td className="p-4 font-semibold text-slate-800">
                        {m.usuario?.nombre} {m.usuario?.apellido}
                      </td>
                      <td className="p-4 text-slate-600">{m.usuario?.correo}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
                          {m.rol}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-500">{m.metodoIngreso || 'REGISTRO'}</td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                            m.estado === 'ACTIVO'
                              ? 'bg-green-100 text-green-700'
                              : m.estado === 'PENDIENTE_APROBACION'
                              ? 'bg-amber-100 text-amber-700 animate-pulse'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {m.estado}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {m.estado === 'PENDIENTE_APROBACION' && (
                          <>
                            <button
                              onClick={() => handleAprobarMembresia(m.idMembresia)}
                              className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-md hover:bg-green-700 transition"
                            >
                              Aprobar
                            </button>
                            <button
                              onClick={() => handleRechazarMembresia(m.idMembresia)}
                              className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-md hover:bg-red-200 transition"
                            >
                              Rechazar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: INVITACIONES POR CORREO */}
        {tab === 'invitaciones' && (
          <div className="space-y-6">
            {/* Formulario de Nueva Invitación */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-800">Enviar Invitación por Correo</h3>
              <form onSubmit={handleInvitar} className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[240px]">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    placeholder="docente@universidad.edu"
                    value={correoInvitar}
                    onChange={(e) => setCorreoInvitar(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="w-48">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Rol a Asignar</label>
                  <select
                    value={rolInvitar}
                    onChange={(e) => setRolInvitar(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="DOCENTE">Docente</option>
                    <option value="ADMIN_ORGANIZACION">Admin de Organización</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition"
                >
                  Generar Invitación
                </button>
              </form>

              {invitacionCreada && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2 text-sm">
                  <p className="font-bold text-indigo-900">Enlace de Invitación Generado:</p>
                  <div className="p-2 bg-white rounded border border-indigo-200 font-mono text-xs text-indigo-800 select-all">
                    {window.location.origin}/unirse?token={invitacionCreada.token}
                  </div>
                  <p className="text-xs text-indigo-700">
                    Expira el: {new Date(invitacionCreada.fechaExpiracion).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Tabla de Invitaciones */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-800">Historial de Invitaciones</h3>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Correo Invitado</th>
                    <th className="p-4">Rol</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4">Expiración</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invitaciones.map((inv) => (
                    <tr key={inv.idInvitacion} className="hover:bg-slate-50 transition">
                      <td className="p-4 font-medium text-slate-800">{inv.correoInvitado}</td>
                      <td className="p-4 text-xs font-semibold text-slate-600">{inv.rolAsignado}</td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                            inv.estado === 'PENDIENTE'
                              ? 'bg-amber-100 text-amber-700'
                              : inv.estado === 'ACEPTADA'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {inv.estado}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-500">
                        {new Date(inv.fechaExpiracion).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right">
                        {inv.estado === 'PENDIENTE' && (
                          <button
                            onClick={() => handleRevocarInvitacion(inv.idInvitacion)}
                            className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs font-semibold transition"
                          >
                            Revocar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: CÓDIGO DE ORGANIZACIÓN */}
        {tab === 'codigo' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 max-w-3xl">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Código de Organización (Método Alternativo)</h3>
              <p className="text-xs text-slate-500">
                Permite que los docentes se unan introduciendo un código. Los administradores controlan si requiere aprobación.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Código Actual</p>
                <p className="text-2xl font-mono font-bold text-indigo-600 tracking-wider">
                  {org?.codigoAcceso || 'SIN CÓDIGO GENERADO'}
                </p>
              </div>
              <button
                onClick={handleGenerarCodigo}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg transition"
              >
                {org?.codigoAcceso ? 'Regenerar Código' : 'Generar Código'}
              </button>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={codigoActivo}
                  onChange={(e) => setCodigoActivo(e.target.checked)}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-bold text-slate-800">Activar ingreso por código</span>
                  <p className="text-xs text-slate-500">Si está desactivado, nadie podrá unirse usando el código.</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aprobacionRequerida}
                  onChange={(e) => setAprobacionRequerida(e.target.checked)}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-bold text-slate-800">Requerir aprobación de administrador</span>
                  <p className="text-xs text-slate-500">
                    Los docentes que ingresen con código quedarán como PENDIENTE hasta ser aprobados.
                  </p>
                </div>
              </label>

              <button
                onClick={handleGuardarConfigCodigo}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm rounded-lg transition"
              >
                Guardar Configuración
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: CONSUMO DE IA */}
        {tab === 'ia' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Dashboard de Consumo de IA</h3>
                <p className="text-xs text-slate-500">Detalle del consumo mensual por la organización.</p>
              </div>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-full">
                {usoIa?.plan || 'GRATUITO'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs font-semibold text-slate-400 uppercase">Solicitudes Exitosas</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{usoIa?.usadas || 0}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs font-semibold text-slate-400 uppercase">Solicitudes Disponibles</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{usoIa?.disponibles || 0}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs font-semibold text-slate-400 uppercase">Reinicio de Período</p>
                <p className="text-sm font-bold text-slate-700 mt-1">
                  {usoIa?.reiniciaPeriodo ? new Date(usoIa.reiniciaPeriodo).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
