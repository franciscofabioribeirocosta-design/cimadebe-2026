/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Páginas Públicas do Portal Controladas por CMS
 * Design Neofintech (Dark Navy, Slate & Emerald com Micro-interações)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSecurity } from '../SecurityContext';
import { obterOrdemHierarquicaMesa, type IgrejaFiliada } from '../types';
import { fetchEventos, fetchNoticias, fetchIgrejasFiliadas, extrairEventoAgo } from '../db/databaseService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { PlanoAgo, ouvirPlanosAgo, validarElegibilidadeCargo, realizarInscricaoPlanoGenericaTransacional } from '../services/planosAgoService';
import { formatarDataBR, formatarRotuloStatus, obterBadgeClassStatus } from '../financialEngine';
import { ouvirInscricoesAgo, InscricaoAgoDocumento, FormaPagamentoAgo } from '../services/inscricaoAgoService';
import { FormStepper, StepItem } from '../components/FormStepper';

const STEPS_MODAL_AGO: StepItem[] = [
  { id: 'BUSCA_CPF', label: '1. Identificação', sublabel: 'Consulta de CPF' },
  { id: 'SELECAO_PLANOS', label: '2. Plano & Anexos', sublabel: 'Elegibilidade & Dossiê' },
  { id: 'CHECKOUT_PAGAMENTO', label: '3. Pagamento', sublabel: 'Efetivação da Taxa' },
];
import { Etapa4NovoCadastroAgo } from '../admin/Etapa4NovoCadastroAgo';
import { CheckoutRealAgo } from './CheckoutRealAgo';
import {
  buscarMinistroPorCPF,
  verificarInscricaoAtiva,
  verificarComplianceFinanceiroDetalhado,
  liquidarAnuidadeImediata,
} from '../services/agoFirebaseService';
import { CrachaCredencialAgoModal } from '../components/CrachaCredencialAgoModal';
import { Credencial3dShowcaseHome } from '../components/Credencial3dShowcaseHome';
import { AniversariantesDoMesCard } from '../components/AniversariantesDoMesCard';
import confetti from 'canvas-confetti';
import {
  Users,
  Building2,
  Calendar,
  Newspaper,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  MapPin,
  ArrowRight,
  Search,
  ExternalLink,
  Award,
  BookOpen,
  Phone,
  Mail,
  Clock,
  Sparkles,
  Layers,
  ChevronRight,
  Shield,
  Activity,
  Lock,
  X,
  Filter,
  Globe,
  FileText,
  Check,
  Crown,
  CreditCard,
  QrCode,
  UserCheck,
  UserCog,
  RefreshCw,
  Vote,
  Upload,
  Copy,
  FileCheck,
} from 'lucide-react';

interface PortalPageProps {
  readonly onNavegar: (pagina: string) => void;
  readonly onAbrirLogin?: () => void;
}

