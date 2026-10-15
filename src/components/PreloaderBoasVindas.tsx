/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção Geral
 * Preloader Delicado, Minimalista e Fluido (Estética Executiva e Suave)
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Sparkles, ArrowRight } from 'lucide-react';
import { useNotification } from '../NotificationContext';

interface PreloaderBoasVindasProps {
  readonly onConcluido: () => void;
  readonly sistemaVirgem?: boolean;
}

export function PreloaderBoasVindas({ onConcluido, sistemaVirgem = false }: PreloaderBoasVindasProps) {
  const [progresso, setProgresso] = useState(15);
  const { notifyError } = useNotification();

  const onConcluidoRef = React.useRef(onConcluido);
  useEffect(() => {
    onConcluidoRef.current = onConcluido;
  }, [onConcluido]);

  useEffect(() => {
    // Pacing delicado, fluido e sem sobrecarga (2.4s total)
    const t1 = setTimeout(() => setProgresso(45), 500);
    const t2 = setTimeout(() => setProgresso(75), 1100);
    const t3 = setTimeout(() => setProgresso(100), 1800);

    const t4 = setTimeout(() => {
      try {
        onConcluidoRef.current();
      } catch (err: any) {
        notifyError('Erro na Inicialização', err?.message || 'Falha ao concluir.');
        onConcluidoRef.current();
      }
    }, 2200);

    const safetyValve = setTimeout(() => {
      onConcluidoRef.current();
    }, 4000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(safetyValve);
    };
  }, [notifyError]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.6, ease: 'easeInOut' } }}
      className="fixed inset-0 z-[3000] bg-slate-950/95 backdrop-blur-md text-white flex flex-col items-center justify-center p-6 select-none overflow-hidden"
    >
      <div className="relative z-10 max-w-sm w-full text-center space-y-6 bg-slate-900/60 p-8 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-xl">
        
        {/* LOGO SUTIL E ELEGANTE */}
        <div className="relative inline-flex items-center justify-center mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600/20 via-emerald-600/20 to-yellow-500/20 border border-slate-700/80 flex items-center justify-center shadow-lg">
            <Shield className="w-8 h-8 text-yellow-400" />
          </div>
        </div>

        {/* TÍTULO E SUBTÍTULO DELICADO */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-yellow-400 text-[11px] font-mono tracking-wider uppercase">
            <Sparkles className="w-3 h-3 text-yellow-400" />
            <span>CIMADEBE</span>
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight font-serif">
            Convenção Geral
          </h1>
          <p className="text-xs text-slate-400 font-sans">
            Assembleia de Deus • Sistema Integrado
          </p>
        </div>

        {/* BARRA DE PROGRESSO DELICADA */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Carregando ambiente</span>
            <span className="text-yellow-400 font-bold">{progresso}%</span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <motion.div
              className="bg-gradient-to-r from-blue-500 via-yellow-400 to-emerald-400 h-full rounded-full"
              initial={{ width: '10%' }}
              animate={{ width: `${progresso}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* BOTÃO SUTIL DE ENTRADA */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onConcluido}
            className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-200 hover:text-white transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 group shadow-sm active:scale-95"
          >
            <span>Acessar o Sistema</span>
            <ArrowRight className="w-3.5 h-3.5 text-yellow-400 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

      </div>
    </motion.div>
  );
}
