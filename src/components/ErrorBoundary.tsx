/**
 * @license
 * CIMADEBE / SIGM - Error Boundary Component
 * Prevents blank black screens and provides graceful error recovery with cache clearing.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly hasError: boolean;
  readonly error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CIMADEBE Error Boundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 select-none">
          <div className="max-w-md w-full bg-slate-900 border border-amber-500/40 rounded-3xl p-8 space-y-6 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto text-2xl font-bold shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              ⚡
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold tracking-widest bg-amber-950 text-amber-400 px-3 py-1 rounded-full border border-amber-500/30">
                SYSTEM RECOVERY GATE
              </span>
              <h1 className="text-lg font-bold text-white mt-2">
                Recuperação de Erro do Sistema
              </h1>
              <p className="text-xs text-slate-400 font-mono">
                {this.state.error?.message || 'Erro inesperado na renderização do shell.'}
              </p>
            </div>
            <div className="space-y-3 pt-2">
              <button
                onClick={() => {
                  window.location.reload();
                }}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer transition-all shadow-lg"
              >
                Limpar Cache e Reiniciar Aplicação
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition-all border border-slate-700"
              >
                Recarregar Página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
