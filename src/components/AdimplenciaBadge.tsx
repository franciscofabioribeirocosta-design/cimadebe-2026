/**
 * @license
 * CIMADEBE / SIGM - Adimplencia Badge with Framer Motion Transition & Pulsing Icon
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, ShieldAlert, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { formatarRotuloStatus, obterBadgeClassStatus } from '../financialEngine';

interface AdimplenciaBadgeProps {
  readonly status: string;
  readonly className?: string;
  readonly showIcon?: boolean;
}

export function AdimplenciaBadge({ status, className = '', showIcon = true }: AdimplenciaBadgeProps) {
  const st = String(status || 'EM_DIA').toUpperCase();
  const isInadimplente = st === 'INADIMPLENTE' || st === 'EM_ATRASO' || st === 'PENDENTE';
  const badgeClass = obterBadgeClassStatus(st as any);

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border shadow-sm ${badgeClass} ${className}`}
    >
      {showIcon && (
        isInadimplente ? (
          <motion.span
            animate={{ scale: [1, 1.25, 1], opacity: [1, 0.65, 1] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            className="inline-flex items-center"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </motion.span>
        ) : (
          <motion.span
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2 }}
            className="inline-flex items-center"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </motion.span>
        )
      )}
      <span>{formatarRotuloStatus(st as any).toUpperCase()}</span>
    </motion.span>
  );
}
