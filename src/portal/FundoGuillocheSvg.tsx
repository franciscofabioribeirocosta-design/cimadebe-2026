/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Fundo de Segurança Vetorial Guilloché Oficial (Compatível 100% CorelDRAW)
 */

import React from 'react';

export const FundoGuillocheDefs: React.FC = () => (
  <>
    <linearGradient id="rgSecurityIris" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#FFFFFF" />
      <stop offset="18%" stopColor="#F4FAFD" />
      <stop offset="38%" stopColor="#FBFDF6" />
      <stop offset="55%" stopColor="#FFFDF7" />
      <stop offset="75%" stopColor="#F5FAF6" />
      <stop offset="90%" stopColor="#F3F9FC" />
      <stop offset="100%" stopColor="#FFFFFF" />
    </linearGradient>
    <radialGradient id="rgCenterSunburst" cx="50%" cy="50%" r="58%">
      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
      <stop offset="30%" stopColor="#FEF9C3" stopOpacity="0.25" />
      <stop offset="65%" stopColor="#DCFCE7" stopOpacity="0.15" />
      <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="headerNavy" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stopColor="#081830" />
      <stop offset="50%" stopColor="#0F2B57" />
      <stop offset="100%" stopColor="#081830" />
    </linearGradient>
    <linearGradient id="goldSeal" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#8F6B23" />
      <stop offset="25%" stopColor="#C5A04E" />
      <stop offset="50%" stopColor="#FDE8A5" />
      <stop offset="75%" stopColor="#C5A04E" />
      <stop offset="100%" stopColor="#7A5614" />
    </linearGradient>
    <linearGradient id="headerDarkGold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stopColor="#141006" />
      <stop offset="50%" stopColor="#241B08" />
      <stop offset="100%" stopColor="#141006" />
    </linearGradient>
  </>
);

