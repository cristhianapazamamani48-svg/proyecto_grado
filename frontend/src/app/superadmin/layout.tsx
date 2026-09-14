'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [nombreSuperadmin, setNombreSuperadmin] = useState('Superadmin');
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('uub_docente_token');
      const nombre = localStorage.getItem('uub_docente_nombre');
      if (nombre) setNombreSuperadmin(nombre);

      if (pathname !== '/superadmin/login' && !token) {
        router.push('/superadmin/login');
      }
    }
  }, [pathname, router]);

  if (pathname === '/superadmin/login') {
    return <>{children}</>;
  }

  const handleLogout = () => {
    localStorage.removeItem('uub_docente_token');
    localStorage.removeItem('uub_docente_nombre');
    router.push('/superadmin/login');
  };

  const navItems = [
    { label: 'Panel Principal', href: '/superadmin', icon: '⚡' },
    { label: 'Instituciones Educativas', href: '/superadmin/instituciones', icon: '🏛️' },
    { label: 'Usuarios y Membresías', href: '/superadmin/usuarios', icon: '👤' },
    { label: 'Planes y Límites SaaS', href: '/superadmin/planes', icon: '💳' },
    { label: 'Consumo de IA', href: '/superadmin/ia', icon: '🤖' },
    { label: 'Auditoría Administrativa', href: '/superadmin/auditoria', icon: '📜' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans text-slate-800">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-slate-900 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm">
            U
          </div>
          <div>
            <span className="font-bold text-white text-sm block leading-none">Proyecto UUB</span>
            <span className="text-[10px] text-blue-400 font-semibold uppercase">Superadmin</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMenuMovilAbierto(!menuMovilAbierto)}
          className="p-2 text-slate-300 hover:text-white font-bold focus:outline-none"
        >
          {menuMovilAbierto ? '✕' : '☰'}
        </button>
      </header>

      {/* Mobile Navigation Drawer */}
      {menuMovilAbierto && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-6 py-4 space-y-3 z-30 shadow-xl text-white">
          <div className="pb-2 border-b border-slate-800">
            <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">Superusuario Autenticado</p>
            <p className="text-sm font-bold text-white">{nombreSuperadmin}</p>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const activo =
                pathname === item.href || (item.href !== '/superadmin' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuMovilAbierto(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                    activo
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
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
            className="w-full text-left flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-900/30 font-bold text-xs rounded-xl transition-colors"
          >
            <span className="text-base">🚪</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      )}

      {/* Desktop Sidebar (Sidebar de Superusuario separado) */}
      <aside className="hidden md:flex flex-col justify-between w-64 bg-slate-900 text-slate-100 min-h-screen sticky top-0 z-30 shadow-xl flex-shrink-0">
        <div className="p-6 space-y-8">
          {/* Logo Superadmin */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-600/30">
              U
            </div>
            <div>
              <span className="text-base font-bold text-white tracking-tight leading-none block">Proyecto UUB</span>
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Superusuario SaaS</span>
            </div>
          </div>

          {/* User Profile Card */}
          <div className="p-3.5 bg-slate-800/90 border border-slate-700/60 rounded-2xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-md">
              {nombreSuperadmin.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate">{nombreSuperadmin}</p>
              <p className="text-[10px] text-blue-400 font-bold uppercase">Superadmin Global</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Administración Global</p>
            {navItems.map((item) => {
              const activo =
                pathname === item.href || (item.href !== '/superadmin' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                    activo
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
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
        <div className="p-6 border-t border-slate-800">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-950/40 font-bold text-xs rounded-2xl transition-colors"
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
