'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/sesiones/unirse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, nombreCompleto }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al unirse a la sesión');
      }

      // Guardar token y tokenReanudacion en localStorage para recuperar sesión si cae la conexión
      localStorage.setItem('uub_guest_token', data.token);
      localStorage.setItem('uub_token_reanudacion', data.tokenReanudacion);
      localStorage.setItem('uub_nombre_estudiante', nombreCompleto);

      router.push(`/examen/${data.sesion.codigo}`);
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado');
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">Unirse a una Evaluación</h1>
          <p className="text-sm text-slate-400">Ingresa el código facilitado por tu docente</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm rounded-lg text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleUnirse} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Código de Sesión
            </label>
            <input
              type="text"
              required
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ej: ABC123"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-center text-2xl font-mono tracking-widest text-indigo-400 focus:outline-none focus:border-indigo-500 transition-colors uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Nombre Completo
            </label>
            <input
              type="text"
              required
              value={nombreCompleto}
              onChange={(e) => setNombreCompleto(e.target.value)}
              placeholder="Ej: Juan Pérez"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-colors disabled:opacity-50"
          >
            {cargando ? 'Ingresando...' : 'Comenzar Evaluación'}
          </button>
        </form>
      </div>
    </main>
  );
}
