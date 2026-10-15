/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Componente: SiteInstitucional.tsx
 * Seções: Notícias Oficiais, História da CIMADEBE, e Botões de Acesso Rápido
 * Padrão: Conformidade Estrita com a Lei de Renderização Zero-Trust (Zero Dados Fictícios)
 * Design: Editorial Moderno, Clean Metadados sem Static Pills, Paleta Cyber Slate & Emerald
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSecurity } from '../SecurityContext';
import {
  Shield,
  ShieldCheck,
  Building2,
  BookOpen,
  Newspaper,
  User,
  KeyRound,
  ArrowRight,
  ExternalLink,
  Calendar,
  CheckCircle2,
  Award,
  Clock,
  FileText,
  Search,
  Sparkles,
  Users,
  Compass,
  Scroll,
  Layers,
  ChevronRight,
  X,
} from 'lucide-react';
import type { DbNoticia } from '../db/databaseService';

interface SiteInstitucionalProps {
  readonly onNavegar?: (pagina: string) => void;
  readonly onAbrirLogin?: () => void;
  readonly onValidarCredencial?: () => void;
}

export function SiteInstitucional({
  onNavegar,
  onAbrirLogin,
  onValidarCredencial,
}: SiteInstitucionalProps) {
  const { noticias: noticiasGlobais, ministros, igrejasFiliadas, cmsSettings, appConfig } = useSecurity();
  const igrejaSede = igrejasFiliadas.find((i) => i.chaveSede || i.tenantId === 't-sede-salvador') || igrejasFiliadas[0];
  const enderecoSede = appConfig?.endereco || (igrejaSede?.municipio ? `${igrejaSede.municipio} - ${igrejaSede.uf || 'BA'}` : 'Salvador - BA');

  // Estado para busca e filtro de notícias
  const [buscaNoticia, setBuscaNoticia] = useState<string>('');
  const [noticiaSelecionada, setNoticiaSelecionada] = useState<DbNoticia | null>(null);

  // Lista de notícias com estrita validação e filtragem
  const noticiasValidas = useMemo(() => {
    if (!noticiasGlobais || !Array.isArray(noticiasGlobais)) return [];
    return noticiasGlobais.filter((n) => n && typeof n === 'object' && n.titulo && String(n.titulo).trim().length > 0);
  }, [noticiasGlobais]);

  const noticiasFiltradas = useMemo(() => {
    if (!buscaNoticia.trim()) return noticiasValidas;
    const termo = buscaNoticia.toLowerCase().trim();
    return noticiasValidas.filter((n) => {
      const tit = (n.titulo || '').toLowerCase();
      const sub = (n.subtitulo || '').toLowerCase();
      const cat = (n.categoria || '').toLowerCase();
      return tit.includes(termo) || sub.includes(termo) || cat.includes(termo);
    });
  }, [noticiasValidas, buscaNoticia]);

  // Ações de navegação rápida
  const handleAcessoRapido = (destino: string) => {
    if (destino === 'login') {
      if (onAbrirLogin) {
        onAbrirLogin();
      } else if (onNavegar) {
        onNavegar('login');
      }
    } else if (destino === 'validacaoCredenciais') {
      if (onValidarCredencial) {
        onValidarCredencial();
      } else if (onNavegar) {
        onNavegar('validacaoCredenciais');
      }
    } else if (onNavegar) {
      onNavegar(destino);
    }
  };

  return (
    <div className="space-y-16 pb-16 font-sans text-slate-100">
      {/* ========================================================================= */}
      {/* 1. SEÇÃO HERO: IDENTIDADE OFICIAL & PROPÓSITO INSTITUCIONAL               */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40 border border-emerald-500/20 p-8 sm:p-12 lg:p-16 shadow-2xl backdrop-blur-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl space-y-6">
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Convenção Interestadual de Ministros e Igrejas</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
            Convenção CIMADEBE <span className="text-emerald-400">&</span> SIGM
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-3xl">
            A Convenção Interestadual de Ministros e Igrejas das Assembleias de Deus do Estado da Bahia e Extensão é uma instituição eclesiástica alicerçada na inerrância bíblica, na fraternidade pastoral e no rigor ético-administrativo. Por meio do Sistema Integrado de Governança Ministerial (SIGM), asseguramos transparência, autenticação segura e valorização de cada obreiro filiado.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400">
            <span>Sede Administrativa: {enderecoSede}</span>
            <span aria-hidden="true">·</span>
            <span>Jurisdição Interestadual</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-400">Registros Oficiais</span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. BOTÕES DE ACESSO RÁPIDO (CENTRAL DE SERVIÇOS & OPERAÇÕES)              */}
      {/* ========================================================================= */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider font-bold block mb-1">
              PORTAL DE OPERAÇÕES
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Acesso Rápido aos Serviços Oficiais
            </h2>
          </div>
          <p className="text-xs text-slate-400 max-w-md">
            Canais imediatos para membros, secretarias locais, delegados de AGO e validação pública de credenciais.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Espaço do Ministro */}
          <button
            type="button"
            onClick={() => handleAcessoRapido('login')}
            className="group p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/80 transition-all duration-200 text-left flex flex-col justify-between shadow-lg cursor-pointer"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                <User className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono text-slate-500 group-hover:text-emerald-400 flex items-center gap-1 transition-colors">
                Entrar <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
            <div>
              <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                Espaço Privado do Ministro
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Acesse sua ficha funcional, situação de adimplência, emissão de certidões e histórico ministerial.
              </p>
            </div>
          </button>

          {/* Card 2: Validação de Credencial */}
          {cmsSettings?.paginasVisiveis?.validacaoCredenciais !== false && (
            <button
              type="button"
              onClick={() => handleAcessoRapido('validacaoCredenciais')}
              className="group p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/80 transition-all duration-200 text-left flex flex-col justify-between shadow-lg cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <span className="text-xs font-mono text-slate-500 group-hover:text-cyan-400 flex items-center gap-1 transition-colors">
                  Verificar <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                  Validar Credencial Ministerial
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Verificação instantânea de autenticidade documental por QR Code ou matrícula registrada no SIGM.
                </p>
              </div>
            </button>
          )}

          {/* Card 3: Inscrições AGO */}
          {cmsSettings?.paginasVisiveis?.inscricaoAgo !== false && (
            <button
              type="button"
              onClick={() => handleAcessoRapido('inscricaoAgo')}
              className="group p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/80 transition-all duration-200 text-left flex flex-col justify-between shadow-lg cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
                  <Calendar className="w-6 h-6" />
                </div>
                <span className="text-xs font-mono text-slate-500 group-hover:text-amber-400 flex items-center gap-1 transition-colors">
                  Inscrição <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                  Inscrições da AGO
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Credenciamento de delegados, pastores e obreiros com emissão de crachá e certificação oficial.
                </p>
              </div>
            </button>
          )}

          {/* Card 4: Igrejas Filiadas */}
          {cmsSettings?.paginasVisiveis?.igrejasFiliadas !== false && (
            <button
              type="button"
              onClick={() => handleAcessoRapido('igrejasFiliadas')}
              className="group p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-teal-500/50 hover:bg-slate-800/80 transition-all duration-200 text-left flex flex-col justify-between shadow-lg cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="p-3 rounded-xl bg-teal-500/10 text-teal-400 group-hover:scale-110 transition-transform">
                  <Building2 className="w-6 h-6" />
                </div>
                <span className="text-xs font-mono text-slate-500 group-hover:text-teal-400 flex items-center gap-1 transition-colors">
                  Consultar <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors">
                  Igrejas Filiadas & Campos
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Relação eclesiástica dos templos e congregações devidamente integrados e homologados na Convenção.
                </p>
              </div>
            </button>
          )}

          {/* Card 5: Mesa Diretora */}
          {cmsSettings?.paginasVisiveis?.mesaDiretora !== false && (
            <button
              type="button"
              onClick={() => handleAcessoRapido('mesaDiretora')}
              className="group p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/80 transition-all duration-200 text-left flex flex-col justify-between shadow-lg cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                  <Award className="w-6 h-6" />
                </div>
                <span className="text-xs font-mono text-slate-500 group-hover:text-indigo-400 flex items-center gap-1 transition-colors">
                  Conhecer <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                  Mesa Diretora & Conselhos
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Composição oficial da liderança convencional, conselho fiscal, comissões de ética e doutrina.
                </p>
              </div>
            </button>
          )}

          {/* Card 6: Secretaria & Ouvidoria */}
          {cmsSettings?.paginasVisiveis?.contatos !== false && (
            <button
              type="button"
              onClick={() => handleAcessoRapido('contatos')}
              className="group p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/80 transition-all duration-200 text-left flex flex-col justify-between shadow-lg cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="text-xs font-mono text-slate-500 group-hover:text-emerald-400 flex items-center gap-1 transition-colors">
                  Contato <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Secretaria & Comunicação
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Atendimento institucional, solicitação de transferências, protocolos e envio de correspondências.
                </p>
              </div>
            </button>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. SEÇÃO: HISTÓRIA DA CIMADEBE (DOCUMENTAÇÃO HISTÓRICA E DOUTRINÁRIA)     */}
      {/* ========================================================================= */}
      <section className="space-y-10">
        <div className="border-b border-slate-800 pb-4">
          <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider font-bold block mb-1">
            MEMÓRIA & TRADIÇÃO
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            A História da Convenção CIMADEBE
          </h2>
        </div>

        {/* Narrativa Histórica em Blocos Editoriais */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-6 text-sm text-slate-300 leading-relaxed">
            <p>
              A <strong className="text-white">Convenção Interestadual de Ministros e Igrejas das Assembleias de Deus do Estado da Bahia e Extensão (CIMADEBE)</strong> nasceu do anseio de líderes e pastores comprometidos com a preservação da genuína fé pentecostal, com a ortodoxia bíblica e com a unidade do corpo pastoral assembleiano na Bahia e regiões fronteiriças.
            </p>
            <p>
              Historicamente estruturada para apoiar ministros em suas lutas cotidianas, a CIMADEBE consolidou-se como um referencial eclesiástico estável. A instituição atua na homologação de vocações, consagração ministerial, orientação jurídica de congregações filiadas e intercâmbio fraterno entre campos eclesiásticos soberanos.
            </p>
            <p>
              Com a evolução das demandas ministeriais e a necessidade de absoluta probidade na administração dos recursos do Reino, a CIMADEBE protagonizou um marco histórico ao adotar o <strong className="text-emerald-400">SIGM (Sistema Integrado de Governança Ministerial)</strong>. Essa integração unificou a tesouraria, o registro cadastral e a expedição de credenciais sob padrões criptográficos de alta confiabilidade, garantindo que a fé viva caminhe de mãos dadas com a integridade civil e fiscal.
            </p>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center gap-3 text-white font-bold text-sm">
                <Scroll className="w-5 h-5 text-emerald-400" />
                <span>Marcos Fundamentais da Nossa Trajetória</span>
              </div>

              <div className="space-y-4 text-xs text-slate-400 divide-y divide-slate-800">
                <div className="pt-3 first:pt-0">
                  <span className="font-mono text-emerald-400 font-bold block text-sm">Fundação e Chamado Fraternal</span>
                  <p className="mt-1 leading-normal text-slate-300">
                    Organização inicial de congregações históricas com foco na unidade pentecostal e zelo pastoral contínuo.
                  </p>
                </div>

                <div className="pt-3">
                  <span className="font-mono text-cyan-400 font-bold block text-sm">Expansão e Regionalização</span>
                  <p className="mt-1 leading-normal text-slate-300">
                    Acolhimento de ministérios em toda a Bahia e expansão para estados vizinhos mantendo a soberania das igrejas locais.
                  </p>
                </div>

                <div className="pt-3">
                  <span className="font-mono text-amber-400 font-bold block text-sm">Era Digital e Transparência SIGM</span>
                  <p className="mt-1 leading-normal text-slate-300">
                    Pioneirismo na modernização contábil, eliminação de caixas opacos e certificação digital instantânea de ministros.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pilares Institucionais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="p-2.5 w-fit rounded-xl bg-emerald-500/10 text-emerald-400 mb-4">
              <BookOpen className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Ortodoxia Doutrinária</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Fidelidade irrevogável às Sagradas Escrituras, defesa do avivamento genuíno e firmeza teológica sem concessões.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="p-2.5 w-fit rounded-xl bg-cyan-500/10 text-cyan-400 mb-4">
              <Users className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Comunhão & Suporte</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Assistência espiritual, respaldo eclesiástico e amparo contínuo à família pastoral em todas as circunstâncias.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="p-2.5 w-fit rounded-xl bg-teal-500/10 text-teal-400 mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Probidade Administrativa</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Prestação de contas clara em AGOs, conciliação em tempo real e rigor estatutário perante os órgãos de controle.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="p-2.5 w-fit rounded-xl bg-amber-500/10 text-amber-400 mb-4">
              <Compass className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Visão Missionária</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Apoio efetivo à plantação de igrejas, suporte aos obreiros de vanguarda e cooperação interdenominacional sadia.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. SEÇÃO: NOTÍCIAS & COMUNICADOS OFICIAIS (CONFORMIDADE ZERO-TRUST)       */}
      {/* ========================================================================= */}
      <section className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider font-bold block mb-1">
              COMUNICAÇÃO CONVENCIONAL
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Notícias, Editais & Comunicados
            </h2>
          </div>

          {/* Campo de Busca de Notícias */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={buscaNoticia}
              onChange={(e) => setBuscaNoticia(e.target.value)}
              placeholder="Pesquisar comunicados..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Lei de Renderização Estrita: Sem notícias fake ou placeholders */}
        {noticiasFiltradas.length === 0 ? (
          <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center space-y-3">
            <Newspaper className="w-8 h-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-300">
              Nenhuma publicação oficial no momento
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Os editais, deliberações da Mesa Diretora e comunicados de eventos serão listados aqui assim que registrados no sistema oficial.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {noticiasFiltradas.map((noticia) => {
              const temBanner = Boolean(noticia.banner_url);
              const bannerSrc = String(noticia.banner_url || '');
              const categoria = String(noticia.categoria || '').trim();
              const titulo = String(noticia.titulo || '').trim();
              const subtitulo = String(noticia.subtitulo || '').trim();
              const dataPublicacao = String(noticia.data_publicacao || noticia.criado_em || '').trim();

              return (
                <article
                  key={noticia.id}
                  onClick={() => setNoticiaSelecionada(noticia)}
                  className="rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 transition-all duration-200 overflow-hidden flex flex-col justify-between group cursor-pointer shadow-lg hover:-translate-y-1"
                >
                  {/* Banner condicional estrito: sem imagem fake se ausente */}
                  {temBanner && (
                    <div className="w-full h-48 overflow-hidden relative bg-slate-950">
                      <img
                        src={bannerSrc}
                        alt={titulo}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                  )}

                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      {/* Metadados limpos sem static pills (Separadores tipográficos) */}
                      <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                        {categoria && <span className="text-emerald-400 font-bold uppercase">{categoria}</span>}
                        {categoria && dataPublicacao && <span aria-hidden="true">·</span>}
                        {dataPublicacao && <span>{dataPublicacao}</span>}
                      </div>

                      {titulo && (
                        <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
                          {titulo}
                        </h3>
                      )}

                      {subtitulo && (
                        <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                          {subtitulo}
                        </p>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 group-hover:text-emerald-400">
                      <span className="font-semibold">Ler comunicado completo</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* MODAL: VISUALIZAÇÃO COMPLETA DA NOTÍCIA SELECIONADA                       */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {noticiaSelecionada && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => setNoticiaSelecionada(null)}
                className="absolute top-6 right-6 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Banner se houver */}
              {Boolean(noticiaSelecionada.banner_url) && (
                <div className="w-full h-56 rounded-2xl overflow-hidden bg-slate-950">
                  <img
                    src={String(noticiaSelecionada.banner_url)}
                    alt={String(noticiaSelecionada.titulo || '')}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                  {noticiaSelecionada.categoria && (
                    <span className="text-emerald-400 font-bold uppercase">{noticiaSelecionada.categoria}</span>
                  )}
                  {noticiaSelecionada.categoria && (noticiaSelecionada.data_publicacao || noticiaSelecionada.criado_em) && <span aria-hidden="true">·</span>}
                  {(noticiaSelecionada.data_publicacao || noticiaSelecionada.criado_em) && <span>{noticiaSelecionada.data_publicacao || noticiaSelecionada.criado_em}</span>}
                </div>

                {noticiaSelecionada.titulo && (
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {noticiaSelecionada.titulo}
                  </h2>
                )}

                {noticiaSelecionada.subtitulo && (
                  <p className="text-sm font-medium text-slate-300">
                    {noticiaSelecionada.subtitulo}
                  </p>
                )}
              </div>

              {/* Corpo da notícia */}
              {noticiaSelecionada.conteudo && (
                <div className="text-sm text-slate-300 leading-relaxed space-y-4 border-t border-slate-800 pt-4 whitespace-pre-line">
                  {noticiaSelecionada.conteudo}
                </div>
              )}

              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setNoticiaSelecionada(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Fechar Publicação
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
export default SiteInstitucional;
