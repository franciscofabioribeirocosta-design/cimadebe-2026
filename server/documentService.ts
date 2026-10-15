import crypto from 'crypto';
import { adminDb } from './firebaseAdmin';

export interface EmitirDocumentoInput {
  ministroId: string;
  tipoDocumento: 'CERTIFICADO_ORDENACAO' | 'CARTA_RECOMENDACAO';
  operadorEmail: string;
  tenantId: string;
  finalidade?: string;
  destino?: string;
}

export interface DocumentoEmitidoData {
  codigoValidacao: string;
  ministroId: string;
  ministroNome: string;
  ministroCpf: string;
  cargo: string;
  tipoDocumento: 'CERTIFICADO_ORDENACAO' | 'CARTA_RECOMENDACAO';
  tituloDocumento: string;
  dataEmissao: string;
  validoAte: string;
  emitidoPor: string;
  tenantId: string;
  statusNoMomento: string;
  hashIntegridade: string;
  finalidade?: string;
  destino?: string;
  qrCodeUrl: string;
}

/**
 * PILLAR 1: MÓDULO DE DOCUMENTOS OFICIAIS COM VALIDAÇÃO PÚBLICA VIA QR CODE
 * Emissão estrita com verificação de elegibilidade canônica e selo criptográfico SHA-256.
 */
export async function emitirDocumentoOficial(input: EmitirDocumentoInput): Promise<DocumentoEmitidoData> {
  const { ministroId, tipoDocumento, operadorEmail, tenantId } = input;

  // 1. STRICT CANON ELIGIBILITY CHECK
  if (!ministroId || typeof ministroId !== 'string') {
    throw new Error('Fail-Fast: O identificador do ministro (ministroId) é obrigatório.');
  }

  if (!tipoDocumento || !['CERTIFICADO_ORDENACAO', 'CARTA_RECOMENDACAO'].includes(tipoDocumento)) {
    throw new Error('Fail-Fast: Tipo de documento inválido. Permitidos: CERTIFICADO_ORDENACAO ou CARTA_RECOMENDACAO.');
  }

  if (!operadorEmail || typeof operadorEmail !== 'string') {
    throw new Error('Fail-Fast: E-mail do operador emissor é obrigatório para conformidade de auditoria.');
  }

  // Fetch minister record strictly from ministros/${input.ministroId}
  const minDoc = await adminDb.collection('ministros').doc(ministroId).get();
  if (!minDoc.exists) {
    throw new Error(`Registro não encontrado: Nenhum ministro localizado com a chave [${ministroId}].`);
  }

  const minData = minDoc.data() || {};

  // Validação de status ativo
  const statusAcesso = (minData.statusAcesso || minData.status || '').toUpperCase();
  if (statusAcesso !== 'ATIVO') {
    throw new Error(`Emissão vetada: O ministro ${minData.nome || ministroId} está com status ministerial [${statusAcesso}], impedindo a emissão de documentos oficiais.`);
  }

  // Validação estrita de adimplência
  const statusAdimplencia = (minData.statusAdimplencia || '').toUpperCase();
  const adimplenciasPermitidas = ['EM_DIA', 'ANISTIADO'];
  if (!adimplenciasPermitidas.includes(statusAdimplencia)) {
    throw new Error(
      `Veto de Compliance Contábil: O ministro ${minData.nome || ministroId} encontra-se com status financeiro [${statusAdimplencia || 'INDEFINIDO'}]. Apenas obreiros 'EM_DIA' ou 'ANISTIADO' podem receber documentos oficiais com QR Code.`
    );
  }

  // 2. CRYPTOGRAPHIC IDENTIFIER GENERATION
  const now = new Date();
  const nowIso = now.toISOString();
  const hashPayload = `${ministroId}|${tipoDocumento}|${nowIso}`;
  const sha256 = crypto.createHash('sha256').update(hashPayload).digest('hex');
  const hashSegment = sha256.substring(0, 8).toUpperCase();

  const prefixo = tipoDocumento === 'CERTIFICADO_ORDENACAO' ? 'CERT' : 'REC';
  const codigoValidacao = `DOC-${prefixo}-${now.getFullYear()}-${hashSegment}`;

  // Validade: Certificado de Ordenação (5 anos) | Carta de Recomendação (90 dias estatutários)
  const diasValidade = tipoDocumento === 'CERTIFICADO_ORDENACAO' ? 365 * 5 : 90;
  const validoAteDate = new Date(now.getTime() + diasValidade * 24 * 60 * 60 * 1000);
  const validoAteIso = validoAteDate.toISOString();

  const tituloDocumento = tipoDocumento === 'CERTIFICADO_ORDENACAO'
    ? 'Certificado Oficial de Ordenação e Consagração Ministerial'
    : 'Carta Oficial de Recomendação & Regularidade Ministerial';

  const docData: DocumentoEmitidoData = {
    codigoValidacao,
    ministroId,
    ministroNome: String(minData.nome || 'Ministro Homologado').trim(),
    ministroCpf: String(minData.cpf || '').trim(),
    cargo: String(minData.cargo || 'Ministro do Evangelho').trim(),
    tipoDocumento,
    tituloDocumento,
    dataEmissao: nowIso,
    validoAte: validoAteIso,
    emitidoPor: operadorEmail.trim(),
    tenantId: tenantId || minData.tenantId || 't-sede-salvador',
    statusNoMomento: statusAdimplencia,
    hashIntegridade: sha256,
    finalidade: input.finalidade ? String(input.finalidade).trim() : undefined,
    destino: input.destino ? String(input.destino).trim() : undefined,
    qrCodeUrl: `/validar/${codigoValidacao}`,
  };

  // 3. PERSISTENCE IN FIRESTORE
  const batch = adminDb.batch();

  // Save under collection documentos_emitidos/${codigoValidacao}
  const docRef = adminDb.collection('documentos_emitidos').doc(codigoValidacao);
  batch.set(docRef, docData);

  // Concurrent audit log entry
  const auditRef = adminDb.collection('audit_logs').doc(`log-doc-${Date.now()}-${hashSegment}`);
  batch.set(auditRef, {
    id: `log-doc-${Date.now()}-${hashSegment}`,
    timestamp: nowIso,
    tenantId: docData.tenantId,
    operador: operadorEmail,
    operadorId: operadorEmail,
    acao: 'EMISSAO_DOCUMENTO_OFICIAL',
    detalhes: `Documento ${tipoDocumento} emitido com selo QR Code [${codigoValidacao}] para o ministro ${docData.ministroNome} (CPF: ${docData.ministroCpf}). Hash: ${sha256}`,
    hashIntegridade: sha256,
  });

  await batch.commit();

  return docData;
}
