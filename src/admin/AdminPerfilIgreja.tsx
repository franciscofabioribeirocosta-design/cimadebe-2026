import React, { useState, useMemo, useRef } from 'react';
import { formatarDataBR } from '../financialEngine';
import {
  Building2,
  ArrowLeft,
  FileText,
  MapPin,
  Mail,
  Phone,
  Calendar,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Users,
  Edit3,
  DollarSign,
  Eye,
  ExternalLink,
  Plus,
  BadgeCheck,
  ShoppingBag,
  CheckSquare,
  Square,
  CreditCard,
  QrCode,
  Copy,
  Printer,
  Download,
  Check,
  Trash2,
  Clock,
  Receipt,
  Sparkles,
  Search,
  Filter,
  ArrowRight,
  UserCheck,
  UserX,
  AlertCircle,
} from 'lucide-react';
import { useSecurity } from '../SecurityContext';
import { useNotification } from '../NotificationContext';
import { gerarPdfReciboPagamentoMinistro } from '../services/pdfExportService';
import { SYSTEM_REFERENCE_DATE, SYSTEM_REFERENCE_TIME_ISO, SYSTEM_REFERENCE_YEAR, getSystemYear, formatarRotuloStatus, obterBadgeClassStatus } from '../financialEngine';
import { AdimplenciaBadge } from '../components/AdimplenciaBadge';
import type { IgrejaFiliada, Ministro, AnuidadeMinistro } from '../types';

interface AdminPerfilIgrejaProps {
  readonly igrejaId: string;
  readonly onVoltar: () => void;
  readonly onSelecionarMinistro?: (ministroId: string) => void;
}

type AbaPerfil = 'cnpj' | 'ministros' | 'sacola';
type MetodoPagamento = 'PIX' | 'BOLETO' | 'CARTAO';

