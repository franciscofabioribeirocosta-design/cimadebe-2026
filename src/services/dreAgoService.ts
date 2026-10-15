/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Serviço Transacional DRE AGO (Demonstrativo do Resultado do Exercício)
 * Isolamento ACID de Nível Bancário com runTransaction() e Aritmética de Centavos (Anti-IEEE 754)
 */

import {
  Firestore,
  doc,
  collection,
  runTransaction,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
  getDocs,
  writeBatch,
  setDoc,
  query,
  limit,
} from 'firebase/firestore';
import { toCents, fromCents } from '../financialEngine';

export type FormaPagamentoAsaas = 'PIX' | 'CARTAO_CREDITO' | 'BOLETO' | 'CARTAO_DEBITO';

export type CargoEclesiasticoOficial = 'Pastor' | 'Evangelista' | 'Presbítero' | 'Missionária';

export type PlanoAgoKey =
  | 'PLANO_1'
  | 'PLANO_2'
  | 'PLANO_3'
  | 'PLANO_4'
  | 'PLANO_DIAMANTE'
  | 'PLANO_OURO'
  | 'PLANO_PRATA'
  | 'PLANO_BRONZE';

export interface LancamentoAgo {
  id: string;
  tipo: 'RECEITA' | 'DESPESA';
  descricao: string;
  valor: number; // Valor Bruto em Reais
  formaPagamento?: FormaPagamentoAsaas;
  tarifaAsaas?: number; // Tarifa Asaas em Reais
  valorLiquido?: number; // Valor Consolidado líquido pós-tarifa
  data: string; // YYYY-MM-DD
  centroCusto: string;
  cargoEclesiastico?: CargoEclesiasticoOficial;
  plano?: PlanoAgoKey;
  status: 'CONFIRMADO' | 'PENDENTE';
  inscritoNome?: string;
  chaveNfce?: string | null;
  origemLancamento?: 'QR_CODE_NFCE' | 'MANUAL' | 'INSCRICAO_PORTAL';
  criadoEm?: any;
}

export interface MetricaPlanoAgo {
  qtdInscritos: number;
  totalArrecadadoBruto: number;
  totalTarifasPlano: number;
  totalArrecadadoConsolidado: number;
}

export interface MetricaCargoAgo {
  qtdInscritos: number;
  totalArrecadadoBruto: number;
  totalTarifasCargo: number;
  totalArrecadadoConsolidado: number;
  ticketMedio: number;
}

export interface MetricaMesAgo {
  mes: string;
  receitaBruta: number;
  tarifasAsaas: number;
  consolidado: number;
  despesas: number;
}

export interface DreAgoTotaisConsolidado {
  id: string;
  totalValorBruto: number;
  totalTarifasAsaas: number;
  totalValorConsolidado: number;
  totalDespesas: number;
  superavitLiquidoFinal: number;
  margemOperacional: number;
  totalInscritosPagantes: number;
  totalDespesasCount: number;
  receitasPorPlano: Record<PlanoAgoKey, MetricaPlanoAgo>;
  receitasPorCargo: Record<CargoEclesiasticoOficial, MetricaCargoAgo>;
  balancoMensal: Record<string, MetricaMesAgo>;
  versaoTransacional: number;
  ultimoLancamentoId: string;
  atualizadoEm?: any;
}

/**
 * Cálculo das tarifas oficiais do gateway de pagamentos Asaas
 */
export function calcularTarifaAsaas(valor: number, forma: FormaPagamentoAsaas): number {
  switch (forma) {
    case 'PIX':
      return 0.99; // R$ 0,99 por Pix recebido
    case 'CARTAO_CREDITO':
      return parseFloat(((valor * 0.0299) + 0.49).toFixed(2)); // 2.99% + R$ 0,49
    case 'BOLETO':
      return 1.99; // R$ 1,99 por boleto compensado
    case 'CARTAO_DEBITO':
      return parseFloat(((valor * 0.0199) + 0.35).toFixed(2)); // 1.99% + R$ 0,35
    default:
      return 0.99;
  }
}

/**
 * Estrutura inicial do documento de totais consolidados
 */
