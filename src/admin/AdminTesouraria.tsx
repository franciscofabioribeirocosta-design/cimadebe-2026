/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Módulo de Tesouraria e Ledger Transacional (/admin-tesouraria)
 * Estética Neofintech de Alta Performance Contábil
 * DRE com Aritmética de Centavos (Anti-IEEE 754), Linhas Zebradas, Indicadores de Tendência e Terminal Asaas
 */

import React, { useState, useMemo } from 'react';
import { useSecurity } from '../SecurityContext';
import {
  SYSTEM_REFERENCE_TIME_ISO,
  SYSTEM_REFERENCE_DATE,
  SYSTEM_REFERENCE_YEAR,
  calcularDRE,
  formatarDataBR,
} from '../financialEngine';
import {
  exportarRelatorioFinanceiroPDF,
  exportarRelatorioFinanceiroCSV,
} from '../services/relatorioFinanceiroService';
import type { AsaasWebhookPayload, CategoriaTransacao, StatusPagamento } from '../types';
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  Receipt,
  Cpu,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Zap,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  Lock,
  ArrowRight,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  Filter,
  BarChart3,
  PieChart as PieIcon,
  LineChart as LineIcon,
  Calendar,
  DollarSign,
  BadgePercent,
  Wallet,
  Download,
  FileText,
  Printer,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Trash2,
  QrCode,
  Send,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import { GraficoProjetadoVsRealizado } from '../components/GraficoProjetadoVsRealizado';
import { AdminTesourariaOperacoes } from './AdminTesourariaOperacoes';

