'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/api-config';

export default function RestablecerPasswordPage() {
  const [token, setToken] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => setToken(new URLSearchParams(window.location.search).get('token') || ''), []);

  async function restablecer(evento: FormEvent) {
    evento.preventDefault();
    setCargando(true);
    try {
      const respuesta = await fetch(`${getApiUrl()}/auth/restablecer-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nuevaPassword }),
      });
      const datos = await respuesta.json();
      setMensaje(respuesta.ok ? datos.mensaje : (datos.message || 'No se pudo restablecer la contrasena.'));
    } finally {
      setCargando(false);
    }
  }

  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><form onSubmit={restablecer} className="w-full max-w-sm space-y-5 bg-white border border-slate-200 p-7 rounded-lg shadow-sm"><h1 className="text-xl font-bold text-slate-900">Nueva contrasena</h1><input required minLength={8} type="password" value={nuevaPassword} onChange={(e) => setNuevaPassword(e.target.value)} placeholder="Minimo 8 caracteres" className="w-full border border-slate-300 p-3 rounded" /><button disabled={cargando || !token} className="w-full bg-blue-600 text-white p-3 rounded disabled:opacity-50">{cargando ? 'Guardando...' : 'Restablecer contrasena'}</button>{mensaje && <p className="text-sm text-slate-600">{mensaje}</p>}<Link className="block text-center text-sm text-blue-600" href="/docente/login">Ir al inicio de sesion</Link></form></main>;
}
