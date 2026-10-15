/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Módulo: Log de Auditoria Visual em Tempo Real (AGO vs. Filiação)
 * Monitoramento Contábil, Integridade ACID e Detecção de Divergência de Valores
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  ArrowRight,
  Sparkles,
  Layers,
  FileText,
  DollarSign,
  UserCheck,
  Calendar,
} from 'lucide-react';
import {
  ouvirLogsAuditoriaAgoFiliacao,
  LogAuditoriaAgoFiliacao,
} from '../services/agoFirebaseService';
import { formatarMoeda } from '../financialEngine';

export function PainelAuditoriaAgoFiliacao() {
  const [logs, setLogs] = useState<LogAuditoriaAgoFiliacao[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [termoBusca, setTermoBusca] = useState<string>('');
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | 'SUCESSO' | 'DIVERGENCIA'>('TODOS');

  useEffect(() => {
    setCarregando(true);
    const unsub = ouvirLogsAuditoriaAgoFiliacao((dados) => {
      setLogs(dados);
      setCarregando(false);
    });

    return () => {
      unsub();
    };
  }, []);

  const logsFiltrados = logs.filter((log) => {
    const matchBusca =
      !termoBusca ||
      log.ministroNome.toLowerCase().includes(termoBusca.toLowerCase()) ||
      log.ministroCpf.includes(termoBusca) ||
      log.cargo.toLowerCase().includes(termoBusca.toLowerCase()) ||
      log.planoNome.toLowerCase().includes(termoBusca.toLowerCase());

    const matchStatus =
      filtroStatus === 'TODOS' ||
      (filtroStatus === 'SUCESSO' && log.statusTransacao === 'CONCLUIDO_COM_SUCESSO') ||
      (filtroStatus === 'DIVERGENCIA' && log.statusTransacao === 'DIVERGENCIA_DETECTADA');

    return matchBusca && matchStatus;
  });

  const totalSucessos = logs.filter((l) => l.statusTransacao === 'CONCLUIDO_COM_SUCESSO').length;
  const totalDivergencias = logs.filter((l) => l.statusTransacao === 'DIVERGENCIA_DETECTADA').length;

  return (
    <div className="space-y-4">
      {/* Cabeçalho do Log com Status em Tempo Real */}
      <div className="p-4 rounded-xl bg-slate-850 border border-slate-700/80 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Log de Auditoria Contábil (AGO vs. Filiação)</h3>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live onSnapshot
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Conciliação atômica em tempo real para prevenção de divergências e duplicidades.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs">
              <span className="text-slate-400">Transações Válidas: </span>
              <strong className="text-emerald-400">{totalSucessos}</strong>
            </div>
            {totalDivergencias > 0 && (
              <div className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs">
                <span className="text-rose-400 font-bold">Divergências: {totalDivergencias}</span>
              </div>
            )}
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-800">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, CPF ou plano no log..."
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFiltroStatus('TODOS')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${
                filtroStatus === 'TODOS'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos ({logs.length})
            </button>
            <button
              onClick={() => setFiltroStatus('SUCESSO')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${
                filtroStatus === 'SUCESSO'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Sucessos
            </button>
            {totalDivergencias > 0 && (
              <button
                onClick={() => setFiltroStatus('DIVERGENCIA')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${
                  filtroStatus === 'DIVERGENCIA'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                Divergências
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lista de Transações Auditadas */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {carregando ? (
          <div className="flex items-center justify-center p-8 text-slate-400 text-xs gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
            <span>Carregando logs de auditoria contábil...</span>
          </div>
        ) : logsFiltrados.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-850/60 border border-slate-800 text-center text-xs text-slate-400">
            Nenhuma transação de cadastro/recebimento registrada no log até o momento.
          </div>
        ) : (
          logsFiltrados.map((log) => {
            const isSucesso = log.statusTransacao === 'CONCLUIDO_COM_SUCESSO';
            return (
              <div
                key={log.id}
                className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  isSucesso
                    ? 'bg-slate-850 border-slate-800 hover:border-slate-700'
                    : 'bg-rose-950/20 border-rose-800/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg mt-0.5 ${
                      isSucesso
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {isSucesso ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white">{log.ministroNome}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                        {log.cargo}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.ehMembroExistente
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {log.ehMembroExistente ? 'Ordenação (Membro Já Filiado)' : 'Novo Recebimento (Filiação + AGO)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 flex-wrap">
                      <span>Plano: <strong className="text-slate-200">{log.planoNome}</strong></span>
                      <span>•</span>
                      <span>Inscrição AGO: <strong className="text-teal-400">{formatarMoeda(log.valorInscricaoAgo)}</strong></span>
                      <span>•</span>
                      <span>
                        Taxa Filiação:{' '}
                        <strong className="text-slate-300">
                          {log.ehMembroExistente ? 'Isenta (Já Filiado)' : formatarMoeda(log.valorFiliacao)}
                        </strong>
                      </span>
                    </div>

                    {log.divergenciaMotivo && (
                      <p className="text-[11px] text-rose-400 font-medium mt-1">
                        ⚠️ Atenção: {log.divergenciaMotivo}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right self-end sm:self-center flex flex-col items-end">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      isSucesso
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {isSucesso ? 'Transação Atômica OK' : 'Divergência'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono mt-1">{log.dataHoraStr}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
