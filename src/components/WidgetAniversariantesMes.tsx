/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Módulo: Widget Aniversariantes do Mês
 * Relação Cronológica de Aniversários Eclesiásticos e Envio de Mensagens de Felicitação
 */

import React, { useState, useMemo } from 'react';
import type { Ministro } from '../types';
import {
  Cake,
  Calendar,
  Send,
  MessageCircle,
  Copy,
  Check,
  Search,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Users,
  Building2,
  X,
  Phone,
  Mail,
  Gift,
} from 'lucide-react';

interface WidgetAniversariantesMesProps {
  ministros: readonly Ministro[] | Ministro[];
  nomeConvencao?: string;
}

const MESES_NOMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

interface AniversarianteItem {
  ministro: Ministro;
  dia: number;
  mes: number;
  anoNasc?: number;
  idadeCelebrada?: number;
  isHoje: boolean;
}

export function WidgetAniversariantesMes({
  ministros,
  nomeConvencao = 'CIMADEBE',
}: WidgetAniversariantesMesProps) {
  const dataHoje = new Date();
  const mesAtualIndex = dataHoje.getMonth(); // 0 a 11
  const diaAtual = dataHoje.getDate();

  const [mesSelecionado, setMesSelecionado] = useState<number>(mesAtualIndex);
  const [busca, setBusca] = useState<string>('');
  const [modalMensagem, setModalMensagem] = useState<AniversarianteItem | null>(null);
  const [mensagemTexto, setMensagemTexto] = useState<string>('');
  const [copiado, setCopiado] = useState<boolean>(false);

  // Mapeamento dos aniversariantes do mês selecionado
  const aniversariantesMes = useMemo(() => {
    const list: AniversarianteItem[] = [];
    if (!Array.isArray(ministros)) return list;

    ministros.forEach((m) => {
      if (!m || !m.dataNascimento || typeof m.dataNascimento !== 'string') return;

      let dia = 0;
      let mes = 0;
      let anoNasc: number | undefined;

      const raw = m.dataNascimento.trim();
      if (raw.includes('-')) {
        // YYYY-MM-DD
        const parts = raw.split('-');
        if (parts.length >= 3) {
          anoNasc = parseInt(parts[0], 10);
          mes = parseInt(parts[1], 10);
          dia = parseInt(parts[2], 10);
        }
      } else if (raw.includes('/')) {
        // DD/MM/YYYY
        const parts = raw.split('/');
        if (parts.length >= 2) {
          dia = parseInt(parts[0], 10);
          mes = parseInt(parts[1], 10);
          if (parts.length >= 3) {
            anoNasc = parseInt(parts[2], 10);
          }
        }
      }

      if (dia > 0 && mes === mesSelecionado + 1) {
        const isHoje = mesSelecionado === mesAtualIndex && dia === diaAtual;
        const idadeCelebrada = anoNasc && anoNasc > 1900 ? dataHoje.getFullYear() - anoNasc : undefined;

        list.push({
          ministro: m,
          dia,
          mes,
          anoNasc,
          idadeCelebrada,
          isHoje,
        });
      }
    });

    // Ordenação cronológica por dia do aniversário
    return list.sort((a, b) => a.dia - b.dia);
  }, [ministros, mesSelecionado, mesAtualIndex, diaAtual]);

  // Filtragem por busca
  const aniversariantesFiltrados = useMemo(() => {
    if (!busca.trim()) return aniversariantesMes;
    const termo = busca.toLowerCase();
    return aniversariantesMes.filter(
      (item) =>
        (item.ministro?.nome || '').toLowerCase().includes(termo) ||
        (item.ministro?.cargo || '').toLowerCase().includes(termo) ||
        (item.ministro?.igrejaFiliadaNome &&
          item.ministro.igrejaFiliadaNome.toLowerCase().includes(termo))
    );
  }, [aniversariantesMes, busca]);

  const aniversariantesHoje = useMemo(() => {
    return aniversariantesMes.filter((item) => item.isHoje);
  }, [aniversariantesMes]);

  const gerarMensagemPadrao = (item: AniversarianteItem) => {
    const cargo = item.ministro.cargo || 'Ministro';
    const nome = item.ministro.nome || 'Obreiro(a)';
    const idadeTexto = item.idadeCelebrada ? ` seus ${item.idadeCelebrada} anos de vida e` : '';

    return `*A Paz do Senhor Jesus, amado(a) ${cargo} ${nome}!* 🎂🎉\n\nA Diretoria e a Secretaria Geral da *${nomeConvencao}* têm a grande alegria de parabenizá-lo(a) pelo seu aniversário!\n\nCelebramos com júbilo${idadeTexto} o dom precioso do seu ministério. Que o Senhor Deus derrame ricas bênçãos espirituais, saúde, paz, renovo e sabedoria sobre você, sua família e todo o seu rebanho.\n\n_"O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti e tenha misericórdia de ti; o Senhor sobre ti levante o seu rosto e te dê a paz." (Números 6:24-26)_\n\nFraternalmente em Cristo,\n*Mesa Diretora & Secretaria Geral — ${nomeConvencao}*`;
  };

  const abrirModalFelicitar = (item: AniversarianteItem) => {
    setModalMensagem(item);
    setMensagemTexto(gerarMensagemPadrao(item));
    setCopiado(false);
  };

  const enviarWhatsApp = (telefone?: string, texto?: string) => {
    if (!telefone) return;
    const digits = telefone.replace(/\D/g, '');
    const num = digits.length <= 11 ? `55${digits}` : digits;
    const url = `https://wa.me/${num}?text=${encodeURIComponent(texto || '')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copiarTexto = async () => {
    try {
      await navigator.clipboard.writeText(mensagemTexto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
      {/* Header do Widget */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/20 to-amber-600/20 text-amber-400 border border-amber-500/30 shadow-md">
            <Cake className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Aniversariantes do Mês
              </h3>
              {aniversariantesHoje.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold font-mono animate-pulse">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  {aniversariantesHoje.length} HOJE!
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Felicitações eclesiásticas oficiais e gestão pastoral de aniversários
            </p>
          </div>
        </div>

        {/* Navegador de Mês */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-950 rounded-2xl border border-slate-800 p-1">
            <button
              onClick={() => setMesSelecionado((prev) => (prev === 0 ? 11 : prev - 1))}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Mês Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-teal-300 font-mono min-w-[100px] text-center">
              {MESES_NOMES[mesSelecionado]}
            </span>
            <button
              onClick={() => setMesSelecionado((prev) => (prev === 11 ? 0 : prev + 1))}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Próximo Mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {mesSelecionado !== mesAtualIndex && (
            <button
              onClick={() => setMesSelecionado(mesAtualIndex)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-medium border border-slate-700 transition-all"
            >
              Mês Atual
            </button>
          )}
        </div>
      </div>

      {/* Barra de Busca e Resumo Rápido */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, cargo ou igreja..."
            className="w-full pl-10 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
          />
        </div>

        <div className="text-xs text-slate-400 font-mono flex items-center gap-2 self-end sm:self-auto">
          <span>Total em {MESES_NOMES[mesSelecionado]}:</span>
          <span className="font-bold text-white bg-slate-950 px-2.5 py-0.5 rounded-md border border-slate-800">
            {aniversariantesMes.length} obreiro(s)
          </span>
        </div>
      </div>

      {/* Lista de Aniversariantes */}
      {aniversariantesFiltrados.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
          <Gift className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400">
            Nenhum ministro aniversariante encontrado para {MESES_NOMES[mesSelecionado]}
            {busca ? ` com o termo "${busca}"` : ''}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {aniversariantesFiltrados.map((item, idx) => {
            if (!item || !item.ministro) return null;
            const hasPhone = Boolean(item.ministro.telefone);
            return (
              <div
                key={item.ministro.id || `aniv-${idx}`}
                className={`relative group p-4 rounded-2xl border transition-all shadow-md flex flex-col justify-between ${
                  item.isHoje
                    ? 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-amber-950/20 border-amber-500/50 hover:border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                    : 'bg-slate-950/80 border-slate-800 hover:border-teal-500/40'
                }`}
              >
                {/* Topo do Card: Data e Badge */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex flex-col items-center justify-center w-10 h-11 rounded-xl font-mono text-center border ${
                        item.isHoje
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                          : 'bg-slate-900 text-teal-300 border-slate-700 font-bold'
                      }`}
                    >
                      <span className="text-[13px] leading-none">{String(item.dia).padStart(2, '0')}</span>
                      <span className="text-[9px] uppercase leading-none mt-0.5">
                        {(MESES_NOMES[mesSelecionado] || 'Mês').slice(0, 3)}
                      </span>
                    </div>

                    {item.isHoje && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black font-mono tracking-wider">
                        HOJE! 🎂
                      </span>
                    )}
                  </div>

                  {item.idadeCelebrada && (
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {item.idadeCelebrada} anos
                    </span>
                  )}
                </div>

                {/* Centro: Foto e Informações do Ministro */}
                <div className="flex items-center gap-3.5 mb-4">
                  <div className="relative shrink-0">
                    {item?.ministro?.fotoUrl ? (
                      <img
                        src={item.ministro.fotoUrl}
                        alt={item?.ministro?.nome || 'Ministro'}
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-700 shadow"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-700 to-slate-800 text-white font-black text-sm flex items-center justify-center border border-slate-700 shadow">
                        {((item?.ministro?.nome || 'M').trim().slice(0, 2) || 'M').toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-teal-300 transition-colors">
                      {item.ministro.nome || 'Ministro Convocado'}
                    </h4>
                    <span className="inline-block text-[11px] font-mono text-emerald-400 font-semibold truncate">
                      {item.ministro.cargo || 'Ministro'}
                    </span>
                    {item.ministro.igrejaFiliadaNome && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 truncate mt-0.5">
                        <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{item.ministro.igrejaFiliadaNome}</span>
                      </span>
                    )}
                  </div>
                </div>


              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Personalização e Envio de Mensagem de Felicitação */}
      {modalMensagem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Cake className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Mensagem Oficial de Aniversário</h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {modalMensagem.ministro.cargo || 'Ministro'} {modalMensagem.ministro.nome || 'Obreiro(a)'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalMensagem(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-mono text-slate-400 uppercase">
                Texto Institucional da Felicitação (Editável):
              </label>
              <textarea
                value={mensagemTexto}
                onChange={(e) => setMensagemTexto(e.target.value)}
                rows={9}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:border-teal-500 font-sans leading-relaxed resize-none"
              />
            </div>

            {/* Ações do Modal */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                onClick={copiarTexto}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-2 transition-all cursor-pointer"
              >
                {copiado ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300">Copiado para Área de Transferência!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-400" />
                    <span>Copiar Texto</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalMensagem(null)}
                  className="px-3.5 py-2 rounded-xl bg-transparent hover:bg-slate-800 text-slate-400 text-xs font-bold"
                >
                  Fechar
                </button>
                {modalMensagem.ministro.telefone && (
                  <button
                    onClick={() => {
                      enviarWhatsApp(modalMensagem.ministro.telefone, mensagemTexto);
                      setModalMensagem(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Disparar WhatsApp</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
