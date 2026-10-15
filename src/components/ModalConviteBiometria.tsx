/**
 * @license
 * CIMADEBE / SIGM - Core Banking
 * Modal Inteligente de Convite para Cadastro Biométrico (Padrão Bancário)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  X,
  Sparkles,
  ArrowRight,
  Lock,
} from 'lucide-react';
import {
  cadastrarBiometriaNativa,
  detectarNomeDispositivo,
  verificarSuporteBiometria,
  type CredencialBiometrica,
} from '../services/biometriaService';

interface ModalConviteBiometriaProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly identificador: string; // CPF ou Email
  readonly nomeUsuario: string;
  readonly onBiometriaCadastrada: (cred: CredencialBiometrica) => void;
}

export function ModalConviteBiometria({
  isOpen,
  onClose,
  identificador,
  nomeUsuario,
  onBiometriaCadastrada,
}: ModalConviteBiometriaProps) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const nomeDispositivo = detectarNomeDispositivo();

  const lidarComAtivarBiometria = async () => {
    setCarregando(true);
    setErro(null);

    try {
      const cred = await cadastrarBiometriaNativa(identificador, nomeUsuario);
      setSucesso(true);
      setTimeout(() => {
        onBiometriaCadastrada(cred);
        onClose();
      }, 1400);
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível cadastrar a biometria neste momento.');
    } finally {
      setCarregando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1250] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(6,182,212,0.2)] text-white overflow-hidden"
      >
        {/* Glow de fundo */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          title="Agora não"
        >
          <X className="w-5 h-5" />
        </button>

        {sucesso ? (
          <div className="py-6 text-center space-y-4 animate-fadeIn">
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-white font-sans">
                Biometria Ativada com Sucesso!
              </h3>
              <p className="text-xs text-slate-300 font-sans">
                Nos próximos acessos você entrará em 1 toque usando sua digital ou Face ID.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Ícone de Biometria Bancária */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 to-emerald-500 p-0.5 shadow-lg shadow-cyan-500/25">
                <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
                  <Fingerprint className="w-8 h-8 text-cyan-400 animate-pulse" />
                </div>
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-[10px] font-mono font-bold text-cyan-300 mb-1">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  ACESSO RÁPIDO BANCÁRIO
                </span>
                <h3 className="text-lg font-black text-white font-sans leading-tight">
                  Ativar Acesso por Biometria?
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Olá, <strong className="text-white">{nomeUsuario}</strong>! Deseja habilitar a autenticação por{' '}
              <strong className="text-cyan-300">Impressão Digital / Face ID</strong> neste dispositivo para não precisar digitar sua senha nos próximos acessos?
            </p>

            {/* Caixa com detalhes do dispositivo */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono text-slate-400 uppercase">
                  Dispositivo Detectado:
                </div>
                <div className="text-xs font-bold text-white truncate font-sans">
                  {nomeDispositivo}
                </div>
              </div>
            </div>

            {erro && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-sans">
                {erro}
              </div>
            )}

            {/* Ações */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={carregando}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs font-sans transition-colors text-center"
              >
                Agora Não
              </button>

              <button
                type="button"
                onClick={lidarComAtivarBiometria}
                disabled={carregando}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-black text-xs font-sans flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/30 transition-all cursor-pointer"
              >
                {carregando ? (
                  <>
                    <Fingerprint className="w-4 h-4 animate-spin text-white" />
                    <span>Validando...</span>
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4 text-white" />
                    <span>Ativar Biometria</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