export function AdminPerfilIgreja({
  igrejaId,
  onVoltar,
  onSelecionarMinistro,
}: AdminPerfilIgrejaProps) {
  const {
    igrejasFiliadas,
    ministros,
    anuidades,
    liquidarAnuidade,
    registrarAnuidade,
    addAuditLog,
    appConfig,
    tenantAtivoId,
  } = useSecurity();
  const { notifySuccess, notifyError } = useNotification();

  // Aba ativa
  const [abaAtiva, setAbaAtiva] = useState<AbaPerfil>('cnpj');

  // Filtros da listagem de ministros
  const [buscaMinistro, setBuscaMinistro] = useState('');
  const [filtroStatusAdimplencia, setFiltroStatusAdimplencia] = useState<'TODOS' | 'PENDENTES' | 'ADIMPLENTES'>('TODOS');
  const [filtroCargo, setFiltroCargo] = useState('TODOS');

  // Sacola de Anuidades (IDs dos ministros selecionados)
  const [ministrosSelecionadosIds, setMinistrosSelecionadosIds] = useState<string[]>([]);
  const [metodoPagamento, setMetodoPagamento] = useState<MetodoPagamento>('PIX');
  const [parcelasCartao, setParcelasCartao] = useState<number>(1);
  const [chaveCopiada, setChaveCopiada] = useState(false);
  const [processandoPagamento, setProcessandoPagamento] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro' | 'info'; texto: string } | null>(null);

  // Modal de Comprovante de Quitação Unificada
  const [comprovanteModalAberto, setComprovanteModalAberto] = useState(false);
  const [dadosComprovante, setDadosComprovante] = useState<{
    reciboId: string;
    igrejaNome: string;
    igrejaCnpj: string;
    dataHora: string;
    ministrosQuitados: Array<{ id: string; nome: string; cpf: string; cargo: string; valor: number }>;
    totalPago: number;
    metodo: string;
    hashAutenticacao: string;
  } | null>(null);

  // Localiza a igreja
  const igreja = useMemo(() => {
    return igrejasFiliadas.find((i) => i.id === igrejaId);
  }, [igrejasFiliadas, igrejaId]);

  // Ministros vinculados a esta igreja
  const ministrosVinculados = useMemo(() => {
    if (!igreja) return [];
    return ministros.filter((m) => {
      if (!m) return false;
      const minIgrejaNome = (m.igrejaFiliadaNome || '').toLowerCase().trim();
      const igrejaNome = (igreja.nomeFantasia || '').toLowerCase().trim();
      const minNome = (m.nome || '').toLowerCase().trim();
      const pastorNome = (igreja.pastorPresidenteNome || '').toLowerCase().trim();
      const minCidade = (m.dadosEndereco?.cidade || '').toLowerCase().trim();
      const igrejaCidade = (igreja.municipio || '').toLowerCase().trim();

      return (
        (m.igrejaFiliadaId && m.igrejaFiliadaId === igreja.id) ||
        (minIgrejaNome.length > 0 && igrejaNome.length > 0 && minIgrejaNome === igrejaNome) ||
        (igreja.pastorPresidenteId && m.id === igreja.pastorPresidenteId) ||
        (minNome.length > 0 && pastorNome.length > 0 && minNome.includes(pastorNome)) ||
        (minCidade.length > 0 && igrejaCidade.length > 0 && minCidade === igrejaCidade)
      );
    });
  }, [ministros, igreja]);

  // Informações de taxa / anuidade inadimplente de cada ministro vinculado
  const ministrosComAnuidades = useMemo(() => {
    const valorPadraoAnuidade = appConfig?.taxaAnuidadeRecorrente || 120.0;
    const anoAtual = getSystemYear();
    const hoje = new Date().toISOString().split('T')[0];

    return ministrosVinculados.map((m) => {
      const anuidadesDoMin = anuidades.filter((a) => a.ministroId === m.id);
      
      // Busca anuidade efetivamente inadimplente (status ATRASADO, ATRASADA ou INADIMPLENTE) - SEM PENDENTES / ABERTOS
      const anuidadeInadimplente = anuidadesDoMin.find((a) => {
        const st = (a.statusPagamento || '').trim().toUpperCase();
        return (
          st === 'ATRASADO' ||
          st === 'ATRASADA' ||
          st === 'INADIMPLENTE'
        );
      });

      const statusMin = (m.statusAdimplencia || '').trim().toUpperCase();
      const ehInadimplente =
        statusMin === 'INADIMPLENTE' ||
        statusMin === 'EM_ATRASO' ||
        Boolean(anuidadeInadimplente);

      // Identifica com precisão se é Taxa de Filiação Inicial ou Anuidade Recorrente
      const ehFiliacao = Boolean(
        anuidadeInadimplente?.id.startsWith('an-fil-') ||
        anuidadeInadimplente?.categoria === 'TAXA_CONVENCAO' ||
        (!anuidadesDoMin.some((a) => a.statusPagamento === 'PAGO') && (statusMin === 'EM_ATRASO' || statusMin === 'INADIMPLENTE'))
      );

      const cargoMin = (m.cargo || '').toLowerCase();
      const isMissionaria = cargoMin.includes('missionar');
      const valorFiliacaoPadrao = isMissionaria
        ? Number(appConfig?.taxaFiliacaoMissionaria || 120.0)
        : Number(appConfig?.taxaFiliacaoMinistro || 190.0);

      const valor = anuidadeInadimplente
        ? Number(anuidadeInadimplente.valor)
        : (ehFiliacao ? valorFiliacaoPadrao : valorPadraoAnuidade);

      const anuidadeId = anuidadeInadimplente ? anuidadeInadimplente.id : null;
      const anoReferencia = anuidadeInadimplente ? anuidadeInadimplente.anoVigente : (m.dataFiliacao ? parseInt(m.dataFiliacao.split('-')[0], 10) : anoAtual);
      const tipoCobrancaRotulo = ehFiliacao ? 'Taxa de Filiação' : `Anuidade ${anoReferencia}`;

      return {
        ...m,
        ehPendente: ehInadimplente,
        ehFiliacao,
        tipoCobrancaRotulo,
        valorAnuidade: valor,
        anuidadeId,
        anoReferencia,
      };
    });
  }, [ministrosVinculados, anuidades, appConfig]);

  // Ministros pendentes vinculados
  const ministrosPendentes = useMemo(() => {
    return ministrosComAnuidades.filter((m) => m.ehPendente);
  }, [ministrosComAnuidades]);

  // Ministros selecionados na sacola
  const ministrosNaSacola = useMemo(() => {
    return ministrosComAnuidades.filter((m) => ministrosSelecionadosIds.includes(m.id) && m.ehPendente);
  }, [ministrosComAnuidades, ministrosSelecionadosIds]);

  // Total da sacola em Reais
  const totalSacola = useMemo(() => {
    return ministrosNaSacola.reduce((acc, m) => acc + m.valorAnuidade, 0);
  }, [ministrosNaSacola]);

  // Ministros filtrados para a tabela
  const ministrosFiltrados = useMemo(() => {
    return ministrosComAnuidades.filter((m) => {
      // Filtro de texto (nome, cpf, cargo)
      const termo = (buscaMinistro || '').toLowerCase().trim();
      const nomeNorm = (m.nome || '').toLowerCase();
      const cpfNorm = String(m.cpf || '');
      const cargoNorm = (m.cargo || '').toLowerCase();

      const bateTexto =
        !termo ||
        nomeNorm.includes(termo) ||
        cpfNorm.includes(termo) ||
        cargoNorm.includes(termo);

      if (!bateTexto) return false;

      // Filtro por cargo
      if (filtroCargo !== 'TODOS' && m.cargo !== filtroCargo) return false;

      // Filtro por adimplência
      if (filtroStatusAdimplencia === 'PENDENTES' && !m.ehPendente) return false;
      if (filtroStatusAdimplencia === 'ADIMPLENTES' && m.ehPendente) return false;

      return true;
    });
  }, [ministrosComAnuidades, buscaMinistro, filtroCargo, filtroStatusAdimplencia]);

  // Alternar seleção de um ministro
  const alternarSelecaoMinistro = (ministroId: string) => {
    const min = ministrosComAnuidades.find((m) => m.id === ministroId);
    if (!min || !min.ehPendente) return; // Apenas pendentes podem ser selecionados

    setMinistrosSelecionadosIds((anteriores) => {
      if (anteriores.includes(ministroId)) {
        return anteriores.filter((id) => id !== ministroId);
      } else {
        return [...anteriores, ministroId];
      }
    });
  };

  // Selecionar todos os ministros pendentes
  const selecionarTodosPendentes = () => {
    const pendentesIds = ministrosPendentes.map((m) => m.id);
    setMinistrosSelecionadosIds(pendentesIds);
    setFeedback({
      tipo: 'info',
      texto: `${pendentesIds.length} ministro(s) pendente(s) adicionado(s) à sacola!`,
    });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Limpar sacola
  const limparSacola = () => {
    setMinistrosSelecionadosIds([]);
  };

  // Copiar chave Pix
  const copiarChavePix = () => {
    const chave = `00020126580014br.gov.bcb.pix0136tesouraria@cimadebe.org.br520400005303986540${totalSacola.toFixed(2)}5802BR5925CIMADEBE ESTADUAL SALVADOR6009SALVADOR62070503***6304`;
    navigator.clipboard.writeText(chave);
    setChaveCopiada(true);
    setTimeout(() => setChaveCopiada(false), 3000);
  };

  // Executar liquidação unificada da sacola
  const efetuarPagamentoSacola = async () => {
    if (ministrosNaSacola.length === 0 || totalSacola <= 0) {
      setFeedback({ tipo: 'erro', texto: 'A sacola está vazia ou sem ministros pendentes.' });
      return;
    }

    setProcessandoPagamento(true);

    try {
      const listaQuitados: Array<{ id: string; nome: string; cpf: string; cargo: string; valor: number }> = [];

      for (const m of ministrosNaSacola) {
        let anuidadeId = m.anuidadeId;

        // Se não tiver anuidade aberta cadastrada explicitamente, registra uma antes
        if (!anuidadeId) {
          const anoAtual = new Date().getFullYear();
          const nova = await registrarAnuidade({
            ministroId: m.id,
            tenantId: m.tenantId || tenantAtivoId,
            anoVigente: m.anoReferencia || anoAtual,
            dataVencimento: `${anoAtual}-12-31`,
            valor: m.valorAnuidade,
            statusPagamento: 'ABERTO',
            tipo: 'RECEITA',
            categoria: m.ehFiliacao ? 'TAXA_CONVENCAO' : 'ANUIDADE',
          });
          anuidadeId = nova.id;
        }

        // Liquida a anuidade
        if (anuidadeId) {
          await liquidarAnuidade(anuidadeId, 'MANUAL');
        }

        listaQuitados.push({
          id: m.id,
          nome: m.nome,
          cpf: m.cpf,
          cargo: m.cargo,
          valor: m.valorAnuidade,
        });
      }

      // Hash de autenticação contábil
      const reciboId = `REC-SAC-${Date.now().toString().slice(-6)}`;
      const hashAutenticacao = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();

      const metodoFormatado =
        metodoPagamento === 'CARTAO'
          ? `Cartão de Crédito (${parcelasCartao}x de R$ ${(totalSacola / parcelasCartao).toFixed(2)})`
          : metodoPagamento === 'PIX'
          ? 'PIX Instantâneo'
          : 'Boleto Bancário';

      const ehIgrejaSuspensa = igreja?.status === 'SUSPENSA';

      addAuditLog(
        'ANUIDADE_LIQUIDADA',
        ehIgrejaSuspensa
          ? `Quitação e Congelamento de Débitos (Acordo de Congregação Desabilitada): ${listaQuitados.length} valores quitados via ${metodoFormatado} para a Igreja [${igreja?.nomeFantasia}]. Total R$ ${totalSacola.toFixed(2)}. Congelamento e liquidação do passivo consumados no Ledger. Recibo: ${reciboId}`
          : `Pagamento Coletivo da Sacola: ${listaQuitados.length} anuidade(s) liquidada(s) via ${metodoFormatado} para a Igreja [${igreja?.nomeFantasia}]. Total R$ ${totalSacola.toFixed(2)}. Recibo: ${reciboId}`,
        tenantAtivoId
      );

      // Dados para o comprovante
      setDadosComprovante({
        reciboId,
        igrejaNome: igreja?.nomeFantasia || 'Igreja Filiada',
        igrejaCnpj: igreja?.cnpj || '',
        dataHora: new Date().toLocaleString('pt-BR'),
        ministrosQuitados: listaQuitados,
        totalPago: totalSacola,
        metodo: metodoFormatado,
        hashAutenticacao,
      });

      // Limpa sacola e abre modal de comprovante
      setMinistrosSelecionadosIds([]);
      setComprovanteModalAberto(true);
      setFeedback({
        tipo: 'sucesso',
        texto: `Pagamento coletivo de R$ ${totalSacola.toFixed(2)} liquidado com sucesso para ${listaQuitados.length} ministro(s)!`,
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback({
        tipo: 'erro',
        texto: `Erro ao processar quitação coletiva: ${err.message || 'Falha contábil'}`,
      });
    } finally {
      setProcessandoPagamento(false);
    }
  };

  if (!igreja) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">Igreja Filiada não localizada</h3>
        <p className="text-xs text-slate-400">O registro pode ter sido excluído ou não existe.</p>
        <button
          onClick={onVoltar}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Igrejas Filiadas</span>
        </button>
      </div>
    );
  }

  const ehAtiva = igreja.status === 'ATIVA';

  return (
    <div className="space-y-6 animate-fadeIn pb-24 max-w-full">
      {/* Top Header & Navegação de Retorno */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onVoltar}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all shadow-md cursor-pointer w-fit"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
          <span>Voltar para Lista de Igrejas Filiadas</span>
        </button>

        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-mono font-bold border flex items-center gap-1.5 ${
              ehAtiva
                ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                : 'bg-rose-950 text-rose-400 border-rose-500/40'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${ehAtiva ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}
            />
            FILIADA {igreja.status}
          </span>
        </div>
      </div>

      {/* Banner de Suspensão da Igreja e Painel de Valores Inadimplentes Congelados para Negociação */}
      {igreja.status === 'SUSPENSA' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-950/90 border border-rose-500/60 text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs shadow-xl">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <strong className="text-white block font-sans text-sm">IGREJA FILIADA SUSPENSA / DESABILITADA</strong>
                <span>Todos os ministros vinculados a esta congregação foram automaticamente desabilitados em cadeia.</span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-rose-900 border border-rose-400 text-[10px] font-bold text-white uppercase shrink-0 w-fit">
              CONGREGAÇÃO SUSPENSA
            </span>
          </div>

          {/* PAINEL VISÍVEL: VALORES PENDENTES PARA NEGOCIAÇÃO (APENAS INADIMPLENTES) */}
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/80 border-2 border-cyan-500/50 shadow-2xl space-y-4 font-mono">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/10">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold tracking-widest text-cyan-300 bg-cyan-950 px-2.5 py-0.5 rounded-full border border-cyan-500/40">
                      VALORES PENDENTES P/ NEGOCIAÇÃO
                    </span>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                      APENAS INADIMPLENTES
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-1 font-sans">
                    Pendências Financeiras da Congregação Desabilitada
                  </h3>
                </div>
              </div>

              <div className="text-left sm:text-right bg-slate-950/80 p-3 sm:p-0 sm:bg-transparent rounded-xl border sm:border-0 border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Inadimplente Pendente</span>
                <span className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono tracking-tight">
                  R$ {ministrosPendentes.reduce((acc, m) => acc + (m.valorAnuidade || 0), 0).toFixed(2)}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              Os valores abaixo correspondem estritamente às taxas e anuidades em atraso dos ministros desta igreja. <strong>O processo de congelamento definitivo e liquidação contábil ocorre estritamente APÓS o pagamento</strong> (e não antes). Apenas nesta ocasião especial de regularização de igreja desabilitada, a forma de pagamento é aceita via <strong>PIX</strong> ou <strong>Cartão de Crédito em até 6x</strong>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Ministros com Pendência</span>
                <span className="text-base font-bold text-amber-400 font-mono">{ministrosPendentes.length} ministro(s) inadimplente(s)</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Momento do Congelamento</span>
                <span className="text-xs font-bold text-cyan-300">Congela no Ledger Após Pagamento</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Formas de Pagamento Permitidas</span>
                <span className="text-xs font-bold text-emerald-400">PIX ou Cartão em até 6x</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Banner Principal de Identificação da Igreja */}
      <div className={`p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 shadow-2xl relative overflow-hidden ${igreja.status === 'SUSPENSA' ? 'border-rose-900/70' : ''}`}>
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <img
              src={igreja.logoUrl || 'https://images.unsplash.com/photo-1548625361-195fe578cb66?auto=format&fit=crop&w=300&h=300&q=80'}
              alt={igreja.nomeFantasia}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-slate-700 shadow-2xl bg-slate-950 shrink-0"
            />

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">
                  FILIADA CIMADEBE
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  FILIAÇÃO: {formatarDataBR(igreja.dataFiliacao)}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {igreja.nomeFantasia}
              </h1>

              <p className="text-xs text-slate-400 font-mono">
                Razão Social: <span className="text-slate-200 font-bold">{igreja.razaoSocial}</span>
              </p>

              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold pt-0.5">
                <BadgeCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Pastor Responsável: {igreja.pastorPresidenteNome}</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-1 w-full lg:w-auto min-w-[220px] text-xs font-mono">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">CNPJ Oficial</span>
            <span className="text-sm sm:text-base font-bold text-white block">{igreja.cnpj}</span>
            <span className="text-[11px] text-emerald-400 block font-bold">
              Situação na RFB: {igreja.situacaoCadastral}
            </span>
            <span className="text-[10px] text-slate-400 block pt-1 border-t border-slate-800/80">
              {igreja.municipio} / {igreja.uf}
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold animate-fadeIn ${
            feedback.tipo === 'sucesso'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
              : feedback.tipo === 'erro'
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-300'
              : 'bg-indigo-950/90 border-indigo-500/50 text-indigo-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.tipo === 'sucesso' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : feedback.tipo === 'erro' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            )}
            <span>{feedback.texto}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABAS DE NAVEGAÇÃO SUPERIOR DO PERFIL */}
      {/* ======================================================== */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        {/* Aba 1: Cartão CNPJ */}
        <button
          onClick={() => setAbaAtiva('cnpj')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            abaAtiva === 'cnpj'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Cartão CNPJ & Dados Cadastrais</span>
        </button>

        {/* Aba 2: Ministros da Igreja */}
        <button
          onClick={() => setAbaAtiva('ministros')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            abaAtiva === 'ministros'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Listar Ministros da Igreja</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              abaAtiva === 'ministros'
                ? 'bg-slate-950 text-emerald-400'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {ministrosVinculados.length}
          </span>
          {ministrosPendentes.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500 text-slate-950">
              {ministrosPendentes.length} pendente(s)
            </span>
          )}
        </button>

        {/* Aba 3: Sacola de Regularização */}
        <button
          onClick={() => setAbaAtiva('sacola')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer relative ${
            abaAtiva === 'sacola'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900/80 text-indigo-400 hover:text-indigo-200 hover:bg-slate-800 border border-indigo-500/30'
          }`}
        >
          <ShoppingBag className="w-4 h-4 text-amber-400" />
          <span>Sacola de Regularização</span>
          {ministrosNaSacola.length > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400 text-slate-950 animate-bounce">
              {ministrosNaSacola.length} (R$ {totalSacola.toFixed(2)})
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-400">
              0
            </span>
          )}
        </button>
      </div>

      {/* ======================================================== */}
      {/* CONTEÚDO DA ABA 1: CARTÃO CNPJ OFICIAL & FICHA CADASTRAL */}
      {/* ======================================================== */}
      {abaAtiva === 'cnpj' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                Cartão Oficial do CNPJ da Igreja Filiada
              </h2>
              <p className="text-xs text-slate-400">
                Comprovante de Inscrição e de Situação Cadastral homologado para regularidade eclesiástica.
              </p>
            </div>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all shadow cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Imprimir Cartão CNPJ</span>
            </button>
          </div>

          {/* Cartão CNPJ no estilo oficial */}
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-950 border-2 border-slate-700 shadow-2xl space-y-6 font-mono text-slate-200">
            {/* Cabeçalho Oficial RFB / CIMADEBE */}
            <div className="text-center pb-6 border-b border-slate-800 space-y-1">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>
              <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase block">
                REPÚBLICA FEDERATIVA DO BRASIL
              </span>
              <span className="text-xs font-black tracking-widest text-emerald-400 uppercase block">
                CADASTRO NACIONAL DA PESSOA JURÍDICA
              </span>
              <h3 className="text-sm sm:text-base font-bold text-white uppercase pt-1">
                COMPROVANTE DE INSCRIÇÃO E DE SITUAÇÃO CADASTRAL
              </h3>
            </div>

            {/* Linha 1: CNPJ e Data de Abertura */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1 md:col-span-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  NÚMERO DE INSCRIÇÃO (CNPJ)
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold text-white">{igreja.cnpj}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40 font-bold">
                    MATRIZ
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  DATA DE ABERTURA
                </span>
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  {igreja.dataAbertura}
                </span>
              </div>
            </div>

            {/* Linha 2: Razão Social */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">
                NOME EMPRESARIAL (RAZÃO SOCIAL)
              </span>
              <span className="text-sm font-bold text-white block">{igreja.razaoSocial}</span>
            </div>

            {/* Linha 3: Nome Fantasia e Porte */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1 md:col-span-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  TÍTULO DO ESTABELECIMENTO (NOME DE FANTASIA)
                </span>
                <span className="text-sm font-bold text-emerald-300 block">{igreja.nomeFantasia}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  PORTE
                </span>
                <span className="text-xs font-bold text-slate-300 block">DEMAIS (ORGANIZAÇÃO RELIGIOSA)</span>
              </div>
            </div>

            {/* Linha 4: Atividade Econômica Principal (CNAE) */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">
                CÓDIGO E DESCRIÇÃO DA ATIVIDADE ECONÔMICA PRINCIPAL (CNAE)
              </span>
              <span className="text-xs font-bold text-slate-200 block">{igreja.cnaePrincipal}</span>
            </div>

            {/* Linha 5: Natureza Jurídica */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">
                CÓDIGO E DESCRIÇÃO DA NATUREZA JURÍDICA
              </span>
              <span className="text-xs font-bold text-slate-200 block">{igreja.naturezaJuridica}</span>
            </div>

            {/* Linha 6: Endereço da Sede */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1 md:col-span-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  LOGRADOURO
                </span>
                <span className="text-xs font-bold text-white block">
                  {igreja.logradouro}, {igreja.numero} {igreja.complemento ? `(${igreja.complemento})` : ''}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  BAIRRO / DISTRITO
                </span>
                <span className="text-xs font-bold text-white block">{igreja.bairro}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  CEP
                </span>
                <span className="text-xs font-bold text-white block">{igreja.cep}</span>
              </div>
            </div>

            {/* Linha 7: Município, UF e Contatos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  MUNICÍPIO / UF
                </span>
                <span className="text-xs font-bold text-white block">
                  {igreja.municipio} / {igreja.uf}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  ENDEREÇO ELETRÔNICO (E-MAIL)
                </span>
                <span className="text-xs font-bold text-slate-300 block truncate">{igreja.email}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  TELEFONE
                </span>
                <span className="text-xs font-bold text-slate-300 block">{igreja.telefone}</span>
              </div>
            </div>

            {/* Linha 8: Situação Cadastral e Pastor Responsável */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 space-y-1">
                <span className="text-[10px] text-emerald-400 uppercase font-bold block">
                  SITUAÇÃO CADASTRAL NA RECEITA FEDERAL DO BRASIL
                </span>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-black text-emerald-300">{igreja.situacaoCadastral}</span>
                  <span className="text-[10px] text-slate-400">DESDE {formatarDataBR(igreja.dataFiliacao)}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  PASTOR PRESIDENTE / REPRESENTANTE LEGAL
                </span>
                <div className="flex items-center gap-2">
                  <BadgeCheck className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-bold text-white">{igreja.pastorPresidenteNome}</span>
                </div>
              </div>
            </div>

            {/* Rodapé de Autenticação */}
            <div className="text-center pt-4 border-t border-slate-800/80 text-[10px] text-slate-500 space-y-1">
              <p>Emitido eletronicamente pelo Sistema Integrado CIMADEBE / SIGM em conformidade estatutária.</p>
              <p className="font-mono">Chave de Validação: {igreja.id.toUpperCase()}-RFB-{igreja.cnpj.replace(/\D/g, '')}-CIMADEBE-2026</p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CONTEÚDO DA ABA 2: LISTAGEM DE MINISTROS & GESTÃO SACAL */}
      {/* ======================================================== */}
      {abaAtiva === 'ministros' && (
        <div className="space-y-6">
          {/* Métricas do Corpo Ministerial da Igreja */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase block font-bold">
                Total de Ministros
              </span>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-white font-mono">{ministrosVinculados.length}</span>
                <Users className="w-6 h-6 text-emerald-400 opacity-70" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                Adimplentes (Quitados)
              </span>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {ministrosVinculados.length - ministrosPendentes.length}
                </span>
                <CheckCircle2 className="w-6 h-6 text-emerald-400 opacity-70" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                Pendentes / Inadimplentes
              </span>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {ministrosPendentes.length}
                </span>
                <Clock className="w-6 h-6 text-amber-400 opacity-70" />
              </div>
            </div>

            <div className={`p-4 rounded-2xl border space-y-1 ${igreja.status === 'SUSPENSA' ? 'bg-cyan-950/40 border-cyan-500/50 shadow-lg shadow-cyan-950/40' : 'bg-slate-900 border border-slate-800'}`}>
              <span className="text-[10px] font-mono uppercase font-bold block">
                {igreja.status === 'SUSPENSA' ? (
                  <span className="text-cyan-400">Inadimplência Congelada (Total)</span>
                ) : (
                  <span className="text-slate-400">Taxas &amp; Anuidades Pendentes (Total)</span>
                )}
              </span>
              <div className="flex items-center justify-between">
                <span className={`text-2xl font-black font-mono ${igreja.status === 'SUSPENSA' ? 'text-cyan-300' : 'text-amber-400'}`}>
                  R$ {ministrosPendentes.reduce((acc, m) => acc + (m.valorAnuidade || 0), 0).toFixed(2)}
                </span>
                <DollarSign className={`w-6 h-6 ${igreja.status === 'SUSPENSA' ? 'text-cyan-400' : 'text-amber-400 opacity-70'}`} />
              </div>
            </div>
          </div>

          {/* Barra de Ações Rápidas & Sacola */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Filtros e Busca */}
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por nome, CPF ou cargo..."
                  value={buscaMinistro}
                  onChange={(e) => setBuscaMinistro(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Filtro por Status */}
              <select
                value={filtroStatusAdimplencia}
                onChange={(e) => setFiltroStatusAdimplencia(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="TODOS">Status: Todos</option>
                <option value="PENDENTES">Apenas Pendentes ({ministrosPendentes.length})</option>
                <option value="ADIMPLENTES">Apenas Adimplentes</option>
              </select>

              {/* Filtro por Cargo */}
              <select
                value={filtroCargo}
                onChange={(e) => setFiltroCargo(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="TODOS">Cargo: Todos</option>
                <option value="Pastor">Pastor</option>
                <option value="Evangelista">Evangelista</option>
                <option value="Presbítero">Presbítero</option>
                <option value="Missionária">Missionária</option>
              </select>
            </div>

            {/* Botões de Ação para Sacola */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {ministrosPendentes.length > 0 && (
                <button
                  onClick={selecionarTodosPendentes}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckSquare className="w-4 h-4 text-amber-400" />
                  <span>Selecionar Todos Pendentes ({ministrosPendentes.length})</span>
                </button>
              )}

              {ministrosSelecionadosIds.length > 0 && (
                <button
                  onClick={limparSacola}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpar</span>
                </button>
              )}

              <button
                onClick={() => setAbaAtiva('sacola')}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all shadow-lg shadow-indigo-600/30 inline-flex items-center gap-2 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                <span>Ver Sacola ({ministrosNaSacola.length})</span>
                {totalSacola > 0 && (
                  <span className="font-mono bg-indigo-950 px-2 py-0.5 rounded text-amber-300 text-[11px]">
                    R$ {totalSacola.toFixed(2)}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Tabela de Ministros com Foto, Nome, CPF, Cargo, Status de Pagamento e Checkbox da Sacola */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  Ministros Credenciados ({ministrosFiltrados.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Selecione os ministros com taxas ou anuidades pendentes através da caixa de seleção para somar e realizar o pagamento único.
                </p>
              </div>
            </div>

            {/* Tabela Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                    <th className="pb-3 pl-2 font-bold w-12 text-center">Sacola</th>
                    <th className="pb-3 font-bold">Ministro / Foto</th>
                    <th className="pb-3 font-bold">CPF</th>
                    <th className="pb-3 font-bold">Cargo Eclesiástico</th>
                    <th className="pb-3 font-bold">Status Cadastral</th>
                    <th className="pb-3 font-bold">Status de Pagamento</th>
                    <th className="pb-3 font-bold">Taxa / Anuidade Vigente</th>
                    <th className="pb-3 font-bold text-right pr-2">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {ministrosFiltrados.map((m) => {
                    const selecionado = ministrosSelecionadosIds.includes(m.id);
                    const ehAtivo = m.status === 'ATIVO';

                    return (
                      <tr
                        key={m.id}
                        className={`transition-colors ${
                          !ehAtivo
                            ? 'bg-slate-950/80 opacity-50 grayscale filter hover:grayscale-0 hover:opacity-100'
                            : selecionado
                            ? 'bg-indigo-950/40 hover:bg-indigo-950/60'
                            : 'hover:bg-slate-800/30'
                        }`}
                      >
                        {/* Checkbox da Sacola */}
                        <td className="py-4 pl-2 text-center">
                          {m.ehPendente ? (
                            <button
                              type="button"
                              onClick={() => alternarSelecaoMinistro(m.id)}
                              className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                                selecionado
                                  ? 'bg-indigo-600 border-indigo-400 text-white shadow'
                                  : 'bg-slate-950 border-slate-700 hover:border-indigo-400 text-transparent'
                              }`}
                              title={selecionado ? 'Remover da sacola' : 'Adicionar à sacola de pagamento'}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          ) : (
                            <div
                              className="w-6 h-6 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-center text-slate-600 mx-auto cursor-not-allowed"
                              title="Ministro já está ADIMPLENTE (sem pendências)"
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-500/50" />
                            </div>
                          )}
                        </td>

                        {/* Foto e Nome */}
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                m.fotoUrl ||
                                'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80'
                              }
                              alt={m.nome}
                              className="w-11 h-11 rounded-2xl object-cover border border-slate-700 shadow shrink-0 bg-slate-950"
                            />
                            <div>
                              <div className="font-bold text-white font-sans text-sm flex items-center gap-1.5">
                                <span>{m.nome}</span>
                                {m.id === igreja.pastorPresidenteId && (
                                  <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono font-bold">
                                    PRESIDENTE
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500">Reg: {m.registroMinisterial || m.id}</span>
                            </div>
                          </div>
                        </td>

                        {/* CPF */}
                        <td className="py-4 font-bold text-slate-200">{m.cpf}</td>

                        {/* Cargo Eclesiástico */}
                        <td className="py-4">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-sans text-xs font-medium">
                            {m.cargo}
                          </span>
                        </td>

                        {/* Status Cadastral */}
                        <td className="py-4">
                          <span
                            className={`px-2.5 py-0.8 rounded-full text-[10px] font-bold inline-flex items-center gap-1.5 ${
                              ehAtivo
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                                : 'bg-rose-950 text-rose-400 border border-rose-500/40'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${ehAtivo ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}
                            />
                            {ehAtivo ? 'ATIVO' : 'SUSPENSO'}
                          </span>
                        </td>

                        {/* Status de Pagamento */}
                        <td className="py-4">
                          <AdimplenciaBadge status={m.statusAdimplencia} />
                        </td>

                        {/* Taxa / Anuidade Vigente / Valor */}
                        <td className="py-4">
                          {m.ehPendente ? (
                            <div className="space-y-0.5">
                              <span className="font-bold text-amber-400 block text-xs">
                                R$ {m.valorAnuidade.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-slate-400 block font-mono">
                                {m.tipoCobrancaRotulo}
                              </span>
                              {igreja.status === 'SUSPENSA' && (
                                <span className="inline-block text-[9px] font-mono font-bold text-cyan-300 bg-cyan-950 border border-cyan-500/40 px-1.5 py-0.2 rounded">
                                  CONGELADO P/ NEGOCIAÇÃO
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-emerald-400 font-bold">
                              Quitada ({m.anoReferencia || getSystemYear()})
                            </span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="py-4 text-right pr-2">
                          <div className="flex items-center justify-end gap-1.5">
                            {m.ehPendente && (
                              <button
                                type="button"
                                onClick={() => alternarSelecaoMinistro(m.id)}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer ${
                                  selecionado
                                    ? 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30'
                                    : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                                }`}
                              >
                                <ShoppingBag className="w-3.5 h-3.5" />
                                <span>{selecionado ? 'Remover' : '+ Sacola'}</span>
                              </button>
                            )}

                            {!m.ehPendente && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await gerarPdfReciboPagamentoMinistro({
                                      ministro: m,
                                      anuidade: {
                                        id: m.anuidadeId || `an-${m.anoReferencia || getSystemYear()}-${m.id}`,
                                        anoVigente: m.anoReferencia || getSystemYear(),
                                        valor: m.valorAnuidade || 120,
                                        statusPagamento: 'PAGO',
                                        ehFiliacao: m.ehFiliacao,
                                        rotulo: m.tipoCobrancaRotulo,
                                        dataPagamento: new Date().toISOString(),
                                      },
                                      appConfig,
                                    });
                                    notifySuccess(
                                      'Recibo Gerado',
                                      `Recibo do ministro ${m.nome} baixado em PDF com sucesso.`
                                    );
                                  } catch (err: any) {
                                    notifyError('Erro ao Gerar Recibo', err?.message || 'Falha ao emitir recibo.');
                                  }
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                                title="Baixar Recibo Oficial de Quitação em PDF"
                              >
                                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Recibo</span>
                              </button>
                            )}

                            {onSelecionarMinistro && (
                              <button
                                onClick={() => onSelecionarMinistro(m.id)}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                                title="Ver Perfil Individual"
                              >
                                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Perfil</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-800">
              {ministrosFiltrados.map((m) => {
                const selecionado = ministrosSelecionadosIds.includes(m.id);
                const ehAtivo = m.status === 'ATIVO';

                return (
                  <div key={m.id} className={`py-4 space-y-3 ${!ehAtivo ? 'opacity-50 grayscale filter' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={m.fotoUrl}
                          alt={m.nome}
                          className="w-12 h-12 rounded-2xl object-cover border border-slate-700 shrink-0"
                        />
                        <div>
                          <h4 className="font-bold text-white text-sm font-sans">{m.nome}</h4>
                          <span className="text-xs text-slate-400 font-mono">CPF: {m.cpf}</span>
                        </div>
                      </div>

                      {m.ehPendente && (
                        <button
                          type="button"
                          onClick={() => alternarSelecaoMinistro(m.id)}
                          className={`p-2 rounded-xl border flex items-center justify-center cursor-pointer ${
                            selecionado
                              ? 'bg-indigo-600 border-indigo-400 text-white'
                              : 'bg-slate-950 border-slate-700 text-slate-400'
                          }`}
                        >
                          <ShoppingBag className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-xs font-mono bg-slate-950 p-2.5 rounded-xl">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Cargo</span>
                        <span className="text-slate-200 font-bold">{m.cargo}</span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] mb-1">Status</span>
                        <AdimplenciaBadge status={m.statusAdimplencia} />
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px]">Cobrança</span>
                        <span className="font-bold text-amber-400">
                          {m.ehPendente ? `${m.tipoCobrancaRotulo} (R$ ${m.valorAnuidade.toFixed(2)})` : 'Quitada'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {m.ehPendente && (
                        <button
                          type="button"
                          onClick={() => alternarSelecaoMinistro(m.id)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                            selecionado
                              ? 'bg-rose-600 text-white'
                              : 'bg-indigo-600 text-white'
                          }`}
                        >
                          {selecionado ? 'Remover da Sacola' : 'Adicionar à Sacola'}
                        </button>
                      )}

                      {!m.ehPendente && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await gerarPdfReciboPagamentoMinistro({
                                ministro: m,
                                anuidade: {
                                  id: m.anuidadeId || `an-${m.anoReferencia || getSystemYear()}-${m.id}`,
                                  anoVigente: m.anoReferencia || getSystemYear(),
                                  valor: m.valorAnuidade || 120,
                                  statusPagamento: 'PAGO',
                                  ehFiliacao: m.ehFiliacao,
                                  rotulo: m.tipoCobrancaRotulo,
                                  dataPagamento: new Date().toISOString(),
                                },
                                appConfig,
                              });
                              notifySuccess(
                                'Recibo Gerado',
                                `Recibo do ministro ${m.nome} baixado em PDF com sucesso.`
                              );
                            } catch (err: any) {
                              notifyError('Erro ao Gerar Recibo', err?.message || 'Falha ao emitir recibo.');
                            }
                          }}
                          className="flex-1 py-2 rounded-xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition-all text-center cursor-pointer flex items-center justify-center gap-1.5"
                          title="Baixar Recibo Oficial de Quitação em PDF"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Gerar Recibo</span>
                        </button>
                      )}

                      {onSelecionarMinistro && (
                        <button
                          onClick={() => onSelecionarMinistro(m.id)}
                          className="px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold transition-all text-center cursor-pointer"
                        >
                          Ver Perfil
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {ministrosFiltrados.length === 0 && (
              <div className="p-8 text-center bg-slate-950/40 border border-slate-800 rounded-2xl space-y-2">
                <Users className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-300">
                  Nenhum ministro atende aos filtros de busca especificados.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CONTEÚDO DA ABA 3: SACOLA DE ANUIDADES & PAGAMENTO EM LOTE */}
      {/* ======================================================== */}
      {abaAtiva === 'sacola' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-widest text-indigo-400 bg-indigo-950/80 border border-indigo-500/30 px-2 py-0.5 rounded">
                  CHECKOUT COLETIVO DE MINISTROS
                </span>
              </div>
              <h2 className="text-xl font-black text-white mt-1 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                Sacola de Taxas & Anuidades da Igreja
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Unifique o pagamento de múltiplos ministros pendentes em uma única transação contábil com recibo oficial.
              </p>
            </div>

            {ministrosNaSacola.length > 0 && (
              <button
                onClick={limparSacola}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-rose-300 text-xs font-bold transition-all cursor-pointer w-fit"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Esvaziar Sacola</span>
              </button>
            )}
          </div>

          {ministrosNaSacola.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/90 border border-slate-800 rounded-3xl space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 mx-auto">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Sua Sacola de Taxas & Anuidades está vazia</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Vá até a aba "Listar Ministros", selecione os ministros pendentes que deseja regularizar e retorne aqui para fazer o pagamento unificado.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setAbaAtiva('ministros')}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all shadow cursor-pointer inline-flex items-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  <span>Ver Ministros Pendentes</span>
                </button>

                {ministrosPendentes.length > 0 && (
                  <button
                    onClick={() => {
                      selecionarTodosPendentes();
                      setAbaAtiva('sacola');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all shadow cursor-pointer inline-flex items-center gap-2"
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>Adicionar Todos os Pendentes ({ministrosPendentes.length})</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Coluna 1 e 2: Lista dos Ministros na Sacola */}
              <div className="lg:col-span-2 space-y-4">
                <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-400" />
                      Ministros Selecionados ({ministrosNaSacola.length})
                    </h3>
                    <span className="text-xs font-mono text-slate-400">
                      Igreja: {igreja.nomeFantasia}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-800/80">
                    {ministrosNaSacola.map((m) => (
                      <div
                        key={m.id}
                        className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={m.fotoUrl}
                            alt={m.nome}
                            className="w-11 h-11 rounded-2xl object-cover border border-slate-700 shrink-0"
                          />
                          <div>
                            <h4 className="font-bold text-white text-sm font-sans">{m.nome}</h4>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400">
                              <span>CPF: {m.cpf}</span>
                              <span>•</span>
                              <span className="text-slate-300 font-sans">{m.cargo}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4">
                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-amber-400 block">
                              R$ {m.valorAnuidade.toFixed(2)}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 block">
                              {m.tipoCobrancaRotulo}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => alternarSelecaoMinistro(m.id)}
                            className="p-1.5 rounded-lg bg-slate-950 hover:bg-rose-950/80 border border-slate-800 hover:border-rose-500/50 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Remover este ministro da sacola"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Opções de Forma de Pagamento */}
                <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      Forma de Pagamento Unificado
                    </h3>
                    {igreja.status === 'SUSPENSA' && (
                      <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 rounded">
                        CONDIÇÃO ESPECIAL: PIX OU CARTÃO ATÉ 6X
                      </span>
                    )}
                  </div>

                  {/* Botões de Seleção do Método */}
                  <div className={`grid gap-3 ${igreja.status === 'SUSPENSA' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
                    <button
                      type="button"
                      onClick={() => setMetodoPagamento('PIX')}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-2 ${
                        metodoPagamento === 'PIX'
                          ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <QrCode className="w-5 h-5 text-emerald-400" />
                        <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                          INSTANTÂNEO
                        </span>
                      </div>
                      <div>
                        <span className="text-xs font-bold block text-white">PIX Convencional</span>
                        <span className="text-[10px] text-slate-400 block">Liberação contábil imediata</span>
                      </div>
                    </button>

                    {igreja.status !== 'SUSPENSA' && (
                      <button
                        type="button"
                        onClick={() => setMetodoPagamento('BOLETO')}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-2 ${
                          metodoPagamento === 'BOLETO'
                            ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <FileText className="w-5 h-5 text-indigo-400" />
                          <span className="text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">
                            UNIFICADO
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-bold block text-white">Boleto Bancário</span>
                          <span className="text-[10px] text-slate-400 block">Vencimento em 3 dias úteis</span>
                        </div>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setMetodoPagamento('CARTAO')}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-2 ${
                        metodoPagamento === 'CARTAO'
                          ? 'bg-cyan-950/60 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <CreditCard className="w-5 h-5 text-cyan-400" />
                        <span className="text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded">
                          {igreja.status === 'SUSPENSA' ? 'ATÉ 6X' : 'CRÉDITO'}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs font-bold block text-white">Cartão de Crédito</span>
                        <span className="text-[10px] text-slate-400 block">
                          {igreja.status === 'SUSPENSA' ? 'Parcelamento em até 6x' : 'À vista ou parcelado'}
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Detalhe do PIX com Chave Copia e Cola */}
                  {metodoPagamento === 'PIX' && (
                    <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-3 font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          <QrCode className="w-4 h-4" />
                          Chave PIX Oficial CIMADEBE (Copia e Cola)
                        </span>
                        <span className="text-[10px] text-slate-400">Banco Santander / SIGM</span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 break-all select-all">
                        00020126580014br.gov.bcb.pix0136tesouraria@cimadebe.org.br520400005303986540{totalSacola.toFixed(2)}5802BR5925CIMADEBE ESTADUAL SALVADOR6009SALVADOR62070503***6304
                      </div>

                      <button
                        type="button"
                        onClick={copiarChavePix}
                        className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-400 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {chaveCopiada ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>Chave PIX Copiada com Sucesso!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copiar Chave PIX</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Detalhe do Boleto (Apenas Igrejas Ativas) */}
                  {metodoPagamento === 'BOLETO' && igreja.status !== 'SUSPENSA' && (
                    <div className="p-4 rounded-2xl bg-slate-950 border border-indigo-500/30 space-y-2 font-mono text-xs">
                      <span className="text-indigo-400 font-bold block">Linha Digitável do Boleto Unificado:</span>
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-[11px] select-all">
                        03399.88210 55000.123456 78900.123455 1 987600000{Math.round(totalSacola * 100)}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Após a confirmação da quitação, os ministros listados serão automaticamente adimplidos.
                      </p>
                    </div>
                  )}

                  {/* Detalhe do Cartão com Seletor em até 6x */}
                  {metodoPagamento === 'CARTAO' && (
                    <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/30 space-y-4 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-cyan-400 font-bold block">Parcelamento no Cartão:</span>
                        <span className="text-[10px] text-slate-400">Até 6x sem juros (Acordo Convencional)</span>
                      </div>

                      {/* Seletor de Parcelas (1x a 6x) */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[1, 2, 3, 4, 5, 6].map((p) => {
                          const valorParcela = totalSacola / p;
                          const selecionado = parcelasCartao === p;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setParcelasCartao(p)}
                              className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                                selecionado
                                  ? 'bg-cyan-950/80 border-cyan-400 text-white font-bold shadow-md shadow-cyan-950'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                              }`}
                            >
                              <span className="block text-xs font-bold">{p}x {p === 1 ? 'à vista' : ''}</span>
                              <span className={`block text-[11px] ${selecionado ? 'text-cyan-300 font-bold' : 'text-slate-400'}`}>
                                R$ {valorParcela.toFixed(2)}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 space-y-2">
                        <span className="text-slate-400 font-bold block text-[11px]">Dados do Cartão Corporativo:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Número do Cartão (4000 0000 0000 0000)"
                            defaultValue="4111 2222 3333 4444"
                            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                          />
                          <input
                            type="text"
                            placeholder="Nome Impresso no Cartão"
                            defaultValue={igreja.nomeFantasia}
                            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Coluna 3: Resumo Financeiro & Liquidação Única */}
              <div className="space-y-4">
                <div className="p-6 rounded-3xl bg-slate-900/95 border border-slate-800 shadow-2xl space-y-5 sticky top-24">
                  <div className="border-b border-slate-800 pb-3">
                    <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                      Resumo da Transação
                    </span>
                    <h3 className="text-lg font-black text-white">Quitação Coletiva</h3>
                  </div>

                  <div className="space-y-3 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Igreja Pagadora:</span>
                      <span className="font-bold text-white truncate max-w-[140px]" title={igreja.nomeFantasia}>
                        {igreja.nomeFantasia}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-300">
                      <span>Qtd. de Ministros:</span>
                      <span className="font-bold text-white">{ministrosNaSacola.length}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-300">
                      <span>Valor Unitário Base:</span>
                      <span className="text-slate-400">R$ {(appConfig?.taxaAnuidadeRecorrente || 120).toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-300">
                      <span>Taxa de Processamento:</span>
                      <span className="text-emerald-400 font-bold">R$ 0,00 (ISENTO)</span>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-baseline justify-between">
                      <span className="text-sm font-bold text-white uppercase">TOTAL GERAL:</span>
                      <span className="text-2xl font-black text-emerald-400">
                        R$ {totalSacola.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Botão de Pagamento Único / Liquidação */}
                  <button
                    type="button"
                    onClick={efetuarPagamentoSacola}
                    disabled={processandoPagamento || totalSacola <= 0}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm tracking-wide transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {processandoPagamento ? (
                      <>
                        <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        <span>Liquidando no Ledger...</span>
                      </>
                    ) : (
                      <>
                        <BadgeCheck className="w-5 h-5" />
                        <span>Efetuar Pagamento Único (R$ {totalSacola.toFixed(2)})</span>
                      </>
                    )}
                  </button>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[10px] text-slate-400 space-y-1">
                    <p className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <Shield className="w-3.5 h-3.5" />
                      Garantia Contábil de Regularidade
                    </p>
                    <p>
                      Todos os {ministrosNaSacola.length} ministros selecionados terão suas taxas de filiação e anuidades quitadas imediatamente no Ledger Criptográfico, tornando-se 100% ADIMPLENTES.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* BARRA FIXA FLUTUANTE DA SACOLA QUANDO HOUVER SELEÇÃO */}
      {/* ======================================================== */}
      {abaAtiva === 'ministros' && ministrosNaSacola.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-8 sm:max-w-md z-50 animate-slideUp">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border-2 border-indigo-500/60 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-400/20">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-mono text-amber-300 font-bold block">
                  {ministrosNaSacola.length} ministro(s) na sacola
                </span>
                <span className="text-base font-black text-white font-mono">
                  R$ {totalSacola.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={() => setAbaAtiva('sacola')}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all shadow cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>Abrir Sacola</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: COMPROVANTE DE QUITAÇÃO COLETIVA DA IGREJA */}
      {/* ======================================================== */}
      {comprovanteModalAberto && dadosComprovante && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="max-w-2xl w-full bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Topo do Recibo */}
            <div className="text-center pb-4 border-b border-slate-800 space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                <BadgeCheck className="w-6 h-6" />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">
                  RECIBO OFICIAL DE QUITAÇÃO COLETIVA
                </span>
                {igreja.status === 'SUSPENSA' && (
                  <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-300 bg-cyan-950/90 border border-cyan-500/40 px-2 py-0.5 rounded">
                    DÉBITOS CONGELADOS & QUITADOS NO LEDGER
                  </span>
                )}
              </div>
              <h3 className="text-lg font-black text-white mt-1">CIMADEBE / CONVENÇÃO ESTADUAL</h3>
              <p className="text-xs text-slate-400 font-mono">
                Recibo Nº: <span className="text-white font-bold">{dadosComprovante.reciboId}</span> • Data: {dadosComprovante.dataHora}
              </p>
            </div>

            {/* Dados da Igreja e Pagamento */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Igreja Filiada:</span>
                <span className="text-white font-bold">{dadosComprovante.igrejaNome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">CNPJ:</span>
                <span className="text-white font-bold">{dadosComprovante.igrejaCnpj}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Método de Pagamento:</span>
                <span className="text-emerald-400 font-bold">{dadosComprovante.metodo}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-slate-800 font-bold">
                <span className="text-white">Valor Total Quitado:</span>
                <span className="text-emerald-400 text-base">R$ {dadosComprovante.totalPago.toFixed(2)}</span>
              </div>
            </div>

            {/* Relação Nominal de Ministros Quitados */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 block font-mono">
                Relação de Ministros Adimplidos ({dadosComprovante.ministrosQuitados.length}):
              </span>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/80 rounded-2xl bg-slate-900/60 border border-slate-800 p-3">
                {dadosComprovante.ministrosQuitados.map((m, idx) => (
                  <div key={m.id} className="py-2 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">{idx + 1}.</span>
                      <span className="text-white font-bold">{m.nome}</span>
                      <span className="text-slate-400 text-[10px]">({m.cargo} - CPF: {m.cpf})</span>
                    </div>
                    <span className="text-emerald-400 font-bold">R$ {m.valor.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hash Criptográfico */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-500 break-all">
              <span className="block text-slate-400 font-bold">Autenticação Digital SHA-256:</span>
              <span>{dadosComprovante.hashAutenticacao}</span>
            </div>

            {/* Botões do Modal */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Imprimir Recibo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setComprovanteModalAberto(false);
                  setAbaAtiva('ministros');
                }}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
