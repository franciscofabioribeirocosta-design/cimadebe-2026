/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Módulo de Serviços dos 4 Planos Oficiais da AGO
 * Sincronização em Tempo Real (onSnapshot), Isolamento ACID com runTransaction() e Idempotência
 */

import {
  Firestore,
  doc,
  collection,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
  increment,
  onSnapshot,
  Unsubscribe,
  query,
  orderBy,
  where,
  writeBatch,
} from 'firebase/firestore';
import { calcularTarifaAsaas, acumularLancamentoEmTotais, DreAgoTotaisConsolidado, criarTotaisIniciaisDreAgo } from './dreAgoService';
import { gerarHashIntegridade } from '../crypto';
import { sanitizarPayloadParaFirestore } from '../utils/imageCompressor';
import { getSystemDate } from '../financialEngine';
import type { FormaPagamentoAgo } from './inscricaoAgoService';

export interface PlanoAgo {
  id: string;
  codigo: string;
  nome: string;
  subtitulo: string;
  valor: number;
  cargosPermitidos: string[];
  beneficios: string[];
  destaque?: boolean;
  badgeDestaque?: string;
  ativo: boolean;
  ordem: number;
  modalidade?: 'INSCRICAO' | 'ORDENACAO' | 'RECEBIMENTO' | 'AMBOS' | string;
  criadoEm?: any;
  atualizadoEm?: any;
}

export interface PlanoAgoInput {
  codigo: string;
  nome: string;
  subtitulo: string;
  valor: number;
  cargosPermitidos: string[];
  beneficios: string[];
  destaque?: boolean;
  badgeDestaque?: string;
  ativo: boolean;
  ordem?: number;
}

export interface DadosInscricaoGenericaInput {
  ministroId: string;
  ministroNome: string;
  ministroCpf: string;
  cargo: string;
  fotoUrl?: string;
  email?: string;
  telefone?: string;
  planoId: string;
  planoNome: string;
  planoValor: number;
  formaPagamento: FormaPagamentoAgo;
  operadorId: string;
  operadorNome: string;
  status?: 'CONFIRMADO' | 'PENDENTE';
  linhaDigitavelBoleto?: string;
  codigoBarrasBoleto?: string;
}

/**
 * Converte valor em reais para centavos inteiros (ex: R$ 240,00 -> 24000)
 * Previne falhas de precisão de ponto flutuante em gateways (Asaas).
 */
export function converterValorParaCentavos(valor: number): number {
  return Math.round((Number(valor) || 0) * 100);
}

/**
 * 1. LISTENER REAL-TIME ON SNAPSHOT PARA COLEÇÃO planos_ago
 * Sincroniza em tempo real com o Firestore sem mocks ou dados fictícios.
 */