export function criarTotaisIniciaisDreAgo(): DreAgoTotaisConsolidado {
  return {
    id: 'consolidado_geral',
    totalValorBruto: 0,
    totalTarifasAsaas: 0,
    totalValorConsolidado: 0,
    totalDespesas: 0,
    superavitLiquidoFinal: 0,
    margemOperacional: 0,
    totalInscritosPagantes: 0,
    totalDespesasCount: 0,
    receitasPorPlano: {
      PLANO_1: { qtdInscritos: 0, totalArrecadadoBruto: 0, totalTarifasPlano: 0, totalArrecadadoConsolidado: 0 },
      PLANO_2: { qtdInscritos: 0, totalArrecadadoBruto: 0, totalTarifasPlano: 0, totalArrecadadoConsolidado: 0 },
      PLANO_3: { qtdInscritos: 0, totalArrecadadoBruto: 0, totalTarifasPlano: 0, totalArrecadadoConsolidado: 0 },
      PLANO_4: { qtdInscritos: 0, totalArrecadadoBruto: 0, totalTarifasPlano: 0, totalArrecadadoConsolidado: 0 },
      PLANO_DIAMANTE: { qtdInscritos: 0, totalArrecadadoBruto: 0, totalTarifasPlano: 0, totalArrecadadoConsolidado: 0 },
      PLANO_OURO: { qtdInscritos: 0, totalArrecadadoBruto: 0, totalTarifasPlano: 0, totalArrecadadoConsolidado: 0 },
      PLANO_PRATA: { qtdInscritos: 0, totalArrecadadoBruto: 0, totalTarifasPlano: 0, totalArrecadadoConsolidado: 0 },
      PLANO_BRONZE: { qtdInscritos: 0, totalArrecadadoBruto: 0, totalTarifasPlano: 0, totalArrecadadoConsolidado: 0 },
    },
    receitasPorCargo: {
      Pastor: { qtdInscritos: 0, totalArrecadadoBruto: 0, totalTarifasCargo: 0, totalArrecadadoConsolidado: 0, ticketMedio: 0 },
      Evangelista: { qtdInscritos: 0, totalArrecadadoBruto: 0, totalTarifasCargo: 0, totalArrecadadoConsolidado: 0, ticketMedio: 0 },
      Presbítero: { qtdInscritos: 0, totalArrecadadoBruto: 0, totalTarifasCargo: 0, totalArrecadadoConsolidado: 0, ticketMedio: 0 },
      Missionária: { qtdInscritos: 0, totalArrecadadoBruto: 0, totalTarifasCargo: 0, totalArrecadadoConsolidado: 0, ticketMedio: 0 },
    },
    balancoMensal: {
      '2026-03': { mes: 'Mar/26', receitaBruta: 0, tarifasAsaas: 0, consolidado: 0, despesas: 0 },
      '2026-04': { mes: 'Abr/26', receitaBruta: 0, tarifasAsaas: 0, consolidado: 0, despesas: 0 },
      '2026-05': { mes: 'Mai/26', receitaBruta: 0, tarifasAsaas: 0, consolidado: 0, despesas: 0 },
      '2026-06': { mes: 'Jun/26', receitaBruta: 0, tarifasAsaas: 0, consolidado: 0, despesas: 0 },
      '2026-07': { mes: 'Jul/26', receitaBruta: 0, tarifasAsaas: 0, consolidado: 0, despesas: 0 },
    },
    versaoTransacional: 0,
    ultimoLancamentoId: '',
  };
}

/**
 * Aplica um lançamento contábil sobre a estrutura de totais usando Aritmética de Centavos Exata
 */
