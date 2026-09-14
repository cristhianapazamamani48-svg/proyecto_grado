'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('uub_docente_token') : null;
}

export default function SuperadminAuditoriaPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    cargarAuditoria();
  }, [q]);

  const cargarAuditoria = async () => {
    const token = getToken();
    if (!token) {
      router.push('/superadmin/login');
      return;
    }

    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (q) params.append('q', q);

      const res = await fetch(`${API}/superadmin/auditoria?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setLogs(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              📜 Auditoría Administrativa
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Registro inmutable de todas las acciones administrativas realizadas en la plataforma.
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-8 space-y-6">
        {/* Filtro Búsqueda */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm max-w-md">
          <input
            type="text"
            placeholder="🔍 Buscar por acción o recurso..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 outline-none"
          />
        </div>

        {/* Tabla de Logs */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {cargando ? (
            <div className="p-12 text-center text-slate-400 font-semibold text-sm">
              Cargando registros de auditoría...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              No hay registros de auditoría administrativa disponibles.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Fecha & Hora</th>
                    <th className="p-4">Usuario Ejecutor</th>
                    <th className="p-4">Acción</th>
                    <th className="p-4">Recurso Afectado</th>
                    <th className="p-4">ID Recurso</th>
                    <th className="p-4">IP Origen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.idAuditoriaAdmin} className="hover:bg-slate-50 transition">
                      <td className="p-4 text-xs font-mono text-slate-600">
                        {new Date(log.fecha).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-slate-900 block">
                          {log.usuario?.nombre} {log.usuario?.apellido}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">{log.usuario?.correo}</span>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                          {log.accion}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-700">{log.recursoAfectado}</td>
                      <td className="p-4 text-xs font-mono text-slate-500">{log.idRecurso || 'N/A'}</td>
                      <td className="p-4 text-xs font-mono text-slate-400">{log.ipOrigen || 'Internal'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
