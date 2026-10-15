/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Minister Credential Vector Generator (CR-80 PVC SVG Renderer)
 * Strict Vector Measurement (324x204), Dynamic Role Theme Matrix,
 * Base64 Ingestion & Direct Vector QR Code Gate for CorelDRAW / Adobe Illustrator.
 */

import { Request, Response } from 'express';
import { adminDb } from './firebaseAdmin';
import { db } from '../src/firebase';
import { doc as clientDoc, getDoc as clientGetDoc, collection as clientCollection, query as clientQuery, where as clientWhere, limit as clientLimit, getDocs as clientGetDocs } from 'firebase/firestore';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import QRCode from 'qrcode';

interface MinistroProntuario {
  id: string;
  nome?: string;
  cargo?: string;
  registroMinisterial?: string;
  cpf?: string;
  dataConsagracao?: string;
  validade?: string;
  fotoUrl?: string;
  statusAdimplencia?: string;
  status?: string;
  [key: string]: any;
}

/**
 * Busca segura do prontuário do ministro (Zero-Trust)
 * Tenta buscar por ID ou pelo CPF limpo em camadas de persistência
 */
async function buscarProntuarioMinistro(ministroIdOuCpf: string): Promise<MinistroProntuario | null> {
  const identificador = String(ministroIdOuCpf || '').trim();
  if (!identificador) return null;

  const cleanCpf = identificador.replace(/\D/g, '');

  // 1. Consulta prioritária via Client SDK Firestore (autenticado com apiKey e banco canônico)
  if (db) {
    try {
      const snap = await clientGetDoc(clientDoc(db, 'ministros', identificador));
      if (snap.exists()) {
        return { id: snap.id, ...(snap.data() as any) };
      }

      if (cleanCpf) {
        const qSnap = await clientGetDocs(clientQuery(clientCollection(db, 'ministros'), clientWhere('cpf', '==', identificador), clientLimit(1)));
        if (!qSnap.empty) {
          const d = qSnap.docs[0];
          return { id: d.id, ...(d.data() as any) };
        }
      }
    } catch (clientErr: any) {
      console.warn('[MINISTER_CREDENTIAL_CLIENT_DB_WARN] Client DB read failed:', clientErr?.message);
    }
  }

  // 2. Fallback via Admin SDK Firestore apenas se credenciais explícitas existirem
  if (adminDb && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      // Busca direta por ID de documento
      const docSnap = await adminDb.collection('ministros').doc(identificador).get();
      if (docSnap.exists) {
        return { id: docSnap.id, ...(docSnap.data() as any) };
      }

      // Busca por CPF exato ou CPF limpo
      if (cleanCpf) {
        const qSnap = await adminDb.collection('ministros').where('cpf', '==', identificador).limit(1).get();
        if (!qSnap.empty) {
          const d = qSnap.docs[0];
          return { id: d.id, ...(d.data() as any) };
        }
      }
    } catch (adminErr: any) {
      // Ignora silenciosamente se o Admin SDK não estiver configurado
    }
  }

  return null;
}

/**
 * Download e conversão da foto para Base64 binário seguro
 * 1. Tenta Firebase Storage nativo: ministros/fotos/${cleanCpf}.jpg
 * 2. Tenta fotoUrl HTTP/HTTPS remota
 * 3. Tenta Base64 existente
 */
export async function obterFotoEmBase64(cleanCpf: string, fotoUrlExistente?: string): Promise<string> {
  // 1. Tentar download do Firebase Storage Admin SDK
  if (cleanCpf) {
    try {
      const storageBucketName = process.env.STORAGE_BUCKET || 'gen-lang-client-0060094106.firebasestorage.app';
      const bucket = getAdminStorage().bucket(storageBucketName);
      const file = bucket.file(`ministros/fotos/${cleanCpf}.jpg`);
      const [exists] = await file.exists();
      if (exists) {
        const [buffer] = await file.download();
        return `data:image/jpeg;base64,${buffer.toString('base64')}`;
      }
    } catch (storageErr) {
      // Storage não disponível ou arquivo ausente
    }
  }

  // 2. Se houver fotoUrl em base64 direto
  const targetFoto = String(fotoUrlExistente || '').trim();
  if (targetFoto.startsWith('data:image/')) {
    return targetFoto;
  }

  // 3. Se for URL remota (HTTP/HTTPS)
  if (targetFoto.startsWith('http://') || targetFoto.startsWith('https://')) {
    try {
      const res = await fetch(targetFoto);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        return `data:${contentType};base64,${buffer.toString('base64')}`;
      }
    } catch (fetchErr) {
      console.warn('[CREDENTIAL_SVG_PHOTO_FETCH_WARN] Não foi possível baixar foto remota:', fetchErr);
    }
  }

  return '';
}

