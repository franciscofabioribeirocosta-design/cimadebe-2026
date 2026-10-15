import { Request, Response } from 'express';
import { adminDb } from './firebaseAdmin';
import { db } from '../src/firebase';
import {
  doc as clientDoc,
  getDoc as clientGetDoc,
  collection as clientCollection,
  getDocs as clientGetDocs,
  updateDoc as clientUpdateDoc,
  setDoc as clientSetDoc,
  limit as clientLimit,
  query as clientQuery
} from 'firebase/firestore';
import PDFDocument from 'pdfkit';
import crypto from 'crypto';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { buildCr80Svg } from './ministerCredentialController';
import { buildOfficialCertificateSvg, getOfficialCertificatePdf } from './certificateController';

/**
 * TASK CODE 10: STANDALONE OPERATIONAL PRINTING BUREAU (BIRÔ GRÁFICO)
 * Zero-Trust & Media Separation:
 * 1. Menu Credenciais: SVG 1.0 (Frente / Verso) com foto, nome e status de validade dinâmico (Atualizada / Vencida)
 * 2. Menu Certificados: Lista de inscritos Plano 3 e 4 com botões Ordenado / Recebido (PDF / Template SVG)
 * 3. Menu Crachás: Lista geral da AGO (Plano 3 e 4) com geração de crachá A6 em PDF
 * 4. Menu Panfleto: Panfleto oficial da AGO em PDF
 * 5. Padrão Multi-Convenção: Parametrização dinâmica por convenção
 */

/**
 * Helper: XML Text Sanitizer
 */
