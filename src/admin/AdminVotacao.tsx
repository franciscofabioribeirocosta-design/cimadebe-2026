/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Admin Votação / Urna Eletrônica - Gestão de Pleitos, Tipos de Votação (Candidatos, Temas, Investimentos), Quesitos e Recharts
 */

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import {
  Vote,
  Plus,
  Trash2,
  CheckCircle2,
  Lock,
  Unlock,
  BarChart3,
  FileText,
  AlertCircle,
  Clock,
  UserCheck,
  Briefcase,
  Layers,
  Coins,
} from 'lucide-react';
import { formatarDataBR } from '../financialEngine';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

interface OpcaoVoto {
  id: string;
  nome: string;
  lider: string;
  proposta: string;
}

interface VotacaoItem {
  id: string;
  titulo: string;
  descricao: string;
  quesitos: string;
  tipoVotacao: 'ELEICAO_CANDIDATO' | 'ESCOLHA_TEMA' | 'APROVACAO_INVESTIMENTO';
  dataInicio: string;
  dataFim: string;
  status: 'ABERTA' | 'FECHADA' | 'AGENDADA';
  quorumMinimo: number;
  regrasElegibilidade: 'APENAS_ADIMPLENTES' | 'TODOS_MINISTROS';
  chapas: OpcaoVoto[];
  tenantId: string;
}