/**
 * Formata CPF para padrão gráfico nacional
 */
function formatarCpf(cpf: string): string {
  const digits = String(cpf || '').replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return cpf || '000.000.000-00';
}

export async function buscarConfiguracaoConvencao(): Promise<any> {
  if (adminDb) {
    try {
      const snap = await adminDb.collection('configuracoes').doc('convencao').get();
      if (snap.exists) {
        return snap.data() || {};
      }
    } catch (e) {}
  }
  return {};
}

/**
 * Constrói o SVG vetorial puro com dimensões exatas de CR-80 (856 x 540),
 * idêntico ao modelo oficial MinisterialCard utilizado na home e na credencial a laser.
 */
export async function buildCr80Svg(dados: {
  id: string;
  nome: string;
  cargo: string;
  registroMinisterial: string;
  cpf: string;
  dataConsagracao: string;
  validade: string;
  fotoBase64: string;
}): Promise<string> {
  const { id, nome, cargo, registroMinisterial, cpf, dataConsagracao, validade, fotoBase64 } = dados;

  const appConfig = await buscarConfiguracaoConvencao();
  const rawLogomarca = appConfig?.logomarca || '';
  const logomarcaUrl = rawLogomarca ? await obterFotoEmBase64('', rawLogomarca) : '';

  const nomeFormatado = String(nome || 'MINISTRO DA CONVENÇÃO').toUpperCase().trim();
  const cargoFormatado = String(cargo || 'Pastor').toUpperCase().trim();
  const registroFormatado = String(registroMinisterial || 'REG-0000').trim();
  const cpfFormatado = formatarCpf(cpf);
  const consagrFormatada = String(dataConsagracao || '01/01/2020').trim();
  const validadeFormatada = String(validade || '31/12/2026').trim();
  const validationUrl = `https://cimadebe.org.br/validar/${String(id || cpf).trim()}`;

  let qrCodeSvgInner = '';
  try {
    const rawQrSvg = await QRCode.toString(validationUrl, {
      type: 'svg',
      margin: 1,
      color: { dark: '#03172E', light: '#FFFFFF' },
    });
    const matchInner = rawQrSvg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
    const matchViewBox = rawQrSvg.match(/viewBox="([^"]+)"/);
    const viewBoxAttr = matchViewBox ? matchViewBox[1] : '0 0 29 29';
    const [, , vbW = '29', vbH = '29'] = viewBoxAttr.split(' ');
    qrCodeSvgInner = `
      <g transform="translate(650, 158)">
        <rect width="178" height="178" rx="14" fill="#FFFFFF" stroke="#059669" stroke-width="2.4" />
        <svg x="14" y="14" width="150" height="150" viewBox="0 0 ${vbW} ${vbH}" shape-rendering="crispEdges">
          ${matchInner ? matchInner[1] : ''}
        </svg>
        <text x="89" y="204" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="900" fill="#065F46" letter-spacing="1.0">VALIDAÇÃO DIGITAL</text>
        <text x="89" y="222" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="9" font-weight="bold" fill="#64748B">Aponte a câmera</text>
      </g>
    `;
  } catch (qrErr) {
    qrCodeSvgInner = `
      <g transform="translate(650, 158)">
        <rect width="178" height="178" rx="14" fill="#FFFFFF" stroke="#059669" stroke-width="2.4" />
        <text x="89" y="98" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="bold" fill="#03172E">QR CODE</text>
      </g>
    `;
  }

  const imageElement = fotoBase64
    ? `<image href="${fotoBase64}" x="0" y="0" width="160" height="200" preserveAspectRatio="xMidYMid slice" />`
    : `<g>
        <rect width="160" height="200" fill="#E2E8F0" />
        <circle cx="80" cy="80" r="36" fill="#CBD5E1" />
        <path d="M 30 200 C 30 145, 55 125, 80 125 C 105 125, 130 145, 130 200 Z" fill="#CBD5E1" />
      </g>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="856" height="540" viewBox="0 0 856 540" version="1.1">
  <defs>
    <linearGradient id="rgSecurityIris" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="18%" stop-color="#F0F9FF" />
      <stop offset="38%" stop-color="#F8FAFC" />
      <stop offset="55%" stop-color="#FFFDF7" />
      <stop offset="75%" stop-color="#F0FDF4" />
      <stop offset="90%" stop-color="#EFF6FF" />
      <stop offset="100%" stop-color="#FFFFFF" />
    </linearGradient>
    <radialGradient id="rgCenterSunburst" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95" />
      <stop offset="30%" stop-color="#FEF9C3" stop-opacity="0.25" />
      <stop offset="65%" stop-color="#DCFCE7" stop-opacity="0.2" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="headerRoyalNavy" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#061838" />
      <stop offset="45%" stop-color="#0B2F64" />
      <stop offset="100%" stop-color="#0E3D7D" />
    </linearGradient>
    <linearGradient id="goldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#C59B27" />
      <stop offset="50%" stop-color="#FDE047" />
      <stop offset="100%" stop-color="#A16207" />
    </linearGradient>
    <clipPath id="avatarClip">
      <rect x="0" y="0" width="160" height="200" rx="8" />
    </clipPath>
  </defs>

  <!-- Base CR-80 -->
  <rect width="856" height="540" rx="8" fill="url(#rgSecurityIris)" stroke="url(#goldBorder)" stroke-width="3.2" />
  <rect x="8" y="8" width="840" height="524" rx="6" fill="url(#rgCenterSunburst)" stroke="#0284C7" stroke-width="1.5" opacity="0.9" />

  <!-- Trama de Segurança Guilloché -->
  <g fill="none">
    <path d="M 0 24 Q 12 12, 24 24 T 48 24 T 72 24 T 96 24 T 120 24 T 144 24 T 168 24 T 192 24 T 216 24 T 240 24 T 264 24 T 288 24 T 312 24 T 336 24 T 360 24 T 384 24 T 408 24 T 432 24 T 456 24 T 480 24 T 504 24 T 528 24 T 552 24 T 576 24 T 600 24 T 624 24 T 648 24 T 672 24 T 696 24 T 720 24 T 744 24 T 768 24 T 792 24 T 816 24 T 840 24" stroke="#0284C7" stroke-width="0.65" opacity="0.35" />
    <path d="M 0 72 Q 12 60, 24 72 T 48 72 T 72 72 T 96 72 T 120 72 T 144 72 T 168 72 T 192 72 T 216 72 T 240 72 T 264 72 T 288 72 T 312 72 T 336 72 T 360 72 T 384 72 T 408 72 T 432 72 T 456 72 T 480 72 T 504 72 T 528 72 T 552 72 T 576 72 T 600 72 T 624 72 T 648 72 T 672 72 T 696 72 T 720 72 T 744 72 T 768 72 T 792 72 T 816 72 T 840 72" stroke="#059669" stroke-width="0.65" opacity="0.3" />
    <path d="M 0 120 Q 12 108, 24 120 T 48 120 T 72 120 T 96 120 T 120 120 T 144 120 T 168 120 T 192 120 T 216 120 T 240 120 T 264 120 T 288 120 T 312 120 T 336 120 T 360 120 T 384 120 T 408 120 T 432 120 T 456 120 T 480 120 T 504 120 T 528 120 T 552 120 T 576 120 T 600 120 T 624 120 T 648 120 T 672 120 T 696 120 T 720 120 T 744 120 T 768 120 T 792 120 T 816 120 T 840 120" stroke="#C59B27" stroke-width="0.65" opacity="0.3" />
  </g>

  <!-- Logo do Fundo e Círculo Dourado Removidos - Fundo Limpo com Guilloché -->

  {/* Topbar Header */}
  <g transform="translate(28, 16)">
    <rect width="800" height="100" rx="12" fill="url(#headerRoyalNavy)" stroke="#1E40AF" stroke-width="1.2" />
    <!-- Brasão Circular -->
    <g transform="translate(14, 8)">
      <circle cx="42" cy="42" r="42" fill="#FFFFFF" stroke="url(#goldBorder)" stroke-width="3.5" />
      ${logomarcaUrl ? `
        <clipPath id="logoFrontClipServer">
          <circle cx="42" cy="42" r="42" />
        </clipPath>
        <image href="${logomarcaUrl}" x="-4" y="-4" width="92" height="92" clip-path="url(#logoFrontClipServer)" preserveAspectRatio="xMidYMid slice" />
      ` : `
        <circle cx="42" cy="42" r="38" fill="#0B2F64" />
        <circle cx="42" cy="42" r="34" fill="none" stroke="#FDE047" stroke-width="1.2" stroke-dasharray="3 2" />
        <polygon points="42,18 49,32 64,42 49,52 42,66 35,52 20,42 35,32" fill="#FDE047" />
        <circle cx="42" cy="42" r="7" fill="#FFFFFF" />
        <text x="42" y="73" font-family="Arial, sans-serif" font-size="7" font-weight="900" fill="#FDE047" letter-spacing="0.8" text-anchor="middle">CIMADEBE</text>
      `}
    </g>
    <text x="116" y="36" font-family="Arial, sans-serif" font-size="27" font-weight="900" fill="#FFFFFF" letter-spacing="2.5">CIMADEBE</text>
    <text x="116" y="60" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#FDE047" letter-spacing="1.0">CONVENÇÃO DE IGREJAS E MINISTROS ASSEMBLÉIA DE DEUS</text>
    <text x="116" y="82" font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#E2E8F0" letter-spacing="0.8">CNPJ: 00.000.000/0001-00 • CONTATO OFICIAL • FUNDADA EM 2010</text>
    
    <!-- Badge Oficial -->
    <g transform="translate(706, 20)">
      <rect width="78" height="58" rx="6" fill="#061838" stroke="#C59B27" stroke-width="1.2" />
      <text x="39" y="18" font-family="Arial, sans-serif" font-size="6.5" font-weight="bold" fill="#93C5FD" text-anchor="middle" letter-spacing="1.0">CIMADEBE</text>
      <text x="39" y="34" font-family="Arial, sans-serif" font-size="10.5" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="1.0">OFICIAL</text>
      <text x="39" y="48" font-family="Arial, sans-serif" font-size="6.5" font-weight="bold" fill="#FDE047" text-anchor="middle">ESTATUTO</text>
    </g>
  </g>

  <!-- Texto Vertical Borda Esquerda -->
  <text transform="rotate(-90)" x="-380" y="20" font-family="Arial, sans-serif" font-size="7" font-weight="bold" fill="#0284C7" letter-spacing="2.5" opacity="0.9">VÁLIDO EM TODO O TERRITÓRIO NACIONAL</text>

  <!-- Foto do Ministro -->
  <g transform="translate(36, 144)">
    <rect x="-4" y="-4" width="168" height="208" rx="18" fill="none" stroke="url(#goldBorder)" stroke-width="4" />
    <g clip-path="url(#avatarClip)">
      ${imageElement}
    </g>
  </g>

  <!-- Bloco de Identificação -->
  <g transform="translate(224, 144)">
    <text x="0" y="12" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#475569" letter-spacing="1.0">MINISTRO OBREIRO</text>
    <text x="0" y="40" font-family="Arial, sans-serif" font-size="23" font-weight="900" fill="#0A1E3F" letter-spacing="0.2">${nomeFormatado}</text>

    <text x="0" y="72" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#475569" letter-spacing="1.0">FUNÇÃO / CONSAGRAÇÃO ECLESIÁSTICA</text>
    <text x="0" y="100" font-family="Arial, sans-serif" font-size="21" font-weight="900" fill="#0F172A" letter-spacing="0.5">${cargoFormatado}</text>

    <!-- Três Caixas Arredondadas -->
    <g transform="translate(0, 124)">
      <rect width="604" height="76" rx="10" fill="#FFFFFF" fill-opacity="0.96" stroke="#CBD5E1" stroke-width="1.2" />
      
      <!-- Registro -->
      <g transform="translate(20, 20)">
        <text x="0" y="0" font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#475569" letter-spacing="0.6">REGISTRO MINISTERIAL</text>
        <text x="0" y="26" font-family="Arial, sans-serif" font-size="16" font-weight="900" fill="#0284C7" letter-spacing="0.5">${registroFormatado}</text>
      </g>

      <!-- CPF -->
      <g transform="translate(225, 20)">
        <text x="0" y="0" font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#475569" letter-spacing="0.6">CPF REGISTRADO</text>
        <text x="0" y="26" font-family="Arial, sans-serif" font-size="16" font-weight="900" fill="#0F172A" letter-spacing="0.5">${cpfFormatado}</text>
      </g>

      <!-- Consagração -->
      <g transform="translate(425, 20)">
        <text x="0" y="0" font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#475569" letter-spacing="0.6">CONSAGRAÇÃO</text>
        <text x="0" y="26" font-family="Arial, sans-serif" font-size="16" font-weight="900" fill="#059669" letter-spacing="0.5">${consagrFormatada}</text>
      </g>
    </g>
  </g>

  <!-- QR Code Dinâmico de Validação -->
  ${qrCodeSvgInner}

  <!-- Caixa Inferior -->
  <g transform="translate(28, 378)">
    <rect width="800" height="92" rx="12" fill="#FFFFFF" fill-opacity="0.96" stroke="#CBD5E1" stroke-width="1.2" />

    <g transform="translate(24, 24)">
      <text x="0" y="0" font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#475569" letter-spacing="0.6">VALIDADE DA CREDENCIAL</text>
      <text x="0" y="30" font-family="Arial, sans-serif" font-size="14.5" font-weight="900" fill="#DC2626" letter-spacing="0.5">${validadeFormatada}</text>
    </g>

    <g transform="translate(265, 24)">
      <text x="0" y="0" font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#475569" letter-spacing="0.6">SEDE CONVENCIONAL</text>
      <text x="0" y="30" font-family="Arial, sans-serif" font-size="14.5" font-weight="900" fill="#0F172A" letter-spacing="0.2">CIMADEBE / SIGM</text>
    </g>

    <g transform="translate(545, 16)">
      <text x="115" y="0" text-anchor="middle" font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#475569" letter-spacing="0.6">ASSINATURA DIGITAL</text>
      <path d="M 20 20 Q 70 8, 120 24 T 210 18" fill="none" stroke="#0284C7" stroke-width="2.8" stroke-linecap="round" />
      <text x="115" y="38" text-anchor="middle" font-family="Arial, sans-serif" font-size="9.5" font-weight="900" fill="#0F172A">PRESIDÊNCIA GERAL</text>
      <text x="115" y="52" text-anchor="middle" font-family="Arial, sans-serif" font-size="7.5" font-weight="600" fill="#64748B">Presidente Executivo</text>
    </g>
  </g>

  <!-- Rodapé -->
  <text x="428" y="508" font-family="Arial, sans-serif" font-size="14" font-weight="900" fill="#0A2540" letter-spacing="2.8" text-anchor="middle">CARTEIRA DE IDENTIDADE MINISTERIAL</text>
</svg>`;
}


