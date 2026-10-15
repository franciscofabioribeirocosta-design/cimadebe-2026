/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Módulo: Widget Matriz de Conformidade
 * Distribuição Eclesiástica Adimplentes vs. Inadimplentes com Gráfico de Pizza e Filtro Rápido
 */

import React, { useMemo } from 'react';
import type { Ministro } from '../types';
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Filter,
  PieChart as PieChartIcon,
  Percent,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

interface WidgetMatrizConformidadeProps {
  ministros: readonly Ministro[] | Ministro[];
  onFiltrarStatus?: (status: 'ADIMPLENTE' | 'INADIMPLENTE') => void;
}

const CORES = {
  ADIMPLENTE: '#10b981', // Emerald 500
  INADIMPLENTE: '#f43f5e', // Rose 500
};

export function WidgetMatrizConformidade({
  ministros,
  onFiltrarStatus,
}: WidgetMatrizConformidadeProps) {
  const dadosConformidade = useMemo(() => {
    const total = ministros.length;
    const adimplentes = ministros.filter((m) => {
      const st = String(m.statusAdimplencia || 'EM_DIA').toUpperCase();
      return st === 'EM_DIA' || st === 'EM_DIA_FUTURO' || st === 'ADIMPLENTE' || st === 'PENDENTE';
    }).length;
    const inadimplentes = total - adimplentes;
    const taxaAdimplencia = total > 0 ? Number(((adimplentes / total) * 100).toFixed(1)) : 0;
    const taxaInadimplencia = total > 0 ? Number(((inadimplentes / total) * 100).toFixed(1)) : 0;

    const chartData = [
      {
        name: 'Adimplentes',
        statusKey: 'ADIMPLENTE' as const,
        value: adimplentes,
        percentual: taxaAdimplencia,
        color: CORES.ADIMPLENTE,
      },
      {
        name: 'Inadimplentes',
        statusKey: 'INADIMPLENTE' as const,
        value: inadimplentes,
        percentual: taxaInadimplencia,
        color: CORES.INADIMPLENTE,
      },
    ];

    return {
      total,
      adimplentes,
      inadimplentes,
      taxaAdimplencia,
      taxaInadimplencia,
      chartData,
    };
  }, [ministros]);

  const handleSliceClick = (entry: any) => {
    if (onFiltrarStatus && entry && entry.statusKey) {
      onFiltrarStatus(entry.statusKey);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 sm:p-5 backdrop-blur-md shadow-sm space-y-4">
      {/* Header do Widget */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/70 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-500/15 text-teal-400 border border-teal-500/25">
              <PieChartIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                Matriz de Conformidade
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-teal-300 border border-teal-500/30">
                  TEMPO REAL
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Distribuição de regularidade eclesiástica (Adimplência vs. Inadimplência)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400 bg-slate-950/70 px-2.5 py-1 rounded-lg border border-slate-800/80 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>Total: <strong className="text-white">{dadosConformidade.total}</strong> ministros</span>
          </span>
        </div>
      </div>

      {/* Conteúdo Principal: Gráfico de Pizza + Métricas Clicáveis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Gráfico de Pizza Interativo */}
        <div className="lg:col-span-5 h-52 sm:h-56 w-full flex items-center justify-center relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-950 border border-slate-700 p-2.5 rounded-lg shadow-xl space-y-1 text-xs">
                        <div className="flex items-center gap-2 font-bold text-white">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: data.color }}
                          />
                          <span>{data.name}</span>
                        </div>
                        <div className="text-slate-300 font-mono text-[11px]">
                          Quantidade: <strong className="text-white">{data.value}</strong> obreiro(s)
                        </div>
                        <div className="text-teal-400 font-mono text-[10px]">
                          Participação: <strong>{data.percentual}%</strong>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={30}
                formatter={(value, entry: any) => (
                  <span className="text-[11px] font-medium text-slate-300 ml-1">
                    {value} ({entry.payload.value})
                  </span>
                )}
              />
              <Pie
                data={dadosConformidade.chartData}
                cx="50%"
                cy="45%"
                innerRadius={46}
                outerRadius={70}
                paddingAngle={4}
                dataKey="value"
                onClick={handleSliceClick}
                cursor="pointer"
                stroke="#0f172a"
                strokeWidth={2}
              >
                {dadosConformidade.chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    className="hover:opacity-80 transition-opacity"
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Indicador Central no Donut */}
          <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <span className="text-lg font-bold font-mono text-white tracking-tight block">
              {dadosConformidade.taxaAdimplencia}%
            </span>
            <span className="text-[8px] font-mono text-slate-400 uppercase block tracking-wider">
              Adimplência
            </span>
          </div>
        </div>

        {/* Painel de Cards de Ação Rápida e Métricas */}
        <div className="lg:col-span-7 space-y-2.5">
          <p className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-teal-400" />
            <span>Filtro Rápido de Obreiros:</span>
          </p>

          {/* Card Adimplentes */}
          <div
            onClick={() => onFiltrarStatus && onFiltrarStatus('ADIMPLENTE')}
            className="group p-3 rounded-lg bg-emerald-950/15 hover:bg-emerald-950/30 border border-emerald-500/25 hover:border-emerald-500/50 transition-all cursor-pointer shadow-sm flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                    Ministros Adimplentes
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-500/40">
                    {dadosConformidade.taxaAdimplencia}%
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Regularizados e aptos para a AGO 2026
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-right">
              <div>
                <span className="text-base font-bold font-mono text-emerald-400 block">
                  {dadosConformidade.adimplentes}
                </span>
                <span className="text-[9px] font-mono text-slate-500 uppercase">
                  Obreiros
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>

          {/* Card Inadimplentes */}
          <div
            onClick={() => onFiltrarStatus && onFiltrarStatus('INADIMPLENTE')}
            className="group p-3 rounded-lg bg-rose-950/15 hover:bg-rose-950/30 border border-rose-500/25 hover:border-rose-500/50 transition-all cursor-pointer shadow-sm flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/25 group-hover:scale-105 transition-transform">
                <XCircle className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white group-hover:text-rose-300 transition-colors">
                    Ministros Inadimplentes
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-900/60 text-rose-300 border border-rose-500/40">
                    {dadosConformidade.taxaInadimplencia}%
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Com anuidades pendentes no ledger
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-right">
              <div>
                <span className="text-base font-bold font-mono text-rose-400 block">
                  {dadosConformidade.inadimplentes}
                </span>
                <span className="text-[9px] font-mono text-slate-500 uppercase">
                  Pendentes
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-rose-400 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>

          {/* Barra de Status e Conformidade Global */}
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span>Conformidade Estatutária:</span>
            </div>
            <span className={`font-mono text-[10px] font-semibold ${dadosConformidade.taxaAdimplencia >= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {dadosConformidade.taxaAdimplencia >= 75 ? 'Quadro Saudável' : 'Atenção Requerida'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
