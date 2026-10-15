/**
 * @license
 * CIMADEBE / SIGM - Ministerial Card Component (CR80 Standard: 856x540)
 * Matriz Vetorial Oficial com Centralização Geométrica Absoluta das Logomarcas
 */

import React, { useId, useState, useEffect, forwardRef } from 'react';
import QRCode from 'qrcode';
import { useSecurity } from '../SecurityContext';
import type { Ministro } from '../types';

export interface MinisterialCardProps {
  readonly ministro?: Partial<Ministro> | null;
  readonly verso?: boolean;
  readonly width?: number | string;
  readonly height?: number | string;
  readonly tarjaInadimplente?: boolean;
  readonly className?: string;
}

const truncateText = (text: string, maxChars: number) => {
  if (!text) return '';
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '...';
};

export const MinisterialCard = forwardRef<SVGSVGElement, MinisterialCardProps>(
  function MinisterialCard(
    {
      ministro,
      verso = false,
      width = '100%',
      height = 'auto',
      tarjaInadimplente = false,
      className = 'select-none shadow-2xl rounded-[16px]',
    },
    ref
  ) {
    const uid = useId().replace(/:/g, '-');
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

    let appConfig: any = null;
    let membrosMesa: readonly any[] = [];
    try {
      const security = useSecurity();
      appConfig = security?.appConfig;
      membrosMesa = security?.membrosMesaDiretora || [];
    } catch (e) {
      // Fallback
    }

    // 1. Dados da Convenção (Apenas se configurado no appConfig, sem mocks)
    const safeSigla = (
      appConfig?.sigla ||
      (appConfig?.nomeConvencao ? appConfig.nomeConvencao.split(' ')[0] : '')
    ).toUpperCase();

    const safeNomeConvencao = (appConfig?.nomeConvencao || '').toUpperCase();
    const safeCnpj = appConfig?.cnpj || '';
    const safeContatoConvencao = appConfig?.telefone || appConfig?.contato || '';
    const safeAnoFundacao = appConfig?.anoCriacao || appConfig?.anoFundacao || '';
    const safeCidadeUf =
      appConfig?.cidade && appConfig?.uf
        ? `${appConfig.cidade} / ${appConfig.uf}`.toUpperCase()
        : (appConfig?.cidade || appConfig?.uf || '').toUpperCase();
    const safeRegistroRcpj = appConfig?.registroRcpj || '';

    // Presidente da Mesa Diretora
    const presidenteMembro = membrosMesa.find(
      (m) =>
        m.cargoMesa &&
        m.cargoMesa.toLowerCase().includes('presidente') &&
        !m.cargoMesa.toLowerCase().includes('vice') &&
        !m.cargoMesa.toLowerCase().includes('conselho')
    );
    const safePresidenteNome = (
      presidenteMembro?.nome ||
      appConfig?.presidenteNome ||
      ''
    ).toUpperCase();

    // 2. Dados do Ministro (Lei Estrita de Renderização - Sem Dados Fictícios ou Placeholders)
    const safeNome = ministro?.nome || '';
    const safeCargo = ministro?.cargo ? String(ministro.cargo).toUpperCase() : '';
    const safeCpf = ministro?.cpf || '';

    // RM
    let safeRm = '';
    if (ministro?.registroMinisterial) {
      safeRm = ministro.registroMinisterial.startsWith('RM')
        ? ministro.registroMinisterial
        : `RM-${ministro.registroMinisterial}`;
    } else if (safeCpf) {
      const clean = safeCpf.replace(/\D/g, '');
      if (clean.length >= 6) {
        safeRm = `RM-${clean.slice(0, 3)}.${clean.slice(3, 6)}`;
      }
    }

    const safeFiliacao =
      ministro?.dataConsagracao || (ministro as any)?.dataFiliacao || '';
    const safeDataNascimento = ministro?.dataNascimento || '';
    const safeSede =
      ministro?.igrejaFiliadaNome ||
      (ministro as any)?.igrejaSede ||
      '';
    const safeStatus = ministro?.status || '';
    const safeAdimplencia = ministro?.statusAdimplencia || '';
    const safeStatusFull = safeStatus
      ? safeAdimplencia
        ? `${safeStatus} • ${safeAdimplencia}`
        : safeStatus
      : safeAdimplencia || '';

    // QR Code: Apenas se houver identificador real
    useEffect(() => {
      let isMounted = true;
      const idValido = ministro?.id || (safeCpf ? safeCpf.replace(/\D/g, '') : '');
      if (!idValido) {
        setQrCodeDataUrl('');
        return;
      }
      const validationUrl = `https://cimadebe.org.br/validar/${idValido}`;
      QRCode.toDataURL(validationUrl, {
        margin: 1,
        width: 280,
        color: {
          dark: '#03172E',
          light: '#FFFFFF',
        },
      })
        .then((url) => {
          if (isMounted) setQrCodeDataUrl(url);
        })
        .catch(() => {});
      return () => {
        isMounted = false;
      };
    }, [ministro?.id, safeCpf]);

    const xPoints = [30, 90, 150, 210, 270, 330, 390, 450, 510, 570, 630, 690, 750, 810];
    const yPoints = [30, 90, 150, 210, 270, 330, 390, 450, 510];

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        viewBox="0 0 856 540"
        width={width}
        height={height}
        className={className}
      >
        <defs>
          {/* Fundo Gradiente Íris de Alta Segurança */}
          <linearGradient id={`rgSecurityIris-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="18%" stopColor="#F0F9FF" />
            <stop offset="38%" stopColor="#F8FAFC" />
            <stop offset="55%" stopColor="#FFFDF7" />
            <stop offset="75%" stopColor="#F0FDF4" />
            <stop offset="90%" stopColor="#EFF6FF" />
            <stop offset="100%" stopColor="#FFFFFF" />
          </linearGradient>

          {/* Halo Central Suave */}
          <radialGradient id={`rgCenterSunburst-${uid}`} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="30%" stopColor="#FEF9C3" stopOpacity="0.25" />
            <stop offset="65%" stopColor="#DCFCE7" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>

          {/* Gradiente Azul Marinho & Azul Real Nobre */}
          <linearGradient id={`headerRoyalNavy-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#061838" />
            <stop offset="45%" stopColor="#0B2F64" />
            <stop offset="100%" stopColor="#0E3D7D" />
          </linearGradient>

          {/* Gradiente Moldura Dourada da Foto */}
          <linearGradient id={`goldBorder-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C59B27" />
            <stop offset="50%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#A16207" />
          </linearGradient>

          {/* Clip Path da Foto com Cantos Arredondados */}
          <clipPath id={`avatarClipCR80-${uid}`}>
            <rect x="0" y="0" width="160" height="200" rx="8" />
          </clipPath>
        </defs>

        {/* ========================================================================= */}
        {/* BASE DO CARTÃO CR-80 (PADRÃO INTERNACIONAL 856 x 540) COM BORDA DOURADA   */}
        {/* ========================================================================= */}
        <rect
          width="856"
          height="540"
          rx="8"
          fill={`url(#rgSecurityIris-${uid})`}
          stroke={`url(#goldBorder-${uid})`}
          strokeWidth="3.2"
          opacity="1.0"
        />

        {/* HALO CENTRAL & MOLDURA INTERNA */}
        <rect
          x="8"
          y="8"
          width="840"
          height="524"
          rx="6"
          fill={`url(#rgCenterSunburst-${uid})`}
          stroke="#0284C7"
          strokeWidth="1.5"
          opacity="0.9"
        />

        {/* ========================================================================= */}
        {/* TRAMA COMPLETA DE MICRO-ONDAS DE CALCOGRAFIA (AZUL, VERDE E OURO)         */}
        {/* ========================================================================= */}
        <g id={`Trama_MicroOndas_Calcografia-${uid}`} fill="none">
          {Array.from({ length: 23 }).map((_, i) => {
            const y = 12 + i * 24;
            return (
              <path
                key={`calc-blue-${i}`}
                d={
                  `M 0 ${y} Q 12 ${y - 12}, 24 ${y} ` +
                  Array.from({ length: 35 })
                    .map((__, j) => `T ${(j + 2) * 24} ${y}`)
                    .join(' ')
                }
                stroke="#0284C7"
                strokeWidth={0.65}
                opacity={0.4}
              />
            );
          })}

          {Array.from({ length: 23 }).map((_, i) => {
            const y = 18 + i * 24;
            return (
              <path
                key={`calc-green-${i}`}
                d={
                  `M 0 ${y} Q 12 ${y - 12}, 24 ${y} ` +
                  Array.from({ length: 35 })
                    .map((__, j) => `T ${(j + 2) * 24} ${y}`)
                    .join(' ')
                }
                stroke="#059669"
                strokeWidth={0.55}
                opacity={0.38}
              />
            );
          })}

          {Array.from({ length: 23 }).map((_, i) => {
            const y = 6 + i * 24;
            return (
              <path
                key={`calc-gold-${i}`}
                d={
                  `M 0 ${y} Q 12 ${y + 12}, 24 ${y} ` +
                  Array.from({ length: 35 })
                    .map((__, j) => `T ${(j + 2) * 24} ${y}`)
                    .join(' ')
                }
                stroke="#D97706"
                strokeWidth={0.45}
                opacity={0.32}
              />
            );
          })}
        </g>

        {/* ========================================================================= */}
        {/* GRADE DE ANÉIS CONCÊNTRICOS DE SEGURANÇA                                  */}
        {/* ========================================================================= */}
        <g id={`Trama_Aneis_Seguranca-${uid}`} fill="none">
          {xPoints.map((cx) =>
            yPoints.map((cy) => (
              <g key={`ring-${cx}-${cy}`}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={18}
                  stroke="#0284C7"
                  strokeWidth={0.5}
                  strokeDasharray="2 3"
                  opacity={0.28}
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={10}
                  stroke="#059669"
                  strokeWidth={0.45}
                  opacity={0.28}
                />
              </g>
            ))
          )}
        </g>

        {/* ========================================================================= */}
        {/* FEIXES DE LINHAS GUILLOCHÉ SINUOSAS DE ALTA PRECISÃO                      */}
        {/* ========================================================================= */}
        <g id={`Feixes_Linhas_Guilloche-${uid}`} fill="none">
          <path
            d="M -20 160 C 240 80, 520 240, 880 130"
            stroke="#0284C7"
            strokeWidth={1.6}
            opacity={0.55}
          />
          <path
            d="M -20 172 C 240 92, 520 252, 880 142"
            stroke="#D97706"
            strokeWidth={1.4}
            strokeDasharray="8 3"
            opacity={0.6}
          />
          <path
            d="M -20 184 C 240 104, 520 264, 880 154"
            stroke="#059669"
            strokeWidth={1.3}
            opacity={0.5}
          />
          <path
            d="M -20 196 C 240 116, 520 276, 880 166"
            stroke="#0284C7"
            strokeWidth={1.1}
            strokeDasharray="4 2"
            opacity={0.45}
          />

          <path
            d="M -20 340 C 260 230, 560 450, 880 290"
            stroke="#D97706"
            strokeWidth={1.8}
            opacity={0.55}
          />
          <path
            d="M -20 354 C 260 244, 560 464, 880 304"
            stroke="#0284C7"
            strokeWidth={1.4}
            strokeDasharray="6 3"
            opacity={0.5}
          />
          <path
            d="M -20 368 C 260 258, 560 478, 880 318"
            stroke="#059669"
            strokeWidth={1.3}
            opacity={0.45}
          />

          <path
            d="M 60 560 C 320 440, 600 540, 880 430"
            stroke="#0284C7"
            strokeWidth={1.6}
            opacity={0.5}
          />
          <path
            d="M 80 560 C 340 454, 620 554, 880 444"
            stroke="#D97706"
            strokeWidth={1.2}
            strokeDasharray="5 3"
            opacity={0.5}
          />
        </g>

        {/* ========================================================================= */}
        {/* ROSETA GEOMÉTRICA CENTRALIZADA NO PONTO MÉDIO EXATO (428, 270)            */}
        {/* ========================================================================= */}
        <g id={`Marca_Dagua_Roseta-${uid}`} transform="translate(428, 270)" fill="none">
          <circle
            cx={0}
            cy={0}
            r={165}
            stroke="#0284C7"
            strokeWidth={0.8}
            strokeDasharray="3 3"
            opacity={0.35}
          />
          <circle cx={0} cy={0} r={138} stroke="#D97706" strokeWidth={1.4} opacity={0.45} />
          <circle cx={0} cy={0} r={112} stroke="#059669" strokeWidth={0.9} opacity={0.4} />
          <circle
            cx={0}
            cy={0}
            r={84}
            stroke="#0284C7"
            strokeWidth={1.1}
            strokeDasharray="5 2"
            opacity={0.35}
          />

          <g stroke="#D97706" strokeWidth={0.85} opacity={0.4}>
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

        {/* ========================================================================= */}
        {/* LOGO DO FUNDO E CÍRCULO DOURADO REMOVIDOS - FUNDO LIMPO COM GUILLOCHÉ      */}
        {/* ========================================================================= */}

        {verso ? (
          /* ========================================================================= */
          /* VERSO (REVERSO) COM GRADIENTE AZUL MARINHO E CENTRALIZAÇÃO MATEMÁTICA     */
          /* ========================================================================= */
          <g id={`Verso_Oficial-${uid}`}>
            {/* 1. Barra Superior com Gradiente Azul Marinho */}
            <g transform="translate(28, 16)">
              <rect
                width="800"
                height="74"
                rx="10"
                fill={`url(#headerRoyalNavy-${uid})`}
                stroke="#1E40AF"
                strokeWidth={1}
              />
              <text
                x="24"
                y="42"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="12.5"
                fontWeight="bold"
                fill="#CBD5E1"
                letterSpacing="1.2"
              >
                {safeSigla} • PVC CR-80 CONTACTLESS SECURE ENCLAVE
              </text>
              <text
                x="776"
                y="42"
                textAnchor="end"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="13"
                fontWeight="bold"
                fill="#FDE047"
                letterSpacing="1.2"
              >
                ISO/IEC 7810 ID-1
              </text>
            </g>

            {/* 2. Faixa Mesa Diretora */}
            <g transform="translate(28, 106)">
              <rect width="580" height="36" rx="6" fill="#0B2F64" stroke="#1D4ED8" strokeWidth={0.8} />
              <rect x="0" y="0" width="10" height="36" rx="4" fill="#EA580C" />
              <text
                x="26"
                y="22"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="11.5"
                fontWeight="bold"
                fill="#FFFFFF"
                letterSpacing="1.2"
              >
                MESA DIRETORA EXECUTIVA • ÓRGÃO EXECUTIVO CENTRAL
              </text>
            </g>

            {/* Badge SHA-256 DIGITAL */}
            <g transform="translate(650, 106)">
              <rect
                width="178"
                height="36"
                rx="8"
                fill="#F0FDF4"
                stroke="#86EFAC"
                strokeWidth="1.2"
              />
              <text
                x="89"
                y="23"
                textAnchor="middle"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="11"
                fontWeight="900"
                fill="#0F766E"
                letterSpacing="1.2"
              >
                SHA-256 DIGITAL
              </text>
            </g>

            {/* 3. Dados: Registro RCPJ & Datas */}
            <g transform="translate(28, 158)">
              {/* Registro Nacional Institucional */}
              <text
                x="0"
                y="0"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="9"
                fontWeight="bold"
                fill="#475569"
                letterSpacing="0.6"
              >
                REGISTRO NACIONAL INSTITUCIONAL
              </text>
              <text
                x="0"
                y="20"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="15"
                fontWeight="900"
                fill="#0F172A"
                letterSpacing="0.4"
              >
                {safeRegistroRcpj}
              </text>

              {/* Data de Consagração & Data de Nascimento */}
              <g transform="translate(0, 44)">
                <text
                  x="0"
                  y="0"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontSize="9"
                  fontWeight="bold"
                  fill="#475569"
                  letterSpacing="0.6"
                >
                  DATA DE CONSAGRAÇÃO
                </text>
                <text
                  x="0"
                  y="20"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontSize="15.5"
                  fontWeight="900"
                  fill="#0F172A"
                  letterSpacing="0.5"
                >
                  {safeFiliacao}
                </text>

                <text
                  x="300"
                  y="0"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontSize="9"
                  fontWeight="bold"
                  fill="#475569"
                  letterSpacing="0.6"
                >
                  DATA DE NASCIMENTO
                </text>
                <text
                  x="300"
                  y="20"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontSize="15.5"
                  fontWeight="900"
                  fill="#0F172A"
                  letterSpacing="0.5"
                >
                  {safeDataNascimento}
                </text>
              </g>
            </g>

            {/* 4. Caixa: INFORMAÇÕES ESTATUTÁRIAS E DECLARAÇÃO DE FÉ */}
            <g transform="translate(28, 250)">
              <rect
                width="580"
                height="200"
                rx="10"
                fill="#FFFFFF"
                fillOpacity={0.94}
                stroke="#CBD5E1"
                strokeWidth="1.2"
              />
              <text
                x="16"
                y="24"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="11.5"
                fontWeight="900"
                fill="#0F2B57"
                letterSpacing="0.8"
              >
                INFORMAÇÕES ESTATUTÁRIAS E DECLARAÇÃO DE FÉ
              </text>
              <line x1="16" y1="34" x2="564" y2="34" stroke="#CBD5E1" strokeWidth={1} />

              <text x="16" y="58" fontFamily="Arial, Helvetica, sans-serif" fontSize="9.5" fontWeight="500" fill="#1E293B">
                1. O portador desta credencial é ministro eclesiástico filiado à Convenção.
              </text>
              <text x="16" y="84" fontFamily="Arial, Helvetica, sans-serif" fontSize="9.5" fontWeight="500" fill="#1E293B">
                2. Documento válido em todo o território nacional para o exercício das funções.
              </text>
              <text x="16" y="110" fontFamily="Arial, Helvetica, sans-serif" fontSize="9.5" fontWeight="500" fill="#1E293B">
                3. A validade jurídica e eclesiástica está sujeita à adimplência contábil.
              </text>
              <text x="16" y="136" fontFamily="Arial, Helvetica, sans-serif" fontSize="9.5" fontWeight="500" fill="#1E293B">
                4. Em caso de extravio, comunique imediatamente a Secretaria Geral.
              </text>
              <text x="16" y="162" fontFamily="Arial, Helvetica, sans-serif" fontSize="9.5" fontWeight="500" fill="#1E293B">
                5. Documento pessoal, intransferível e de propriedade da Convenção.
              </text>
            </g>

            {/* 5. QR Code à Direita com Validação Digital */}
            <g transform="translate(650, 158)">
              <rect
                width="178"
                height="178"
                rx="14"
                fill="#FFFFFF"
                stroke="#059669"
                strokeWidth="2.4"
              />
              {qrCodeDataUrl ? (
                <image
                  href={qrCodeDataUrl}
                  x="14"
                  y="14"
                  width="150"
                  height="150"
                  preserveAspectRatio="xMidYMid meet"
                />
              ) : (
                <rect x="14" y="14" width="150" height="150" fill="#0A1829" />
              )}
              <text
                x="89"
                y="204"
                textAnchor="middle"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="12"
                fontWeight="900"
                fill="#065F46"
                letterSpacing="1.0"
              >
                VALIDAÇÃO DIGITAL
              </text>
              <text
                x="89"
                y="222"
                textAnchor="middle"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="9"
                fontWeight="bold"
                fill="#64748B"
              >
                Aponte a câmera
              </text>
            </g>

            {/* 6. Rodapé Inferior */}
            <g transform="translate(28, 498)">
              <line x1="0" y1="0" x2="800" y2="0" stroke="#CBD5E1" strokeWidth={0.8} />
              <text
                x="0"
                y="16"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="8.5"
                fontWeight="bold"
                fill="#64748B"
              >
                Art. 5º, VI e VII da CF/88 • Válido em todo território nacional
              </text>
              <text
                x="400"
                y="16"
                textAnchor="middle"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="10"
                fontWeight="900"
                fill="#0F766E"
                letterSpacing="1.2"
              >
                {safeSigla} OFICIAL
              </text>
              <text
                x="800"
                y="16"
                textAnchor="end"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="8.5"
                fontWeight="bold"
                fill="#64748B"
              >
                {safeCidadeUf}
              </text>
            </g>
          </g>
        ) : (
          /* ========================================================================= */
          /* FRENTE (ANVERSO) COM CENTRALIZAÇÃO MATEMÁTICA ABSOLUTA                    */
          /* ========================================================================= */
          <g id={`Frente_Oficial-${uid}`}>
            {/* 1. Cabeçalho com Gradiente Azul Marinho & Azul Real */}
            <g transform="translate(28, 16)">
              <rect
                width="800"
                height="100"
                rx="12"
                fill={`url(#headerRoyalNavy-${uid})`}
                stroke="#1E40AF"
                strokeWidth={1.2}
              />

              {/* Brasão Circular à Esquerda (Centralizado Verticalmente no Cabeçalho) */}
              <g transform="translate(14, 8)">
                <circle cx="42" cy="42" r="42" fill="#FFFFFF" stroke={`url(#goldBorder-${uid})`} strokeWidth="3.5" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.3))" />
                {appConfig?.logomarca ? (
                  <>
                    <clipPath id={`logoFrontClip-${uid}`}>
                      <circle cx="42" cy="42" r="42" />
                    </clipPath>
                    <image
                      href={appConfig.logomarca}
                      x="-4"
                      y="-4"
                      width="92"
                      height="92"
                      clipPath={`url(#logoFrontClip-${uid})`}
                      preserveAspectRatio="xMidYMid slice"
                    />
                  </>
                ) : (
                  <g>
                    <circle cx="42" cy="42" r="41" fill="#0B2F64" />
                    <circle cx="42" cy="42" r="37" fill="none" stroke="#FDE047" strokeWidth="1.5" strokeDasharray="3 2" />
                    <polygon points="42,4 51,28 80,42 51,56 42,80 33,56 4,42 33,28" fill="#FDE047" />
                    <circle cx="42" cy="42" r="11" fill="#FFFFFF" />
                    <text
                      x="42"
                      y="76"
                      fontFamily="Arial, Helvetica, sans-serif"
                      fontSize="7.5"
                      fontWeight="900"
                      fill="#FDE047"
                      letterSpacing="0.8"
                      textAnchor="middle"
                    >
                      {safeSigla}
                    </text>
                  </g>
                )}
              </g>

              {/* Textos do Cabeçalho */}
              <text
                x="116"
                y="36"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="27"
                fontWeight="900"
                fill="#FFFFFF"
                letterSpacing="2.5"
              >
                {safeSigla}
              </text>

              <text
                x="116"
                y="60"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="10"
                fontWeight="bold"
                fill="#FDE047"
                letterSpacing="1.0"
              >
                {safeNomeConvencao}
              </text>

              <text
                x="116"
                y="82"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="8.5"
                fontWeight="bold"
                fill="#E2E8F0"
                letterSpacing="0.8"
              >
                CNPJ: {safeCnpj} • CONTATO: {safeContatoConvencao} • FUNDADA EM {safeAnoFundacao}
              </text>

              {/* Badge Oficial à Direita */}
              <g transform="translate(706, 20)">
                <rect
                  width="78"
                  height="58"
                  rx="6"
                  fill="#061838"
                  stroke="#C59B27"
                  strokeWidth="1.2"
                />
                <text
                  x="39"
                  y="18"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontSize="6.5"
                  fontWeight="bold"
                  fill="#93C5FD"
                  textAnchor="middle"
                  letterSpacing="1.0"
                >
                  {safeSigla}
                </text>
                <text
                  x="39"
                  y="34"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontSize="10.5"
                  fontWeight="900"
                  fill="#FFFFFF"
                  textAnchor="middle"
                  letterSpacing="1.0"
                >
                  OFICIAL
                </text>
                <text
                  x="39"
                  y="48"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontSize="6.5"
                  fontWeight="bold"
                  fill="#FDE047"
                  textAnchor="middle"
                >
                  ESTATUTO
                </text>
              </g>
            </g>

            {/* Texto Vertical na Borda Esquerda */}
            <text
              transform="rotate(-90)"
              x="-380"
              y="20"
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize="7"
              fontWeight="bold"
              fill="#0284C7"
              letterSpacing="2.5"
              opacity="0.9"
            >
              VÁLIDO EM TODO O TERRITÓRIO NACIONAL
            </text>

            {/* 2. Foto 3x4 (Deslocada para baixo em y=144, Altura=200, Base em y=344) */}
            <g transform="translate(36, 144)">
              {/* Moldura Dourada Externa */}
              <rect
                x="-4"
                y="-4"
                width="168"
                height="208"
                rx="18"
                fill="none"
                stroke={`url(#goldBorder-${uid})`}
                strokeWidth="4"
              />

              {ministro?.fotoUrl ? (
                <g clipPath={`url(#avatarClipCR80-${uid})`}>
                  <image
                    href={ministro.fotoUrl}
                    x="0"
                    y="0"
                    width="160"
                    height="200"
                    preserveAspectRatio="xMidYMid slice"
                  />
                </g>
              ) : (
                <g clipPath={`url(#avatarClipCR80-${uid})`}>
                  <rect width="160" height="200" fill="#E2E8F0" />
                  <circle cx="80" cy="80" r="36" fill="#CBD5E1" />
                  <path
                    d="M 30 200 C 30 145, 55 125, 80 125 C 105 125, 130 145, 130 200 Z"
                    fill="#CBD5E1"
                  />
                </g>
              )}
            </g>

            {/* 3. Bloco de Identificação */}
            <g transform="translate(224, 144)">
              <text
                x="0"
                y="12"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="9"
                fontWeight="bold"
                fill="#475569"
                letterSpacing="1.0"
              >
                MINISTRO OBREIRO
              </text>
              <text
                x="0"
                y="40"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="23"
                fontWeight="900"
                fill="#0A1E3F"
                letterSpacing="0.2"
              >
                {truncateText(safeNome, 34)}
              </text>

              <text
                x="0"
                y="72"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="9"
                fontWeight="bold"
                fill="#475569"
                letterSpacing="1.0"
              >
                FUNÇÃO / CONSAGRAÇÃO ECLESIÁSTICA
              </text>
              <text
                x="0"
                y="100"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="21"
                fontWeight="900"
                fill="#0F172A"
                letterSpacing="0.5"
              >
                {safeCargo}
              </text>

              {/* 4. Três Caixas Arredondadas (Niveladas exatamente na base da foto: y=124 + 76 = 200) */}
              <g transform="translate(0, 124)">
                <rect
                  width="604"
                  height="76"
                  rx="10"
                  fill="#FFFFFF"
                  fillOpacity={0.96}
                  stroke="#CBD5E1"
                  strokeWidth="1.2"
                />

                {/* Coluna 1: Registro Ministerial */}
                <g transform="translate(20, 20)">
                  <text
                    x="0"
                    y="0"
                    fontFamily="Arial, Helvetica, sans-serif"
                    fontSize="8.5"
                    fontWeight="bold"
                    fill="#475569"
                    letterSpacing="0.6"
                  >
                    REGISTRO MINISTERIAL
                  </text>
                  <text
                    x="0"
                    y="26"
                    fontFamily="Arial, Helvetica, sans-serif"
                    fontSize="16"
                    fontWeight="900"
                    fill="#0284C7"
                    letterSpacing="0.5"
                  >
                    {safeRm}
                  </text>
                </g>

                {/* Coluna 2: CPF Registrado */}
                <g transform="translate(225, 20)">
                  <text
                    x="0"
                    y="0"
                    fontFamily="Arial, Helvetica, sans-serif"
                    fontSize="8.5"
                    fontWeight="bold"
                    fill="#475569"
                    letterSpacing="0.6"
                  >
                    CPF REGISTRADO
                  </text>
                  <text
                    x="0"
                    y="26"
                    fontFamily="Arial, Helvetica, sans-serif"
                    fontSize="16"
                    fontWeight="900"
                    fill="#0F172A"
                    letterSpacing="0.5"
                  >
                    {safeCpf}
                  </text>
                </g>

                {/* Coluna 3: Filiação */}
                <g transform="translate(425, 20)">
                  <text
                    x="0"
                    y="0"
                    fontFamily="Arial, Helvetica, sans-serif"
                    fontSize="8.5"
                    fontWeight="bold"
                    fill="#475569"
                    letterSpacing="0.6"
                  >
                    FILIAÇÃO
                  </text>
                  <text
                    x="0"
                    y="26"
                    fontFamily="Arial, Helvetica, sans-serif"
                    fontSize="16"
                    fontWeight="900"
                    fill="#059669"
                    letterSpacing="0.5"
                  >
                    {safeFiliacao}
                  </text>
                </g>
              </g>
            </g>

            {/* 5. Caixa Inferior (Deslocada para y=378, respiro de 34px da foto) */}
            <g transform="translate(28, 378)">
              <rect
                width="800"
                height="92"
                rx="12"
                fill="#FFFFFF"
                fillOpacity={0.96}
                stroke="#CBD5E1"
                strokeWidth="1.2"
              />

              {/* Coluna 1: Status do Ministro */}
              <g transform="translate(24, 24)">
                <text
                  x="0"
                  y="0"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontSize="8.5"
                  fontWeight="bold"
                  fill="#475569"
                  letterSpacing="0.6"
                >
                  STATUS DO MINISTRO
                </text>
                <text
                  x="0"
                  y="30"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontSize="14.5"
                  fontWeight="900"
                  fill="#059669"
                  letterSpacing="0.5"
                >
                  {safeStatusFull}
                </text>
              </g>

              {/* Coluna 2: Sede Convencional */}
              <g transform="translate(265, 24)">
                <text
                  x="0"
                  y="0"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontSize="8.5"
                  fontWeight="bold"
                  fill="#475569"
                  letterSpacing="0.6"
                >
                  SEDE CONVENCIONAL
                </text>
                <text
                  x="0"
                  y="30"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontSize="14.5"
                  fontWeight="900"
                  fill="#0F172A"
                  letterSpacing="0.2"
                >
                  {truncateText(safeSede, 28)}
                </text>
              </g>

              {/* Coluna 3: Assinatura Digital com Rubrica Azul */}
              <g transform="translate(545, 16)">
                <text
                  x="115"
                  y="0"
                  textAnchor="middle"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontSize="8.5"
                  fontWeight="bold"
                  fill="#475569"
                  letterSpacing="0.6"
                >
                  ASSINATURA DIGITAL
                </text>

                {/* Rubrica Curva Azul */}
                <path
                  d="M 20 20 Q 70 8, 120 24 T 210 18"
                  fill="none"
                  stroke="#0284C7"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />

                <text
                  x="115"
                  y="38"
                  textAnchor="middle"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontSize="9.5"
                  fontWeight="900"
                  fill="#0F172A"
                >
                  {safePresidenteNome}
                </text>
                <text
                  x="115"
                  y="52"
                  textAnchor="middle"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontSize="7.5"
                  fontWeight="600"
                  fill="#64748B"
                >
                  Presidente Geral Estatutário
                </text>
              </g>
            </g>

            {/* 6. Rodapé Central: CARTEIRA DE IDENTIDADE MINISTERIAL */}
            <text
              x="428"
              y="508"
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize="14"
              fontWeight="900"
              fill="#0A2540"
              letterSpacing="2.8"
              textAnchor="middle"
            >
              CARTEIRA DE IDENTIDADE MINISTERIAL
            </text>
          </g>
        )}

        {/* Borda Externa de Corte e Contorno Nítido */}
        <rect
          x="6"
          y="6"
          width="844"
          height="528"
          rx="6"
          fill="none"
          stroke="#0284C7"
          strokeWidth="1.8"
          strokeDasharray="6 3"
          opacity={0.95}
        />

        {/* Tarja de Inadimplência Se Houver Veto */}
        {tarjaInadimplente && (
          <g transform="rotate(-25 428 270)">
            <rect x="-200" y="235" width="1256" height="70" fill="#881337" opacity="0.95" />
            <text
              x="428"
              y="280"
              fill="#ffffff"
              fontSize="32"
              fontWeight="900"
              fontFamily="monospace"
              letterSpacing="4"
              textAnchor="middle"
            >
              DOCUMENTO INVÁLIDO - INADIMPLENTE
            </text>
          </g>
        )}
      </svg>
    );
  }
);
