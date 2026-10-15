/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Componente: AdminRelatoriosFinanceiros.tsx
 * Responsabilidade Única: Exibir Relatórios Financeiros Detalhados com Gráfico de Linha (Recharts)
 * comparando as entradas de anuidades mês a mês e permitindo exportação dos dados para CSV.
 */

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Download,
  Calendar,
  DollarSign,
  Receipt,
  FileSpreadsheet,
  CheckCircle2,
  BarChart3,
  LineChart as LineIcon,
  FileText,
} from 'lucide-react';
import { useSecurity } from '../SecurityContext';
import {
  exportarRelatorioFinanceiroCSV,
} from '../services/relatorioFinanceiroService';
import { exportarRelatorioFinanceiroPdf } from '../services/pdfExportService';
import { processarMatrizContabilAnuidades, getSystemYear } from '../financialEngine';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

export function AdminRelatoriosFinanceiros() {
  const { anuidades, ministros, tenantAtivo, appConfig } = useSecurity();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const anoAtual = getSystemYear();

  // Matriz Contábil Oficial: Segrega ministros Ativos vs Suspensos vs Deletados
  const matrizContabil = useMemo(() => {
    return processarMatrizContabilAnuidades(anuidades, ministros, tenantAtivo?.id, anoAtual);
  }, [anuidades, ministros, tenantAtivo?.id, anoAtual]);

  const totalArrecadado = matrizContabil.totalRealizado;
  const totalPendente = matrizContabil.totalPendente;

  const handleExportarPdf = async () => {
    try {
      setGerandoPdf(true);
      const tenantAnuidades = matrizContabil.anuidadesProjetadas;
      await exportarRelatorioFinanceiroPdf(tenantAnuidades as any, appConfig, totalArrecadado, totalPendente);
      setFeedback('Relatório financeiro oficial em PDF gerado com QR Code de verificação e assinatura digital SHA-256!');
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao gerar relatório em PDF: ' + (err?.message || String(err)));
    } finally {
      setGerandoPdf(false);
    }
  };

  // Mapeamento de meses do ano corrente (considerando a matriz contábil limpa de obreiros suspensos/deletados)
  const dadosMensaisAnuidades = useMemo(() => {
    const meses = [
      { mesNum: '01', nome: 'Janeiro' },
      { mesNum: '02', nome: 'Fevereiro' },
      { mesNum: '03', nome: 'Março' },
      { mesNum: '04', nome: 'Abril' },
      { mesNum: '05', nome: 'Maio' },
      { mesNum: '06', nome: 'Junho' },
      { mesNum: '07', nome: 'Julho' },
      { mesNum: '08', nome: 'Agosto' },
      { mesNum: '09', nome: 'Setembro' },
      { mesNum: '10', nome: 'Outubro' },
      { mesNum: '11', nome: 'Novembro' },
      { mesNum: '12', nome: 'Dezembro' },
    ];

    return meses.map((m) => {
      const prefixo = `${anoAtual}-${m.mesNum}`;

      // Apenas lançamentos projetáveis (ministros ativos ou receitas já realizadas)
      const lancamentosMesProjetados = matrizContabil.anuidadesProjetadas.filter((a) =>
        a.dataVencimento.startsWith(prefixo)
      );

      // Realizado histórico (valores pagos de qualquer ministro)
      const lancamentosMesRealizados = matrizContabil.anuidadesRealizadas.filter((a) =>
        (a.dataPagamento || a.dataLiquidacao || a.dataVencimento).startsWith(prefixo)
      );

      // Pendentes efetivos (ativos com anuidade aberta ou suspensos com inadimplência vencida)
      const lancamentosMesPendentes = matrizContabil.anuidadesPendentes.filter((a) =>
        a.dataVencimento.startsWith(prefixo)
      );

      const projetado = lancamentosMesProjetados.reduce((acc, curr) => acc + (curr.valor || 0), 0);
      const realizado = lancamentosMesRealizados.reduce((acc, curr) => acc + (curr.valor || 0), 0);
      const pendente = lancamentosMesPendentes.reduce((acc, curr) => acc + (curr.valor || 0), 0);

      return {
        mes: m.nome,
        projetado,
        realizado,
        pendente,
        quantidade: lancamentosMesProjetados.length,
      };
    });
  }, [matrizContabil, anoAtual]);

  // Função para exportar os dados para CSV
  const exportarParaCsv = () => {
    const headers = ['Mes', 'Projetado (R$)', 'Realizado (R$)', 'Pendente (R$)', 'Qtd Lancamentos'];
    const rows = dadosMensaisAnuidades.map((d) => [
      d.mes,
      d.projetado.toFixed(2),
      d.realizado.toFixed(2),
      d.pendente.toFixed(2),
      d.quantidade,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Relatorio_Financeiro_Anuidades_2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setFeedback('Relatório financeiro exportado para CSV com sucesso!');
    setTimeout(() => setFeedback(null), 3500);
  };

  const totalRealizadoAno = dadosMensaisAnuidades.reduce((acc, curr) => acc + curr.realizado, 0);
  const totalProjetadoAno = dadosMensaisAnuidades.reduce((acc, curr) => acc + curr.projetado, 0);

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* Feedback Toast */}
      {feedback && (
        <div className="p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Banner Superior */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold text-teal-400 bg-teal-950/80 border border-teal-500/30 px-2.5 py-0.5 rounded">
              DRE & FLUXO DE CAIXA
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Relatórios Financeiros Detalhados (Exercício 2026)
            </h2>
            <p className="text-xs text-slate-400 max-w-xl">
              Comparativo mês a mês das entradas de anuidades e taxas eclesiásticas com trilha de auditoria e exportação para CSV.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={gerandoPdf}
              onClick={handleExportarPdf}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer hover:scale-102 disabled:opacity-50"
              title="Gerar e imprimir relatório contábil oficial com QR Code e assinatura digital SHA-256"
            >
              <FileText className={`w-4 h-4 text-rose-400 ${gerandoPdf ? 'animate-pulse' : ''}`} />
              <span>{gerandoPdf ? 'Gerando QR Code...' : 'Exportar PDF com QR Code'}</span>
            </button>

            <button
              onClick={() =>
                exportarRelatorioFinanceiroCSV({
                  anuidades,
                  ministros,
                  appConfig,
                  titulo: 'Relatório Financeiro de Anuidades e Arrecadação - Exercício 2026',
                })
              }
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(20,184,166,0.3)] cursor-pointer hover:scale-102"
              title="Exportar dados analíticos em CSV compatível com Excel e ERPs Contábeis"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Dados em CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase">Total Realizado (Ano)</span>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {totalRealizadoAno.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <span className="text-[10px] font-mono text-slate-500">Baixadas via Asaas/Ledger</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase">Total Projetado (Orçado)</span>
          <div className="text-2xl font-black text-cyan-400 font-mono">
            {totalProjetadoAno.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <span className="text-[10px] font-mono text-slate-500">Previsão total do exercício</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase">Taxa de Conversão</span>
          <div className="text-2xl font-black text-teal-400 font-mono">
            {totalProjetadoAno > 0 ? ((totalRealizadoAno / totalProjetadoAno) * 100).toFixed(1) : '0'}%
          </div>
          <span className="text-[10px] font-mono text-slate-500">Realizado vs Projetado</span>
        </div>
      </div>

      {/* Gráfico de Linha Recharts Mês a Mês */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <LineIcon className="w-5 h-5 text-teal-400" />
            Evolução Mensal: Projetado vs. Realizado (Anuidades {anoAtual})
          </h3>
          <span className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
            RECHARTS LINE CHART
          </span>
        </div>

        <div className="h-80 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dadosMensaisAnuidades}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="mes" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                formatter={(val: any) => [`R$ ${Number(val).toFixed(2)}`, '']}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="projetado"
                name="Receita Projetada"
                stroke="#06b6d4"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="realizado"
                name="Receita Realizada (Liquidada)"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela Resumo Mensal */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Detalhamento Tabular Mensal</h3>
          <span className="text-xs font-mono text-slate-400">12 Meses • 2026</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
              <tr>
                <th className="p-4">Mês</th>
                <th className="p-4">Qtd Lançamentos</th>
                <th className="p-4">Projetado</th>
                <th className="p-4">Realizado</th>
                <th className="p-4">Pendente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {dadosMensaisAnuidades.map((row) => (
                <tr key={row.mes} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-4 font-bold text-white">{row.mes}</td>
                  <td className="p-4">{row.quantidade}</td>
                  <td className="p-4 text-cyan-400 font-bold">R$ {row.projetado.toFixed(2)}</td>
                  <td className="p-4 text-emerald-400 font-bold">R$ {row.realizado.toFixed(2)}</td>
                  <td className="p-4 text-amber-400">R$ {row.pendente.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
