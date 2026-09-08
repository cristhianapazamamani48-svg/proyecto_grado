'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function UnirsePage() {
  const [codigo, setCodigo] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  const handleUnirse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const res = await fetch(`${API}/sesiones/unirse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, nombreCompleto }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al unirse a la sesión');

      localStorage.setItem('uub_guest_token', data.token);
      localStorage.setItem('uub_token_reanudacion', data.tokenAcceso);
      localStorage.setItem('uub_nombre_estudiante', nombreCompleto);

      router.push(`/examen/${data.sesion.codigo}`);
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado');
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-xl shadow-blue-500/25 mx-auto">U</div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Ingresar a Evaluación</h1>
            <p className="text-slate-500 mt-2 text-sm">Introduce el código de sesión y tu nombre para comenzar.</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleUnirse} className="space-y-5 bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">Código de Sesión</label>
            <input
              type="text"
              required
              maxLength={20}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ej: ABC123"
              className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-3xl font-mono font-bold tracking-[0.3em] text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all uppercase placeholder:text-slate-300 placeholder:text-2xl placeholder:tracking-normal"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">Nombre Completo</label>
            <input
              type="text"
              required
              value={nombreCompleto}
              onChange={(e) => setNombreCompleto(e.target.value)}
              placeholder="Ej: Juan Pérez"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-full shadow-lg shadow-blue-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cargando ? 'Ingresando...' : 'Comenzar Evaluación'}
          </button>
        </form>

        <div className="text-center">
          <Link href="/" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
