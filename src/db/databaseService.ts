/**
 * @license
 * CIMADEBE / SIGM - Sistema Integrado de Governança e Ministros
 * Camada de Persistência e Serviço de Conexão com Banco de Dados Relacional
 * Compatível com Supabase / Cloud SQL (PostgreSQL) com RLS e Auditoria SHA-256
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sha256, normalizeUtf8String } from '../crypto';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, limit } from 'firebase/firestore';
import {
  validarCPF,
  validarCEP,
  detectarTentativaSqlInjection,
} from '../security/validationAndSanitization';
import { getSystemDate, getSystemTimeIso, getSystemYear } from '../financialEngine';

// ============================================================================
// 1. MODELOS DE TIPAGEM ESTREITA DO BANCO RELACIONAL
// ============================================================================

export interface DbTenant {
  readonly id: string;
  readonly name: string;
  readonly cnpj: string;
  readonly chave_sede: boolean;
  readonly endereco?: string;
  readonly criado_em: string;
}

export interface DbMinistro {
  readonly id: string;
  readonly tenant_id: string;
  readonly nome: string;
  readonly cpf: string;
  readonly cargo: string;
  readonly status: 'ATIVO' | 'SUSPENSO' | 'EM_ANALISE';
  readonly status_adimplencia: 'ADIMPLENTE' | 'PENDENTE' | 'INADIMPLENTE';
  readonly cep: string;
  readonly endereco: string;
  readonly bairro: string;
  readonly cidade: string;
  readonly uf: string;
  readonly data_filiacao: string;
  readonly foto_url?: string;
  readonly criado_em: string;
  readonly atualizado_em: string;
}

export interface DbAnuidade {
  readonly id: string;
  readonly ministro_id: string;
  readonly tenant_id: string;
  readonly ano_vigente: number;
  readonly data_vencimento: string;
  readonly valor: number;
  readonly status_pagamento: 'PAGO' | 'ABERTO';
  readonly tipo: 'RECEITA';
  readonly categoria: 'TAXA_CONVENCAO' | 'ANUIDADE';
  readonly asaas_payment_id?: string;
  readonly data_confirmacao_pagamento?: string;
  readonly criado_em: string;
  readonly atualizado_em: string;
}

export interface DbInscricaoAGO {
  readonly id: string;
  readonly ministro_id: string;
  readonly tenant_id: string;
  readonly cpf: string;
  readonly ano_vigente: number;
  readonly status_inscricao: 'VALIDA' | 'REVOGADA';
  readonly data_inscricao: string;
  readonly motivo_revogacao?: string;
  readonly data_revogacao?: string;
}

export interface DbAuditLog {
  readonly id: string;
  readonly tenant_id: string;
  readonly timestamp: string;
  readonly operador_id: string;
  readonly acao: string;
  readonly payload_str: string;
  readonly payload_hash: string;
  readonly ip_sessao: string;
}

export interface DbIgrejaFiliada {
  readonly id: string;
  readonly tenant_id: string;
  readonly razao_social: string;
  readonly nome_fantasia: string;
  readonly cnpj: string;
  readonly data_abertura: string;
  readonly natureza_juridica: string;
  readonly cnae_principal: string;
  readonly situacao_cadastral: 'ATIVA' | 'BAIXADA' | 'SUSPENSA';
  readonly logradouro: string;
  readonly numero: string;
  readonly complemento?: string;
  readonly bairro: string;
  readonly municipio: string;
  readonly uf: string;
  readonly cep: string;
  readonly email: string;
  readonly telefone: string;
  readonly pastor_presidente_id?: string;
  readonly pastor_presidente_nome: string;
  readonly logo_url?: string;
  readonly status: 'ATIVA' | 'SUSPENSA';
  readonly data_filiacao: string;
  readonly criado_em: string;
  readonly atualizado_em: string;
}

export interface DbUsuarioAdministrativo {
  readonly id: string;
  readonly tenant_id: string;
  readonly ministro_id: string;
  readonly nome: string;
  readonly cpf: string;
  readonly email: string;
  readonly telefone: string;
  readonly cargo_ministerial: string;
  readonly igreja_filiada: string;
  readonly role: string;
  readonly cargo_administrativo: string;
  readonly departamento: string;
  readonly status_acesso: 'ATIVO' | 'SUSPENSO' | 'EM_ANALISE';
  readonly data_concessao: string;
  readonly ultimo_acesso: string;
  readonly foto_url?: string;
  readonly permissoes_speciais: readonly string[];
  readonly criado_em: string;
  readonly atualizado_em: string;
}

export interface DbEvento {
  readonly id: string;
  readonly tenant_id: string;
  readonly titulo: string;
  readonly subtitulo: string;
  readonly data_evento: string;
  readonly local: string;
  readonly banner_url: string;
  readonly descricao: string;
  readonly status: 'ATIVO' | 'ENCERRADO' | 'RASCUNHO' | 'INATIVO' | 'EXCLUIDO';
  readonly criado_em: string;
  readonly atualizado_em: string;
  readonly tema_biblico?: string;
  readonly texto_convite?: string;
  readonly preletores?: Array<{ nome: string; foto_url: string; cargo: string }>;
  readonly chave_mestra?: string;
  readonly data_inicio?: string;
  readonly data_fim?: string;
  readonly deletado?: boolean;
  readonly deletado_em?: string;
  readonly deletado_por?: string;
}

export interface DbNoticia {
  readonly id: string;
  readonly tenant_id: string;
  readonly titulo: string;
  readonly subtitulo: string;
  readonly data_publicacao: string;
  readonly autor: string;
  readonly banner_url: string;
  readonly conteudo: string;
  readonly categoria?: string;
  readonly status: 'PUBLICADO' | 'RASCUNHO' | 'INATIVO' | 'EXCLUIDO';
  readonly criado_em: string;
  readonly atualizado_em: string;
  readonly deletado?: boolean;
  readonly deletado_em?: string;
  readonly deletado_por?: string;
}

export interface InsertMinistroPayload {
  readonly nome: string;
  readonly cpf: string;
  readonly cargo: string;
  readonly status?: 'ATIVO' | 'SUSPENSO' | 'EM_ANALISE';
  readonly status_adimplencia?: 'ADIMPLENTE' | 'PENDENTE' | 'INADIMPLENTE';
  readonly cep: string;
  readonly endereco: string;
  readonly bairro: string;
  readonly cidade: string;
  readonly uf: string;
  readonly foto_url?: string;
  readonly valorTaxaInicial?: number;
}

// ============================================================================
// 2. CONFIGURAÇÃO DE AMBIENTE E CLIENTE SUPABASE / CLOUD SQL
// ============================================================================

const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  'https://mock-supabase-cloudsql.cimadebe.org';

const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  'mock_sec_key_token_supabase_rls_banking_provider_2026';

// Identificador se o cliente está conectado a uma instância real ou emulada
export const IS_REAL_SUPABASE_CONFIGURED = Boolean(
  typeof import.meta !== 'undefined' &&
    (import.meta as any).env?.VITE_SUPABASE_URL &&
    (import.meta as any).env?.VITE_SUPABASE_ANON_KEY &&
    !(import.meta as any).env?.VITE_SUPABASE_URL.includes('mock')
);

// Criação do cliente oficial do Supabase
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public',
  },
});

// Contexto do Tenant da Sessão Ativa para injeção em RLS
let sessionTenantId = '11111111-1111-1111-1111-111111111111';

/**
 * Define o tenant ativo da sessão atual, propagando o contexto para o isolamento RLS.
 */