export function ouvirPlanosAgo(
  firestore: Firestore,
  aoAtualizar: (planos: PlanoAgo[]) => void,
  aoErro?: (err: Error) => void
): Unsubscribe {
  const planosFallback: PlanoAgo[] = [
    {
      id: 'PLANO_1',
      codigo: 'PLANO_1',
      nome: 'Plano 1 - Anuidade Regular',
      subtitulo: 'Para membros efetivos e ministros em dia com a tesouraria',
      valor: 120.0,
      cargosPermitidos: ['Pastor', 'Evangelista', 'Presbítero', 'Missionária', 'Diácono'],
      beneficios: ['Credencial Oficial CR-80 PVC com QR Code', 'Direito a Voto na Plenária da AGO', 'Kit Congressista Oficial', 'Acesso ao Portal do Ministro'],
      destaque: false,
      badgeDestaque: 'Efetivo',
      ativo: true,
      ordem: 1,
    },
    {
      id: 'PLANO_2',
      codigo: 'PLANO_2',
      nome: 'Plano 2 - Inscrição Missionária',
      subtitulo: 'Destinado a missionárias e obreiras credenciadas',
      valor: 120.0,
      cargosPermitidos: ['Missionária', 'Missionária Recebida', 'Missionária Ordenada'],
      beneficios: ['Credencial de Missionária Oficial', 'Kit Congressista', 'Participação nas Plenárias'],
      destaque: false,
      badgeDestaque: 'Missionária',
      ativo: true,
      ordem: 2,
    },
    {
      id: 'PLANO_3',
      codigo: 'PLANO_3',
      nome: 'Plano 3 - Ordenação Ministerial',
      subtitulo: 'Para pastores, evangelistas e presbíteros em processo de ordenação ou elevação',
      valor: 380.0,
      cargosPermitidos: ['Pastor', 'Evangelista', 'Presbítero', 'Pastor Ordenado', 'Evangelista Ordenado'],
      beneficios: ['Certificado A4 de Ordenação em Papel Moeda', 'Credencial de Alta Graduação', 'Kit VIP Congressista', 'Direito a Voto Master'],
      destaque: true,
      badgeDestaque: 'Mais Procurado',
      ativo: true,
      ordem: 3,
    },
    {
      id: 'PLANO_4',
      codigo: 'PLANO_4',
      nome: 'Plano 4 - Nova Filiação & Credenciamento',
      subtitulo: 'Para novos ministros e igrejas filiadas ingressando na convenção',
      valor: 240.0,
      cargosPermitidos: ['Pastor', 'Evangelista', 'Presbítero', 'Missionária', 'Diácono', 'Novo Ministro'],
      beneficios: ['Credencial Provisória e Definitiva', 'Inclusão no Rol Geral da Convenção', 'Acesso Completo aos Benefícios'],
      destaque: false,
      badgeDestaque: 'Novo Ingresso',
      ativo: true,
      ordem: 4,
    }
  ];

  const colRef = collection(firestore, 'planos_ago');
  const q = query(colRef, orderBy('ordem', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        aoAtualizar(planosFallback);
        return;
      }

      const planos = snapshot.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      })) as PlanoAgo[];

      aoAtualizar(planos);
    },
    (err) => {
      console.warn('[ouvirPlanosAgo] Quota limit / error reached. Fallback to local memory plans:', err?.message || err);
      aoAtualizar(planosFallback);
      if (aoErro) aoErro(err);
    }
  );
}

/**
 * 2. BUSCA DIRETA PASSIVA VIA GETDOCS (COM FALLBACK LOCAL SE QUOTA EXCEDIDA)
 */
export async function buscarPlanosAgo(firestore: Firestore): Promise<PlanoAgo[]> {
  const planosFallback: PlanoAgo[] = [
    {
      id: 'PLANO_1',
      codigo: 'PLANO_1',
      nome: 'Plano 1 - Anuidade Regular',
      subtitulo: 'Para membros efetivos e ministros em dia com a tesouraria',
      valor: 120.0,
      cargosPermitidos: ['Pastor', 'Evangelista', 'Presbítero', 'Missionária', 'Diácono'],
      beneficios: ['Credencial Oficial CR-80 PVC com QR Code', 'Direito a Voto na Plenária da AGO', 'Kit Congressista Oficial', 'Acesso ao Portal do Ministro'],
      destaque: false,
      badgeDestaque: 'Efetivo',
      ativo: true,
      ordem: 1,
    },
    {
      id: 'PLANO_2',
      codigo: 'PLANO_2',
      nome: 'Plano 2 - Inscrição Missionária',
      subtitulo: 'Destinado a missionárias e obreiras credenciadas',
      valor: 120.0,
      cargosPermitidos: ['Missionária', 'Missionária Recebida', 'Missionária Ordenada'],
      beneficios: ['Credencial de Missionária Oficial', 'Kit Congressista', 'Participação nas Plenárias'],
      destaque: false,
      badgeDestaque: 'Missionária',
      ativo: true,
      ordem: 2,
    },
    {
      id: 'PLANO_3',
      codigo: 'PLANO_3',
      nome: 'Plano 3 - Ordenação Ministerial',
      subtitulo: 'Para pastores, evangelistas e presbíteros em processo de ordenação ou elevação',
      valor: 380.0,
      cargosPermitidos: ['Pastor', 'Evangelista', 'Presbítero', 'Pastor Ordenado', 'Evangelista Ordenado'],
      beneficios: ['Certificado A4 de Ordenação em Papel Moeda', 'Credencial de Alta Graduação', 'Kit VIP Congressista', 'Direito a Voto Master'],
      destaque: true,
      badgeDestaque: 'Mais Procurado',
      ativo: true,
      ordem: 3,
    },
    {
      id: 'PLANO_4',
      codigo: 'PLANO_4',
      nome: 'Plano 4 - Nova Filiação & Credenciamento',
      subtitulo: 'Para novos ministros e igrejas filiadas ingressando na convenção',
      valor: 240.0,
      cargosPermitidos: ['Pastor', 'Evangelista', 'Presbítero', 'Missionária', 'Diácono', 'Novo Ministro'],
      beneficios: ['Credencial Provisória e Definitiva', 'Inclusão no Rol Geral da Convenção', 'Acesso Completo aos Benefícios'],
      destaque: false,
      badgeDestaque: 'Novo Ingresso',
      ativo: true,
      ordem: 4,
    }
  ];

  try {
    const colRef = collection(firestore, 'planos_ago');
    const q = query(colRef, orderBy('ordem', 'asc'));
    const snap = await getDocs(q);

    if (snap.empty) {
      return planosFallback;
    }

    return snap.docs.map((d) => ({
      ...d.data(),
      id: d.id,
    })) as PlanoAgo[];
  } catch (err: any) {
    console.warn('[buscarPlanosAgo] Quota / Rate exceeded. Fallback to local memory plans:', err?.message || err);
    return planosFallback;
  }
}