export function AdminVotacao({ tenantId, operadorId }: { tenantId: string; operadorId: string }) {
  const [votacoes, setVotacoes] = useState<VotacaoItem[]>([]);
  const [votos, setVotos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Modal Novo Pleito
  const [modalNovoAberto, setModalNovoAberto] = useState<boolean>(false);
  const [novoTitulo, setNovoTitulo] = useState<string>('');
  const [novaDescricao, setNewDescricao] = useState<string>('');
  const [tipoVotacao, setTipoVotacao] = useState<'ELEICAO_CANDIDATO' | 'ESCOLHA_TEMA' | 'APROVACAO_INVESTIMENTO'>('ELEICAO_CANDIDATO');
  const [novosQuesitos, setNovosQuesitos] = useState<string>('Escolha do Novo Tesoureiro Geral da Convenção');
  const [novaDataInicio, setNovaDataInicio] = useState<string>('2026-03-01');
  const [novaDataFim, setNovaDataFim] = useState<string>('2026-03-31');
  const [novoQuorum, setNovoQuorum] = useState<number>(50);
  const [regraElegibilidade, setRegraElegibilidade] = useState<'APENAS_ADIMPLENTES' | 'TODOS_MINISTROS'>('APENAS_ADIMPLENTES');
  
  const [opcoesForm, setOpcoesForm] = useState<Array<{ nome: string; lider: string; proposta: string }>>([
    { nome: 'Pr. Josué da Silva', lider: 'Candidato a Tesoureiro', proposta: 'Transparência contábil e auditoria digital' },
    { nome: 'Pr. Antônio Carlos', lider: 'Candidato a Tesoureiro', proposta: 'Redução de taxas e modernização do ledger' }
  ]);

  const [votacaoSelecionadaId, setVotacaoSelecionadaId] = useState<string | null>(null);

  useEffect(() => {
    setCarregando(true);
    const qVotacoes = query(collection(db, 'votacoes'), orderBy('dataInicio', 'desc'), limit(50));
    const unsubVotacoes = onSnapshot(
      qVotacoes,
      (snap) => {
        const lista: VotacaoItem[] = [];
        snap.forEach((d) => {
          lista.push({ id: d.id, ...d.data() } as VotacaoItem);
        });
        setVotacoes(lista);
        if (lista.length > 0 && !votacaoSelecionadaId) {
          setVotacaoSelecionadaId(lista[0].id);
        }
        setCarregando(false);
      },
      (err) => {
        console.warn('Erro ao carregar votações:', err);
        setCarregando(false);
      }
    );

    const qVotos = query(collection(db, 'votos_eletronicos'), limit(50));
    const unsubVotos = onSnapshot(
      qVotos,
      (snap) => {
        const listaVotos: any[] = [];
        snap.forEach((d) => {
          listaVotos.push({ id: d.id, ...d.data() });
        });
        setVotos(listaVotos);
      },
      (err) => {
        console.warn('Erro ao carregar votos:', err);
      }
    );

    return () => {
      unsubVotacoes();
      unsubVotos();
    };
  }, []);

  const criarVotacao = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!novoTitulo.trim() || opcoesForm.length === 0) {
      setErro('Informe o título e ao menos uma opção/candidato para a votação.');
      return;
    }

    try {
      const nova: Omit<VotacaoItem, 'id'> = {
        titulo: novoTitulo,
        descricao: novaDescricao,
        quesitos: novosQuesitos,
        tipoVotacao,
        dataInicio: novaDataInicio,
        dataFim: novaDataFim,
        status: 'ABERTA',
        quorumMinimo: Number(novoQuorum) || 50,
        regrasElegibilidade: regraElegibilidade,
        chapas: opcoesForm.map((c, idx) => ({ id: `op-${Date.now()}-${idx}`, ...c })),
        tenantId: tenantId || 't-sede-salvador',
      };

      await addDoc(collection(db, 'votacoes'), nova);
      setSucesso('Nova urna configurada e aberta com sucesso!');
      setModalNovoAberto(false);
      setNovoTitulo('');
      setNewDescricao('');
    } catch (err: any) {
      setErro(err?.message || 'Falha ao criar votação.');
    }
  };

  const alterarStatusVotacao = async (id: string, novoStatus: 'ABERTA' | 'FECHADA' | 'AGENDADA') => {
    try {
      await updateDoc(doc(db, 'votacoes', id), { status: novoStatus });
      setSucesso(`Status da votação atualizado para ${novoStatus}.`);
    } catch (err: any) {
      setErro(err?.message || 'Erro ao alterar status.');
    }
  };

  const deletarVotacao = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta votação e seus votos auditados?')) return;
    try {
      await deleteDoc(doc(db, 'votacoes', id));
      setSucesso('Votação excluída com sucesso.');
    } catch (err: any) {
      setErro(err?.message || 'Erro ao excluir votação.');
    }
  };

  const votacaoAtivaObj = votacoes.find((v) => v.id === votacaoSelecionadaId) || votacoes[0];
  const votosDaVotacao = votos.filter((v) => v.votacaoId === votacaoAtivaObj?.id);

  const contagemVotos = votacaoAtivaObj?.chapas.map((chapa) => {
    const total = votosDaVotacao.filter((v) => v.opId === chapa.id).length;
    return { name: chapa.nome, votos: total, lider: chapa.lider };
  }) || [];

  const totalVotosGeral = votosDaVotacao.length;
  const votacoesAbertasCount = votacoes.filter((v) => v.status === 'ABERTA').length;

  return (
    <div className="space-y-6 text-white font-sans">
      {/* Cabeçalho */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/30 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold">
            <Vote className="w-4 h-4 text-purple-400" />
            <span>URNA ELETRÔNICA • ELEIÇÕES, TEMAS & INVESTIMENTOS</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Dashboard Central de Pleitos & Escolhas Eclesiásticas
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Configure urnas para escolha de candidatos a cargos, votação de temas/estatutos ou aprovação de investimentos convenccionais com apuração analítica em tempo real.
          </p>
        </div>
        <button
          onClick={() => setModalNovoAberto(true)}
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-slate-950 font-black text-xs font-mono uppercase tracking-wider shadow-lg shadow-purple-500/30 transition-all cursor-pointer flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Nova Votação</span>
        </button>
      </div>

      {erro && (
        <div className="p-4 rounded-2xl bg-rose-950 border border-rose-500 text-rose-200 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {sucesso && (
        <div className="p-4 rounded-2xl bg-emerald-950 border border-emerald-500 text-emerald-200 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{sucesso}</span>
        </div>
      )}

      {/* Grid de Resumo Executivo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Urnas Cadastradas</span>
            <span className="text-3xl font-black text-white mt-1 block">{votacoes.length}</span>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Vote className="w-6 h-6" />
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Urnas Abertas</span>
            <span className="text-3xl font-black text-emerald-400 mt-1 block">{votacoesAbertasCount}</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Unlock className="w-6 h-6" />
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Votos Computados</span>
            <span className="text-3xl font-black text-amber-400 mt-1 block">{votos.length}</span>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Grid Principal: Listagem & Detalhes com Gráfico Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-sm font-mono font-bold text-slate-400 uppercase tracking-wider">
            Pleitos no Sistema ({votacoes.length})
          </h3>
          <div className="space-y-3">
            {votacoes.map((vot) => {
              const selecionada = vot.id === votacaoSelecionadaId;
              const aberta = vot.status === 'ABERTA';
              return (
                <div
                  key={vot.id}
                  onClick={() => setVotacaoSelecionadaId(vot.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                    selecionada
                      ? 'bg-purple-950/40 border-purple-500 shadow-lg shadow-purple-500/10'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-mono px-2.5 py-1 rounded-full font-bold border ${
                        aberta
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40 animate-pulse'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      {vot.status}
                    </span>
                    <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                      {vot.tipoVotacao === 'ELEICAO_CANDIDATO' ? '👤 Candidatos' : vot.tipoVotacao === 'ESCOLHA_TEMA' ? '📜 Temas' : '💰 Investimento'}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white line-clamp-1">{vot.titulo}</h4>
                  <p className="text-xs text-slate-400 line-clamp-1">{vot.quesitos}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detalhes, Opções e Gráfico Recharts */}
        <div className="lg:col-span-2 space-y-6">
          {votacaoAtivaObj ? (
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-6 shadow-2xl backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/40 font-bold uppercase">
                      {votacaoAtivaObj.tipoVotacao === 'ELEICAO_CANDIDATO' ? 'Eleição de Candidato' : votacaoAtivaObj.tipoVotacao === 'ESCOLHA_TEMA' ? 'Escolha de Tema' : 'Aprovação de Investimento'}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-white">{votacaoAtivaObj.titulo}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {votacaoAtivaObj.status === 'ABERTA' ? (
                    <button
                      onClick={() => alterarStatusVotacao(votacaoAtivaObj.id, 'FECHADA')}
                      className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold font-mono transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Fechar Urna</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => alterarStatusVotacao(votacaoAtivaObj.id, 'ABERTA')}
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold font-mono transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Abrir Urna</span>
                    </button>
                  )}
                  <button
                    onClick={() => deletarVotacao(votacaoAtivaObj.id)}
                    className="p-2 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-500/40 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Informações de Quesito e Vigência */}
              <div className="space-y-3 font-mono text-xs">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-purple-400 uppercase block font-bold">Quesito / Pergunta do Pleito</span>
                  <span className="text-white font-semibold text-sm">{votacaoAtivaObj.quesitos}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Vigência</span>
                    <span className="text-white">{formatarDataBR(votacaoAtivaObj.dataInicio)} a {formatarDataBR(votacaoAtivaObj.dataFim)}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Elegibilidade</span>
                    <span className="text-purple-300">{votacaoAtivaObj.regrasElegibilidade === 'APENAS_ADIMPLENTES' ? 'Apenas Adimplentes' : 'Todos os Ministros'}</span>
                  </div>
                </div>
              </div>

              {/* Gráfico Recharts */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                  <span>Apuração em Tempo Real</span>
                </h4>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={contagemVotos}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                      <Bar dataKey="votos" fill="#c084fc" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Auditoria de Votos */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Ledger de Votos ({votosDaVotacao.length} computados):
                </h4>
                <div className="max-h-36 overflow-y-auto space-y-2 font-mono text-[11px]">
                  {votosDaVotacao.map((v) => (
                    <div key={v.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                      <span className="text-slate-300">Eleitor: <strong className="text-white">{v.ministroNome || v.ministroId}</strong></span>
                      <span className="text-cyan-400 text-[10px]">Hash: {v.hashAudit?.substring(0, 16)}...</span>
                    </div>
                  ))}
                  {votosDaVotacao.length === 0 && (
                    <div className="p-4 text-center text-slate-500">Nenhum voto registrado nesta urna até o momento.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-3xl bg-slate-900 border border-slate-800 text-slate-400 font-mono text-xs">
              Selecione uma votação para visualizar o painel analítico.
            </div>
          )}
        </div>
      </div>

      {/* Modal Criar Nova Votação (Candidatos, Temas ou Investimentos) */}
      {modalNovoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={criarVotacao} className="bg-slate-900 border border-purple-500/40 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl text-white max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-black text-white">Configurar Nova Votação & Escolhas</h3>
            
            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-slate-400 uppercase text-[10px]">Tipo de Votação</label>
                <select
                  value={tipoVotacao}
                  onChange={(e: any) => {
                    setTipoVotacao(e.target.value);
                    if (e.target.value === 'ELEICAO_CANDIDATO') {
                      setNovosQuesitos('Escolha do Novo Tesoureiro Geral');
                      setOpcoesForm([
                        { nome: 'Pr. Josué da Silva', lider: 'Candidato a Tesoureiro', proposta: 'Transparência financeira e auditoria' },
                        { nome: 'Pr. Antônio Carlos', lider: 'Candidato a Tesoureiro', proposta: 'Redução de taxas e modernização' }
                      ]);
                    } else if (e.target.value === 'ESCOLHA_TEMA') {
                      setNovosQuesitos('Qual tema principal deve priorizar a Assembleia de 2026?');
                      setOpcoesForm([
                        { nome: 'Expansão Missionária Nacional', lider: 'Pauta eclesiástica', proposta: 'Abertura de 50 novas congregações' },
                        { nome: 'Reforma do Estatuto e Governança', lider: 'Pauta administrativa', proposta: 'Atualização digital do estatuto' }
                      ]);
                    } else {
                      setNovosQuesitos('Em qual projeto de investimento aplicaremos o fundo regional?');
                      setOpcoesForm([
                        { nome: 'Construção da Sede Regional', lider: 'Projeto de Infraestrutura', proposta: 'Edifício com auditório para 2.000 pessoas' },
                        { nome: 'Aquisição de Unidade Móvel Teológica', lider: 'Projeto Educacional', proposta: 'Ônibus equipado para capacitação' }
                      ]);
                    }
                  }}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white mt-1"
                >
                  <option value="ELEICAO_CANDIDATO">👤 Eleição de Candidato / Cargo (Ex: Tesoureiro, Secretário)</option>
                  <option value="ESCOLHA_TEMA">📜 Escolha de Tema / Pauta Estatutária</option>
                  <option value="APROVACAO_INVESTIMENTO">💰 Aprovação de Investimento / Orçamento</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 uppercase text-[10px]">Título do Pleito</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Pleito Oficial 2026"
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white mt-1"
                />
              </div>

              <div>
                <label className="text-slate-400 uppercase text-[10px]">Quesito / Pergunta Exposta ao Ministro</label>
                <input
                  type="text"
                  required
                  value={novosQuesitos}
                  onChange={(e) => setNovosQuesitos(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white mt-1"
                />
              </div>

              <div>
                <label className="text-slate-400 uppercase text-[10px]">Descrição / Regulamento</label>
                <textarea
                  rows={2}
                  value={novaDescricao}
                  onChange={(e) => setNewDescricao(e.target.value)}
                  placeholder="Detalhes e orientações para a votação..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 uppercase text-[10px]">Início</label>
                  <input
                    type="date"
                    value={novaDataInicio}
                    onChange={(e) => setNovaDataInicio(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-400 uppercase text-[10px]">Fim</label>
                  <input
                    type="date"
                    value={novaDataFim}
                    onChange={(e) => setNovaDataFim(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 uppercase text-[10px]">Regra de Elegibilidade</label>
                <select
                  value={regraElegibilidade}
                  onChange={(e: any) => setRegraElegibilidade(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white mt-1"
                >
                  <option value="APENAS_ADIMPLENTES">Apenas Ministros Adimplentes</option>
                  <option value="TODOS_MINISTROS">Todos os Ministros Ativos</option>
                </select>
              </div>

              {/* Opções / Candidatos / Temas / Investimentos */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase">Opções / Escolhas Disponíveis:</span>
                  <button
                    type="button"
                    onClick={() => setOpcoesForm([...opcoesForm, { nome: '', lider: '', proposta: '' }])}
                    className="px-2.5 py-1 rounded-lg bg-purple-950 text-purple-300 border border-purple-500/40 text-[10px] font-bold cursor-pointer"
                  >
                    + Adicionar Opção
                  </button>
                </div>
                <div className="space-y-2">
                  {opcoesForm.map((op, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          placeholder="Nome da Opção / Candidato / Tema / Investimento"
                          value={op.nome}
                          onChange={(e) => {
                            const arr = [...opcoesForm];
                            arr[idx].nome = e.target.value;
                            setOpcoesForm(arr);
                          }}
                          className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs"
                        />
                        {opcoesForm.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setOpcoesForm(opcoesForm.filter((_, i) => i !== idx))}
                            className="p-2 text-rose-400 hover:text-rose-300 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Subtítulo / Categoria"
                          value={op.lider}
                          onChange={(e) => {
                            const arr = [...opcoesForm];
                            arr[idx].lider = e.target.value;
                            setOpcoesForm(arr);
                          }}
                          className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Proposta / Descrição Resumida"
                          value={op.proposta}
                          onChange={(e) => {
                            const arr = [...opcoesForm];
                            arr[idx].proposta = e.target.value;
                            setOpcoesForm(arr);
                          }}
                          className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalNovoAberto(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Publicar Urna & Opções
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