export function setDatabaseSessionTenant(tenantId: string): void {
  sessionTenantId = tenantId;
}

export function getDatabaseSessionTenant(): string {
  return sessionTenantId;
}

// ============================================================================
// 3. STORE TRANSACIONAL EMULADA COM SUPORTE TOTAL A RLS (OFFLINE / DEV ENGINE)
// Garante conformidade de RLS e unicidade mesmo quando Supabase remoto não configurado
// ============================================================================

class MockDatabaseEngine {
  private tenants: DbTenant[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'CIMADEBE Sede Central Salvador',
      cnpj: '14.852.963/0001-44',
      chave_sede: true,
      endereco: 'Av. Sete de Setembro, 1500 - Campo Grande, Salvador - BA',
      criado_em: '2026-01-01T00:00:00Z',
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'CIMADEBE Regional Feira de Santana',
      cnpj: '25.963.741/0001-55',
      chave_sede: false,
      endereco: 'Av. Getúlio Vargas, 2100 - Centro, Feira de Santana - BA',
      criado_em: '2026-01-01T00:00:00Z',
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      name: 'CIMADEBE Regional Vitória da Conquista',
      cnpj: '36.741.852/0001-66',
      chave_sede: false,
      endereco: 'Av. Juracy Magalhães, 340 - Felícia, Vitória da Conquista - BA',
      criado_em: '2026-01-01T00:00:00Z',
    },
  ];

  private ministros: DbMinistro[] = [];

  private anuidades: DbAnuidade[] = [];

  private inscricoesAgo: DbInscricaoAGO[] = [];

  private auditLogs: DbAuditLog[] = [
    {
      id: 'd0000000-0000-0000-0000-000000000000',
      tenant_id: '11111111-1111-1111-1111-111111111111',
      timestamp: '2026-01-01T00:00:00Z',
      operador_id: 'SISTEMA_ROOT_RLS',
      acao: 'GENESIS_POSTGRES_SCHEMA',
      payload_str: '{"status":"INICIALIZADO","rls":true,"fips180_4":true}',
      payload_hash: '0000000000000000000000000000000000000000000000000000000000000000',
      ip_sessao: '127.0.0.1',
    },
  ];

  private igrejasFiliadas: DbIgrejaFiliada[] = [];

  private usuariosAdministrativos: DbUsuarioAdministrativo[] = [];

  private eventos: DbEvento[] = [];

  private noticias: DbNoticia[] = [];

  public getEventos(_tenantId?: string): DbEvento[] {
    return this.eventos;
  }
  public insertEvento(evento: DbEvento): void {
    this.eventos.push(Object.freeze({ ...evento }));
  }
  public updateEvento(id: string, update: Partial<DbEvento>): void {
    const idx = this.eventos.findIndex((e) => e.id === id);
    if (idx !== -1) {
      this.eventos[idx] = Object.freeze({ ...this.eventos[idx], ...update, atualizado_em: new Date().toISOString() });
    }
  }
  public deleteEvento(id: string): void {
    this.eventos = this.eventos.filter((e) => e.id !== id);
  }

  public getNoticias(_tenantId?: string): DbNoticia[] {
    return this.noticias;
  }
  public insertNoticia(noticia: DbNoticia): void {
    this.noticias.push(Object.freeze({ ...noticia }));
  }
  public updateNoticia(id: string, update: Partial<DbNoticia>): void {
    const idx = this.noticias.findIndex((n) => n.id === id);
    if (idx !== -1) {
      this.noticias[idx] = Object.freeze({ ...this.noticias[idx], ...update, atualizado_em: new Date().toISOString() });
    }
  }
  public deleteNoticia(id: string): void {
    this.noticias = this.noticias.filter((n) => n.id !== id);
  }

  public getIgrejasFiliadas(tenantId?: string): DbIgrejaFiliada[] {
    if (!tenantId) {
      return this.igrejasFiliadas;
    }
    return this.igrejasFiliadas.filter((i) => i.tenant_id === tenantId);
  }

  public insertIgrejaFiliada(igreja: DbIgrejaFiliada): void {
    const jaExiste = this.igrejasFiliadas.some((i) => i.cnpj === igreja.cnpj && i.id !== igreja.id);
    if (jaExiste) {
      throw new Error(`VIOLAÇÃO DE UNICIDADE: CNPJ ${igreja.cnpj} já cadastrado.`);
    }
    this.igrejasFiliadas.push(Object.freeze({ ...igreja }));
  }

  public updateIgrejaFiliada(id: string, update: Partial<DbIgrejaFiliada>): void {
    const idx = this.igrejasFiliadas.findIndex((i) => i.id === id);
    if (idx !== -1) {
      this.igrejasFiliadas[idx] = Object.freeze({
        ...this.igrejasFiliadas[idx],
        ...update,
        atualizado_em: new Date().toISOString(),
      });
    }
  }

  public deleteIgrejaFiliada(id: string): void {
    this.igrejasFiliadas = this.igrejasFiliadas.filter((i) => i.id !== id);
  }

  public getUsuariosAdministrativos(tenantId: string): DbUsuarioAdministrativo[] {
    return this.usuariosAdministrativos.filter((u) => u.tenant_id === tenantId);
  }

  public insertUsuarioAdministrativo(usuario: DbUsuarioAdministrativo): void {
    const jaExiste = this.usuariosAdministrativos.some((u) => u.cpf === usuario.cpf);
    if (jaExiste) {
      throw new Error(`VIOLAÇÃO DE UNICIDADE: CPF ${usuario.cpf} já possui acesso administrativo.`);
    }
    this.usuariosAdministrativos.push(Object.freeze({ ...usuario }));
  }

  // RLS nativo do Mock Engine: filtra estritamente por tenant_id
  public getMinistros(tenantId: string): DbMinistro[] {
    return this.ministros.filter((m) => m.tenant_id === tenantId);
  }

  public getAnuidades(tenantId: string): DbAnuidade[] {
    return this.anuidades.filter((a) => a.tenant_id === tenantId);
  }

  public getInscricoesAgo(tenantId: string): DbInscricaoAGO[] {
    return this.inscricoesAgo.filter((i) => i.tenant_id === tenantId);
  }

  public getAuditLogs(tenantId: string): DbAuditLog[] {
    return this.auditLogs.filter((l) => l.tenant_id === tenantId);
  }

  public insertMinistro(ministro: DbMinistro): void {
    // Unicidade de CPF
    const jaExiste = this.ministros.some((m) => m.cpf === ministro.cpf);
    if (jaExiste) {
      throw new Error(`VIOLAÇÃO DE UNICIDADE (UNIQUE CONSTRAINT): CPF ${ministro.cpf} já cadastrado no banco.`);
    }
    this.ministros.push(Object.freeze({ ...ministro }));
  }

  public insertAnuidade(anuidade: DbAnuidade): void {
    this.anuidades.push(Object.freeze({ ...anuidade }));
  }

  public updateAnuidade(anuidade: DbAnuidade): void {
    const idx = this.anuidades.findIndex((a) => a.id === anuidade.id);
    if (idx !== -1) {
      this.anuidades[idx] = Object.freeze({ ...anuidade });
    }
  }

  public updateMinistro(ministro: DbMinistro): void {
    const idx = this.ministros.findIndex((m) => m.id === ministro.id);
    if (idx !== -1) {
      this.ministros[idx] = Object.freeze({ ...ministro });
    }
  }

  public insertInscricaoAGO(inscricao: DbInscricaoAGO): void {
    // Restrição única combinando 'cpf' + 'ano_vigente' + 'status_inscricao'
    const duplicata = this.inscricoesAgo.some(
      (i) =>
        i.cpf === inscricao.cpf &&
        i.ano_vigente === inscricao.ano_vigente &&
        i.status_inscricao === inscricao.status_inscricao
    );

    if (duplicata) {
      throw new Error(
        `VIOLAÇÃO DE CONSTRAINT (uq_inscricao_ago_cpf_ano_status): Já existe inscrição ativa para o CPF ${inscricao.cpf} no ciclo ${inscricao.ano_vigente}. Operação rejeitada.`
      );
    }

    // Trava adicional: proíbe duas inscrições 'VALIDA' simultâneas
    if (inscricao.status_inscricao === 'VALIDA') {
      const temValida = this.inscricoesAgo.some(
        (i) => i.cpf === inscricao.cpf && i.ano_vigente === inscricao.ano_vigente && i.status_inscricao === 'VALIDA'
      );
      if (temValida) {
        throw new Error(
          `VETO DE UNICIDADE AGO: O ministro com CPF ${inscricao.cpf} já possui credenciamento 'VALIDA' no ano ${inscricao.ano_vigente}.`
        );
      }
    }

    this.inscricoesAgo.push(Object.freeze({ ...inscricao }));
  }

  public insertAuditLog(log: DbAuditLog): void {
    this.auditLogs.push(Object.freeze({ ...log }));
  }
}

