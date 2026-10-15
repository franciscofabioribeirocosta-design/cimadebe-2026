/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Módulo DRE AGO: Demonstrativo do Resultado do Exercício da AGO 2026
 * Arquitetura Neofintech: Firestore ACID runTransaction(), Recharts, 4 Planos Oficiais,
 * Cargos Eclesiásticos e Integração de Tarifas Asaas (Valor Bruto, Tarifas e Consolidado)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { parseNfceQrCode } from '../utils/nfceQrParser';
import { ModalLancamentoDespesaQr } from './ModalLancamentoDespesaQr';
export { parseNfceQrCode };
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Receipt,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Layers,
  Crown,
  Filter,
  Calendar,
  Sparkles,
  CheckCircle2,
  Plus,
  RefreshCw,
  Building2,
  PieChart as PieIcon,
  BarChart3,
  ShieldCheck,
  Award,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  X,
  CreditCard,
  QrCode,
  FileText,
  BadgePercent,
  Check,
  Zap,
} from 'lucide-react';
import {
  LancamentoAgo,
  DreAgoTotaisConsolidado,
  PlanoAgoKey,
  CargoEclesiasticoOficial,
  FormaPagamentoAsaas,
  calcularTarifaAsaas,
  criarTotaisIniciaisDreAgo,
  inicializarDreAgoSeNecessario,
  ouvirTotaisDreAgo,
  ouvirLancamentosDreAgo,
  redefinirEzerarBalancoTotal,
} from '../services/dreAgoService';
import { ouvirPlanosAgo, PlanoAgo } from '../services/planosAgoService';

export type { FormaPagamentoAsaas, LancamentoAgo, CargoEclesiasticoOficial, PlanoAgoKey };

export interface PlanoAgoDef {
  key: PlanoAgoKey;
  nome: string;
  subtitulo: string;
  valorUnitario: number;
  cor: string;
  corBorda: string;
  corFundo: string;
  corTexto: string;
}

export const PLANOS_AGO_DEFINICAO: readonly PlanoAgoDef[] = [
  {
    key: 'PLANO_1',
    nome: 'Plano 1 - Inscrição Normal Ministros',
    subtitulo: 'Plenárias + Kit Congressista Completo + Direito a Voto',
    valorUnitario: 190.0,
    cor: '#6366f1', // Indigo
    corBorda: 'border-indigo-500/50',
    corFundo: 'bg-indigo-950/40',
    corTexto: 'text-indigo-400',
  },
  {
    key: 'PLANO_2',
    nome: 'Plano 2 - Inscrição Exclusiva Missionárias',
    subtitulo: 'Plenárias + Reuniões Especiais UEMH + Kit Especializado',
    valorUnitario: 120.0,
    cor: '#f59e0b', // Amber
    corBorda: 'border-amber-500/50',
    corFundo: 'bg-amber-950/40',
    corTexto: 'text-amber-400',
  },
  {
    key: 'PLANO_3',
    nome: 'Plano 3 - Novos Ministros (Recebidos / Ordenados)',
    subtitulo: 'Consagração Solene + Ordem do Dia + Diploma Oficial e Nova Credencial',
    valorUnitario: 380.0,
    cor: '#06b6d4', // Cyan
    corBorda: 'border-cyan-500/50',
    corFundo: 'bg-cyan-950/40',
    corTexto: 'text-cyan-400',
  },
  {
    key: 'PLANO_4',
    nome: 'Plano 4 - Missionárias (Recebidas / Ordenadas)',
    subtitulo: 'Consagração Solene UEMH + Diploma Oficial e Nova Credencial',
    valorUnitario: 240.0,
    cor: '#10b981', // Emerald
    corBorda: 'border-emerald-500/50',
    corFundo: 'bg-emerald-950/40',
    corTexto: 'text-emerald-400',
  },
];

// Cargos eclesiásticos oficiais da Convenção Geral (sem setores ou regionais)
export const CARGOS_ECLESIASTICOS_AGO: readonly CargoEclesiasticoOficial[] = [
  'Pastor',
  'Evangelista',
  'Presbítero',
  'Missionária',
];

export const CENTROS_CUSTO_AGO = [
  'TODOS',
  'Inscrições & Credenciamento',
  'Hospedagem & Hotelaria',
  'Alimentação & Buffet Plenária',
  'Infraestrutura & Locação Centro de Convenções',
  'Mídia, Transmissão & TI',
  'Secretaria, Gráfica & Crachás CR-80',
] as const;

