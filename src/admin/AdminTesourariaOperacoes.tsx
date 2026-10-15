import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSecurity } from '../SecurityContext';
import { fromCents } from '../financialEngine';
import {
  verificarSuporteBiometria,
  obterCredencialBiometricaLocal,
  autenticarComBiometriaNativa,
} from '../services/biometriaService';
import {
  DollarSign,
  Receipt,
  Lock,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  Building2,
  User,
  SlidersHorizontal,
  TrendingUp,
  Snowflake
} from 'lucide-react';

interface EventoPendente {
  id: string;
  paymentId: string;
  valor: number;
  data: string;
  tipo: string;
  statusConciliacao: string;
  ministroId?: string | null;
  ministroNome?: string | null;
  conciliadoPor?: string | null;
  conciliadoEm?: string | null;
}

interface FechamentoContabil {
  id: string;
  anoExercicio: number;
  fechadoEm: string;
  fechadoPor: string;
  tenantId: string;
  faturamentoBrutoCentavos: number;
  taxasGatewayCentavos: number;
  faturamentoLiquidoCentavos: number;
  totalAnuidadesCentavos: number;
  totalInscricoesAgoCentavos: number;
  totalAnuidadesLiquidadas?: number;
  totalInscricoesAgoLiquidadas?: number;
  faturamentoBrutoBrl: number;
  faturamentoLiquidoBrl: number;
  taxasGatewayBrl: number;
  status: string;
  observacoes?: string;
}

