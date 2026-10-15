import { Request, Response } from 'express';
import { adminDb } from './firebaseAdmin';

function toCents(amount: number): number {
  return Math.round((Number(amount) || 0) * 100);
}

function fromCents(cents: number): number {
  return (Math.round(cents) || 0) / 100;
}

/**
 * PILLAR 2: PAINEL DA TESOURARIA - CONCILIAÇÃO MANUAL ASAAS
 * POST /api/treasury/reconcile-event
 * Associa manualmente eventos de webhook Asaas a ministros ou igrejas com reconciliação atômica no banco.
 */
export async function conciliarEventoManual(req: Request, res: Response): Promise<void> {
  try {
    const { eventId, ministroId, igrejaId, operadorEmail, observacao } = req.body || {};

    if (!eventId || typeof eventId !== 'string') {
      res.status(400).json({ error: 'Fail-Fast: O identificador do evento (eventId) é obrigatório.' });
      return;
    }

    if (!operadorEmail || typeof operadorEmail !== 'string') {
      res.status(400).json({ error: 'Fail-Fast: O e-mail do operador responsável é obrigatório para conformidade de auditoria.' });
      return;
    }

    // 1. Fetch target event from transacoes_processadas/${eventId}
    const eventRef = adminDb.collection('transacoes_processadas').doc(eventId);
    const eventSnap = await eventRef.get();

    if (!eventSnap.exists) {
      res.status(404).json({ error: `Evento não localizado: Nenhuma transação encontrada com o ID [${eventId}].` });
      return;
    }

    const eventData = eventSnap.data() || {};
    const valorEvento = Number(eventData.valor || eventData.value || 0);
    const nowIso = new Date().toISOString();

    const batch = adminDb.batch();

    // 2. If ministroId provided, find and mark open annuity
    let anuidadeAfetadaId: string | null = null;
    let ministroNome: string = 'Ministro Homologado';

    if (ministroId) {
      const minSnap = await adminDb.collection('ministros').doc(ministroId).get();
      if (!minSnap.exists) {
        res.status(404).json({ error: `Ministro alvo com ID [${ministroId}] não encontrado no cadastro.` });
        return;
      }
      ministroNome = String(minSnap.data()?.nome || ministroId);

      // Search for open annuity of this minister
      const anuidadesSnap = await adminDb
        .collection('anuidades')
        .where('ministroId', '==', ministroId)
        .where('statusPagamento', '==', 'ABERTO')
        .limit(1)
        .get();

      if (!anuidadesSnap.empty) {
        const docAnuidade = anuidadesSnap.docs[0];
        anuidadeAfetadaId = docAnuidade.id;
        batch.update(docAnuidade.ref, {
          statusPagamento: 'PAGO',
          dataPagamento: nowIso,
          dataLiquidacao: nowIso,
          valorPago: valorEvento > 0 ? valorEvento : docAnuidade.data()?.valor,
          asaasPaymentId: eventData.paymentId || eventData.id || eventId,
          conciliadoManualmente: true,
          conciliadoPor: operadorEmail,
          conciliadoEm: nowIso,
        });
      } else {
        // Create canonical receipt record
        anuidadeAfetadaId = `an-concil-${Date.now()}`;
        const novaAnuidadeRef = adminDb.collection('anuidades').doc(anuidadeAfetadaId);
        batch.set(novaAnuidadeRef, {
          id: anuidadeAfetadaId,
          ministroId,
          tenantId: eventData.tenantId || 't-sede-salvador',
          anoVigente: new Date().getFullYear(),
          dataVencimento: nowIso.split('T')[0],
          dataPagamento: nowIso,
          valor: valorEvento,
          valorPago: valorEvento,
          statusPagamento: 'PAGO',
          tipo: 'RECEITA',
          categoria: 'ANUIDADE',
          descricao: `Conciliação Manual Asaas - Evento ${eventId}`,
          conciliadoManualmente: true,
          conciliadoPor: operadorEmail,
          conciliadoEm: nowIso,
        });
      }

      // Record in financial_logs using canonical keys
      const logFinRef = adminDb.collection('financial_logs').doc(`fin-concil-${Date.now()}`);
      batch.set(logFinRef, {
        id: `fin-concil-${Date.now()}`,
        ministroId,
        ministroNome,
        eventId,
        valor: valorEvento,
        valorPago: valorEvento,
        dataPagamento: nowIso,
        tipo: 'RECEITA_ANUIDADE',
        operadorEmail,
        status: 'LIQUIDADO_MANUAL',
      });
    }

    // 3. Update transacoes_processadas/${eventId}
    batch.update(eventRef, {
      statusConciliacao: 'CONCILIADO_MANUAL',
      conciliadoPor: operadorEmail,
      conciliadoEm: nowIso,
      ministroIdVinculado: ministroId || null,
      igrejaIdVinculada: igrejaId || null,
      observacaoConciliacao: observacao || null,
    });

    // 4. Write permanent record into audit_logs
    const auditRef = adminDb.collection('audit_logs').doc(`log-concil-${Date.now()}`);
    batch.set(auditRef, {
      id: `log-concil-${Date.now()}`,
      timestamp: nowIso,
      tenantId: eventData.tenantId || 't-sede-salvador',
      operador: operadorEmail,
      operadorId: operadorEmail,
      acao: 'CONCILIACAO_MANUAL_EVENTO',
      detalhes: `Conciliação manual do evento Asaas ${eventId} no valor de R$ ${valorEvento.toFixed(2)} vinculada a ${ministroId ? `Ministro: ${ministroNome} (${ministroId})` : `Igreja: ${igrejaId}`}.`,
    });

    await batch.commit();

    res.status(200).json({
      sucesso: true,
      mensagem: `Evento ${eventId} conciliado com sucesso no Ledger da Tesouraria.`,
      anuidadeAfetadaId,
      valor: valorEvento,
    });
  } catch (error: any) {
    console.error('[TREASURY_RECONCILE_ERR]', error);
    res.status(500).json({ error: error?.message || 'Falha ao conciliar evento manualmente.' });
  }
}