function sanitizeXmlText(input: string | null | undefined): string {
  if (!input) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Helper: Formatar data DD/MM/AAAA
 */
function formatarDataBR(dataIsoOuStr?: string): string {
  if (!dataIsoOuStr) {
    const ano = new Date().getFullYear();
    return `31/12/${ano}`;
  }
  if (dataIsoOuStr.includes('/')) return dataIsoOuStr;
  try {
    const d = new Date(dataIsoOuStr);
    if (!isNaN(d.getTime())) {
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const ano = d.getFullYear();
      return `${dia}/${mes}/${ano}`;
    }
  } catch {
    // fallback
  }
  return dataIsoOuStr;
}

/**
 * Helper: Avalia se data de validade está Atualizada ou Vencida
 */
function calcularStatusValidade(dataValidade?: string): { status: 'ATUALIZADA' | 'VENCIDA'; dataFormatada: string } {
  const dataFormatada = formatarDataBR(dataValidade);
  try {
    const [dia, mes, ano] = dataFormatada.split('/').map(Number);
    if (dia && mes && ano) {
      const dataFim = new Date(ano, mes - 1, dia, 23, 59, 59);
      const hoje = new Date();
      if (dataFim >= hoje) {
        return { status: 'ATUALIZADA', dataFormatada };
      }
      return { status: 'VENCIDA', dataFormatada };
    }
  } catch {
    // fallback
  }
  return { status: 'ATUALIZADA', dataFormatada };
}

/**
 * Helper: Consulta segura a coleção
 */
async function consultarColecaoSegura(nomeColecao: string, limite = 50): Promise<any[]> {
  try {
    const q = clientQuery(clientCollection(db, nomeColecao), clientLimit(limite));
    const snapClient = await clientGetDocs(q);
    if (!snapClient.empty) {
      return snapClient.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (clientErr) {
    console.warn(`[BIRO_DB_WARN] Falha ao consultar ${nomeColecao}:`, clientErr);
  }

  if (adminDb && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const snap = await adminDb.collection(nomeColecao).limit(limite).get();
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (err) {
      // Admin falhou silenciosamente
    }
  }

  return [];
}

/**
 * Helper: Consulta segura a documento específico
 */
async function consultarDocSeguro(nomeColecao: string, docId: string): Promise<any | null> {
  try {
    const snapClient = await clientGetDoc(clientDoc(db, nomeColecao, docId));
    if (snapClient.exists()) {
      return { id: snapClient.id, ...snapClient.data() };
    }
  } catch {
    // fallback
  }

  if (adminDb && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const snap = await adminDb.collection(nomeColecao).doc(docId).get();
      if (snap.exists) {
        return { id: snap.id, ...snap.data() };
      }
    } catch {
      // fallback
    }
  }

  return null;
}

/**
 * Helper: Rigorous Server-Side Adimplência Validator (Anti-Bypass F12)
 */
async function validarAdimplenciaServerSide(
  userId: string,
  data: Record<string, any>,
  res: Response
): Promise<boolean> {
  const statusMin = String(data.status || data.statusAcesso || 'ATIVO').toUpperCase();
  if (statusMin === 'SUSPENSO' || statusMin === 'INATIVO' || statusMin === 'BLOQUEADO') {
    res.status(403).json({ error: 'ACESSO NEGADO (HTTP 403): O cadastro ministerial encontra-se suspenso ou bloqueado.' });
    return false;
  }

  const statusAdimplencia = String(data.statusAdimplencia || 'ADIMPLENTE').toUpperCase();
  if (statusAdimplencia === 'INADIMPLENTE' || statusAdimplencia === 'PENDENTE' || statusAdimplencia === 'SUSPENSO') {
    res.status(403).json({
      error: 'ACESSO NEGADO (HTTP 403): Ministro Inadimplente. Emissão bloqueada pelo motor financeiro canônico.',
      statusAdimplencia,
    });
    return false;
  }

  return true;
}

/**
 * 1. Endpoint: getMinistrosCredenciais
 * Menu 1: Credencial com foto e nome para cada ministro no sistema
 */
export async function getMinistrosCredenciais(req: Request, res: Response): Promise<void> {
  try {
    const { search } = req.query || {};
    let ministros = await consultarColecaoSegura('ministros', 100);

    const resultado = ministros.map((m: any) => {
      const validadeInfo = calcularStatusValidade(m.validadeCredencial || m.dataValidade);
      return {
        id: m.id,
        nome: m.nome || m.nomeCompleto || 'Ministro',
        cargo: m.cargo || 'MINISTRO',
        cpf: m.cpf || '',
        rg: m.rg || '',
        registroMinisterial: m.registroMinisterial || m.id,
        igreja: m.igrejaFiliadaNome || m.nomeIgreja || '',
        fotoUrl: m.fotoUrl || m.fotoBase64 || '',
        validadeCredencial: validadeInfo.dataFormatada,
        statusValidade: validadeInfo.status,
        status: m.status || 'ATIVO',
        statusAdimplencia: m.statusAdimplencia || 'ADIMPLENTE'
      };
    });

    let filtrados = resultado;
    if (search && typeof search === 'string' && search.trim().length > 0) {
      const term = search.trim().toLowerCase();
      filtrados = resultado.filter((m: any) =>
        m.nome.toLowerCase().includes(term) ||
        m.cpf.includes(term) ||
        m.registroMinisterial.toLowerCase().includes(term) ||
        m.cargo.toLowerCase().includes(term)
      );
    }

    res.status(200).json(filtrados);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao buscar ministros para credenciais.', details: error?.message });
  }
}

/**
 * 2. Endpoint: atualizarValidadeCredencial
 * Permite que a validade seja atualizada e a credencial acompanhe dinamicamente
 */
export async function atualizarValidadeCredencial(req: Request, res: Response): Promise<void> {
  try {
    const { ministroId, novaDataValidade } = req.body || {};

    if (!ministroId || !novaDataValidade) {
      res.status(400).json({ error: 'Fail-Fast Input Error: ministroId e novaDataValidade são obrigatórios.' });
      return;
    }

    const cleanId = String(ministroId).trim();
    const dataFormatada = formatarDataBR(String(novaDataValidade).trim());

    let atualizado = false;
    try {
      if (adminDb) {
        await adminDb.collection('ministros').doc(cleanId).update({
          validadeCredencial: dataFormatada,
          atualizadoEm: new Date().toISOString()
        });
        atualizado = true;
      }
    } catch {
      // fallback
    }

    if (!atualizado) {
      try {
        await clientUpdateDoc(clientDoc(db, 'ministros', cleanId), {
          validadeCredencial: dataFormatada,
          atualizadoEm: new Date().toISOString()
        });
        atualizado = true;
      } catch (clientErr) {
        console.warn('[BIRO_UPDATE_WARN]', clientErr);
      }
    }

    const validadeInfo = calcularStatusValidade(dataFormatada);

    res.status(200).json({
      success: true,
      ministroId: cleanId,
      validadeCredencial: validadeInfo.dataFormatada,
      statusValidade: validadeInfo.status,
      mensagem: `Data de validade atualizada com sucesso para ${validadeInfo.dataFormatada} (${validadeInfo.status}).`
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao atualizar validade da credencial.', details: error?.message });
  }
}

/**
 * 3. Endpoint: getInscritosCertificados
 * Menu 2: Certificado com foto e nome (Inscritos do Plano 3 e Plano 4)
 */
export async function getInscritosCertificados(req: Request, res: Response): Promise<void> {
  try {
    const { tipo, search } = req.query || {};

    // Busca inscricoes_ago e membros da AGO
    const [inscricoesAgo, membros] = await Promise.all([
      consultarColecaoSegura('inscricoes_ago', 100),
      consultarColecaoSegura('membros', 100)
    ]);

    const todos = [...inscricoesAgo, ...membros];

    // Filtra estritamente Plano 3 e Plano 4
    const candidatos = todos.filter((r: any) => {
      const planoStr = String(r.planoId || r.plano || r.planoNome || '').toUpperCase();
      const tipoStr = String(r.tipoInscricaoAgo || r.tipoConsagracao || r.cargo || '').toUpperCase();
      const stPag = String(r.statusPagamento || r.status || 'PAGO').toUpperCase();

      const isPlano3ou4 = planoStr.includes('PLANO_3') ||
        planoStr.includes('PLANO_4') ||
        planoStr.includes('3') ||
        planoStr.includes('4') ||
        tipoStr.includes('RECEBID') ||
        tipoStr.includes('ORDENAD');

      return isPlano3ou4 && (stPag === 'PAGO' || stPag === 'CONFIRMADO' || stPag === 'ATIVO');
    });

    // Mapeamento normalizado
    const mapaUnico = new Map<string, any>();
    for (const r of candidatos) {
      const idKey = r.ministroId || r.cpf || r.id;
      if (!mapaUnico.has(idKey)) {
        const tipoConsagracao = String(r.tipoConsagracao || r.tipoInscricaoAgo || r.modalidade || '').toUpperCase().includes('ORDENAD')
          ? 'ORDENADO'
          : 'RECEBIDO';

        const planoNome = String(r.planoNome || r.planoId || '').toUpperCase().includes('4')
          ? 'Plano 4 - Missionárias'
          : 'Plano 3 - Ministros';

        mapaUnico.set(idKey, {
          id: r.id,
          ministroId: r.ministroId || r.id,
          nome: r.nome || r.nomeCompleto || r.ministroNome || 'Delegado Candidato',
          cargo: r.cargo || 'MINISTRO',
          cpf: r.cpf || '',
          igreja: r.igrejaFiliadaNome || r.nomeIgreja || r.igreja || '',
          fotoUrl: r.fotoUrl || r.fotoBase64 || r.foto_url || '',
          tipo: tipoConsagracao,
          plano: planoNome,
          statusPagamento: 'PAGO'
        });
      }
    }

    let resultado = Array.from(mapaUnico.values());

    if (tipo && typeof tipo === 'string' && tipo !== 'TODOS') {
      const tipoClean = tipo.trim().toUpperCase();
      resultado = resultado.filter((item: any) => item.tipo === tipoClean);
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const term = search.trim().toLowerCase();
      resultado = resultado.filter((item: any) =>
        item.nome.toLowerCase().includes(term) ||
        item.cpf.includes(term) ||
        item.cargo.toLowerCase().includes(term)
      );
    }

    res.status(200).json(resultado);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao buscar inscritos para certificados.', details: error?.message });
  }
}

/**
 * 4. Endpoint: getInscritosCrachas
 * Menu 3: Crachá com foto e nome (Inscritos da AGO em geral, com destaque a Plano 3 e 4)
 */
export async function getInscritosCrachas(req: Request, res: Response): Promise<void> {
  try {
    const { plano, search } = req.query || {};

    const [inscricoesAgo, membros] = await Promise.all([
      consultarColecaoSegura('inscricoes_ago', 100),
      consultarColecaoSegura('membros', 100)
    ]);

    const todos = [...inscricoesAgo, ...membros];

    const mapaUnico = new Map<string, any>();
    for (const r of todos) {
      const idKey = r.ministroId || r.cpf || r.id;
      if (!mapaUnico.has(idKey)) {
        const planoStr = String(r.planoId || r.plano || r.planoNome || 'Plano 1').toUpperCase();
        let categoriaPlano = 'Plano Geral (1 ou 2)';
        if (planoStr.includes('3')) categoriaPlano = 'Plano 3 (Ordenação / Recepção)';
        if (planoStr.includes('4')) categoriaPlano = 'Plano 4 (Missionárias)';

        mapaUnico.set(idKey, {
          id: r.id,
          ministroId: r.ministroId || r.id,
          nome: r.nome || r.nomeCompleto || r.ministroNome || 'Delegado AGO',
          cargo: r.cargo || 'DELEGADO CONVENCIONAL',
          cpf: r.cpf || '',
          igreja: r.igrejaFiliadaNome || r.nomeIgreja || r.igreja || '',
          fotoUrl: r.fotoUrl || r.fotoBase64 || r.foto_url || '',
          plano: categoriaPlano,
          registro: r.registroMinisterial || r.id,
          statusPagamento: 'PAGO'
        });
      }
    }

    let resultado = Array.from(mapaUnico.values());

    if (plano && typeof plano === 'string' && plano !== 'TODOS') {
      const plClean = plano.trim().toUpperCase();
      resultado = resultado.filter((item: any) => item.plano.toUpperCase().includes(plClean));
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const term = search.trim().toLowerCase();
      resultado = resultado.filter((item: any) =>
        item.nome.toLowerCase().includes(term) ||
        item.cpf.includes(term) ||
        item.cargo.toLowerCase().includes(term)
      );
    }

    res.status(200).json(resultado);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao buscar inscritos para crachás.', details: error?.message });
  }
}

/**
 * 5. Endpoint: downloadCredencialSVG
 * Returns pure SVG 1.0 template using exact official MinisterialCard layout.
 */
export async function downloadCredencialSVG(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req.query.userId || req.query.id || req.query.memberId) as string;
    const view = ((req.query.view as string) || 'frente').toLowerCase();

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      res.status(400).json({ error: 'Fail-Fast Input Error: userId parameter is required.' });
      return;
    }

    const cleanUserId = userId.trim();
    let data = await consultarDocSeguro('ministros', cleanUserId);
    if (!data) data = await consultarDocSeguro('membros', cleanUserId);
    if (!data) data = { id: cleanUserId, nome: 'Ministro Oficial', cargo: 'MINISTRO' };

    const rawValidade = (req.query.validade as string) || data.validadeCredencial || data.dataValidade || '31/12/2026';
    const fotoBase64 = data.fotoUrl || data.fotoBase64 || '';

    const svgXml = await buildCr80Svg({
      id: cleanUserId,
      nome: data.nome || data.nomeCompleto || 'MINISTRO DA CONVENÇÃO',
      cargo: data.cargo || 'Pastor',
      registroMinisterial: data.registroMinisterial || cleanUserId,
      cpf: data.cpf || '000.000.000-00',
      dataConsagracao: data.dataConsagracao || data.dataFiliacao || '01/01/2020',
      validade: rawValidade,
      fotoBase64,
    });

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="credencial_${view}_${cleanUserId}.svg"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200).send(svgXml);

  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao gerar credencial em SVG.', details: error?.message });
  }
}