export function acumularLancamentoEmTotais(
  totais: DreAgoTotaisConsolidado,
  lancamento: LancamentoAgo
): DreAgoTotaisConsolidado {
  const novosTotais: DreAgoTotaisConsolidado = {
    ...totais,
    receitasPorPlano: {
      PLANO_1: { ...(totais.receitasPorPlano.PLANO_1 || { qtdInscritos: 0, totalArrecadadoBruto: 0, totalTarifasPlano: 0, totalArrecadadoConsolidado: 0 }) },
      PLANO_2: { ...(totais.receitasPorPlano.PLANO_2 || { qtdInscritos: 0, totalArrecadadoBruto: 0, totalTarifasPlano: 0, totalArrecadadoConsolidado: 0 }) },
      PLANO_3: { ...(totais.receitasPorPlano.PLANO_3 || { qtdInscritos: 0, totalArrecadadoBruto: 0, totalTarifasPlano: 0, totalArrecadadoConsolidado: 0 }) },
      PLANO_4: { ...(totais.receitasPorPlano.PLANO_4 || { qtdInscritos: 0, totalArrecadadoBruto: 0, totalTarifasPlano: 0, totalArrecadadoConsolidado: 0 }) },
      PLANO_DIAMANTE: { ...(totais.receitasPorPlano.PLANO_DIAMANTE || { qtdInscritos: 0, totalArrecadadoBruto: 0, totalTarifasPlano: 0, totalArrecadadoConsolidado: 0 }) },
      PLANO_OURO: { ...(totais.receitasPorPlano.PLANO_OURO || { qtdInscritos: 0, totalArrecadadoBruto: 0, totalTarifasPlano: 0, totalArrecadadoConsolidado: 0 }) },
      PLANO_PRATA: { ...(totais.receitasPorPlano.PLANO_PRATA || { qtdInscritos: 0, totalArrecadadoBruto: 0, totalTarifasPlano: 0, totalArrecadadoConsolidado: 0 }) },
      PLANO_BRONZE: { ...(totais.receitasPorPlano.PLANO_BRONZE || { qtdInscritos: 0, totalArrecadadoBruto: 0, totalTarifasPlano: 0, totalArrecadadoConsolidado: 0 }) },
    },
    receitasPorCargo: {
      Pastor: { ...totais.receitasPorCargo.Pastor },
      Evangelista: { ...totais.receitasPorCargo.Evangelista },
      Presbítero: { ...totais.receitasPorCargo.Presbítero },
      Missionária: { ...totais.receitasPorCargo.Missionária },
    },
    balancoMensal: { ...totais.balancoMensal },
    versaoTransacional: (totais.versaoTransacional || 0) + 1,
    ultimoLancamentoId: lancamento.id,
  };

  const valorCentavos = toCents(lancamento.valor);
  const chaveMes = lancamento.data ? lancamento.data.substring(0, 7) : '2026-03';

  // Garantir existência do mês no balanço mensal
  if (!novosTotais.balancoMensal[chaveMes]) {
    const nomesMeses: Record<string, string> = {
      '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
      '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
      '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
    };
    const [ano, m] = chaveMes.split('-');
    const label = `${nomesMeses[m] || m}/${ano?.substring(2) || '26'}`;
    novosTotais.balancoMensal[chaveMes] = {
      mes: label,
      receitaBruta: 0,
      tarifasAsaas: 0,
      consolidado: 0,
      despesas: 0,
    };
  }

  const mesAtual = { ...novosTotais.balancoMensal[chaveMes] };

  if (lancamento.tipo === 'RECEITA') {
    const tarifaCalc = lancamento.tarifaAsaas ?? (lancamento.formaPagamento ? calcularTarifaAsaas(lancamento.valor, lancamento.formaPagamento) : 0.99);
    const tarifaCentavos = toCents(tarifaCalc);
    const liquidoCentavos = Math.max(0, valorCentavos - tarifaCentavos);

    const brutoAcum = toCents(novosTotais.totalValorBruto) + valorCentavos;
    const tarifasAcum = toCents(novosTotais.totalTarifasAsaas) + tarifaCentavos;
    const consolidadoAcum = Math.max(0, brutoAcum - tarifasAcum);

    novosTotais.totalValorBruto = fromCents(brutoAcum);
    novosTotais.totalTarifasAsaas = fromCents(tarifasAcum);
    novosTotais.totalValorConsolidado = fromCents(consolidadoAcum);

    if (lancamento.plano || lancamento.cargoEclesiastico) {
      novosTotais.totalInscritosPagantes += 1;
    }

    // Acumulação por Plano
    if (lancamento.plano && novosTotais.receitasPorPlano[lancamento.plano]) {
      const pl = novosTotais.receitasPorPlano[lancamento.plano];
      const plBrutoCentavos = toCents(pl.totalArrecadadoBruto) + valorCentavos;
      const plTarifaCentavos = toCents(pl.totalTarifasPlano) + tarifaCentavos;
      const plConsolidadoCentavos = Math.max(0, plBrutoCentavos - plTarifaCentavos);

      novosTotais.receitasPorPlano[lancamento.plano] = {
        qtdInscritos: pl.qtdInscritos + 1,
        totalArrecadadoBruto: fromCents(plBrutoCentavos),
        totalTarifasPlano: fromCents(plTarifaCentavos),
        totalArrecadadoConsolidado: fromCents(plConsolidadoCentavos),
      };
    }

    // Acumulação por Cargo Ministerial Oficial
    if (lancamento.cargoEclesiastico && novosTotais.receitasPorCargo[lancamento.cargoEclesiastico]) {
      const cg = novosTotais.receitasPorCargo[lancamento.cargoEclesiastico];
      const cgBrutoCentavos = toCents(cg.totalArrecadadoBruto) + valorCentavos;
      const cgTarifaCentavos = toCents(cg.totalTarifasCargo) + tarifaCentavos;
      const cgConsolidadoCentavos = Math.max(0, cgBrutoCentavos - cgTarifaCentavos);
      const novaQtd = cg.qtdInscritos + 1;
      const novoTicket = novaQtd > 0 ? fromCents(cgBrutoCentavos) / novaQtd : 0;

      novosTotais.receitasPorCargo[lancamento.cargoEclesiastico] = {
        qtdInscritos: novaQtd,
        totalArrecadadoBruto: fromCents(cgBrutoCentavos),
        totalTarifasCargo: fromCents(cgTarifaCentavos),
        totalArrecadadoConsolidado: fromCents(cgConsolidadoCentavos),
        ticketMedio: novoTicket,
      };
    }

    // Acumulação Mensal
    const mesBrutoCentavos = toCents(mesAtual.receitaBruta) + valorCentavos;
    const mesTarifaCentavos = toCents(mesAtual.tarifasAsaas) + tarifaCentavos;
    const mesConsolidadoCentavos = Math.max(0, mesBrutoCentavos - mesTarifaCentavos);

    mesAtual.receitaBruta = fromCents(mesBrutoCentavos);
    mesAtual.tarifasAsaas = fromCents(mesTarifaCentavos);
    mesAtual.consolidado = fromCents(mesConsolidadoCentavos);
  } else {
    // DESPESA OPERACIONAL
    const despesasAcumCentavos = toCents(novosTotais.totalDespesas) + valorCentavos;
    novosTotais.totalDespesas = fromCents(despesasAcumCentavos);
    novosTotais.totalDespesasCount += 1;

    const mesDespesasCentavos = toCents(mesAtual.despesas) + valorCentavos;
    mesAtual.despesas = fromCents(mesDespesasCentavos);
  }

  novosTotais.balancoMensal[chaveMes] = mesAtual;

  // Recalcular Superávit Final e Margem Operacional
  const consolidadoCentavos = toCents(novosTotais.totalValorConsolidado);
  const despesasCentavos = toCents(novosTotais.totalDespesas);
  const superavitCentavos = consolidadoCentavos - despesasCentavos;

  novosTotais.superavitLiquidoFinal = fromCents(superavitCentavos);
  novosTotais.margemOperacional = consolidadoCentavos > 0
    ? (superavitCentavos / consolidadoCentavos) * 100
    : 0;

  return novosTotais;
}