/**
 * PILLAR 2: DRE SNAPSHOT & FISCAL YEAR CLOSURE
 * POST /api/treasury/fechar-exercicio
 * Congela e salva o snapshot anual imutável das contas da convenção.
 */
export async function fecharExercicioContabil(req: Request, res: Response): Promise<void> {
  try {
    const { anoExercicio, operadorEmail, tenantId, observacoesFechamento } = req.body || {};

    const ano = Number(anoExercicio);
    if (!ano || isNaN(ano) || ano < 2000 || ano > 2100) {
      res.status(400).json({ error: 'Fail-Fast: O anoExercicio informado é inválido.' });
      return;
    }

    if (!operadorEmail || typeof operadorEmail !== 'string') {
      res.status(400).json({ error: 'Fail-Fast: O e-mail do operador responsável é obrigatório.' });
      return;
    }

    // 1. Check if fechamentos_contabeis/dre_${anoExercicio} already exists
    const fechamentoRef = adminDb.collection('fechamentos_contabeis').doc(`dre_${ano}`);
    const fechamentoSnap = await fechamentoRef.get();

    if (fechamentoSnap.exists) {
      res.status(409).json({
        error: 'EXERCICIO_JA_ENCERRADO',
        message: `O exercício contábil de ${ano} já foi encerrado e congelado em definitivo. Não é permitido sobrescrever snapshots imutáveis.`,
        dados: fechamentoSnap.data(),
      });
      return;
    }

    // 2. Query all paid annuities of the fiscal year
    const anuidadesSnap = await adminDb
      .collection('anuidades')
      .where('anoVigente', '==', ano)
      .where('statusPagamento', '==', 'PAGO')
      .limit(1000)
      .get();

    let totalAnuidadesCentavos = 0;
    let taxasGatewayCentavos = 0;

    anuidadesSnap.docs.forEach((doc) => {
      const data = doc.data();
      const val = Number(data.valorPago ?? data.valor ?? 0);
      const taxa = Number(data.tarifaAsaas ?? 0);
      totalAnuidadesCentavos += toCents(val);
      taxasGatewayCentavos += toCents(taxa);
    });

    // Query AGO revenue for this fiscal year
    const agoSnap = await adminDb
      .collection('inscricoes_ago')
      .where('anoVigente', '==', ano)
      .where('statusPagamento', '==', 'PAGO')
      .limit(1000)
      .get();

    let totalInscricoesAgoCentavos = 0;
    agoSnap.docs.forEach((doc) => {
      const data = doc.data();
      const val = Number(data.valor ?? 190.0);
      totalInscricoesAgoCentavos += toCents(val);
    });

    const faturamentoBrutoCentavos = totalAnuidadesCentavos + totalInscricoesAgoCentavos;
    const faturamentoLiquidoCentavos = Math.max(0, faturamentoBrutoCentavos - taxasGatewayCentavos);
    const nowIso = new Date().toISOString();

    const snapshotData = {
      anoExercicio: ano,
      fechadoEm: nowIso,
      fechadoPor: operadorEmail.trim(),
      tenantId: tenantId || 't-sede-salvador',
      faturamentoBrutoCentavos,
      taxasGatewayCentavos,
      faturamentoLiquidoCentavos,
      totalAnuidadesCentavos,
      totalInscricoesAgoCentavos,
      totalAnuidadesLiquidadas: anuidadesSnap.size,
      totalInscricoesAgoLiquidadas: agoSnap.size,
      faturamentoBrutoBrl: fromCents(faturamentoBrutoCentavos),
      faturamentoLiquidoBrl: fromCents(faturamentoLiquidoCentavos),
      taxasGatewayBrl: fromCents(taxasGatewayCentavos),
      status: 'CONGELADO_IMUTAVEL',
      observacoes: observacoesFechamento || 'Encerramento contábil com auditoria e conciliação atômica.',
    };

    const batch = adminDb.batch();
    batch.set(fechamentoRef, snapshotData);

    // Audit log
    const auditRef = adminDb.collection('audit_logs').doc(`log-fechamento-${ano}-${Date.now()}`);
    batch.set(auditRef, {
      id: `log-fechamento-${ano}-${Date.now()}`,
      timestamp: nowIso,
      tenantId: snapshotData.tenantId,
      operador: operadorEmail,
      operadorId: operadorEmail,
      acao: 'FECHAMENTO_EXERCICIO_DRE',
      detalhes: `Exercício contábil ${ano} encerrado com Faturamento Bruto de R$ ${snapshotData.faturamentoBrutoBrl.toFixed(2)} e Líquido de R$ ${snapshotData.faturamentoLiquidoBrl.toFixed(2)}. Status: CONGELADO_IMUTAVEL.`,
    });

    await batch.commit();

    res.status(201).json({
      sucesso: true,
      mensagem: `Exercício ${ano} encerrado e congelado com sucesso.`,
      snapshot: snapshotData,
    });
  } catch (error: any) {
    console.error('[FECHAR_EXERCICIO_ERR]', error);
    res.status(500).json({ error: error?.message || 'Falha ao encerrar exercício contábil.' });
  }
}

