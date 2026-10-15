/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Central de Verificação Pública de Credenciais & Carteirinha Digital 3D 360°
 * Física de Shader Holográfico Iridescente e Interatividade por Pointer Events
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSecurity } from '../SecurityContext';
import { sha256, base64ToUtf8, utf8ToBase64 } from '../crypto';
import type { Ministro } from '../types';
import { formatarDataBR, formatarRotuloStatus, obterBadgeClassStatus } from '../financialEngine';
import { MinisterialCard } from '../components/MinisterialCard';
import {
  ShieldCheck,
  ShieldAlert,
  Rotate3d,
  Sparkles,
  Search,
  Scan,
  CheckCircle2,
  XCircle,
  Play,
  Pause,
  RotateCcw,
  Fingerprint,
  Cpu,
  KeyRound,
  ExternalLink,
  ChevronRight,
  Shield,
  Layers,
  ZoomIn,
  ZoomOut,
  UserCheck,
  Download,
} from 'lucide-react';

const CHAVE_PRIVADA_CONVENCAO = 'CIMADEBE_SEC_KEY_2026_SIGM_CORE';

interface DecodedTokenPayload {
  readonly ministroId: string;
  readonly cpfHash: string;
  readonly tenantId: string;
  readonly statusAtual: string;
  readonly adimplencia: string;
  readonly timestampEmissao: string;
  readonly signature: string;
}

interface PublicCredentialVerificationProps {
  readonly tokenInicial?: string;
  readonly onVoltarAoPortal?: () => void;
}

