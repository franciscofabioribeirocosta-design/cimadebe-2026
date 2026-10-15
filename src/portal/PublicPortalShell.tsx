/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Shell do Portal Público Dinâmico Controlado por CMS
 * Estética Neofintech: Paleta Slate, Navy Blue e Emerald, Glassmorphism e Efeitos Neon
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSecurity } from '../SecurityContext';
import type { CmsPaginasVisiveis, IgrejaFiliada } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { CmsInterceptionGuard } from './CmsInterceptionGuard';
import { CredentialValidationScanner } from './CredentialValidationScanner';
import { ValidacaoPublicaDoc } from './ValidacaoPublicaDoc';
import { PublicCredentialVerification } from './PublicCredentialVerification';
import { SiteInstitucional } from './SiteInstitucional';
import {
  PortalHome,
  PortalQuemSomos,
  PortalMesaDiretora,
  PortalIgrejasFiliadas,
  PortalEventos,
  PortalNoticias,
  PortalInscricaoAgo,
  PortalContatos,
} from './PortalPages';
import {
  Shield,
  ShieldCheck,
  Building2,
  Users,
  Calendar,
  Newspaper,
  Phone,
  Scan,
  QrCode,
  Cpu,
  Layers,
  Sparkles,
  Lock,
  ArrowRight,
  ExternalLink,
  SlidersHorizontal,
  Receipt,
  Menu,
  X,
  ChevronRight,
  Printer,
} from 'lucide-react';
import { type DbEvento, type DbNoticia } from '../db/databaseService';

interface PublicPortalShellProps {
  readonly onAlternarParaAdmin?: (aba?: string) => void;
  readonly onAbrirLogin?: () => void;
  readonly onAbrirSetup?: () => void;
  readonly onResetarSetup?: () => void;
  readonly estiloTema?: 'vidro-fosco' | 'classico';
  readonly onAlternarTema?: () => void;
}

