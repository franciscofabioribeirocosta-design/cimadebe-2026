/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Utilitário de Parsing de QR Code de Notas Fiscais (NFC-e / NF-e SEFAZ)
 * Princípio da Responsabilidade Única (SRP) e Validação Anti-Falhas
 */

export interface NfceParsedData {
  readonly valor: number;
  readonly data: string; // YYYY-MM-DD
  readonly chaveAcesso?: string;
  readonly descricao: string;
  readonly centroCustoSugerido: string;
  readonly urlOriginal: string;
  readonly formatoDetectado: 'SEFAZ_PARAM_PIPE' | 'SEFAZ_QUERY_STRING' | 'JSON' | 'TEXTO_GENERICO';
}

/**
 * Converte data em diversos formatos (ISO, YYYYMMDD, DD/MM/YYYY, etc.) para YYYY-MM-DD
 */
function normalizarData(rawDate?: string): string {
  if (!rawDate) {
    return new Date().toISOString().split('T')[0];
  }

  // Formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return rawDate;
  }

  // Formato YYYYMMDD
  if (/^\d{8}$/.test(rawDate)) {
    return `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
  }

  // Formato ISO timestamp: 2026-09-27T14:30:00-03:00 ou 2026-09-27...
  if (rawDate.includes('T')) {
    const d = rawDate.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  }

  // Formato DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
    const [dd, mm, yyyy] = rawDate.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Normaliza valor monetário
 */
function normalizarValor(rawValor?: string | number): number {
  if (typeof rawValor === 'number') {
    return isNaN(rawValor) ? 0 : Math.round(rawValor * 100) / 100;
  }
  if (!rawValor) return 0;

  // Substitui vírgula por ponto
  const limpo = rawValor.toString().replace('R$', '').replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Sugere Centro de Custo da AGO com base no texto ou razão social
 */
export function sugerirCentroCusto(texto: string): string {
  const t = (texto || '').toLowerCase();
  if (t.includes('hotel') || t.includes('pousada') || t.includes('hosped') || t.includes('flat')) {
    return 'Hospedagem & Hotelaria';
  }
  if (t.includes('restaurante') || t.includes('buffet') || t.includes('alimento') || t.includes('padaria') || t.includes('refeic') || t.includes('mercado') || t.includes('bebida') || t.includes('lanche')) {
    return 'Alimentação & Buffet Plenária';
  }
  if (t.includes('som') || t.includes('led') || t.includes('audio') || t.includes('video') || t.includes('transmiss') || t.includes('ti') || t.includes('internet') || t.includes('computador')) {
    return 'Mídia, Transmissão & TI';
  }
  if (t.includes('grafica') || t.includes('cracha') || t.includes('papel') || t.includes('impress') || t.includes('banner') || t.includes('adesivo')) {
    return 'Secretaria, Gráfica & Crachás CR-80';
  }
  if (t.includes('centro') || t.includes('locac') || t.includes('aluguel') || t.includes('tenda') || t.includes('cadeira') || t.includes('palco')) {
    return 'Infraestrutura & Locação Centro de Convenções';
  }
  return 'Infraestrutura & Locação Centro de Convenções';
}

/**
 * Parser principal de QR Code de Nota Fiscal Eletrônica do Consumidor (NFC-e / NF-e)
 */
export function parseNfceQrCode(qrString: string): NfceParsedData {
  const raw = (qrString || '').trim();
  const hoje = new Date().toISOString().split('T')[0];

  if (!raw) {
    return {
      valor: 0,
      data: hoje,
      descricao: 'Despesa AGO',
      centroCustoSugerido: 'Infraestrutura & Locação Centro de Convenções',
      urlOriginal: '',
      formatoDetectado: 'TEXTO_GENERICO',
    };
  }

  // 1. Tentar parsear como JSON se for um QR code em formato JSON
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const obj = JSON.parse(raw);
      const val = normalizarValor(obj.valor || obj.valorTotal || obj.total || obj.vNF || obj.vTot || 0);
      const dataDoc = normalizarData(obj.data || obj.dataEmissao || obj.dhEmi || hoje);
      const desc = obj.descricao || obj.razaoSocial || obj.nome || `Nota Fiscal ${obj.numero || obj.nNF || ''}`.trim();
      const centro = sugerirCentroCusto(desc);

      return {
        valor: val,
        data: dataDoc,
        chaveAcesso: obj.chave || obj.chaveAcesso || obj.chNFe,
        descricao: desc || 'Nota Fiscal NFC-e',
        centroCustoSugerido: centro,
        urlOriginal: raw,
        formatoDetectado: 'JSON',
      };
    } catch {
      // continua para os outros formatos
    }
  }

  // 2. Formato SEFAZ Padrão NFC-e com parâmetro `p=` (ex: http://sefaz...?p=CHAVE|2|1|1|VALOR|...)
  // Exemplo SEFAZ: p=35240312345678000195650010000001231000001234|2|1|1|150.00|...
  let paramP = '';
  if (raw.includes('p=')) {
    try {
      const urlObj = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
      paramP = urlObj.searchParams.get('p') || '';
    } catch {
      const match = raw.match(/p=([^&]+)/);
      if (match) paramP = match[1];
    }
  } else if (raw.includes('|')) {
    paramP = raw;
  }

  if (paramP && paramP.includes('|')) {
    const parts = paramP.split('|');
    // Estrutura padrão NFC-e Manual Técnico SEFAZ:
    // [0]: Chave de Acesso (44 dígitos)
    // [1]: Versão do QR Code (ex: 2)
    // [2]: Tipo de Ambiente (1 = Produção, 2 = Homologação)
    // [3]: Identificador do Destinatário / Consumidor
    // [4]: Valor Total da NFC-e (ex: 120.50 ou em Hex / Float)
    // [5]: DigestValue da NF-e (Hex)
    // [6]: Identificador do CSC
    // [7]: Código Hash de Validação

    const chave = parts[0] && parts[0].length >= 40 ? parts[0] : undefined;
    let rawValor = parts[4] || '';

    // Se o valor estiver em hexadecimal ou formato especial
    let valorExtraido = normalizarValor(rawValor);

    // Se o valor não veio no índice 4, procurar nos outros segmentos
    if (valorExtraido <= 0) {
      for (let i = 1; i < parts.length; i++) {
        if (/^\d+(\.\d{1,2})?$/.test(parts[i]) && parseFloat(parts[i]) > 0) {
          valorExtraido = parseFloat(parts[i]);
          break;
        }
      }
    }

    // Extrair data da chave de acesso (dígitos 2 a 5 são AAMM da emissão)
    let dataEmissao = hoje;
    if (chave && chave.length === 44) {
      const aa = chave.substring(2, 4);
      const mm = chave.substring(4, 6);
      const anoCompleto = `20${aa}`;
      dataEmissao = `${anoCompleto}-${mm}-01`;
    }

    const chaveFormatada = chave ? `${chave.substring(0, 4)}...${chave.substring(chave.length - 4)}` : '';
    const desc = chave ? `NFC-e SEFAZ (Chave: ${chaveFormatada})` : 'Nota Fiscal NFC-e QR SEFAZ';

    return {
      valor: valorExtraido,
      data: dataEmissao,
      chaveAcesso: chave,
      descricao: desc,
      centroCustoSugerido: sugerirCentroCusto(desc),
      urlOriginal: raw,
      formatoDetectado: 'SEFAZ_PARAM_PIPE',
    };
  }

  // 3. Formato SEFAZ com Query Parameters explícitos (ex: ?chNFe=...&vNF=150.00&dhEmi=...)
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    const chNFe = url.searchParams.get('chNFe') || url.searchParams.get('chave') || url.searchParams.get('c');
    const vNF = url.searchParams.get('vNF') || url.searchParams.get('vTot') || url.searchParams.get('valor') || url.searchParams.get('total');
    const dhEmi = url.searchParams.get('dhEmi') || url.searchParams.get('dEmi') || url.searchParams.get('data');

    if (vNF || chNFe) {
      const val = normalizarValor(vNF || '0');
      const dataNormal = normalizarData(dhEmi || undefined);
      const chaveFmt = chNFe ? `${chNFe.substring(0, 4)}...${chNFe.substring(chNFe.length - 4)}` : '';
      const desc = chNFe ? `NFC-e SEFAZ (Chave: ${chaveFmt})` : 'Despesa Nota Fiscal Eletrônica';

      return {
        valor: val,
        data: dataNormal,
        chaveAcesso: chNFe || undefined,
        descricao: desc,
        centroCustoSugerido: sugerirCentroCusto(desc),
        urlOriginal: raw,
        formatoDetectado: 'SEFAZ_QUERY_STRING',
      };
    }
  } catch {
    // Não é URL válida
  }

  // 4. Extração Regex Genérica (procurar chave de 44 dígitos ou valores)
  const matchChave44 = raw.match(/\b\d{44}\b/);
  const matchValor = raw.match(/R?\$?\s*(\d+[.,]\d{2})/);

  const chaveEncontrada = matchChave44 ? matchChave44[0] : undefined;
  const valorEncontrado = matchValor ? normalizarValor(matchValor[1]) : 0;

  return {
    valor: valorEncontrado,
    data: hoje,
    chaveAcesso: chaveEncontrada,
    descricao: chaveEncontrada ? `NFC-e SEFAZ (Chave: ${chaveEncontrada.substring(0, 4)}...${chaveEncontrada.substring(40)})` : 'Despesa Nota Fiscal AGO',
    centroCustoSugerido: 'Infraestrutura & Locação Centro de Convenções',
    urlOriginal: raw,
    formatoDetectado: 'TEXTO_GENERICO',
  };
}
