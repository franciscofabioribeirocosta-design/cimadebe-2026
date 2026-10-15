/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção Estadual
 * Controlador de Governança Eclesiástica Estrita no Servidor (Zero-Trust)
 * 
 * Executa as 4 Cadeias Rígidas de Governança no Backend:
 * - CHAIN 1: Validação do pool de 'ministros'
 * - CHAIN 2: Validação da 'membros_mesa_diretora' e 'configuracoes/mesa_diretora'
 * - CHAIN 3: Obtenção estrita do Presidente Geral Nomeado (Zero Fallback / String vazia se não nomeado)
 * - CHAIN 4: Validação de nomeação dos operadores funcionais
 */

import { Request, Response } from 'express';
import { adminDb } from './firebaseAdmin';

/**
 * Endpoint: GET /api/governance/presidente-geral
 * Retorna o Presidente Geral nomeado oficialmente pela Mesa Diretora.
 * Se nenhum ministro for nomeado, retorna objeto com nome: "" e nomeado: false.
 * PROIBIDO categoricamente retornar o primeiro ministro cadastrado ou dados de CNPJ.
 */
export async function getPresidenteGeralOficial(_req: Request, res: Response): Promise<void> {
  try {
    // 1. Consulta estrita na coleção 'membros_mesa_diretora' ou 'configuracoes/mesa_diretora'
    const snapMesa = await adminDb.collection('membros_mesa_diretora')
      .where('cargoMesa', 'in', ['Presidente Geral', 'Presidente', 'Pastor Presidente Geral'])
      .limit(1)
      .get();

    if (snapMesa.empty) {
      res.status(200).json({
        nomeado: false,
        ministroId: '',
        nome: '',
        cargoEclesiastico: '',
        mandato: '',
        mensagem: 'Nenhum Presidente Geral nomeado formalmente pela Mesa Diretora ativa.',
      });
      return;
    }

    const docMesa = snapMesa.docs[0];
    const dataMesa = docMesa.data();
    const ministroId = dataMesa.ministroId || '';

    if (!ministroId) {
      res.status(200).json({
        nomeado: false,
        ministroId: '',
        nome: '',
        cargoEclesiastico: '',
        mandato: dataMesa.mandato || '',
        mensagem: 'Nomeação sem vínculo relacional com ministro cadastrado.',
      });
      return;
    }

    // 2. CHAIN 1: Verifica existência real do ministro no pool oficial
    const docMinistro = await adminDb.collection('ministros').doc(ministroId).get();
    if (!docMinistro.exists) {
      res.status(200).json({
        nomeado: false,
        ministroId: '',
        nome: '',
        cargoEclesiastico: '',
        mandato: dataMesa.mandato || '',
        mensagem: 'Ministro nomeado não localizado no cadastro oficial de ministros.',
      });
      return;
    }

    const dataMin = docMinistro.data() || {};

    res.status(200).json({
      nomeado: true,
      ministroId: docMinistro.id,
      nome: dataMin.nome || dataMesa.nome || '',
      cargoEclesiastico: dataMin.cargo || 'Pastor',
      cpf: dataMin.cpf || '',
      mandato: dataMesa.mandato || '',
      dataPosse: dataMesa.dataPosse || '',
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Falha ao consultar governança eclesiástica no servidor.',
      details: error?.message,
    });
  }
}

/**
 * Endpoint: POST /api/governance/validar-operador
 * Valida se um operador possui nomeação ativa e compatível para executar funções corporativas.
 */
export async function validarOperadorEclesiastico(req: Request, res: Response): Promise<void> {
  try {
    const { usuarioId, funcao } = req.body || {};

    if (!usuarioId || typeof usuarioId !== 'string') {
      res.status(400).json({ error: 'Fail-Fast: usuarioId é obrigatório.' });
      return;
    }

    const userDoc = await adminDb.collection('usuarios_administrativos').doc(usuarioId).get();
    if (!userDoc.exists) {
      res.status(404).json({ autorizado: false, error: 'Usuário administrativo não cadastrado.' });
      return;
    }

    const userData = userDoc.data() || {};
    if (userData.statusAcesso !== 'ATIVO') {
      res.status(403).json({ autorizado: false, error: 'Acesso suspenso ou inativo.' });
      return;
    }

    if (userData.role === 'SUPER_ADMIN') {
      res.status(200).json({ autorizado: true, role: 'SUPER_ADMIN' });
      return;
    }

    // Verifica nomeação na Mesa Diretora
    const ministroId = userData.ministroId || userDoc.id;
    const snapMesa = await adminDb.collection('membros_mesa_diretora')
      .where('ministroId', '==', ministroId)
      .limit(1)
      .get();

    if (snapMesa.empty) {
      res.status(403).json({
        autorizado: false,
        error: 'Operador não possui nomeação formal homologada pela Mesa Diretora ativa.',
      });
      return;
    }

    res.status(200).json({
      autorizado: true,
      membroMesa: snapMesa.docs[0].data(),
      role: userData.role,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro na validação de governança do operador.',
      details: error?.message,
    });
  }
}