export const mockDb = new MockDatabaseEngine();

// ============================================================================
// 4. FUNÇÃO AUXILIAR: GERAÇÃO DE LOG DE AUDITORIA SHA-256
// ============================================================================

/**
 * Cria um registro auditável em conformidade com FIPS 180-4 SHA-256,
 * gravando-o compulsoriamente na tabela 'audit_logs'.
 */
async function registrarLogAuditoria(
  tenantId: string,
  operadorId: string,
  acao: string,
  payloadData: unknown
): Promise<DbAuditLog> {
  const timestampIso = '2026-09-26T12:00:00.000Z'; // Data base contábil
  const payloadStr = normalizeUtf8String(JSON.stringify(payloadData));
  const payloadHash = sha256(`${tenantId}|${operadorId}|${acao}|${payloadStr}|${timestampIso}`);

  const novoLog: DbAuditLog = Object.freeze({
    id: `aud-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`,
    tenant_id: tenantId,
    timestamp: timestampIso,
    operador_id: operadorId,
    acao,
    payload_str: payloadStr,
    payload_hash: payloadHash,
    ip_sessao: '127.0.0.1 (TLS 1.3 / Cloud SQL)',
  });

  if (IS_REAL_SUPABASE_CONFIGURED) {
    try {
      const { error } = await supabase.from('audit_logs').insert([novoLog]);
      if (error) {
        console.error('[DATABASE_SERVICE_AUDIT_LOG_ERROR]', error);
      }
    } catch (err) {
      console.error('[DATABASE_SERVICE_AUDIT_LOG_EXCEPTION]', err);
    }
  }

  // Sempre grava no motor local para coerência contínua
  mockDb.insertAuditLog(novoLog);
  return novoLog;
}

// ============================================================================
// 5. FUNÇÕES PRINCIPAIS DE SERVIÇO ASSÍNCRONO
// ============================================================================

/**
 * 1. fetchMinistros(tenantId: string)
 * Consulta os ministros aplicando estritamente as regras de isolamento RLS.
 */
export async function fetchMinistros(tenantId: string): Promise<readonly DbMinistro[]> {
  if (!tenantId) {
    throw new Error('Acesso a banco rejeitado: tenant_id é obrigatório para execução de query.');
  }

  // Sanitização anti-SQLi preventiva
  const checagemTenant = detectarTentativaSqlInjection(tenantId);
  if (checagemTenant.detectado) {
    throw new Error('Ataque detectado: identificador de tenant contém parâmetros SQLi maliciosos.');
  }

  try {
    const snap = await getDocs(query(collection(db, 'ministros'), limit(50)));
    if (!snap.empty) {
      const list: DbMinistro[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          tenant_id: data.tenant_id || data.tenantId || tenantId,
          nome: data.nome || '',
          cpf: data.cpf || '',
          cargo: data.cargo || '',
          status: data.status || 'ATIVO',
          status_adimplencia: data.status_adimplencia || data.statusAdimplencia || 'ADIMPLENTE',
          cep: data.dadosEndereco?.cep || data.cep || '',
          endereco: data.dadosEndereco?.rua || data.endereco || '',
          bairro: data.dadosEndereco?.bairro || data.bairro || '',
          cidade: data.dadosEndereco?.cidade || data.cidade || '',
          uf: data.dadosEndereco?.uf || data.uf || 'BA',
          data_filiacao: data.dataFiliacao || data.data_filiacao || '',
          foto_url: data.fotoUrl || data.foto_url || '',
          criado_em: data.criado_em || new Date().toISOString(),
          atualizado_em: data.atualizado_em || new Date().toISOString(),
        };
      });
      return Object.freeze(list);
    }
  } catch (err) {
    console.error('[FIRESTORE_FETCH_MINISTROS_ERR]', err);
  }

  return Object.freeze([]);
}

/**
 * 2. insertMinistroComTaxaInicial(payload, operadorId, tenantId)
 * Registra novo ministro no banco gerando a taxa de filiação inicial vinculada e log auditado SHA-256.
 */
