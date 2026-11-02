'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  BarChart3,
  CreditCard,
  LogOut,
  Menu,
  X,
  Plus,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

export default function DocenteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { toggleTema, esOscuro } = useTheme();
  const [nombreDocente, setNombreDocente] = useState('Docente');
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('uub_docente_token');
      if (!token && pathname !== '/docente/login') {
        router.push('/docente/login');
        return;
      }
      const nombre = localStorage.getItem('uub_docente_nombre');
      if (nombre) queueMicrotask(() => setNombreDocente(nombre));
    }
  }, [pathname, router]);

  if (pathname === '/docente/login') {
    return <>{children}</>;
  }

  const handleLogout = () => {
    localStorage.removeItem('uub_docente_token');
    localStorage.removeItem('uub_docente_nombre');
    router.push('/docente/login');
  };

  const navItems = [
    { label: 'Panel principal', href: '/docente/dashboard', icon: LayoutDashboard },
    { label: 'Mi biblioteca', href: '/docente/biblioteca', icon: BookOpen },
    { label: 'Sesiones', href: '/docente/sesiones', icon: Users },
    { label: 'Reportes e informes', href: '/docente/reportes', icon: BarChart3 },
    { label: 'Mi Plan y Suscripción', href: '/docente/organizacion', icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-[#fafafc] dark:bg-[#0d0b14] flex flex-col md:flex-row font-sans text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Mobile Top Header - Diferenciado con fondo sutil lavanda */}
      <header className="md:hidden bg-[#f6f4fa] dark:bg-[#110f1a] border-b border-[#e8e3f2] dark:border-[#221c33] px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-violet-500 rounded-xl flex items-center justify-center text-white font-black text-base shadow-sm shadow-purple-500/30">
            U
          </div>
          <span className="font-bold text-slate-900 dark:text-white text-base">Proyecto UUB</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Toggle Mobile */}
          <button
            type="button"
            onClick={toggleTema}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-purple-100/60 dark:hover:bg-[#1d182d] transition-colors cursor-pointer"
            aria-label="Cambiar modo de color"
          >
            {esOscuro ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-purple-600" />}
          </button>

          <button
            type="button"
            onClick={() => setMenuMovilAbierto(!menuMovilAbierto)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white focus:outline-none flex items-center justify-center cursor-pointer"
            aria-label={menuMovilAbierto ? 'Cerrar menú' : 'Abrir menú'}
          >
            {menuMovilAbierto ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {menuMovilAbierto && (
        <div className="md:hidden bg-[#f6f4fa] dark:bg-[#110f1a] border-b border-[#e8e3f2] dark:border-[#221c33] px-6 py-4 space-y-3 z-30 shadow-md transition-colors">
          <div className="pb-2 border-b border-[#e8e3f2] dark:border-[#221c33]">
            <p className="text-xs text-slate-400 font-semibold uppercase">Docente Autenticado</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{nombreDocente}</p>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const activo = pathname === item.href || (item.href !== '/docente/dashboard' && pathname?.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuMovilAbierto(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                    activo
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-purple-100/60 dark:hover:bg-[#1d182d]'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${activo ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left flex items-center gap-3 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 font-bold text-xs rounded-2xl transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 flex-shrink-0 text-red-600 dark:text-red-400" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      )}

      {/* Desktop Sidebar - Claramente diferenciado con tono lavanda suave y estructura limpia */}
      <aside className="hidden md:flex flex-col justify-between w-68 bg-[#f6f4fa] dark:bg-[#110f1a] border-r border-[#e8e3f2] dark:border-[#221c33] min-h-screen sticky top-0 z-30 shadow-xs flex-shrink-0 transition-colors">
        <div className="p-5 space-y-6">
          {/* Logo Brand con gradiente púrpura */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-violet-500 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md shadow-purple-500/30">
                U
              </div>
              <div>
                <span className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight leading-none block">
                  Proyecto UUB
                </span>
                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold tracking-wide">
                  Panel Académico
                </span>
              </div>
            </div>
          </div>

          {/* User Profile Card - Destaca en blanco puro sobre el fondo lavanda */}
          <div className="p-3 bg-white dark:bg-[#171424] border border-[#e8e3f2] dark:border-[#26203a] rounded-2xl flex items-center gap-3 shadow-2xs">
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-violet-500 text-white font-black text-xs flex items-center justify-center shadow-xs">
                {nombreDocente.charAt(0).toUpperCase()}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-[#171424] rounded-full"></span>
            </div>
            <div className="overflow-hidden min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{nombreDocente}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Docente Activo</p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 dark:text-purple-300/60 uppercase tracking-widest px-3 mb-2">
              Navegación Principal
            </p>
            {navItems.map((item) => {
              const activo =
                pathname === item.href || (item.href !== '/docente/dashboard' && pathname?.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                    activo
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25 translate-x-0.5'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#171424] hover:text-purple-700 dark:hover:text-purple-300 hover:shadow-2xs hover:translate-x-1'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110 ${
                      activo ? 'text-white' : 'text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400'
                    }`}
                  />
                  <span>{item.label}</span>
                  {activo && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer: Modo Nocturno, Logout y Enlaces */}
        <div className="p-4 border-t border-[#e8e3f2] dark:border-[#221c33] space-y-3">
          {/* Switch interactivo de Modo Nocturno / Claro */}
          <button
            type="button"
            onClick={toggleTema}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#171424] hover:bg-purple-50 dark:hover:bg-[#1d182d] border border-[#e8e3f2] dark:border-[#26203a] text-xs font-bold text-slate-700 dark:text-slate-200 transition-all cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-2.5">
              {esOscuro ? (
                <Sun className="w-4 h-4 text-amber-400 transition-transform group-hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 text-purple-600 transition-transform group-hover:-rotate-12" />
              )}
              <span>{esOscuro ? 'Modo Claro' : 'Modo Oscuro'}</span>
            </div>
            <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${esOscuro ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <div className={`w-3 h-3 rounded-full bg-white transition-transform ${esOscuro ? 'translate-x-4' : 'translate-x-0'}`}></div>
            </div>
          </button>

          {/* Botón Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-red-600 dark:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-950/30 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 flex-shrink-0 text-red-600 dark:text-red-400" />
            <span>Cerrar sesión</span>
          </button>

          {/* Links legales */}
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] text-slate-400 text-center pt-1">
            <Link href="/legal/privacidad" className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              Privacidad
            </Link>
            <span>·</span>
            <Link href="/legal/terminos" className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              Términos
            </Link>
            <span>·</span>
            <Link href="/legal/cookies" className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              Cookies
            </Link>
          </div>
        </div>
      </aside>

      {/* Content Area - Fondo en blanco especial de diseño web (#fafafc) */}
      <div className="flex-1 min-w-0 flex flex-col bg-[#fafafc] dark:bg-[#0d0b14]">{children}</div>

      {pathname !== '/docente/evaluacion/nueva' && !pathname?.startsWith('/docente/evaluacion/') && (
        <Link
          href="/docente/dashboard"
          aria-label="Crear nueva evaluación"
          title="Crear nueva evaluación"
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-purple-600 hover:bg-purple-700 px-5 py-3.5 text-sm font-bold text-white shadow-xl shadow-purple-600/30 transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-purple-300"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nueva evaluación</span>
        </Link>
      )}
    </div>
  );
}
