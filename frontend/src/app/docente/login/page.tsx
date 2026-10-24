'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { getApiUrl } from '@/lib/api-config';

export default function DocenteLoginPage() {
  const [esRegistro, setEsRegistro] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!googleClientId) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if ((window as any).google?.accounts?.id) {
        (window as any).google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleResponse,
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handleGoogleResponse = async (response: any) => {
    if (!response?.credential) return;
    setCargando(true);
    setError('');
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al autenticar con Google');

      localStorage.setItem('uub_docente_token', data.token);
      localStorage.setItem('uub_docente_nombre', data.usuario.nombre);
      router.push('/docente/dashboard');
    } catch (err: any) {
      setError(err.message || 'No se pudo iniciar sesión con Google');
    } finally {
      setCargando(false);
    }
  };

  const handleGoogleSignIn = () => {
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (googleClientId && (window as any).google?.accounts?.id) {
      (window as any).google.accounts.id.prompt();
    } else {
      setError('El inicio de sesión con Google no está configurado o aún no está disponible.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    const endpoint = esRegistro ? '/auth/docente/registro' : '/auth/docente/login';
    const body = esRegistro ? { nombre, email, password } : { email, password };

    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      let data: any = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const textErr = await res.text();
        throw new Error(`El servidor respondió con error (${res.status}): ${textErr.slice(0, 80)}`);
      }
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 font-sans">
      {/* Outer Card Container */}
      <div className="w-full max-w-4xl bg-white rounded-[32px] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden min-h-[540px] flex flex-col md:flex-row relative transition-all duration-500">
        
        {/* VIEW 1: LOGIN MODE (Form on Left, Solid Blue on Right) */}
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
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-100/70 border border-transparent rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
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
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-100/70 border border-transparent rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                    />
                  </div>

                  {/* Login Button */}
                  <button
                    type="submit"
                    disabled={cargando}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-blue-600/25 cursor-pointer mt-2"
                  >
                    {cargando ? 'Procesando...' : 'Login'}
                  </button>

                  {/* Google Button Separator */}
                  <div className="flex items-center my-3">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">o continúa con</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>

                  {/* Google Sign-In Button */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={cargando}
                    className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 active:scale-[0.99] disabled:opacity-50 text-slate-700 font-bold text-xs rounded-2xl transition-all shadow-sm hover:shadow cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Google</span>
                  </button>
                </form>

                <div className="pt-2 flex flex-col items-center gap-2">
                  <Link href="/" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                    ← Volver al inicio
                  </Link>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <Link href="/legal/aviso-legal" className="hover:text-slate-600 transition-colors">
                      Aviso Legal
                    </Link>
                    <span>·</span>
                    <Link href="/legal/privacidad" className="hover:text-slate-600 transition-colors">
                      Privacidad
                    </Link>
                    <span>·</span>
                    <Link href="/legal/terminos" className="hover:text-slate-600 transition-colors">
                      Términos
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Diagonal Side (Right) */}
            <div className="w-full md:w-5/12 bg-blue-600 text-white relative overflow-hidden flex flex-col justify-between p-8 sm:p-12 min-h-[220px] md:min-h-auto">
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
                <p className="text-xs text-blue-100 leading-relaxed max-w-xs">
                  Regístrate como docente para crear y calificar evaluaciones académicas con IA.
                </p>
              </div>
            </div>
          </>
        ) : (
          /* VIEW 2: SIGN UP MODE (Solid Blue on Left, Form on Right) */
          <>
            {/* Diagonal Side (Left) */}
            <div className="w-full md:w-5/12 bg-blue-600 text-white relative overflow-hidden flex flex-col justify-between p-8 sm:p-12 min-h-[220px] md:min-h-auto order-2 md:order-1">
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
                <p className="text-xs text-blue-100 leading-relaxed max-w-xs">
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
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-100/70 border border-transparent rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
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
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-100/70 border border-transparent rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
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
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-100/70 border border-transparent rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                    />
                  </div>

                  {/* Sign Up Button */}
                  <button
                    type="submit"
                    disabled={cargando}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-blue-600/25 cursor-pointer mt-2"
                  >
                    {cargando ? 'Procesando...' : 'Sign up'}
                  </button>

                  {/* Google Button Separator */}
                  <div className="flex items-center my-3">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">o regístrate con</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>

                  {/* Google Sign-Up Button */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={cargando}
                    className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 active:scale-[0.99] disabled:opacity-50 text-slate-700 font-bold text-xs rounded-2xl transition-all shadow-sm hover:shadow cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Google</span>
                  </button>

                  <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                    Al registrarte, confirmas que aceptas nuestros{' '}
                    <Link href="/legal/terminos" target="_blank" className="text-blue-600 hover:underline">
                      Términos de Servicio
                    </Link>{' '}
                    y{' '}
                    <Link href="/legal/privacidad" target="_blank" className="text-blue-600 hover:underline">
                      Política de Privacidad
                    </Link>.
                  </p>
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