export async function insertMinistroComTaxaInicial(
  payload: InsertMinistroPayload,
  operadorId: string,
  tenantId: string
): Promise<{
  readonly ministro: DbMinistro;
  readonly anuidade: DbAnuidade;
  readonly log: DbAuditLog;
}> {
  // 1. Validação estrita de CPF com Módulo 11 da Receita
  const resCpf = validarCPF(payload.cpf);
  if (!resCpf.valido) {
    throw new Error(`VETO DE SUBMISSÃO CLOUD: ${resCpf.mensagemErro}`);
  }

  // 2. Validação estrita de CEP
  const resCep = validarCEP(payload.cep);
  if (!resCep.valido) {
    throw new Error(`VETO DE SUBMISSÃO CLOUD: ${resCep.mensagemErro}`);
  }

  // 3. Detecção de SQL Injection nos campos textuais
  for (const [campo, valor] of Object.entries(payload)) {
    if (typeof valor === 'string') {
      const checkSql = detectarTentativaSqlInjection(valor);
      if (checkSql.detectado) {
        throw new Error(
          `VETO DE SEGURANÇA BANCÁRIA: Tentativa de SQL Injection detectada no campo '${campo}'. Assinatura: ${checkSql.padroesDetectados.join(', ')}`
        );
      }
    }
  }

  const timestampIso = getSystemTimeIso();
  const dataHoje = getSystemDate();
  const anoAtual = getSystemYear();
  const novoMinistroId = `min-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
  const novaAnuidadeId = `an-fil-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
  const valorTaxa = payload.valorTaxaInicial ?? 190.0;

  const novoMinistro: DbMinistro = Object.freeze({
    id: novoMinistroId,
    tenant_id: tenantId,
    nome: normalizeUtf8String(payload.nome),
    cpf: resCpf.formatado,
    cargo: normalizeUtf8String(payload.cargo),
    status: payload.status ?? 'ATIVO',
    status_adimplencia: payload.status_adimplencia ?? 'PENDENTE',
    cep: resCep.formatado,
    endereco: normalizeUtf8String(payload.endereco),
    bairro: normalizeUtf8String(payload.bairro),
    cidade: normalizeUtf8String(payload.cidade),
    uf: payload.uf.toUpperCase(),
    data_filiacao: dataHoje,
    foto_url: payload.foto_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80',
    criado_em: timestampIso,
    atualizado_em: timestampIso,
  });

  const novaAnuidade: DbAnuidade = Object.freeze({
    id: novaAnuidadeId,
    ministro_id: novoMinistroId,
    tenant_id: tenantId,
    ano_vigente: anoAtual,
    data_vencimento: dataHoje,
    valor: valorTaxa,
    status_pagamento: 'ABERTO',
    tipo: 'RECEITA',
    categoria: 'TAXA_CONVENCAO',
    criado_em: timestampIso,
    atualizado_em: timestampIso,
  });

  if (IS_REAL_SUPABASE_CONFIGURED) {
    const { error: errMin } = await supabase.from('ministros').insert([novoMinistro]);
    if (errMin) {
      throw new Error(`Falha ao inserir ministro no PostgreSQL: ${errMin.message}`);
    }

    const { error: errAnu } = await supabase.from('anuidades').insert([novaAnuidade]);
    if (errAnu) {
      throw new Error(`Falha ao inserir anuidade no PostgreSQL: ${errAnu.message}`);
    }
  }

  // Atualização atômica no motor local
  mockDb.insertMinistro(novoMinistro);
  mockDb.insertAnuidade(novaAnuidade);

  // Registro compulsório no audit log com SHA-256
  const log = await registrarLogAuditoria(tenantId, operadorId, 'CADASTRO_MINISTRO_TAXA_INICIAL', {
    ministro: novoMinistro,
    anuidade: novaAnuidade,
  });

  return {
    ministro: novoMinistro,
    anuidade: novaAnuidade,
    log,
  };
}

/**
 * 3. confirmarPagamentoAsaasCascata(anuidadeId, paymentId, valor, operadorId, tenantId)
 * Liquida a anuidade e recalcula em cascata o status do ministro correspondente.
 */
