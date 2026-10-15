/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * AdminReportTesouraria - Painel de Prestação de Contas da Tesouraria e DRE Anual
 * Protocolo: Aritmética em Centavos Inteiros via fromCents(), Fuso Horário de Brasília (-03:00)
 * e Fechamento Imutável de Exercício Contábil.
 */

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Receipt,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  ShieldCheck,
  RefreshCw,
  FileText,
  CreditCard,
  Building2,
  ChevronRight,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { useSecurity } from '../SecurityContext';
import { useNotification } from '../NotificationContext';
import { formatarMoeda, fromCents, getSystemYear } from '../financialEngine';

interface LedgerItem {
  id: string;
  eventId?: string;
  timestamp: string;
  dataLiquidacao?: string;
  dataBrasiliaFormatada?: string;
  operadorEmail?: string;
  ministroId?: string;
  igrejaId?: string;
  valorCentavos: number;
  taxaCentavos: number;
  valorBrl: number;
  taxaBrl: number;
  tipoOperacao?: string;
  metodoPagamento?: string;
  descricao?: string;
}

interface DreReportData {
  ano: number;
  fusoHorario: string;
  totalTransacoes: number;
  centavos: {
    faturamentoBrutoCentavos: number;
    taxasGatewayCentavos: number;
    despesasTotaisCentavos: number;
    faturamentoLiquidoCentavos: number;
  };
  brl: {
    faturamentoBruto: number;
    taxasGateway: number;
    despesasTotais: number;
    faturamentoLiquido: number;
  };
  statusFechamento: 'EM_ABERTO' | 'CONGELADO_IMUTAVEL';
  fechamentoCongelado?: {
    id: string;
    ano: number;
    status: string;
    dataFechamentoIso: string;
    operadorFechamento: string;
    justificativa: string;
    transacoesAuditadas: number;
  } | null;
}

