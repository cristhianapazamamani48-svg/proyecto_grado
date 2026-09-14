'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('uub_docente_token') : null;
}

const PLANES_INFO = [
  {
    tipo: 'GRATUITO',
    nombre: 'Plan Gratuito',
    descripcion: 'Para pequeñas escuelas o pruebas docentes individuales.',
    limiteDocentes: 5,
    limiteEstudiantes: 100,
    limiteEvaluaciones: 20,
    limiteCorreccionesIaMes: 50,
    color: 'border-slate-300 bg-white',
    badge: 'bg-slate-100 text-slate-700',
  },
  {
    tipo: 'BASICO',
    nombre: 'Plan Básico Institucional',
    descripcion: 'Para colegios medianos o institutos de formación.',
    limiteDocentes: 25,
    limiteEstudiantes: 500,
    limiteEvaluaciones: 200,
    limiteCorreccionesIaMes: 500,
    color: 'border-blue-400 bg-blue-50/30',
    badge: 'bg-blue-100 text-blue-800',
  },
  {
    tipo: 'INSTITUCIONAL',
    nombre: 'Plan Institucional Pro',
    descripcion: 'Para universidades y grandes redes educativas.',
    limiteDocentes: 500,
    limiteEstudiantes: 10000,
    limiteEvaluaciones: 9999,
    limiteCorreccionesIaMes: 9999,
    color: 'border-indigo-400 bg-indigo-50/30',
    badge: 'bg-indigo-100 text-indigo-800',
  },
];

export default function SuperadminPlanesPage() {
  const router = useRouter();
  const [instituciones, setInstituciones] = useState<any[]>([]);
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
      const res = await fetch(`${API}/superadmin/instituciones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setInstituciones(await res.json());
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
              💳 Planes y Límites SaaS
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Estructura de planes y cuotas institucionales del sistema Proyecto UUB.
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-8 space-y-8">
        {/* Tarjetas de Planes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANES_INFO.map((plan) => {
            const countOrgs = instituciones.filter((i) => i.plan === plan.tipo).length;
            return (
              <div
                key={plan.tipo}
                className={`p-6 rounded-3xl border shadow-sm space-y-6 flex flex-col justify-between ${plan.color}`}
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${plan.badge}`}>
                      {plan.tipo}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {countOrgs} Instituciones
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{plan.nombre}</h3>
                    <p className="text-xs text-slate-500 mt-1">{plan.descripcion}</p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-200/60 text-xs font-semibold text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Docentes Permitidos:</span>
                      <span className="font-bold">{plan.limiteDocentes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Estudiantes Permitidos:</span>
                      <span className="font-bold">{plan.limiteEstudiantes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Evaluaciones:</span>
                      <span className="font-bold">{plan.limiteEvaluaciones}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Correcciones IA / Mes:</span>
                      <span className="font-bold text-indigo-600">{plan.limiteCorreccionesIaMes}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200/60">
                  <Link
                    href={`/superadmin/instituciones?plan=${plan.tipo}`}
                    className="block w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl text-center transition"
                  >
                    Ver Instituciones en este Plan →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
