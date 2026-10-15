/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Motor Contábil da Tesouraria e DRE Anual com Offset de Brasília (-03:00)
 * Protocolo: Aritmética em Centavos Inteiros, Imutabilidade de Fechamentos e Sessão em Memória.
 */

import { Request, Response } from 'express';
import { adminDb } from './firebaseAdmin';
import { db } from '../src/firebase';
import {
  collection,
  query,
  getDocs,
  getDoc,
  doc,
  setDoc,
  orderBy,
  limit,
} from 'firebase/firestore';

/**
 * Utilitário estrito de conversão para centavos (Anti-IEEE 754)
 */
export function toCents(amount: number | string): number {
  return Math.round((Number(amount) || 0) * 100);
}

/**
 * Utilitário de conversão de centavos para reais
 */
export function fromCents(cents: number | string): number {
  return (Math.round(Number(cents) || 0) || 0) / 100;
}

/**
 * Extrai o ano fiscal e data formatada no fuso horário canônico de Brasília (-03:00)
 * O cálculo ignora UTC desfasado: a virada obedece estritamente às 23:59:59 no Horário de Brasília.
 */
export function extrairDataBrasilia(dataIso: string): {
  ano: number;
  mes: number;
  dia: number;
  isoBrasilia: string;
} | null {
  if (!dataIso) return null;
  const d = new Date(dataIso);
  if (isNaN(d.getTime())) return null;

  // Offset fixo de Brasília: UTC - 3 horas (-180 minutos)
  const brasiliaMs = d.getTime() - (3 * 60 * 60 * 1000);
  const brasiliaDate = new Date(brasiliaMs);

  const ano = brasiliaDate.getUTCFullYear();
  const mes = brasiliaDate.getUTCMonth() + 1;
  const dia = brasiliaDate.getUTCDate();

  return {
    ano,
    mes,
    dia,
    isoBrasilia: brasiliaDate.toISOString(),
  };
}

/**
 * 1. APURADOR DE DRE DINÂMICO
 * Endpoint GET /api/treasury/reports/dre/:ano
 * - Puxa todos os documentos da coleção financial_ledger onde o ano da dataLiquidacao corresponda ao parâmetro.
 * - Limite estrito de 23:59:59 no Horário de Brasília (-03:00).
 * - Soma receitas e despesas utilizando inteiros em centavos via toCents().
 * - Devolve faturamento bruto, taxas do gateway Asaas e faturamento líquido.
 */
