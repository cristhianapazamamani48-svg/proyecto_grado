'use client';

import React, { useEffect, useState } from 'react';
import { useMotionValueEvent, useSpring, useTransform } from 'motion/react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export default function AnimatedCounter({
  value,
  duration = 0.8,
  className = '',
  prefix = '',
  suffix = '',
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(() => value.toLocaleString('es-BO'));

  const spring = useSpring(value, {
    stiffness: 85,
    damping: 18,
    duration: duration * 1000,
  });

  const display = useTransform(spring, (current) =>
    Math.round(current).toLocaleString('es-BO')
  );

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useMotionValueEvent(display, 'change', (latest) => {
    setDisplayValue(latest);
  });

  return (
    <span
      suppressHydrationWarning
      className={`inline-flex items-baseline font-black tracking-tight ${className}`}
    >
      {prefix && <span>{prefix}</span>}
      <span>{displayValue}</span>
      {suffix && <span>{suffix}</span>}
    </span>
  );
}
