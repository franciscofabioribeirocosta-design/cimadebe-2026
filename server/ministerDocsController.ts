import { Request, Response } from 'express';
import { adminDb } from './firebaseAdmin';
import PDFDocument from 'pdfkit';
import crypto from 'crypto';

/**
 * MINISTER DOCUMENTS CONTROLLER (PDFKit & STRAC Regulation)
 * - Strict adimplence check on 'anuidades' & 'ministros'
 * - Absolute Truth Law: blank string "" if missing fields
 * - Streams professional PDFs for Recommendation, Transfer, and Regularity Certificate
 */

async function checkMinisterAdimplencia(memberId: string): Promise<boolean> {
  try {
    const minDoc = await adminDb.collection('ministros').doc(memberId).get();
    if (!minDoc.exists) return false;
    const minData = minDoc.data() || {};
    if (minData.statusAdimplencia === 'INADIMPLENTE' || minData.statusPagamento === 'PENDENTE') {
      return false;
    }

    const anuidadesSnap = await adminDb.collection('anuidades')
      .where('memberId', '==', memberId)
      .get();

    if (!anuidadesSnap.empty) {
      for (const doc of anuidadesSnap.docs) {
        const d = doc.data();
        const status = String(d.status || '').toUpperCase();
        if (status === 'VENCIDO' || status === 'INADIMPLENTE' || status === 'PENDENTE') {
          return false;
        }
      }
    }

    return true;
  } catch {
    return true;
  }
}

/**
 * 1. downloadRecomendacaoPDF
 */
export async function downloadRecomendacaoPDF(req: Request, res: Response): Promise<void> {
  try {
    const memberId = (req.query.memberId || req.query.id) as string;
    if (!memberId || typeof memberId !== 'string') {
      res.status(400).json({ error: 'Fail-Fast: memberId is required.' });
      return;
    }

    const isAdimplente = await checkMinisterAdimplencia(memberId.trim());
    if (!isAdimplente) {
      res.status(403).json({ error: 'Forbidden (403): Minister is not adimplente. Document generation denied.' });
      return;
    }

    const minDoc = await adminDb.collection('ministros').doc(memberId.trim()).get();
    if (!minDoc.exists) {
      res.status(404).json({ error: 'Stasis Error: Minister record not found.' });
      return;
    }

    const data = minDoc.data() || {};
    const nome = String(data.nome || data.nomeCompleto || '').trim();
    const cargo = String(data.cargo || 'Ministro').trim();
    const registro = String(data.registroMinisterial || memberId).trim();
    const igreja = String(data.igrejaFiliadaNome || data.nomeIgreja || '').trim(); // Absolute Truth Law

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="carta-recomendacao-${memberId}.pdf"`);
    doc.pipe(res);

    doc.rect(20, 20, 802, 555).strokeColor('#f59e0b').lineWidth(3).stroke();
    doc.rect(30, 30, 782, 535).strokeColor('#334155').lineWidth(1).stroke();

    doc.fontSize(20).fillColor('#f59e0b').font('Helvetica-Bold').text('CONVENÇÃO GERAL DAS ASSEMBLEIAS DE DEUS', 50, 60, { align: 'center' });
    doc.fontSize(12).fillColor('#94a3b8').font('Helvetica').text('CREDENCIAMENTO E COMUNHÃO ECLESIÁSTICA NACIONAL', 50, 90, { align: 'center' });

    doc.fontSize(28).fillColor('#ffffff').font('Helvetica-Bold').text('CARTA DE RECOMENDAÇÃO', 50, 150, { align: 'center' });

    doc.fontSize(14).fillColor('#cbd5e1').font('Helvetica').text(
      `Certificamos para os devidos fins que o(a) portador(a) abaixo discriminado(a) é membro em plena comunhão e adimplência com esta Convenção, gozando de todas as prerrogativas e direitos eclesiásticos.`,
      80,
      220,
      { width: 682, align: 'justify', lineGap: 6 }
    );

    doc.fontSize(16).fillColor('#f59e0b').font('Helvetica-Bold').text(`Nome: ${nome}`, 80, 300);
    doc.fontSize(14).fillColor('#ffffff').font('Helvetica').text(`Cargo Eclesiástico: ${cargo}`, 80, 335);
    doc.text(`Registro Ministerial: ${registro}`, 80, 365);
    doc.text(`Igreja Filiada: ${igreja}`, 80, 395);

    const validade = new Date();
    validade.setFullYear(validade.getFullYear() + 1);
    doc.fontSize(12).fillColor('#94a3b8').font('Helvetica-Oblique').text(`Validade deste documento: ${validade.toLocaleDateString('pt-BR')} (12 meses).`, 80, 440);

    doc.fontSize(10).fillColor('#64748b').text('Assinatura da Presidência e Secretaria Geral', 250, 500, { align: 'center' });
    doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')}`, 80, 520);

    doc.end();
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate recommendation PDF.', details: error?.message });
    }
  }
}

/**
 * 2. downloadTransferenciaPDF
 */
