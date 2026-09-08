import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-800 flex flex-col">
      {/* Navbar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between bg-white z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold">
            U
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">UUB</span>
        </div>
        <nav className="hidden md:flex gap-8 text-sm font-medium text-slate-600">
          <Link href="#producto" className="hover:text-blue-600 transition-colors">Producto</Link>
          <Link href="#aprende" className="hover:text-blue-600 transition-colors">Aprende</Link>
          <Link href="#socios" className="hover:text-blue-600 transition-colors">Socios</Link>
        </nav>
        <div>
          <Link 
            href="/docente/login" 
            className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
          >
            Acceso Docente
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="w-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white pt-20 pb-32 px-6 relative overflow-hidden">
        {/* Decorative waves / curves could go here as SVG absolute positioning */}
        <div className="max-w-5xl mx-auto flex flex-col items-center text-center relative z-10">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 max-w-3xl leading-tight">
            Evaluaciones en vivo, <br className="hidden md:block"/> fiables y rápidas
          </h1>
          <p className="text-blue-100 mb-10 max-w-xl text-lg">
            Plataforma intuitiva para crear, aplicar y calificar exámenes con soporte avanzado. Deja que el sistema evalúe por ti.
          </p>
          <Link 
            href="/unirse" 
            className="bg-transparent border border-white text-white hover:bg-white hover:text-blue-600 px-8 py-3 rounded-full font-medium transition-all"
          >
            Ingresar como estudiante
          </Link>
          
          {/* Mockup */}
          <div className="mt-16 w-full max-w-4xl bg-white/10 backdrop-blur-md p-4 rounded-3xl border border-white/20 shadow-2xl">
            <div className="bg-white rounded-2xl aspect-[16/9] w-full shadow-inner overflow-hidden flex flex-col">
              <div className="h-12 border-b border-slate-100 flex items-center px-4 gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="flex-1 p-8 flex gap-6 bg-slate-50/50">
                <div className="w-64 space-y-4">
                  <div className="h-8 bg-slate-200 rounded-md w-full animate-pulse"></div>
                  <div className="h-4 bg-slate-200 rounded-md w-3/4 animate-pulse"></div>
                  <div className="h-4 bg-slate-200 rounded-md w-1/2 animate-pulse"></div>
                </div>
                <div className="flex-1 bg-white border border-slate-100 rounded-xl p-6 shadow-sm">
                   <div className="h-6 bg-blue-100 rounded-md w-1/3 mb-6"></div>
                   <div className="space-y-3 mb-8">
                      <div className="h-4 bg-slate-100 rounded-md w-full"></div>
                      <div className="h-4 bg-slate-100 rounded-md w-full"></div>
                      <div className="h-4 bg-slate-100 rounded-md w-4/5"></div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="h-12 border-2 border-blue-500 rounded-lg bg-blue-50"></div>
                      <div className="h-12 border border-slate-200 rounded-lg"></div>
                      <div className="h-12 border border-slate-200 rounded-lg"></div>
                      <div className="h-12 border border-slate-200 rounded-lg"></div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 max-w-7xl mx-auto w-full flex flex-col md:flex-row items-center gap-16">
        <div className="flex-1 space-y-12">
          <h2 className="text-3xl md:text-4xl font-bold text-blue-600 tracking-tight">
            Evaluaciones en las que confiar
          </h2>
          
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">01. Rápidas y Ágiles</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Nuestra plataforma está diseñada para que puedas crear un examen completo en minutos. Usa diferentes tipos de preguntas para evaluar el conocimiento de forma efectiva.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">02. Rentables y Escalables</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Soporta desde un pequeño grupo hasta cientos de estudiantes simultáneamente sin perder rendimiento. La arquitectura moderna garantiza estabilidad.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">03. Análisis en tiempo real</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Obtén calificaciones automáticas y monitorea el progreso de los estudiantes mientras rinden la evaluación. Detecta eventos inusuales al instante.
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 flex justify-center">
          {/* Mobile mockup */}
          <div className="w-80 h-[600px] border-[8px] border-slate-100 rounded-[3rem] bg-white shadow-2xl overflow-hidden flex flex-col relative">
            <div className="absolute top-0 inset-x-0 h-6 bg-slate-100 rounded-b-2xl w-40 mx-auto"></div>
            <div className="flex-1 p-6 pt-12 space-y-6">
              <div className="h-4 bg-slate-200 w-1/3 mx-auto rounded-full"></div>
              <div className="h-32 bg-blue-50 rounded-2xl border border-blue-100 p-4">
                 <div className="h-full w-full relative">
                   <svg viewBox="0 0 100 50" className="absolute inset-0 w-full h-full stroke-blue-500 fill-none" strokeWidth="2">
                      <path d="M0,25 C20,5 30,45 50,25 C70,5 80,45 100,25" />
                   </svg>
                   <svg viewBox="0 0 100 50" className="absolute inset-0 w-full h-full stroke-teal-400 fill-none" strokeWidth="2">
                      <path d="M0,35 C25,35 25,15 50,15 C75,15 75,35 100,35" />
                   </svg>
                 </div>
              </div>
              <div className="space-y-3">
                <div className="h-10 bg-slate-100 rounded-xl"></div>
                <div className="h-10 bg-slate-100 rounded-xl"></div>
                <div className="h-10 bg-blue-600 rounded-xl shadow-md shadow-blue-500/20"></div>
              </div>
            </div>
            <div className="h-16 bg-blue-600 mt-auto flex items-center justify-around px-6 text-white/70">
              <div className="w-6 h-6 rounded-md bg-white/20"></div>
              <div className="w-6 h-6 rounded-md bg-white/20"></div>
              <div className="w-6 h-6 rounded-md bg-white/20"></div>
              <div className="w-6 h-6 rounded-md bg-white/20"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Banner Section */}
      <section className="w-full bg-gradient-to-r from-blue-600 to-indigo-500 py-24 text-center px-6 relative overflow-hidden">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 relative z-10">
          Comprende mejor <br/> a tus estudiantes
        </h2>
        <p className="text-blue-100 max-w-2xl mx-auto mb-10 text-sm md:text-base relative z-10">
          Nuestra plataforma analiza los resultados, detecta áreas de mejora y te proporciona 
          estadísticas claras para adaptar tu contenido educativo a sus necesidades reales.
        </p>
        <Link 
          href="/docente/registro" 
          className="relative z-10 bg-transparent border border-white text-white hover:bg-white hover:text-blue-600 px-8 py-3 rounded-full font-medium transition-all"
        >
          Crear una cuenta
        </Link>
      </section>

      {/* About Section */}
      <section className="py-24 px-6 max-w-7xl mx-auto w-full">
        <h2 className="text-3xl font-bold text-blue-600 mb-16 tracking-tight">Acerca de</h2>
        <div className="grid md:grid-cols-3 gap-12">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Misión</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Facilitar el proceso de evaluación académica proporcionando herramientas intuitivas 
              que ahorren tiempo al docente y ofrezcan una experiencia justa al estudiante.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Visión</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Convertirnos en el estándar de evaluación digital, donde la tecnología 
              se adapta a las metodologías de enseñanza y no al revés.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Tecnología</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Construido con arquitecturas modernas, garantizando seguridad, persistencia de 
              sesiones ante fallos de red y análisis profundo de datos.
            </p>
          </div>
        </div>
      </section>

      {/* Partners Section */}
      <section className="w-full bg-blue-600 py-16 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <h2 className="text-2xl font-bold text-white min-w-max border-r border-blue-400 pr-12">
            Tecnologías
          </h2>
          <div className="flex gap-12 opacity-80 text-white font-bold text-xl uppercase tracking-widest flex-wrap justify-center">
            <span>Next.js</span>
            <span>NestJS</span>
            <span>PostgreSQL</span>
            <span>Tailwind</span>
          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      <section className="w-full bg-blue-500 py-24 px-6 text-center text-white">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm text-blue-100 uppercase tracking-widest mb-6 font-semibold">
            Proyecto de Grado &mdash; UUB
          </p>
          <blockquote className="text-2xl md:text-4xl font-medium leading-tight">
            "Una plataforma diseñada para simplificar y modernizar el proceso de evaluación en entornos académicos, asegurando la integridad y la facilidad de uso."
          </blockquote>
        </div>
      </section>

      {/* Join Session Form */}
      <section className="py-24 px-6 max-w-3xl mx-auto w-full text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-blue-600 mb-8 tracking-tight">
          Ingresa a tu sesión
        </h2>
        <p className="text-slate-500 mb-10 text-sm">
          Ingresa el código proporcionado por tu docente y tu nombre completo.
        </p>
        
        <form className="bg-white text-left space-y-6" action="/unirse">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Código de Sesión *
              </label>
              <input 
                type="text" 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-800"
                placeholder="Ej. A1B2C3"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Nombre Completo *
              </label>
              <input 
                type="text" 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-800"
                placeholder="Juan Pérez"
                required
              />
            </div>
          </div>
          <div className="pt-4 flex justify-center">
             <button 
                type="submit"
                className="bg-blue-600 text-white px-12 py-4 rounded-full font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
             >
               Ingresar a la Evaluación
             </button>
          </div>
        </form>
      </section>

      {/* Footer */}
      <footer className="w-full bg-blue-600 text-blue-100 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 border-t border-blue-500 pt-8">
          <div className="text-sm">
             PROYECTO UUB &copy; {new Date().getFullYear()}
          </div>
          <div className="flex gap-6 text-sm">
             <Link href="#" className="hover:text-white transition-colors">Soporte</Link>
             <Link href="#" className="hover:text-white transition-colors">Privacidad</Link>
             <Link href="#" className="hover:text-white transition-colors">Términos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
