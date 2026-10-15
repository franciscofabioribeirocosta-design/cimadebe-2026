/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Componente Principal: AgoInscricaoFrontend.tsx
 * Interface unificada de inscrição e triagem AGO, gerenciando busca por CPF,
 * verificação de adimplência, exibição de planos dinâmicos e crachá digital.
 */

import React, { useState } from 'react';
import { Etapa3BuscaTriagemAgo } from '../admin/Etapa3BuscaTriagemAgo';
import type { Ministro } from '../types';
import type { PlanoAgo } from '../services/planosAgoService';
import { efetivarInscricaoAGO } from '../services/agoFirebaseService';
import { ShieldCheck, ArrowLeft, CheckCircle2, RefreshCw } from 'lucide-react';

export function AgoInscricaoFrontend() {
  const [etapaFluxo, setEtapaFluxo] = useState<'BUSCA' | 'PAGAMENTO' | 'SUCESSO'>('BUSCA');
  const [ministroSelecionado, setMinistroSelecionado] = useState<Ministro | null>(null);
  const [planoEscolhido, setPlanoEscolhido] = useState<PlanoAgo | null>(null);
  const [modalidadeEscolhida, setModalidadeEscolhida] = useState<string>('INSCRICAO');
  const [processandoPagamento, setProcessandoPagamento] = useState<boolean>(false);
  const [erroPagamento, setErroPagamento] = useState<string | null>(null);

  const lidarComProsseguirPagamento = (ministro: Ministro, plano: PlanoAgo, modalidade?: string) => {
    setMinistroSelecionado(ministro);
    setPlanoEscolhido(plano);
    setModalidadeEscolhida(modalidade || 'INSCRICAO');
    setEtapaFluxo('PAGAMENTO');
  };

  const lidarComEfetivarPagamentoSimulado = async () => {
    if (!ministroSelecionado || !planoEscolhido) return;

    setProcessandoPagamento(true);
    setErroPagamento(null);

    try {
      const chaveIdempotencia = `${ministroSelecionado.id}_AGO_2026_${planoEscolhido.id}_${Date.now()}`;
      const dadosInscricao = {
        ministroId: ministroSelecionado.id,
        ministroNome: ministroSelecionado.nome,
        ministroCpf: ministroSelecionado.cpf,
        cargo: ministroSelecionado.cargo,
        fotoUrl: ministroSelecionado.fotoUrl || '',
        planoId: planoEscolhido.id,
        planoNome: planoEscolhido.nome,
        valor: planoEscolhido.valor,
        modalidade: modalidadeEscolhida,
        cicloAGO: '2026',
        formaPagamento: 'PIX',
      };

      await efetivarInscricaoAGO(dadosInscricao, chaveIdempotencia);
      setEtapaFluxo('SUCESSO');
    } catch (err: any) {
      console.error('Erro ao efetivar inscrição:', err);
      setErroPagamento(err?.message || 'Falha ao processar a transação atômica.');
    } finally {
      setProcessandoPagamento(false);
    }
  };

  return (
    <div className="w-full min-h-[80vh] flex flex-col justify-between py-6">
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 space-y-8">
        {/* Cabeçalho do Módulo */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-600/30 flex items-center justify-center text-indigo-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-widest block">
                MÓDULO OFICIAL • CIMADEBE
              </span>
              <h2 className="text-lg font-black text-slate-900">Inscrição AGO 2026</h2>
            </div>
          </div>

          {etapaFluxo !== 'BUSCA' && (
            <button
              type="button"
              onClick={() => {
                setEtapaFluxo('BUSCA');
                setMinistroSelecionado(null);
                setPlanoEscolhido(null);
              }}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar à Busca</span>
            </button>
          )}
        </div>

        {/* Renderização condicional dos estados do fluxo */}
        {etapaFluxo === 'BUSCA' && (
          <Etapa3BuscaTriagemAgo
            cicloAGO="2026"
            onProsseguirPagamento={lidarComProsseguirPagamento}
          />
        )}

        {etapaFluxo === 'PAGAMENTO' && ministroSelecionado && planoEscolhido && (
          <div className="max-w-2xl mx-auto p-8 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-6 font-sans">
            <div className="text-center space-y-2">
              <span className="text-xs font-mono font-bold text-indigo-600 uppercase tracking-wider">
                CHECKOUT ATÔMICO (RUNTRANSACTION)
              </span>
              <h3 className="text-2xl font-black text-slate-900">Confirmação de Pagamento</h3>
              <p className="text-xs text-slate-500">
                Revise os dados da sua adesão antes de efetivar a transação no Core Banking.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 font-mono text-xs">
              <div className="flex items-center gap-3.5 pb-3 border-b border-slate-200">
                {ministroSelecionado.fotoUrl ? (
                  <img
                    src={ministroSelecionado.fotoUrl}
                    alt={ministroSelecionado.nome}
                    className="w-12 h-12 rounded-xl object-cover border border-indigo-500/40 shadow-sm shrink-0 bg-slate-100"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-sm shrink-0">
                    {ministroSelecionado.nome?.charAt(0) || 'M'}
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-black text-slate-900 font-sans">{ministroSelecionado.nome}</h4>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {ministroSelecionado.cargo} • CPF: {ministroSelecionado.cpf}
                  </p>
                </div>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Plano Escolhido:</span>
                <span className="text-slate-900 font-bold">{planoEscolhido.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Modalidade:</span>
                <span className="text-indigo-600 font-bold">{modalidadeEscolhida}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-slate-200 text-sm font-bold">
                <span className="text-slate-600">Total a Pagar:</span>
                <span className="text-emerald-600 text-base">{planoEscolhido.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            </div>

            {erroPagamento && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono">
                {erroPagamento}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEtapaFluxo('BUSCA')}
                disabled={processandoPagamento}
                className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={lidarComEfetivarPagamentoSimulado}
                disabled={processandoPagamento}
                className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs font-bold uppercase tracking-wider shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {processandoPagamento && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{processandoPagamento ? 'Processando Transação...' : 'Efetivar Inscrição'}</span>
              </button>
            </div>
          </div>
        )}

        {etapaFluxo === 'SUCESSO' && (
          <div className="max-w-xl mx-auto p-10 rounded-3xl bg-slate-900 text-white text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-widest">
                TRANSAÇÃO CONCLUÍDA COM SUCESSO
              </span>
              <h3 className="text-2xl font-black">Inscrição Homologada!</h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                Sua adesão foi confirmada e sua inscrição na Assembleia Geral Ordinária está garantida.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEtapaFluxo('BUSCA');
                setMinistroSelecionado(null);
                setPlanoEscolhido(null);
              }}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold uppercase tracking-wider cursor-pointer shadow-lg"
            >
              Realizar Nova Consulta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
