/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * PortalVotacaoMinistro - Urna Eletrônica Móvel do Delegado da AGO
 * Escuta Pautas Abertas em Tempo Real via onSnapshot passivo.
 * Votação auditável com hash SHA-256 e congelamento anti-duplo voto.
 */

import React, { useState, useEffect } from 'react';
import {
  Vote,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Lock,
  Sparkles,
  Flame,
  Award,
  Hash,
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Ministro } from '../types';

interface PautaAberta {
  id: string;
  titulo: string;
  descricao?: string;
  status: 'VOTACAO_ABERTA' | 'VOTACAO_ENCERRADA';
  totalVotos?: number;
  abertaEm?: string;
}

interface PortalVotacaoMinistroProps {
  readonly ministro: Ministro;
  readonly onVotoComputado?: (recibo: any) => void;
}

export function PortalVotacaoMinistro({
  ministro,
  onVotoComputado,
}: PortalVotacaoMinistroProps) {
  const [pautasAbertas, setPautasAbertas] = useState<PautaAberta[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [votosComputados, setVotosComputados] = useState<Record<string, { opcao: string; hashSha256: string; data: string }>>({});
  const [votandoPautaId, setVotandoPautaId] = useState<string | null>(null);
  const [opcaoSelecionada, setOpcaoSelecionada] = useState<'FAVOR' | 'CONTRA' | 'ABSTENCAO' | null>(null);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  const cleanMinistroId = ministro?.id || '';
  const presencaConfirmada = (ministro as any)?.presencaAgoVigente === true;
  const isAdimplente =
    ministro?.statusAdimplencia === 'ADIMPLENTE' ||
    ministro?.statusAdimplencia === 'EM_DIA' ||
    ministro?.statusAdimplencia === 'EM_DIA_FUTURO';

  // 1. Escuta passiva singleton de pautas com status VOTACAO_ABERTA (Anti-Query Explosion limit 5)
  useEffect(() => {
    setCarregando(true);
    const qPautas = query(
      collection(db, 'ago_pautas'),
      where('status', '==', 'VOTACAO_ABERTA'),
      limit(5)
    );

    const unsubPautas = onSnapshot(
      qPautas,
      (snap) => {
        if (!snap.empty) {
          const lista: PautaAberta[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));
          setPautasAbertas(lista);
        } else {
          setPautasAbertas([]);
        }
        setCarregando(false);
      },
      (err) => {
        console.warn('[VOTACAO_MINISTRO_PAUTAS_ERR]', err?.message);
        setCarregando(false);
      }
    );

    return () => unsubPautas();
  }, []);

  // 2. Escuta passiva dos votos já computados por este ministro específico (limit 20)
  useEffect(() => {
    if (!cleanMinistroId) return;

    const qMeusVotos = query(
      collection(db, 'ago_votos_computados'),
      where('ministroId', '==', cleanMinistroId),
      limit(20)
    );

    const unsubVotos = onSnapshot(
      qMeusVotos,
      (snap) => {
        if (!snap.empty) {
          const map: Record<string, { opcao: string; hashSha256: string; data: string }> = {};
          snap.docs.forEach((d) => {
            const data = d.data();
            map[data.pautaId] = {
              opcao: data.opcao,
              hashSha256: data.hashSha256 || d.id,
              data: data.timestamp,
            };
          });
          setVotosComputados(map);
        } else {
          setVotosComputados({});
        }
      },
      (err) => {
        console.warn('[VOTACAO_MINISTRO_MEUS_VOTOS_ERR]', err?.message);
      }
    );

    return () => unsubVotos();
  }, [cleanMinistroId]);

  // Execução do Voto Eletrônico com trava imediata
  const handleRegistrarVoto = async (pautaId: string, opcao: 'FAVOR' | 'CONTRA' | 'ABSTENCAO') => {
    if (!cleanMinistroId || !presencaConfirmada) return;

    setVotandoPautaId(pautaId);
    setOpcaoSelecionada(opcao);
    setFeedback(null);

    try {
      const res = await fetch('/api/ago/voto/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pautaId,
          ministroId: cleanMinistroId,
          opcao,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || 'Erro ao registrar voto.');
      }

      setFeedback({
        tipo: 'sucesso',
        texto: 'Seu voto foi computado com sucesso na Urna Eletrônica da Convenção!',
      });

      if (onVotoComputado) {
        onVotoComputado(body.recibo);
      }
    } catch (err: any) {
      setFeedback({
        tipo: 'erro',
        texto: err?.message || 'Falha na comunicação com a urna eletrônica.',
      });
    } finally {
      setVotandoPautaId(null);
      setOpcaoSelecionada(null);
    }
  };

  return (
    <div className="space-y-5 w-full min-w-0">
      {/* CABEÇALHO DO TERMINAL MÓVEL */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/30 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <Vote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                <span>Urna Eletrônica Deliberativa (AGO)</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-500/40 font-mono font-bold">
                  PLENÁRIA OFICIAL
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Delegado: <strong>{ministro?.nome}</strong> ({ministro?.cargo})
              </p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            {presencaConfirmada ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>CHECK-IN ATIVO</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/90 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>CHECK-IN PENDENTE</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* BLOQUEIOS PREVENTIVOS DE PRESENÇA OU ADIMPLÊNCIA */}
      {!isAdimplente && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs font-mono flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <strong>Votação Bloqueada:</strong> O seu registro eclesiástico consta com pendência financeira na convenção. Apenas ministros com quitação plena possuem direito de voto deliberativo nas plenárias da AGO.
          </div>
        </div>
      )}

      {isAdimplente && !presencaConfirmada && (
        <div className="p-4 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-200 text-xs font-mono flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong>Presença Não Registrada na Portaria:</strong> Para exercer seu voto eletrônico, apresente seu Crachá/Credencial na portaria da Assembleia Geral para confirmação do seu check-in de quórum.
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-mono flex items-center gap-2 ${
            feedback.tipo === 'sucesso'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
          }`}
        >
          {feedback.tipo === 'sucesso' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.texto}</span>
        </div>
      )}

      {/* ESTADO DE CARREGAMENTO */}
      {carregando ? (
        <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-xs font-mono text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
          <span>Sincronizando com a Mesa Diretora...</span>
        </div>
      ) : pautasAbertas.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2">
          <Vote className="w-8 h-8 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-white">Nenhuma pauta em votação aberta agora</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Assim que a Mesa Diretora abrir um quesito ou proposta para deliberação na Plenária, os botões de voto aparecerão automaticamente nesta tela em tempo real.
          </p>
        </div>
      ) : (
        /* PAUTAS ABERTAS COM BOTÕES GIGANTES PARA CELULAR */
        <div className="space-y-6">
          {pautasAbertas.map((pauta) => {
            const votoComputado = votosComputados[pauta.id];
            const jaVotou = Boolean(votoComputado);
            const votandoEsta = votandoPautaId === pauta.id;

            return (
              <div
                key={pauta.id}
                className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-purple-500/40 shadow-xl space-y-5"
              >
                <div className="space-y-1.5 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold animate-pulse">
                      ● EM VOTAÇÃO NA PLENÁRIA
                    </span>
                  </div>
                  <h4 className="text-lg sm:text-xl font-black text-white">{pauta.titulo}</h4>
                  {pauta.descricao && (
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {pauta.descricao}
                    </p>
                  )}
                </div>

                {/* CENÁRIO 1: O MINISTRO JÁ VOTOU NESTA PAUTA -> RECIBO CRIPTOGRÁFICO AUDITÁVEL */}
                {jaVotou ? (
                  <div className="p-5 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-3 font-mono text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h5 className="text-base font-bold text-white">Seu voto foi registrado com sucesso!</h5>
                      <p className="text-xs text-emerald-400 font-bold mt-0.5">
                        Opção escolhida: [{votoComputado.opcao}]
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-[10px] text-slate-400 space-y-1 text-left">
                      <div className="flex items-center gap-1.5 text-purple-400 font-bold">
                        <Hash className="w-3.5 h-3.5" />
                        <span>Hash Criptográfico de Auditoria (SHA-256):</span>
                      </div>
                      <div className="font-mono text-[9px] text-slate-300 break-all select-all bg-slate-950 p-1.5 rounded border border-slate-800">
                        {votoComputado.hashSha256}
                      </div>
                    </div>
                  </div>
                ) : !presencaConfirmada || !isAdimplente ? (
                  /* CENÁRIO 2: DELEGADO SEM CHECK-IN OU INADIMPLENTE */
                  <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-2 text-slate-400 font-mono text-xs">
                    <Lock className="w-8 h-8 text-slate-600 mx-auto" />
                    <p>Urna bloqueada para este delegado até confirmação de check-in.</p>
                  </div>
                ) : (
                  /* CENÁRIO 3: BOTOES DE VOTAÇÃO GIGANTES E OTIMIZADOS PARA CELULAR */
                  <div className="space-y-3">
                    <span className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider block">
                      Selecione sua deliberação consciente:
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* BOTAO A FAVOR */}
                      <button
                        type="button"
                        onClick={() => handleRegistrarVoto(pauta.id, 'FAVOR')}
                        disabled={Boolean(votandoPautaId)}
                        className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:scale-95 text-slate-950 font-black text-base sm:text-lg flex flex-col items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {votandoEsta && opcaoSelecionada === 'FAVOR' ? (
                          <Loader2 className="w-8 h-8 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-8 h-8 text-slate-950" />
                        )}
                        <span>A FAVOR</span>
                        <span className="text-[10px] font-mono text-emerald-950 uppercase font-bold">
                          Aprovar Pauta
                        </span>
                      </button>

                      {/* BOTAO CONTRA */}
                      <button
                        type="button"
                        onClick={() => handleRegistrarVoto(pauta.id, 'CONTRA')}
                        disabled={Boolean(votandoPautaId)}
                        className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-95 text-white font-black text-base sm:text-lg flex flex-col items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {votandoEsta && opcaoSelecionada === 'CONTRA' ? (
                          <Loader2 className="w-8 h-8 animate-spin" />
                        ) : (
                          <XCircle className="w-8 h-8 text-white" />
                        )}
                        <span>CONTRA</span>
                        <span className="text-[10px] font-mono text-rose-200 uppercase font-bold">
                          Rejeitar Pauta
                        </span>
                      </button>

                      {/* BOTAO ABSTENÇÃO */}
                      <button
                        type="button"
                        onClick={() => handleRegistrarVoto(pauta.id, 'ABSTENCAO')}
                        disabled={Boolean(votandoPautaId)}
                        className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 active:scale-95 text-slate-950 font-black text-base sm:text-lg flex flex-col items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {votandoEsta && opcaoSelecionada === 'ABSTENCAO' ? (
                          <Loader2 className="w-8 h-8 animate-spin" />
                        ) : (
                          <MinusCircle className="w-8 h-8 text-slate-950" />
                        )}
                        <span>ABSTENÇÃO</span>
                        <span className="text-[10px] font-mono text-amber-950 uppercase font-bold">
                          Abster-se
                        </span>
                      </button>
                    </div>

                    <p className="text-[10px] font-mono text-slate-400 text-center pt-2">
                      🔒 O clique computa imediatamente o recibo criptográfico irreversível. Duplo voto é bloqueado.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PortalVotacaoMinistro;
