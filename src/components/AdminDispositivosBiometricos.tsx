/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * AdminDispositivosBiometricos.tsx - Gestão de Dispositivos FIDO2 / Passkeys com Pipeline writeBatch
 */

import React, { useState, useEffect } from 'react';
import { Shield, Key, Trash2, Loader2, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

interface BiometricDevice {
  id: string;
  credentialId?: string;
  email?: string;
  userId?: string;
  deviceModel?: string;
  counter?: number;
  criadoEm?: string;
  status?: string;
}

export function AdminDispositivosBiometricos() {
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchDevices = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/biometrics/devices');
      if (!res.ok) {
        throw new Error('Falha ao carregar dispositivos biométricos.');
      }
      const data = await res.json();
      if (data && Array.isArray(data.devices)) {
        setDevices(data.devices);
      } else {
        setDevices([]);
      }
    } catch (err: any) {
      console.error('[FETCH DEVICES ERROR]:', err);
      setDevices([]);
      setFeedback({ type: 'error', message: err?.message || 'Erro ao carregar lista de dispositivos.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleRevokeDevice = async (idDeletado: string, ministroId?: string) => {
    if (processandoId !== null) return;
    setProcessandoId(idDeletado);
    setFeedback(null);

    try {
      const res = await fetch('/api/biometrics/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: idDeletado, ministroId })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao revogar credencial biométrica.');
      }

      // Strict Row Isolation UI Filtering
      setDevices((prev) => prev.filter((item) => item.id !== idDeletado));
      setFeedback({ type: 'success', message: 'Credencial biométrica revogada e isolada com sucesso.' });
    } catch (err: any) {
      console.error('[REVOKE DEVICE ERROR]:', err);
      setFeedback({ type: 'error', message: err?.message || 'Erro ao revogar credencial.' });
    } finally {
      setProcessandoId(null);
    }
  };

  return (
    <div className="w-full space-y-6 text-slate-100 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[10px] tracking-widest uppercase">
              <Shield className="w-3.5 h-3.5" /> FIDO2 / Passkeys Hardware Security
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">Gestão de Dispositivos Biométricos</h2>
          </div>
        </div>

        <button
          onClick={fetchDevices}
          disabled={loading}
          className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold flex items-center gap-2 border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar Dispositivos</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-mono flex items-center gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Devices Table / Clean Array Stasis */}
      <div className="rounded-3xl bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 shadow-2xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400 font-mono text-xs">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            <span>Carregando chaves de segurança biométricas...</span>
          </div>
        ) : devices.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400 font-mono text-xs">
            <Key className="w-10 h-10 text-slate-600" />
            <span>Nenhum dispositivo biométrico FIDO2 cadastrado no momento.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-mono tracking-widest text-slate-400 uppercase bg-slate-950/50">
                  <th className="py-4 px-6">ID Credencial</th>
                  <th className="py-4 px-6">Operador / E-mail</th>
                  <th className="py-4 px-6">Dispositivo</th>
                  <th className="py-4 px-6">Contador (Counter)</th>
                  <th className="py-4 px-6">Data de Registro</th>
                  <th className="py-4 px-6 text-right">Ação Governança</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
                {devices.map((dev) => (
                  <tr key={dev.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-4 px-6 font-mono text-amber-400 truncate max-w-[140px]" title={dev.credentialId || dev.id}>
                      {dev.credentialId || dev.id}
                    </td>
                    <td className="py-4 px-6 text-slate-200">{dev.email || dev.userId || 'N/A'}</td>
                    <td className="py-4 px-6 text-slate-300">{dev.deviceModel || 'Hardware Passkey'}</td>
                    <td className="py-4 px-6 text-slate-300 font-bold">{dev.counter ?? 0}</td>
                    <td className="py-4 px-6 text-slate-400">
                      {dev.criadoEm ? new Date(dev.criadoEm).toLocaleDateString('pt-BR') : 'N/A'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        type="button"
                        disabled={processandoId !== null}
                        onClick={() => handleRevokeDevice(dev.id, dev.userId)}
                        className="py-2 px-3 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 text-xs font-bold transition-all border border-rose-800/80 flex items-center gap-1.5 ml-auto cursor-pointer disabled:opacity-50"
                      >
                        {processandoId === dev.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Revogando...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Revogar Acesso</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