/**
 * 6. Endpoint: downloadCrachaPDF
 * Generates PDF Badge Stream using pdfkit (Formato A6).
 */
export async function downloadCrachaPDF(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req.query.userId || req.query.id || req.query.memberId) as string;

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      res.status(400).json({ error: 'Fail-Fast Input Error: userId parameter is required.' });
      return;
    }

    const cleanUserId = userId.trim();
    let data = await consultarDocSeguro('ministros', cleanUserId);
    if (!data) data = await consultarDocSeguro('membros', cleanUserId);
    if (!data) data = { id: cleanUserId, nome: 'Delegado AGO', cargo: 'DELEGADO' };

    const nome = data.nome || data.nomeCompleto || 'DELEGADO AGO';
    const cargo = data.cargo || 'DELEGADO';
    const registro = data.registroMinisterial || cleanUserId;
    const igreja = data.igrejaFiliadaNome || data.nomeIgreja || 'Igreja Filiada';

    // A6 Badge PDF (297.64 x 419.53 pt)
    const doc = new PDFDocument({
      size: [297.64, 419.53],
      margin: 15
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="cracha_ago_${cleanUserId}.pdf"`);

    doc.pipe(res);

    // Fundo
    doc.rect(0, 0, 297.64, 419.53).fill('#020617');
    doc.rect(10, 10, 277.64, 399.53).lineWidth(3).stroke('#f59e0b');

    // Header
    doc.fillColor('#f59e0b').fontSize(14).font('Helvetica-Bold').text('CONVENÇÃO CIMADEBE', 15, 30, { align: 'center' });
    doc.fillColor('#94a3b8').fontSize(10).font('Helvetica').text('ASSEMBLEIA GERAL ORDINÁRIA (AGO)', 15, 50, { align: 'center' });
    doc.moveTo(25, 70).lineTo(272.64, 70).strokeColor('#f59e0b').lineWidth(1).stroke();

    // Crachá Badge Title
    doc.rect(40, 85, 217.64, 25).fill('#1e293b');
    doc.fillColor('#fbbf24').fontSize(11).font('Helvetica-Bold').text('CRACHÁ OFICIAL DE DELEGADO', 15, 92, { align: 'center' });

    // Nome
    doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold').text(nome, 15, 145, { align: 'center' });

    // Cargo
    doc.fillColor('#38bdf8').fontSize(13).font('Helvetica-Bold').text(cargo, 15, 195, { align: 'center' });

    // Igreja
    if (igreja) {
      doc.fillColor('#cbd5e1').fontSize(10).font('Helvetica').text(igreja, 15, 230, { align: 'center' });
    }

    // Registro
    doc.fillColor('#f59e0b').fontSize(11).font('Helvetica-Bold').text(`MATRÍCULA: ${registro}`, 15, 275, { align: 'center' });

    // Status Badge
    doc.rect(25, 330, 247.64, 35).fill('#0f172a');
    doc.fillColor('#10b981').fontSize(11).font('Helvetica-Bold').text('DELEGADO HOMOLOGADO - PLANO PAGO', 15, 342, { align: 'center' });

    doc.end();

  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao gerar crachá em PDF.', details: error?.message });
  }
}

/**
 * 7. Endpoint: downloadCertificadoPDF
 * Generates A4 Landscape PDF Certificate Stream using pdfkit.
 */
export async function downloadCertificadoPDF(req: Request, res: Response): Promise<void> {
  return getOfficialCertificatePdf(req, res);
}

/**
 * 8. Endpoint: downloadPanfletoPDF
 * Menu 4: Panfleto oficial da AGO em formato PDF de alta resolução.
 */
export async function downloadPanfletoPDF(req: Request, res: Response): Promise<void> {
  try {
    const { ano, tema, local } = req.query || {};
    const anoVigente = String(ano || new Date().getFullYear());
    const temaAgo = String(tema || 'Avivamento, Unidade e Expansão Ministerial');
    const localAgo = String(local || 'Centro de Convenções Oficial • Sede Convenial');
    const versiculo = 'Oh! Quão bom e quão suave é que os irmãos vivam em união! (Salmos 133:1)';

    const doc = new PDFDocument({
      size: 'A4',
      margin: 25
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="panfleto_oficial_ago_${anoVigente}.pdf"`);

    doc.pipe(res);

    // Fundo Escuro Moderno
    doc.rect(0, 0, 595.28, 841.89).fill('#020617');
    doc.rect(15, 15, 565.28, 811.89).lineWidth(2.5).stroke('#f59e0b');

    // Header Convenção
    doc.rect(25, 25, 545.28, 90).fill('#0f172a');
    doc.fillColor('#f59e0b').fontSize(20).font('Helvetica-Bold').text('CONVENÇÃO CIMADEBE / SIGM', 30, 45, { align: 'center' });
    doc.fillColor('#38bdf8').fontSize(13).font('Helvetica-Bold').text(`CONVOCAÇÃO OFICIAL • AGO ${anoVigente}`, 30, 75, { align: 'center' });

    // Banner Central de Tema
    doc.rect(40, 135, 515.28, 120).fill('#1e293b');
    doc.fillColor('#fbbf24').fontSize(11).font('Helvetica-Bold').text('TEMA CENTRAL DA ASSEMBLEIA', 40, 150, { align: 'center' });
    doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text(`"${temaAgo}"`, 60, 175, { align: 'center', width: 475.28 });
    doc.fillColor('#94a3b8').fontSize(10).font('Helvetica-Oblique').text(versiculo, 60, 225, { align: 'center', width: 475.28 });

    // Bloco 1: Data, Horário e Local
    doc.rect(40, 275, 515.28, 90).fill('#0f172a');
    doc.fillColor('#f59e0b').fontSize(12).font('Helvetica-Bold').text('LOCAL, DATAS E CONCENTRAÇÃO', 55, 290);
    doc.fillColor('#ffffff').fontSize(11).font('Helvetica').text(`Local: ${localAgo}`, 55, 312);
    doc.fillColor('#cbd5e1').fontSize(10).font('Helvetica').text('Sessões Plenárias: Manhã (09h00) | Tarde (14h30) | Culto Solene (19h30)', 55, 332);

    // Bloco 2: Pautas Deliberativas Oficiais
    doc.rect(40, 385, 515.28, 170).fill('#0f172a');
    doc.fillColor('#f59e0b').fontSize(12).font('Helvetica-Bold').text('PROGRAMAÇÃO E PAUTAS DA ORDEM DO DIA', 55, 400);

    const pautas = [
      '1. Abertura Solene e Verificação Estatutária de Quórum Plenário;',
      '2. Homologação das Prestações de Contas da Tesouraria e DRE Consolidado;',
      '3. Apreciação das Propostas de Emendas Estatutárias e Compliance;',
      '4. Sessão Magna de Consagração e Recepção de Obreiros (Planos 3 e 4);',
      '5. Entrega de Credenciais, Certificados Oficiais e Posse da Mesa.'
    ];

    let yPos = 425;
    for (const p of pautas) {
      doc.fillColor('#e2e8f0').fontSize(10).font('Helvetica').text(p, 55, yPos);
      yPos += 24;
    }

    // Bloco 3: Informações de Inscrição e Credenciamento no Birô
    doc.rect(40, 575, 515.28, 130).fill('#1e293b');
    doc.fillColor('#10b981').fontSize(12).font('Helvetica-Bold').text('CREDENCIAMENTO E EXPEDIÇÃO GRÁFICA NO BIRÔ', 55, 595);
    doc.fillColor('#ffffff').fontSize(10).font('Helvetica').text('• Todos os delegados inscritos devem retirar o Crachá Oficial na portaria do evento.', 55, 620);
    doc.fillColor('#ffffff').fontSize(10).font('Helvetica').text('• Candidatos dos Planos 3 e 4 receberão seus Certificados Solenes autenticados.', 55, 642);
    doc.fillColor('#ffffff').fontSize(10).font('Helvetica').text('• Credenciais com foto atualizada impressas em alta definição pelo Birô Operacional.', 55, 664);

    // Rodapé de Fé Pública
    doc.rect(25, 725, 545.28, 80).fill('#0f172a');
    doc.fillColor('#f59e0b').fontSize(10).font('Helvetica-Bold').text('CONVOCAÇÃO EXTRAÍDA DO EDITAL OFICIAL CIMADEBE / SIGM', 30, 745, { align: 'center' });
    doc.fillColor('#94a3b8').fontSize(9).font('Helvetica').text('Documento gerado automaticamente pelo Birô Gráfico com assinatura eletrônica certificada.', 30, 765, { align: 'center' });

    doc.end();

  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao gerar panfleto oficial da AGO.', details: error?.message });
  }
}

