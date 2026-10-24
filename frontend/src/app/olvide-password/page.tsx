'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { getApiUrl } from '@/lib/api-config';

export default function OlvidePasswordPage() {
  const [correo, setCorreo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setCargando(true);
    try {
      const respuesta = await fetch(`${getApiUrl()}/auth/olvide-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo }),
      });
      const datos = await respuesta.json();
      setMensaje(datos.mensaje || 'Revisa tu correo si existe una cuenta compatible.');
    } finally {
      setCargando(false);
    }
  }

  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><form onSubmit={enviar} className="w-full max-w-sm space-y-5 bg-white border border-slate-200 p-7 rounded-lg shadow-sm"><h1 className="text-xl font-bold text-slate-900">Recuperar contrasena</h1><p className="text-sm text-slate-500">Te enviaremos un enlace si tu cuenta es compatible.</p><input required type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="Correo" className="w-full border border-slate-300 p-3 rounded" /><button disabled={cargando} className="w-full bg-blue-600 text-white p-3 rounded disabled:opacity-50">{cargando ? 'Enviando...' : 'Enviar enlace'}</button>{mensaje && <p className="text-sm text-slate-600">{mensaje}</p>}<Link className="block text-center text-sm text-blue-600" href="/docente/login">Volver al inicio de sesion</Link></form></main>;
}
