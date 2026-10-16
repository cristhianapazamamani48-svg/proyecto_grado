'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const COOKIE_CONSENT_KEY = 'uub_cookie_consent_v1';

export default function BannerCookies() {
  const [mostrar, setMostrar] = useState(false);
  const [detallesAbiertos, setDetallesAbiertos] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!consent) {
        setMostrar(true);
      }
    } catch {
      // Ignorar errores de localStorage restringido
    }
  }, []);

  const aceptarTodas = () => {
    try {
      localStorage.setItem(
        COOKIE_CONSENT_KEY,
        JSON.stringify({
          esenciales: true,
          analiticas: true,
          preferencias: true,
          fecha: new Date().toISOString(),
        })
      );
    } catch {}
    setMostrar(false);
  };

  const aceptarSoloEsenciales = () => {
    try {
      localStorage.setItem(
        COOKIE_CONSENT_KEY,
        JSON.stringify({
          esenciales: true,
          analiticas: false,
          preferencias: false,
          fecha: new Date().toISOString(),
        })
      );
    } catch {}
    setMostrar(false);
  };

  if (!mostrar) return null;

  return (
    <aside
      aria-label="Aviso de cookies y privacidad"
      role="region"
      className="fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4 md:p-6 flex justify-center pointer-events-none animate-in fade-in slide-in-from-bottom duration-300"
    >
      <div className="w-full max-w-4xl bg-slate-900/95 text-white backdrop-blur-md rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-700/60 pointer-events-auto flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl" role="img" aria-label="Cookie">
              🍪
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Privacidad y Cookies en Proyecto UUB
              </h2>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Utilizamos cookies técnicas y almacenamiento local esenciales para autenticación segura (JWT),
                persistencia de sesiones de evaluación y prevención de pérdida de respuestas.
                Puedes aceptar todas o limitar el uso a solo las estrictamente necesarias.
              </p>
            </div>
          </div>
        </div>

        {detallesAbiertos && (
          <div className="bg-slate-800/80 rounded-xl p-4 text-xs text-slate-300 space-y-2 border border-slate-700">
            <p className="font-semibold text-white">Detalle de almacenamiento:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li>
                <strong className="text-slate-200">Técnicas / Esenciales:</strong> JWT de autenticación docente/superadmin, token de participante invitado y token de reanudación de examen (indispensables para rendir evaluaciones).
              </li>
              <li>
                <strong className="text-slate-200">Preferencias:</strong> Guardado de estado de interfaz (como el consentimiento de este aviso).
              </li>
              <li>
                <strong className="text-slate-200">Analíticas / Rendimiento:</strong> Métricas agregadas de rendimiento de sesiones sin rastreo publicitario entre sitios de terceros.
              </li>
            </ul>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-slate-800">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <button
              type="button"
              onClick={() => setDetallesAbiertos(!detallesAbiertos)}
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors cursor-pointer"
            >
              {detallesAbiertos ? 'Ocultar detalles' : 'Configurar / Ver detalles'}
            </button>
            <span>•</span>
            <Link
              href="/legal/cookies"
              className="text-slate-400 hover:text-slate-200 underline underline-offset-2 transition-colors"
            >
              Política de cookies
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={aceptarSoloEsenciales}
              className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-200 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              Solo esenciales
            </button>
            <button
              type="button"
              onClick={aceptarTodas}
              className="flex-1 sm:flex-none px-5 py-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              Aceptar todas
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
