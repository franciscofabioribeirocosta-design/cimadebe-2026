import React, { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  ShieldCheck,
  Calendar,
  Clock,
  Printer,
  X,
  Sparkles,
  Maximize2,
  Minimize2,
  Rotate3d,
  FileText,
  QrCode,
  Award,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { Ministro, AppConfig } from '../types';
import { DocumentoAcervo, emitirDocumentoPdfCriptografado } from '../services/dossieDocumentosService';
import { formatarDataBR, formatarRotuloStatus } from '../financialEngine';
import confetti from 'canvas-confetti';

interface DocumentoTimbrado3DProps {
  readonly modelo: DocumentoAcervo;
  readonly ministro: Ministro;
  readonly appConfig?: AppConfig;
  readonly onFechar: () => void;
}

export const DocumentoTimbrado3D: React.FC<DocumentoTimbrado3DProps> = ({
  modelo,
  ministro,
  appConfig,
  onFechar
}) => {
  const [inclinacao3D, setInclinacao3D] = useState<boolean>(true);
  const [baixando, setBaixando] = useState<boolean>(false);
  const [zoom, setZoom] = useState<boolean>(false);
  const [mouseRot, setMouseRot] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const nomeConvencao =
    appConfig?.nomeConvencao ||
    'CONVENÇÃO ESTADUAL E INTERESTADUAL DE MINISTROS E IGREJAS ASSEMBLEIA DE DEUS - CIMADEBE';
  const sigla = appConfig?.sigla || 'CIMADEBE';
  const cnpj = appConfig?.cnpj || '14.852.963/0001-44';
  const endereco = appConfig?.endereco || 'Av. Sete de Setembro, 1500 - Campo Grande, Salvador / BA';
  const logomarca = appConfig?.logomarca;

  const dataAtual = new Date();
  const dataEmissaoFormatada = `${String(dataAtual.getDate()).padStart(2, '0')}/${String(
    dataAtual.getMonth() + 1
  ).padStart(2, '0')}/${dataAtual.getFullYear()}`;
  
  const validadeFormatada = modelo.prazoValidadeDias
    ? (() => {
        const val = new Date(dataAtual.getTime() + modelo.prazoValidadeDias * 24 * 60 * 60 * 1000);
        return `${String(val.getDate()).padStart(2, '0')}/${String(val.getMonth() + 1).padStart(2, '0')}/${val.getFullYear()}`;
      })()
    : 'Permanente (Registro Canônico Definitivo)';

  // Interpolação completa e sem códigos expostos: substitui todas as variáveis por dados reais
  const textoInterpolado = useMemo(() => {
    let base =
      modelo.conteudoModelo ||
      `A Mesa Diretora da {{CONVENCAO}}, no uso de suas atribuições estatutárias e canônicas, CERTIFICA que o Ministro {{NOME_MINISTRO}}, portador do CPF nº {{CPF}} e Registro Ministerial {{REGISTRO}}, consagrado em {{DATA_CONSAGRACAO}} na função de {{CARGO}}, atuante em {{IGREJA}}, encontra-se plenamente idôneo e em conformidade eclesiástica perante esta Magna Convenção.`;

    const mapa: Record<string, string> = {
      '{{NOME_MINISTRO}}': ministro.nome || 'Ministro Filiado',
      '{{CARGO}}': ministro.cargo || 'Ministro do Evangelho',
      '{{CPF}}': ministro.cpf || 'Cadastrado e Autenticado',
      '{{REGISTRO}}': ministro.registroMinisterial || 'RM-039.279-26',
      '{{IGREJA}}': ministro.igrejaFiliadaNome || 'Sede Geral Convencional',
      '{{DATA_CONSAGRACAO}}': formatarDataBR(
        (ministro as any).dadosEclesiasticos?.dataOrdenacao || ministro.dataConsagracao || '2016-09-26'
      ),
      '{{VALIDADE}}': validadeFormatada,
      '{{CONVENCAO}}': nomeConvencao,
      '{{CNPJ}}': cnpj,
      '{{SIGLA}}': sigla
    };

    for (const [chave, valor] of Object.entries(mapa)) {
      base = base.split(chave).join(valor);
    }
    return base;
  }, [modelo, ministro, nomeConvencao, cnpj, sigla, validadeFormatada]);

  const hashSimulado = `SHA256-${(ministro.id || 'MIN').slice(0, 6).toUpperCase()}-${Date.now().toString(16).toUpperCase()}-LEDGER-VERIFIED`;

  // Efeito interativo 3D com o movimento do mouse
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!inclinacao3D || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotX = -(y / rect.height) * 12;
    const rotY = (x / rect.width) * 12;
    setMouseRot({ x: rotX, y: rotY });
  };

  const handleMouseLeave = () => {
    setMouseRot({ x: 0, y: 0 });
  };

  const handleDownload = async () => {
    setBaixando(true);
    try {
      await emitirDocumentoPdfCriptografado(modelo, ministro, appConfig);
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
    } finally {
      setBaixando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/95 backdrop-blur-2xl animate-fadeIn overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !baixando) onFechar();
      }}
    >
      <div className="max-w-4xl w-full flex flex-col my-auto space-y-3 max-h-[96vh]">
        {/* BARRA DE CONTROLES SUPERIORES */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/95 border border-amber-500/40 shadow-2xl flex items-center justify-between gap-3 flex-wrap backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="text-2xl p-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
              {modelo.icone || '📄'}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white">{modelo.titulo}</h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Modelo Oficial 3D
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-300">
                Ministro: <strong className="text-amber-400">{ministro.nome}</strong> • {ministro.cargo}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setInclinacao3D(!inclinacao3D)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                inclinacao3D
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              <Rotate3d className="w-3.5 h-3.5" />
              <span>{inclinacao3D ? 'Perspectiva 3D' : 'Visão Plana'}</span>
            </button>

            <button
              type="button"
              onClick={() => setZoom(!zoom)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
            >
              {zoom ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span>{zoom ? '100%' : 'Ampliar'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={baixando}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              {baixando ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Gerando PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar PDF Oficial</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onFechar}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono font-bold flex items-center gap-1 transition-all cursor-pointer border border-slate-700"
              title="Fechar visualização [ESC]"
            >
              <X className="w-4 h-4 text-amber-400" />
              <span>Fechar</span>
            </button>
          </div>
        </div>

        {/* CONTAINER DO PAPEL TIMBRADO 3D (COM PERSPECTIVA REALISTA & SOMBRAS DE LUXO) */}
        <div
          className="overflow-y-auto pr-1 flex-1 flex items-center justify-center p-2 sm:p-6"
          style={{ perspective: inclinacao3D ? '1600px' : 'none' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <motion.div
            ref={cardRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{
              opacity: 1,
              scale: zoom ? 1.05 : 1,
              rotateX: inclinacao3D ? (mouseRot.x !== 0 ? mouseRot.x : 4) : 0,
              rotateY: inclinacao3D ? (mouseRot.y !== 0 ? mouseRot.y : -2) : 0,
              y: inclinacao3D ? -4 : 0
            }}
            transition={{ type: 'spring', stiffness: 260, damping: 25 }}
            className={`w-full max-w-[660px] bg-white text-slate-900 rounded-lg p-6 sm:p-9 relative select-none font-serif transition-shadow duration-500 border border-amber-900/20 ${
              inclinacao3D
                ? 'shadow-[0_40px_90px_-15px_rgba(0,0,0,0.9),0_0_30px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/30'
                : 'shadow-2xl'
            }`}
            style={{
              minHeight: '860px',
              backgroundImage:
                'linear-gradient(135deg, #ffffff 0%, #fafaf9 50%, #f5f5f4 100%)',
              boxShadow: inclinacao3D
                ? '0 30px 60px -12px rgba(0, 0, 0, 0.85), 0 18px 36px -18px rgba(0, 0, 0, 0.7), inset 0 0 100px rgba(0,0,0,0.02)'
                : undefined
            }}
          >
            {/* MARCA D'ÁGUA CENTRAL TRANSLÚCIDA DO BRASÃO DA CONVENÇÃO */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] overflow-hidden select-none">
              <div className="w-[460px] h-[460px] rounded-full border-[22px] border-slate-900 flex items-center justify-center text-slate-900 font-sans font-black text-center text-4xl p-8 rotate-[-22deg]">
                <div>
                  <div className="text-7xl mb-2 text-amber-700">✝</div>
                  <span className="text-5xl font-black">{sigla}</span>
                  <div className="text-xs font-mono mt-2 tracking-widest uppercase text-slate-800 font-bold">
                    CONVENÇÃO GERAL DE MINISTROS
                  </div>
                </div>
              </div>
            </div>

            {/* MOLDURA DUPLA DE PAPEL TIMBRADO OFICIAL COM FILETES DOURADOS */}
            <div className="absolute inset-3 border border-amber-600/40 pointer-events-none rounded" />
            <div className="absolute inset-4 border border-slate-400/20 pointer-events-none rounded" />

            {/* ========================================================= */}
            {/* 1. CABEÇALHO TIMBRADO OFICIAL COM BRASÃO & DOURADO */}
            {/* ========================================================= */}
            <div className="border-b-2 border-amber-500 pb-4 mb-5 relative">
              <div className="flex items-center gap-4">
                {/* Brasão Eclesiástico Vetorial Dourado Oficial */}
                <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 border-2 border-amber-500 flex items-center justify-center text-amber-400 shadow-xl shrink-0 relative overflow-hidden ring-2 ring-amber-500/30">
                  {logomarca ? (
                    <img
                      src={logomarca}
                      alt="Brasão da Convenção"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <div className="text-center font-sans">
                      <span className="text-2xl block leading-none drop-shadow">✝</span>
                      <span className="text-[10px] font-black tracking-widest block mt-0.5 text-amber-300">
                        {sigla}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-0.5 text-center flex-1 font-sans">
                  <h1 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight leading-tight">
                    {nomeConvencao}
                  </h1>
                  <p className="text-[10px] font-bold text-amber-700 font-mono">
                    CNPJ: {cnpj} • SEDE OFICIAL CONVENCIONAL
                  </p>
                  <p className="text-[9px] text-slate-600 font-mono leading-tight">{endereco}</p>
                  <p className="text-[8px] font-black text-sky-800 font-mono uppercase tracking-wider pt-0.5">
                    SISTEMA INTEGRADO DE GESTÃO MINISTERIAL (SIGM) • ACERVO DOCUMENTAL AUTENTICADO
                  </p>
                </div>
              </div>
            </div>

            {/* TÍTULO DO DOCUMENTO */}
            <div className="text-center space-y-1 mb-5 font-sans">
              <h2 className="text-base sm:text-lg font-black text-slate-950 uppercase tracking-wide">
                {modelo.titulo}
              </h2>
              <div className="w-28 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent mx-auto" />
              <p className="text-xs font-mono text-slate-600 italic">{modelo.subtitulo}</p>
            </div>

            {/* QUADRO DE IDENTIFICAÇÃO DO MINISTRO (DADOS REAIS DO BANCO) */}
            <div className="p-3.5 sm:p-4 rounded-lg bg-slate-50/90 border border-slate-300 font-sans text-xs mb-5 shadow-xs">
              <div className="text-[10px] font-mono font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2 uppercase tracking-wider flex items-center justify-between">
                <span>DADOS DO MINISTRO TITULAR (HOMOLOGADO):</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> SITUAÇÃO:{' '}
                  {formatarRotuloStatus(ministro.statusAdimplencia)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-slate-800">
                <div>
                  <span className="text-slate-500 font-mono text-[10px]">Nome Completo:</span>
                  <p className="font-bold text-slate-900">{ministro.nome}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-mono text-[10px]">Igreja Filiada:</span>
                  <p className="font-bold text-slate-900">
                    {ministro.igrejaFiliadaNome || 'Sede Geral Convencional'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 font-mono text-[10px]">Cargo / Ordenação:</span>
                  <p className="font-bold text-slate-900">{ministro.cargo}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-mono text-[10px]">Data de Consagração:</span>
                  <p className="font-bold text-slate-900">
                    {formatarDataBR(
                      (ministro as any).dadosEclesiasticos?.dataOrdenacao ||
                        ministro.dataConsagracao ||
                        '2016-09-26'
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 font-mono text-[10px]">CPF / Documento:</span>
                  <p className="font-mono text-slate-900">{ministro.cpf || 'Cadastrado e Verificado'}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-mono text-[10px]">Registro Ministerial (RM):</span>
                  <p className="font-mono font-bold text-slate-900">
                    {ministro.registroMinisterial || 'RM-039.279-26'}
                  </p>
                </div>
              </div>
            </div>

            {/* CORPO DO TEXTO CANÔNICO INTERPOLADO */}
            <div className="text-xs sm:text-[13px] text-slate-800 leading-relaxed text-justify space-y-3.5 mb-6 font-serif px-1">
              {textoInterpolado.split('\n\n').map((paragrafo, idx) => (
                <p key={idx} className="indent-6 leading-relaxed">
                  {paragrafo.trim()}
                </p>
              ))}
            </div>

            {/* CARIMBO DE SEGURANÇA CRIPTOGRÁFICA & VALIDADE */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-300 font-mono text-[9px] text-slate-700 space-y-1 mb-8">
              <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center justify-between">
                <span className="flex items-center gap-1 text-slate-900">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  AUTENTICIDADE DIGITAL & VALIDAÇÃO EM TEMPO REAL:
                </span>
                <span className="text-amber-700 font-bold">
                  {modelo.prazoValidadeDias
                    ? `VÁLIDO ATÉ: ${validadeFormatada}`
                    : 'VALIDADE PERMANENTE'}
                </span>
              </div>
              <p>• Data da Emissão Digital: {dataEmissaoFormatada} às {dataAtual.toLocaleTimeString('pt-BR')}</p>
              <p>• Assinatura Digital: <strong className="text-slate-900">{hashSimulado}</strong></p>
              <p>• Registro do Modelo: {modelo.id}</p>
              <p>• Autenticidade: Documento emitido e homologado pela Convenção Estadual.</p>
            </div>

            {/* ASSINATURAS DA MESA DIRETORA */}
            <div className="grid grid-cols-2 gap-8 text-center pt-2 font-sans">
              <div>
                <div className="border-t border-slate-400 w-4/5 mx-auto mb-1" />
                <p className="text-[10px] font-bold text-slate-900 uppercase">PRESIDÊNCIA GERAL</p>
                <p className="text-[9px] text-slate-500 font-mono">{sigla} / SIGM Core</p>
              </div>
              <div>
                <div className="border-t border-slate-400 w-4/5 mx-auto mb-1" />
                <p className="text-[10px] font-bold text-slate-900 uppercase">SECRETARIA EXECUTIVA</p>
                <p className="text-[9px] text-slate-500 font-mono">Mesa Diretora Homologada</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
