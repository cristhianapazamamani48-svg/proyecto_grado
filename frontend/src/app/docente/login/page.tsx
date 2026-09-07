'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DocenteLoginPage() {
  const [esRegistro, setEsRegistro] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    const endpoint = esRegistro ? '/auth/docente/registro' : '/auth/docente/login';
    const body = esRegistro ? { nombre, email, password } : { email, password };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error de autenticación');

      localStorage.setItem('uub_docente_token', data.token);
      localStorage.setItem('uub_docente_nombre', data.usuario.nombre);

      router.push('/docente/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error inesperado');
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">
            {esRegistro ? 'Crear Cuenta Docente' : 'Portal Docente'}
          </h1>
          <p className="text-sm text-slate-400">
            {esRegistro ? 'Registra tus datos para comenzar' : 'Ingresa tus credenciales de acceso'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm rounded-lg text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {esRegistro && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Nombre Completo</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Prof. Carlos Ruiz"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Correo Electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="docente@institucion.edu"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-colors disabled:opacity-50"
          >
            {cargando ? 'Procesando...' : esRegistro ? 'Registrarse' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => setEsRegistro(!esRegistro)}
            className="text-xs font-semibold text-emerald-400 hover:underline"
          >
            {esRegistro ? '¿Ya tienes cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate aquí'}
          </button>
        </div>
      </div>
    </main>
  );
}
