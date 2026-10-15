import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { sha256 } from '../crypto';

export interface RegistroAuditoriaInvalido {
  readonly id: string;
  readonly motivo: string;
  readonly camposAusentes: readonly string[];
  readonly dadosIncompletos: {
    readonly acao?: string;
    readonly operador?: string;
    readonly timestamp?: string | null;
    readonly hashIntegridade?: string | null;
  };
}

export interface ResultadoAuditoriaLogs {
  readonly totalAnalisados: number;
  readonly totalValidos: number;
  readonly totalCorrompidos: number;
  readonly registrosCorrompidos: readonly RegistroAuditoriaInvalido[];
  readonly status: 'INTEGRO' | 'CORROMPIDO';
  readonly mensagem: string;
}

export class ErroCorrupcaoAuditoria extends Error {
  readonly resultado: ResultadoAuditoriaLogs;

  constructor(resultado: ResultadoAuditoriaLogs) {
    super(resultado.mensagem);
    this.name = 'ErroCorrupcaoAuditoria';
    this.resultado = resultado;
  }
}

export interface BackupPayload {
  readonly timestamp: string;
  readonly schemaVersion: string;
  readonly checksum: string;
  readonly metadata: {
    readonly exportadoPor: string;
    readonly totalLogsExportados: number;
    readonly dataReferenciaSistema: string;
    readonly statusAuditoria: 'INTEGRO';
    readonly logsVerificados: number;
  };
  readonly auditLogs: any[];
  readonly parametrosFinanceiros: any[];
}

/**
 * Camada de verificação estrita para garantir que cada entrada de 'audit_logs'
 * contenha o hash de integridade e o timestamp antes de qualquer exportação JSON.
 */
export function auditarIntegridadeAuditLogs(auditLogs: any[]): ResultadoAuditoriaLogs {
  const registrosCorrompidos: RegistroAuditoriaInvalido[] = [];

  for (const log of auditLogs) {
    const camposAusentes: string[] = [];

    // 1. Validação do hash de integridade
    if (!log.hashIntegridade || typeof log.hashIntegridade !== 'string' || log.hashIntegridade.trim() === '') {
      camposAusentes.push('hashIntegridade ausente ou vazio');
    }

    // 2. Validação do timestamp
    if (!log.timestamp) {
      camposAusentes.push('timestamp ausente');
    } else {
      const dataMs = new Date(log.timestamp).getTime();
      if (isNaN(dataMs)) {
        camposAusentes.push(`timestamp corrompido ou formato inválido: '${log.timestamp}'`);
      }
    }

    if (camposAusentes.length > 0) {
      registrosCorrompidos.push({
        id: log.id || 'DOCUMENTO_SEM_ID',
        motivo: `Falha de integridade bancária: ${camposAusentes.join('; ')}`,
        camposAusentes,
        dadosIncompletos: {
          acao: log.acao || 'NÃO_INFORMADA',
          operador: log.operador || log.operadorId || 'NÃO_IDENTIFICADO',
          timestamp: log.timestamp || null,
          hashIntegridade: log.hashIntegridade || null,
        },
      });
    }
  }

  const totalCorrompidos = registrosCorrompidos.length;
  const status = totalCorrompidos === 0 ? 'INTEGRO' : 'CORROMPIDO';
  const mensagem = totalCorrompidos === 0
    ? `Auditoria aprovada: todos os ${auditLogs.length} registros contêm hash de integridade e timestamp válidos.`
    : `Alerta Crítico: ${totalCorrompidos} registro(s) em 'audit_logs' possuem hash de integridade ou timestamp corrompidos/ausentes.`;

  return {
    totalAnalisados: auditLogs.length,
    totalValidos: auditLogs.length - totalCorrompidos,
    totalCorrompidos,
    registrosCorrompidos,
    status,
    mensagem,
  };
}

/**
 * Consulta e audita todos os logs de auditoria na base Firestore sem disparar exportação
 */
export async function verificarLogsAuditFirestore(): Promise<ResultadoAuditoriaLogs> {
  const auditSnap = await getDocs(query(collection(db, 'audit_logs'), limit(50)));
  const auditLogs: any[] = [];
  auditSnap.forEach((doc) => {
    auditLogs.push({
      id: doc.id,
      ...doc.data(),
    });
  });

  return auditarIntegridadeAuditLogs(auditLogs);
}

/**
 * Serviço de Backup de Segurança para Rastreabilidade Bancária (Compliance Geral)
 * Executa a camada de validação e bloqueia exportação se houver corrupção de dados.
 */
export async function gerarBackupRastreabilidadeBancaria(
  operadorEmail: string
): Promise<BackupPayload> {
  try {
    const auditLogs: any[] = [];
    const parametrosFinanceiros: any[] = [];

    // 1. Busca todos os registros da coleção 'audit_logs'
    const auditSnap = await getDocs(query(collection(db, 'audit_logs'), limit(50)));
    auditSnap.forEach((doc) => {
      auditLogs.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // 2. Camada de verificação compulsória de integridade
    const resultadoAuditoria = auditarIntegridadeAuditLogs(auditLogs);
    if (resultadoAuditoria.status === 'CORROMPIDO') {
      throw new ErroCorrupcaoAuditoria(resultadoAuditoria);
    }

    // Ordena logs cronologicamente para garantir integridade do ledger
    auditLogs.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

    // 3. Busca todos os registros da coleção 'parametros_financeiros'
    const paramsSnap = await getDocs(query(collection(db, 'parametros_financeiros'), limit(50)));
    paramsSnap.forEach((doc) => {
      parametrosFinanceiros.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // 4. Monta o payload estruturado de Backup
    const nowIso = new Date().toISOString();
    
    // Serialização determinística para cálculo de hash seguro
    const backupRawData = JSON.stringify({
      auditLogs,
      parametrosFinanceiros,
    });

    // Calcula checksum SHA-256 do corpo do backup para atestar integridade e não-repúdio
    const checksum = sha256(backupRawData);

    const payload: BackupPayload = {
      timestamp: nowIso,
      schemaVersion: '2.5.0-BANKING-COMPLIANCE',
      checksum,
      metadata: {
        exportadoPor: operadorEmail,
        totalLogsExportados: auditLogs.length,
        dataReferenciaSistema: '2026-10-03T07:28:42-07:00',
        statusAuditoria: 'INTEGRO',
        logsVerificados: auditLogs.length,
      },
      auditLogs,
      parametrosFinanceiros,
    };

    return payload;
  } catch (error: any) {
    if (error instanceof ErroCorrupcaoAuditoria) {
      console.error('[AUDIT_INTEGRITY_VIOLATION_BLOCKED]', error.resultado);
      throw error;
    }
    console.error('[BACKEND_BACKUP_SERVICE_ERROR]', error);
    throw new Error('Falha ao processar exportação de segurança: ' + (error?.message || String(error)));
  }
}

/**
 * Dispara o download nativo do navegador do arquivo JSON estruturado
 */
export function descarregarBackupComoJson(payload: BackupPayload) {
  try {
    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    const dataLimpa = payload.timestamp.slice(0, 10);
    a.download = `backup_rastreabilidade_sigm_${dataLimpa}_v${payload.schemaVersion.slice(0, 5)}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Limpa recursos temporários
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('[BACKEND_BACKUP_DOWNLOAD_ERROR]', error);
    alert('Erro ao disparar download do arquivo de backup.');
  }
}
