import { Router, Request, Response } from 'express';
import { adminDb } from './firebaseAdmin';
import { emitirDocumentoOficial } from './documentService';
import { buscarProntuarioMinistro, formatarCpf } from './certificateController';

const router = Router();

/**
 * PUBLIC REAL-TIME DOCUMENT VALIDATION ENDPOINT
 * GET /api/validar/:codigo
 * Unauthenticated, read-only endpoint with live compliance verification against the minister's record.
 */
router.get('/validar/:codigo', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawCodigo = req.params.codigo;
    if (!rawCodigo || typeof rawCodigo !== 'string' || rawCodigo.trim().length === 0) {
      res.status(400).json({
        valido: false,
        mensagem: 'Código de validação ausente ou em formato inválido.',
      });
      return;
    }

    const codigo = rawCodigo.trim().toUpperCase();

    // 1. Fetch document from canonical collection
    const docRef = adminDb.collection('documentos_emitidos').doc(codigo);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      // Validação de Certificado Oficial de Ordenação (/validar/cert-CPF ou código de ministro)
      if (codigo.startsWith('CERT-') || /^\d{11}$/.test(codigo)) {
        const idOuCpf = codigo.replace('CERT-', '').trim();
        const minProntuario = await buscarProntuarioMinistro(idOuCpf);
        if (minProntuario) {
          const stAdimplencia = String(minProntuario.statusAdimplencia || 'ADIMPLENTE').toUpperCase();
          const regular = stAdimplencia === 'ADIMPLENTE' || stAdimplencia === 'EM_DIA' || stAdimplencia === 'ANISTIADO';

          if (!regular) {
            res.status(200).json({
              valido: false,
              mensagem: 'Certificado de Ordenação autêntico, porém o registro ministerial encontra-se com pendência estatutária/financeira na Tesouraria.',
              documento: {
                tipoDocumento: 'CERTIFICADO_ORDENACAO',
                titulo: 'Certificado Oficial de Ordenação & Credenciamento Eclesiástico',
                codigoAutenticacao: codigo,
                ministroNome: minProntuario.nome,
                cargo: minProntuario.cargo,
                registroMinisterial: minProntuario.registroMinisterial || minProntuario.id,
              },
              ministroRegular: false,
              ministroInfo: {
                nome: minProntuario.nome,
                cargo: minProntuario.cargo,
                statusAdimplencia: stAdimplencia,
                regular: false,
              },
            });
            return;
          }

          res.status(200).json({
            valido: true,
            documento: {
              tipoDocumento: 'CERTIFICADO_ORDENACAO',
              titulo: 'Certificado Oficial de Ordenação & Credenciamento Eclesiástico',
              codigoAutenticacao: codigo,
              ministroNome: minProntuario.nome,
              cargo: minProntuario.cargo,
              registroMinisterial: minProntuario.registroMinisterial || minProntuario.id,
              cpf: formatarCpf(minProntuario.cpf || ''),
              igreja: minProntuario.igrejaFiliadaNome || minProntuario.nomeIgreja || minProntuario.igreja || 'CATEDRAL SEDE GERAL',
              dataEmissao: new Date().toLocaleDateString('pt-BR'),
            },
            ministroRegular: true,
            ministroInfo: {
              nome: minProntuario.nome,
              cargo: minProntuario.cargo,
              statusAdimplencia: stAdimplencia,
              regular: true,
            },
            mensagem: 'Certificado Oficial de Ordenação 100% autêntico e homologado junto à Convenção CIMADEBE / SIGM.',
          });
          return;
        }
      }

      res.status(404).json({
        valido: false,
        mensagem: 'Documento não encontrado ou revogado.',
      });
      return;
    }

    const docData = docSnap.data() || {};

    // 2. Query live minister document to verify current compliance in real-time
    const ministroId = docData.ministroId;
    let ministroRegular = false;
    let ministroInfo: any = null;

    if (ministroId) {
      const minSnap = await adminDb.collection('ministros').doc(ministroId).get();
      if (minSnap.exists) {
        const minData = minSnap.data() || {};
        const statusAcesso = (minData.statusAcesso || minData.status || '').toUpperCase();
        const statusAdimplencia = (minData.statusAdimplencia || '').toUpperCase();
        const adimplente = ['EM_DIA', 'ANISTIADO'].includes(statusAdimplencia);
        const ativo = statusAcesso === 'ATIVO';

        ministroRegular = ativo && adimplente;
        ministroInfo = {
          nome: minData.nome,
          cargo: minData.cargo,
          statusAcesso: minData.statusAcesso || minData.status,
          statusAdimplencia: minData.statusAdimplencia,
          regular: ministroRegular,
        };
      }
    }

    // Check expiration date
    const agora = new Date().toISOString();
    const expirado = docData.validoAte ? docData.validoAte < agora : false;

    if (expirado) {
      res.status(200).json({
        valido: false,
        expirado: true,
        mensagem: 'Documento expirado. A validade estatutária deste documento foi ultrapassada.',
        documento: docData,
        ministroRegular,
        ministroInfo,
      });
      return;
    }

    if (!ministroRegular) {
      res.status(200).json({
        valido: false,
        mensagem: 'Documento autêntico, porém o registro ministerial encontra-se suspenso ou com pendência estatutária no momento.',
        documento: docData,
        ministroRegular: false,
        ministroInfo,
      });
      return;
    }

    res.status(200).json({
      valido: true,
      documento: docData,
      ministroRegular: true,
      ministroInfo,
      mensagem: 'Documento eclesiástico 100% autêntico e regularizado junto à Convenção Estadual.',
    });
  } catch (error: any) {
    console.error('[DOC_VALIDATION_ERR]', error);
    res.status(500).json({
      valido: false,
      mensagem: 'Erro interno ao consultar base de validação criptográfica.',
      erro: error?.message || 'Erro desconhecido',
    });
  }
});

