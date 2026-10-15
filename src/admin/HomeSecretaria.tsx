/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Home Secretaria - Dashboard Operacional com Grade Adaptável e Tipografia Refinada
 */

import React from 'react';
import { useSecurity } from '../SecurityContext';
import {
  Users,
  Building2,
  Crown,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  FileText,
} from 'lucide-react';

interface HomeSecretariaProps {
  onNavegarPara: (subAba: string) => void;
}

export function HomeSecretaria({ onNavegarPara }: HomeSecretariaProps) {
  const { ministros, igrejasFiliadas } = useSecurity();

  const totalMinistros = ministros.length;
  const adimplentes = ministros.filter((m) => {
    const st = String(m.statusAdimplencia || 'EM_DIA').toUpperCase();
    return st === 'EM_DIA' || st === 'EM_DIA_FUTURO' || st === 'ADIMPLENTE' || st === 'PENDENTE';
  }).length;
  const inadimplentes = totalMinistros - adimplentes;
  const totalIgrejas = igrejasFiliadas.length;

  return (
    <div className="space-y-3.5 w-full min-w-0">
      {/* Banner da Secretaria Geral Compacto e Delicado */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-rose-950/60 via-slate-900/80 to-cyan-950/60 border border-rose-500/25 p-3.5 sm:p-4 shadow-sm min-w-0">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 min-w-0">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 text-rose-400 text-[10px] font-mono uppercase tracking-wider font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>GABINETE DA SECRETARIA GERAL — CIMADEBE</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
              Secretaria & Gestão Eclesiástica
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Gerencie cadastros ministeriais, ordenações, filiação de igrejas e diretoria da Convenção Geral em tempo real.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              onClick={() => onNavegarPara('modelos-documentos')}
              className="px-2.5 py-1.5 rounded-lg bg-amber-600/90 hover:bg-amber-500 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Modelos</span>
            </button>
            <button
              onClick={() => onNavegarPara('listar-ministros')}
              className="px-2.5 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Ministros</span>
            </button>
            <button
              onClick={() => onNavegarPara('mesa-diretora')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700/80 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>Mesa Diretora</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grade CSS Adaptável de 4 Cards de Estatísticas (Auto-Fit Fluido) */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2.5 sm:gap-3 min-w-0">
        <div
          onClick={() => onNavegarPara('listar-ministros')}
          className="bg-slate-900/60 border border-slate-800/80 hover:border-emerald-500/40 rounded-xl p-3 sm:p-3.5 backdrop-blur-sm transition-all cursor-pointer group shadow-sm flex flex-col justify-between min-w-0"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono text-emerald-400">
                OBREIROS
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Total de Ministros</span>
            <div className="text-xl sm:text-2xl font-bold font-mono text-white mt-0.5 tabular-nums tracking-tight">{totalMinistros}</div>
          </div>
          <div className="pt-2 border-t border-slate-800/60 mt-2 text-[11px] text-slate-400 flex items-center justify-between group-hover:text-emerald-300">
            <span>Cadastros ativos</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        <div
          onClick={() => onNavegarPara('listar-ministros')}
          className="bg-slate-900/60 border border-slate-800/80 hover:border-emerald-500/40 rounded-xl p-3 sm:p-3.5 backdrop-blur-sm transition-all cursor-pointer group shadow-sm flex flex-col justify-between min-w-0"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono text-emerald-400">
                REGULARES
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Ministros Adimplentes</span>
            <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-0.5 tabular-nums tracking-tight">{adimplentes}</div>
          </div>
          <div className="pt-2 border-t border-slate-800/60 mt-2 text-[11px] text-slate-400 flex items-center justify-between group-hover:text-emerald-300">
            <span>Elegíveis para voto</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        <div
          onClick={() => onNavegarPara('listar-ministros')}
          className="bg-slate-900/60 border border-slate-800/80 hover:border-rose-500/40 rounded-xl p-3 sm:p-3.5 backdrop-blur-sm transition-all cursor-pointer group shadow-sm flex flex-col justify-between min-w-0"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono text-rose-400">
                PENDENTES
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Ministros Inadimplentes</span>
            <div className="text-xl sm:text-2xl font-bold font-mono text-rose-400 mt-0.5 tabular-nums tracking-tight">{inadimplentes}</div>
          </div>
          <div className="pt-2 border-t border-slate-800/60 mt-2 text-[11px] text-slate-400 flex items-center justify-between group-hover:text-rose-300">
            <span>Aguardando regularização</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        <div
          onClick={() => onNavegarPara('igrejas-filiadas')}
          className="bg-slate-900/60 border border-slate-800/80 hover:border-cyan-500/40 rounded-xl p-3 sm:p-3.5 backdrop-blur-sm transition-all cursor-pointer group shadow-sm flex flex-col justify-between min-w-0"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Building2 className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono text-cyan-400">
                FILIAÇÃO
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Igrejas Filiadas</span>
            <div className="text-xl sm:text-2xl font-bold font-mono text-white mt-0.5 tabular-nums tracking-tight">{totalIgrejas}</div>
          </div>
          <div className="pt-2 border-t border-slate-800/60 mt-2 text-[11px] text-slate-400 flex items-center justify-between group-hover:text-cyan-300">
            <span>Templos com CNPJ</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>

      {/* Atalhos Rápidos da Secretaria */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 backdrop-blur-sm shadow-sm space-y-2.5 min-w-0">
        <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white">Central de Operações da Secretaria</h3>
            <p className="text-[11px] text-slate-400">Atalhos para secretários e oficiais da convenção.</p>
          </div>
          <span className="text-[10px] font-mono text-rose-400">
            SECRETARIA GERAL
          </span>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,250px),1fr))] gap-2 sm:gap-2.5">
          <button
            onClick={() => onNavegarPara('listar-ministros')}
            className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 hover:border-emerald-500/40 text-left transition-colors cursor-pointer group min-w-0"
          >
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-white group-hover:text-emerald-300 truncate">
                Cadastro & Edição de Ministros
              </span>
              <span className="block text-[10px] text-slate-400 font-mono truncate">
                Adicionar obreiro e emitir credencial
              </span>
            </div>
          </button>

          <button
            onClick={() => onNavegarPara('mesa-diretora')}
            className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 hover:border-amber-500/40 text-left transition-colors cursor-pointer group min-w-0"
          >
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
              <Crown className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-white group-hover:text-amber-300 truncate">
                Mesa Diretora & Cargos
              </span>
              <span className="block text-[10px] text-slate-400 font-mono truncate">
                Diretoria estatutária e mandatos
              </span>
            </div>
          </button>

          <button
            onClick={() => onNavegarPara('igrejas-filiadas')}
            className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 hover:border-cyan-500/40 text-left transition-colors cursor-pointer group min-w-0"
          >
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-white group-hover:text-cyan-300 truncate">
                Igrejas Filiadas & CNPJ
              </span>
              <span className="block text-[10px] text-slate-400 font-mono truncate">
                Consulta CNPJ, CEP e sedes
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
