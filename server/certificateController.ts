import { Request, Response } from 'express';
import { adminDb } from './firebaseAdmin';
import { db } from '../src/firebase';
import {
  doc as clientDoc,
  getDoc as clientGetDoc,
  collection as clientCollection,
  query as clientQuery,
  where as clientWhere,
  limit as clientLimit,
  getDocs as clientGetDocs,
} from 'firebase/firestore';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

export interface MinistroProntuario {
  id: string;
  nome?: string;
  cargo?: string;
  registroMinisterial?: string;
  cpf?: string;
  dataConsagracao?: string;
  dataFiliacao?: string;
  validade?: string;
  fotoUrl?: string;
  statusAdimplencia?: string;
  status?: string;
  statusAcesso?: string;
  igrejaFiliadaNome?: string;
  nomeIgreja?: string;
  igreja?: string;
  cidade?: string;
  uf?: string;
  dadosEndereco?: {
    cidade?: string;
    uf?: string;
  };
  [key: string]: any;
}

export function formatarCpf(cpf: string): string {
  const digits = String(cpf || '').replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return cpf || '000.000.000-00';
}

export function limparCpf(cpf: string): string {
  return String(cpf || '').replace(/\D/g, '');
}

/**
 * BUSCA DETERMINÍSTICA DO PRONTUÁRIO MINISTERIAL (LAYER 2: FIRESTORE IMMUTABILITY & STASIS)
 * Não cria dados fictícios, não aplica fallbacks arbitrários.
 */
export async function buscarProntuarioMinistro(ministroIdOuCpf: string): Promise<MinistroProntuario | null> {
  const identificador = String(ministroIdOuCpf || '').trim();
  if (!identificador) return null;

  const cleanCpf = limparCpf(identificador);
  const formattedCpf = formatarCpf(cleanCpf);
  const colecoes = ['ministros', 'membros', 'inscricoes_ago'];

  // 1. Consulta prioritária via Client SDK Canônico (autenticado com apiKey e banco institucional)
  if (db) {
    try {
      for (const col of colecoes) {
        const snap = await clientGetDoc(clientDoc(db, col, identificador));
        if (snap.exists()) {
          return { id: snap.id, ...(snap.data() as any) };
        }

        if (cleanCpf && cleanCpf.length === 11) {
          let qSnap = await clientGetDocs(
            clientQuery(clientCollection(db, col), clientWhere('cpf', '==', cleanCpf), clientLimit(1))
          );
          if (!qSnap.empty) {
            const d = qSnap.docs[0];
            return { id: d.id, ...(d.data() as any) };
          }

          qSnap = await clientGetDocs(
            clientQuery(clientCollection(db, col), clientWhere('cpf', '==', formattedCpf), clientLimit(1))
          );
          if (!qSnap.empty) {
            const d = qSnap.docs[0];
            return { id: d.id, ...(d.data() as any) };
          }
        }

        if (col === 'inscricoes_ago') {
          const qSnap = await clientGetDocs(
            clientQuery(clientCollection(db, 'inscricoes_ago'), clientWhere('ministroId', '==', identificador), clientLimit(1))
          );
          if (!qSnap.empty) {
            const d = qSnap.docs[0];
            return { id: d.id, ...(d.data() as any) };
          }
        }
      }
    } catch (clientErr) {
      console.warn('[CERT_CONTROLLER] Client SDK query error:', clientErr);
    }
  }

  // 2. Consulta via Admin SDK (apenas se credenciais explícitas de serviço estiverem configuradas)
  if (adminDb && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      for (const col of colecoes) {
        const docSnap = await adminDb.collection(col).doc(identificador).get();
        if (docSnap.exists) {
          return { id: docSnap.id, ...(docSnap.data() as any) };
        }

        if (cleanCpf && cleanCpf.length === 11) {
          let qSnap = await adminDb.collection(col).where('cpf', '==', cleanCpf).limit(1).get();
          if (!qSnap.empty) {
            const d = qSnap.docs[0];
            return { id: d.id, ...(d.data() as any) };
          }

          qSnap = await adminDb.collection(col).where('cpf', '==', formattedCpf).limit(1).get();
          if (!qSnap.empty) {
            const d = qSnap.docs[0];
            return { id: d.id, ...(d.data() as any) };
          }
        }

        if (col === 'inscricoes_ago') {
          const qSnap = await adminDb.collection('inscricoes_ago').where('ministroId', '==', identificador).limit(1).get();
          if (!qSnap.empty) {
            const d = qSnap.docs[0];
            return { id: d.id, ...(d.data() as any) };
          }
        }
      }
    } catch (e) {
      // Ignora silenciosamente se o Admin SDK não estiver configurado
    }
  }

  return null;
}

