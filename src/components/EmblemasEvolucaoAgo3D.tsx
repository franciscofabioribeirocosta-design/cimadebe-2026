/**
 * @license
 * CIMADEBE / SIGM - Histórico Flutuante de Participações da AGO
 * Linha do tempo horizontal com Círculo Vazado de Luz e Diamante Central,
 * com fluxo em onda fina animada em SVG.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Gem,
  Clock,
  Sparkles,
  Lock,
  Crown,
} from 'lucide-react';

export interface ItemHistoricoAgo {
  readonly ano: number;
  readonly edicao?: string;
  readonly status: 'PAGO' | 'ABERTO' | 'NAO_INSCRITO';
}

interface EmblemasProps {
  readonly ministroNome?: string;
  readonly historicoAnos?: readonly ItemHistoricoAgo[];
  readonly anosInscritos?: readonly number[];
  readonly participacoes?: readonly any[];
  readonly cicloVigente?: number;
  readonly onClickCredencial?: () => void;
}

export function EmblemasEvolucaoAgo3D({
  ministroNome = 'Ministro',
  historicoAnos,
  anosInscritos = [],
  participacoes = [],
  cicloVigente,
  onClickCredencial,
}: EmblemasProps) {
  // Lista de anos do histórico (Iniciando estritamente na 1ª AGO 2026, sem registros anteriores)
  const listaCompletaAnos: ItemHistoricoAgo[] = useMemo(() => {
    const anosBase = [2026, 2027, 2028, 2029, 2030];
    return anosBase.map((ano) => {
      let status: 'PAGO' | 'ABERTO' | 'NAO_INSCRITO' = 'NAO_INSCRITO';

      // Mecanismo de verificação estrito: cruza anosInscritos e valida se existe inscrição ativa/válida (sem exclusão)
      const temInscricaoAtiva =
        anosInscritos.includes(ano) &&
        (!participacoes || participacoes.length === 0 || participacoes.some((p) =>
          (p.anoVigente === ano || p.ano === ano) &&
          (p.statusInscricao === 'VALIDA' || p.status === 'CONFIRMADO')
        ));

      if (temInscricaoAtiva) {
        status = 'PAGO';
      } else {
        status = 'NAO_INSCRITO';
      }

      return {
        ano,
        edicao: `${ano - 2025}ª AGO`,
        status,
      };
    });
  }, [anosInscritos, participacoes]);

  // Carrossel: Exibe 4 anos por vez
  const [startIndex, setStartIndex] = useState(0);

  const total = listaCompletaAnos.length;
  const maxIndex = Math.max(0, total - 4);

  const proximo = () => {
    setStartIndex((prev) => Math.min(maxIndex, prev + 1));
  };

  const anterior = () => {
    setStartIndex((prev) => Math.max(0, prev - 1));
  };

  const itensVisiveis = listaCompletaAnos.slice(startIndex, startIndex + 4);
  const possuiInscricao2026 = anosInscritos.includes(2026);

  return (
    <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/95 border border-amber-500/30 shadow-2xl space-y-6 backdrop-blur-xl relative overflow-hidden font-sans">
      {/* Keyframes para animações do Círculo de Luz e Diamante */}
      <style>{`
        @keyframes rotateLightRing {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        .light-ring-spin {
          animation: rotateLightRing 8s linear infinite;
        }
        @keyframes diamondGlow {
          0%, 100% {
            filter: drop-shadow(0 0 12px rgba(245, 158, 11, 0.9));
            transform: scale(1);
          }
          50% {
            filter: drop-shadow(0 0 22px rgba(251, 191, 36, 1));
            transform: scale(1.1);
          }
        }
        .diamond-pulse {
          animation: diamondGlow 2.5s ease-in-out infinite;
        }
        @keyframes waveFlow {
          0% {
            stroke-dashoffset: 60;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        .wave-line-active {
          stroke-dasharray: 8, 4;
          animation: waveFlow 2s linear infinite;
        }
      `}</style>

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 p-0.5 shadow-lg shadow-amber-500/30">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-amber-400 font-black">
              <Crown className="w-5 h-5 text-amber-400 animate-bounce" />
            </div>
          </div>
          <div>
            <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-widest block">
              HISTÓRICO DE PARTICIPAÇÕES • TRILHA AGO
            </span>
            <h4 className="text-base font-black text-white tracking-tight">
              Evolução Temporal do Ministro ({ministroNome})
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {possuiInscricao2026 && onClickCredencial && (
            <button
              type="button"
              onClick={onClickCredencial}
              className="px-3.5 py-1.5 rounded-xl bg-amber-950/80 border border-amber-500/50 hover:border-amber-400 text-amber-300 font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Passaporte AGO 2026</span>
            </button>
          )}

          {/* Navegação do Slider */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={anterior}
              disabled={startIndex === 0}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-mono text-slate-400 px-1 font-bold">
              {startIndex + 1}-{Math.min(startIndex + 4, total)} / {total}
            </span>
            <button
              type="button"
              onClick={proximo}
              disabled={startIndex >= maxIndex}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ROTA HORIZONTAL: 4 CÍRCULOS DE LUZ SEM PREENCHIMENTO + DIAMANTE + ONDA FINA */}
      <div className="relative py-2">
        <div className="grid grid-cols-4 gap-3 sm:gap-6 items-center relative z-10">
          <AnimatePresence mode="popLayout">
            {itensVisiveis.map((item) => {
              const isPago = item.status === 'PAGO';
              const isAberto = item.status === 'ABERTO';

              return (
                <motion.div
                  key={item.ano}
                  initial={{ opacity: 0, scale: 0.85, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: -10 }}
                  transition={{ duration: 0.35 }}
                  className="flex flex-col items-center space-y-3 group cursor-pointer"
                >
                  {/* 1. CÍRCULO VAZADO DE LUZ COM DIAMANTE CENTRAL (SEM PREENCHIMENTO) */}
                  <div className="relative flex items-center justify-center">
                    {/* Anel Externo de Luz Pulso */}
                    {isPago && (
                      <div className="absolute w-20 h-20 rounded-full border border-amber-400/40 bg-transparent blur-md animate-pulse pointer-events-none" />
                    )}

                    {/* Círculo Anel de Luz (Hollow Circle) */}
                    <div
                      className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full relative flex items-center justify-center bg-slate-950/40 backdrop-blur-md transition-all duration-300 transform group-hover:scale-110 ${
                        isPago
                          ? 'border-2 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.85)]'
                          : isAberto
                          ? 'border-2 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.3)] opacity-80'
                          : 'border border-slate-800/80 opacity-25'
                      }`}
                    >
                      {/* Anel Interno Rotativo de Luz (Orbit Ring) */}
                      {isPago && (
                        <div className="absolute inset-1 rounded-full border border-dashed border-yellow-300/60 light-ring-spin pointer-events-none" />
                      )}

                      {/* DIAMANTE CENTRAL + EFEITOS DE LUZ DE ACORDO COM O STATUS */}
                      {isPago ? (
                        <div className="flex flex-col items-center justify-center text-amber-400">
                          <Gem className="w-7 h-7 text-amber-300 diamond-pulse" />
                          <span className="text-[8px] font-mono font-black uppercase tracking-tighter mt-0.5 text-amber-300">
                            QUITADO
                          </span>
                        </div>
                      ) : isAberto ? (
                        <div className="flex flex-col items-center justify-center text-amber-400/80">
                          <Gem className="w-6 h-6 text-amber-400/70" />
                          <span className="text-[8px] font-mono font-bold uppercase tracking-tighter mt-0.5 text-amber-400/80">
                            OPACA
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-600">
                          <Gem className="w-5 h-5 text-slate-700" />
                          <span className="text-[8px] font-mono font-bold uppercase tracking-tighter mt-0.5 text-slate-600">
                            APAGADA
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. EFEITO DE FLUXO EM ONDA FINA (SVG) */}
                  <div className="w-full flex items-center justify-center px-1">
                    <svg
                      viewBox="0 0 100 12"
                      className="w-full h-3 overflow-visible"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M 0 6 Q 25 0, 50 6 T 100 6"
                        fill="none"
                        stroke={isPago ? '#f59e0b' : isAberto ? '#fbbf24' : '#334155'}
                        strokeWidth={isPago ? '2.5' : '1.5'}
                        strokeOpacity={isPago ? '0.9' : isAberto ? '0.5' : '0.2'}
                        className={isPago ? 'wave-line-active' : ''}
                      />
                    </svg>
                  </div>

                  {/* 3. ANO DE PARTICIPAÇÃO ABAIXO DA ONDA FINA */}
                  <div className="text-center space-y-0.5">
                    <span
                      className={`text-sm sm:text-base font-mono font-black tracking-tight block ${
                        isPago
                          ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]'
                          : isAberto
                          ? 'text-amber-300/80 font-bold'
                          : 'text-slate-600 font-medium'
                      }`}
                    >
                      {item.ano}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500 block uppercase">
                      {item.edicao || 'AGO'}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Legenda Informativa */}
      <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono">
        <div className="flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full border border-amber-400 flex items-center justify-center shadow-[0_0_8px_#f59e0b]">
              <Gem className="w-2.5 h-2.5 text-amber-300" />
            </div>
            <span className="text-slate-200">
              <strong className="text-amber-400">Diamante Ouro:</strong> Pago / Quitado
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full border border-amber-500/40 flex items-center justify-center">
              <Gem className="w-2.5 h-2.5 text-amber-500/50" />
            </div>
            <span className="text-slate-300">
              <strong className="text-amber-300">Opaca:</strong> Inscrição Aberta
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full border border-slate-800 flex items-center justify-center opacity-40">
              <Gem className="w-2.5 h-2.5 text-slate-600" />
            </div>
            <span className="text-slate-400">
              <strong className="text-slate-500">Apagada:</strong> Não Inscrito
            </span>
          </div>
        </div>

        <span className="text-[10px] text-amber-500/80 font-bold uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" /> TRILHA DE FIDELIDADE AGO
        </span>
      </div>
    </div>
  );
}