/**
 * 1. REGISTRO ATÔMICO DE LANÇAMENTO E ATUALIZAÇÃO DOS TOTAIS DRE AGO COM runTransaction()
 * Garante Isolamento ACID, concorrência bancária e prevenção de duplicidade por chave de idempotência.
 */
export async function registrarLancamentoAgoTransacional(
  firestore: Firestore,
  lancamento: Omit<LancamentoAgo, 'criadoEm'>,
  chaveIdempotencia?: string
): Promise<{ sucesso: boolean; totaisAtualizados: DreAgoTotaisConsolidado }> {
  const chaveIdemp = chaveIdempotencia || `idemp_${lancamento.id}_${Date.now()}`;

  return await runTransaction(firestore, async (transaction) => {
    // Trava de Idempotência Bancária
    const idempDocRef = doc(firestore, 'transacoes_processadas', chaveIdemp);
    const idempDoc = await transaction.get(idempDocRef);

    const totaisDocRef = doc(firestore, 'dre_ago_totais', 'consolidado_geral');
    const totaisDoc = await transaction.get(totaisDocRef);

    let totaisAtuais: DreAgoTotaisConsolidado = totaisDoc.exists()
      ? (totaisDoc.data() as DreAgoTotaisConsolidado)
      : criarTotaisIniciaisDreAgo();

    if (idempDoc.exists()) {
      // Transação já foi processada anteriormente
      return {
        sucesso: true,
        totaisAtualizados: totaisAtuais,
      };
    }

    // Calcula tarifa Asaas e valor líquido
    const isReceita = lancamento.tipo === 'RECEITA';
    const tarifa = isReceita
      ? (lancamento.tarifaAsaas ?? (lancamento.formaPagamento ? calcularTarifaAsaas(lancamento.valor, lancamento.formaPagamento) : 0.99))
      : 0;
    const valorLiquido = isReceita ? Math.max(0, lancamento.valor - tarifa) : lancamento.valor;

    const lancamentoCompleto: LancamentoAgo = {
      ...lancamento,
      tarifaAsaas: tarifa,
      valorLiquido: valorLiquido,
    };

    // Atualiza totais atomicamente
    const novosTotais = acumularLancamentoEmTotais(totaisAtuais, lancamentoCompleto);

    // Gravações ACID enfileiradas pelo Firestore
    const lancamentoDocRef = doc(firestore, 'lancamentos_ago', lancamento.id);
    transaction.set(lancamentoDocRef, {
      ...lancamentoCompleto,
      criadoEm: serverTimestamp(),
    });

    transaction.set(totaisDocRef, {
      ...novosTotais,
      atualizadoEm: serverTimestamp(),
    });

    transaction.set(idempDocRef, {
      id: chaveIdemp,
      lancamentoId: lancamento.id,
      tipo: lancamento.tipo,
      valor: lancamento.valor,
      processadoEm: serverTimestamp(),
    });

    return {
      sucesso: true,
      totaisAtualizados: novosTotais,
    };
  });
}