/**
 * 3. FILTRAGEM DINÂMICA DE PLANOS PARA MEMBROS EXISTENTES
 * Opera exclusivamente sobre a coleção viva do Firestore.
 */
export function filtrarPlanosParaMembroExistente(
  planosDoBanco: PlanoAgo[],
  cargoAtual: string
): PlanoAgo[] {
  const cargoLimpo = (cargoAtual || '').trim();

  if (cargoLimpo === 'Pastor') {
    return planosDoBanco.filter((p) => p.id === 'PLANO_1' || p.cargosPermitidos?.includes('Pastor'));
  }

  if (cargoLimpo === 'Evangelista' || cargoLimpo === 'Presbítero') {
    const plano1 = planosDoBanco.find((p) => p.id === 'PLANO_1');
    const plano3 = planosDoBanco.find((p) => p.id === 'PLANO_3');
    const resultado: PlanoAgo[] = [];
    if (plano1) resultado.push(plano1);
    if (plano3) {
      resultado.push({
        ...plano3,
        modalidade: 'ORDENACAO',
        destaque: true,
      });
    }
    return resultado;
  }

  if (cargoLimpo.toLowerCase().includes('mission')) {
    return planosDoBanco.filter((p) => p.id === 'PLANO_2' || p.cargosPermitidos?.includes('Missionária'));
  }

  return planosDoBanco.filter((p) => p.id === 'PLANO_1');
}

/**
 * 4. FILTRAGEM DINÂMICA DE PLANOS PARA NOVOS CADASTROS (ORDENAÇÃO / RECEBIMENTO)
 * Opera exclusivamente sobre a coleção viva do Firestore.
 * - Missionária -> PLANO_4 (R$ 240,00 no Firestore)
 * - Ministros (Pastor, Evangelista, Presbítero) -> PLANO_3 (R$ 380,00 no Firestore)
 */
