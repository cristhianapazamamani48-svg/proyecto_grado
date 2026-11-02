'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Tema = 'light' | 'dark';

interface ThemeContextType {
  tema: Tema;
  toggleTema: () => void;
  esOscuro: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  tema: 'light',
  toggleTema: () => {},
  esOscuro: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>('light');

  useEffect(() => {
    const guardado = localStorage.getItem('uub_theme') as Tema | null;
    const temaInicial: Tema =
      guardado === 'dark' ||
      (!guardado && window.matchMedia('(prefers-color-scheme: dark)').matches)
        ? 'dark'
        : 'light';
    queueMicrotask(() => setTema(temaInicial));
    if (temaInicial === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTema = () => {
    const nuevoTema: Tema = tema === 'light' ? 'dark' : 'light';
    setTema(nuevoTema);
    localStorage.setItem('uub_theme', nuevoTema);

    if (nuevoTema === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <ThemeContext.Provider value={{ tema, toggleTema, esOscuro: tema === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