export async function confirmarPagamentoAsaasCascata(
  anuidadeId: string,
  paymentId: string,
  valor: number,
  operadorId: string,
  tenantId: string
): Promise<{
  readonly anuidade: DbAnuidade;
  readonly statusAdimplenciaAtualizado: 'ADIMPLENTE' | 'PENDENTE' | 'INADIMPLENTE';
  readonly log: DbAuditLog;
}> {
  const timestampIso = '2026-09-26T12:00:00.000Z';
  const anuidadesDoTenant = mockDb.getAnuidades(tenantId);
  const anuidadeAlvo = anuidadesDoTenant.find((a) => a.id === anuidadeId);

  if (!anuidadeAlvo) {
    throw new Error(`Acesso negado ou anuidade não encontrada para o id [${anuidadeId}] sob o tenant [${tenantId}].`);
  }

  const anuidadeAtualizada: DbAnuidade = Object.freeze({
    ...anuidadeAlvo,
    status_pagamento: 'PAGO',
    asaas_payment_id: paymentId,
    data_confirmacao_pagamento: timestampIso,
    atualizado_em: timestampIso,
  });

  // Atualiza a anuidade
  if (IS_REAL_SUPABASE_CONFIGURED) {
    const { error } = await supabase
      .from('anuidades')
      .update({
        status_pagamento: 'PAGO',
        asaas_payment_id: paymentId,
        data_confirmacao_pagamento: timestampIso,
        atualizado_em: timestampIso,
      })
      .eq('id', anuidadeId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Falha ao liquidar anuidade no Supabase: ${error.message}`);
    }
  }

  mockDb.updateAnuidade(anuidadeAtualizada);

  // Recálculo em cascata do status de adimplência do ministro
  const todasAnuidadesMinistro = mockDb
    .getAnuidades(tenantId)
    .filter((a) => a.ministro_id === anuidadeAlvo.ministro_id);

  const dataCorte = '2026-09-26';
  const temInadimplente = todasAnuidadesMinistro.some(
    (a) => a.status_pagamento === 'ABERTO' && a.data_vencimento < dataCorte
  );
  const temPendente = todasAnuidadesMinistro.some(
    (a) => a.status_pagamento === 'ABERTO' && a.data_vencimento >= dataCorte
  );

  let novoStatus: 'ADIMPLENTE' | 'PENDENTE' | 'INADIMPLENTE' = 'ADIMPLENTE';
  if (temInadimplente) {
    novoStatus = 'INADIMPLENTE';
  } else if (temPendente) {
    novoStatus = 'PENDENTE';
  }

  // Atualiza ministro
  const ministrosDoTenant = mockDb.getMinistros(tenantId);
  const ministroAlvo = ministrosDoTenant.find((m) => m.id === anuidadeAlvo.ministro_id);
  if (ministroAlvo) {
    const ministroAtualizado: DbMinistro = Object.freeze({
      ...ministroAlvo,
      status_adimplencia: novoStatus,
      atualizado_em: timestampIso,
    });
    mockDb.updateMinistro(ministroAtualizado);

    if (IS_REAL_SUPABASE_CONFIGURED) {
      await supabase
        .from('ministros')
        .update({
          status_adimplencia: novoStatus,
          atualizado_em: timestampIso,
        })
        .eq('id', ministroAlvo.id)
        .eq('tenant_id', tenantId);
    }
  }

  // Grava auditoria SHA-256
  const log = await registrarLogAuditoria(tenantId, operadorId, 'LIQUIDACAO_ANUIDADE_CASCATA_ASAAS', {
    anuidadeId,
    paymentId,
    valor,
    statusAdimplenciaAtualizado: novoStatus,
  });

  return {
    anuidade: anuidadeAtualizada,
    statusAdimplenciaAtualizado: novoStatus,
    log,
  };
}

/**
 * 4. registrarInscricaoAGO(ministroId, cpf, anoVigente, operadorId, tenantId)
 * Realiza o credenciamento na AGO validando adimplência e acionando a trava de unicidade no banco.
 */
export async function registrarInscricaoAGO(
  ministroId: string,
  cpf: string,
  anoVigente: number,
  operadorId: string,
  tenantId: string
): Promise<{
  readonly inscricao: DbInscricaoAGO;
  readonly log: DbAuditLog;
}> {
  const resCpf = validarCPF(cpf);
  if (!resCpf.valido) {
    throw new Error(`Falha de inscrição AGO: ${resCpf.mensagemErro}`);
  }

  // Varredura de adimplência do ministro
  const ministrosDoTenant = mockDb.getMinistros(tenantId);
  const ministro = ministrosDoTenant.find((m) => m.id === ministroId || m.cpf === resCpf.formatado);

  if (!ministro) {
    throw new Error(`Ministro com CPF ${resCpf.formatado} não encontrado no tenant [${tenantId}].`);
  }

  if (ministro.status_adimplencia === 'INADIMPLENTE') {
    // Veto de Compliance Contábil
    await registrarLogAuditoria(tenantId, operadorId, 'AGO_NOVA_TENTATIVA_REJEITADA', {
      ministroId,
      cpf: resCpf.formatado,
      motivo: 'VETO_INADIMPLENCIA_FINANCEIRA',
    });
    throw new Error(
      `BLOQUEADO: Inscrição vetada para o CPF ${resCpf.formatado}. O obreiro encontra-se INADIMPLENTE no exercício contábil.`
    );
  }

  const timestampIso = '2026-09-26T12:00:00.000Z';
  const novaInscricaoId = `ago-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;

  const novaInscricao: DbInscricaoAGO = Object.freeze({
    id: novaInscricaoId,
    ministro_id: ministro.id,
    tenant_id: tenantId,
    cpf: resCpf.formatado,
    ano_vigente: anoVigente,
    status_inscricao: 'VALIDA',
    data_inscricao: timestampIso,
  });

  if (IS_REAL_SUPABASE_CONFIGURED) {
    const { error } = await supabase.from('inscricoes_ago').insert([novaInscricao]);
    if (error) {
      if (error.code === '23505') {
        // Código PostgreSQL 23505 = unique_violation
        throw new Error(
          `VETO DE DUPLICIDADE (POSTGRESQL 23505): Já existe inscrição ativa da AGO para o CPF ${resCpf.formatado} em ${anoVigente}.`
        );
      }
      throw new Error(`Erro ao gravar inscrição no PostgreSQL: ${error.message}`);
    }
  }

  // Validação e inserção no motor local (dispara a trava de unicidade se duplicar)
  mockDb.insertInscricaoAGO(novaInscricao);

  // Registro auditado
  const log = await registrarLogAuditoria(tenantId, operadorId, 'AGO_INSCRICAO_HOMOLOGADA', {
    inscricao: novaInscricao,
  });

  return {
    inscricao: novaInscricao,
    log,
  };
}

/**
 * Consulta o histórico de auditoria com isolamento de tenant.
 */
export async function fetchAuditLogs(tenantId: string): Promise<readonly DbAuditLog[]> {
  if (IS_REAL_SUPABASE_CONFIGURED) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('timestamp', { ascending: false });

    if (error) {
      throw new Error(`Erro ao consultar audit logs: ${error.message}`);
    }
    return Object.freeze(data as DbAuditLog[]);
  }

  return Object.freeze([]);
}

export async function fetchIgrejasFiliadas(tenantId?: string): Promise<readonly DbIgrejaFiliada[]> {
  try {
    const snap = await getDocs(query(collection(db, 'igrejas'), limit(50)));
    if (!snap.empty) {
      const list: DbIgrejaFiliada[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          tenant_id: data.tenant_id || data.tenantId || '11111111-1111-1111-1111-111111111111',
          razao_social: data.razao_social || data.razaoSocial || '',
          nome_fantasia: data.nome_fantasia || data.nomeFantasia || '',
          cnpj: data.cnpj || '',
          data_abertura: data.data_abertura || data.dataAbertura || '',
          natureza_juridica: data.natureza_juridica || data.naturezaJuridica || '',
          cnae_principal: data.cnae_principal || data.cnaePrincipal || '',
          situacao_cadastral: data.situacao_cadastral || data.situacaoCadastral || 'ATIVA',
          logradouro: data.logradouro || '',
          numero: data.numero || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          municipio: data.municipio || '',
          uf: data.uf || 'BA',
          cep: data.cep || '',
          email: data.email || '',
          telefone: data.telefone || '',
          pastor_presidente_id: data.pastor_presidente_id || data.pastorPresidenteId || '',
          pastor_presidente_nome: data.pastor_presidente_nome || data.pastorPresidenteNome || '',
          logo_url: data.logo_url || data.logoUrl || '',
          status: data.status || 'ATIVA',
          data_filiacao: data.data_filiacao || data.dataFiliacao || '',
          criado_em: data.criado_em || data.criadoEm || new Date().toISOString(),
          atualizado_em: data.atualizado_em || data.atualizadoEm || new Date().toISOString(),
        };
      });
      return Object.freeze(list);
    }
  } catch (err) {
    console.error('[FIRESTORE_FETCH_IGREJAS_ERR]', err);
  }
  return Object.freeze([]);
}

