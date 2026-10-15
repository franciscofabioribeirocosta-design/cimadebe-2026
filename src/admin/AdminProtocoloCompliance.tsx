import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  FileText, 
  Lock, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  Flame, 
  Terminal,
  Activity,
  UserCheck,
  Key,
  Database,
  Download,
  RefreshCw,
  ShieldAlert,
  XCircle
} from 'lucide-react';
import { useSecurity } from '../SecurityContext';
import { 
  gerarBackupRastreabilidadeBancaria, 
  descarregarBackupComoJson,
  verificarLogsAuditFirestore,
  ErroCorrupcaoAuditoria,
  type ResultadoAuditoriaLogs 
} from '../services/backupComplianceService';

export function AdminProtocoloCompliance() {
  const { operadorId, operadorAtual } = useSecurity();
  const [exportandoBackup, setExportandoBackup] = useState(false);
  const [backupSucesso, setBackupSucesso] = useState<string | null>(null);
  const [backupErro, setBackupErro] = useState<string | null>(null);
  
  const [analiseLogs, setAnaliseLogs] = useState<ResultadoAuditoriaLogs | null>(null);
  const [verificandoProativo, setVerificandoProativo] = useState(false);

  useEffect(() => {
    let ativo = true;
    setVerificandoProativo(true);
    verificarLogsAuditFirestore()
      .then((resultado) => {
        if (ativo) {
          setAnaliseLogs(resultado);
        }
      })
      .catch((err) => {
        console.error('[PROACTIVE_AUDIT_CHECK_FAILED]', err);
      })
      .finally(() => {
        if (ativo) {
          setVerificandoProativo(false);
        }
      });
    return () => {
      ativo = false;
    };
  }, []);

  const [checklist, setChecklist] = useState({
    transacaoAtomica: false,
    semCacheLocal: false,
    auditLogManual: false,
    rbacVerificado: false,
    idempotenciaAtiva: false,
  });

  const toggleCheck = (key: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const totalChecked = Object.values(checklist).filter(Boolean).length;
  const complianceScore = (totalChecked / Object.keys(checklist).length) * 100;

  const handleExportarBackup = async () => {
    try {
      setExportandoBackup(true);
      setBackupSucesso(null);
      setBackupErro(null);

      const emailOperador = operadorId || 'operador@sigm.org';
      const payload = await gerarBackupRastreabilidadeBancaria(emailOperador);
      descarregarBackupComoJson(payload);

      setBackupSucesso(`✓ Backup de segurança gerado com sucesso! Contém ${payload.metadata.totalLogsExportados} registros de auditoria e configurações financeiras.`);
    } catch (err: any) {
      if (err instanceof ErroCorrupcaoAuditoria) {
        setAnaliseLogs(err.resultado);
        setBackupErro(`🚨 BLOQUEIO DE SEGURANÇA: Exportação cancelada! Foram detectados ${err.resultado.totalCorrompidos} registros em 'audit_logs' sem hash de integridade ou com timestamp inválido. Notificação emitida na interface do Super Master.`);
      } else {
        setBackupErro('Erro ao processar backup: ' + (err?.message || String(err)));
      }
    } finally {
      setExportandoBackup(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Alerta de Integridade de Banco de Dados / Ledger Corrompido */}
      {analiseLogs?.status === 'CORROMPIDO' && (
        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/60 animate-pulse space-y-3">
          <div className="flex items-center gap-2.5 text-rose-400 font-bold uppercase text-xs font-mono">
            <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0" />
            <span>🚨 ALERTA CRÍTICO: DETECTADA INCONSISTÊNCIA NO LEDGER CONTÁBIL!</span>
          </div>
          <p className="text-xs text-slate-300 font-sans leading-relaxed">
            Atenção Super Master: O scanner proativo detectou que <strong className="text-rose-400 font-mono">{analiseLogs.totalCorrompidos}</strong> registro(s) em <code className="text-cyan-400 font-mono">audit_logs</code> estão sem hash de integridade ou timestamp válido.
          </p>
          <div className="bg-slate-950/90 border border-rose-500/20 rounded-lg p-3 space-y-1.5 max-h-40 overflow-y-auto font-mono text-[10px]">
            <span className="text-rose-400 font-bold block mb-1">REGISTROS CORROMPIDOS DETECTADOS:</span>
            {analiseLogs.registrosCorrompidos.map((r, i) => (
              <div key={r.id || i} className="border-b border-slate-900 pb-1.5 mb-1.5 last:border-0 last:pb-0 text-slate-400">
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold">Doc ID: {r.id}</span>
                  <span className="text-rose-400 font-semibold">FALHA: {r.motivo}</span>
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                  Ação: {r.dadosIncompletos.acao} · Operador: {r.dadosIncompletos.operador}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cabeçalho do Protocolo */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 sm:p-5 backdrop-blur-md relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-950/60 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              Selo de Conformidade Estrutural e Fiscal
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Protocolo de Operação <span className="text-amber-400">&amp; Compliance</span>
            </h2>
            <p className="text-xs text-slate-400 font-sans max-w-2xl leading-relaxed">
              Diretrizes de integridade bancária, governança mestre e padrões criptográficos compulsórios que regem o sistema SIGM Core.
            </p>
          </div>

          {/* Medidor de Compliance Prático */}
          <div className="bg-slate-950/80 border border-slate-800/80 p-3.5 rounded-xl space-y-2 shrink-0 md:w-60 font-mono">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">SCORE OPERACIONAL:</span>
              <span className={`font-bold text-xs ${complianceScore === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {complianceScore}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${complianceScore}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 leading-normal font-sans">
              Complete o checklist rápido para certificar seu operador.
            </p>
          </div>
        </div>
      </div>

      {/* Grid de Seções do Protocolo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
        
        {/* Seção 1: Diretrizes do Ledger Contábil (Blockchain-style) */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2.5 border-b border-slate-800/70 pb-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-xs uppercase font-mono">01 · Diretrizes do Ledger Contábil</h3>
              <p className="text-[10px] text-slate-500 font-sans">Rastreabilidade criptográfica imutável</p>
            </div>
          </div>

          <div className="space-y-3 text-xs leading-relaxed text-slate-300 font-sans">
            <p>
              O ecossistema SIGM opera sob o modelo de **Ledger Encadeado por Hash (blockchain-style)**. Todas as mutações contábeis, líquidações de anuidades e cadastros de ministros são registrados de forma indestrutível na coleção <code className="text-cyan-400 font-mono">logs</code>.
            </p>

            <ul className="space-y-2 list-disc pl-4 text-slate-400 text-xs">
              <li>
                <strong className="text-white">Encadeamento Criptográfico:</strong> Cada registro de auditoria (`AuditLog`) contém um <code className="text-amber-400 font-mono text-[11px]">hashIntegridade</code> derivado dos dados da operação somados ao hash anterior.
              </li>
              <li>
                <strong className="text-white">Impossibilidade de Exclusão:</strong> Operações de exclusão física são expressamente proibidas. Correções exigem estorno compensatório documentado.
              </li>
              <li>
                <strong className="text-white">Rastreadores de Mutação:</strong> Alterações financeiras exigem justificativa e o registro do e-mail certificado do operador.
              </li>
            </ul>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start gap-2 font-mono text-[10px]">
              <Terminal className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-cyan-400 font-semibold block">ALGORITMO DE INTEGRIDADE:</span>
                <span className="text-slate-500 block truncate">
                  H(N) = SHA256( TenantId | OperadorId | Acao | Detalhes | Timestamp | H(N-1) )
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Seção 2: Padrões de Alta Segurança (Anti-Hack / Concorrência) */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2.5 border-b border-slate-800/70 pb-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-xs uppercase font-mono">02 · Padrões de Segurança &amp; Escritas</h3>
              <p className="text-[10px] text-slate-500 font-sans">Isolamento ACID e proteção contra injeções</p>
            </div>
          </div>

          <div className="space-y-3 text-xs leading-relaxed text-slate-300 font-sans">
            <p>
              Qualquer gravação de dados críticos (saldos, contagem de votos da AGO, cadastros) cumpre requisitos de nível de transição bancária.
            </p>

            <ul className="space-y-2 list-disc pl-4 text-slate-400 text-xs">
              <li>
                <strong className="text-white">Escrita Atômica (runTransaction):</strong> Operações financeiras concorrentes usam obrigatoriamente `runTransaction()` para evitar race-conditions.
              </li>
              <li>
                <strong className="text-white">Sanitização Rigorosa:</strong> Entradas de dados passam por decodificação UTF-8 padronizada e filtros estritos.
              </li>
              <li>
                <strong className="text-white">Idempotência de Clique:</strong> Botões de pagamento e cadastro contêm travas que impedem cliques duplos.
              </li>
            </ul>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start gap-2 font-mono text-[10px]">
              <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-emerald-400 font-semibold block">TEMPO REAL ATIVO (onSnapshot):</span>
                <span className="text-slate-400">
                  Os painéis contábeis operam sob listeners sincronizados sem cache fantasma.
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* Seção 3: Regras de Governança e Modelo Centralizado */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2.5 border-b border-slate-800/70 pb-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-xs uppercase font-mono">03 · Regras de Governança Estratégica</h3>
              <p className="text-[10px] text-slate-500 font-sans">Modelo de Convenção Única e Centralização</p>
            </div>
          </div>

          <div className="space-y-3 text-xs leading-relaxed text-slate-300 font-sans">
            <p>
              O SIGM Core rege-se sob resoluções estatutárias de centralização contábil, mitigando riscos de divisões políticas.
            </p>

            <ul className="space-y-2 list-disc pl-4 text-slate-400 text-xs">
              <li>
                <strong className="text-white">Mitigação de Splits Regionais:</strong> Canal de liquidação unificado central. Splits arbitrários são estritamente bloqueados.
              </li>
              <li>
                <strong className="text-white">Unicidade Cadastral por CPF:</strong> Proibido cadastrar o mesmo CPF mais de uma vez ou duplicar RM.
              </li>
              <li>
                <strong className="text-white">Homologação de Mesa Diretora:</strong> Composição estatutária homologada segundo regimento geral.
              </li>
            </ul>
          </div>
        </div>

        {/* Seção 4: Protocolo de Contingência */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2.5 border-b border-slate-800/70 pb-2.5">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-xs uppercase font-mono">04 · Protocolo de Janela Crítica &amp; Contingência</h3>
              <p className="text-[10px] text-slate-500 font-sans">Diretrizes de integridade e suspensão preventiva</p>
            </div>
          </div>

          <div className="space-y-3 text-xs leading-relaxed text-slate-300 font-sans">
            <p>
              Durante a **Janela da Assembleia Geral Ordinária (AGO)**, regras de conformidade e integridade atuam proativamente.
            </p>

            <ul className="space-y-2 list-disc pl-4 text-slate-400 text-xs">
              <li>
                <strong className="text-white">Bloqueio Automático por Inadimplência:</strong> Inscrição revogada automaticamente se detectado débito pendente.
              </li>
              <li>
                <strong className="text-white">Suspensão Preventiva:</strong> Procedimento estatutário temporário em caso de anomalia investigativa.
              </li>
              <li>
                <strong className="text-white">Auditoria Física e QR Codes:</strong> Todos os crachás contêm autenticação digital e assinatura homologada.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bloco de Exportação de Backup para Rastreabilidade Bancária */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 sm:p-5 space-y-3.5 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-semibold uppercase tracking-wider">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              Backup Criptográfico e Rastreabilidade Bancária
            </div>
            <h3 className="text-base font-bold text-white tracking-tight font-mono">
              Exportação Geral de Segurança (.JSON)
            </h3>
            <p className="text-xs text-slate-400 font-sans max-w-2xl leading-relaxed">
              Exporte instantaneamente os dados essenciais de <code className="text-emerald-400 font-mono">audit_logs</code> e <code className="text-emerald-400 font-mono">parametros_financeiros</code> com assinatura SHA-256.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-center">
            <button
              type="button"
              disabled={verificandoProativo}
              onClick={async () => {
                try {
                  setVerificandoProativo(true);
                  const res = await verificarLogsAuditFirestore();
                  setAnaliseLogs(res);
                  if (res.status === 'INTEGRO') {
                    setBackupSucesso(`✓ Varredura concluída: todos os ${res.totalAnalisados} logs auditados estão íntegros com hash e timestamp.`);
                    setBackupErro(null);
                  } else {
                    setBackupErro(`🚨 ALERTA SUPER MASTER: ${res.totalCorrompidos} log(s) corrompidos ou sem hash detectados!`);
                  }
                } catch (e: any) {
                  setBackupErro('Erro ao verificar logs: ' + (e?.message || String(e)));
                } finally {
                  setVerificandoProativo(false);
                }
              }}
              className="px-3.5 py-2 rounded-lg bg-slate-950/90 border border-slate-700 hover:border-cyan-500 text-cyan-300 font-mono text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Executar verificação manual em tempo real de cada entrada na coleção audit_logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${verificandoProativo ? 'animate-spin' : ''}`} />
              <span>{verificandoProativo ? 'Auditando...' : 'Verificar Integridade'}</span>
            </button>

            <button
              type="button"
              disabled={exportandoBackup}
              onClick={handleExportarBackup}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-mono font-bold text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {exportandoBackup ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
              ) : (
                <Download className="w-3.5 h-3.5 text-slate-950" />
              )}
              <span>{exportandoBackup ? 'Processando...' : 'Exportar Backup'}</span>
            </button>
          </div>
        </div>

        {backupSucesso && (
          <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
            {backupSucesso}
          </div>
        )}

        {backupErro && (
          <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs font-mono">
            {backupErro}
          </div>
        )}
      </div>

      {/* Checklist Interativo de Validação do Operador */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-amber-400" />
            <h4 className="font-bold text-white text-xs font-mono uppercase">Checklist de Certificação do Operador</h4>
          </div>
          <span className="text-[10px] font-mono text-slate-500 uppercase">
            CERTIFICAÇÃO OBRIGATÓRIA
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <button 
            type="button"
            onClick={() => toggleCheck('transacaoAtomica')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
              checklist.transacaoAtomica 
                ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-300' 
                : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700'
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${checklist.transacaoAtomica ? 'text-emerald-400' : 'text-slate-600'}`} />
            <div>
              <span className="font-bold block text-white">Escrita Atômica</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Confirmo que uso runTransaction para gravar dados contábeis.</span>
            </div>
          </button>

          <button 
            type="button"
            onClick={() => toggleCheck('semCacheLocal')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
              checklist.semCacheLocal 
                ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-300' 
                : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700'
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${checklist.semCacheLocal ? 'text-emerald-400' : 'text-slate-600'}`} />
            <div>
              <span className="font-bold block text-white">Invalidação de Cache</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Confirmo que não simulo estados locais voláteis ou cache falsos.</span>
            </div>
          </button>

          <button 
            type="button"
            onClick={() => toggleCheck('auditLogManual')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
              checklist.auditLogManual 
                ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-300' 
                : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700'
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${checklist.auditLogManual ? 'text-emerald-400' : 'text-slate-600'}`} />
            <div>
              <span className="font-bold block text-white">Registro de Auditoria</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Confirmo o disparo obrigatório de addAuditLog em mutações cadastrais.</span>
            </div>
          </button>

          <button 
            type="button"
            onClick={() => toggleCheck('rbacVerificado')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
              checklist.rbacVerificado 
                ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-300' 
                : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700'
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${checklist.rbacVerificado ? 'text-emerald-400' : 'text-slate-600'}`} />
            <div>
              <span className="font-bold block text-white">Controle de Privilégio</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Certifico que verifiquei as regras de privilégio mínimo (RBAC) do operador.</span>
            </div>
          </button>

          <button 
            type="button"
            onClick={() => toggleCheck('idempotenciaAtiva')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
              checklist.idempotenciaAtiva 
                ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-300' 
                : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700'
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${checklist.idempotenciaAtiva ? 'text-emerald-400' : 'text-slate-600'}`} />
            <div>
              <span className="font-bold block text-white">Trava de Duplicação</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Certifico que o sistema está livre de disparos paralelos por clique múltiplo.</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
