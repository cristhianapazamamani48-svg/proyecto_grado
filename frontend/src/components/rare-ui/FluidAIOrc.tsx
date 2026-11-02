'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface FluidAIOrcProps {
  estado?: 'idle' | 'generando' | 'completado';
  mensaje?: string;
  className?: string;
}

export default function FluidAIOrc({
  estado = 'generando',
  mensaje = 'Claude está formulando las preguntas...',
  className = '',
}: FluidAIOrcProps) {
  return (
    <div
      data-estado={estado}
      className={`flex flex-col items-center justify-center p-8 text-center ${className}`}
    >
      {/* Esfera fluida con halos concéntricos en paleta Indigo / Violeta */}
      <div className="relative w-36 h-36 flex items-center justify-center">
        {/* Halo exterior pulsante */}
        <motion.div
          animate={{
            scale: [1, 1.25, 1],
            opacity: [0.25, 0.55, 0.25],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500/30 via-indigo-400/20 to-violet-600/30 blur-xl"
        />

        {/* Capa de orbe intermedia */}
        <motion.div
          animate={{
            rotate: [360, 0],
            scale: [0.95, 1.05, 0.95],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="absolute w-28 h-28 rounded-full border border-indigo-400/30 dark:border-indigo-300/20 bg-gradient-to-bl from-blue-600/40 via-indigo-700/30 to-slate-900/60 backdrop-blur-sm shadow-inner"
        />

        {/* Núcleo fluido central brillante */}
        <motion.div
          animate={{
            scale: [1, 1.12, 1],
            boxShadow: [
              '0 0 20px rgba(12, 179, 213, 0.4)',
              '0 0 35px rgba(40, 202, 232, 0.7)',
              '0 0 20px rgba(12, 179, 213, 0.4)',
            ],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30"
        >
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles className="w-8 h-8 text-white drop-shadow-md" />
          </motion.div>
        </motion.div>

        {/* Ondas orbitales expansivas */}
        <motion.div
          animate={{
            scale: [0.8, 1.6],
            opacity: [0.7, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeOut',
          }}
          className="absolute w-24 h-24 rounded-full border border-indigo-400/40 pointer-events-none"
        />
      </div>

      {/* Texto de estado fluido */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 space-y-1.5"
      >
        <p className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
          Generador Asistido de Evaluaciones
        </p>
        <motion.p
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold"
        >
          {mensaje}
        </motion.p>
      </motion.div>
    </div>
  );
}
