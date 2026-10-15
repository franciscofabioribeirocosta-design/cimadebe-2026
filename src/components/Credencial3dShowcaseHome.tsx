import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MinisterialCard } from './MinisterialCard';
import { useSecurity } from '../SecurityContext';
import type { Ministro } from '../types';
import {
  ShieldCheck,
  RotateCw,
  Sparkles,
  QrCode,
  CheckCircle2,
  Lock,
  Layers,
  Award,
  Maximize2,
  Volume2,
  ChevronRight,
  Eye,
} from 'lucide-react';

interface Credencial3dShowcaseHomeProps {
  readonly onValidarCredencial?: () => void;
}

export function Credencial3dShowcaseHome({ onValidarCredencial }: Credencial3dShowcaseHomeProps) {
  const { ministros, appConfig } = useSecurity();
  const [verso, setVerso] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [rotacaoX, setRotacaoX] = useState(10);
  const [rotacaoY, setRotacaoY] = useState(-15);
  const [brilhoPosicao, setBrilhoPosicao] = useState({ x: 50, y: 50, opacidade: 0.3 });
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Objeto de demonstração fixo e estático para exibição pública segura na Home, sem vazamento de dados do banco
  const ministroAtivo: Partial<Ministro> = {
    id: 'demonstracao-home-segura',
    tenantId: 't-sede-salvador',
    nome: 'Pr. João da Silva',
    cargo: 'Pastor',
    registroMinisterial: 'REG-2026.0001',
    status: 'ATIVO',
    statusAdimplencia: 'ADIMPLENTE',
    cpf: '000.000.000-00',
    fotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&h=300&q=80',
    email: 'exemplo@convencao.org.br',
    telefone: '(11) 99999-9999',
    igrejaFiliadaNome: 'Igreja Assembleia de Deus Sede',
    dataFiliacao: '2026-01-01',
    dadosEndereco: {
      cep: '40000-000',
      rua: 'Av. Sete de Setembro',
      numero: '1500',
      bairro: 'Centro',
      cidade: 'Salvador',
      uf: 'BA'
    }
  };

  // Cálculo de Tilt 3D com o Mouse
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Converte posição do mouse para ângulos de -25deg a +25deg
    const calcY = ((mouseX - width / 2) / (width / 2)) * 25;
    const calcX = -((mouseY - height / 2) / (height / 2)) * 20;

    setRotacaoY(calcY);
    setRotacaoX(calcX);

    // Atualiza posição do reflexo holográfico
    const percentX = (mouseX / width) * 100;
    const percentY = (mouseY / height) * 100;
    setBrilhoPosicao({ x: percentX, y: percentY, opacidade: 0.6 });
  }, []);

  const handleMouseEnter = () => {
    setIsHovered(true);
    setAutoRotate(false);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotacaoX(10);
    setRotacaoY(-15);
    setBrilhoPosicao({ x: 50, y: 50, opacidade: 0.2 });
  };

  const toggleVerso = () => {
    setVerso((prev) => !prev);
  };

  return (
    <section className="relative my-12 overflow-hidden rounded-xl bg-slate-950/90 border border-emerald-500/30 p-6 sm:p-10 shadow-[0_0_50px_rgba(16,185,129,0.15)] backdrop-blur-2xl">
      {/* Luz de fundo holográfica */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-emerald-500/20 via-teal-500/10 to-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Lado Esquerdo: Textos e Informações de Governança */}
        <div className="lg:col-span-5 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-400 text-xs font-mono font-bold tracking-wider uppercase shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>IDENTIFICAÇÃO MINISTERIAL 3D HIGH-SECURITY</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-snug">
            Credencial Digital Oficial em{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Modelo 3D Holográfico
            </span>
          </h2>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Padrão ISO/IEC CR80 com vetorização de fundo guilloché anti-falsificação, validação QR Code em tempo real no servidor do ecossistema <strong className="text-emerald-400">SIGM / CIMADEBE</strong> e ledger de adimplência imutável.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Padrão CR80</span>
              </div>
              <p className="text-[11px] text-slate-400">Dimensão física 85.6mm x 54mm em alta resolução vetorial</p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-400 font-bold">
                <QrCode className="w-4 h-4" />
                <span>QR Code Validável</span>
              </div>
              <p className="text-[11px] text-slate-400">Verificação de autenticidade instantânea com geolocalização</p>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-wrap items-center gap-3 pt-3">
            <button
              onClick={toggleVerso}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
              <span>Girar Carteira 180° ({verso ? 'Exibir Frente' : 'Exibir Verso'})</span>
            </button>

            {onValidarCredencial && (
              <button
                onClick={onValidarCredencial}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition-all cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Scanner de Validação</span>
              </button>
            )}
          </div>
        </div>

        {/* Lado Direito: O Cartão 3D Interativo */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center relative py-4">
          <div className="text-center mb-3">
            <span className="text-[11px] font-mono text-emerald-400/80 uppercase tracking-widest block">
              💡 MOVA O PONTEIRO DO MOUSE SOBRE A CARTEIRA PARA INSPECIONAR EM 3D
            </span>
          </div>

          {/* Palco 3D em Perspectiva */}
          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="relative cursor-grab active:cursor-grabbing w-full max-w-[520px] aspect-[856/540] flex items-center justify-center select-none"
            style={{ perspective: '1200px' }}
          >
            {/* O Cartão 3D com Transformações de Rotação */}
            <motion.div
              className="relative w-full h-full rounded-[8px] transition-transform duration-100 ease-out shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]"
              style={{
                transformStyle: 'preserve-3d',
                transform: `rotateX(${rotacaoX}deg) rotateY(${verso ? rotacaoY + 180 : rotacaoY}deg) translateZ(0px)`,
              }}
            >
              {/* LADO FRENTE DA CREDENCIAL */}
              <div
                className="absolute inset-0 w-full h-full rounded-[8px] overflow-hidden bg-slate-900 border border-emerald-500/40 shadow-2xl"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
              >
                <MinisterialCard
                  ministro={ministroAtivo}
                  verso={false}
                  width="100%"
                  height="100%"
                  className="w-full h-full object-contain rounded-[8px]"
                />

                {/* Efeito Holográfico / Refrator de Luz Metálica (Sheen Effect) */}
                <div
                  className="absolute inset-0 pointer-events-none mix-blend-color-dodge transition-opacity duration-300 rounded-[8px]"
                  style={{
                    opacity: brilhoPosicao.opacidade,
                    background: `radial-gradient(circle at ${brilhoPosicao.x}% ${brilhoPosicao.y}%, rgba(255,255,255,0.7) 0%, rgba(16,185,129,0.3) 30%, transparent 70%)`,
                  }}
                />
              </div>

              {/* LADO VERSO DA CREDENCIAL */}
              <div
                className="absolute inset-0 w-full h-full rounded-[8px] overflow-hidden bg-slate-900 border border-emerald-500/40 shadow-2xl"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                <MinisterialCard
                  ministro={ministroAtivo}
                  verso={true}
                  width="100%"
                  height="100%"
                  className="w-full h-full object-contain rounded-[8px]"
                />

                {/* Efeito Holográfico Verso */}
                <div
                  className="absolute inset-0 pointer-events-none mix-blend-color-dodge transition-opacity duration-300 rounded-[8px]"
                  style={{
                    opacity: brilhoPosicao.opacidade,
                    background: `radial-gradient(circle at ${brilhoPosicao.x}% ${brilhoPosicao.y}%, rgba(255,255,255,0.6) 0%, rgba(6,182,212,0.3) 30%, transparent 70%)`,
                  }}
                />
              </div>
            </motion.div>

            {/* Sombra 3D Dinâmica sob a Credencial */}
            <div
              className="absolute -bottom-8 w-[85%] h-8 bg-black/80 rounded-full blur-xl pointer-events-none transition-transform duration-200"
              style={{
                transform: `scale(${isHovered ? 1.05 : 0.95}) translateY(${rotacaoX * 0.5}px)`,
                opacity: 0.7,
              }}
            />
          </div>

          {/* Legenda dos Dados da Credencial - Renderização Condicional Estrita */}
          {ministroAtivo?.nome ? (
            <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs font-mono text-slate-300 bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-2xl">
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {ministroAtivo.nome}
              </span>
              {ministroAtivo.cargo && (
                <>
                  <span className="text-slate-600">|</span>
                  <span className="text-cyan-400">{ministroAtivo.cargo}</span>
                </>
              )}
              {ministroAtivo.registroMinisterial && (
                <>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400">{ministroAtivo.registroMinisterial}</span>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
