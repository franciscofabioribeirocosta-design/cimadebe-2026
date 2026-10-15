/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção Estadual
 * Modulo de Governança Eclesiástica Estrita (Zero-Trust)
 * 
 * AS 4 CADEIAS RIGIDAS DE GOVERNANCA:
 * 1. CHAIN 1: Pool Central (Ministros) - Todo indivíduo deve existir no cadastro oficial de ministros.
 * 2. CHAIN 2: Mesa Diretora - Composta exclusivamente por ministros eleitos/nomeados do pool.
 * 3. CHAIN 3: Presidente Geral - Exclusivamente por nomeação explícita na Mesa Diretora (configuracoes/mesa_diretora).
 *               Sem nomeação, o cargo permanece RIGOROSAMENTE VAZIO (""). PROIBIDO fallback para primeiro registro ou CNPJ.
 * 4. CHAIN 4: Operadores de Sistema - Funções de Tesouraria, Secretaria, Ética e Fiscal exigem nomeação ativa pela Mesa Diretora.
 */

import type { Ministro, MembroMesaDiretora, UsuarioAdministrativo } from '../types';

export interface PresidenteGeralInfo {
  readonly ministroId: string;
  readonly nome: string;
  readonly cargoEclesiastico: string;
  readonly cpf: string;
  readonly mandato: string;
  readonly nomeadoEm: string;
}

/**
 * CHAIN 3: Obtém o Presidente Geral da Convenção estritamente por nomeação ativa na Mesa Diretora.
 * Se não houver nomeação explícita, retorna null (string vazia "" na interface).
 */
export function obterPresidenteGeralNomeado(
  membrosMesa: readonly MembroMesaDiretora[],
  ministros: readonly Ministro[]
): PresidenteGeralInfo | null {
  if (!membrosMesa || membrosMesa.length === 0) {
    return null;
  }

  // Busca exclusivamente o membro com cargoMesa exato de 'Presidente Geral'
  const nomeacaoPresidente = membrosMesa.find((m) => {
    const cargoNorm = (m.cargoMesa || '').trim().toLowerCase();
    return cargoNorm === 'presidente geral' || cargoNorm === 'presidente';
  });

  if (!nomeacaoPresidente || !nomeacaoPresidente.ministroId) {
    return null;
  }

  // CHAIN 1 & 2: Valida integridade relacional com o cadastro de Ministros
  const ministro = ministros.find((min) => min.id === nomeacaoPresidente.ministroId);
  if (!ministro) {
    return null;
  }

  return {
    ministroId: ministro.id,
    nome: ministro.nome,
    cargoEclesiastico: ministro.cargo || 'Pastor',
    cpf: ministro.cpf || '',
    mandato: nomeacaoPresidente.mandato || '',
    nomeadoEm: nomeacaoPresidente.mandato || '',
  };
}

/**
 * CHAIN 4: Valida se um usuário administrativo possui nomeação explícita e válida pela Mesa Diretora.
 * Se o operador não for nomeado pela Mesa Diretora, seus privilégios funcionais são bloqueados.
 */
export function validarNomeacaoOperador(
  usuarioId: string,
  cargoDesejado: string,
  membrosMesa: readonly MembroMesaDiretora[],
  usuarios: readonly UsuarioAdministrativo[]
): boolean {
  if (!usuarioId || !cargoDesejado) return false;

  const usuario = usuarios.find((u) => u.id === usuarioId && u.statusAcesso === 'ATIVO');
  if (!usuario) return false;

  // Super Admin / Master do Bunker possui governança de infraestrutura técnica
  if (usuario.role === 'SUPER_ADMIN') return true;

  // Validação de correspondência funcional na Mesa Diretora
  const cargoDesejadoNorm = cargoDesejado.toLowerCase().trim();

  return membrosMesa.some((membro) => {
    const cargoMesaNorm = (membro.cargoMesa || '').toLowerCase().trim();
    const ministroVinculado = membro.ministroId === usuario.ministroId || membro.id === usuario.id;

    if (!ministroVinculado) return false;

    if (cargoDesejadoNorm.includes('secretar') && cargoMesaNorm.includes('secretár')) return true;
    if (cargoDesejadoNorm.includes('tesour') && cargoMesaNorm.includes('tesour')) return true;
    if (cargoDesejadoNorm.includes('fiscal') && cargoMesaNorm.includes('fiscal')) return true;
    if (cargoDesejadoNorm.includes('ética') && cargoMesaNorm.includes('ética')) return true;

    return false;
  });
}
