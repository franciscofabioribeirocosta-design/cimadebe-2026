/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção Geral
 * Serviço de Integração Receita Federal / Consulta Pública de CNPJ
 * Responsabilidade Única (SRP): Conectar, buscar e normalizar dados cadastrais de Pessoas Jurídicas
 */

export interface DadosReceitaCnpj {
  razaoSocial: string;
  nomeFantasia: string;
  sigla: string;
  cnpj: string;
  dataAbertura: string;
  naturezaJuridica: string;
  cnaePrincipal: string;
  situacaoCadastral: string;
  dataSituacaoCadastral?: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  presidenteOuResponsavel?: string;
  sociosOuDiretoria?: Array<{
    nome: string;
    qualificacao: string;
  }>;
}

export function limparCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, '').slice(0, 14);
}

export function formatarCnpjString(cnpj: string): string {
  const nums = limparCnpj(cnpj);
  return nums
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/**
 * Consulta dados na Receita Federal via BrasilAPI com fallback transparente
 */
export async function consultarCnpjReceita(cnpjInput: string): Promise<DadosReceitaCnpj> {
  const cnpjLimpo = limparCnpj(cnpjInput);
  if (cnpjLimpo.length !== 14) {
    throw new Error('CNPJ deve conter exatamente 14 dígitos numéricos.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  // 1. Tenta CNPJ.ws (Mais rico em dados cadastrais, e-mail e QSA)
  try {
    const resCnpjWs = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (resCnpjWs.ok) {
      clearTimeout(timeoutId);
      const dataWs = await resCnpjWs.json();
      return normalizarRespostaCnpjWs(dataWs, cnpjLimpo);
    }
  } catch (err) {
    console.warn('[RECEITA_CNPJWS_FALLBACK]', err);
  } finally {
    clearTimeout(timeoutId);
  }

  // 2. Fallback MinhaReceita
  try {
    const resMinha = await fetch(`https://minhareceita.org/${cnpjLimpo}`, {
      headers: { Accept: 'application/json' }
    });
    if (resMinha.ok) {
      const dataMinha = await resMinha.json();
      return normalizarRespostaMinhaReceita(dataMinha, cnpjLimpo);
    }
  } catch (err) {
    console.warn('[RECEITA_MINHARECEITA_FALLBACK]', err);
  }

  // 3. Fallback BrasilAPI
  try {
    const resBrasilApi = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
      headers: { Accept: 'application/json' }
    });
    if (resBrasilApi.ok) {
      const data = await resBrasilApi.json();
      return normalizarRespostaBrasilApi(data, cnpjLimpo);
    }
  } catch (err) {
    console.warn('[RECEITA_BRASILAPI_FALLBACK]', err);
  }

  throw new Error('Não foi possível obter os dados da Receita Federal para o CNPJ informado. Verifique a conexão ou digite os dados manualmente.');
}

function extrairSigla(nomeFantasia: string, razaoSocial: string): string {
  if (nomeFantasia && nomeFantasia.trim()) {
    const primeiraPalavra = nomeFantasia.trim().split(/\s+/)[0];
    if (primeiraPalavra.length >= 3 && primeiraPalavra.length <= 12) {
      return primeiraPalavra.toUpperCase();
    }
  }
  const matchSigla = razaoSocial.match(/\b([A-Z]{3,10})\b/);
  if (matchSigla) {
    return matchSigla[1];
  }
  return 'CONVENÇÃO';
}

function normalizarRespostaBrasilApi(data: any, cnpjLimpo: string): DadosReceitaCnpj {
  const razaoSocial = data.razao_social || data.nome || '';
  const nomeFantasia = data.nome_fantasia || data.fantasia || razaoSocial;
  const sigla = extrairSigla(nomeFantasia, razaoSocial);

  let presidenteOuResponsavel = '';
  const socios: Array<{ nome: string; qualificacao: string }> = [];

  if (Array.isArray(data.qsa)) {
    for (const socio of data.qsa) {
      const nome = socio.nome_socio || socio.nome || '';
      const qual = socio.qualificacao_socio || socio.qualificacao || '';
      if (nome) {
        socios.push({ nome, qualificacao: qual });
        if (
          !presidenteOuResponsavel &&
          (qual.toLowerCase().includes('presidente') ||
            qual.toLowerCase().includes('administrador') ||
            qual.toLowerCase().includes('diretor'))
        ) {
          presidenteOuResponsavel = nome;
        }
      }
    }
  }

  const logradouro = [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(' ') || data.logradouro || '';

  let telefone = data.ddd_telefone_1 || data.telefone || '';
  if (telefone && !telefone.startsWith('(') && telefone.length >= 10) {
    telefone = `(${telefone.slice(0, 2)}) ${telefone.slice(2)}`;
  }

  return {
    razaoSocial,
    nomeFantasia,
    sigla,
    cnpj: formatarCnpjString(cnpjLimpo),
    dataAbertura: data.data_inicio_atividade || data.abertura || '',
    naturezaJuridica: data.natureza_juridica || data.codigo_natureza_juridica || 'Organização Religiosa',
    cnaePrincipal: data.cnae_fiscal_descricao || data.cnae_fiscal || 'Atividades de organizações religiosas',
    situacaoCadastral: data.descricao_situacao_cadastral || data.situacao_cadastral || 'ATIVA',
    dataSituacaoCadastral: data.data_situacao_cadastral || '',
    logradouro,
    numero: data.numero || 'S/N',
    complemento: data.complemento || '',
    bairro: data.bairro || '',
    municipio: data.municipio || data.cidade || '',
    uf: data.uf || 'CE',
    cep: data.cep ? data.cep.replace(/^(\d{5})(\d{3})/, '$1-$2') : '',
    telefone,
    email: data.email || '',
    presidenteOuResponsavel: presidenteOuResponsavel || (socios[0]?.nome ?? ''),
    sociosOuDiretoria: socios
  };
}

function normalizarRespostaMinhaReceita(data: any, cnpjLimpo: string): DadosReceitaCnpj {
  const razaoSocial = data.razao_social || data.nome_empresarial || '';
  const nomeFantasia = data.nome_fantasia || razaoSocial;
  const sigla = extrairSigla(nomeFantasia, razaoSocial);

  return {
    razaoSocial,
    nomeFantasia,
    sigla,
    cnpj: formatarCnpjString(cnpjLimpo),
    dataAbertura: data.data_inicio_atividade || '',
    naturezaJuridica: data.natureza_juridica || 'Organização Religiosa',
    cnaePrincipal: data.cnae_fiscal_descricao || 'Atividades de organizações religiosas',
    situacaoCadastral: data.descricao_situacao_cadastral || 'ATIVA',
    logradouro: [data.tipo_logradouro, data.logradouro].filter(Boolean).join(' ') || data.logradouro || '',
    numero: data.numero || 'S/N',
    complemento: data.complemento || '',
    bairro: data.bairro || '',
    municipio: data.municipio || '',
    uf: data.uf || 'CE',
    cep: data.cep ? String(data.cep).replace(/^(\d{5})(\d{3})/, '$1-$2') : '',
    telefone: data.ddd_telefone_1 || '',
    email: data.email || '',
    presidenteOuResponsavel: data.qsa?.[0]?.nome_socio || '',
    sociosOuDiretoria: Array.isArray(data.qsa)
      ? data.qsa.map((s: any) => ({ nome: s.nome_socio || '', qualificacao: s.qualificacao_socio || '' }))
      : []
  };
}

function normalizarRespostaCnpjWs(data: any, cnpjLimpo: string): DadosReceitaCnpj {
  const estab = data.estabelecimento || {};
  const razaoSocial = data.razao_social || '';
  const nomeFantasia = estab.nome_fantasia || razaoSocial;
  const sigla = extrairSigla(nomeFantasia, razaoSocial);

  return {
    razaoSocial,
    nomeFantasia,
    sigla,
    cnpj: formatarCnpjString(cnpjLimpo),
    dataAbertura: estab.data_inicio_atividade || '',
    naturezaJuridica: data.natureza_juridica?.descricao || 'Organização Religiosa',
    cnaePrincipal: estab.atividade_principal?.descricao || 'Atividades de organizações religiosas',
    situacaoCadastral: estab.situacao_cadastral || 'ATIVA',
    logradouro: [estab.tipo_logradouro, estab.logradouro].filter(Boolean).join(' ') || estab.logradouro || '',
    numero: estab.numero || 'S/N',
    complemento: estab.complemento || '',
    bairro: estab.bairro || '',
    municipio: estab.cidade?.nome || '',
    uf: estab.estado?.sigla || 'CE',
    cep: estab.cep ? String(estab.cep).replace(/^(\d{5})(\d{3})/, '$1-$2') : '',
    telefone: estab.telefone1 || '',
    email: estab.email || '',
    presidenteOuResponsavel: data.socios?.[0]?.nome || '',
    sociosOuDiretoria: Array.isArray(data.socios)
      ? data.socios.map((s: any) => ({ nome: s.nome || '', qualificacao: s.qualificacao_socio?.descricao || '' }))
      : []
  };
}