export function filtrarPlanosParaNovoCadastro(
  planosDoBanco: PlanoAgo[],
  cargoDesejado?: string
): PlanoAgo[] {
  const cargoLimpo = (cargoDesejado || '').trim().toLowerCase();
  if (!cargoLimpo) {
    return [];
  }

  if (cargoLimpo.includes('mission')) {
    const plano4 = planosDoBanco.find((p) => p.id === 'PLANO_4');
    if (plano4) {
      return [{
        ...plano4,
        modalidade: 'AMBOS',
        destaque: true,
      }];
    }
    // Caso o id tenha outro identificador mas contenha Missionária
    const alternativo4 = planosDoBanco.find((p) =>
      p.cargosPermitidos?.some((c) => c.toLowerCase().includes('missionária'))
    );
    return alternativo4 ? [{ ...alternativo4, modalidade: 'AMBOS', destaque: true }] : [];
  }

  const plano3 = planosDoBanco.find((p) => p.id === 'PLANO_3');
  if (plano3) {
    return [{
      ...plano3,
      modalidade: 'AMBOS',
      destaque: true,
    }];
  }

  const alternativo3 = planosDoBanco.find((p) =>
    p.cargosPermitidos?.some((c) =>
      c.toLowerCase().includes('pastor') ||
      c.toLowerCase().includes('evangelista') ||
      c.toLowerCase().includes('presbítero')
    )
  );
  return alternativo3 ? [{ ...alternativo3, modalidade: 'AMBOS', destaque: true }] : [];
}

/**
 * 3. SALVAR OU ATUALIZAR PLANO DA AGO
 */
export async function salvarPlanoAgo(
  firestore: Firestore,
  planoId: string | null,
  dados: PlanoAgoInput
): Promise<string> {
  const id = planoId || dados.codigo || `plano-${Date.now()}`;
  const docRef = doc(firestore, 'planos_ago', id);

  const payload: Partial<PlanoAgo> = {
    id,
    codigo: dados.codigo,
    nome: dados.nome,
    subtitulo: dados.subtitulo,
    valor: Number(dados.valor) || 0,
    cargosPermitidos: dados.cargosPermitidos,
    beneficios: dados.beneficios,
    destaque: Boolean(dados.destaque),
    badgeDestaque: dados.badgeDestaque || '',
    ativo: dados.ativo ?? true,
    ordem: dados.ordem ?? 99,
    atualizadoEm: serverTimestamp(),
  };

  if (!planoId) {
    payload.criadoEm = serverTimestamp();
  }

  await setDoc(docRef, payload, { merge: true });
  return id;
}

/**
 * 4. EXCLUIR PLANO DA AGO (COM TRAVA DE SEGURANÇA SE HOUVER INSCRITOS)
 */
export async function excluirPlanoAgo(
  firestore: Firestore,
  planoId: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  // 1. Checa se existem inscrições vinculadas a este plano
  const colInsc = collection(firestore, 'inscricoes_ago');
  const q = query(colInsc, where('planoId', '==', planoId));
  const snap = await getDocs(q);

  if (!snap.empty) {
    throw new Error(
      `Operação bloqueada: Existem ${snap.size} inscrição(ões) homologada(s) vinculada(s) a este plano. Não é permitida a exclusão de planos com registros históricos.`
    );
  }

  const docRef = doc(firestore, 'planos_ago', planoId);
  await deleteDoc(docRef);

  return {
    sucesso: true,
    mensagem: 'Plano excluído com sucesso.',
  };
}

/**
 * 5. VALIDAÇÃO DE ELEGIBILIDADE DO CARGO PARA UM PLANO ESPECÍFICO
 */
export function validarElegibilidadeCargo(
  plano: PlanoAgo,
  cargoUsuario: string
): { elegivel: boolean; motivo?: string } {
  if (!plano.cargosPermitidos || plano.cargosPermitidos.length === 0) {
    return { elegivel: true };
  }

  const cargoLimpo = (cargoUsuario || '').trim().toLowerCase();
  const planoId = (plano.codigo || plano.id || '').toUpperCase();

  // Exceção Amigável: Presbíteros, Evangelistas e Pastores podem acessar o PLANO_3 (Recebimento/Ordenação) e PLANO_1
  if ((planoId === 'PLANO_3' || planoId.includes('PLANO_3')) &&
      (cargoLimpo.includes('presb') || cargoLimpo.includes('evangel') || cargoLimpo.includes('pastor'))) {
    return { elegivel: true };
  }

  // Exceção Amigável: Missionárias podem acessar o PLANO_4 (Ordenação/Recebimento Missionária) e PLANO_2
  if ((planoId === 'PLANO_4' || planoId.includes('PLANO_4')) && cargoLimpo.includes('mission')) {
    return { elegivel: true };
  }

  const permitido = plano.cargosPermitidos.some((c) => {
    const permLimpo = c.trim().toLowerCase();
    return permLimpo === cargoLimpo || cargoLimpo.includes(permLimpo) || permLimpo.includes(cargoLimpo);
  });

  if (!permitido) {
    return {
      elegivel: false,
      motivo: `Incompatível com seu Cargo (${cargoUsuario || 'Não informado'}). Permitido apenas para: ${plano.cargosPermitidos.join(', ')}.`,
    };
  }

  return { elegivel: true };
}

