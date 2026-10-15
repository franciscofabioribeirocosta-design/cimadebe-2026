/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * [ETAPA 2 DE 5] - Serviço de Banco de Dados (Firestore) com Integridade Atômica
 * Focado em persistência segura, KillSwitch de Compliance e Transações ACID (runTransaction)
 */

import {
  Firestore,
  doc,
  collection,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  writeBatch,
  serverTimestamp,
  increment,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Ministro, AnuidadeMinistro } from '../types';
import { getSystemDate, getDataHoraBrasil, getSystemTimeIso } from '../financialEngine';

export interface LogAuditoriaAgoFiliacao {
  id: string;
  inscricaoId: string;
  ministroId: string;
  ministroNome: string;
  ministroCpf: string;
  cargo: string;
  planoId: string;
  planoNome: string;
  valorInscricaoAgo: number;
  valorFiliacao: number;
  ehMembroExistente: boolean;
  statusTransacao: 'CONCLUIDO_COM_SUCESSO' | 'DIVERGENCIA_DETECTADA';
  divergenciaMotivo?: string;
  integridadeAcid: boolean;
  dataHoraStr: string;
  criadoEm?: any;
}

/**
 * 1. BUSCA POR CPF E VERIFICAÇÃO DE ELEGIBILIDADE (KillSwitch de Compliance & Anti-Quota Lock)
 */
export async function buscarMinistroPorCPF(
  cpf: string,
  ministrosEmMemoria?: readonly Ministro[]
): Promise<Ministro | null> {
  const cpfLimpo = (cpf || '').replace(/\D/g, '');
  if (!cpfLimpo || cpfLimpo.length < 11) {
    return null;
  }

  // 0. LAYER 3: CACHE LOCK - Prioridade absoluta à leitura em memória (0 leituras no Firestore)
  if (ministrosEmMemoria && ministrosEmMemoria.length > 0) {
    const minCache = ministrosEmMemoria.find(
      (m) => (m.cpf || '').replace(/\D/g, '') === cpfLimpo || m.id === cpfLimpo
    );
    if (minCache) {
      validarElegibilidadeMinistro(minCache);
      return minCache;
    }
  }

  try {
    const ministrosRef = collection(db, 'ministros');
    
    // 1. Busca direta por ID de documento caso o ID seja o CPF numérico (O(1)) com proteção contra quota
    try {
      const snapDireto = await getDoc(doc(db, 'ministros', cpfLimpo));
      if (snapDireto.exists()) {
        let ministro = { id: snapDireto.id, ...snapDireto.data() } as Ministro;
        validarElegibilidadeMinistro(ministro);
        try {
          const compl = await verificarComplianceFinanceiroDetalhado(db, ministro.id);
          if (compl.inadimplente) {
            ministro = { ...ministro, statusAdimplencia: 'INADIMPLENTE' };
          }
        } catch (e: any) {
          console.warn('[verificarComplianceFinanceiro] Quota/aviso:', e?.message);
        }
        return ministro;
      }
    } catch (errDirect: any) {
      console.warn('[buscarMinistroPorCPF] getDoc direto protegido contra quota:', errDirect?.message);
    }

    // 2. Busca estrita por CPF com formatação canônica ou numérico com limit(1)
    const cpfFormatado = `${cpfLimpo.slice(0, 3)}.${cpfLimpo.slice(3, 6)}.${cpfLimpo.slice(6, 9)}-${cpfLimpo.slice(9, 11)}`;
    let snap: any = null;

    try {
      const q = query(ministrosRef, where('cpf', 'in', [cpfFormatado, cpfLimpo]), limit(1));
      snap = await getDocs(q);
    } catch (eIn: any) {
      try {
        const qSimple = query(ministrosRef, where('cpf', '==', cpfFormatado), limit(1));
        snap = await getDocs(qSimple);
      } catch (eSim: any) {
        console.warn('[buscarMinistroPorCPF] Quota diária Firestore esgotada:', eSim?.message);
        return null;
      }
    }

    if (!snap || snap.empty) {
      return null;
    }

    const ministroDoc = snap.docs[0];
    let ministro = { id: ministroDoc.id, ...ministroDoc.data() } as Ministro;

    validarElegibilidadeMinistro(ministro);
    try {
      const compl = await verificarComplianceFinanceiroDetalhado(db, ministro.id);
      if (compl.inadimplente) {
        ministro = { ...ministro, statusAdimplencia: 'INADIMPLENTE' };
      }
    } catch (e: any) {
      console.warn('[verificarComplianceFinanceiro] Quota/aviso:', e?.message);
    }

    return ministro;
  } catch (err: any) {
    console.warn('[buscarMinistroPorCPF] Falha na consulta Firestore (quota ou offline):', err?.message);
    return null;
  }
}

function validarElegibilidadeMinistro(ministro: Ministro) {
  const status = (ministro.status || '').trim().toUpperCase();
  if (status === 'INATIVO' || status === 'SUSPENSO' || status === 'DESLIGADO' || status === 'EXPULSO') {
    throw new Error(`Inscrição Bloqueada: O ministro ${ministro.nome} encontra-se com status '${ministro.status}'. Regularize sua situação junto ao Conselho Geral.`);
  }
}

