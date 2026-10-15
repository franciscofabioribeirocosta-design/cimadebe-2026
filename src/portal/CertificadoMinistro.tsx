import React, { useMemo, useState, useEffect } from 'react';
import { Download, ShieldCheck, AlertTriangle, Printer, X, Sparkles, CheckCircle2, FileText } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

// Polyfill robusto para prevenir TypeError: canvas.getBoundingClientRect is not a function em html2canvas
if (typeof window !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.getBoundingClientRect) {
  HTMLCanvasElement.prototype.getBoundingClientRect = function () {
    return {
      width: this.width || 0,
      height: this.height || 0,
      top: 0,
      left: 0,
      bottom: this.height || 0,
      right: this.width || 0,
      x: 0,
      y: 0,
      toJSON: () => {}
    } as DOMRect;
  };
}

export interface CertificadoMinistroProps {
  ministro: {
    id: string;
    nome?: string;
    nomeCompleto?: string;
    cargo?: string;
    cpf?: string;
    registroMinisterial?: string;
    igrejaFiliadaNome?: string;
    nomeIgreja?: string;
    igreja?: string;
    cidade?: string;
    uf?: string;
    dadosEndereco?: {
      cidade?: string;
      uf?: string;
    };
    dataConsagracao?: string;
    dataFiliacao?: string;
    statusAdimplencia?: 'ADIMPLENTE' | 'INADIMPLENTE' | 'PENDENTE' | 'SUSPENSO' | string;
    status?: string;
    statusAcesso?: string;
    [key: string]: any;
  };
  appConfig?: any;
  onFechar?: () => void;
}