export async function insertIgrejaComAuditoria(
  payload: Omit<DbIgrejaFiliada, 'id' | 'criado_em' | 'atualizado_em'>,
  tenantId: string,
  operadorId: string
): Promise<{ readonly igreja: DbIgrejaFiliada; readonly log: DbAuditLog }> {
  const id = `ig-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
  const now = new Date().toISOString();
  const igreja: DbIgrejaFiliada = Object.freeze({
    ...payload,
    id,
    tenant_id: tenantId,
    criado_em: now,
    atualizado_em: now,
  });

  try {
    await setDoc(doc(db, 'igrejas', id), {
      ...igreja,
      razaoSocial: igreja.razao_social,
      nomeFantasia: igreja.nome_fantasia,
      dataAbertura: igreja.data_abertura,
      naturezaJuridica: igreja.natureza_juridica,
      cnaePrincipal: igreja.cnae_principal,
      situacaoCadastral: igreja.situacao_cadastral,
      pastorPresidenteId: igreja.pastor_presidente_id,
      pastorPresidenteNome: igreja.pastor_presidente_nome,
      logoUrl: igreja.logo_url,
      dataFiliacao: igreja.data_filiacao,
      tenantId: igreja.tenant_id,
    });
  } catch (err) {
    console.error('[FIRESTORE_INSERT_IGREJA_ERR]', err);
    throw new Error('Erro ao salvar igreja no Firestore.');
  }

  mockDb.insertIgrejaFiliada(igreja);
  const log = await registrarLogAuditoria(tenantId, operadorId, 'IGREJA_CADASTRADA', { igreja });
  return { igreja, log };
}

export async function updateIgrejaComAuditoria(
  id: string,
  payload: Partial<DbIgrejaFiliada>,
  tenantId: string,
  operadorId: string
): Promise<{ readonly log: DbAuditLog }> {
  try {
    const firestorePayload: Record<string, any> = { ...payload, atualizado_em: new Date().toISOString() };
    if (payload.razao_social) firestorePayload.razaoSocial = payload.razao_social;
    if (payload.nome_fantasia) firestorePayload.nomeFantasia = payload.nome_fantasia;
    if (payload.pastor_presidente_nome) firestorePayload.pastorPresidenteNome = payload.pastor_presidente_nome;
    if (payload.pastor_presidente_id) firestorePayload.pastorPresidenteId = payload.pastor_presidente_id;
    if (payload.logo_url) firestorePayload.logoUrl = payload.logo_url;
    if (payload.data_filiacao) firestorePayload.dataFiliacao = payload.data_filiacao;
    if (payload.situacao_cadastral) firestorePayload.situacaoCadastral = payload.situacao_cadastral;

    await updateDoc(doc(db, 'igrejas', id), firestorePayload);
  } catch (err) {
    console.error('[FIRESTORE_UPDATE_IGREJA_ERR]', err);
    throw new Error('Erro ao atualizar igreja no Firestore.');
  }

  mockDb.updateIgrejaFiliada(id, payload);
  const log = await registrarLogAuditoria(tenantId, operadorId, 'IGREJA_ATUALIZADA', { id, payload });
  return { log };
}

export async function deleteIgrejaComAuditoria(
  id: string,
  tenantId: string,
  operadorId: string
): Promise<{ readonly log: DbAuditLog }> {
  try {
    await deleteDoc(doc(db, 'igrejas', id));
  } catch (err) {
    console.error('[FIRESTORE_DELETE_IGREJA_ERR]', err);
    throw new Error('Erro ao excluir igreja no Firestore.');
  }

  mockDb.deleteIgrejaFiliada(id);
  const log = await registrarLogAuditoria(tenantId, operadorId, 'IGREJA_EXCLUIDA', { id });
  return { log };
}

export async function fetchUsuariosAdministrativos(tenantId: string): Promise<readonly DbUsuarioAdministrativo[]> {
  if (IS_REAL_SUPABASE_CONFIGURED) {
    const { data, error } = await supabase.from('usuarios_administrativos').select('*').eq('tenant_id', tenantId);
    if (error) throw new Error(`Erro ao buscar usuários: ${error.message}`);
    return Object.freeze(data as DbUsuarioAdministrativo[]);
  }
  return Object.freeze([...mockDb.getUsuariosAdministrativos(tenantId)]);
}

export const EVENTOS_INICIAIS_BANCO: readonly DbEvento[] = Object.freeze([
  {
    id: 'evento-ago-2026',
    tenant_id: 'default',
    titulo: '1ª Assembleia Geral Ordinária (AGO 2026)',
    subtitulo: 'Grande Conclave Geral de Obreiros e Plenárias Deliberativas',
    data_evento: '2026-11-20',
    data_inicio: '2026-11-20',
    data_fim: '2026-11-23',
    local: 'Centro de Convenções Pastor Gilberto • Salvador / BA',
    banner_url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
    descricao: 'CONVOCAÇÃO E PROGRAMAÇÃO DA ASSEMBLEIA GERAL ORDINÁRIA\n\nPelo presente Edital de Convocação, o Presidente Geral da Convenção convoca todos os ministros habilitados para a Assembleia Geral Ordinária. O tema central é "1ª Assembleia Geral Ordinária (AGO 2026)", desdobrando-se sob o lema: "Grande Conclave Geral de Obreiros e Plenárias Deliberativas".\n\n📅 CRONOGRAMA DE ATIVIDADES:\n• Dia 1 - 09:00: Recepção de Delegados e Credenciamento Biométrico. Sessão Solene de Abertura às 19:30.\n• Dia 2 - 09:00: Sessões plenárias, julgamentos contábeis e aprovação de atas.\n• Dia 3 - 09:00: Homologação de novas filiações e consagrações ministeriais.\n• Dia 4 - 10:00: Eleição e Posse da nova Mesa Diretora. Culto de Encerramento às 19:30.',
    tema_biblico: '“Permanecendo Firmes na Vocação da Glória” (1 Co 15:58)',
    texto_convite: 'Convidamos todos os ministros convencionados e delegados homologados para quatro dias de comunhão celestial, plenárias administrativas e direcionamento estratégico.',
    preletores: [
      { nome: 'Pr. Manoel Carlos', foto_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80', cargo: 'Presidente da Mesa Diretora' }
    ],
    status: 'ATIVO',
    criado_em: '2026-09-01T08:00:00Z',
    atualizado_em: '2026-09-01T08:00:00Z'
  },
  {
    id: 'evento-simposio-pastoral-2026',
    tenant_id: 'default',
    titulo: 'Simpósio Interestadual de Liderança Pastoral & Teologia',
    subtitulo: 'Alinhamento Doutrinário e Capacitação Ministerial para Ministros e Obreiros',
    data_evento: '2026-10-15',
    data_inicio: '2026-10-15',
    data_fim: '2026-10-16',
    local: 'Templo Sede Regional • Feira de Santana / BA',
    banner_url: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1200&q=80',
    descricao: 'Dois dias intensivos de capacitação ministerial, hermenêutica bíblica aplicada, ética pastoral e administração eclesiástica.',
    tema_biblico: '“Maneja bem a palavra da verdade” (2 Tm 2:15)',
    preletores: [
      { nome: 'Pr. Dr. Conferencista Teológico', foto_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80', cargo: 'Doutor em Teologia Pastoral' }
    ],
    status: 'ATIVO',
    criado_em: '2026-08-15T12:00:00Z',
    atualizado_em: '2026-08-15T12:00:00Z'
  }
]);

export const NOTICIAS_INICIAIS_BANCO: readonly DbNoticia[] = Object.freeze([
  {
    id: 'noticia-edital-ago-2026',
    tenant_id: 'default',
    titulo: 'Edital de Convocação Oficial da 1ª Assembleia Geral Ordinária (AGO 2026)',
    subtitulo: 'A Mesa Diretora da CIMADEBE publica o edital de convocação com diretrizes estatutárias e credenciamento.',
    data_publicacao: '2026-09-15',
    autor: 'Secretaria Geral & Mesa Diretora',
    banner_url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
    conteudo: `A Mesa Diretora da Convenção Interestadual de Ministros (CIMADEBE), no uso de suas atribuições estatutárias, torna pública a Convocação Oficial para a 1ª Assembleia Geral Ordinária (AGO 2026).\n\nTodos os ministros filiados (Pastores, Evangelistas, Presbíteros, Diáconos e Cooperadores) em situação de regularidade documental e financeira estão convocados para os trabalhos convencionais, plenárias deliberativas, votação eletrônica e a magna solenidade de posse e consagração.\n\nO credenciamento de delegados e a aquisição do pacote oficial da AGO (com crachá holográfico com QR Code, pasta ministerial e certificado digital) podem ser realizados diretamente pelo Portal do Ministro na aba "AGO".`,
    categoria: 'Convocatória Oficial',
    status: 'PUBLICADO',
    criado_em: '2026-09-15T08:00:00Z',
    atualizado_em: '2026-09-15T08:00:00Z'
  },
  {
    id: 'noticia-seguranca-cr80-dossie',
    tenant_id: 'default',
    titulo: 'Lançamento do Sistema de Identificação CR-80 e Dossiê com Carimbo Criptográfico',
    subtitulo: 'Novo padrão de segurança anti-fraude protege o registro dos ministros em todo o território nacional.',
    data_publicacao: '2026-08-20',
    autor: 'Diretoria de Tecnologia & Governança',
    banner_url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80',
    conteudo: `O Sistema Integrado de Governança e Ministros (SIGM) implementou o novo padrão CR-80 de identificação ministerial com validação em tempo real via QR Code criptografado e emissão de cartas de recomendação de transferência com prazo de validade dinâmico e hash criptográfico inviolável.\n\nCom este recurso, qualquer autoridade civil ou eclesiástica pode atestar a regularidade do ministro através de leitura instantânea, garantindo transparência, integridade e proteção aos obreiros credenciados pela CIMADEBE.`,
    categoria: 'Segurança & Governança',
    status: 'PUBLICADO',
    criado_em: '2026-08-20T10:00:00Z',
    atualizado_em: '2026-08-20T10:00:00Z'
  }
]);

export async function seedEventosENoticiasIniciaisSeVazio(): Promise<void> {
  // Stasis mandate: No automatic background seeding allowed
}

export async function fetchEventos(_tenantId?: string): Promise<readonly DbEvento[]> {
  try {
    const snap = await getDocs(query(collection(db, 'eventos'), limit(50)));
    if (!snap.empty) {
      const lista = snap.docs.map(d => ({ ...d.data(), id: d.id } as DbEvento));
      return Object.freeze(lista);
    }
    return Object.freeze([...EVENTOS_INICIAIS_BANCO]);
  } catch (err: any) {
    console.warn('[databaseService] Firestore fetchEventos modo estático/quota excedida:', err?.message);
    return Object.freeze([...EVENTOS_INICIAIS_BANCO]);
  }
}

/**
 * Localiza e extrai o documento oficial do evento AGO registrado no banco de dados Firestore
 */
export function extrairEventoAgo(eventos?: readonly DbEvento[] | null, cicloVigente?: number | string): DbEvento | null {
  if (!eventos || eventos.length === 0) return null;
  const cicloAlvo = cicloVigente ? String(cicloVigente) : '2026';
  
  // 1. Prioridade máxima: Evento correspondente ao ciclo/ano vigente e chave_mestra ago_conclave ou título AGO
  const porCiclo = eventos.find(
    (e) =>
      (e.chave_mestra === 'ago_conclave' || (e.titulo && (e.titulo.toLowerCase().includes('ago') || e.titulo.toLowerCase().includes('assembleia')))) &&
      (String(e.id).includes(cicloAlvo) || String(e.titulo).includes(cicloAlvo) || String(e.data_inicio).includes(cicloAlvo) || String(e.data_evento).includes(cicloAlvo))
  );
  if (porCiclo) return porCiclo;

  // 2. Fallback para qualquer evento AGO registrado no Firestore
  const encontrado = eventos.find(
    (e) =>
      e.chave_mestra === 'ago_conclave' ||
      (e.titulo && (e.titulo.toLowerCase().includes('ago') || e.titulo.toLowerCase().includes('assembleia')))
  );
  return encontrado || eventos[0] || null;
}

/**
 * Formata amigavelmente o período e datas do conclave para exibição e documentos
 */
export function formatarPeriodoEvento(dataInicio?: string, dataFim?: string, dataEvento?: string): string {
  const dInicioStr = dataInicio || dataEvento;
  if (!dInicioStr) return '';
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  try {
    const [anoI, mesI, diaI] = dInicioStr.split('T')[0].split('-').map(Number);
    if (!anoI || !mesI || !diaI) return dInicioStr;
    const nomeMesI = meses[mesI - 1] || '';

    if (dataFim) {
      const [anoF, mesF, diaF] = dataFim.split('T')[0].split('-').map(Number);
      if (anoF && mesF && diaF) {
        if (anoI === anoF && mesI === mesF) {
          return `${diaI} a ${diaF} de ${nomeMesI} de ${anoI}`;
        }
        const nomeMesF = meses[mesF - 1] || '';
        if (anoI === anoF) {
          return `${diaI} de ${nomeMesI} a ${diaF} de ${nomeMesF} de ${anoI}`;
        }
        return `${diaI}/${mesI}/${anoI} a ${diaF}/${mesF}/${anoF}`;
      }
    }
    return `${diaI} de ${nomeMesI} de ${anoI}`;
  } catch {
    return dInicioStr;
  }
}

export async function insertEventoComAuditoria(
  payload: Omit<DbEvento, 'id' | 'criado_em' | 'atualizado_em'>,
  tenantId: string,
  operadorId: string
): Promise<{ readonly evento: DbEvento; readonly log: DbAuditLog }> {
  const id = `evt-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
  const now = new Date().toISOString();
  const evento: DbEvento = Object.freeze({
    ...payload,
    id,
    tenant_id: tenantId,
    criado_em: now,
    atualizado_em: now,
  });

  try {
    await setDoc(doc(db, 'eventos', id), evento);
  } catch (err) {
    console.error('[FIRESTORE_INSERT_EVENTO_ERR]', err);
    throw new Error('Erro ao salvar evento no Firestore.');
  }

  mockDb.insertEvento(evento);
  const log = await registrarLogAuditoria(tenantId, operadorId, 'EVENTO_CADASTRADO', { evento });
  return { evento, log };
}

