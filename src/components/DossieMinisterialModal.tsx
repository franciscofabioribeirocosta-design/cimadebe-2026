/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção Geral Centralizada
 * Módulo: Dossiê Ministerial Consolidado
 * Histórico Eclesiástico, Linha do Tempo de Ordenações, Taxas Oficiais e Vinculação Institucional
 * 100% Responsivo, com Botões de Saída Visíveis e Acessíveis em Qualquer Dispositivo
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  User,
  Shield,
  Award,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  FileText,
  Printer,
  X,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  History,
  BadgeCheck,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';
import type { Ministro, AnuidadeMinistro, InscricaoAGO } from '../types';
import { formatarMoeda, formatarDataBR } from '../financialEngine';

interface DossieMinisterialModalProps {
  readonly ministro: Ministro;
  readonly anuidades?: readonly AnuidadeMinistro[];
  readonly inscricoesAgo?: readonly InscricaoAGO[];
  readonly onClose: () => void;
}

export function DossieMinisterialModal({
  ministro,
  anuidades = [],
  inscricoesAgo = [],
  onClose,
}: DossieMinisterialModalProps) {
  const [abaAtiva, setAbaAtiva] = useState<'VISAO_GERAL' | 'HISTORICO_FINANCEIRO' | 'LINHA_TEMPO' | 'COMPLIANCE'>('VISAO_GERAL');

  // Suporte à tecla ESC para fechar imediatamente o dossiê
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Filtrar dados do ministro
  const anuidadesFiltradas = useMemo(() => {
    return (anuidades || [])
      .filter((a) => a.ministroId === ministro.id)
      .sort((a, b) => b.anoVigente - a.anoVigente);
  }, [anuidades, ministro.id]);

  const inscricoesFiltradas = useMemo(() => {
    return (inscricoesAgo || [])
      .filter((i) => i.ministroId === ministro.id || (i.cpf && i.cpf === ministro.cpf))
      .sort((a, b) => (b.anoVigente || 2026) - (a.anoVigente || 2026));
  }, [inscricoesAgo, ministro.id, ministro.cpf]);

  // Totalizadores
  const totalPagoAnuidades = useMemo(() => {
    return anuidadesFiltradas
      .filter((a) => a.statusPagamento === 'PAGO')
      .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  }, [anuidadesFiltradas]);

  const totalPagoInscricoes = useMemo(() => {
    return inscricoesFiltradas
      .filter((i) => i.statusInscricao === 'VALIDA')
      .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  }, [inscricoesFiltradas]);

  const imprimirDossie = () => {
    window.print();
  };

  const isMissionaria = (ministro.cargo || '').toLowerCase().includes('missionár') || (ministro.cargo || '').toLowerCase().includes('missionar');
  const valorPlanoOficial = isMissionaria ? 120.00 : 190.00;
  const planoOficialNome = isMissionaria ? 'PLANO 4: Inscrição para Missionárias Recebidas/Ordenadas' : 'PLANO 1: Inscrição Normal para Ministros';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/90 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh] my-auto">
        {/* HEADER PRINCIPAL COM BOTÃO VOLTAR / FECHAR PROMINENTE */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-800/95 border-b border-slate-700/80 shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={onClose}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-700/90 hover:bg-slate-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0"
              title="Voltar ao sistema"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Voltar</span>
            </button>

            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-teal-500/20 border border-amber-500/30 text-amber-400 shrink-0 hidden sm:flex">
              <Shield className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base md:text-lg font-bold text-white tracking-wide truncate">
                  Dossiê Ministerial
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hidden xs:inline">
                  Auditado
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                {ministro.nome} ({ministro.cargo})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={imprimirDossie}
              className="px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-xs font-medium border border-slate-600 flex items-center gap-1.5 transition cursor-pointer"
              title="Imprimir Certidão do Dossiê"
            >
              <Printer className="w-4 h-4 text-teal-400" />
              <span className="hidden md:inline">Imprimir</span>
            </button>

            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1 transition shadow-sm cursor-pointer"
              title="Fechar Janela [ESC]"
            >
              <X className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </div>
        </div>

        {/* ABAS DE NAVEGAÇÃO RESPONSIVAS COM TOUCH SCROLL */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-2.5 bg-slate-800/60 border-b border-slate-800 overflow-x-auto scrollbar-none shrink-0">
          <button
            onClick={() => setAbaAtiva('VISAO_GERAL')}
            className={`px-3 sm:px-4 py-2 text-xs font-semibold rounded-t-lg transition flex items-center gap-1.5 border-b-2 whitespace-nowrap shrink-0 cursor-pointer ${
              abaAtiva === 'VISAO_GERAL'
                ? 'text-teal-400 border-teal-400 bg-slate-850 shadow-sm'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Perfil & Identificação</span>
          </button>

          <button
            onClick={() => setAbaAtiva('HISTORICO_FINANCEIRO')}
            className={`px-3 sm:px-4 py-2 text-xs font-semibold rounded-t-lg transition flex items-center gap-1.5 border-b-2 whitespace-nowrap shrink-0 cursor-pointer ${
              abaAtiva === 'HISTORICO_FINANCEIRO'
                ? 'text-teal-400 border-teal-400 bg-slate-850 shadow-sm'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Taxas & Anuidades</span>
          </button>

          <button
            onClick={() => setAbaAtiva('LINHA_TEMPO')}
            className={`px-3 sm:px-4 py-2 text-xs font-semibold rounded-t-lg transition flex items-center gap-1.5 border-b-2 whitespace-nowrap shrink-0 cursor-pointer ${
              abaAtiva === 'LINHA_TEMPO'
                ? 'text-teal-400 border-teal-400 bg-slate-850 shadow-sm'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Linha do Tempo</span>
          </button>

          <button
            onClick={() => setAbaAtiva('COMPLIANCE')}
            className={`px-3 sm:px-4 py-2 text-xs font-semibold rounded-t-lg transition flex items-center gap-1.5 border-b-2 whitespace-nowrap shrink-0 cursor-pointer ${
              abaAtiva === 'COMPLIANCE'
                ? 'text-teal-400 border-teal-400 bg-slate-850 shadow-sm'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <BadgeCheck className="w-3.5 h-3.5" />
            <span>Conformidade & Planos</span>
          </button>
        </div>

        {/* CONTEÚDO DINÂMICO ROLÁVEL */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* ABA 1: VISÃO GERAL */}
          {abaAtiva === 'VISAO_GERAL' && (
            <div className="space-y-5">
              {/* Card Principal do Ministro */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col sm:flex-row gap-5 items-start">
                <div className="relative shrink-0 mx-auto sm:mx-0">
                  {ministro.fotoUrl && ministro.fotoUrl.trim() !== '' ? (
                    <img
                      src={ministro.fotoUrl}
                      alt={ministro.nome}
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-amber-500/40 shadow-lg bg-slate-900"
                    />
                  ) : (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-slate-700 flex flex-col items-center justify-center text-slate-400 shadow-lg">
                      <User className="w-10 h-10 text-emerald-400 mb-1" />
                      <span className="text-[10px] font-mono">Sem Foto</span>
                    </div>
                  )}
                  <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 shadow-md">
                    {ministro.cargo}
                  </span>
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-4 w-full">
                  <div>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono uppercase block">Nome Completo</span>
                    <p className="text-xs sm:text-sm font-bold text-white truncate">{ministro.nome}</p>
                    {ministro.ehPresidenteIgreja && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-cyan-400 mt-0.5">
                        <Building2 className="w-3 h-3 text-cyan-400" />
                        Presidente de Igreja ({ministro.igrejaPresidenteNome || 'Filiada'})
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono uppercase block">CPF</span>
                    <p className="text-xs sm:text-sm font-mono text-slate-200">{ministro.cpf || 'Não informado'}</p>
                  </div>

                  <div>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono uppercase block">Registro Ministerial</span>
                    <p className="text-xs sm:text-sm font-mono font-bold text-amber-400">
                      {ministro.registroMinisterial || 'RM-HOMOLOGADO'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono uppercase block">Igreja Vinculada</span>
                    <p className="text-xs sm:text-sm font-semibold text-white flex items-center gap-1.5 truncate">
                      <Building2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      <span className="truncate">{ministro.igrejaFiliadaNome || 'Sede Geral Centralizada'}</span>
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono uppercase block">Status Adimplência</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold mt-0.5 ${
                        ministro.statusAdimplencia === 'ADIMPLENTE' || ministro.statusAdimplencia === 'EM_DIA'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {ministro.statusAdimplencia || 'REGULAR'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono uppercase block">Data de Filiação</span>
                    <p className="text-xs sm:text-sm font-mono text-slate-300">
                      {ministro.dataFiliacao ? formatarDataBR(ministro.dataFiliacao) : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Detalhes de Contato & Localização */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                  <span className="text-[11px] font-bold text-teal-400 uppercase block">
                    Canais de Contato Oficial
                  </span>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="truncate">{ministro.email || 'Não informado'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>{ministro.telefone || 'Não informado'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                  <span className="text-[11px] font-bold text-cyan-400 uppercase block">
                    Endereço Residencial Cadastrado
                  </span>
                  <div className="text-xs text-slate-300 space-y-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>
                        {ministro.dadosEndereco?.rua || 'Avenida Central'}, {ministro.dadosEndereco?.numero || 'S/N'}
                      </span>
                    </div>
                    <p className="text-slate-400 pl-6">
                      {ministro.dadosEndereco?.bairro || 'Centro'} — {ministro.dadosEndereco?.cidade || 'Salvador'} / {ministro.dadosEndereco?.uf || 'BA'} (CEP: {ministro.dadosEndereco?.cep || '40000-000'})
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: HISTÓRICO FINANCEIRO */}
          {abaAtiva === 'HISTORICO_FINANCEIRO' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-mono">Total Liquidado em Anuidades</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">
                      {formatarMoeda(totalPagoAnuidades)}
                    </span>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-mono">Total Pago em Conclaves/AGO</span>
                    <span className="text-lg font-bold text-teal-400 font-mono">
                      {formatarMoeda(totalPagoInscricoes)}
                    </span>
                  </div>
                  <Award className="w-6 h-6 text-teal-400" />
                </div>
              </div>

              {/* Tabela de Anuidades */}
              <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950">
                <div className="p-3 bg-slate-900 border-b border-slate-800 text-xs font-bold text-white flex items-center justify-between">
                  <span>Lançamentos Contábeis de Anuidades</span>
                  <span className="text-[10px] font-mono text-slate-400">{anuidadesFiltradas.length} registros</span>
                </div>
                <div className="divide-y divide-slate-800/80 max-h-60 overflow-y-auto">
                  {anuidadesFiltradas.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      Nenhuma anuidade registrada no histórico.
                    </div>
                  ) : (
                    anuidadesFiltradas.map((a) => (
                      <div key={a.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-900/50">
                        <div>
                          <span className="font-bold text-white block">
                            {a.categoria === 'TAXA_CONVENCAO' || a.id?.startsWith('an-fil-') ? 'Taxa de Filiação' : `Anuidade ${a.anoVigente}`}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Vencimento: {formatarDataBR(a.dataVencimento)}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-white block font-mono">{formatarMoeda(a.valor)}</span>
                          <span
                            className={`text-[10px] font-mono font-bold ${
                              a.statusPagamento === 'PAGO' ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {a.statusPagamento}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ABA 3: LINHA DO TEMPO ECLESIÁSTICA */}
          {abaAtiva === 'LINHA_TEMPO' && (
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Trajetória Ministerial & Consagrações
              </h3>

              <div className="relative pl-6 border-l-2 border-emerald-500/40 space-y-6">
                <div className="relative">
                  <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-950" />
                  <span className="text-[10px] font-mono text-emerald-400">FILIAÇÃO À CIMADEBE</span>
                  <p className="text-xs font-bold text-white mt-0.5">
                    Homologação do Registro Canônico ({ministro.registroMinisterial || 'RM Oficial'})
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Acolhido na Convenção Geral com jurisdição eclesiástica plena.
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-teal-500 border-2 border-slate-950" />
                  <span className="text-[10px] font-mono text-teal-400">ORDENAÇÃO AO SANTO MINISTÉRIO</span>
                  <p className="text-xs font-bold text-white mt-0.5">
                    {ministro.cargo} — Consagrado em {ministro.dataConsagracao ? formatarDataBR(ministro.dataConsagracao) : 'Salvador / BA'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Local: {ministro.localConsagracao || 'Templo Central / Convenção'} • Pastor Consagrante: {ministro.pastorConsagrante || 'Mesa Diretora'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ABA 4: COMPLIANCE E PLANOS */}
          {abaAtiva === 'COMPLIANCE' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono uppercase block">Plano Oficial Aplicável</span>
                    <h4 className="text-xs sm:text-sm font-bold text-white">{planoOficialNome}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-mono uppercase block">Valor Oficial</span>
                    <span className="text-sm sm:text-base font-bold text-teal-400 font-mono">
                      {formatarMoeda(valorPlanoOficial)}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-300 border-t border-slate-800 pt-3 space-y-1">
                  <p className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Regra Estatutária Homologada</span>
                  </p>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    {isMissionaria
                      ? 'O Plano 4 é reservado a Missionárias (ordenadas ou recebidas), fixado no valor correto de R$ 120,00 com direito pleno a credencial e participação.'
                      : 'O Plano 1 contempla Ministros Oficiais (Pastores, Evangelistas e Presbíteros) no valor oficial de R$ 190,00 com direito a voto estatutário e filiação.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RODAPÉ DO DOSSIÊ COM BOTÃO DE SAÍDA FIXO */}
        <div className="px-4 sm:px-6 py-3 bg-slate-800/95 border-t border-slate-700/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">SIGM Core • Sincronização em Tempo Real</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            <span>Fechar Dossiê</span>
          </button>
        </div>
      </div>
    </div>
  );
}
