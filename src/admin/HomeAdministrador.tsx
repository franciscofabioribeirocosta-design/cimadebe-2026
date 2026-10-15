/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Home Administrador - Dashboard Executivo com Grade CSS Adaptável e Tipografia Refinada
 * Padrão Anti-Overflow, Alta Densidade de Informação e Estética Delicada
 */

import React, { useMemo } from 'react';
import { useSecurity } from '../SecurityContext';
import { DashboardMetricasEstrategicas } from '../components/DashboardMetricasEstrategicas';
import { DashboardBiTendencias } from '../components/DashboardBiTendencias';
import { WidgetProjecaoArrecadacao2026 } from '../components/WidgetProjecaoArrecadacao2026';
import { WidgetMatrizConformidade } from '../components/WidgetMatrizConformidade';
import { WidgetAniversariantesMes } from '../components/WidgetAniversariantesMes';
import type { AuditLog } from '../types';
import {
  Users,
  Building2,
  Receipt,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  Crown,
  Activity,
  FileText,
  UserCog,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

interface HomeAdministradorProps {
  onNavegarPara: (subAba: string) => void;
  onFiltrarMinistros?: (status: 'ADIMPLENTE' | 'INADIMPLENTE') => void;
}

export function HomeAdministrador({ onNavegarPara, onFiltrarMinistros }: HomeAdministradorProps) {
  const {
    ministros,
    igrejasFiliadas,
    anuidades,
    dreTenant,
    logs,
    appConfig,
    eventos,
  } = useSecurity();

  // Métricas calculadas
  const totalMinistros = ministros.length;
  const totalIgrejas = igrejasFiliadas.length;
  const adimplentesCount = ministros.filter((m) => {
    const st = String(m.statusAdimplencia || 'EM_DIA').toUpperCase();
    return st === 'EM_DIA' || st === 'EM_DIA_FUTURO' || st === 'ADIMPLENTE' || st === 'PENDENTE';
  }).length;
  const taxaAdimplencia = totalMinistros > 0 ? Math.round((adimplentesCount / totalMinistros) * 100) : 0;
  const totalArrecadado = dreTenant.faturamentoLiquido || dreTenant.faturamentoBruto || 0;

  // Cálculo da distribuição de ministros por faixa etária
  const faixaEtariaDados = useMemo(() => {
    const faixas = {
      '18-30 anos': 0,
      '31-45 anos': 0,
      '46-60 anos': 0,
      '61+ anos': 0,
    };

    const anoAtual = 2026;
    ministros.forEach((m) => {
      let idade = 42; // default estimado se não houver data de nascimento
      if (m.dataNascimento) {
        const anoNasc = parseInt(m.dataNascimento.split('-')[0], 10);
        if (!isNaN(anoNasc)) {
          idade = anoAtual - anoNasc;
        }
      }
      if (idade >= 18 && idade <= 30) faixas['18-30 anos']++;
      else if (idade >= 31 && idade <= 45) faixas['31-45 anos']++;
      else if (idade >= 46 && idade <= 60) faixas['46-60 anos']++;
      else faixas['61+ anos']++;
    });

    return [
      { faixa: '18-30', quantidade: faixas['18-30 anos'] },
      { faixa: '31-45', quantidade: faixas['31-45 anos'] },
      { faixa: '46-60', quantidade: faixas['46-60 anos'] },
      { faixa: '61+', quantidade: faixas['61+ anos'] },
    ];
  }, [ministros]);

  return (
    <div className="space-y-3.5 w-full min-w-0">
      {/* Banner de Boas-Vindas Executivo Compacto e Delicado */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-teal-950/60 via-slate-900/80 to-cyan-950/60 border border-teal-500/25 p-3.5 sm:p-4 shadow-sm min-w-0">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 min-w-0">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 text-teal-400 text-[10px] font-mono uppercase tracking-wider font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>PAINEL EXECUTIVO — CIMADEBE SEDE</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
              Visão Geral & Governança da Convenção
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Acompanhamento em tempo real de ministros, templos, arrecadação e conformidade institucional.
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
              onClick={() => onNavegarPara('tesouraria')}
              className="px-2.5 py-1.5 rounded-lg bg-teal-600/90 hover:bg-teal-500 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>DRE Tesouraria</span>
            </button>
            <button
              onClick={() => onNavegarPara('listar-ministros')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700/80 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ministros</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grade CSS Adaptável de 4 Cards de Métricas Principais (Auto-Fit Fluido) */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2.5 sm:gap-3 min-w-0">
        {/* Total Ministros */}
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
                CADASTRO ATIVO
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Total de Ministros</span>
            <div className="text-xl sm:text-2xl font-bold font-mono text-white mt-0.5 tabular-nums tracking-tight">{totalMinistros}</div>
          </div>
          <div className="pt-2 border-t border-slate-800/60 mt-2 text-[11px] text-slate-400 flex items-center justify-between group-hover:text-emerald-300">
            <span>Listagem completa</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Igrejas Filiadas */}
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
                CNPJ VINCULADO
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Igrejas Filiadas</span>
            <div className="text-xl sm:text-2xl font-bold font-mono text-white mt-0.5 tabular-nums tracking-tight">{totalIgrejas}</div>
          </div>
          <div className="pt-2 border-t border-slate-800/60 mt-2 text-[11px] text-slate-400 flex items-center justify-between group-hover:text-cyan-300">
            <span>Gerenciar templos</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Taxa de Adimplência */}
        <div
          onClick={() => onNavegarPara('listar-ministros')}
          className="bg-slate-900/60 border border-slate-800/80 hover:border-amber-500/40 rounded-xl p-3 sm:p-3.5 backdrop-blur-sm transition-all cursor-pointer group shadow-sm flex flex-col justify-between min-w-0"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono text-amber-400">
                LEDGER CONFERIDO
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Taxa de Adimplência</span>
            <div className="text-xl sm:text-2xl font-bold font-mono text-white mt-0.5 tabular-nums tracking-tight">{taxaAdimplencia}%</div>
          </div>
          <div className="pt-2 border-t border-slate-800/60 mt-2 text-[11px] text-slate-400 flex items-center justify-between group-hover:text-amber-300">
            <span>{adimplentesCount} obreiros em dia</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Arrecadação Total */}
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
                DRE 2026
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Receita Arrecadada</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-white mt-0.5 tabular-nums tracking-tight truncate">
              {totalArrecadado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800/60 mt-2 text-[11px] text-slate-400 flex items-center justify-between group-hover:text-teal-300">
            <span>Acessar Tesouraria</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>

      {/* Dashboard de Business Intelligence: Tendências de Filiações & Fluxo de Caixa Contábil Acumulado */}
      <DashboardBiTendencias
        ministros={ministros}
        anuidades={anuidades}
        anoInicial={2026}
        onNavegarTesouraria={() => onNavegarPara('tesouraria')}
        onNavegarMinistros={() => onNavegarPara('listar-ministros')}
      />

      {/* Dashboard de Métricas Estratégicas (Recharts) */}
      <DashboardMetricasEstrategicas
        igrejas={igrejasFiliadas}
        ministros={ministros}
        onNavegarIgrejas={() => onNavegarPara('igrejas-filiadas')}
        onNavegarMinistros={() => onNavegarPara('listar-ministros')}
      />

      {/* Widget de Projeção de Arrecadação 2026 & Fluxo Recorrente */}
      <WidgetProjecaoArrecadacao2026
        ministros={ministros}
        anuidades={anuidades}
        eventos={eventos}
        valorPadraoAnuidade={appConfig?.taxaAnuidadeRecorrente || 120}
      />

      {/* Widget Matriz de Conformidade: Adimplentes vs. Inadimplentes */}
      <WidgetMatrizConformidade
        ministros={ministros}
        onFiltrarStatus={(status) => {
          if (onFiltrarMinistros) {
            onFiltrarMinistros(status);
          } else {
            onNavegarPara('listar-ministros');
          }
        }}
      />

      {/* Card com Gráfico de Barras: Distribuição de Ministros por Faixa Etária */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 backdrop-blur-sm shadow-sm space-y-2.5 min-w-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 border-b border-slate-800/70 pb-2.5 min-w-0">
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 truncate">
              <BarChart3 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Distribuição de Ministros por Faixa Etária</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Análise demográfica do quadro de obreiros cadastrados na convenção.
            </p>
          </div>
          <span className="text-[10px] font-mono text-cyan-400 shrink-0">
            DEMOGRAFIA
          </span>
        </div>

        <div className="h-52 sm:h-56 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={faixaEtariaDados} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="faixa" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '6px', fontSize: '11px', color: '#f8fafc' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="quantidade" name="Obreiros" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Widget de Aniversariantes do Mês & Felicitações */}
      <WidgetAniversariantesMes
        ministros={ministros}
        nomeConvencao={appConfig?.nomeFantasia || 'CIMADEBE'}
      />

      {/* Grade Adaptável de Atalhos Rápidos para Módulos */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 backdrop-blur-sm shadow-sm space-y-2.5 min-w-0">
        <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white">Módulos de Gestão e Operações</h3>
            <p className="text-[11px] text-slate-400">Acesso rápido às ferramentas administrativas.</p>
          </div>
          <span className="text-[10px] font-mono text-teal-400">
            RBAC ATIVO
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
                Listar & Cadastrar Ministros
              </span>
              <span className="block text-[10px] text-slate-400 font-mono truncate">
                Obreiros, CPF, fotos e vínculos
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
                Mesa Diretora
              </span>
              <span className="block text-[10px] text-slate-400 font-mono truncate">
                Diretoria estatutária e cargos
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
                Consulta CNPJ, CEP e templos
              </span>
            </div>
          </button>

          <button
            onClick={() => onNavegarPara('tesouraria')}
            className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 hover:border-teal-500/40 text-left transition-colors cursor-pointer group min-w-0"
          >
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-white group-hover:text-teal-300 truncate">
                DRE Tesouraria & Asaas
              </span>
              <span className="block text-[10px] text-slate-400 font-mono truncate">
                DRE, Ledger e liquidações
              </span>
            </div>
          </button>

          <button
            onClick={() => onNavegarPara('cadastral')}
            className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 hover:border-indigo-500/40 text-left transition-colors cursor-pointer group min-w-0"
          >
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-white group-hover:text-indigo-300 truncate">
                Gestão AGO 2026
              </span>
              <span className="block text-[10px] text-slate-400 font-mono truncate">
                Inscrições, Eventos e DRE
              </span>
            </div>
          </button>

          <button
            onClick={() => onNavegarPara('usuarios')}
            className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 hover:border-purple-500/40 text-left transition-colors cursor-pointer group min-w-0"
          >
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 shrink-0">
              <UserCog className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-white group-hover:text-purple-300 truncate">
                Gestão de Usuários & RBAC
              </span>
              <span className="block text-[10px] text-slate-400 font-mono truncate">
                Permissões e operadores
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Atividade Recente do Ledger */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 backdrop-blur-sm shadow-sm space-y-2.5 min-w-0">
        <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-teal-400" />
            <h3 className="text-xs sm:text-sm font-bold text-white">Últimos Eventos no Ledger</h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            SHA-256 IMUTÁVEL
          </span>
        </div>

        <div className="space-y-1.5">
          {logs.slice(0, 5).map((log: AuditLog, idx: number) => (
            <div
              key={log.id ? `${log.id}-${idx}` : `log-${idx}`}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs font-mono"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-teal-300 font-semibold uppercase text-[10px]">
                      [{log.acao}]
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Operador: <strong className="text-cyan-400">{log.operadorId || 'SISTEMA'}</strong>
                    </span>
                  </div>
                  <span className="text-slate-300 font-sans truncate block text-[11px] mt-0.5">{log.detalhes}</span>
                </div>
              </div>
              <div className="text-slate-500 text-[10px] shrink-0 font-mono">
                {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
