/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Componente: DashboardBiTendencias.tsx
 * Responsabilidade Única (SRP): Dashboard de BI com Recharts para visualização
 * de tendências de filiação de novos ministros e fluxo de caixa contábil acumulado por mês.
 */

import React, { useMemo, useState } from 'react';
import type { Ministro, AnuidadeMinistro } from '../types';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  Users,
  DollarSign,
  ArrowUpRight,
  Filter,
  BarChart3,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  Zap,
} from 'lucide-react';

interface DashboardBiTendenciasProps {
  readonly ministros: readonly Ministro[];
  readonly anuidades: readonly AnuidadeMinistro[];
  readonly anoInicial?: number;
  readonly onNavegarTesouraria?: () => void;
  readonly onNavegarMinistros?: () => void;
}

const MESES_ABREV = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

const MESES_COMPLETOS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Utilitário de parsing seguro de data (Layer 1: Fail-Safe)
function extrairAnoMes(dataStr?: string): { ano: number; mes: number } | null {
  if (!dataStr) return null;
  const limpo = String(dataStr).trim();
  const match = limpo.match(/^(\d{4})-(\d{2})/);
  if (match) {
    const ano = parseInt(match[1], 10);
    const mes = parseInt(match[2], 10) - 1;
    if (!isNaN(ano) && !isNaN(mes) && mes >= 0 && mes <= 11) {
      return { ano, mes };
    }
  }
  const d = new Date(limpo);
  if (!isNaN(d.getTime())) {
    return { ano: d.getFullYear(), mes: d.getMonth() };
  }
  return null;
}

