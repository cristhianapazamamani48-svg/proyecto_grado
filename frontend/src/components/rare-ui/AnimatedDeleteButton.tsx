'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, AlertCircle, X, Check } from 'lucide-react';

interface AnimatedDeleteButtonProps {
  onConfirm: () => void;
  label?: string;
  confirmLabel?: string;
  disabled?: boolean;
  className?: string;
}

export default function AnimatedDeleteButton({
  onConfirm,
  label = 'Eliminar',
  confirmLabel = '¿Confirmar?',
  disabled = false,
  className = '',
}: AnimatedDeleteButtonProps) {
  const [confirmando, setConfirmando] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled) return;
    setConfirmando(true);
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setConfirmando(false);
    onConfirm();
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setConfirmando(false);
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <AnimatePresence mode="wait">
        {!confirmando ? (
          <motion.button
            key="delete-trigger"
            type="button"
            onClick={handleClick}
            disabled={disabled}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
            <span>{label}</span>
          </motion.button>
        ) : (
          <motion.div
            key="delete-confirm"
            initial={{ opacity: 0, scale: 0.85, y: -2 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="flex items-center gap-1 p-1 bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-900/60 rounded-xl shadow-md z-10"
          >
            <span className="flex items-center gap-1 text-[11px] font-extrabold text-red-700 dark:text-red-300 px-1.5">
              <AlertCircle className="w-3 h-3 text-red-500" />
              {confirmLabel}
            </span>
            <button
              type="button"
              onClick={handleConfirm}
              className="p-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold shadow-xs transition-colors cursor-pointer"
              title="Confirmar eliminación"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1 rounded-lg text-slate-500 hover:bg-red-100 dark:hover:bg-red-900/40 text-[10px] transition-colors cursor-pointer"
              title="Cancelar"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