export function AdminReportTesouraria() {
  const { operadorAtual, tenantAtivo } = useSecurity();
  const { notifySuccess, notifyError } = useNotification();

  const anoAtual = getSystemYear();
  const [anoSelecionado, setAnoSelecionado] = useState<number>(anoAtual);
  const [carregandoDre, setCarregandoDre] = useState<boolean>(true);
  const [dreData, setDreData] = useState<DreReportData | null>(null);

  // Livro Caixa: 50 últimas transações
  const [ledgerRecentes, setLedgerRecentes] = useState<LedgerItem[]>([]);
  const [carregandoLedger, setCarregandoLedger] = useState<boolean>(true);

  // Modal de Congelamento de Exercício (2 Etapas)
  const [modalCongelarAberto, setModalCongelarAberto] = useState<boolean>(false);
  const [etapaConfirmacao, setEtapaConfirmacao] = useState<1 | 2>(1);
  const [justificativaFechamento, setJustificativaFechamento] = useState<string>('');
  const [processandoFechamento, setProcessandoFechamento] = useState<boolean>(false);

  // Carrega DRE Dinâmico do Ano Selecionado
  const carregarDre = async (ano: number) => {
    setCarregandoDre(true);
    try {
      const res = await fetch(`/api/treasury/reports/dre/${ano}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Erro ao consultar DRE anual.');
      }
      const data: DreReportData = await res.json();
      setDreData(data);
    } catch (err: any) {
      console.warn('[DRE_FETCH_ERR]', err);
      notifyError('Erro no DRE', err?.message || 'Falha ao processar relatório da tesouraria.');
    } finally {
      setCarregandoDre(false);
    }
  };

  // Carrega Livro Caixa (Últimas 50 transações)
  const carregarLedger = async () => {
    setCarregandoLedger(true);
    try {
      const res = await fetch('/api/treasury/reports/ledger-recentes');
      if (!res.ok) throw new Error('Falha ao obter livro caixa.');
      const data = await res.json();
      setLedgerRecentes(data.registros || []);
    } catch (err: any) {
      console.warn('[LEDGER_FETCH_ERR]', err);
    } finally {
      setCarregandoLedger(false);
    }
  };

  useEffect(() => {
    carregarDre(anoSelecionado);
    carregarLedger();
  }, [anoSelecionado]);

  // Congelar Exercício Contábil Definitivo
  const handleCongelarExercicio = async () => {
    setProcessandoFechamento(true);
    try {
      const res = await fetch('/api/treasury/reports/dre/congelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ano: anoSelecionado,
          operadorEmail: operadorAtual || 'tesoureiro_geral@cimadebe.org',
          justificativa: justificativaFechamento || `Aprovação de contas do exercício ${anoSelecionado} homologado em AGO`,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (res.status === 409) {
        throw new Error(body.error || 'Exercício contábil já se encontra congelado de forma imutável.');
      }

      if (!res.ok) {
        throw new Error(body.error || 'Falha ao congelar exercício.');
      }

      notifySuccess('Exercício Congelado', `Exercício fiscal ${anoSelecionado} fechado com sucesso.`);
      setModalCongelarAberto(false);
      setEtapaConfirmacao(1);
      setJustificativaFechamento('');
      carregarDre(anoSelecionado);
    } catch (err: any) {
      notifyError('Bloqueio Contábil', err?.message || 'Erro ao congelar exercício.');
    } finally {
      setProcessandoFechamento(false);
    }
  };

  const isExercicioCongelado = dreData?.statusFechamento === 'CONGELADO_IMUTAVEL';

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* 1. CABEÇALHO DO RELATÓRIO DA TESOURARIA GERAL */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-teal-950/70 border border-emerald-500/30 p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider">
              <Receipt className="w-4 h-4 shrink-0" />
              <span>TESOURARIA GERAL • DEMONSTRATIVO DO RESULTADO DO EXERCÍCIO (DRE)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Prestação de Contas & Livro Caixa Auditável
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Aritmética estrita em centavos inteiros (Anti-IEEE 754) com corte de virada à meia-noite no fuso oficial de Brasília (-03:00).
            </p>
          </div>

          {/* SELETOR DE ANO E BOTÃO REFRESH */}
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
              {[anoAtual - 1, anoAtual, anoAtual + 1].map((ano) => (
                <button
                  key={ano}
                  type="button"
                  onClick={() => setAnoSelecionado(ano)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    anoSelecionado === ano
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {ano}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                carregarDre(anoSelecionado);
                carregarLedger();
              }}
              disabled={carregandoDre || carregandoLedger}
              title="Recarregar Livro Caixa e DRE"
              className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${carregandoDre ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* STATUS DO EXERCÍCIO FISCAL */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-5 mt-5 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Status do Ano {anoSelecionado}:</span>
            {isExercicioCongelado ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/80 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold">
                <Lock className="w-3.5 h-3.5 text-rose-400" />
                <span>EXERCÍCIO CONGELADO (IMUTÁVEL)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold">
                <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                <span>EXERCÍCIO ABERTO (EM ANDAMENTO)</span>
              </span>
            )}
          </div>

          <div>
            {!isExercicioCongelado && (
              <button
                type="button"
                onClick={() => {
                  setEtapaConfirmacao(1);
                  setModalCongelarAberto(true);
                }}
                disabled={processandoFechamento}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-95 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Congelar Exercício Financeiro</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. CARDS FINANCEIROS CONSOLIDADOS (FROM CENTS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* FATURAMENTO BRUTO */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Faturamento Bruto</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-white tabular-nums">
            {formatarMoeda(dreData?.brl.faturamentoBruto || 0)}
          </div>
          <span className="text-[10px] text-slate-500 font-mono block">
            {dreData?.centavos.faturamentoBrutoCentavos || 0} centavos
          </span>
        </div>

        {/* TAXAS GATEWAY (ASAAS) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Taxas Asaas / Gateway</span>
            <CreditCard className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-amber-400 tabular-nums">
            {formatarMoeda(dreData?.brl.taxasGateway || 0)}
          </div>
          <span className="text-[10px] text-slate-500 font-mono block">
            Custos bancários liquidados
          </span>
        </div>

        {/* DESPESAS TOTAIS */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Despesas do Exercício</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-rose-400 tabular-nums">
            {formatarMoeda(dreData?.brl.despesasTotais || 0)}
          </div>
          <span className="text-[10px] text-slate-500 font-mono block">
            Saídas e custeios operacionais
          </span>
        </div>

        {/* FATURAMENTO LÍQUIDO (SUPERÁVIT) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 space-y-1.5 shadow-md">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-mono font-bold">
            <span>Superávit Líquido</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 tabular-nums">
            {formatarMoeda(dreData?.brl.faturamentoLiquido || 0)}
          </div>
          <span className="text-[10px] text-emerald-400/70 font-mono block">
            Resultado real disponível
          </span>
        </div>
      </div>

      {/* 3. LIVRO CAIXA: ÚLTIMAS 50 TRANSAÇÕES POR ORDEM DE LIQUIDAÇÃO */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-400" />
              <span>Livro Caixa Imutável (financial_ledger)</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Últimas 50 transações liquidadas registradas com offset de Brasília (-03:00).
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Total exibido: {ledgerRecentes.length} registros
          </span>
        </div>

        {carregandoLedger ? (
          <div className="p-8 text-center text-xs font-mono text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Consultando livro caixa contábil...</span>
          </div>
        ) : ledgerRecentes.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
            <Receipt className="w-8 h-8 text-slate-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-300">Nenhuma transação liquidada no livro caixa</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto font-mono">
              As transações liquidadas via PIX/Boleto pelo Asaas Webhook são lançadas automaticamente com timestamp canônico.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-950 text-slate-400 font-mono text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Data (Brasília -03:00)</th>
                  <th className="py-2.5 px-3">Operação / Descrição</th>
                  <th className="py-2.5 px-3">Método</th>
                  <th className="py-2.5 px-3 text-right">Taxa Gateway</th>
                  <th className="py-2.5 px-3 text-right">Valor Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40 font-mono">
                {ledgerRecentes.map((item) => {
                  const isDespesa = (item.tipoOperacao || '').toUpperCase().includes('DESPESA');
                  return (
                    <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-300">
                        {item.dataBrasiliaFormatada || item.timestamp?.slice(0, 10)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-white font-sans truncate max-w-xs">
                          {item.descricao || item.tipoOperacao || 'Transação'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          ID: {item.id}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px]">
                          {item.metodoPagamento || 'PIX'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-amber-400">
                        {formatarMoeda(item.taxaBrl || 0)}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${
                        isDespesa ? 'text-rose-400' : 'text-emerald-400'
                      }`}>
                        {isDespesa ? '-' : '+'}{formatarMoeda(item.valorBrl || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL EM DUAS ETAPAS PARA CONGELAMENTO IMUTÁVEL */}
      {modalCongelarAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold">
                <Lock className="w-5 h-5" />
                <h3 className="text-white text-base">Fechamento do Exercício {anoSelecionado}</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalCongelarAberto(false)}
                className="text-slate-400 hover:text-white cursor-pointer font-mono"
              >
                ✕
              </button>
            </div>

            {etapaConfirmacao === 1 ? (
              <div className="space-y-4 text-xs font-sans">
                <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-rose-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>AVISO ESTATUTÁRIO: AÇÃO IRREVERSÍVEL</span>
                  </div>
                  <p className="leading-relaxed">
                    O congelamento contábil grava o status <strong>CONGELADO_IMUTAVEL</strong> no banco de dados. O sistema rejeitará qualquer alteração retroativa neste exercício financeiro.
                  </p>
                </div>

                <div className="space-y-2 font-mono">
                  <label className="block text-slate-300 font-bold">Justificativa da Mesa Diretora / AGO:</label>
                  <textarea
                    rows={3}
                    value={justificativaFechamento}
                    onChange={(e) => setJustificativaFechamento(e.target.value)}
                    placeholder="Ex: Contas aprovadas por unanimidade na AGO ordinária realizada nesta data."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500 font-sans"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setModalCongelarAberto(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEtapaConfirmacao(2)}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black cursor-pointer"
                  >
                    Avançar para Etapa 2
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs font-sans">
                <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/60 text-rose-100 space-y-2">
                  <div className="font-black text-sm text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                    <span>CONFIRMAÇÃO FINAL DE AUDITORIA</span>
                  </div>
                  <p>
                    Deseja realmente congelar em definitivo o livro caixa de <strong>{anoSelecionado}</strong> com Faturamento Bruto de <strong>{formatarMoeda(dreData?.brl.faturamentoBruto || 0)}</strong> e Superávit de <strong>{formatarMoeda(dreData?.brl.faturamentoLiquido || 0)}</strong>?
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEtapaConfirmacao(1)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleCongelarExercicio}
                    disabled={processandoFechamento}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 text-white font-black uppercase font-mono tracking-wider flex items-center gap-2 shadow-xl cursor-pointer disabled:opacity-50"
                  >
                    {processandoFechamento ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Gravando Snapshot...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Confirmar Congelamento Imutável</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminReportTesouraria;
