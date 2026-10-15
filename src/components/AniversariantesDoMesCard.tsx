import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PartyPopper,
  Sparkles,
  Award,
  Calendar,
  Heart,
  Share2,
  Check,
  ChevronRight,
  User,
  Building,
  Crown,
  Gift,
  Send,
  MessageCircle
} from 'lucide-react';
import { Ministro } from '../types';
import { useSecurity } from '../SecurityContext';
import confetti from 'canvas-confetti';

interface AniversariantesDoMesCardProps {
  readonly onVerPerfilMinistro?: (ministroId: string) => void;
  readonly className?: string;
}

const NOMAS_MESES = [
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
  'Dezembro'
];

export const AniversariantesDoMesCard: React.FC<AniversariantesDoMesCardProps> = ({
  onVerPerfilMinistro,
  className = ''
}) => {
  const { ministros, appConfig } = useSecurity();
  const agora = new Date();
  const mesAtualNum = agora.getMonth(); // 0-indexed (9 = Outubro)
  const diaAtualNum = agora.getDate();

  const [mesSelecionado, setMesSelecionado] = useState<number>(mesAtualNum);
  const [copiadoMsgId, setCopiadoMsgId] = useState<string | null>(null);

  // Dispara confete quando houver aniversariante no dia
  useEffect(() => {
    const hojeTemAniversariante = (ministros || []).some((m) => {
      if (!m || !m.dataNascimento || typeof m.dataNascimento !== 'string') return false;
      const partes = m.dataNascimento.split('-');
      if (partes.length !== 3) return false;
      const mes = parseInt(partes[1], 10) - 1;
      const dia = parseInt(partes[2], 10);
      return mes === mesAtualNum && dia === diaAtualNum;
    });

    if (hojeTemAniversariante) {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 }
        });
      } catch {}
    }
  }, [ministros, mesAtualNum, diaAtualNum]);

  // Processa aniversariantes de hoje e do mês
  const { aniversariantesHoje, aniversariantesDoMes } = useMemo(() => {
    const hojeList: Array<{ ministro: Ministro; dia: number; mes: number; idade?: number }> = [];
    const mesList: Array<{ ministro: Ministro; dia: number; mes: number; eHoje: boolean }> = [];

    if (!Array.isArray(ministros)) {
      return {
        aniversariantesHoje: [],
        aniversariantesDoMes: []
      };
    }

    ministros.forEach((m) => {
      // Regra Zero-Trust: Sem dados fictícios ou fallbacks inventados.
      // Se não houver dataNascimento válida no Firestore, não sintetizar aniversários.
      if (!m || !m.dataNascimento || typeof m.dataNascimento !== 'string') {
        return;
      }

      const partes = m.dataNascimento.split('-');
      if (partes.length !== 3) {
        return;
      }

      const anoNasc = parseInt(partes[0], 10);
      const mes = parseInt(partes[1], 10) - 1;
      const dia = parseInt(partes[2], 10);

      if (isNaN(mes) || isNaN(dia) || mes < 0 || mes > 11 || dia < 1 || dia > 31) {
        return;
      }

      const eHoje = mes === mesAtualNum && dia === diaAtualNum;
      const idade = !isNaN(anoNasc) && anoNasc > 1900 ? agora.getFullYear() - anoNasc : undefined;

      if (eHoje) {
        hojeList.push({ ministro: m, dia, mes, idade });
      }

      if (mes === mesSelecionado) {
        mesList.push({ ministro: m, dia, mes, eHoje });
      }
    });

    mesList.sort((a, b) => a.dia - b.dia);

    return {
      aniversariantesHoje: hojeList,
      aniversariantesDoMes: mesList
    };
  }, [ministros, mesAtualNum, diaAtualNum, mesSelecionado]);

  const enviarParabensWhatsapp = (m: Ministro) => {
    const nomeConv = appConfig?.nomeFantasia || 'CIMADEBE';
    const cargo = m.cargo || 'Ministro';
    const nome = m.nome || 'Irmão(ã)';
    const texto = encodeURIComponent(
      `🎉 *Feliz Aniversário, ${cargo} ${nome}!* 🎂\n\nA Convenção ${nomeConv} deseja a você um abençoado aniversário! Que o Senhor continue derramando bênçãos sem medida sobre sua vida, família e ministério.\n\n_"O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti." (Números 6:24-25)_ 🙌✨`
    );
    const tel = m.telefone ? m.telefone.replace(/\D/g, '') : '';
    if (tel) {
      window.open(`https://wa.me/55${tel}?text=${texto}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${texto}`, '_blank');
    }
  };

  const copiarMensagemParabens = (m: Ministro) => {
    const nomeConv = appConfig?.nomeFantasia || 'CIMADEBE';
    const cargo = m.cargo || 'Ministro';
    const nome = m.nome || 'Irmão(ã)';
    const texto = `🎉 Feliz Aniversário, ${cargo} ${nome}! 🎂\n\nA Convenção ${nomeConv} deseja a você um abençoado aniversário! Que o Senhor continue derramando bênçãos sem medida sobre sua vida, família e ministério.\n\n"O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti." (Números 6:24-25) 🙌✨`;
    navigator.clipboard.writeText(texto);
    setCopiadoMsgId(m.id);
    setTimeout(() => setCopiadoMsgId(null), 2500);
  };

  return (
    <div className={`space-y-6 font-sans ${className}`}>
      {/* ========================================================================= */}
      {/* 1. CARD ESPECIAL DE CELEBRAÇÃO DO ANIVERSARIANTE DO DIA (HOJE) */}
      {/* ========================================================================= */}
      {aniversariantesHoje.length > 0 && (
        <div className="space-y-4">
          {aniversariantesHoje.map(({ ministro, dia, idade }, idx) => {
            if (!ministro) return null;
            return (
              <motion.div
                key={`hoje-${ministro.id || idx}`}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-amber-950/90 via-slate-900 to-emerald-950/90 border-2 border-amber-500/60 shadow-[0_0_35px_rgba(245,158,11,0.25)] relative overflow-hidden backdrop-blur-2xl"
            >
              {/* Partículas Douradas Decorativas de Fundo */}
              <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

              <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                {/* LADO ESQUERDO: FOTO DE PERFIL COM COROA DOURADA & DADOS */}
                <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                  <div className="relative shrink-0">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-slate-950 border-2 border-amber-400 p-1 shadow-2xl relative overflow-hidden group">
                      {ministro.fotoUrl ? (
                        <img
                          src={ministro.fotoUrl}
                          alt={ministro.nome || 'Ministro'}
                          className="w-full h-full object-cover rounded-2xl"
                        />
                      ) : (
                        <div className="w-full h-full rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-3xl">
                          {ministro?.nome && typeof ministro.nome === 'string' && ministro.nome.trim().length > 0 ? (
                            ministro.nome.trim().charAt(0).toUpperCase()
                          ) : (
                            <User className="w-8 h-8 text-amber-400" />
                          )}
                        </div>
                      )}
                    </div>
                    {/* Badge de Coroa Festiva de Aniversariante do Dia */}
                    <div className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 border-2 border-slate-900 flex items-center justify-center shadow-lg animate-bounce">
                      <Crown className="w-5 h-5 fill-slate-950" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-amber-500 text-slate-950 shadow-md flex items-center gap-1">
                        <PartyPopper className="w-3.5 h-3.5" /> ANIVERSARIANTE DO DIA!
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono text-emerald-300 bg-emerald-950/80 border border-emerald-500/40">
                        {dia} de {NOMAS_MESES[mesAtualNum] || ''}
                      </span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {ministro.nome || 'Ministro Convocado'}
                    </h3>

                    <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-mono text-amber-300 flex-wrap">
                      <span className="font-bold">{ministro.cargo || 'Ministro'}</span>
                      <span>•</span>
                      <span className="text-slate-300">
                        {ministro.igrejaFiliadaNome || 'Sede Geral Convencional'}
                      </span>
                    </div>

                    {ministro.registroMinisterial && (
                      <p className="text-[11px] font-mono text-slate-400">
                        Registro Ministerial: <strong className="text-amber-400">{ministro.registroMinisterial}</strong>
                      </p>
                    )}
                  </div>
                </div>

                {/* LADO DIREITO: MENSAGEM ESPECIAL DE PARABÉNS & AÇÕES */}
                <div className="w-full md:w-auto max-w-md bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                    <Gift className="w-4 h-4" />
                    <span>Homenagem da Convenção Geral</span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed font-serif italic">
                    “Desejamos ao querido obreiro {ministro.cargo || 'Ministro'} <strong>{ministro.nome || 'Ministro Convocado'}</strong> um abençoado Aniversário! Que a graça e a paz do Senhor Jesus continuem multiplicadas sobre sua vida e ministério.”
                  </p>

                  <p className="text-[10px] font-mono text-amber-300/90 font-bold">
                    “O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti.” — Nm 6:24-25
                  </p>


                </div>
              </div>
            </motion.div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PAINEL DE ANIVERSARIANTES DO MÊS COM FILTRO DE MÊS */}
      {/* ========================================================================= */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800/90 space-y-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <PartyPopper className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-white">
                  Aniversariantes do Mês
                </h3>
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/80 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                  {aniversariantesDoMes.length} Obreiros
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Celebração fraterna dos ministros filiados da Convenção Geral.
              </p>
            </div>
          </div>

          {/* Seletor de Mês */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 scrollbar-none">
            {NOMAS_MESES.map((nomeMes, idx) => (
              <button
                key={nomeMes}
                type="button"
                onClick={() => setMesSelecionado(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                  mesSelecionado === idx
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {nomeMes.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* GRID DE ANIVERSARIANTES DO MÊS */}
        {aniversariantesDoMes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {aniversariantesDoMes.map(({ ministro, dia, eHoje }, idx) => {
              if (!ministro) return null;
              return (
                <div
                  key={ministro.id || `aniv-mes-${idx}`}
                  className={`p-4 sm:p-5 rounded-2xl transition-all shadow-xl flex items-center justify-between gap-3 border ${
                    eHoje
                      ? 'bg-gradient-to-r from-amber-950/80 to-slate-900 border-amber-500/60 ring-1 ring-amber-500/40'
                      : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-slate-900 border border-amber-500/30 overflow-hidden flex items-center justify-center font-bold text-amber-400 text-base">
                      {ministro.fotoUrl ? (
                        <img
                          src={ministro.fotoUrl}
                          alt={ministro.nome || 'Ministro'}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        ministro?.nome && typeof ministro.nome === 'string' && ministro.nome.trim().length > 0 ? (
                          ministro.nome.trim().charAt(0).toUpperCase()
                        ) : (
                          <User className="w-5 h-5 text-amber-400" />
                        )
                      )}
                    </div>
                    {eHoje && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 rounded-full border border-slate-950 animate-ping" />
                    )}
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/80 border border-amber-500/30 px-2 py-0.2 rounded-full">
                        {dia} de {NOMAS_MESES[mesSelecionado] || ''}
                      </span>
                      {eHoje && (
                        <span className="text-[9px] font-mono font-black text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-1.5 py-0.2 rounded uppercase">
                          Hoje!
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                      {ministro.nome || 'Ministro Convocado'}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-mono truncate">
                      {ministro.cargo || 'Ministro'} • {ministro.igrejaFiliadaNome || 'Sede Geral'}
                    </p>
                  </div>
                </div>


              </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2 font-mono">
            <Calendar className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">
              Nenhum ministro cadastrado com aniversário no mês de {NOMAS_MESES[mesSelecionado]}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
