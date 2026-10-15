/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * PortalCredencialSvg - Componente de Exportação Vetorial CR-80 (Gráfica / CorelDRAW / Illustrator)
 * Dimensões Exatas: 85.60mm x 53.98mm (viewBox 0 0 324 204)
 * Anti-Bypass F12: Exige adimplência confirmada no servidor antes de liberar o fluxo.
 */

import React, { useState } from 'react';
import { Download, Loader2, ShieldCheck, ShieldAlert, Sparkles, FileCode } from 'lucide-react';
import { Ministro } from '../types';

interface PortalCredencialSvgProps {
  readonly ministro: Ministro;
  readonly className?: string;
  readonly compact?: boolean;
}

export function PortalCredencialSvg({
  ministro,
  className = '',
  compact = false,
}: PortalCredencialSvgProps) {
  const [baixando, setBaixando] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<boolean>(false);

  // Verificação estrita de adimplência inicial no cliente
  const stAdimplencia = String(ministro?.statusAdimplencia || 'ADIMPLENTE').toUpperCase();
  const isInadimplente =
    stAdimplencia === 'INADIMPLENTE' ||
    stAdimplencia === 'PENDENTE' ||
    stAdimplencia === 'SUSPENSO';

  const handleExportarSvg = async () => {
    if (!ministro || !ministro.id) return;
    if (isInadimplente) {
      setErro('Emissão bloqueada: Ministro possui pendências cadastrais ou financeiras (Inadimplente).');
      return;
    }

    setBaixando(true);
    setErro(null);
    setSucesso(false);

    try {
      const cleanCpf = String(ministro.cpf || '').replace(/\D/g, '');
      const ministroIdentificador = ministro.id || cleanCpf;

      // Chama a rota de compilação vetorial do servidor
      // A rota executa validação server-side rígida de adimplência (Anti-Bypass F12)
      const res = await fetch(`/api/minister/credencial/svg/${encodeURIComponent(ministroIdentificador)}`, {
        method: 'GET',
        headers: {
          Accept: 'image/svg+xml, application/json',
        },
      });

      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error || 'Acesso negado (403): O motor financeiro identificou pendência de anuidade.'
        );
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro HTTP ${res.status} ao compilar credencial vetorial.`);
      }

      const svgBlob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(svgBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `CIMADEBE_Credencial_CR80_${cleanCpf || ministro.id}_Grafica.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setSucesso(true);
      setTimeout(() => setSucesso(false), 4000);
    } catch (err: any) {
      console.error('[PORTAL_CREDENCIAL_SVG_ERR]', err);
      setErro(err?.message || 'Falha ao descarregar arquivo vetorial SVG da gráfica.');
    } finally {
      setBaixando(false);
    }
  };

  if (compact) {
    return (
      <div className={`inline-flex flex-col items-start ${className}`}>
        <button
          type="button"
          onClick={handleExportarSvg}
          disabled={baixando || isInadimplente}
          title={
            isInadimplente
              ? 'Emissão bloqueada por pendência financeira'
              : 'Exportar arquivo vetorial SVG padrão PVC CR-80 para impressão gráfica'
          }
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed ${
            isInadimplente
              ? 'bg-slate-800 text-slate-500 border border-slate-700/60 opacity-60'
              : baixando
              ? 'bg-amber-600/50 text-amber-200 border border-amber-500/50 cursor-wait'
              : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 border border-amber-400/40 shadow-sm'
          }`}
        >
          {baixando ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FileCode className="w-3.5 h-3.5" />
          )}
          <span>{baixando ? 'Gerando...' : 'Exportar SVG (Gráfica)'}</span>
        </button>

        {erro && <span className="text-[10px] text-rose-400 font-mono mt-1">{erro}</span>}
        {sucesso && <span className="text-[10px] text-emerald-400 font-mono mt-1">SVG baixado!</span>}
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-xl bg-slate-900/90 border border-amber-500/30 backdrop-blur-md space-y-3 shadow-md ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <FileCode className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold font-mono text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>Credencial Vetorial CR-80</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-500/40">
                PRO GRÁFICA
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Vetor puro (85,60 mm x 53,98 mm) com textos e curvas editáveis para CorelDRAW e Illustrator.
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {isInadimplente ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-950/80 text-rose-400 border border-rose-500/30 text-[10px] font-mono font-bold">
              <ShieldAlert className="w-3 h-3" />
              <span>BLOQUEADO</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
              <ShieldCheck className="w-3 h-3" />
              <span>REGULAR</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1 border-t border-slate-800">
        <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
          <span>Dimensões CR-80: 324 x 204 px • Foto em Base64 • QR Code Vetorial</span>
        </div>

        <button
          type="button"
          onClick={handleExportarSvg}
          disabled={baixando || isInadimplente}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed ${
            isInadimplente
              ? 'bg-slate-800 text-slate-500 border border-slate-700/60 opacity-60'
              : baixando
              ? 'bg-amber-600/50 text-amber-200 border border-amber-500/50 cursor-wait'
              : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black shadow-md'
          }`}
        >
          {baixando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              <span>Compilando SVG...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4 text-slate-950" />
              <span>Exportar Credencial Vetorial (Gráfica)</span>
            </>
          )}
        </button>
      </div>

      {erro && (
        <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {sucesso && (
        <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Arquivo vetorial SVG (CR-80) descarregado com sucesso para produção gráfica!</span>
        </div>
      )}
    </div>
  );
}

export default PortalCredencialSvg;