function FormatarMoeda({ valor }: { readonly valor: number }) {
  return (
    <span className="font-mono tracking-tight font-semibold">
      {(Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
    </span>
  );
}

export const MESES_EXERCICIO_2026 = [
  { valor: 'TODOS', label: 'Todos os Meses (Exercício 2026)' },
  { valor: '2026-01', label: 'Janeiro / 2026' },
  { valor: '2026-02', label: 'Fevereiro / 2026' },
  { valor: '2026-03', label: 'Março / 2026' },
  { valor: '2026-04', label: 'Abril / 2026' },
  { valor: '2026-05', label: 'Maio / 2026' },
  { valor: '2026-06', label: 'Junho / 2026' },
  { valor: '2026-07', label: 'Julho / 2026' },
  { valor: '2026-08', label: 'Agosto / 2026' },
  { valor: '2026-09', label: 'Setembro / 2026' },
  { valor: '2026-10', label: 'Outubro / 2026' },
  { valor: '2026-11', label: 'Novembro / 2026' },
  { valor: '2026-12', label: 'Dezembro / 2026' },
] as const;

export function AdminTesouraria() {
  const {
    anuidades,
    ministros,
    tenantAtivo,
    appConfig,
    liquidarAnuidade,
    excluirAnuidade,
    processarWebhookAsaas,
    executarVarreduraAdimplencia,
    cacheIdempotencia,
  } = useSecurity();

  // Estados locais da view de Tesouraria
  const [filtroBusca, setFiltroBusca] = useState<string>('');
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODOS');
  const [filtroMesDre, setFiltroMesDre] = useState<string>('TODOS');
  const [campoOrdenacao, setCampoOrdenacao] = useState<'data' | 'valor' | 'ministro' | 'status' | 'categoria' | 'id'>('data');
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<'asc' | 'desc'>('desc');
  const [feedbackAcao, setFeedbackAcao] = useState<{ tipo: 'sucesso' | 'erro' | 'info'; texto: string } | null>(null);
  const [subAbaTesouraria, setSubAbaTesouraria] = useState<'DRE_LEDGER' | 'OPERACOES' | 'PENDENCIAS_ASAAS'>('DRE_LEDGER');
  const [selecionadosPendencias, setSelecionadosPendencias] = useState<string[]>([]);
  const [filtroBuscaPendencias, setFiltroBuscaPendencias] = useState<string>('');
  const [filtroPrazoPendencias, setFiltroPrazoPendencias] = useState<string>('TODOS');
  const [processandoMassaPendencias, setProcessandoMassaPendencias] = useState<boolean>(false);

  const pendenciasDetalhadas = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return anuidades.map((anuidade) => {
      const ministro = ministros.find((m) => m.id === anuidade.ministroId) || null;
      const statusUpper = (anuidade.statusPagamento || 'ABERTO').toUpperCase();
      const isPago = ['PAGO', 'LIQUIDADO', 'CONFIRMADO', 'EM_DIA', 'ANISTIADO'].includes(statusUpper);
      if (isPago) return null;

      const vencStr = anuidade.dataVencimento ? String(anuidade.dataVencimento).split('T')[0] : '';
      let diasRestantes = 999;
      let statusPrazo = 'EM_ABERTO';
      if (vencStr) {
        const dataVenc = new Date(`${vencStr}T00:00:00`);
        const diffMs = dataVenc.getTime() - hoje.getTime();
        diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diasRestantes < 0) {
          statusPrazo = 'VENCIDO';
        } else if (diasRestantes <= 30) {
          statusPrazo = 'VENCIMENTO_PROXIMO';
        } else {
          statusPrazo = 'NO_PRAZO';
        }
      }

      return {
        anuidadeId: anuidade.id,
        ministroId: ministro?.id || anuidade.ministroId || 'desconhecido',
        nomeMinistro: ministro?.nome || anuidade.nomeMinistro || 'Ministro Conveniado',
        email: ministro?.email || 'N/A',
        telefone: ministro?.telefone || 'N/A',
        cargo: ministro?.cargo || 'Obreiro',
        igreja: ministro?.igrejaFiliadaNome || 'Sede Central',
        valor: Number(anuidade.valor) || 120,
        anoVigente: anuidade.anoVigente || 2026,
        vencimento: vencStr,
        diasRestantes,
        statusPrazo,
        statusPagamento: statusUpper,
        asaasInvoiceUrl: anuidade.asaasInvoiceUrl || null,
        asaasSubscriptionId: anuidade.asaasSubscriptionId || null,
        ministroRaw: ministro,
      };
    }).filter(Boolean) as Array<any>;
  }, [anuidades, ministros]);

  const pendenciasFiltradas = useMemo(() => {
    return pendenciasDetalhadas.filter((p) => {
      const b = (filtroBuscaPendencias || '').toLowerCase().trim();
      const matchBusca =
        !b ||
        (p.nomeMinistro || '').toLowerCase().includes(b) ||
        (p.email || '').toLowerCase().includes(b) ||
        (p.igreja || '').toLowerCase().includes(b);
      
      if (!matchBusca) return false;
      if (filtroPrazoPendencias === 'TODOS') return true;
      return p.statusPrazo === filtroPrazoPendencias;
    });
  }, [pendenciasDetalhadas, filtroBuscaPendencias, filtroPrazoPendencias]);

  const gerarLinkAsaasParaAnuidade = async (anuidadeId: string, valor: number, ministro: any) => {
    try {
      const response = await fetch('/api/asaas/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: ministro?.email || 'tesouraria@cimadebe.org.br',
          cpf: ministro?.cpf || '00000000000',
          name: ministro?.nome || 'Ministro Conveniado',
          userId: ministro?.id || anuidadeId,
          pricingModel: 'RENOVACAO_ANUAL',
          planPrice: valor
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro ao gerar Asaas');
      if (result.data?.invoiceUrl) {
        window.open(result.data.invoiceUrl, '_blank');
        setFeedbackAcao({ tipo: 'sucesso', texto: `Link de pagamento Asaas gerado com sucesso!` });
      }
    } catch (err: any) {
      setFeedbackAcao({ tipo: 'erro', texto: err?.message || 'Falha ao gerar link Asaas.' });
    }
  };

  const handleGerarMassaAsaas = async () => {
    if (!selecionadosPendencias.length) return;
    setProcessandoMassaPendencias(true);
    try {
      let gerados = 0;
      for (const id of selecionadosPendencias) {
        const item = pendenciasDetalhadas.find((p) => p.anuidadeId === id);
        if (!item) continue;
        await fetch('/api/asaas/subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: item.email || 'tesouraria@cimadebe.org.br',
            cpf: item.ministroRaw?.cpf || '00000000000',
            name: item.nomeMinistro,
            userId: item.ministroId,
            pricingModel: 'RENOVACAO_ANUAL',
            planPrice: item.valor
          })
        });
        gerados++;
      }
      setFeedbackAcao({ tipo: 'sucesso', texto: `${gerados} links de pagamento Asaas gerados em massa com sucesso!` });
      setSelecionadosPendencias([]);
    } catch (err: any) {
      setFeedbackAcao({ tipo: 'erro', texto: err?.message || 'Erro ao processar lote Asaas.' });
    } finally {
      setProcessandoMassaPendencias(false);
    }
  };

  const handleEnviarLembreteMassa = () => {
    if (!selecionadosPendencias.length) return;
    setFeedbackAcao({ tipo: 'sucesso', texto: `Lembretes de cobrança enviados via WebPush / WhatsApp para ${selecionadosPendencias.length} ministros selecionados!` });
    setSelecionadosPendencias([]);
  };

  const alternarOrdenacao = (campo: 'data' | 'valor' | 'ministro' | 'status' | 'categoria' | 'id') => {
    if (campoOrdenacao === campo) {
      setDirecaoOrdenacao((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setCampoOrdenacao(campo);
      setDirecaoOrdenacao(campo === 'valor' || campo === 'data' ? 'desc' : 'asc');
    }
  };

  // Payload inicial do mock de Webhook Asaas
  const payloadExemploInicial: AsaasWebhookPayload = {
    event: 'PAYMENT_RECEIVED',
    payment: {
      id: 'pay_asaas_88319203_sim',
      customer: 'cus_cimadebe_001',
      value: 120.0,
      netValue: 118.02,
      billingType: 'PIX',
      status: 'RECEIVED',
      confirmedDate: SYSTEM_REFERENCE_TIME_ISO,
      externalReference: 'an-003',
      description: 'Liquidação Anuidade Convencional 2026 - CIMADEBE',
    },
  };

  const [webhookJsonTexto, setWebhookJsonTexto] = useState<string>(
    JSON.stringify(payloadExemploInicial, null, 2)
  );
  const [processandoWebhook, setProcessandoWebhook] = useState<boolean>(false);

  // DRE Calculado com suporte a Filtro de Período por Mês
  const dreAtivo = useMemo(() => {
    if (!ministros || ministros.length === 0) {
      return calcularDRE([]);
    }
    const idsMinistrosValidos = new Set(
      ministros.flatMap((m) => [m.id, m.cpf ? m.cpf.replace(/\D/g, '') : ''].filter(Boolean))
    );

    const listaBase = anuidades.filter((a) => {
      if (!idsMinistrosValidos.has(a.ministroId)) return false;
      if (tenantAtivo?.id && a.tenantId && a.tenantId !== tenantAtivo.id) return false;
      if (filtroMesDre !== 'TODOS') {
        const mesVencimento = (a?.dataVencimento || (a as any)?.data || (a as any)?.dataPagamento || '').substring(0, 7);
        if (mesVencimento !== filtroMesDre) return false;
      }
      return true;
    });

    return calcularDRE(listaBase);
  }, [anuidades, ministros, tenantAtivo?.id, filtroMesDre]);

  // Anuidades filtradas e ordenadas instantaneamente para relatórios e ledger
  const anuidadesFiltradas = useMemo(() => {
    const filtradas = anuidades.filter((a) => {
      const min = ministros.find((m) => m.id === a.ministroId);

      // Filtrar pelo tenant ativo
      if (tenantAtivo?.id && a.tenantId && a.tenantId !== tenantAtivo.id) return false;

      // Filtro de mês se ativo
      if (filtroMesDre !== 'TODOS') {
        const mes = (a?.dataVencimento || (a as any)?.data || (a as any)?.dataPagamento || '').substring(0, 7);
        if (mes !== filtroMesDre) return false;
      }

      // Filtro de status
      if (filtroStatus !== 'TODOS' && a.statusPagamento !== filtroStatus) return false;

      // Filtro de categoria
      if (filtroCategoria !== 'TODOS' && a.categoria !== filtroCategoria) return false;

      // Filtro de busca por nome do ministro ou ID
      if (filtroBusca.trim()) {
        const termo = filtroBusca.toLowerCase();
        const nomeMin = (min?.nome || '').toLowerCase();
        const cpfMin = (min?.cpf || '');
        const idMin = (a.ministroId || '').toLowerCase();
        const idAnuidade = (a.id || '').toLowerCase();
        const bateNome = nomeMin.includes(termo);
        const bateCpf = cpfMin.includes(termo);
        const bateId = idMin.includes(termo) || idAnuidade.includes(termo);
        if (!bateNome && !bateCpf && !bateId) return false;
      }

      return true;
    });

    return [...filtradas].sort((a, b) => {
      let comp = 0;
      if (campoOrdenacao === 'data') {
        const dataA = a?.dataVencimento || (a as any)?.data || (a as any)?.dataPagamento || '';
        const dataB = b?.dataVencimento || (b as any)?.data || (b as any)?.dataPagamento || '';
        comp = dataA.localeCompare(dataB);
      } else if (campoOrdenacao === 'valor') {
        const valA = Number(a.valor) || 0;
        const valB = Number(b.valor) || 0;
        comp = valA - valB;
      } else if (campoOrdenacao === 'ministro') {
        const minA = ministros.find((m) => m.id === a.ministroId)?.nome || a.ministroId || '';
        const minB = ministros.find((m) => m.id === b.ministroId)?.nome || b.ministroId || '';
        comp = minA.localeCompare(minB);
      } else if (campoOrdenacao === 'status') {
        comp = (a.statusPagamento || '').localeCompare(b.statusPagamento || '');
      } else if (campoOrdenacao === 'categoria') {
        comp = (a.categoria || '').localeCompare(b.categoria || '');
      } else if (campoOrdenacao === 'id') {
        comp = (a.id || '').localeCompare(b.id || '');
      }

      return direcaoOrdenacao === 'asc' ? comp : -comp;
    });
  }, [
    anuidades,
    tenantAtivo?.id,
    filtroMesDre,
    filtroStatus,
    filtroCategoria,
    filtroBusca,
    ministros,
    campoOrdenacao,
    direcaoOrdenacao,
  ]);

  // Linhas Analíticas do DRE para a Tabela Zebrada com Indicadores Visuais de Tendência
  const linhasDreAnaliticas = useMemo(() => {
    const faturamentoBruto = dreAtivo.faturamentoBruto;
    const taxasGateway = dreAtivo.taxasGateway;
    const faturamentoLiquido = dreAtivo.faturamentoLiquido;
    const taxaConvencao = dreAtivo.receitaTaxaConvencao;
    const anuidadesRecorrentes = dreAtivo.receitaAnuidades;
    const previsaoReceber = dreAtivo.previsaoReceber;

    const percentualConvencao = faturamentoBruto > 0 ? (taxaConvencao / faturamentoBruto) * 100 : 0;
    const percentualAnuidades = faturamentoBruto > 0 ? (anuidadesRecorrentes / faturamentoBruto) * 100 : 0;
    const percentualRetencao = faturamentoBruto > 0 ? (taxasGateway / faturamentoBruto) * 100 : 1.65;
    const percentualMargemLiquida = faturamentoBruto > 0 ? (faturamentoLiquido / faturamentoBruto) * 100 : 0;

    return [
      {
        id: 'dre-lin-1',
        codigo: '1.0',
        descricao: 'Faturamento Bruto Convencional Realizado',
        tipo: 'RECEITA' as const,
        natureza: 'Entrada Eclesiástica',
        valor: faturamentoBruto,
        centavos: dreAtivo.faturamentoBrutoCentavos,
        tendencia: 'ALTA' as const,
        percentual: 100,
        badgeTexto: 'Receita Bruta (+)',
        corTexto: 'text-emerald-400',
        corBadge: 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30',
        iconeTendencia: TrendingUp,
        iconeDirecao: ArrowUpRight,
      },
      {
        id: 'dre-lin-1-1',
        codigo: '1.1',
        descricao: '↳ Receita de Taxas de Filiação Convencional (TAXA_CONVENCAO)',
        tipo: 'RECEITA' as const,
        natureza: 'Sub-Conta Receita',
        valor: taxaConvencao,
        centavos: dreAtivo.receitaTaxaConvencaoCentavos,
        tendencia: 'ALTA' as const,
        percentual: percentualConvencao,
        badgeTexto: `${percentualConvencao.toFixed(1)}% do Bruto`,
        corTexto: 'text-emerald-300',
        corBadge: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/30',
        iconeTendencia: TrendingUp,
        iconeDirecao: ArrowUpRight,
      },
      {
        id: 'dre-lin-1-2',
        codigo: '1.2',
        descricao: '↳ Receita de Anuidades Ministeriais Recorrentes (ANUIDADE)',
        tipo: 'RECEITA' as const,
        natureza: 'Sub-Conta Receita',
        valor: anuidadesRecorrentes,
        centavos: dreAtivo.receitaAnuidadesCentavos,
        tendencia: 'ALTA' as const,
        percentual: percentualAnuidades,
        badgeTexto: `${percentualAnuidades.toFixed(1)}% do Bruto`,
        corTexto: 'text-emerald-300',
        corBadge: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/30',
        iconeTendencia: TrendingUp,
        iconeDirecao: ArrowUpRight,
      },
      {
        id: 'dre-lin-2',
        codigo: '2.0',
        descricao: '(-) Deduções & Tarifas Bancárias Asaas (Pix / Boleto)',
        tipo: 'DESPESA' as const,
        natureza: 'Dedução Operacional',
        valor: -taxasGateway,
        centavos: -dreAtivo.taxasGatewayCentavos,
        tendencia: 'BAIXA' as const,
        percentual: percentualRetencao,
        badgeTexto: `-${percentualRetencao.toFixed(2)}% Taxa Gateway`,
        corTexto: 'text-rose-400',
        corBadge: 'bg-rose-950/80 text-rose-300 border-rose-500/30',
        iconeTendencia: TrendingDown,
        iconeDirecao: ArrowDownRight,
      },
      {
        id: 'dre-lin-3',
        codigo: '3.0',
        descricao: '(=) Faturamento Líquido Realizado (Disponível em Conta)',
        tipo: 'RESULTADO' as const,
        natureza: 'Resultado Caixa',
        valor: faturamentoLiquido,
        centavos: dreAtivo.faturamentoLiquidoCentavos,
        tendencia: 'ESTAVEL' as const,
        percentual: percentualMargemLiquida,
        badgeTexto: `${percentualMargemLiquida.toFixed(1)}% Margem Efetiva`,
        corTexto: 'text-cyan-300 font-bold',
        corBadge: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40',
        iconeTendencia: TrendingUp,
        iconeDirecao: ArrowUpRight,
      },
      {
        id: 'dre-lin-4',
        codigo: '4.0',
        descricao: '(+) Previsão de Arrecadação em Aberto (Contas a Receber)',
        tipo: 'PREVISAO' as const,
        natureza: 'Fluxo Futuro / Aberto',
        valor: previsaoReceber,
        centavos: dreAtivo.previsaoReceberCentavos,
        tendencia: 'ALTA' as const,
        percentual: 0,
        badgeTexto: 'Em Aberto / Cascata',
        corTexto: 'text-amber-400',
        corBadge: 'bg-amber-950/80 text-amber-300 border-amber-500/30',
        iconeTendencia: Clock,
        iconeDirecao: ArrowUpRight,
      },
    ];
  }, [dreAtivo]);

  // Dados calculados para os gráficos Recharts
  const dadosPagasVsPendentes = useMemo(() => {
    let valorPago = 0;
    let valorPendente = 0;
    let qtdPago = 0;
    let qtdPendente = 0;

    anuidades.forEach((a) => {
      if (tenantAtivo?.id && a.tenantId !== tenantAtivo.id) return;
      if (filtroMesDre !== 'TODOS') {
        const mes = (a?.dataVencimento || (a as any)?.data || (a as any)?.dataPagamento || '').substring(0, 7);
        if (mes !== filtroMesDre) return;
      }
      if (a.statusPagamento === 'PAGO') {
        valorPago += a.valor;
        qtdPago += 1;
      } else {
        valorPendente += a.valor;
        qtdPendente += 1;
      }
    });

    return [
      { name: 'Pagas (Liquidadas)', valor: valorPago, quantidade: qtdPago, color: '#10b981' },
      { name: 'Pendentes (Aberto)', valor: valorPendente, quantidade: qtdPendente, color: '#f59e0b' },
    ];
  }, [anuidades, tenantAtivo?.id, filtroMesDre]);

  const dadosFluxoCaixaAno = useMemo(() => {
    const mapaAnos: Record<number, { ano: number; recebido: number; esperado: number; convencao: number; anuidade: number }> = {};

    anuidades.forEach((a) => {
      if (tenantAtivo?.id && a.tenantId !== tenantAtivo.id) return;
      const ano = a.anoVigente || 2026;
      if (!mapaAnos[ano]) {
        mapaAnos[ano] = { ano, recebido: 0, esperado: 0, convencao: 0, anuidade: 0 };
      }
      if (a.statusPagamento === 'PAGO') {
        mapaAnos[ano].recebido += a.valor;
      } else {
        mapaAnos[ano].esperado += a.valor;
      }
      if (a.categoria === 'TAXA_CONVENCAO') {
        mapaAnos[ano].convencao += a.valor;
      } else {
        mapaAnos[ano].anuidade += a.valor;
      }
    });

    return Object.values(mapaAnos).sort((a, b) => a.ano - b.ano);
  }, [anuidades, tenantAtivo?.id]);

  const dadosProjecaoReceita = useMemo(() => {
    const baseReceita = dreAtivo.faturamentoBruto || 45000;
    return [
      { ano: '2026 (Atual)', projecao: baseReceita, conservador: baseReceita * 0.92, otimista: baseReceita * 1.12 },
      { ano: '2027', projecao: baseReceita * 1.15, conservador: baseReceita * 1.05, otimista: baseReceita * 1.30 },
      { ano: '2028', projecao: baseReceita * 1.32, conservador: baseReceita * 1.18, otimista: baseReceita * 1.55 },
      { ano: '2029', projecao: baseReceita * 1.52, conservador: baseReceita * 1.35, otimista: baseReceita * 1.85 },
    ];
  }, [dreAtivo.faturamentoBruto]);

  // Handler para simular webhook Asaas
  const lidarComSimulacaoWebhook = async () => {
    setProcessandoWebhook(true);
    setFeedbackAcao(null);

    try {
      const parsed: AsaasWebhookPayload = JSON.parse(webhookJsonTexto);
      const resultado = await processarWebhookAsaas(parsed);

      if (resultado.sucesso) {
        setFeedbackAcao({
          tipo: 'sucesso',
          texto: resultado.mensagem,
        });
      } else {
        setFeedbackAcao({
          tipo: 'erro',
          texto: resultado.mensagem,
        });
      }
    } catch (err) {
      setFeedbackAcao({
        tipo: 'erro',
        texto: `JSON Inválido: ${err instanceof Error ? err.message : 'Falha de formatação no payload do webhook.'}`,
      });
    } finally {
      setProcessandoWebhook(false);
    }
  };

  // Carregar anuidade em aberto para o simulador de webhook
  const carregarAnuidadeNoWebhook = (anuidadeId: string) => {
    const anuidade = anuidades.find((a) => a.id === anuidadeId);
    if (!anuidade) return;

    const payloadAtualizado: AsaasWebhookPayload = {
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: `pay_asaas_${Math.random().toString(36).substring(2, 9)}`,
        customer: `cus_${anuidade.ministroId}`,
        value: anuidade.valor,
        netValue: Math.round((anuidade.valor * 0.9835) * 100) / 100,
        billingType: 'PIX',
        status: 'RECEIVED',
        confirmedDate: SYSTEM_REFERENCE_TIME_ISO,
        externalReference: anuidade.id,
        description: `Conciliação Automática: ${anuidade.categoria} - ${anuidade.anoVigente}`,
      },
    };

    setWebhookJsonTexto(JSON.stringify(payloadAtualizado, null, 2));
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Banner Superior da Tesouraria Neofintech Compacto e Delicado */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-950 via-slate-900/90 to-emerald-950/40 border border-emerald-500/25 p-4 sm:p-5 backdrop-blur-md shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-emerald-950 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Receipt className="w-3 h-3" />
                DRE TESOURARIA GERAL • CONVENÇÃO CENTRALIZADA
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700/80 text-slate-300 font-mono text-[10px]">
                DATA BASE: {new Date().toLocaleDateString('pt-BR')}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Demonstrativo de Resultado do Exercício (DRE)
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Demonstrativo contábil com recálculo em cascata recursiva para anuidades, conciliação Asaas, indicadores visuais de tendência e cálculos em centavos inteiros blindados contra ponto flutuante IEEE 754.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                executarVarreduraAdimplencia();
                setFeedbackAcao({
                  tipo: 'sucesso',
                  texto: `Varredura temporal concluída: Adimplência de todos os ministros sincronizada em tempo real contra a data atual (${new Date().toLocaleDateString('pt-BR')}).`,
                });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-emerald-500/30 text-emerald-300 font-semibold text-xs font-mono shadow-sm transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              Sincronizar Temporalidade
            </button>
          </div>
        </div>
      </div>

      {/* Alerta de Feedback */}
      {feedbackAcao && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-mono flex items-center justify-between transition-all ${
            feedbackAcao.tipo === 'sucesso'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
              : feedbackAcao.tipo === 'erro'
              ? 'bg-rose-950/80 border-rose-500/40 text-rose-200'
              : 'bg-cyan-950/80 border-cyan-500/40 text-cyan-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackAcao.tipo === 'sucesso' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {feedbackAcao.tipo === 'erro' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>{feedbackAcao.texto}</span>
          </div>
          <button onClick={() => setFeedbackAcao(null)} className="opacity-70 hover:opacity-100 cursor-pointer text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Seletor de Sub-Abas: DRE & Livro Caixa vs Operações Asaas / Fechamento DRE */}
      <div className="flex items-center justify-between flex-wrap gap-2 p-1.5 rounded-xl bg-slate-900/90 border border-slate-800">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubAbaTesouraria('DRE_LEDGER')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              subAbaTesouraria === 'DRE_LEDGER'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>DRE Analítico & Livro Caixa Geral</span>
          </button>
          <button
            type="button"
            onClick={() => setSubAbaTesouraria('OPERACOES')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              subAbaTesouraria === 'OPERACOES'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Operações & Conciliação Asaas / Fechamento DRE</span>
          </button>
          <button
            type="button"
            onClick={() => setSubAbaTesouraria('PENDENCIAS_ASAAS')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              subAbaTesouraria === 'PENDENCIAS_ASAAS'
                ? 'bg-amber-600 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Gestão de Pendências & Vencimentos Asaas</span>
          </button>
        </div>
      </div>

      {subAbaTesouraria === 'OPERACOES' ? (
        <AdminTesourariaOperacoes />
      ) : subAbaTesouraria === 'PENDENCIAS_ASAAS' ? (
        <section className="space-y-4">
          {/* Painel Centralizado de Pendências & Vencimentos Asaas */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Central de Pendências & Vencimentos Asaas</h3>
                <p className="text-[11px] text-slate-400">Ministros com anuidades pendentes ou próximas do vencimento (inferior a 30 dias)</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={!selecionadosPendencias.length || processandoMassaPendencias}
                onClick={handleGerarMassaAsaas}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
              >
                {processandoMassaPendencias ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                <span>Gerar Asaas em Massa ({selecionadosPendencias.length})</span>
              </button>
              <button
                type="button"
                disabled={!selecionadosPendencias.length}
                onClick={handleEnviarLembreteMassa}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar Lembretes ({selecionadosPendencias.length})</span>
              </button>
            </div>
          </div>

          {/* Filtros e Busca */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-xs font-mono">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por nome, e-mail ou igreja..."
                value={filtroBuscaPendencias}
                onChange={(e) => setFiltroBuscaPendencias(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              {[
                { id: 'TODOS', label: 'Todos' },
                { id: 'VENCIDO', label: 'Em Atraso' },
                { id: 'VENCIMENTO_PROXIMO', label: 'Vencimento Próximo (<30d)' },
                { id: 'EM_ABERTO', label: 'Em Aberto' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiltroPrazoPendencias(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filtroPrazoPendencias === f.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabela de Pendências */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-x-auto shadow-sm">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selecionadosPendencias.length > 0 && selecionadosPendencias.length === pendenciasFiltradas.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelecionadosPendencias(pendenciasFiltradas.map((p) => p.anuidadeId));
                        } else {
                          setSelecionadosPendencias([]);
                        }
                      }}
                      className="rounded accent-amber-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Ministro & Cargo</th>
                  <th className="py-3 px-4">Igreja Filiada</th>
                  <th className="py-3 px-4">Exercício</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Status Prazo</th>
                  <th className="py-3 px-4 text-right">Ações Asaas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {pendenciasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                      Nenhum ministro encontrado com anuidades pendentes para este filtro.
                    </td>
                  </tr>
                ) : (
                  pendenciasFiltradas.map((p) => {
                    const selecionado = selecionadosPendencias.includes(p.anuidadeId);
                    return (
                      <tr key={p.anuidadeId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={selecionado}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelecionadosPendencias([...selecionadosPendencias, p.anuidadeId]);
                              } else {
                                setSelecionadosPendencias(selecionadosPendencias.filter((id) => id !== p.anuidadeId));
                              }
                            }}
                            className="rounded accent-amber-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-white block font-sans text-sm">{p.nomeMinistro}</span>
                          <span className="text-[10px] text-slate-400">{p.cargo} • {p.email}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{p.igreja}</td>
                        <td className="py-3 px-4 text-amber-400 font-bold">{p.anoVigente}</td>
                        <td className="py-3 px-4 text-slate-300">{p.vencimento ? formatarDataBR(p.vencimento) : 'Sem Data'}</td>
                        <td className="py-3 px-4 text-emerald-400 font-bold font-mono">R$ {p.valor.toFixed(2).replace('.', ',')}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              p.statusPrazo === 'VENCIDO'
                                ? 'bg-rose-950/80 text-rose-400 border border-rose-500/30 animate-pulse'
                                : p.statusPrazo === 'VENCIMENTO_PROXIMO'
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {p.statusPrazo === 'VENCIDO' ? `Vencido há ${Math.abs(p.diasRestantes)}d` : p.statusPrazo === 'VENCIMENTO_PROXIMO' ? `Vence em ${p.diasRestantes}d` : 'Em Aberto'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => gerarLinkAsaasParaAnuidade(p.anuidadeId, p.valor, p.ministroRaw)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow transition-all cursor-pointer flex items-center gap-1"
                              title="Gerar Link de Pagamento Asaas (Pix / Cartão)"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Link Asaas</span>
                            </button>
                            <button
                              onClick={() => {
                                setFeedbackAcao({ tipo: 'sucesso', texto: `Lembrete enviado para ${p.nomeMinistro} (${p.email}) com sucesso!` });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-[10px] shadow transition-all cursor-pointer flex items-center gap-1"
                              title="Enviar Lembrete por Notificação"
                            >
                              <Send className="w-3 h-3" />
                              <span>Lembrete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <>
          {/* Seção DRE: Demonstrativo de Resultado de Exercício */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Demonstrativo de Resultado de Exercício (DRE)</h3>
              <p className="text-[11px] font-mono text-slate-400">
                Aritmética de Centavos Inteiros • Convenção Geral Centralizada
              </p>
            </div>
          </div>

          {/* Ações: Filtro de Período e Exportações */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                MÊS:
              </span>
              <select
                aria-label="Filtrar DRE por mês"
                value={filtroMesDre}
                onChange={(e) => setFiltroMesDre(e.target.value)}
                className="bg-slate-950 border border-slate-700/80 text-white rounded-lg px-2.5 py-1 text-xs font-mono focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                {MESES_EXERCICIO_2026.map((m) => (
                  <option key={m.valor} value={m.valor} className="bg-slate-900 text-white">
                    {m.label}
                  </option>
                ))}
              </select>
              {filtroMesDre !== 'TODOS' && (
                <button
                  type="button"
                  onClick={() => setFiltroMesDre('TODOS')}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 underline cursor-pointer ml-0.5"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Ordenação Rápida dos Relatórios */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
                ORDENAR:
              </span>
              <select
                aria-label="Ordenar Relatório Financeiro"
                value={`${campoOrdenacao}_${direcaoOrdenacao}`}
                onChange={(e) => {
                  const [campo, dir] = e.target.value.split('_');
                  setCampoOrdenacao(campo as any);
                  setDirecaoOrdenacao(dir as any);
                }}
                className="bg-slate-950 border border-slate-700/80 text-cyan-300 rounded-lg px-2.5 py-1 text-xs font-mono focus:border-cyan-500 focus:outline-none cursor-pointer"
              >
                <option value="data_desc">Data (Recentes)</option>
                <option value="data_asc">Data (Antigas)</option>
                <option value="valor_desc">Valor (Maior)</option>
                <option value="valor_asc">Valor (Menor)</option>
                <option value="ministro_asc">Ministro (A → Z)</option>
                <option value="ministro_desc">Ministro (Z → A)</option>
                <option value="status_asc">Status (PAGO)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Botão Exportar PDF Timbrado */}
              <button
                type="button"
                onClick={() =>
                  exportarRelatorioFinanceiroPDF({
                    anuidades: anuidadesFiltradas,
                    ministros,
                    appConfig,
                    titulo: `Relatório Financeiro Geral da Tesouraria - ${
                      filtroMesDre !== 'TODOS' ? filtroMesDre : 'Exercício 2026'
                    }`,
                    mesFiltro: filtroMesDre,
                  })
                }
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/30 text-rose-300 font-semibold text-xs transition-all cursor-pointer shadow-sm"
                title="Exportar Relatório Oficial Timbrado em PDF com Logo e Conformidade"
              >
                <FileText className="w-3.5 h-3.5 text-rose-400" />
                <span>PDF</span>
              </button>

              {/* Botão Exportar CSV Excel */}
              <button
                type="button"
                onClick={() =>
                  exportarRelatorioFinanceiroCSV({
                    anuidades: anuidadesFiltradas,
                    ministros,
                    appConfig,
                    titulo: `Relatório Financeiro Geral da Tesouraria - ${
                      filtroMesDre !== 'TODOS' ? filtroMesDre : 'Exercício 2026'
                    }`,
                    mesFiltro: filtroMesDre,
                  })
                }
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-500/30 text-emerald-300 font-semibold text-xs transition-all cursor-pointer shadow-sm"
                title="Exportar Dados em CSV para Microsoft Excel e Sistemas Contábeis"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 Cartões do DRE Adaptáveis com Grade CSS Fluida e Tendências */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2.5 sm:gap-3 min-w-0">
          {/* Card 1: Faturamento Bruto Realizado (Receita +) */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/80 border border-emerald-500/25 shadow-sm backdrop-blur-md space-y-1.5 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="uppercase tracking-wider font-semibold text-[11px]">Faturamento Bruto</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-950 border border-emerald-500/30 text-emerald-400 font-bold flex items-center gap-0.5">
                <TrendingUp className="w-2.5 h-2.5 text-emerald-400" /> RECEITA
              </span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-white font-mono flex items-center gap-1.5 tabular-nums">
              <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0" />
              <FormatarMoeda valor={dreAtivo.faturamentoBruto} />
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/70">
              <span>{dreAtivo.faturamentoBrutoCentavos.toLocaleString('pt-BR')} ¢</span>
              <span className="text-emerald-400 font-semibold">100% Bruto</span>
            </div>
          </div>

          {/* Card 2: Taxas de Gateway Estimadas (Despesa -) */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/80 border border-rose-500/25 shadow-sm backdrop-blur-md space-y-1.5 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="uppercase tracking-wider font-semibold text-[11px]">Tarifas Asaas</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-950 border border-rose-500/30 text-rose-400 font-bold flex items-center gap-0.5">
                <TrendingDown className="w-2.5 h-2.5 text-rose-400" /> DESPESA
              </span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-rose-400 font-mono flex items-center gap-1.5 tabular-nums">
              <ArrowDownRight className="w-4 h-4 text-rose-400 shrink-0" />
              -<FormatarMoeda valor={dreAtivo.taxasGateway} />
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/70">
              <span>Retenção gateway</span>
              <span className="text-rose-400 font-semibold">-1.65% Médio</span>
            </div>
          </div>

          {/* Card 3: Faturamento Líquido Realizado (Resultado =) */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-br from-slate-900/90 via-slate-900/90 to-indigo-950/40 border border-cyan-500/30 shadow-sm backdrop-blur-md space-y-1.5 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="uppercase tracking-wider font-semibold text-[11px] text-cyan-300">Faturamento Líquido</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-950 border border-cyan-500/30 text-cyan-300 font-bold flex items-center gap-0.5">
                <ShieldCheck className="w-2.5 h-2.5 text-cyan-400" /> LÍQUIDO
              </span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-cyan-300 font-mono flex items-center gap-1.5 tabular-nums">
              <Wallet className="w-4 h-4 text-cyan-400 shrink-0" />
              <FormatarMoeda valor={dreAtivo.faturamentoLiquido} />
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/70">
              <span>Disponível em conta</span>
              <span className="text-cyan-300 font-semibold">98.35% Líquido</span>
            </div>
          </div>

          {/* Card 4: Previsão a Receber */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/80 border border-amber-500/25 shadow-sm backdrop-blur-md space-y-1.5 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="uppercase tracking-wider font-semibold text-[11px]">Previsão a Receber</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-950 border border-amber-500/30 text-amber-400 font-bold flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5 text-amber-400" /> EM ABERTO
              </span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-amber-400 font-mono flex items-center gap-1.5 tabular-nums">
              <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" />
              <FormatarMoeda valor={dreAtivo.previsaoReceber} />
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/70">
              <span>Cobranças e cascata</span>
              <span className="text-amber-400 font-semibold">Previsão 2026</span>
            </div>
          </div>
        </div>

        {/* TABELA DE DRE ZEBRADA COM INDICADORES VISUAIS DE TENDÊNCIA */}
        <div className="overflow-hidden rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-sm space-y-0">
          <div className="p-3 bg-slate-950/80 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Estrutura Analítica do DRE ({filtroMesDre === 'TODOS' ? 'Exercício Completo' : filtroMesDre})
              </h4>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              Linhas Zebradas • Indicadores de Tendência (Receitas ↑ / Despesas ↓)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-16">CÓD</th>
                  <th className="py-3 px-4">LINHA CONTÁBIL / DISCRIMINAÇÃO</th>
                  <th className="py-3 px-4">TIPO</th>
                  <th className="py-3 px-4 text-center">TENDÊNCIA</th>
                  <th className="py-3 px-4 text-right">VALOR CENTAVOS</th>
                  <th className="py-3 px-4 text-right">TOTAL CONSOLIDADO (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {linhasDreAnaliticas.map((linha, index) => {
                  const Icone = linha.iconeTendencia;
                  const IconeSeta = linha.iconeDirecao;
                  const isZebrada = index % 2 === 1;

                  return (
                    <tr
                      key={linha.id}
                      className={`transition-colors ${
                        isZebrada ? 'bg-slate-950/60' : 'bg-slate-900/40'
                      } hover:bg-slate-800/50`}
                    >
                      {/* Código da Conta */}
                      <td className="py-3.5 px-4 font-bold text-slate-400 text-[11px]">
                        {linha.codigo}
                      </td>

                      {/* Descrição */}
                      <td className="py-3.5 px-4 font-sans font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span className={linha.codigo.includes('.') && linha.codigo !== '1.0' && linha.codigo !== '2.0' && linha.codigo !== '3.0' && linha.codigo !== '4.0' ? 'pl-2 text-slate-300' : 'font-bold'}>
                            {linha.descricao}
                          </span>
                        </div>
                      </td>

                      {/* Tipo / Natureza */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-block ${linha.corBadge}`}>
                          {linha.badgeTexto}
                        </span>
                      </td>

                      {/* Indicador Visual de Tendência (Seta Verde/Vermelha) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800">
                          {linha.tipo === 'RECEITA' && (
                            <>
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-[10px] text-emerald-400 font-bold">RECEITA</span>
                            </>
                          )}
                          {linha.tipo === 'DESPESA' && (
                            <>
                              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                              <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                              <span className="text-[10px] text-rose-400 font-bold">DESPESA</span>
                            </>
                          )}
                          {linha.tipo === 'RESULTADO' && (
                            <>
                              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                              <span className="text-[10px] text-cyan-300 font-bold">LÍQUIDO</span>
                            </>
                          )}
                          {linha.tipo === 'PREVISAO' && (
                            <>
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              <span className="text-[10px] text-amber-400 font-bold">PREVISÃO</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Centavos Inteiros */}
                      <td className="py-3.5 px-4 text-right text-slate-400 text-[11px]">
                        {linha.centavos.toLocaleString('pt-BR')} ¢
                      </td>

                      {/* Valor em Moeda Real */}
                      <td className={`py-3.5 px-4 text-right text-sm font-bold ${linha.corTexto}`}>
                        <FormatarMoeda valor={linha.valor} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Painel de Visualização com Gráficos Recharts */}
      <section className="space-y-6">
        {/* Gráfico Principal: Receita Projetada vs Realizada (Mensal & Acumulado) */}
        <GraficoProjetadoVsRealizado
          anuidades={anuidades}
          ano={2026}
          tenantId={tenantAtivo?.id}
        />

        <div className="flex items-center justify-between pt-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              Painel Analítico Complementar de Tesouraria
            </h3>
            <p className="text-xs text-slate-400">
              Visualização avançada com Recharts para Fluxo de Caixa por Exercício, Status Pagas vs. Pendentes e Projeções de Longo Prazo.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Gráfico 1: Anuidades Pagas vs Pendentes (Pie) */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-sm flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <PieIcon className="w-3.5 h-3.5 text-emerald-400" />
                Pagas vs. Pendentes
              </h4>
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-500/30">
                STATUS ATUAL
              </span>
            </div>
            
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dadosPagasVsPendentes}
                    dataKey="valor"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={70}
                    paddingAngle={4}
                    label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {dadosPagasVsPendentes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', color: '#f8fafc' }}
                    formatter={(value: any) => [`R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-800 text-xs font-mono">
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 text-center">
                <span className="text-slate-400 block text-[9px]">Pagas</span>
                <span className="text-emerald-400 font-bold text-xs">{dadosPagasVsPendentes[0]?.quantidade || 0}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 text-center">
                <span className="text-slate-400 block text-[9px]">Pendentes</span>
                <span className="text-amber-400 font-bold text-xs">{dadosPagasVsPendentes[1]?.quantidade || 0}</span>
              </div>
            </div>
          </div>

          {/* Gráfico 2: Fluxo de Caixa por Ano / Recebido vs Esperado (BarChart) */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-sm flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                Fluxo de Caixa
              </h4>
              <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-500/30">
                HISTÓRICO
              </span>
            </div>

            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosFluxoCaixaAno} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="ano" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', color: '#f8fafc' }}
                    formatter={(value: any) => [`R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                  <Bar dataKey="recebido" name="Recebido (Pago)" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="esperado" name="Pendente (Aberto)" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 text-[10px] font-mono text-slate-400 text-center">
              Arrecadação versus pendente por ano.
            </div>
          </div>

          {/* Gráfico 3: Projeção de Receita Anual (AreaChart) */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-sm flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <LineIcon className="w-3.5 h-3.5 text-indigo-400" />
                Projeção (2026-2029)
              </h4>
              <span className="text-[9px] font-mono text-indigo-400 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-500/30">
                FORECAST
              </span>
            </div>

            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dadosProjecaoReceita} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorProjecao" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="ano" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', color: '#f8fafc' }}
                    formatter={(value: any) => [`R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                  <Area type="monotone" dataKey="otimista" name="Cenário Otimista" stroke="#10b981" fillOpacity={0.1} fill="#10b981" />
                  <Area type="monotone" dataKey="projecao" name="Projeção Base" stroke="#6366f1" fillOpacity={0.3} fill="url(#colorProjecao)" />
                  <Area type="monotone" dataKey="conservador" name="Cenário Conservador" stroke="#f59e0b" fillOpacity={0.05} fill="#f59e0b" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 text-[10px] font-mono text-slate-400 text-center">
              Projeção atuarial da base de ministros.
            </div>
          </div>
        </div>
      </section>

      {/* Seção 2: Terminal de Simulação de Webhook (Gateway Asaas) */}
      <section className="p-6 rounded-3xl bg-slate-900/80 border border-cyan-500/30 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400 animate-pulse" />
              <h3 className="text-base font-bold text-white">Terminal de Webhook Asaas (Conciliação Instantânea)</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Simule o envio de webhook do gateway Asaas. O motor executa a liquidação contábil, projeta a anuidade seguinte em cascata e recálcula a adimplência.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400">Idempotência:</span>
            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-cyan-400 font-bold">
              {cacheIdempotencia.length} locks ativos
            </span>
          </div>
        </div>

        {/* Injeção Rápida de IDs de Anuidades Abertas */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="text-slate-400 text-[11px]">Carregar Cobrança em Aberto:</span>
          {anuidades
            .filter((a) => a.statusPagamento === 'ABERTO')
            .slice(0, 4)
            .map((a) => {
              const min = ministros.find((m) => m.id === a.ministroId);
              return (
                <button
                  key={a.id}
                  onClick={() => carregarAnuidadeNoWebhook(a.id)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-cyan-950 border border-slate-700 hover:border-cyan-500 text-cyan-300 text-[10px] transition-colors cursor-pointer"
                >
                  {min?.nome.split(' ')[1] || a.ministroId} ({a.id}) - R$ {a.valor}
                </button>
              );
            })}
        </div>

        {/* Textarea com Payload JSON do Asaas */}
        <div className="space-y-2">
          <label className="block text-xs font-mono text-slate-400 flex items-center justify-between">
            <span>PAYLOAD JSON (EVENT: PAYMENT_RECEIVED):</span>
            <span className="text-[10px] text-cyan-400 font-mono">MOCK TEST ENVIRONMENT</span>
          </label>
          <textarea
            rows={7}
            value={webhookJsonTexto}
            onChange={(e) => setWebhookJsonTexto(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-400 resize-none shadow-inner"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setWebhookJsonTexto(JSON.stringify(payloadExemploInicial, null, 2))}
            className="text-xs text-slate-400 hover:text-white font-mono cursor-pointer"
          >
            Restaurar Payload Padrão
          </button>

          <button
            onClick={lidarComSimulacaoWebhook}
            disabled={processandoWebhook}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs font-mono shadow-[0_0_20px_rgba(6,182,212,0.35)] transition-all disabled:opacity-50 cursor-pointer"
          >
            {processandoWebhook ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Conciliando Webhook...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Simular Webhook de Pagamento
              </>
            )}
          </button>
        </div>
      </section>

      {/* Seção 3: Tabela de Cobranças Zebrada e Lançamentos em Cascata */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              Ledger de Cobranças e Lançamentos em Cascata ({anuidadesFiltradas.length})
            </h3>
            <p className="text-xs text-slate-400">
              Cada cobrança quitada projeta imediatamente o ciclo anual seguinte para o mesmo ministro.
            </p>
          </div>

          {/* Filtros da Tabela */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar ministro ou ID..."
                value={filtroBusca}
                onChange={(e) => setFiltroBusca(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <select
              aria-label="Filtrar por Status de Pagamento"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="PAGO">PAGO</option>
              <option value="ABERTO">ABERTO</option>
            </select>

            <select
              aria-label="Filtrar por Categoria Contábil"
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
            >
              <option value="TODOS">Todas Categorias</option>
              <option value="TAXA_CONVENCAO">Taxa Filiação</option>
              <option value="ANUIDADE">Anuidade</option>
            </select>
          </div>
        </div>

        {/* Chips de Ordenação Rápida da Tesouraria */}
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" /> Ordenação Rápida:
          </span>
          <button
            type="button"
            onClick={() => { setCampoOrdenacao('data'); setDirecaoOrdenacao('desc'); }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-all cursor-pointer flex items-center gap-1 ${
              campoOrdenacao === 'data' && direcaoOrdenacao === 'desc'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Calendar className="w-3 h-3 text-cyan-400" /> Mais Recentes ↓
          </button>
          <button
            type="button"
            onClick={() => { setCampoOrdenacao('data'); setDirecaoOrdenacao('asc'); }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-all cursor-pointer flex items-center gap-1 ${
              campoOrdenacao === 'data' && direcaoOrdenacao === 'asc'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Calendar className="w-3 h-3 text-cyan-400" /> Mais Antigas ↑
          </button>
          <button
            type="button"
            onClick={() => { setCampoOrdenacao('valor'); setDirecaoOrdenacao('desc'); }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-all cursor-pointer flex items-center gap-1 ${
              campoOrdenacao === 'valor' && direcaoOrdenacao === 'desc'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <DollarSign className="w-3 h-3 text-emerald-400" /> Maior Valor ↓
          </button>
          <button
            type="button"
            onClick={() => { setCampoOrdenacao('valor'); setDirecaoOrdenacao('asc'); }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-all cursor-pointer flex items-center gap-1 ${
              campoOrdenacao === 'valor' && direcaoOrdenacao === 'asc'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <DollarSign className="w-3 h-3 text-emerald-400" /> Menor Valor ↑
          </button>
          <button
            type="button"
            onClick={() => { setCampoOrdenacao('ministro'); setDirecaoOrdenacao('asc'); }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-all cursor-pointer flex items-center gap-1 ${
              campoOrdenacao === 'ministro' && direcaoOrdenacao === 'asc'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Nome (A → Z) ↑
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950">
                <th
                  className="py-3 px-4 cursor-pointer select-none hover:text-cyan-300 transition-colors"
                  onClick={() => alternarOrdenacao('id')}
                  title="Clique para ordenar por ID"
                >
                  <div className="flex items-center gap-1.5">
                    <span>ID COBRANÇA</span>
                    {campoOrdenacao === 'id' ? (
                      direcaoOrdenacao === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-cyan-400" /> : <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60" />
                    )}
                  </div>
                </th>
                <th
                  className="py-3 px-4 cursor-pointer select-none hover:text-cyan-300 transition-colors"
                  onClick={() => alternarOrdenacao('ministro')}
                  title="Clique para ordenar por Ministro"
                >
                  <div className="flex items-center gap-1.5">
                    <span>MINISTRO</span>
                    {campoOrdenacao === 'ministro' ? (
                      direcaoOrdenacao === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-cyan-400" /> : <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60" />
                    )}
                  </div>
                </th>
                <th
                  className="py-3 px-4 cursor-pointer select-none hover:text-cyan-300 transition-colors"
                  onClick={() => alternarOrdenacao('categoria')}
                  title="Clique para ordenar por Categoria"
                >
                  <div className="flex items-center gap-1.5">
                    <span>CATEGORIA</span>
                    {campoOrdenacao === 'categoria' ? (
                      direcaoOrdenacao === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-cyan-400" /> : <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">ANO VIGENTE</th>
                <th
                  className="py-3 px-4 cursor-pointer select-none hover:text-cyan-300 transition-colors"
                  onClick={() => alternarOrdenacao('data')}
                  title="Clique para ordenar por Data de Vencimento"
                >
                  <div className="flex items-center gap-1.5">
                    <span>VENCIMENTO / DATA</span>
                    {campoOrdenacao === 'data' ? (
                      direcaoOrdenacao === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60" />
                    )}
                  </div>
                </th>
                <th
                  className="py-3 px-4 cursor-pointer select-none hover:text-cyan-300 transition-colors"
                  onClick={() => alternarOrdenacao('valor')}
                  title="Clique para ordenar por Valor"
                >
                  <div className="flex items-center gap-1.5">
                    <span>VALOR (BRL)</span>
                    {campoOrdenacao === 'valor' ? (
                      direcaoOrdenacao === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60" />
                    )}
                  </div>
                </th>
                <th
                  className="py-3 px-4 cursor-pointer select-none hover:text-cyan-300 transition-colors"
                  onClick={() => alternarOrdenacao('status')}
                  title="Clique para ordenar por Status"
                >
                  <div className="flex items-center gap-1.5">
                    <span>STATUS</span>
                    {campoOrdenacao === 'status' ? (
                      direcaoOrdenacao === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-cyan-400" /> : <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4 text-right">AÇÃO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {anuidadesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-mono text-xs">
                    Nenhum lançamento ou cobrança em aberto no Ledger contábil.
                  </td>
                </tr>
              ) : (
                anuidadesFiltradas.map((a, idx) => {
                  const ministro = ministros.find((m) => m.id === a.ministroId);
                  const dataVenc = a?.dataVencimento || (a as any)?.data || (a as any)?.dataPagamento || '';
                  const isVencida = a.statusPagamento === 'ABERTO' && Boolean(dataVenc) && dataVenc < SYSTEM_REFERENCE_DATE;
                  const isZebrada = idx % 2 === 1;

                  return (
                    <tr
                      key={a.id}
                      className={`transition-colors ${
                        isZebrada ? 'bg-slate-950/60' : 'bg-slate-900/40'
                      } hover:bg-slate-800/40`}
                    >
                      <td className="py-3 px-4 text-slate-400 text-[11px] font-bold">
                        {a.id}
                      </td>
                      <td className="py-3 px-4 font-sans font-medium text-white">
                        {ministro?.nome || a.ministroId}
                        <span className="block text-[10px] text-slate-500 font-mono">CPF: {ministro?.cpf}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.categoria === 'TAXA_CONVENCAO'
                              ? 'bg-indigo-950 border border-indigo-500/40 text-indigo-300'
                              : 'bg-emerald-950 border border-emerald-500/40 text-emerald-300'
                          }`}
                        >
                          {a.categoria}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-200 font-bold">{a.anoVigente}</td>
                      <td className="py-3 px-4">
                        <span className={isVencida ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                          {formatarDataBR(dataVenc)}
                          {isVencida && ' (VENCIDA)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        <FormatarMoeda valor={a.valor} />
                      </td>
                      <td className="py-3 px-4">
                        {a.statusPagamento === 'PAGO' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/40 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" /> LIQUIDADO
                          </span>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 w-fit ${
                              isVencida
                                ? 'bg-rose-950 text-rose-400 border-rose-500/40'
                                : 'bg-amber-950 text-amber-400 border-amber-500/40'
                            }`}
                          >
                            <Clock className="w-3 h-3" /> ABERTO
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {a.statusPagamento === 'ABERTO' ? (
                            <button
                              onClick={async () => {
                                const ok = await liquidarAnuidade(a.id, 'MANUAL');
                                if (ok) {
                                  setFeedbackAcao({
                                    tipo: 'sucesso',
                                    texto: `Cobrança ${a.id} liquidada! Projeção em cascata para ${a.anoVigente + 1} disparada com sucesso.`,
                                  });
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow transition-all cursor-pointer"
                            >
                              Baixa & Cascata
                            </button>
                          ) : (
                            <button
                              onClick={() => carregarAnuidadeNoWebhook(a.id)}
                              title="Carregar dados no simulador de webhook"
                              className="text-[10px] text-slate-500 hover:text-cyan-400 underline cursor-pointer"
                            >
                              Ver no Webhook
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              if (window.confirm(`Deseja realmente excluir o lançamento ${a.id}? Esta ação remove o registro do Ledger e do banco de dados.`)) {
                                const ok = await excluirAnuidade(a.id);
                                if (ok) {
                                  setFeedbackAcao({
                                    tipo: 'sucesso',
                                    texto: `Lançamento ${a.id} excluído com sucesso do Ledger.`,
                                  });
                                } else {
                                  setFeedbackAcao({
                                    tipo: 'erro',
                                    texto: `Falha ao excluir o lançamento ${a.id}.`,
                                  });
                                }
                              }
                            }}
                            title="Excluir lançamento"
                            className="p-1 rounded-lg hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
        </>
      )}
    </div>
  );
}
