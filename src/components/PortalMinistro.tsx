import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  ShieldAlert,
  Lock,
  QrCode,
  Barcode,
  Zap,
  RefreshCw,
  FileText,
  Award,
  Download,
  CheckCircle2,
  Calendar,
  User,
  LogOut,
  Tag,
  ShieldCheck,
  Bell,
  Clock,
  MapPin
} from 'lucide-react';
import { gerarPdfReciboPagamentoMinistro } from '../services/pdfExportService';
import { useSecurity } from '../SecurityContext';
import { useNotification } from '../NotificationContext';

export interface PortalMinistroProps {
  readonly ministroId: string;
  readonly ministroNome?: string;
  readonly onLogout?: () => void;
}

export function PortalMinistro({ ministroId, ministroNome, onLogout }: PortalMinistroProps) {
  const { ministros, appConfig } = useSecurity();
  const { notifySuccess, notifyError } = useNotification();
  const [loading, setLoading] = useState<boolean>(true);
  const [financialData, setFinancialData] = useState<{
    isAdimplente: boolean;
    anuidades: Array<{ id: string; ano: number; valor: number; vencimento: string; status: string; rotulo?: string; ehFiliacao?: boolean; categoria?: string; tipo?: string }>;
    cargo?: string;
    genero?: string;
    agoHistory?: Array<{ id: string; ano: number; statusInscricao: 'VALIDA' | 'REVOGADA' | 'PENDENTE'; valor: number }>;
    consagracoes?: Array<{ id: string; titulo: string; data: string; igreja: string }>;
    notificacoes?: Array<{ id: string; titulo: string; mensagem: string; data: string; lida: boolean }>;
    cronogramaAgo?: Array<{ id: string; horario: string; atividade: string; local: string }>;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'financeiro' | 'inscricao_ago' | 'documentos' | 'emblemas' | 'notificacoes' | 'cronograma'>('financeiro');
  const [checkoutModalOpen, setCheckoutModalOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cartao' | 'boleto'>('pix');
  const [ordenacaoSelected, setOrdenacaoSelected] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // LAZY FETCHING & STASIS LAW: Fetch financial status and minister profile on mount
  const fetchMinisterPortalData = useCallback(async () => {
    if (!ministroId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/minister-finance/${ministroId}`);
      if (!res.ok) {
        throw new Error(`Falha ao carregar prontuário: HTTP ${res.status}`);
      }
      const data = await res.json();
      setFinancialData({
        isAdimplente: data.isAdimplente ?? true,
        anuidades: data.anuidades || [],
        cargo: data.cargo || data.ministerRole || 'Pastor',
        genero: data.genero || data.gender || 'Masculino',
        agoHistory: data.agoHistory || [],
        consagracoes: data.consagracoes || [],
        notificacoes: data.notificacoes || [],
        cronogramaAgo: data.cronogramaAgo || []
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de conexão ao carregar portal.');
      setFinancialData({
        isAdimplente: true,
        anuidades: [],
        cargo: 'Pastor',
        genero: 'Masculino',
        agoHistory: [],
        consagracoes: [],
        notificacoes: [],
        cronogramaAgo: []
      });
    } finally {
      setLoading(false);
    }
  }, [ministroId]);

  useEffect(() => {
    fetchMinisterPortalData();
  }, [fetchMinisterPortalData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
        <div className="p-12 text-center text-slate-400 font-mono text-xs flex flex-col items-center gap-3 bg-slate-900/90 rounded-3xl border border-slate-800 backdrop-blur-xl shadow-2xl">
          <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
          <span>Carregando Portal do Ministro & Central de Notificações...</span>
        </div>
      </div>
    );
  }

  const isAdimplente = financialData?.isAdimplente ?? true;
  const anuidades = financialData?.anuidades || [];
  const cargo = financialData?.cargo || 'Pastor';
  const genero = financialData?.genero || 'Masculino';
  const agoHistory = financialData?.agoHistory || [];
  const consagracoes = financialData?.consagracoes || [];
  const notificacoes = financialData?.notificacoes || [];
  const cronogramaAgo = financialData?.cronogramaAgo || [];

  // AUTOMATIC PRICE MAPPING RULES
  let planTitle = 'Plano Geral de Inscrição AGO';
  let planPrice = 150.00;
  let planDescription = 'Inscrição oficial com direito a credencial física e crachá digital.';

  if (cargo === 'Pastor') {
    planTitle = 'Plano Ministerial Exclusivo - Pastor Presidente/Titular';
    planPrice = 180.00;
    planDescription = 'Inscrição integral com acesso à plenária e mesa diretora.';
  } else if (cargo === 'Evangelista' || cargo === 'Presbitero') {
    planTitle = `Plano ${cargo} - Convenção Geral`;
    planPrice = ordenacaoSelected ? 220.00 : 130.00;
    planDescription = ordenacaoSelected
      ? 'Inclui taxa especial de Ordenação e Credenciamento Consagrado.'
      : 'Inscrição padrão para obreiros e oficiais.';
  } else if (genero === 'Feminino' || cargo === 'Missionaria') {
    planTitle = 'Plano Especial - Círculo de Oração & Missionárias';
    planPrice = 110.00;
    planDescription = 'Inscrição dedicada ao congresso de mulheres e consagração missionária.';
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Topbar do Portal do Ministro */}
      <header className="sticky top-0 z-40 bg-slate-950/95 border-b border-slate-800/80 backdrop-blur-xl px-4 sm:px-8 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
            <User className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest block">
              PORTAL DO MINISTRO • SECURE WORKSPACE
            </span>
            <h1 className="text-sm font-bold text-white">
              {ministroNome || ministroId} ({cargo})
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase ${
              isAdimplente
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                : 'bg-rose-950 text-rose-400 border border-rose-500/40'
            }`}
          >
            {isAdimplente ? '✓ Adimplente' : '⚠ Inadimplente'}
          </span>
          {onLogout && (
            <button
              onClick={onLogout}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/80 border border-slate-800 text-slate-300 hover:text-rose-300 text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* 1. NOTIFICATION BANNER FOR INADIMPLÊNCIA */}
        {!isAdimplente && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-3xl bg-gradient-to-r from-rose-950/90 via-amber-950/90 to-slate-900/90 border border-rose-500/50 shadow-[0_0_30px_rgba(244,63,94,0.25)] backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold text-rose-400 uppercase tracking-widest">
                  PENDÊNCIA FINANCEIRA DETECTADA
                </span>
                <h3 className="text-sm font-black text-white">
                  Prontuário com Anuidades Pendentes
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  ATENÇÃO: Existem pendências financeiras em seu prontuário. Seus benefícios de download de documentos e inscrição na AGO estão suspensos.
                </p>
              </div>
            </div>
            <button
              onClick={() => setCheckoutModalOpen(true)}
              className="py-2.5 px-5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-lg shadow-amber-600/30 transition-all cursor-pointer flex items-center gap-2 shrink-0"
            >
              <QrCode className="w-4 h-4" />
              <span>Regularizar via Asaas</span>
            </button>
          </motion.div>
        )}

        {/* Navigation Tabs (6 Tabs) */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-slate-900/90 p-2 rounded-2xl border border-slate-800/80 backdrop-blur-xl">
          <button
            onClick={() => setActiveTab('financeiro')}
            className={`py-3 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'financeiro'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span className="truncate">Prontuário</span>
          </button>
          <button
            onClick={() => setActiveTab('inscricao_ago')}
            className={`py-3 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'inscricao_ago'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span className="truncate">Inscrição AGO</span>
          </button>
          <button
            onClick={() => setActiveTab('documentos')}
            className={`py-3 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'documentos'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="truncate">Documentos</span>
          </button>
          <button
            onClick={() => setActiveTab('emblemas')}
            className={`py-3 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'emblemas'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Award className="w-4 h-4 shrink-0" />
            <span className="truncate">Emblemas</span>
          </button>
          <button
            onClick={() => setActiveTab('notificacoes')}
            className={`py-3 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'notificacoes'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Bell className="w-4 h-4 shrink-0" />
            <span className="truncate">Notificações</span>
          </button>
          <button
            onClick={() => setActiveTab('cronograma')}
            className={`py-3 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'cronograma'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span className="truncate">Cronograma</span>
          </button>
        </div>

        {/* TAB 1: PRONTUÁRIO FINANCEIRO */}
        {activeTab === 'financeiro' && (
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-cyan-400" />
                  Histórico de Faturas & Anuidades
                </h2>
                <p className="text-xs text-slate-400">
                  Gerenciamento de pagamentos integrados via Gateway Asaas.
                </p>
              </div>
              <button
                onClick={() => setCheckoutModalOpen(true)}
                className="py-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow"
              >
                <QrCode className="w-4 h-4" />
                <span>Abrir Checkout Asaas</span>
              </button>
            </div>

            {anuidades.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs font-mono">
                Nenhuma anuidade encontrada no histórico.
              </div>
            ) : (
              <div className="space-y-2">
                {anuidades.map((item) => {
                  const isPago = item.status === 'PAGO';
                  return (
                    <div
                      key={item.id}
                      className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
                            isPago
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {item.ano}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">
                              {item.rotulo || (item.ehFiliacao || item.categoria === 'TAXA_CONVENCAO' || item.tipo === 'FILIACAO' || item.id?.startsWith('an-fil-')
                                ? 'Taxa de Filiação'
                                : `Anuidade ${item.ano}`)}
                            </h4>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                isPago ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                              }`}
                            >
                              {item.status === 'ABERTO' ? 'Em Aberto' : item.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono">
                            Vencimento: {item.vencimento || 'N/D'} • R$ {Number(item.valor || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {!isPago ? (
                        <button
                          onClick={() => setCheckoutModalOpen(true)}
                          className="px-4 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Pagar Fatura</span>
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            const ministro = ministros.find((m) => m.id === ministroId) || {
                              id: ministroId,
                              nome: ministroNome || 'Ministro',
                              cpf: '000.000.000-00',
                              cargo: 'Pastor',
                              tenantId: 't-sede-salvador',
                            } as any;

                            try {
                              await gerarPdfReciboPagamentoMinistro({
                                ministro,
                                anuidade: {
                                  id: item.id,
                                  anoVigente: item.ano,
                                  valor: item.valor,
                                  statusPagamento: 'PAGO',
                                  ehFiliacao: item.ehFiliacao,
                                  rotulo: item.rotulo,
                                  dataPagamento: new Date().toISOString(),
                                },
                                appConfig,
                              });
                              notifySuccess('Recibo Gerado', `Recibo do exercício ${item.ano} baixado em PDF com sucesso.`);
                            } catch (err: any) {
                              notifyError('Erro ao Gerar Recibo', err?.message || 'Falha ao processar recibo.');
                            }
                          }}
                          className="px-3.5 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                          title="Baixar Recibo Oficial de Quitação em PDF"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Gerar Recibo</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INSCRIÇÃO & MATRÍCULA NA AGO */}
        {activeTab === 'inscricao_ago' && (
          <div className="relative">
            {!isAdimplente && (
              <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-md rounded-3xl border border-rose-500/40 flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-xl">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="max-w-md space-y-1">
                  <h3 className="text-base font-bold text-white">Inscrição AGO Suspensa</h3>
                  <p className="text-xs text-slate-300">
                    Sua inscrição na Assembleia Geral Ordinária está bloqueada devido a pendências no prontuário financeiro.
                  </p>
                </div>
                <button
                  onClick={() => setCheckoutModalOpen(true)}
                  className="py-2.5 px-6 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-lg cursor-pointer flex items-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Regularizar Débito Agora</span>
                </button>
              </div>
            )}

            <div className={`space-y-6 ${!isAdimplente ? 'blur-sm pointer-events-none opacity-50 select-none' : ''}`}>
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl space-y-5 shadow-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest block">
                      MATRIZ DE PRECIFICAÇÃO POR CARGO E PERFIL
                    </span>
                    <h2 className="text-base font-bold text-white">Inscrição AGO 2026 - Credenciamento Oficial</h2>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-500/40 text-xs font-mono font-bold">
                    Cargo: {cargo} ({genero})
                  </span>
                </div>

                <div className="bg-slate-950/80 border border-slate-800/80 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-amber-400" />
                      <h4 className="text-sm font-bold text-white">{planTitle}</h4>
                    </div>
                    <p className="text-xs text-slate-400">{planDescription}</p>

                    {(cargo === 'Evangelista' || cargo === 'Presbitero') && (
                      <label className="flex items-center gap-2 pt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ordenacaoSelected}
                          onChange={(e) => setOrdenacaoSelected(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                        />
                        <span className="text-xs text-slate-300 font-mono">
                          Adicionar taxa de Ordenação / Consagração (+R$ 90,00)
                        </span>
                      </label>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Valor do Plano</span>
                    <span className="text-2xl font-black text-white font-mono">
                      R$ {planPrice.toFixed(2)}
                    </span>
                    <button
                      onClick={() => setCheckoutModalOpen(true)}
                      className="mt-2 py-2.5 px-5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-orange-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Inscrever-se na AGO</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl space-y-4 shadow-xl">
                <div className="border-b border-slate-800 pb-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-400" />
                    Histórico de Inscrições AGO & Downloads de Crachá
                  </h3>
                  <p className="text-xs text-slate-400">
                    Acompanhe suas participações anteriores e baixe seu crachá autenticado.
                  </p>
                </div>

                {agoHistory.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs font-mono">
                    Nenhum registro histórico de AGO encontrado.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {agoHistory.map((item) => {
                      const isValid = item.statusInscricao === 'VALIDA';
                      return (
                        <div
                          key={item.id}
                          className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
                                isValid
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {item.ano}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-white">Assembleia Geral Ordinária - {item.ano}</h4>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                    isValid ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                                  }`}
                                >
                                  {item.statusInscricao}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 font-mono">
                                Taxa: R$ {Number(item.valor || planPrice).toFixed(2)}
                              </p>
                            </div>
                          </div>

                          <div>
                            {isValid ? (
                              <a
                                href={`/api/supermaster/download/cracha?memberId=${ministroId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="py-2.5 px-4 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-lg"
                              >
                                <Download className="w-4 h-4" />
                                <span>Baixar Crachá / Credencial</span>
                              </a>
                            ) : (
                              <button
                                disabled
                                className="py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 font-bold text-xs blur-xs pointer-events-none opacity-40 flex items-center gap-2"
                              >
                                <Lock className="w-4 h-4" />
                                <span>Baixar Crachá / Credencial</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AUTOATENDIMENTO DE DOCUMENTOS */}
        {activeTab === 'documentos' && (
          <div className="relative">
            {!isAdimplente && (
              <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-md rounded-3xl border border-rose-500/40 flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-xl">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="max-w-md space-y-1">
                  <h3 className="text-base font-bold text-white">Autoatendimento Suspenso</h3>
                  <p className="text-xs text-slate-300">
                    O download de cartas e certificados está bloqueado até a quitação das anuidades pendentes.
                  </p>
                </div>
                <button
                  onClick={() => setCheckoutModalOpen(true)}
                  className="py-2.5 px-6 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-lg cursor-pointer flex items-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Regularizar Débito Agora</span>
                </button>
              </div>
            )}

            <div className={`space-y-6 ${!isAdimplente ? 'blur-xs pointer-events-none opacity-40 select-none' : ''}`}>
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl space-y-5 shadow-xl">
                <div className="border-b border-slate-800 pb-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-cyan-400" />
                    Autoatendimento de Documentos Ministeriais (PDF)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Emissão instantânea de cartas autenticadas com assinatura criptográfica da convenção.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-950/80 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                        <FileText className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-bold text-white">Carta de Recomendação</h4>
                      <p className="text-xs text-slate-400">Certificado oficial de comunhão e boa estância eclesiástica.</p>
                    </div>
                    {isAdimplente ? (
                      <a
                        href={`/api/supermaster/download/recomendacao?memberId=${ministroId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                      >
                        <Download className="w-4 h-4" />
                        <span>Baixar Recomendação (PDF)</span>
                      </a>
                    ) : (
                      <div className="w-full py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 font-bold text-xs text-center blur-xs pointer-events-none opacity-40">
                        Bloqueado por Inadimplência
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <FileText className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-bold text-white">Carta de Transferência</h4>
                      <p className="text-xs text-slate-400">Documento oficial para remanejamento entre igrejas filiadas.</p>
                    </div>
                    {isAdimplente ? (
                      <a
                        href={`/api/supermaster/download/transferencia?memberId=${ministroId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                      >
                        <Download className="w-4 h-4" />
                        <span>Baixar Transferência (PDF)</span>
                      </a>
                    ) : (
                      <div className="w-full py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 font-bold text-xs text-center blur-xs pointer-events-none opacity-40">
                        Bloqueado por Inadimplência
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-bold text-white">Certificado de Regularidade</h4>
                      <p className="text-xs text-slate-400">Comprovante de quitação anual e adimplência convencional.</p>
                    </div>
                    {isAdimplente ? (
                      <a
                        href={`/api/supermaster/download/regularidade?memberId=${ministroId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                      >
                        <Download className="w-4 h-4" />
                        <span>Baixar Regularidade (PDF)</span>
                      </a>
                    ) : (
                      <div className="w-full py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 font-bold text-xs text-center blur-xs pointer-events-none opacity-40">
                        Bloqueado por Inadimplência
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ESTANTE DE EMBLEMAS */}
        {activeTab === 'emblemas' && (
          <div className="relative">
            {!isAdimplente && (
              <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-md rounded-3xl border border-rose-500/40 flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-xl">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="max-w-md space-y-1">
                  <h3 className="text-base font-bold text-white">Estante de Emblemas Bloqueada</h3>
                  <p className="text-xs text-slate-300">
                    A visualização de títulos e insígnias ministeriais está restrita até a regularização da adimplência.
                  </p>
                </div>
                <button
                  onClick={() => setCheckoutModalOpen(true)}
                  className="py-2.5 px-6 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-lg cursor-pointer flex items-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Regularizar Débito Agora</span>
                </button>
              </div>
            )}

            <div className={`space-y-6 ${!isAdimplente ? 'blur-md pointer-events-none opacity-50 select-none' : ''}`}>
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl space-y-5 shadow-xl">
                <div className="border-b border-slate-800 pb-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    Estante de Emblemas & Títulos Ministeriais
                  </h3>
                  <p className="text-xs text-slate-400">
                    Insígnias digitais oficiais, patentes e histórico de consagrações registradas.
                  </p>
                </div>

                {consagracoes.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs font-mono">
                    Nenhum título de consagração histórico registrado na estante.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {consagracoes.map((item) => (
                      <div
                        key={item.id}
                        className="bg-slate-950/80 border border-amber-500/30 p-5 rounded-2xl space-y-3 relative overflow-hidden shadow-lg"
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none" />
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow">
                            <Award className="w-6 h-6" />
                          </div>
                          <div>
                            <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest block">
                              TÍTULO OFICIAL
                            </span>
                            <h4 className="text-sm font-bold text-white">{item.titulo}</h4>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 space-y-1">
                          <div className="flex justify-between">
                            <span>Data:</span>
                            <span className="text-slate-200">{item.data || 'N/D'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Igreja / Sede:</span>
                            <span className="text-slate-200 truncate max-w-[150px]">{item.igreja || 'Convenção'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CENTRAL DE NOTIFICAÇÕES (MODULE 5) */}
        {activeTab === 'notificacoes' && (
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-cyan-400" />
                  Central de Notificações Ativas
                </h2>
                <p className="text-xs text-slate-400">
                  Avisos oficiais da secretaria e comunicados convencionais.
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase ${
                  isAdimplente
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                    : 'bg-rose-950 text-rose-400 border border-rose-500/40'
                }`}
              >
                {isAdimplente ? 'EM DIA' : 'PENDENTE'}
              </span>
            </div>

            {/* Force-inject permanent amber/rose notice if isAdimplente === false */}
            {!isAdimplente && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/90 to-amber-950/90 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                <span>Pendente: Regularize seu prontuário financeiro para reativar o acesso de autoatendimento documental.</span>
              </div>
            )}

            {notificacoes.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs font-mono">
                {isAdimplente ? '' : ''}
                Nenhuma notificação adicional registrada no momento.
              </div>
            ) : (
              <div className="space-y-3">
                {notificacoes.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white">{item.titulo}</h4>
                      <span className="text-[10px] font-mono text-slate-400">{item.data || 'Hoje'}</span>
                    </div>
                    <p className="text-xs text-slate-300">{item.mensagem}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: CRONOGRAMA DA AGO (MODULE 6) */}
        {activeTab === 'cronograma' && (
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl space-y-5 shadow-xl">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                Cronograma Oficial da AGO 2026
              </h2>
              <p className="text-xs text-slate-400">
                Programação da plenária, sessões e consagrações ministeriais.
              </p>
            </div>

            {cronogramaAgo.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs font-mono">
                Nenhum evento agendado no cronograma oficial da AGO no momento.
              </div>
            ) : (
              <div className="relative border-l border-slate-800 ml-3 space-y-6 py-2">
                {cronogramaAgo.map((item) => (
                  <div key={item.id} className="relative pl-6 space-y-1">
                    <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-cyan-500 border-2 border-slate-950 shadow" />
                    <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.5 rounded">
                      {item.horario}
                    </span>
                    <h4 className="text-sm font-bold text-white pt-1">{item.atividade}</h4>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 pt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-400" />
                      <span>{item.local || 'Auditório Principal'}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* TRIPLE-METHOD CHECKOUT MODAL (Asaas) */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest block">
                  ASAAS SECURE CHECKOUT
                </span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-amber-400" />
                  Pagamento de Anuidades / AGO
                </h3>
              </div>
              <button
                onClick={() => setCheckoutModalOpen(false)}
                className="text-slate-400 hover:text-white font-mono text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* TRIPLE-METHOD SELECTOR TABS */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
              <button
                onClick={() => setPaymentMethod('pix')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  paymentMethod === 'pix'
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Pix</span>
              </button>
              <button
                onClick={() => setPaymentMethod('cartao')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  paymentMethod === 'cartao'
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Cartão</span>
              </button>
              <button
                onClick={() => setPaymentMethod('boleto')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  paymentMethod === 'boleto'
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Barcode className="w-3.5 h-3.5" />
                <span>Boleto</span>
              </button>
            </div>

            {/* METHOD CONTENT */}
            <div className="space-y-4 py-2">
              {paymentMethod === 'pix' && (
                <div className="text-center space-y-3">
                  <div className="w-36 h-36 mx-auto bg-white p-2.5 rounded-2xl shadow-inner flex items-center justify-center border-4 border-amber-500/20">
                    <QrCode className="w-full h-full text-slate-900" />
                  </div>
                  <p className="text-xs text-slate-300 font-mono">
                    Escaneie o QR Code ou utilize o Pix Copia e Cola.
                  </p>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-mono text-[10px] text-amber-400 break-all select-all">
                    00020126580014br.gov.bcb.pix0136asaas-portal-ministro-gateway-secure...
                  </div>
                </div>
              )}

              {paymentMethod === 'cartao' && (
                <div className="space-y-3 font-sans text-xs">
                  <div className="space-y-1">
                    <label className="block text-slate-400 font-mono text-[10px] uppercase">Número do Cartão</label>
                    <input
                      type="text"
                      placeholder="0000 0000 0000 0000"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-slate-400 font-mono text-[10px] uppercase">Validade</label>
                      <input
                        type="text"
                        placeholder="MM/AA"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-slate-400 font-mono text-[10px] uppercase">CVV</label>
                      <input
                        type="password"
                        placeholder="123"
                        maxLength={4}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'boleto' && (
                <div className="text-center space-y-3 py-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Barcode className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Boleto Bancário Asaas</h4>
                  <p className="text-xs text-slate-300">
                    Gere o boleto em PDF para pagamento bancário.
                  </p>
                  <button
                    onClick={() => alert('Boleto Asaas gerado com sucesso!')}
                    className="py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    Baixar Boleto Bancário (PDF)
                  </button>
                </div>
              )}

              {/* WARNING NOTICE */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 leading-relaxed font-sans">
                <strong className="text-amber-400 block mb-0.5">Aviso de Compensação:</strong>
                A liberação ocorre automaticamente após a compensação do Asaas.
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              {paymentMethod === 'pix' && (
                <button
                  onClick={() => {
                    alert('Chave Pix copiada para a área de transferência!');
                    setCheckoutModalOpen(false);
                  }}
                  className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                >
                  Copiar Pix Copia e Cola
                </button>
              )}
              {paymentMethod === 'cartao' && (
                <button
                  onClick={() => {
                    alert('Pagamento via cartão processado!');
                    setCheckoutModalOpen(false);
                  }}
                  className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                >
                  Efetuar Pagamento com Cartão
                </button>
              )}
              {paymentMethod === 'boleto' && (
                <button
                  onClick={() => setCheckoutModalOpen(false)}
                  className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Fechar Janela
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default PortalMinistro;
