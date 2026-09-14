'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DocenteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [nombreDocente, setNombreDocente] = useState('Docente');
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const nombre = localStorage.getItem('uub_docente_nombre');
      if (nombre) setNombreDocente(nombre);
    }
  }, []);

  // Si es la página de login, no mostrar la barra lateral
  if (pathname === '/docente/login') {
    return <>{children}</>;
  }

  const handleLogout = () => {
    localStorage.removeItem('uub_docente_token');
    localStorage.removeItem('uub_docente_nombre');
    router.push('/docente/login');
  };

  const navItems = [
    { label: 'Panel principal', href: '/docente/dashboard', icon: '📊' },
    { label: 'Mi biblioteca', href: '/docente/biblioteca', icon: '📚' },
    { label: 'Reportes e informes', href: '/docente/reportes', icon: '📈' },
    { label: 'Nueva evaluación', href: '/docente/evaluacion/nueva', icon: '➕' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm">
            U
          </div>
          <span className="font-bold text-slate-900 text-base">Proyecto UUB</span>
        </div>

        <button
          type="button"
          onClick={() => setMenuMovilAbierto(!menuMovilAbierto)}
          className="p-2 text-slate-600 hover:text-slate-900 font-bold focus:outline-none"
        >
          {menuMovilAbierto ? '✕' : '☰'}
        </button>
      </header>

      {/* Mobile Navigation Drawer */}
      {menuMovilAbierto && (
        <div className="md:hidden bg-white border-b border-slate-200 px-6 py-4 space-y-3 z-30 shadow-md">
          <div className="pb-2 border-b border-slate-100">
            <p className="text-xs text-slate-400 font-semibold uppercase">Docente Autenticado</p>
            <p className="text-sm font-bold text-slate-900">{nombreDocente}</p>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const activo = pathname === item.href || (item.href !== '/docente/dashboard' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuMovilAbierto(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                    activo
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 font-bold text-xs rounded-2xl transition-colors"
          >
            <span className="text-base">🚪</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      )}

      {/* Desktop Sidebar (Navegación Lateral) */}
      <aside className="hidden md:flex flex-col justify-between w-64 bg-white border-r border-slate-200 min-h-screen sticky top-0 z-30 shadow-sm flex-shrink-0">
        <div className="p-6 space-y-8">
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md shadow-blue-500/25">
              U
            </div>
            <div>
              <span className="text-lg font-bold text-slate-900 tracking-tight leading-none block">Proyecto UUB</span>
              <span className="text-[11px] text-slate-400 font-semibold">Panel Docente</span>
            </div>
          </div>

          {/* User Profile Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
              {nombreDocente.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-900 truncate">{nombreDocente}</p>
              <p className="text-[10px] text-slate-400 font-semibold">Docente Autorizado</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Navegación Principal</p>
            {navItems.map((item) => {
              const activo =
                pathname === item.href || (item.href !== '/docente/dashboard' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                    activo
                      ? 'bg-blue-50 text-blue-700 border border-blue-200/80 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Logout */}
        <div className="p-6 border-t border-slate-100">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 font-bold text-xs rounded-2xl transition-colors"
          >
            <span className="text-base">🚪</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
}
