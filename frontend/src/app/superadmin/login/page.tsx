'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function SuperadminLoginPage() {
  const router = useRouter();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCargando(true);

    try {
      const res = await fetch(`${API}/auth/login/docente`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Credenciales inválidas');
      }

      if (data.usuario?.rol !== 'SUPER_ADMIN') {
        throw new Error('Acceso denegado: Esta cuenta no posee permisos de Superusuario.');
      }

      localStorage.setItem('uub_docente_token', data.token);
      localStorage.setItem('uub_docente_nombre', `${data.usuario.nombre} ${data.usuario.apellido}`);

      router.push('/superadmin');
    } catch (err: any) {
      setError(err.message || 'Error de autenticación');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 text-slate-100">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto shadow-lg shadow-blue-600/30">
            U
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Panel de Superusuario</h1>
          <p className="text-xs text-slate-400">
            Administración centralizada de la plataforma SaaS Proyecto UUB
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-950/60 border border-red-800 text-red-200 rounded-2xl text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              placeholder="superadmin@uub.edu.pe"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-blue-600/25"
          >
            {cargando ? 'Autenticando...' : 'Ingresar al Panel Superadmin'}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-800 text-center">
          <Link href="/docente/login" className="text-xs text-slate-400 hover:text-slate-200">
            ← Ir al Login Docente Normal
          </Link>
        </div>
      </div>
    </div>
  );
}