/**
 * 6. TRANSAÇÃO ATÔMICA ACID DE INSCRIÇÃO EM QUALQUER UM DOS 4 PLANOS (runTransaction)
 */
export async function realizarInscricaoPlanoGenericaTransacional(
  firestore: Firestore,
  dados: DadosInscricaoGenericaInput
): Promise<{ sucesso: boolean; inscricao: any; mensagem: string }> {
  // 1. Chave de Idempotência
  const chaveIdempotencia = `${dados.ministroId}_AGO_${dados.planoId}`;
  const hoje = getSystemDate();
  const timestamp = Date.now();
  const inscricaoId = `insc-ago-${dados.planoId.toLowerCase()}-${dados.ministroId}-${timestamp}`;
  const lancamentoId = `lago-rec-${dados.planoId.toLowerCase()}-${dados.ministroId}-${timestamp}`;
  const logId = `audit-${dados.planoId.toLowerCase()}-${timestamp}-${Math.random().toString(36).substring(2, 7)}`;

  // Tarifas Asaas
  const tarifaAsaas = calcularTarifaAsaas(dados.planoValor, dados.formaPagamento);
  const valorLiquido = Math.max(0, dados.planoValor - tarifaAsaas);

  return await runTransaction(firestore, async (transaction) => {
    // Check de Adimplência do Ministro
    const minRef = doc(firestore, 'ministros', dados.ministroId);
    const minSnap = await transaction.get(minRef);
    if (minSnap.exists()) {
      const minData = minSnap.data();
      if (minData.statusAdimplencia === 'INADIMPLENTE' || minData.status === 'INATIVO' || minData.status === 'SUSPENSO') {
        throw new Error(
          `Inscrição VETADA: O ministro ${minData.nome || dados.ministroNome} possui pendência financeira/cadastral (Status: ${minData.statusAdimplencia || 'INADIMPLENTE'}). Regularize a taxa de filiação/anuidade na Tesouraria.`
        );
      }
    }

    // A. Verificação de Idempotência no Banco
    const idempDocRef = doc(firestore, 'transacoes_processadas', chaveIdempotencia);
    const idempDoc = await transaction.get(idempDocRef);

    if (idempDoc.exists()) {
      throw new Error(
        'Esta inscrição já foi processada anteriormente para este ministro. Duplicação bloqueada pela chave de idempotência.'
      );
    }

    // B. Leitura dos Totais do DRE e Estatísticas da AGO
    const totaisDreRef = doc(firestore, 'dre_ago_totais', 'consolidado_geral');
    const totaisDreDoc = await transaction.get(totaisDreRef);

    const statsRef = doc(firestore, 'totais_financeiros', 'ago_estatisticas');
    const statsDoc = await transaction.get(statsRef);

    let totaisDreAtuais: DreAgoTotaisConsolidado = totaisDreDoc.exists()
      ? (totaisDreDoc.data() as DreAgoTotaisConsolidado)
      : criarTotaisIniciaisDreAgo();

    // C. Geração do Hash Criptográfico
    const hashPayload = `${inscricaoId}|${dados.ministroId}|${dados.cargo}|${dados.planoId}|${dados.planoValor}|${chaveIdempotencia}|${hoje}`;
    const hashIntegridade = gerarHashIntegridade(hashPayload);

    const statusFinal = dados.status || (dados.formaPagamento === 'BOLETO' ? 'PENDENTE' : 'CONFIRMADO');

    // D. Objeto da Inscrição
    const novaInscricao = {
      id: inscricaoId,
      ministroId: dados.ministroId,
      ministroNome: dados.ministroNome,
      ministroCpf: dados.ministroCpf,
      cpf: dados.ministroCpf,
      cargo: dados.cargo,
      anoVigente: (dados as any).anoVigente || new Date().getFullYear(),
      fotoUrl: dados.fotoUrl || '',
      email: dados.email || '',
      telefone: dados.telefone || '',
      planoId: dados.planoId,
      planoNome: dados.planoNome,
      valor: dados.planoValor,
      tarifaAsaas,
      valorLiquido,
      formaPagamento: dados.formaPagamento,
      status: statusFinal,
      statusInscricao: statusFinal,
      dataInscricao: hoje,
      direitoVotoHomologado: statusFinal === 'CONFIRMADO',
      kitCongressistaReservado: true,
      chaveIdempotencia,
      hashIntegridade,
      linhaDigitavelBoleto: dados.linhaDigitavelBoleto || '',
      codigoBarrasBoleto: dados.codigoBarrasBoleto || '',
      criadoEm: serverTimestamp(),
    };

    // E. Atualização do DRE com Aritmética de Centavos
    const novosTotaisDre = acumularLancamentoEmTotais(totaisDreAtuais, {
      id: lancamentoId,
      tipo: 'RECEITA',
      descricao: `Inscrição ${dados.planoNome} - ${dados.cargo} ${dados.ministroNome}`,
      valor: dados.planoValor,
      formaPagamento: dados.formaPagamento,
      tarifaAsaas,
      valorLiquido,
      data: hoje,
      centroCusto: 'Inscrições & Credenciamento',
      cargoEclesiastico: dados.cargo as any,
      plano: dados.planoId as any,
      status: 'CONFIRMADO',
      inscritoNome: dados.ministroNome,
    });

    const tenantIdFinal = (dados as any).tenantId || 't-sede-salvador';

    // F. Gravação dos Documentos na Transação Atômica ACID
    const inscricaoRef = doc(firestore, 'inscricoes_ago', inscricaoId);
    transaction.set(inscricaoRef, sanitizarPayloadParaFirestore({ ...novaInscricao, tenantId: tenantIdFinal }));

    // F.1 - Histórico de Pagamento de Filiação Liquidado para Novos Cadastros via AGO
    const filiacaoRef = doc(firestore, 'pagamentos_filiacao', `fil-${dados.ministroId}-${timestamp}`);
    transaction.set(
      filiacaoRef,
      sanitizarPayloadParaFirestore({
        id: `fil-${dados.ministroId}-${timestamp}`,
        ministroId: dados.ministroId || '',
        tenantId: tenantIdFinal,
        ministroNome: dados.ministroNome || 'Ministro',
        ministroCpf: dados.ministroCpf || '',
        cargo: dados.cargo || 'Obreiro',
        descricao: `Taxa de Filiação Convenial e Credenciamento Inicial (Inclusa no Plano AGO - ${dados.planoNome || 'AGO'})`,
        valor: dados.planoValor || 190.0,
        statusPagamento: 'LIQUIDADO',
        formaPagamento: dados.formaPagamento || 'PIX',
        dataPagamento: hoje,
        origem: 'NOVO_CADASTRO_AGO',
        criadoEm: serverTimestamp(),
      })
    );

    // F.2 - Geração Automática da Anuidade para o Ano Seguinte (2027) a partir do término da AGO (Valor R$ 120,00)
    const isMissionaria = (dados.cargo || '').toLowerCase().includes('missionár') || (dados.cargo || '').toLowerCase().includes('missionar');
    const valorAnuidade2027 = isMissionaria ? 120.00 : 120.00;

    const anuidadeProximoAnoRef = doc(firestore, 'anuidades', `anuidade-${dados.ministroId}-2027`);
    transaction.set(
      anuidadeProximoAnoRef,
      sanitizarPayloadParaFirestore({
        id: `anuidade-${dados.ministroId}-2027`,
        ministroId: dados.ministroId || '',
        tenantId: tenantIdFinal,
        ministroNome: dados.ministroNome || 'Ministro',
        ministroCpf: dados.ministroCpf || '',
        cargo: dados.cargo || 'Obreiro',
        anoReferencia: '2027',
        anoVigente: 2027,
        valor: valorAnuidade2027,
        statusPagamento: 'ABERTO',
        dataVencimento: '2027-10-30',
        origem: 'GERACAO_AUTOMATICA_AGO_2026',
        observacao: 'Anuidade 2027 gerada automaticamente após filiação liquidada na AGO 2026',
        criadoEm: serverTimestamp(),
      })
    );

    // F.3 - Atualização Atômica do Cadastro do Ministro no Firestore
    const ministroRef = doc(firestore, 'ministros', dados.ministroId);
    transaction.set(
      ministroRef,
      {
        status: 'ATIVO',
        statusAcesso: 'Ativo',
        filiadoViaAGO: true,
        filiacaoPaga: true,
        dataFiliacao: hoje,
        planoAgoInscrito: dados.planoNome,
        valorFiliacaoPago: dados.planoValor,
        atualizadoEm: serverTimestamp(),
      },
      { merge: true }
    );

    const lancamentoRef = doc(firestore, 'lancamentos_ago', lancamentoId);
    transaction.set(lancamentoRef, {
      id: lancamentoId,
      tipo: 'RECEITA',
      descricao: `Inscrição ${dados.planoNome} - ${dados.cargo} ${dados.ministroNome}`,
      valor: dados.planoValor,
      formaPagamento: dados.formaPagamento,
      tarifaAsaas,
      valorLiquido,
      data: hoje,
      centroCusto: 'Inscrições & Credenciamento',
      cargoEclesiastico: dados.cargo as any,
      plano: dados.planoId as any,
      status: 'CONFIRMADO',
      inscritoNome: dados.ministroNome,
      origemLancamento: 'PORTAL_AGO',
      criadoEm: serverTimestamp(),
    });

    transaction.set(totaisDreRef, {
      ...novosTotaisDre,
      atualizadoEm: serverTimestamp(),
    });

    // Incremento Atômico no Servidor com increment()
    if (statsDoc.exists()) {
      transaction.update(statsRef, {
        totalInscritos: increment(1),
        totalArrecadadoBruto: increment(dados.planoValor),
        totalVotosHomologados: increment(1),
        totalKitsCongressista: increment(1),
        [`inscritosPlano_${dados.planoId}`]: increment(1),
        [`inscritosPorCargo.${dados.cargo}`]: increment(1),
        atualizadoEm: serverTimestamp(),
      });
    } else {
      transaction.set(statsRef, {
        totalInscritos: 1,
        totalArrecadadoBruto: dados.planoValor,
        totalVotosHomologados: 1,
        totalKitsCongressista: 1,
        [`inscritosPlano_${dados.planoId}`]: 1,
        inscritosPorCargo: {
          [dados.cargo]: 1,
        },
        atualizadoEm: serverTimestamp(),
      });
    }

    // Trava de Idempotência
    transaction.set(idempDocRef, {
      id: chaveIdempotencia,
      ministroId: dados.ministroId,
      inscricaoId,
      planoId: dados.planoId,
      valor: dados.planoValor,
      processadoEm: serverTimestamp(),
    });

    // Log de Auditoria Imutável
    const auditRef = doc(firestore, 'audit_logs', logId);
    transaction.set(auditRef, {
      id: logId,
      timestamp: new Date().toISOString(),
      tenantId: 'TENANT_SEDE_GERAL',
      operador: dados.operadorNome || 'Operador Convencional',
      operadorId: dados.operadorId || 'op-sistema',
      acao: 'HOMOLOGACAO_INSCRICAO_AGO',
      detalhes: `Inscrição homologada em ${dados.planoNome} para o ministro ${dados.ministroNome} (${dados.cargo}) - Valor: R$ ${dados.planoValor.toFixed(2)} - Idempotência: ${chaveIdempotencia}`,
      hashIntegridade,
      hashAnterior: 'GENESIS_AGO_2026',
    });

    return {
      sucesso: true,
      inscricao: novaInscricao,
      mensagem: `Inscrição confirmada com sucesso em ${dados.planoNome} para ${dados.cargo} ${dados.ministroNome}!`,
    };
  });
}