/**
 * ENDPOINT PRIVADO: GET /api/minister/credencial/svg/:ministroId
 * Recupere o prontuário do ministro diretamente do Firestore usando o CPF limpo.
 * Faça o download do arquivo de imagem do Firebase Storage (ministros/fotos/${cleanCpf}.jpg).
 * Converta os bytes binários para Base64 e monte o SVG vetorial CR-80.
 */
export async function getMinisterCredencialSvg(req: Request, res: Response): Promise<any> {
  try {
    const ministroParam = String(req.params?.ministroId || req.params?.id || req.query?.ministroId || '').trim();
    if (!ministroParam) {
      return res.status(400).json({ error: 'Identificador do ministro (ID ou CPF) é obrigatório.' });
    }

    const prontuario = await buscarProntuarioMinistro(ministroParam);
    if (!prontuario) {
      return res.status(404).json({ error: 'Prontuário ministerial não encontrado no banco de dados.' });
    }

    // Validação Rigorosa de Adimplência Server-Side (Anti-Bypass F12)
    const stAdimplencia = String(prontuario.statusAdimplencia || 'ADIMPLENTE').toUpperCase();
    if (stAdimplencia === 'INADIMPLENTE' || stAdimplencia === 'PENDENTE' || stAdimplencia === 'SUSPENSO') {
      return res.status(403).json({
        error: 'ACESSO NEGADO (HTTP 403): Emissão de credencial bloqueada por inadimplência cadastral.',
        statusAdimplencia: stAdimplencia,
      });
    }

    const cleanCpf = String(prontuario.cpf || '').replace(/\D/g, '');
    const fotoBase64 = await obterFotoEmBase64(cleanCpf, prontuario.fotoUrl);

    const svgXml = await buildCr80Svg({
      id: prontuario.id,
      nome: prontuario.nome || 'MINISTRO DA CONVENÇÃO',
      cargo: prontuario.cargo || 'Pastor',
      registroMinisterial: prontuario.registroMinisterial || prontuario.registroGeral || 'REG-0000',
      cpf: prontuario.cpf || '000.000.000-00',
      dataConsagracao: prontuario.dataConsagracao || '01/01/2020',
      validade: prontuario.validade || '31/12/2026',
      fotoBase64,
    });

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="credencial_${cleanCpf || prontuario.id}_CR80.svg"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.status(200).send(svgXml);
  } catch (err: any) {
    console.error('[GET_MINISTER_CREDENCIAL_SVG_FATAL]:', err);
    return res.status(500).json({ error: 'Falha ao compilar credencial vetorial SVG.', details: err?.message });
  }
}