export async function getDreDinamico(req: Request, res: Response): Promise<any> {
  try {
    const anoParam = parseInt(String(req.params?.ano || req.query?.ano || new Date().getFullYear()), 10);
    if (!anoParam || isNaN(anoParam) || anoParam < 1900 || anoParam > 2100) {
      return res.status(400).json({ error: 'Ano inválido fornecido para apuração do DRE.' });
    }

    // Leitura dos registros de financial_ledger (com stasis para tabela vazia)
    let docsLedger: any[] = [];
    try {
      const qLedger = query(collection(db, 'financial_ledger'), limit(500));
      const snapLedger = await getDocs(qLedger);
      if (!snapLedger.empty) {
        docsLedger = snapLedger.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      }
    } catch (dbErr: any) {
      console.warn('[DRE_LEDGER_FETCH_WARN] Fallback para leitura direta:', dbErr?.message);
      if (adminDb) {
        try {
          const snapAdmin = await adminDb.collection('financial_ledger').limit(500).get();
          if (!snapAdmin.empty) {
            docsLedger = snapAdmin.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          }
        } catch (adminErr) {
          console.warn('[DRE_ADMIN_LEDGER_ERR]', adminErr);
        }
      }
    }

    // Filtragem pelo Ano com Offset Estrito de Brasília (-03:00)
    let faturamentoBrutoCentavos = 0;
    let taxasGatewayCentavos = 0;
    let despesasTotaisCentavos = 0;
    let totalTransacoes = 0;

    const lancamentosDoAno: any[] = [];

    for (const item of docsLedger) {
      const dataRef = String(item.dataLiquidacao || item.dataPagamento || item.timestamp || '');
      const dtBrasilia = extrairDataBrasilia(dataRef);
      if (!dtBrasilia || dtBrasilia.ano !== anoParam) {
        continue;
      }

      totalTransacoes++;
      lancamentosDoAno.push(item);

      // Valores em centavos estritos
      const valorCentavos = item.valorCentavos !== undefined
        ? Number(item.valorCentavos)
        : toCents(item.valor || 0);

      const taxaCentavos = item.taxaGatewayCentavos !== undefined
        ? Number(item.taxaGatewayCentavos)
        : toCents(item.taxaAsaas || item.taxa || 0);

      const tipo = String(item.tipoOperacao || item.tipo || '').toUpperCase();

      if (tipo.includes('DESPESA')) {
        despesasTotaisCentavos += valorCentavos;
      } else {
        // Receita (Anuidade, Inscrição AGO, Taxa de Filiação)
        faturamentoBrutoCentavos += valorCentavos;
        taxasGatewayCentavos += taxaCentavos;
      }
    }

    // Aritmética em Centavos Inteiros (Anti-IEEE 754)
    const faturamentoLiquidoCentavos = faturamentoBrutoCentavos - taxasGatewayCentavos - despesasTotaisCentavos;

    // Checar se já existe fechamento congelado imutável deste ano
    let fechamentoCongelado: any = null;
    try {
      const snapFechamento = await getDoc(doc(db, 'fechamentos_contabeis', `dre_${anoParam}`));
      if (snapFechamento.exists()) {
        fechamentoCongelado = snapFechamento.data();
      }
    } catch {
      // Nenhum fechamento existente
    }

    return res.status(200).json({
      ano: anoParam,
      fusoHorario: 'America/Sao_Paulo (UTC -03:00)',
      totalTransacoes,
      centavos: {
        faturamentoBrutoCentavos,
        taxasGatewayCentavos,
        despesasTotaisCentavos,
        faturamentoLiquidoCentavos,
      },
      brl: {
        faturamentoBruto: fromCents(faturamentoBrutoCentavos),
        taxasGateway: fromCents(taxasGatewayCentavos),
        despesasTotais: fromCents(despesasTotaisCentavos),
        faturamentoLiquido: fromCents(faturamentoLiquidoCentavos),
      },
      statusFechamento: fechamentoCongelado?.status || 'EM_ABERTO',
      fechamentoCongelado: fechamentoCongelado || null,
    });
  } catch (err: any) {
    console.error('[GET_DRE_DINAMICO_ERROR]:', err);
    return res.status(500).json({ error: 'Falha ao apurar DRE anual.', details: err?.message });
  }
}

/**
 * 2. SNAPSHOT IMUTÁVEL DE FECHAMENTO
 * Endpoint POST /api/treasury/reports/dre/congelar
 * Payload: { ano, operadorEmail, justificativa }
 * - Grava o resultado consolidado do ano em fechamentos_contabeis/dre_${ano} com status: 'CONGELADO_IMUTAVEL'.
 * - Se o documento já existir, barra imediatamente com HTTP 409 Conflict.
 */