/**
 * LIST PENDING TRANSACTIONS FOR RECONCILIATION
 * GET /api/treasury/pending-events
 */
export async function listarEventosPendentes(_req: Request, res: Response): Promise<void> {
  try {
    const snap = await adminDb
      .collection('transacoes_processadas')
      .orderBy('processadoEm', 'desc')
      .limit(50)
      .get();

    const eventos = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        paymentId: data.paymentId || data.id || d.id,
        valor: Number(data.valor || data.value || 0),
        data: data.processadoEm || data.timestamp || new Date().toISOString(),
        tipo: data.tipo || data.origem || 'PAYMENT_RECEIVED',
        statusConciliacao: data.statusConciliacao || 'PENDENTE_CONCILIACAO',
        ministroId: data.ministroId || null,
        ministroNome: data.ministroNome || null,
        conciliadoPor: data.conciliadoPor || null,
        conciliadoEm: data.conciliadoEm || null,
      };
    });

    res.json({
      sucesso: true,
      total: eventos.length,
      eventos,
    });
  } catch (error: any) {
    console.error('[LIST_PENDING_ERR]', error);
    res.status(500).json({ error: 'Falha ao listar eventos pendentes de conciliação.' });
  }
}

/**
 * LIST HISTORICAL DRE SNAPSHOTS
 * GET /api/treasury/fechamentos
 */
export async function listarFechamentos(_req: Request, res: Response): Promise<void> {
  try {
    const snap = await adminDb
      .collection('fechamentos_contabeis')
      .orderBy('anoExercicio', 'desc')
      .limit(30)
      .get();

    const fechamentos = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    res.json({
      sucesso: true,
      total: fechamentos.length,
      fechamentos,
    });
  } catch (error: any) {
    console.error('[LIST_FECHAMENTOS_ERR]', error);
    res.status(500).json({ error: 'Falha ao listar fechamentos contábeis históricos.' });
  }
}