export function PublicCredentialVerification({
  tokenInicial = '',
  onVoltarAoPortal,
}: PublicCredentialVerificationProps) {
  const { ministros, tenants, tenantAtivo, addAuditLog, membrosMesaDiretora } = useSecurity();

  // Estado do Token de Entrada
  const [tokenInput, setTokenInput] = useState<string>(tokenInicial);
  const [payloadDecodificado, setPayloadDecodificado] = useState<DecodedTokenPayload | null>(null);
  const [erroDecodificacao, setErroDecodificacao] = useState<string | null>(null);
  const [buscaSaneada, setBuscaSaneada] = useState<string>('');

  // Estados da Física Gráfica 3D e Pointer Events
  const [rotX, setRotX] = useState<number>(12);
  const [rotY, setRotY] = useState<number>(-18);
  const [zoom, setZoom] = useState<number>(1);
  const [isArrastando, setIsArrastando] = useState<boolean>(false);
  const [autoRotacao, setAutoRotacao] = useState<boolean>(false);

  // Posições de referência para cálculo delta de rotação
  const ultimaPosicaoRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animacaoFrameRef = useRef<number | null>(null);

  // Download do arquivo SVG vetorial oficial do Birô para edição direta no CorelDRAW
  const downloadSvgBiro3D = (side: 'frente' | 'verso') => {
    try {
      const container = document.getElementById(`biro-3d-vector-${side}`);
      const targetSvg = container?.querySelector('svg') || document.querySelector('svg');
      if (!targetSvg) {
        alert('Não foi possível localizar o vetor SVG para exportação.');
        return;
      }
      const svgContent = new XMLSerializer().serializeToString(targetSvg);
      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = svgUrl;
      const cpfLimpo = (ministroNoBanco?.cpf || 'doc').replace(/\D/g, '');
      downloadLink.download = `CIMADEBE_Credencial_${side}_CorelDRAW_${cpfLimpo}.svg`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(svgUrl);
    } catch (e) {
      console.error('Erro ao exportar SVG:', e);
      alert('Não foi possível exportar a credencial vetorial no momento.');
    }
  };

  // Amostra de ministro se houver ministro adimplente explicitamente localizado
  const ministroPadrao = useMemo(() => {
    return ministros.find((m) => m.statusAdimplencia === 'EM_DIA' || m.statusAdimplencia === 'EM_DIA_FUTURO' || m.statusAdimplencia === 'ADIMPLENTE') || null;
  }, [ministros]);

  // Função utilitária para gerar token de teste
  const criarTokenAmostra = useCallback((min?: Ministro | null): string => {
    if (!min?.id) return '';
    const cpfDigitos = (min.cpf || '').replace(/\D/g, '');
    const cpfHash =
      cpfDigitos.length >= 5
        ? `${cpfDigitos.substring(0, 3)}...${cpfDigitos.slice(-2)}`
        : '000...00';

    const timestampEmissao = '2026-09-26T12:00:00Z';
    const stringParaAssinatura = `${min.id}|${cpfHash}|${min.tenantId || ''}|${min.status || 'ATIVO'}|${min.statusAdimplencia || 'ADIMPLENTE'}|${timestampEmissao}|${CHAVE_PRIVADA_CONVENCAO}`;
    const signature = sha256(stringParaAssinatura);

    const payload: DecodedTokenPayload = {
      ministroId: min.id,
      cpfHash,
      tenantId: min.tenantId || 't-sede-salvador',
      statusAtual: min.status || 'ATIVO',
      adimplencia: min.statusAdimplencia || 'ADIMPLENTE',
      timestampEmissao,
      signature,
    };

    return utf8ToBase64(JSON.stringify(payload));
  }, []);

  // Processamento e Decodificação do Token
  const processarToken = useCallback(
    (tokenParaProcessar: string) => {
      setErroDecodificacao(null);
      if (!tokenParaProcessar.trim()) {
        setPayloadDecodificado(null);
        return;
      }

      try {
        const jsonDecodificado = base64ToUtf8(tokenParaProcessar);
        const obj = JSON.parse(jsonDecodificado) as DecodedTokenPayload;

        if (!obj.ministroId || !obj.signature) {
          throw new Error('Payload com estrutura inválida ou campos essenciais ausentes.');
        }

        setPayloadDecodificado(obj);

        addAuditLog(
          'ALTERACAO_CONFIGURACAO',
          `Verificação pública de credencial executada para o Ministro ID ${obj.ministroId} (Hash CPF: ${obj.cpfHash})`,
          obj.tenantId
        );
      } catch {
        setPayloadDecodificado(null);
        setErroDecodificacao(
          'Token criptográfico inválido, corrompido ou formato Base64 não reconhecido pelo ecossistema.'
        );
      }
    },
    [addAuditLog]
  );

  // Inicialização com token ou primeiro ministro
  useEffect(() => {
    if (tokenInicial) {
      setTokenInput(tokenInicial);
      processarToken(tokenInicial);
    } else if (ministroPadrao) {
      const tokenGerado = criarTokenAmostra(ministroPadrao);
      if (tokenGerado) {
        setTokenInput(tokenGerado);
        processarToken(tokenGerado);
      }
    }
  }, [tokenInicial, ministroPadrao, criarTokenAmostra, processarToken]);

  // Busca de Ministros por Saneamento (CPF, Nome ou Registro Ministerial)
  const ministrosEncontrados = useMemo(() => {
    if (!buscaSaneada.trim()) return [];
    const termo = buscaSaneada.toLowerCase().trim();
    const apenasNumeros = buscaSaneada.replace(/\D/g, '');
    return ministros
      .filter((m) => {
        const nomeLimpo = (m.nome || '').toLowerCase();
        const cpfLimpo = (m.cpf || '').replace(/\D/g, '');
        const rm = (m.registroMinisterial || '').toLowerCase();
        return (
          nomeLimpo.includes(termo) ||
          (apenasNumeros.length >= 3 && cpfLimpo.includes(apenasNumeros)) ||
          rm.includes(termo)
        );
      })
      .slice(0, 6);
  }, [buscaSaneada, ministros]);

  // HOT-RELOAD CONTÁBIL: Consulta estado síncrono atual do ministro no Ledger
  const ministroNoBanco = useMemo(() => {
    if (!payloadDecodificado) return null;
    return ministros.find((m) => m.id === payloadDecodificado.ministroId) || null;
  }, [payloadDecodificado, ministros]);

  const membroMesa = useMemo(() => {
    if (!ministroNoBanco) return null;
    const bancoCpf = (ministroNoBanco.cpf || '').replace(/\D/g, '');
    const bancoNome = (ministroNoBanco.nome || '').toLowerCase().trim();

    return membrosMesaDiretora.find((m: any) => {
      if (!m) return false;
      const mCpf = (m.cpf || '').replace(/\D/g, '');
      const mNome = (m.nome || '').toLowerCase().trim();

      return (
        (m.ministerioId && m.ministerioId === ministroNoBanco.id) ||
        (bancoCpf.length > 0 && mCpf.length > 0 && mCpf === bancoCpf) ||
        (bancoNome.length > 0 && mNome.length > 0 && mNome === bancoNome)
      );
    });
  }, [ministroNoBanco, membrosMesaDiretora]);

  const tenantDoMinistro = useMemo(() => {
    const baseTenant =
      (ministroNoBanco?.tenantId && tenants.find((t) => t.id === ministroNoBanco.tenantId)) ||
      tenantAtivo ||
      tenants[0];
    return (
      baseTenant || {
        id: 't-default',
        nome: 'CIMADEBE Sede',
        cnpj: '14.852.963/0001-44',
        logomarca: '',
        endereco: 'Salvador - BA',
        chaveSede: true,
      }
    );
  }, [ministroNoBanco, tenants, tenantAtivo]);

  // REGRA CRÍTICA DE COMPLIANCE:
  // Se o ministro tornou-se INADIMPLENTE no banco (mesmo que o token diga adimplente),
  // a verificação prevalece o estado do Ledger em tempo real e bloqueia!
  const statusAdimplenciaReal = ministroNoBanco
    ? ministroNoBanco.statusAdimplencia
    : payloadDecodificado?.adimplencia || 'INADIMPLENTE';

  const statusCadastroReal = ministroNoBanco
    ? ministroNoBanco.status
    : (payloadDecodificado?.statusAtual as 'ATIVO' | 'SUSPENSO' | 'EM_ANALISE') || 'EM_ANALISE';

  const isRegular =
    (statusAdimplenciaReal === 'EM_DIA' ||
      statusAdimplenciaReal === 'EM_DIA_FUTURO' ||
      statusAdimplenciaReal === 'PENDENTE' ||
      statusAdimplenciaReal === 'ADIMPLENTE') &&
    statusCadastroReal === 'ATIVO';

  // Validação da assinatura criptográfica SHA-256 do token
  const assinaturaValida = useMemo(() => {
    if (!payloadDecodificado) return false;
    const stringParaAssinatura = `${payloadDecodificado.ministroId}|${payloadDecodificado.cpfHash}|${payloadDecodificado.tenantId}|${payloadDecodificado.statusAtual}|${payloadDecodificado.adimplencia}|${payloadDecodificado.timestampEmissao}|${CHAVE_PRIVADA_CONVENCAO}`;
    const hashEsperado = sha256(stringParaAssinatura);
    return hashEsperado === payloadDecodificado.signature;
  }, [payloadDecodificado]);

  // Loop de Auto-Rotação 360° em tempo real
  useEffect(() => {
    if (!autoRotacao) {
      if (animacaoFrameRef.current) {
        cancelAnimationFrame(animacaoFrameRef.current);
      }
      return;
    }

    const animar = () => {
      setRotY((anterior) => (anterior + 0.8) % 360);
      animacaoFrameRef.current = requestAnimationFrame(animar);
    };

    animacaoFrameRef.current = requestAnimationFrame(animar);

    return () => {
      if (animacaoFrameRef.current) {
        cancelAnimationFrame(animacaoFrameRef.current);
      }
    };
  }, [autoRotacao]);

  // LISTENERS DE POINTER EVENTS: Mouse e Touch para Arrastar 360 Graus
  const lidarComMouseDown = (e: React.MouseEvent) => {
    setIsArrastando(true);
    setAutoRotacao(false);
    ultimaPosicaoRef.current = { x: e.clientX, y: e.clientY };
  };

  const lidarComMouseMove = (e: React.MouseEvent) => {
    if (!isArrastando) return;
    const deltaX = e.clientX - ultimaPosicaoRef.current.x;
    const deltaY = e.clientY - ultimaPosicaoRef.current.y;

    setRotY((ant) => (ant + deltaX * 0.6) % 360);
    setRotX((ant) => Math.max(-65, Math.min(65, ant - deltaY * 0.6)));

    ultimaPosicaoRef.current = { x: e.clientX, y: e.clientY };
  };

  const lidarComMouseUp = () => {
    setIsArrastando(false);
  };

  // Suporte a Touch em Smartphones e Tablets
  const lidarComTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsArrastando(true);
      setAutoRotacao(false);
      ultimaPosicaoRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const lidarComTouchMove = (e: React.TouchEvent) => {
    if (!isArrastando || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - ultimaPosicaoRef.current.x;
    const deltaY = e.touches[0].clientY - ultimaPosicaoRef.current.y;

    setRotY((ant) => (ant + deltaX * 0.8) % 360);
    setRotX((ant) => Math.max(-65, Math.min(65, ant - deltaY * 0.8)));

    ultimaPosicaoRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const lidarComTouchEnd = () => {
    setIsArrastando(false);
  };

  // SHADER HOLOGRÁFICO IRIDESCENTE:
  // Calcula o ângulo e opacidade do espectro óptico arco-íris baseado estritamente
  // na rotação atual dos eixos X e Y provocada pelos eventos de arrasto.
  const anguloShaderHolografico = useMemo(() => {
    const angulo = Math.round((rotY * 2.2 + rotX * 1.8 + 45) % 360);
    return angulo < 0 ? angulo + 360 : angulo;
  }, [rotX, rotY]);

  const intensidadeBrilho = useMemo(() => {
    // Pico de reflexo especular quando o cartão está próximo dos 0° ou 180°
    const anguloNormalizadoY = Math.abs(rotY % 180);
    const fatorReflexo = 1 - Math.min(1, Math.abs(anguloNormalizadoY - 90) / 90);
    return 0.25 + fatorReflexo * 0.45;
  }, [rotY]);

  return (
    <div className="space-y-8 pb-16 font-sans">
      {/* Header da Central Pública */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">
              VERIFICADOR PÚBLICO CRIPTOGRÁFICO
            </span>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.5 rounded">
              CONSULTA OFICIAL
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Validação de Credencial Ministerial 3D
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Inspeção visual da credencial em 360° e verificação em tempo real da regularidade ministerial perante a Convenção Estadual.
          </p>
        </div>

        {onVoltarAoPortal && (
          <button
            onClick={onVoltarAoPortal}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all self-start md:self-auto cursor-pointer"
          >
            ← Voltar ao Portal
          </button>
        )}
      </div>

      {/* Caixa de Busca Direta por Saneamento (CPF, Nome ou Registro Ministerial) */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl relative">
        <label htmlFor="busca-saneada-input" className="text-xs font-bold text-slate-200 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Search className="w-4 h-4 text-cyan-400" />
            <span>Busca de Ministro por Saneamento Cadastral:</span>
          </span>
          <span className="text-[11px] font-mono text-cyan-400">
            Filtro: CPF, Nome ou Registro Ministerial
          </span>
        </label>

        <div className="relative">
          <input
            id="busca-saneada-input"
            type="text"
            value={buscaSaneada}
            onChange={(e) => setBuscaSaneada(e.target.value)}
            placeholder="Digite o CPF, nome do ministro ou registro ministerial para carregar em 3D..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-2xl px-4 py-3 text-xs text-slate-200 font-sans focus:outline-none transition-all pr-9"
          />
          {buscaSaneada && (
            <button
              onClick={() => setBuscaSaneada('')}
              className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-500 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Resultados Saneados */}
        {buscaSaneada.trim() && (
          <div className="p-2 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
            {ministrosEncontrados.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500 font-mono">
                Nenhum ministro localizado com o termo informado.
              </div>
            ) : (
              ministrosEncontrados.map((min) => (
                <button
                  key={min.id}
                  onClick={() => {
                    const tok = criarTokenAmostra(min);
                    setTokenInput(tok);
                    processarToken(tok);
                    setBuscaSaneada('');
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-900/80 hover:bg-cyan-950/50 border border-slate-800/80 hover:border-cyan-500/50 text-left transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-2">
                    <span className="text-xs font-bold text-white group-hover:text-cyan-300 block truncate">
                      {min.nome}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {min.cargo} • CPF: {min.cpf} • {min.registroMinisterial || 'RM-OFICIAL'}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 border ${obterBadgeClassStatus(
                      min.statusAdimplencia
                    )}`}
                  >
                    {formatarRotuloStatus(min.statusAdimplencia)}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Caixa de Entrada e Varredura de Token */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <label htmlFor="token-verification-input" className="text-xs font-bold text-slate-200 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-400" />
            Cole a URL Pública ou Token Base64 para Validação Instantânea:
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            Padrão: https://cimadebe.org.br[TOKEN]
          </span>
        </label>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <input
              id="token-verification-input"
              type="text"
              value={tokenInput}
              onChange={(e) => {
                setTokenInput(e.target.value);
                processarToken(e.target.value);
              }}
              placeholder="Ex: eyJtaW5pc3Ryb0lkIjoibWluLTAwMSIs..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-2xl px-4 py-3 text-xs text-slate-200 font-mono focus:outline-none transition-all"
            />
          </div>

          <button
            onClick={() => processarToken(tokenInput)}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs font-mono shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
          >
            <Scan className="w-4 h-4" />
            <span>Validar Token</span>
          </button>
        </div>

        {/* Seleção do Modelo Real de Ministro Cadastrado no Banco (Firestore) */}
        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono text-slate-400 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-slate-300 font-bold">Modelo Real do Banco (Firestore):</span>
          </div>

          <select
            value={payloadDecodificado?.ministroId || ''}
            onChange={(e) => {
              const selecionado = ministros.find((m) => m.id === e.target.value);
              if (selecionado) {
                const tok = criarTokenAmostra(selecionado);
                setTokenInput(tok);
                processarToken(tok);
              }
            }}
            className="w-full sm:w-auto bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="" disabled>-- Selecionar Ministro do Banco --</option>
            {ministros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome} — {m.cargo} [{m.statusAdimplencia}]
              </option>
            ))}
          </select>
        </div>

        {/* Alerta de Erro na Decodificação */}
        {erroDecodificacao && (
          <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-mono flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{erroDecodificacao}</span>
          </div>
        )}
      </div>

      {/* Grid Central: Credencial 3D 360° + Painel de Auditoria e Telemetria */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Coluna 3D Interativa (7 Colunas) */}
        <div className="lg:col-span-7 flex flex-col items-center space-y-4">
          {/* Status Bar do Objeto 3D */}
          <div className="w-full flex items-center justify-between text-xs font-mono text-slate-400 px-2">
            <div className="flex items-center gap-2">
              <Rotate3d className="w-4 h-4 text-emerald-400" />
              <span>Espaço Vetorial 3D (Arraste livremente)</span>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span>X: {Math.round(rotX)}°</span>
              <span>Y: {Math.round(rotY)}°</span>
              <span>Zoom: {Math.round(zoom * 100)}%</span>
            </div>
          </div>

          {/* PALCO 3D COM PERSPECTIVA E TRANSFORM-STYLE PRESERVE-3D */}
          <div
            className="w-full max-w-[540px] aspect-[1.586/1] bg-slate-950/90 rounded-xl p-4 border border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
            style={{ perspective: '1200px' }}
            onMouseDown={lidarComMouseDown}
            onMouseMove={lidarComMouseMove}
            onMouseUp={lidarComMouseUp}
            onMouseLeave={lidarComMouseUp}
            onTouchStart={lidarComTouchStart}
            onTouchMove={lidarComTouchMove}
            onTouchEnd={lidarComTouchEnd}
          >
            {/* Iluminação de Ambiente em Profundidade */}
            <div
              className="absolute inset-0 pointer-events-none rounded-xl transition-opacity duration-300"
              style={{
                background: `radial-gradient(circle at ${50 + (rotY / 180) * 30}% ${
                  50 + (rotX / 90) * 30
                }%, rgba(16,185,129,0.12) 0%, transparent 70%)`,
              }}
            />

            {/* CARTÃO TRIDIMENSIONAL ROTATIVO COM FRENTE E VERSO (MODELO OFICIAL CR-80) */}
            <div
              className="w-full h-full relative transition-transform duration-75 ease-out"
              style={{
                transformStyle: 'preserve-3d',
                transform: `rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${zoom})`,
              }}
            >
              {/* ======================================================== */}
              {/* PAINEL FRENTE DO CARTÃO (ANVERSO - VETORIAL CR-80)       */}
              {/* ======================================================== */}
              <div
                id="biro-3d-vector-frente"
                className="absolute inset-0 rounded-[8px] overflow-hidden shadow-2xl"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
              >
                <MinisterialCard
                  ministro={ministroNoBanco}
                  verso={false}
                  tarjaInadimplente={!isRegular}
                />
              </div>

              {/* ======================================================== */}
              {/* PAINEL VERSO DO CARTÃO (REVERSO - ROTATE Y 180 DEG)       */}
              {/* ======================================================== */}
              <div
                id="biro-3d-vector-verso"
                className="absolute inset-0 rounded-[8px] overflow-hidden shadow-2xl"
                style={{
                  transform: 'rotateY(180deg)',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
              >
                <MinisterialCard
                  ministro={ministroNoBanco}
                  verso={true}
                  tarjaInadimplente={!isRegular}
                />
              </div>
            </div>
          </div>

          {/* Barra de Controles Espaciais 3D */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              onClick={() => {
                setRotX(0);
                setRotY(0);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-mono transition-all cursor-pointer"
            >
              Frente (0°)
            </button>
            <button
              onClick={() => {
                setRotX(0);
                setRotY(180);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-mono transition-all cursor-pointer"
            >
              Verso (180°)
            </button>
            <button
              onClick={() => setAutoRotacao(!autoRotacao)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                autoRotacao
                  ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {autoRotacao ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>Auto 360°</span>
            </button>
            <button
              onClick={() => {
                setRotX(12);
                setRotY(-18);
                setZoom(1);
                setAutoRotacao(false);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs font-mono transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs transition-all cursor-pointer"
              title="Aumentar Zoom"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs transition-all cursor-pointer"
              title="Diminuir Zoom"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Coluna de Telemetria e Diagnóstico Contábil (5 Colunas) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Painel de Veredito de Segurança */}
          <div
            className={`p-6 rounded-3xl border shadow-2xl transition-all ${
              isRegular
                ? 'bg-gradient-to-br from-emerald-950/70 to-slate-900 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.2)]'
                : 'bg-gradient-to-br from-rose-950/80 to-slate-900 border-rose-500/60 shadow-[0_0_30px_rgba(244,63,94,0.25)]'
            }`}
          >
            <div className="flex items-center gap-3">
              {isRegular ? (
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shrink-0">
                  <ShieldCheck className="w-7 h-7" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0">
                  <ShieldAlert className="w-7 h-7" />
                </div>
              )}

              <div>
                <span
                  className={`text-[10px] font-mono font-bold uppercase tracking-widest ${
                    isRegular ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  VERIFICAÇÃO DE AUTENTICIDADE
                </span>
                <h3 className="text-lg font-black text-white">
                  {isRegular
                    ? 'CREDENCIAL AUTÊNTICA E HOMOLOGADA'
                    : 'DOCUMENTO INVÁLIDO / MINISTRO IRREGULAR'}
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-300 mt-4 leading-relaxed font-sans">
              {isRegular
                ? `O ministro obreiro ${ministroNoBanco?.nome || payloadDecodificado?.ministroId} encontra-se plenamente ativo e adimplente perante a convenção estadual na data corrente (${new Date().toLocaleDateString('pt-BR')}). Documento oficial regular.`
                : `Acesso e credenciamento eclesiástico não autorizados: O ministro encontra-se com situação ${formatarRotuloStatus(statusAdimplenciaReal)} e cadastro ${statusCadastroReal}. Documento não autorizado pela convenção estadual.`}
            </p>

            {/* Checklist de Validação */}
            <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Validação Digital:</span>
                {assinaturaValida ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> ÍNTEGRA E VÁLIDA
                  </span>
                ) : (
                  <span className="text-rose-400 font-bold flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> NÃO VERIFICADA
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Situação Financeira:</span>
                <span
                  className={`font-bold ${
                    statusAdimplenciaReal === 'EM_DIA' || statusAdimplenciaReal === 'EM_DIA_FUTURO' || statusAdimplenciaReal === 'ADIMPLENTE' || statusAdimplenciaReal === 'PENDENTE'
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {formatarRotuloStatus(statusAdimplenciaReal)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status Cadastral:</span>
                <span
                  className={`font-bold ${
                    statusCadastroReal === 'ATIVO' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {statusCadastroReal}
                </span>
              </div>
            </div>
          </div>

          {/* Dados do Token Auditado */}
          {payloadDecodificado && (
            <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3 font-mono text-xs shadow-lg">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <Fingerprint className="w-4 h-4 text-cyan-400" />
                  Metadados do Payload
                </span>
                <span className="text-[10px] text-slate-500">JSON/BASE64</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-[11px] text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Ministro ID:</span>
                  <span className="text-white font-bold">{payloadDecodificado.ministroId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Hash CPF:</span>
                  <span className="text-slate-200">{payloadDecodificado.cpfHash}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tenant ID:</span>
                  <span className="text-indigo-400">{payloadDecodificado.tenantId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Data Emissão:</span>
                  <span className="text-slate-400">{payloadDecodificado.timestampEmissao}</span>
                </div>
              </div>
            </div>
          )}

          {/* INFORMAÇÕES DO PERFIL & SITUAÇÃO NA CONVENÇÃO */}
          {ministroNoBanco && (
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-emerald-500/30 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <UserCheck className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-black text-white">Informações do Perfil &amp; Situação na Convenção</h4>
              </div>

              {membroMesa && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/80 to-slate-900 border border-amber-500/50 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-300 font-bold shrink-0">
                    ★
                  </div>
                  <div>
                    <span className="text-[9px] font-mono font-bold text-amber-400 uppercase tracking-widest block">
                      Membro da Mesa Diretora Estatutária
                    </span>
                    <h5 className="text-xs font-black text-white">{membroMesa.cargoMesa}</h5>
                    <span className="text-[10px] font-mono text-slate-300">Mandato: {membroMesa.mandato}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Registro Nacional Institucional</span>
                  <span className="text-cyan-400 font-bold text-sm">
                    {ministroNoBanco.registroMinisterial || `RM-${ministroNoBanco.cpf.replace(/\D/g, '').slice(0, 3)}.${ministroNoBanco.cpf.replace(/\D/g, '').slice(3, 6)}-${ministroNoBanco.cpf.replace(/\D/g, '').slice(-2)}`}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Data de Nascimento</span>
                  <span className="text-white font-bold text-sm">
                    {ministroNoBanco.dataNascimento ? formatarDataBR(ministroNoBanco.dataNascimento) : 'Não informada'}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Estado Civil</span>
                  <span className="text-white font-bold text-sm uppercase">
                    {ministroNoBanco.estadoCivil || 'Não informado'}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Cargo / Consagração</span>
                  <span className="text-amber-400 font-bold text-sm uppercase">
                    {ministroNoBanco.cargo}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-1">
                <span className="text-[10px] text-slate-400 block">Situação Eclesiástica &amp; Contábil</span>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Igreja Filiada:</span>
                  <span className="text-white font-bold truncate max-w-[200px]">{ministroNoBanco.igrejaFiliadaNome || 'Sede Geral'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Status Adimplência:</span>
                  <span className={`font-bold ${ministroNoBanco.statusAdimplencia === 'EM_DIA' || ministroNoBanco.statusAdimplencia === 'EM_DIA_FUTURO' || ministroNoBanco.statusAdimplencia === 'ADIMPLENTE' || ministroNoBanco.statusAdimplencia === 'PENDENTE' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatarRotuloStatus(ministroNoBanco.statusAdimplencia)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
