/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Módulo de Serviços Transacionais: AGO Enrollment & Monetized Centavos Architecture
 * Isolamento ACID Bancário, Uniformidade de Chaves Monetárias (`valor`, `statusPagamento: 'PAGO'`)
 */

import {
  Firestore,
  doc,
  collection,
  runTransaction,
  serverTimestamp,
  increment,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { toCents, fromCents, getSystemDate } from '../financialEngine';
import { calcularTarifaAsaas, acumularLancamentoEmTotais, DreAgoTotaisConsolidado, criarTotaisIniciaisDreAgo, PlanoAgoKey, CargoEclesiasticoOficial } from './dreAgoService';
import { gerarHashIntegridade } from '../crypto';

export type FormaPagamentoAgo = 'PIX' | 'BOLETO' | 'CARTAO_CREDITO';

export type CargoPermitidoPlano1 = 'Pastor' | 'Evangelista' | 'Presbítero';

export const CARGOS_PERMITIDOS_PLANO_1: readonly CargoPermitidoPlano1[] = [
  'Pastor',
  'Evangelista',
  'Presbítero',
];

export const BENEFICIOS_PLANO_1_AGO: readonly string[] = [
  'Acesso completo a todas as sessões e plenárias da AGO.',
  'Kit Oficial do Congressista (Pasta, Bloco, Caneta e Crachá de Identificação).',
  'Direito a Voto nas decisões da Assembleia Geral (conforme estatuto).',
  'Certificado Digital de Participação (gerado pós-evento).',
];

export const PLANO_1_CONFIG = {
  id: 'PLANO_1_NORMAL',
  nome: 'Plano 1 - Inscrição Normal AGO',
  subtitulo: 'Plenárias + Kit Congressista Oficial + Direito a Voto Estatutário',
  valor: 190.0,
  moeda: 'BRL',
  categoriasPermitidas: CARGOS_PERMITIDOS_PLANO_1,
  beneficios: BENEFICIOS_PLANO_1_AGO,
} as const;

export interface DadosInscricaoPlano1Input {
  ministroId: string;
  ministroNome: string;
  ministroCpf: string;
  cargo: CargoPermitidoPlano1;
  fotoUrl?: string;
  email?: string;
  telefone?: string;
  formaPagamento: FormaPagamentoAgo;
  operadorId: string;
  operadorNome: string;
}

export interface InscricaoAgoDocumento {
  id: string;
  ministroId: string;
  ministroNome: string;
  ministroCpf: string;
  cargo: CargoPermitidoPlano1;
  fotoUrl?: string;
  email?: string;
  telefone?: string;
  planoId: 'PLANO_1_NORMAL' | string;
  planoNome: string;
  valor: number; // Chave simétrica em BRL para o DRE
  tarifaAsaas: number;
  status: 'CONFIRMADO' | string;
  statusPagamento: 'PAGO' | 'ABERTO'; // Lei de Simetria Monetária
  dataPagamento: string;
  formaPagamento: FormaPagamentoAgo;
  dataInscricao: string;
  beneficiosInclusos: readonly string[];
  direitoVotoHomologado: boolean;
  kitCongressistaReservado: boolean;
  chaveIdempotencia: string;
  hashIntegridade: string;
  criadoEm: any;
}

export interface EstatisticasAgoTotais {
  totalInscritos: number;
  totalArrecadadoBruto: number;
  totalVotosHomologados: number;
  totalKitsCongressista: number;
  inscritosPlano1: number;
  inscritosPorCargo: {
    Pastor: number;
    Evangelista: number;
    Presbítero: number;
  };
  atualizadoEm?: any;
}

export function validarElegibilidadePlano1(
  cargo: string
): { valido: boolean; motivo?: string } {
  if (!CARGOS_PERMITIDOS_PLANO_1.includes(cargo as CargoPermitidoPlano1)) {
    return {
      valido: false,
      motivo: `O cargo '${cargo}' não é elegível para o Plano 1. As categorias permitidas são: Pastores, Evangelistas e Presbíteros.`,
    };
  }
  return { valido: true };
}

/**
 * 1. PERSISTÊNCIA ATÔMICA DA INSCRIÇÃO COM PIPELINE DE CASCATA E ARITMÉTICA DE CENTAVOS
 * Chave estrita unificada: `[ministroId]_[anoCiclo]` dentro de `inscricoes_ago`.
 */
export async function realizarInscricaoPlano1Transacional(
  firestore: Firestore,
  dados: DadosInscricaoPlano1Input
): Promise<{ sucesso: boolean; inscricao: InscricaoAgoDocumento; mensagem: string }> {
  const validacao = validarElegibilidadePlano1(dados.cargo);
  if (!validacao.valido) {
    throw new Error(validacao.motivo);
  }

  const anoCiclo = 2026;
  const chaveIdempotencia = `${dados.ministroId}_AGO_PLANO_1_${anoCiclo}`;
  const unicosInscricaoId = `${dados.ministroId}_${anoCiclo}`;
  const hoje = getSystemDate();
  const timestamp = Date.now();
  const lancamentoId = `lago-rec-p1-${dados.ministroId}-${timestamp}`;
  const logId = `audit-p1-${timestamp}-${Math.random().toString(36).substring(2, 7)}`;

  const valorCentavos = toCents(PLANO_1_CONFIG.valor);
  const tarifaAsaasCentavos = toCents(calcularTarifaAsaas(PLANO_1_CONFIG.valor, dados.formaPagamento));
  const valorLiquidoCentavos = Math.max(0, valorCentavos - tarifaAsaasCentavos);

  const valorBrl = fromCents(valorCentavos);
  const tarifaAsaasBrl = fromCents(tarifaAsaasCentavos);

  return await runTransaction(firestore, async (transaction) => {
    const idempDocRef = doc(firestore, 'transacoes_processadas', chaveIdempotencia);
    const idempDoc = await transaction.get(idempDocRef);

    if (idempDoc.exists()) {
      throw new Error(
        'Esta inscrição já foi processada anteriormente para este ministro. Duplicação bloqueada pela chave de idempotência.'
      );
    }

    const totaisDreRef = doc(firestore, 'dre_ago_totais', 'consolidado_geral');
    const totaisDreDoc = await transaction.get(totaisDreRef);

    const statsRef = doc(firestore, 'totais_financeiros', 'ago_estatisticas');
    const statsDoc = await transaction.get(statsRef);

    const totaisDreAtuais: DreAgoTotaisConsolidado = totaisDreDoc.exists()
      ? (totaisDreDoc.data() as DreAgoTotaisConsolidado)
      : criarTotaisIniciaisDreAgo();

    const hashPayload = `${unicosInscricaoId}|${dados.ministroId}|${dados.cargo}|${valorBrl}|${chaveIdempotencia}|${hoje}`;
    const hashIntegridade = gerarHashIntegridade(hashPayload);

    const novaInscricao: InscricaoAgoDocumento = {
      id: unicosInscricaoId,
      ministroId: dados.ministroId,
      ministroNome: dados.ministroNome,
      ministroCpf: dados.ministroCpf,
      cargo: dados.cargo,
      fotoUrl: dados.fotoUrl || '',
      email: dados.email || '',
      telefone: dados.telefone || '',
      planoId: 'PLANO_1_NORMAL',
      planoNome: PLANO_1_CONFIG.nome,
      valor: valorBrl,
      tarifaAsaas: tarifaAsaasBrl,
      status: 'CONFIRMADO',
      statusPagamento: 'PAGO',
      dataPagamento: hoje,
      formaPagamento: dados.formaPagamento,
      dataInscricao: hoje,
      beneficiosInclusos: PLANO_1_CONFIG.beneficios,
      direitoVotoHomologado: true,
      kitCongressistaReservado: true,
      chaveIdempotencia,
      hashIntegridade,
      criadoEm: serverTimestamp(),
    };

    const novosTotaisDre = acumularLancamentoEmTotais(totaisDreAtuais, {
      id: lancamentoId,
      tipo: 'RECEITA',
      descricao: `Inscrição Plano 1 AGO - ${dados.cargo} ${dados.ministroNome}`,
      valor: valorBrl,
      formaPagamento: dados.formaPagamento,
      tarifaAsaas: tarifaAsaasBrl,
      valorLiquido: fromCents(valorLiquidoCentavos),
      data: hoje,
      centroCusto: 'Inscrições & Credenciamento',
      cargoEclesiastico: dados.cargo,
      plano: 'PLANO_BRONZE',
      status: 'CONFIRMADO',
      inscritoNome: dados.ministroNome,
    });

    const inscricaoRef = doc(firestore, 'inscricoes_ago', unicosInscricaoId);
    transaction.set(inscricaoRef, novaInscricao);

    const lancamentoRef = doc(firestore, 'lancamentos_ago', lancamentoId);
    transaction.set(lancamentoRef, {
      id: lancamentoId,
      tipo: 'RECEITA',
      descricao: `Inscrição Plano 1 AGO - ${dados.cargo} ${dados.ministroNome}`,
      valor: valorBrl,
      formaPagamento: dados.formaPagamento,
      tarifaAsaas: tarifaAsaasBrl,
      valorLiquido: fromCents(valorLiquidoCentavos),
      statusPagamento: 'PAGO',
      dataPagamento: hoje,
      data: hoje,
      centroCusto: 'Inscrições & Credenciamento',
      cargoEclesiastico: dados.cargo,
      plano: 'PLANO_BRONZE',
      status: 'CONFIRMADO',
      inscritoNome: dados.ministroNome,
      origemLancamento: 'INSCRICAO_PORTAL',
      criadoEm: serverTimestamp(),
    });

    transaction.set(totaisDreRef, {
      ...novosTotaisDre,
      atualizadoEm: serverTimestamp(),
    });

    // Geração Automática da Anuidade Recorrente para o Ano Seguinte (2027) a partir do término da AGO
    const anuidadeProximoAnoRef = doc(firestore, 'anuidades', `anuidade-${dados.ministroId}-2027`);
    transaction.set(
      anuidadeProximoAnoRef,
      {
        id: `anuidade-${dados.ministroId}-2027`,
        ministroId: dados.ministroId || '',
        tenantId: 't-sede-salvador',
        ministroNome: dados.ministroNome || 'Ministro',
        ministroCpf: dados.ministroCpf || '',
        cargo: dados.cargo || 'Obreiro',
        anoReferencia: '2027',
        anoVigente: 2027,
        valor: 120.00,
        statusPagamento: 'ABERTO',
        dataVencimento: '2027-10-30',
        origem: 'GERACAO_AUTOMATICA_AGO_2026',
        observacao: 'Anuidade 2027 gerada automaticamente após filiação/inscrição liquidada na AGO 2026',
        criadoEm: serverTimestamp(),
      }
    );

    if (statsDoc.exists()) {
      transaction.update(statsRef, {
        totalInscritos: increment(1),
        totalArrecadadoBruto: increment(valorBrl),
        totalVotosHomologados: increment(1),
        totalKitsCongressista: increment(1),
        inscritosPlano1: increment(1),
        [`inscritosPorCargo.${dados.cargo}`]: increment(1),
        atualizadoEm: serverTimestamp(),
      });
    } else {
      transaction.set(statsRef, {
        totalInscritos: 1,
        totalArrecadadoBruto: valorBrl,
        totalVotosHomologados: 1,
        totalKitsCongressista: 1,
        inscritosPlano1: 1,
        inscritosPorCargo: {
          Pastor: dados.cargo === 'Pastor' ? 1 : 0,
          Evangelista: dados.cargo === 'Evangelista' ? 1 : 0,
          Presbítero: dados.cargo === 'Presbítero' ? 1 : 0,
        },
        atualizadoEm: serverTimestamp(),
      });
    }

    transaction.set(idempDocRef, {
      id: chaveIdempotencia,
      ministroId: dados.ministroId,
      inscricaoId: unicosInscricaoId,
      planoId: 'PLANO_1_NORMAL',
      valor: valorBrl,
      statusPagamento: 'PAGO',
      processadoEm: serverTimestamp(),
    });

    const auditRef = doc(firestore, 'audit_logs', logId);
    transaction.set(auditRef, {
      id: logId,
      timestamp: new Date().toISOString(),
      tenantId: 'TENANT_SEDE_GERAL',
      operador: dados.operadorNome || 'Operador Convencional',
      operadorId: dados.operadorId || 'op-sistema',
      acao: 'HOMOLOGACAO_INSCRICAO_PLANO_1_AGO',
      detalhes: `Inscrição homologada para o ministro ${dados.ministroNome} (${dados.cargo}) - Valor: R$ ${valorBrl.toFixed(2)} - Chave: ${unicosInscricaoId}`,
      hashIntegridade,
      hashAnterior: 'GENESIS_AGO_2026',
    });

    return {
      sucesso: true,
      inscricao: novaInscricao,
      mensagem: `Inscrição no Plano 1 confirmada com sucesso para ${dados.cargo} ${dados.ministroNome}! Voto e Kit Congressista homologados.`,
    };
  });
}

/**
 * 2. CANCELAMENTO E EXCLUÇÃO TRANSACIONAL DE INSCRIÇÃO DA AGO
 */
export async function deletarInscricaoAgoTransacional(
  firestore: Firestore,
  inscricaoId: string,
  justificativa: string,
  operadorNome: string,
  operadorId: string,
  outrosDocsDeletar?: { readonly lancamentosIds: readonly string[]; readonly anuidadesIds: readonly string[] }
): Promise<{ readonly sucesso: boolean; readonly mensagem: string }> {
  const logId = `audit-del-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  return await runTransaction(firestore, async (transaction) => {
    const inscRef = doc(firestore, 'inscricoes_ago', inscricaoId);
    const inscSnap = await transaction.get(inscRef);

    if (!inscSnap.exists()) {
      throw new Error('Inscrição não encontrada no banco de dados.');
    }

    const dados = inscSnap.data() as InscricaoAgoDocumento;
    const ministroId = dados.ministroId || '';
    const ministroNome = dados.ministroNome || 'Não informado';
    const valor = Number(dados.valor) || 0;
    const tarifaAsaas = Number(dados.tarifaAsaas) || 0;
    const cargo = dados.cargo || 'Obreiro';
    const planoId = dados.planoId || 'PLANO_1_NORMAL';

    transaction.delete(inscRef);

    if (outrosDocsDeletar) {
      if (outrosDocsDeletar.lancamentosIds) {
        outrosDocsDeletar.lancamentosIds.forEach((lId) => {
          transaction.delete(doc(firestore, 'lancamentos_ago', lId));
        });
      }
      if (outrosDocsDeletar.anuidadesIds) {
        outrosDocsDeletar.anuidadesIds.forEach((aId) => {
          transaction.delete(doc(firestore, 'anuidades', aId));
        });
      }
    }

    const statsRef = doc(firestore, 'totais_financeiros', 'ago_estatisticas');
    const statsDoc = await transaction.get(statsRef);
    if (statsDoc.exists()) {
      transaction.update(statsRef, {
        totalInscritos: increment(-1),
        totalArrecadadoBruto: increment(-valor),
        totalVotosHomologados: increment(-1),
        totalKitsCongressista: increment(-1),
        inscritosPlano1: increment(-1),
        [`inscritosPorCargo.${cargo}`]: increment(-1),
        atualizadoEm: serverTimestamp(),
      });
    }

    const chaveIdemp1 = `${ministroId}_AGO_PLANO_1_2026`;
    const chaveIdemp2 = `${ministroId}_AGO_${planoId}`;
    transaction.delete(doc(firestore, 'transacoes_processadas', chaveIdemp1));
    transaction.delete(doc(firestore, 'transacoes_processadas', chaveIdemp2));

    const auditRef = doc(firestore, 'audit_logs', logId);
    transaction.set(auditRef, {
      id: logId,
      timestamp: new Date().toISOString(),
      tenantId: 'TENANT_SEDE_GERAL',
      operador: operadorNome || 'Administrador',
      operadorId: operadorId || 'op-sistema',
      acao: 'EXCLUSAO_INSCRICAO_AGO',
      detalhes: `Exclusão definitiva da inscrição ${inscricaoId} do ministro ${ministroNome} (${cargo}). Valor estornado: R$ ${valor.toFixed(2)}. Justificativa: ${justificativa}`,
      criadoEm: serverTimestamp(),
    });

    return {
      sucesso: true,
      mensagem: `Inscrição de ${ministroNome} foi estornada e removida com sucesso.`,
    };
  });
}

export function ouvirInscricoesAgo(
  firestore: Firestore,
  aoAtualizar: (inscricoes: InscricaoAgoDocumento[]) => void,
  aoErro?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(firestore, 'inscricoes_ago');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      })) as InscricaoAgoDocumento[];
      aoAtualizar(items);
    },
    (err) => {
      const isQuotaErr = err?.message?.includes('Quota') || err?.message?.includes('quota') || (err as any)?.code === 'resource-exhausted';
      if (isQuotaErr) {
        aoAtualizar([]);
      } else {
        console.error('Erro no listener de inscrições AGO:', err);
      }
      if (aoErro) aoErro(err);
    }
  );
}

export function ouvirEstatisticasAgo(
  firestore: Firestore,
  aoAtualizar: (stats: EstatisticasAgoTotais) => void,
  aoErro?: (err: Error) => void
): Unsubscribe {
  const statsRef = doc(firestore, 'totais_financeiros', 'ago_estatisticas');
  return onSnapshot(
    statsRef,
    (snapshot) => {
      if (snapshot.exists()) {
        aoAtualizar(snapshot.data() as EstatisticasAgoTotais);
      } else {
        aoAtualizar({
          totalInscritos: 0,
          totalArrecadadoBruto: 0,
          totalVotosHomologados: 0,
          totalKitsCongressista: 0,
          inscritosPlano1: 0,
          inscritosPorCargo: { Pastor: 0, Evangelista: 0, Presbítero: 0 },
        });
      }
    },
    (err) => {
      const isQuotaErr = err?.message?.includes('Quota') || err?.message?.includes('quota') || (err as any)?.code === 'resource-exhausted';
      if (isQuotaErr) {
        aoAtualizar({
          totalInscritos: 0,
          totalArrecadadoBruto: 0,
          totalVotosHomologados: 0,
          totalKitsCongressista: 0,
          inscritosPlano1: 0,
          inscritosPorCargo: { Pastor: 0, Evangelista: 0, Presbítero: 0 },
        });
      } else {
        console.error('Erro no listener de estatísticas da AGO:', err);
      }
      if (aoErro) aoErro(err);
    }
  );
}
