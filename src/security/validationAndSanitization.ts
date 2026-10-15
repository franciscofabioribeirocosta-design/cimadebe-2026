/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Módulo de Validação Estrita, Sanitização e Princípio do Privilégio Mínimo (RBAC)
 * Blindagem Anti-SQL Injection com Cláusulas Parametrizadas e Barreira Pré-Cloud Google
 */

import type {
  OperadorRole,
  PermissaoSistema,
  ValidacaoEntradaResultado,
  ParametrizedStatement,
  SqlParamValue,
} from '../types';
import { normalizeUtf8String } from '../crypto';

// ==============================================================
// 1. VALIDAÇÃO MATEMÁTICA ESTRITA DE CPF (MÓDULO 11 DA RECEITA)
// ==============================================================

/**
 * Validação rigorosa de CPF aplicando os cálculos dos dois dígitos verificadores
 * da Receita Federal e rejeitando sequências nulas/repetidas conhecidas.
 */
export function validarCPF(cpfEntrada: string): ValidacaoEntradaResultado {
  const sanitizado = normalizeUtf8String(cpfEntrada).trim();
  const apenasDigitos = sanitizado.replace(/\D/g, '');

  if (apenasDigitos.length !== 11) {
    return {
      valido: false,
      formatado: sanitizado,
      valorLimpo: apenasDigitos,
      mensagemErro: `CPF deve conter exatamente 11 dígitos numéricos (recebido: ${apenasDigitos.length}).`,
      sanitizado,
    };
  }

  // Rejeição de sequências com todos os dígitos idênticos (ex: 000.000.000-00, 111.111.111-11)
  const sequenciasInvalidasConhecidas = [
    '00000000000',
    '11111111111',
    '22222222222',
    '33333333333',
    '44444444444',
    '55555555555',
    '66666666666',
    '77777777777',
    '88888888888',
    '99999999999',
  ];

  if (sequenciasInvalidasConhecidas.includes(apenasDigitos)) {
    return {
      valido: false,
      formatado: sanitizado,
      valorLimpo: apenasDigitos,
      mensagemErro: 'CPF composto por sequência repetida inválida.',
      sanitizado,
    };
  }

  // Cálculo do 1º Dígito Verificador (pesos de 10 a 2)
  let somaPrimeiroDigito = 0;
  for (let i = 0; i < 9; i++) {
    somaPrimeiroDigito += parseInt(apenasDigitos.charAt(i), 10) * (10 - i);
  }
  let restoPrimeiroDigito = (somaPrimeiroDigito * 10) % 11;
  if (restoPrimeiroDigito === 10 || restoPrimeiroDigito === 11) {
    restoPrimeiroDigito = 0;
  }

  if (restoPrimeiroDigito !== parseInt(apenasDigitos.charAt(9), 10)) {
    return {
      valido: false,
      formatado: sanitizado,
      valorLimpo: apenasDigitos,
      mensagemErro: 'Primeiro dígito verificador do CPF inválido (matematicamente falso).',
      sanitizado,
    };
  }

  // Cálculo do 2º Dígito Verificador (pesos de 11 a 2)
  let somaSegundoDigito = 0;
  for (let j = 0; j < 10; j++) {
    somaSegundoDigito += parseInt(apenasDigitos.charAt(j), 10) * (11 - j);
  }
  let restoSegundoDigito = (somaSegundoDigito * 10) % 11;
  if (restoSegundoDigito === 10 || restoSegundoDigito === 11) {
    restoSegundoDigito = 0;
  }

  if (restoSegundoDigito !== parseInt(apenasDigitos.charAt(10), 10)) {
    return {
      valido: false,
      formatado: sanitizado,
      valorLimpo: apenasDigitos,
      mensagemErro: 'Segundo dígito verificador do CPF inválido (matematicamente falso).',
      sanitizado,
    };
  }

  // Formatação canônica 000.000.000-00
  const cpfFormatado = `${apenasDigitos.substring(0, 3)}.${apenasDigitos.substring(
    3,
    6
  )}.${apenasDigitos.substring(6, 9)}-${apenasDigitos.substring(9, 11)}`;

  return {
    valido: true,
    formatado: cpfFormatado,
    valorLimpo: apenasDigitos,
    sanitizado,
  };
}

// ==============================================================
// 2. VALIDAÇÃO MATEMÁTICA ESTRITA DE CEP (PADRÃO CORREIOS / DNE)
// ==============================================================

/**
 * Validação rigorosa de Código de Endereçamento Postal (CEP) brasileiro.
 */
