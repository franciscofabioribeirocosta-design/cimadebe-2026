/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Módulo: Inscritos AGO - Relatório e Tabela de Ministros Inscritos na AGO 2026
 * Design Estilo Banco Premium / Modern & Clean (Inspiração: Stripe, Nubank, Vercel)
 * Sincronização em Tempo Real (onSnapshot) com Firestore
 */

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useSecurity } from '../SecurityContext';
import {
  ouvirInscricoesAgo,
  ouvirEstatisticasAgo,
  InscricaoAgoDocumento,
  EstatisticasAgoTotais,
  deletarInscricaoAgoTransacional,
} from '../services/inscricaoAgoService';
import { CrachaCredencialAgoModal } from '../components/CrachaCredencialAgoModal';
import { extrairEventoAgo } from '../db/databaseService';
import { EmblemasEvolucaoAgo3D } from '../components/EmblemasEvolucaoAgo3D';
import { DossieMinisterialModal } from '../components/DossieMinisterialModal';
import { PainelAuditoriaAgoFiliacao } from '../components/PainelAuditoriaAgoFiliacao';
import { exportarPdfTabelaInscritosAgoFiltrados } from '../services/pdfExportService';
import { Phone, Shield, User } from 'lucide-react';
import type { Ministro } from '../types';
import {
  Users,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  ShieldCheck,
  CreditCard,
  QrCode,
  FileText,
  DollarSign,
  TrendingUp,
  Filter,
  Check,
  X,
  Eye,
} from 'lucide-react';

