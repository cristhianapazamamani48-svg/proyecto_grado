import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-3xl w-full text-center space-y-8">
        <div className="space-y-3">
          <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-xs font-semibold tracking-wide uppercase border border-indigo-500/30">
            Sistema de Evaluaciones UUB
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Evaluaciones Académicas Inteligentes y Flexibles
          </h1>
          <p className="text-lg text-slate-400 max-w-xl mx-auto">
            Plataforma para docentes y estudiantes. Unete a una evaluación con tu código de sesión o administra tus exámenes.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 pt-4">
          <Link
            href="/unirse"
            className="group p-6 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-indigo-500/50 rounded-2xl transition-all shadow-xl flex flex-col text-left space-y-4"
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xl group-hover:scale-110 transition-transform">
              📝
            </div>
            <div>
              <h2 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors">
                Estudiante — Ingresar a Evaluación
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Ingresa con tu código de sesión y nombre completo. Sin necesidad de estar registrado.
              </p>
            </div>
            <span className="text-xs font-semibold text-indigo-400 flex items-center pt-2">
              Ingresar ahora &rarr;
            </span>
          </Link>

          <Link
            href="/docente/login"
            className="group p-6 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-emerald-500/50 rounded-2xl transition-all shadow-xl flex flex-col text-left space-y-4"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-xl group-hover:scale-110 transition-transform">
              🎓
            </div>
            <div>
              <h2 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                Portal Docente
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Crea evaluaciones, gestiona preguntas con imágenes, programa sesiones y corrige con IA.
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-400 flex items-center pt-2">
              Acceder al Portal &rarr;
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