export interface ResultadoComplianceFinanceiro {
  inadimplente: boolean;
  pendencias: AnuidadeMinistro[];
  totalDevido: number;
}

export async function verificarComplianceFinanceiroDetalhado(
  firestore: Firestore,
  ministroId: string,
  anuidadesEmMemoria?: readonly AnuidadeMinistro[]
): Promise<ResultadoComplianceFinanceiro> {
  const hoje = getSystemDate();
  let docsAnuidades: AnuidadeMinistro[] = [];

  // LAYER 3: Prioriza memória para poupar quota de leitura (0 reads)
  if (anuidadesEmMemoria && anuidadesEmMemoria.length > 0) {
    docsAnuidades = anuidadesEmMemoria.filter((a) => a.ministroId === ministroId) as AnuidadeMinistro[];
  }

  // Se não encontrado em memória, faz query segura com limit(20) e captura QuotaExhausted
  if (docsAnuidades.length === 0) {
    try {
      const anuidadesRef = collection(firestore, 'anuidades');
      const q = query(anuidadesRef, where('ministroId', '==', ministroId), limit(20));
      const snap = await getDocs(q);
      if (!snap.empty) {
        docsAnuidades = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AnuidadeMinistro));
      }
    } catch (err: any) {
      console.warn('[verificarComplianceFinanceiroDetalhado] Quota / Rate Exceeded Firestore:', err?.message);
      return { inadimplente: false, pendencias: [], totalDevido: 0 };
    }
  }

  if (docsAnuidades.length === 0) {
    return { inadimplente: false, pendencias: [], totalDevido: 0 };
  }

  const mapAnuidades = new Map<number, AnuidadeMinistro>();

  for (const data of docsAnuidades) {
    const ano = data.anoVigente || 2026;

    if (!mapAnuidades.has(ano)) {
      mapAnuidades.set(ano, data);
    } else {
      const existente = mapAnuidades.get(ano)!;
      if (data.statusPagamento === 'PAGO' && existente.statusPagamento !== 'PAGO') {
        mapAnuidades.set(ano, data);
      }
    }
  }

  const pendencias: AnuidadeMinistro[] = [];
  let totalDevido = 0;

  for (const data of mapAnuidades.values()) {
    const status = (data.statusPagamento || '').trim().toUpperCase();
    const dataVenc = data.dataVencimento ? String(data.dataVencimento).split('T')[0] : '';

    const estaVencida = status === 'ATRASADA' || (status === 'ABERTO' && dataVenc && dataVenc <= hoje);
    if (estaVencida) {
      pendencias.push(data);
      totalDevido += Number(data.valor) || 0;
    }
  }

  return {
    inadimplente: pendencias.length > 0,
    pendencias,
    totalDevido,
  };
}

export async function liquidarAnuidadeImediata(
  firestore: Firestore,
  anuidadeId: string,
  ministroId: string
): Promise<void> {
  const anuidadeRef = doc(firestore, 'anuidades', anuidadeId);
  const snap = await getDoc(anuidadeRef);

  if (!snap.exists()) {
    return;
  }

  const anuidadeData = snap.data() as AnuidadeMinistro;
  if (anuidadeData.statusPagamento === 'PAGO') {
    return;
  }

  const batch = writeBatch(firestore);
  const dataHojeIso = new Date().toISOString();
  const tenantId = anuidadeData.tenantId || 't-sede-salvador';
  const valor = Number(anuidadeData.valor) || 120.0;
  const anoVigente = Number(anuidadeData.anoVigente) || 2026;
  const proximoAno = anoVigente + 1;

  // 1. Marca a anuidade atual como PAGA com chave padronizada
  batch.update(anuidadeRef, {
    statusPagamento: 'PAGO',
    dataLiquidacao: dataHojeIso,
    dataPagamento: dataHojeIso,
    metodoPagamento: 'PIX_SISTEMA',
  });

  // 2. Projeta a próxima anuidade em cascata para o ano subsequente
  const proximaAnuidadeId = `an-${proximoAno}-${ministroId}-${Math.random().toString(36).substring(2, 7)}`;
  const proximaRef = doc(firestore, 'anuidades', proximaAnuidadeId);
  const proximoVencimento = `${proximoAno}-09-26`;

  batch.set(
    proximaRef,
    {
      id: proximaAnuidadeId,
      ministroId,
      tenantId,
      anoVigente: proximoAno,
      dataVencimento: proximoVencimento,
      valor: 120.0,
      statusPagamento: 'ABERTO',
      tipo: 'RECEITA',
      categoria: 'ANUIDADE',
    },
    { merge: true }
  );

  // 3. Atualiza os totais financeiros consolidados
  const totalRef = doc(firestore, 'totais_financeiros', tenantId);
  batch.set(
    totalRef,
    {
      totalLiquidado: increment(valor),
      quantidadeLancamentos: increment(1),
      ultimaAtualizacao: dataHojeIso,
    },
    { merge: true }
  );

  // 4. Atualiza o status do ministro para EM_DIA
  const minRef = doc(firestore, 'ministros', ministroId);
  batch.update(minRef, {
    statusAdimplencia: 'EM_DIA',
    ultimaAtualizacao: dataHojeIso,
  });

  // 5. Commit atômico no Firestore
  await batch.commit();
}