// Formatação monetária em padrão BRL
function formatarBRL(valor: number): string {
  return (Number(valor) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatarBRLCompacto(valor: number): string {
  const v = Number(valor) || 0;
  if (Math.abs(v) >= 1000000) {
    return `R$ ${(v / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(v) >= 1000) {
    return `R$ ${(v / 1000).toFixed(1)}k`;
  }
  return `R$ ${v.toFixed(0)}`;
}

export function DashboardBiTendencias({
  ministros,
  anuidades,
  anoInicial = 2026,
  onNavegarTesouraria,
  onNavegarMinistros,
}: DashboardBiTendenciasProps) {
  // Estado de controle do período de análise
  const [anoFiltro, setAnoFiltro] = useState<number>(anoInicial);
  const [abaAtiva, setAbaAtiva] = useState<'CONSOLIDADO' | 'FINANCEIRO' | 'FILIACOES'>('CONSOLIDADO');

  // Compilação dos anos disponíveis com base nos dados reais
  const anosDisponiveis = useMemo(() => {
    const anosSet = new Set<number>([anoInicial, anoInicial - 1]);
    ministros.forEach((m) => {
      const parsed = extrairAnoMes(m.dataFiliacao);
      if (parsed) anosSet.add(parsed.ano);
    });
    anuidades.forEach((a) => {
      if (a.anoVigente) anosSet.add(a.anoVigente);
      const parsed = extrairAnoMes(a.dataPagamento || a.dataLiquidacao || a.dataVencimento);
      if (parsed) anosSet.add(parsed.ano);
    });
    return Array.from(anosSet).sort((a, b) => b - a);
  }, [ministros, anuidades, anoInicial]);

  // Agregação estatística mês a mês do ano selecionado
  const serieMensal = useMemo(() => {
    // Inicialização da grade dos 12 meses
    const meses = MESES_ABREV.map((abrev, idx) => ({
      mesIndex: idx,
      mesAbrev: abrev,
      mesCompleto: MESES_COMPLETOS[idx],
      ano: anoFiltro,
      novosMinistros: 0,
      filiaçõesAcumuladas: 0,
      receitaMensal: 0,
      fluxoAcumulado: 0,
      cobrancasLiquidadasCount: 0,
    }));

    // 1. Contabilização de Novas Filiações por mês
    ministros.forEach((m) => {
      const parsed = extrairAnoMes(m.dataFiliacao);
      if (parsed && parsed.ano === anoFiltro) {
        meses[parsed.mes].novosMinistros += 1;
      }
    });

    // 2. Contabilização de Receita Liquidada (Fluxo de Caixa)
    anuidades.forEach((a) => {
      if (a.statusPagamento === 'PAGO' && a.tipo === 'RECEITA') {
        const dataReferencia = a.dataPagamento || a.dataLiquidacao || a.dataVencimento;
        const parsed = extrairAnoMes(dataReferencia);
        // Associa ao mês se a data for do ano do filtro ou se o anoVigente corresponder
        if (parsed && parsed.ano === anoFiltro) {
          meses[parsed.mes].receitaMensal += Number(a.valor) || 0;
          meses[parsed.mes].cobrancasLiquidadasCount += 1;
        } else if (!parsed && a.anoVigente === anoFiltro) {
          // Fallback seguro de competência: distribui para o mês de vencimento se ano bate
          meses[0].receitaMensal += Number(a.valor) || 0;
          meses[0].cobrancasLiquidadasCount += 1;
        }
      }
    });

    // 3. Cálculo Cumulativo (Acumulado Mês a Mês) com aritmética segura
    let accFiliações = 0;
    let accFluxo = 0;

    meses.forEach((m) => {
      accFiliações += m.novosMinistros;
      accFluxo += m.receitaMensal;
      m.filiaçõesAcumuladas = accFiliações;
      m.fluxoAcumulado = Math.round(accFluxo * 100) / 100;
      m.receitaMensal = Math.round(m.receitaMensal * 100) / 100;
    });

    return meses;
  }, [ministros, anuidades, anoFiltro]);

  // Indicadores de Alta Gestão (KPIs)
  const metricasResumo = useMemo(() => {
    let totalFiliaçõesPeriodo = 0;
    let totalFluxoPeriodo = 0;
    let picoReceita = { valor: 0, mes: '—' };
    let picoFiliações = { valor: 0, mes: '—' };

    serieMensal.forEach((item) => {
      totalFiliaçõesPeriodo += item.novosMinistros;
      totalFluxoPeriodo += item.receitaMensal;

      if (item.receitaMensal > picoReceita.valor) {
        picoReceita = { valor: item.receitaMensal, mes: item.mesCompleto };
      }
      if (item.novosMinistros > picoFiliações.valor) {
        picoFiliações = { valor: item.novosMinistros, mes: item.mesCompleto };
      }
    });

    const mediaFiliaçõesMes = Math.round((totalFiliaçõesPeriodo / 12) * 10) / 10;
    const mediaReceitaMes = Math.round((totalFluxoPeriodo / 12) * 100) / 100;

    return {
      totalFiliaçõesPeriodo,
      totalFluxoPeriodo: Math.round(totalFluxoPeriodo * 100) / 100,
      mediaFiliaçõesMes,
      mediaReceitaMes,
      picoReceita,
      picoFiliações,
    };
  }, [serieMensal]);

  // Tooltip customizado do Recharts para Fluxo de Caixa Contábil
  const CustomTooltipFinanceiro = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const mesData = serieMensal.find((m) => m.mesAbrev === label);

    return (
      <div className="bg-[#090d16]/95 border border-slate-700/80 rounded-xl p-3 shadow-xl backdrop-blur-md text-xs font-mono space-y-2 min-w-[210px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="text-white font-bold tracking-wider">
            {mesData ? `${mesData.mesCompleto} / ${anoFiltro}` : label}
          </span>
          <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/40">
            DRE LEDGER
          </span>
        </div>
        <div className="space-y-1.5 pt-0.5">
          {payload.map((entry: any, i: number) => {
            const isAcumulado = entry.dataKey === 'fluxoAcumulado';
            return (
              <div key={`entry-${i}`} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-slate-300 text-[11px]">{entry.name}:</span>
                </div>
                <span className={`font-bold tabular-nums ${isAcumulado ? 'text-teal-300' : 'text-emerald-400'}`}>
                  {formatarBRL(entry.value)}
                </span>
              </div>
            );
          })}
        </div>
        {mesData && mesData.cobrancasLiquidadasCount > 0 && (
          <div className="pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-400 flex justify-between">
            <span>Liquidações computadas:</span>
            <span className="text-cyan-300 font-bold">{mesData.cobrancasLiquidadasCount}</span>
          </div>
        )}
      </div>
    );
  };

  // Tooltip customizado do Recharts para Filiação de Ministros
  const CustomTooltipFiliacoes = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const mesData = serieMensal.find((m) => m.mesAbrev === label);

    return (
      <div className="bg-[#090d16]/95 border border-slate-700/80 rounded-xl p-3 shadow-xl backdrop-blur-md text-xs font-mono space-y-2 min-w-[210px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="text-white font-bold tracking-wider">
            {mesData ? `${mesData.mesCompleto} / ${anoFiltro}` : label}
          </span>
          <span className="text-[10px] text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/40">
            MINISTERIAL
          </span>
        </div>
        <div className="space-y-1.5 pt-0.5">
          {payload.map((entry: any, i: number) => {
            const isAcumulado = entry.dataKey === 'filiaçõesAcumuladas';
            return (
              <div key={`filiacao-${i}`} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-slate-300 text-[11px]">{entry.name}:</span>
                </div>
                <span className={`font-bold tabular-nums ${isAcumulado ? 'text-indigo-300' : 'text-cyan-400'}`}>
                  {entry.value} {entry.value === 1 ? 'obreiro' : 'obreiros'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 backdrop-blur-sm shadow-sm space-y-3.5 min-w-0">
      {/* Cabeçalho do Dashboard de BI */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/70 pb-3 min-w-0">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5 text-cyan-400 text-[10px] font-mono uppercase tracking-wider font-semibold">
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />
            <span>BUSINESS INTELLIGENCE & GOVERNANÇA EXECUTIVA</span>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
            <span>Tendências de Filiações & Fluxo de Caixa Contábil</span>
            <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/40 text-[10px] font-mono font-semibold">
              Exercício {anoFiltro}
            </span>
          </h3>
          <p className="text-[11px] text-slate-400 max-w-2xl leading-relaxed">
            Curva de crescimento do quadro de obreiros e arrecadação cumulativa mensal atualizada em tempo real.
          </p>
        </div>

        {/* Controles de Período e Visualização */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Seletor de Ano */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={anoFiltro}
              onChange={(e) => setAnoFiltro(Number(e.target.value))}
              aria-label="Selecionar Ano de Exercício para Análise"
              className="bg-transparent text-white font-mono text-xs focus:outline-none cursor-pointer"
            >
              {anosDisponiveis.map((ano) => (
                <option key={ano} value={ano} className="bg-slate-900 text-white">
                  Ano {ano}
                </option>
              ))}
            </select>
          </div>

          {/* Alternador de Abas / Modos de Gráfico */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] font-semibold">
            <button
              onClick={() => setAbaAtiva('CONSOLIDADO')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                abaAtiva === 'CONSOLIDADO'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Consolidado
            </button>
            <button
              onClick={() => setAbaAtiva('FINANCEIRO')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                abaAtiva === 'FINANCEIRO'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Fluxo de Caixa
            </button>
            <button
              onClick={() => setAbaAtiva('FILIACOES')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                abaAtiva === 'FILIACOES'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Filiações
            </button>
          </div>
        </div>
      </div>

      {/* Grade de Cards KPIs de Alto Nível */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 min-w-0">
        {/* KPI 1: Total de Novas Filiações */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase tracking-wider">
            <span>Novas Filiações</span>
            <Users className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-1">
            <div className="text-lg sm:text-xl font-bold font-mono text-white tabular-nums">
              {metricasResumo.totalFiliaçõesPeriodo}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
              <span>Média mensal:</span>
              <strong className="text-cyan-300 font-bold">{metricasResumo.mediaFiliaçõesMes}</strong>
            </div>
          </div>
        </div>

        {/* KPI 2: Fluxo Acumulado no Exercício */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase tracking-wider">
            <span>Fluxo Acumulado</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-1">
            <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400 tabular-nums truncate">
              {formatarBRL(metricasResumo.totalFluxoPeriodo)}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
              <span>Média mensal:</span>
              <strong className="text-emerald-300 font-bold">{formatarBRLCompacto(metricasResumo.mediaReceitaMes)}</strong>
            </div>
          </div>
        </div>

        {/* KPI 3: Pico de Filiação */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase tracking-wider">
            <span>Pico de Filiações</span>
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="mt-1">
            <div className="text-lg sm:text-xl font-bold font-mono text-white tabular-nums">
              {metricasResumo.picoFiliações.valor}{' '}
              <span className="text-xs font-normal text-slate-400 font-sans">obreiros</span>
            </div>
            <div className="text-[10px] text-indigo-300 font-mono mt-0.5 truncate">
              Mês: <strong className="text-white">{metricasResumo.picoFiliações.mes}</strong>
            </div>
          </div>
        </div>

        {/* KPI 4: Maior Arrecadação Mensal */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase tracking-wider">
            <span>Maior Liquidação</span>
            <Zap className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <div className="mt-1">
            <div className="text-lg sm:text-xl font-bold font-mono text-teal-300 tabular-nums truncate">
              {formatarBRLCompacto(metricasResumo.picoReceita.valor)}
            </div>
            <div className="text-[10px] text-teal-400 font-mono mt-0.5 truncate">
              Mês: <strong className="text-white">{metricasResumo.picoReceita.mes}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ÁREA DE GRÁFICOS RECHARTS (LINHAS E COLUNAS) */}
      <div className="space-y-4 pt-1">
        {/* GRÁFICO 1: FLUXO DE CAIXA CONTÁBIL ACUMULADO (COLUNAS DE RECEITA + LINHA DE FLUXO ACUMULADO) */}
        {(abaAtiva === 'CONSOLIDADO' || abaAtiva === 'FINANCEIRO') && (
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 border-b border-slate-800/60 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded bg-emerald-500 shrink-0" />
                <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                  Fluxo de Caixa Contábil Acumulado (Mês a Mês)
                </h4>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-2 rounded bg-emerald-500/80 inline-block" />
                  Receita Mensal (Colunas)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-teal-300 inline-block" />
                  Fluxo Acumulado (Linha)
                </span>
              </div>
            </div>

            <div className="h-60 sm:h-64 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={serieMensal}
                  margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="mesAbrev"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                  />
                  {/* Eixo Esquerdo: Receita Mensal */}
                  <YAxis
                    yAxisId="left"
                    stroke="#10b981"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#10b981', opacity: 0.3 }}
                    tickFormatter={(v) => formatarBRLCompacto(v)}
                  />
                  {/* Eixo Direito: Fluxo Acumulado */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#2dd4bf"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#2dd4bf', opacity: 0.3 }}
                    tickFormatter={(v) => formatarBRLCompacto(v)}
                  />
                  <Tooltip content={<CustomTooltipFinanceiro />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    height={28}
                    wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
                  />
                  {/* Colunas: Receita Mensal Realizada */}
                  <Bar
                    yAxisId="left"
                    dataKey="receitaMensal"
                    name="Receita Mensal (R$)"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                  {/* Linha: Tendência de Fluxo de Caixa Acumulado */}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="fluxoAcumulado"
                    name="Fluxo Acumulado (R$)"
                    stroke="#2dd4bf"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#2dd4bf', stroke: '#090d16', strokeWidth: 1.5 }}
                    activeDot={{ r: 5, fill: '#5eead4' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* GRÁFICO 2: TENDÊNCIAS DE FILIAÇÃO DE NOVOS MINISTROS (COLUNAS DE INGRESSOS + LINHA DE CRESCIMENTO) */}
        {(abaAtiva === 'CONSOLIDADO' || abaAtiva === 'FILIACOES') && (
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 border-b border-slate-800/60 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded bg-cyan-500 shrink-0" />
                <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                  Tendência de Filiação de Novos Ministros (Mês a Mês)
                </h4>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-2 rounded bg-cyan-500/80 inline-block" />
                  Novos Filiados (Colunas)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-indigo-400 inline-block" />
                  Total Acumulado (Linha)
                </span>
              </div>
            </div>

            <div className="h-60 sm:h-64 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={serieMensal}
                  margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="mesAbrev"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                  />
                  {/* Eixo Esquerdo: Novos Ministros */}
                  <YAxis
                    yAxisId="left"
                    stroke="#06b6d4"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#06b6d4', opacity: 0.3 }}
                    allowDecimals={false}
                  />
                  {/* Eixo Direito: Total Acumulado */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#818cf8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#818cf8', opacity: 0.3 }}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltipFiliacoes />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    height={28}
                    wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
                  />
                  {/* Colunas: Ingressos no Mês */}
                  <Bar
                    yAxisId="left"
                    dataKey="novosMinistros"
                    name="Novos Filiados no Mês"
                    fill="#06b6d4"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                  {/* Linha: Crescimento Acumulado de Ministros */}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="filiaçõesAcumuladas"
                    name="Crescimento Acumulado"
                    stroke="#818cf8"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#818cf8', stroke: '#090d16', strokeWidth: 1.5 }}
                    activeDot={{ r: 5, fill: '#a5b4fc' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Barra de Rodapé com Atalhos Rápidos para Aprofundamento */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-slate-800/60 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-mono">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Dados compilados do Ledger contábil e do livro canônico de registros.</span>
        </div>

        <div className="flex items-center gap-2">
          {onNavegarTesouraria && (
            <button
              onClick={onNavegarTesouraria}
              className="text-emerald-400 hover:text-emerald-300 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>Ver DRE Completo</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
          {onNavegarMinistros && (
            <button
              onClick={onNavegarMinistros}
              className="text-cyan-400 hover:text-cyan-300 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors ml-2"
            >
              <span>Gestão de Ministros</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
