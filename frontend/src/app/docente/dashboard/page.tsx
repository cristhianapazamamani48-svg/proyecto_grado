'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const opcionesCreacion = [
  {
    modo: 'MANUAL',
    icono: '✍️',
    titulo: 'Crear manualmente',
    descripcion: 'Diseña la evaluación y agrega tus propias preguntas.',
    estilo: 'border-blue-200 bg-blue-50 hover:border-blue-400',
  },
  {
    modo: 'PDF',
    icono: '📄',
    titulo: 'Usar PDF',
    descripcion: 'Prepara preguntas a partir del contenido de un documento PDF.',
    estilo: 'border-violet-200 bg-violet-50 hover:border-violet-400',
  },
  {
    modo: 'TEMA',
    icono: '💡',
    titulo: 'Generar por tema',
    descripcion: 'Indica un tema y prepara una evaluación para revisarla.',
    estilo: 'border-amber-200 bg-amber-50 hover:border-amber-400',
  },
] as const;

export default function DocenteDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem('uub_docente_token')) {
      router.push('/docente/login');
    }
  }, [router]);

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-slate-50 p-6 font-sans text-slate-800 md:p-10">
      <section className="w-full max-w-5xl space-y-8">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Crear una evaluación</h1>
          <p className="mt-2 text-sm text-slate-500">Elige cómo quieres preparar tu próxima evaluación.</p>
        </header>

        <div className="grid gap-5 md:grid-cols-3">
          {opcionesCreacion.map(({ modo, icono, titulo, descripcion, estilo }) => (
            <Link
              key={modo}
              href={`/docente/evaluacion/nueva?modo=${modo}`}
              className={`group flex min-h-64 flex-col items-center justify-center rounded-3xl border p-7 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md ${estilo}`}
            >
              <span className="text-4xl" aria-hidden="true">{icono}</span>
              <h2 className="mt-5 text-lg font-bold text-slate-900">{titulo}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{descripcion}</p>
              <span className="mt-5 text-sm font-bold text-blue-700 group-hover:underline">Continuar →</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
