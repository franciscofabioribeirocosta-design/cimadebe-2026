import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Newspaper,
  Calendar,
  MapPin,
  Clock,
  User,
  Share2,
  ChevronRight,
  Search,
  X,
  Printer,
  Bell,
  BookOpen,
  Database,
  CalendarCheck2
} from 'lucide-react';
import { DbEvento, DbNoticia } from '../db/databaseService';
import { formatarDataBR } from '../financialEngine';

interface NoticiasEventosMinistroProps {
  readonly noticias?: readonly DbNoticia[];
  readonly eventos?: readonly DbEvento[];
}

export const NoticiasEventosMinistro: React.FC<NoticiasEventosMinistroProps> = ({
  noticias = [],
  eventos = []
}) => {
  const [filtroTipo, setFiltroTipo] = useState<'TODOS' | 'NOTICIAS' | 'EVENTOS'>('TODOS');
  const [busca, setBusca] = useState<string>('');
  const [noticiaSelecionada, setNoticiaSelecionada] = useState<DbNoticia | null>(null);
  const [eventoSelecionado, setEventoSelecionado] = useState<DbEvento | null>(null);
  const [compartilhadoFeedback, setCompartilhadoFeedback] = useState<boolean>(false);

  // Lista de Notícias Ativas vindas estritamente do Banco de Dados
  const listaNoticias = useMemo(() => {
    if (!noticias || noticias.length === 0) return [];
    return noticias.filter((n) => n.status === 'PUBLICADO' && !n.deletado);
  }, [noticias]);

  // Lista de Eventos Ativos vindos estritamente do Banco de Dados
  const listaEventos = useMemo(() => {
    if (!eventos || eventos.length === 0) return [];
    return eventos.filter((e) => e.status === 'ATIVO' && !e.deletado);
  }, [eventos]);

  // Itens filtrados com base no texto de busca
  const noticiasFiltradas = useMemo(() => {
    if (!busca.trim()) return listaNoticias;
    const b = busca.toLowerCase();
    return listaNoticias.filter(
      (n) =>
        n.titulo?.toLowerCase().includes(b) ||
        n.subtitulo?.toLowerCase().includes(b) ||
        n.categoria?.toLowerCase().includes(b) ||
        n.conteudo?.toLowerCase().includes(b)
    );
  }, [listaNoticias, busca]);

  const eventosFiltrados = useMemo(() => {
    if (!busca.trim()) return listaEventos;
    const b = busca.toLowerCase();
    return listaEventos.filter(
      (e) =>
        e.titulo?.toLowerCase().includes(b) ||
        e.subtitulo?.toLowerCase().includes(b) ||
        e.local?.toLowerCase().includes(b) ||
        e.tema_biblico?.toLowerCase().includes(b)
    );
  }, [listaEventos, busca]);

  const copiarLink = (texto: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(texto);
      setCompartilhadoFeedback(true);
      setTimeout(() => setCompartilhadoFeedback(false), 2500);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn font-sans">
      {/* Header com Banner Tecnológico Neofintech */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-amber-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest bg-amber-500/10 border border-amber-500/40 text-amber-400 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                COMUNICADOS & AGENDA OFICIAL
              </span>
              <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 flex items-center gap-1.5">
                <Database className="w-3 h-3 text-cyan-400" />
                FIRESTORE REAL-TIME
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Notícias, Editais & Eventos Convencionais
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Informativos oficiais da Mesa Diretora, editais de convocação da Assembleia Geral Ordinária (AGO), simpósios teológicos e cruzadas regionais sincronizados diretamente do banco de dados.
            </p>
          </div>

          {/* Estatísticas Rápidas */}
          <div className="flex items-center gap-3">
            <div className="px-4 py-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-[100px]">
              <span className="text-xl font-mono font-black text-amber-400 block">{listaNoticias.length}</span>
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Notícias</span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-[100px]">
              <span className="text-xl font-mono font-black text-emerald-400 block">{listaEventos.length}</span>
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Eventos</span>
            </div>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="mt-6 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
          {/* Botões de Filtro */}
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'TODOS', label: 'Todos os Registros' },
              { id: 'EVENTOS', label: 'Eventos & Congressos' },
              { id: 'NOTICIAS', label: 'Notícias & Editais' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltroTipo(f.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                  filtroTipo === f.id
                    ? 'bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.3)] font-black'
                    : 'bg-slate-950/80 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Campo de Busca */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar registros no banco..."
              className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 font-mono transition-colors"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SEÇÃO 1: EVENTOS CONVENCIONAIS CADASTRADOS NO BANCO */}
      {(filtroTipo === 'TODOS' || filtroTipo === 'EVENTOS') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck2 className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-black text-white tracking-wide">
                Agenda Oficial de Eventos da Convenção
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {eventosFiltrados.length} evento(s) no banco
            </span>
          </div>

          {eventosFiltrados.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 text-center space-y-2">
              <Calendar className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs font-mono text-slate-400">Nenhum evento cadastrado no banco de dados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {eventosFiltrados.map((evento) => (
                <div
                  key={evento.id}
                  className="rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 transition-all duration-300 overflow-hidden flex flex-col group shadow-xl hover:shadow-[0_10px_30px_rgba(245,158,11,0.1)]"
                >
                  {/* Banner do Evento */}
                  <div className="h-44 w-full relative overflow-hidden bg-slate-950">
                    <img
                      src={evento.banner_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80'}
                      alt={evento.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                    {/* Badge de Data */}
                    <div className="absolute top-4 left-4 px-3.5 py-1.5 rounded-xl bg-slate-950/90 border border-amber-500/50 shadow-lg flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-mono font-black text-amber-300">
                        {formatarDataBR(evento.data_evento)}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-[10px] font-mono font-black text-emerald-400 uppercase tracking-widest">
                      OFICIAL (BANCO)
                    </div>
                  </div>

                  {/* Informações do Evento */}
                  <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <h4 className="text-lg font-black text-white group-hover:text-amber-400 transition-colors">
                        {evento.titulo}
                      </h4>
                      {evento.subtitulo && (
                        <p className="text-xs font-mono text-slate-300">{evento.subtitulo}</p>
                      )}

                      {evento.tema_biblico && (
                        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-amber-500/20 text-xs font-mono text-amber-300/90 flex items-start gap-2">
                          <BookOpen className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <span className="italic">{evento.tema_biblico}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs font-mono text-slate-400 pt-1">
                        <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="truncate">{evento.local}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
                      <span className="text-[10px] font-mono text-slate-500 uppercase">
                        ID: {evento.id}
                      </span>

                      <button
                        type="button"
                        onClick={() => setEventoSelecionado(evento)}
                        className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 border border-amber-500/30 text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <span>Ver Detalhes</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SEÇÃO 2: NOTÍCIAS & INFORMATIVOS CADASTRADOS NO BANCO */}
      {(filtroTipo === 'TODOS' || filtroTipo === 'NOTICIAS') && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-black text-white tracking-wide">
                Notícias, Editais & Decretos Publicados
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {noticiasFiltradas.length} notícia(s) no banco
            </span>
          </div>

          {noticiasFiltradas.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 text-center space-y-2">
              <Newspaper className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs font-mono text-slate-400">Nenhuma notícia cadastrada no banco de dados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {noticiasFiltradas.map((noticia) => (
                <div
                  key={noticia.id}
                  onClick={() => setNoticiaSelecionada(noticia)}
                  className="rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 transition-all duration-300 overflow-hidden flex flex-col justify-between group cursor-pointer shadow-lg hover:shadow-[0_8px_25px_rgba(245,158,11,0.1)]"
                >
                  <div>
                    {/* Imagem de Capa */}
                    <div className="h-44 w-full relative overflow-hidden bg-slate-950">
                      <img
                        src={noticia.banner_url || 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80'}
                        alt={noticia.titulo}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />

                      {noticia.categoria && (
                        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-950/90 border border-slate-700 text-[10px] font-mono font-bold text-amber-400">
                          {noticia.categoria}
                        </div>
                      )}
                    </div>

                    <div className="p-5 space-y-2.5">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span>{formatarDataBR(noticia.data_publicacao)}</span>
                        <span>{noticia.autor}</span>
                      </div>

                      <h4 className="text-base font-black text-white group-hover:text-amber-400 transition-colors leading-snug">
                        {noticia.titulo}
                      </h4>

                      <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                        {noticia.subtitulo || noticia.conteudo}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 pt-0">
                    <button
                      type="button"
                      className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>Ler Comunicado Completo</span>
                      <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: LEITURA COMPLETA DA NOTÍCIA */}
      {noticiaSelecionada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-xl animate-fadeIn overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setNoticiaSelecionada(null);
          }}
        >
          <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-5 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 relative overflow-hidden max-h-[92vh] flex flex-col my-auto">
            {/* Topbar com Botão de Fechar */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 relative z-20">
              <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" /> FIRESTORE • {noticiaSelecionada.categoria || 'NOTÍCIA'}
              </span>

              <button
                type="button"
                onClick={() => setNoticiaSelecionada(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5 text-xs font-mono font-bold transition-all cursor-pointer border border-slate-700"
                title="Fechar comunicado"
              >
                <X className="w-4 h-4 text-amber-400" />
                <span>Fechar [ESC]</span>
              </button>
            </div>

            {/* Conteúdo com scroll seguro */}
            <div className="overflow-y-auto space-y-5 pr-1 flex-1">
              {noticiaSelecionada.banner_url && (
                <div className="h-56 w-full rounded-2xl overflow-hidden border border-slate-800">
                  <img
                    src={noticiaSelecionada.banner_url}
                    alt={noticiaSelecionada.titulo}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    {formatarDataBR(noticiaSelecionada.data_publicacao)}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    {noticiaSelecionada.autor}
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                  {noticiaSelecionada.titulo}
                </h3>

                {noticiaSelecionada.subtitulo && (
                  <p className="text-sm font-semibold text-amber-400/90 leading-relaxed font-sans">
                    {noticiaSelecionada.subtitulo}
                  </p>
                )}
              </div>

              {/* Texto Completo Formatado */}
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs sm:text-sm text-slate-200 leading-relaxed font-sans space-y-4 whitespace-pre-line">
                {noticiaSelecionada.conteudo}
              </div>
            </div>

            {/* Ações Inferiores */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => copiarLink(window.location.href)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold flex items-center gap-2 cursor-pointer transition-all"
              >
                <Share2 className="w-4 h-4 text-amber-400" />
                <span>{compartilhadoFeedback ? 'Link Copiado!' : 'Compartilhar Link'}</span>
              </button>

              <button
                type="button"
                onClick={() => setNoticiaSelecionada(null)}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg"
              >
                Concluir Leitura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DETALHES DO EVENTO */}
      {eventoSelecionado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-xl animate-fadeIn overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEventoSelecionado(null);
          }}
        >
          <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-5 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 relative overflow-hidden max-h-[92vh] flex flex-col my-auto">
            {/* Topbar */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 relative z-20">
              <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" /> EVENTO DO BANCO DE DADOS
              </span>

              <button
                type="button"
                onClick={() => setEventoSelecionado(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5 text-xs font-mono font-bold transition-all cursor-pointer border border-slate-700"
                title="Fechar detalhes do evento"
              >
                <X className="w-4 h-4 text-amber-400" />
                <span>Fechar [ESC]</span>
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="overflow-y-auto space-y-5 pr-1 flex-1">
              <div className="h-48 w-full rounded-2xl overflow-hidden border border-slate-800 relative">
                <img
                  src={eventoSelecionado.banner_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80'}
                  alt={eventoSelecionado.titulo}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 px-3 py-1 rounded-xl bg-amber-500 text-slate-950 text-xs font-mono font-black">
                  Data: {formatarDataBR(eventoSelecionado.data_evento)}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                  {eventoSelecionado.titulo}
                </h3>
                {eventoSelecionado.subtitulo && (
                  <p className="text-xs font-mono text-slate-300">{eventoSelecionado.subtitulo}</p>
                )}
              </div>

              {/* Informações Práticas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Localização</span>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                    {eventoSelecionado.local}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Período</span>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    {eventoSelecionado.data_inicio && eventoSelecionado.data_fim
                      ? `${formatarDataBR(eventoSelecionado.data_inicio)} até ${formatarDataBR(eventoSelecionado.data_fim)}`
                      : formatarDataBR(eventoSelecionado.data_evento)}
                  </p>
                </div>
              </div>

              {eventoSelecionado.tema_biblico && (
                <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider block">
                    TEMA BÍBLICO DA CONVOCAÇÃO
                  </span>
                  <p className="text-sm font-semibold text-white italic">
                    {eventoSelecionado.tema_biblico}
                  </p>
                </div>
              )}

              {eventoSelecionado.descricao && (
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                    Descrição do Evento
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                    {eventoSelecionado.descricao}
                  </p>
                </div>
              )}

              {eventoSelecionado.preletores && eventoSelecionado.preletores.length > 0 && (
                <div className="space-y-3">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                    Preletores & Ministrantes Convidados
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {eventoSelecionado.preletores.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                        <img
                          src={p.foto_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'}
                          alt={p.nome}
                          className="w-10 h-10 rounded-xl object-cover border border-amber-500/30"
                        />
                        <div className="space-y-0.5">
                          <h5 className="text-xs font-bold text-white">{p.nome}</h5>
                          <span className="text-[10px] font-mono text-slate-400 block">{p.cargo}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Ações Inferiores */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold flex items-center gap-2 cursor-pointer transition-all"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>Imprimir Convocatória</span>
              </button>

              <button
                type="button"
                onClick={() => setEventoSelecionado(null)}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg"
              >
                Voltar à Agenda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