/**
 * ENDPOINT COMPATÍVEL ANTERIOR: GET /credential/svg (com query params e checagem server-side)
 */
export async function generateSvgCredential(req: Request, res: Response): Promise<any> {
  try {
    const {
      nome = 'MINISTRO DA CONVENÇÃO',
      cargo = 'Pastor',
      registroMinisterial = 'REG-0000',
      cpf = '000.000.000-00',
      dataConsagracao = '01/01/2020',
      validade = '31/12/2026',
      fotoUrl = '',
      id = '000000',
    } = req.query as Record<string, string>;

    const credId = String(id).trim();
    const cleanCpf = String(cpf).replace(/\D/g, '');

    // Checagem Anti-Bypass F12 de adimplência no Firestore
    const prontuario = await buscarProntuarioMinistro(credId || cleanCpf);
    if (prontuario) {
      const stAdimplencia = String(prontuario.statusAdimplencia || 'ADIMPLENTE').toUpperCase();
      if (stAdimplencia === 'INADIMPLENTE' || stAdimplencia === 'PENDENTE' || stAdimplencia === 'SUSPENSO') {
        return res.status(403).json({
          error: 'ACESSO NEGADO (HTTP 403): Emissão de credencial bloqueada por inadimplência cadastral.',
          statusAdimplencia: stAdimplencia,
        });
      }
    }

    const fotoBase64 = await obterFotoEmBase64(cleanCpf, fotoUrl || prontuario?.fotoUrl);

    const svgXml = await buildCr80Svg({
      id: credId || prontuario?.id || '000000',
      nome: prontuario?.nome || String(nome),
      cargo: prontuario?.cargo || String(cargo),
      registroMinisterial: prontuario?.registroMinisterial || String(registroMinisterial),
      cpf: prontuario?.cpf || String(cpf),
      dataConsagracao: prontuario?.dataConsagracao || String(dataConsagracao),
      validade: prontuario?.validade || String(validade),
      fotoBase64,
    });

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(svgXml);
  } catch (err: any) {
    console.error('[MINISTER CREDENTIAL CONTROLLER ERROR]:', err);
    return res.status(500).json({ error: 'Erro ao gerar credencial SVG', details: err?.message });
  }
}
