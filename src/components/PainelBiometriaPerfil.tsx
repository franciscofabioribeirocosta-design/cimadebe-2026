/**
 * @license
 * CIMADEBE / SIGM - Core Banking
 * Painel de Gestão e Vinculação de Biometria no Perfil (Padrão Bancário)
 */

import React, { useState, useEffect } from 'react';
import {
  Fingerprint,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  Trash2,
  Sparkles,
  RefreshCw,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import {
  obterCredencialBiometricaLocal,
  cadastrarBiometriaNativa,
  desvincularBiometria,
  detectarNomeDispositivo,
  verificarSuporteBiometria,
  type CredencialBiometrica,
} from '../services/biometriaService';

interface PainelBiometriaPerfilProps {
  readonly identificador: string; // CPF ou Email
  readonly nomeUsuario: string;
}

export function PainelBiometriaPerfil({
  identificador,
  nomeUsuario,
}: PainelBiometriaPerfilProps) {
  const [credencialLocal, setCredencialLocal] = useState<CredencialBiometrica | null>(null);
  const [suporte, setSuporte] = useState<boolean>(true);
  const [carregando, setCarregando] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  const nomeAparelho = detectarNomeDispositivo();

  useEffect(() => {
    verificarSuporteBiometria().then(setSuporte);
    const cred = obterCredencialBiometricaLocal();
    setCredencialLocal(cred);
  }, [identificador]);

  const lidarComAtivarOuAtualizar = async () => {
    setCarregando(true);
    setFeedback(null);
    try {
      const novaCred = await cadastrarBiometriaNativa(identificador, nomeUsuario);
      setCredencialLocal(novaCred);
      setFeedback({
        tipo: 'sucesso',
        texto: 'Biometria vinculada com sucesso a este dispositivo!',
      });
    } catch (err: any) {
      setFeedback({
        tipo: 'erro',
        texto: err?.message || 'Falha ao registrar biometria.',
      });
    } finally {
      setCarregando(false);
    }
  };

  const lidarComDesvincular = async () => {
    setCarregando(true);
    setFeedback(null);
    try {
      await desvincularBiometria(identificador);
      setCredencialLocal(null);
      setFeedback({
        tipo: 'sucesso',
        texto: 'Biometria desvinculada deste dispositivo com sucesso.',
      });
    } catch (err: any) {
      setFeedback({
        tipo: 'erro',
        texto: err?.message || 'Erro ao desvincular biometria.',
      });
    } finally {
      setCarregando(false);
    }
  };

  if (!suporte) {
    return (
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs font-sans">
        Este navegador ou dispositivo não possui suporte a leitor biométrico compatível.
      </div>
    );
  }

  const estaAtivo = Boolean(credencialLocal && credencialLocal.ativo);

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className={`p-3 rounded-2xl ${estaAtivo ? 'bg-emerald-950/80 border border-emerald-500/30 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
            <Fingerprint className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-white text-sm font-sans">
                Acesso por Biometria (Passkey / FIDO2)
              </h4>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  estaAtivo
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {estaAtivo ? 'ATIVADA NESTE DISPOSITIVO' : 'NÃO CADASTRADA'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Faça login em 1 toque usando sua impressão digital, Face ID ou Windows Hello.
            </p>
          </div>
        </div>
      </div>

      {/* Cartão de Detalhes do Dispositivo */}
      <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 text-xs font-sans space-y-1.5">
        <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
          <span className="flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
            Dispositivo Atual:
          </span>
          <span className="text-slate-200 font-bold">{nomeAparelho}</span>
        </div>

        {estaAtivo && credencialLocal && (
          <div className="flex items-center justify-between text-slate-400 font-mono text-[11px] pt-1 border-t border-slate-900">
            <span>Vinculado em:</span>
            <span className="text-slate-300">
              {new Date(credencialLocal.criadoEm).toLocaleDateString('pt-BR')} às{' '}
              {new Date(credencialLocal.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-sans border ${
            feedback.tipo === 'sucesso'
              ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/70 border-rose-500/40 text-rose-300'
          }`}
        >
          {feedback.texto}
        </div>
      )}

      {/* Botões de Ação */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {estaAtivo ? (
          <>
            <button
              type="button"
              onClick={lidarComAtivarOuAtualizar}
              disabled={carregando}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold font-sans flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
              <span>Recadastrar Digital / Face ID</span>
            </button>

            <button
              type="button"
              onClick={lidarComDesvincular}
              disabled={carregando}
              className="py-2.5 px-4 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-xs font-bold font-sans flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Desvincular deste Aparelho</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={lidarComAtivarOuAtualizar}
            disabled={carregando}
            className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white text-xs font-black font-sans flex items-center gap-2 shadow-lg shadow-cyan-600/25 transition-all cursor-pointer"
          >
            <Fingerprint className="w-4 h-4 text-white" />
            <span>Cadastrar Biometria Neste Aparelho</span>
          </button>
        )}
      </div>
    </div>
  );
}
