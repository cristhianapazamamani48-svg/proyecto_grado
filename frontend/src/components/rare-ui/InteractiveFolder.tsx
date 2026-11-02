'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { MoreVertical, FileText, Play, Users, Folder, FolderOpen } from 'lucide-react';
import Link from 'next/link';

interface InteractiveFolderProps {
  id: number;
  nombre: string;
  descripcion?: string | null;
  estado: string;
  cantidadPreguntas: number;
  cantidadSesiones?: number;
  onLanzar?: () => void;
  onMenuToggle?: () => void;
  menuAbierto?: boolean;
  menuContenido?: React.ReactNode;
}

const ESTADO_COLORES: Record<string, { badge: string; tab: string }> = {
  PUBLICADA: {
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
    tab: 'bg-emerald-500',
  },
  BORRADOR: {
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
    tab: 'bg-amber-500',
  },
  ARCHIVADA: {
    badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    tab: 'bg-slate-400',
  },
};

export default function InteractiveFolder({
  id,
  nombre,
  descripcion,
  estado,
  cantidadPreguntas,
  cantidadSesiones = 0,
  onLanzar,
  onMenuToggle,
  menuAbierto = false,
  menuContenido,
}: InteractiveFolderProps) {
  const [hovered, setHovered] = useState(false);
  const colores = ESTADO_COLORES[estado] || ESTADO_COLORES.BORRADOR;

  return (
    <motion.div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className={`relative flex flex-col justify-between rounded-3xl border transition-all duration-300 bg-white dark:bg-[#131d31] p-6 shadow-xs hover:shadow-xl ${
        menuAbierto ? 'z-30' : 'z-10'
      } ${
        hovered
          ? 'border-blue-400 shadow-blue-500/10 dark:shadow-black/50'
          : 'border-slate-200/90 dark:border-[#1e2c4a]'
      }`}
    >
      {/* Pestaña superior integrada limpia (Folder Top Tab) */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#1e2c4a]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400">
            {hovered ? (
              <FolderOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            ) : (
              <Folder className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full uppercase border ${colores.badge}`}>
            {estado}
          </span>
        </div>

        {/* Menú de opciones de tres puntos libre de interferencias */}
        <div className="relative">
          <button
            type="button"
            onClick={onMenuToggle}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1a2744] transition-colors cursor-pointer"
            aria-label="Opciones de evaluación"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuAbierto && (
            <div className="relative z-50">
              {menuContenido}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 pt-3">
        {/* Título y Descripción */}
        <div className="space-y-1">
          <h3 className="font-extrabold text-slate-900 dark:text-white text-base leading-snug line-clamp-2">
            {nombre}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-300 line-clamp-2 leading-relaxed">
            {descripcion || 'Sin descripción asignada'}
          </p>
        </div>

        {/* Metadatos */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-[#1e2c4a] text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>
              <strong>{cantidadPreguntas}</strong> {cantidadPreguntas === 1 ? 'pregunta' : 'preguntas'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>
              <strong>{cantidadSesiones}</strong> {cantidadSesiones === 1 ? 'sesión' : 'sesiones'}
            </span>
          </div>
        </div>
      </div>

      {/* Botón de acción inferior */}
      <div className="pt-4 mt-2">
        {estado === 'PUBLICADA' ? (
          <motion.button
            type="button"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={onLanzar}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-md shadow-blue-500/20 transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Lanzar Nueva Sesión</span>
          </motion.button>
        ) : (
          <Link
            href={`/docente/evaluacion/${id}/editar`}
            className="block w-full py-2 bg-slate-50 dark:bg-[#0e172a] hover:bg-slate-100 dark:hover:bg-[#1a2744] border border-slate-200/80 dark:border-[#1e2c4a] text-slate-600 dark:text-slate-300 font-bold text-[11px] text-center rounded-2xl transition-colors"
          >
            Editar para publicar
          </Link>
        )}
      </div>
    </motion.div>
  );
}