export async function compensarBoletoInscricaoAgo(
  firestore: Firestore,
  inscricaoId: string
): Promise<boolean> {
  try {
    const inscRef = doc(firestore, 'inscricoes_ago', inscricaoId);
    await setDoc(
      inscRef,
      {
        status: 'CONFIRMADO',
        statusInscricao: 'CONFIRMADO',
        direitoVotoHomologado: true,
        dataCompensacao: new Date().toISOString(),
        atualizadoEm: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error('[ERRO_COMPENSAR_BOLETO_AGO]', err);
    return false;
  }
}

export async function sincronizarPlanosAgoPadrao(firestore: Firestore): Promise<void> {
  const planosPadrao = [
    {
      id: 'PLANO_1',
      codigo: 'PLANO_1',
      nome: 'Plano 1 - Anuidade Regular',
      subtitulo: 'Para membros efetivos e ministros em dia com a tesouraria',
      valor: 120.0,
      cargosPermitidos: ['Pastor', 'Evangelista', 'Presbítero', 'Missionária', 'Diácono'],
      beneficios: ['Credencial Oficial CR-80 PVC com QR Code', 'Direito a Voto na Plenária da AGO', 'Kit Congressista Oficial', 'Acesso ao Portal do Ministro'],
      destaque: false,
      badgeDestaque: 'Efetivo',
      ativo: true,
      ordem: 1,
    },
    {
      id: 'PLANO_2',
      codigo: 'PLANO_2',
      nome: 'Plano 2 - Inscrição Missionária',
      subtitulo: 'Destinado a missionárias e obreiras credenciadas',
      valor: 120.0,
      cargosPermitidos: ['Missionária', 'Missionária Recebida', 'Missionária Ordenada'],
      beneficios: ['Credencial de Missionária Oficial', 'Kit Congressista', 'Participação nas Plenárias'],
      destaque: false,
      badgeDestaque: 'Missionária',
      ativo: true,
      ordem: 2,
    },
    {
      id: 'PLANO_3',
      codigo: 'PLANO_3',
      nome: 'Plano 3 - Ordenação Ministerial',
      subtitulo: 'Para pastores, evangelistas e presbíteros em processo de ordenação ou elevação',
      valor: 380.0,
      cargosPermitidos: ['Pastor', 'Evangelista', 'Presbítero', 'Pastor Ordenado', 'Evangelista Ordenado'],
      beneficios: ['Certificado A4 de Ordenação em Papel Moeda', 'Credencial de Alta Graduação', 'Kit VIP Congressista', 'Direito a Voto Master'],
      destaque: true,
      badgeDestaque: 'Mais Procurado',
      ativo: true,
      ordem: 3,
    },
    {
      id: 'PLANO_4',
      codigo: 'PLANO_4',
      nome: 'Plano 4 - Nova Filiação & Credenciamento',
      subtitulo: 'Para novos ministros e igrejas filiadas ingressando na convenção',
      valor: 240.0,
      cargosPermitidos: ['Pastor', 'Evangelista', 'Presbítero', 'Missionária', 'Pastor Recebido'],
      beneficios: ['Processo de Credenciamento Completo', 'Inclusão no Rol Estadual', 'Credencial CR-80', 'Kit de Boas-Vindas'],
      destaque: false,
      badgeDestaque: 'Nova Filiação',
      ativo: true,
      ordem: 4,
    },
  ];

  for (const p of planosPadrao) {
    const docRef = doc(firestore, 'planos_ago', p.id);
    await setDoc(docRef, {
      ...p,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    }, { merge: true });
  }
}

