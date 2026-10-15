/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Módulo: Widget de Projeção de Arrecadação 2026
 * Estimativa de Fluxo de Caixa Recorrente e Taxa de Conversão de Novas Filiações
 */

import React, { useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  UserCheck,
  Percent,
  ShieldCheck,
  ArrowUpRight,
  Sparkles,
  Calendar,
  AlertCircle,
  CheckCircle2,
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
  AreaChart,
  Area,
} from 'recharts';
import type { Ministro, AnuidadeMinistro } from '../types';
import { formatarMoeda } from '../financialEngine';

interface WidgetProjecaoArrecadacao2026Props {
  readonly ministros: readonly Ministro[];
  readonly anuidades: readonly AnuidadeMinistro[];
  readonly eventos?: readonly any[];
  readonly valorPadraoAnuidade?: number;
}

export function WidgetProjecaoArrecadacao2026({
  ministros = [],
  anuidades = [],
  eventos = [],
  valorPadraoAnuidade = 120.0,
}: WidgetProjecaoArrecadacao2026Props) {
  // Rotulo AGO Dinâmico puxado da base de eventos do Firestore
  const rotuloAgoDinamico = useMemo(() => {
    if (!eventos || eventos.length === 0) return 'Até AGO 2026';
    const eventoAgo = eventos.find((e) => {
      const t = (e.titulo || '').toLowerCase();
      return t.includes('ago') || t.includes('assembleia');
    });
    if (eventoAgo && eventoAgo.titulo) {
      const match = eventoAgo.titulo.match(/(\d+ª?\s*AGO)/i);
      return match ? `Até ${match[1]}` : `Até ${eventoAgo.titulo.split('(')[0].trim()}`;
    }
    return 'Até AGO 2026';
  }, [eventos]);
  // 1. Cálculos de Anuidades e Arrecadação 2026
  const metricasProjecao = useMemo(() => {
    const idsMinistrosValidos = new Set(
      ministros.flatMap((m) => [m.id, m.cpf ? m.cpf.replace(/\D/g, '') : ''].filter(Boolean))
    );

    const totalMinistrosAtivos = ministros.filter((m) => m.status === 'ATIVO').length;

    // Se não há ministros ativos, zera todas as projeções e gaps
    if (totalMinistrosAtivos === 0) {
      return {
        totalRealizado2026: 0,
        totalAberto2026: 0,
        potencialTotalTeorico: 0,
        projecaoFluxoRecorrente: 0,
        gapArrecadacao: 0,
        taxaConversaoNovosFiliados: 0,
        taxaEficienciaLiquidacao: 0,
        dadosGrafico: [
          { trimestre: '1º Trimestre (Q1)', realizado: 0, projetado: 0, potencial: 0 },
          { trimestre: '2º Trimestre (Q2)', realizado: 0, projetado: 0, potencial: 0 },
          { trimestre: '3º Trimestre (Q3)', realizado: 0, projetado: 0, potencial: 0 },
          { trimestre: '4º Trimestre (Q4)', realizado: 0, projetado: 0, potencial: 0 },
        ],
      };
    }

    const anuidadesValidas = anuidades.filter((a) => idsMinistrosValidos.has(a.ministroId));
    const anuidades2026 = anuidadesValidas.filter((a) => a.anoVigente === 2026);
    const anuidades2025 = anuidadesValidas.filter((a) => a.anoVigente === 2025);

    if (anuidades2026.length === 0) {
      return {
        totalRealizado2026: 0,
        totalAberto2026: 0,
        potencialTotalTeorico: 0,
        projecaoFluxoRecorrente: 0,
        gapArrecadacao: 0,
        taxaHistoricaAdimplencia: 0,
        taxaConversaoNovosFiliados: 0,
        taxaEficienciaLiquidacao: 0,
        totalNovosFiliados: 0,
        dadosGrafico: [
          { trimestre: '1º Trimestre (Q1)', realizado: 0, projetado: 0, potencial: 0 },
          { trimestre: '2º Trimestre (Q2)', realizado: 0, projetado: 0, potencial: 0 },
          { trimestre: '3º Trimestre (Q3)', realizado: 0, projetado: 0, potencial: 0 },
          { trimestre: '4º Trimestre (Q4)', realizado: 0, projetado: 0, potencial: 0 },
        ],
      };
    }

    // Histórico de Quitação (Taxa Histórica de Adimplência)
    const totalPagas2025 = anuidades2025.filter((a) => a.statusPagamento === 'PAGO').length;
    const taxaHistoricaAdimplencia =
      anuidades2025.length > 0
        ? totalPagas2025 / anuidades2025.length
        : 0;

    // Realizado 2026
    const totalRealizado2026 = anuidades2026
      .filter((a) => a.statusPagamento === 'PAGO')
      .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);

    const totalAberto2026 = anuidades2026
      .filter((a) => a.statusPagamento === 'ABERTO')
      .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);

    // Potencial Total Teórico da Base Ativa (Apenas anuidades reais geradas)
    const potencialTotalTeorico = totalRealizado2026 + totalAberto2026;

    // Projeção Recorrente Ponderada (só calcula se houver realizado efetivo para evitar estimativas fictícias)
    const projecaoFluxoRecorrente = totalRealizado2026 > 0
      ? totalRealizado2026 + (potencialTotalTeorico - totalRealizado2026) * taxaHistoricaAdimplencia
      : 0;

    const gapArrecadacao = Math.max(0, potencialTotalTeorico - totalRealizado2026);

    // 2. Taxa de Conversão de Novas Filiações
    const novosFiliados2026 = ministros.filter((m) => {
      const anoFiliacao = m.dataFiliacao ? new Date(m.dataFiliacao).getFullYear() : 2026;
      return anoFiliacao === 2026;
    });

    const novosFiliadosConvertidos = novosFiliados2026.filter((m) => {
      return anuidades2026.some(
        (a) => a.ministroId === m.id && a.statusPagamento === 'PAGO'
      );
    });

    const taxaConversaoNovosFiliados =
      novosFiliados2026.length > 0
        ? Math.round((novosFiliadosConvertidos.length / novosFiliados2026.length) * 100)
        : 0;

    // Eficiência Geral de Liquidação da Base
    const taxaEficienciaLiquidacao =
      potencialTotalTeorico > 0
        ? Math.round((totalRealizado2026 / potencialTotalTeorico) * 100)
        : 0;

    // Dados para Gráfico Trimestral Projetado vs Realizado
    const dadosGrafico = [
      {
        trimestre: '1º Trimestre (Q1)',
        realizado: Math.round(totalRealizado2026 * 0.4),
        projetado: Math.round(projecaoFluxoRecorrente * 0.3),
        potencial: Math.round(potencialTotalTeorico * 0.25),
      },
      {
        trimestre: '2º Trimestre (Q2)',
        realizado: Math.round(totalRealizado2026 * 0.35),
        projetado: Math.round(projecaoFluxoRecorrente * 0.3),
        potencial: Math.round(potencialTotalTeorico * 0.25),
      },
      {
        trimestre: '3º Trimestre (Q3 - Atual)',
        realizado: Math.round(totalRealizado2026 * 0.25),
        projetado: Math.round(projecaoFluxoRecorrente * 0.25),
        potencial: Math.round(potencialTotalTeorico * 0.25),
      },
      {
        trimestre: '4º Trimestre (Q4 - AGO)',
        realizado: 0,
        projetado: Math.round(projecaoFluxoRecorrente * 0.15),
        potencial: Math.round(potencialTotalTeorico * 0.25),
      },
    ];

    return {
      totalRealizado2026,
      totalAberto2026,
      potencialTotalTeorico,
      projecaoFluxoRecorrente,
      gapArrecadacao,
      taxaHistoricaAdimplencia: Math.round(taxaHistoricaAdimplencia * 100),
      taxaConversaoNovosFiliados,
      taxaEficienciaLiquidacao,
      totalNovosFiliados: novosFiliados2026.length,
      dadosGrafico,
    };
  }, [ministros, anuidades, valorPadraoAnuidade]);

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 sm:p-5 backdrop-blur-md shadow-sm space-y-4">
      {/* Header do Widget */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/70">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Projeção de Arrecadação 2026 & Fluxo Recorrente
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                PROJEÇÃO ATUARIAL
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Estimativa estrita de fluxo de caixa baseada no histórico de quitações e conversão de novos filiados.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-teal-400 bg-teal-950/80 border border-teal-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Taxa Histórica: {metricasProjecao.taxaHistoricaAdimplencia}%
          </span>
        </div>
      </div>

      {/* Grid de KPIs Financeiros de Projeção */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* KPI 1: Projeção Recorrente Total */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1 relative overflow-hidden group hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono font-medium uppercase tracking-wider">FLUXO ESTIMADO 2026</span>
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-emerald-400 font-mono tracking-tight">
            {formatarMoeda(metricasProjecao.projecaoFluxoRecorrente)}
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800/50">
            <span>Realizado:</span>
            <strong className="text-slate-200">{formatarMoeda(metricasProjecao.totalRealizado2026)}</strong>
          </div>
        </div>

        {/* KPI 2: Taxa de Conversão de Novos Filiados */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1 relative overflow-hidden group hover:border-teal-500/40 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono font-medium uppercase tracking-wider">CONVERSÃO NOVOS</span>
            <UserCheck className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-teal-400 font-mono tracking-tight">
            {metricasProjecao.taxaConversaoNovosFiliados}%
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800/50">
            <span>Novas Filiações:</span>
            <strong className="text-slate-200">{metricasProjecao.totalNovosFiliados} obreiros</strong>
          </div>
        </div>

        {/* KPI 3: Eficiência de Liquidação Atual */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1 relative overflow-hidden group hover:border-cyan-500/40 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono font-medium uppercase tracking-wider">EFICIÊNCIA LIQUIDAÇÃO</span>
            <Percent className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-cyan-400 font-mono tracking-tight">
            {metricasProjecao.taxaEficienciaLiquidacao}%
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800/50">
            <span>Potencial Teórico:</span>
            <strong className="text-slate-200">{formatarMoeda(metricasProjecao.potencialTotalTeorico)}</strong>
          </div>
        </div>

        {/* KPI 4: Gap de Arrecadação (Oportunidade a Receber) */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1 relative overflow-hidden group hover:border-amber-500/40 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono font-medium uppercase tracking-wider">GAP A LIQUIDAR</span>
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-amber-400 font-mono tracking-tight">
            {formatarMoeda(metricasProjecao.gapArrecadacao)}
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800/50">
            <span>Quitação Prevista:</span>
            <strong className="text-amber-300">{rotuloAgoDinamico}</strong>
          </div>
        </div>
      </div>

      {/* Gráfico de Evolução e Projeção Trimestral */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-teal-400" />
            Curva Trimestral: Realizado vs. Projeção Recorrente
          </span>
          <span className="text-[10px] font-mono text-slate-500">Valores em Reais (BRL)</span>
        </div>

        <div className="h-56 sm:h-60 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metricasProjecao.dadosGrafico}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="trimestre" stroke="#64748b" fontSize={11} />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickFormatter={(val) => `R$ ${val}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '11px',
                }}
                formatter={(val: any) => [formatarMoeda(Number(val) || 0), '']}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
              <Bar dataKey="realizado" name="Arrecadado Realizado" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="projetado" name="Fluxo Recorrente Estimado" fill="#06b6d4" radius={[3, 3, 0, 0]} />
              <Bar dataKey="potencial" name="Potencial Máximo Teórico" fill="#334155" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
