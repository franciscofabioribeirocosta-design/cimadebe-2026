import { Request, Response } from 'express';
import { adminDb } from './firebaseAdmin';

/**
 * IGREJAS CONTROLLER - STRICT IDEMPOTENCY & EXACT CANONICAL PATH ('igrejas')
 * Prohibits duplicate CNPJ registrations and enforces isolated operations.
 */

export async function criarIgreja(req: Request, res: Response): Promise<void> {
  try {
    const {
      razaoSocial,
      nomeFantasia,
      cnpj,
      dataAbertura,
      naturezaJuridica,
      cnaePrincipal,
      situacaoCadastral,
      logradouro,
      numero,
      complemento,
      bairro,
      municipio,
      uf,
      cep,
      email,
      telefone,
      pastorPresidenteId,
      pastorPresidenteNome,
      logoUrl,
      tenantId,
      status
    } = req.body || {};

    // 1. STRICT INPUT VALIDATION & FAIL-FAST GATE
    if (!razaoSocial || typeof razaoSocial !== 'string' || razaoSocial.trim().length === 0) {
      res.status(400).json({ error: 'Fail-Fast: O campo razaoSocial é obrigatório.' });
      return;
    }

    if (!nomeFantasia || typeof nomeFantasia !== 'string' || nomeFantasia.trim().length === 0) {
      res.status(400).json({ error: 'Fail-Fast: O campo nomeFantasia é obrigatório.' });
      return;
    }

    if (!cnpj || typeof cnpj !== 'string' || cnpj.trim().length === 0) {
      res.status(400).json({ error: 'Fail-Fast: O campo cnpj é obrigatório.' });
      return;
    }

    // 2. CHECK DUPLICATE CNPJ IN DATABASE
    const cleanCnpj = cnpj.replace(/\D/g, '');
    const docId = cleanCnpj.length >= 8 
      ? cleanCnpj 
      : (nomeFantasia.toLowerCase().replace(/[^a-z0-9]/g, '') || `ig-${Date.now()}`);

    const existingDoc = await adminDb.collection('igrejas').doc(docId).get();
    if (existingDoc.exists) {
      const data = existingDoc.data() || {};
      res.status(409).json({
        error: 'CNPJ_DUPLICADO',
        message: `Não é possível cadastrar: O CNPJ ${cnpj} já está vinculado à igreja "${data.nomeFantasia || data.razaoSocial}".`
      });
      return;
    }

    // Also verify if any other document has the same CNPJ string
    const queryDuplicate = await adminDb.collection('igrejas').where('cnpj', '==', cnpj.trim()).limit(1).get();
    if (!queryDuplicate.empty) {
      const data = queryDuplicate.docs[0].data() || {};
      res.status(409).json({
        error: 'CNPJ_DUPLICADO',
        message: `Não é possível cadastrar: O CNPJ ${cnpj} já está vinculado à igreja "${data.nomeFantasia || data.razaoSocial}".`
      });
      return;
    }

    const payload = {
      id: docId,
      tenantId: tenantId || 't-sede-salvador',
      razaoSocial: razaoSocial.trim(),
      nomeFantasia: nomeFantasia.trim(),
      cnpj: cnpj.trim(),
      dataAbertura: String(dataAbertura || '2010-01-01').trim(),
      naturezaJuridica: String(naturezaJuridica || '322-0 - Organização Religiosa').trim(),
      cnaePrincipal: String(cnaePrincipal || '94.91-0-00 - Atividades de organizações religiosas').trim(),
      situacaoCadastral: situacaoCadastral === 'SUSPENSA' || situacaoCadastral === 'BAIXADA' ? situacaoCadastral : 'ATIVA',
      logradouro: String(logradouro || '').trim(),
      numero: String(numero || '').trim(),
      complemento: String(complemento || '').trim(),
      bairro: String(bairro || '').trim(),
      municipio: String(municipio || '').trim(),
      uf: String(uf || '').trim().toUpperCase(),
      cep: String(cep || '').trim(),
      email: String(email || '').trim(),
      telefone: String(telefone || '').trim(),
      pastorPresidenteId: String(pastorPresidenteId || '').trim(),
      pastorPresidenteNome: String(pastorPresidenteNome || 'Pastor Responsável a Designar').trim(),
      logoUrl: logoUrl || 'https://images.unsplash.com/photo-1548625361-195fe578cb66?auto=format&fit=crop&w=300&h=300&q=80',
      status: status === 'SUSPENSA' ? 'SUSPENSA' : 'ATIVA',
      dataFiliacao: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString()
    };

    // Explicit Database Key Overwrite on Canonical 'igrejas' Collection
    await adminDb.collection('igrejas').doc(docId).set(payload, { merge: true });

    res.status(200).json({ success: true, id: docId, igreja: payload });
  } catch (error: any) {
    console.error('[CRIAR_IGREJA_ERR]', error);
    res.status(500).json({ error: 'Falha ao processar cadastro de igreja filiada.', details: error?.message });
  }
}

export async function deletarIgreja(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // 1. STRICT VALIDATION GATE
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      res.status(400).json({ error: 'Fail-Fast: ID da igreja é obrigatório para exclusão.' });
      return;
    }

    const cleanId = id.trim();

    // 2. ISOLATED DELETION RESTRICTION ON EXACT '.doc(id)'
    const docRef = adminDb.collection('igrejas').doc(cleanId);
    const snap = await docRef.get();

    if (!snap.exists) {
      res.status(404).json({ error: 'Igreja não localizada na coleção canônica igrejas.' });
      return;
    }

    await docRef.delete();

    res.status(200).json({ success: true, id: cleanId, message: 'Igreja filiada excluída com sucesso.' });
  } catch (error: any) {
    console.error('[DELETAR_IGREJA_ERR]', error);
    res.status(500).json({ error: 'Falha ao excluir igreja filiada.', details: error?.message });
  }
}

export async function listarIgrejas(_req: Request, res: Response): Promise<void> {
  try {
    const snap = await adminDb.collection('igrejas').limit(100).get();
    if (snap.empty) {
      res.status(200).json([]);
      return;
    }

    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.status(200).json(docs);
  } catch (error: any) {
    console.error('[LISTAR_IGREJAS_ERR]', error);
    res.status(500).json({ error: 'Falha ao buscar lista de igrejas filiadas.', details: error?.message });
  }
}
