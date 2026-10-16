import Link from 'next/link';
import FooterLegal from '@/components/FooterLegal';

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Header institucional / legal */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:bg-blue-700 transition-colors">
              U
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 tracking-tight block leading-tight">Proyecto UUB</span>
              <span className="text-[11px] text-slate-400 font-semibold">Marco Legal & Cumplimiento</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              ← Volver al inicio
            </Link>
            <Link
              href="/docente/login"
              className="text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3.5 py-1.5 rounded-lg transition-colors shadow-xs"
            >
              Acceso Docente
            </Link>
          </div>
        </div>
      </header>

      {/* Main Legal Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-10 md:p-12">
          {children}
        </div>
      </main>

      {/* Footer */}
      <FooterLegal />
    </div>
  );
}