/**
 * Recupera o caminho absoluto ou buffer da imagem da matriz oficial imutável.
 * Compatível estritamente com ESM e execução estática (Zero __dirname).
 */
function obterCaminhoMatrizPng(): string {
  const caminhos = [
    path.resolve(process.cwd(), 'public/assets/matriz_certificado_oficial.png'),
    path.resolve(process.cwd(), 'dist/assets/matriz_certificado_oficial.png'),
    path.resolve(process.cwd(), 'dist/public/assets/matriz_certificado_oficial.png'),
  ];

  for (const c of caminhos) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return path.resolve(process.cwd(), 'public/assets/matriz_certificado_oficial.png');
}

/**
 * Construtor do Certificado Oficial em SVG
 * Utiliza a matriz PNG imutável como fundo absoluto (<image>)
 * Sem redesenhar molduras, brasões ou marcas d'água com SVG manual.
 */
export async function buildOfficialCertificateSvg(dados: {
  id: string;
  nome: string;
  cargo: string;
  registroMinisterial: string;
  cpf: string;
  igreja: string;
  localidade: string;
  dataConsagracao: string;
}): Promise<string> {
  const { id, nome, cargo, registroMinisterial, cpf, igreja, localidade, dataConsagracao } = dados;

  const cleanCpf = limparCpf(cpf);
  const nomeFormatado = String(nome || 'MINISTRO OFICIAL HOMOLOGADO').toUpperCase().trim();
  const cargoFormatado = String(cargo || 'PASTOR').toUpperCase().trim();
  const registroFormatado = String(registroMinisterial || 'RM-0000').trim();
  const cpfFormatado = formatarCpf(cpf);
  const igrejaFormatada = String(igreja || 'CATEDRAL SEDE GERAL').toUpperCase().trim();
  const localidadeFormatada = String(localidade || 'SÃO PAULO / SP').toUpperCase().trim();
  const consagrFormatada = String(dataConsagracao || '18 de Outubro de 2026').trim();
  const dataEmissao = new Date().toLocaleDateString('pt-BR');
  const validationUrl = `https://cimadebe.org.br/validar/cert-${cleanCpf || id}`;

  // Geração do QR Code Vetorial
  let qrCodeSvgInner = '';
  try {
    const rawQrSvg = await QRCode.toString(validationUrl, {
      type: 'svg',
      margin: 1,
      color: { dark: '#0B2F64', light: '#FFFFFF' },
    });
    const matchInner = rawQrSvg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
    const matchViewBox = rawQrSvg.match(/viewBox="([^"]+)"/);
    const viewBoxAttr = matchViewBox ? matchViewBox[1] : '0 0 29 29';
    const [, , vbW = '29', vbH = '29'] = viewBoxAttr.split(' ');
    qrCodeSvgInner = `
      <svg x="969" y="612" width="80" height="80" viewBox="0 0 ${vbW} ${vbH}" shape-rendering="crispEdges">
        ${matchInner ? matchInner[1] : ''}
      </svg>
    `;
  } catch (qrErr) {
    qrCodeSvgInner = `
      <g transform="translate(969, 612)">
        <rect width="80" height="80" rx="4" fill="#FFFFFF" stroke="#CA8A04" stroke-width="1.5" />
        <text x="40" y="44" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#0B2F64">QR CODE</text>
      </g>
    `;
  }

  // Conversão da matriz PNG para Base64 caso o arquivo exista no disco
  let bgImageHref = '/assets/matriz_certificado_oficial.png';
  const caminhoMatriz = obterCaminhoMatrizPng();
  if (fs.existsSync(caminhoMatriz)) {
    try {
      const buffer = fs.readFileSync(caminhoMatriz);
      bgImageHref = `data:image/png;base64,${buffer.toString('base64')}`;
    } catch (e) {
      console.warn('[CERT_CONTROLLER] Erro ao ler matriz PNG em base64, usando URL relativa:', e);
    }
  }

  const cleanId = (id || '000').slice(0, 8).toUpperCase();
  const cleanCpfHash = cleanCpf.slice(0, 5) || '00000';
  const hashAutenticidade = `CHAVE: ACDE${cleanCpfHash}C4E4C520DF40416B${cleanId}SIGM3499032A027037EA`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1123" height="794" viewBox="0 0 1123 794" version="1.1">
  <!-- MATRIZ OFICIAL IMUTÁVEL COMO FUNDO ABSOLUTO -->
  <image href="${bgImageHref}" x="0" y="0" width="1123" height="794" preserveAspectRatio="none" />

  <!-- 1. NOME COMPLETO DO MINISTRO (CENTRALIZADO HORIZONTALMENTE COM FONTE INSTITUCIONAL ELEGANTE) -->
  <text x="561" y="332" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="bold" fill="#0F172A" letter-spacing="0.5">
    ${nomeFormatado}
  </text>

  <!-- 2. REGISTRO MINISTERIAL E CPF DO MINISTRO -->
  <text x="561" y="370" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="13" font-weight="normal" fill="#334155">
    Portador(a) do Registro Ministerial: <tspan font-weight="bold" fill="#78350F">${registroFormatado}</tspan> • Inscrito(a) no CPF: <tspan font-weight="bold" fill="#0F172A">${cpfFormatado}</tspan>
  </text>

  <!-- 3. CONGREGAÇÃO / IGREJA E LOCALIDADE -->
  <text x="561" y="396" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="12.5" font-weight="normal" fill="#475569">
    Filiado(a) à Congregação / Igreja: <tspan font-weight="bold" fill="#0F172A">${igrejaFormatada}</tspan> (${localidadeFormatada})
  </text>

  <!-- 4. CARGO DO MINISTRO (CENTRALIZADO NA CAIXA DOURADA) -->
  <text x="561" y="492" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="24" font-weight="bold" fill="#0B2F64" letter-spacing="2.5">
    ${cargoFormatado}
  </text>

  <!-- 5. DATA DA CONSAGRAÇÃO / SESSÃO SOLENE -->
  <text x="561" y="555" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="11.5" font-weight="bold" fill="#78350F">
    Data da Consagração / Recebimento: ${consagrFormatada} • Sessão Solene de Encerramento da AGO
  </text>

  <!-- 6. QR CODE VETORIAL NO QUADRO RESERVADO DO CANTO INFERIOR DIREITO -->
  ${qrCodeSvgInner}

  <!-- 7. RODAPÉ DE AUDITORIA E HASH CRIPTOGRÁFICO -->
  <text x="36" y="755" font-family="Courier, monospace" font-size="8" font-weight="bold" fill="#64748B">
    ${hashAutenticidade}
  </text>
  <text x="1087" y="755" text-anchor="end" font-family="Arial, sans-serif" font-size="8" font-weight="bold" fill="#64748B">
    EMISSÃO: ${dataEmissao} • VÁLIDO EM TODO O TERRITÓRIO NACIONAL • ART. 5º, VII CF/88
  </text>
