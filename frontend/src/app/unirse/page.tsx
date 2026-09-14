'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function UnirseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenInvitacion = searchParams.get('token');

  const [codigo, setCodigo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const getToken = () => {
    return typeof window !== 'undefined' ? localStorage.getItem('uub_docente_token') : null;
  };

  useEffect(() => {
    if (tokenInvitacion && getToken()) {
      handleAceptarToken(tokenInvitacion);
    }
  }, [tokenInvitacion]);

  const handleAceptarToken = async (tok: string) => {
    const jwt = getToken();
    if (!jwt) {
      setMensaje({
        tipo: 'error',
        texto: 'Debes iniciar sesión con la cuenta de correo invitada para aceptar esta invitación.',
      });
      return;
    }

    setCargando(true);
    try {
      const res = await fetch(`${API}/organizaciones/aceptar-invitacion/${tok}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const data = await res.json();
      if (res.ok) {
        setMensaje({ tipo: 'ok', texto: data.mensaje || '¡Invitación aceptada exitosamente!' });
        setTimeout(() => router.push('/docente/dashboard'), 3000);
      } else {
        setMensaje({ tipo: 'error', texto: data.message || 'Error al procesar la invitación.' });
      }
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Error de conexión.' });
    } finally {
      setCargando(false);
    }
  };

  const handleUnirseConCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo.trim()) return;

    const jwt = getToken();
    if (!jwt) {
      setMensaje({
        tipo: 'error',
        texto: 'Por favor inicia sesión o regístrate como docente antes de usar un código.',
      });
      return;
    }

    setCargando(true);
    try {
      const res = await fetch(`${API}/organizaciones/unirse-codigo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ codigo: codigo.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setMensaje({ tipo: 'ok', texto: data.mensaje });
        setTimeout(() => router.push('/docente/dashboard'), 3000);
      } else {
        setMensaje({ tipo: 'error', texto: data.message || 'Código inválido o inactivo.' });
      }
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Error de conexión.' });
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
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Instituciones</span>
              </div>
              <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Unirse a Institución</h1>
              <p className="text-xs text-slate-400 mt-1">Introduce el código de acceso institucional o procesa tu invitación</p>
            </div>

            {mensaje && (
              <div
                className={`p-3.5 rounded-2xl text-xs font-semibold ${
                  mensaje.tipo === 'ok'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {mensaje.texto}
              </div>
            )}

            {tokenInvitacion ? (
              <div className="space-y-4 py-2">
                <p className="text-xs text-slate-600 font-medium">Procesando invitación enviada por token...</p>
                {!getToken() && (
                  <div className="space-y-3">
                    <p className="text-xs text-amber-800 bg-amber-50 p-3 rounded-2xl border border-amber-200">
                      Debes haber iniciado sesión con tu cuenta para aceptar la invitación.
                    </p>
                    <Link
                      href="/docente/login"
                      className="block w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl text-center shadow-lg shadow-indigo-600/25 transition-all"
                    >
                      Iniciar Sesión Docente →
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleUnirseConCodigo} className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 0121 9z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="CÓDIGO DE INSTITUCIÓN (ej. ABC12345)"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-100/70 border border-transparent rounded-2xl text-sm font-mono font-bold text-slate-800 tracking-wider placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all uppercase"
                  />
                </div>

                <button
                  type="submit"
                  disabled={cargando}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-indigo-600/25 cursor-pointer mt-2"
                >
                  {cargando ? 'Procesando...' : 'Unirse con Código'}
                </button>
              </form>
            )}

            <div className="pt-2 text-center">
              <Link href="/docente/dashboard" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                ← Volver al Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Right Side: Diagonal Polygon Section */}
        <div className="w-full md:w-5/12 bg-indigo-600 text-white relative overflow-hidden flex flex-col justify-between p-8 sm:p-12 min-h-[220px] md:min-h-auto">
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
            <h3 className="text-2xl font-bold tracking-tight">Acceso Institucional</h3>
            <p className="text-xs text-indigo-100 leading-relaxed max-w-xs">
              Únete a la organización de tu universidad o colegio para colaborar y gestionar evaluaciones.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function UnirsePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-indigo-50/40 flex items-center justify-center text-indigo-600 font-bold">Cargando...</div>}>
      <UnirseContent />
    </Suspense>
  );
}