export { calcularTarifaAsaas };

// Base inicial padrão de simulação real para bootstrapping atômico com as 4 categorias e tarifas Asaas
const SEED_LANCAMENTOS_AGO: readonly Omit<LancamentoAgo, 'id'>[] = [];

function formatarMoeda(val: number): string {
  return (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function AdminDreAgo() {
  const [totaisConsolidados, setTotaisConsolidados] = useState<DreAgoTotaisConsolidado | null>(null);
  const [lancamentos, setLancamentos] = useState<LancamentoAgo[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>('TODOS');
  const [filtroCentroCusto, setFiltroCentroCusto] = useState<string>('TODOS');
  const [filtroCargo, setFiltroCargo] = useState<string>('TODOS');
  const [filtroPlano, setFiltroPlano] = useState<string>('TODOS');
  const [planosDb, setPlanosDb] = useState<PlanoAgo[]>([]);

  // Modal de Lançamento de Despesa com Leitor QR Code NFC-e
  const [modalDespesaAberto, setModalDespesaAberto] = useState<boolean>(false);
  const [processandoLimpeza, setProcessandoLimpeza] = useState(false);
  const [confirmandoZerar, setConfirmandoZerar] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  const handleZerarDRE = async () => {
    try {
      setProcessandoLimpeza(true);
      setMensagemSucesso(null);
      setMensagemErro(null);
      await redefinirEzerarBalancoTotal(db);
      setMensagemSucesso('✓ Balanço DRE AGO e todas as inscrições de teste foram excluídos com sucesso! O sistema contábil está 100% limpo e operando no Modo de Produção Real.');
      setConfirmandoZerar(false);
    } catch (err: any) {
      setMensagemErro('Erro ao zerar balanço: ' + (err?.message || String(err)));
    } finally {
      setProcessandoLimpeza(false);
    }
  };

  // 1. Sincronização em Tempo Real via onSnapshot() dos Totais Atômicos do Servidor e Lançamentos
  useEffect(() => {
    // Inicialização atômica se banco estiver zerado
    inicializarDreAgoSeNecessario(db, SEED_LANCAMENTOS_AGO).catch((err) => {
      console.error('Erro na inicialização atômica do DRE AGO:', err);
    });

    // Ouvinte em tempo real para o documento de Totais Consolidados no Firestore
    const unsubTotais = ouvirTotaisDreAgo(
      db,
      (novosTotais) => {
        setTotaisConsolidados(novosTotais);
        setCarregando(false);
      },
      (err) => {
        console.error('Erro no listener de totais DRE AGO:', err);
        setCarregando(false);
      }
    );

    // Ouvinte em tempo real para o Ledger de Lançamentos
    const unsubLancamentos = ouvirLancamentosDreAgo(
      db,
      (docs) => {
        setLancamentos(docs);
      },
      (err) => {
        console.error('Erro no listener de lançamentos DRE AGO:', err);
      }
    );

    // Ouvinte em tempo real para os 4 Planos Oficiais do Firestore
    const unsubPlanos = ouvirPlanosAgo(
      db,
      (docs) => {
        setPlanosDb(docs);
      },
      (err) => {
        console.warn('Erro ao carregar planos do banco no DRE:', err);
      }
    );

    return () => {
      unsubTotais();
      unsubLancamentos();
      unsubPlanos();
    };
  }, []);

  const temFiltroAtivo = filtroCentroCusto !== 'TODOS' || filtroCargo !== 'TODOS' || filtroPlano !== 'TODOS' || filtroPeriodo !== 'TODOS';

  // 2. Filtro Inteligente de Lançamentos do Ledger
  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter((l) => {
      if (filtroCentroCusto !== 'TODOS' && l.centroCusto !== filtroCentroCusto) return false;
      if (filtroCargo !== 'TODOS' && l.cargoEclesiastico !== filtroCargo) return false;
      if (filtroPlano !== 'TODOS' && l.plano !== filtroPlano) return false;
      if (filtroPeriodo !== 'TODOS') {
        const mes = (l?.data || '').substring(5, 7);
        if (filtroPeriodo === 'Q1' && !['01', '02', '03'].includes(mes)) return false;
        if (filtroPeriodo === 'Q2' && !['04', '05', '06'].includes(mes)) return false;
        if (filtroPeriodo === 'Q3' && !['07', '08', '09'].includes(mes)) return false;
      }
      return true;
    });
  }, [lancamentos, filtroCentroCusto, filtroCargo, filtroPlano, filtroPeriodo]);

  // 3. Métricas Contábeis DRE (Utiliza os Totais Consolidados Atômicos do Firestore quando sem filtros)
  const metricasContabeis = useMemo(() => {
    if (!temFiltroAtivo && totaisConsolidados) {
      return {
        totalValorBruto: totaisConsolidados.totalValorBruto,
        totalTarifasAsaas: totaisConsolidados.totalTarifasAsaas,
        totalValorConsolidado: totaisConsolidados.totalValorConsolidado,
        totalDespesas: totaisConsolidados.totalDespesas,
        superavitLiquidoFinal: totaisConsolidados.superavitLiquidoFinal,
        margemOperacional: totaisConsolidados.margemOperacional,
        totalInscritosPagantes: totaisConsolidados.totalInscritosPagantes,
        origem: 'FIRESTORE_ATOMIC_TRANSACTION',
        versao: totaisConsolidados.versaoTransacional,
      };
    }

    // Cálculo do subconjunto filtrado
    let totalValorBruto = 0;
    let totalTarifasAsaas = 0;
    let totalDespesas = 0;
    let totalInscritosPagantes = 0;

    lancamentosFiltrados.forEach((l) => {
      if (l.tipo === 'RECEITA') {
        totalValorBruto += l.valor;
        const tarifa = l.tarifaAsaas ?? (l.formaPagamento ? calcularTarifaAsaas(l.valor, l.formaPagamento) : 0.99);
        totalTarifasAsaas += tarifa;
        if (l.plano || l.cargoEclesiastico) {
          totalInscritosPagantes += 1;
        }
      } else {
        totalDespesas += l.valor;
      }
    });

    const totalValorConsolidado = Math.max(0, totalValorBruto - totalTarifasAsaas);
    const superavitLiquidoFinal = totalValorConsolidado - totalDespesas;
    const margemOperacional = totalValorConsolidado > 0 ? (superavitLiquidoFinal / totalValorConsolidado) * 100 : 0;

    return {
      totalValorBruto,
      totalTarifasAsaas,
      totalValorConsolidado,
      totalDespesas,
      superavitLiquidoFinal,
      margemOperacional,
      totalInscritosPagantes,
      origem: 'FILTRO_PERSONALIZADO',
      versao: totaisConsolidados?.versaoTransacional ?? 1,
    };
  }, [temFiltroAtivo, totaisConsolidados, lancamentosFiltrados]);

  // 4. Métricas por 4 Planos da AGO
  const metricasPorPlano = useMemo(() => {
    return PLANOS_AGO_DEFINICAO.map((p) => {
      const docDb = planosDb.find((d) => d.id === p.key);
      const valorUnitarioFinal = docDb ? docDb.valor : p.valorUnitario;
      const nomeFinal = docDb?.nome || p.nome;
      const subtituloFinal = docDb?.subtitulo || p.subtitulo;

      if (!temFiltroAtivo && totaisConsolidados?.receitasPorPlano?.[p.key]) {
        const metric = totaisConsolidados.receitasPorPlano[p.key];
        return {
          ...p,
          nome: nomeFinal,
          subtitulo: subtituloFinal,
          valorUnitario: valorUnitarioFinal,
          qtdInscritos: metric.qtdInscritos,
          totalArrecadadoBruto: metric.totalArrecadadoBruto,
          totalTarifasPlano: metric.totalTarifasPlano,
          totalArrecadadoConsolidado: metric.totalArrecadadoConsolidado,
        };
      }

      const lancsDoPlano = lancamentosFiltrados.filter(
        (l) => l.tipo === 'RECEITA' && l.plano === p.key
      );
      const totalArrecadadoBruto = lancsDoPlano.reduce((acc, curr) => acc + curr.valor, 0);
      const totalTarifasPlano = lancsDoPlano.reduce(
        (acc, curr) => acc + (curr.tarifaAsaas ?? (curr.formaPagamento ? calcularTarifaAsaas(curr.valor, curr.formaPagamento) : 0.99)),
        0
      );
      const totalArrecadadoConsolidado = Math.max(0, totalArrecadadoBruto - totalTarifasPlano);
      const qtdInscritos = lancsDoPlano.length;

      return {
        ...p,
        nome: nomeFinal,
        subtitulo: subtituloFinal,
        valorUnitario: valorUnitarioFinal,
        qtdInscritos,
        totalArrecadadoBruto,
        totalTarifasPlano,
        totalArrecadadoConsolidado,
      };
    });
  }, [temFiltroAtivo, totaisConsolidados, lancamentosFiltrados, planosDb]);

  // 5. Métricas pelos 4 Cargos Eclesiásticos Oficiais (Pastor, Evangelista, Presbítero, Missionária)
  const metricasPorCargo = useMemo(() => {
    return CARGOS_ECLESIASTICOS_AGO.map((cargo) => {
      if (!temFiltroAtivo && totaisConsolidados?.receitasPorCargo?.[cargo]) {
        const metric = totaisConsolidados.receitasPorCargo[cargo];
        return {
          cargo,
          qtdInscritos: metric.qtdInscritos,
          totalArrecadadoBruto: metric.totalArrecadadoBruto,
          totalTarifasCargo: metric.totalTarifasCargo,
          totalArrecadadoConsolidado: metric.totalArrecadadoConsolidado,
          ticketMedio: metric.ticketMedio,
        };
      }

      const lancsDoCargo = lancamentosFiltrados.filter(
        (l) => l.tipo === 'RECEITA' && l.cargoEclesiastico === cargo
      );
      const totalArrecadadoBruto = lancsDoCargo.reduce((acc, curr) => acc + curr.valor, 0);
      const totalTarifasCargo = lancsDoCargo.reduce(
        (acc, curr) => acc + (curr.tarifaAsaas ?? (curr.formaPagamento ? calcularTarifaAsaas(curr.valor, curr.formaPagamento) : 0.99)),
        0
      );
      const totalArrecadadoConsolidado = Math.max(0, totalArrecadadoBruto - totalTarifasCargo);
      const qtdInscritos = lancsDoCargo.length;
      const ticketMedio = qtdInscritos > 0 ? totalArrecadadoBruto / qtdInscritos : 0;

      return {
        cargo,
        qtdInscritos,
        totalArrecadadoBruto,
        totalTarifasCargo,
        totalArrecadadoConsolidado,
        ticketMedio,
      };
    });
  }, [temFiltroAtivo, totaisConsolidados, lancamentosFiltrados]);

  // 6. Dados para Gráfico Temporal
  const dadosGraficoMensal = useMemo(() => {
    if (!temFiltroAtivo && totaisConsolidados?.balancoMensal) {
      return Object.values(totaisConsolidados.balancoMensal).map((bm) => ({
        mes: bm.mes,
        'Receita Bruta': bm.receitaBruta,
        'Tarifas Asaas': bm.tarifasAsaas,
        Consolidado: bm.consolidado,
        Despesas: bm.despesas,
      }));
    }

    const mesesMap: { [mes: string]: { mes: string; 'Receita Bruta': number; 'Tarifas Asaas': number; Consolidado: number; Despesas: number } } = {
      '2026-03': { mes: 'Mar/26', 'Receita Bruta': 0, 'Tarifas Asaas': 0, Consolidado: 0, Despesas: 0 },
      '2026-04': { mes: 'Abr/26', 'Receita Bruta': 0, 'Tarifas Asaas': 0, Consolidado: 0, Despesas: 0 },
      '2026-05': { mes: 'Mai/26', 'Receita Bruta': 0, 'Tarifas Asaas': 0, Consolidado: 0, Despesas: 0 },
      '2026-06': { mes: 'Jun/26', 'Receita Bruta': 0, 'Tarifas Asaas': 0, Consolidado: 0, Despesas: 0 },
      '2026-07': { mes: 'Jul/26', 'Receita Bruta': 0, 'Tarifas Asaas': 0, Consolidado: 0, Despesas: 0 },
    };

    lancamentosFiltrados.forEach((l) => {
      const chaveMes = (l?.data || '').substring(0, 7);
      if (mesesMap[chaveMes]) {
        if (l.tipo === 'RECEITA') {
          mesesMap[chaveMes]['Receita Bruta'] += l.valor;
          const tar = l.tarifaAsaas ?? (l.formaPagamento ? calcularTarifaAsaas(l.valor, l.formaPagamento) : 0.99);
          mesesMap[chaveMes]['Tarifas Asaas'] += tar;
          mesesMap[chaveMes]['Consolidado'] += (l.valor - tar);
        } else {
          mesesMap[chaveMes]['Despesas'] += l.valor;
        }
      }
    });

    return Object.values(mesesMap);
  }, [temFiltroAtivo, totaisConsolidados, lancamentosFiltrados]);

  // 7. Dados para Gráfico de Distribuição por Plano (Donut)
  const dadosGraficoPlanos = useMemo(() => {
    return metricasPorPlano
      .filter((p) => p.totalArrecadadoBruto > 0)
      .map((p) => ({
        name: p.nome,
        value: p.totalArrecadadoBruto,
        color: p.cor,
      }));
  }, [metricasPorPlano]);

  return (
    <div className="space-y-8">
      {/* Top Banner DRE AGO */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-indigo-500/30 backdrop-blur-xl shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-cyan-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-[0_0_25px_rgba(99,102,241,0.3)] shrink-0">
            <Receipt className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold tracking-widest text-indigo-400 bg-indigo-950/80 border border-indigo-500/30 px-2 py-0.5 rounded uppercase">
                DEMONSTRATIVO DE RESULTADOS • DRE AGO 2026
              </span>
              <span className="text-[10px] font-mono text-emerald-400 inline-flex items-center gap-1 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                <ShieldCheck className="w-3 h-3" /> FIRESTORE runTransaction() ACID
              </span>
              {totaisConsolidados?.versaoTransacional ? (
                <span className="text-[10px] font-mono text-cyan-400 inline-flex items-center gap-1 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded">
                  <Zap className="w-3 h-3" /> Versão #{totaisConsolidados.versaoTransacional}
                </span>
              ) : null}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
              Balanço Contábil & Arrecadação AGO
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl">
              Consolidação analítica de receitas pelos 4 planos, arrecadação por cargos eclesiásticos, tarifas bancárias Asaas e despesas operacionais da AGO 2026.
            </p>
          </div>
        </div>

        {/* Ação de Lançamento de Despesa */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {confirmandoZerar ? (
            <div className="flex items-center gap-2 bg-slate-950 border border-rose-500/50 p-1.5 rounded-xl">
              <span className="text-[10px] font-mono text-rose-400 font-bold px-2">CONFIRMA ZERAR?</span>
              <button
                type="button"
                disabled={processandoLimpeza}
                onClick={handleZerarDRE}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-black cursor-pointer disabled:opacity-50"
              >
                {processandoLimpeza ? 'Processando...' : 'SIM, EXCLUIR TUDO'}
              </button>
              <button
                type="button"
                disabled={processandoLimpeza}
                onClick={() => setConfirmandoZerar(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-bold cursor-pointer"
              >
                CANCELAR
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={processandoLimpeza}
              onClick={() => {
                setMensagemSucesso(null);
                setMensagemErro(null);
                setConfirmandoZerar(true);
              }}
              className="flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-slate-950 border border-rose-500/30 hover:border-rose-500 hover:bg-rose-950/20 text-rose-300 font-mono text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4 text-rose-400" />
              <span>Zerar DRE (Limpar Testes)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setModalDespesaAberto(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-xs font-mono shadow-[0_0_20px_rgba(244,63,94,0.35)] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <QrCode className="w-4 h-4 text-rose-200" />
            <span>+ Lançamento Despesas</span>
          </button>
        </div>
      </div>

      {mensagemSucesso && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center justify-between shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <span>{mensagemSucesso}</span>
          <button onClick={() => setMensagemSucesso(null)} className="text-emerald-400 hover:text-white font-bold px-2 shrink-0 cursor-pointer">✕</button>
        </div>
      )}

      {mensagemErro && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center justify-between shadow-[0_0_15px_rgba(244,63,94,0.1)]">
          <span>{mensagemErro}</span>
          <button onClick={() => setMensagemErro(null)} className="text-rose-400 hover:text-white font-bold px-2 shrink-0 cursor-pointer">✕</button>
        </div>
      )}

      {/* PAINEL CENTRAL DE CONCILIAÇÃO FINANCEIRA ASAAS & DRE (VALOR BRUTO, TARIFAS E CONSOLIDADO) */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/40 border border-indigo-500/40 shadow-2xl relative overflow-hidden space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <BadgePercent className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-indigo-400 font-bold tracking-wider block">
                CONCILIAÇÃO BANCÁRIA ASAAS • SOMA ATÔMICA
              </span>
              <h3 className="text-base font-black text-white">
                Demonstrativo do Valor Bruto, Tarifas e Consolidado
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-3 py-1 rounded-xl">
              {metricasContabeis.totalInscritosPagantes} inscrições atômicas
            </span>
            {temFiltroAtivo && (
              <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2.5 py-1 rounded-xl">
                Filtro Ativo
              </span>
            )}
          </div>
        </div>

        {/* 5 Cartões de Fluxo Contábil da AGO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 font-mono">
          {/* 1. Valor Bruto Total */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30 relative flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold uppercase mb-1">
                <span>(+) VALOR BRUTO</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl font-black text-white">
                {formatarMoeda(metricasContabeis.totalValorBruto)}
              </div>
            </div>
            <span className="text-[10px] text-slate-400 mt-2 font-sans">
              Total bruto sem deduções
            </span>
          </div>

          {/* 2. Total Geral de Tarifas Asaas */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/30 relative flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold uppercase mb-1">
                <span>(-) TARIFAS ASAAS</span>
                <BadgePercent className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl font-black text-amber-300">
                {formatarMoeda(metricasContabeis.totalTarifasAsaas)}
              </div>
            </div>
            <span className="text-[10px] text-slate-400 mt-2 font-sans">
              Soma geral de taxas Pix/Cartão/Boleto
            </span>
          </div>

          {/* 3. Valor Consolidado Líquido Asaas */}
          <div className="p-4 rounded-2xl bg-indigo-950/60 border border-indigo-500/60 shadow-[0_0_20px_rgba(99,102,241,0.2)] relative flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[10px] text-indigo-300 font-bold uppercase mb-1">
                <span>(=) CONSOLIDADO</span>
                <Wallet className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl font-black text-indigo-200">
                {formatarMoeda(metricasContabeis.totalValorConsolidado)}
              </div>
            </div>
            <span className="text-[10px] text-indigo-300/80 mt-2 font-sans">
              Creditado na conta Asaas
            </span>
          </div>

          {/* 4. Despesas Operacionais AGO */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-rose-500/30 relative flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[10px] text-rose-400 font-bold uppercase mb-1">
                <span>(-) DESPESAS AGO</span>
                <ArrowDownRight className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl font-black text-rose-300">
                {formatarMoeda(metricasContabeis.totalDespesas)}
              </div>
            </div>
            <span className="text-[10px] text-slate-400 mt-2 font-sans">
              Locação, buffet e estrutura
            </span>
          </div>

          {/* 5. Superávit Líquido Final */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/40 relative flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[10px] text-cyan-400 font-bold uppercase mb-1">
                <span>(=) SUPERÁVIT REAL</span>
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <div className={`text-xl font-black ${metricasContabeis.superavitLiquidoFinal >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
                {formatarMoeda(metricasContabeis.superavitLiquidoFinal)}
              </div>
            </div>
            <span className="text-[10px] text-slate-400 mt-2 font-sans">
              Margem: {metricasContabeis.margemOperacional.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros Avançados */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-bold">FILTROS:</span>
          </div>

          {/* Filtro Período */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
            <span className="text-slate-500 text-[10px]">PERÍODO:</span>
            <select
              aria-label="Filtrar por período"
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer pr-1"
            >
              <option value="TODOS" className="bg-slate-900 text-white">Todos os Meses (2026)</option>
              <option value="Q1" className="bg-slate-900 text-white">1º Trimestre (Jan-Mar)</option>
              <option value="Q2" className="bg-slate-900 text-white">2º Trimestre (Abr-Jun)</option>
              <option value="Q3" className="bg-slate-900 text-white">3º Trimestre (Jul-Set)</option>
            </select>
          </div>

          {/* Filtro Centro de Custo */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
            <span className="text-slate-500 text-[10px]">CENTRO DE CUSTO:</span>
            <select
              aria-label="Filtrar por centro de custo"
              value={filtroCentroCusto}
              onChange={(e) => setFiltroCentroCusto(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer pr-1"
            >
              {CENTROS_CUSTO_AGO.map((cc) => (
                <option key={cc} value={cc} className="bg-slate-900 text-white">
                  {cc}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Cargo (4 Cargos Oficiais) */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
            <span className="text-slate-500 text-[10px]">CARGO:</span>
            <select
              aria-label="Filtrar por cargo"
              value={filtroCargo}
              onChange={(e) => setFiltroCargo(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer pr-1"
            >
              <option value="TODOS" className="bg-slate-900 text-white">Todos os 4 Cargos</option>
              {CARGOS_ECLESIASTICOS_AGO.map((c) => (
                <option key={c} value={c} className="bg-slate-900 text-white">
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Plano (4 Planos Oficiais) */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
            <span className="text-slate-500 text-[10px]">PLANO:</span>
            <select
              aria-label="Filtrar por plano"
              value={filtroPlano}
              onChange={(e) => setFiltroPlano(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer pr-1"
            >
              <option value="TODOS" className="bg-slate-900 text-white">Todos os 4 Planos</option>
              {PLANOS_AGO_DEFINICAO.map((p) => (
                <option key={p.key} value={p.key} className="bg-slate-900 text-white">
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {temFiltroAtivo && (
          <button
            type="button"
            onClick={() => {
              setFiltroPeriodo('TODOS');
              setFiltroCentroCusto('TODOS');
              setFiltroCargo('TODOS');
              setFiltroPlano('TODOS');
            }}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
          >
            Limpar Filtros
          </button>
        )}
      </div>

      {/* SEÇÃO 1: ARRECADAÇÃO CONSOLIDADA PELOS 4 PLANOS DA AGO */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-black text-white">
              Arrecadação Consolidada pelos 4 Planos da AGO
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Valores Brutos e Consolidados pós-Tarifa Asaas
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metricasPorPlano.map((plano) => {
            const percReceita = metricasContabeis.totalValorBruto > 0
              ? (plano.totalArrecadadoBruto / metricasContabeis.totalValorBruto) * 100
              : 0;

            return (
              <div
                key={plano.key}
                className={`p-5 rounded-2xl border ${plano.corBorda} ${plano.corFundo} backdrop-blur-xl shadow-lg relative overflow-hidden flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${plano.corTexto}`}>
                      {plano.nome}
                    </span>
                    <span className="text-[10px] font-mono bg-slate-950/80 px-2 py-0.5 rounded text-white border border-slate-800">
                      {formatarMoeda(plano.valorUnitario)}/un
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 line-clamp-2 min-h-[32px]">
                    {plano.subtitulo}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1 font-mono">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Valor Bruto:</span>
                      <span className="font-bold text-white">{formatarMoeda(plano.totalArrecadadoBruto)}</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-amber-400/90">
                      <span>(-) Tarifas Asaas:</span>
                      <span>{formatarMoeda(plano.totalTarifasPlano)}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60 font-black">
                      <span className="text-slate-300">(=) Consolidado:</span>
                      <span className={plano.corTexto}>{formatarMoeda(plano.totalArrecadadoConsolidado)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span><strong className="text-white">{plano.qtdInscritos}</strong> inscritos</span>
                  </div>
                  <span className={`font-bold ${plano.corTexto}`}>
                    {percReceita.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SEÇÃO 2: GRÁFICOS CONTÁBEIS COM RECHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico 1: Evolução Receitas Brutas, Tarifas Asaas e Despesas */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              <h4 className="text-sm font-bold text-white">
                Balanço Mensal: Receita Bruta, Tarifas Asaas & Despesas (2026)
              </h4>
            </div>
            <span className="text-[10px] font-mono text-slate-500 uppercase">
              Consolidação Cronológica
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosGraficoMensal} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="mes" stroke="#64748b" fontSize={11} fontStyle="bold" />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `R$${val}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#020617',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                  formatter={(val: any) => [formatarMoeda(Number(val) || 0)]}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="Receita Bruta" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Tarifas Asaas" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Proporção de Receitas por Plano (Donut) */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-xl space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-cyan-400" />
              <h4 className="text-sm font-bold text-white">
                Distribuição por Plano
              </h4>
            </div>
          </div>

          <div className="h-52 w-full flex items-center justify-center">
            {dadosGraficoPlanos.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dadosGraficoPlanos}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {dadosGraficoPlanos.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#020617',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                    formatter={(val: any) => [formatarMoeda(Number(val) || 0)]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500 font-mono text-center">
                Sem receitas registradas nos filtros
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-2 border-t border-slate-800">
            {metricasPorPlano.map((p) => (
              <div key={p.key} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.cor }} />
                <span className="text-slate-300 truncate">{p.nome.split(' - ')[1]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SEÇÃO 3: CARDS DE PAGAMENTOS REALIZADOS PELOS 4 CARGOS ECLESIÁSTICOS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-black text-white">
              Arrecadação e Pagamentos por Cargos Eclesiásticos
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            4 Cargos Ministeriais Oficiais
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metricasPorCargo.map((mc) => {
            const coresBadge: Record<string, { badge: string; border: string; glow: string }> = {
              Pastor: {
                badge: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
                border: 'border-indigo-500/30',
                glow: 'shadow-[0_0_15px_rgba(99,102,241,0.15)]',
              },
              Evangelista: {
                badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
                border: 'border-emerald-500/30',
                glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
              },
              Presbítero: {
                badge: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
                border: 'border-cyan-500/30',
                glow: 'shadow-[0_0_15px_rgba(6,182,212,0.15)]',
              },
              Missionária: {
                badge: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
                border: 'border-amber-500/30',
                glow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]',
              },
            };

            const estilo = coresBadge[mc.cargo] || {
              badge: 'bg-slate-800 border-slate-700 text-slate-300',
              border: 'border-slate-800',
              glow: '',
            };

            return (
              <div
                key={mc.cargo}
                className={`p-5 rounded-2xl bg-slate-900/80 border ${estilo.border} ${estilo.glow} backdrop-blur-xl shadow-lg transition-all flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border uppercase inline-block ${estilo.badge}`}>
                        ORDEM MINISTERIAL
                      </span>
                      <h4 className="text-base font-black text-white mt-1.5">
                        {mc.cargo}
                      </h4>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 space-y-1.5 font-mono text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Inscritos Pagos:</span>
                      <span className="text-sm font-black text-white">{mc.qtdInscritos}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Valor Bruto:</span>
                      <span className="font-bold text-emerald-400">{formatarMoeda(mc.totalArrecadadoBruto)}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-amber-400">
                      <span>Tarifas Asaas:</span>
                      <span>-{formatarMoeda(mc.totalTarifasCargo)}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 font-black text-indigo-300">
                      <span>Consolidado:</span>
                      <span>{formatarMoeda(mc.totalArrecadadoConsolidado)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>Ticket Médio Bruto:</span>
                  <span className="text-slate-200 font-bold">
                    {formatarMoeda(mc.ticketMedio)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SEÇÃO 4: TABELA DO LEDGER DE LANÇAMENTOS COM FORMA DE PAGAMENTO E TARIFA ASAAS */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-400" />
            <h4 className="text-sm font-bold text-white">
              Ledger Contábil de Lançamentos da AGO ({lancamentosFiltrados.length})
            </h4>
          </div>
          <span className="text-[10px] font-mono text-slate-500 uppercase">
            Tempo Real • Conciliação Asaas • runTransaction() ACID
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-[10px] text-slate-400 uppercase bg-slate-950/80 border-b border-slate-800">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Descrição / Ministro</th>
                <th className="p-3">Cargo / Plano</th>
                <th className="p-3">Forma Pagamento</th>
                <th className="p-3 text-right">Tarifa Asaas</th>
                <th className="p-3 text-right">Valor Bruto</th>
                <th className="p-3 text-right">Consolidado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {lancamentosFiltrados.map((l) => {
                const isReceita = l.tipo === 'RECEITA';
                const tarifa = isReceita ? (l.tarifaAsaas ?? (l.formaPagamento ? calcularTarifaAsaas(l.valor, l.formaPagamento) : 0.99)) : 0;
                const valorLiquido = isReceita ? Math.max(0, l.valor - tarifa) : l.valor;

                return (
                  <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 text-slate-400 whitespace-nowrap">
                      {l.data.split('-').reverse().join('/')}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isReceita ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-rose-950 text-rose-400 border border-rose-500/30'}`}>
                        {l.tipo}
                      </span>
                    </td>
                    <td className="p-3 text-white font-sans font-medium max-w-xs truncate">
                      {l.descricao}
                    </td>
                    <td className="p-3 text-slate-300 whitespace-nowrap">
                      {l.cargoEclesiastico && (
                        <span className="mr-2 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-indigo-300">
                          {l.cargoEclesiastico}
                        </span>
                      )}
                      {l.plano && (
                        <span className="text-slate-400 text-[11px]">
                          {l.plano.replace('PLANO_', '')}
                        </span>
                      )}
                      {!l.cargoEclesiastico && !l.plano && (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {isReceita && l.formaPagamento ? (
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-cyan-300 font-bold">
                          {l.formaPagamento.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right text-amber-400 whitespace-nowrap">
                      {isReceita ? `-${formatarMoeda(tarifa)}` : '—'}
                    </td>
                    <td className={`p-3 text-right font-bold whitespace-nowrap ${isReceita ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isReceita ? '+' : '-'} {formatarMoeda(l.valor)}
                    </td>
                    <td className="p-3 text-right font-black text-indigo-300 whitespace-nowrap">
                      {isReceita ? formatarMoeda(valorLiquido) : `-${formatarMoeda(l.valor)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE LANÇAMENTO DE DESPESAS COM LEITOR QR CODE NFC-E E TRANSAÇÃO ACID */}
      <ModalLancamentoDespesaQr
        aberto={modalDespesaAberto}
        onFechar={() => setModalDespesaAberto(false)}
      />
    </div>
  );
}
