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
    <div className="min-h-screen bg-indigo-50/40 flex items-center justify-center p-4 sm:p-6 font-sans">
      {/* Outer Card Container */}
      <div className="w-full max-w-4xl bg-white rounded-[32px] shadow-2xl shadow-indigo-500/10 border border-slate-100 overflow-hidden min-h-[520px] flex flex-col md:flex-row relative">
        
        {/* Left Side: Form Area */}
        <div className="w-full md:w-7/12 p-8 sm:p-12 flex flex-col justify-center z-10">
          <div className="max-w-md w-full mx-auto space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-600/30">
                  U
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Superusuario SaaS</span>
              </div>
              <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Login Superadmin</h1>
              <p className="text-xs text-slate-400 mt-1">Acceso restringido a la administración global de Proyecto UUB</p>
            </div>

            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl animate-shake">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Input Email */}
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
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-100/70 border border-transparent rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                />
              </div>

              {/* Input Password */}
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

              {/* Submit Button */}
              <button
                type="submit"
                disabled={cargando}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-indigo-600/25 cursor-pointer mt-2"
              >
                {cargando ? 'Procesando...' : 'Login Superadmin'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Diagonal Polygon Section */}
        <div className="w-full md:w-5/12 bg-indigo-600 text-white relative overflow-hidden flex flex-col justify-between p-8 sm:p-12 min-h-[220px] md:min-h-auto">
          {/* Diagonal SVG Background overlay */}
          <div 
            className="absolute inset-0 bg-indigo-600 z-0"
            style={{
              clipPath: 'polygon(0 0, 100% 0, 100% 100%, 25% 100%)',
            }}
          />
          
          <div className="relative z-10 flex justify-end">
            <Link
              href="/docente/login"
              className="px-5 py-2 rounded-full border border-white/40 hover:border-white text-white font-medium text-xs tracking-wide transition-all backdrop-blur-sm hover:bg-white/10 flex items-center gap-1.5"
            >
              <span>Acceso Docente</span>
              <span>→</span>
            </Link>
          </div>

          <div className="relative z-10 space-y-2 mt-auto">
            <h3 className="text-2xl font-bold tracking-tight">Administración SaaS</h3>
            <p className="text-xs text-indigo-100 leading-relaxed max-w-xs">
              Monitoreo centralizado de instituciones educativas, consumo de IA y usuarios globales.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
