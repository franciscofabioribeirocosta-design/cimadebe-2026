import { Request, Response } from 'express';
import { adminDb } from './firebaseAdmin';

/**
 * MINISTER FINANCIAL CONTROLLER - Layered Zero-Trust & Strict Adimplence Evaluation
 */
export async function getMinisterFinancialStatus(req: Request, res: Response): Promise<void> {
  try {
    const { ministroId } = req.params;

    // LAYER 1: STRICT INPUT VALIDATION & FAIL-FAST GATE
    if (!ministroId || ministroId.trim() === '' || ministroId === 'undefined') {
      res.status(400).json({ error: 'Identificador de ministro inválido ou ausente.' });
      return;
    }

    const minDoc = await adminDb.collection('ministros').doc(ministroId).get();
    const minData = minDoc.exists ? minDoc.data() || {} : {};
    const nome = minData.nome || minData.ministroNome || ministroId;
    const cpf = minData.cpf || minData.ministerCpf || '00000000000';
    const cargo = minData.cargo || minData.ministerRole || 'Pastor';
    const genero = minData.genero || minData.gender || 'Masculino';
    const email = minData.email || '';
    const telefone = minData.telefone || minData.whatsapp || '';

    // LAYER 2 ADDENDUM: QUERY LIMIT & PROTECTION
    const querySnap = await adminDb
      .collection('anuidades')
      .where('ministroId', '==', ministroId)
      .limit(30)
      .get();

    if (querySnap.empty) {
      // RENDER LAW: Zero historical invoices -> return clean empty array
      res.json({
        ministroId,
        nome,
        cpf,
        cargo,
        genero,
        email,
        telefone,
        isAdimplente: true,
        anuidades: []
      });
      return;
    }

    const anuidades: any[] = [];
    let isAdimplente = true;

    querySnap.forEach((doc) => {
      const data = doc.data();
      const status = (data.statusPagamento || data.status || data.situacao || 'PAGO').toUpperCase();

      if (['ABERTO', 'VENCIDO', 'PENDENTE', 'INADIMPLENTE', 'ATRASADO', 'EM_ATRASO'].includes(status)) {
        isAdimplente = false;
      }

      const ehFiliacao = Boolean(
        doc.id.startsWith('an-fil-') ||
        data.categoria === 'TAXA_CONVENCAO' ||
        data.tipo === 'FILIACAO'
      );

      anuidades.push({
        id: doc.id,
        ano: data.anoVigente || data.ano || new Date().getFullYear(),
        valor: Number(data.valor) || 0,
        vencimento: data.dataVencimento || data.vencimento || '',
        status: status,
        categoria: data.categoria || (ehFiliacao ? 'TAXA_CONVENCAO' : 'ANUIDADE'),
        tipo: data.tipo || (ehFiliacao ? 'FILIACAO' : 'ANUIDADE'),
        ehFiliacao,
        rotulo: ehFiliacao ? 'Taxa de Filiação' : `Anuidade ${data.anoVigente || data.ano || ''}`.trim()
      });
    });

    res.json({
      ministroId,
      nome,
      cpf,
      cargo,
      genero,
      email,
      telefone,
      isAdimplente,
      anuidades
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao processar status financeiro do ministro.' });
  }
}