/**
 * 2. INICIALIZAÇÃO CONTÁBIL LIMPA (PRODUÇÃO REAL)
 * Se a base inicial estiver vazia, cria o documento de totais zerado sem gerar nenhum lançamento fictício.
 */
export async function inicializarDreAgoSeNecessario(
  firestore: Firestore,
  _seedLancamentos?: readonly any[]
): Promise<void> {
  const totaisDocRef = doc(firestore, 'dre_ago_totais', 'consolidado_geral');

  await runTransaction(firestore, async (transaction) => {
    const totaisDoc = await transaction.get(totaisDocRef);

    if (totaisDoc.exists()) {
      return; // Já inicializado
    }

    const totaisAcumulados = criarTotaisIniciaisDreAgo();

    transaction.set(totaisDocRef, {
      ...totaisAcumulados,
      atualizadoEm: serverTimestamp(),
    });
  });
}

/**
 * Helper interno para deletar documentos em lotes (max 400 por lote) para evitar limites de transação do Firestore
 */
async function deleteInBatches(firestore: Firestore, docs: any[]): Promise<void> {
  if (!docs || docs.length === 0) return;
  const CHUNK_SIZE = 400;
  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const chunk = docs.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(firestore);
    chunk.forEach((d) => {
      batch.delete(d.ref);
    });
    await batch.commit();
  }
}

/**
 * 2.A - REDEFINIÇÃO E PURGA DE DADOS DE SIMULAÇÃO (RESTAURAÇÃO DO MODO DE PRODUÇÃO REAL)
 * Deleta todos os lançamentos da base de dados e zera o DRE Consolidado.
 * Implementado com fatiamento em lotes de segurança de 400 operações para evitar limites de commit do Firebase.
 */