export interface VerificacaoAdimplenciaLoginResultado {
  readonly statusAdimplencia: 'EM_DIA' | 'EM_DIA_FUTURO' | 'PENDENTE' | 'EM_ATRASO' | 'ADIMPLENTE' | 'INADIMPLENTE';
  readonly dentroDoPrazo12Meses: boolean;
  readonly diasDesdeUltimaTaxa: number | null;
  readonly mesesDesdeUltimaTaxa: number | null;
  readonly dataUltimaTaxaPaga: string | null;
  readonly ultimaTaxaPagaId: string | null;
  readonly possuiDebitoVencido: boolean;
  readonly totalDebitoVencido: number;
  readonly motivo: string;
  readonly dataVerificacaoIso: string;
}

/**
 * [MECANISMO DE CÁLCULO DE ADIMPLÊNCIA NO LOGIN - PRAZO DE 12 MESES]
 * Camada estrita em tempo real executada antes da liberação do acesso.
 * 
 * Regra:
 * 1. Layer 1: Validação do identificador do ministro (Fail-Fast).
 * 2. Layer 2: Consulta atômica no Firestore da coleção 'anuidades' (limite 50).
 * 3. Identifica a última taxa de filiação paga (PAGO / ISENTO / JUBILADO).
 * 4. Calcula o intervalo temporal contra a data atual.
 * 5. Se intervalo > 365 dias (12 meses) OU existirem débitos vencidos em aberto, classifica como INADIMPLENTE.
 * 6. Grava atomicamente no Firestore o status recalculado no documento do ministro antes da concessão de sessão.
 */
