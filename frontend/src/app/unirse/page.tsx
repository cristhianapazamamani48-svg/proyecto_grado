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
    // Si viene un token en la URL y el usuario ya está autenticado, intentar procesarlo
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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto shadow-lg shadow-indigo-500/30">
            U
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Unirse a una Organización</h1>
          <p className="text-xs text-slate-500">
            Introduce el código de acceso proporcionado por tu institución o usa un enlace de invitación.
          </p>
        </div>

        {mensaje && (
          <div
            className={`p-4 rounded-xl text-sm font-semibold ${
              mensaje.tipo === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {mensaje.texto}
          </div>
        )}

        {tokenInvitacion ? (
          <div className="space-y-4 text-center py-4">
            <p className="text-sm text-slate-700 font-medium">
              Procesando invitación por token...
            </p>
            {!getToken() && (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                  Para aceptar la invitación debes haber iniciado sesión previamente.
                </p>
                <Link
                  href="/docente/login"
                  className="block w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl text-center transition"
                >
                  Iniciar Sesión
                </Link>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleUnirseConCodigo} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Código de Organización
              </label>
              <input
                type="text"
                required
                placeholder="Ej. ABC12345"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-center font-mono font-bold text-lg tracking-widest uppercase focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-indigo-600/20"
            >
              {cargando ? 'Procesando...' : 'Unirse con Código'}
            </button>
          </form>
        )}

        <div className="pt-4 border-t border-slate-100 text-center">
          <Link href="/docente/dashboard" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
            ← Volver al Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function UnirsePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Cargando...</div>}>
      <UnirseContent />
    </Suspense>
  );
}