/**
 * OFFICIAL DOCUMENT EMISSION ENDPOINT
 * POST /api/documentos/emitir
 */
router.post('/documentos/emitir', async (req: Request, res: Response): Promise<void> => {
  try {
    const { ministroId, tipoDocumento, operadorEmail, tenantId, finalidade, destino } = req.body || {};

    if (!ministroId || !tipoDocumento) {
      res.status(400).json({
        erro: 'Os campos ministroId e tipoDocumento (CERTIFICADO_ORDENACAO ou CARTA_RECOMENDACAO) são obrigatórios.',
      });
      return;
    }

    const documento = await emitirDocumentoOficial({
      ministroId,
      tipoDocumento,
      operadorEmail: operadorEmail || 'secretaria@cimadebe.org.br',
      tenantId: tenantId || 't-sede-salvador',
      finalidade,
      destino,
    });

    res.status(201).json({
      sucesso: true,
      mensagem: 'Documento oficial emitido e selado com QR Code com sucesso.',
      documento,
    });
  } catch (error: any) {
    console.error('[DOC_EMISSION_ERR]', error);
    const msg = error?.message || 'Falha ao emitir documento oficial.';
    const isVeto = msg.includes('vetada') || msg.includes('Veto') || msg.includes('Compliance');
    res.status(isVeto ? 403 : 400).json({
      erro: msg,
    });
  }
});

/**
 * LIST ISSUED DOCUMENTS
 * GET /api/documentos
 */
router.get('/documentos', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await adminDb.collection('documentos_emitidos').orderBy('dataEmissao', 'desc').limit(50).get();
    const docs = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
    res.json({
      sucesso: true,
      total: docs.length,
      documentos: docs,
    });
  } catch (error: any) {
    console.error('[DOC_LIST_ERR]', error);
    res.status(500).json({
      erro: 'Falha ao consultar documentos emitidos.',
    });
  }
});

export default router;
