'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getApiUrl } from '@/lib/api-config';

type Modo = 'examen' | 'institucion';

function UnirseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenInvitacion = searchParams.get('token');
  const API = getApiUrl();

  const [modo, setModo] = useState<Modo>(tokenInvitacion ? 'institucion' : 'examen');

  // Ingreso a examen (participante sin cuenta)
  const [codigoExamen, setCodigoExamen] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');

  // Ingreso a institución (docente con cuenta)
  const [codigoInstitucion, setCodigoInstitucion] = useState('');

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

  const cambiarModo = (nuevo: Modo) => {
    if (nuevo === modo) return;
    setModo(nuevo);
    setMensaje(null);
  };

  const handleUnirseAExamen = async (e: React.FormEvent) => {
    e.preventDefault();
    const codigo = codigoExamen.trim().toUpperCase();
    const nombre = nombreCompleto.trim();
    if (!codigo || !nombre) {
      setMensaje({ tipo: 'error', texto: 'Ingresa el código de la sesión y tu nombre completo.' });
      return;
    }

    setCargando(true);
    setMensaje(null);
    try {
      const res = await fetch(`${API}/sesiones/unirse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, nombreCompleto: nombre }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.token) {
        setMensaje({
          tipo: 'error',
          texto: data?.message || 'No se pudo unir a la sesión. Verifica el código e inténtalo de nuevo.',
        });
        return;
      }

      // Credenciales del participante para rendir y para reanudar si pierde la conexión.
      localStorage.setItem('uub_guest_token', data.token);
      if (data.tokenAcceso) {
        localStorage.setItem('uub_token_reanudacion', data.tokenAcceso);
      }

      router.push(`/examen/${codigo}`);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Error de conexión. Inténtalo de nuevo.' });
    } finally {
      setCargando(false);
    }
  };

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
    const codigo = codigoInstitucion.trim();
    if (!codigo) return;

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
        body: JSON.stringify({ codigo }),
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
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                  {modo === 'examen' ? 'Participantes' : 'Instituciones'}
                </span>
              </div>
              <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
                {modo === 'examen' ? 'Rendir Examen' : 'Unirse a Institución'}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                {modo === 'examen'
                  ? 'Ingresa el código que te compartió tu docente'
                  : 'Introduce el código de acceso institucional o procesa tu invitación'}
              </p>
            </div>

            {/* Selector de modo */}
            <div className="flex gap-1 rounded-2xl bg-slate-100/70 p-1">
              <button
                type="button"
                onClick={() => cambiarModo('examen')}
                aria-pressed={modo === 'examen'}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  modo === 'examen'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Rendir examen
              </button>
              <button
                type="button"
                onClick={() => cambiarModo('institucion')}
                aria-pressed={modo === 'institucion'}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  modo === 'institucion'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Institución
              </button>
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

            {modo === 'examen' ? (
              <form onSubmit={handleUnirseAExamen} className="space-y-4">
                <div>
                  <label htmlFor="codigo-sesion" className="block text-xs font-semibold text-slate-500 mb-1.5">
                    Código de sesión
                  </label>
                  <input
                    id="codigo-sesion"
                    type="text"
                    required
                    autoComplete="off"
                    placeholder="EJ. AB3C7D"
                    value={codigoExamen}
                    onChange={(e) => setCodigoExamen(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3.5 bg-slate-100/70 border border-transparent rounded-2xl text-sm font-mono font-bold text-slate-800 tracking-[0.3em] placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all uppercase"
                  />
                </div>

                <div>
                  <label htmlFor="nombre-completo" className="block text-xs font-semibold text-slate-500 mb-1.5">
                    Nombre completo
                  </label>
                  <input
                    id="nombre-completo"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Nombres y apellidos"
                    value={nombreCompleto}
                    onChange={(e) => setNombreCompleto(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-100/70 border border-transparent rounded-2xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={cargando}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-indigo-600/25 cursor-pointer mt-2"
                >
                  {cargando ? 'Ingresando...' : 'Comenzar Examen'}
                </button>

                <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                  No necesitas crear una cuenta. Si pierdes la conexión podrás retomar tu examen desde donde lo dejaste.
                </p>
              </form>
            ) : tokenInvitacion ? (
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
                    aria-label="Código de institución"
                    placeholder="CÓDIGO DE INSTITUCIÓN (ej. ABC12345)"
                    value={codigoInstitucion}
                    onChange={(e) => setCodigoInstitucion(e.target.value.toUpperCase())}
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
              {modo === 'examen' ? (
                <Link href="/docente/login" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                  ¿Eres docente? Inicia sesión aquí →
                </Link>
              ) : (
                <Link href="/docente/dashboard" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                  ← Volver al Dashboard
                </Link>
              )}
              <div className="flex items-center justify-center gap-2 pt-1 text-[10px] text-slate-400">
                <Link href="/legal/privacidad" className="hover:text-slate-600 transition-colors">
                  Privacidad
                </Link>
                <span>·</span>
                <Link href="/legal/cookies" className="hover:text-slate-600 transition-colors">
                  Cookies
                </Link>
                <span>·</span>
                <Link href="/legal/terminos" className="hover:text-slate-600 transition-colors">
                  Términos
                </Link>
              </div>
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
            <h3 className="text-2xl font-bold tracking-tight">
              {modo === 'examen' ? 'Evaluación en Línea' : 'Acceso Institucional'}
            </h3>
            <p className="text-xs text-indigo-100 leading-relaxed max-w-xs">
              {modo === 'examen'
                ? 'Ingresa el código de sesión y tu nombre para rendir la evaluación. Tus respuestas se guardan automáticamente.'
                : 'Únete a la organización de tu universidad o colegio para colaborar y gestionar evaluaciones.'}
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
