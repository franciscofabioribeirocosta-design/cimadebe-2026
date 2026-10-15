/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * AdminPlenariaAgo - Painel Administrativo da Plenária Deliberativa da AGO
 * Quórum em Tempo Real, Controle de Pautas e Terminal de Check-in de Delegados
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  Vote,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Plus,
  Play,
  Square,
  RefreshCw,
  Search,
  UserCheck,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  QrCode,
  Flame,
  Award,
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useSecurity } from '../SecurityContext';
import { useNotification } from '../NotificationContext';

export interface PautaAgoItem {
  id: string;
  titulo: string;
  descricao?: string;
  status: 'VOTACAO_ABERTA' | 'VOTACAO_ENCERRADA';
  votosFavor: number;
  votosContra: number;
  abstencoes: number;
  totalVotos: number;
  abertaEm?: string;
  encerradaEm?: string;
}

export function AdminPlenariaAgo() {
  const { ministros, operadorAtual, tenantAtivo } = useSecurity();
  const { notifySuccess, notifyError } = useNotification();

  // Estados de Pautas
  const [pautas, setPautas] = useState<PautaAgoItem[]>([]);
  const [carregandoPautas, setCarregandoPautas] = useState<boolean>(true);
  const [modalNovaPauta, setModalNovaPauta] = useState<boolean>(false);
  const [novaPautaTitulo, setNovaPautaTitulo] = useState<string>('');
  const [novaPautaDescricao, setNovaPautaDescricao] = useState<string>('');
  const [processandoAcao, setProcessandoAcao] = useState<boolean>(false);

  // Estados de Check-in Rápido
  const [buscaDelegado, setBuscaDelegado] = useState<string>('');
  const [checkinStatus, setCheckinStatus] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [processandoCheckinId, setProcessandoCheckinId] = useState<string | null>(null);

  // Quórum derivado diretamente dos dados canônicos em memória passiva
  const totalMinistrosAtivos = ministros.filter((m) => m.status === 'ATIVO').length;
  const presentesEmPlenaria = ministros.filter((m) => m.status === 'ATIVO' && (m as any).presencaAgoVigente === true).length;
  const percPresentes = totalMinistrosAtivos > 0 ? ((presentesEmPlenaria / totalMinistrosAtivos) * 100).toFixed(1) : '0';

  // Listener Singleton Passivo para Pautas da AGO (limit 20)
  useEffect(() => {
    setCarregandoPautas(true);
    const qPautas = query(collection(db, 'ago_pautas'), limit(20));

    const unsub = onSnapshot(
      qPautas,
      (snap) => {
        if (!snap.empty) {
          const lista: PautaAgoItem[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));
          setPautas(lista);
        } else {
          setPautas([]);
        }
        setCarregandoPautas(false);
      },
      (err) => {
        console.warn('[AGO_PAUTAS_SNAPSHOT_WARN]', err?.message);
        setCarregandoPautas(false);
      }
    );

    return () => unsub();
  }, []);

  // Abertura de Nova Pauta
  const handleCriarPauta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaPautaTitulo.trim()) return;

    setProcessandoAcao(true);
    try {
      const pautaId = `pauta_${Date.now()}`;
      const res = await fetch('/api/ago/pauta/abrir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pautaId,
          titulo: novaPautaTitulo.trim(),
          descricao: novaPautaDescricao.trim(),
          operadorEmail: operadorAtual || 'mesa_diretora@cimadebe.org',
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Erro ao abrir pauta no servidor.');
      }

      setNovaPautaTitulo('');
      setNovaPautaDescricao('');
      setModalNovaPauta(false);
      notifySuccess('Pauta Aberta', 'A pauta foi aberta para deliberação na Plenária.');
    } catch (err: any) {
      notifyError('Erro na Pauta', err?.message || 'Falha ao registrar abertura de pauta.');
    } finally {
      setProcessandoAcao(false);
    }
  };

  // Encerramento de Pauta
  const handleEncerrarPauta = async (pautaId: string) => {
    setProcessandoAcao(true);
    try {
      const res = await fetch('/api/ago/pauta/fechar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pautaId,
          operadorEmail: operadorAtual || 'mesa_diretora@cimadebe.org',
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Erro ao fechar pauta.');
      }

      notifySuccess('Votação Encerrada', 'A pauta foi fechada e os votos foram congelados.');
    } catch (err: any) {
      notifyError('Erro', err?.message || 'Falha ao encerrar votação da pauta.');
    } finally {
      setProcessandoAcao(false);
    }
  };

  // Reabrir Pauta Existente
  const handleReabrirPauta = async (pauta: PautaAgoItem) => {
    setProcessandoAcao(true);
    try {
      const res = await fetch('/api/ago/pauta/abrir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pautaId: pauta.id,
          titulo: pauta.titulo,
          descricao: pauta.descricao,
          operadorEmail: operadorAtual || 'mesa_diretora@cimadebe.org',
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Erro ao reabrir pauta.');
      }

      notifySuccess('Pauta Reaberta', 'A votação foi reaberta para os delegados.');
    } catch (err: any) {
      notifyError('Erro', err?.message || 'Falha ao reabrir pauta.');
    } finally {
      setProcessandoAcao(false);
    }
  };

  // Check-in de Presença de Delegado
  const handleCheckin = async (ministroId: string) => {
    setProcessandoCheckinId(ministroId);
    setCheckinStatus(null);
    try {
      const res = await fetch('/api/ago/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ministroId,
          operadorEmail: operadorAtual || 'secretaria@cimadebe.org',
          tenantId: tenantAtivo?.id || 't-sede-salvador',
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || 'Falha ao registrar check-in.');
      }

      setCheckinStatus({
        tipo: 'sucesso',
        texto: body.message || 'Presença confirmada!',
      });
      notifySuccess('Check-in Confirmado', body.message || 'Delegado liberado para votação.');
    } catch (err: any) {
      setCheckinStatus({
        tipo: 'erro',
        texto: err?.message || 'Erro ao realizar check-in.',
      });
      notifyError('Check-in Negado', err?.message || 'Falha na validação de presença.');
    } finally {
      setProcessandoCheckinId(null);
    }
  };

  // Filtragem de Ministros para a esteira de Check-in
  const delegadosFiltrados = ministros
    .filter((m) => {
      if (!buscaDelegado.trim()) return true;
      const b = buscaDelegado.toLowerCase().trim();
      return (
        (m.nome || '').toLowerCase().includes(b) ||
        (m.cpf || '').includes(b) ||
        (m.registroMinisterial || '').toLowerCase().includes(b)
      );
    })
    .slice(0, 15);

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* 1. BANNER INSTITUCIONAL E CONTROLE DE QUÓRUM */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950/70 via-slate-900 to-indigo-950/70 border border-purple-500/30 p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 text-purple-400 text-xs font-mono font-bold uppercase tracking-wider">
              <Vote className="w-4 h-4 shrink-0" />
              <span>PLENÁRIA DELIBERATIVA & URNA ELETRÔNICA ACID</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Mesa Diretora — Gestão da Assembleia Geral (AGO)
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Controle estrito de quórum com integridade criptográfica. Somente delegados com presença confirmada e adimplência ativa possuem poder de voto na plenária.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => setModalNovaPauta(true)}
              disabled={processandoAcao}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-slate-950 text-xs font-black uppercase font-mono tracking-wider flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Abrir Nova Pauta</span>
            </button>
          </div>
        </div>

        {/* INDICADOR CANÔNICO DE QUÓRUM (BARRA + NÚMEROS) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-800/80 mt-6">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">
              Ministros Ativos Aptos
            </span>
            <div className="text-2xl font-black font-mono text-white mt-1 tabular-nums">
              {totalMinistrosAtivos}
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Quórum Máximo Potencial</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-purple-500/30">
            <span className="text-[10px] font-mono text-purple-400 uppercase font-bold block">
              Presentes em Plenária (Check-in)
            </span>
            <div className="text-2xl font-black font-mono text-purple-400 mt-1 tabular-nums">
              {presentesEmPlenaria}
            </div>
            <span className="text-[11px] text-emerald-400 font-mono">Delegados Habilitados a Votar</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] font-mono text-amber-400 uppercase font-bold block">
              Quórum Instalado
            </span>
            <div className="text-2xl font-black font-mono text-amber-400 mt-1 tabular-nums">
              {percPresentes}%
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 mt-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-amber-500 transition-all duration-500"
                style={{ width: `${Math.min(100, Number(percPresentes))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. GRADE DE PAUTAS E URNA ELETRÔNICA */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-400" />
            <span>Pautas e Votações da Assembleia</span>
          </h3>
          <span className="text-xs font-mono text-slate-400">
            {pautas.length} pauta(s) registrada(s)
          </span>
        </div>

        {carregandoPautas ? (
          <div className="p-8 text-center text-xs font-mono text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
            <span>Carregando pautas da plenária...</span>
          </div>
        ) : pautas.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800/80 space-y-2">
            <Vote className="w-8 h-8 text-slate-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-300">Nenhuma pauta aberta no momento</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Utilize o botão acima para registrar e abrir uma pauta deliberativa para voto dos delegados credenciados.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pautas.map((pauta) => {
              const estaAberta = pauta.status === 'VOTACAO_ABERTA';
              const total = pauta.totalVotos || (pauta.votosFavor + pauta.votosContra + pauta.abstencoes) || 0;
              const percFavor = total > 0 ? ((pauta.votosFavor / total) * 100).toFixed(0) : '0';
              const percContra = total > 0 ? ((pauta.votosContra / total) * 100).toFixed(0) : '0';
              const percAbs = total > 0 ? ((pauta.abstencoes / total) * 100).toFixed(0) : '0';

              return (
                <div
                  key={pauta.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    estaAberta
                      ? 'bg-slate-900/90 border-purple-500/40 shadow-lg'
                      : 'bg-slate-950/80 border-slate-800 opacity-90'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                            estaAberta
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 animate-pulse'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {estaAberta ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                          <span>{estaAberta ? 'VOTAÇÃO ABERTA' : 'ENCERRADA'}</span>
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-white">{pauta.titulo}</h4>
                      {pauta.descricao && (
                        <p className="text-xs text-slate-400 leading-relaxed">{pauta.descricao}</p>
                      )}
                    </div>

                    <div className="shrink-0">
                      {estaAberta ? (
                        <button
                          type="button"
                          onClick={() => handleEncerrarPauta(pauta.id)}
                          disabled={processandoAcao}
                          className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Square className="w-3.5 h-3.5" />
                          <span>Encerrar</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReabrirPauta(pauta)}
                          disabled={processandoAcao}
                          className="px-3 py-1.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Reabrir</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* PLACAR DE VOTOS DA PAUTA */}
                  <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-slate-800 text-center font-mono">
                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/20">
                      <div className="flex items-center justify-center gap-1 text-emerald-400 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>FAVOR</span>
                      </div>
                      <div className="text-lg font-black text-white mt-0.5">{pauta.votosFavor || 0}</div>
                      <span className="text-[10px] text-slate-400">{percFavor}%</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/20">
                      <div className="flex items-center justify-center gap-1 text-rose-400 text-xs font-bold">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>CONTRA</span>
                      </div>
                      <div className="text-lg font-black text-white mt-0.5">{pauta.votosContra || 0}</div>
                      <span className="text-[10px] text-slate-400">{percContra}%</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/20">
                      <div className="flex items-center justify-center gap-1 text-amber-400 text-xs font-bold">
                        <MinusCircle className="w-3.5 h-3.5" />
                        <span>ABSTENÇÃO</span>
                      </div>
                      <div className="text-lg font-black text-white mt-0.5">{pauta.abstencoes || 0}</div>
                      <span className="text-[10px] text-slate-400">{percAbs}%</span>
                    </div>
                  </div>

                  <div className="pt-2 text-right">
                    <span className="text-[10px] font-mono text-slate-400">
                      Total Computado: <strong>{total} votos</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. TERMINAL DE CHECK-IN RÁPIDO DE DELEGADOS */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Controle de Acesso & Check-in de Presença (Plenária)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Registre a entrada física do ministro para habilitar sua Urna Eletrônica móvel.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={buscaDelegado}
              onChange={(e) => setBuscaDelegado(e.target.value)}
              placeholder="Buscar por nome, CPF ou registro..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {checkinStatus && (
          <div
            className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
              checkinStatus.tipo === 'sucesso'
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
            }`}
          >
            {checkinStatus.tipo === 'sucesso' ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{checkinStatus.texto}</span>
          </div>
        )}

        {/* TABELA DE DELEGADOS APTOS / CHECK-IN */}
        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-slate-950 text-slate-400 font-mono text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-3">Ministro / Delegado</th>
                <th className="py-2.5 px-3">Cargo</th>
                <th className="py-2.5 px-3">Adimplência</th>
                <th className="py-2.5 px-3">Presença AGO</th>
                <th className="py-2.5 px-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {delegadosFiltrados.map((m) => {
                const presencaConfirmada = (m as any).presencaAgoVigente === true;
                const isAdimplente =
                  m.statusAdimplencia === 'ADIMPLENTE' ||
                  m.statusAdimplencia === 'EM_DIA' ||
                  m.statusAdimplencia === 'EM_DIA_FUTURO';
                const carregandoEste = processandoCheckinId === m.id;

                return (
                  <tr key={m.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-white">{m.nome}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        CPF: {m.cpf} • {m.registroMinisterial || 'REG'}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-slate-300 font-mono text-[11px]">{m.cargo}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          isAdimplente
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {m.statusAdimplencia || 'INADIMPLENTE'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {presencaConfirmada ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-mono text-[11px] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>CONFIRMADA</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[11px]">Ausente</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {presencaConfirmada ? (
                        <span className="text-[11px] font-mono text-slate-400">Check-in OK</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCheckin(m.id)}
                          disabled={carregandoEste || !isAdimplente}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                            !isAdimplente
                              ? 'bg-slate-800 text-slate-500 border border-slate-700'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-sm'
                          }`}
                        >
                          {carregandoEste ? 'Validando...' : 'Confirmar Presença'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL PARA CRIAÇÃO DE NOVA PAUTA */}
      {modalNovaPauta && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Vote className="w-5 h-5 text-purple-400" />
                <span>Nova Pauta Deliberativa da AGO</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalNovaPauta(false)}
                className="text-slate-400 hover:text-white cursor-pointer font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCriarPauta} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-400 font-mono mb-1">Título da Pauta / Quesito *</label>
                <input
                  type="text"
                  required
                  value={novaPautaTitulo}
                  onChange={(e) => setNovaPautaTitulo(e.target.value)}
                  placeholder="Ex: Aprovação das Contas do Exercício Fiscal 2025"
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-purple-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1">Descrição / Detalhes Estatutários</label>
                <textarea
                  rows={3}
                  value={novaPautaDescricao}
                  onChange={(e) => setNovaPautaDescricao(e.target.value)}
                  placeholder="Texto do parecer do Conselho Fiscal ou diretriz colocada em votação..."
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-purple-500 font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalNovaPauta(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processandoAcao || !novaPautaTitulo.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 text-slate-950 font-black cursor-pointer disabled:opacity-50"
                >
                  {processandoAcao ? 'Gravando...' : 'Abrir Votação Agora'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPlenariaAgo;
