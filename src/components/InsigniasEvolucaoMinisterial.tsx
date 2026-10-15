import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Sparkles,
  Award,
  CheckCircle2,
  Lock,
  ChevronRight,
  Flame,
  Crown,
  BookOpen,
  Calendar,
  Share2,
  FileCheck,
  Zap,
  Info,
  X,
  RefreshCw,
  Sliders,
  Play,
  Pause,
  FastForward,
  RotateCcw,
  Compass,
  Clock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Ministro } from '../types';
import {
  InsigniaOrdenacao,
  TODAS_INSIGNIAS,
  extrairNivelMinistro,
  montarHistoricoInsignias,
  HistoricoInsigniaMinistro
} from '../services/insigniasService';
import { formatarDataBR } from '../financialEngine';
import { EmblemaInsignia3D } from './EmblemaInsignia3D';

interface InsigniasEvolucaoProps {
  readonly ministro: Ministro;
}

export const InsigniasEvolucaoMinisterial: React.FC<InsigniasEvolucaoProps> = ({ ministro }) => {
  const historico = useMemo(() => montarHistoricoInsignias(ministro), [ministro]);
  const nivelAtual = useMemo(() => extrairNivelMinistro(ministro.cargo), [ministro.cargo]);

  const insigniaVigente = useMemo(() => {
    return TODAS_INSIGNIAS.find((i) => i.nivel === nivelAtual) || TODAS_INSIGNIAS[0];
  }, [nivelAtual]);

  const [insigniaSelecionada, setInsigniaSelecionada] = useState<HistoricoInsigniaMinistro>(() => {
    return historico.find((h) => h.insignia.nivel === nivelAtual) || historico[0];
  });

  const [modalCerimoniaAberto, setModalCerimoniaAberto] = useState(false);
  const [estagioCerimonia, setEstagioCerimonia] = useState<'INICIO' | 'ASCENSAO' | 'CONCLUIDO'>('INICIO');

  // CONTROLES DA PASSAGEM DE TEMPO TEMPORAL (TIME LAPSE 3D)
  const anoInicial = 2005;
  const anoFinal = 2026;
  const [anoTemporal, setAnoTemporal] = useState<number>(2026);
  const [reproduzindoTempo, setReproduzindoTempo] = useState<boolean>(false);
  const [rotacao3D, setRotacao3D] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Escape key handler para fechar modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalCerimoniaAberto) {
        setModalCerimoniaAberto(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalCerimoniaAberto]);

  // Insígnia ativa no ano temporal da simulação
  const insigniaTemporal = useMemo(() => {
    const proporcao = (anoTemporal - anoInicial) / (anoFinal - anoInicial);
    const nivelSimulado = Math.min(Math.max(Math.ceil(proporcao * nivelAtual), 1), nivelAtual);
    return TODAS_INSIGNIAS.find((i) => i.nivel === nivelSimulado) || TODAS_INSIGNIAS[0];
  }, [anoTemporal, nivelAtual]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (reproduzindoTempo) {
      timer = setInterval(() => {
        setAnoTemporal((prev) => {
          if (prev >= anoFinal) {
            setReproduzindoTempo(false);
            confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
            return anoFinal;
          }
          return prev + 1;
        });
      }, 700);
    }
    return () => clearInterval(timer);
  }, [reproduzindoTempo]);

  const iniciarPassagemTempo = () => {
    setAnoTemporal(anoInicial);
    setReproduzindoTempo(true);
  };

  const iniciarCerimoniaAlcamento = () => {
    setEstagioCerimonia('INICIO');
    setModalCerimoniaAberto(true);

    setTimeout(() => {
      setEstagioCerimonia('ASCENSAO');
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
    }, 1200);

    setTimeout(() => {
      setEstagioCerimonia('CONCLUIDO');
      confetti({
        particleCount: 100,
        spread: 100,
        origin: { y: 0.5 }
      });
    }, 2800);
  };

  return (
    <div className="space-y-8 font-sans">
      {/* HEADER HERO: INSÍGNIA VIGENTE EM DESTAQUE HOLOGRÁFICO */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/40 shadow-[0_0_40px_rgba(245,158,11,0.15)] relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
            {/* Emblema Holográfico 3D Interativo com Giro e Reflexo */}
            <div
              className="relative group cursor-pointer"
              onClick={() => setInsigniaSelecionada(historico.find((h) => h.insignia.nivel === nivelAtual)!)}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientY - rect.top) / rect.height - 0.5) * -20;
                const y = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
                setRotacao3D({ x, y });
              }}
              onMouseLeave={() => setRotacao3D({ x: 0, y: 0 })}
            >
              <div
                className="w-32 h-32 sm:w-36 sm:h-36 rounded-3xl flex items-center justify-center shadow-2xl relative transition-all duration-300 p-2"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${insigniaVigente.corPrimaria}30, #090d16)`,
                  border: `2px solid ${insigniaVigente.corPrimaria}`,
                  boxShadow: `0 0 45px ${insigniaVigente.corGlow}`,
                  transform: `perspective(600px) rotateX(${rotacao3D.x}deg) rotateY(${rotacao3D.y}deg)`
                }}
              >
                {/* Linhas de Circuito Cyber */}
                <div className="absolute inset-2 border border-white/10 rounded-2xl pointer-events-none" />
                <div
                  className="absolute -inset-1 border border-dashed rounded-3xl animate-spin [animation-duration:30s] opacity-30 pointer-events-none"
                  style={{ borderColor: insigniaVigente.corPrimaria }}
                />

                <EmblemaInsignia3D
                  nivel={insigniaVigente.nivel}
                  cargo={insigniaVigente.cargo}
                  tamanho={115}
                  animado={true}
                />

                <span className="absolute bottom-1.5 right-2 text-[9px] font-mono font-black text-white px-2 py-0.5 rounded bg-black/80 border border-amber-500/40">
                  NV.{insigniaVigente.nivel}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <span
                  className="px-3 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider shadow"
                  style={{
                    backgroundColor: `${insigniaVigente.corPrimaria}25`,
                    color: insigniaVigente.corPrimaria,
                    border: `1px solid ${insigniaVigente.corPrimaria}50`
                  }}
                >
                  INSÍGNIA DE GRAU VIGENTE • {insigniaVigente.cargo.toUpperCase()}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Homologado na Convenção
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {insigniaVigente.titulo}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                {insigniaVigente.subtitulo}
              </p>

              <div className="pt-2 flex items-center justify-center sm:justify-start gap-3 font-mono text-xs text-slate-400">
                <span>Ordenação Atual: <strong className="text-white">{ministro.cargo}</strong></span>
                <span>•</span>
                <span>Nível Eclesiástico: <strong className="text-amber-400">{nivelAtual} de 6</strong></span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={iniciarCerimoniaAlcamento}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs font-mono uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(245,158,11,0.4)] cursor-pointer flex items-center justify-center gap-2 hover:scale-105 active:scale-95"
            >
              <Zap className="w-4 h-4 text-slate-950" />
              <span>Passagem de Emblema Alçado</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('passagem-tempo-3d');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-xs font-bold border border-cyan-500/40 transition-all cursor-pointer flex items-center justify-center gap-2 shadow"
            >
              <Clock className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>Viagem no Tempo 3D ({anoInicial}-{anoFinal})</span>
            </button>
          </div>
        </div>
      </div>

      {/* SEÇÃO: VISUALIZAÇÃO HOLOGRÁFICA 3D DE PASSAGEM DE TEMPO (TIME LAPSE EVOLUTION) */}
      <div id="passagem-tempo-3d" className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 border-cyan-500/40 shadow-[0_0_45px_rgba(6,182,212,0.2)] space-y-6 relative overflow-hidden backdrop-blur-xl">
        <div className="absolute inset-0 cyber-grid-bg opacity-10 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest block">
                TIME LAPSE • TRAJETÓRIA SACERDOTAL HOLOGRÁFICA
              </span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-[9px] font-mono font-bold">
                RENDERIZAÇÃO 3D VETORIAL
              </span>
            </div>
            <h3 className="text-xl font-black text-white mt-1">
              Evolução Histórica de Ordenações & Insígnias Conquistadas
            </h3>
          </div>

          <div className="flex items-center gap-2 font-mono">
            {reproduzindoTempo ? (
              <button
                type="button"
                onClick={() => setReproduzindoTempo(false)}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
              >
                <Pause className="w-4 h-4" />
                <span>Pausar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => (anoTemporal >= anoFinal ? iniciarPassagemTempo() : setReproduzindoTempo(true))}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-950/50 hover:scale-105 active:scale-95"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>{anoTemporal >= anoFinal ? 'Reiniciar Viagem no Tempo' : 'Iniciar Passagem de Tempo'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={iniciarPassagemTempo}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 cursor-pointer transition-all"
              title="Voltar ao início"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Display Central do Time Lapse com Emblema Dinâmico */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center relative z-10">
          {/* Lado Esquerdo: Display do Ano e Histórico */}
          <div className="space-y-4 text-center sm:text-left">
            <div className="space-y-1">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest block">
                ANO ECLESIÁSTICO EM REPRODUÇÃO:
              </span>
              <div className="text-5xl sm:text-6xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">
                {anoTemporal}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-cyan-500/30 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-cyan-400 uppercase font-bold block">Status no Ano de {anoTemporal}:</span>
              <p className="text-sm font-bold text-white">{insigniaTemporal.cargo} • Nível {insigniaTemporal.nivel}</p>
              <p className="text-[11px] text-slate-400">{insigniaTemporal.titulo}</p>
            </div>

            {/* Slider de Tempo Manual */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>{anoInicial} (Início do Ministério)</span>
                <span className="text-cyan-400 font-bold">{anoTemporal}</span>
                <span>{anoFinal} (Presente)</span>
              </div>
              <input
                type="range"
                min={anoInicial}
                max={anoFinal}
                value={anoTemporal}
                onChange={(e) => {
                  setAnoTemporal(Number(e.target.value));
                  setReproduzindoTempo(false);
                }}
                className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-950 rounded-lg border border-slate-800"
              />
            </div>
          </div>

          {/* Centro: Emblema Holográfico Dinâmico do Ano */}
          <div className="flex flex-col items-center justify-center py-4">
            <motion.div
              key={insigniaTemporal.id}
              initial={{ scale: 0.8, rotateY: -90, opacity: 0 }}
              animate={{ scale: 1, rotateY: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="w-44 h-44 sm:w-52 sm:h-52 rounded-3xl flex items-center justify-center shadow-2xl relative p-3"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${insigniaTemporal.corPrimaria}40, #080d1a)`,
                border: `3px solid ${insigniaTemporal.corPrimaria}`,
                boxShadow: `0 0 55px ${insigniaTemporal.corGlow}`
              }}
            >
              <div className="absolute -inset-2 border-2 border-dashed rounded-3xl animate-spin [animation-duration:20s] pointer-events-none opacity-40" style={{ borderColor: insigniaTemporal.corPrimaria }} />
              
              <EmblemaInsignia3D
                nivel={insigniaTemporal.nivel}
                cargo={insigniaTemporal.cargo}
                tamanho={170}
                animado={true}
              />

              <span className="absolute bottom-2 right-2 text-[10px] font-mono font-black text-white px-2 py-0.5 rounded bg-black/80 border border-white/30">
                NÍVEL {insigniaTemporal.nivel}
              </span>
            </motion.div>

            <div className="mt-4 text-center space-y-1">
              <span className="text-xs font-mono font-black uppercase text-cyan-300">
                {insigniaTemporal.cargo} ({anoTemporal})
              </span>
              <p className="text-[11px] text-slate-400 max-w-xs">{insigniaTemporal.subtitulo}</p>
            </div>
          </div>

          {/* Lado Direito: Histórico de Conquistas Acumuladas */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 font-mono text-xs">
            <span className="text-[10px] text-amber-400 uppercase font-bold tracking-wider block">
              Insígnias Conquistadas até {anoTemporal}:
            </span>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {historico
                .filter((h) => h.insignia.nivel <= insigniaTemporal.nivel)
                .map((h) => (
                  <div
                    key={h.insignia.id}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-3">
                      <EmblemaInsignia3D nivel={h.insignia.nivel} cargo={h.insignia.cargo} tamanho={36} />
                      <div>
                        <span className="font-bold text-white text-xs block">{h.insignia.cargo}</span>
                        <span className="text-[9px] text-slate-400">Grau NV.{h.insignia.nivel}</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                      ✓ Ativo
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* PAINEL DETALHADO DO EMBLEMA SELECIONADO & PRERROGATIVAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lado Esquerdo: Ficha Técnica do Emblema */}
        <div
          className={`lg:col-span-1 p-6 sm:p-7 rounded-3xl bg-slate-900/90 border transition-all shadow-2xl backdrop-blur-xl space-y-6`}
          style={{ borderColor: `${insigniaSelecionada.insignia.corPrimaria}40` }}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <EmblemaInsignia3D
                nivel={insigniaSelecionada.insignia.nivel}
                cargo={insigniaSelecionada.insignia.cargo}
                tamanho={50}
              />
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block">
                  Grau de Ordenação
                </span>
                <h4 className="text-sm font-black text-white">{insigniaSelecionada.insignia.cargo}</h4>
              </div>
            </div>

            {insigniaSelecionada.desbloqueada ? (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-mono font-black uppercase">
                Alçado & Consagrado
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[9px] font-mono font-bold uppercase flex items-center gap-1">
                <Lock className="w-3 h-3" /> Bloqueado
              </span>
            )}
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-amber-500/30 space-y-2 font-mono">
              <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-bold uppercase">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>Pedra Preciosa & Joalheria Sacra</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Gema Mineral</span>
                <p className="text-amber-300 font-bold text-xs">{insigniaSelecionada.insignia.pedraPreciosa}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Lapidação 3D</span>
                <p className="text-slate-300 text-[11px]">{insigniaSelecionada.insignia.lapidacao}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1.5 font-mono">
              <span className="text-[10px] text-slate-500 uppercase block font-bold">Título do Alçamento</span>
              <p className="text-slate-200 font-bold">{insigniaSelecionada.insignia.titulo}</p>
              <p className="text-[11px] text-slate-400">{insigniaSelecionada.insignia.grauAutoridade}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[10px] font-bold uppercase">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Fundamento Bíblico do Cargo</span>
              </div>
              <p className="text-slate-300 italic leading-relaxed text-[11px]">
                {insigniaSelecionada.insignia.versiculoChave}
              </p>
              <span className="text-amber-400/90 font-mono text-[10px] font-bold block text-right">
                — {insigniaSelecionada.insignia.referenciaBiblica}
              </span>
            </div>

            {insigniaSelecionada.desbloqueada && (
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2 font-mono text-[11px]">
                <span className="text-[10px] text-emerald-400 uppercase font-bold block">
                  Registro de Consagração
                </span>
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div>
                    <span className="text-[9px] text-slate-500 block">Data Oficial</span>
                    <strong>{formatarDataBR(insigniaSelecionada.dataConsagracao || '2016-09-26')}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block">Ata Convencional</span>
                    <strong>{insigniaSelecionada.ataNumero || 'ATA-2016-142'}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lado Direito: Prerrogativas Ministeriais & Simbologia */}
        <div className="lg:col-span-2 p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800/90 space-y-6 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" />
                <span>Prerrogativas Canônicas & Poderes Eclesiásticos</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Direitos estatutários outorgados pela Convenção CIMADEBE para este grau de ordenação.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {insigniaSelecionada.insignia.prerrogativas.map((prerrogativa, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-3 text-xs text-slate-200"
              >
                <div
                  className="w-6 h-6 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    backgroundColor: `${insigniaSelecionada.insignia.corPrimaria}20`,
                    color: insigniaSelecionada.insignia.corPrimaria
                  }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span className="leading-relaxed">{prerrogativa}</span>
              </div>
            ))}
          </div>

          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
            <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider block">
              Simbologia Heráldica do Emblema
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">
              {insigniaSelecionada.insignia.descricaoSimbolica}
            </p>
          </div>
        </div>
      </div>

      {/* TRILHA COMPLETA DE EVOLUÇÃO MINISTERIAL (TIMELINE HOLOGRÁFICA) */}
      <div id="trilha-ordenacoes" className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800/90 space-y-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest block">
                CARREIRA SACERDOTAL & GRAUS ECLESIÁSTICOS
              </span>
            </div>
            <h3 className="text-lg font-black text-white">
              Trilha de Ordenações & Alçamento Ministerial
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 px-3.5 py-1.5 rounded-xl border border-emerald-500/40">
            {nivelAtual} DE {TODAS_INSIGNIAS.length} INSÍGNIAS CONQUISTADAS
          </span>
        </div>

        {/* Grade de Insígnias */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {historico.map((item) => {
            const isSelected = insigniaSelecionada.insignia.id === item.insignia.id;
            const isCurrent = item.insignia.nivel === nivelAtual;

            return (
              <div
                key={item.insignia.id}
                onClick={() => setInsigniaSelecionada(item)}
                className={`p-4 rounded-3xl border transition-all cursor-pointer relative overflow-hidden flex flex-col items-center text-center space-y-3 ${
                  isSelected
                    ? 'ring-2 ring-amber-400 scale-105 shadow-2xl z-10'
                    : 'hover:scale-102 hover:border-slate-700'
                } ${
                  item.desbloqueada
                    ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-slate-800'
                    : 'bg-slate-950/50 border-slate-900 opacity-50'
                }`}
                style={isSelected ? { borderColor: item.insignia.corPrimaria } : {}}
              >
                {/* Badge Nível */}
                <div className="w-full flex items-center justify-between text-[9px] font-mono">
                  <span className="text-slate-500 font-bold">NV.{item.insignia.nivel}</span>
                  {isCurrent && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black tracking-tighter uppercase text-[8px]">
                      ATUAL
                    </span>
                  )}
                </div>

                {/* Ícone 3D */}
                <div
                  className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg relative p-1 ${
                    item.desbloqueada ? '' : 'grayscale opacity-60'
                  }`}
                  style={{
                    backgroundColor: `${item.insignia.corPrimaria}15`,
                    border: `2px solid ${item.insignia.corPrimaria}${item.desbloqueada ? '80' : '30'}`,
                    boxShadow: item.desbloqueada ? `0 0 20px ${item.insignia.corGlow}` : 'none'
                  }}
                >
                  <EmblemaInsignia3D
                    nivel={item.insignia.nivel}
                    cargo={item.insignia.cargo}
                    tamanho={64}
                  />

                  {!item.desbloqueada && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs rounded-2xl flex items-center justify-center">
                      <Lock className="w-5 h-5 text-slate-400" />
                    </div>
                  )}
                </div>

                {/* Textos */}
                <div className="space-y-0.5 w-full">
                  <h4 className="text-xs font-black text-white truncate">{item.insignia.cargo}</h4>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    {item.desbloqueada ? 'Consagrado' : 'Grau Superior'}
                  </span>
                </div>

                {/* Status Indicator */}
                <div className="w-full pt-1 border-t border-slate-800/60">
                  {item.desbloqueada ? (
                    <span className="text-[9px] font-mono text-emerald-400 font-bold flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Conquistada
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono text-slate-500 flex items-center justify-center gap-1">
                      <Lock className="w-3 h-3" /> Bloqueada
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: CERIMÔNIA DE ALÇAMENTO & PASSAGEM DE EMBLEMA (COM ESCAPE HATCH TOTAL & SEM TRAVAR EM NENHUM DISPOSITIVO) */}
      {modalCerimoniaAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-xl animate-fadeIn overflow-y-auto"
          onClick={(e) => {
            // Fecha ao clicar fora do card
            if (e.target === e.currentTarget) {
              setModalCerimoniaAberto(false);
            }
          }}
        >
          <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/50 rounded-3xl p-5 sm:p-8 max-w-lg w-full shadow-[0_0_60px_rgba(245,158,11,0.3)] space-y-5 relative overflow-hidden text-center max-h-[92vh] flex flex-col my-auto">
            {/* Barra de Fechamento Superior com Botão de Destaque */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 relative z-20">
              <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest">
                CIMADEBE / SIGM • SOLENIDADE
              </span>

              <button
                type="button"
                onClick={() => setModalCerimoniaAberto(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5 text-xs font-mono font-bold transition-all cursor-pointer border border-slate-700 shadow"
                title="Fechar e voltar à página"
              >
                <X className="w-4 h-4 text-amber-400" />
                <span>Fechar [ESC]</span>
              </button>
            </div>

            {/* Conteúdo com scroll interno garantido para mobile */}
            <div className="overflow-y-auto space-y-5 pr-1 flex-1 relative z-10">
              <div className="space-y-1 relative z-10 pt-1">
                <span className="px-3.5 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-widest bg-amber-500 text-slate-950 inline-block shadow">
                  SOLENIDADE CONVENCIONAL DE ALÇAMENTO
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  Decreto Canônico de Passagem de Emblema
                </h3>
                <p className="text-xs text-slate-300 font-mono">
                  Convenção Interestadual de Ministros
                </p>
              </div>

              {/* Animação do Emblema Alçado 3D Vetorial de Alta Resolução */}
              <div className="py-3 flex flex-col items-center justify-center relative z-10">
                <motion.div
                  initial={{ scale: 0.5, rotateY: 0, opacity: 0 }}
                  animate={{
                    scale: estagioCerimonia === 'CONCLUIDO' ? 1.1 : 1,
                    rotateY: [0, 180, 360],
                    opacity: 1
                  }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                  className="w-44 h-44 rounded-3xl flex items-center justify-center shadow-2xl relative p-3"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${insigniaVigente.corPrimaria}40, #090d16)`,
                    border: `3px solid ${insigniaVigente.corPrimaria}`,
                    boxShadow: `0 0 50px ${insigniaVigente.corGlow}`
                  }}
                >
                  <div
                    className="absolute -inset-2 border-2 border-dashed rounded-3xl animate-spin [animation-duration:15s] pointer-events-none opacity-40"
                    style={{ borderColor: insigniaVigente.corPrimaria }}
                  />
                  
                  <EmblemaInsignia3D
                    nivel={insigniaVigente.nivel}
                    cargo={insigniaVigente.cargo}
                    tamanho={160}
                    animado={true}
                  />
                </motion.div>

                <div className="mt-4 space-y-1">
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-widest block">
                    ORDENAÇÃO CONFERIDA
                  </span>
                  <h4 className="text-xl font-black text-white">{insigniaVigente.titulo}</h4>
                  <p className="text-xs text-slate-300">{ministro.nome} • {insigniaVigente.grauAutoridade}</p>
                </div>
              </div>

              {/* Texto de Outorga Canônica */}
              <div className="p-4 rounded-2xl bg-slate-950/90 border border-amber-500/30 text-xs font-mono text-slate-300 text-left space-y-2 relative z-10">
                <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold border-b border-slate-800 pb-1.5">
                  <span>SELO DE AUTORIDADE ECLESIÁSTICA</span>
                  <span>REG: {ministro.registroMinisterial || 'RM-039.279-26'}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  Pelo presente decreto, a Mesa Diretora da <strong>CIMADEBE</strong> certifica que o Ministro <strong>{ministro.nome}</strong> foi devidamente examinado, aprovado e investido na função canônica de <strong>{ministro.cargo}</strong>, outorgando-lhe plena autoridade litúrgica e convencional.
                </p>
              </div>
            </div>

            {/* Botões de Ação Inferiores */}
            <div className="pt-2 border-t border-slate-800 relative z-20 flex items-center justify-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setModalCerimoniaAberto(false)}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs font-mono uppercase tracking-wider shadow-lg transition-all cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-slate-950" />
                <span>Concluir e Retornar ao Painel</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
