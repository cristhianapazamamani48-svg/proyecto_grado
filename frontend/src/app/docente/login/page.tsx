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
    <div className="min-h-screen bg-indigo-50/40 flex items-center justify-center p-4 sm:p-6 font-sans">
      {/* Outer Card Container */}
      <div className="w-full max-w-4xl bg-white rounded-[32px] shadow-2xl shadow-indigo-500/10 border border-slate-100 overflow-hidden min-h-[540px] flex flex-col md:flex-row relative transition-all duration-500">
        
        {/* VIEW 1: LOGIN MODE (Form on Left, Diagonal Purple on Right) */}
        {!esRegistro ? (
          <>
            {/* Form Area (Left) */}
            <div className="w-full md:w-7/12 p-8 sm:p-12 flex flex-col justify-center z-10">
              <div className="max-w-md w-full mx-auto space-y-6">
                <div>
                  <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Login</h1>
                  <p className="text-xs text-slate-400 mt-1">Accede a tu panel docente de evaluaciones</p>
                </div>

                {error && (
                  <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Email */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-100/70 border border-transparent rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                    />
                  </div>

                  {/* Password */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-100/70 border border-transparent rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                    />
                  </div>

                  {/* Login Button */}
                  <button
                    type="submit"
                    disabled={cargando}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-indigo-600/25 cursor-pointer mt-2"
                  >
                    {cargando ? 'Procesando...' : 'Login'}
                  </button>
                </form>

                <div className="pt-2 text-center">
                  <Link href="/" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                    ← Volver al inicio
                  </Link>
                </div>
              </div>
            </div>

            {/* Diagonal Side (Right) */}
            <div className="w-full md:w-5/12 bg-indigo-600 text-white relative overflow-hidden flex flex-col justify-between p-8 sm:p-12 min-h-[220px] md:min-h-auto">
              <div className="relative z-10 flex justify-end">
                <button
                  type="button"
                  onClick={() => { setEsRegistro(true); setError(''); }}
                  className="px-5 py-2 rounded-full border border-white/40 hover:border-white text-white font-medium text-xs tracking-wide transition-all backdrop-blur-sm hover:bg-white/10 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Sign up</span>
                  <span>→</span>
                </button>
              </div>

              <div className="relative z-10 space-y-2 mt-auto">
                <h3 className="text-2xl font-bold tracking-tight">¿No tienes cuenta?</h3>
                <p className="text-xs text-indigo-100 leading-relaxed max-w-xs">
                  Regístrate como docente para crear y calificar evaluaciones académicas con IA.
                </p>
              </div>
            </div>
          </>
        ) : (
          /* VIEW 2: SIGN UP MODE (Diagonal Purple on Left, Form on Right) */
          <>
            {/* Diagonal Side (Left) */}
            <div className="w-full md:w-5/12 bg-indigo-600 text-white relative overflow-hidden flex flex-col justify-between p-8 sm:p-12 min-h-[220px] md:min-h-auto order-2 md:order-1">
              <div className="relative z-10 flex justify-start">
                <button
                  type="button"
                  onClick={() => { setEsRegistro(false); setError(''); }}
                  className="px-5 py-2 rounded-full border border-white/40 hover:border-white text-white font-medium text-xs tracking-wide transition-all backdrop-blur-sm hover:bg-white/10 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Login</span>
                  <span>→</span>
                </button>
              </div>

              <div className="relative z-10 space-y-2 mt-auto">
                <h3 className="text-2xl font-bold tracking-tight">¿Ya tienes cuenta?</h3>
                <p className="text-xs text-indigo-100 leading-relaxed max-w-xs">
                  Inicia sesión con tus credenciales docente para acceder a tus evaluaciones.
                </p>
              </div>
            </div>

            {/* Form Area (Right) */}
            <div className="w-full md:w-7/12 p-8 sm:p-12 flex flex-col justify-center z-10 order-1 md:order-2">
              <div className="max-w-md w-full mx-auto space-y-6">
                <div>
                  <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Sign up</h1>
                  <p className="text-xs text-slate-400 mt-1">Crea tu cuenta de docente en Proyecto UUB</p>
                </div>

                {error && (
                  <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Name */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Nombre Completo"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-100/70 border border-transparent rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                    />
                  </div>

                  {/* Email */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-100/70 border border-transparent rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                    />
                  </div>

                  {/* Password */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-100/70 border border-transparent rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                    />
                  </div>

                  {/* Sign Up Button */}
                  <button
                    type="submit"
                    disabled={cargando}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-indigo-600/25 cursor-pointer mt-2"
                  >
                    {cargando ? 'Procesando...' : 'Sign up'}
                  </button>
                </form>

                <div className="pt-2 text-center">
                  <Link href="/" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                    ← Volver al inicio
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
