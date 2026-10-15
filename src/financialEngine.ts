/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Motor de Transações Financeiras de Alta Integridade & DRE Data-Mapping Layer
 * Lei de Simetria Monetária: Chaves estritas `valor` (BRL) e `statusPagamento: 'PAGO'`
 */

import type {
  Ministro,
  AnuidadeMinistro,
  StatusAdimplencia,
  DemonstrativoResultadoExercicio,
} from './types';
import { deepFreeze } from './crypto';

// ==========================================
// DATA BASE DINÂMICA DO SISTEMA SINCRONIZADA COM O BRASIL (America/Sao_Paulo / UTC-3)
// ==========================================
export const getSystemDate = (dataRef?: Date | string | number): string => {
  const d = dataRef
    ? (typeof dataRef === 'string' || typeof dataRef === 'number' ? new Date(dataRef) : dataRef)
    : new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  } catch {
    // Fallback compensando UTC-3 manualmente se Intl falhar
    const utcTime = d.getTime() + d.getTimezoneOffset() * 60000;
    const brazilTime = new Date(utcTime - 3 * 3600000);
    const year = brazilTime.getFullYear();
    const month = String(brazilTime.getMonth() + 1).padStart(2, '0');
    const day = String(brazilTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};

export const getSystemTimeIso = (dataRef?: Date | string | number): string => {
  const d = dataRef
    ? (typeof dataRef === 'string' || typeof dataRef === 'number' ? new Date(dataRef) : dataRef)
    : new Date();
  return d.toISOString();
};

export const getSystemYear = (dataRef?: Date | string | number): number => {
  const dateStr = getSystemDate(dataRef);
  return parseInt(dateStr.split('-')[0], 10) || new Date().getFullYear();
};

export const getDataHoraBrasil = (dataRef?: Date | string | number): string => {
  const d = dataRef
    ? (typeof dataRef === 'string' || typeof dataRef === 'number' ? new Date(dataRef) : dataRef)
    : new Date();
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(d);
  } catch {
    return d.toLocaleString('pt-BR');
  }
};

export const SYSTEM_REFERENCE_TIME_ISO = getSystemTimeIso();
export const SYSTEM_REFERENCE_DATE = getSystemDate();
export const SYSTEM_REFERENCE_YEAR = getSystemYear();

/**
 * Formata data ISO ou YYYY-MM-DD para o padrão brasileiro DD/MM/AAAA.
 */
