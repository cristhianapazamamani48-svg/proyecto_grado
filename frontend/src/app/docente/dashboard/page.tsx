'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PenLine, FileText, Sparkles, ArrowRight } from 'lucide-react';

const opcionesCreacion = [
  {
    modo: 'MANUAL',
    icono: PenLine,
    colorIcono: 'text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/70 ring-1 ring-purple-500/20',
    colorBoton: 'text-purple-700 dark:text-purple-300',
    titulo: 'Crear manualmente',
    descripcion: 'Diseña la evaluación y agrega tus propias preguntas paso a paso.',
    estilo: 'border-purple-200/90 bg-purple-50/70 hover:border-purple-400 dark:bg-purple-950/25 dark:border-purple-900/60 dark:hover:border-purple-600',
  },
  {
    modo: 'PDF',
    icono: FileText,
    colorIcono: 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/70 ring-1 ring-emerald-500/20',
    colorBoton: 'text-emerald-700 dark:text-emerald-300',
    titulo: 'Usar PDF',
    descripcion: 'Prepara preguntas a partir del contenido de un documento PDF con asistencia IA.',
    estilo: 'border-emerald-200/90 bg-emerald-50/70 hover:border-emerald-400 dark:bg-emerald-950/25 dark:border-emerald-900/60 dark:hover:border-emerald-600',
  },
  {
    modo: 'TEMA',
    icono: Sparkles,
    colorIcono: 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/70 ring-1 ring-amber-500/20',
    colorBoton: 'text-amber-700 dark:text-amber-300',
    titulo: 'Generar por tema',
    descripcion: 'Indica un tema y prepara una evaluación automática para revisarla.',
    estilo: 'border-amber-200/90 bg-amber-50/70 hover:border-amber-400 dark:bg-amber-950/25 dark:border-amber-900/60 dark:hover:border-amber-600',
  },
] as const;

export default function DocenteDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('uub_docente_token')) {
      router.push('/docente/login');
    }
  }, [router]);

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-[#fafafc] dark:bg-[#0d0b14] p-6 font-sans text-slate-800 dark:text-slate-100 md:p-10 transition-colors">
      <section className="w-full max-w-5xl space-y-8">
        <header className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Crear una evaluación</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Elige cómo quieres preparar tu próxima evaluación.</p>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          {opcionesCreacion.map(({ modo, icono: Icono, colorIcono, colorBoton, titulo, descripcion, estilo }) => (
            <Link
              key={modo}
              href={`/docente/evaluacion/nueva?modo=${modo}`}
              className={`group flex min-h-64 flex-col items-center justify-center rounded-3xl border p-7 text-center shadow-xs transition-all hover:-translate-y-1 hover:shadow-xl ${estilo}`}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-xs ${colorIcono}`}>
                <Icono className="w-7 h-7" />
              </div>
              <h2 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">{titulo}</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{descripcion}</p>
              <span className={`mt-5 inline-flex items-center gap-1.5 text-xs font-bold ${colorBoton} group-hover:underline`}>
                Continuar <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
