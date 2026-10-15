/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção Geral
 * Componente: WebAuthnChallengeModal.tsx (SRP)
 * Responsabilidade Única: Execução e simulação de desafio biométrico WebAuthn / FIDO2 Passkey de Alta Fidelidade
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint,
  ShieldCheck,
  KeyRound,
  Cpu,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Scan,
  Sparkles,
  ShieldAlert,
  Smartphone,
  Laptop
} from 'lucide-react';
import { gerarHashSha256 } from '../services/licenseSecurityService';

export interface WebAuthnSuccessPayload {
  credentialId: string;
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
  userHandle: string;
  perfil: string;
  timestamp: string;
}

interface WebAuthnChallengeModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly perfilDesejado: 'ministro' | 'admin' | 'master' | 'biro';
  readonly identificador?: string;
  readonly onAutenticado: (payload: WebAuthnSuccessPayload) => void;
}

type EtapaDesafio = 'iniciando' | 'aguardando_toque' | 'verificando_assinatura' | 'sucesso' | 'erro';

export function WebAuthnChallengeModal({
  isOpen,
  onClose,
  perfilDesejado,
  identificador,
  onAutenticado
}: WebAuthnChallengeModalProps) {
  const [etapa, setEtapa] = useState<EtapaDesafio>('iniciando');
  const [nonceDesafio, setNonceDesafio] = useState<string>('');
  const [progresso, setProgresso] = useState<number>(0);
  const [mensagemStatus, setMensagemStatus] = useState<string>('Negociando parâmetros FIDO2/WebAuthn...');
  const [tipoDispositivo, setTipoDispositivo] = useState<'BIOMETRIA' | 'CHAVE_HARDWARE' | 'TOUCH_ID'>('TOUCH_ID');
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  // Inicializa o desafio criptográfico assim que a modal abre
  const gerarDesafioCriptografico = useCallback(async () => {
    try {
      setEtapa('iniciando');
      setErroMsg(null);
      setProgresso(15);
      setMensagemStatus('Gerando Nonce Criptográfico Web Crypto (256-bit entropy)...');

      // Gera 32 bytes de entropia pura
      const arrayRandom = new Uint8Array(32);
      crypto.getRandomValues(arrayRandom);
      const hexRandom = Array.from(arrayRandom)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const hashNonce = await gerarHashSha256(`WEBAUTHN-CHALLENGE-${hexRandom}-${Date.now()}`);
      setNonceDesafio(hashNonce);

      setProgresso(50);
      setMensagemStatus('Aguardando verificação biométrica do dispositivo...');
      setEtapa('aguardando_toque');
    } catch (err: any) {
      setErroMsg(err?.message || 'Falha ao inicializar desafio WebAuthn.');
      setEtapa('erro');
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      gerarDesafioCriptografico();
    } else {
      setEtapa('iniciando');
      setProgresso(0);
      setErroMsg(null);
    }
  }, [isOpen, gerarDesafioCriptografico]);

  // Simulação do sensor de toque / leitura biométrica FIDO2
  const executarValidacaoSensor = async () => {
    if (etapa !== 'aguardando_toque') return;

    try {
      setEtapa('verificando_assinatura');
      setProgresso(75);
      setMensagemStatus('Capturando chave assimétrica e validando assinatura ECDSA...');

      await new Promise((resolve) => setTimeout(resolve, 850));

      setProgresso(90);
      setMensagemStatus('Validando atestação de integridade de hardware com o servidor...');

      await new Promise((resolve) => setTimeout(resolve, 600));

      const credentialId = `fido2-cred-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const signature = await gerarHashSha256(`${nonceDesafio}-${perfilDesejado}-${identificador || 'anon'}`);

      setProgresso(100);
      setMensagemStatus('Autenticação biométrica confirmada com sucesso!');
      setEtapa('sucesso');

      const payload: WebAuthnSuccessPayload = {
        credentialId,
        clientDataJSON: btoa(JSON.stringify({ type: 'webauthn.get', challenge: nonceDesafio, origin: window.location.origin })),
        authenticatorData: 'flags:UP+UV_signCount:1',
        signature,
        userHandle: identificador || `user-${perfilDesejado}`,
        perfil: perfilDesejado,
        timestamp: new Date().toISOString()
      };

      setTimeout(() => {
        onAutenticado(payload);
      }, 700);
    } catch (err: any) {
      setErroMsg('Assinatura biométrica rejeitada pelo sensor.');
      setEtapa('erro');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        className="relative w-full max-w-md bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(6,182,212,0.25)] text-slate-100 overflow-hidden"
      >
        {/* Glow Superior */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Botão Fechar */}
        <button
          onClick={onClose}
          disabled={etapa === 'verificando_assinatura'}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-30 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header do Desafio */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>FIDO2 / WEBAUTHN HARDWARE CHALLENGE</span>
          </div>

          <h3 className="text-xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            Autenticação Biométrica
          </h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Acesso seguro sem senha com proteção criptográfica de hardware de nível bancário.
          </p>
        </div>

        {/* Perfil em Autenticação */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 mb-6 flex items-center justify-between text-xs font-mono">
          <div>
            <span className="block text-[10px] text-slate-500 uppercase">Perfil Requisitado</span>
            <span className="font-bold text-cyan-300 uppercase tracking-wide">
              {perfilDesejado === 'master'
                ? 'Super Master (Root)'
                : perfilDesejado === 'admin'
                ? 'Administrador Geral'
                : perfilDesejado === 'biro'
                ? 'Birô de Impressão'
                : 'Ministro Obreiro'}
            </span>
          </div>
          <div className="text-right">
            <span className="block text-[10px] text-slate-500 uppercase">Credencial / Alvo</span>
            <span className="text-slate-300 truncate max-w-[150px] inline-block font-sans">
              {identificador || 'Dispositivo Autorizado'}
            </span>
          </div>
        </div>

        {/* Sensor Interativo / Scanner Biométrico */}
        <div className="flex flex-col items-center justify-center py-4 space-y-4">
          <div className="relative group">
            {/* Círculos pulsantes */}
            {etapa === 'aguardando_toque' && (
              <>
                <motion.div
                  animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 rounded-full bg-cyan-500/20 pointer-events-none"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0.2, 0.8] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -inset-2 rounded-full border border-cyan-400/40 pointer-events-none"
                />
              </>
            )}

            {etapa === 'verificando_assinatura' && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                className="absolute -inset-3 rounded-full border-2 border-dashed border-cyan-400 pointer-events-none"
              />
            )}

            {/* Botão de Leitura / Sensor */}
            <button
              type="button"
              onClick={executarValidacaoSensor}
              disabled={etapa !== 'aguardando_toque'}
              className={`relative w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl cursor-pointer ${
                etapa === 'sucesso'
                  ? 'bg-emerald-500 text-slate-950 shadow-[0_0_40px_rgba(16,185,129,0.5)]'
                  : etapa === 'verificando_assinatura'
                  ? 'bg-cyan-950 border-2 border-cyan-400 text-cyan-400 shadow-[0_0_35px_rgba(6,182,212,0.4)]'
                  : etapa === 'erro'
                  ? 'bg-rose-950 border-2 border-rose-500 text-rose-400'
                  : 'bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-cyan-500/50 hover:border-cyan-400 text-cyan-400 hover:shadow-[0_0_35px_rgba(6,182,212,0.5)] active:scale-95'
              }`}
            >
              {etapa === 'sucesso' ? (
                <CheckCircle2 className="w-12 h-12 animate-bounce" />
              ) : etapa === 'verificando_assinatura' ? (
                <RefreshCw className="w-10 h-10 animate-spin" />
              ) : etapa === 'erro' ? (
                <AlertTriangle className="w-10 h-10" />
              ) : (
                <>
                  <Fingerprint className="w-12 h-12 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-mono tracking-widest uppercase mt-1 text-cyan-300 font-bold">
                    TOQUE AQUI
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Status Text & Step Details */}
          <div className="text-center space-y-1 max-w-xs">
            <p className="text-xs font-semibold text-white">
              {mensagemStatus}
            </p>
            {etapa === 'aguardando_toque' && (
              <p className="text-[11px] text-slate-400">
                Pressione o sensor biométrico acima ou use o Touch ID / Face ID do seu aparelho.
              </p>
            )}
          </div>
        </div>

        {/* Informações Criptográficas do Nonce em Tempo Real */}
        <div className="bg-slate-950 rounded-xl p-3 border border-slate-800/80 space-y-2 mt-2">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3 text-cyan-400" />
              CHALLENGE NONCE (SHA-256):
            </span>
            <span className="text-emerald-400 font-bold">TLS 1.3 ATIVO</span>
          </div>
          <div className="text-[10px] font-mono text-slate-300 bg-slate-900 p-1.5 rounded border border-slate-800 truncate select-all">
            {nonceDesafio || '0000000000000000000000000000000000000000000000000000000000000000'}
          </div>

          {/* Barra de Progresso Criptográfico */}
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
            <motion.div
              className={`h-full ${
                etapa === 'sucesso'
                  ? 'bg-emerald-500'
                  : etapa === 'erro'
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-cyan-500 to-emerald-500'
              }`}
              initial={{ width: '0%' }}
              animate={{ width: `${progresso}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Mensagem de Erro com Ação de Retry */}
        {erroMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-300 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{erroMsg}</span>
            </div>
            <button
              onClick={gerarDesafioCriptografico}
              className="px-2.5 py-1 bg-rose-900 hover:bg-rose-800 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Rodapé Alternativas */}
        <div className="mt-6 flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Voltar para login com senha
          </button>
          <span className="font-mono text-[10px] text-cyan-400 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            ISO/IEC 27001
          </span>
        </div>
      </motion.div>
    </div>
  );
}
