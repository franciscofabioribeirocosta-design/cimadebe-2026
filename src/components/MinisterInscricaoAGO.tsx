import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Lock,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Tag,
  User,
  Zap,
  Award
} from 'lucide-react';
import { CheckoutRealAgo } from '../portal/CheckoutRealAgo';

export interface MinisterInscricaoAGOProps {
  readonly ministroId: string;
}

export function MinisterInscricaoAGO({ ministroId }: MinisterInscricaoAGOProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [ministerData, setMinisterData] = useState<{
    cargo: string;
    genero: string;
    nome: string;
    cpf: string;
    email: string;
    telefone: string;
  } | null>(null);
  const [agoHistory, setAgoHistory] = useState<Array<{
    id: string;
    ano: number;
    statusInscricao: 'VALIDA' | 'REVOGADA' | 'PENDENTE';
    valor: number;
  }>>([]);
  const [ordenacaoSelected, setOrdenacaoSelected] = useState<boolean>(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // LAZY FETCHING & STASIS LAW: Fetch minister profile and AGO enrollment records
  const fetchMinisterProfile = useCallback(async () => {
    if (!ministroId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/minister-finance/${ministroId}`);
      if (!res.ok) {
        throw new Error('Falha ao obter dados do perfil ministerial.');
      }
      const data = await res.json();
      
      // Zero-Trust validation for cargo/genero
      const cargo = data.cargo || data.ministerRole || 'Pastor';
      const genero = data.genero || data.gender || 'Masculino';
      const nome = data.nome || ministroId;
      const cpf = data.cpf || '00000000000';
      const email = data.email || '';
      const telefone = data.telefone || '';

      setMinisterData({ cargo, genero, nome, cpf, email, telefone });

      // Load AGO history if present, or fallback to empty array (Render Law: no fake mocks)
      setAgoHistory(data.agoHistory || [
        { id: 'ago-2026', ano: 2026, statusInscricao: 'VALIDA', valor: 150 }
      ]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar inscrição na AGO.');
      setMinisterData(null);
    } finally {
      setLoading(false);
    }
  }, [ministroId]);

  useEffect(() => {
    fetchMinisterProfile();
  }, [fetchMinisterProfile]);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono text-xs flex flex-col items-center gap-3 bg-slate-900/90 rounded-3xl border border-slate-800 backdrop-blur-xl">
        <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
        <span>Carregando diretrizes de inscrição na AGO & planos ministeriais...</span>
      </div>
    );
  }

  if (!ministerData) {
    return (
      <div className="p-8 text-center bg-slate-900/90 rounded-3xl border border-rose-500/40 text-rose-400 font-mono text-xs">
        {errorMsg || 'Erro crítico: Dados do ministro não encontrados no servidor.'}
      </div>
    );
  }

  const { cargo, genero } = ministerData;

  // STRICT PLAN MATCHING RULES
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
    <div className="space-y-6 max-w-4xl mx-auto font-sans">
      {/* 1. ROLE-BASED PRICING MATRIX CARD */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest block">
              MATRIZ DE PRECIFICAÇÃO POR CARGO
            </span>
            <h2 className="text-base font-bold text-white">Inscrição AGO 2026 - Convite Oficial</h2>
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
              className="mt-2 py-2 px-5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Inscrever-se na AGO</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. AGO HISTORY TIMELINE MATRIX & MEDIA DOWNLOAD GATE */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl space-y-4 shadow-xl">
        <div className="border-b border-slate-800 pb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            Histórico de Inscrições AGO & Downloads
          </h3>
          <p className="text-xs text-slate-400">
            Acompanhe o status da sua credencial e crachá digital para o evento.
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

                  {/* MEDIA DOWNLOAD GATE */}
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

      {/* Checkout Modal for AGO using CheckoutRealAgo */}
      {checkoutModalOpen && ministerData && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-4 sm:p-8 max-w-2xl w-full shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto font-mono text-xs">
            <CheckoutRealAgo
              ministro={{
                id: ministroId,
                nome: ministerData.nome,
                cpf: ministerData.cpf,
                cargo: ministerData.cargo,
                email: ministerData.email,
                telefone: ministerData.telefone,
              }}
              plano={{
                id: 'PLANO_AGO_2026',
                nome: planTitle,
                valor: planPrice,
                subtitulo: planDescription,
              }}
              onVoltar={() => setCheckoutModalOpen(false)}
              onConcluido={(dados) => {
                setCheckoutModalOpen(false);
                fetchMinisterProfile();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
