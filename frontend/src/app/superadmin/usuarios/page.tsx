'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('uub_docente_token') : null;
}

export default function SuperadminUsuariosPage() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [instituciones, setInstituciones] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  // Filtros
  const [q, setQ] = useState('');
  const [rolFiltro, setRolFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [instFiltro, setInstFiltro] = useState('');

  // Modal Rol
  const [modalRol, setModalRol] = useState<any>(null);
  const [nuevoRol, setNuevoRol] = useState('DOCENTE');

  // Modal Asignar Institución
  const [modalAsignar, setModalAsignar] = useState<any>(null);
  const [idInstAsignar, setIdInstAsignar] = useState<number | null>(null);
  const [rolAsignar, setRolAsignar] = useState('DOCENTE');

  // Feedback
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const mostrarMensaje = (tipo: 'ok' | 'error', texto: string) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 5000);
  };

  const cargarDatos = async () => {
    const token = getToken();
    if (!token) {
      router.push('/superadmin/login');
      return;
    }

    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (q) params.append('q', q);
      if (rolFiltro) params.append('rol', rolFiltro);
      if (estadoFiltro) params.append('estado', estadoFiltro);
      if (instFiltro) params.append('idOrganizacion', instFiltro);

      const [resUsers, resInst] = await Promise.all([
        fetch(`${API}/superadmin/usuarios?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API}/superadmin/instituciones`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (resUsers.ok) setUsuarios(await resUsers.json());
      if (resInst.ok) setInstituciones(await resInst.json());
    } catch (err) {
      mostrarMensaje('error', 'Error al cargar usuarios.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [q, rolFiltro, estadoFiltro, instFiltro]);

  const handleToggleEstado = async (idUsuario: number, estadoActual: string) => {
    const nuevoEstado = estadoActual === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    const token = getToken();
    try {
      const res = await fetch(`${API}/superadmin/usuarios/${idUsuario}/estado`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const data = await res.json();
      if (res.ok) {
        mostrarMensaje('ok', `Estado del usuario actualizado a ${nuevoEstado}.`);
        cargarDatos();
      } else {
        mostrarMensaje('error', data.message || 'Error al cambiar estado.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    }
  };

  const handleGuardarRol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalRol) return;
    const token = getToken();
    try {
      const res = await fetch(`${API}/superadmin/usuarios/${modalRol.idUsuario}/rol`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rol: nuevoRol }),
      });

      const data = await res.json();
      if (res.ok) {
        mostrarMensaje('ok', `Rol cambiado a ${nuevoRol} exitosamente.`);
        setModalRol(null);
        cargarDatos();
      } else {
        mostrarMensaje('error', data.message || 'Error al cambiar rol.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    }
  };

  const handleAsignarInstitucion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalAsignar || !idInstAsignar) return;
    const token = getToken();
    try {
      const res = await fetch(`${API}/superadmin/usuarios/${modalAsignar.idUsuario}/asignar-institucion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ idOrganizacion: idInstAsignar, rol: rolAsignar }),
      });

      const data = await res.json();
      if (res.ok) {
        mostrarMensaje('ok', 'Usuario asignado a la institución educativa.');
        setModalAsignar(null);
        cargarDatos();
      } else {
        mostrarMensaje('error', data.message || 'Error al asignar.');
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
              👤 Directorio Global de Usuarios y Membresías
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Administración de cuentas docentes, roles globales y asignación a instituciones.
            </p>
          </div>
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
        {/* Filtros */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
          <div className="flex-1 min-w-[260px]">
            <input
              type="text"
              placeholder="🔍 Buscar usuario por nombre o correo..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={rolFiltro}
              onChange={(e) => setRolFiltro(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white outline-none"
            >
              <option value="">Todos los roles</option>
              <option value="SUPER_ADMIN">Superadmin</option>
              <option value="ADMIN_ORGANIZACION">Admin Institución</option>
              <option value="DOCENTE">Docente</option>
            </select>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white outline-none"
            >
              <option value="">Todos los estados</option>
              <option value="ACTIVO">Activos</option>
              <option value="INACTIVO">Inactivos</option>
            </select>
          </div>
        </div>

        {/* Tabla de Usuarios */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {cargando ? (
            <div className="p-12 text-center text-slate-400 font-semibold text-sm">
              Cargando directorio de usuarios...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Usuario</th>
                    <th className="p-4">Correo</th>
                    <th className="p-4">Rol Global</th>
                    <th className="p-4">Institución(es)</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usuarios.map((u) => (
                    <tr key={u.idUsuario} className="hover:bg-slate-50 transition">
                      <td className="p-4 font-bold text-slate-900">
                        {u.nombre} {u.apellido}
                      </td>
                      <td className="p-4 text-xs text-slate-600">{u.correo}</td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                            u.rol === 'SUPER_ADMIN'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : u.rol === 'ADMIN_ORGANIZACION'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {u.rol}
                        </span>
                      </td>
                      <td className="p-4">
                        {u.membresias?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {u.membresias.map((m: any) => (
                              <span
                                key={m.idMembresia}
                                className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 rounded-md"
                              >
                                {m.organizacion?.nombre} ({m.rol})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Sin institución</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                            u.estado === 'ACTIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {u.estado}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => {
                            setModalRol(u);
                            setNuevoRol(u.rol);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
                        >
                          Rol
                        </button>
                        <button
                          onClick={() => setModalAsignar(u)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition"
                        >
                          + Institución
                        </button>
                        <button
                          onClick={() => handleToggleEstado(u.idUsuario, u.estado)}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                            u.estado === 'ACTIVO'
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
                        >
                          {u.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
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

      {/* Modal Rol */}
      {modalRol && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Cambiar Rol de {modalRol.nombre} {modalRol.apellido}
            </h3>
            <form onSubmit={handleGuardarRol} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nuevo Rol Global</label>
                <select
                  value={nuevoRol}
                  onChange={(e) => setNuevoRol(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold outline-none"
                >
                  <option value="DOCENTE">Docente</option>
                  <option value="ADMIN_ORGANIZACION">Admin de Institución</option>
                  <option value="SUPER_ADMIN">Superusuario Global</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalRol(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 shadow-md shadow-blue-600/20"
                >
                  Guardar Rol
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Asignar Institución */}
      {modalAsignar && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Asignar Institución a {modalAsignar.nombre}
            </h3>
            <form onSubmit={handleAsignarInstitucion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Seleccionar Institución</label>
                <select
                  required
                  value={idInstAsignar || ''}
                  onChange={(e) => setIdInstAsignar(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold outline-none"
                >
                  <option value="">Seleccione una institución...</option>
                  {instituciones.map((i) => (
                    <option key={i.idOrganizacion} value={i.idOrganizacion}>
                      {i.nombre} ({i.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Rol en la Institución</label>
                <select
                  value={rolAsignar}
                  onChange={(e) => setRolAsignar(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold outline-none"
                >
                  <option value="DOCENTE">Docente</option>
                  <option value="ADMIN_ORGANIZACION">Admin de Institución</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAsignar(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 shadow-md shadow-blue-600/20"
                >
                  Asignar Institución
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
