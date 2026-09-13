import Link from 'next/link';

export default function Home() {
  return (
    <main className="h-screen bg-white font-sans text-slate-800 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-blue-500/30">
            U
          </div>
          <span className="text-lg font-bold text-slate-900 tracking-tight">UUB</span>
          <span className="hidden sm:inline text-xs text-slate-400 font-medium ml-1">Evaluaciones Académicas</span>
        </div>
        <Link
          href="/docente/login"
          className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium rounded-full transition-colors shadow-sm"
        >
          Acceso Docente
        </Link>
      </header>

      {/* Body */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-0 min-h-0">

        {/* Left — Hero */}
        <div className="flex flex-col justify-center px-10 py-8 bg-gradient-to-br from-blue-600 to-indigo-600 text-white order-2 md:order-1">
          <div className="max-w-md">
            <span className="inline-block mb-4 px-3 py-1 bg-white/15 text-white text-xs font-semibold rounded-full uppercase tracking-widest">
              Sistema de Evaluaciones
            </span>
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight mb-4">
              Evaluaciones en vivo, fiables y rápidas
            </h1>
            <p className="text-blue-100 text-base leading-relaxed">
              Crea exámenes, lanza sesiones con un código y obtén resultados automáticos al instante. Sin complicaciones.
            </p>

            <div className="mt-8 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 text-blue-100">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">✓</div>
                Calificación automática
              </div>
              <div className="flex items-center gap-2 text-blue-100">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">✓</div>
                5 tipos de pregunta
              </div>
              <div className="flex items-center gap-2 text-blue-100">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">✓</div>
                Reanudación automática
              </div>
            </div>
          </div>
        </div>

        {/* Right — Join form */}
        <div className="flex flex-col justify-center px-10 py-8 bg-slate-50 order-1 md:order-2">
          <div className="max-w-sm w-full mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Ingresar a una evaluación</h2>
            <p className="text-slate-500 text-sm mb-8">
              Introduce el código que te entregó tu docente y tu nombre completo.
            </p>

            <form action="/unirse" className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                  Código de sesión
                </label>
                <input
                  type="text"
                  name="codigo"
                  maxLength={20}
                  placeholder="Ej: ABC123"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-center text-2xl font-mono font-bold tracking-[0.25em] text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all uppercase placeholder:text-slate-300 placeholder:text-base placeholder:tracking-normal"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                  Nombre completo
                </label>
                <input
                  type="text"
                  name="nombre"
                  placeholder="Ej: Juan Pérez"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              <Link
                href="/unirse"
                className="block w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-full text-center shadow-lg shadow-blue-500/25 transition-colors mt-2"
              >
                Comenzar Evaluación →
              </Link>
            </form>

            <p className="mt-6 text-center text-xs text-slate-400">
              ¿Eres docente?{' '}
              <Link href="/docente/login" className="text-blue-600 font-semibold hover:underline">
                Accede a tu panel
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex-shrink-0 px-8 py-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-400">© {new Date().getFullYear()} Proyecto UUB — Evaluaciones Académicas</span>
        <span className="text-xs text-slate-300">Next.js · NestJS · PostgreSQL</span>
      </footer>
    </main>
  );
}