export function validarCEP(cepEntrada: string): ValidacaoEntradaResultado {
  const sanitizado = normalizeUtf8String(cepEntrada).trim();
  const apenasDigitos = sanitizado.replace(/\D/g, '');

  if (apenasDigitos.length !== 8) {
    return {
      valido: false,
      formatado: sanitizado,
      valorLimpo: apenasDigitos,
      mensagemErro: `CEP deve conter exatamente 8 dígitos numéricos (recebido: ${apenasDigitos.length}).`,
      sanitizado,
    };
  }

  // Rejeição de sequências nulas
  if (apenasDigitos === '00000000') {
    return {
      valido: false,
      formatado: sanitizado,
      valorLimpo: apenasDigitos,
      mensagemErro: 'CEP nulo inválido.',
      sanitizado,
    };
  }

  // Formatação canônica 00000-000
  const cepFormatado = `${apenasDigitos.substring(0, 5)}-${apenasDigitos.substring(5, 8)}`;

  return {
    valido: true,
    formatado: cepFormatado,
    valorLimpo: apenasDigitos,
    sanitizado,
  };
}

// ==============================================================
// 3. SANITIZAÇÃO ESTRITA DE STRINGS (ANTI-XSS & ANTI-TRAVERSAL)
// ==============================================================

/**
 * Sanitiza qualquer entrada textual, removendo tags de script,
 * handlers de evento maliciosos, null bytes e sequências de path traversal.
 */