export function PublicPortalShell({
  onAlternarParaAdmin,
  onAbrirLogin,
  onAbrirSetup,
  onResetarSetup,
  estiloTema: estiloTemaProp,
  onAlternarTema: onAlternarTemaProp,
}: PublicPortalShellProps) {
  const { cmsSettings, tenantAtivo, tenants, alternarTenant, eventos: eventosGlobal, noticias: noticiasGlobal, igrejasFiliadas: igrejasGlobal, usuariosAdministrativos, esvaziarFinanceiroEUsuarios, appConfig } = useSecurity();
  const [paginaAtiva, setPaginaAtiva] = useState<keyof CmsPaginasVisiveis>('home');
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [eventoModal, setEventoModal] = useState<DbEvento | null>(null);
  const [noticiaModal, setNoticiaModal] = useState<DbNoticia | null>(null);

  const [tipoValidacao, setTipoValidacao] = useState<'DOCUMENTO_QR' | 'CREDENCIAL'>('DOCUMENTO_QR');
  const [estiloTemaLocal, setEstiloTemaLocal] = useState<'vidro-fosco' | 'classico'>('vidro-fosco');

  const estiloTema = estiloTemaProp || estiloTemaLocal;
  const alternarTema = onAlternarTemaProp || (() => {
    const proximo = estiloTema === 'vidro-fosco' ? 'classico' : 'vidro-fosco';
    setEstiloTemaLocal(proximo);
    try {
      if (proximo === 'vidro-fosco') {
        document.documentElement.classList.add('theme-glass-frosted');
      } else {
        document.documentElement.classList.remove('theme-glass-frosted');
      }
    } catch {}
  });

  useEffect(() => {
    try {
      if (estiloTema === 'vidro-fosco') {
        document.documentElement.classList.add('theme-glass-frosted');
      } else {
        document.documentElement.classList.remove('theme-glass-frosted');
      }
    } catch {}
  }, [estiloTema]);

  // Regra Zero-Trust & Imutabilidade: Consome exclusivamente do listener centralizado do Firestore (Zero Mocks)
  const listaEventos = eventosGlobal || [];
  const listaNoticias = noticiasGlobal || [];
  const listaIgrejas = igrejasGlobal || [];

  const itensMenu: {
    chave: keyof CmsPaginasVisiveis;
    rotulo: string;
    icone: React.ComponentType<{ className?: string }>;
  }[] = useMemo(() => [
    { chave: 'home', rotulo: 'Início', icone: Sparkles },
    { chave: 'quemSomos', rotulo: 'Quem Somos', icone: Users },
    { chave: 'mesaDiretora', rotulo: 'Mesa Diretora', icone: ShieldCheck },
    { chave: 'igrejasFiliadas', rotulo: 'Igrejas Filiadas', icone: Building2 },
    { chave: 'inscricaoAgo', rotulo: 'Inscrição AGO', icone: Calendar },
    { chave: 'eventos', rotulo: 'Eventos', icone: Calendar },
    { chave: 'noticias', rotulo: 'Notícias', icone: Newspaper },
    { chave: 'validacaoCredenciais', rotulo: 'Terminal Laser Scanner', icone: Scan },
    { chave: 'contatos', rotulo: 'Contatos', icone: Phone },
  ], []);

  // Oculta estritamente menus desativados pelo CMS
  const itensMenuVisiveis = useMemo(() => {
    return itensMenu.filter((item) => cmsSettings?.paginasVisiveis?.[item.chave] !== false);
  }, [itensMenu, cmsSettings?.paginasVisiveis]);

  // Se a página atualmente aberta for desativada no CMS, redireciona suavemente para 'home'
  useEffect(() => {
    if (cmsSettings?.paginasVisiveis && cmsSettings.paginasVisiveis[paginaAtiva] === false) {
      setPaginaAtiva('home');
    }
  }, [paginaAtiva, cmsSettings?.paginasVisiveis]);

  return (
    <div className={`min-h-screen w-full max-w-full overflow-x-hidden bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black transition-colors duration-300 ${estiloTema === 'vidro-fosco' ? 'theme-glass-frosted' : ''}`}>
      {/* Top Cyber Neofintech Navbar */}
      <header className="sticky top-0 z-40 border-b border-emerald-500/20 bg-slate-950/85 backdrop-blur-xl w-full">
        {/* Linha de Gradiente Superior */}
        <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          {/* Logo Institucional */}
          <div
            onClick={() => setPaginaAtiva('home')}
            className="flex items-center gap-3 cursor-pointer group min-w-0"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shrink-0 overflow-hidden">
              {appConfig?.logomarca ? (
                <img src={appConfig.logomarca} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Shield className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                  PORTAL OFICIAL
                </span>
              </div>
              <h1 className="text-base font-black tracking-tight text-white group-hover:text-emerald-300 transition-colors truncate">
                {appConfig?.nomeConvencao || 'CIMADEBE'} <span className="text-slate-400 font-normal">/ {appConfig?.sigla || 'SIGM'}</span>
              </h1>
            </div>
          </div>

          {/* Acesso Institucional, Seletor de Tema & Login */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Seletor de Tema: Vidro Fosco Pronunciado vs Clássico */}
            <button
              type="button"
              onClick={alternarTema}
              title={
                estiloTema === 'vidro-fosco'
                  ? 'Modo Ativo: Vidro Fosco Pronunciado (Clique para alternar para o Neofintech Clássico)'
                  : 'Modo Ativo: Neofintech Clássico (Clique para alternar para Vidro Fosco Pronunciado)'
              }
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer shadow-md bg-slate-900/90 border-emerald-500/30 text-emerald-300 hover:bg-slate-800 hover:border-emerald-400"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">
                {estiloTema === 'vidro-fosco' ? 'Vidro Fosco' : 'Clássico'}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                {estiloTema === 'vidro-fosco' ? 'FROSTED' : 'STD'}
              </span>
            </button>

            {/* Badge Institucional da Convenção */}
            <div className="hidden lg:flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl py-1.5 px-3 text-xs">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-slate-200">
                Convenção Estadual • Igrejas & Ministros
              </span>
            </div>

            {/* Botão Hamburguer Mobile */}
            <button
              onClick={() => setMenuMobileAberto(!menuMobileAberto)}
              className="md:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
              aria-label="Abrir Menu Mobile"
            >
              {menuMobileAberto ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Menu Mobile Expandido */}
        {menuMobileAberto && (
          <div className="md:hidden border-t border-slate-800/80 bg-slate-950/95 px-4 py-3 space-y-1 animate-fadeIn">
            {itensMenuVisiveis.map((item) => {
              const estaAtivo = paginaAtiva === item.chave;
              const Icone = item.icone;

              return (
                <button
                  key={item.chave}
                  onClick={() => {
                    setPaginaAtiva(item.chave);
                    setMenuMobileAberto(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    estaAtivo
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icone className={`w-4 h-4 ${estaAtivo ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.rotulo}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Barra de Navegação Horizontal das Páginas Dinâmicas - Em linha única */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-800/80 overflow-x-auto py-2">
          <nav className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap min-w-max">
            {itensMenuVisiveis.map((item) => {
              const estaAtivo = paginaAtiva === item.chave;
              const Icone = item.icone;

              return (
                <button
                  key={item.chave}
                  onClick={() => setPaginaAtiva(item.chave)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    estaAtivo
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
                  }`}
                >
                  <Icone className={`w-3.5 h-3.5 ${estaAtivo ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.rotulo}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Conteúdo Principal com Intercepção Dinâmica do CMS e Transições Fluidas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={paginaAtiva}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full"
          >
            {paginaAtiva === 'home' && (
          <CmsInterceptionGuard
            paginaKey="home"
            tituloPagina="Página Inicial / Dashboard"
            onIrParaHome={() => setPaginaAtiva('home')}
          >
            <div className="space-y-16">
              <PortalHome
                onNavegar={(p) => setPaginaAtiva(p as keyof CmsPaginasVisiveis)}
                onAbrirLogin={onAbrirLogin || (() => onAlternarParaAdmin && onAlternarParaAdmin('login'))}
              />

              {/* SEÇÃO DINÂMICA 1: EVENTOS OFICIAIS (CONSUMINDO SECURITYCONTEXT EM TEMPO REAL) */}
              <section className="space-y-6 pt-6 border-t border-slate-800/80">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-mono text-xs font-bold tracking-wider uppercase">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="w-2 h-2 rounded-full bg-emerald-400 -ml-3.5" />
                      <span>SINCRONIZAÇÃO EM TEMPO REAL • CORE BANKING</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                      <Calendar className="w-7 h-7 text-emerald-400" />
                      <span>Agenda & Próximos Eventos Oficiais</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
                      Eventos, convenções estaduais e simpósios eclesiásticos cadastrados e atualizados em tempo real pela secretaria geral.
                    </p>
                  </div>

                  <button
                    onClick={() => setPaginaAtiva('eventos')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-400 font-bold text-xs hover:border-emerald-500/40 transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto font-mono"
                  >
                    <span>Ver Todos os Eventos ({listaEventos.length})</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {listaEventos.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
                    <Calendar className="w-10 h-10 text-slate-600 mx-auto" />
                    <p className="text-sm font-semibold text-slate-300">Nenhum evento registrado no momento.</p>
                    <p className="text-xs text-slate-500 font-mono">Novos eventos cadastrados no painel administrativo aparecerão aqui instantaneamente via Firestore onSnapshot.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {listaEventos.slice(0, 3).map((evento, idx) => (
                      <div
                        key={evento.id ? `${evento.id}-${idx}` : `evt-${idx}`}
                        className="rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition-all overflow-hidden shadow-xl flex flex-col justify-between group backdrop-blur-sm"
                      >
                        <div>
                          <div className="w-full h-48 relative overflow-hidden bg-slate-950">
                            <img
                              src={evento.banner_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=600&q=80'}
                              alt={evento.titulo}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                            <div className="absolute top-3 left-3 flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-400 font-mono text-[10px] font-bold shadow-lg">
                                {evento.status || 'ATIVO'}
                              </span>
                            </div>
                            <div className="absolute bottom-3 left-3 right-3 text-[11px] font-mono text-cyan-300 font-semibold flex items-center gap-1.5 drop-shadow">
                              <span>📅 {evento.data_evento ? new Date(evento.data_evento).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Data a confirmar'}</span>
                            </div>
                          </div>

                          <div className="p-5 space-y-2.5">
                            <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
                              {evento.titulo}
                            </h3>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                              <span>📍</span>
                              <span className="truncate">{evento.local}</span>
                            </div>
                            {evento.subtitulo && (
                              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                                {evento.subtitulo}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="p-5 pt-0">
                          <button
                            onClick={() => setEventoModal(evento)}
                            className="w-full py-2.5 rounded-xl bg-slate-800/90 hover:bg-emerald-600 hover:text-white text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer font-mono border border-slate-700 hover:border-emerald-500 shadow"
                          >
                            <span>Ver Detalhes do Evento</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* SEÇÃO DINÂMICA 2: NOTÍCIAS & COMUNICADOS (CONSUMINDO ESTADO EM TEMPO REAL ON-SNAPSHOT) */}
              <section className="space-y-6 pt-6 border-t border-slate-800/80">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 font-mono text-xs font-bold tracking-wider uppercase">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      <span className="w-2 h-2 rounded-full bg-cyan-400 -ml-3.5" />
                      <span>FEED AO VIVO • FIRESTORE ONSNAPSHOT ATIVO</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                      <Newspaper className="w-7 h-7 text-cyan-400" />
                      <span>Últimas Notícias & Comunicados da Convenção</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
                      Publicações oficiais, decisões da Mesa Diretora e relatórios de campo sincronizados instantaneamente a partir do banco de dados relacional e Firestore.
                    </p>
                  </div>

                  <button
                    onClick={() => setPaginaAtiva('noticias')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-400 font-bold text-xs hover:border-cyan-500/40 transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto font-mono"
                  >
                    <span>Ver Todas as Notícias ({listaNoticias.length})</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {listaNoticias.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
                    <Newspaper className="w-10 h-10 text-slate-600 mx-auto" />
                    <p className="text-sm font-semibold text-slate-300">Nenhuma notícia publicada no momento.</p>
                    <p className="text-xs text-slate-500 font-mono">Qualquer nova matéria cadastrada no painel administrativo será exibida aqui instantaneamente via Firestore onSnapshot.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {listaNoticias.slice(0, 3).map((noticia, idx) => (
                      <div
                        key={noticia.id ? `${noticia.id}-${idx}` : `not-${idx}`}
                        className="rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 transition-all overflow-hidden shadow-xl flex flex-col justify-between group backdrop-blur-sm"
                      >
                        <div>
                          <div className="w-full h-48 relative overflow-hidden bg-slate-950">
                            <img
                              src={noticia.banner_url || 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=600&q=80'}
                              alt={noticia.titulo}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                            <div className="absolute top-3 left-3 flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full bg-cyan-950/90 border border-cyan-500/50 text-cyan-400 font-mono text-[10px] font-bold shadow-lg">
                                {noticia.categoria || 'OFICIAL'}
                              </span>
                            </div>
                            <div className="absolute bottom-3 left-3 right-3 text-[11px] font-mono text-slate-300 flex items-center justify-between drop-shadow">
                              <span>✍️ {noticia.autor || 'Secretaria Geral'}</span>
                              <span>📅 {noticia.data_publicacao ? new Date(noticia.data_publicacao).toLocaleDateString('pt-BR') : 'Hoje'}</span>
                            </div>
                          </div>

                          <div className="p-5 space-y-2.5">
                            <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-2">
                              {noticia.titulo}
                            </h3>
                            <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                              {noticia.subtitulo || noticia.conteudo}
                            </p>
                          </div>
                        </div>

                        <div className="p-5 pt-0">
                          <button
                            onClick={() => setNoticiaModal(noticia)}
                            className="w-full py-2.5 rounded-xl bg-slate-800/90 hover:bg-cyan-600 hover:text-white text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer font-mono border border-slate-700 hover:border-cyan-500 shadow"
                          >
                            <span>Ler Notícia Completa</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </CmsInterceptionGuard>
        )}

        {paginaAtiva === 'quemSomos' && (
          <CmsInterceptionGuard
            paginaKey="quemSomos"
            tituloPagina="Quem Somos"
            onIrParaHome={() => setPaginaAtiva('home')}
          >
            <SiteInstitucional
              onNavegar={(pg) => {
                if (pg === 'login') {
                  onAbrirLogin?.();
                } else if (pg === 'validacaoCredenciais') {
                  setPaginaAtiva('validacaoCredenciais');
                } else {
                  setPaginaAtiva(pg as any);
                }
              }}
              onAbrirLogin={onAbrirLogin}
              onValidarCredencial={() => setPaginaAtiva('validacaoCredenciais')}
            />
          </CmsInterceptionGuard>
        )}

        {paginaAtiva === 'mesaDiretora' && (
          <CmsInterceptionGuard
            paginaKey="mesaDiretora"
            tituloPagina="Mesa Diretora"
            onIrParaHome={() => setPaginaAtiva('home')}
          >
            <PortalMesaDiretora />
          </CmsInterceptionGuard>
        )}

        {paginaAtiva === 'igrejasFiliadas' && (
          <CmsInterceptionGuard
            paginaKey="igrejasFiliadas"
            tituloPagina="Igrejas Filiadas"
            onIrParaHome={() => setPaginaAtiva('home')}
          >
            <PortalIgrejasFiliadas igrejasProp={listaIgrejas} />
          </CmsInterceptionGuard>
        )}

        {paginaAtiva === 'inscricaoAgo' && (
          <CmsInterceptionGuard
            paginaKey="inscricaoAgo"
            tituloPagina="Inscrição na AGO 2026"
            onIrParaHome={() => setPaginaAtiva('home')}
          >
            <PortalInscricaoAgo onNavegar={(p) => setPaginaAtiva(p as keyof CmsPaginasVisiveis)} />
          </CmsInterceptionGuard>
        )}

        {paginaAtiva === 'eventos' && (
          <CmsInterceptionGuard
            paginaKey="eventos"
            tituloPagina="Calendário de Eventos"
            onIrParaHome={() => setPaginaAtiva('home')}
          >
            <PortalEventos eventosProp={listaEventos} />
          </CmsInterceptionGuard>
        )}

        {paginaAtiva === 'noticias' && (
          <CmsInterceptionGuard
            paginaKey="noticias"
            tituloPagina="Notícias & Comunicados"
            onIrParaHome={() => setPaginaAtiva('home')}
          >
            <PortalNoticias noticiasProp={listaNoticias} />
          </CmsInterceptionGuard>
        )}

        {paginaAtiva === 'validacaoCredenciais' && (
          <CmsInterceptionGuard
            paginaKey="validacaoCredenciais"
            tituloPagina="Portal Público de Validação & Scanner"
            onIrParaHome={() => setPaginaAtiva('home')}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-center gap-2 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 max-w-md mx-auto shadow-lg">
                <button
                  type="button"
                  onClick={() => setTipoValidacao('DOCUMENTO_QR')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    tipoValidacao === 'DOCUMENTO_QR'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>Documentos Oficiais (QR Code)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTipoValidacao('CREDENCIAL')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    tipoValidacao === 'CREDENCIAL'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Scan className="w-4 h-4" />
                  <span>Terminal Laser (Portaria, Crachás & 3D)</span>
                </button>
              </div>

              {tipoValidacao === 'DOCUMENTO_QR' ? (
                <CredentialValidationScanner modoInicial="DOCUMENTOS_OFICIAIS" />
              ) : (
                <CredentialValidationScanner modoInicial="PORTARIA_CRACHAS" />
              )}
            </div>
          </CmsInterceptionGuard>
        )}

        {paginaAtiva === 'contatos' && (
          <CmsInterceptionGuard
            paginaKey="contatos"
            tituloPagina="Canais de Contato"
            onIrParaHome={() => setPaginaAtiva('home')}
          >
            <PortalContatos />
          </CmsInterceptionGuard>
        )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer Neofintech */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-400 font-semibold">{appConfig?.sigla || 'CIMADEBE'} / SIGM v5.0</span>
            <span>— Gestão Eclesiástica & Ministerial</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>{appConfig?.nomeConvencao || 'CIMADEBE'} • Filiação de Igrejas & Ministros</span>
            <span>•</span>
            <button
              onClick={() => {
                if (onAbrirLogin) {
                  onAbrirLogin();
                } else if (onAlternarParaAdmin) {
                  onAlternarParaAdmin('login');
                }
              }}
              className="text-emerald-400 hover:underline cursor-pointer"
            >
              Entrar
            </button>
          </div>
        </div>
      </footer>

      {/* Modal de Detalhes do Evento em Tempo Real */}
      {eventoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="max-w-2xl w-full rounded-3xl bg-slate-900 border border-emerald-500/40 shadow-2xl overflow-hidden my-8">
            <div className="relative h-64 sm:h-80 w-full overflow-hidden bg-slate-950">
              <img
                src={eventoModal.banner_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&h=600&q=80'}
                alt={eventoModal.titulo}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
              <button
                onClick={() => setEventoModal(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-slate-950/80 text-white hover:bg-emerald-600 transition-colors cursor-pointer border border-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute bottom-4 left-6 right-6">
                <span className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-mono text-xs font-bold">
                  {eventoModal.status || 'ATIVO'}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white mt-2 drop-shadow">{eventoModal.titulo}</h3>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono">
                <div>
                  <span className="text-slate-500 uppercase block">Data Oficial</span>
                  <span className="text-white font-bold">{eventoModal.data_evento ? new Date(eventoModal.data_evento).toLocaleString('pt-BR') : 'Data não informada'}</span>
                </div>
                <div>
                  <span className="text-slate-500 uppercase block">Local</span>
                  <span className="text-emerald-400 font-bold">{eventoModal.local}</span>
                </div>
              </div>

              {eventoModal.subtitulo && (
                <p className="text-sm font-semibold text-slate-200 italic">{eventoModal.subtitulo}</p>
              )}

              <div className="text-sm text-slate-300 leading-relaxed space-y-3 whitespace-pre-line">
                {eventoModal.descricao || 'Nenhum detalhe adicional informado.'}
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  onClick={() => setEventoModal(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Leitura de Notícia em Tempo Real */}
      {noticiaModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="max-w-2xl w-full rounded-3xl bg-slate-900 border border-cyan-500/40 shadow-2xl overflow-hidden my-8">
            <div className="relative h-64 sm:h-80 w-full overflow-hidden bg-slate-950">
              <img
                src={noticiaModal.banner_url || 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&h=600&q=80'}
                alt={noticiaModal.titulo}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
              <button
                onClick={() => setNoticiaModal(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-slate-950/80 text-white hover:bg-cyan-600 transition-colors cursor-pointer border border-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute bottom-4 left-6 right-6">
                <span className="px-3 py-1 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-mono text-xs font-bold">
                  {noticiaModal.categoria || 'COMUNICADO OFICIAL'}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white mt-2 drop-shadow">{noticiaModal.titulo}</h3>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-3">
                <span>✍️ Autor: <strong className="text-white">{noticiaModal.autor || 'Secretaria Geral'}</strong></span>
                <span>📅 {noticiaModal.data_publicacao ? new Date(noticiaModal.data_publicacao).toLocaleDateString('pt-BR') : 'Hoje'}</span>
              </div>

              {noticiaModal.subtitulo && (
                <p className="text-sm font-semibold text-slate-200 italic">{noticiaModal.subtitulo}</p>
              )}

              <div className="text-sm text-slate-300 leading-relaxed space-y-3 whitespace-pre-line">
                {noticiaModal.conteudo || 'Nenhum conteúdo adicional informado.'}
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  onClick={() => setNoticiaModal(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botão Flutuante de Acesso Rápido ao Sistema */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => {
            if (onAbrirLogin) {
              onAbrirLogin();
            } else if (onAlternarParaAdmin) {
              onAlternarParaAdmin('login');
            }
          }}
          className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs shadow-[0_0_25px_rgba(16,185,129,0.5)] hover:shadow-[0_0_35px_rgba(6,182,212,0.7)] transition-all cursor-pointer group hover:scale-105"
        >
          <Lock className="w-4 h-4 text-slate-950 group-hover:rotate-12 transition-transform" />
          <span>Entrar</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