export async function congelarExercicioDre(req: Request, res: Response): Promise<any> {
  try {
    const { ano, operadorEmail, justificativa } = req.body || {};
    const anoInt = parseInt(String(ano || ''), 10);

    if (!anoInt || isNaN(anoInt) || anoInt < 1900 || anoInt > 2100) {
      return res.status(400).json({ error: 'Parâmetro [ano] é obrigatório e deve ser um ano válido.' });
    }

    const docId = `dre_${anoInt}`;
    const docRef = doc(db, 'fechamentos_contabeis', docId);

    // 1. Verificação Estrita de Existência Prévia (Idempotência / Imutabilidade)
    const docExistente = await getDoc(docRef);
    if (docExistente.exists()) {
      return res.status(409).json({
        error: `CONFLITO (HTTP 409): O exercício contábil do ano [${anoInt}] já se encontra [CONGELADO_IMUTAVEL]. O estatuto veda a alteração de históricos passados.`,
        fechamentoExistente: docExistente.data(),
      });
    }

    // 2. Apuração dos Centavos do Ano com Horário de Brasília (-03:00)
    let docsLedger: any[] = [];
    try {
      const qLedger = query(collection(db, 'financial_ledger'), limit(500));
      const snapLedger = await getDocs(qLedger);
      if (!snapLedger.empty) {
        docsLedger = snapLedger.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      }
    } catch (e: any) {
      console.warn('[DRE_CONGELAR_FETCH_WARN]', e?.message);
    }

    let faturamentoBrutoCentavos = 0;
    let taxasGatewayCentavos = 0;
    let despesasTotaisCentavos = 0;
    let transacoesAuditadas = 0;

    for (const item of docsLedger) {
      const dataRef = String(item.dataLiquidacao || item.dataPagamento || item.timestamp || '');
      const dtBrasilia = extrairDataBrasilia(dataRef);
      if (!dtBrasilia || dtBrasilia.ano !== anoInt) {
        continue;
      }

      transacoesAuditadas++;
      const valorCentavos = item.valorCentavos !== undefined
        ? Number(item.valorCentavos)
        : toCents(item.valor || 0);

      const taxaCentavos = item.taxaGatewayCentavos !== undefined
        ? Number(item.taxaGatewayCentavos)
        : toCents(item.taxaAsaas || item.taxa || 0);

      const tipo = String(item.tipoOperacao || item.tipo || '').toUpperCase();
      if (tipo.includes('DESPESA')) {
        despesasTotaisCentavos += valorCentavos;
      } else {
        faturamentoBrutoCentavos += valorCentavos;
        taxasGatewayCentavos += taxaCentavos;
      }
    }

    const faturamentoLiquidoCentavos = faturamentoBrutoCentavos - taxasGatewayCentavos - despesasTotaisCentavos;
    const agoraIso = new Date().toISOString();

    const snapshotFechamento = {
      id: docId,
      ano: anoInt,
      status: 'CONGELADO_IMUTAVEL',
      dataFechamentoIso: agoraIso,
      operadorFechamento: String(operadorEmail || 'tesoureiro_geral@cimadebe.org').trim(),
      justificativa: String(justificativa || 'Homologação oficial de contas em Assembleia Geral Ordinária').trim(),
      transacoesAuditadas,
      fusoHorarioCorte: 'America/Sao_Paulo (-03:00 23:59:59)',
      centavos: {
        faturamentoBrutoCentavos,
        taxasGatewayCentavos,
        despesasTotaisCentavos,
        faturamentoLiquidoCentavos,
      },
      brl: {
        faturamentoBruto: fromCents(faturamentoBrutoCentavos),
        taxasGateway: fromCents(taxasGatewayCentavos),
        despesasTotais: fromCents(despesasTotaisCentavos),
        faturamentoLiquido: fromCents(faturamentoLiquidoCentavos),
      },
    };

    // 3. Gravação definitiva e irreversível no Firestore
    await setDoc(docRef, snapshotFechamento);

    return res.status(200).json({
      success: true,
      message: `Exercício contábil de [${anoInt}] congelado com sucesso sob status [CONGELADO_IMUTAVEL].`,
      fechamento: snapshotFechamento,
    });
  } catch (err: any) {
    console.error('[CONGELAR_DRE_ERROR]:', err);
    return res.status(500).json({ error: 'Erro ao congelar exercício contábil.', details: err?.message });
  }
}

/**
 * 3. LISTAR ÚLTIMAS TRANSAÇÕES DO LIVRO CAIXA
 * Endpoint GET /api/treasury/reports/ledger-recentes
 */
export async function getLedgerRecentes(req: Request, res: Response): Promise<any> {
  try {
    const qSnap = await getDocs(query(collection(db, 'financial_ledger'), limit(50)));
    const registros: any[] = [];

    if (!qSnap.empty) {
      qSnap.docs.forEach((d) => {
        const item = d.data();
        const dataRef = String(item.dataLiquidacao || item.dataPagamento || item.timestamp || '');
        const dtBrasilia = extrairDataBrasilia(dataRef);

        const valorCentavos = item.valorCentavos !== undefined ? Number(item.valorCentavos) : toCents(item.valor || 0);
        const taxaCentavos = item.taxaGatewayCentavos !== undefined ? Number(item.taxaGatewayCentavos) : toCents(item.taxaAsaas || item.taxa || 0);

        registros.push({
          id: d.id,
          ...item,
          dataBrasiliaFormatada: dtBrasilia ? `${dtBrasilia.dia.toString().padStart(2, '0')}/${dtBrasilia.mes.toString().padStart(2, '0')}/${dtBrasilia.ano}` : 'Data pendente',
          valorCentavos,
          taxaCentavos,
          valorBrl: fromCents(valorCentavos),
          taxaBrl: fromCents(taxaCentavos),
        });
      });
    }

    // Ordenação cronológica reversa por liquidação
    registros.sort((a, b) => {
      const tA = new Date(a.dataLiquidacao || a.timestamp || 0).getTime();
      const tB = new Date(b.dataLiquidacao || b.timestamp || 0).getTime();
      return tB - tA;
    });

    return res.status(200).json({
      total: registros.length,
      registros: registros.slice(0, 50),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao carregar livro caixa.', details: err?.message });
  }
}
