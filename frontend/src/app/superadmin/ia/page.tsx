'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('uub_docente_token') : null;
}

export default function SuperadminIaPage() {
  const router = useRouter();
  const [datosIa, setDatosIa] = useState<any>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    const token = getToken();
    if (!token) {
      router.push('/superadmin/login');
      return;
    }

    try {
      const res = await fetch(`${API}/superadmin/ia/consumo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDatosIa(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              🤖 Consumo de Inteligencia Artificial (IA)
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Monitoreo de solicitudes procesadas, cuotas mensuales e integración de proveedores.
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-8 space-y-8">
        {/* Tarjetas Informativas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase">Proveedor Configurado</p>
            <p className="text-2xl font-black text-indigo-600 uppercase">
              {datosIa?.proveedorConfigurado || 'MOCK'}
            </p>
            <p className="text-xs text-slate-500">Modelo: {datosIa?.modeloConfigurado}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase">Solicitudes Éxitosas (Este Mes)</p>
            <p className="text-3xl font-black text-slate-900">{datosIa?.consumoMesActual || 0}</p>
            <p className="text-xs text-slate-500">Solo consumen crédito en respuestas procesadas</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase">Consumo Histórico Total</p>
            <p className="text-3xl font-black text-slate-900">{datosIa?.consumoHistorico || 0}</p>
            <p className="text-xs text-slate-500">Desde la creación del sistema</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase">Regla de Cobro</p>
            <p className="text-xs font-bold text-slate-700 mt-1">
              ✓ Errores / Timeouts no consumen saldo.
            </p>
            <p className="text-xs text-slate-500">
              ✓ Claves API protegidas en backend.
            </p>
          </div>
        </div>

        {/* Tabla Desglose por Institución */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Desglose de Consumo por Institución Educativa</h3>
          </div>
          {datosIa?.desglosePorInstitucion?.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No hay consumos de IA registrados en el mes actual.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Institución</th>
                    <th className="p-4">Plan</th>
                    <th className="p-4">Consumo Mes Actual</th>
                    <th className="p-4">Límite Mes</th>
                    <th className="p-4">Porcentaje Consumido</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {datosIa?.desglosePorInstitucion?.map((item: any) => {
                    const pct = item.limiteMes > 0 ? Math.round((item.usadasMes / item.limiteMes) * 100) : 0;
                    return (
                      <tr key={item.idOrganizacion} className="hover:bg-slate-50 transition">
                        <td className="p-4">
                          <Link
                            href={`/superadmin/instituciones/${item.idOrganizacion}`}
                            className="font-bold text-slate-900 hover:text-blue-600 transition"
                          >
                            {item.nombre}
                          </Link>
                          <span className="block text-xs text-slate-400 font-mono">{item.slug}</span>
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-50 text-blue-700">
                            {item.plan}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-indigo-600">{item.usadasMes}</td>
                        <td className="p-4 font-semibold text-slate-700">{item.limiteMes}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-24 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${pct >= 80 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-bold text-slate-700">{pct}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <Link
                            href={`/superadmin/instituciones/${item.idOrganizacion}`}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
                          >
                            Ajustar Cuota
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