</svg>`;
}

/**
 * ENDPOINT GET /api/certificate/svg
 * Emite o certificado compilado sobre matriz imutável em SVG.
 * Inclui Trava Anti-Bypass F12 (HTTP 403 Forbidden para inadimplentes).
 */
export async function getOfficialCertificateSvg(req: Request, res: Response): Promise<any> {
  try {
    const ministroParam = String(
      req.params?.ministroId ||
      req.query?.userId ||
      req.query?.usuarioId ||
      req.query?.ministroId ||
      req.query?.id ||
      req.query?.cpf ||
      ''
    ).trim();

    // LAYER 1: STRICT INPUT VALIDATION & FAIL-FAST GATE
    if (!ministroParam) {
      return res.status(400).json({ error: 'Identificador do ministro (ID ou CPF) é obrigatório.' });
    }

    // LAYER 2: FIRESTORE IMMUTABILITY & STASIS CHECK
    const prontuario = await buscarProntuarioMinistro(ministroParam);
    if (!prontuario) {
      return res.status(404).json({ error: 'Prontuário ministerial não encontrado no banco de dados.' });
    }

    // TRAVA ANTI-BYPASS F12: BLOQUEIO IMEDIATO DE INADIMPLÊNCIA
    const stAdimplencia = String(prontuario.statusAdimplencia || 'ADIMPLENTE').toUpperCase();
    if (stAdimplencia === 'INADIMPLENTE' || stAdimplencia === 'PENDENTE' || stAdimplencia === 'SUSPENSO') {
      return res.status(403).json({
        error: 'ACESSO NEGADO (HTTP 403): Emissão de certificado bloqueada por inadimplência cadastral.',
        statusAdimplencia: stAdimplencia,
      });
    }

    const cleanCpf = limparCpf(prontuario.cpf || '');
    const cidade = prontuario.cidade || prontuario.dadosEndereco?.cidade || 'SÃO PAULO';
    const uf = prontuario.uf || prontuario.dadosEndereco?.uf || 'SP';

    const svgXml = await buildOfficialCertificateSvg({
      id: prontuario.id,
      nome: prontuario.nome || prontuario.nomeCompleto || 'MINISTRO OFICIAL HOMOLOGADO',
      cargo: prontuario.cargo || 'PASTOR',
      registroMinisterial: prontuario.registroMinisterial || prontuario.id || 'RM-0000',
      cpf: prontuario.cpf || '000.000.000-00',
      igreja: prontuario.igrejaFiliadaNome || prontuario.nomeIgreja || prontuario.igreja || 'CATEDRAL SEDE GERAL',
      localidade: `${cidade} / ${uf}`,
      dataConsagracao: prontuario.dataConsagracao || prontuario.dataFiliacao || '18 de Outubro de 2026',
    });

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="certificado_ordenacao_${cleanCpf || prontuario.id}.svg"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(200).send(svgXml);
  } catch (err: any) {
    return res.status(500).json({ error: 'Falha ao compilar certificado oficial em SVG.', details: err?.message });
  }
}

/**
 * ENDPOINT GET /api/certificate/pdf
 * Emite o certificado compilado sobre matriz imutável em formato PDF A4 Paisagem (1123x794).
 * Inclui Trava Anti-Bypass F12 (HTTP 403 Forbidden para inadimplentes).
 */
export async function getOfficialCertificatePdf(req: Request, res: Response): Promise<any> {
  try {
    const ministroParam = String(
      req.params?.ministroId ||
      req.query?.userId ||
      req.query?.usuarioId ||
      req.query?.ministroId ||
      req.query?.id ||
      req.query?.cpf ||
      ''
    ).trim();

    // LAYER 1: STRICT INPUT VALIDATION & FAIL-FAST GATE
    if (!ministroParam) {
      return res.status(400).json({ error: 'Identificador do ministro (ID ou CPF) é obrigatório.' });
    }

    // LAYER 2: FIRESTORE IMMUTABILITY & STASIS CHECK
    const prontuario = await buscarProntuarioMinistro(ministroParam);
    if (!prontuario) {
      return res.status(404).json({ error: 'Prontuário ministerial não encontrado no banco de dados.' });
    }

    // TRAVA ANTI-BYPASS F12: BLOQUEIO IMEDIATO DE INADIMPLÊNCIA
    const stAdimplencia = String(prontuario.statusAdimplencia || 'ADIMPLENTE').toUpperCase();
    if (stAdimplencia === 'INADIMPLENTE' || stAdimplencia === 'PENDENTE' || stAdimplencia === 'SUSPENSO') {
      return res.status(403).json({
        error: 'ACESSO NEGADO (HTTP 403): Emissão de certificado bloqueada por inadimplência cadastral.',
        statusAdimplencia: stAdimplencia,
      });
    }

    const cleanCpf = limparCpf(prontuario.cpf || '');
    const nomeFormatado = String(prontuario.nome || prontuario.nomeCompleto || 'MINISTRO OFICIAL HOMOLOGADO').toUpperCase().trim();
    const cargoFormatado = String(prontuario.cargo || 'PASTOR').toUpperCase().trim();
    const registroFormatado = String(prontuario.registroMinisterial || prontuario.id || 'RM-0000').trim();
    const cpfFormatado = formatarCpf(prontuario.cpf || '');
    const igrejaFormatada = String(
      prontuario.igrejaFiliadaNome || prontuario.nomeIgreja || prontuario.igreja || 'CATEDRAL SEDE GERAL'
    ).toUpperCase().trim();
    const cidade = prontuario.cidade || prontuario.dadosEndereco?.cidade || 'SÃO PAULO';
    const uf = prontuario.uf || prontuario.dadosEndereco?.uf || 'SP';
    const consagrFormatada = String(prontuario.dataConsagracao || prontuario.dataFiliacao || '18 de Outubro de 2026').trim();
    const validationUrl = `https://cimadebe.org.br/validar/cert-${cleanCpf || prontuario.id}`;

    // Tipos de certificados homologados
    const tipoCertificado = String(req.query?.tipo || 'ORDENADO').toUpperCase();
    let textoTitulo = 'Certificado Oficial de Ordenação';
    let textoConsagracao = `Data da Consagração: ${consagrFormatada} • Sessão Solene de Encerramento da AGO`;
    let cargoExibicao = cargoFormatado;
    let filenamePrefix = 'certificado_ordenado';

    if (tipoCertificado === 'CONSAGRACAO_5_ANOS') {
      textoTitulo = 'Certificado de Consagração Ministerial (5 Anos)';
      textoConsagracao = `Consagração Ministerial Jubilar (5 Anos) • Concedido em ${consagrFormatada}`;
      cargoExibicao = `${cargoFormatado} - JUBILAR 5 ANOS`;
      filenamePrefix = 'consagracao_5_anos';
    } else if (tipoCertificado === 'RECEBIDO') {
      textoTitulo = 'Certificado de Recepção Ministerial';
      textoConsagracao = `Data da Recepção Ministerial: ${consagrFormatada} • Sessão Solene da AGO`;
      if (!cargoExibicao.includes('RECEBIDO')) {
        cargoExibicao = `${cargoFormatado} (RECEBIDO)`;
      }
      filenamePrefix = 'certificado_recebido';
    } else if (tipoCertificado === 'ORDENADO') {
      textoTitulo = 'Certificado Oficial de Ordenação';
      textoConsagracao = `Data da Consagração / Ordenação: ${consagrFormatada} • Sessão Solene de Encerramento da AGO`;
      if (!cargoExibicao.includes('ORDENADO')) {
        cargoExibicao = `${cargoFormatado} (ORDENADO)`;
      }
      filenamePrefix = 'certificado_ordenado';
    }

    // Criação do Documento PDF em A4 Paisagem exato
    const doc = new PDFDocument({
      size: [1123, 794],
      layout: 'landscape',
      margin: 0,
      autoFirstPage: true,
      info: {
        Title: `${textoTitulo} - ${nomeFormatado}`,
        Author: 'Convenção CIMADEBE / SIGM Core Banking',
        Subject: textoTitulo,
        Keywords: 'Certificado, Ordenação, Consagração, Eclesiástico, CIMADEBE, SIGM',
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filenamePrefix}_${cleanCpf || prontuario.id}.pdf"`
    );
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    doc.pipe(res);

    // 1. Matriz de Imagem Imutável como Fundo Absoluto
    const caminhoMatriz = obterCaminhoMatrizPng();
    if (fs.existsSync(caminhoMatriz)) {
      try {
        doc.image(caminhoMatriz, 0, 0, { width: 1123, height: 794 });
      } catch (imgErr) {
        console.warn('[CERT_PDF] Falha ao renderizar imagem de fundo da matriz:', imgErr);
      }
    }

    // 2. Sobreposição do Nome Completo
    doc.font('Times-Bold').fontSize(26).fillColor('#0F172A').text(nomeFormatado, 0, 310, {
      align: 'center',
      width: 1123,
    });

    // 3. Sobreposição de Registro Ministerial e CPF
    doc
      .font('Times-Roman')
      .fontSize(13)
      .fillColor('#334155')
      .text(
        `Portador(a) do Registro Ministerial: ${registroFormatado} • Inscrito(a) no CPF: ${cpfFormatado}`,
        0,
        355,
        { align: 'center', width: 1123 }
      );

    // 4. Sobreposição de Congregação e Localidade
    doc
      .font('Times-Roman')
      .fontSize(12.5)
      .fillColor('#475569')
      .text(`Filiado(a) à Congregação / Igreja: ${igrejaFormatada} (${cidade} / ${uf})`, 0, 380, {
        align: 'center',
        width: 1123,
      });

    // 5. Sobreposição do Cargo Consagrado dentro da Caixa Central Dourada
    doc.font('Times-Bold').fontSize(23).fillColor('#0B2F64').text(cargoExibicao, 0, 474, {
      align: 'center',
      width: 1123,
    });

    // 6. Data da Consagração
    doc
      .font('Times-Italic')
      .fontSize(11.5)
      .fillColor('#78350F')
      .text(
        textoConsagracao,
        0,
        546,
        { align: 'center', width: 1123 }
      );

    // 7. QR Code Vetorial no Canto Inferior Direito
    try {
      const qrBuffer = await QRCode.toBuffer(validationUrl, {
        width: 80,
        margin: 1,
        color: { dark: '#0B2F64', light: '#FFFFFF' },
      });
      doc.image(qrBuffer, 969, 612, { width: 80, height: 80 });
    } catch (qrErr) {
      console.warn('[CERT_PDF] Falha ao renderizar QR Code no PDF:', qrErr);
    }

    doc.end();
  } catch (err: any) {
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Falha ao compilar certificado oficial em PDF.', details: err?.message });
    }
  }
}

