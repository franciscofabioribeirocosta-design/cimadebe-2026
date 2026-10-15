/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Componente Guardião de Manutenção do CMS
 * Renderiza interface limpa e institucional quando a página estiver inativa.
 */

import React, { type ReactNode } from 'react';
import { useSecurity } from '../SecurityContext';
import type { CmsPaginasVisiveis } from '../types';
import { Clock } from 'lucide-react';

interface CmsInterceptionGuardProps {
  readonly paginaKey: keyof CmsPaginasVisiveis;
  readonly tituloPagina: string;
  readonly children: ReactNode;
  readonly onIrParaHome?: () => void;
}

export function CmsInterceptionGuard({
  paginaKey,
  tituloPagina,
  children,
  onIrParaHome,
}: CmsInterceptionGuardProps) {
  const { cmsSettings, tenantAtivo } = useSecurity();
  const visivel = cmsSettings.paginasVisiveis[paginaKey];

  if (visivel) {
    return <>{children}</>;
  }

  // Interface Limpa e Institucional (Sem telemetria, logs de sistema ou jargões de mecanismo)
  return (
    <div className="relative min-h-[480px] w-full rounded-3xl bg-slate-900/60 border border-slate-800 p-8 sm:p-12 overflow-hidden flex flex-col items-center justify-center text-center shadow-xl backdrop-blur-md">
      <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-6 shadow-inner">
        <Clock className="w-8 h-8" />
      </div>

      <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight max-w-lg mb-3">
        Seção Temporariamente Indisponível
      </h2>

      <p className="text-sm text-slate-400 max-w-md mb-8 leading-relaxed">
        A página <span className="text-teal-300 font-semibold">{tituloPagina}</span> está temporariamente em manutenção pela administração de{' '}
        <span className="text-white font-medium">{tenantAtivo?.nome || 'CIMADEBE'}</span>. Em breve o conteúdo estará disponível novamente.
      </p>

      {onIrParaHome && (
        <button
          onClick={onIrParaHome}
          className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
        >
          Retornar ao Painel Principal
        </button>
      )}
    </div>
  );
}
