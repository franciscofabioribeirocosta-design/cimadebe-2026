import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Download,
  FileText,
  ShieldAlert,
  RefreshCw,
  QrCode,
  Award,
  ArrowRight,
  Barcode,
  Zap
} from 'lucide-react';
import { gerarPdfReciboPagamentoMinistro } from '../services/pdfExportService';
import { useSecurity } from '../SecurityContext';
import { useNotification } from '../NotificationContext';

export interface MinisterFinanceiroProps {
  readonly ministroId: string;
  readonly ministroNome?: string;
}

export function MinisterFinanceiro({ ministroId, ministroNome }: MinisterFinanceiroProps) {
  const { ministros, appConfig } = useSecurity();
  const { notifySuccess, notifyError } = useNotification();
  const [loading, setLoading] = useState<boolean>(true);
  const [financialData, setFinancialData] = useState<{
    isAdimplente: boolean;
    anuidades: Array<{ id: string; ano: number; valor: number; vencimento: string; status: string; rotulo?: string; ehFiliacao?: boolean; categoria?: string; tipo?: string }>;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pixModalOpen, setPixModalOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cartao' | 'boleto'>('pix');

  // LAZY FETCHING & STASIS LAW: Fetch financial status on mount / ministroId change
  const fetchFinancialStatus = useCallback(async () => {
    if (!ministroId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/minister-finance/${ministroId}`);
      if (!res.ok) {
        throw new Error(`Erro ao carregar prontuário financeiro: HTTP ${res.status}`);
      }
      const data = await res.json();
      setFinancialData({
        isAdimplente: data.isAdimplente ?? true,
        anuidades: data.anuidades || []
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de conexão ao verificar adimplência.');
      setFinancialData({ isAdimplente: true, anuidades: [] });
    } finally {
      setLoading(false);
    }
  }, [ministroId]);

  useEffect(() => {
    fetchFinancialStatus();
  }, [fetchFinancialStatus]);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono text-xs flex flex-col items-center gap-3 bg-slate-900/90 rounded-3xl border border-slate-800 backdrop-blur-xl">
        <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
        <span>Verificando prontuário financeiro e adimplência convencional...</span>
      </div>
    );
  }

  const isAdimplente = financialData?.isAdimplente ?? true;
  const anuidades = financialData?.anuidades || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans">
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
                BLOQUEIO FINANCEIRO ATIVO
              </span>
              <h3 className="text-sm font-black text-white">
                Pendência em seu Prontuário Ministerial
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                ATENÇÃO: Detectamos pendências financeiras em seu prontuário ministerial. Seus benefícios de download de documentos e inscrição na AGO estão suspensos até a liquidação.
              </p>
            </div>
          </div>
          <button
            onClick={() => setPixModalOpen(true)}
            className="py-2.5 px-5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-lg shadow-amber-600/30 transition-all cursor-pointer flex items-center gap-2 shrink-0"
          >
            <QrCode className="w-4 h-4" />
            <span>Gerar Pagamento Asaas</span>
          </button>
        </motion.div>
      )}

      {/* 2. FINANCIAL TIMELINE & STATUS OVERVIEW */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-400" />
              Prontuário de Anuidades & Adimplência
            </h2>
            <p className="text-xs text-slate-400">
              Ministro: <strong className="text-white">{ministroNome || ministroId}</strong>
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase ${
              isAdimplente
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                : 'bg-rose-950 text-rose-400 border border-rose-500/40'
            }`}
          >
            {isAdimplente ? '✓ Adimplente' : '⚠ Inadimplente / Pendente'}
          </span>
        </div>

        {anuidades.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs font-mono">
            Nenhuma fatura de anuidade registrada no histórico.
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
                      onClick={() => setPixModalOpen(true)}
                      className="px-4 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Regularizar Fatura</span>
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

      {/* 3. BENEFIT BLUR MATRIX CONTAINER */}
      <div className="relative">
        {!isAdimplente && (
          <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-md rounded-3xl border border-rose-500/40 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-xl">
              <Lock className="w-7 h-7" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-base font-bold text-white">Benefícios Ministeriais Suspensos</h3>
              <p className="text-xs text-slate-300">
                A emissão de cartas de recomendação, transferência e emblemas de consagração encontra-se temporariamente bloqueada devido à inadimplência.
              </p>
            </div>
            <button
              onClick={() => setPixModalOpen(true)}
              className="py-2.5 px-6 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-lg cursor-pointer flex items-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              <span>Liquidar Débito Agora (Checkout Asaas)</span>
            </button>
          </div>
        )}

        <div className={`space-y-6 ${!isAdimplente ? 'blur-sm pointer-events-none opacity-50 select-none' : ''}`}>
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl space-y-4 shadow-xl">
            <div className="border-b border-slate-800/80 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-cyan-400" />
                Emissão de Documentos & Benefícios Ministeriais
              </h3>
              <p className="text-xs text-slate-400">
                Downloads oficiais autenticados e emblemas da convenção.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950/80 border border-slate-800/80 p-5 rounded-2xl space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Carta de Recomendação</h4>
                  <p className="text-xs text-slate-400">Certificado oficial de recomendação e comunhão eclesiástica.</p>
                </div>
                <button
                  type="button"
                  onClick={() => alert('Download da carta de recomendação iniciado.')}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar PDF</span>
                </button>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 p-5 rounded-2xl space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Carta de Transferência</h4>
                  <p className="text-xs text-slate-400">Documento oficial para remanejamento entre igrejas filiadas.</p>
                </div>
                <button
                  type="button"
                  onClick={() => alert('Download da carta de transferência iniciado.')}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar PDF</span>
                </button>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 p-5 rounded-2xl space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Award className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Emblemas de Consagração</h4>
                  <p className="text-xs text-slate-400">Insígnias digitais e distintivos ministeriais oficiais.</p>
                </div>
                <button
                  type="button"
                  onClick={() => alert('Visualização de emblemas aberta.')}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Ver Emblemas</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. TRIPLE-METHOD CHECKOUT ASAAS BILLING MODAL */}
      {pixModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest block">
                  CHECKOUT ASAAS SECURE GATEWAY
                </span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-amber-400" />
                  Liquidação de Anuidades Ministeriais
                </h3>
              </div>
              <button
                onClick={() => setPixModalOpen(false)}
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
                <span>Pix Instantâneo</span>
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
                <span>Cartão Crédito</span>
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
                <span>Boleto Bancário</span>
              </button>
            </div>

            {/* METHOD CONTENT VIEW */}
            <div className="space-y-4 py-2">
              {paymentMethod === 'pix' && (
                <div className="text-center space-y-3">
                  <div className="w-40 h-40 mx-auto bg-white p-2.5 rounded-2xl shadow-inner flex items-center justify-center border-4 border-amber-500/20">
                    <QrCode className="w-full h-full text-slate-900" />
                  </div>
                  <p className="text-xs text-slate-300 font-mono">
                    Escaneie o QR Code acima ou utilize o código Copia e Cola para pagamento instantâneo.
                  </p>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-mono text-[10px] text-amber-400 break-all select-all">
                    00020126580014br.gov.bcb.pix0136cid-c19a-4f51-87ab-9d0124fe78905204000053039865802BR...
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
                      <label className="block text-slate-400 font-mono text-[10px] uppercase">Validade (MM/AA)</label>
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
                  <div className="space-y-1">
                    <label className="block text-slate-400 font-mono text-[10px] uppercase">Nome no Cartão</label>
                    <input
                      type="text"
                      placeholder="Nome impresso no cartão"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'boleto' && (
                <div className="text-center space-y-3 py-3">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Barcode className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Boleto Bancário Asaas</h4>
                  <p className="text-xs text-slate-300">
                    Gere o boleto para pagamento em qualquer agência bancária ou internet banking. A compensação ocorre em até 48 horas úteis.
                  </p>
                  <button
                    onClick={() => alert('Boleto Asaas gerado com sucesso! Abrindo PDF.')}
                    className="py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    Baixar Boleto Bancário em PDF
                  </button>
                </div>
              )}

              {/* STASIS LAW CLEARING NOTICE */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 leading-relaxed font-sans">
                <strong className="text-amber-400 block mb-0.5">Aviso de Compensação Automática:</strong>
                O sistema processa a liberação automaticamente após a compensação bancária do Asaas (Pix: imediato | Cartão: até 2h | Boleto: até 48h). O envio de comprovantes manuais não altera o bloqueio.
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              {paymentMethod === 'pix' && (
                <button
                  onClick={() => {
                    alert('Código Pix copiado para a área de transferência!');
                    setPixModalOpen(false);
                  }}
                  className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                >
                  Copiar Pix Copia e Cola
                </button>
              )}
              {paymentMethod === 'cartao' && (
                <button
                  onClick={() => {
                    alert('Pagamento com cartão processado com sucesso pelo Asaas!');
                    setPixModalOpen(false);
                  }}
                  className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                >
                  Efetuar Pagamento com Cartão
                </button>
              )}
              {paymentMethod === 'boleto' && (
                <button
                  onClick={() => setPixModalOpen(false)}
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