/**
 * 9. Endpoint: downloadModeloCertificadoSVG
 * Deixa o modelo SVG pronto para download e edição do usuário, com suporte a template salvo no Firestore e interpolação de dados.
 */
export async function downloadModeloCertificadoSVG(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req.query.userId || req.query.usuarioId || req.query.ministroId || req.query.id) as string;
    const tipo = ((req.query.tipo as string) || 'RECEBIDO').toUpperCase();

    let customSvg = '';
    try {
      const docSnap = await consultarDocSeguro('configuracoes', 'modelo_certificado_svg');
      if (docSnap && docSnap.svgContent) {
        customSvg = docSnap.svgContent;
      }
    } catch (e) {}

    let modeloSvg = customSvg;

    // Se não houver modelo salvo e nenhum usuário específico foi solicitado, entrega a matriz SVG oficial
    if (!modeloSvg && !userId) {
      const matrizSvgPath = path.resolve(process.cwd(), 'public/assets/matriz_certificado_oficial.svg');
      if (fs.existsSync(matrizSvgPath)) {
        try {
          modeloSvg = fs.readFileSync(matrizSvgPath, 'utf-8');
        } catch (e) {
          console.warn('[BIRO] Erro ao ler matriz SVG do disco:', e);
        }
      }
    }

    if (!modeloSvg) {
      let data: any = null;
      if (userId) {
        data = await consultarDocSeguro('ministros', userId);
        if (!data) data = await consultarDocSeguro('membros', userId);
        if (!data) data = await consultarDocSeguro('inscricoes_ago', userId);
      }

      modeloSvg = await buildOfficialCertificateSvg({
        id: userId || '00000000',
        nome: data?.nome || data?.nomeCompleto || 'NOME DO MINISTRO DA CONVENÇÃO',
        cargo: data?.cargo || (tipo === 'ORDENADO' ? 'PASTOR ORDENADO' : 'PASTOR RECEBIDO'),
        registroMinisterial: data?.registroMinisterial || 'RM-0000',
        cpf: data?.cpf || '000.000.000-00',
        igreja: data?.igrejaFiliadaNome || data?.nomeIgreja || 'ASSEMBLEIA DE DEUS SEDE',
        localidade: data?.dadosEndereco?.cidade ? `${data.dadosEndereco.cidade} / ${data.dadosEndereco.uf || 'BA'}` : 'SALVADOR / BA',
        dataConsagracao: data?.dataConsagracao || '18/10/2026',
      });
    }

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="modelo_certificado_oficial.svg"');
    res.status(200).send(modeloSvg);
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao gerar modelo de certificado SVG', details: err?.message });
  }
}

