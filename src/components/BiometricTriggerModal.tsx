/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Modal de Confirmação e Validação Biométrica FIDO2 / WebAuthn (BiometricTriggerModal.tsx)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Fingerprint, Lock, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { verificarSuporteBiometria } from '../services/biometriaService';

export interface BiometricTriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
  title?: string;
  description?: string;
}

export function BiometricTriggerModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'VALIDAÇÃO BIOMÉTRICA REQUERIDA',
  description = 'Aproxime sua credencial cadastrada ou utilize o sensor biométrico do dispositivo (TouchID / FaceID / Windows Hello) para assinar esta operação de alta governança.'
}: BiometricTriggerModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      verificarSuporteBiometria().then((suportado) => {
        if (!suportado) {
          setError('Dispositivo sem suporte a hardware biométrico (WebAuthn/FIDO2). Esta ação crítica de alta governança exige autenticação biométrica ou chave física homologada.');
        }
      });
    }
  }, [isOpen]);

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    try {
      const suporte = await verificarSuporteBiometria();
      if (!suporte) {
        setError('Dispositivo sem suporte a hardware biométrico (WebAuthn/FIDO2). Esta ação crítica de alta governança exige autenticação biométrica ou chave física homologada.');
        setLoading(false);
        return;
      }
      const ok = await onConfirm();
      if (ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setLoading(false);
          onClose();
        }, 1500);
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Falha na validação biométrica.');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-md bg-[#0B101C] border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-white space-y-6 relative overflow-hidden"
        >
          {/* Top Amber Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Fingerprint className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[10px] tracking-widest uppercase">
                <Shield className="w-3.5 h-3.5" /> FIDO2 / Passkeys Gateway
              </div>
              <h3 className="text-lg font-bold tracking-tight text-white">{title}</h3>
            </div>
          </div>

          {/* Prompt Description */}
          {success ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-5 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 flex flex-col items-center text-center space-y-3"
            >
              <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
              <h4 className="text-emerald-300 font-bold text-sm">Assinatura Biométrica Aprovada!</h4>
              <p className="text-slate-300 text-xs font-mono">Operação autorizada com sucesso na rede segura.</p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-slate-300 text-xs leading-relaxed font-mono">
                {description}
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {!success && (
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold font-mono transition-all border border-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleExecute}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 text-xs font-extrabold font-mono transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Lendo Biometria...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Autenticar Passkey</span>
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