export function AdminTesourariaOperacoes() {
  const { ministros, igrejasFiliadas, operadorAtual, tenantAtivoId } = useSecurity();

  // Abas do Painel Operacional da Tesouraria
  const [abaAtiva, setAbaAtiva] = useState<'CONCILIACAO' | 'FECHAMENTO_DRE'>('CONCILIACAO');

  // Estados da Fila de Conciliação
  const [eventos, setEventos] = useState<EventoPendente[]>([]);
  const [carregandoEventos, setCarregandoEventos] = useState<boolean>(true);
  const [buscaEvento, setBuscaEvento] = useState<string>('');

  // Modal de Conciliação Manual
  const [modalConciliarAberto, setModalConciliarAberto] = useState<boolean>(false);
  const [eventoSelecionado, setEventoSelecionado] = useState<EventoPendente | null>(null);
  const [ministroAlvoId, setMinistroAlvoId] = useState<string>('');
  const [igrejaAlvoId, setIgrejaAlvoId] = useState<string>('');
  const [observacaoConciliacao, setObservacaoConciliacao] = useState<string>('');
  const [salvandoConciliacao, setSalvandoConciliacao] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Estados de Fechamento de Exercício
  const [fechamentos, setFechamentos] = useState<FechamentoContabil[]>([]);
  const [carregandoFechamentos, setCarregandoFechamentos] = useState<boolean>(true);
  const [anoParaFechar, setAnoParaFechar] = useState<number>(new Date().getFullYear() - 1);
  const [modalFecharAberto, setModalFecharAberto] = useState<boolean>(false);
  const [salvandoFechamento, setSalvandoFechamento] = useState<boolean>(false);
  const [observacoesFechamento, setObservacoesFechamento] = useState<string>('');

  // 1. Carregar Fila de Transações Asaas
  const carregarEventos = useCallback(async () => {
    setCarregandoEventos(true);
    try {
      const res = await fetch('/api/treasury/pending-events');
      if (res.ok) {
        const data = await res.json();
        setEventos(data.eventos || []);
      }
    } catch (err) {
      console.error('[ERRO_FETCH_PENDING_EVENTS]', err);
    } finally {
      setCarregandoEventos(false);
    }
  }, []);

  // 2. Carregar Fechamentos Históricos
  const carregarFechamentos = useCallback(async () => {
    setCarregandoFechamentos(true);
    try {
      const res = await fetch('/api/treasury/fechamentos');
      if (res.ok) {
        const data = await res.json();
        setFechamentos(data.fechamentos || []);
      }
    } catch (err) {
      console.error('[ERRO_FETCH_FECHAMENTOS]', err);
    } finally {
      setCarregandoFechamentos(false);
    }
  }, []);

  useEffect(() => {
    carregarEventos();
    carregarFechamentos();
  }, [carregarEventos, carregarFechamentos]);

  // Abertura do Modal de Conciliação
  const abrirModalConciliar = (ev: EventoPendente) => {
    setEventoSelecionado(ev);
    setMinistroAlvoId('');
    setIgrejaAlvoId('');
    setObservacaoConciliacao('');
    setModalConciliarAberto(true);
    setFeedback(null);
  };

  // Submissão da Conciliação Manual com Freeze Lock (disabled={loading})
  const lidarComSalvarConciliacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventoSelecionado || salvandoConciliacao) return;

    if (!ministroAlvoId && !igrejaAlvoId) {
      setFeedback({ tipo: 'erro', texto: 'Selecione o ministro ou a igreja titular para vincular a transação.' });
      return;
    }

    setSalvandoConciliacao(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/treasury/reconcile-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: eventoSelecionado.id,
          ministroId: ministroAlvoId || undefined,
          igrejaId: igrejaAlvoId || undefined,
          operadorEmail: operadorAtual || 'tesouraria@cimadebe.org.br',
          observacao: observacaoConciliacao || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao conciliar evento.');
      }

      setFeedback({ tipo: 'sucesso', texto: data.mensagem || 'Evento conciliado com sucesso no Ledger contábil.' });
      setModalConciliarAberto(false);
      carregarEventos();
    } catch (err: any) {
      setFeedback({ tipo: 'erro', texto: err?.message || 'Erro durante a conciliação manual.' });
    } finally {
      setSalvandoConciliacao(false);
    }
  };

  // Submissão do Fechamento de Exercício com Freeze Lock (disabled={loading})
  const lidarComFecharExercicio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvandoFechamento) return;

    setSalvandoFechamento(true);
    setFeedback(null);

    // GATILHO BIOMÉTRICO MANDATÓRIO DE ALTA GOVERNANÇA (FIDO2 / WebAuthn)
    try {
      const suporteBio = await verificarSuporteBiometria();
      if (!suporteBio) {
        setFeedback({
          tipo: 'erro',
          texto: 'Dispositivo sem suporte a hardware biométrico (WebAuthn/FIDO2). Esta ação crítica de alta governança exige autenticação biométrica ou chave física homologada.',
        });
        setSalvandoFechamento(false);
        return;
      }

      const credLocal = obterCredencialBiometricaLocal();
      if (credLocal && credLocal.ativo) {
        await autenticarComBiometriaNativa(credLocal);
      }
    } catch (bioErr: any) {
      setFeedback({
        tipo: 'erro',
        texto: `Validação Biométrica Cancelada ou Não Reconhecida: ${bioErr?.message || 'Falha no sensor FIDO2'}. Ação abortada por segurança.`,
      });
      setSalvandoFechamento(false);
      return;
    }

    try {
      const res = await fetch('/api/treasury/fechar-exercicio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anoExercicio: anoParaFechar,
          operadorEmail: operadorAtual || 'tesouraria@cimadebe.org.br',
          tenantId: tenantAtivoId,
          observacoesFechamento,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Falha ao fechar exercício contábil.');
      }

      setFeedback({ tipo: 'sucesso', texto: data.mensagem || `Exercício ${anoParaFechar} congelado com sucesso.` });
      setModalFecharAberto(false);
      carregarFechamentos();
    } catch (err: any) {
      setFeedback({ tipo: 'erro', texto: err?.message || 'Erro ao fechar exercício contábil.' });
    } finally {
      setSalvandoFechamento(false);
    }
  };

  // Filtro de Eventos
  const eventosFiltrados = eventos.filter((ev) => {
    if (!buscaEvento.trim()) return true;
    const b = buscaEvento.toLowerCase();
    return (
      ev.id.toLowerCase().includes(b) ||
      (ev.paymentId && ev.paymentId.toLowerCase().includes(b)) ||
      (ev.ministroNome && ev.ministroNome.toLowerCase().includes(b)) ||
      (ev.statusConciliacao && ev.statusConciliacao.toLowerCase().includes(b))
    );
  });

  const formatarMoeda = (val: number) => {
    return (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatarData = (iso?: string) => {
    if (!iso) return '—';
    try {
      const safeIso = String(iso || '');
      const mesReferencia = (safeIso || '').substring(0, 7);
      if (!mesReferencia) return '—';
      const d = new Date(safeIso);
      if (isNaN(d.getTime())) return safeIso.substring(0, 10) || '—';
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return (iso || '').substring(0, 10) || '—';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header com Chaves de Navegação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </span>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
                Módulo Avançado de Tesouraria
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Operações de Conciliação Asaas & Snapshot Histórico de DRE
              </h2>
            </div>
          </div>
        </div>

        {/* Alternador de Abas */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 self-start sm:self-center">
          <button
            onClick={() => setAbaAtiva('CONCILIACAO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              abaAtiva === 'CONCILIACAO'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Fila de Conciliação Asaas</span>
          </button>
          <button
            onClick={() => setAbaAtiva('FECHAMENTO_DRE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              abaAtiva === 'FECHAMENTO_DRE'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Snowflake className="w-3.5 h-3.5" />
            <span>Fechamento & DRE Congelado</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-2 shadow-lg animate-fadeIn ${
            feedback.tipo === 'sucesso'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.tipo === 'sucesso' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{feedback.texto}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 1: FILA DE CONCILIAÇÃO ASAAS                                          */}
      {/* ========================================================================= */}
      {abaAtiva === 'CONCILIACAO' && (
        <div className="space-y-4">
          {/* Barra de Filtro e Atualização */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={buscaEvento}
                onChange={(e) => setBuscaEvento(e.target.value)}
                placeholder="Filtrar por ID, status ou ministro..."
                className="w-full h-9 pl-9 pr-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>

            <button
              onClick={carregarEventos}
              disabled={carregandoEventos}
              className="h-9 px-3 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/60 text-xs text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${carregandoEventos ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Sincronizar Fila</span>
            </button>
          </div>

          {/* Tabela de Transações */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] font-mono uppercase text-slate-400">
                    <th className="py-3 px-4">ID Transação Asaas</th>
                    <th className="py-3 px-4">Tipo / Canal</th>
                    <th className="py-3 px-4">Valor (BRL)</th>
                    <th className="py-3 px-4">Data Registro</th>
                    <th className="py-3 px-4">Status Conciliação</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {carregandoEventos ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500 font-mono">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-400 mb-2" />
                        Carregando transações da fila do gateway...
                      </td>
                    </tr>
                  ) : eventosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500 font-mono">
                        Nenhuma transação pendente ou registrada na fila de conciliação.
                      </td>
                    </tr>
                  ) : (
                    eventosFiltrados.map((ev) => {
                      const conciliado = ev.statusConciliacao === 'CONCILIADO_MANUAL' || ev.statusConciliacao === 'CONCILIADO_AUTOMATICO';
                      return (
                        <tr key={ev.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-cyan-300">
                            {ev.paymentId || ev.id}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300">
                            {ev.tipo}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                            {formatarMoeda(ev.valor)}
                          </td>
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                            {formatarData(ev.data)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                conciliado
                                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                                  : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                              }`}
                            >
                              {conciliado ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                              <span>{ev.statusConciliacao}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => abrirModalConciliar(ev)}
                              disabled={conciliado}
                              className={`h-7 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                conciliado
                                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                              }`}
                            >
                              {conciliado ? 'Conciliado' : 'Conciliar Manualmente'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: FECHAMENTO DE EXERCÍCIO & HISTÓRICO DRE CONGELADO                   */}
      {/* ========================================================================= */}
      {abaAtiva === 'FECHAMENTO_DRE' && (
        <div className="space-y-6">
          {/* Card de Ação: Congelar Exercício Contábil */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold">
                Procedimento Estatutário Anual
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Encerramento e Congelamento de Exercício Fiscal (DRE Imutável)
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Gera um snapshot contábil permanente com contabilidade inteira em centavos, bloqueando mutações posteriores para auditoria oficial.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={anoParaFechar}
                onChange={(e) => setAnoParaFechar(Number(e.target.value))}
                className="h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs font-bold focus:outline-none focus:border-cyan-400"
              >
                {[2024, 2025, 2026, 2027].map((a) => (
                  <option key={a} value={a}>
                    Exercício {a}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setModalFecharAberto(true)}
                className="h-10 px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-cyan-950/40 transition-all cursor-pointer shrink-0"
              >
                <Snowflake className="w-4 h-4" />
                <span>Congelar Exercício {anoParaFechar}</span>
              </button>
            </div>
          </div>

          {/* Lista de Snapshots Históricos */}
          <div className="space-y-4">
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>Exercícios Encerrados & Snapshots Congelados</span>
            </h4>

            {carregandoFechamentos ? (
              <div className="p-8 text-center text-slate-500 font-mono">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-cyan-400 mb-2" />
                Carregando fechamentos históricos...
              </div>
            ) : fechamentos.length === 0 ? (
              <div className="p-8 text-center text-slate-500 font-mono border border-slate-800 rounded-2xl bg-slate-900/40">
                Nenhum exercício fiscal congelado até o momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fechamentos.map((f) => (
                  <div
                    key={f.id}
                    className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-3">
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-[9px] font-bold">
                        {f.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono font-bold text-sm">
                        {f.anoExercicio}
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-white tracking-tight">
                          Demonstrativo Fiscal {f.anoExercicio}
                        </h5>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Fechado em {formatarData(f.fechadoEm)} por {f.fechadoPor}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                        <span className="text-[9px] text-slate-500 uppercase block">Faturamento Bruto</span>
                        <span className="text-white font-bold">
                          {formatarMoeda(f.faturamentoBrutoBrl || fromCents(f.faturamentoBrutoCentavos))}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                        <span className="text-[9px] text-slate-500 uppercase block">Faturamento Líquido</span>
                        <span className="text-emerald-400 font-bold">
                          {formatarMoeda(f.faturamentoLiquidoBrl || fromCents(f.faturamentoLiquidoCentavos))}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                        <span className="text-[9px] text-slate-500 uppercase block">Taxas Asaas / Gateway</span>
                        <span className="text-amber-400 font-bold">
                          {formatarMoeda(f.taxasGatewayBrl || fromCents(f.taxasGatewayCentavos))}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                        <span className="text-[9px] text-slate-500 uppercase block">Receita de Anuidades</span>
                        <span className="text-cyan-300 font-bold">
                          {formatarMoeda(fromCents(f.totalAnuidadesCentavos))}
                        </span>
                      </div>
                    </div>

                    {f.observacoes && (
                      <p className="text-[11px] text-slate-400 font-sans italic border-t border-slate-800/60 pt-2">
                        "{f.observacoes}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CONCILIAÇÃO MANUAL DE EVENTO ASAAS                               */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {modalConciliarAberto && eventoSelecionado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Conciliar Transação Asaas</h4>
                    <span className="text-[10px] font-mono text-cyan-400">
                      ID: {eventoSelecionado.paymentId || eventoSelecionado.id}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalConciliarAberto(false)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Valor Recebido:</span>
                  <span className="text-emerald-400 font-bold">{formatarMoeda(eventoSelecionado.valor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Data do Evento:</span>
                  <span className="text-slate-300">{formatarData(eventoSelecionado.data)}</span>
                </div>
              </div>

              <form onSubmit={lidarComSalvarConciliacao} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-bold mb-1 font-mono uppercase text-[10px]">
                    1. Vincular a Ministro Eclesiástico:
                  </label>
                  <select
                    value={ministroAlvoId}
                    onChange={(e) => {
                      setMinistroAlvoId(e.target.value);
                      if (e.target.value) setIgrejaAlvoId('');
                    }}
                    className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Selecione o ministro alvo --</option>
                    {ministros.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome} ({m.cargo}) · CPF: {m.cpf}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-center text-[10px] font-mono text-slate-500">OU</div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1 font-mono uppercase text-[10px]">
                    2. Vincular a Igreja Filiada:
                  </label>
                  <select
                    value={igrejaAlvoId}
                    onChange={(e) => {
                      setIgrejaAlvoId(e.target.value);
                      if (e.target.value) setMinistroAlvoId('');
                    }}
                    className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Selecione a igreja filiada alvo --</option>
                    {igrejasFiliadas.map((ig) => (
                      <option key={ig.id} value={ig.id}>
                        {ig.nomeFantasia || ig.razaoSocial} · CNPJ: {ig.cnpj}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1 font-mono uppercase text-[10px]">
                    Observações de Auditoria:
                  </label>
                  <textarea
                    rows={2}
                    value={observacaoConciliacao}
                    onChange={(e) => setObservacaoConciliacao(e.target.value)}
                    placeholder="Ex: Conciliado referente à taxa de filiação de obreiro transferido..."
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    disabled={salvandoConciliacao}
                    onClick={() => setModalConciliarAberto(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvandoConciliacao}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {salvandoConciliacao && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{salvandoConciliacao ? 'Gravando no Ledger...' : 'Confirmar Conciliação'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 2: CONFIRMAÇÃO DE CONGELAMENTO DE EXERCÍCIO FISCAL                  */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {modalFecharAberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md bg-slate-900 border border-cyan-500/40 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-cyan-400">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                  <Snowflake className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Congelar Exercício Fiscal {anoParaFechar}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">Operação com Snapshot Imutável</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Você está prestes a encerrar oficialmente as contas da convenção relativas ao ano de{' '}
                <strong className="text-white">{anoParaFechar}</strong>. Essa ação consolidará todos os pagamentos e receitas da AGO em centavos exatos.
              </p>

              <div className="space-y-1.5 text-xs">
                <label className="block text-slate-400 font-mono uppercase text-[10px]">
                  Observações Estatutárias do Fechamento:
                </label>
                <textarea
                  rows={2}
                  value={observacoesFechamento}
                  onChange={(e) => setObservacoesFechamento(e.target.value)}
                  placeholder="Ex: Parecer favorável do Conselho Fiscal em Sessão Ordinária..."
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  disabled={salvandoFechamento}
                  onClick={() => setModalFecharAberto(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={salvandoFechamento}
                  onClick={lidarComFecharExercicio}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {salvandoFechamento && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{salvandoFechamento ? 'Congelando Contas...' : 'Confirmar Encerramento'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