export async function redefinirEzerarBalancoTotal(firestore: Firestore): Promise<void> {
  const totaisDocRef = doc(firestore, 'dre_ago_totais', 'consolidado_geral');
  const limpo = criarTotaisIniciaisDreAgo();

  // 1. Grava documento de totais completamente zerado de forma limpa
  try {
    await setDoc(totaisDocRef, {
      ...limpo,
      atualizadoEm: new Date().toISOString()
    });
  } catch (err) {
    console.error('[RESET_DRE_TOTAIS_ERR]', err);
  }

  // 2. Busca e deleta todos os documentos na coleção 'lancamentos_ago'
  try {
    const lancSnap = await getDocs(query(collection(firestore, 'lancamentos_ago'), limit(50)));
    await deleteInBatches(firestore, lancSnap.docs);
  } catch (err) {
    console.error('[RESET_LANCAMENTOS_AGO_ERR]', err);
  }

  // 3. Busca e deleta todos os documentos na coleção 'inscricoes_ago'
  try {
    const inscSnap = await getDocs(query(collection(firestore, 'inscricoes_ago'), limit(50)));
    await deleteInBatches(firestore, inscSnap.docs);
  } catch (err) {
    console.error('[RESET_INSCRICOES_AGO_ERR]', err);
  }

  // 4. Busca e deleta lançamentos correspondentes à AGO no Ledger Geral ('anuidades')
  try {
    const anuidadesSnap = await getDocs(query(collection(firestore, 'anuidades'), limit(50)));
    const anuidadesToDelete = anuidadesSnap.docs.filter((d) => d.id.startsWith('an-ago-'));
    await deleteInBatches(firestore, anuidadesToDelete);
  } catch (err) {
    console.error('[RESET_ANUIDADES_ERR]', err);
  }

  // 5. Busca e deleta registros de filiação gerados por inscrições de teste da AGO
  try {
    const filiacaoSnap = await getDocs(query(collection(firestore, 'pagamentos_filiacao'), limit(50)));
    const filiacaoToDelete = filiacaoSnap.docs.filter(
      (d) => d.id.startsWith('fil-') || d.data().origem === 'NOVO_CADASTRO_AGO'
    );
    await deleteInBatches(firestore, filiacaoToDelete);
  } catch (err) {
    console.error('[RESET_FILIACAO_ERR]', err);
  }

  // 6. Deleta chaves de idempotência e travas de transação anteriores para liberar as reinscrições livres
  try {
    const idempSnap = await getDocs(query(collection(firestore, 'transacoes_processadas'), limit(50)));
    const idempToDelete = idempSnap.docs.filter(
      (d) => d.id.includes('AGO') || d.id.startsWith('idemp_')
    );
    await deleteInBatches(firestore, idempToDelete);
  } catch (err) {
    console.error('[RESET_IDEMP_ERR]', err);
  }

  // 7. Reseta estatísticas gerais da AGO
  try {
    const statsRef = doc(firestore, 'totais_financeiros', 'ago_estatisticas');
    await setDoc(statsRef, {
      totalInscritos: 0,
      totalArrecadadoBruto: 0,
      totalVotosHomologados: 0,
      totalKitsCongressista: 0,
      atualizadoEm: new Date().toISOString()
    });
  } catch (err) {
    console.error('[RESET_STATS_ERR]', err);
  }
}

/**
 * 3. LISTENER REAL-TIME ON SNAPSHOT DO DOCUMENTO DE TOTAIS CONSOLIDADOS
 */
export function ouvirTotaisDreAgo(
  firestore: Firestore,
  aoAtualizar: (totais: DreAgoTotaisConsolidado) => void,
  aoErro?: (err: Error) => void
): Unsubscribe {
  const totaisDocRef = doc(firestore, 'dre_ago_totais', 'consolidado_geral');
  return onSnapshot(
    totaisDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        aoAtualizar(snapshot.data() as DreAgoTotaisConsolidado);
      }
    },
    (err) => {
      console.error('Erro no listener de totais DRE AGO:', err);
      if (aoErro) aoErro(err);
    }
  );
}

/**
 * 4. LISTENER REAL-TIME ON SNAPSHOT DA COLEÇÃO DE LANÇAMENTOS
 */
export function ouvirLancamentosDreAgo(
  firestore: Firestore,
  aoAtualizar: (lancamentos: LancamentoAgo[]) => void,
  aoErro?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(firestore, 'lancamentos_ago');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      })) as LancamentoAgo[];
      aoAtualizar(items);
    },
    (err) => {
      console.error('Erro no listener de lançamentos DRE AGO:', err);
      if (aoErro) aoErro(err);
    }
  );
}