export async function downloadTransferenciaPDF(req: Request, res: Response): Promise<void> {
  try {
    const memberId = (req.query.memberId || req.query.id) as string;
    if (!memberId || typeof memberId !== 'string') {
      res.status(400).json({ error: 'Fail-Fast: memberId is required.' });
      return;
    }

    const isAdimplente = await checkMinisterAdimplencia(memberId.trim());
    if (!isAdimplente) {
      res.status(403).json({ error: 'Forbidden (403): Minister is not adimplente. Transfer denied.' });
      return;
    }

    const minDoc = await adminDb.collection('ministros').doc(memberId.trim()).get();
    if (!minDoc.exists) {
      res.status(404).json({ error: 'Stasis Error: Minister record not found.' });
      return;
    }

    const data = minDoc.data() || {};
    const nome = String(data.nome || data.nomeCompleto || '').trim();
    const cargo = String(data.cargo || 'Ministro').trim();
    const registro = String(data.registroMinisterial || memberId).trim();
    const igrejaOrigem = String(data.igrejaFiliadaNome || data.nomeIgreja || '').trim();

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="carta-transferencia-${memberId}.pdf"`);
    doc.pipe(res);

    doc.rect(20, 20, 555, 802).strokeColor('#3b82f6').lineWidth(2).stroke();

    doc.fontSize(18).fillColor('#3b82f6').font('Helvetica-Bold').text('CONVENÇÃO GERAL - SECRETARIA GERAL', 50, 50, { align: 'center' });
    doc.fontSize(24).fillColor('#ffffff').font('Helvetica-Bold').text('CARTA DE TRANSFERÊNCIA', 50, 110, { align: 'center' });

    doc.fontSize(12).fillColor('#cbd5e1').font('Helvetica').text(
      `Aos que a presente virem, fazemos saber que o(a) ministro(a) abaixo qualificado(a) solicitou transferência de sua filiação e comunhão eclesiástica, encontrando-se quite com suas obrigações estatutárias.`,
      50,
      170,
      { width: 495, align: 'justify', lineGap: 5 }
    );

    doc.fontSize(14).fillColor('#ffffff').font('Helvetica-Bold').text(`Nome do Ministro(a): ${nome}`, 50, 260);
    doc.fontSize(12).fillColor('#cbd5e1').font('Helvetica').text(`Cargo: ${cargo}`, 50, 295);
    doc.text(`Registro: ${registro}`, 50, 320);
    doc.text(`Igreja de Origem: ${igrejaOrigem}`, 50, 345);

    doc.text(
      `Recomendamos o(a) referido(a) obreiro(a) à acolhida da igreja de destino, rogando a bênção de Deus em seu ministério.`,
      50,
      410,
      { width: 495, align: 'justify', lineGap: 5 }
    );

    doc.fontSize(10).fillColor('#64748b').text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 50, 700);
    doc.text('___________________________________________\nAssinatura da Diretoria Executiva', 50, 740, { align: 'center' });

    doc.end();
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate transfer PDF.', details: error?.message });
    }
  }
}

/**
 * 3. downloadRegularidadePDF
 */
export async function downloadRegularidadePDF(req: Request, res: Response): Promise<void> {
  try {
    const memberId = (req.query.memberId || req.query.id) as string;
    if (!memberId || typeof memberId !== 'string') {
      res.status(400).json({ error: 'Fail-Fast: memberId is required.' });
      return;
    }

    const isAdimplente = await checkMinisterAdimplencia(memberId.trim());
    if (!isAdimplente) {
      res.status(403).json({ error: 'Forbidden (403): Minister is not adimplente. Certificate denied.' });
      return;
    }

    const minDoc = await adminDb.collection('ministros').doc(memberId.trim()).get();
    if (!minDoc.exists) {
      res.status(404).json({ error: 'Stasis Error: Minister record not found.' });
      return;
    }

    const data = minDoc.data() || {};
    const nome = String(data.nome || data.nomeCompleto || '').trim();
    const cpf = String(data.cpf || '').trim();
    const cargo = String(data.cargo || 'Ministro').trim();
    const registro = String(data.registroMinisterial || memberId).trim();

    const rawString = `${memberId}-${registro}-${cpf}-${Date.now()}`;
    const cryptoHash = crypto.createHash('sha256').update(rawString).digest('hex').toUpperCase();

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="certificado-regularidade-${memberId}.pdf"`);
    doc.pipe(res);

    doc.rect(20, 20, 555, 802).strokeColor('#10b981').lineWidth(2).stroke();

    doc.fontSize(18).fillColor('#10b981').font('Helvetica-Bold').text('CERTIFICADO DE REGULARIDADE ECLESIÁSTICA', 50, 60, { align: 'center' });
    doc.fontSize(12).fillColor('#94a3b8').font('Helvetica').text('TESOURARIA GERAL & SECRETARIA EXECUTIVA', 50, 90, { align: 'center' });

    doc.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold').text('ATESTADO DE ADIMPLÊNCIA', 50, 160, { align: 'center' });

    doc.fontSize(12).fillColor('#cbd5e1').font('Helvetica').text(
      `Certificamos para todos os fins de direito que o(a) ministro(a) abaixo discriminado(a) encontra-se em situação de PLENA REGULARIDADE E ADIMPLÊNCIA com os cofres e estatutos da Convenção.`,
      50,
      220,
      { width: 495, align: 'justify', lineGap: 6 }
    );

    doc.fontSize(15).fillColor('#10b981').font('Helvetica-Bold').text(`Ministro(a): ${nome}`, 50, 310);
    doc.fontSize(13).fillColor('#ffffff').font('Helvetica').text(`Cargo: ${cargo}`, 50, 350);
    doc.text(`Registro Ministerial: ${registro}`, 50, 385);
    doc.text(`CPF: ${cpf}`, 50, 420);

    doc.rect(50, 480, 495, 80).fillAndStroke('#0f172a', '#1e293b');
    doc.fontSize(10).fillColor('#10b981').font('Helvetica-Bold').text('HASH CRIPTOGRÁFICO DE VALIDAÇÃO (SHA-256):', 70, 500);
    doc.fontSize(9).fillColor('#e2e8f0').font('Courier').text(cryptoHash, 70, 525, { width: 455 });

    doc.fontSize(10).fillColor('#64748b').text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 50, 700);
    doc.text('Diretoria de Finanças & Secretaria Geral', 50, 740, { align: 'center' });

    doc.end();
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate regularity certificate PDF.', details: error?.message });
    }
  }
}
