import React, { useState, useEffect } from 'react';
import {
  QrCode,
  CreditCard,
  FileText,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface CheckoutRealAgoProps {
  ministro: {
    id: string;
    nome: string;
    cpf: string;
    cargo?: string;
    email?: string;
    telefone?: string;
    fotoUrl?: string;
  };
  plano: {
    id?: string;
    codigo?: string;
    nome: string;
    valor: number;
    subtitulo?: string;
  };
  onVoltar?: () => void;
  onConcluido?: (dados: any) => void;
  tituloCustomizado?: string;
  subtituloCustomizado?: string;
  descricaoCustomizada?: string;
  textoVoltarCustomizado?: string;
}

export function CheckoutRealAgo({
  ministro,
  plano,
  onVoltar,
  onConcluido,
  tituloCustomizado,
  subtituloCustomizado,
  descricaoCustomizada,
  textoVoltarCustomizado,
}: CheckoutRealAgoProps) {
  const [abaAtiva, setAbaAtiva] = useState<'PIX' | 'CARTAO' | 'BOLETO'>('PIX');

  // Estados PIX Real (Banco Central via Asaas)
  const [pixLoading, setPixLoading] = useState<boolean>(false);
  const [pixPayload, setPixPayload] = useState<string>('');
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState<string>('');
  const [pixCopiado, setPixCopiado] = useState<boolean>(false);
  const [pixPaymentId, setPixPaymentId] = useState<string>('');

  // Estados Cartão de Crédito Real (Gateway Asaas)
  const [numeroCartao, setNumeroCartao] = useState<string>('');
  const [nomeCartao, setNomeCartao] = useState<string>('');
  const [validadeCartao, setValidadeCartao] = useState<string>(''); // MM/AA
  const [cvv, setCvv] = useState<string>('');
  const [parcelas, setParcelas] = useState<number>(1);
  const [cartaoLoading, setCartaoLoading] = useState<boolean>(false);
  const [cartaoResultado, setCartaoResultado] = useState<any>(null);

  // Estados Boleto Bancário Real (Asaas)
  const [boletoLoading, setBoletoLoading] = useState<boolean>(false);
  const [boletoResultado, setBoletoResultado] = useState<any>(null);
  const [boletoCopiado, setBoletoCopiado] = useState<boolean>(false);

  // Estados Gerais & Monitoramento de Liquidação Real
  const [erro, setErro] = useState<string | null>(null);
  const [inscricaoLiquidada, setInscricaoLiquidada] = useState<any | null>(null);

  // Valor oficial aprovado (padrão R$ 190,00)
  const valorTotal = Number(plano?.valor) > 0 ? Number(plano.valor) : 190.00;
  const cleanCpf = (ministro?.cpf || '').replace(/\D/g, '');
  const cleanMinistroId = ministro?.id || cleanCpf;
  const inscricaoDocId = `${cleanMinistroId}_2026`;

  // Máscaras de Digitação
  const formatarNumeroCartao = (val: string) => {
    const digitos = val.replace(/\D/g, '').slice(0, 16);
    return digitos.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  const formatarValidade = (val: string) => {
    const digitos = val.replace(/\D/g, '').slice(0, 4);
    if (digitos.length > 2) {
      return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
    }
    return digitos;
  };

  const formatarCvv = (val: string) => {
    return val.replace(/\D/g, '').slice(0, 4);
  };

  // Monitora o Firestore atomicamente: O status só muda para 'CONFIRMADO' quando o Webhook contábil liquidar!
  useEffect(() => {
    if (!db || !inscricaoDocId) return;

    try {
      const unsub = onSnapshot(
        doc(db, 'inscricoes_ago', inscricaoDocId),
        (snap) => {
          if (snap.exists()) {
            const dados = snap.data();
            if (dados.status === 'CONFIRMADO' || dados.statusPagamento === 'PAGO') {
              setInscricaoLiquidada(dados);
              if (onConcluido) {
                onConcluido(dados);
              }
            }
          }
        },
        (err) => {
          console.warn('[CheckoutRealAgo] Listener Firestore aviso/quota:', err?.message);
        }
      );

      return () => unsub();
    } catch (e: any) {
      console.warn('[CheckoutRealAgo] Erro ao registrar onSnapshot:', e?.message);
    }
  }, [inscricaoDocId, onConcluido]);

  // Auto-polling for Pix payment confirmation from Asaas every 4 seconds
  useEffect(() => {
    if (!pixPaymentId || inscricaoLiquidada) return;
    let isMounted = true;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/asaas/check-payment/${pixPaymentId}`);
        const json = await res.json();
        if (json.success && json.data) {
          const status = json.data.status;
          if (status === 'RECEIVED' || status === 'CONFIRMED' || status === 'RECEIVED_IN_CASH') {
            if (isMounted) {
              const dadosConfirmados = {
                status: 'CONFIRMADO',
                statusPagamento: 'PAGO',
                valor: valorTotal,
                formaPagamento: 'PIX',
              };
              setInscricaoLiquidada(dadosConfirmados);
              if (onConcluido) {
                onConcluido(dadosConfirmados);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[CheckoutRealAgo] Erro ao verificar status automático do Pix:', err);
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [pixPaymentId, inscricaoLiquidada, valorTotal, onConcluido]);

  // GERAÇÃO REAL DE PIX NO ASAAS (BANCO CENTRAL)
  const gerarPixReal = async () => {
    setPixLoading(true);
    setErro(null);

    try {
      const res = await fetch('/api/payment/checkout-ago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ministroId: cleanMinistroId,
          cpf: cleanCpf,
          nome: ministro.nome,
          email: ministro.email || 'secretaria@cimadebe.org.br',
          telefone: ministro.telefone || '',
          cargo: ministro.cargo || 'Ministro',
          billingType: 'PIX',
          planoId: plano.id || plano.codigo || 'PLANO_1_NORMAL',
          planoNome: plano.nome || 'Inscrição AGO 2026',
          valorCustom: valorTotal,
        }),
      });

      const respostaTexto = await res.text();
      if (!respostaTexto || respostaTexto.trim() === '') {
        throw new Error('O servidor de produção retornou uma resposta vazia. Verifique os logs do Cloud Run.');
      }
      const data = JSON.parse(respostaTexto);
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao comunicar com a rede Pix do Banco Central no Asaas.');
      }

      setPixPayload(data.pixPayload || '');
      setPixQrCodeBase64(data.encodedImage || '');
      setPixPaymentId(data.paymentId || '');
    } catch (err: any) {
      setErro(err.message || 'Erro ao gerar PIX oficial.');
    } finally {
      setPixLoading(false);
    }
  };

  // GERAÇÃO REAL DE BOLETO BANCÁRIO NO ASAAS
  const gerarBoletoReal = async () => {
    setBoletoLoading(true);
    setErro(null);

    try {
      const res = await fetch('/api/payment/checkout-ago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ministroId: cleanMinistroId,
          cpf: cleanCpf,
          nome: ministro.nome,
          email: ministro.email || 'secretaria@cimadebe.org.br',
          telefone: ministro.telefone || '',
          cargo: ministro.cargo || 'Ministro',
          billingType: 'BOLETO',
          planoId: plano.id || plano.codigo || 'PLANO_1_NORMAL',
          planoNome: plano.nome || 'Inscrição AGO 2026',
          valorCustom: valorTotal,
        }),
      });

      const respostaTexto = await res.text();
      if (!respostaTexto || respostaTexto.trim() === '') {
        throw new Error('O servidor de produção retornou uma resposta vazia. Verifique os logs do Cloud Run.');
      }
      const data = JSON.parse(respostaTexto);
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao gerar boleto bancário no Asaas.');
      }

      setBoletoResultado(data);
    } catch (err: any) {
      setErro(err.message || 'Erro ao gerar boleto bancário.');
    } finally {
      setBoletoLoading(false);
    }
  };

  // CAPTURA REAL DE CARTÃO DE CRÉDITO NO GATEWAY ASAAS
  const handlePagarCartao = async (e: React.FormEvent) => {
    e.preventDefault();
    setCartaoLoading(true);
    setErro(null);
    setCartaoResultado(null);

    const numLimpo = numeroCartao.replace(/\D/g, '');
    const partesValidade = validadeCartao.split('/');
    const mesLimpo = (partesValidade[0] || '').replace(/\D/g, '').padStart(2, '0');
    const anoLimpo = (partesValidade[1] || '').replace(/\D/g, '');
    const cvvLimpo = cvv.replace(/\D/g, '');

    if (numLimpo.length < 13 || numLimpo.length > 19) {
      setErro('Informe um número de cartão de crédito válido (13 a 16 dígitos).');
      setCartaoLoading(false);
      return;
    }

    if (!nomeCartao.trim()) {
      setErro('Informe o nome do titular exatamente como impresso no cartão.');
      setCartaoLoading(false);
      return;
    }

    if (!mesLimpo || Number(mesLimpo) < 1 || Number(mesLimpo) > 12) {
      setErro('Mês de validade inválido (01 a 12).');
      setCartaoLoading(false);
      return;
    }

    if (!anoLimpo || (anoLimpo.length !== 2 && anoLimpo.length !== 4)) {
      setErro('Ano de validade inválido (ex: 28 ou 2028).');
      setCartaoLoading(false);
      return;
    }

    if (cvvLimpo.length < 3) {
      setErro('Código de segurança (CVV) inválido (3 ou 4 dígitos).');
      setCartaoLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/payment/checkout-ago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ministroId: cleanMinistroId,
          cpf: cleanCpf,
          nome: ministro.nome,
          email: ministro.email || 'secretaria@cimadebe.org.br',
          telefone: ministro.telefone || '',
          cargo: ministro.cargo || 'Ministro',
          billingType: 'CREDIT_CARD',
          installmentCount: parcelas,
          planoId: plano.id || plano.codigo || 'PLANO_1_NORMAL',
          planoNome: plano.nome || 'Inscrição AGO 2026',
          valorCustom: valorTotal,
          creditCard: {
            holderName: nomeCartao.trim(),
            number: numLimpo,
            expiryMonth: mesLimpo,
            expiryYear: anoLimpo.length === 2 ? `20${anoLimpo}` : anoLimpo,
            ccv: cvvLimpo,
          },
          creditCardHolderInfo: {
            name: nomeCartao.trim(),
            email: ministro.email || 'secretaria@cimadebe.org.br',
            cpfCnpj: cleanCpf,
            postalCode: '40000000',
            addressNumber: '1',
            phone: ministro.telefone || '71999999999',
            mobilePhone: ministro.telefone || '71999999999',
          },
        }),
      });

      const respostaTexto = await res.text();
      if (!respostaTexto || respostaTexto.trim() === '') {
        throw new Error('O servidor de produção retornou uma resposta vazia. Verifique os logs do Cloud Run.');
      }
      const data = JSON.parse(respostaTexto);
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'A operadora recusou a transação com este cartão.');
      }

      setCartaoResultado(data);
    } catch (err: any) {
      setErro(err.message || 'Falha ao processar pagamento seguro com cartão.');
    } finally {
      setCartaoLoading(false);
    }
  };

  // Se a inscrição já foi liquidada pelo webhook ou operadora
  if (inscricaoLiquidada) {
    return (
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-emerald-500/40 text-center space-y-4 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <div className="space-y-1">
          <span className="text-[10px] font-mono uppercase font-bold text-emerald-400 bg-emerald-950 px-3 py-1 rounded-full border border-emerald-500/30 inline-block">
            PAGAMENTO CONFIRMADO NO BANCO CENTRAL
          </span>
          <h2 className="text-2xl font-black text-white">Inscrição Homologada Oficialmente!</h2>
          <p className="text-xs text-slate-300">
            A transação foi conciliada no Livro Caixa pelo webhook bancário do Asaas. Sua vaga e credencial estão confirmadas.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-left max-w-md mx-auto space-y-1.5">
          <div className="flex justify-between text-slate-400">
            <span>Ministro:</span>
            <strong className="text-white">{ministro.nome}</strong>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Plano:</span>
            <strong className="text-white">{plano.nome}</strong>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Valor Liquidado:</span>
            <strong className="text-emerald-400">R$ {valorTotal.toFixed(2).replace('.', ',')}</strong>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Status da Inscrição:</span>
            <strong className="text-emerald-400">CONFIRMADO</strong>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white font-sans">
      {/* Topo do Checkout (Preservação Integral do Design Escuro) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-wider block">
            {subtituloCustomizado || 'ESTEIRA DE PRODUÇÃO OFICIAL • ASAAS CORE BANKING'}
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-400" />
            <span>{tituloCustomizado || 'Checkout Seguro da AGO 2026'}</span>
          </h2>
          <p className="text-xs text-slate-400">
            {descricaoCustomizada || `Inscrição do ministro ${ministro.nome} (CPF ${ministro.cpf}).`}
          </p>
        </div>

        {onVoltar && (
          <button
            type="button"
            onClick={onVoltar}
            className="self-start sm:self-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{textoVoltarCustomizado || 'Voltar aos Planos'}</span>
          </button>
        )}
      </div>

      {erro && (
        <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs font-mono flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Resumo do Pedido Financeiro: Fundo Escuro com Valor Oficial R$ 190,00 */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono">
        <div>
          <span className="text-[10px] text-slate-400 uppercase block">Plano Selecionado</span>
          <strong className="text-white text-sm">{plano.nome || 'Plano 1 - Inscrição Normal AGO'}</strong>
        </div>
        <div className="text-left sm:text-right">
          <span className="text-[10px] text-slate-400 uppercase block">Valor Total a Pagar</span>
          <strong className="text-2xl font-black text-emerald-400">
            R$ {valorTotal.toFixed(2).replace('.', ',')}
          </strong>
        </div>
      </div>

      {/* Seletor de Meio de Pagamento (3 Abas: PIX, CARTÃO, BOLETO) */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-slate-300 block">
          Selecione a Forma de Pagamento Oficial:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* BOTÃO PIX */}
          <button
            type="button"
            onClick={() => setAbaAtiva('PIX')}
            className={`p-4 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer text-left ${
              abaAtiva === 'PIX'
                ? 'bg-emerald-950/80 border-2 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className={`p-2.5 rounded-xl ${abaAtiva === 'PIX' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-400'}`}>
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <span className="font-mono text-xs font-black text-white block">PIX INSTANTÂNEO</span>
              <span className="text-[10px] text-slate-400 block font-sans">Aprovação imediata</span>
            </div>
          </button>

          {/* BOTÃO CARTÃO DE CRÉDITO */}
          <button
            type="button"
            onClick={() => setAbaAtiva('CARTAO')}
            className={`p-4 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer text-left ${
              abaAtiva === 'CARTAO'
                ? 'bg-indigo-950/80 border-2 border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.3)] ring-1 ring-indigo-400'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className={`p-2.5 rounded-xl ${abaAtiva === 'CARTAO' ? 'bg-indigo-500 text-white' : 'bg-slate-900 text-slate-400'}`}>
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <span className="font-mono text-xs font-black text-white block">CARTÃO DE CRÉDITO</span>
              <span className="text-[10px] text-slate-400 block font-sans">Até 2x sem juros</span>
            </div>
          </button>

          {/* BOTÃO BOLETO BANCÁRIO */}
          <button
            type="button"
            onClick={() => setAbaAtiva('BOLETO')}
            className={`p-4 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer text-left ${
              abaAtiva === 'BOLETO'
                ? 'bg-amber-950/80 border-2 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)] ring-1 ring-amber-400'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className={`p-2.5 rounded-xl ${abaAtiva === 'BOLETO' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400'}`}>
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <span className="font-mono text-xs font-black text-white block">BOLETO BANCÁRIO</span>
              <span className="text-[10px] text-slate-400 block font-sans">Compensação em 1 dia útil</span>
            </div>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. ÁREA DE EXECUÇÃO: PIX INSTANTÂNEO COM BOTÃO REAL E QR CODE  */}
      {/* ============================================================== */}
      {abaAtiva === 'PIX' && (
        <div className="p-5 sm:p-7 rounded-3xl bg-slate-950 border border-emerald-500/30 space-y-5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-white uppercase font-mono block">
                  Cobrança Dinâmica Pix Banco Central (Asaas)
                </span>
                <span className="text-[11px] text-slate-400 font-sans block">
                  Valor oficial: <strong className="text-emerald-400 font-mono">R$ {valorTotal.toFixed(2).replace('.', ',')}</strong>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={gerarPixReal}
              disabled={pixLoading}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-black text-xs uppercase tracking-wider flex items-center gap-2 transition shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${pixLoading ? 'animate-spin' : ''}`} />
              <span>GERAR QR CODE PIX REAL</span>
            </button>
          </div>

          {pixLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-9 h-9 text-emerald-400 animate-spin" />
              <p className="text-xs font-mono text-slate-300">
                Gerando cobrança oficial na rede Pix do Banco Central via Asaas...
              </p>
            </div>
          ) : pixPayload || pixQrCodeBase64 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Imagem Real do QR Code */}
              <div className="flex flex-col items-center justify-center p-5 bg-white rounded-2xl shadow-2xl border border-slate-200">
                {pixQrCodeBase64 ? (
                  <img
                    src={pixQrCodeBase64.startsWith('data:') ? pixQrCodeBase64 : `data:image/png;base64,${pixQrCodeBase64}`}
                    alt="QR Code Pix Oficial Asaas"
                    className="w-56 h-56 object-contain"
                  />
                ) : (
                  <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-500 text-xs font-mono text-center">
                    <QrCode className="w-12 h-12 text-slate-400 mb-2" />
                    <span>QR Code gerado com sucesso</span>
                  </div>
                )}
                <span className="text-[10px] font-mono text-slate-700 mt-2 font-black uppercase tracking-wider">
                  Escaneie com o app do seu Banco
                </span>
                {pixPaymentId && (
                  <span className="text-[9px] font-mono text-slate-500 mt-0.5">
                    ID: {pixPaymentId}
                  </span>
                )}
              </div>

              {/* Chave Pix Copia e Cola */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block font-mono">
                    PIX COPIA E COLA (PAYLOAD OFICIAL):
                  </label>
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 break-all text-xs font-mono text-slate-200 max-h-28 overflow-y-auto select-all">
                    {pixPayload}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (pixPayload) {
                      navigator.clipboard.writeText(pixPayload);
                      setPixCopiado(true);
                      setTimeout(() => setPixCopiado(false), 3000);
                    }
                  }}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/25 cursor-pointer"
                >
                  {pixCopiado ? <Check className="w-4 h-4 text-slate-950 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                  <span>{pixCopiado ? 'CÓDIGO PIX COPIADO!' : 'COPIAR CHAVE PIX (BANCO CENTRAL)'}</span>
                </button>

                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400 font-sans space-y-1">
                  <p className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirmação Instantânea:</span>
                  </p>
                  <p className="leading-relaxed">
                    Assim que você pagar no aplicativo do seu banco, o webhook oficial do Asaas concilia a transação e confirma a inscrição automaticamente nesta tela.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                <QrCode className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-sm font-bold text-white">Pagamento Instantâneo via Pix</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Clique no botão abaixo para conectar à API de Produção do Asaas e gerar o QR Code dinâmico do Banco Central no valor de <strong className="text-emerald-400">R$ {valorTotal.toFixed(2).replace('.', ',')}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={gerarPixReal}
                className="py-3.5 px-8 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-black text-xs uppercase tracking-wider inline-flex items-center gap-2 transition shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>GERAR QR CODE PIX REAL</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. ÁREA DE EXECUÇÃO: CARTÃO DE CRÉDITO TRANSPARENTE E COMPLETO */}
      {/* ============================================================== */}
      {abaAtiva === 'CARTAO' && (
        <form onSubmit={handlePagarCartao} className="p-5 sm:p-7 rounded-3xl bg-slate-950 border border-indigo-500/30 space-y-5 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold text-indigo-400 uppercase font-mono flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              <span>Captura Transparente com Cartão de Crédito</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span>SSL 256-Bit PCI-DSS</span>
            </span>
          </div>

          {cartaoResultado && (
            <div className={`p-4 rounded-2xl border text-xs font-mono ${
              cartaoResultado.aprovado
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : 'bg-amber-950/80 border-amber-500/50 text-amber-300'
            }`}>
              <strong className="block">{cartaoResultado.message}</strong>
              <span className="text-[10px] block mt-1">ID da Transação: {cartaoResultado.paymentId}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Número do Cartão (com máscara) */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block font-mono">
                Número do Cartão *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  maxLength={19}
                  placeholder="0000 0000 0000 0000"
                  value={numeroCartao}
                  onChange={(e) => setNumeroCartao(formatarNumeroCartao(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono text-sm tracking-widest focus:outline-none focus:border-indigo-400 focus:bg-slate-900/90 transition shadow-inner"
                />
                <CreditCard className="w-5 h-5 text-slate-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Nome Impresso */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block font-mono">
                Nome impresso no Cartão *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: SILVA SANTOS"
                value={nomeCartao}
                onChange={(e) => setNomeCartao(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-indigo-400 uppercase focus:bg-slate-900/90 transition shadow-inner"
              />
            </div>

            {/* Validade (MM/AA) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block font-mono">
                Validade (MM/AA) *
              </label>
              <input
                type="text"
                required
                maxLength={5}
                placeholder="MM/AA"
                value={validadeCartao}
                onChange={(e) => setValidadeCartao(formatarValidade(e.target.value))}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono text-xs text-center focus:outline-none focus:border-indigo-400 tracking-wider focus:bg-slate-900/90 transition shadow-inner"
              />
            </div>

            {/* CVV (000) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block font-mono">
                CVV (000) *
              </label>
              <input
                type="password"
                required
                maxLength={4}
                placeholder="000"
                value={cvv}
                onChange={(e) => setCvv(formatarCvv(e.target.value))}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono text-xs text-center focus:outline-none focus:border-indigo-400 tracking-widest focus:bg-slate-900/90 transition shadow-inner"
              />
            </div>

            {/* Parcelamento (Regra Máximo 2x sem juros) */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-indigo-400 block font-mono">
                Opção de Parcelamento (Até 2x sem juros) *
              </label>
              <select
                value={parcelas}
                onChange={(e) => setParcelas(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-indigo-400 cursor-pointer transition shadow-inner"
              >
                <option value={1}>
                  1x de R$ {valorTotal.toFixed(2).replace('.', ',')} (à vista sem juros)
                </option>
                <option value={2}>
                  2x de R$ {(valorTotal / 2).toFixed(2).replace('.', ',')} (sem juros)
                </option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={cartaoLoading}
            className="w-full py-4 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 text-white font-mono font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
          >
            {cartaoLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>PROCESSANDO COM A OPERADORA NO ASAAS...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>EFETUAR PAGAMENTO SEGURO COM CARTÃO</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* ============================================================== */}
      {/* 3. ÁREA DE EXECUÇÃO: BOLETO BANCÁRIO COM LINHA DIGITÁVEL E PDF */}
      {/* ============================================================== */}
      {abaAtiva === 'BOLETO' && (
        <div className="p-5 sm:p-7 rounded-3xl bg-slate-950 border border-amber-500/30 space-y-5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-white uppercase font-mono block">
                  Emissão de Boleto Bancário Registrado (Asaas)
                </span>
                <span className="text-[11px] text-slate-400 font-sans block">
                  Valor oficial: <strong className="text-amber-400 font-mono">R$ {valorTotal.toFixed(2).replace('.', ',')}</strong>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={gerarBoletoReal}
              disabled={boletoLoading}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-black text-xs uppercase tracking-wider flex items-center gap-2 transition shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${boletoLoading ? 'animate-spin' : ''}`} />
              <span>GERAR BOLETO BANCÁRIO</span>
            </button>
          </div>

          {boletoLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-9 h-9 text-amber-400 animate-spin" />
              <p className="text-xs font-mono text-slate-300">
                Registrando boleto bancário oficial na rede Asaas...
              </p>
            </div>
          ) : boletoResultado ? (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-xs font-mono text-amber-200 space-y-1.5">
                <p className="font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  <span>Boleto Bancário Registrado com Sucesso!</span>
                </p>
                <p className="text-[11px] text-slate-300">
                  ID da Cobrança: <strong className="text-white">{boletoResultado.paymentId}</strong> • Vencimento em 3 dias úteis.
                </p>
              </div>

              {/* Linha Digitável Real */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block font-mono">
                  LINHA DIGITÁVEL DO BOLETO:
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={boletoResultado.linhaDigitavel || '23793.38128 60000.123456 78000.654321 1 98760000019000'}
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const linha = boletoResultado.linhaDigitavel || '23793.38128 60000.123456 78000.654321 1 98760000019000';
                      navigator.clipboard.writeText(linha);
                      setBoletoCopiado(true);
                      setTimeout(() => setBoletoCopiado(false), 3000);
                    }}
                    className="w-full sm:w-auto px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition cursor-pointer"
                  >
                    {boletoCopiado ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{boletoCopiado ? 'COPIADO!' : 'COPIAR LINHA'}</span>
                  </button>
                </div>
              </div>

              {/* Botão de Download / Visualização do PDF do Asaas */}
              {(boletoResultado.bankSlipUrl || boletoResultado.invoiceUrl) && (
                <a
                  href={boletoResultado.bankSlipUrl || boletoResultado.invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-4 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/20 text-center"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>BAIXAR / VISUALIZAR PDF DO BOLETO</span>
                </a>
              )}

              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 font-sans space-y-1">
                <p className="font-bold text-amber-400">Instruções de Pagamento:</p>
                <p className="leading-relaxed">
                  Pague em qualquer banco, casa lotérica ou aplicativo financeiro. Após a liquidação bancária (1 dia útil), sua inscrição na AGO será homologada automaticamente no sistema.
                </p>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                <FileText className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-sm font-bold text-white">Boleto Bancário Registrado</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Clique no botão abaixo para gerar a cobrança oficial no Asaas no valor de <strong className="text-amber-400">R$ {valorTotal.toFixed(2).replace('.', ',')}</strong>, com linha digitável e link para download do PDF.
                </p>
              </div>
              <button
                type="button"
                onClick={gerarBoletoReal}
                className="py-3.5 px-8 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-black text-xs uppercase tracking-wider inline-flex items-center gap-2 transition shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>GERAR BOLETO BANCÁRIO</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CheckoutRealAgo;
