/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * GlobalErrorBoundary.tsx
 * Monitoramento Global de Execução, Validação de Implantação e Captura de Erros de Requisição/Clique
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { AlertTriangle, RefreshCw, Copy, Check, ShieldAlert, Bug, Terminal } from 'lucide-react';

export const APP_BUILD_SIGNATURE = {
  version: '2026.09.27-v5.4.1',
  timestamp: '2026-09-27 15:22:00 UTC-3',
  status: 'IMPLANTADO_E_VERIFICADO',
  environment: 'PRODUCTION_PREVIEW',
};

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  lastActionTarget: string | null;
  logsNotificados: Array<{ id: string; timestamp: string; mensagem: string; acao: string; stack?: string }>;
  copiado: boolean;
  painelAberto: boolean;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    lastActionTarget: null,
    logsNotificados: [],
    copiado: false,
    painelAberto: false,
  };

  private isIgnorableError(message: string, stack: string = ''): boolean {
    const msg = (message || '').toLowerCase();
    const stk = (stack || '').toLowerCase();
    return (
      msg.includes('websocket') ||
      msg.includes('vite') ||
      msg.includes('hmr') ||
      stk.includes('@vite/client') ||
      stk.includes('vite/client')
    );
  }

  private unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const errorMessage = reason instanceof Error ? reason.message : String(reason || 'Erro assíncrono não tratado');
    const stack = reason instanceof Error ? reason.stack || '' : '';

    if (this.isIgnorableError(errorMessage, stack)) {
      // Ignora avisos normais do ambiente de preview sobre WebSocket HMR desativado
      return;
    }

    this.registrarEExibirErro(
      new Error(`[Promise Rejection]: ${errorMessage}`),
      { componentStack: stack || 'Capturado via window.unhandledrejection' },
      'REQUISICAO_ASSINCRONA'
    );
  };

  private windowErrorHandler = (event: ErrorEvent) => {
    const message = event.message || '';
    const stack = `${event.filename}:${event.lineno}:${event.colno}`;

    if (this.isIgnorableError(message, stack)) {
      return;
    }

    this.registrarEExibirErro(
      event.error || new Error(message),
      { componentStack: stack },
      'ERRO_RUNTIME_GLOBAL'
    );
  };

  private globalClickHandler = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const elementoClicavel = target.closest('button, a, input[type="submit"], [role="button"]');
    if (elementoClicavel) {
      const texto = elementoClicavel.textContent?.trim() || elementoClicavel.getAttribute('aria-label') || elementoClicavel.tagName;
      this.setState({ lastActionTarget: `Clique em: [${texto}]` });
    }
  };

  public componentDidMount() {
    window.addEventListener('unhandledrejection', this.unhandledRejectionHandler);
    window.addEventListener('error', this.windowErrorHandler);
    window.addEventListener('click', this.globalClickHandler, true);
  }

  public componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.unhandledRejectionHandler);
    window.removeEventListener('error', this.windowErrorHandler);
    window.removeEventListener('click', this.globalClickHandler, true);
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.registrarEExibirErro(error, errorInfo, 'ERRO_COMPONENTE_REACT');
  }

  private async registrarEExibirErro(error: Error, info: { componentStack?: string | null }, origem: string) {
    const acaoContexto = this.state.lastActionTarget || 'Ação do Usuário';
    const logItem = {
      id: `err-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('pt-BR'),
      mensagem: error.message || 'Exceção desconhecida',
      acao: acaoContexto,
      stack: info.componentStack || error.stack || '',
    };

    console.error(`🔴 [MONITORAMENTO SIGM]: Erro detectado na ação "${acaoContexto}":`, error, info);

    this.setState((prev) => ({
      logsNotificados: [logItem, ...prev.logsNotificados.slice(0, 9)],
      errorInfo: info as any,
    }));

    // Tenta persistir a telemetria no Firestore para diagnóstico automático
    try {
      if (db) {
        await addDoc(collection(db, 'registros_erros_sistema'), {
          build: APP_BUILD_SIGNATURE,
          origem,
          mensagem: error.message,
          stack: info.componentStack || error.stack || '',
          acaoContexto,
          userAgent: navigator.userAgent,
          dataHora: serverTimestamp(),
        });
      }
    } catch (e) {
      console.warn('Não foi possível gravar telemetria no Firestore:', e);
    }
  }

  private copiarRelatorioGeral = () => {
    const { error, errorInfo, lastActionTarget, logsNotificados } = this.state;
    const relatorio = `
🚨 RELATÓRIO DE ERRO DE EXECUÇÃO E IMPLANTAÇÃO SIGM
==================================================
Versão da Implantação: ${APP_BUILD_SIGNATURE.version}
Timestamp do Build: ${APP_BUILD_SIGNATURE.timestamp}
Status: ${APP_BUILD_SIGNATURE.status}
Última Ação do Usuário: ${lastActionTarget || 'N/A'}
Data/Hora: ${new Date().toLocaleString('pt-BR')}

ERRO PRINCIPAL:
${error?.message || 'Sem mensagem'}

STACK TRACE:
${errorInfo?.componentStack || error?.stack || 'Sem stack trace'}

HISTÓRICO RECENTE DE FALHAS:
${logsNotificados.map((l) => `[${l.timestamp}] [${l.acao}] ${l.mensagem}`).join('\n')}
==================================================
`;

    navigator.clipboard.writeText(relatorio.trim());
    this.setState({ copiado: true });
    setTimeout(() => this.setState({ copiado: false }), 3000);
  };

  private reiniciarModulo = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  public render() {
    const { hasError, error, errorInfo, logsNotificados, copiado, painelAberto } = this.state;

    if (hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white font-sans flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-3xl bg-slate-900 border border-rose-500/50 rounded-3xl p-6 sm:p-10 shadow-[0_0_50px_rgba(244,63,94,0.2)] space-y-6">
            <div className="flex items-center gap-4 border-b border-slate-800 pb-6">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-950 border border-rose-500/40 px-3 py-1 rounded-full uppercase">
                  FALHA NA EXECUÇÃO DO MÓDULO • BUILD {APP_BUILD_SIGNATURE.version}
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                  Erro Detectado no Componente / Ação
                </h2>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs text-rose-300">
              <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/80 pb-2">
                <span>ÚLTIMA AÇÃO REGISTRADA:</span>
                <span className="text-white font-bold">{this.state.lastActionTarget || 'Clique/Requisição'}</span>
              </div>

              <div className="space-y-1">
                <span className="text-rose-400 font-bold block">MENSAGEM DE ERRO:</span>
                <p className="text-slate-200 font-sans text-sm leading-relaxed">
                  {error?.message || 'Falha de renderização no componente React.'}
                </p>
              </div>

              {errorInfo?.componentStack && (
                <div className="space-y-1 pt-2 border-t border-slate-800">
                  <span className="text-slate-500 block text-[10px]">STACK TRACE COMPLETO:</span>
                  <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[10px] text-slate-400 overflow-x-auto max-h-40">
                    {errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={this.copiarRelatorioGeral}
                className="px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-rose-600/30"
              >
                {copiado ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiado ? 'Relatório Copiado para Notificar!' : 'Copiar Relatório de Erro'}</span>
              </button>

              <button
                type="button"
                onClick={this.reiniciarModulo}
                className="px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 border border-slate-700"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recarregar / Tentar Novamente</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        {this.props.children}

        {/* NOTIFICADOR DE INTERCEPTAÇÃO EM TEMPO REAL QUANDO OCORRE UM ERRO ASSÍNCRONO */}
        {logsNotificados.length > 0 && (
          <div className="fixed bottom-4 right-4 z-[9999] max-w-md w-full space-y-2 font-mono text-xs">
            <div className="p-4 rounded-2xl bg-slate-900/95 border border-rose-500/60 text-white shadow-2xl backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-400 font-bold">
                  <Bug className="w-4 h-4" />
                  <span>ALERTA DE FALHA EM TEMPO REAL</span>
                </div>
                <button
                  type="button"
                  onClick={() => this.setState({ painelAberto: !painelAberto })}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 font-bold"
                >
                  {painelAberto ? 'Ocultar' : 'Ver Logs'}
                </button>
              </div>

              <p className="text-slate-300 text-[11px] font-sans leading-tight">
                Uma requisição ou ação falhou durante a execução. O erro foi registrado no console e na telemetria.
              </p>

              {painelAberto && (
                <div className="space-y-2 pt-2 border-t border-slate-800 max-h-48 overflow-y-auto">
                  {logsNotificados.map((log) => (
                    <div key={log.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>{log.timestamp}</span>
                        <span className="text-indigo-400 font-bold">{log.acao}</span>
                      </div>
                      <p className="text-rose-300 text-[11px] font-bold leading-tight">{log.mensagem}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-1 flex items-center justify-between">
                <span className="text-[9px] text-slate-500">BUILD {APP_BUILD_SIGNATURE.version}</span>
                <button
                  type="button"
                  onClick={this.copiarRelatorioGeral}
                  className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold flex items-center gap-1"
                >
                  {copiado ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                  <span>{copiado ? 'Copiado!' : 'Copiar Erro'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
}