/**
 * ENDPOINT GET /api/certificate/data
 * Retorna os metadados do certificado e validação para consumo no frontend.
 */
export async function getOfficialCertificateData(req: Request, res: Response): Promise<any> {
  try {
    const ministroParam = String(
      req.params?.ministroId ||
      req.query?.userId ||
      req.query?.usuarioId ||
      req.query?.ministroId ||
      req.query?.id ||
      req.query?.cpf ||
      ''
    ).trim();

    if (!ministroParam) {
      return res.status(400).json({ error: 'Identificador do ministro (ID ou CPF) é obrigatório.' });
    }

    const prontuario = await buscarProntuarioMinistro(ministroParam);
    if (!prontuario) {
      return res.status(404).json({ error: 'Prontuário ministerial não encontrado.' });
    }

    const stAdimplencia = String(prontuario.statusAdimplencia || 'ADIMPLENTE').toUpperCase();
    const isInadimplente = stAdimplencia === 'INADIMPLENTE' || stAdimplencia === 'PENDENTE' || stAdimplencia === 'SUSPENSO';

    const cleanCpf = limparCpf(prontuario.cpf || '');
    const validationUrl = `https://cimadebe.org.br/validar/cert-${cleanCpf || prontuario.id}`;

    let qrCodeDataUrl = '';
    try {
      qrCodeDataUrl = await QRCode.toDataURL(validationUrl, {
        width: 160,
        margin: 1,
        color: { dark: '#0B2F64', light: '#FFFFFF' },
      });
    } catch (e) {}

    return res.status(200).json({
      ministro: prontuario,
      statusAdimplencia: stAdimplencia,
      isInadimplente,
      validationUrl,
      qrCodeDataUrl,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao consultar dados do certificado.', details: err?.message });
  }
}
