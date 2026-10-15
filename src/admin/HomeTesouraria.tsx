/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Home Tesouraria - Dashboard Contábil com Grade Adaptável e Tipografia Refinada
 */

import React from 'react';
import { useSecurity } from '../SecurityContext';
import { GraficoProjetadoVsRealizado } from '../components/GraficoProjetadoVsRealizado';
import {
  Receipt,
  TrendingUp,
  CreditCard,
  Zap,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface HomeTesourariaProps {
  onNavegarPara: (subAba: string) => void;
}

export function HomeTesouraria({ onNavegarPara }: HomeTesourariaProps) {
  const { anuidades, dreTenant, tenantAtivo } = useSecurity();

  const totalReceitas = dreTenant.faturamentoLiquido || dreTenant.faturamentoBruto || 0;
  const saldoLiquido = dreTenant.faturamentoLiquido || 0;
  const anuidadesAbertas = anuidades.filter((a) => a.statusPagamento === 'ABERTO').length;
  const anuidadesPagas = anuidades.filter((a) => a.statusPagamento === 'PAGO').length;

  return (
    <div className="space-y-3.5 w-full min-w-0">
      {/* Banner da Tesouraria Compacto e Delicado */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-teal-950/60 via-slate-900/80 to-cyan-950/60 border border-teal-500/25 p-3.5 sm:p-4 shadow-sm min-w-0">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 min-w-0">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 text-teal-400 text-[10px] font-mono uppercase tracking-wider font-semibold">
              <Receipt className="w-3.5 h-3.5 shrink-0" />
              <span>CENTRAL FINANCEIRA & CORE BANKING — ASAAS API</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
              Tesouraria Contábil & DRE 2026
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Monitore o fluxo de caixa da convenção, liquidação de anuidades, recebimentos via Pix e relatórios DRE em tempo real.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              onClick={() => onNavegarPara('tesouraria')}
              className="px-2.5 py-1.5 rounded-lg bg-teal-600/90 hover:bg-teal-500 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Abrir Tesouraria</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grade CSS Adaptável de 4 Cards Financeiros (Auto-Fit Fluido) */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2.5 sm:gap-3 min-w-0">
        <div
          onClick={() => onNavegarPara('tesouraria')}
          className="bg-slate-900/60 border border-slate-800/80 hover:border-teal-500/40 rounded-xl p-3 sm:p-3.5 backdrop-blur-sm transition-all cursor-pointer group shadow-sm flex flex-col justify-between min-w-0"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono text-teal-400">
                ENTRADAS
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Total de Receitas</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-white mt-0.5 tabular-nums tracking-tight truncate">
              {totalReceitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800/60 mt-2 text-[11px] text-slate-400 flex items-center justify-between group-hover:text-teal-300">
            <span>Anuidades e taxas</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        <div
          onClick={() => onNavegarPara('tesouraria')}
          className="bg-slate-900/60 border border-slate-800/80 hover:border-cyan-500/40 rounded-xl p-3 sm:p-3.5 backdrop-blur-sm transition-all cursor-pointer group shadow-sm flex flex-col justify-between min-w-0"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <CreditCard className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono text-cyan-400">
                SALDO LÍQUIDO
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Saldo em Caixa</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400 mt-0.5 tabular-nums tracking-tight truncate">
              {saldoLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800/60 mt-2 text-[11px] text-slate-400 flex items-center justify-between group-hover:text-cyan-300">
            <span>DRE auditado</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        <div
          onClick={() => onNavegarPara('tesouraria')}
          className="bg-slate-900/60 border border-slate-800/80 hover:border-emerald-500/40 rounded-xl p-3 sm:p-3.5 backdrop-blur-sm transition-all cursor-pointer group shadow-sm flex flex-col justify-between min-w-0"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono text-emerald-400">
                QUITADAS
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Anuidades Pagas</span>
            <div className="text-xl sm:text-2xl font-bold font-mono text-white mt-0.5 tabular-nums tracking-tight">{anuidadesPagas}</div>
          </div>
          <div className="pt-2 border-t border-slate-800/60 mt-2 text-[11px] text-slate-400 flex items-center justify-between group-hover:text-emerald-300">
            <span>Baixas processadas</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        <div
          onClick={() => onNavegarPara('tesouraria')}
          className="bg-slate-900/60 border border-slate-800/80 hover:border-amber-500/40 rounded-xl p-3 sm:p-3.5 backdrop-blur-sm transition-all cursor-pointer group shadow-sm flex flex-col justify-between min-w-0"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Zap className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono text-amber-400">
                PENDENTES
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Anuidades em Aberto</span>
            <div className="text-xl sm:text-2xl font-bold font-mono text-amber-400 mt-0.5 tabular-nums tracking-tight">{anuidadesAbertas}</div>
          </div>
          <div className="pt-2 border-t border-slate-800/60 mt-2 text-[11px] text-slate-400 flex items-center justify-between group-hover:text-amber-300">
            <span>Aguardando liquidação</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>

      {/* Gráfico de Performance: Projetado vs. Realizado (Recharts) */}
      <GraficoProjetadoVsRealizado
        anuidades={anuidades}
        ano={2026}
        tenantId={tenantAtivo?.id}
      />

      {/* Atalhos Rápidos da Tesouraria */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 backdrop-blur-sm shadow-sm space-y-2.5 min-w-0">
        <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white">Módulos de Tesouraria & Asaas</h3>
            <p className="text-[11px] text-slate-400">Ferramentas de controle financeiro, recebimento e DRE.</p>
          </div>
          <span className="text-[10px] font-mono text-teal-400">
            CONTABILIDADE CORE
          </span>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,250px),1fr))] gap-2 sm:gap-2.5">
          <button
            onClick={() => onNavegarPara('tesouraria')}
            className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 hover:border-teal-500/40 text-left transition-colors cursor-pointer group min-w-0"
          >
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-white group-hover:text-teal-300 truncate">
                Tesouraria Contábil & Webhook Asaas
              </span>
              <span className="block text-[10px] text-slate-400 font-mono truncate">
                Baixa de anuidades e DRE completo
              </span>
            </div>
          </button>

          <button
            onClick={() => onNavegarPara('listar-ministros')}
            className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 hover:border-emerald-500/40 text-left transition-colors cursor-pointer group min-w-0"
          >
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-white group-hover:text-emerald-300 truncate">
                Consulta de Obreiros & Status
              </span>
              <span className="block text-[10px] text-slate-400 font-mono truncate">
                Verificar adimplência por obreiro
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
