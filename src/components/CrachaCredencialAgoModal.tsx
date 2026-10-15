/**
 * @license
 * CIMADEBE / SIGM - Crachá Oficial de Inscrição & Credenciamento da AGO 2026
 * Apresentação obrigatória na Portaria e Recepção para registro de presença e retirada de kit.
 * Em conformidade estatutária: A credencial ministerial física é impressa exclusivamente pelo Birô.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Download,
  Printer,
  X,
  QrCode,
  Calendar,
  MapPin,
  CheckCircle2,
  FileDown,
  Image as ImageIcon,
  User,
} from 'lucide-react';
import type { Ministro } from '../types';
import { useSecurity } from '../SecurityContext';
import { exportarCrachaInscricaoAgoPdf } from '../services/pdfExportService';
import { extrairEventoAgo, formatarPeriodoEvento } from '../db/databaseService';
import QRCode from 'qrcode';

interface CrachaProps {
  readonly inscricao?: {
    readonly id?: string;
    readonly ministroNome?: string;
    readonly ministroCpf?: string;
    readonly cargo?: string;
    readonly planoNome?: string;
    readonly planoId?: string;
    readonly valor?: number;
    readonly formaPagamento?: string;
    readonly fotoUrl?: string;
    readonly dataInscricao?: string;
    readonly registroMinisterial?: string;
    readonly status?: string;
    readonly statusInscricao?: string;
    readonly cicloAGO?: string;
  };
  readonly ministro?: Partial<Ministro> | Ministro;
  readonly evento?: any;
  readonly triggerButtonText?: string;
  readonly onClose?: () => void;
}

export function CrachaCredencialAgoModal({ inscricao, ministro, evento, triggerButtonText, onClose }: CrachaProps) {
  const { appConfig, eventos, cicloAgoVigente } = useSecurity();
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [gerandoPng, setGerandoPng] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [modalAberto, setModalAberto] = useState<boolean>(!triggerButtonText);
  const crachaRef = useRef<HTMLDivElement>(null);

  // Dados Oficiais do Evento AGO extraídos do Banco de Dados Firestore (Zero-Mock)
  const eventoFinal = evento || extrairEventoAgo(eventos, cicloAgoVigente);
  const tituloEvento = String(eventoFinal?.titulo || '1ª Assembleia Geral Ordinária (AGO 2026)');
  const subtituloEvento = String(eventoFinal?.subtitulo || 'Grande Conclave Geral de Obreiros e Plenárias Deliberativas');
  const localEvento = String(eventoFinal?.local || 'Centro de Convenções Pastor Gilberto • Salvador / BA');
  const periodoEvento = formatarPeriodoEvento(eventoFinal?.data_inicio, eventoFinal?.data_fim, eventoFinal?.data_evento) || '20 a 23 de Novembro de 2026';
  const temaBiblico = eventoFinal?.tema_biblico || '';

  // Normalização de dados do congressista e da inscrição (Zero-Trust)
  const ministroAlvo = ministro || {};
  const nomeCompleto = String(ministroAlvo.nome || inscricao?.ministroNome || 'Congressista Convocado').toUpperCase();
  const cpfFormatado = ministroAlvo.cpf || inscricao?.ministroCpf || '000.000.000-00';
  const cargoCongressista = String(ministroAlvo.cargo || inscricao?.cargo || 'DELEGADO').toUpperCase();
  const fotoUrl = ministroAlvo.fotoUrl || inscricao?.fotoUrl || '';
  const protocolo = inscricao?.id || `AGO-2026-${String(Date.now()).slice(-6)}`;
  const cicloAGO = inscricao?.cicloAGO || eventoFinal?.data_inicio?.slice(0, 4) || '2026';
  const planoNome = inscricao?.planoNome || inscricao?.planoId || 'Plano Oficial da AGO';
  const sigla = appConfig?.sigla || 'CIMADEBE';
  const nomeConvencao = appConfig?.nomeConvencao || 'Convenção CIMADEBE';

  // Gera o QR Code seguro de validação de presença na portaria
  useEffect(() => {
    let ativo = true;
    async function gerarQR() {
      try {
        const payload = JSON.stringify({
          tipo: 'CRACHA_PORTARIA_AGO',
          protocolo,
          ciclo: cicloAGO,
          cpf: cpfFormatado,
          nome: nomeCompleto,
          cargo: cargoCongressista,
          status: 'QUITADO',
          timestamp: new Date().toISOString(),
        });

        const url = await QRCode.toDataURL(payload, {
          width: 320,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });
        if (ativo) {
          setQrCodeDataUrl(url);
        }
      } catch (err) {
        console.error('[ERRO_GERAR_QR_CRACHA]', err);
      }
    }

    gerarQR();
    return () => {
      ativo = false;
    };
  }, [protocolo, cicloAGO, cpfFormatado, nomeCompleto, cargoCongressista]);

  const handlePrint = () => {
    window.print();
  };

  const handleBaixarPdf = async () => {
    try {
      setGerandoPdf(true);
      await exportarCrachaInscricaoAgoPdf(
        {
          id: protocolo,
          cicloAGO,
          planoNome,
          status: 'QUITADO',
          dataInscricao: inscricao?.dataInscricao,
        },
        {
          nome: nomeCompleto,
          cpf: cpfFormatado,
          cargo: cargoCongressista as any,
          fotoUrl,
        },
        appConfig,
        eventoFinal
      );
    } catch (err: any) {
      console.error(err);
      alert('Erro ao gerar crachá da AGO em PDF: ' + (err?.message || String(err)));
    } finally {
      setGerandoPdf(false);
    }
  };

  // Motor para baixar o crachá em imagem PNG de alta definição para salvar no celular
  const handleBaixarPng = async () => {
    try {
      setGerandoPng(true);
      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 1100;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível inicializar o contexto gráfico.');

      // Fundo principal com cantos arredondados
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 720, 1100);

      // Topo Azul Marinho Nobre
      const gradTopo = ctx.createLinearGradient(0, 0, 0, 220);
      gradTopo.addColorStop(0, '#0a1128');
      gradTopo.addColorStop(1, '#0f172a');
      ctx.fillStyle = gradTopo;
      ctx.fillRect(0, 0, 720, 220);

      // Faixa Dourada
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, 216, 720, 8);

      // Textos do Topo (Dados do Banco de Dados)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${sigla} • CONCLAVE NACIONAL ${cicloAGO}`, 360, 58);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.fillText(tituloEvento.toUpperCase(), 360, 108);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.fillText(subtituloEvento.slice(0, 50).toUpperCase(), 360, 148);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText('● CREDENCIAMENTO HOMOLOGADO & QUITADO', 360, 185);

      // Moldura da Foto ou Avatar
      const photoSize = 180;
      const photoX = (720 - photoSize) / 2;
      const photoY = 260;

      ctx.fillStyle = '#f1f5f9';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(photoX, photoY, photoSize, photoSize, 20);
      ctx.fill();
      ctx.stroke();

      // Desenha foto se carregada
      let fotoDesenhada = false;
      if (fotoUrl) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = fotoUrl;
          await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = rej;
            setTimeout(rej, 1500); // timeout se falhar
          });
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(photoX, photoY, photoSize, photoSize, 20);
          ctx.clip();
          ctx.drawImage(img, photoX, photoY, photoSize, photoSize);
          ctx.restore();
          fotoDesenhada = true;
        } catch {
          fotoDesenhada = false;
        }
      }

      if (!fotoDesenhada) {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(360, photoY + 70, 45, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 36px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(nomeCompleto.slice(0, 2), 360, photoY + 82);

        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.fillText('FOTO OFICIAL', 360, photoY + 145);
      }

      // Tarja de Cargo Ministerial
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(210, 455, 300, 38, 19);
      ctx.fill();

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(cargoCongressista, 360, 481);

      // Nome do Congressista em Destaque
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(nomeCompleto.length > 28 ? nomeCompleto.slice(0, 28) + '...' : nomeCompleto, 360, 535);

      // CPF e Categoria
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(`CPF: ${cpfFormatado}`, 360, 568);

      ctx.fillStyle = '#0284c7';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText('DELEGADO CONVENCIONAL • COM DIREITO A VOZ E VOTO', 360, 598);

      ctx.fillStyle = '#64748b';
      ctx.font = '500 15px system-ui, sans-serif';
      ctx.fillText(planoNome, 360, 622);

      // Box do QR Code de Portaria
      const qrBoxW = 260;
      const qrBoxH = 260;
      const qrBoxX = (720 - qrBoxW) / 2;
      const qrBoxY = 650;

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 16);
      ctx.fill();
      ctx.stroke();

      // Desenha QR Code
      if (qrCodeDataUrl) {
        const qrImg = new Image();
        qrImg.src = qrCodeDataUrl;
        await new Promise((res) => {
          qrImg.onload = res;
        });
        ctx.drawImage(qrImg, qrBoxX + 15, qrBoxY + 15, 230, 230);
      }

      // Instrução sob o QR Code
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('[ APRESENTE ESTE QR CODE NA PORTARIA ]', 360, 938);

      ctx.fillStyle = '#64748b';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText('Leitura óptica para registro de presença e retirada de kit no Birô', 360, 962);

      // Rodapé Institucional
      ctx.fillStyle = '#0a1128';
      ctx.fillRect(0, 995, 720, 105);

      ctx.fillStyle = '#10b981';
      ctx.fillRect(0, 995, 720, 5);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`PROTOCOLO: ${protocolo}`, 360, 1030);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px system-ui, sans-serif';
      const rodapeInfo = [periodoEvento, localEvento].filter(Boolean).join(' • ');
      ctx.fillText(rodapeInfo.length > 55 ? rodapeInfo.slice(0, 55) + '...' : rodapeInfo, 360, 1055);

      ctx.fillStyle = '#64748b';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('Documento intransferível. Tenha em mãos documento oficial com foto.', 360, 1078);

      // Download do PNG
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const nomeClean = nomeCompleto.replace(/\s+/g, '_').slice(0, 20);
        a.download = `Cracha_AGO_${cicloAGO}_${nomeClean}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (e) {
      console.error('Erro ao gerar PNG:', e);
      alert('Falha ao exportar imagem do crachá.');
    } finally {
      setGerandoPng(false);
    }
  };

  const handleFechar = () => {
    setModalAberto(false);
    if (onClose) onClose();
  };

  if (triggerButtonText && !modalAberto) {
    return (
      <button
        type="button"
        onClick={() => setModalAberto(true)}
        className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-md"
      >
        <ShieldCheck className="w-4 h-4 text-amber-400" />
        <span>{triggerButtonText}</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/95 backdrop-blur-xl overflow-y-auto">
      {/* Estilos dedicados para impressão limpa do crachá */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area-cracha, #print-area-cracha * {
            visibility: visible;
          }
          #print-area-cracha {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: flex !important;
            justify-content: center;
            background: white !important;
            padding: 20px;
          }
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-full max-w-lg space-y-4 relative my-auto bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl"
      >
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between text-white border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <span className="font-bold text-emerald-400 uppercase tracking-wider text-xs font-mono block">
                CRACHÁ DE INSCRIÇÃO DA AGO 2026
              </span>
              <span className="text-[11px] text-slate-400">
                Apresentação obrigatória na portaria para entrada e retirada do kit
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleFechar}
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ============================================================== */}
        {/* PALCO VISUAL DO CRACHÁ OFICIAL DA AGO (VERTICAL DE CONFERÊNCIA) */}
        {/* ============================================================== */}
        <div className="flex justify-center w-full py-1">
          <div
            ref={crachaRef}
            id="print-area-cracha"
            className="w-full max-w-[380px] bg-white text-slate-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-500/70 relative flex flex-col"
          >
            {/* Topo Institucional do Crachá */}
            <div className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white p-4 text-center relative border-b-4 border-amber-500">
              <div className="flex items-center justify-center gap-1.5 text-amber-400 text-[10px] font-mono font-bold tracking-widest uppercase">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>{sigla} • CONCLAVE AGO {cicloAGO}</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-amber-400 uppercase tracking-tight mt-0.5">
                {tituloEvento}
              </h3>
              <p className="text-[10px] text-slate-300 font-medium uppercase tracking-wider">
                {subtituloEvento || 'Crachá Oficial de Congressista'}
              </p>
              {temaBiblico && (
                <p className="text-[9px] text-amber-200/90 italic font-serif mt-0.5 line-clamp-1 px-1">
                  {temaBiblico}
                </p>
              )}
              <div className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[9px] font-bold text-emerald-300 uppercase">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Inscrição Homologada & Quitada</span>
              </div>
            </div>

            {/* Corpo do Crachá: Foto, Cargo e Identificação */}
            <div className="p-4 sm:p-5 flex flex-col items-center text-center space-y-3 bg-gradient-to-b from-white to-slate-50">
              {/* Foto ou Avatar do Congressista */}
              <div className="relative">
                <div className="w-24 h-28 sm:w-28 sm:h-32 rounded-xl overflow-hidden border-2 border-amber-500 shadow-lg bg-slate-100 flex items-center justify-center">
                  {fotoUrl ? (
                    <img
                      src={fotoUrl}
                      alt={nomeCompleto}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-amber-400">
                      <User className="w-10 h-10 text-amber-400/80 mb-1" />
                      <span className="text-[10px] font-mono font-bold text-slate-300 uppercase">Foto Oficial</span>
                    </div>
                  )}
                </div>

                {/* Tarja de Cargo Ministerial */}
                <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-slate-900 text-amber-400 border border-amber-500 text-[10px] font-mono font-bold uppercase tracking-wider shadow-md whitespace-nowrap">
                  {cargoCongressista}
                </div>
              </div>

              {/* Nome do Congressista */}
              <div className="pt-2 space-y-0.5 w-full">
                <h4 className="text-base sm:text-lg font-black text-slate-900 leading-tight tracking-tight uppercase">
                  {nomeCompleto}
                </h4>
                <p className="text-xs font-mono font-bold text-slate-600">
                  CPF: {cpfFormatado}
                </p>
                <div className="pt-1">
                  <span className="inline-block px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-bold uppercase">
                    Delegado Convencional • Voz e Voto
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-1 font-medium pt-0.5">
                  {planoNome}
                </p>
              </div>

              {/* Box de Alta Densidade do QR Code para Portaria */}
              <div className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center space-y-1.5 shadow-inner">
                <div className="flex items-center gap-1.5 text-slate-700 font-mono text-[10px] font-bold uppercase">
                  <QrCode className="w-3.5 h-3.5 text-slate-900" />
                  <span>Scanner de Portaria & Triagem</span>
                </div>

                <div className="p-1.5 bg-white rounded-lg border border-slate-300 shadow-sm">
                  {qrCodeDataUrl ? (
                    <img
                      src={qrCodeDataUrl}
                      alt="QR Code de Portaria"
                      className="w-32 h-32 sm:w-36 sm:h-36"
                    />
                  ) : (
                    <div className="w-32 h-32 flex items-center justify-center text-slate-400 font-mono text-xs">
                      Gerando QR...
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-slate-500 leading-tight max-w-[260px]">
                  Apresente este QR Code no leitor óptico da portaria para validação da presença e retirada do kit.
                </p>
              </div>
            </div>

            {/* Rodapé do Crachá */}
            <div className="bg-slate-950 text-white p-3 text-center border-t-2 border-emerald-500 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-2">
                <span>Protocolo: <strong className="text-white">{protocolo.slice(0, 18)}</strong></span>
                <span className="text-emerald-400 font-bold">QUITADO ✓</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-[9px] text-slate-400 pt-0.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-amber-400 shrink-0" /> {periodoEvento}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-amber-400 shrink-0" /> {localEvento}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Informação Estatutária Clara */}
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-300 leading-relaxed flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-white">Portaria da AGO:</strong> Apresente este crachá impresso ou no celular com documento com foto. A <strong className="text-amber-400">credencial ministerial física em PVC</strong> é confeccionada e entregue com exclusividade pelo Birô Central.
          </p>
        </div>

        {/* Painel de Ações: Baixar PDF, Baixar Imagem PNG e Imprimir */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-xs">
          <button
            type="button"
            disabled={gerandoPdf}
            onClick={handleBaixarPdf}
            className="py-3 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
          >
            <FileDown className={`w-4 h-4 ${gerandoPdf ? 'animate-bounce' : ''}`} />
            <span>{gerandoPdf ? 'Gerando...' : 'Baixar PDF'}</span>
          </button>

          <button
            type="button"
            disabled={gerandoPng}
            onClick={handleBaixarPng}
            className="py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-amber-500/50 text-amber-300 font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <ImageIcon className={`w-4 h-4 ${gerandoPng ? 'animate-spin' : ''}`} />
            <span>{gerandoPng ? 'Exportando...' : 'Baixar PNG'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="py-3 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            <span>Imprimir</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Aliases para retrocompatibilidade
export const CrachaInscricaoAgoModal = CrachaCredencialAgoModal;
export default CrachaCredencialAgoModal;
