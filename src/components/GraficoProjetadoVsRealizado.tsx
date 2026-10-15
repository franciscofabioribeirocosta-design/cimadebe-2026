/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção Geral
 * Componente: GraficoProjetadoVsRealizado.tsx (SRP)
 * Responsabilidade Única: Renderização analítica e visualização gráfica com Recharts do comparativo
 * 'Receita Projetada vs. Receita Realizada' com base no ciclo mensal de pagamentos de anuidades.
 */

import React, { useState, useMemo } from 'react';
import { useSecurity } from '../SecurityContext';
import { getSystemDate } from '../financialEngine';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  DollarSign,
  CheckCircle2,
  Clock,
  Sparkles,
  Percent
} from 'lucide-react';
import type { AnuidadeMinistro } from '../types';

interface GraficoProjetadoVsRealizadoProps {
  readonly anuidades: readonly AnuidadeMinistro[];
  readonly ano?: number;
  readonly tenantId?: string;
}

const NOMES_MESES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

const NOMES_MESES_COMPLETOS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function GraficoProjetadoVsRealizado({
  anuidades,
  ano = 2026,
  tenantId
}: GraficoProjetadoVsRealizadoProps) {
  const { ministros } = useSecurity();
  const [modoVisualizacao, setModoVisualizacao] = useState<'mensal' | 'acumulado' | 'delta'>('mensal');
  const [semestreFiltro, setSemestreFiltro] = useState<'TODOS' | '1S' | '2S'>('TODOS');

  // Processamento síncrono e imutável dos dados mensais de Projetado vs Realizado
  const { dadosMensais, kpis } = useMemo(() => {
    const hoje = getSystemDate();
    const mapMin = new Map(ministros.map((m) => [m.id, m]));

    // 1. Filtrar anuidades do ano e tenant ativo com regras estritas de ministros ativos/suspensos/deletados
    const listaFiltrada = anuidades.filter((a) => {
      if (tenantId && a.tenantId !== tenantId) return false;
      const dataStr = a.dataVencimento || (a as any).data || '';
      const anoAnuidade = a.anoVigente || (dataStr ? parseInt(dataStr.substring(0, 4), 10) : 0) || ano;
      if (anoAnuidade !== ano) return false;

      const isPago = a.statusPagamento === 'PAGO';
      if (isPago) return true; // Pagamentos históricos SEMPRE compõem o realizado

      const min = mapMin.get(a.ministroId);
      if (!min) return false; // Ministro deletado não projeta receita

      if (min.status === 'SUSPENSO') {
        const vencIso = dataStr.split('T')[0];
        const isVencido = vencIso < hoje;
        // Ministro suspenso em dia não projeta receita futura
        if (!isVencido) return false;
      }

      return true;
    });

    // 2. Inicializar os 12 meses
    const meses = Array.from({ length: 12 }, (_, index) => {
      const mesNum = index + 1;
      const mesStr = mesNum.toString().padStart(2, '0');
      return {
        mesIndex: index,
        mes: NOMES_MESES[index],
        mesCompleto: `${NOMES_MESES_COMPLETOS[index]} / ${ano}`,
        mesChave: `${ano}-${mesStr}`,
        projetado: 0,
        realizado: 0,
        pendente: 0,
        qtdPagas: 0,
        qtdAbertas: 0,
        delta: 0,
        taxaRealizacao: 0,
        acumuladoProjetado: 0,
        acumuladoRealizado: 0,
      };
    });

    // 3. Agregar dados das anuidades
    listaFiltrada.forEach((a) => {
      const dataStr = a.dataVencimento || (a as any).data || '';
      const mesVencimentoStr = dataStr.length >= 7 ? dataStr.substring(5, 7) : '';
      let mesIdx = mesVencimentoStr ? parseInt(mesVencimentoStr, 10) - 1 : 0;
      if (isNaN(mesIdx) || mesIdx < 0 || mesIdx > 11) {
        mesIdx = 0;
      }

      const valor = Number(a.valor) || 0;
      meses[mesIdx].projetado += valor;

      if (a.statusPagamento === 'PAGO') {
        meses[mesIdx].realizado += valor;
        meses[mesIdx].qtdPagas += 1;
      } else {
        meses[mesIdx].pendente += valor;
        meses[mesIdx].qtdAbertas += 1;
      }
    });

    // Calcular delta e taxa de realização estritamente com base nos dados reais do Firestore
    meses.forEach((m) => {
      m.delta = m.realizado - m.projetado;
      m.taxaRealizacao = m.projetado > 0 ? Math.round((m.realizado / m.projetado) * 100) : 0;
    });

    // 4. Calcular Acumulados
    let acumProj = 0;
    let acumReal = 0;
    meses.forEach((m) => {
      acumProj += m.projetado;
      acumReal += m.realizado;
      m.acumuladoProjetado = acumProj;
      m.acumuladoRealizado = acumReal;
    });

    // 5. KPIs Gerais do Exercício
    const totalProjetado = acumProj;
    const totalRealizado = acumReal;
    const diferencaTotal = totalRealizado - totalProjetado;
    const taxaGeral = totalProjetado > 0 ? Math.round((totalRealizado / totalProjetado) * 100) : 0;

    // Filtrar por semestre se selecionado
    let mesesExibicao = meses;
    if (semestreFiltro === '1S') {
      mesesExibicao = meses.slice(0, 6);
    } else if (semestreFiltro === '2S') {
      mesesExibicao = meses.slice(6, 12);
    }

    return {
      dadosMensais: mesesExibicao,
      kpis: {
        totalProjetado,
        totalRealizado,
        diferencaTotal,
        taxaGeral,
        totalCobrancas: listaFiltrada.length
      }
    };
  }, [anuidades, ano, tenantId, semestreFiltro]);

  return (
    <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-xl space-y-6">
      {/* Header do Gráfico com Controles */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5" />
              REVENUE PERFORMANCE & FORECAST
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[10px]">
              EXERCÍCIO {ano}
            </span>
          </div>
          <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
            Receita Projetada vs. Realizada (Anuidades Mensais)
          </h3>
          <p className="text-xs text-slate-400">
            Acompanhamento em tempo real da aderência orçamentária e taxa de conversão das anuidades convencionais.
          </p>
        </div>

        {/* Botões de Controle e Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Semestre */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setSemestreFiltro('TODOS')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                semestreFiltro === 'TODOS' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Ano Todo
            </button>
            <button
              onClick={() => setSemestreFiltro('1S')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                semestreFiltro === '1S' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              1º Sem (Jan-Jun)
            </button>
            <button
              onClick={() => setSemestreFiltro('2S')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                semestreFiltro === '2S' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              2º Sem (Jul-Dez)
            </button>
          </div>

          {/* Seletor de Modo de Visualização */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setModoVisualizacao('mensal')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                modoVisualizacao === 'mensal' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setModoVisualizacao('acumulado')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                modoVisualizacao === 'acumulado' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Acumulado
            </button>
            <button
              onClick={() => setModoVisualizacao('delta')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                modoVisualizacao === 'delta' ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Delta
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Métricas KPI Rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 uppercase block">Total Projetado (Orçado)</span>
          <div className="text-base sm:text-lg font-black text-cyan-400 font-mono mt-0.5">
            {kpis.totalProjetado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1 mt-1">
            <Calendar className="w-3 h-3" /> Meta anual prevista
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 uppercase block">Total Realizado (Pago)</span>
          <div className="text-base sm:text-lg font-black text-emerald-400 font-mono mt-0.5">
            {kpis.totalRealizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <span className="text-[10px] font-mono text-emerald-500/80 flex items-center gap-1 mt-1">
            <CheckCircle2 className="w-3 h-3" /> Liquidado via Asaas / Pix
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 uppercase block">Taxa de Realização</span>
          <div className="text-base sm:text-lg font-black text-indigo-300 font-mono mt-0.5">
            {kpis.taxaGeral}%
          </div>
          <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1 mt-1">
            <Percent className="w-3 h-3" /> Aderência atuarial
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 uppercase block">Diferença (Gap)</span>
          <div className={`text-base sm:text-lg font-black font-mono mt-0.5 ${kpis.diferencaTotal >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {kpis.diferencaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1 mt-1">
            {kpis.diferencaTotal >= 0 ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : <TrendingDown className="w-3 h-3 text-amber-400" />}
            {kpis.diferencaTotal >= 0 ? 'Superávit realizado' : 'Pendente em aberto'}
          </span>
        </div>
      </div>

      {/* Área do Gráfico Interativo com Recharts */}
      <div className="h-80 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {modoVisualizacao === 'mensal' ? (
            <ComposedChart data={dadosMensais} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorRealizado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="colorProjetado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#0891b2" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="mes" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis
                yAxisId="left"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                tickFormatter={(val) => `R$ ${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#818cf8"
                fontSize={11}
                tickLine={false}
                tickFormatter={(val) => `${val}%`}
                domain={[0, 150]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '16px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  fontSize: '12px',
                  color: '#f8fafc'
                }}
                formatter={(value: any, name: any) => {
                  if (name === 'Taxa de Realização') {
                    return [`${value}%`, name];
                  }
                  return [
                    `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                    name
                  ];
                }}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload;
                  return item ? item.mesCompleto : label;
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', paddingTop: '10px' }}
              />
              <Bar
                yAxisId="left"
                dataKey="projetado"
                name="Receita Projetada"
                fill="url(#colorProjetado)"
                radius={[6, 6, 0, 0]}
                barSize={20}
              />
              <Bar
                yAxisId="left"
                dataKey="realizado"
                name="Receita Realizada"
                fill="url(#colorRealizado)"
                radius={[6, 6, 0, 0]}
                barSize={20}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="taxaRealizacao"
                name="Taxa de Realização"
                stroke="#818cf8"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#818cf8' }}
                activeDot={{ r: 6, fill: '#c7d2fe' }}
              />
            </ComposedChart>
          ) : modoVisualizacao === 'acumulado' ? (
            <ComposedChart data={dadosMensais} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorAcumReal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorAcumProj" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="mes" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                tickFormatter={(val) => `R$ ${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '16px',
                  fontSize: '12px',
                  color: '#f8fafc'
                }}
                formatter={(value: any, name: any) => [
                  `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                  name
                ]}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload;
                  return item ? item.mesCompleto : label;
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', paddingTop: '10px' }} />
              <Area
                type="monotone"
                dataKey="acumuladoProjetado"
                name="Projetado Acumulado"
                stroke="#06b6d4"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorAcumProj)"
              />
              <Area
                type="monotone"
                dataKey="acumuladoRealizado"
                name="Realizado Acumulado"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorAcumReal)"
              />
            </ComposedChart>
          ) : (
            <ComposedChart data={dadosMensais} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="mes" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                tickFormatter={(val) => `R$ ${val}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '16px',
                  fontSize: '12px',
                  color: '#f8fafc'
                }}
                formatter={(value: any, name: any) => [
                  `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                  name
                ]}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload;
                  return item ? item.mesCompleto : label;
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', paddingTop: '10px' }} />
              <ReferenceLine y={0} stroke="#475569" />
              <Bar
                dataKey="delta"
                name="Superávit / Déficit (Realizado - Projetado)"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
                barSize={24}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Legenda Informativa Rodapé */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-slate-400 pt-3 border-t border-slate-800/80 gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500 inline-block" />
            <span>Projeção Orçamentária</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
            <span>Arrecadação Liquidada</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block" />
            <span>Linha de Conversão (%)</span>
          </span>
        </div>

        <span className="text-slate-500 text-[10px]">
          Sincronização Ledger Asaas em tempo real
        </span>
      </div>
    </div>
  );
}