export function sanitizarStringEntrada(entrada: string, tamanhoMaximo: number = 255): string {
  if (!entrada) return '';
  let normalizado = normalizeUtf8String(entrada);

  // Remoção de null bytes
  normalizado = normalizado.replace(/\0/g, '');

  // Remoção de tags HTML perigosas e scripts
  normalizado = normalizado.replace(/<\/?(script|iframe|object|embed|style|meta|link|base)[^>]*>/gi, '');

  // Remoção de handlers inline (ex: onclick=, onerror=, onload=)
  normalizado = normalizado.replace(/\bon\w+\s*=\s*(['"]).*?\1/gi, '');
  normalizado = normalizado.replace(/\bon\w+\s*=\s*[^>\s]+/gi, '');

  // Remoção de esquemas de pseudo-protocolos javascript: / vbscript: / data:text/html
  normalizado = normalizado.replace(/(javascript|vbscript|data):/gi, '$1_safe:');

  // Prevenção de Path Traversal
  normalizado = normalizado.replace(/\.\.(\/|\\)/g, '');

  // Truncamento seguro de buffer
  if (normalizado.length > tamanhoMaximo) {
    normalizado = normalizado.substring(0, tamanhoMaximo);
  }

  return normalizado.trim();
}

// ==============================================================
// 4. DETECTOR DEFENSIVO DE SQL INJECTION
// ==============================================================

const PADROES_SQL_INJECTION: readonly RegExp[] = Object.freeze([
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|UNION|MERGE)\b)/i,
  /(--|\/\*|\*\/)/,
  /('|\b)OR(\b|')\s+['"]?1['"]?\s*=\s*['"]?1/i,
  /('|\b)AND(\b|')\s+['"]?1['"]?\s*=\s*['"]?1/i,
  /;\s*(DROP|DELETE|UPDATE|INSERT|SELECT)/i,
  /\bWAITFOR\s+DELAY\b/i,
  /\bBENCHMARK\s*\(/i,
  /\bSLEEP\s*\(/i,
  /0x[0-9a-fA-F]+/i,
]);

/**
 * Analisa uma entrada de texto à procura de assinaturas de ataque SQL Injection.
 */
export function detectarTentativaSqlInjection(entrada: string): {
  readonly detectado: boolean;
  readonly padroesDetectados: readonly string[];
} {
  const padroesDetectados: string[] = [];
  const entradaNormalizada = normalizeUtf8String(entrada);

  for (const regex of PADROES_SQL_INJECTION) {
    if (regex.test(entradaNormalizada)) {
      padroesDetectados.push(regex.toString());
    }
  }

  return {
    detectado: padroesDetectados.length > 0,
    padroesDetectados: Object.freeze(padroesDetectados),
  };
}

// ==============================================================
// 5. MOTOR DE CONSULTAS PARAMETRIZADAS (ANTI-SQLi OBRIGATÓRIO)
// ==============================================================

/**
 * Cria uma instrução SQL parametrizada garantindo o isolamento total entre
 * a estrutura da cláusula e os valores dos parâmetros.
 */
export function buildParametrizedStatement(
  sqlTemplate: string,
  params: readonly SqlParamValue[]
): ParametrizedStatement {
  // Verificação defensiva: checa se o template contém parâmetros inline suspeitos
  const checagemSqlTemplate = detectarTentativaSqlInjection(sqlTemplate);
  // O template pode conter SELECT/INSERT/UPDATE (legítimo), mas NÃO pode conter comentários ou tautologias inline
  if (/(--|\/\*|'\s*OR\s*'\d'='\d)/i.test(sqlTemplate)) {
    throw new Error('VIOLAÇÃO CRÍTICA: Tentativa de interpolação não parametrizada detectada na query.');
  }

  // Gera preview sanitizado com identificadores de parâmetros ($1, $2...)
  let preview = sqlTemplate;
  params.forEach((param, index) => {
    const representacaoSegura =
      param === null ? 'NULL' : typeof param === 'string' ? `'${param.replace(/'/g, "''")}'` : String(param);
    preview = preview.replace(new RegExp(`\\$${index + 1}\\b`, 'g'), representacaoSegura);
  });

  return Object.freeze({
    sql: sqlTemplate,
    params: Object.freeze([...params]),
    sanitizedSqlPreview: preview,
    timestamp: '2026-09-26T12:00:00Z',
  });
}

/**
 * Executa uma consulta em dataset contábil através de Cláusula Parametrizada,
 * simulando o comportamento de drivers e ORMs de nível bancário (ex: pg, Cloud SQL).
 */
export function executeSecureQuery<T>(
  statement: ParametrizedStatement,
  dataset: readonly T[],
  predicate: (item: T, params: readonly SqlParamValue[]) => boolean
): readonly T[] {
  // Auditoria estrita da cláusula
  if (!statement.sql || !Array.isArray(statement.params)) {
    throw new Error('Acesso a banco rejeitado: instrução SQL parametrizada corrompida.');
  }

  return Object.freeze(dataset.filter((item) => predicate(item, statement.params)));
}

// ==============================================================
// 6. PRINCÍPIO DO PRIVILÉGIO MÍNIMO (MATRIZ RBAC)
// ==============================================================

export const MAPA_PERMISSOES_RBAC: Readonly<Record<OperadorRole, readonly PermissaoSistema[]>> = Object.freeze({
  SUPER_ADMIN: Object.freeze<PermissaoSistema[]>([
    'CADASTRAR_MINISTRO',
    'EDITAR_MINISTRO',
    'LIQUIDAR_ANUIDADE',
    'CONCILIAR_WEBHOOK',
    'HOMOLOGAR_AGO',
    'REVOGAR_AGO',
    'EXPORTAR_BIRO_SVG',
    'ALTERAR_CONFIGURACOES_TAXAS',
    'ALTERAR_KILL_SWITCH',
    'VISUALIZAR_AUDIT_LOGS',
    'DOWNLOAD_DOCUMENTOS_OFICIAIS',
    'CONSULTAR_PUBLICO',
  ]),

  ADMINISTRADOR_MASTER: Object.freeze<PermissaoSistema[]>([
    'CADASTRAR_MINISTRO',
    'EDITAR_MINISTRO',
    'LIQUIDAR_ANUIDADE',
    'CONCILIAR_WEBHOOK',
    'HOMOLOGAR_AGO',
    'REVOGAR_AGO',
    'EXPORTAR_BIRO_SVG',
    'ALTERAR_CONFIGURACOES_TAXAS',
    'ALTERAR_KILL_SWITCH',
    'VISUALIZAR_AUDIT_LOGS',
    'DOWNLOAD_DOCUMENTOS_OFICIAIS',
    'CONSULTAR_PUBLICO',
  ]),

  PRESIDENTE_GERAL: Object.freeze<PermissaoSistema[]>([
    'CADASTRAR_MINISTRO',
    'EDITAR_MINISTRO',
    'LIQUIDAR_ANUIDADE',
    'HOMOLOGAR_AGO',
    'REVOGAR_AGO',
    'VISUALIZAR_AUDIT_LOGS',
    'DOWNLOAD_DOCUMENTOS_OFICIAIS',
    'CONSULTAR_PUBLICO',
  ]),

  SECRETARIO: Object.freeze<PermissaoSistema[]>([
    'CADASTRAR_MINISTRO',
    'EDITAR_MINISTRO',
    'HOMOLOGAR_AGO',
    'REVOGAR_AGO',
    'EXPORTAR_BIRO_SVG',
    'DOWNLOAD_DOCUMENTOS_OFICIAIS',
    'VISUALIZAR_AUDIT_LOGS',
    'CONSULTAR_PUBLICO',
  ]),

  TESOUREIRO: Object.freeze<PermissaoSistema[]>([
    'LIQUIDAR_ANUIDADE',
    'CONCILIAR_WEBHOOK',
    'VISUALIZAR_AUDIT_LOGS',
    'CONSULTAR_PUBLICO',
  ]),

  MINISTRO_OBREIRO: Object.freeze<PermissaoSistema[]>([
    'EXPORTAR_BIRO_SVG',
    'DOWNLOAD_DOCUMENTOS_OFICIAIS',
    'CONSULTAR_PUBLICO',
  ]),

  CONSULTA_PUBLICA: Object.freeze<PermissaoSistema[]>(['CONSULTAR_PUBLICO']),

  BIRO: Object.freeze<PermissaoSistema[]>([
    'EXPORTAR_BIRO_SVG',
    'CONSULTAR_PUBLICO',
  ]),
});

/**
 * Checa se um perfil de operador possui explicitamente autorização
 * para executar determinada operação sensível (Princípio do Privilégio Mínimo).
 */
export function verificarPrivilegioMinimo(
  role: OperadorRole,
  permissaoRequerida: PermissaoSistema
): boolean {
  const permissoesDoRole = MAPA_PERMISSOES_RBAC[role];
  if (!permissoesDoRole) return false;
  return permissoesDoRole.includes(permissaoRequerida);
}

// ==============================================================
// 7. BARREIRA DE COMPLIANCE PRÉ-SUBMISSÃO CLOUD (GOOGLE CLOUD GUARD)
// ==============================================================

export interface PreCloudValidationEnvelope<T> {
  readonly cpf?: string;
  readonly cep?: string;
  readonly payload: T;
  readonly operadorRole: OperadorRole;
  readonly acao: PermissaoSistema;
}

/**
 * Gateway compulsório que valida CPF, CEP, privilégio mínimo e
 * sanitiza todos os inputs antes de qualquer despacho para a nuvem da Google.
 */
export function interceptarESubmeterGoogleCloud<T extends Record<string, unknown>>(
  envelope: PreCloudValidationEnvelope<T>
): {
  readonly aprovado: boolean;
  readonly payloadSanitizado: T;
  readonly cpfValidado?: string;
  readonly cepValidado?: string;
  readonly motivoRejeicao?: string;
} {
  // 1. Verificação de Privilégio Mínimo
  if (!verificarPrivilegioMinimo(envelope.operadorRole, envelope.acao)) {
    return {
      aprovado: false,
      payloadSanitizado: envelope.payload,
      motivoRejeicao: `ACESSO NEGADO (PRIVILÉGIO MÍNIMO): O papel [${envelope.operadorRole}] não possui a permissão '${envelope.acao}'.`,
    };
  }

  // 2. Validação Estrita de CPF (se presente)
  let cpfFormatado: string | undefined;
  if (envelope.cpf) {
    const resCpf = validarCPF(envelope.cpf);
    if (!resCpf.valido) {
      return {
        aprovado: false,
        payloadSanitizado: envelope.payload,
        motivoRejeicao: `BLOQUEIO DE SUBMISSÃO CLOUD: ${resCpf.mensagemErro || 'CPF inválido.'}`,
      };
    }
    cpfFormatado = resCpf.formatado;
  }

  // 3. Validação Estrita de CEP (se presente)
  let cepFormatado: string | undefined;
  if (envelope.cep) {
    const resCep = validarCEP(envelope.cep);
    if (!resCep.valido) {
      return {
        aprovado: false,
        payloadSanitizado: envelope.payload,
        motivoRejeicao: `BLOQUEIO DE SUBMISSÃO CLOUD: ${resCep.mensagemErro || 'CEP inválido.'}`,
      };
    }
    cepFormatado = resCep.formatado;
  }

  // 4. Sanitização recursiva do payload contra XSS e SQL Injection
  const payloadLimpo = { ...envelope.payload };
  for (const [chave, valor] of Object.entries(payloadLimpo)) {
    if (typeof valor === 'string') {
      const checagemSql = detectarTentativaSqlInjection(valor);
      if (checagemSql.detectado) {
        return {
          aprovado: false,
          payloadSanitizado: envelope.payload,
          motivoRejeicao: `BLOQUEIO DE SUBMISSÃO CLOUD: Assinatura de SQL Injection detectada no campo '${chave}'.`,
        };
      }
      (payloadLimpo as Record<string, unknown>)[chave] = sanitizarStringEntrada(valor);
    }
  }

  return {
    aprovado: true,
    payloadSanitizado: payloadLimpo,
    cpfValidado: cpfFormatado,
    cepValidado: cepFormatado,
  };
}
