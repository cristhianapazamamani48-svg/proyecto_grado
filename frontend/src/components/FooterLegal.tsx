import Link from 'next/link';

export default function FooterLegal() {
  const anio = new Date().getFullYear();

  return (
    <footer className="w-full bg-white border-t border-slate-200 py-6 px-4 sm:px-8 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-[10px]">
            U
          </div>
          <span className="font-semibold text-slate-700">Proyecto UUB</span>
          <span>— Plataforma de Evaluaciones Académicas</span>
        </div>

        <nav aria-label="Enlaces legales" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-medium">
          <Link href="/legal/terminos" className="hover:text-blue-600 transition-colors">
            Términos de Servicio
          </Link>
          <Link href="/legal/privacidad" className="hover:text-blue-600 transition-colors">
            Política de Privacidad
          </Link>
          <Link href="/legal/cookies" className="hover:text-blue-600 transition-colors">
            Política de Cookies
          </Link>
          <Link href="/legal/aviso-legal" className="hover:text-blue-600 transition-colors">
            Aviso Legal
          </Link>
        </nav>

        <div className="text-slate-400 text-[11px]">
          © {anio} Proyecto UUB. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