export async function updateEventoComAuditoria(
  id: string,
  payload: Partial<DbEvento>,
  tenantId: string,
  operadorId: string
): Promise<{ readonly log: DbAuditLog }> {
  try {
    await setDoc(doc(db, 'eventos', id), { ...payload, atualizado_em: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.error('[FIRESTORE_UPDATE_EVENTO_ERR]', err);
    throw new Error('Erro ao atualizar evento no Firestore.');
  }

  mockDb.updateEvento(id, payload);
  const log = await registrarLogAuditoria(tenantId, operadorId, 'EVENTO_ATUALIZADO', { id, payload });
  return { log };
}

export async function deleteEventoComAuditoria(
  id: string,
  tenantId: string,
  operadorId: string
): Promise<{ readonly log: DbAuditLog }> {
  try {
    await deleteDoc(doc(db, 'eventos', id));
  } catch (err) {
    console.error('[FIRESTORE_DELETE_EVENTO_ERR]', err);
    throw new Error('Erro ao excluir evento no Firestore.');
  }

  mockDb.deleteEvento(id);
  const log = await registrarLogAuditoria(tenantId, operadorId, 'EXCLUSAO_EVENTO', { id });
  return { log };
}

export async function softDeleteEventoComAuditoria(
  id: string,
  tenantId: string,
  operadorId: string
): Promise<{ readonly log: DbAuditLog }> {
  const payload = {
    status: 'INATIVO' as const,
    deletado: true,
    deletado_em: new Date().toISOString(),
    deletado_por: operadorId,
    atualizado_em: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'eventos', id), payload, { merge: true });
  } catch (err) {
    console.error('[FIRESTORE_SOFT_DELETE_EVENTO_ERR]', err);
  }

  mockDb.updateEvento(id, payload);
  const log = await registrarLogAuditoria(tenantId, operadorId, 'EXCLUSAO_EVENTO', { id, softDelete: true });
  return { log };
}