export const CamadaFundoGuillocheOficial: React.FC = () => {
  // Geração exata da grade de anéis de segurança 30..810 x 30..510
  const xPoints = [30, 90, 150, 210, 270, 330, 390, 450, 510, 570, 630, 690, 750, 810];
  const yPoints = [30, 90, 150, 210, 270, 330, 390, 450, 510];

  return (
    <g id="Camada_Fundo_Frente">
      {/* Base Estrutural com Cantos Arredondados CR-80 Leves */}
      <rect id="Base_Cartao" width="856" height="540" rx="8" fill="url(#rgSecurityIris)" stroke="#CBD5E1" strokeWidth={1.2} />
      <rect id="Halo_Central" x="12" y="12" width="832" height="516" rx="6" fill="url(#rgCenterSunburst)" />

      {/* Trama de MicroOndas Calcografia */}
      <g id="Trama_MicroOndas_Calcografia" fill="none">
        {/* Camada Azul (#0284C7) */}
        {Array.from({ length: 23 }).map((_, i) => {
          const y = 12 + i * 24;
          return (
            <path
              key={`calc-blue-${i}`}
              d={`M 0 ${y} Q 12 ${y - 12}, 24 ${y} ` + Array.from({ length: 35 }).map((__, j) => `T ${(j + 2) * 24} ${y}`).join(' ')}
              stroke="#0284C7"
              strokeWidth={0.65}
              opacity={0.4}
            />
          );
        })}

        {/* Camada Verde (#059669) */}
        {Array.from({ length: 23 }).map((_, i) => {
          const y = 18 + i * 24;
          return (
            <path
              key={`calc-green-${i}`}
              d={`M 0 ${y} Q 12 ${y - 12}, 24 ${y} ` + Array.from({ length: 35 }).map((__, j) => `T ${(j + 2) * 24} ${y}`).join(' ')}
              stroke="#059669"
              strokeWidth={0.55}
              opacity={0.4}
            />
          );
        })}

        {/* Camada Ouro (#D97706) */}
        {Array.from({ length: 23 }).map((_, i) => {
          const y = 6 + i * 24;
          return (
            <path
              key={`calc-gold-${i}`}
              d={`M 0 ${y} Q 12 ${y + 12}, 24 ${y} ` + Array.from({ length: 35 }).map((__, j) => `T ${(j + 2) * 24} ${y}`).join(' ')}
              stroke="#D97706"
              strokeWidth={0.45}
              opacity={0.3}
            />
          );
        })}
      </g>

      {/* Trama de Anéis de Segurança */}
      <g id="Trama_Aneis_Seguranca" fill="none">
        {xPoints.map((cx) =>
          yPoints.map((cy) => (
            <g key={`ring-${cx}-${cy}`}>
              <circle cx={cx} cy={cy} r={18} stroke="#0284C7" strokeWidth={0.5} strokeDasharray="2 3" opacity={0.3} />
              <circle cx={cx} cy={cy} r={10} stroke="#059669" strokeWidth={0.45} opacity={0.3} />
            </g>
          ))
        )}
      </g>

      {/* Feixes de Linhas Guilloché */}
      <g id="Feixes_Linhas_Guilloche" fill="none">
        <path d="M -20 160 C 240 80, 520 240, 880 130" stroke="#0284C7" strokeWidth={1.6} opacity={0.55} />
        <path d="M -20 172 C 240 92, 520 252, 880 142" stroke="#D97706" strokeWidth={1.4} strokeDasharray="8 3" opacity={0.6} />
        <path d="M -20 184 C 240 104, 520 264, 880 154" stroke="#059669" strokeWidth={1.3} opacity={0.5} />
        <path d="M -20 196 C 240 116, 520 276, 880 166" stroke="#0284C7" strokeWidth={1.1} strokeDasharray="4 2" opacity={0.45} />

        <path d="M -20 340 C 260 230, 560 450, 880 290" stroke="#D97706" strokeWidth={1.8} opacity={0.55} />
        <path d="M -20 354 C 260 244, 560 464, 880 304" stroke="#0284C7" strokeWidth={1.4} strokeDasharray="6 3" opacity={0.5} />
        <path d="M -20 368 C 260 258, 560 478, 880 318" stroke="#059669" strokeWidth={1.3} opacity={0.45} />

        <path d="M 60 560 C 320 440, 600 540, 880 430" stroke="#0284C7" strokeWidth={1.6} opacity={0.5} />
        <path d="M 80 560 C 340 454, 620 554, 880 444" stroke="#D97706" strokeWidth={1.2} strokeDasharray="5 3" opacity={0.5} />
      </g>

      {/* Marca D'Água / Roseta Central */}
      <g id="Marca_Dagua_Roseta" transform="translate(428, 270)" fill="none">
        <circle cx={0} cy={0} r={165} stroke="#0284C7" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.45} />
        <circle cx={0} cy={0} r={138} stroke="#D97706" strokeWidth={1.4} opacity={0.6} />
        <circle cx={0} cy={0} r={112} stroke="#059669" strokeWidth={0.9} opacity={0.5} />
        <circle cx={0} cy={0} r={84} stroke="#0284C7" strokeWidth={1.1} strokeDasharray="5 2" opacity={0.45} />

        <g stroke="#D97706" strokeWidth={0.85} opacity={0.5}>
          <ellipse cx={0} cy={0} rx={105} ry={30} transform="rotate(0)" />
          <ellipse cx={0} cy={0} rx={105} ry={30} transform="rotate(22.5)" stroke="#059669" />
          <ellipse cx={0} cy={0} rx={105} ry={30} transform="rotate(45)" />
          <ellipse cx={0} cy={0} rx={105} ry={30} transform="rotate(67.5)" stroke="#0284C7" />
          <ellipse cx={0} cy={0} rx={105} ry={30} transform="rotate(90)" />
          <ellipse cx={0} cy={0} rx={105} ry={30} transform="rotate(112.5)" stroke="#059669" />
          <ellipse cx={0} cy={0} rx={105} ry={30} transform="rotate(135)" />
          <ellipse cx={0} cy={0} rx={105} ry={30} transform="rotate(157.5)" stroke="#0284C7" />
        </g>
      </g>

      {/* Borda Dupla Externa de Segurança */}
      <rect id="Borda_Seguranca" x={8} y={8} width={840} height={524} rx={7} fill="none" stroke="#94A3B8" strokeWidth={0.9} strokeDasharray="6 3" opacity={0.6} />
    </g>
  );
};