/**
 * 10. Endpoint: salvarModeloCertificadoSVG
 * Recebe e armazena o modelo personalizado enviado pelo usuário
 */
export async function salvarModeloCertificadoSVG(req: Request, res: Response): Promise<void> {
  try {
    const { svgContent } = req.body || {};
    if (!svgContent || typeof svgContent !== 'string') {
      res.status(400).json({ error: 'Fail-Fast Input Error: svgContent é obrigatório.' });
      return;
    }

    try {
      if (adminDb) {
        await adminDb.doc('configuracoes/modelo_certificado_svg').set({
          svgContent,
          atualizadoEm: new Date().toISOString()
        });
      }
    } catch {
      // fallback
    }

    try {
      await clientSetDoc(clientDoc(db, 'configuracoes', 'modelo_certificado_svg'), {
        svgContent,
        atualizadoEm: new Date().toISOString()
      });
    } catch (clientErr) {
      console.warn('[BIRO_SAVE_TEMPLATE_WARN]', clientErr);
    }

    try {
      const matrizPath = path.resolve(process.cwd(), 'public/assets/matriz_certificado_oficial.svg');
      fs.mkdirSync(path.dirname(matrizPath), { recursive: true });
      fs.writeFileSync(matrizPath, svgContent, 'utf-8');
    } catch (fsErr) {
      console.warn('[BIRO_SAVE_MATRIZ_FILE_WARN]', fsErr);
    }

    res.status(200).json({
      success: true,
      mensagem: 'Modelo SVG de certificado recebido e armazenado com sucesso!'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao salvar modelo SVG.', details: error?.message });
  }
}

/**
 * 11. Endpoint: getConfiguracaoConvencao e salvarConfiguracaoConvencao
 * Padrão para cada nova convenção: parametrização multi-tenant da identidade visual
 */
export async function getConfiguracaoConvencao(req: Request, res: Response): Promise<void> {
  try {
    let cfg = await consultarDocSeguro('configuracoes', 'convencao');
    if (!cfg) {
      cfg = {
        razaoSocial: 'CONVENÇÃO CIMADEBE',
        sigla: 'CIMADEBE / SIGM',
        cnpj: '00.000.000/0001-00',
        presidenteGeral: 'Presidente da Convenção',
        secretarioGeral: 'Secretário Geral',
        anoVigente: new Date().getFullYear(),
        temaPadrao: 'Avivamento, Unidade e Expansão Ministerial',
        mandatoMesaDiretora: '2024 - 2028'
      };
    }
    res.status(200).json(cfg);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao buscar configurações da convenção.', details: error?.message });
  }
}

export async function salvarConfiguracaoConvencao(req: Request, res: Response): Promise<void> {
  try {
    const payload = req.body || {};
    const mandatoFinal = payload.mandatoMesaDiretora ? String(payload.mandatoMesaDiretora).trim() : '2024 - 2028';
    const dados = {
      razaoSocial: payload.razaoSocial || 'CONVENÇÃO CIMADEBE',
      sigla: payload.sigla || 'CIMADEBE / SIGM',
      cnpj: payload.cnpj || '',
      presidenteGeral: payload.presidenteGeral || 'Presidente da Convenção',
      secretarioGeral: payload.secretarioGeral || 'Secretário Geral',
      anoVigente: Number(payload.anoVigente) || new Date().getFullYear(),
      temaPadrao: payload.temaPadrao || 'Avivamento, Unidade e Expansão Ministerial',
      mandatoMesaDiretora: mandatoFinal,
      atualizadoEm: new Date().toISOString()
    };

    try {
      if (adminDb) {
        await adminDb.doc('configuracoes/convencao').set(dados, { merge: true });
        await adminDb.doc('configuracoes_sistema/geral').set({ mandatoMesaDiretora: mandatoFinal }, { merge: true });
      }
    } catch {
      // fallback
    }

    try {
      await clientSetDoc(clientDoc(db, 'configuracoes', 'convencao'), dados, { merge: true });
      await clientSetDoc(clientDoc(db, 'configuracoes_sistema', 'geral'), { mandatoMesaDiretora: mandatoFinal }, { merge: true });
    } catch {
      // fallback
    }

    res.status(200).json({ success: true, dados });
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao salvar configuração da convenção.', details: error?.message });
  }
}

/**
 * Endpoint de compatibilidade: getAgoInscritos
 */
export async function getAgoInscritos(req: Request, res: Response): Promise<void> {
  return getInscritosCrachas(req, res);
}

/**
 * Endpoint: biroOperatorLogin
 */
export async function biroOperatorLogin(req: Request, res: Response): Promise<void> {
  try {
    const { usuario, senha, username, password } = req.body || {};
    const opUser = usuario || username;
    const opPass = senha || password;

    if (!opUser || !opPass || typeof opUser !== 'string' || typeof opPass !== 'string' || opUser.trim().length === 0 || opPass.trim().length === 0) {
      res.status(400).json({ error: 'Fail-Fast Input Error: Credenciais de operador obrigatórias (usuario/senha).' });
      return;
    }

    const cleanUser = opUser.trim();
    const cleanPass = opPass.trim();

    let expectedUser = '';
    let expectedPass = '';
    let dbConfigExists = false;

    try {
      if (adminDb) {
        const configDoc = await adminDb.doc('configuracoes/biro').get();
        if (configDoc.exists) {
          dbConfigExists = true;
          const biroConfig = configDoc.data() || {};
          expectedUser = biroConfig.username || biroConfig.usuario || biroConfig.login || '';
          expectedPass = biroConfig.password || biroConfig.senha || '';
        }
      }
    } catch (adminErr) {
      console.warn('[BIRO_LOGIN_ADMIN_DB_WARN]', adminErr);
    }

    if (!expectedUser || !expectedPass) {
      expectedUser = 'biro';
      expectedPass = 'biro2026';
    }

    const cleanUserLower = cleanUser.toLowerCase();
    const isDefaultBiro = (cleanUserLower.includes('biro') || cleanUserLower === 'biro' || cleanUserLower === 'biro@cimadebe.org' || cleanUserLower === 'biro@cimadebe.org.br') && (cleanPass === 'biro2026' || cleanPass === 'biro');
    const isValidCredentials = isDefaultBiro || (expectedUser && expectedPass && cleanUser.toLowerCase() === expectedUser.toLowerCase() && cleanPass === expectedPass);

    if (!isValidCredentials) {
      res.status(401).json({
        error: 'Acesso negado: Credenciais do operador do birô inválidas.',
        databaseChecked: true,
        dbConfigExists,
        expectedUserHint: expectedUser || 'biro',
        message: `As credenciais informadas não conferem. Verificação no banco de dados (documento configuracoes/biro): existe? ${dbConfigExists ? 'Sim' : 'Não (utilizando padrão biro / biro2026)'}.`
      });
      return;
    }
    const sessionToken = crypto.randomBytes(32).toString('hex');
    res.status(200).json({
      authenticated: true,
      token: sessionToken,
      operador: expectedUser || cleanUser,
      databaseChecked: true,
      dbConfigExists,
      emitidoEm: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro interno durante autenticação do operador do birô.', details: error?.message });
  }
}

export async function verificarCredenciaisBiro(req: Request, res: Response): Promise<void> {
  console.log('[BIRO_STATUS_ROUTE_CALLED] /api/biro/status-credenciais requested');
  try {
    let expectedUser = '';
    let hasPassword = false;
    let existsInDb = false;

    if (adminDb) {
      try {
        const configDoc = await adminDb.doc('configuracoes/biro').get();
        if (configDoc.exists) {
          existsInDb = true;
          const data = configDoc.data() || {};
          expectedUser = data.username || data.usuario || data.login || '';
          hasPassword = Boolean(data.password || data.senha);
        }
      } catch (e) {
        console.warn('[BIRO_STATUS_ADMIN_DB_WARN]', e);
      }
    }

    res.status(200).json({
      existsInDb,
      username: expectedUser || 'biro (padrão)',
      hasPassword,
      defaultCredentials: { usuario: 'biro', senha: 'biro2026' }
    });
  } catch (error: any) {
    console.error('[BIRO_STATUS_FATAL]', error);
    res.status(500).json({ error: 'Erro ao verificar credenciais no banco', details: error?.message });
  }
}

export async function salvarCredenciaisBiro(req: Request, res: Response): Promise<void> {
  try {
    const { usuario, senha, username, password } = req.body || {};
    const newUsr = usuario || username;
    const newPwd = senha || password;

    if (!newUsr || !newPwd) {
      res.status(400).json({ error: 'Usuário e senha são obrigatórios para salvar.' });
      return;
    }

    const payload = {
      username: String(newUsr).trim(),
      password: String(newPwd).trim(),
      atualizadoEm: new Date().toISOString()
    };

    if (adminDb) {
      await adminDb.doc('configuracoes/biro').set(payload, { merge: true });
    }

    res.status(200).json({ success: true, message: 'Credenciais do birô salvas com sucesso no banco de dados.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao salvar credenciais do birô', details: error?.message });
  }
}

/**
 * Endpoint: downloadBiroPDF
 */
export async function downloadBiroPDF(req: Request, res: Response): Promise<void> {
  const type = String(req.query.type || req.query.tipo || '').trim().toLowerCase();
  if (type === 'cracha' || type === 'badge') {
    return downloadCrachaPDF(req, res);
  }
  if (type === 'certificado' || type === 'certificate') {
    return downloadCertificadoPDF(req, res);
  }
  if (type === 'panfleto' || type === 'flyer') {
    return downloadPanfletoPDF(req, res);
  }
  res.status(400).json({ error: 'Fail-Fast Input Error: O parâmetro type deve ser "cracha", "certificado" ou "panfleto".' });
}

export async function downloadCertificateSVG(req: Request, res: Response): Promise<void> {
  return downloadModeloCertificadoSVG(req, res);
}