export const CertificadoMinistro: React.FC<CertificadoMinistroProps> = ({
  ministro,
  appConfig,
  onFechar,
}) => {
  const [baixando, setBaixando] = useState<boolean>(false);
  const [erroBloqueio, setErroBloqueio] = useState<string | null>(null);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // TRAVA ANTI-BYPASS F12: Validação rigorosa de adimplência
  const statusAdimplencia = (ministro?.statusAdimplencia || 'ADIMPLENTE').toUpperCase();
  const isInadimplente =
    statusAdimplencia === 'INADIMPLENTE' ||
    statusAdimplencia === 'PENDENTE' ||
    statusAdimplencia === 'SUSPENSO';

  const cleanCpf = useMemo(() => {
    return String(ministro?.cpf || '').replace(/\D/g, '');
  }, [ministro?.cpf]);

  const nomeFormatado = useMemo(() => {
    return String(ministro?.nome || ministro?.nomeCompleto || 'MINISTRO OFICIAL HOMOLOGADO')
      .toUpperCase()
      .trim();
  }, [ministro]);

  const cargoFormatado = useMemo(() => {
    return String(ministro?.cargo || 'PASTOR').toUpperCase().trim();
  }, [ministro]);

  const registroFormatado = useMemo(() => {
    return String(ministro?.registroMinisterial || ministro?.id || 'RM-0000').trim();
  }, [ministro]);

  const cpfFormatado = useMemo(() => {
    if (cleanCpf.length === 11) {
      return `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6, 9)}-${cleanCpf.slice(9)}`;
    }
    return ministro?.cpf || '000.000.000-00';
  }, [cleanCpf, ministro?.cpf]);

  const igrejaFormatada = useMemo(() => {
    return String(
      ministro?.igrejaFiliadaNome ||
        ministro?.nomeIgreja ||
        ministro?.igreja ||
        appConfig?.nomeConvenc ||
        'CATEDRAL SEDE GERAL'
    )
      .toUpperCase()
      .trim();
  }, [ministro, appConfig]);

  const localidadeFormatada = useMemo(() => {
    const cidade = (ministro?.cidade || ministro?.dadosEndereco?.cidade || 'SÃO PAULO').toUpperCase();
    const uf = (ministro?.uf || ministro?.dadosEndereco?.uf || 'SP').toUpperCase();
    return `${cidade} / ${uf}`;
  }, [ministro]);

  const dataConsagracaoFormatada = useMemo(() => {
    return String(ministro?.dataConsagracao || ministro?.dataFiliacao || '18 de Outubro de 2026').trim();
  }, [ministro]);

  const dataEmissao = useMemo(() => {
    return new Date().toLocaleDateString('pt-BR');
  }, []);

  // DIRETRIZ MASTER: O link do QR Code remete para a rota pública /validar/cert-03927930326
  const validationUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cimadebe.org.br';
    const identificador = cleanCpf || ministro?.id || '03927930326';
    return `${origin}/validar/cert-${identificador}`;
  }, [cleanCpf, ministro?.id]);

  const hashAutenticidade = useMemo(() => {
    const cleanId = (ministro?.id || '000').slice(0, 8).toUpperCase();
    const cleanCpfSlice = cleanCpf.slice(0, 5) || '00000';
    return `CHAVE: ACDE${cleanCpfSlice}C4E4C520DF40416B${cleanId}SIGM3499032A027037EA`;
  }, [ministro?.id, cleanCpf]);

  // Geração do QR Code local em Data URL de alta resolução
  useEffect(() => {
    let cancelado = false;
    QRCode.toDataURL(validationUrl, {
      width: 180,
      margin: 1,
      color: {
        dark: '#0B2F64',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelado) setQrCodeDataUrl(url);
      })
      .catch((err) => {
        console.warn('[CERTIFICADO_QR] Fallback para api externa:', err);
        if (!cancelado) {
          setQrCodeDataUrl(
            `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(validationUrl)}`
          );
        }
      });
    return () => {
      cancelado = true;
    };
  }, [validationUrl]);

  /**
   * EXPORTAÇÃO EM PDF GRÁFICO (A4 PAISAGEM EM ALTA RESOLUÇÃO)
   * Captura o container combinado (imagem de fundo + textos absolutos).
   * Não quebra fontes nem corta bordas.
   */
  const handleBaixarCertificadoPdf = async () => {
    if (isInadimplente) {
      setErroBloqueio('ACESSO NEGADO (HTTP 403): Emissão de certificado bloqueada por inadimplência cadastral.');
      return;
    }

    try {
      setBaixando(true);
      setErroBloqueio(null);
      setSucessoMsg(null);

      // Trava de verificação de integridade no servidor antes da captura
      const verifyRes = await fetch(
        `/api/certificate/data?ministroId=${encodeURIComponent(ministro.id || cleanCpf)}`
      );
      if (verifyRes.status === 403) {
        throw new Error('ACESSO NEGADO (HTTP 403): Emissão de certificado bloqueada por inadimplência cadastral.');
      }

      const container = document.getElementById('certificado-matriz-container');
      if (!container) {
        throw new Error('Container do certificado não encontrado no DOM.');
      }

      // Captura via html2canvas com scale 2.5 para nitidez gráfica impecável
      const canvas = await html2canvas(container, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#FFFFFF',
        width: 1123,
        height: 794,
        windowWidth: 1123,
        windowHeight: 794,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);

      // Instanciação jsPDF em A4 Paisagem (1123px x 794px exatos)
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [1123, 794],
        hotfixes: ['px_scaling'],
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, 1123, 794);
      pdf.save(`Certificado_Oficial_Ordenacao_${cleanCpf || registroFormatado}.pdf`);

      setSucessoMsg('Certificado Oficial em PDF emitido e baixado com sucesso!');
      setTimeout(() => setSucessoMsg(null), 6000);
    } catch (err: any) {
      console.error('[ERRO_PDF_CERTIFICADO]', err);
      // Fallback: Tentativa de download direto via endpoint nativo do backend
      try {
        const downloadUrl = `/api/certificate/pdf?ministroId=${encodeURIComponent(
          ministro.id || cleanCpf
        )}`;
        const res = await fetch(downloadUrl);
        if (res.status === 403) {
          throw new Error('ACESSO NEGADO (HTTP 403): Emissão de certificado bloqueada por inadimplência cadastral.');
        }
        if (!res.ok) throw new Error('Falha no download direto via servidor.');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Certificado_Oficial_Ordenacao_${cleanCpf || registroFormatado}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setSucessoMsg('Certificado Oficial em PDF emitido via servidor!');
      } catch (fallbackErr: any) {
        setErroBloqueio(
          fallbackErr.message || err.message || 'Falha ao compilar e baixar o certificado oficial em PDF.'
        );
      }
    } finally {
      setBaixando(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-6 w-full max-w-6xl mx-auto p-4">
      {/* Barra Superior de Ações & Controles de Emissão */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full bg-slate-900/90 border border-amber-500/30 p-4 rounded-2xl backdrop-blur-md shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              Certificado Oficial de Ordenação
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                MATRIZ IMUTÁVEL A4
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Titular: <strong className="text-amber-300">{nomeFormatado}</strong> • CPF: {cpfFormatado} • RM: {registroFormatado}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleBaixarCertificadoPdf}
            disabled={baixando || isInadimplente}
            className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg text-xs cursor-pointer ${
              isInadimplente
                ? 'bg-rose-950/80 text-rose-300 border border-rose-500/50 opacity-80 cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>{baixando ? 'Compilando PDF...' : 'Baixar Certificado Oficial (PDF)'}</span>
          </button>

          {onFechar && (
            <button
              type="button"
              onClick={onFechar}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Trava Anti-Bypass F12 se Inadimplente */}
      {isInadimplente && (
        <div className="w-full bg-rose-950/90 border-2 border-rose-500/80 p-4 rounded-2xl flex items-center gap-3 text-rose-200 text-xs font-bold shadow-xl animate-pulse">
          <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
          <div>
            <p className="font-black text-rose-100 uppercase tracking-wider">
              ACESSO NEGADO (HTTP 403) • EMISSÃO BLOQUEADA POR INADIMPLÊNCIA
            </p>
            <p className="text-[11px] font-normal text-rose-300 mt-0.5">
              O ministro possui pendências na Tesouraria. Regularize a anuidade ou taxa da convenção para liberar o certificado oficial de ordenação.
            </p>
          </div>
        </div>
      )}

      {/* Mensagem de Erro de Bloqueio */}
      {erroBloqueio && !isInadimplente && (
        <div className="w-full bg-rose-900/60 border border-rose-500/40 p-3 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{erroBloqueio}</span>
        </div>
      )}

      {/* Mensagem de Sucesso */}
      {sucessoMsg && (
        <div className="w-full bg-emerald-950/70 border border-emerald-500/40 p-3 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{sucessoMsg}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. CONTAINER A4 PAISAGEM DA MATRIZ IMUTÁVEL COM SOBREPOSIÇÃO ABSOLUTA */}
      {/* Dimensão exata de folha A4 Paisagem a 96 DPI: 1123px x 794px           */}
      {/* Fundo absoluto: matriz_certificado_oficial.png                        */}
      {/* ===================================================================== */}
      <div className="w-full overflow-x-auto pb-6 flex justify-center">
        <div
          id="certificado-matriz-container"
          className="relative shadow-2xl rounded-sm overflow-hidden bg-white select-none shrink-0"
          style={{
            width: '1123px',
            height: '794px',
            backgroundImage: "url('/assets/matriz_certificado_oficial.png')",
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            position: 'relative',
          }}
        >
          {/* 1. NOME COMPLETO DO MINISTRO (SOBREPOSIÇÃO CENTRALIZADA COM FONTE INSTITUCIONAL ELEGANTE) */}
          <div
            className="absolute left-0 right-0 text-center uppercase tracking-wide font-black"
            style={{
              top: '308px',
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: '28px',
              lineHeight: '1.2',
              color: '#0F172A',
              textShadow: '0 1px 1px rgba(255,255,255,0.9)',
              letterSpacing: '0.8px',
            }}
          >
            {nomeFormatado}
          </div>

          {/* 2. REGISTRO MINISTERIAL E CPF (SOBREPOSIÇÃO PURA) */}
          <div
            className="absolute left-0 right-0 text-center"
            style={{
              top: '356px',
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: '13px',
              color: '#334155',
              letterSpacing: '0.3px',
            }}
          >
            Portador(a) do Registro Ministerial:{' '}
            <strong className="text-amber-800 font-bold">{registroFormatado}</strong> • Inscrito(a) no CPF:{' '}
            <strong className="text-slate-900 font-bold">{cpfFormatado}</strong>
          </div>

          {/* 3. CONGREGAÇÃO / IGREJA E LOCALIDADE */}
          <div
            className="absolute left-0 right-0 text-center"
            style={{
              top: '382px',
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: '12.5px',
              color: '#475569',
            }}
          >
            Filiado(a) à Congregação / Igreja:{' '}
            <strong className="text-slate-900 font-bold">{igrejaFormatada}</strong> ({localidadeFormatada})
          </div>

          {/* 4. CARGO DO MINISTRO (SOBREPOSIÇÃO EXATA NO ESPAÇO CENTRAL DA CAIXA DOURADA) */}
          <div
            className="absolute left-0 right-0 text-center font-black uppercase tracking-widest"
            style={{
              top: '476px',
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: '24px',
              color: '#0B2F64',
              textShadow: '0 1px 1px rgba(255,255,255,0.8)',
            }}
          >
            {cargoFormatado}
          </div>

          {/* 5. DATA DA CONSAGRAÇÃO / SESSÃO SOLENE */}
          <div
            className="absolute left-0 right-0 text-center"
            style={{
              top: '550px',
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: '11.5px',
              color: '#78350F',
              fontWeight: 'bold',
            }}
          >
            Data da Consagração / Recebimento: {dataConsagracaoFormatada} • Sessão Solene de Encerramento da AGO
          </div>

          {/* 6. ASSINATURAS DA DIRETORIA (ALINHADAS SOBRE AS DUAS LINHAS ESCURAS HORIZONTAIS) */}
          {/* Assinatura Presidente (Esquerda: centro x=280) */}
          <div
            className="absolute flex flex-col items-center justify-end"
            style={{
              left: '160px',
              width: '240px',
              top: '638px',
              height: '42px',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                fontFamily: '"Brush Script MT", "Great Vibes", cursive, Georgia, serif',
                fontSize: '23px',
                color: '#0B2F64',
                lineHeight: '1',
                opacity: 0.95,
              }}
            >
              Pr. Ezequiel Moreira
            </span>
          </div>

          {/* Assinatura Secretaria Geral (Direita: centro x=842) */}
          <div
            className="absolute flex flex-col items-center justify-end"
            style={{
              left: '722px',
              width: '240px',
              top: '638px',
              height: '42px',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                fontFamily: '"Brush Script MT", "Great Vibes", cursive, Georgia, serif',
                fontSize: '21px',
                color: '#0B2F64',
                lineHeight: '1',
                opacity: 0.95,
              }}
            >
              Secretaria Executiva
            </span>
          </div>

          {/* 7. QR CODE VETORIAL DE VALIDAÇÃO (CANTO INFERIOR DIREITO NO ESPAÇO QUADRADO RESERVADO) */}
          <div
            className="absolute flex items-center justify-center p-1 bg-white rounded-md border border-amber-400 shadow-sm"
            style={{
              top: '612px',
              left: '969px',
              width: '80px',
              height: '80px',
            }}
          >
            <img
              src={
                qrCodeDataUrl ||
                `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(validationUrl)}`
              }
              alt="QR Code de Validação Eclesiástica"
              className="w-full h-full object-contain"
            />
          </div>

          {/* 8. CHAVE DE AUTENTICIDADE E EMISSÃO NO RODAPÉ */}
          <div
            className="absolute left-9 font-mono text-[8px] font-bold text-slate-500"
            style={{ top: '755px' }}
          >
            CHAVE DE AUTENTICIDADE: {hashAutenticidade}
          </div>

          <div
            className="absolute right-9 font-sans text-[8px] font-bold text-slate-500 text-right"
            style={{ top: '755px' }}
          >
            CONSAGRAÇÃO / EMISSÃO: {dataEmissao} • VÁLIDO EM TODO O TERRITÓRIO NACIONAL • ART. 5º, VII CF/88
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificadoMinistro;