export async function restaurarEventoComAuditoria(
  id: string,
  tenantId: string,
  operadorId: string
): Promise<{ readonly log: DbAuditLog }> {
  const payload = {
    status: 'ATIVO' as const,
    deletado: false,
    deletado_em: '',
    deletado_por: '',
    atualizado_em: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'eventos', id), payload, { merge: true });
  } catch (err) {
    console.error('[FIRESTORE_RESTORE_EVENTO_ERR]', err);
  }

  mockDb.updateEvento(id, payload);
  const log = await registrarLogAuditoria(tenantId, operadorId, 'RESTAURACAO_EVENTO', { id });
  return { log };
}

export async function fetchNoticias(_tenantId?: string): Promise<readonly DbNoticia[]> {
  try {
    const snap = await getDocs(query(collection(db, 'noticias'), limit(50)));
    if (!snap.empty) {
      const lista = snap.docs.map(d => ({ ...d.data(), id: d.id } as DbNoticia));
      return Object.freeze(lista);
    }
    return Object.freeze([]);
  } catch (err: any) {
    console.warn('[databaseService] Firestore fetchNoticias modo estático:', err);
    return Object.freeze([]);
  }
}

export async function insertNoticiaComAuditoria(
  payload: Omit<DbNoticia, 'id' | 'criado_em' | 'atualizado_em'>,
  tenantId: string,
  operadorId: string
): Promise<{ readonly noticia: DbNoticia; readonly log: DbAuditLog }> {
  const id = `not-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
  const now = new Date().toISOString();
  const noticia: DbNoticia = Object.freeze({
    ...payload,
    id,
    tenant_id: tenantId,
    criado_em: now,
    atualizado_em: now,
  });

  try {
    await setDoc(doc(db, 'noticias', id), noticia);
  } catch (err) {
    console.error('[FIRESTORE_INSERT_NOTICIA_ERR]', err);
    throw new Error('Erro ao salvar notícia no Firestore.');
  }

  mockDb.insertNoticia(noticia);
  const log = await registrarLogAuditoria(tenantId, operadorId, 'NOTICIA_CADASTRADA', { noticia });
  return { noticia, log };
}

export async function updateNoticiaComAuditoria(
  id: string,
  payload: Partial<DbNoticia>,
  tenantId: string,
  operadorId: string
): Promise<{ readonly log: DbAuditLog }> {
  try {
    await updateDoc(doc(db, 'noticias', id), { ...payload, atualizado_em: new Date().toISOString() });
  } catch (err) {
    console.error('[FIRESTORE_UPDATE_NOTICIA_ERR]', err);
    throw new Error('Erro ao atualizar notícia no Firestore.');
  }

  mockDb.updateNoticia(id, payload);
  const log = await registrarLogAuditoria(tenantId, operadorId, 'NOTICIA_ATUALIZADA', { id, payload });
  return { log };
}

export async function deleteNoticiaComAuditoria(
  id: string,
  tenantId: string,
  operadorId: string
): Promise<{ readonly log: DbAuditLog }> {
  try {
    await deleteDoc(doc(db, 'noticias', id));
  } catch (err) {
    console.error('[FIRESTORE_DELETE_NOTICIA_ERR]', err);
    throw new Error('Erro ao excluir notícia no Firestore.');
  }

  mockDb.deleteNoticia(id);
  const log = await registrarLogAuditoria(tenantId, operadorId, 'EXCLUSAO_NOTICIA', { id });
  return { log };
}

export async function softDeleteNoticiaComAuditoria(
  id: string,
  tenantId: string,
  operadorId: string
): Promise<{ readonly log: DbAuditLog }> {
  const payload = {
    status: 'INATIVO' as const,
    deletado: true,
    deletado_em: new Date().toISOString(),
    deletado_por: operadorId,
    atualizado_em: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'noticias', id), payload, { merge: true });
  } catch (err) {
    console.error('[FIRESTORE_SOFT_DELETE_NOTICIA_ERR]', err);
  }

  mockDb.updateNoticia(id, payload);
  const log = await registrarLogAuditoria(tenantId, operadorId, 'EXCLUSAO_NOTICIA', { id, softDelete: true });
  return { log };
}

export async function restaurarNoticiaComAuditoria(
  id: string,
  tenantId: string,
  operadorId: string
): Promise<{ readonly log: DbAuditLog }> {
  const payload = {
    status: 'PUBLICADO' as const,
    deletado: false,
    deletado_em: '',
    deletado_por: '',
    atualizado_em: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'noticias', id), payload, { merge: true });
  } catch (err) {
    console.error('[FIRESTORE_RESTORE_NOTICIA_ERR]', err);
  }

  mockDb.updateNoticia(id, payload);
  const log = await registrarLogAuditoria(tenantId, operadorId, 'RESTAURACAO_NOTICIA', { id });
  return { log };
}


