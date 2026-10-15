/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção Geral
 * Serviço Criptográfico de Licenciamento e Proteção Anti-Bypass (SRP)
 * Responsabilidade Única: Gerar, validar algoritmicamente, hashear e auditar o ciclo de vida de uso único de chaves
 */

import { doc, getDoc, runTransaction, type Transaction } from 'firebase/firestore';
import { db } from '../firebase';

// Chave oficial de teste / homologação solicitada pelo operador
export const CHAVE_LICENCA_TESTE_OFICIAL = 'CIMA-2026-CORE-PRO-9842';

/**
 * Interface da Estrutura de Chave de Licença Criptografada
 */
export interface RegistroChaveLicenca {
  id: string; // Hash SHA-256 da chave normalizada
  chaveMascarada: string;
  tipo: 'HOMOLOGACAO_TESTE' | 'PRODUCAO_DEFINITIVA';
  status: 'DISPONIVEL' | 'ATIVADA' | 'REVOGADA';
  ativacoesPermitidas: number;
  ativacoesConsumidas: number;
  geradaEm: string;
  ativadaEm?: string;
  ativadaPor?: string;
  hashIntegridade: string;
  metadados?: {
    versao: string;
    protocolo: string;
    ambiente: string;
  };
}

/**
 * Função utilitária para gerar Hash Criptográfico SHA-256 nativo Web Crypto API
 */
export async function gerarHashSha256(texto: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(texto.trim().toUpperCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Normaliza e formata string de chave de licença
 */
export function normalizarChave(chave: string): string {
  return chave.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

/**
 * Validação algorítmica de formato da chave de licença (Anti-injeção)
 * Padrão aceito: CIMA-AAAA-XXXX-XXXX ou CIMA-AAAA-XXXX-XXXX-XXXX
 */
export function validarFormatoChave(chave: string): { valido: boolean; motivo?: string } {
  const limpa = normalizarChave(chave);
  if (!limpa) {
    return { valido: false, motivo: 'A chave de licença não pode estar vazia.' };
  }
  if (limpa.length < 12) {
    return { valido: false, motivo: 'Comprimento da chave insuficiente. Mínimo de 12 caracteres.' };
  }
  const regexPadrao = /^CIMA-\d{4}-[A-Z0-9]{3,8}-[A-Z0-9]{3,8}(-[A-Z0-9]{3,8})?$/;
  if (!regexPadrao.test(limpa) && limpa !== CHAVE_LICENCA_TESTE_OFICIAL) {
    return { valido: false, motivo: 'Formato inválido. Use o padrão CIMA-2026-CORE-PRO-XXXX.' };
  }
  return { valido: true };
}

/**
 * Gerador Criptográfico de Chaves Únicas de Produção (para o fechamento do projeto)
 * Gera chave com entropia segura (crypto.getRandomValues) e segmento checksum de integridade
 */
export async function gerarChaveLicencaProducao(ano: number = 2026): Promise<{
  chave: string;
  hashSha256: string;
  checksum: string;
}> {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  
  const bloco1 = Array.from(array.slice(0, 4))
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join('');
  const bloco2 = Array.from(array.slice(4, 8))
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join('');

  const chaveBase = `CIMA-${ano}-${bloco1}-${bloco2}`;
  const hash = await gerarHashSha256(chaveBase);
  const checksum = hash.slice(0, 4).toUpperCase();
  const chaveCompleta = `${chaveBase}-${checksum}`;
  const hashFinal = await gerarHashSha256(chaveCompleta);

  return {
    chave: chaveCompleta,
    hashSha256: hashFinal,
    checksum
  };
}

export interface PreparacaoChaveTransacao {
  chaveRef: any;
  isUpdate: boolean;
  updateData?: Record<string, any>;
  setData?: RegistroChaveLicenca;
  hashKey: string;
  tipo: string;
}

/**
 * FASE 1: LEITURA E VALIDAÇÃO DA CHAVE NA TRANSAÇÃO (TODOS OS GETS PRIMEIRO)
 */
export async function validarChaveNaTransacaoReadPhase(
  transaction: Transaction,
  chave: string,
  operadorEmail: string
): Promise<PreparacaoChaveTransacao> {
  const limpa = normalizarChave(chave);
  const validacao = validarFormatoChave(limpa);
  if (!validacao.valido) {
    throw new Error(validacao.motivo || 'Chave de licença inválida.');
  }

  const hashKey = await gerarHashSha256(limpa);
  const chaveRef = doc(db, 'chaves_licenca_sistema', hashKey);
  const chaveSnap = await transaction.get(chaveRef);

  const agoraIso = new Date().toISOString();

  if (chaveSnap.exists()) {
    const dados = chaveSnap.data() as RegistroChaveLicenca;
    if (dados.status === 'ATIVADA' || (dados.ativacoesConsumidas && dados.ativacoesConsumidas >= dados.ativacoesPermitidas)) {
      throw new Error(
        `VIOLAÇÃO DE SEGURANÇA: Esta chave de licença (${limpa.slice(0, 9)}...) já foi utilizada e ativada em ${dados.ativadaEm || 'outra sessão'}. Chaves do Core Banking possuem uso estritamente único.`
      );
    }
    if (dados.status === 'REVOGADA') {
      throw new Error('Esta chave de licença foi revogada pela central de governança.');
    }

    return {
      chaveRef,
      isUpdate: true,
      updateData: {
        status: 'ATIVADA',
        ativacoesConsumidas: 1,
        ativadaEm: agoraIso,
        ativadaPor: operadorEmail,
        hashIntegridade: hashKey
      },
      hashKey,
      tipo: dados.tipo
    };
  } else {
    // Se for a chave oficial de teste ou uma nova chave válida de primeiro uso:
    const isTeste = limpa === CHAVE_LICENCA_TESTE_OFICIAL;
    const novoRegistro: RegistroChaveLicenca = {
      id: hashKey,
      chaveMascarada: `${limpa.slice(0, 9)}****-****`,
      tipo: isTeste ? 'HOMOLOGACAO_TESTE' : 'PRODUCAO_DEFINITIVA',
      status: 'ATIVADA',
      ativacoesPermitidas: 1,
      ativacoesConsumidas: 1,
      geradaEm: agoraIso,
      ativadaEm: agoraIso,
      ativadaPor: operadorEmail,
      hashIntegridade: hashKey,
      metadados: {
        versao: '2.5.0-ACID',
        protocolo: 'BUNKER-SHA256-SINGLE-USE',
        ambiente: isTeste ? 'TESTE_HOMOLOGACAO' : 'PRODUCAO_CONVENCAO'
      }
    };

    return {
      chaveRef,
      isUpdate: false,
      setData: novoRegistro,
      hashKey,
      tipo: novoRegistro.tipo
    };
  }
}

/**
 * FASE 2: GRAVAÇÃO DO CONSUMO DA CHAVE NA TRANSAÇÃO (TODOS OS SETS/UPDATES DEPOIS)
 */
export function gravarChaveNaTransacaoWritePhase(
  transaction: Transaction,
  preparacao: PreparacaoChaveTransacao
): void {
  if (preparacao.isUpdate && preparacao.updateData) {
    transaction.update(preparacao.chaveRef, preparacao.updateData);
  } else if (preparacao.setData) {
    transaction.set(preparacao.chaveRef, preparacao.setData);
  }
}
