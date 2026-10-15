import React from 'react';

interface EmblemaInsignia3DProps {
  readonly nivel: number;
  readonly cargo?: string;
  readonly tamanho?: number; // em pixels (ex: 40, 60, 115, 160, 220)
  readonly className?: string;
  readonly animado?: boolean;
}

/**
 * Componente de Joias e Pedras Preciosas Ministeriais 3D Multifacetadas
 * CIMADEBE / SIGM - Coleção Sagrada de Gemas Eclesiásticas
 */
export const EmblemaInsignia3D: React.FC<EmblemaInsignia3DProps> = ({
  nivel,
  tamanho = 120,
  className = '',
  animado = false
}) => {
  const uniqueId = `gem-${nivel}-${Math.round(tamanho)}`;

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: tamanho, height: tamanho }}
    >
      <svg
        viewBox="0 0 200 200"
        width={tamanho}
        height={tamanho}
        className={`w-full h-full drop-shadow-[0_12px_30px_rgba(0,0,0,0.8)] ${animado ? 'hover:scale-105 transition-transform duration-300' : ''}`}
      >
        <defs>
          {/* GRADIENTES METÁLICOS DE OURO IMPERIAL 24K */}
          <linearGradient id={`${uniqueId}-gold-metallic`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff8db" />
            <stop offset="20%" stopColor="#ffd700" />
            <stop offset="45%" stopColor="#b8860b" />
            <stop offset="70%" stopColor="#ffe680" />
            <stop offset="100%" stopColor="#7a5500" />
          </linearGradient>

          <linearGradient id={`${uniqueId}-gold-rim`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#664600" />
            <stop offset="30%" stopColor="#ffd700" />
            <stop offset="60%" stopColor="#ffffff" />
            <stop offset="85%" stopColor="#e6ac00" />
            <stop offset="100%" stopColor="#996e00" />
          </linearGradient>

          <linearGradient id={`${uniqueId}-platinum`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#cbd5e1" />
            <stop offset="65%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          {/* GRADIENTES DE PEDRAS PRECIOSAS FACETADAS */}
          {/* 1. DIAMANTE PURO (BRILHO CRISTALINO & PRISMÁTICO) */}
          <linearGradient id={`${uniqueId}-diamond-table`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#e0f2fe" />
            <stop offset="100%" stopColor="#bae6fd" />
          </linearGradient>
          <linearGradient id={`${uniqueId}-diamond-facet-a`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f0f9ff" />
            <stop offset="100%" stopColor="#7dd3fc" />
          </linearGradient>
          <linearGradient id={`${uniqueId}-diamond-facet-b`} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e0e7ff" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <linearGradient id={`${uniqueId}-diamond-dark`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>

          {/* 2. RUBI SANGUE-DE-POMBO (BURGUNDY & SCARLET) */}
          <linearGradient id={`${uniqueId}-ruby-table`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fecdd3" />
            <stop offset="40%" stopColor="#e11d48" />
            <stop offset="100%" stopColor="#881337" />
          </linearGradient>
          <linearGradient id={`${uniqueId}-ruby-facet-a`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff4d6d" />
            <stop offset="100%" stopColor="#9f1239" />
          </linearGradient>
          <linearGradient id={`${uniqueId}-ruby-facet-b`} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fda4af" />
            <stop offset="100%" stopColor="#4c0519" />
          </linearGradient>

          {/* 3. ESMERALDA COLOMBIANA (VERDE PROFUNDO & REFLEXOS DE MENTA) */}
          <linearGradient id={`${uniqueId}-emerald-table`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a7f3d0" />
            <stop offset="35%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#064e3b" />
          </linearGradient>
          <linearGradient id={`${uniqueId}-emerald-facet-a`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6ee7b7" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id={`${uniqueId}-emerald-facet-b`} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#022c22" />
          </linearGradient>

          {/* 4. SAFIRA AZUL CELESTE (AZUL ROYAL & REFLEXOS DE DIAMANTE) */}
          <linearGradient id={`${uniqueId}-sapphire-table`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#bae6fd" />
            <stop offset="40%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#082f49" />
          </linearGradient>
          <linearGradient id={`${uniqueId}-sapphire-facet-a`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
          <linearGradient id={`${uniqueId}-sapphire-facet-b`} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="100%" stopColor="#0c4a6e" />
          </linearGradient>

          {/* 5. AMETISTA REAL SAGRADA (VIOLETA IMPERIAL & PRISMA) */}
          <linearGradient id={`${uniqueId}-amethyst-table`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f3e8ff" />
            <stop offset="35%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#3b0764" />
          </linearGradient>
          <linearGradient id={`${uniqueId}-amethyst-facet-a`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#6b21a8" />
          </linearGradient>
          <linearGradient id={`${uniqueId}-amethyst-facet-b`} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e9d5ff" />
            <stop offset="100%" stopColor="#581c87" />
          </linearGradient>

          {/* 6. TOPÁZIO DOURADO IMPERIAL (ÂMBAR DE FOGO & MEL) */}
          <linearGradient id={`${uniqueId}-topaz-table`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="35%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>
          <linearGradient id={`${uniqueId}-topaz-facet-a`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <linearGradient id={`${uniqueId}-topaz-facet-b`} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>

          {/* FILTRO DE BRILHO E CAUSTICAS DE LUZ */}
          <filter id={`${uniqueId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <radialGradient id={`${uniqueId}-halo`} cx="50%" cy="50%" r="50%">
            <stop
              offset="0%"
              stopColor={
                nivel >= 5
                  ? '#fbbf24'
                  : nivel === 4
                  ? '#c084fc'
                  : nivel === 3
                  ? '#34d399'
                  : nivel === 2
                  ? '#38bdf8'
                  : '#60a5fa'
              }
              stopOpacity="0.5"
            />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* HALO RADIANTE CRISTALINO */}
        <circle cx="100" cy="100" r="96" fill={`url(#${uniqueId}-halo)`} />

        {/* ANEL EXTERIOR COM MICRO-DIAMANTES CRAVEJADOS */}
        <circle
          cx="100"
          cy="100"
          r="88"
          fill="none"
          stroke={`url(#${uniqueId}-gold-rim)`}
          strokeWidth="2.5"
        />
        <circle
          cx="100"
          cy="100"
          r="84"
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="1"
          strokeDasharray="2 4"
          className={animado ? 'animate-spin [animation-duration:35s]' : ''}
        />

        {/* ========================================================================= */}
        {/* NÍVEL 5 (PASTOR): O GRANDE DIAMANTE BRILHANTE & COROA IMPERIAL DE RUBIS */}
        {/* ========================================================================= */}
        {nivel === 5 && (
          <g>
            {/* Engaste de Ouro Imperial & Berço de Alta Joalheria */}
            <path
              d="M 100 18 L 165 42 L 180 100 L 165 158 L 100 182 L 35 158 L 20 100 L 35 42 Z"
              fill="#090d16"
              stroke={`url(#${uniqueId}-gold-metallic)`}
              strokeWidth="4"
              filter={`url(#${uniqueId}-glow)`}
            />

            {/* Cravação de 8 Rubis e Esmeraldas no Aro Externo */}
            <circle cx="100" cy="24" r="4.5" fill={`url(#${uniqueId}-ruby-table)`} stroke="#fff" strokeWidth="0.8" />
            <circle cx="160" cy="48" r="4" fill={`url(#${uniqueId}-emerald-table)`} stroke="#fff" strokeWidth="0.8" />
            <circle cx="174" cy="100" r="4.5" fill={`url(#${uniqueId}-ruby-table)`} stroke="#fff" strokeWidth="0.8" />
            <circle cx="160" cy="152" r="4" fill={`url(#${uniqueId}-sapphire-table)`} stroke="#fff" strokeWidth="0.8" />
            <circle cx="100" cy="176" r="4.5" fill={`url(#${uniqueId}-ruby-table)`} stroke="#fff" strokeWidth="0.8" />
            <circle cx="40" cy="152" r="4" fill={`url(#${uniqueId}-sapphire-table)`} stroke="#fff" strokeWidth="0.8" />
            <circle cx="26" cy="100" r="4.5" fill={`url(#${uniqueId}-ruby-table)`} stroke="#fff" strokeWidth="0.8" />
            <circle cx="40" cy="48" r="4" fill={`url(#${uniqueId}-emerald-table)`} stroke="#fff" strokeWidth="0.8" />

            {/* O DIAMANTE LAPIDAÇÃO BRILHANTE 3D (SOLITÁRIO GIGANTE) */}
            <g transform="translate(0, 5)">
              {/* Mesa Central do Diamante (Table Facet) */}
              <polygon
                points="80,72 120,72 134,88 134,112 120,128 80,128 66,112 66,88"
                fill={`url(#${uniqueId}-diamond-table)`}
                stroke="#ffffff"
                strokeWidth="1"
              />

              {/* Facetas da Coroa Superior (Crown Facets) */}
              <polygon points="100,50 80,72 120,72" fill={`url(#${uniqueId}-diamond-facet-a)`} stroke="#fff" strokeWidth="0.8" />
              <polygon points="100,50 120,72 148,60" fill={`url(#${uniqueId}-diamond-facet-b)`} stroke="#fff" strokeWidth="0.8" />
              <polygon points="120,72 134,88 156,86 148,60" fill={`url(#${uniqueId}-diamond-dark)`} stroke="#fff" strokeWidth="0.8" />
              <polygon points="134,88 134,112 158,100 156,86" fill={`url(#${uniqueId}-diamond-facet-a)`} stroke="#fff" strokeWidth="0.8" />

              <polygon points="100,50 80,72 52,60" fill={`url(#${uniqueId}-diamond-facet-b)`} stroke="#fff" strokeWidth="0.8" />
              <polygon points="80,72 66,88 44,60 52,60" fill={`url(#${uniqueId}-diamond-dark)`} stroke="#fff" strokeWidth="0.8" />
              <polygon points="66,88 66,112 42,100 44,60" fill={`url(#${uniqueId}-diamond-facet-a)`} stroke="#fff" strokeWidth="0.8" />

              {/* Facetas do Pavilhão Inferior (Pavilion Facets) */}
              <polygon points="100,150 80,128 120,128" fill={`url(#${uniqueId}-diamond-facet-b)`} stroke="#fff" strokeWidth="0.8" />
              <polygon points="100,150 120,128 148,140" fill={`url(#${uniqueId}-diamond-facet-a)`} stroke="#fff" strokeWidth="0.8" />
              <polygon points="120,128 134,112 158,100 148,140" fill={`url(#${uniqueId}-diamond-dark)`} stroke="#fff" strokeWidth="0.8" />

              <polygon points="100,150 80,128 52,140" fill={`url(#${uniqueId}-diamond-facet-a)`} stroke="#fff" strokeWidth="0.8" />
              <polygon points="80,128 66,112 42,100 52,140" fill={`url(#${uniqueId}-diamond-dark)`} stroke="#fff" strokeWidth="0.8" />

              {/* Triângulos de Luz e Estrela Interna */}
              <polygon points="100,80 114,100 100,120 86,100" fill="#ffffff" opacity="0.85" filter={`url(#${uniqueId}-glow)`} />
              
              {/* Garras de Ouro 24k Segurando o Diamante */}
              <circle cx="52" cy="60" r="3" fill={`url(#${uniqueId}-gold-rim)`} />
              <circle cx="148" cy="60" r="3" fill={`url(#${uniqueId}-gold-rim)`} />
              <circle cx="158" cy="100" r="3" fill={`url(#${uniqueId}-gold-rim)`} />
              <circle cx="148" cy="140" r="3" fill={`url(#${uniqueId}-gold-rim)`} />
              <circle cx="52" cy="140" r="3" fill={`url(#${uniqueId}-gold-rim)`} />
              <circle cx="42" cy="100" r="3" fill={`url(#${uniqueId}-gold-rim)`} />

              {/* Brilhos Estelares (Flashes Prismáticos) */}
              <g className="animate-pulse">
                <polygon points="100,68 102,74 108,76 102,78 100,84 98,78 92,76 98,74" fill="#ffffff" filter={`url(#${uniqueId}-glow)`} />
                <polygon points="126,92 128,96 132,98 128,100 126,104 124,100 120,98 124,96" fill="#ffffff" filter={`url(#${uniqueId}-glow)`} />
                <polygon points="74,108 76,112 80,114 76,116 74,120 72,116 68,114 72,112" fill="#ffffff" filter={`url(#${uniqueId}-glow)`} />
              </g>
            </g>

            {/* Coroa Superior Cravada */}
            <path
              d="M 75 32 L 85 44 L 100 28 L 115 44 L 125 32 L 122 48 Q 100 52 78 48 Z"
              fill={`url(#${uniqueId}-gold-metallic)`}
              stroke="#fff2b2"
              strokeWidth="1.2"
            />
            <circle cx="100" cy="28" r="3.5" fill={`url(#${uniqueId}-ruby-table)`} stroke="#fff" strokeWidth="0.8" />
          </g>
        )}

        {/* ========================================================================= */}
        {/* NÍVEL 4 (EVANGELISTA): A AMETISTA REAL & JASPE DE FOGO FACETADA */}
        {/* ========================================================================= */}
        {nivel === 4 && (
          <g>
            {/* Engaste em Ouro & Platina */}
            <path
              d="M 100 18 L 170 50 L 170 150 L 100 182 L 30 150 L 30 50 Z"
              fill="#18042b"
              stroke={`url(#${uniqueId}-gold-metallic)`}
              strokeWidth="3.5"
              filter={`url(#${uniqueId}-glow)`}
            />

            {/* A JOIA AMETISTA MARQUISE MULTIFACETADA */}
            <g transform="translate(0, 0)">
              {/* Mesa Central Pontiaguda */}
              <polygon
                points="100,48 135,100 100,152 65,100"
                fill={`url(#${uniqueId}-amethyst-table)`}
                stroke="#ffffff"
                strokeWidth="1"
              />

              {/* Facetas Laterais Esquerda */}
              <polygon points="100,28 65,100 100,48" fill={`url(#${uniqueId}-amethyst-facet-a)`} stroke="#fff" strokeWidth="0.8" />
              <polygon points="100,28 40,75 65,100" fill={`url(#${uniqueId}-amethyst-facet-b)`} stroke="#fff" strokeWidth="0.8" />
              <polygon points="65,100 40,125 100,172" fill={`url(#${uniqueId}-amethyst-facet-a)`} stroke="#fff" strokeWidth="0.8" />
              <polygon points="65,100 100,152 100,172" fill={`url(#${uniqueId}-amethyst-facet-b)`} stroke="#fff" strokeWidth="0.8" />

              {/* Facetas Laterais Direita */}
              <polygon points="100,28 135,100 100,48" fill={`url(#${uniqueId}-amethyst-facet-b)`} stroke="#fff" strokeWidth="0.8" />
              <polygon points="100,28 160,75 135,100" fill={`url(#${uniqueId}-amethyst-facet-a)`} stroke="#fff" strokeWidth="0.8" />
              <polygon points="135,100 160,125 100,172" fill={`url(#${uniqueId}-amethyst-facet-b)`} stroke="#fff" strokeWidth="0.8" />
              <polygon points="135,100 100,152 100,172" fill={`url(#${uniqueId}-amethyst-facet-a)`} stroke="#fff" strokeWidth="0.8" />

              {/* Coração da Joia: O Jaspe de Fogo Central */}
              <polygon
                points="100,75 118,100 100,125 82,100"
                fill={`url(#${uniqueId}-ruby-table)`}
                opacity="0.9"
                stroke={`url(#${uniqueId}-gold-metallic)`}
                strokeWidth="1.5"
                filter={`url(#${uniqueId}-glow)`}
              />

              {/* Chamas de Luz Branca */}
              <polygon points="100,85 106,100 100,115 94,100" fill="#ffffff" />
            </g>

            {/* Cravos de Diamante nas 6 Pontas */}
            <circle cx="100" cy="22" r="3.5" fill="#ffffff" stroke={`url(#${uniqueId}-gold-rim)`} strokeWidth="1" />
            <circle cx="166" cy="52" r="3.5" fill="#ffffff" stroke={`url(#${uniqueId}-gold-rim)`} strokeWidth="1" />
            <circle cx="166" cy="148" r="3.5" fill="#ffffff" stroke={`url(#${uniqueId}-gold-rim)`} strokeWidth="1" />
            <circle cx="100" cy="178" r="3.5" fill="#ffffff" stroke={`url(#${uniqueId}-gold-rim)`} strokeWidth="1" />
            <circle cx="34" cy="148" r="3.5" fill="#ffffff" stroke={`url(#${uniqueId}-gold-rim)`} strokeWidth="1" />
            <circle cx="34" cy="52" r="3.5" fill="#ffffff" stroke={`url(#${uniqueId}-gold-rim)`} strokeWidth="1" />
          </g>
        )}

        {/* ========================================================================= */}
        {/* NÍVEL 3 (PRESBÍTERO): A ESMERALDA NOBRE DE JUDÁ (EMERALD STEP CUT) */}
        {/* ========================================================================= */}
        {nivel === 3 && (
          <g>
            {/* Engaste Octogonal de Ouro 24k */}
            <polygon
              points="60,20 140,20 180,60 180,140 140,180 60,180 20,140 20,60"
              fill="#022c22"
              stroke={`url(#${uniqueId}-gold-metallic)`}
              strokeWidth="4"
              filter={`url(#${uniqueId}-glow)`}
            />

            {/* A ESMERALDA OCTOGONAL EM DEGRAUS (EMERALD CUT) */}
            <g transform="translate(0, 0)">
              {/* Degrau 1 (Outer Step) */}
              <polygon
                points="66,32 134,32 168,66 168,134 134,168 66,168 32,134 32,66"
                fill={`url(#${uniqueId}-emerald-facet-b)`}
                stroke="#ffffff"
                strokeWidth="0.8"
              />

              {/* Degrau 2 (Middle Step) */}
              <polygon
                points="72,44 128,44 156,72 156,128 128,156 72,156 44,128 44,72"
                fill={`url(#${uniqueId}-emerald-facet-a)`}
                stroke="#ffffff"
                strokeWidth="0.8"
              />

              {/* Mesa Central da Esmeralda (Table Facet) */}
              <polygon
                points="78,56 122,56 144,78 144,122 122,144 78,144 56,122 56,78"
                fill={`url(#${uniqueId}-emerald-table)`}
                stroke="#ffffff"
                strokeWidth="1.2"
              />

              {/* Reflexo de Menorá Sagrada em Ouro e Diamantes Gravada na Esmeralda */}
              <g transform="translate(0, 0)">
                <path d="M 85 125 L 115 125 L 110 120 L 90 120 Z" fill={`url(#${uniqueId}-gold-metallic)`} />
                <line x1="100" y1="80" x2="100" y2="120" stroke={`url(#${uniqueId}-gold-metallic)`} strokeWidth="3" />
                <path d="M 72 80 Q 72 108 100 108 Q 128 108 128 80" fill="none" stroke={`url(#${uniqueId}-gold-metallic)`} strokeWidth="2.5" />
                <path d="M 82 80 Q 82 100 100 100 Q 118 100 118 80" fill="none" stroke={`url(#${uniqueId}-gold-metallic)`} strokeWidth="2" />
                <path d="M 92 80 Q 92 92 100 92 Q 108 92 108 80" fill="none" stroke={`url(#${uniqueId}-gold-metallic)`} strokeWidth="1.8" />

                {/* 7 Chamas de Diamante Puro */}
                {[72, 82, 92, 100, 108, 118, 128].map((x) => (
                  <circle key={x} cx={x} cy="76" r="2.8" fill="#ffffff" filter={`url(#${uniqueId}-glow)`} />
                ))}
              </g>

              {/* Brilhos Facetados de Esmeralda */}
              <polygon points="62,60 66,66 72,66 68,70 70,76 64,72 58,76 60,70 56,66 62,66" fill="#ffffff" opacity="0.9" filter={`url(#${uniqueId}-glow)`} />
              <polygon points="138,130 142,136 148,136 144,140 146,146 140,142 134,146 136,140 132,136 138,136" fill="#ffffff" opacity="0.9" filter={`url(#${uniqueId}-glow)`} />
            </g>
          </g>
        )}

        {/* ========================================================================= */}
        {/* NÍVEL 2 (DIÁCONO): O TOPÁZIO IMPERIAL & ÁGUA-MARINHA (CUSHION CUT) */}
        {/* ========================================================================= */}
        {nivel === 2 && (
          <g>
            {/* Engaste de Ouro & Topázio */}
            <path
              d="M 100 20 Q 165 25 175 100 Q 165 175 100 180 Q 35 175 25 100 Q 35 25 100 20 Z"
              fill="#082f49"
              stroke={`url(#${uniqueId}-gold-metallic)`}
              strokeWidth="4"
              filter={`url(#${uniqueId}-glow)`}
            />

            {/* A GEMA DE TOPÁZIO & ÁGUA-MARINHA CUSHION CUT */}
            <g transform="translate(0, 0)">
              {/* Facetas Exteriores */}
              <polygon points="100,32 152,48 168,100 152,152 100,168 48,152 32,100 48,48" fill={`url(#${uniqueId}-topaz-facet-b)`} stroke="#fff" strokeWidth="0.8" />
              <polygon points="100,46 140,58 154,100 140,142 100,154 60,142 46,100 60,58" fill={`url(#${uniqueId}-topaz-facet-a)`} stroke="#fff" strokeWidth="0.8" />

              {/* Mesa da Gema com Água-Marinha Central */}
              <polygon
                points="100,60 130,70 140,100 130,130 100,140 70,130 60,100 70,70"
                fill={`url(#${uniqueId}-topaz-table)`}
                stroke="#ffffff"
                strokeWidth="1.2"
              />

              {/* Cálice Sagrado Cravejado com Safiras e Vinho de Rubi */}
              <g transform="translate(0, 5)">
                <ellipse cx="100" cy="78" rx="22" ry="6" fill={`url(#${uniqueId}-gold-rim)`} />
                <ellipse cx="100" cy="78" rx="18" ry="4" fill={`url(#${uniqueId}-ruby-table)`} />
                <path d="M 80 78 Q 100 82 120 78 L 115 105 Q 100 120 85 105 Z" fill={`url(#${uniqueId}-gold-metallic)`} />
                <rect x="97" y="112" width="6" height="20" fill={`url(#${uniqueId}-gold-metallic)`} />
                <circle cx="100" cy="120" r="5" fill={`url(#${uniqueId}-sapphire-table)`} stroke="#fff" strokeWidth="0.5" />
                <path d="M 82 132 Q 100 128 118 132 L 122 136 Q 100 140 78 136 Z" fill={`url(#${uniqueId}-gold-metallic)`} />

                {/* Cruz de Diamante Branco no Cálice */}
                <path d="M 98 88 L 102 88 L 102 92 L 106 92 L 106 95 L 102 95 L 102 102 L 98 102 L 98 95 L 94 95 L 94 92 L 98 92 Z" fill="#ffffff" filter={`url(#${uniqueId}-glow)`} />
              </g>

              {/* Centelhas de Brilho */}
              <polygon points="135,65 137,70 142,72 137,74 135,79 133,74 128,72 133,70" fill="#ffffff" filter={`url(#${uniqueId}-glow)`} />
            </g>
          </g>
        )}

        {/* ========================================================================= */}
        {/* NÍVEL 1 (COOPERADOR): A SAFIRA CELESTE (TRILLIANT SHIELD CUT) */}
        {/* ========================================================================= */}
        {nivel === 1 && (
          <g>
            {/* Engaste de Safira Triangular */}
            <polygon
              points="100,20 178,55 160,155 100,182 40,155 22,55"
              fill="#031d33"
              stroke={`url(#${uniqueId}-gold-metallic)`}
              strokeWidth="4"
              filter={`url(#${uniqueId}-glow)`}
            />

            {/* A GEMA DE SAFIRA FACETADA EM ESCUDO */}
            <g transform="translate(0, 0)">
              {/* Facetas Externas */}
              <polygon points="100,32 165,62 150,145 100,168 50,145 35,62" fill={`url(#${uniqueId}-sapphire-facet-b)`} stroke="#fff" strokeWidth="0.8" />
              <polygon points="100,48 150,72 138,135 100,154 62,135 50,72" fill={`url(#${uniqueId}-sapphire-facet-a)`} stroke="#fff" strokeWidth="0.8" />

              {/* Mesa Central Triangular da Safira */}
              <polygon
                points="100,64 135,84 125,125 100,140 75,125 65,84"
                fill={`url(#${uniqueId}-sapphire-table)`}
                stroke="#ffffff"
                strokeWidth="1.2"
              />

              {/* Tocha do Altar em Ouro e Fogo de Diamante */}
              <g transform="translate(0, 5)">
                <polygon points="95,135 105,135 108,90 92,90" fill={`url(#${uniqueId}-gold-metallic)`} />
                <circle cx="100" cy="90" r="8" fill={`url(#${uniqueId}-gold-rim)`} />
                {/* Labareda Brilhante de Diamante */}
                <path d="M 100 52 Q 115 72 106 84 Q 100 78 94 84 Q 85 72 100 52 Z" fill="#ffffff" filter={`url(#${uniqueId}-glow)`} />
                <circle cx="100" cy="74" r="4" fill="#38bdf8" />
              </g>

              {/* Centelha de Safira */}
              <polygon points="62,80 64,84 68,86 64,88 62,92 60,88 56,86 60,84" fill="#ffffff" filter={`url(#${uniqueId}-glow)`} />
            </g>
          </g>
        )}

        {/* ========================================================================= */}
        {/* NÍVEL 6 (PRESIDENTE): O DIAMANTE NEGRO ÔNIX REAL & 12 PEDRAS PRECIOSAS */}
        {/* ========================================================================= */}
        {nivel >= 6 && (
          <g>
            {/* Engaste de Platina & Ouro 24k */}
            <polygon
              points="100,16 160,35 184,95 160,155 100,184 40,155 16,95 40,35"
              fill="#000000"
              stroke={`url(#${uniqueId}-gold-metallic)`}
              strokeWidth="4"
              filter={`url(#${uniqueId}-glow)`}
            />

            {/* O ÔNIX REAL & DIAMANTE NEGRO IMPERIAL */}
            <polygon
              points="100,30 148,45 168,95 148,145 100,170 52,145 32,95 52,45"
              fill="#0f172a"
              stroke="#ffffff"
              strokeWidth="1.2"
            />
            <polygon
              points="100,48 135,60 150,95 135,130 100,150 65,130 50,95 65,60"
              fill="#020617"
              stroke={`url(#${uniqueId}-gold-rim)`}
              strokeWidth="1.5"
            />

            {/* As 12 Pedras Preciosas do Peitoral Sacerdotal ao Redor */}
            {[
              { cx: 100, cy: 22, fill: `${uniqueId}-ruby-table` },
              { cx: 135, cy: 28, fill: `${uniqueId}-topaz-table` },
              { cx: 164, cy: 50, fill: `${uniqueId}-emerald-table` },
              { cx: 178, cy: 80, fill: `${uniqueId}-sapphire-table` },
              { cx: 172, cy: 115, fill: `${uniqueId}-amethyst-table` },
              { cx: 152, cy: 146, fill: `${uniqueId}-diamond-table` },
              { cx: 100, cy: 178, fill: `${uniqueId}-ruby-table` },
              { cx: 48, cy: 146, fill: `${uniqueId}-topaz-table` },
              { cx: 28, cy: 115, fill: `${uniqueId}-emerald-table` },
              { cx: 22, cy: 80, fill: `${uniqueId}-sapphire-table` },
              { cx: 36, cy: 50, fill: `${uniqueId}-amethyst-table` },
              { cx: 65, cy: 28, fill: `${uniqueId}-diamond-table` }
            ].map((p, idx) => (
              <circle key={idx} cx={p.cx} cy={p.cy} r="4" fill={`url(#${p.fill})`} stroke="#fff" strokeWidth="0.8" />
            ))}

            {/* Estrela Patriarcal de Platina no Centro */}
            <g transform="translate(0, 0)">
              <polygon
                points="100,60 108,85 135,95 108,105 100,130 92,105 65,95 92,85"
                fill={`url(#${uniqueId}-platinum)`}
                stroke="#ffffff"
                strokeWidth="1"
                filter={`url(#${uniqueId}-glow)`}
              />
              <circle cx="100" cy="95" r="7" fill={`url(#${uniqueId}-gold-rim)`} />
              <circle cx="100" cy="95" r="4.5" fill="#ffffff" filter={`url(#${uniqueId}-glow)`} />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};