function formatarMoeda(val: number): string {
  return (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function AdminInscricaoPlano1Ago() {
  const { addAuditLog, ministros, anuidades, inscricoesAGO, appConfig, eventos, cicloAgoVigente } = useSecurity();

  // Estados em Tempo Real de Inscrições e Totais (onSnapshot)
  const [inscricoes, setInscricoes] = useState<InscricaoAgoDocumento[]>([]);
  const [estatisticas, setEstatisticas] = useState<EstatisticasAgoTotais | null>(null);
  const [carregandoInscricoes, setCarregandoInscricoes] = useState<boolean>(true);

  // Aba Ativa (Tabela de Inscritos vs. Log de Auditoria Contábil)
  const [abaVisao, setAbaVisao] = useState<'TABELA' | 'AUDITORIA'>('TABELA');

  // Modal de Dossiê Ministerial
  const [ministroDossie, setMinistroDossie] = useState<Ministro | null>(null);

  // Filtros da Tabela de Inscritos
  const [buscaInscrito, setBuscaInscrito] = useState<string>('');
  const [filtroPlano, setFiltroPlano] = useState<string>('TODOS');
  const [filtroCargo, setFiltroCargo] = useState<string>('TODOS');
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');

  // Modal de Detalhes
  const [inscritoDetalhes, setInscritoDetalhes] = useState<InscricaoAgoDocumento | null>(null);

  // Deletar Inscrição com Rastreabilidade, Confirmação e Justificativa
  const [modalDeletarInscricaoAberto, setModalDeletarInscricaoAberto] = useState<boolean>(false);
  const [inscricaoParaDeletar, setInscricaoParaDeletar] = useState<InscricaoAgoDocumento | null>(null);
  const [justificativaInscricaoDelecao, setJustificativaInscricaoDelecao] = useState<string>('');
  const [processandoDelecao, setProcessandoDelecao] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  const abrirModalDeletarInscricao = (insc: InscricaoAgoDocumento, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setInscricaoParaDeletar(insc);
    setJustificativaInscricaoDelecao('');
    setModalDeletarInscricaoAberto(true);
  };

  const lidarComConfirmarDelecaoInscricao = async () => {
    if (!inscricaoParaDeletar) return;
    if (!justificativaInscricaoDelecao.trim()) {
      alert('Por favor, informe uma justificativa válida para realizar a exclusão.');
      return;
    }

    try {
      setProcessandoDelecao(true);
      setFeedback(null);

      // Buscar documentos relacionados de forma assíncrona antes de iniciar a transação
      const anuidadesQuery = query(
        collection(db, 'anuidades'),
        where('ministroId', '==', inscricaoParaDeletar.ministroId)
      );
      const anuidadesSnap = await getDocs(anuidadesQuery);
      const anuidadesIds = anuidadesSnap.docs
        .filter((d) => d.id.startsWith('an-ago-'))
        .map((d) => d.id);

      const lancamentosQuery = query(
        collection(db, 'lancamentos_ago'),
        where('inscritoNome', '==', inscricaoParaDeletar.ministroNome)
      );
      const lancamentosSnap = await getDocs(lancamentosQuery);
      const lancamentosIds = lancamentosSnap.docs.map((d) => d.id);

      // Chamar o serviço transacional robusto
      const res = await deletarInscricaoAgoTransacional(
        db,
        inscricaoParaDeletar.id,
        justificativaInscricaoDelecao.trim(),
        'Administrador Sede',
        'op-admin',
        { lancamentosIds, anuidadesIds }
      );

      setModalDeletarInscricaoAberto(false);
      setInscricaoParaDeletar(null);
      setJustificativaInscricaoDelecao('');
      setFeedback({
        tipo: 'sucesso',
        texto: res.mensagem || 'Inscrição excluída com sucesso e caixa estornado.',
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback({
        tipo: 'erro',
        texto: err?.message || 'Erro ao excluir inscrição.',
      });
    } finally {
      setProcessandoDelecao(false);
    }
  };

  useEffect(() => {
    setCarregandoInscricoes(true);
    const unsubInscricoes = ouvirInscricoesAgo(
      db,
      (docs) => {
        setInscricoes(docs);
        setCarregandoInscricoes(false);
      },
      (err) => {
        const msg = (err?.message || '').toLowerCase();
        const isQuotaErr = msg.includes('quota') || msg.includes('resourceexhausted') || msg.includes('exceeded') || msg.includes('limit') || msg.includes('free daily read units');
        if (isQuotaErr) {
          console.warn('[AdminInscricaoPlano1Ago] Quota excedida. Usando modo de resiliência local.');
          setInscricoes([]);
        } else {
          console.error('Erro ao escutar inscrições:', err);
        }
        setCarregandoInscricoes(false);
      }
    );

    const unsubEvolucao = ouvirEstatisticasAgo(
      db,
      (totais) => {
        setEstatisticas(totais);
      },
      (err) => {
        const isQuotaErr = err?.message?.includes('Quota') || err?.message?.includes('quota');
        if (isQuotaErr) {
          console.warn('[AdminInscricaoPlano1Ago] Quota de estatísticas excedida.');
        } else {
          console.error('Erro ao escutar estatísticas:', err);
        }
      }
    );

    return () => {
      unsubInscricoes();
      unsubEvolucao();
    };
  }, []);

  // Lista Filtrada de Inscritos
  const listaFiltrada = useMemo(() => {
    return inscricoes.filter((item) => {
      const b = (buscaInscrito || '').toLowerCase().trim();
      const nomeNorm = (item.ministroNome || '').toLowerCase();
      const cpfNorm = String(item.ministroCpf || '');
      const cargoNorm = (item.cargo || '').toLowerCase();

      const atendeBusca =
        !b ||
        nomeNorm.includes(b) ||
        cpfNorm.includes(b) ||
        cargoNorm.includes(b);

      const atendePlano = filtroPlano === 'TODOS' || item.planoId === filtroPlano;
      const atendeCargo = filtroCargo === 'TODOS' || item.cargo === filtroCargo;
      const atendeStatus = filtroStatus === 'TODOS' || item.status === filtroStatus;

      return atendeBusca && atendePlano && atendeCargo && atendeStatus;
    });
  }, [inscricoes, buscaInscrito, filtroPlano, filtroCargo, filtroStatus]);

  const exportarCSV = () => {
    const cabecalho = 'Nome;CPF;Cargo;Plano;Valor;Forma Pagamento;Status;Data Inscrição\n';
    const linhas = listaFiltrada
      .map(
        (i) =>
          `"${i.ministroNome}";"${i.ministroCpf}";"${i.cargo}";"${i.planoNome}";"${i.valor}";"${i.formaPagamento}";"${i.status}";"${i.dataInscricao}"`
      )
      .join('\n');

    const blob = new Blob([cabecalho + linhas], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `INSCRITOS_AGO_2026_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addAuditLog(
      'AGO_INSCRICAO_REALIZADA',
      `Exportado relatório CSV com ${listaFiltrada.length} inscritos da AGO 2026`,
      'TENANT_SEDE_GERAL'
    );
  };

  const exportarPDF = () => {
    try {
      exportarPdfTabelaInscritosAgoFiltrados(
        listaFiltrada,
        {
          busca: buscaInscrito,
          plano: filtroPlano,
          status: filtroStatus,
        },
        appConfig,
        2026
      );
      addAuditLog(
        'AGO_INSCRICAO_REALIZADA',
        `Exportado relatório PDF oficial com ${listaFiltrada.length} inscritos da AGO 2026`,
        'TENANT_SEDE_GERAL'
      );
    } catch (err) {
      console.error('[EXPORT_PDF_AGO_ERR]', err);
    }
  };

  return (
    <div className="space-y-8 font-sans text-white pb-20">
      {/* Cabeçalho Oficial do Módulo */}
      <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 backdrop-blur-xl">
        <div className="space-y-2">
          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-3.5 py-1.5 rounded-full uppercase tracking-wider inline-block">
            MÓDULO DE GESTÃO • CONVENÇÃO GENERAL AGO 2026
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Relatório e Tabela de Inscritos AGO
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
            Acompanhamento em tempo real das homologações de participantes, status financeiro no Ledger e emissão de credenciamento.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={exportarPDF}
            className="px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/40 font-mono font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/10 transition-all cursor-pointer flex items-center gap-2"
            title="Gerar Relatório Oficial da AGO em PDF"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Relatório PDF ({listaFiltrada.length})</span>
          </button>

          <button
            type="button"
            onClick={exportarCSV}
            className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-mono font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas e Indicadores de Desempenho */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono font-bold uppercase">TOTAL DE INSCRITOS</span>
            <Users className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-3xl font-black text-white font-mono">
            {estatisticas?.totalInscritos || inscricoes.length}
          </div>
          <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Homologados na Base
          </span>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono font-bold uppercase">RECEITA HOMOLOGADA</span>
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-emerald-400 font-mono">
            {formatarMoeda(estatisticas?.totalArrecadadoBruto || inscricoes.reduce((acc, i) => acc + (i.valor || 0), 0))}
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Baixa confirmada no Ledger
          </span>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono font-bold uppercase">PAGAMENTOS VIA PIX</span>
            <QrCode className="w-5 h-5 text-teal-400" />
          </div>
          <div className="text-3xl font-black text-teal-400 font-mono">
            {inscricoes.filter((i) => i.formaPagamento === 'PIX').length}
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Liquidação Bacen Instantânea
          </span>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono font-bold uppercase">PASTORES & DIRIGENTES</span>
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="text-3xl font-black text-cyan-400 font-mono">
            {inscricoes.filter((i) => i.cargo?.includes('Pastor')).length}
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Delegados com direito a Voto
          </span>
        </div>
      </div>

      {/* Seletor de Visão: Tabela de Inscritos vs. Log de Auditoria Contábil (AGO vs. Filiação) */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <button
          onClick={() => setAbaVisao('TABELA')}
          className={`px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            abaVisao === 'TABELA'
              ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/20'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Tabela de Inscritos ({listaFiltrada.length})</span>
        </button>

        <button
          onClick={() => setAbaVisao('AUDITORIA')}
          className={`px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            abaVisao === 'AUDITORIA'
              ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg shadow-teal-600/20'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Log de Auditoria Visual (AGO vs. Filiação)</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-1" />
        </button>
      </div>

      {/* RENDERIZAÇÃO CONDICIONAL: PAINEL DE AUDITORIA CONTÁBIL */}
      {abaVisao === 'AUDITORIA' && (
        <PainelAuditoriaAgoFiliacao />
      )}

      {/* RENDERIZAÇÃO CONDICIONAL: TABELA DE INSCRITOS */}
      {abaVisao === 'TABELA' && (
        <>
          {/* Barra de Filtros e Busca */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={buscaInscrito}
                  onChange={(e) => setBuscaInscrito(e.target.value)}
                  placeholder="Buscar por Nome do Ministro, CPF ou Cargo..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-11 pr-4 py-3.5 text-white font-mono text-xs focus:border-indigo-500 focus:bg-slate-900 focus:outline-none transition-all shadow-inner"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto font-mono text-xs">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-400 font-bold uppercase">Status:</span>
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none"
                  >
                    <option value="TODOS">Todos os Status</option>
                    <option value="CONFIRMADO">Confirmados</option>
                    <option value="PENDENTE">Pendentes</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold uppercase">Plano:</span>
                  <select
                    value={filtroPlano}
                    onChange={(e) => setFiltroPlano(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none"
                  >
                    <option value="TODOS">Todos os Planos</option>
                    <option value="PLANO_1">Plano 1</option>
                    <option value="PLANO_2">Plano 2</option>
                    <option value="PLANO_3">Plano 3</option>
                    <option value="PLANO_4">Plano 4</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={exportarPDF}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-amber-400 border border-slate-700 hover:border-amber-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  title="Exportar PDF desta busca"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">PDF</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tabela de Inscritos na AGO */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-black text-white">
                  Lista de Ministros Inscritos Homologados
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Exibindo {listaFiltrada.length} de {inscricoes.length} registros
              </span>
            </div>

            {carregandoInscricoes ? (
              <div className="p-12 text-center text-slate-400 font-mono text-xs flex items-center justify-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                <span>Sincronizando tabela de inscritos com o Firestore...</span>
              </div>
            ) : listaFiltrada.length === 0 ? (
              <div className="p-12 text-center text-slate-500 font-mono text-xs space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-600 mx-auto" />
                <p>Nenhum ministro inscrito localizado com os filtros selecionados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-4">Foto / Ministro</th>
                      <th className="p-4">CPF</th>
                      <th className="p-4">Cargo</th>
                      <th className="p-4">Telefone / WhatsApp</th>
                      <th className="p-4">Plano Escolhido</th>
                      <th className="p-4">Valor</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {listaFiltrada.map((item) => {
                      const ministroCorrespondente = ministros.find(
                        (m) =>
                          (item.ministroId && m.id === item.ministroId) ||
                          (item.ministroCpf &&
                            m.cpf &&
                            m.cpf.trim() !== '' &&
                            m.cpf.replace(/\D/g, '') === item.ministroCpf.replace(/\D/g, ''))
                      );
                      const fotoUrl = item.fotoUrl || ministroCorrespondente?.fotoUrl || '';
                      const telefone = item.telefone || ministroCorrespondente?.telefone || '';

                      return (
                        <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                          {/* Foto + Nome */}
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {fotoUrl ? (
                                <img
                                  src={fotoUrl}
                                  alt={item.ministroNome}
                                  className="w-10 h-10 rounded-full object-cover border border-indigo-500/40 shrink-0 shadow-md bg-slate-950"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-black text-xs flex items-center justify-center border border-indigo-500/30 shrink-0 shadow-md">
                                  {item.ministroNome?.charAt(0) || 'M'}
                                </div>
                              )}
                              <span className="font-bold text-white font-sans text-sm truncate max-w-[180px]">
                                {item.ministroNome}
                              </span>
                            </div>
                          </td>

                          {/* CPF */}
                          <td className="p-4 text-slate-300 font-mono font-bold">
                            {item.ministroCpf}
                          </td>

                          {/* Cargo */}
                          <td className="p-4">
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 font-bold text-[11px]">
                              {item.cargo}
                            </span>
                          </td>

                          {/* Telefone */}
                          <td className="p-4 text-slate-300 font-mono">
                            <span className="inline-flex items-center gap-1.5 text-slate-200">
                              <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              {telefone}
                            </span>
                          </td>

                          {/* Plano Escolhido */}
                          <td className="p-4 font-sans text-slate-200 font-medium">
                            {item.planoNome}
                          </td>

                          {/* Valor */}
                          <td className="p-4 text-emerald-400 font-bold font-mono">
                            {formatarMoeda(item.valor)}
                          </td>

                          {/* Status */}
                          <td className="p-4">
                            <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              CONFIRMADO
                            </span>
                          </td>

                          {/* Ações */}
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-1.5">
                              {ministroCorrespondente && (
                                <button
                                  type="button"
                                  onClick={() => setMinistroDossie(ministroCorrespondente)}
                                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 transition-all cursor-pointer font-bold inline-flex items-center gap-1 text-[11px]"
                                  title="Abrir Dossiê Ministerial Consolidado"
                                >
                                  <Shield className="w-3.5 h-3.5" />
                                  <span>Dossiê</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setInscritoDetalhes(item)}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white transition-all cursor-pointer font-bold inline-flex items-center gap-1 text-[11px]"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Detalhes</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => abrirModalDeletarInscricao(item, e)}
                                className="px-2.5 py-1.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-400 hover:bg-rose-900 hover:text-white transition-all cursor-pointer font-bold inline-flex items-center gap-1 text-[11px]"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Excluir</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal de Dossiê Ministerial Consolidado */}
      {ministroDossie && (
        <DossieMinisterialModal
          ministro={ministroDossie}
          anuidades={anuidades}
          inscricoesAgo={inscricoesAGO}
          onClose={() => setMinistroDossie(null)}
        />
      )}

      {/* Modal de Detalhes e Passaporte do Inscrito */}
      {inscritoDetalhes && (
        <CrachaCredencialAgoModal
          evento={extrairEventoAgo(eventos, cicloAgoVigente)}
          inscricao={{
            ...inscritoDetalhes,
            fotoUrl:
              inscritoDetalhes.fotoUrl ||
              ministros.find(
                (m) =>
                  m.id === inscritoDetalhes.ministroId ||
                  (m.cpf &&
                    inscritoDetalhes.ministroCpf &&
                    m.cpf.replace(/\D/g, '') === inscritoDetalhes.ministroCpf.replace(/\D/g, ''))
              )?.fotoUrl ||
              '',
          }}
          ministro={ministros.find(
            (m) =>
              m.id === inscritoDetalhes.ministroId ||
              (m.cpf &&
                inscritoDetalhes.ministroCpf &&
                m.cpf.replace(/\D/g, '') === inscritoDetalhes.ministroCpf.replace(/\D/g, ''))
          )}
          onClose={() => setInscritoDetalhes(null)}
        />
      )}

      {/* Modal de Exclusão da Inscrição (Com Justificativa e Confirmação) */}
      {modalDeletarInscricaoAberto && inscricaoParaDeletar && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-3xl p-6 space-y-6 text-white shadow-2xl relative">
            <button
              onClick={() => setModalDeletarInscricaoAberto(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-950/60 border border-rose-500/30 px-3 py-1 rounded-full uppercase">
                ⚠️ CONFIRMAÇÃO DE ESTORNO DE CAIXA
              </span>
              <h3 className="text-lg font-black text-white mt-2">
                Excluir Inscrição da AGO?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Você está prestes a excluir definitivamente a inscrição de <strong>{inscricaoParaDeletar.ministroNome}</strong> no plano {inscricaoParaDeletar.planoNome} (Valor: {formatarMoeda(inscricaoParaDeletar.valor)}).
                Esta operação irá:
              </p>
              <ul className="list-disc pl-4 text-[11px] text-slate-400 space-y-1 font-sans">
                <li>Excluir o registro de credenciamento e portaria da AGO;</li>
                <li>Estornar o lançamento de {formatarMoeda(inscricaoParaDeletar.valor)} do DRE;</li>
                <li>Estornar as tarifas e os lançamentos contábeis no Ledger Geral;</li>
                <li>Liberar o ministro para que possa se inscrever novamente.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-mono text-slate-400 uppercase font-bold block">
                Justificativa da Exclusão:
              </label>
              <textarea
                value={justificativaInscricaoDelecao}
                onChange={(e) => setJustificativaInscricaoDelecao(e.target.value)}
                placeholder="Ex: Ministro desistiu do kit, erro no plano selecionado..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-xs font-mono focus:border-rose-500 focus:outline-none transition-all shadow-inner"
              />
            </div>

            <div className="flex gap-3 font-mono text-xs pt-2">
              <button
                type="button"
                onClick={() => setModalDeletarInscricaoAberto(false)}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={processandoDelecao}
                onClick={lidarComConfirmarDelecaoInscricao}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black transition-all cursor-pointer disabled:opacity-50"
              >
                {processandoDelecao ? 'Estornando...' : 'Confirmar & Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
