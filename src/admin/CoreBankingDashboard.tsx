/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Módulo de Gestão AGO: Inscrição AGO, Evento AGO, Plano AGO e DRE AGO
 * Arquitetura Limpa com Páginas em Branco / Clean Canvas
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCheck,
  Calendar,
  Layers,
  Receipt,
  Building2,
} from 'lucide-react';
import { AdminDreAgo } from './AdminDreAgo';
import { AdminInscricaoPlano1Ago } from './AdminInscricaoPlano1Ago';
import { AdminPlanosAgo } from './AdminPlanosAgo';
import { AdminEventoAgo } from './AdminEventoAgo';
import { useSecurity } from '../SecurityContext';

export type SubAbaAgo = 'inscricao-ago' | 'evento-ago' | 'plano-ago' | 'dre-ago';

interface CoreBankingDashboardProps {
  readonly onAlternarParaPortal?: () => void;
  readonly abaPadrao?: SubAbaAgo;
}

export function CoreBankingDashboard({
  abaPadrao = 'inscricao-ago',
}: CoreBankingDashboardProps) {
  const { tenantAtivo, operadorAtual } = useSecurity();
  const [subAba, setSubAba] = useState<SubAbaAgo>(abaPadrao);

  return (
    <div className="space-y-6">
      {/* Header do Módulo Gestão AGO */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-indigo-500/30 backdrop-blur-xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.25)]">
            <Layers className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-indigo-400 uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-500/30">
                AGO 2026 • ASSEMBLEIA GERAL
              </span>
              <span className="text-[10px] font-mono text-emerald-400">
                SISTEMA OFICIAL
              </span>
            </div>
            <h2 className="text-xl font-black text-white mt-1">
              Gestão AGO
            </h2>
            <p className="text-xs text-slate-400">
              Controle de inscrições, eventos deliberativos, planejamento estratégico e demonstrativo de resultados da AGO 2026.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <Building2 className="w-4 h-4 text-indigo-400" />
          <span>CIMADEBE Sede Geral</span>
        </div>
      </div>

      {/* Barra de Sub-Navegação com os 4 Menus */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSubAba('inscricao-ago')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
            subAba === 'inscricao-ago'
              ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.35)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <FileCheck className="w-4 h-4 text-indigo-300" />
          <span>Inscritos AGO</span>
        </button>

        <button
          type="button"
          onClick={() => setSubAba('evento-ago')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
            subAba === 'evento-ago'
              ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.35)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <Calendar className="w-4 h-4 text-indigo-300" />
          <span>Evento AGO</span>
        </button>

        <button
          type="button"
          onClick={() => setSubAba('plano-ago')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
            subAba === 'plano-ago'
              ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.35)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <Layers className="w-4 h-4 text-indigo-300" />
          <span>Plano AGO</span>
        </button>

        <button
          type="button"
          onClick={() => setSubAba('dre-ago')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
            subAba === 'dre-ago'
              ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.35)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <Receipt className="w-4 h-4 text-indigo-300" />
          <span>DRE AGO</span>
        </button>
      </div>

      {/* Conteúdo Dinâmico das 4 Páginas com Transições Framer Motion */}
      <AnimatePresence mode="wait">
        {/* ================================================================= */}
        {/* PÁGINA 1: INSCRIÇÃO AGO (PÁGINA EM BRANCO)                        */}
        {/* ================================================================= */}
        {subAba === 'inscricao-ago' && (
          <motion.div
            key="aba-inscricao-ago"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full"
          >
            <AdminInscricaoPlano1Ago />
          </motion.div>
        )}

        {/* ================================================================= */}
        {/* PÁGINA 2: EVENTO AGO (GESTÃO E CADASTRO DOS EVENTOS)               */}
        {/* ================================================================= */}
        {subAba === 'evento-ago' && (
          <motion.div
            key="aba-evento-ago"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full animate-fadeIn"
          >
            <AdminEventoAgo />
          </motion.div>
        )}

        {/* ================================================================= */}
        {/* PÁGINA 3: PLANO AGO (GESTÃO DINÂMICA DOS 4 PLANOS OFICIAIS)       */}
        {/* ================================================================= */}
        {subAba === 'plano-ago' && (
          <motion.div
            key="aba-plano-ago"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full"
          >
            <AdminPlanosAgo />
          </motion.div>
        )}

        {/* ================================================================= */}
        {/* PÁGINA 4: DRE AGO (DEMONSTRATIVO DE RESULTADOS DA AGO)            */}
        {/* ================================================================= */}
        {subAba === 'dre-ago' && (
          <motion.div
            key="aba-dre-ago"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full"
          >
            <AdminDreAgo />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