export function formatarDataBR(dataStr: string | null | undefined): string {
  if (!dataStr) return '—';
  const str = String(dataStr).trim();
  if (!str) return '—';
  if (str.includes('/')) return str;
  // Se for ISO completo com horário (ex: 2026-10-06T23:30:00Z), converter considerando o fuso de Brasília
  if (str.includes('T')) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const parts = getSystemDate(d).split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
    } catch {
      // Fallback
    }
  }
  const limpa = str.split('T')[0];
  const partes = limpa.split('-');
  if (partes.length === 3) {
    const [ano, mes, dia] = partes;
    if (ano.length === 4) {
      return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`;
    }
  }
  return str;
}

export function obterCicloAgoVigente(dataReferencia?: string): number {
  const ref = dataReferencia || getSystemDate();
  const ano = parseInt(ref.split('-')[0], 10) || getSystemYear();
  return ano;
}

export function verificarJanelaCriticaAGO(dataReferencia?: string): {
  readonly emJanelaCritica: boolean;
  readonly diasRestantesAteAgo: number;
  readonly descricao: string;
} {
  const ref = dataReferencia || getSystemDate();
  const anoAtual = parseInt(ref.split('-')[0], 10) || getSystemYear();
  const dataLimiteAgo = `${anoAtual}-11-20`;
  const diasRestantes = calcularDiferencaDias(dataLimiteAgo, ref);
  const emJanelaCritica = diasRestantes > 0 && diasRestantes <= 65;

  return {
    emJanelaCritica,
    diasRestantesAteAgo: Math.max(0, diasRestantes),
    descricao: `Janela de Inscrição AGO ${anoAtual}: ${Math.max(0, diasRestantes)} dias restantes`,
  };
}

// ==========================================
// ARITMÉTICA BANCÁRIA EM CENTAVOS (ANTI-IEEE 754)
// ==========================================
export function toCents(amount: number): number {
  return Math.round((Number(amount) || 0) * 100);
}

export function fromCents(cents: number): number {
  return (Math.round(cents) || 0) / 100;
}

export function formatarMoeda(val: number): string {
  return (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function calcularDiferencaDias(dataIsoA: string, dataIsoB: string): number {
  const parsePartes = (iso: string) => {
    const partes = iso.split('T')[0].split('-');
    const ano = parseInt(partes[0], 10) || getSystemYear();
    const mes = parseInt(partes[1], 10) || 1;
    const dia = parseInt(partes[2], 10) || 1;
    return { ano, mes, dia };
  };

  const pA = parsePartes(dataIsoA);
  const pB = parsePartes(dataIsoB);

  const diasJulA = pA.ano * 365 + Math.floor(pA.ano / 4) + pA.mes * 30 + pA.dia;
  const diasJulB = pB.ano * 365 + Math.floor(pB.ano / 4) + pB.mes * 30 + pB.dia;

  return diasJulA - diasJulB;
}

export function avaliarStatusCobranca(
  anuidade: AnuidadeMinistro,
  dataReferencia?: string
): 'EM_DIA' | 'EM_DIA_FUTURO' | 'EM_ATRASO' | 'ABERTO' {
  const status = (anuidade.statusPagamento || 'ABERTO').toUpperCase();
  const hoje = (dataReferencia || getSystemDate()).split('T')[0];
  const anoAtual = parseInt(hoje.split('-')[0], 10) || getSystemYear();

  if (status === 'PAGO' || status === 'EM_DIA' || status === 'EM_DIA_FUTURO' || status === 'ANISTIADO') {
    if (anuidade.anoVigente > anoAtual) {
      return 'EM_DIA_FUTURO';
    }
    return 'EM_DIA';
  }

  const vencimento = (anuidade.dataVencimento || '').split('T')[0].trim();
  if (!vencimento) {
    return 'ABERTO';
  }

  // Barreira temporal com offset de Brasília (-03:00):
  // Permanece em dia até 23:59:59.999 do dia de vencimento.
  const limiteBrasilia = new Date(`${vencimento}T23:59:59.999-03:00`).getTime();
  const agoraEpoch = dataReferencia ? new Date(`${hoje}T23:59:59.999-03:00`).getTime() : Date.now();

  if (agoraEpoch > limiteBrasilia) {
    return 'EM_ATRASO';
  }

  if (anuidade.anoVigente > anoAtual) {
    return 'EM_DIA_FUTURO';
  }

  return 'EM_DIA';
}

export function avaliarStatusAdimplencia(
  anuidadesDoMinistro: readonly AnuidadeMinistro[],
  dataReferencia?: string
): StatusAdimplencia {
  if (!anuidadesDoMinistro || anuidadesDoMinistro.length === 0) {
    return 'EM_DIA';
  }

  // Se dataReferencia for fornecida como YYYY-MM-DD ou ISO, calcula o timestamp de referência em Brasília (-03:00)
  let agoraEpoch: number;
  if (dataReferencia) {
    const dataRefLimpa = dataReferencia.split('T')[0].trim();
    agoraEpoch = new Date(`${dataRefLimpa}T23:59:59.999-03:00`).getTime();
  } else {
    agoraEpoch = Date.now();
  }

  // Lei Cronológica Estrita (Horário Oficial de Brasília / UTC-03:00):
  // Uma fatura permanece rigorosamente 'ADIMPLENTE' até às 23:59:59 do dia de vencimento.
  // A transição para 'INADIMPLENTE' ocorre a partir das 00:01:00 do dia seguinte.
  const temFaturaVencida = anuidadesDoMinistro.some((a) => {
    const statusPg = String(a.statusPagamento || 'ABERTO').toUpperCase().trim();
    if (statusPg === 'PAGO' || statusPg === 'EM_DIA' || statusPg === 'EM_DIA_FUTURO' || statusPg === 'ANISTIADO') {
      return false;
    }

    const vencimentoBase = (a.dataVencimento || '').split('T')[0].trim();
    if (!vencimentoBase) return false;

    // Constrói o timestamp limite exato com offset -03:00 (Brasília)
    const limiteBrasilia = new Date(`${vencimentoBase}T23:59:59.999-03:00`).getTime();
    if (isNaN(limiteBrasilia)) return false;

    return agoraEpoch > limiteBrasilia;
  });

  if (temFaturaVencida) {
    return 'INADIMPLENTE';
  }

  return 'EM_DIA';
}

export function formatarRotuloStatus(status: string | null | undefined): string {
  const st = (status || '').toUpperCase();
  switch (st) {
    case 'EM_DIA':
    case 'ADIMPLENTE':
    case 'PAGO':
    case 'QUITADO':
    case 'PENDENTE':
      return 'Em Dia';
    case 'EM_DIA_FUTURO':
      return 'Em Dia (Futuro)';
    case 'EM_ATRASO':
    case 'INADIMPLENTE':
    case 'ATRASADA':
    case 'VENCIDO':
      return 'Em Atraso';
    default:
      return 'Em Dia';
  }
}

export function obterBadgeClassStatus(status: string | null | undefined): string {
  const st = (status || '').toUpperCase();
  switch (st) {
    case 'EM_DIA':
    case 'ADIMPLENTE':
    case 'PAGO':
    case 'QUITADO':
    case 'PENDENTE':
      return 'bg-emerald-950 text-emerald-300 border-emerald-500/40';
    case 'EM_DIA_FUTURO':
      return 'bg-sky-950 text-sky-300 border-sky-500/40';
    case 'EM_ATRASO':
    case 'INADIMPLENTE':
    case 'ATRASADA':
    case 'VENCIDO':
      return 'bg-rose-950 text-rose-300 border-rose-500/40';
    default:
      return 'bg-emerald-950 text-emerald-300 border-emerald-500/40';
  }
}

export function projetarProximaAnuidade(
  anuidadeLiquidada: AnuidadeMinistro,
  valorRecorrente: number
): AnuidadeMinistro {
  const proximoAno = anuidadeLiquidada.anoVigente + 1;
  const hoje = new Date();
  const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
  const diaAtual = String(hoje.getDate()).padStart(2, '0');
  const partesData = (anuidadeLiquidada.dataVencimento || '').split('T')[0].split('-');
  const mes = partesData[1] && partesData[1].length === 2 ? partesData[1] : mesAtual;
  const dia = partesData[2] && partesData[2].length === 2 ? partesData[2] : diaAtual;
  const mesDia = `${mes}-${dia}`;
  const novoVencimento = `${proximoAno}-${mesDia}`;

  return deepFreeze({
    id: `an-${proximoAno}-${anuidadeLiquidada.ministroId}-${Math.random().toString(36).substring(2, 7)}`,
    ministroId: anuidadeLiquidada.ministroId,
    tenantId: anuidadeLiquidada.tenantId,
    anoVigente: proximoAno,
    dataVencimento: novoVencimento,
    valor: valorRecorrente,
    statusPagamento: 'ABERTO',
    tipo: 'RECEITA',
    categoria: 'ANUIDADE',
  });
}

/**
 * Demonstrativo de Resultado de Exercício (DRE) Data-Mapping Layer
 * Lei de Simetria Monetária: Estritamente `valor` (number em BRL) e `statusPagamento: 'PAGO'`.
 */
export function calcularDRE(
  anuidades: readonly AnuidadeMinistro[]
): DemonstrativoResultadoExercicio {
  let faturamentoBrutoCentavos = 0;
  let receitaTaxaConvencaoCentavos = 0;
  let receitaAnuidadesCentavos = 0;
  let previsaoReceberCentavos = 0;
  let taxasGatewayCentavos = 0;

  for (const a of anuidades) {
    const rawVal = Number(a.valor) || 0;
    const valorCentavos = toCents(rawVal);
    const status = String(a.statusPagamento || '').toUpperCase().trim();
    const isPago = status === 'PAGO' || status === 'EM_DIA';
    const isIsentoOuAnistiado = status === 'ISENTO' || status === 'ANISTIADO';
    const isDespesa = String(a.tipo || '').toUpperCase().trim() === 'DESPESA';
    const categoria = String(a.categoria || '').toUpperCase().trim();

    if (isPago) {
      if (isDespesa) {
        if (categoria === 'DESPESA_TAXA_GATEWAY' || categoria === 'TARIFA_GATEWAY') {
          taxasGatewayCentavos += valorCentavos;
        }
      } else {
        faturamentoBrutoCentavos += valorCentavos;

        if (categoria === 'TAXA_CONVENCAO' || categoria === 'FILIACAO') {
          receitaTaxaConvencaoCentavos += valorCentavos;
        } else {
          receitaAnuidadesCentavos += valorCentavos;
        }

        if (a.tarifaAsaas && a.tarifaAsaas > 0) {
          taxasGatewayCentavos += toCents(a.tarifaAsaas);
        }
      }
    } else if (isIsentoOuAnistiado) {
      // Isentos ou anistiados não entram no faturamento nem na previsão a receber (contabilidade isenta)
    } else {
      if (!isDespesa) {
        previsaoReceberCentavos += valorCentavos;
      }
    }
  }

  if (taxasGatewayCentavos === 0 && faturamentoBrutoCentavos > 0) {
    taxasGatewayCentavos = Math.round(faturamentoBrutoCentavos * 0.0165);
  }

  const faturamentoLiquidoCentavos = Math.max(0, faturamentoBrutoCentavos - taxasGatewayCentavos);

  return deepFreeze({
    faturamentoBrutoCentavos,
    faturamentoLiquidoCentavos,
    taxasGatewayCentavos,
    receitaTaxaConvencaoCentavos,
    receitaAnuidadesCentavos,
    previsaoReceberCentavos,
    faturamentoBruto: fromCents(faturamentoBrutoCentavos),
    faturamentoLiquido: fromCents(faturamentoLiquidoCentavos),
    taxasGateway: fromCents(taxasGatewayCentavos),
    receitaTaxaConvencao: fromCents(receitaTaxaConvencaoCentavos),
    receitaAnuidades: fromCents(receitaAnuidadesCentavos),
    previsaoReceber: fromCents(previsaoReceberCentavos),
  });
}

/**
 * Gera código Pix Copia e Cola 100% aderente ao padrão oficial BACEN BRCode (EMV).
 * Inclui cálculo dinâmico de TLV (Tag-Length-Value) e CRC16-CCITT válido.
 */
export function calcularCrc16Pix(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function gerarPixBacenBrcode(params: {
  chavePix?: string;
  identificador: string;
  valor: number;
  nomeRecebedor?: string;
  cidade?: string;
}): string {
  const chave = params.chavePix || 'financeiro@cimadebe.org.br';
  const nome = (params.nomeRecebedor || 'CIMADEBE').normalize('NFD').replace(/[\u0300-\u036f]/g, '').substring(0, 25).toUpperCase();
  const cidade = (params.cidade || 'SALVADOR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').substring(0, 15).toUpperCase();
  const valorStr = params.valor.toFixed(2);
  const txId = params.identificador.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) || '***';

  const tlv = (tag: string, val: string) => `${tag}${String(val.length).padStart(2, '0')}${val}`;

  const tag00 = tlv('00', '01');
  const tag26 = tlv('26', `${tlv('00', 'BR.GOV.BCB.PIX')}${tlv('01', chave)}`);
  const tag52 = tlv('52', '0000');
  const tag53 = tlv('53', '986');
  const tag54 = tlv('54', valorStr);
  const tag58 = tlv('58', 'BR');
  const tag59 = tlv('59', nome);
  const tag60 = tlv('60', cidade);
  const tag62 = tlv('62', tlv('05', txId));

  const payloadParcial = `${tag00}${tag26}${tag52}${tag53}${tag54}${tag58}${tag59}${tag60}${tag62}6304`;
  const crc = calcularCrc16Pix(payloadParcial);
  return `${payloadParcial}${crc}`;
}

/**
 * Matriz de Auditoria e Filtro Contábil de Lançamentos:
 * 1. Ministro Deletado (não encontrado na lista):
 *    - Valores Pagos (PAGO): PERMANECEM no histórico contábil realizado (preservação do livro-caixa).
 *    - Valores Abertos/Projetados: EXPURGADOS 100% (não entram em projeção nem em cobrança ativa).
 * 2. Ministro Desabilitado (SUSPENSO):
 *    - Valores Pagos (PAGO): PERMANECEM no histórico contábil.
 *    - Inadimplência Passada / Débitos Vencidos (dataVencimento < hoje): PERMANECEM como passivo pendente a regularizar.
 *    - Previsão / Anuidade Aberta sem atraso vencido (ministro em dia que foi suspenso): BARRADA da projeção orçamentária.
 * 3. Ministro Ativo (ATIVO):
 *    - Todos os lançamentos pagos, abertos e projetados compõem a contabilidade normal.
 */
export interface ResultadoFiltroContabil {
  readonly anuidadesProjetadas: readonly AnuidadeMinistro[];
  readonly anuidadesRealizadas: readonly AnuidadeMinistro[];
  readonly anuidadesPendentes: readonly AnuidadeMinistro[];
  readonly totalProjetado: number;
  readonly totalRealizado: number;
  readonly totalPendente: number;
}

export function processarMatrizContabilAnuidades(
  anuidades: readonly AnuidadeMinistro[],
  ministros: readonly Ministro[],
  tenantId?: string,
  anoExercicio?: number
): ResultadoFiltroContabil {
  const hoje = getSystemDate();
  const anoRef = anoExercicio || getSystemYear();
  const mapMinistros = new Map<string, Ministro>();
  for (const m of ministros) {
    mapMinistros.set(m.id, m);
    if (m.cpf) {
      mapMinistros.set(m.cpf.replace(/\D/g, ''), m);
    }
  }

  const projetadas: AnuidadeMinistro[] = [];
  const realizadas: AnuidadeMinistro[] = [];
  const pendentes: AnuidadeMinistro[] = [];

  for (const a of anuidades) {
    if (tenantId && a.tenantId && a.tenantId !== tenantId) {
      continue;
    }

    const min = mapMinistros.get(a.ministroId);
    const isPago = a.statusPagamento === 'PAGO';
    const isAnistiado = a.statusPagamento === 'ANISTIADO';
    const vencimentoIso = (a.dataVencimento || '').split('T')[0];
    const isVencido = vencimentoIso < hoje;

    // 1. Valores Pagos SEMPRE permanecem no Realizado (integridade do livro-caixa)
    if (isPago) {
      realizadas.push(a);
      projetadas.push(a); // Realizado faz parte do orçado cumprido
      continue;
    }

    if (isAnistiado) {
      continue;
    }

    // 2. Se o ministro foi DELETADO (não existe na base de ministros):
    // Não projeta nem cobra nada em aberto
    if (!min) {
      continue;
    }

    // 3. Se o ministro é ATIVO:
    if (min.status === 'ATIVO') {
      projetadas.push(a);
      if (a.anoVigente <= anoRef) {
        pendentes.push(a);
      }
      continue;
    }

    // 4. Se o ministro é SUSPENSO (Desabilitado):
    if (min.status === 'SUSPENSO') {
      // Se tiver dívida real vencida anterior, permanece no pendente para cobrança de regularização
      if (isVencido || a.anoVigente < anoRef) {
        pendentes.push(a);
      }
      // Se era anuidade aberta sem atraso vencido de ministro que foi suspenso em dia:
      // BARRADA DA PROJEÇÃO (não entra em projetadas nem em pendentes).
    }
  }

  const totalProjetado = projetadas.reduce((acc, a) => acc + (a.valor || 0), 0);
  const totalRealizado = realizadas.reduce((acc, a) => acc + (a.valor || 0), 0);
  const totalPendente = pendentes.reduce((acc, a) => acc + (a.valor || 0), 0);

  return deepFreeze({
    anuidadesProjetadas: projetadas,
    anuidadesRealizadas: realizadas,
    anuidadesPendentes: pendentes,
    totalProjetado,
    totalRealizado,
    totalPendente,
  });
}