// ==========================================
// 1. PÁGINA: HOME (DASHBOARD PÚBLICO)
// ==========================================
export function PortalHome({ onNavegar, onAbrirLogin }: PortalPageProps) {
  const { ministros, resumoFinanceiro, igrejasFiliadas, appConfig, cmsSettings } = useSecurity();

  // Micro-dados estatísticos para o micro-gráfico
  const dadosArrecadacaoTrimestral = [
    { mes: 'Out', valor: 65, label: 'R$ 65k' },
    { mes: 'Nov', valor: 82, label: 'R$ 82k' },
    { mes: 'Dez', valor: 94, label: 'R$ 94k' },
    { mes: 'Jan', valor: 78, label: 'R$ 78k' },
    { mes: 'Fev', valor: 88, label: 'R$ 88k' },
    { mes: 'Mar', valor: 98, label: 'R$ 98k' },
  ];

  return (
    <div className="space-y-12 pb-12">
      {/* Hero Section Neofintech */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40 border border-emerald-500/20 p-8 sm:p-14 shadow-2xl backdrop-blur-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-bold tracking-wider uppercase shadow-[0_0_15px_rgba(16,185,129,0.25)]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>ECOSSISTEMA DIGITAL {appConfig?.sigla || 'CIMADEBE'} & SIGM</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
            Governança Ministerial com Precisão de{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Internet Banking
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
            Convenção Geral eclesiástica com credenciamento digital unificado, gestão ministerial e transparência institucional em tempo real.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            {cmsSettings?.paginasVisiveis?.igrejasFiliadas !== false && (
              <button
                onClick={() => onNavegar('igrejasFiliadas')}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
              >
                <Building2 className="w-5 h-5 text-white" />
                Igrejas Filiadas & Localização
              </button>
            )}
            {cmsSettings?.paginasVisiveis?.validacaoCredenciais !== false && (
              <button
                onClick={() => onNavegar('validacaoCredenciais')}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 font-bold text-sm shadow transition-all cursor-pointer"
              >
                <ShieldCheck className="w-5 h-5" />
                Validar Credencial
              </button>
            )}
            {cmsSettings?.paginasVisiveis?.inscricaoAgo !== false && (
              <button
                onClick={() => onNavegar('inscricaoAgo')}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-white font-bold text-sm shadow transition-all cursor-pointer"
              >
                <Calendar className="w-5 h-5 text-indigo-400" />
                Inscrição da AGO
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Credencial 3D Interativa em Destaque na Home */}
      <Credencial3dShowcaseHome onValidarCredencial={() => onNavegar('validacaoCredenciais')} />

      {/* Módulo de Aniversariantes do Mês & Card Especial do Dia */}
      <AniversariantesDoMesCard />

      {/* Contadores Institucionais Animados em CSS */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition-all backdrop-blur-md shadow-lg group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Ministros Ativos</span>
            <Users className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl sm:text-4xl font-black text-white font-mono">
            {ministros.filter((m) => m.status === 'ATIVO').length}
          </div>
          <p className="text-xs text-slate-500 mt-2 font-mono">Com filiação homologada</p>
        </div>

        <div
          onClick={() => onNavegar('igrejasFiliadas')}
          className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 transition-all backdrop-blur-md shadow-lg group cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 group-hover:text-emerald-300">Igrejas Filiadas</span>
            <Building2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl sm:text-4xl font-black text-white font-mono flex items-center justify-between">
            <span>{igrejasFiliadas.length}</span>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </div>
          <p className="text-xs text-slate-500 mt-2 font-mono group-hover:text-slate-400">Ver congregações no Google Maps</p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition-all backdrop-blur-md shadow-lg group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Inscritos AGO 2026</span>
            <Award className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl sm:text-4xl font-black text-white font-mono">
            {resumoFinanceiro.totalInscricoesAgo}
          </div>
          <p className="text-xs text-slate-500 mt-2 font-mono">Quórum homologado</p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition-all backdrop-blur-md shadow-lg group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Índice Conformidade</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono">
            100%
          </div>
          <p className="text-xs text-slate-500 mt-2 font-mono">Registros auditados</p>
        </div>
      </section>

      {/* Micro-Gráficos em Puro Tailwind & Sumário de Dados em Tempo Real */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Micro-Gráfico de Barras Tailwind */}
        <div className="lg:col-span-2 p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider block">
                EVOLUÇÃO CONTÁBIL MENSAL
              </span>
              <h3 className="text-lg font-bold text-white mt-1">
                Transparência e Volume do Fundo Convencional
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+18.4% a.m.</span>
            </div>
          </div>

          {/* Gráfico de Barras Estilizado */}
          <div className="pt-6">
            <div className="grid grid-cols-6 gap-3 items-end h-44 border-b border-slate-800 pb-3">
              {dadosArrecadacaoTrimestral.map((dado) => (
                <div key={dado.mes} className="flex flex-col items-center gap-2 group h-full justify-end">
                  <span className="text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {dado.label}
                  </span>
                  <div className="w-full bg-slate-800/80 rounded-t-xl overflow-hidden flex flex-col justify-end">
                    <div
                      className="w-full bg-gradient-to-t from-emerald-600 via-teal-500 to-cyan-400 rounded-t-xl transition-all duration-700 group-hover:brightness-125"
                      style={{ height: `${dado.valor}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-slate-400 font-bold">{dado.mes}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 font-mono pt-2">
            <span>Fonte: Tesouraria Geral {appConfig?.sigla || 'CIMADEBE'}</span>
            <span className="text-emerald-400">Auditoria Externa Contínua</span>
          </div>
        </div>

        {/* Sumário de Dados Consolidados */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-2 text-white font-bold text-base mb-1">
              <Shield className="w-5 h-5 text-emerald-400" />
              Sumário de Governança
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Consolidação contábil e conformidade estatutária da convenção.
            </p>

            <div className="space-y-3 mt-6 font-mono text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-400">Taxa de Adimplência:</span>
                <span className="text-emerald-400 font-bold">{resumoFinanceiro.taxaAdimplenciaPercentual}%</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-400">Status dos Registros:</span>
                <span className="text-cyan-400 font-bold">100% REGULAR</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-400">Mesa Diretora:</span>
                <span className="text-white font-bold">Mandato 2025/2028</span>
              </div>
            </div>
          </div>

          {cmsSettings?.paginasVisiveis?.quemSomos !== false && (
            <button
              onClick={() => onNavegar('quemSomos')}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              Conhecer Nossa História
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

// ==========================================
// 2. PÁGINA: QUEM SOMOS
// ==========================================
export function PortalQuemSomos() {
  const pilares = [
    {
      titulo: 'Transparência de Nível Bancário',
      descricao: 'Eliminação completa de caixa opaco com conciliação automática de anuidades e taxas em tempo real.',
      icone: ShieldCheck,
      cor: 'from-emerald-500/20 to-teal-500/20',
    },
    {
      titulo: 'Rastreabilidade Criptográfica',
      descricao: 'Toda filiação, ordenação e credencial é selada com hash irreversível SHA-256 e protegida contra falsificações.',
      icone: Award,
      cor: 'from-cyan-500/20 to-blue-500/20',
    },
    {
      titulo: 'Comunhão & Cuidado Pastoral',
      descricao: 'Suporte institucional integral às igrejas filiadas, convenções setoriais e assistência ministerial permanente.',
      icone: Users,
      cor: 'from-indigo-500/20 to-purple-500/20',
    },
    {
      titulo: 'Expansão Missionária Estratégica',
      descricao: 'Aporte de recursos contábeis direcionados ao avanço da evangelização no estado da Bahia e fronteiras de extensão.',
      icone: BookOpen,
      cor: 'from-emerald-500/20 to-cyan-500/20',
    },
  ];

  return (
    <div className="space-y-10 pb-12">
      <div className="max-w-3xl space-y-4">
        <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider block">
          INSTITUCIONAL & MANIFESTO
        </span>
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Quem Somos: Convenção CIMADEBE
        </h2>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          A <strong className="text-white">CIMADEBE</strong> (Convenção Interestadual de Ministros e Igrejas das Assembleias de Deus do Estado da Bahia e Extensão) é uma organização eclesiástica comprometida com os fundamentos bíblicos, a ortodoxia pentecostal e a excelência administrativa. Integrada ao sistema unificado <strong className="text-emerald-400">SIGM</strong>, estabelecemos um novo paradigma de gestão ética, transparente e digital.
        </p>
      </div>

      {/* Grid Cibernético de Pilares com Hover Tridimensional */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {pilares.map((pilar) => {
          const Icone = pilar.icone;
          return (
            <div
              key={pilar.titulo}
              className="relative p-8 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition-all duration-300 group hover:-translate-y-1 shadow-xl overflow-hidden backdrop-blur-xl"
            >
              <div
                className={`absolute top-0 right-0 w-44 h-44 bg-gradient-to-br ${pilar.cor} rounded-full blur-3xl pointer-events-none group-hover:scale-125 transition-transform`}
              />
              <div className="relative z-10 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                  <Icone className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                  {pilar.titulo}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {pilar.descricao}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// 3. PÁGINA: MESA DIRETORA (DINÂMICA)
// ==========================================
export function PortalMesaDiretora() {
  const { membrosMesaDiretora } = useSecurity();

  const membrosOrdenados = React.useMemo(() => {
    return [...membrosMesaDiretora].sort((a, b) => {
      const ordemA = obterOrdemHierarquicaMesa(a.cargoMesa);
      const ordemB = obterOrdemHierarquicaMesa(b.cargoMesa);
      return ordemA - ordemB;
    });
  }, [membrosMesaDiretora]);

  return (
    <div className="space-y-10 pb-12">
      <div className="max-w-3xl space-y-4">
        <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider block">
          LIDERANÇA & GOVERNANÇA ESTATUTÁRIA
        </span>
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Mesa Diretora da Convenção
        </h2>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          Conheça os ministros que compõem o corpo deliberativo e executivo da CIMADEBE, organizados conforme a ordem de precedência estatutária da convenção.
        </p>
      </div>

      {/* Grid de Cartões Inovadores ou Estado de Homologação */}
      {membrosOrdenados.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {membrosOrdenados.map((membro, idx) => {
            const rank = obterOrdemHierarquicaMesa(membro.cargoMesa);
            const isPresidente = rank === 1;

            return (
              <div
                key={membro.id ? `${membro.id}-${idx}` : `membro-${idx}`}
                className={`p-6 rounded-3xl transition-all duration-300 group hover:-translate-y-1 shadow-xl flex flex-col justify-between space-y-4 backdrop-blur-xl relative overflow-hidden border ${
                  isPresidente
                    ? 'bg-gradient-to-b from-amber-950/30 via-slate-900/90 to-slate-950 border-amber-500/50 shadow-[0_0_25px_rgba(245,158,11,0.15)]'
                    : 'bg-slate-900/80 border-slate-800 hover:border-emerald-500/50'
                }`}
              >
                <div>
                  <div className="relative mb-4">
                    <img
                      src={
                        membro.fotoUrl ||
                        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&h=300&q=80'
                      }
                      alt={membro.nome}
                      className="w-full h-52 rounded-2xl object-cover border border-slate-700 group-hover:border-emerald-400 transition-colors"
                    />
                    <span className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-slate-950/85 border border-slate-700 text-[10px] font-mono text-amber-400 font-bold">
                      MANDATO {membro.mandato}
                    </span>
                    <span className="absolute top-2 right-2 w-7 h-7 rounded-xl bg-slate-950/90 border border-slate-700 text-[11px] font-mono font-bold text-white flex items-center justify-center shadow">
                      {rank}º
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-emerald-400 font-bold block uppercase tracking-wider">
                    {membro.cargoMesa}
                  </span>
                  <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors mt-0.5">
                    {membro.nome}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-1">
                    📍 {membro.igrejaFiliada}
                  </p>
                  <p className="text-xs text-slate-300/90 mt-3 leading-relaxed font-sans line-clamp-3">
                    {membro.biografia || 'Ministro membro da Mesa Diretora da Convenção Estadual.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mandato Vigente
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-4 max-w-xl mx-auto shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
            <Crown className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">Composição em Processo Estatutário</h3>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            A Mesa Diretora e a Presidência Geral da Convenção encontram-se em processo de homologação regimental e posse formal. Os registros serão exibidos imediatamente após a promulgação da ata oficial.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-mono text-amber-400">
            <span>Status: Vacância Transitória Conforme Estatuto</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Dicionário Oficial com nomes dos estados brasileiros
const NOMES_ESTADOS: Record<string, string> = {
  BA: 'Bahia',
  SE: 'Sergipe',
  MG: 'Minas Gerais',
  SP: 'São Paulo',
  PE: 'Pernambuco',
  ES: 'Espírito Santo',
  RJ: 'Rio de Janeiro',
  DF: 'Distrito Federal',
  GO: 'Goiás',
  PR: 'Paraná',
  SC: 'Santa Catarina',
  RS: 'Rio Grande do Sul',
  CE: 'Ceará',
  MA: 'Maranhão',
  PB: 'Paraíba',
  RN: 'Rio Grande do Norte',
  AL: 'Alagoas',
  PI: 'Piauí',
  PA: 'Pará',
  AM: 'Amazonas',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  RO: 'Rondônia',
  AC: 'Acre',
  AP: 'Amapá',
  RR: 'Roraima',
  TO: 'Tocantins',
};

// ==========================================
// 4. PÁGINA: IGREJAS FILIADAS (BANCO DE DADOS DINÂMICO & GOOGLE MAPS)
// ==========================================
export function PortalIgrejasFiliadas({
  igrejasProp,
}: {
  readonly igrejasProp?: readonly IgrejaFiliada[];
} = {}) {
  const { igrejasFiliadas: igrejasGlobal } = useSecurity();
  const [igrejasLocal, setIgrejasLocal] = useState<IgrejaFiliada[]>([]);
  const [busca, setBusca] = useState('');
  const [ufSelecionada, setUfSelecionada] = useState<string>('TODOS');
  const [modoAgrupamento, setModoAgrupamento] = useState<'ESTADOS' | 'TODAS'>('ESTADOS');
  const [igrejaModal, setIgrejaModal] = useState<IgrejaFiliada | null>(null);

  useEffect(() => {
    fetchIgrejasFiliadas()
      .then((res) => {
        if (res && res.length > 0) {
          const formatadas: IgrejaFiliada[] = res.map((r) => ({
            id: r.id,
            tenantId: r.tenant_id,
            razaoSocial: r.razao_social,
            nomeFantasia: r.nome_fantasia,
            cnpj: r.cnpj,
            dataAbertura: r.data_abertura,
            naturezaJuridica: r.natureza_juridica,
            cnaePrincipal: r.cnae_principal,
            situacaoCadastral: r.situacao_cadastral,
            logradouro: r.logradouro,
            numero: r.numero,
            complemento: r.complemento,
            bairro: r.bairro,
            municipio: r.municipio,
            uf: r.uf,
            cep: r.cep,
            email: r.email,
            telefone: r.telefone,
            pastorPresidenteId: r.pastor_presidente_id || '',
            pastorPresidenteNome: r.pastor_presidente_nome,
            logoUrl: r.logo_url || '',
            status: r.status,
            dataFiliacao: r.data_filiacao,
          }));
          setIgrejasLocal(formatadas);
        }
      })
      .catch((err) => {
        console.warn('[PortalIgrejasFiliadas] Erro ao carregar igrejas locais:', err);
      });
  }, []);

  // Lista consolidada direto do banco de dados (Firestore / SecurityContext)
  const igrejas = useMemo(() => {
    if (igrejasProp && igrejasProp.length > 0) return igrejasProp;
    if (igrejasGlobal && igrejasGlobal.length > 0) return igrejasGlobal;
    if (igrejasLocal && igrejasLocal.length > 0) return igrejasLocal;
    return [];
  }, [igrejasProp, igrejasGlobal, igrejasLocal]);

  // Lista dinâmica e ordenada de Estados presentes no banco
  const estadosDisponiveis = useMemo(() => {
    const ufs = new Set<string>();
    igrejas.forEach((ig) => {
      if (ig.uf) ufs.add(ig.uf.trim().toUpperCase());
    });
    return Array.from(ufs).sort();
  }, [igrejas]);

  // Contagem de igrejas por Estado
  const contagemPorEstado = useMemo(() => {
    const mapa: Record<string, number> = {};
    igrejas.forEach((ig) => {
      const uf = (ig.uf || 'OUTROS').toUpperCase();
      mapa[uf] = (mapa[uf] || 0) + 1;
    });
    return mapa;
  }, [igrejas]);

  // Filtragem reativa por texto e Estado selecionado
  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return igrejas.filter((ig) => {
      const ufItem = (ig.uf || '').toUpperCase();
      const matchUf = ufSelecionada === 'TODOS' || ufItem === ufSelecionada;
      if (!matchUf) return false;

      if (!termo) return true;

      const nomeFantasia = (ig.nomeFantasia || '').toLowerCase();
      const razaoSocial = (ig.razaoSocial || '').toLowerCase();
      const cnpj = (ig.cnpj || '').toLowerCase();
      const pastor = (ig.pastorPresidenteNome || '').toLowerCase();
      const municipio = (ig.municipio || '').toLowerCase();
      const bairro = (ig.bairro || '').toLowerCase();
      const logradouro = (ig.logradouro || '').toLowerCase();

      return (
        nomeFantasia.includes(termo) ||
        razaoSocial.includes(termo) ||
        cnpj.includes(termo) ||
        pastor.includes(termo) ||
        municipio.includes(termo) ||
        bairro.includes(termo) ||
        logradouro.includes(termo) ||
        ufItem.includes(termo)
      );
    });
  }, [igrejas, busca, ufSelecionada]);

  // Agrupamento estruturado por Estado
  const agrupadasPorEstado = useMemo(() => {
    const grupos: Record<string, IgrejaFiliada[]> = {};
    filtradas.forEach((ig) => {
      const uf = (ig.uf || 'OUTROS').toUpperCase();
      if (!grupos[uf]) grupos[uf] = [];
      grupos[uf].push(ig);
    });
    return grupos;
  }, [filtradas]);

  // Função auxiliar para montagem do link de navegação para o Google Maps
  const gerarUrlGoogleMaps = (ig: IgrejaFiliada) => {
    const partes = [
      ig.nomeFantasia || ig.razaoSocial,
      ig.logradouro,
      ig.numero ? `nº ${ig.numero}` : '',
      ig.bairro,
      ig.municipio,
      ig.uf,
      ig.cep ? `CEP ${ig.cep}` : '',
      'Brasil',
    ].filter(Boolean);
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(partes.join(', '))}`;
  };

  return (
    <div className="space-y-8 pb-16 animate-fadeIn">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-800 pb-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>BANCO DE DADOS CONVENCIONAL • CADASTRO OFICIAL</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
            <Building2 className="w-8 h-8 text-emerald-400 shrink-0" />
            <span>Igrejas Filiadas</span>
            <span className="text-sm font-mono font-bold px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
              {filtradas.length} {filtradas.length === 1 ? 'congregação' : 'congregações'}
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Relação oficial de todas as igrejas e sedes eclesiásticas filiadas à Convenção Geral, com endereçamento georreferenciado e acesso direto via Google Maps.
          </p>
        </div>

        {/* Barra de Busca e Alternador de Modo */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="relative min-w-[280px] sm:min-w-[320px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por igreja, cidade, pastor ou CNPJ..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-sans"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setModoAgrupamento('ESTADOS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                modoAgrupamento === 'ESTADOS'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Por Estado
            </button>
            <button
              onClick={() => setModoAgrupamento('TODAS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                modoAgrupamento === 'TODAS'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Grade Geral
            </button>
          </div>
        </div>
      </div>

      {/* SELETOR RÁPIDO DE ESTADOS (FILTRO EM ABAS COM BADGES DE CONTAGEM) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
          <span className="flex items-center gap-1.5 uppercase font-bold text-slate-300">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            <span>Filtrar por Estado (UF):</span>
          </span>
          {ufSelecionada !== 'TODOS' && (
            <button
              onClick={() => setUfSelecionada('TODOS')}
              className="text-emerald-400 hover:underline cursor-pointer text-[11px]"
            >
              Ver Todos os Estados
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800">
          <button
            onClick={() => setUfSelecionada('TODOS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 shrink-0 transition-all cursor-pointer border ${
              ufSelecionada === 'TODOS'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <span>🇧🇷 Todos os Estados</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-950 font-bold border border-slate-700">
              {igrejas.length}
            </span>
          </button>

          {estadosDisponiveis.map((uf) => {
            const count = contagemPorEstado[uf] || 0;
            const nomeCompleto = NOMES_ESTADOS[uf] || uf;
            const isAtivo = ufSelecionada === uf;
            return (
              <button
                key={uf}
                onClick={() => setUfSelecionada(uf)}
                className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 shrink-0 transition-all cursor-pointer border ${
                  isAtivo
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <span>{nomeCompleto} ({uf})</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isAtivo ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-slate-950 text-slate-400 border border-slate-800'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ESTADO VAZIO */}
      {filtradas.length === 0 && (
        <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Nenhuma igreja filiada encontrada</h3>
          <p className="text-xs text-slate-400 font-mono max-w-md mx-auto">
            Não foram localizados registros para o termo informado ou no estado selecionado. Tente limpar os filtros.
          </p>
          <button
            onClick={() => {
              setBusca('');
              setUfSelecionada('TODOS');
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold transition-all cursor-pointer"
          >
            Redefinir Filtros
          </button>
        </div>
      )}

      {/* VISUALIZAÇÃO AGRUPADA POR ESTADO */}
      {modoAgrupamento === 'ESTADOS' && filtradas.length > 0 && (
        <div className="space-y-12">
          {Object.entries(agrupadasPorEstado)
            .sort(([ufA], [ufB]) => ufA.localeCompare(ufB))
            .map(([uf, lista]) => {
              const nomeEstado = NOMES_ESTADOS[uf] || `Estado ${uf}`;
              return (
                <section key={uf} className="space-y-4">
                  {/* Header de Separação do Estado */}
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center font-mono font-black text-emerald-400 text-sm shadow-md">
                        {uf}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                          <span>{nomeEstado}</span>
                        </h3>
                        <p className="text-[11px] font-mono text-slate-400">
                          {lista.length} {lista.length === 1 ? 'congregação registrada' : 'congregações registradas'} nesta jurisdição
                        </p>
                      </div>
                    </div>

                    <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-400 font-bold">
                      JURISDIÇÃO {uf}
                    </span>
                  </div>

                  {/* Grade de Cards do Estado */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {lista.map((igreja, idx) => renderCardIgreja(igreja, gerarUrlGoogleMaps, setIgrejaModal, idx))}
                  </div>
                </section>
              );
            })}
        </div>
      )}

      {/* VISUALIZAÇÃO EM GRADE GERAL */}
      {modoAgrupamento === 'TODAS' && filtradas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtradas.map((igreja, idx) => renderCardIgreja(igreja, gerarUrlGoogleMaps, setIgrejaModal, idx))}
        </div>
      )}

      {/* MODAL DE FICHA CADASTRAL COMPLETA DA IGREJA */}
      {igrejaModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="max-w-2xl w-full rounded-3xl bg-slate-900 border border-emerald-500/40 shadow-2xl overflow-hidden my-8">
            {/* Header Modal */}
            <div className="p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-emerald-500/40 overflow-hidden flex items-center justify-center shrink-0 p-1 shadow-lg">
                  {igrejaModal.logoUrl ? (
                    <img
                      src={igrejaModal.logoUrl}
                      alt={igrejaModal.nomeFantasia}
                      className="w-full h-full object-contain rounded-xl"
                    />
                  ) : (
                    <Building2 className="w-8 h-8 text-emerald-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 border border-emerald-500/50 text-emerald-400">
                      {igrejaModal.status || 'ATIVA'}
                    </span>
                    <span className="text-xs font-mono text-cyan-300 font-bold">
                      {igrejaModal.municipio} - {igrejaModal.uf}
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white truncate mt-1">
                    {igrejaModal.nomeFantasia}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono truncate">
                    {igrejaModal.razaoSocial}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIgrejaModal(null)}
                className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo Modal */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto font-sans">
              {/* Liderança Pastoral */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-slate-500 font-bold tracking-wider block">
                  Pastor Presidente Titular
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold font-mono">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {igrejaModal.pastorPresidenteNome || 'Liderança Pastoral Local'}
                    </h4>
                    <p className="text-xs text-emerald-400 font-mono">Pastor Titular Homologado na Convenção</p>
                  </div>
                </div>
              </div>

              {/* Informações Cadastrais e Tributárias */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                  <span className="text-slate-500 uppercase block text-[10px]">CNPJ Registrado</span>
                  <span className="text-white font-bold">{igrejaModal.cnpj || 'Não informado'}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                  <span className="text-slate-500 uppercase block text-[10px]">Data de Abertura / Fundação</span>
                  <span className="text-white font-bold">
                    {igrejaModal.dataAbertura ? new Date(igrejaModal.dataAbertura).toLocaleDateString('pt-BR') : 'Data não informada'}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                  <span className="text-slate-500 uppercase block text-[10px]">Data de Filiação Convencional</span>
                  <span className="text-emerald-400 font-bold">
                    {igrejaModal.dataFiliacao ? new Date(igrejaModal.dataFiliacao).toLocaleDateString('pt-BR') : 'Filiada'}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                  <span className="text-slate-500 uppercase block text-[10px]">Situação Cadastral Receita</span>
                  <span className="text-cyan-300 font-bold">{igrejaModal.situacaoCadastral || 'ATIVA'}</span>
                </div>
              </div>

              {/* Endereço Completo & Acesso ao Google Maps */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Localização & Endereço Completo</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">CEP: {igrejaModal.cep}</span>
                </div>

                <div className="text-xs text-slate-200 leading-relaxed font-mono">
                  <p className="font-bold text-white">
                    {igrejaModal.logradouro}, nº {igrejaModal.numero} {igrejaModal.complemento ? `(${igrejaModal.complemento})` : ''}
                  </p>
                  <p className="text-slate-400">
                    Bairro: {igrejaModal.bairro} • {igrejaModal.municipio} - {igrejaModal.uf}
                  </p>
                </div>

                {/* BOTÃO EM DESTAQUE NO MODAL: ABRIR NO GOOGLE MAPS */}
                <a
                  href={gerarUrlGoogleMaps(igrejaModal)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer"
                >
                  <MapPin className="w-4 h-4" />
                  <span>Traçar Rota no Google Maps</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Contatos Oficiais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {igrejaModal.telefone && (
                  <a
                    href={`tel:${igrejaModal.telefone.replace(/\D/g, '')}`}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-white transition-colors"
                  >
                    <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-mono truncate">{igrejaModal.telefone}</span>
                  </a>
                )}
                {igrejaModal.email && (
                  <a
                    href={`mailto:${igrejaModal.email}`}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-white transition-colors"
                  >
                    <Mail className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="font-mono truncate">{igrejaModal.email}</span>
                  </a>
                )}
              </div>
            </div>

            {/* Rodapé Modal */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIgrejaModal(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold transition-all cursor-pointer"
              >
                Fechar Ficha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Função Auxiliar de Renderização de Card da Igreja Filiada
 * Padrão Neofintech: Logo, Dados Básicos, Pastor, Endereço e Botão Google Maps Direto
 */
function renderCardIgreja(
  igreja: IgrejaFiliada,
  gerarUrlGoogleMaps: (ig: IgrejaFiliada) => string,
  setIgrejaModal: (ig: IgrejaFiliada) => void,
  keyIndex?: number
) {
  const urlMaps = gerarUrlGoogleMaps(igreja);
  const cardKey = igreja.id ? `${igreja.id}-${keyIndex ?? 0}` : `igreja-${keyIndex ?? 0}`;

  return (
    <div
      key={cardKey}
      className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition-all space-y-4 shadow-xl flex flex-col justify-between group backdrop-blur-sm relative overflow-hidden"
    >
      {/* Barra de Acento Superior */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500/40 via-teal-500/40 to-cyan-500/40 group-hover:from-emerald-400 group-hover:to-cyan-400 transition-all" />

      <div className="space-y-3.5">
        {/* Topo do Card: Logo + Badges */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Logo da Igreja */}
            <div className="w-13 h-13 rounded-2xl bg-slate-950 border border-emerald-500/30 overflow-hidden flex items-center justify-center shrink-0 p-1 shadow group-hover:border-emerald-400 group-hover:scale-105 transition-all">
              {igreja.logoUrl ? (
                <img
                  src={igreja.logoUrl}
                  alt={igreja.nomeFantasia}
                  className="w-full h-full object-contain rounded-xl"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <Building2 className="w-6 h-6 text-emerald-400" />
              )}
            </div>

            {/* Nome Fantasia e Razão Social */}
            <div className="min-w-0">
              <h4 className="font-black text-white text-sm sm:text-base group-hover:text-emerald-300 transition-colors truncate">
                {igreja.nomeFantasia}
              </h4>
              <p className="text-[11px] text-slate-400 font-mono truncate">
                {igreja.razaoSocial}
              </p>
            </div>
          </div>

          {/* Badge UF */}
          <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-black bg-emerald-950/90 text-emerald-400 border border-emerald-500/40 shrink-0 shadow">
            {igreja.uf}
          </span>
        </div>

        {/* Pastor Titular */}
        <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Users className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-500 uppercase font-mono block leading-none">
              Pastor Titular
            </span>
            <span className="text-xs font-bold text-slate-200 truncate block mt-0.5">
              {igreja.pastorPresidenteNome || 'Pr. Titular Responsável'}
            </span>
          </div>
        </div>

        {/* Informações Básicas (CNPJ, Fundação, Filiação) */}
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300">
          <div className="p-2 rounded-lg bg-slate-950/40 border border-slate-800/60">
            <span className="text-[9px] text-slate-500 uppercase block">CNPJ</span>
            <span className="text-slate-300 truncate block font-semibold">{igreja.cnpj || 'Cadastrado'}</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/40 border border-slate-800/60">
            <span className="text-[9px] text-slate-500 uppercase block">Filiada Desde</span>
            <span className="text-emerald-400 truncate block font-bold">
              {igreja.dataFiliacao ? new Date(igreja.dataFiliacao).getFullYear() : 'Ativa'}
            </span>
          </div>
        </div>

        {/* Endereço Físico Formatado */}
        <div className="text-xs font-mono text-slate-300 space-y-1">
          <div className="flex items-start gap-1.5 text-slate-400">
            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span className="text-slate-300 line-clamp-2">
              {igreja.logradouro}, {igreja.numero} - {igreja.bairro}, {igreja.municipio} - {igreja.uf}
            </span>
          </div>
          {igreja.cep && (
            <p className="text-[10px] text-slate-500 pl-5">CEP: {igreja.cep}</p>
          )}
        </div>
      </div>

      {/* Botões de Ação do Card */}
      <div className="space-y-2 pt-2 border-t border-slate-800/80">
        {/* BOTÃO EXIGIDO: ENCAMINHA DIRETAMENTE PARA O GOOGLE MAPS */}
        <a
          href={urlMaps}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2.5 px-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 hover:border-emerald-400 font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md group/btn cursor-pointer"
          title={`Abrir localização de ${igreja.nomeFantasia} no Google Maps`}
        >
          <MapPin className="w-3.5 h-3.5 text-emerald-400 group-hover/btn:text-white transition-colors" />
          <span>Ver no Google Maps</span>
          <ExternalLink className="w-3 h-3 opacity-70 group-hover/btn:opacity-100" />
        </a>

        {/* Botão Secundário: Ficha Detalhada */}
        <button
          onClick={() => setIgrejaModal(igreja)}
          className="w-full py-2 px-3 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-300 hover:text-white font-mono text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all border border-slate-700/60 cursor-pointer"
        >
          <FileText className="w-3 h-3 text-slate-400" />
          <span>Ver Ficha Cadastral</span>
          <ChevronRight className="w-3 h-3 text-slate-500" />
        </button>
      </div>
    </div>
  );
}

// ==========================================
// 5. PÁGINA: EVENTOS
// ==========================================
export function PortalEventos({ eventosProp }: { readonly eventosProp?: readonly any[] } = {}) {
  const { eventos: eventosGlobal } = useSecurity();
  const [eventosLocal, setEventosLocal] = useState<any[]>([]);
  const [eventoSelecionado, setEventoSelecionado] = useState<any | null>(null);

  useEffect(() => {
    fetchEventos().then((res) => {
      if (res) {
        setEventosLocal([...res]);
      }
    });
  }, []);

  const eventosRaw = eventosProp && eventosProp.length > 0
    ? eventosProp
    : eventosGlobal && eventosGlobal.length > 0
    ? eventosGlobal
    : eventosLocal;

  const agoConclaveEvent = useMemo(() => {
    return (eventosRaw || []).find((e: any) => {
      if (!e) return false;
      const t = (e.titulo || '').toLowerCase();
      return e.chave_mestra === 'ago_conclave' || t.includes('ago') || t.includes('assembleia');
    });
  }, [eventosRaw]);

  const outrosEventos = useMemo(() => {
    return (eventosRaw || []).filter((e: any) => e !== agoConclaveEvent);
  }, [eventosRaw, agoConclaveEvent]);

  if (eventoSelecionado) {
    return (
      <div className="space-y-6 pb-12 max-w-4xl mx-auto">
        <button
          onClick={() => setEventoSelecionado(null)}
          className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
        >
          ← Voltar para Eventos
        </button>

        <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl space-y-6">
          <div className="w-full h-72 sm:h-96 relative overflow-hidden">
            <img
              src={eventoSelecionado.banner_url || eventoSelecionado.bannerUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80'}
              alt={eventoSelecionado.titulo}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 space-y-2">
              <span className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-mono text-xs font-bold">
                {eventoSelecionado.status || 'ATIVO'}
              </span>
              <h1 className="text-2xl sm:text-4xl font-black text-white">{eventoSelecionado.titulo}</h1>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div>
                <span className="text-slate-500 block uppercase">Data Oficial</span>
                <span className="text-white font-bold">{eventoSelecionado.data_evento || eventoSelecionado.data}</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase">Localização</span>
                <span className="text-cyan-400 font-bold">{eventoSelecionado.local}</span>
              </div>
            </div>

            {eventoSelecionado.subtitulo && (
              <p className="text-base text-slate-300 font-semibold italic">{eventoSelecionado.subtitulo}</p>
            )}

            <div className="text-sm text-slate-300 leading-relaxed space-y-4">
              <p>{eventoSelecionado.descricao || eventoSelecionado.conteudo || 'Detalhes oficiais do evento cadastrados no sistema de governança.'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div>
        <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider block">
          CALENDÁRIO OFICIAL
        </span>
        <h2 className="text-3xl font-black text-white tracking-tight">
          Eventos e Convenções Eclesiásticas
        </h2>
      </div>

      <div className="space-y-6">
        {agoConclaveEvent && (
          <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-500/50 overflow-hidden shadow-2xl flex flex-col md:flex-row group">
            <div className="md:w-72 h-48 md:h-auto relative overflow-hidden shrink-0">
              <img
                src={agoConclaveEvent.banner_url || agoConclaveEvent.bannerUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=600&q=80'}
                alt={agoConclaveEvent.titulo}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                    ⭐ CONCLAVE OFICIAL PRINCIPAL (AGO 2026)
                  </span>
                  <span className="text-xs font-mono text-cyan-400">{agoConclaveEvent.status || 'ATIVO'}</span>
                </div>
                <h3 className="text-2xl font-black text-white">{agoConclaveEvent.titulo}</h3>
                <p className="text-xs text-slate-300 font-mono">📍 {agoConclaveEvent.local}</p>
                {agoConclaveEvent.subtitulo && <p className="text-xs text-slate-200">{agoConclaveEvent.subtitulo}</p>}
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300">📅 {agoConclaveEvent.data_evento || agoConclaveEvent.data}</span>
                <button
                  onClick={() => setEventoSelecionado(agoConclaveEvent)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg"
                >
                  Ver Detalhes do Conclave <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {outrosEventos.map((evento, idx) => (
          <div
            key={evento.id ? `${evento.id}-${idx}` : `evt-${idx}`}
            className="rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition-all overflow-hidden shadow-xl flex flex-col md:flex-row group"
          >
            <div className="md:w-72 h-48 md:h-auto relative overflow-hidden shrink-0">
              <img
                src={evento.banner_url || evento.bannerUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=600&q=80'}
                alt={evento.titulo}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>

            <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-mono text-[10px] font-bold">
                    EVENTO OFICIAL
                  </span>
                  <span className="text-xs font-mono text-cyan-400">{evento.status || 'ATIVO'}</span>
                </div>
                <h3 className="text-xl font-bold text-white">{evento.titulo}</h3>
                <p className="text-xs text-slate-400 font-mono">📍 {evento.local}</p>
                {evento.subtitulo && <p className="text-xs text-slate-300 line-clamp-2">{evento.subtitulo}</p>}
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">📅 {evento.data_evento || evento.data}</span>
                <button
                  onClick={() => setEventoSelecionado(evento)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow"
                >
                  Ler mais <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// 6. PÁGINA: NOTÍCIAS
// ==========================================
export function PortalNoticias({ noticiasProp }: { readonly noticiasProp?: readonly any[] } = {}) {
  const { noticias: noticiasGlobal } = useSecurity();
  const [noticiasLocal, setNoticiasLocal] = useState<any[]>([]);
  const [noticiaSelecionada, setNoticiaSelecionada] = useState<any | null>(null);

  useEffect(() => {
    fetchNoticias().then((res) => {
      if (res) {
        setNoticiasLocal([...res]);
      }
    });
  }, []);

  const noticias = noticiasProp && noticiasProp.length > 0
    ? noticiasProp
    : noticiasGlobal && noticiasGlobal.length > 0
    ? noticiasGlobal
    : noticiasLocal;

  if (noticiaSelecionada) {
    return (
      <div className="space-y-6 pb-12 max-w-4xl mx-auto">
        <button
          onClick={() => setNoticiaSelecionada(null)}
          className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
        >
          ← Voltar para Notícias
        </button>

        <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl space-y-6">
          <div className="w-full h-72 sm:h-96 relative overflow-hidden">
            <img
              src={noticiaSelecionada.banner_url || noticiaSelecionada.bannerUrl || 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=80'}
              alt={noticiaSelecionada.titulo}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 space-y-2">
              <span className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-mono text-xs font-bold">
                {noticiaSelecionada.categoria}
              </span>
              <h1 className="text-2xl sm:text-4xl font-black text-white">{noticiaSelecionada.titulo}</h1>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between font-mono text-xs text-slate-400 border-b border-slate-800 pb-4">
              <span>✍️ Autor: {noticiaSelecionada.autor || 'Secretaria Geral'}</span>
              <span>📅 {noticiaSelecionada.data_publicacao || noticiaSelecionada.data}</span>
            </div>

            {noticiaSelecionada.subtitulo && (
              <p className="text-base text-slate-300 font-semibold italic">{noticiaSelecionada.subtitulo}</p>
            )}

            <div className="text-sm text-slate-300 leading-relaxed space-y-4">
              <p>{noticiaSelecionada.conteudo || noticiaSelecionada.resumo || 'Conteúdo oficial da notícia registrado no sistema.'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div>
        <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider block">
          INFORMAÇÃO & TRANSPARÊNCIA
        </span>
        <h2 className="text-3xl font-black text-white tracking-tight">
          Notícias e Comunicados da Convenção
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {noticias.map((item, idx) => (
          <div
            key={item.id ? `${item.id}-${idx}` : `not-${idx}`}
            className="rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition-all overflow-hidden shadow-xl flex flex-col justify-between group"
          >
            <div>
              <div className="w-full h-48 relative overflow-hidden">
                <img
                  src={item.banner_url || item.bannerUrl || 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=600&q=80'}
                  alt={item.titulo}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              <div className="p-6 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span className="text-emerald-400 font-bold">{item.categoria}</span>
                  <span>{item.data_publicacao || item.data}</span>
                </div>
                <h3 className="text-base font-bold text-white hover:text-emerald-300 transition-colors line-clamp-2">
                  {item.titulo}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                  {item.subtitulo || item.conteudo || item.resumo}
                </p>
              </div>
            </div>

            <div className="p-6 pt-0">
              <button
                onClick={() => setNoticiaSelecionada(item)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer font-mono shadow"
              >
                Ler mais <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// 7. PÁGINA: INSCRIÇÃO AGO (PÚBLICA) - INTEGRADA COM PLANOS DO BANCO
// ==========================================
function formatarMoeda(val: number): string {
  return (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function PortalInscricaoAgo({ onNavegar }: PortalPageProps) {
  const { ministros, anuidades, inscricoesAGO, operadorAtual, operadorId, addAuditLog, appConfig, eventos, cicloAgoVigente } = useSecurity();

  // Estados dos Planos da Coleção planos_ago (onSnapshot)
  const [planos, setPlanos] = useState<PlanoAgo[]>([]);
  const [carregandoPlanos, setCarregandoPlanos] = useState<boolean>(true);

  // Estado do Conclave AGO Ativo carregado dinamicamente do Banco de Dados Firestore
  const [agoConclave, setAgoConclave] = useState<any | null>(() => extrairEventoAgo(eventos, cicloAgoVigente));

  useEffect(() => {
    const ev = extrairEventoAgo(eventos, cicloAgoVigente);
    if (ev) {
      setAgoConclave(ev);
    }
  }, [eventos, cicloAgoVigente]);

  // Inscrições existentes
  const [inscricoes, setInscricoes] = useState<InscricaoAgoDocumento[]>([]);

  // Seleção e Checkout
  const [modalBuscaCpfAberto, setModalBuscaCpfAberto] = useState<boolean>(false);
  const [modalInadimplenciaAberto, setModalInadimplenciaAberto] = useState<boolean>(false);
  const [etapaModal, setEtapaModal] = useState<'BUSCA_CPF' | 'SELECAO_PLANOS' | 'CHECKOUT_PAGAMENTO' | 'JA_INSCRITO'>('BUSCA_CPF');
  const [inscricaoJaRealizada, setInscricaoJaRealizada] = useState<any | null>(null);
  const [ministroModal, setMinistroModal] = useState<any | null>(null);
  const [planoModalSelecionado, setPlanoModalSelecionado] = useState<PlanoAgo | null>(null);
  const [pendenciasFinanceiras, setPendenciasFinanceiras] = useState<any[]>([]);
  const [totalDevidoAnuidades, setTotalDevidoAnuidades] = useState<number>(0);
  const [liquidandoAnuidade, setLiquidandoAnuidade] = useState<boolean>(false);
  const [chavePixCopiada, setChavePixCopiada] = useState<boolean>(false);
  const [msgSucessoLiquidacao, setMsgSucessoLiquidacao] = useState<string | null>(null);
  const [formaPagamentoInadimplencia, setFormaPagamentoInadimplencia] = useState<'PIX' | 'CARTAO_CREDITO'>('PIX');
  const [cartaoInadimplenciaDados, setCartaoInadimplenciaDados] = useState({
    numero: '',
    titular: '',
    validade: '',
    cvv: ''
  });
  const [docRecomendacaoPastoral, setDocRecomendacaoPastoral] = useState<{ nome: string; url: string } | null>(null);
  const [docAtaIndicacao, setDocAtaIndicacao] = useState<{ nome: string; url: string } | null>(null);
  const [modalidadeConsagracao, setModalidadeConsagracao] = useState<'RECEBIDO' | 'ORDENADO'>('ORDENADO');

  const [planoAlvo, setPlanoAlvo] = useState<PlanoAgo | null>(null);
  const [cpfBuscaModal, setCpfBuscaModal] = useState<string>('');
  const [carregandoModal, setCarregandoModal] = useState<boolean>(false);
  const [erroModal, setErroModal] = useState<string | null>(null);
  const [exibindoNovoCadastroAba, setExibindoNovoCadastroAba] = useState<boolean>(false);
  const [cpfParaNovoCadastro, setCpfParaNovoCadastro] = useState<string>('');
  const [ministroSelecionadoId, setMinistroSelecionadoId] = useState<string>('');
  const [planoParaCheckout, setPlanoParaCheckout] = useState<PlanoAgo | null>(null);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoAgo>('PIX');
  const [processandoInscricao, setProcessandoInscricao] = useState<boolean>(false);
  const [asaasCheckoutCharge, setAsaasCheckoutCharge] = useState<any>(null);
  const [carregandoCheckoutAsaas, setCarregandoCheckoutAsaas] = useState<boolean>(false);

  useEffect(() => {
    if (etapaModal !== 'CHECKOUT_PAGAMENTO' || !planoParaCheckout || !ministroModal) {
      setAsaasCheckoutCharge(null);
      return;
    }
    let isMounted = true;
    setCarregandoCheckoutAsaas(true);
    fetch('/api/asaas/charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ministroModal.email || 'tesouraria@cimadebe.org.br',
        cpf: ministroModal.cpf || '00000000000',
        name: ministroModal.nome || 'Ministro Inscrito',
        userId: ministroModal.id || ministroModal.cpf,
        value: planoParaCheckout.valor || 150,
        description: `Inscrição AGO 2026 - ${planoParaCheckout.nome}`,
        billingType: 'PIX'
      })
    })
      .then(res => res.json())
      .then(json => {
        if (isMounted && json.success) {
          setAsaasCheckoutCharge(json.data);
        }
      })
      .catch(err => {
        console.warn('Erro ao carregar cobrança Asaas checkout:', err);
      })
      .finally(() => {
        if (isMounted) setCarregandoCheckoutAsaas(false);
      });

    return () => {
      isMounted = false;
    };
  }, [etapaModal, planoParaCheckout, ministroModal]);

  // Auto-polling for Pix payment confirmation in PortalPages checkout
  useEffect(() => {
    if (etapaModal !== 'CHECKOUT_PAGAMENTO' || !asaasCheckoutCharge?.paymentId) return;
    let isMounted = true;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/asaas/check-payment/${asaasCheckoutCharge.paymentId}`);
        const json = await res.json();
        if (json.success && json.data) {
          const status = json.data.status;
          if (status === 'RECEIVED' || status === 'CONFIRMED' || status === 'RECEIVED_IN_CASH') {
            if (isMounted) {
              setFeedback({ tipo: 'sucesso', texto: 'Pagamento Pix detectado e confirmado automaticamente!' });
              setEtapaModal('SUCESSO');
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao verificar status automático do Pix em PortalPages:', err);
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [etapaModal, asaasCheckoutCharge?.paymentId]);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro' | 'info'; texto: string } | null>(null);
  const [comprovanteVisualizar, setComprovanteVisualizar] = useState<any | null>(null);

  const estaNaJanelaDeBloqueio3Dias = useMemo(() => {
    if (!agoConclave || !agoConclave.data_inicio) return false;
    try {
      const dataInicio = new Date(agoConclave.data_inicio);
      const agora = new Date();
      const diffMs = dataInicio.getTime() - agora.getTime();
      const diffDias = diffMs / (1000 * 60 * 60 * 24);
      return diffDias <= 3;
    } catch {
      return false;
    }
  }, [agoConclave]);

  useEffect(() => {
    setCarregandoPlanos(true);

    // Carrega informações detalhadas do conclave oficial do Firestore
    fetchEventos()
      .then((todos) => {
        if (todos) {
          const conclave = extrairEventoAgo(todos, cicloAgoVigente);
          if (conclave) {
            setAgoConclave(conclave);
          }
        }
      })
      .catch((err) => console.error('Erro ao buscar conclave AGO no portal:', err));

    const unsubPlanos = ouvirPlanosAgo(
      db,
      (docs) => {
        setPlanos(docs);
        setCarregandoPlanos(false);
      },
      (err) => {
        const msg = (err?.message || '').toLowerCase();
        const isQuota = msg.includes('quota') || msg.includes('resourceexhausted') || msg.includes('exceeded') || msg.includes('limit') || msg.includes('free daily read units');
        if (!isQuota) {
          console.error('Erro ao escutar planos:', err);
        } else {
          console.warn('[PortalPages] Quota excedida em planos. Usando fallback.');
        }
        setCarregandoPlanos(false);
      }
    );

    return () => {
      unsubPlanos();
    };
  }, []);

  const ministroSelecionado = useMemo(() => {
    return ministros.find((m) => m.id === ministroSelecionadoId);
  }, [ministros, ministroSelecionadoId]);

  const inscricaoDoMinistro = useMemo(() => {
    if (!ministroSelecionadoId) return null;
    return inscricoesAGO.find((i: any) => i.ministroId === ministroSelecionadoId);
  }, [inscricoesAGO, ministroSelecionadoId]);

  const abrirCheckoutPlano = (plano?: PlanoAgo) => {
    setPlanoAlvo(plano || null);
    setPlanoModalSelecionado(plano || null);
    setCpfBuscaModal('');
    setErroModal(null);
    setInscricaoJaRealizada(null);
    setExibindoNovoCadastroAba(false);
    setEtapaModal('BUSCA_CPF');
    setMinistroModal(null);
    setPendenciasFinanceiras([]);
    setTotalDevidoAnuidades(0);
    setDocRecomendacaoPastoral(null);
    setDocAtaIndicacao(null);
    setMsgSucessoLiquidacao(null);
    setChavePixCopiada(false);
    setModalBuscaCpfAberto(true);
  };

  const confirmarInscricaoTransacional = async () => {
    if (!ministroSelecionado || !planoParaCheckout) return;

    setProcessandoInscricao(true);
    setFeedback({ tipo: 'info', texto: 'Processando transação bancária atômica no Firestore...' });

    try {
      const resultado = await realizarInscricaoPlanoGenericaTransacional(db, {
        ministroId: ministroSelecionado.id,
        ministroNome: ministroSelecionado.nome,
        ministroCpf: ministroSelecionado.cpf,
        cargo: ministroSelecionado.cargo,
        fotoUrl: ministroSelecionado.fotoUrl || '',
        email: ministroSelecionado.email || 'atendimento@cimadebe.com.br',
        telefone: ministroSelecionado.telefone || '(71) 99999-9999',
        planoId: planoParaCheckout.codigo || planoParaCheckout.id,
        planoNome: planoParaCheckout.nome,
        planoValor: planoParaCheckout.valor,
        formaPagamento,
        operadorId: operadorId || 'op-portal',
        operadorNome: operadorAtual || ministroSelecionado.nome,
      });

      addAuditLog(
        'HOMOLOGACAO_INSCRICAO_AGO',
        `Inscrição pública homologada em ${planoParaCheckout.nome} para o ministro ${ministroSelecionado.nome} - R$ ${planoParaCheckout.valor}`,
        'TENANT_SEDE_GERAL'
      );

      setFeedback({
        tipo: 'sucesso',
        texto: resultado.mensagem,
      });

      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#10b981', '#6366f1', '#06b6d4', '#f59e0b'],
      });

      setComprovanteVisualizar(resultado.inscricao);
      setPlanoParaCheckout(null);
      setMinistroSelecionadoId('');
    } catch (err: any) {
      console.error('Erro na transação de inscrição:', err);
      setFeedback({
        tipo: 'erro',
        texto: err?.message || 'Falha ao processar a inscrição. Tente novamente.',
      });
    } finally {
      setProcessandoInscricao(false);
    }
  };

  if (exibindoNovoCadastroAba) {
    return (
      <Etapa4NovoCadastroAgo
        cpfInicial={cpfParaNovoCadastro}
        onVoltarBusca={() => setExibindoNovoCadastroAba(false)}
        onCadastroConcluido={(dados: any, plano: any) => {
          setExibindoNovoCadastroAba(false);
          const objMinistro = {
            id: dados.id,
            nome: dados.nome,
            cpf: dados.cpf,
            cargo: dados.cargo,
            status: 'ATIVO',
            statusAdimplencia: 'ADIMPLENTE',
            fotoUrl: dados.fotoUrl || '',
            email: dados.email || '',
            telefone: dados.telefone || '',
          } as any;
          setMinistroModal(objMinistro);
          setMinistroSelecionadoId(dados.id);
          const planoFinal = (plano as any) || planoAlvo;
          setPlanoParaCheckout(planoFinal);
          setPlanoModalSelecionado(planoFinal);
          setModalBuscaCpfAberto(true);
          setEtapaModal('CHECKOUT_PAGAMENTO');
        }}
      />
    );
  }

  return (
    <div className="space-y-10 pb-12 max-w-6xl mx-auto">
      {/* Banner Principal */}
      <div className="p-8 rounded-3xl bg-slate-900 border border-emerald-500/30 shadow-2xl text-center space-y-4">
        <span className="px-3.5 py-1.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/40 text-xs font-mono font-bold uppercase tracking-wider inline-block">
          {agoConclave?.titulo || 'ASSEMBLEIA GERAL ORDINÁRIA • AGO 2026'}
        </span>
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Inscrição Oficial & Planos da AGO
        </h2>
        <p className="text-sm text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Selecione seu plano abaixo com base em seu cargo eclesiástico. Todos os planos refletem em tempo real as configurações aprovadas pela Mesa Diretora no banco de dados.
        </p>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => onNavegar('validacaoCredenciais')}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs font-mono shadow-lg transition-all cursor-pointer flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            Verificar Minha Adimplência & Credencial
          </button>
        </div>
      </div>

      {/* Card Pequeno com Breve Informação e Link para ver a página inteira */}
      {agoConclave && (
        <div className="rounded-2xl bg-slate-900/90 border border-emerald-500/30 p-5 sm:p-6 shadow-xl relative overflow-hidden backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center gap-4 relative z-10 min-w-0">
            <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-emerald-500/40 overflow-hidden shrink-0 shadow-md">
              <img 
                src={agoConclave.banner_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=300&h=300&q=80'} 
                alt={agoConclave.titulo} 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/30 text-[9px] text-emerald-400 font-mono font-bold uppercase tracking-wider">
                  CONCLAVE 2026
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  📍 {agoConclave.local}
                </span>
              </div>
              <h3 className="text-sm sm:text-base md:text-lg font-bold text-white tracking-tight leading-snug">{agoConclave.titulo}</h3>
              <p className="text-xs text-slate-300">
                {agoConclave.subtitulo || agoConclave.tema_biblico || 'Assembleia Geral Ordinária com programações oficiais e credenciamento.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 relative z-10 w-full md:w-auto justify-end">
            <button
              onClick={() => onNavegar('eventos')}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs font-mono shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer flex items-center gap-2"
            >
              <span>Ver Página Inteira de Eventos</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-mono flex items-center gap-2.5 max-w-3xl mx-auto w-full ${
            feedback.tipo === 'sucesso'
              ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
              : feedback.tipo === 'erro'
              ? 'bg-rose-950/90 border-rose-500/60 text-rose-200'
              : 'bg-indigo-950/90 border-indigo-500/60 text-indigo-200'
          }`}
        >
          {feedback.tipo === 'sucesso' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          {feedback.tipo === 'erro' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
          {feedback.tipo === 'info' && <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin shrink-0" />}
          <span className="leading-relaxed">{feedback.texto}</span>
        </div>
      )}

      {appConfig.killSwitchCompliance && (
        <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-300 font-mono text-xs max-w-4xl mx-auto space-y-2 mb-4">
          <div className="flex items-center gap-2 text-amber-400 font-bold uppercase text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>INSCRIÇÕES BLOQUEADAS POR COMPLIANCE</span>
          </div>
          <p className="font-sans leading-relaxed text-slate-300">
            Atenção obreiros: O sistema de inscrições para o Conclave AGO foi temporariamente suspenso pelo auditor geral / conselho de compliance da Convenção.
          </p>
        </div>
      )}

      {estaNaJanelaDeBloqueio3Dias && (
        <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-500/30 text-rose-300 font-mono text-xs max-w-4xl mx-auto space-y-2">
          <div className="flex items-center gap-2 text-rose-400 font-bold uppercase text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>INSCRIÇÕES ONLINE SUSPENSAS</span>
          </div>
          <p className="font-sans leading-relaxed text-slate-300">
            Atenção obreiros: O prazo limite para inscrições online e compensação de boletos bancários da AGO {agoConclave?.titulo || ''} encerrou-se por critérios de conformidade e preparação logística (trava de 3 dias de antecedência para compensação dos boletos). 
          </p>
          <p className="font-sans text-slate-400">
            Por favor, dirija-se diretamente à Secretaria Geral Física no local do Conclave para efetivar o seu credenciamento e regularização no dia do evento.
          </p>
        </div>
      )}
      
      {agoConclave && agoConclave.status === 'ENCERRADO' && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-indigo-500/30 text-slate-300 text-center max-w-4xl mx-auto space-y-4 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="inline-flex p-3 bg-indigo-950/80 border border-indigo-500/40 rounded-full text-indigo-300 animate-pulse">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white font-mono uppercase tracking-wider">CONCLAVE ENCERRADO</h3>
            <p className="text-xs text-slate-400 font-sans max-w-lg mx-auto">
              A Assembleia Geral Ordinária de {agoConclave?.titulo || ''} foi encerrada oficialmente. A equipe de Governança está consolidando os votos e atas para a transição do ciclo.
            </p>
          </div>
          <p className="text-[11px] text-indigo-400 font-mono">
            Aguarde o credenciamento e liberação do próximo ciclo oficial pela Mesa Diretora.
          </p>
        </div>
      )}

      {/* Grid Dinâmico dos Planos do Banco de Dados */}
      <div className="space-y-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto px-2">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-black text-white tracking-tight">
              Planos Oficiais Disponíveis na Convenção
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {planos.length} Planos Sincronizados em Tempo Real
          </span>
        </div>

        {carregandoPlanos && planos.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse space-y-4 min-h-[400px]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {planos.map((plano) => {
              const isDestaque = Boolean(plano.destaque);
              const elegibilidade = ministroSelecionado
                ? validarElegibilidadeCargo(plano, ministroSelecionado.cargo)
                : { elegivel: true };
              const estaIncompativel = ministroSelecionado && !elegibilidade.elegivel;
              const estaInscrito = Boolean(inscricaoDoMinistro);

              return (
                <div
                  key={plano.id}
                  className={`rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 relative shadow-2xl backdrop-blur-xl ${
                    estaIncompativel
                      ? 'bg-slate-950/60 border border-slate-800/60 opacity-60'
                      : isDestaque
                      ? 'bg-gradient-to-b from-slate-900/95 via-emerald-950/30 to-slate-900 border-2 border-emerald-500 shadow-[0_0_35px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/40'
                      : 'bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50'
                  }`}
                >
                  {isDestaque && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500 via-indigo-500 to-cyan-400 text-slate-950 text-[10px] font-mono font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5 whitespace-nowrap">
                      <Crown className="w-3.5 h-3.5 text-slate-950" />
                      <span>{plano.badgeDestaque || (plano.id === 'PLANO_4' ? 'Ordenação Missionária' : 'Recebimento / Ordenação')}</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* 1. PRIMEIRO O VALOR EM DESTAQUE NO TOPO DO CARD */}
                    <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/30 flex items-center justify-between gap-4 shadow-inner font-mono">
                      <div>
                        <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-widest block">
                          VALOR
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans block">Taxa Oficial AGO</span>
                      </div>
                      <div className="text-3xl font-black text-emerald-400 font-mono tracking-tight shrink-0">
                        {formatarMoeda(plano.valor)}
                      </div>
                    </div>

                    {/* 2. ABAIXO AS INFORMAÇÕES DO PLANO */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider block">
                        {plano.codigo || plano.id}
                      </span>
                      <h4 className="text-base font-black text-white leading-snug">
                        {plano.nome}
                      </h4>
                      {plano.subtitulo && (
                        <p className="text-xs text-slate-300 leading-relaxed font-sans">
                          {plano.subtitulo}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] font-mono text-slate-400 font-bold uppercase block">BENEFÍCIOS INCLUSOS:</span>
                      <div className="space-y-1.5 text-xs">
                        {plano.beneficios?.map((ben, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-slate-300">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="leading-tight font-sans text-[11px]">{ben}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 space-y-1 font-mono">
                      <span className="text-[10px] text-slate-400 uppercase block font-bold">CARGOS PERMITIDOS:</span>
                      <div className="flex flex-wrap gap-1">
                        {plano.cargosPermitidos?.map((c) => (
                          <span key={c} className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[9px] text-emerald-300">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-slate-800">
                    {estaIncompativel ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-3 px-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-500 font-mono text-xs font-bold cursor-not-allowed text-center"
                      >
                        Incompatível com seu Cargo
                      </button>
                    ) : estaInscrito ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-3 px-4 rounded-2xl bg-slate-950 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4 text-amber-400" />
                        <span>Já Inscrito</span>
                      </button>
                    ) : estaNaJanelaDeBloqueio3Dias || (agoConclave && agoConclave.status === 'ENCERRADO') || appConfig.killSwitchCompliance ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-3 px-4 rounded-2xl bg-slate-950 border border-rose-500/40 text-rose-300 font-mono text-xs font-bold cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        <Lock className="w-4 h-4 text-rose-500" />
                        <span>Inscrições Suspensas</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => abrirCheckoutPlano(plano)}
                        className="w-full py-3.5 px-4 rounded-2xl font-mono font-bold text-xs uppercase tracking-wider transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 shadow-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20"
                      >
                        <span>Inscrever-se Agora</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Unificado de Inscrição AGO (Máquina de Estados de 4 Etapas) */}
      {modalBuscaCpfAberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="w-full max-w-2xl bg-slate-900 border border-emerald-500/30 rounded-3xl shadow-2xl p-5 sm:p-8 space-y-6 relative my-auto max-h-[92vh] overflow-y-auto text-white font-sans backdrop-blur-2xl glass-card"
          >
            {/* Botão Fechar Modal */}
            <button
              type="button"
              onClick={() => setModalBuscaCpfAberto(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer z-10"
              aria-label="Fechar Modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Stepper Superior - Oculto quando já inscrito para manter a página de identificação limpa */}
            {etapaModal !== 'JA_INSCRITO' && (
              <FormStepper
                steps={STEPS_MODAL_AGO}
                currentStepId={
                  etapaModal === 'INADIMPLENTE_BLOQUEADO'
                    ? 'BUSCA_CPF'
                    : etapaModal
                }
              />
            )}

            {/* ============================================================== */}
            {/* ETAPA 1: BUSCA E VALIDAÇÃO DE CPF                             */}
            {/* ============================================================== */}
            {etapaModal === 'BUSCA_CPF' && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-3 py-1 rounded-full uppercase inline-block">
                    CONCLAVE AGO 2026 • IDENTIFICAÇÃO DO OBREIRO
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Consulta de CPF e Elegibilidade
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    Informe o CPF para consultar seu cadastro, verificar a situação contábil e visualizar os planos autorizados para o seu cargo.
                  </p>
                </div>

                {/* Formulário de Busca por CPF */}
                {(() => {
                  const executarBuscaModal = async (cpfDigitado: string) => {
                    const limpo = cpfDigitado.replace(/\D/g, '');
                    if (!limpo || limpo.length < 11) {
                      setErroModal('Por favor, informe um CPF válido com 11 dígitos.');
                      return;
                    }

                    setCarregandoModal(true);
                    setErroModal(null);
                    setInscricaoJaRealizada(null);

                    try {
                      // 0. LAYER 3 CACHE-FIRST: Busca prioritária no estado central em memória (0 leituras)
                      let ministro: any = null;
                      if (ministros && ministros.length > 0) {
                        ministro = ministros.find((m) => (m.cpf || '').replace(/\D/g, '') === limpo || m.id === limpo) || null;
                      }

                      // 1. Se não localizado em memória, consulta o Firestore de forma protegida
                      if (!ministro) {
                        ministro = await buscarMinistroPorCPF(cpfDigitado, ministros);
                      }

                      // 2. LAYER 3 CACHE-FIRST: Verifica se já possui inscrição ativa em memória (0 leituras)
                      let inscricaoExistente: any = null;
                      if (inscricoesAGO && inscricoesAGO.length > 0) {
                        inscricaoExistente = inscricoesAGO.find((i: any) => {
                          const status = (i.status || i.statusInscricao || i.statusPagamento || '').trim().toUpperCase();
                          const statusValidos = ['PAGO', 'CONFIRMADO', 'VALIDA', 'HOMOLOGADO', 'CONCLUIDO', 'EM_PROCESSAMENTO', 'PENDENTE'];
                          const valido = statusValidos.includes(status);
                          const idMatch = ministro && i.ministroId === ministro.id;
                          const rawCpfItem = (i.cpf || i.ministroCpf || '').replace(/\D/g, '');
                          const cpfMatch = rawCpfItem === limpo;
                          return valido && (idMatch || cpfMatch);
                        });
                      }

                      if (!inscricaoExistente) {
                        if (ministro) {
                          inscricaoExistente = await verificarInscricaoAtiva(ministro.id, '2026', cpfDigitado, inscricoesAGO);
                          if (!inscricaoExistente && ministro.cpf) {
                            inscricaoExistente = await verificarInscricaoAtiva(ministro.id, '2026', ministro.cpf, inscricoesAGO);
                          }
                        } else {
                          // Verifica se existe inscrição ativa no ciclo mesmo se não estiver ainda na coleção ministros
                          inscricaoExistente = await verificarInscricaoAtiva('', '2026', cpfDigitado, inscricoesAGO);
                          if (inscricaoExistente && inscricaoExistente.ministroId) {
                            try {
                              const snapMin = await getDoc(doc(db, 'ministros', inscricaoExistente.ministroId));
                              if (snapMin.exists()) {
                                ministro = { id: snapMin.id, ...snapMin.data() } as any;
                              }
                            } catch (e: any) {
                              console.warn('[verificarInscricaoAtiva] Erro ao buscar doc ministro (quota):', e?.message);
                            }
                          }
                          if (inscricaoExistente && !ministro) {
                            ministro = {
                              id: inscricaoExistente.ministroId || limpo,
                              nome: inscricaoExistente.ministroNome || 'Ministro Inscrito',
                              cpf: inscricaoExistente.ministroCpf || inscricaoExistente.cpf || cpfDigitado,
                              cargo: inscricaoExistente.cargo || 'Obreiro',
                              status: 'ATIVO',
                              statusAdimplencia: 'ADIMPLENTE',
                              fotoUrl: inscricaoExistente.fotoUrl || '',
                              email: inscricaoExistente.email || '',
                              telefone: inscricaoExistente.telefone || '',
                            } as any;
                          }
                        }
                      }

                      // SE JÁ POSSUI INSCRIÇÃO ATIVA: Abre imediatamente a identificação limpa com foto e emissão de crachá
                      if (inscricaoExistente) {
                        const ministroFinal = {
                          ...(ministro || {}),
                          id: ministro?.id || inscricaoExistente.ministroId || limpo,
                          nome: ministro?.nome || inscricaoExistente.ministroNome || 'Ministro Inscrito',
                          cpf: ministro?.cpf || inscricaoExistente.ministroCpf || inscricaoExistente.cpf || cpfDigitado,
                          cargo: ministro?.cargo || inscricaoExistente.cargo || 'Obreiro',
                          status: ministro?.status || 'ATIVO',
                          statusAdimplencia: ministro?.statusAdimplencia || 'ADIMPLENTE',
                          fotoUrl: ministro?.fotoUrl || (ministro as any)?.foto || inscricaoExistente.fotoUrl || '',
                          igrejaFiliadaNome: ministro?.igrejaFiliadaNome || (inscricaoExistente as any)?.igrejaFiliadaNome || '',
                          registroMinisterial: ministro?.registroMinisterial || (inscricaoExistente as any)?.registroMinisterial || '',
                          telefone: ministro?.telefone || inscricaoExistente.telefone || '',
                          email: ministro?.email || inscricaoExistente.email || '',
                        };
                        setMinistroModal(ministroFinal as any);
                        setMinistroSelecionadoId(ministroFinal.id);
                        setInscricaoJaRealizada(inscricaoExistente);
                        setEtapaModal('JA_INSCRITO');
                        return;
                      }

                      if (!ministro) {
                        setErroModal('Obreiro não localizado na base convencional com este CPF.');
                        setCarregandoModal(false);
                        return;
                      }

                      setMinistroModal(ministro);
                      setMinistroSelecionadoId(ministro.id);

                      // Verifica compliance financeiro passando cache em memória das anuidades
                      const compliance = await verificarComplianceFinanceiroDetalhado(db, ministro.id, anuidades);

                      if (compliance.inadimplente) {
                        try {
                          localStorage.setItem('sigm_cpf_regularizando', ministro.cpf || limpo);
                          localStorage.setItem('sigm_ministro_id', ministro.id);
                        } catch {}
                        window.location.href = '/regularizar';
                        return;
                      } else {
                        // Ministro adimplente -> abre seleção de planos disponíveis
                        if (planoAlvo) {
                          const validacaoAlvo = validarElegibilidadeCargo(planoAlvo, ministro.cargo);
                          if (validacaoAlvo.elegivel) {
                            setPlanoModalSelecionado(planoAlvo);
                          } else {
                            setPlanoModalSelecionado(null);
                          }
                        } else {
                          setPlanoModalSelecionado(null);
                        }
                        setEtapaModal('SELECAO_PLANOS');
                      }
                    } catch (err: any) {
                      console.error('Erro na validação do CPF:', err);
                      const msg = (err?.message || '').toLowerCase();
                      if (msg.includes('quota') || msg.includes('resourceexhausted') || msg.includes('free daily read units') || msg.includes('limit')) {
                        setErroModal('O sistema está operando sob alta demanda no momento (limite temporário do provedor). Caso seja um novo ministro ou obreiro, realize o pré-cadastro oficial.');
                      } else {
                        setErroModal(err?.message || 'Falha ao validar o ministro.');
                      }
                    } finally {
                      setCarregandoModal(false);
                    }
                  };

                  return (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await executarBuscaModal(cpfBuscaModal);
                      }}
                      className="space-y-5"
                    >
                      <div className="space-y-2">
                        <label className="block text-slate-400 font-mono text-xs font-bold uppercase tracking-wider">
                          DIGITE SEU CPF *
                        </label>
                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            required
                            value={cpfBuscaModal}
                            onChange={(e) => {
                              const apenasNumeros = e.target.value.replace(/\D/g, '').slice(0, 11);
                              let formatado = apenasNumeros;
                              if (apenasNumeros.length > 3 && apenasNumeros.length <= 6) {
                                formatado = `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3)}`;
                              } else if (apenasNumeros.length > 6 && apenasNumeros.length <= 9) {
                                formatado = `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3, 6)}.${apenasNumeros.slice(6)}`;
                              } else if (apenasNumeros.length > 9) {
                                formatado = `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3, 6)}.${apenasNumeros.slice(6, 9)}-${apenasNumeros.slice(9)}`;
                              }
                              setCpfBuscaModal(formatado);
                              setErroModal(null);

                              if (apenasNumeros.length === 11) {
                                executarBuscaModal(formatado);
                              }
                            }}
                            placeholder="000.000.000-00"
                            maxLength={14}
                            className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-11 pr-4 py-4 text-white font-mono text-sm focus:border-emerald-500 focus:bg-slate-900 focus:outline-none transition-all shadow-inner"
                          />
                        </div>
                      </div>

                      {erroModal && (
                        <div className={`p-5 rounded-2xl border text-xs font-mono space-y-3 shadow-xl ${
                          erroModal.includes('não localizado')
                            ? 'bg-gradient-to-br from-amber-950/90 via-slate-900 to-slate-950 border-amber-500/40 text-white'
                            : 'bg-rose-950/90 border-rose-500/60 text-rose-200'
                        }`}>
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-xl shrink-0 border ${
                              erroModal.includes('não localizado')
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            }`}>
                              {erroModal.includes('não localizado') ? <UserCog className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            </div>
                            <div className="space-y-1">
                              <h4 className={`text-sm font-bold font-sans ${erroModal.includes('não localizado') ? 'text-amber-300' : 'text-rose-200'}`}>
                                {erroModal.includes('não localizado') ? 'Cadastro não localizado na base' : 'Atenção'}
                              </h4>
                              <p className="text-slate-300 leading-relaxed font-sans text-xs">
                                {erroModal.includes('não localizado')
                                  ? `O CPF informado (${cpfBuscaModal}) não consta atualmente no registro ativo da convenção. Caso seja um novo ministro ou obreiro ingressante, você pode prosseguir com o pré-cadastro oficial.`
                                  : erroModal}
                              </p>
                            </div>
                          </div>
                          {erroModal.includes('não localizado') && (
                            <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                              <span className="text-[11px] text-slate-400 font-mono">Processo rápido, seguro e integrado</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setModalBuscaCpfAberto(false);
                                  setCpfParaNovoCadastro(cpfBuscaModal);
                                  setExibindoNovoCadastroAba(true);
                                }}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-mono font-black text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Realizar Novo Pré-Cadastro</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={carregandoModal}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-mono font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/30 transition-all duration-300 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {carregandoModal ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Consultar Cadastro & Prosseguir</span>}
                      </button>
                    </form>
                  );
                })()}
              </div>
            )}

            {/* ============================================================== */}
            {/* ETAPA: INSCRIÇÃO JÁ REALIZADA E HOMOLOGADA (PÁGINA LIMPA)      */}
            {/* ============================================================== */}
            {etapaModal === 'JA_INSCRITO' && (
              <div className="space-y-6">
                {/* Header Limpo de Identificação e Homologação */}
                <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-950/90 via-slate-900 to-slate-950 border border-emerald-500/50 shadow-2xl text-center space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold uppercase tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Inscrição Confirmada • Conclave Oficial</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Ministro Credenciado & Inscrito
                  </h3>
                  <p className="text-xs text-slate-300 max-w-lg mx-auto leading-relaxed">
                    Sua inscrição para a <strong className="text-white">{agoConclave?.titulo || 'Assembleia Geral Ordinária (AGO 2026)'}</strong> já está homologada nos registros oficiais com credencial e kit congressista garantidos.
                  </p>
                </div>

                {/* Card de Identificação Completa do Ministro (com Foto em destaque) */}
                <div className="p-5 sm:p-6 rounded-3xl bg-slate-950 border border-slate-800 shadow-xl space-y-5">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                    {/* Foto Oficial do Ministro */}
                    <div className="relative shrink-0">
                      {ministroModal?.fotoUrl ? (
                        <img
                          src={ministroModal.fotoUrl}
                          alt={ministroModal.nome || 'Ministro'}
                          className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-emerald-500/60 shadow-xl shadow-emerald-950/40"
                        />
                      ) : (
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-emerald-900/60 to-slate-800 border-2 border-emerald-500/40 flex flex-col items-center justify-center text-emerald-300 shadow-xl">
                          <Users className="w-8 h-8 mb-1 text-emerald-400" />
                          <span className="font-mono font-bold text-xs">
                            {(ministroModal?.nome || 'M').trim().slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="absolute -bottom-2 -right-2 p-1.5 rounded-xl bg-emerald-500 text-slate-950 shadow-md">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Dados Primários do Ministro */}
                    <div className="flex-1 text-center sm:text-left space-y-2">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-mono font-bold uppercase tracking-wider">
                          {ministroModal?.cargo || 'Ministro'}
                        </span>
                        {ministroModal?.registroMinisterial && (
                          <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">
                            {ministroModal.registroMinisterial}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
                          {inscricaoJaRealizada?.status || 'HOMOLOGADO'}
                        </span>
                      </div>

                      <h4 className="text-lg sm:text-xl font-black text-white tracking-tight">
                        {ministroModal?.nome}
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300 font-mono pt-1">
                        <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                          <span className="text-slate-500 text-[11px]">CPF:</span>
                          <strong className="text-white">{ministroModal?.cpf}</strong>
                        </div>
                        {ministroModal?.igrejaFiliadaNome && (
                          <div className="flex items-center gap-1.5 justify-center sm:justify-start truncate">
                            <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="text-slate-200 truncate">{ministroModal.igrejaFiliadaNome}</span>
                          </div>
                        )}
                        {ministroModal?.telefone && (
                          <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                            <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="text-slate-300">{ministroModal.telefone}</span>
                          </div>
                        )}
                        {ministroModal?.email && (
                          <div className="flex items-center gap-1.5 justify-center sm:justify-start truncate">
                            <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="text-slate-300 truncate">{ministroModal.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Resumo Financeiro e Protocolo da Inscrição */}
                  <div className="pt-4 border-t border-slate-800/80">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                      <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase block">PLANO</span>
                        <span className="text-white font-bold block truncate font-sans">
                          {inscricaoJaRealizada?.planoNome || inscricaoJaRealizada?.planoId || 'Plano AGO'}
                        </span>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase block">VALOR</span>
                        <span className="text-emerald-400 font-bold block">
                          {formatarMoeda(inscricaoJaRealizada?.valor || 0)}
                        </span>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase block">PAGAMENTO</span>
                        <span className="text-slate-200 font-bold block">
                          {inscricaoJaRealizada?.formaPagamento || 'PIX'}
                        </span>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase block">DATA</span>
                        <span className="text-slate-200 font-bold block">
                          {formatarDataBR(inscricaoJaRealizada?.dataInscricao) || '2026'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Protocolo Oficial:</span>
                      <span className="text-slate-300 font-mono select-all font-bold">
                        {inscricaoJaRealizada?.id?.slice(0, 24) || 'AUTENTICADO-SIGM'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="space-y-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setModalBuscaCpfAberto(false);
                      setComprovanteVisualizar(inscricaoJaRealizada);
                    }}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-mono font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/30 transition-all duration-300 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Visualizar Crachá de Inscrição da AGO (Portaria)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalBuscaCpfAberto(false)}
                    className="w-full py-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-mono text-xs font-bold uppercase transition cursor-pointer"
                  >
                    Fechar Consulta
                  </button>
                </div>
              </div>
            )}



            {/* ============================================================== */}
            {/* ETAPA 3: SELEÇÃO DE PLANOS NO MODAL & UPLOAD DE ORDENAÇÃO      */}
            {/* ============================================================== */}
            {etapaModal === 'SELECAO_PLANOS' && ministroModal && (
              <div className="space-y-6">
                {/* Resumo do Ministro Validado */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {ministroModal.fotoUrl ? (
                      <img
                        src={ministroModal.fotoUrl}
                        alt={ministroModal.nome}
                        className="w-12 h-12 rounded-xl object-cover border border-emerald-500/40 shadow-md shrink-0 bg-slate-950"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 font-black text-sm flex items-center justify-center shadow-md shrink-0">
                        {ministroModal.nome?.charAt(0) || 'M'}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.2 rounded border border-emerald-500/30">
                          {ministroModal.cargo}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          CPF: {ministroModal.cpf}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white">{ministroModal.nome}</h4>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-xl border font-mono text-[11px] font-bold flex items-center gap-1.5 shadow-sm ${obterBadgeClassStatus(
                    ministroModal.statusAdimplencia
                  )}`}>
                    {ministroModal.statusAdimplencia === 'EM_ATRASO' || ministroModal.statusAdimplencia === 'INADIMPLENTE' ? (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                        <span>EM ATRASO (PENDÊNCIA)</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{formatarRotuloStatus(ministroModal.statusAdimplencia).toUpperCase()} (LIBERADO)</span>
                      </>
                    )}
                  </div>
                </div>

                {erroModal && (
                  <div className="p-3.5 rounded-xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs font-mono flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{erroModal}</span>
                  </div>
                )}

                {/* 1. Escolha da Modalidade (RECEBIDO e ORDENADO) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block font-mono uppercase tracking-wider">
                    Modalidade de Consagração / Ingresso *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* ORDENADO */}
                    <div
                      onClick={() => setModalidadeConsagracao('ORDENADO')}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                        modalidadeConsagracao === 'ORDENADO'
                          ? 'bg-emerald-950/80 border-2 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                          modalidadeConsagracao === 'ORDENADO'
                            ? 'bg-emerald-500 text-slate-950 shadow-md'
                            : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        <Crown className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                          <span>ORDENADO</span>
                          {modalidadeConsagracao === 'ORDENADO' && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                        </h4>
                        <span className="text-[11px] text-slate-300 font-sans leading-tight block mt-0.5">
                          Consagração e ordenação ministerial ao presbitério/pastorado na AGO 2026.
                        </span>
                      </div>
                    </div>

                    {/* RECEBIDO */}
                    <div
                      onClick={() => setModalidadeConsagracao('RECEBIDO')}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                        modalidadeConsagracao === 'RECEBIDO'
                          ? 'bg-emerald-950/80 border-2 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                          modalidadeConsagracao === 'RECEBIDO'
                            ? 'bg-emerald-500 text-slate-950 shadow-md'
                            : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                          <span>RECEBIDO</span>
                          {modalidadeConsagracao === 'RECEBIDO' && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                        </h4>
                        <span className="text-[11px] text-slate-300 font-sans leading-tight block mt-0.5">
                          Recepção de ministro já consagrado procedente de outra convenção.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Select dos Planos Adequados ao Cargo */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      <span>SELECIONE O PLANO ADEQUADO AO SEU CARGO ({ministroModal.cargo}) *</span>
                    </label>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/40">
                      Plano Homologado
                    </span>
                  </div>

                  {(() => {
                    const adequados = planos.filter((p) => validarElegibilidadeCargo(p, ministroModal.cargo).elegivel);
                    const listaFinal = adequados.length > 0 ? adequados : planos;

                    return (
                      <select
                        value={planoModalSelecionado?.id || ''}
                        onChange={(e) => {
                          const p = planos.find((pl) => pl.id === e.target.value);
                          if (p) setPlanoModalSelecionado(p);
                        }}
                        className="w-full bg-slate-950 border border-emerald-500/50 rounded-2xl p-3.5 text-white font-sans text-xs font-bold focus:outline-none focus:border-emerald-400 shadow-inner"
                      >
                        {listaFinal.map((plano) => (
                          <option key={plano.id} value={plano.id}>
                            {plano.nome} — {formatarMoeda(plano.valor || 0)}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>

                {/* 3. Destaque do Valor em Grande Escala */}
                {planoModalSelecionado && (
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/70 via-slate-950 to-slate-900 border-2 border-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.2)] space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-mono font-black uppercase">
                            PLANO HOMOLOGADO
                          </span>
                          <span className="text-[11px] font-mono text-emerald-300">
                            {planoModalSelecionado.codigo}
                          </span>
                        </div>
                        <h4 className="text-base sm:text-lg font-black text-white">
                          {planoModalSelecionado.nome}
                        </h4>
                        <p className="text-xs text-slate-300 leading-snug">
                          {planoModalSelecionado.subtitulo || 'Inscrição oficial com direito a plenárias, credenciamento e kit congressista.'}
                        </p>
                      </div>

                      <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/40 text-left sm:text-right shrink-0">
                        <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest block font-bold">
                          VALOR DO INVESTIMENTO
                        </span>
                        <span className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight drop-shadow-md block">
                          {formatarMoeda(planoModalSelecionado.valor || 0)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                          Taxa Oficial AGO 2026
                        </span>
                      </div>
                    </div>

                    {planoModalSelecionado.beneficios && planoModalSelecionado.beneficios.length > 0 && (
                      <div className="pt-3 border-t border-slate-800/80 flex flex-wrap gap-2 text-[11px] text-slate-300">
                        {planoModalSelecionado.beneficios.map((b, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-300">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{b}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Exigência Documental caso escolha Plano de Ordenação / Consagração */}
                {planoModalSelecionado && (
                  (() => {
                    const nome = (planoModalSelecionado.nome || '').toLowerCase();
                    const ehOrdenacao = nome.includes('ordena') || nome.includes('consagra') || ((planoModalSelecionado as any).categoria || '').toLowerCase().includes('ordena');

                    if (!ehOrdenacao) return null;

                    const docsProntos = Boolean(docRecomendacaoPastoral && docAtaIndicacao);

                    return (
                      <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-500/40 space-y-4">
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-5 h-5 text-amber-400 shrink-0" />
                          <div>
                            <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider block">
                              DOCUMENTAÇÃO OBRIGATÓRIA PARA CANDIDATOS A ORDENAÇÃO
                            </span>
                            <h5 className="text-xs font-bold text-white">
                              Envio de Documentos Eclesiásticos Comprobatórios
                            </h5>
                          </div>
                        </div>

                        <p className="text-xs text-slate-300 font-sans leading-relaxed">
                          Para homologação da sua ordenação ministerial nesta AGO, anexe os documentos comprobatórios exigidos pelos estatutos da Convenção Estadual:
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          {/* 1. Carta de Recomendação Pastoral */}
                          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                            <span className="text-[11px] font-bold text-white block">
                              1. Carta de Recomendação Pastoral *
                            </span>
                            <label className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-slate-700 hover:border-amber-400 text-xs font-mono text-slate-400 hover:text-white cursor-pointer transition-colors bg-slate-900/60">
                              <Upload className="w-3.5 h-3.5 text-amber-400" />
                              <span className="truncate">
                                {docRecomendacaoPastoral ? docRecomendacaoPastoral.nome : 'Selecionar Arquivo (PDF/Foto)'}
                              </span>
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setDocRecomendacaoPastoral({ nome: file.name, url: URL.createObjectURL(file) });
                                  }
                                }}
                              />
                            </label>
                            {docRecomendacaoPastoral && (
                              <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" />
                                <span className="truncate">Arquivo anexado com sucesso</span>
                              </div>
                            )}
                          </div>

                          {/* 2. Ata de Indicação da Igreja */}
                          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                            <span className="text-[11px] font-bold text-white block">
                              2. Ata de Indicação da Igreja *
                            </span>
                            <label className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-slate-700 hover:border-amber-400 text-xs font-mono text-slate-400 hover:text-white cursor-pointer transition-colors bg-slate-900/60">
                              <Upload className="w-3.5 h-3.5 text-amber-400" />
                              <span className="truncate">
                                {docAtaIndicacao ? docAtaIndicacao.nome : 'Selecionar Arquivo (PDF/Foto)'}
                              </span>
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setDocAtaIndicacao({ nome: file.name, url: URL.createObjectURL(file) });
                                  }
                                }}
                              />
                            </label>
                            {docAtaIndicacao && (
                              <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" />
                                <span className="truncate">Arquivo anexado com sucesso</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {!docsProntos && (
                          <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-[11px] font-mono text-amber-200 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>Anexe a Carta de Recomendação e a Ata de Indicação para liberar o pagamento da ordenação.</span>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}

                {/* Botão de Prosseguir para Checkout */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setErroModal(null);
                      setEtapaModal('BUSCA_CPF');
                    }}
                    className="px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white text-xs font-mono font-bold cursor-pointer"
                  >
                    Voltar
                  </button>

                  {(() => {
                    const validacao = planoModalSelecionado ? validarElegibilidadeCargo(planoModalSelecionado, ministroModal.cargo) : { elegivel: false };
                    const nome = (planoModalSelecionado?.nome || '').toLowerCase();
                    const ehOrdenacao = nome.includes('ordena') || nome.includes('consagra') || ((planoModalSelecionado as any)?.categoria || '').toLowerCase().includes('ordena');
                    const podeAvancar = Boolean(planoModalSelecionado && validacao.elegivel && (!ehOrdenacao || (docRecomendacaoPastoral && docAtaIndicacao)));

                    return (
                      <div className="flex flex-col items-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (!planoModalSelecionado) {
                              setErroModal('Atenção: Por favor, escolha um dos planos elegíveis acima antes de avançar para o pagamento.');
                              return;
                            }
                            if (!validacao.elegivel) {
                              setErroModal(`Atenção: O plano ${planoModalSelecionado.nome} não é compatível com seu cargo (${ministroModal.cargo}). Por favor, escolha um plano compatível.`);
                              return;
                            }
                            if (ehOrdenacao && (!docRecomendacaoPastoral || !docAtaIndicacao)) {
                              setErroModal('Atenção: Para planos de ordenação, é obrigatório anexar a Carta de Recomendação e a Ata de Indicação antes de avançar.');
                              return;
                            }

                            setPlanoParaCheckout(planoModalSelecionado);
                            setMinistroSelecionadoId(ministroModal.id);
                            setEtapaModal('CHECKOUT_PAGAMENTO');
                          }}
                          className={`px-6 py-3.5 rounded-xl font-mono font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                            podeAvancar
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/30 cursor-pointer'
                              : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-pointer hover:border-amber-500/50'
                          }`}
                        >
                          <span>Avançar para Pagamento</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        {!planoModalSelecionado && (
                          <span className="text-[10px] font-mono text-amber-400">
                            * Selecione um plano acima para habilitar o pagamento
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* ETAPA 4: CHECKOUT OFICIAL REAL ASAAS (PRODUÇÃO)               */}
            {/* ============================================================== */}
            {etapaModal === 'CHECKOUT_PAGAMENTO' && planoParaCheckout && ministroModal && (
              <div className="p-2 sm:p-4">
                <CheckoutRealAgo
                  ministro={ministroModal}
                  plano={planoParaCheckout}
                  onVoltar={() => setEtapaModal('SELECAO_PLANOS')}
                  onConcluido={(dadosLiquidada) => {
                    setInscricaoJaRealizada(dadosLiquidada);
                    setEtapaModal('JA_INSCRITO');
                    try {
                      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
                    } catch {}
                  }}
                />
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Modal de Checkout Transacional Oficial Asaas */}
      {planoParaCheckout && ministroSelecionado && !modalBuscaCpfAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/90 backdrop-blur-lg overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-emerald-500/40 rounded-3xl shadow-2xl p-4 sm:p-8 space-y-6 relative my-auto max-h-[92vh] overflow-y-auto font-mono text-xs">
            <CheckoutRealAgo
              ministro={ministroSelecionado}
              plano={planoParaCheckout}
              onVoltar={() => setPlanoParaCheckout(null)}
              onConcluido={(dadosLiquidada) => {
                setPlanoParaCheckout(null);
                try {
                  confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
                } catch {}
              }}
            />
          </div>
        </div>
      )}

      {/* Modal Dedicado e Exclusivo de Regularização de Pendências (Inadimplência) */}
      {modalInadimplenciaAberto && ministroModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-xl overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="w-full max-w-2xl bg-slate-900 border-2 border-amber-500/50 rounded-3xl shadow-2xl p-5 sm:p-8 space-y-6 relative my-auto max-h-[92vh] overflow-y-auto text-white font-sans backdrop-blur-2xl"
          >
            {/* Botão Fechar Modal */}
            <button
              type="button"
              onClick={() => setModalInadimplenciaAberto(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer z-10"
              aria-label="Fechar Modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest block">
                  COMPLIANCE FINANCEIRO • CONCLAVE AGO 2026
                </span>
                <h3 className="text-lg font-black text-white">
                  Regularização de Pendências Obrigatória
                </h3>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 text-xs text-slate-300 space-y-2">
              <p className="leading-relaxed font-sans">
                Prezado(a) <strong className="text-white font-bold">{ministroModal?.nome}</strong> (CPF: {ministroModal?.cpf}), identificamos débitos pendentes em sua ficha ministerial. Para efetivar sua inscrição na AGO 2026, a quitação das taxas ou anuidades abaixo é necessária.
              </p>
            </div>

            <div className="space-y-3">
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider block">
                EXTRATO DE DÉBITOS VINCULADOS AO CPF:
              </span>
              <div className="space-y-2.5 max-h-44 overflow-y-auto pr-1">
                {pendenciasFinanceiras.map((anuidade) => (
                  <div
                    key={anuidade.id}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4 shadow-inner"
                  >
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-white block">
                        {anuidade.categoria === 'TAXA_CONVENCAO' ? 'Taxa de Filiação' : 'Anuidade Ministerial'} ({anuidade.anoVigente || '2026'})
                      </span>
                      <span className="text-[10px] font-mono text-rose-400">
                        Vencimento: {formatarDataBR(anuidade.dataVencimento) || 'Vencido'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-mono text-slate-400 uppercase block">VALOR:</span>
                      <span className="text-base font-mono font-black text-amber-400 tracking-tight">
                        {formatarMoeda(anuidade.valor || 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-2xl border border-emerald-500/40 shadow-xl">
              <CheckoutRealAgo
                ministro={ministroModal}
                plano={{
                  id: 'QUITACAO_PENDENCIAS',
                  codigo: 'QUITACAO',
                  nome: `Regularização de Taxas e Anuidades (${pendenciasFinanceiras.length} item(ns))`,
                  valor: totalDevidoAnuidades > 0 ? totalDevidoAnuidades : 150.00
                }}
                tituloCustomizado="Quitação de Pendências & Anuidades"
                subtituloCustomizado="ESTEIRA DE COMPLIANCE • ASAAS CORE BANKING"
                descricaoCustomizada={`Quitação de débitos e anuidades pendentes em nome de ${ministroModal?.nome} (${ministroModal?.cpf}).`}
                textoVoltarCustomizado="Voltar à Identificação"
                onVoltar={() => {
                  setModalInadimplenciaAberto(false);
                  setModalBuscaCpfAberto(true);
                }}
                onConcluido={async (dadosLiquidada) => {
                  try {
                    for (const pend of pendenciasFinanceiras) {
                      await liquidarAnuidadeImediata(db, pend.id, ministroModal.id);
                    }
                    addAuditLog(
                      'ANUIDADE_LIQUIDADA',
                      `Débitos de Filiação / Anuidade quitados via Checkout Real Asaas para o ministro ${ministroModal.nome}`,
                      ministroModal.tenantId || 't-sede-salvador'
                    );
                    try {
                      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
                    } catch {}
                    setModalInadimplenciaAberto(false);
                    setEtapaModal('SELECAO_PLANOS');
                    if (planoAlvo) {
                      setPlanoModalSelecionado(planoAlvo);
                    } else if (planos.length > 0) {
                      setPlanoModalSelecionado(planos[0]);
                    }
                    setModalBuscaCpfAberto(true);
                  } catch (err: any) {
                    console.error('Erro ao registrar quitação após pagamento:', err);
                  }
                }}
              />
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal do Crachá de Inscrição da AGO para Portaria (Baixável em PDF e Imagem com QR Code) */}
      {comprovanteVisualizar && (
        <CrachaCredencialAgoModal
          inscricao={comprovanteVisualizar}
          evento={agoConclave}
          ministro={
            ministroModal ||
            ministros.find(
              (m) =>
                m.id === comprovanteVisualizar.ministroId ||
                (m.cpf &&
                  comprovanteVisualizar.ministroCpf &&
                  m.cpf.replace(/\D/g, '') === comprovanteVisualizar.ministroCpf.replace(/\D/g, ''))
            )
          }
          onClose={() => setComprovanteVisualizar(null)}
        />
      )}
    </div>
  );
}

// ==========================================
// 8. PÁGINA: CONTATOS
// ==========================================
export function PortalContatos() {
  const { tenantAtivo, appConfig, igrejasFiliadas } = useSecurity();
  const igrejaSede = igrejasFiliadas.find((i) => i.chaveSede || i.tenantId === 't-sede-salvador') || igrejasFiliadas[0];
  const enderecoOficial = appConfig?.endereco || (igrejaSede?.logradouro ? `${igrejaSede.logradouro}, ${igrejaSede.numero || ''} - ${igrejaSede.municipio || 'Salvador'} - ${igrejaSede.uf || 'BA'}` : tenantAtivo.endereco);
  const telefoneOficial = appConfig?.telefoneConvencao || igrejaSede?.telefone || '+55 (71) 3322-8900 / 0800-CIMADEBE';
  const emailOficial = igrejaSede?.email || appConfig?.smtp?.remetenteEmail || 'secretaria@cimadebe.org.br';

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto">
      <div>
        <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider block">
          CANAIS DE ATENDIMENTO
        </span>
        <h2 className="text-3xl font-black text-white tracking-tight">
          Fale com a Secretaria Geral {appConfig?.sigla || 'CIMADEBE'}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white">Sede e Regionais</h3>
          <div className="space-y-3 text-xs text-slate-300 font-mono">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{enderecoOficial}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{telefoneOficial}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{emailOficial}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Segunda a Sexta, das 08h às 17h30</span>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3 text-xs">
          <h3 className="text-base font-bold text-white">Mensagem Criptografada</h3>
          <div>
            <label className="block text-slate-400 mb-1">Seu Nome / Cargo</label>
            <input
              type="text"
              placeholder="Ex: Pr. Carlos..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Email ou WhatsApp</label>
            <input
              type="text"
              placeholder="contato@exemplo.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Mensagem</label>
            <textarea
              rows={3}
              placeholder="Digite sua dúvida pastoral ou solicitação..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>
          <button
            type="button"
            className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all cursor-pointer"
          >
            Transmitir Mensagem
          </button>
        </div>
      </div>
    </div>
  );
}
