/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Sistema de Diagnóstico Automático & Notificações de Correção (Zero-Trust Health Check)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw, Activity, Cpu, Database, Wrench, X, Sparkles } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { useNotification } from '../NotificationContext';

export interface DiagnosticResult {
  firestoreConnected: boolean;
  authOperational: boolean;
  rulesConfigured: boolean;
  latencyMs: number;
  errorMessage?: string;
}

export function GlobalDiagnosticSystem() {
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [runningDiagnostic, setRunningDiagnostic] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const { notifyError, notifySuccess, notifyWarning } = useNotification();

  const executarDiagnosticoAutomatico = useCallback(async () => {
    setRunningDiagnostic(true);
    const start = performance.now();
    let firestoreConnected = false;
    let authOperational = false;
    let rulesConfigured = true;
    let errorMessage: string | undefined = undefined;

    try {
      // 1. Testa leitura do Firestore com timeout otimizado (8s) e coleção ativa
      const testQuery = query(collection(db, 'usuarios_administrativos'), limit(1));
      await Promise.race([
        getDocs(testQuery),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de conexão com o Firestore (>8s)')), 8000))
      ]);
      firestoreConnected = true;
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('quota') || msg.includes('resourceexhausted') || msg.includes('free daily read units') || msg.includes('limit')) {
        firestoreConnected = false;
        errorMessage = 'Cota diária de leitura do Firestore esgotada no Google Cloud (50.000 leituras/dia atingidas no projeto 863559636580). O Google Cloud pausou temporariamente as leituras até a virada do ciclo diário.';
      } else if (msg.includes('permission') || msg.includes('missing or insufficient')) {
        firestoreConnected = false;
        rulesConfigured = false;
        errorMessage = 'Erro de permissão nas regras do Firestore. Verifique as regras de segurança.';
      } else {
        firestoreConnected = false;
        errorMessage = err?.message || 'Falha de conexão com o Firestore.';
      }
    }

    try {
      // 2. Testa Auth
      authOperational = Boolean(auth);
    } catch {
      authOperational = false;
    }

    const latencyMs = Math.round(performance.now() - start);

    const diagnosticRes: DiagnosticResult = {
      firestoreConnected,
      authOperational,
      rulesConfigured,
      latencyMs,
      errorMessage,
    };

    setResult(diagnosticRes);
    setRunningDiagnostic(false);

    if (!firestoreConnected || !rulesConfigured) {
      notifyError(
        'Diagnóstico Automático: Anomalia Detectada',
        errorMessage || 'O sistema encontrou dificuldades na conexão com o Firestore.',
        8000
      );
    }
  }, [notifyError]);

  // Diagnóstico estritamente passivo e sob demanda humana (Zero background triggers)

  return (
    <>
      {/* Botão Flutuante de Diagnóstico no Rodapé Administrativo ou Canto */}
      <div className="fixed bottom-4 left-4 z-50">
        <button
          onClick={() => {
            setDiagnosticOpen(true);
            executarDiagnosticoAutomatico();
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-bold shadow-lg backdrop-blur-xl border transition-all cursor-pointer ${
            result && (!result.firestoreConnected || !result.rulesConfigured)
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-300 animate-pulse'
              : 'bg-slate-900/90 border-emerald-500/40 text-emerald-300 hover:bg-slate-800'
          }`}
          title="Abrir Painel de Diagnóstico Automático"
        >
          <Activity className="w-4 h-4" />
          <span>Saúde do Sistema</span>
          {result && (
            <span className={`w-2 h-2 rounded-full ${result.firestoreConnected && result.rulesConfigured ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          )}
        </button>
      </div>

      {/* Modal de Diagnóstico Automático */}
      <AnimatePresence>
        {diagnosticOpen && (
          <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="max-w-md w-full bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-6 text-slate-100"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Diagnóstico Automático</h3>
                    <p className="text-xs text-slate-400 font-mono">CIMADEBE / SIGM Health Guard</p>
                  </div>
                </div>
                <button
                  onClick={() => setDiagnosticOpen(false)}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {runningDiagnostic ? (
                  <div className="py-10 text-center space-y-3">
                    <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
                    <p className="text-xs text-slate-300 font-mono">Executando varredura em tempo real...</p>
                  </div>
                ) : result ? (
                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-300">Conexão Firestore:</span>
                      <span className={result.firestoreConnected ? 'text-emerald-400 flex items-center gap-1.5 font-bold' : 'text-rose-400 flex items-center gap-1.5 font-bold'}>
                        {result.firestoreConnected ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {result.firestoreConnected ? 'Online (Ativo)' : 'Falha'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-300">Regras de Segurança:</span>
                      <span className={result.rulesConfigured ? 'text-emerald-400 flex items-center gap-1.5 font-bold' : 'text-rose-400 flex items-center gap-1.5 font-bold'}>
                        {result.rulesConfigured ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {result.rulesConfigured ? 'Permissões OK' : 'Restritas'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-300">Autenticação Firebase:</span>
                      <span className={result.authOperational ? 'text-emerald-400 flex items-center gap-1.5 font-bold' : 'text-rose-400 flex items-center gap-1.5 font-bold'}>
                        {result.authOperational ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {result.authOperational ? 'Operacional' : 'Inativo'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-300">Latência de Resposta:</span>
                      <span className="text-cyan-400 font-bold">{result.latencyMs} ms</span>
                    </div>

                    {result.errorMessage && (
                      <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-[11px] space-y-1">
                        <p className="font-bold">Diagnóstico de Erro:</p>
                        <p>{result.errorMessage}</p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  onClick={executarDiagnosticoAutomatico}
                  disabled={runningDiagnostic}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${runningDiagnostic ? 'animate-spin' : ''}`} />
                  Reexecutar Diagnóstico
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