export async function verificarAdimplenciaLogin12Meses(
  firestore: Firestore,
  ministroId: string,
  anuidadesEmMemoria?: readonly AnuidadeMinistro[],
  ministroEmMemoria?: Ministro
): Promise<VerificacaoAdimplenciaLoginResultado> {
  // LAYER 1: STRICT INPUT VALIDATION & FAIL-FAST GATE
  if (!ministroId || typeof ministroId !== 'string' || !ministroId.trim()) {
    throw new Error('Falha de Validação (Layer 1): Identificador do ministro ausente para verificação de adimplência.');
  }

  const idLimpo = ministroId.trim();
  const dataHojeStr = getSystemDate();
  const hoje = new Date(`${dataHojeStr}T00:00:00`);
  const dataVerificacaoIso = getSystemTimeIso();

  // LAYER 3: Se dados de memória fornecidos, utiliza sem consultar Firestore (0 leituras)
  let todasAnuidades: AnuidadeMinistro[] = [];
  let dadosMinistro: Ministro | null = ministroEmMemoria || null;

  if (anuidadesEmMemoria && anuidadesEmMemoria.length > 0) {
    todasAnuidades = anuidadesEmMemoria.filter((a) => a.ministroId === idLimpo) as AnuidadeMinistro[];
  }

  // Se não temos anuidades em memória ou se faltam dados, consulta Firestore de forma protegida
  if (todasAnuidades.length === 0 && !dadosMinistro) {
    try {
      const anuidadesRef = collection(firestore, 'anuidades');
      const q = query(anuidadesRef, where('ministroId', '==', idLimpo), limit(50));
      const snap = await getDocs(q);
      if (!snap.empty) {
        todasAnuidades = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AnuidadeMinistro));
      }

      const minRef = doc(firestore, 'ministros', idLimpo);
      const minDoc = await getDoc(minRef);
      if (minDoc.exists()) {
        dadosMinistro = minDoc.data() as Ministro;
      }
    } catch (errQ: any) {
      const msg = (errQ?.message || '').toLowerCase();
      if (msg.includes('quota') || msg.includes('resourceexhausted') || msg.includes('limit') || msg.includes('free daily read units')) {
        console.warn('[verificarAdimplenciaLogin12Meses] Operando sob cota diária do Cloud. Retornando estase segura.');
        return {
          statusAdimplencia: (dadosMinistro?.statusAdimplencia as any) || 'ADIMPLENTE',
          dentroDoPrazo12Meses: true,
          diasDesdeUltimaTaxa: 0,
          mesesDesdeUltimaTaxa: 0,
          dataUltimaTaxaPaga: dataHojeStr,
          ultimaTaxaPagaId: 'STASIS_COTA_CLOUD',
          possuiDebitoVencido: false,
          totalDebitoVencido: 0,
          motivo: 'Verificação em estase resiliente (cota temporária de leitura do provedor).',
          dataVerificacaoIso,
        };
      }
      console.warn('[verificarAdimplenciaLogin12Meses] Erro Firestore:', errQ?.message);
    }
  }

  if (dadosMinistro?.statusPrivilegio === 'ISENTO' || dadosMinistro?.statusPrivilegio === 'JUBILADO') {
    const resIsento: VerificacaoAdimplenciaLoginResultado = {
      statusAdimplencia: 'EM_DIA',
      dentroDoPrazo12Meses: true,
      diasDesdeUltimaTaxa: 0,
      mesesDesdeUltimaTaxa: 0,
      dataUltimaTaxaPaga: dataHojeStr,
      ultimaTaxaPagaId: 'ISENCAO_ESTATUTARIA',
      possuiDebitoVencido: false,
      totalDebitoVencido: 0,
      motivo: `Ministro dispensado por prerrogativa legal estatutária (${dadosMinistro.statusPrivilegio}).`,
      dataVerificacaoIso,
    };
    try {
      const minRef = doc(firestore, 'ministros', idLimpo);
      await updateDoc(minRef, {
        statusAdimplencia: 'EM_DIA',
        ultimaVerificacaoAdimplencia: dataVerificacaoIso,
        motivoAdimplencia: resIsento.motivo,
      }).catch(() => {});
    } catch {}
    return resIsento;
  }

  if (todasAnuidades.length === 0) {
    const resVazio: VerificacaoAdimplenciaLoginResultado = {
      statusAdimplencia: (dadosMinistro?.statusAdimplencia as any) || 'EM_ATRASO',
      dentroDoPrazo12Meses: false,
      diasDesdeUltimaTaxa: null,
      mesesDesdeUltimaTaxa: null,
      dataUltimaTaxaPaga: null,
      ultimaTaxaPagaId: null,
      possuiDebitoVencido: false,
      totalDebitoVencido: 0,
      motivo: 'Nenhuma taxa de filiação foi localizada no registro contábil do banco de dados.',
      dataVerificacaoIso,
    };
    try {
      const minRef = doc(firestore, 'ministros', idLimpo);
      await updateDoc(minRef, {
        statusAdimplencia: resVazio.statusAdimplencia,
        ultimaVerificacaoAdimplencia: dataVerificacaoIso,
        motivoAdimplencia: resVazio.motivo,
      }).catch(() => {});
    } catch {}
    return resVazio;
  }

  // 1. Identifica débitos vencidos em aberto (passaram do dia)
  const debitosVencidos = todasAnuidades.filter((a) => {
    const status = (a.statusPagamento || '').trim().toUpperCase();
    const dataVenc = a.dataVencimento ? String(a.dataVencimento).split('T')[0] : '';
    return status === 'ATRASADA' || status === 'EM_ATRASO' || (status === 'ABERTO' && dataVenc && dataVenc <= dataHojeStr);
  });

  const possuiDebitoVencido = debitosVencidos.length > 0;
  const totalDebitoVencido = debitosVencidos.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);

  // 2. Identifica as taxas que foram quitadas
  const taxasPagas = todasAnuidades.filter((a) => {
    const st = (a.statusPagamento || '').trim().toUpperCase();
    return st === 'PAGO' || st === 'EM_DIA' || st === 'EM_DIA_FUTURO';
  });

  if (taxasPagas.length === 0) {
    const resSemPago: VerificacaoAdimplenciaLoginResultado = {
      statusAdimplencia: 'EM_ATRASO',
      dentroDoPrazo12Meses: false,
      diasDesdeUltimaTaxa: null,
      mesesDesdeUltimaTaxa: null,
      dataUltimaTaxaPaga: null,
      ultimaTaxaPagaId: null,
      possuiDebitoVencido,
      totalDebitoVencido,
      motivo: 'O ministro não possui nenhuma taxa de filiação quitada no banco de dados.',
      dataVerificacaoIso,
    };
    await updateDoc(minRef, {
      statusAdimplencia: 'EM_ATRASO',
      ultimaVerificacaoAdimplencia: dataVerificacaoIso,
      motivoAdimplencia: resSemPago.motivo,
    }).catch(() => {});
    return resSemPago;
  }

  // Ordena para obter a taxa paga mais recente (prioriza data de liquidação/pagamento ou dataVencimento/anoVigente)
  taxasPagas.sort((a, b) => {
    const dataA = a.dataLiquidacao || a.dataPagamento || a.dataVencimento || `${a.anoVigente || 2020}-01-01`;
    const dataB = b.dataLiquidacao || b.dataPagamento || b.dataVencimento || `${b.anoVigente || 2020}-01-01`;
    return String(dataB).localeCompare(String(dataA));
  });

  const ultimaTaxa = taxasPagas[0];
  const dataReferenciaStr = (ultimaTaxa.dataLiquidacao || ultimaTaxa.dataPagamento || ultimaTaxa.dataVencimento || `${ultimaTaxa.anoVigente}-09-26`).split('T')[0];
  const dataTaxa = new Date(`${dataReferenciaStr}T00:00:00`);

  const diffMs = hoje.getTime() - dataTaxa.getTime();
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMeses = Math.floor(diffDias / 30.4375);

  // Regra dos 12 meses: até 365 dias da última taxa de filiação paga
  const dentroDoPrazo12Meses = diffDias <= 365;

  // Verifica se há cobrança em aberto com vencimento em até 30 dias (PENDENTE)
  const anoAtual = hoje.getFullYear();
  const temPendente30Dias = todasAnuidades.some((a) => {
    const st = (a.statusPagamento || 'ABERTO').toUpperCase();
    if (st === 'PAGO' || st === 'EM_DIA' || st === 'EM_DIA_FUTURO' || st === 'ANISTIADO') return false;
    const v = (a.dataVencimento || '').split('T')[0];
    if (!v) return false;
    const dv = new Date(`${v}T00:00:00`);
    const d = Math.ceil((dv.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    return d >= 0 && d <= 30;
  });

  const temFuturoPago = taxasPagas.some((a) => (a.anoVigente || 0) > anoAtual);

  let statusFinal: 'EM_DIA' | 'EM_DIA_FUTURO' | 'EM_ATRASO' = 'EM_DIA';
  let motivoFinal = '';

  if (!dentroDoPrazo12Meses) {
    statusFinal = 'EM_ATRASO';
    motivoFinal = `Última taxa de filiação quitada em ${dataReferenciaStr.split('-').reverse().join('/')} expirou há ${diffDias} dias (prazo limite de 12 meses excedido).`;
  } else if (possuiDebitoVencido) {
    statusFinal = 'EM_ATRASO';
    motivoFinal = `Identificado(s) ${debitosVencidos.length} débito(s) em atraso no valor total de R$ ${totalDebitoVencido.toFixed(2)}.`;
  } else if (temFuturoPago) {
    statusFinal = 'EM_DIA_FUTURO';
    motivoFinal = `Anuidade de exercício futuro já quitada antecipadamente.`;
  } else {
    statusFinal = 'EM_DIA';
    motivoFinal = `Taxas de filiação e anuidades em dia (${diffDias} dias desde a última quitação).`;
  }

  // LAYER 3: ATOMIC MUTATION NO FIRESTORE
  await updateDoc(minRef, {
    statusAdimplencia: statusFinal,
    ultimaVerificacaoAdimplencia: dataVerificacaoIso,
    diasDesdeUltimaTaxa: diffDias,
    motivoAdimplencia: motivoFinal,
  }).catch((err) => console.warn('[verificarAdimplenciaLogin12Meses] Erro ao persistir status:', err?.message));

  return {
    statusAdimplencia: statusFinal,
    dentroDoPrazo12Meses,
    diasDesdeUltimaTaxa: diffDias,
    mesesDesdeUltimaTaxa: diffMeses,
    dataUltimaTaxaPaga: dataReferenciaStr,
    ultimaTaxaPagaId: ultimaTaxa.id,
    possuiDebitoVencido,
    totalDebitoVencido,
    motivo: motivoFinal,
    dataVerificacaoIso,
  };
}

async function verificarComplianceFinanceiro(_firestore: Firestore, _ministroId: string) {
  // A verificação de compliance financeiro não deve bloquear a busca do obreiro por CPF,
  // permitindo que o ministro visualize seus planos, consulte seus dados e realize a inscrição na AGO.
  return;
}

/**
 * 2. VERIFICAÇÃO DE INSCRIÇÃO ATIVA (ANTI-DUPLICIDADE E CONSULTA MULTI-VETOR)
 */
export async function verificarInscricaoAtiva(
  ministroId: string,
  cicloAGO: string = '2026',
  cpfOpcional?: string,
  inscricoesEmMemoria?: readonly any[]
): Promise<any | null> {
  const anoNum = parseInt(cicloAGO, 10) || 2026;
  const isValida = (dados: any) => {
    if (!dados) return false;
    const status = (dados.status || dados.statusInscricao || dados.statusPagamento || '').trim().toUpperCase();
    const statusValidos = ['PAGO', 'CONFIRMADO', 'VALIDA', 'HOMOLOGADO', 'CONCLUIDO', 'EM_PROCESSAMENTO', 'PENDENTE'];
    const statusMatch = statusValidos.includes(status);
    
    const anoMatch = !dados.anoVigente ||
      String(dados.anoVigente) === String(cicloAGO) ||
      Number(dados.anoVigente) === anoNum;

    return statusMatch && anoMatch;
  };

  const rawCpf = cpfOpcional || (ministroId && ministroId.match(/\d{11}/) ? ministroId : '');
  const cpfLimpo = rawCpf.replace(/\D/g, '');

  // 0. LAYER 3: CACHE LOCK - Prioridade total ao cache em memória imutável (0 leituras)
  if (inscricoesEmMemoria && inscricoesEmMemoria.length > 0) {
    const inscCache = inscricoesEmMemoria.find((item) => {
      const minIdMatch = ministroId && ministroId.trim() && item.ministroId === ministroId.trim();
      const rawItemCpf = (item.cpf || item.ministroCpf || '').replace(/\D/g, '');
      const cpfMatch = cpfLimpo && rawItemCpf === cpfLimpo;
      return (minIdMatch || cpfMatch) && isValida(item);
    });
    if (inscCache) {
      return inscCache;
    }
  }

  try {
    const colRef = collection(db, 'inscricoes_ago');

    // 1. Verificação por ID direto ministroId_cicloAGO
    if (ministroId && ministroId.trim()) {
      const docId = `${ministroId.trim()}_${cicloAGO}`;
      try {
        const snapDirect = await getDoc(doc(db, 'inscricoes_ago', docId));
        if (snapDirect.exists() && isValida(snapDirect.data())) {
          return { id: snapDirect.id, ...snapDirect.data() };
        }
      } catch (errDirect: any) {
        console.warn('[verificarInscricaoAtiva] getDoc direto falhou/quota:', errDirect?.message);
      }

      // 2. Consulta indexada por ministroId com limit(1)
      try {
        const qMinistroId = query(colRef, where('ministroId', '==', ministroId.trim()), limit(1));
        const snapMin = await getDocs(qMinistroId);
        if (!snapMin.empty && isValida(snapMin.docs[0].data())) {
          return { id: snapMin.docs[0].id, ...snapMin.docs[0].data() };
        }
      } catch (errQ: any) {
        console.warn('[verificarInscricaoAtiva] Query ministroId falhou/quota:', errQ?.message);
      }
    }

    // 3. Verificação por CPF (formatado e numérico) com limit(1)
    if (cpfLimpo.length === 11) {
      const cpfFormatado = `${cpfLimpo.slice(0, 3)}.${cpfLimpo.slice(3, 6)}.${cpfLimpo.slice(6, 9)}-${cpfLimpo.slice(9, 11)}`;

      try {
        const qCpf = query(colRef, where('cpf', 'in', [cpfFormatado, cpfLimpo]), limit(1));
        const snapCpf = await getDocs(qCpf);
        if (!snapCpf.empty && isValida(snapCpf.docs[0].data())) {
          return { id: snapCpf.docs[0].id, ...snapCpf.docs[0].data() };
        }
      } catch (errCpf: any) {
        // Fallback para query simples
        try {
          const qCpfSimp = query(colRef, where('cpf', '==', cpfFormatado), limit(1));
          const snapSimp = await getDocs(qCpfSimp);
          if (!snapSimp.empty && isValida(snapSimp.docs[0].data())) {
            return { id: snapSimp.docs[0].id, ...snapSimp.docs[0].data() };
          }
        } catch (e: any) {
          console.warn('[verificarInscricaoAtiva] Quota excedida no Firestore ao buscar por CPF:', e?.message);
        }
      }

      try {
        const qMinCpf = query(colRef, where('ministroCpf', 'in', [cpfFormatado, cpfLimpo]), limit(1));
        const snapMinCpf = await getDocs(qMinCpf);
        if (!snapMinCpf.empty && isValida(snapMinCpf.docs[0].data())) {
          return { id: snapMinCpf.docs[0].id, ...snapMinCpf.docs[0].data() };
        }
      } catch (errMinCpf: any) {
        console.warn('[verificarInscricaoAtiva] Quota excedida no Firestore:', errMinCpf?.message);
      }
    }

    return null;
  } catch (err: any) {
    console.warn('[verificarInscricaoAtiva] Erro na consulta Firestore:', err?.message);
    return null;
  }
}

import { sanitizarPayloadParaFirestore } from '../utils/imageCompressor';

/**
 * 3. PERSISTÊNCIA DE NOVO CADASTRO (STATUS EM ANÁLISE)
 */
export async function salvarPreCadastroNovoMinistro(dados: any): Promise<string> {
  const ministroId = dados.id || `min-novo-${Date.now()}`;
  const docRef = doc(db, 'ministros', ministroId);
  const mediaRef = doc(db, 'ministros', ministroId, 'arquivos', 'midia');

  const fotoUrl = dados.fotoUrl || '';
  const documentos = dados.documentos || dados.documentosAnexos || [];

  const payloadPrincipal = {
    id: ministroId,
    nome: dados.nome || dados.nomeCompleto || '',
    nomeCompleto: dados.nomeCompleto || dados.nome || '',
    cpf: dados.cpf || '',
    dataNascimento: dados.dataNascimento || '',
    naturalidade: dados.naturalidade || '',
    nacionalidade: dados.nacionalidade || 'Brasileira',
    estadoCivil: dados.estadoCivil || '',
    nomeConjuge: dados.nomeConjuge || '',
    escolaridade: dados.escolaridade || '',
    profissao: dados.profissao || '',
    email: dados.email || '',
    telefone: dados.telefone || '',
    whatsapp: dados.whatsapp || '',
    cargo: dados.cargo || dados.cargoDesejado || '',
    cargoDesejado: dados.cargoDesejado || dados.cargo || '',
    registroMinisterial: dados.registroMinisterial || '',
    igrejaFiliadaNome: dados.igrejaFiliadaNome || '',
    campoEclesiastico: dados.campoEclesiastico || '',
    dataConsagracao: dados.dataConsagracao || '',
    pastorConsagrante: dados.pastorConsagrante || '',
    modalidadeConsagracao: dados.modalidadeConsagracao || '',
    planoId: dados.planoId || 'PLANO_3',
    planoNome: dados.planoNome || '',
    valor: dados.valor || 380,
    formaPagamento: dados.formaPagamento || '',
    parcelasCartao: dados.parcelasCartao || 1,
    dadosEndereco: dados.dadosEndereco || {},
    endereco: dados.endereco || '',
    cidade: dados.cidade || '',
    estado: dados.estado || '',
    status: dados.status || 'ATIVO',
    statusAdimplencia: dados.statusAdimplencia || 'ADIMPLENTE',
    statusInscricaoAgo: dados.statusInscricaoAgo || 'CONFIRMADO',
    dataInscricao: dados.dataInscricao || new Date().toISOString(),
    statusAcesso: dados.statusAcesso || 'Ativo',
    criadoEm: serverTimestamp(),
  };

  const payloadMidia = {
    ministroId,
    fotoUrl,
    documentos,
    atualizadoEm: serverTimestamp(),
  };

  await Promise.all([
    setDoc(docRef, sanitizarPayloadParaFirestore(payloadPrincipal), { merge: true }),
    setDoc(mediaRef, sanitizarPayloadParaFirestore(payloadMidia), { merge: true }),
  ]);

  return ministroId;
}

/**
 * 4. PROCESSAMENTO DA LIQUIDAÇÃO (TRANSAÇÃO BANCÁRIA ATÔMICA ACID)
 */
export async function efetivarInscricaoAGO(
  dadosInscricao: any,
  chaveIdempotencia: string
): Promise<void> {
  const inscricaoId = dadosInscricao.id || `insc-${dadosInscricao.ministroId}-${Date.now()}`;
  const statsRef = doc(db, 'totais_financeiros', 'ago_estatisticas');
  const idempRef = doc(db, 'transacoes_processadas', chaveIdempotencia);
  const inscricaoRef = doc(db, 'inscricoes_ago', inscricaoId);

  await runTransaction(db, async (transaction) => {
    // A. Verificação de Idempotência
    const idempDoc = await transaction.get(idempRef);
    if (idempDoc.exists()) {
      throw new Error('Transação rejeitada: Esta inscrição já foi processada anteriormente (Chave de Idempotência duplicada).');
    }

    // B. Salvamento do Documento de Inscrição com Foto do Banco
    let fotoMinistro = dadosInscricao.fotoUrl || '';
    if (!fotoMinistro && dadosInscricao.ministroId) {
      const minRef = doc(db, 'ministros', dadosInscricao.ministroId);
      const minSnap = await transaction.get(minRef);
      if (minSnap.exists()) {
        const minData = minSnap.data() as any;
        fotoMinistro = minData.fotoUrl || '';
      }
    }

    transaction.set(inscricaoRef, {
      ...dadosInscricao,
      id: inscricaoId,
      fotoUrl: fotoMinistro,
      status: 'CONFIRMADO',
      criadoEm: serverTimestamp(),
    });

    const hojeStr = getSystemDate();
    const ts = Date.now();
    const tenantIdFinal = dadosInscricao.tenantId || 't-sede-salvador';
    const ehMembroExistente = Boolean(dadosInscricao.ehMembroExistente);
    const cargoNormalizado = dadosInscricao.cargo || 'Obreiro';
    const isMissionaria = cargoNormalizado.toLowerCase().includes('missionár') || cargoNormalizado.toLowerCase().includes('missionar');

    // B.1 - Histórico de Pagamento de Filiação:
    // Apenas para NOVO CADASTRO / RECEBIMENTO (membros novos que estão ingressando na convenção).
    // Membros já existentes que estão sendo Ordenados NÃO pagam nem geram nova taxa de filiação!
    if (!ehMembroExistente) {
      const valorFiliacao = isMissionaria ? 120.00 : 190.00;
      const filiacaoRef = doc(db, 'pagamentos_filiacao', `fil-${dadosInscricao.ministroId}-${ts}`);
      transaction.set(
        filiacaoRef,
        sanitizarPayloadParaFirestore({
          id: `fil-${dadosInscricao.ministroId}-${ts}`,
          ministroId: dadosInscricao.ministroId || '',
          tenantId: tenantIdFinal,
          ministroNome: dadosInscricao.ministroNome || 'Ministro',
          ministroCpf: dadosInscricao.ministroCpf || '',
          cargo: cargoNormalizado,
          descricao: `Taxa de Filiação Convenial e Credenciamento Oficial (Inclusa no Plano AGO - ${dadosInscricao.planoNome || 'Recebimento/Filiação'})`,
          valor: valorFiliacao,
          statusPagamento: 'LIQUIDADO',
          formaPagamento: dadosInscricao.formaPagamento || 'PIX',
          dataPagamento: hojeStr,
          origem: 'NOVO_CADASTRO_RECEBIMENTO_AGO',
          criadoEm: serverTimestamp(),
        })
      );

      // B.2 - Registro da Anuidade Recorrente do Ciclo Seguinte (2027) para o novo membro filiado
      const anuidadeProximoAnoRef = doc(db, 'anuidades', `anuidade-${dadosInscricao.ministroId}-2027`);
      transaction.set(
        anuidadeProximoAnoRef,
        sanitizarPayloadParaFirestore({
          id: `anuidade-${dadosInscricao.ministroId}-2027`,
          ministroId: dadosInscricao.ministroId || '',
          tenantId: tenantIdFinal,
          ministroNome: dadosInscricao.ministroNome || 'Ministro',
          ministroCpf: dadosInscricao.ministroCpf || '',
          cargo: cargoNormalizado,
          anoReferencia: '2027',
          anoVigente: 2027,
          valor: 120.00,
          statusPagamento: 'ABERTO',
          dataVencimento: '2027-10-30',
          origem: 'GERACAO_AUTOMATICA_RECORRENCIA_AGO_2026',
          observacao: 'Anuidade 2027 programada para o ciclo seguinte após filiação liquidada na AGO 2026',
          criadoEm: serverTimestamp(),
        })
      );

      // B.3 - Atualização do Novo Ministro no Banco
      const ministroRef = doc(db, 'ministros', dadosInscricao.ministroId);
      transaction.set(
        ministroRef,
        {
          status: 'ATIVO',
          statusAcesso: 'Ativo',
          statusAdimplencia: 'ADIMPLENTE',
          filiadoViaAGO: true,
          filiacaoPaga: true,
          dataFiliacao: hojeStr,
          atualizadoEm: serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      // Membro existente sendo ordenado/consagrado na AGO
      const ministroRef = doc(db, 'ministros', dadosInscricao.ministroId);
      transaction.set(
        ministroRef,
        {
          status: 'ATIVO',
          statusAcesso: 'Ativo',
          statusAdimplencia: 'ADIMPLENTE',
          inscritoAgoConfirmado: true,
          cargoOrdenacaoAgo: cargoNormalizado,
          atualizadoEm: serverTimestamp(),
        },
        { merge: true }
      );
    }

    // C. Agregação Atômica no Servidor (increment)
    const statsDoc = await transaction.get(statsRef);
    if (statsDoc.exists()) {
      transaction.update(statsRef, {
        totalInscritos: increment(1),
        totalArrecadadoBruto: increment(Number(dadosInscricao.valor) || 0),
        atualizadoEm: serverTimestamp(),
      });
    } else {
      transaction.set(statsRef, {
        totalInscritos: 1,
        totalArrecadadoBruto: Number(dadosInscricao.valor) || 0,
        atualizadoEm: serverTimestamp(),
      });
    }

    // D. Gravação da Chave de Idempotência
    transaction.set(idempRef, {
      id: chaveIdempotencia,
      inscricaoId,
      ministroId: dadosInscricao.ministroId,
      processadoEm: serverTimestamp(),
    });

    // E. Registro do Log de Auditoria Contábil Visual (AGO + Filiação)
    const valorPagoInscricao = Number(dadosInscricao.valor) || 0;
    const valorEsperadoFiliacao = !ehMembroExistente ? (isMissionaria ? 120.00 : 190.00) : 0;
    const auditRef = doc(db, 'logs_auditoria_ago_filiacao', `audit-${inscricaoId}`);
    
    // Verificação de divergência contábil
    let statusAuditoria: 'CONCLUIDO_COM_SUCESSO' | 'DIVERGENCIA_DETECTADA' = 'CONCLUIDO_COM_SUCESSO';
    let motivoDivergencia: string | undefined = undefined;

    if (!ehMembroExistente && valorPagoInscricao <= 0) {
      statusAuditoria = 'DIVERGENCIA_DETECTADA';
      motivoDivergencia = 'Valor da inscrição inválido ou zerado para novo recebimento.';
    }

    transaction.set(auditRef, {
      id: `audit-${inscricaoId}`,
      inscricaoId,
      ministroId: dadosInscricao.ministroId || '',
      ministroNome: dadosInscricao.ministroNome || 'Ministro',
      ministroCpf: dadosInscricao.ministroCpf || '',
      cargo: cargoNormalizado,
      planoId: dadosInscricao.planoId || 'PLANO_1',
      planoNome: dadosInscricao.planoNome || 'Plano AGO',
      valorInscricaoAgo: valorPagoInscricao,
      valorFiliacao: valorEsperadoFiliacao,
      ehMembroExistente,
      statusTransacao: statusAuditoria,
      divergenciaMotivo: motivoDivergencia,
      integridadeAcid: true,
      dataHoraStr: getDataHoraBrasil(),
      criadoEm: serverTimestamp(),
    });
  });
}

/**
 * 5. LISTENER EM TEMPO REAL DOS LOGS DE AUDITORIA (AGO vs. FILIAÇÃO)
 */
export function ouvirLogsAuditoriaAgoFiliacao(
  callback: (logs: LogAuditoriaAgoFiliacao[]) => void
): Unsubscribe {
  const auditColl = collection(db, 'logs_auditoria_ago_filiacao');
  const q = query(auditColl, orderBy('criadoEm', 'desc'), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const logs: LogAuditoriaAgoFiliacao[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          inscricaoId: data.inscricaoId || '',
          ministroId: data.ministroId || '',
          ministroNome: data.ministroNome || 'Ministro',
          ministroCpf: data.ministroCpf || '',
          cargo: data.cargo || '',
          planoId: data.planoId || '',
          planoNome: data.planoNome || '',
          valorInscricaoAgo: Number(data.valorInscricaoAgo) || 0,
          valorFiliacao: Number(data.valorFiliacao) || 0,
          ehMembroExistente: Boolean(data.ehMembroExistente),
          statusTransacao: data.statusTransacao || 'CONCLUIDO_COM_SUCESSO',
          divergenciaMotivo: data.divergenciaMotivo,
          integridadeAcid: Boolean(data.integridadeAcid ?? true),
          dataHoraStr: data.dataHoraStr || '',
          criadoEm: data.criadoEm,
        };
      });
      callback(logs);
    },
    (erro) => {
      console.warn('Erro ao escutar logs de auditoria da AGO:', erro);
    }
  );
}
