'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
      const res = await fetch(`${API}${endpoint}`, {
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
    <main className="min-h-screen bg-slate-50 flex">
      {/* Panel izquierdo decorativo */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-blue-500 to-indigo-600 p-16 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-bold text-xl">U</div>
          <span className="text-2xl font-bold tracking-tight">UUB</span>
        </div>
        <div className="space-y-6">
          <h2 className="text-4xl font-bold leading-tight">
            Evaluaciones académicas<br />modernas y confiables
          </h2>
          <p className="text-blue-100 leading-relaxed max-w-sm">
            Crea, gestiona y califica evaluaciones con soporte para múltiples tipos de preguntas, sesiones en tiempo real y monitoreo de participantes.
          </p>
        </div>
        <p className="text-blue-200 text-sm">Proyecto de Grado · UUB</p>
      </div>

      {/* Panel derecho: formulario */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-2 mb-4">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">U</div>
            <span className="text-xl font-bold text-slate-900">UUB</span>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              {esRegistro ? 'Crear cuenta' : 'Iniciar sesión'}
            </h1>
            <p className="text-slate-500 mt-2 text-sm">
              {esRegistro ? 'Regístrate como docente para comenzar.' : 'Accede a tu panel de evaluaciones.'}
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {esRegistro && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Prof. Carlos Ruiz"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">Correo Electrónico</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="docente@institucion.edu"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-lg shadow-blue-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cargando ? 'Procesando...' : esRegistro ? 'Crear cuenta' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => { setEsRegistro(!esRegistro); setError(''); }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
            >
              {esRegistro ? '¿Ya tienes cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate'}
            </button>
          </div>

          <div className="text-center">
            <Link href="/" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
