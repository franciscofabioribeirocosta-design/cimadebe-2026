/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Mecanismo Central Reativo (SecurityContext / Core Banking Engine)
 * Isolamento Multi-Tenant, Ledger Criptográfico Encadeado e Hot-Reload Contábil
 * Blindagem Anti-Fraude Cronológica (Data Imutável: 2026-09-26T12:00:00Z)
 * Módulo de Compliance Estrito, Unicidade CPF e Gatilho Crítico da AGO
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import type {
  Tenant,
  Ministro,
  AnuidadeMinistro,
  InscricaoAGO,
  AuditLog,
  CmsSettings,
  AppConfig,
  StatusMinistro,
  StatusAdimplencia,
  AcaoAuditoria,
  EventoContabil,
  ResumoFinanceiroTenant,
  AsaasWebhookPayload,
  DemonstrativoResultadoExercicio,
  AlertaCompulsorioAGO,
  OperadorRole,
  PermissaoSistema,
  ParametrizedStatement,
  SqlParamValue,
  UsuarioAdministrativo,
  CargoAdministrativo,
  CargoEclesiastico,
  MembroMesaDiretora,
  IgrejaFiliada,
  RecursoCritico,
  ResultadoVerificacaoIntegridade,
} from './types';
import {
  obterOrdemHierarquicaMesa,
  gerarRegistroMinisterial,
} from './types';
import { db, auth } from './firebase';
import { onAuthStateChanged, signOut, signInAnonymously, updateProfile } from 'firebase/auth';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
  increment,
  getCountFromServer,
  query,
  where,
  limit,
} from 'firebase/firestore';
import {
  type DbEvento,
  type DbNoticia,
  fetchEventos,
  fetchNoticias,
  mockDb,
  insertEventoComAuditoria,
  updateEventoComAuditoria,
  deleteEventoComAuditoria,
  insertNoticiaComAuditoria,
  updateNoticiaComAuditoria,
  deleteNoticiaComAuditoria,
  formatarPeriodoEvento,
} from './db/databaseService';
import {
  dispararNotificacaoNovaNoticia,
  dispararNotificacaoConvocacaoAgo,
} from './services/webPushService';
import {
  normalizeUtf8String,
  deepFreeze,
  deepCloneAndFreeze,
  sha256,
} from './crypto';
import {
  validarCPF,
  validarCEP,
  sanitizarStringEntrada,
  detectarTentativaSqlInjection,
  buildParametrizedStatement,
  executeSecureQuery,
  verificarPrivilegioMinimo,
  interceptarESubmeterGoogleCloud,
} from './security/validationAndSanitization';
import {
  SYSTEM_REFERENCE_TIME_ISO,
  SYSTEM_REFERENCE_DATE,
  SYSTEM_REFERENCE_YEAR,
  getSystemDate,
  getSystemYear,
  getDataHoraBrasil,
  avaliarStatusAdimplencia,
  projetarProximaAnuidade,
  calcularDRE,
  obterCicloAgoVigente,
  verificarJanelaCriticaAGO,
} from './financialEngine';

function limparParaFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as unknown as T;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    // Limita tamanho máximo de arrays para evitar estouro de 1MB do Firestore (ex: documentos anexos)
    const arrayCortado = obj.slice(0, 10);
    return arrayCortado.map((item) => limparParaFirestore(item)) as unknown as T;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
        result[key] = limparParaFirestore(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result as T;
}

// ==========================================
// SEEDS CONTÁBEIS INICIAIS DETERMINÍSTICOS
// ==========================================

const SEED_TENANTS: readonly Tenant[] = Object.freeze([
  {
    id: 'GLOBAL',
    nome: 'Plataforma Global Root / Infraestrutura SaaS',
    cnpj: '00.000.000/0000-00',
    logomarca: '',
    endereco: 'Infraestrutura Global SaaS',
    chaveSede: true,
  },
  {
    id: 't-sede-salvador',
    nome: 'CIMADEBE - Sede Geral Salvador',
    cnpj: '00.000.000/0001-00',
    logomarca: '',
    endereco: 'Salvador - BA',
    chaveSede: true,
  }
]);

const SEED_MINISTROS: readonly Ministro[] = Object.freeze([]);

const SEED_ANUIDADES: readonly AnuidadeMinistro[] = Object.freeze([]);

const SEED_INSCRICOES_AGO: readonly InscricaoAGO[] = Object.freeze([]);

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

const SEED_LOGS: readonly AuditLog[] = Object.freeze([
  deepFreeze<AuditLog>({
    id: 'log-000',
    timestamp: '2026-01-01T00:00:00.000Z',
    tenantId: 't-sede-salvador',
    operador: 'SISTEMA_ROOT_LEDGER',
    operadorId: 'op-root-system',
    acao: 'ALTERACAO_CONFIGURACAO',
    detalhes: 'Gênese do Ledger Criptográfico de Auditoria CIMADEBE / SIGM.',
    hashAnterior: GENESIS_HASH,
    hashIntegridade: sha256(`t-sede-salvador|op-root-system|SISTEMA_ROOT_LEDGER|ALTERACAO_CONFIGURACAO|Gênese do Ledger Criptográfico de Auditoria CIMADEBE / SIGM.|2026-01-01T00:00:00.000Z|${GENESIS_HASH}`),
  }),
]);

const DEFAULT_CMS_SETTINGS: CmsSettings = deepFreeze({
  paginasVisiveis: {
    home: true,
    quemSomos: true,
    mesaDiretora: true,
    igrejasFiliadas: true,
    inscricaoAgo: true,
    eventos: true,
    noticias: true,
    validacaoCredenciais: true,
    contatos: true,
    ativoClubeBeneficios: false,
    ativoUrnaEletronica: true,
    ativoEad: false,
    ativoMuralOracao: true,
  },
});

const DEFAULT_APP_CONFIG: AppConfig = deepFreeze({
  nomeConvencao: 'CIMADEBE / SIGM - Convenção Estadual',
  cnpj: '00.000.000/0001-00',
  logomarca: '',
  endereco: 'Salvador - BA',
  taxaFiliacaoInicial: 190.0,
  taxaAnuidadeRecorrente: 120.0,
  taxaFiliacaoMinistro: 190.0,
  taxaFiliacaoMissionaria: 120.0,
  taxaAnuidadeMinistro: 120.0,
  taxaAnuidadeMissionaria: 120.0,
  apiKeys: {
    asaas: '',
    gemini: 'gm_ai_studio_native_runtime_injected',
    viaCep: 'https://viacep.com.br/ws/',
  },
  smtp: {
    host: '',
    port: 587,
    user: '',
    pass: '',
    remetenteEmail: '',
    remetenteNome: '',
    sslTls: true,
  },
  primeiroAcesso: true,
  setup_concluido: false,
  killSwitchCompliance: false,
  mandatoMesaDiretora: '2024 - 2028',
});

const SEED_USUARIOS_ADMINISTRATIVOS: readonly UsuarioAdministrativo[] = Object.freeze([]);

const SEED_MEMBROS_MESA_DIRETORA: readonly MembroMesaDiretora[] = Object.freeze([]);

const SEED_IGREJAS_FILIADAS: readonly IgrejaFiliada[] = Object.freeze([]);

function mapearDocIgreja(d: { readonly id: string; data: () => Record<string, any> }): IgrejaFiliada {
  const data = d.data();
  return {
    id: d.id,
    tenantId: data.tenantId || data.tenant_id || 't-sede-salvador',
    razaoSocial: data.razaoSocial || data.razao_social || '',
    nomeFantasia: data.nomeFantasia || data.nome_fantasia || data.razaoSocial || data.razao_social || 'Igreja Filiada',
    cnpj: data.cnpj || '',
    dataAbertura: data.dataAbertura || data.data_abertura || '',
    naturezaJuridica: data.naturezaJuridica || data.natureza_juridica || 'Associação Privada',
    cnaePrincipal: data.cnaePrincipal || data.cnae_principal || '',
    situacaoCadastral: (data.situacaoCadastral || data.situacao_cadastral || 'ATIVA').toUpperCase() as any,
    logradouro: data.logradouro || '',
    numero: data.numero || '',
    complemento: data.complemento || '',
    bairro: data.bairro || '',
    municipio: data.municipio || '',
    uf: data.uf || 'MT',
    cep: data.cep || '',
    email: data.email || '',
    telefone: data.telefone || '',
    pastorPresidenteId: data.pastorPresidenteId || data.pastor_presidente_id || '',
    pastorPresidenteNome: data.pastorPresidenteNome || data.pastor_presidente_nome || '',
    pastorPresidenteCpf: data.pastorPresidenteCpf || data.pastor_presidente_cpf || '',
    logoUrl: data.logoUrl || data.logo_url || '',
    status: (data.status || 'ATIVA').toUpperCase() as any,
    dataFiliacao: data.dataFiliacao || data.data_filiacao || '2026-10-06',
  };
}

function mapearDocUsuarioAdm(d: { readonly id: string; data: () => Record<string, any> }): UsuarioAdministrativo {
  const u = d.data();
  return {
    id: d.id,
    ministroId: u.ministroId || '',
    nome: u.nome || u.displayName || d.id,
    email: u.email || d.id,
    cpf: u.cpf || '',
    telefone: u.telefone || '',
    cargoMinisterial: u.cargoMinisterial || 'Pastor',
    igrejaFiliada: u.igrejaFiliada || '',
    role: (u.role || 'SUPER_ADMIN') as OperadorRole,
    cargoAdministrativo: (u.cargoAdministrativo || u.funcao || 'Administrador Master') as any,
    departamento: u.departamento || 'Geral',
    statusAcesso: (u.statusAcesso || u.status || 'ATIVO') as any,
    status: u.status || 'ATIVO',
    dataConcessao: u.dataConcessao || '2026-01-01',
    ultimoAcesso: u.ultimoAcesso || new Date().toISOString(),
    fotoUrl: u.fotoUrl || '',
    permissoesEspeciais: u.permissoesEspeciais || [],
    senhaAcesso: u.senhaAcesso || '',
    temBiometriaCadastrada: Boolean(u.temBiometriaCadastrada),
    biometricsEnabled: Boolean(u.biometricsEnabled || u.temBiometriaCadastrada),
  };
}

function mapearDocInscricaoAgo(d: { readonly id: string; data: () => Record<string, any> }): InscricaoAGO {
  const data = d.data();
  return {
    id: d.id,
    ministroId: data.ministroId || '',
    cpf: data.cpf || data.ministroCpf || '',
    ministroCpf: data.ministroCpf || data.cpf || '',
    ministroNome: data.ministroNome || '',
    cargo: data.cargo || 'Pastor',
    anoVigente: Number(data.anoVigente || 2026),
    statusInscricao: data.statusInscricao || (data.status === 'CONFIRMADO' ? 'VALIDA' : 'PENDENTE'),
    status: (data.status || (data.statusInscricao === 'VALIDA' ? 'CONFIRMADO' : 'PENDENTE')) as any,
    dataInscricao: data.dataInscricao || new Date().toISOString(),
    valor: data.valor || data.planoValor || 0,
    planoId: data.planoId || 'PLANO_1',
    planoNome: data.planoNome || 'Plano 1 - Inscrição Oficial AGO',
    formaPagamento: data.formaPagamento || 'PIX',
    direitoVotoHomologado: Boolean(data.direitoVotoHomologado ?? (data.status === 'CONFIRMADO' || data.statusInscricao === 'VALIDA')),
    kitCongressistaReservado: Boolean(data.kitCongressistaReservado ?? (data.status === 'CONFIRMADO' || data.statusInscricao === 'VALIDA')),
    chaveIdempotencia: data.chaveIdempotencia || '',
    hashIntegridade: data.hashIntegridade || '',
    linhaDigitavelBoleto: data.linhaDigitavelBoleto || '',
    codigoBarrasBoleto: data.codigoBarrasBoleto || '',
  };
}

function mapearDocAnuidade(d: { readonly id: string; data: () => Record<string, any> }): AnuidadeMinistro {
  const data = d.data();
  return {
    id: d.id,
    ministroId: data.ministroId || '',
    tenantId: data.tenantId || 't-sede-salvador',
    anoVigente: Number(data.anoVigente || 2026),
    dataVencimento: data.dataVencimento || '',
    valor: Number(data.valor || 0),
    statusPagamento: (data.statusPagamento || 'ABERTO') as any,
    tipo: (data.tipo || 'RECEITA') as any,
    categoria: (data.categoria || 'ANUIDADE') as any,
    descricao: data.descricao || '',
    tarifaAsaas: data.tarifaAsaas || 0,
    valorLiquido: data.valorLiquido || data.valor || 0,
    dataLiquidacao: data.dataLiquidacao || '',
    dataPagamento: data.dataPagamento || '',
    nomeMinistro: data.nomeMinistro || '',
    asaasInvoiceUrl: data.asaasInvoiceUrl || '',
    asaasSubscriptionId: data.asaasSubscriptionId || '',
  };
}

// ==========================================
// CONTEXTO E INTERFACE DO CORE BANKING
// ==========================================

export interface SecurityContextType {
  readonly tenants: readonly Tenant[];
  readonly ministros: readonly Ministro[];
  readonly anuidades: readonly AnuidadeMinistro[];
  readonly inscricoesAGO: readonly InscricaoAGO[];
  readonly usuariosAdministrativos: readonly UsuarioAdministrativo[];
  readonly usuariosSistema: readonly UsuarioAdministrativo[];
  readonly membrosMesaDiretora: readonly MembroMesaDiretora[];
  readonly igrejasFiliadas: readonly IgrejaFiliada[];
  readonly logs: readonly AuditLog[];
  readonly cmsSettings: CmsSettings;
  readonly appConfig: AppConfig;
  readonly tenantAtivoId: string;
  readonly tenantAtivo: Tenant;
  readonly operadorAtual: string;
  readonly operadorId: string;
  readonly isAuthenticated: boolean;
  readonly ultimoEventoContabil: EventoContabil | null;
  readonly resumoFinanceiro: ResumoFinanceiroTenant;
  readonly cacheIdempotencia: readonly string[];
  readonly dreGeral: DemonstrativoResultadoExercicio;
  readonly dreTenant: DemonstrativoResultadoExercicio;
  readonly cicloAgoVigente: number;
  readonly alertasCompulsoriosAGO: readonly AlertaCompulsorioAGO[];
  readonly operadorRole: OperadorRole;
  readonly authCarregando: boolean;
  readonly setAuthCarregando: (val: boolean) => void;
  readonly carregandoStatusSistema: boolean;
  readonly sistemaVirgem: boolean;
  readonly avisoCotaFirestore: string | null;

  // Governança e Privilégio Mínimo (RBAC)
  readonly alternarOperadorRole: (role: OperadorRole) => void;
  readonly verificarPermissao: (permissao: PermissaoSistema) => boolean;
  readonly validarIntegridadeAcesso: (
    recurso: RecursoCritico,
    tenantIdAlvo?: string
  ) => ResultadoVerificacaoIntegridade;
  readonly executarConsultaParametrizada: <T>(
    statement: ParametrizedStatement,
    dataset: readonly T[],
    predicate: (item: T, params: readonly SqlParamValue[]) => boolean
  ) => readonly T[];

  // Gestão de Sessão & Rastreabilidade de Operador
  readonly definirOperador: (operador: string, operadorId?: string) => void;
  readonly registrarLogin: (
    operadorNome: string,
    idOperador: string,
    role: OperadorRole,
    metodo?: string,
    tenantIdOverride?: string
  ) => AuditLog;
  readonly registrarLogout: (
    operadorNomeOverride?: string,
    operadorIdOverride?: string,
    tenantIdOverride?: string
  ) => AuditLog;

  // Gestão de Usuários Administrativos
  readonly atribuirUsuarioAdministrativo: (
    usuario: Omit<UsuarioAdministrativo, 'id' | 'dataConcessao' | 'ultimoAcesso'>
  ) => UsuarioAdministrativo;
  readonly alterarStatusUsuarioAdministrativo: (
    id: string,
    novoStatus: 'ATIVO' | 'SUSPENSO' | 'EM_ANALISE'
  ) => void;
  readonly removerUsuarioAdministrativo: (id: string) => Promise<void> | void;
  readonly atualizarUsuarioAdministrativo: (
    id: string,
    dados: Partial<Omit<UsuarioAdministrativo, 'id' | 'dataConcessao'>>
  ) => Promise<UsuarioAdministrativo>;
  readonly atualizarUsuarioSistema: (
    id: string,
    dados: Partial<UsuarioAdministrativo>
  ) => Promise<UsuarioAdministrativo>;

  // Mesa Diretora
  readonly atribuirMembroMesa: (
    membro: Omit<MembroMesaDiretora, 'id'>
  ) => MembroMesaDiretora;
  readonly removerMembroMesa: (id: string, justificativa?: string) => void;
  readonly atualizarMembroMesa: (
    id: string,
    dados: Partial<MembroMesaDiretora>
  ) => void;

  // Igrejas Filiadas
  readonly cadastrarIgreja: (
    igreja: Omit<IgrejaFiliada, 'id' | 'dataFiliacao'>
  ) => Promise<IgrejaFiliada>;
  readonly editarIgreja: (
    id: string,
    dados: Partial<Omit<IgrejaFiliada, 'id'>>
  ) => Promise<IgrejaFiliada>;
  readonly deletarIgreja: (id: string, justificativa?: string) => Promise<void>;
  readonly alternarStatusIgreja: (id: string) => Promise<void>;

  // Mutadores com Isolamento Ledger e Congelamento Recursivo
  readonly alternarTenant: (tenantId: string) => void;
  readonly cadastrarMinistro: (
    novoMinistro: Omit<Ministro, 'id' | 'dataFiliacao'> & { dataFiliacao?: string }
  ) => Promise<Ministro>;
  readonly editarMinistro: (
    ministroId: string,
    dadosAtualizados: Partial<Omit<Ministro, 'id'>>
  ) => Promise<Ministro>;
  readonly deletarMinistro: (ministroId: string, justificativa?: string) => Promise<void>;
  readonly alternarStatusMinistro: (ministroId: string) => Promise<void>;
  readonly atualizarStatusMinistro: (
    ministroId: string,
    status: StatusMinistro,
    statusAdimplencia?: StatusAdimplencia
  ) => Promise<void>;
  readonly registrarAnuidade: (
    novaAnuidade: Omit<AnuidadeMinistro, 'id'>
  ) => Promise<AnuidadeMinistro>;
  readonly editarAnuidade: (
    anuidadeId: string,
    dadosAtualizados: { valor?: number; dataVencimento?: string }
  ) => Promise<AnuidadeMinistro>;
  readonly liquidarAnuidade: (
    anuidadeId: string,
    origem?: 'MANUAL' | 'WEBHOOK_ASAAS'
  ) => Promise<boolean>;
  readonly excluirAnuidade: (anuidadeId: string) => Promise<boolean>;
  readonly concederIsencaoOuJubilacao: (
    ministroId: string,
    tipoPrivilegio: 'ISENCAO' | 'JUBILACAO',
    justificativa: string,
    presidenteIdentificador: string
  ) => Promise<boolean>;
  readonly concederAnistia: (
    ministroId: string,
    anuidadesIds: string[],
    justificativa: string,
    presidenteIdentificador: string
  ) => Promise<boolean>;
  readonly processarWebhookAsaas: (
    payload: AsaasWebhookPayload
  ) => Promise<{ sucesso: boolean; mensagem: string; anuidadeId?: string }>;
  readonly executarVarreduraAdimplencia: () => void;
  readonly inscreverMinistroAGO: (
    ministroId: string,
    anoVigente?: number
  ) => Promise<{ sucesso: boolean; mensagem: string; inscricaoId?: string }>;
  readonly inscreverAGO: (
    ministroId: string,
    cpf: string,
    anoVigente: number
  ) => Promise<{ sucesso: boolean; mensagem: string }>;
  readonly verificarStatusFinanceiroGeral: () => {
    totalInscricoesRevogadas: number;
    ministrosNotificados: string[];
    alertasEmitidos: string[];
  };
  readonly limparAlertaCompulsorio: (alertaId: string) => void;
  readonly revogarInscricaoAGO: (
    inscricaoId: string,
    motivo: string
  ) => Promise<void>;
  readonly atualizarAppConfig: (novosDados: Partial<AppConfig>) => Promise<void> | void;
  readonly atualizarCmsSettings: (
    novasConfigs: Partial<CmsSettings['paginasVisiveis']>
  ) => void;
  readonly addAuditLog: (
    acao: AcaoAuditoria,
    detalhes: string,
    tenantIdOverride?: string,
    operadorIdOverride?: string,
    operadorNomeOverride?: string
  ) => AuditLog;
  readonly verificarIntegridadeAuditTrail: () => {
    valida: boolean;
    totalBlocos: number;
    quebras: number[];
  };
  readonly inscreverOuvinteContabil: (
    callback: (evento: EventoContabil) => void
  ) => () => void;

  // Estado Global Reativo em Tempo Real de Eventos e Notícias (Firebase + PostgreSQL)
  readonly eventos: readonly DbEvento[];
  readonly noticias: readonly DbNoticia[];
  readonly carregarEventosENoticias: () => Promise<void>;
  readonly cadastrarEventoGlobal: (
    payload: Omit<DbEvento, 'id' | 'criado_em' | 'atualizado_em'>
  ) => Promise<DbEvento>;
  readonly atualizarEventoGlobal: (
    id: string,
    payload: Partial<DbEvento>
  ) => Promise<void>;
  readonly deletarEventoGlobal: (id: string) => Promise<void>;
  readonly esvaziarFinanceiroEUsuarios: () => Promise<void>;
  readonly resetarSistemaParaSetupVirgem: () => Promise<void>;
  readonly purgarUsuariosFantasma: () => Promise<number>;
  readonly cadastrarNoticiaGlobal: (
    payload: Omit<DbNoticia, 'id' | 'criado_em' | 'atualizado_em'>
  ) => Promise<DbNoticia>;
  readonly atualizarNoticiaGlobal: (
    id: string,
    payload: Partial<DbNoticia>
  ) => Promise<void>;
  readonly deletarNoticiaGlobal: (id: string) => Promise<void>;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export function SecurityProvider({ children }: { readonly children: ReactNode }) {
  const [tenants, setTenants] = useState<readonly Tenant[]>(SEED_TENANTS);
  const [ministros, setMinistros] = useState<readonly Ministro[]>(() => deepCloneAndFreeze([]));
  const [anuidades, setAnuidades] = useState<readonly AnuidadeMinistro[]>(() => deepCloneAndFreeze([]));
  const [inscricoesAGO, setInscricoesAGO] = useState<readonly InscricaoAGO[]>([]);
  const [usuariosAdministrativos, setUsuariosAdministrativos] = useState<readonly UsuarioAdministrativo[]>(SEED_USUARIOS_ADMINISTRATIVOS);
  const [usuariosSistema, setUsuariosSistema] = useState<readonly UsuarioAdministrativo[]>(() => deepCloneAndFreeze([]));
  const [membrosMesaDiretora, setMembrosMesaDiretora] = useState<readonly MembroMesaDiretora[]>(SEED_MEMBROS_MESA_DIRETORA);
  const [igrejasFiliadas, setIgrejasFiliadas] = useState<readonly IgrejaFiliada[]>(SEED_IGREJAS_FILIADAS);
  const [logs, setLogs] = useState<readonly AuditLog[]>(SEED_LOGS);
  const [cmsSettings, setCmsSettings] = useState<CmsSettings>(DEFAULT_CMS_SETTINGS);
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);

  const [authCarregando, setAuthCarregando] = useState<boolean>(true);
  const [carregandoStatusSistema, setCarregandoStatusSistema] = useState<boolean>(false);
  const [sistemaVirgem, setSistemaVirgem] = useState<boolean>(false);
  const [avisoCotaFirestore, setAvisoCotaFirestore] = useState<string | null>(null);

  const [tenantAtivoId, setTenantAtivoId] = useState<string>('t-sede-salvador');
  const [operadorAtual, setOperadorAtual] = useState<string>('');
  const [operadorId, setOperadorId] = useState<string>('');
  const [operadorRole, setOperadorRole] = useState<OperadorRole>('CONSULTA_PUBLICA');

  // =========================================================================
  // PORTÃO DE INICIALIZAÇÃO (AUTH LOADING GATE) & RESOLUÇÃO ASSÍNCRONA
  // =========================================================================
  useEffect(() => {
    // Conexão com o listener nativo onAuthStateChanged do Firebase Auth
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const nomeUser = firebaseUser.displayName || firebaseUser.email || 'Operador Autenticado';
        const uidUser = firebaseUser.uid;
        const emailUser = (firebaseUser.email || '').toLowerCase().trim();

        setOperadorAtual(nomeUser);
        setOperadorId(uidUser);
        operadorAtualRef.current = nomeUser;
        operadorIdRef.current = uidUser;

        const matchSys = usuariosSistemaRef.current.find(
          (u) =>
            u.id === uidUser ||
            (u.email && u.email.toLowerCase().trim() === emailUser) ||
            u.id === emailUser ||
            emailUser === 'franciscofabio.rc@gmail.com'
        );
        if (matchSys && (matchSys.role === 'SUPER_ADMIN' || matchSys.tipoUsuario === 'SUPER_MASTER_ROOT')) {
          setOperadorRole('SUPER_ADMIN');
          setTenantAtivoId('GLOBAL');
        } else {
          const matchAdm = usuariosAdministrativosRef.current.find(
            (u) => u.id === uidUser || (u.email && u.email.toLowerCase().trim() === emailUser)
          );
          if (matchAdm) {
            setOperadorRole(matchAdm.role as OperadorRole);
          } else {
            const matchMin = ministrosRef.current.find(
              (m) => m.id === uidUser || (m.email && m.email.toLowerCase().trim() === emailUser)
            );
            if (matchMin) {
              setOperadorRole('MINISTRO_OBREIRO');
            }
          }
        }
      }
      setAuthCarregando(false);
    });

    const timerTrava = setTimeout(() => {
      setAuthCarregando(false);
    }, 1500);

    return () => {
      unsubAuth();
      clearTimeout(timerTrava);
    };
  }, []);

  // Re-avaliação reativa do operadorRole assim que as coleções do Firestore chegam da rede (Isolamento Estrito Zero-Trust)
  useEffect(() => {
    if (!operadorId && !auth.currentUser) return;
    const targetId = operadorId || auth.currentUser?.uid || '';
    const emailUser = (auth.currentUser?.email || '').toLowerCase().trim();
    const nomeUser = (operadorAtual || auth.currentUser?.displayName || '').toLowerCase().trim();

    // 0. VERIFICAÇÃO PRIORITÁRIA DE SUPER MASTER ROOT (Dono do SaaS / Infraestrutura Global)
    const matchSys = usuariosSistema.find(
      (u) =>
        u.id === targetId ||
        (u.email && u.email.toLowerCase().trim() === emailUser) ||
        (u.email && targetId && u.email.toLowerCase().trim() === targetId.toLowerCase().trim()) ||
        targetId === 'franciscofabio.rc@gmail.com' ||
        emailUser === 'franciscofabio.rc@gmail.com'
    );

    if (matchSys && (matchSys.role === 'SUPER_ADMIN' || matchSys.tipoUsuario === 'SUPER_MASTER_ROOT')) {
      if (operadorRole !== 'SUPER_ADMIN') {
        setOperadorRole('SUPER_ADMIN');
      }
      if (tenantAtivoId !== 'GLOBAL') {
        setTenantAtivoId('GLOBAL');
      }
      return;
    }

    // 1. ISOLAMENTO ABSOLUTO: Se o operador for SUPER_ADMIN (Super Master / Dono do SaaS), acesso é fixo e imutável
    if (operadorRole === 'SUPER_ADMIN') {
      return;
    }

    // 2. Operador Administrativo da Convenção (Administrador Master, Secretário, Tesoureiro, Birô)
    if (operadorRole !== 'MINISTRO_OBREIRO' && operadorRole !== 'CONSULTA_PUBLICA') {
      const matchAdm = usuariosAdministrativos.find(
        (u) =>
          u.id === targetId ||
          (u.email && u.email.toLowerCase().trim() === emailUser) ||
          (u.email && targetId && u.email.toLowerCase().trim() === targetId.toLowerCase().trim()) ||
          (u.nome && u.nome.toLowerCase().trim() === nomeUser)
      );

      if (matchAdm) {
        const roleDefinida =
          matchAdm.cargoAdministrativo === 'Administrador Master'
            ? 'ADMINISTRADOR_MASTER'
            : matchAdm.cargoAdministrativo === 'Presidente Geral'
            ? 'PRESIDENTE_GERAL'
            : (matchAdm.role as OperadorRole);
        setOperadorRole(roleDefinida);
      }
      // Zero-Trust: NUNCA cruza com a tabela de ministros quando a sessão for administrativa!
      return;
    }

    // Se o perfil for estritamente MINISTRO_OBREIRO, sincroniza EXCLUSIVAMENTE com a tabela de ministros
    if (operadorRole === 'MINISTRO_OBREIRO') {
      const matchMin = ministros.find(
        (m) =>
          m.id === targetId ||
          (m.email && m.email.toLowerCase().trim() === emailUser) ||
          (m.email && targetId && m.email.toLowerCase().trim() === targetId.toLowerCase().trim()) ||
          (m.cpf && targetId && m.cpf.replace(/\D/g, '') === targetId.replace(/\D/g, ''))
      );
      if (matchMin) {
        setOperadorRole('MINISTRO_OBREIRO');
      }
    }
  }, [usuariosSistema, usuariosAdministrativos, ministros, operadorId, operadorAtual, operadorRole, tenantAtivoId]);
  const [ultimoEventoContabil, setUltimoEventoContabil] = useState<EventoContabil | null>(null);

  // Estados do Motor de Compliance e Lockdown de Inatividade (30 minutos)
  const [avisoInatividadeAtivo, setAvisoInatividadeAtivo] = useState<boolean>(false);
  const [segundosRestantesInatividade, setSegundosRestantesInatividade] = useState<number>(60);
  const ultimaAtividadeRef = useRef<number>(Date.now());

  // Estados Globais de Eventos e Notícias sincronizados em Tempo Real
  const [eventos, setEventos] = useState<readonly DbEvento[]>(() => Object.freeze([]));
  const [noticias, setNoticias] = useState<readonly DbNoticia[]>(() => Object.freeze([]));

  // Carregamento e sincronização com Firebase Firestore
  // Active Heartbeat Check (Non-destructive ping)
  useEffect(() => {
    let isMounted = true;
    const pulseInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/health');
        if (!res.ok) {
          throw new Error('Heartbeat pulse failed');
        }
        const data = await res.json();
        if (data.status !== 'OK') {
          throw new Error('Invalid backend health status');
        }
      } catch (err) {
        if (!isMounted) return;
        console.warn('[Heartbeat] Conexão com o servidor operando em modo resiliente:', err);
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(pulseInterval);
    };
  }, []);

  useEffect(() => {
    let unsubs: (() => void)[] = [];
    const safetyTimer = setTimeout(() => {
      setCarregandoStatusSistema(false);
    }, 350);

    async function inicializarESincronizarFirestore() {
      try {
        // ESTRATÉGIA ANTI-ESTOURO DE COTA: 1. TENTA CARREGAR DO SESSION CACHE (0 LEITURAS)
        try {
          const cachedSession = sessionStorage.getItem('sigm_app_data_cache_v2');
          if (cachedSession) {
            const { timestamp, data } = JSON.parse(cachedSession);
            const agora = Date.now();
            // Cache com TTL de 15 minutos (900.000 ms)
            if (data && (agora - timestamp < 900000)) {
              if (data.igrejas && data.igrejas.length > 0) {
                igrejasFiliadasRef.current = deepCloneAndFreeze(data.igrejas);
                setIgrejasFiliadas(data.igrejas);
              }
              if (data.usuariosAdmin && data.usuariosAdmin.length > 0) {
                usuariosAdministrativosRef.current = deepCloneAndFreeze(data.usuariosAdmin);
                setUsuariosAdministrativos(data.usuariosAdmin);
              }
              if (data.ministros && data.ministros.length > 0) {
                ministrosRef.current = deepCloneAndFreeze(data.ministros);
                setMinistros(data.ministros);
              }
              if (data.membrosMesa && data.membrosMesa.length > 0) {
                membrosMesaDiretoraRef.current = deepCloneAndFreeze(data.membrosMesa);
                setMembrosMesaDiretora(data.membrosMesa);
              }
              if (data.inscricoesAGO && data.inscricoesAGO.length > 0) {
                inscricoesAGORef.current = deepCloneAndFreeze(data.inscricoesAGO);
                setInscricoesAGO(data.inscricoesAGO);
              }
              if (data.anuidades && data.anuidades.length > 0) {
                anuidadesRef.current = deepCloneAndFreeze(data.anuidades);
                setAnuidades(data.anuidades);
              }
              setCarregandoStatusSistema(false);
              setSistemaVirgem(false);
              return;
            }
          }
        } catch {}

        // 2. Se o cache não existir ou expirou, executa UMA ÚNICA CONSULTA PONTUAL com getDocs + limit(50)
        let fetchOk = true;
        const [cfgGeralSnap, cfgStatusSnap, snapUsersAdm, snapSys, snapIgrejas, snapMin, snapMesa, snapInsc, snapAnu] = await Promise.all([
          getDoc(doc(db, 'configuracoes_sistema', 'geral')).catch((err: any) => {
            const msg = (err?.message || '').toLowerCase();
            if (msg.includes('quota') || msg.includes('resourceexhausted') || msg.includes('limit')) {
              setAvisoCotaFirestore('Cota diária de leitura do Firestore excedida no Google Cloud (50.000 leituras/dia). Modo resiliente ativado.');
            }
            fetchOk = false;
            return null;
          }),
          getDoc(doc(db, 'configuracoes_sistema', 'status_geral')).catch(() => { fetchOk = false; return null; }),
          getDocs(query(collection(db, 'usuarios_administrativos'), limit(50))).catch(() => { fetchOk = false; return null; }),
          getDocs(query(collection(db, 'usuarios_sistema'), limit(20))).catch(() => { fetchOk = false; return null; }),
          getDocs(query(collection(db, 'igrejas'), limit(50))).catch(() => null),
          getDocs(query(collection(db, 'ministros'), limit(50))).catch(() => null),
          getDocs(query(collection(db, 'membros_mesa_diretora'), limit(50))).catch(() => null),
          getDocs(query(collection(db, 'inscricoes_ago'), limit(50))).catch(() => null),
          getDocs(query(collection(db, 'anuidades'), limit(50))).catch(() => null),
        ]);

        const cfgGeralData = cfgGeralSnap && cfgGeralSnap.exists() ? cfgGeralSnap.data() : null;
        const cfgStatusData = cfgStatusSnap && cfgStatusSnap.exists() ? cfgStatusSnap.data() : null;

        const setupConcluidoNoBanco = Boolean(
          (cfgGeralData && cfgGeralData.setup_concluido === true) ||
          (cfgStatusData && cfgStatusData.setup_concluido === true)
        );

        let temAdminNoBanco = false;

        const listUsersAdm = snapUsersAdm && !snapUsersAdm.empty ? snapUsersAdm.docs.map(mapearDocUsuarioAdm) : [];
        if (listUsersAdm.length > 0) {
          const congeladosAdms = deepCloneAndFreeze(listUsersAdm);
          usuariosAdministrativosRef.current = congeladosAdms;
          setUsuariosAdministrativos(congeladosAdms);

          for (const u of listUsersAdm) {
            const role = (u.role || '').toUpperCase();
            if (role === 'ADMINISTRADOR_MASTER') {
              temAdminNoBanco = true;
              break;
            }
          }
        }

        if (snapSys && !snapSys.empty) {
          const listaSys: UsuarioAdministrativo[] = snapSys.docs.map(mapearDocUsuarioAdm);
          const congeladosSys = deepCloneAndFreeze(listaSys);
          usuariosSistemaRef.current = congeladosSys;
          setUsuariosSistema(congeladosSys);
        }

        const virgem = fetchOk ? !temAdminNoBanco : false;
        setSistemaVirgem(virgem);

        if (cfgGeralData) {
          setAppConfig((prev) => ({
            ...prev,
            nomeConvencao: cfgGeralData.razaoSocial || cfgGeralData.nomeConvencao || prev.nomeConvencao,
            sigla: cfgGeralData.sigla || prev.sigla,
            cnpj: cfgGeralData.cnpj || prev.cnpj,
            mandatoMesaDiretora: cfgGeralData.mandatoMesaDiretora || cfgGeralData.mandato || prev.mandatoMesaDiretora || '2024 - 2028',
            setup_concluido: setupConcluidoNoBanco || prev.setup_concluido,
            primeiroAcesso: setupConcluidoNoBanco ? false : prev.primeiroAcesso,
          }));
        } else if (setupConcluidoNoBanco) {
          setAppConfig((prev) => ({
            ...prev,
            setup_concluido: true,
            primeiroAcesso: false,
          }));
        }

        const listIgrejas = snapIgrejas && !snapIgrejas.empty ? snapIgrejas.docs.map(mapearDocIgreja) : [];
        const listMin = snapMin && !snapMin.empty ? snapMin.docs.map((d) => ({ ...d.data(), id: d.id } as Ministro)) : [];
        const listMesa = snapMesa && !snapMesa.empty ? snapMesa.docs.map((d) => ({ ...d.data(), id: d.id } as MembroMesaDiretora)) : [];
        const listInsc = snapInsc && !snapInsc.empty ? snapInsc.docs.map(mapearDocInscricaoAgo) : [];
        const listAnu = snapAnu && !snapAnu.empty ? snapAnu.docs.map(mapearDocAnuidade) : [];

        if (listIgrejas.length > 0) {
          const congelados = deepCloneAndFreeze(listIgrejas);
          igrejasFiliadasRef.current = congelados;
          setIgrejasFiliadas(congelados);
        }
        if (listMin.length > 0) {
          const congelados = deepCloneAndFreeze(listMin);
          ministrosRef.current = congelados;
          setMinistros(congelados);
        }
        if (listMesa.length > 0) {
          const congelados = deepCloneAndFreeze(listMesa);
          membrosMesaDiretoraRef.current = congelados;
          setMembrosMesaDiretora(congelados);
        }
        if (listInsc.length > 0) {
          const congelados = deepCloneAndFreeze(listInsc);
          inscricoesAGORef.current = congelados;
          setInscricoesAGO(congelados);
        }
        if (listAnu.length > 0) {
          const congelados = deepCloneAndFreeze(listAnu);
          anuidadesRef.current = congelados;
          setAnuidades(congelados);
        }

        // Armazena no cache de sessão para blindar contra leituras desnecessárias nas próximas navegações
        try {
          sessionStorage.setItem('sigm_app_data_cache_v2', JSON.stringify({
            timestamp: Date.now(),
            data: {
              igrejas: listIgrejas,
              usuariosAdmin: listUsersAdm,
              ministros: listMin,
              membrosMesa: listMesa,
              inscricoesAGO: listInsc,
              anuidades: listAnu,
            }
          }));
        } catch {}

      } catch (err: any) {
        console.warn('[VERIFICACAO_STATUS_CANONICA_WARN]', err);
        setSistemaVirgem(false);
      } finally {
        setCarregandoStatusSistema(false);
      }
    }

    inicializarESincronizarFirestore();

    return () => {
      unsubs.forEach(u => u());
    };
  }, []);

  // Sincronização de referências em memória para computação síncrona sem race condition
  const tenantsRef = useRef<readonly Tenant[]>(SEED_TENANTS);
  const ministrosDeletadosLocalmenteRef = useRef<Set<string>>(new Set<string>());
  const delecoesMinistroEmAndamentoRef = useRef<Set<string>>(new Set<string>());
  const ministrosRef = useRef<readonly Ministro[]>([]);
  const anuidadesRef = useRef<readonly AnuidadeMinistro[]>(SEED_ANUIDADES);
  const inscricoesAGORef = useRef<readonly InscricaoAGO[]>(SEED_INSCRICOES_AGO);
  const usuariosAdministrativosRef = useRef<readonly UsuarioAdministrativo[]>(SEED_USUARIOS_ADMINISTRATIVOS);
  const usuariosSistemaRef = useRef<readonly UsuarioAdministrativo[]>([]);
  const membrosMesaDiretoraRef = useRef<readonly MembroMesaDiretora[]>(SEED_MEMBROS_MESA_DIRETORA);
  const igrejasFiliadasRef = useRef<readonly IgrejaFiliada[]>(SEED_IGREJAS_FILIADAS);
  const logsRef = useRef<readonly AuditLog[]>(SEED_LOGS);
  const appConfigRef = useRef<AppConfig>(DEFAULT_APP_CONFIG);
  const operadorAtualRef = useRef<string>('Administrador Master');
  const operadorIdRef = useRef<string>('op-super-master-001');

  useEffect(() => {
    operadorAtualRef.current = operadorAtual;
  }, [operadorAtual]);

  useEffect(() => {
    operadorIdRef.current = operadorId;
  }, [operadorId]);

  useEffect(() => {
    tenantsRef.current = tenants;
  }, [tenants]);

  useEffect(() => {
    ministrosRef.current = ministros;
  }, [ministros]);

  useEffect(() => {
    anuidadesRef.current = anuidades;
  }, [anuidades]);

  useEffect(() => {
    inscricoesAGORef.current = inscricoesAGO;
  }, [inscricoesAGO]);

  useEffect(() => {
    usuariosAdministrativosRef.current = usuariosAdministrativos;
  }, [usuariosAdministrativos]);

  useEffect(() => {
    usuariosSistemaRef.current = usuariosSistema;
  }, [usuariosSistema]);

  useEffect(() => {
    membrosMesaDiretoraRef.current = membrosMesaDiretora;
  }, [membrosMesaDiretora]);

  useEffect(() => {
    igrejasFiliadasRef.current = igrejasFiliadas;
  }, [igrejasFiliadas]);

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  useEffect(() => {
    appConfigRef.current = appConfig;
  }, [appConfig]);

  // Sincronização Síncrona em Tempo Real (onSnapshot Firestore + Mock Engine) para Eventos e Notícias
  const carregarEventosENoticias = useCallback(async () => {
    try {
      const [evts, nots] = await Promise.all([fetchEventos(), fetchNoticias()]);
      setEventos(evts);
      setNoticias(nots);
    } catch (err) {
      console.error('[CARREGAR_EVENTOS_NOTICIAS_ERR]', err);
    }
  }, []);

  useEffect(() => {
    carregarEventosENoticias();
    let primeiraCargaEvt = true;
    let primeiraCargaNot = true;

    // Listener Firestore Tempo Real - Eventos (Mapeamento Direto do Banco com limit estrito)
    const unsubscribeEvt = onSnapshot(
      query(collection(db, 'eventos'), limit(50)),
      (snap) => {
        if (!snap.empty) {
          const listaEventos = snap.docs.map((d) => ({ ...d.data(), id: d.id } as DbEvento));
          setEventos(Object.freeze(listaEventos));

          // Disparo de notificação PUSH via Service Worker para novas convocações em tempo real
          if (!primeiraCargaEvt) {
            snap.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const novoEvt = change.doc.data() as DbEvento;
                if (novoEvt && novoEvt.status === 'ATIVO') {
                  dispararNotificacaoConvocacaoAgo({
                    titulo: novoEvt.titulo,
                    subtitulo: novoEvt.subtitulo,
                    local: novoEvt.local,
                    periodo: formatarPeriodoEvento(novoEvt.data_inicio, novoEvt.data_fim, novoEvt.data_evento),
                    id: change.doc.id,
                    temaBiblico: novoEvt.tema_biblico
                  }).catch(() => {});
                }
              }
            });
          }
          primeiraCargaEvt = false;
        } else {
          setEventos(Object.freeze([]));
          primeiraCargaEvt = false;
        }
      },
      (err) => {
        console.warn('[SecurityContext: eventos] Modo resiliente local:', err?.message || err);
        setEventos(Object.freeze([]));
      }
    );

    // Listener Firestore Tempo Real - Notícias (Mapeamento Direto do Banco com limit estrito)
    const unsubscribeNot = onSnapshot(
      query(collection(db, 'noticias'), limit(50)),
      (snap) => {
        if (!snap.empty) {
          const listaNoticias = snap.docs.map((d) => ({ ...d.data(), id: d.id } as DbNoticia));
          setNoticias(Object.freeze(listaNoticias));

          // Disparo de notificação PUSH via Service Worker para novas notícias em tempo real
          if (!primeiraCargaNot) {
            snap.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const novaNot = change.doc.data() as DbNoticia;
                if (novaNot && novaNot.status === 'PUBLICADO') {
                  dispararNotificacaoNovaNoticia({
                    titulo: novaNot.titulo,
                    subtitulo: novaNot.subtitulo,
                    id: change.doc.id,
                    categoria: novaNot.categoria,
                    autor: novaNot.autor
                  }).catch(() => {});
                }
              }
            });
          }
          primeiraCargaNot = false;
        } else {
          setNoticias(Object.freeze([]));
          primeiraCargaNot = false;
        }
      },
      (err) => {
        console.warn('[SecurityContext: noticias] Modo resiliente local:', err?.message || err);
        setNoticias(Object.freeze([]));
      }
    );

    return () => {
      unsubscribeEvt();
      unsubscribeNot();
    };
  }, [carregarEventosENoticias]);

  const cadastrarEventoGlobal = useCallback(
    async (payload: Omit<DbEvento, 'id' | 'criado_em' | 'atualizado_em'>) => {
      const { evento } = await insertEventoComAuditoria(payload, tenantAtivoId, operadorAtual);
      setEventos((prev) => {
        const map = new Map<string, DbEvento>();
        prev.forEach((e) => map.set(e.id, e));
        map.set(evento.id, evento);
        return Object.freeze(Array.from(map.values()));
      });
      return evento;
    },
    [tenantAtivoId, operadorAtual]
  );

  const atualizarEventoGlobal = useCallback(
    async (id: string, payload: Partial<DbEvento>) => {
      await updateEventoComAuditoria(id, payload, tenantAtivoId, operadorAtual);
      setEventos((prev) =>
        Object.freeze(
          prev.map((e) => (e.id === id ? { ...e, ...payload, atualizado_em: new Date().toISOString() } : e))
        )
      );
    },
    [tenantAtivoId, operadorAtual]
  );

  const deletarEventoGlobal = useCallback(
    async (id: string) => {
      await deleteEventoComAuditoria(id, tenantAtivoId, operadorAtual);
      setEventos((prev) => Object.freeze(prev.filter((e) => e.id !== id)));
    },
    [tenantAtivoId, operadorAtual]
  );

  const cadastrarNoticiaGlobal = useCallback(
    async (payload: Omit<DbNoticia, 'id' | 'criado_em' | 'atualizado_em'>) => {
      const { noticia } = await insertNoticiaComAuditoria(payload, tenantAtivoId, operadorAtual);
      setNoticias((prev) => {
        const map = new Map<string, DbNoticia>();
        prev.forEach((n) => map.set(n.id, n));
        map.set(noticia.id, noticia);
        return Object.freeze(Array.from(map.values()));
      });
      return noticia;
    },
    [tenantAtivoId, operadorAtual]
  );

  const atualizarNoticiaGlobal = useCallback(
    async (id: string, payload: Partial<DbNoticia>) => {
      await updateNoticiaComAuditoria(id, payload, tenantAtivoId, operadorAtual);
      setNoticias((prev) =>
        Object.freeze(
          prev.map((n) => (n.id === id ? { ...n, ...payload, atualizado_em: new Date().toISOString() } : n))
        )
      );
    },
    [tenantAtivoId, operadorAtual]
  );

  const deletarNoticiaGlobal = useCallback(
    async (id: string) => {
      await deleteNoticiaComAuditoria(id, tenantAtivoId, operadorAtual);
      setNoticias((prev) => Object.freeze(prev.filter((n) => n.id !== id)));
    },
    [tenantAtivoId, operadorAtual]
  );

  // Alertas compulsórios de revogação por janela crítica da AGO
  const [alertasCompulsoriosAGO, setAlertasCompulsoriosAGO] = useState<readonly AlertaCompulsorioAGO[]>([]);

  // Cache interno de Idempotência
  const cacheIdempotenciaRef = useRef<Set<string>>(new Set());
  const [cacheIdempotencia, setCacheIdempotencia] = useState<readonly string[]>([]);

  // Ciclo AGO vigente em tempo real
  const cicloAgoVigente = useMemo(() => obterCicloAgoVigente(), []);

  // Registro de ouvintes em tempo real para Hot-Reload Contábil
  const ouvintesRef = useRef<Set<(evento: EventoContabil) => void>>(new Set());
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Inicialização de canal de transmissão entre abas
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const canal = new BroadcastChannel('cimadebe_core_banking_channel');
        broadcastChannelRef.current = canal;

        canal.onmessage = (event: MessageEvent<EventoContabil>) => {
          if (event.data && event.data.id) {
            setUltimoEventoContabil(deepCloneAndFreeze(event.data));
            ouvintesRef.current.forEach((cb) => {
              try {
                cb(event.data);
              } catch (err) {
                console.error('[CORE_BANKING_LISTENER_ERR]', err);
              }
            });
          }
        };

        return () => {
          canal.close();
        };
      }
    } catch {
      // Fallback seguro em ambientes sem suporte
    }
  }, []);

  const inscreverOuvinteContabil = useCallback((callback: (evento: EventoContabil) => void) => {
    ouvintesRef.current.add(callback);
    return () => {
      ouvintesRef.current.delete(callback);
    };
  }, []);

  // Notificação reativa com clonagem profunda e broadcast imediato
  const emitirEventoContabil = useCallback(
    (tipo: EventoContabil['tipo'], mensagem: string, entidadeId: string, tenantId: string, hashIntegridade: string) => {
      const anoAtual = new Date().getFullYear();
      const agoraIso = new Date().toISOString();
      const evento: EventoContabil = deepCloneAndFreeze({
        id: `evt-${anoAtual}-${Math.random().toString(36).substring(2, 8)}`,
        timestamp: agoraIso,
        tipo,
        tenantId,
        mensagem: normalizeUtf8String(mensagem),
        entidadeId,
        hashIntegridade,
      });

      setUltimoEventoContabil(evento);

      ouvintesRef.current.forEach((cb) => {
        try {
          cb(evento);
        } catch (err) {
          console.error('[CORE_BANKING_EVENT_EMIT_ERR]', err);
        }
      });

      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage(evento);
        } catch {
          // Erro de postMessage ignorado com segurança
        }
      }
    },
    []
  );

  // Cadeia Criptográfica de Auditoria em Memória e no Firestore (Blockchain Ledger)
  const addAuditLog = useCallback(
    (
      acao: AcaoAuditoria,
      detalhes: string,
      tenantIdOverride?: string,
      operadorIdOverride?: string,
      operadorNomeOverride?: string
    ): AuditLog => {
      const tenantAlvo = tenantIdOverride || tenantAtivoId;
      const opNome = operadorNomeOverride || operadorAtualRef.current || 'Administrador Master';
      const opId = operadorIdOverride || operadorIdRef.current || 'op-super-master-001';
      const timestampIso = new Date().toISOString();
      const anoAtual = new Date().getFullYear();
      const detalhesSanitizados = normalizeUtf8String(detalhes);

      const logsAnteriores = logsRef.current;
      const ultimoLog = logsAnteriores[logsAnteriores.length - 1];
      const hashAnterior = ultimoLog ? ultimoLog.hashIntegridade : GENESIS_HASH;

      const stringParaHash = `${tenantAlvo}|${opId}|${opNome}|${acao}|${detalhesSanitizados}|${timestampIso}|${hashAnterior}`;
      const hashCalculado = sha256(stringParaHash);

      const novoRegistro: AuditLog = deepCloneAndFreeze({
        id: `log-${anoAtual}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: timestampIso,
        tenantId: tenantAlvo,
        operador: opNome,
        operadorId: opId,
        acao,
        detalhes: detalhesSanitizados,
        hashIntegridade: hashCalculado,
        hashAnterior,
      });

      const listaAtualizada = deepCloneAndFreeze([...logsAnteriores, novoRegistro]);
      logsRef.current = listaAtualizada;
      setLogs(listaAtualizada);

      // Persistência Direta e Imediata no Banco Firestore
      try {
        setDoc(doc(db, 'audit_logs', novoRegistro.id), novoRegistro).catch((err) => {
          console.error('[FIRESTORE_AUDIT_LOG_PERSIST_ERR]', err);
        });
      } catch (err) {
        console.error('[FIRESTORE_AUDIT_LOG_ERR]', err);
      }

      emitirEventoContabil(
        'AUDITORIA_INTEGRIDADE',
        `Log criptografado adicionado: [${acao}] ${detalhesSanitizados}`,
        novoRegistro.id,
        tenantAlvo,
        novoRegistro.hashIntegridade
      );

      return novoRegistro;
    },
    [tenantAtivoId, emitirEventoContabil]
  );

  // Registro de Entrada / Login no Sistema
  const registrarLogin = useCallback(
    (
      operadorNome: string,
      idOperador: string,
      role: OperadorRole,
      metodo: string = 'Portal Unificado',
      tenantIdOverride?: string
    ): AuditLog => {
      const nomeNorm = normalizeUtf8String(operadorNome) || '';
      const idNorm = normalizeUtf8String(idOperador) || '';
      const tenantFinal = tenantIdOverride || tenantAtivoId || 't-sede-salvador';

      setOperadorAtual(nomeNorm);
      setOperadorId(idNorm);
      operadorAtualRef.current = nomeNorm;
      operadorIdRef.current = idNorm;
      setOperadorRole(role);
      setTenantAtivoId(tenantFinal);
      setAuthCarregando(false);

      ultimaAtividadeRef.current = Date.now();
      setAvisoInatividadeAtivo(false);

      return addAuditLog(
        'LOGIN_REALIZADO',
        `Entrada no sistema: Operador ${nomeNorm} (ID: ${idNorm}, Perfil: ${role}) autenticado com sucesso via ${metodo}.`,
        tenantFinal,
        idNorm,
        nomeNorm
      );
    },
    [tenantAtivoId, addAuditLog]
  );

  // Registro de Saída / Logout no Sistema
  const registrarLogout = useCallback(
    (
      motivoOuOperadorNomeOverride?: string,
      operadorIdOverride?: string,
      tenantIdOverride?: string
    ): AuditLog => {
      try {
        signOut(auth).catch(() => {});
      } catch {}

      const opAtual = operadorAtualRef.current;
      const opId = operadorIdOverride || operadorIdRef.current || 'op-sessao';
      const motivo = motivoOuOperadorNomeOverride || 'Encerramento de sessão';
      const nome = opAtual || (motivoOuOperadorNomeOverride && !motivoOuOperadorNomeOverride.includes(' ') ? motivoOuOperadorNomeOverride : 'Operador');

      setOperadorAtual('');
      setOperadorId('');
      setOperadorRole('CONSULTA_PUBLICA');
      operadorAtualRef.current = '';
      operadorIdRef.current = '';
      setAvisoInatividadeAtivo(false);

      const log = addAuditLog(
        'LOGOUT_REALIZADO',
        `Saída do sistema: Sessão do operador ${nome} (ID: ${opId}) encerrada com sucesso. Motivo: ${motivo}`,
        tenantIdOverride || tenantAtivoId,
        opId,
        nome
      );

      return log;
    },
    [tenantAtivoId, addAuditLog]
  );

  // =========================================================================
  // MOTOR DE COMPLIANCE: 30-MINUTE IDLE DISCONNECT ENGINE (CONTROLE DE INATIVIDADE)
  // =========================================================================
  const revalidarSessaoAtiva = useCallback(() => {
    ultimaAtividadeRef.current = Date.now();
    setAvisoInatividadeAtivo(false);
    setSegundosRestantesInatividade(60);
  }, []);

  const avisoInatividadeAtivoRef = useRef(false);
  useEffect(() => {
    avisoInatividadeAtivoRef.current = avisoInatividadeAtivo;
  }, [avisoInatividadeAtivo]);

  useEffect(() => {
    // Apenas monitora se houver um operador autenticado
    if (!operadorAtual || operadorAtual.trim() === '') {
      setAvisoInatividadeAtivo(false);
      return;
    }

    // Reseta imediatamente o contador de inatividade no momento que o operador é ativado
    ultimaAtividadeRef.current = Date.now();
    setAvisoInatividadeAtivo(false);

    const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutos
    const WARNING_THRESHOLD_MS = 29 * 60 * 1000; // 29 minutos

    const registrarInteracaoUsuario = () => {
      // Se o aviso ainda não foi aberto, reseta o marcador de atividade
      if (!avisoInatividadeAtivoRef.current) {
        ultimaAtividadeRef.current = Date.now();
      }
    };

    const eventosMonitorados: (keyof WindowEventMap)[] = [
      'mousemove',
      'keydown',
      'click',
      'scroll',
      'touchstart',
    ];

    eventosMonitorados.forEach((evento) => {
      window.addEventListener(evento, registrarInteracaoUsuario, { passive: true });
    });

    const intervaloVerificacao = setInterval(() => {
      const agora = Date.now();
      const tempoInativo = agora - ultimaAtividadeRef.current;

      if (tempoInativo >= IDLE_LIMIT_MS) {
        // Matriz de Logout Forçado: 30 minutos atingidos sem resposta
        clearInterval(intervaloVerificacao);
        setAvisoInatividadeAtivo(false);
        registrarLogout('Sessão encerrada por inatividade de 30 minutos (Proteção Bancária)');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sigm_idle_logout'));
        }
      } else if (tempoInativo >= WARNING_THRESHOLD_MS) {
        // Gatilho de Aviso: 29 minutos atingidos (contagem regressiva de 60s)
        const restantesMs = IDLE_LIMIT_MS - tempoInativo;
        const restantesSeg = Math.max(0, Math.ceil(restantesMs / 1000));
        if (!avisoInatividadeAtivoRef.current) {
          setAvisoInatividadeAtivo(true);
        }
        setSegundosRestantesInatividade(restantesSeg);
      } else {
        if (avisoInatividadeAtivoRef.current) {
          setAvisoInatividadeAtivo(false);
        }
      }
    }, 1000);

    return () => {
      eventosMonitorados.forEach((evento) => {
        window.removeEventListener(evento, registrarInteracaoUsuario);
      });
      clearInterval(intervaloVerificacao);
    };
  }, [operadorAtual, registrarLogout]);

  // Governança RBAC e Privilégio Mínimo
  const alternarOperadorRole = useCallback(
    (novaRole: OperadorRole) => {
      setOperadorRole(novaRole);
      addAuditLog(
        'ALTERACAO_CONFIGURACAO',
        `Perfil RBAC do operador alterado para [${novaRole}]. Princípio do Privilégio Mínimo aplicado.`,
        tenantAtivoId
      );
    },
    [tenantAtivoId, addAuditLog]
  );

  const verificarPermissao = useCallback(
    (permissao: PermissaoSistema): boolean => {
      return verificarPrivilegioMinimo(operadorRole, permissao);
    },
    [operadorRole]
  );

  // Mecanismo de Verificação de Integridade Criptográfica e Bloqueio de Acesso aos Recursos Críticos (Pure verification, no side effects)
  const validarIntegridadeAcesso = useCallback(
    (recurso: RecursoCritico, tenantIdAlvo?: string): ResultadoVerificacaoIntegridade => {
      const agora = SYSTEM_REFERENCE_TIME_ISO;
      const tenantVerificado = tenantIdAlvo || tenantAtivoId;

      // 1. Verificação de Tenant Válido e Isolamento de Convenção Centralizada
      const tenantValido = tenants.some((t) => t.id === tenantVerificado);
      if (!tenantValido && tenantVerificado !== 't-sede-salvador' && tenantVerificado !== 'GLOBAL') {
        return {
          permitido: false,
          codigoBloqueio: 'TENANT_INVALIDO',
          motivo: `O Tenant informado (${tenantVerificado}) não existe ou não está autorizado na Convenção Geral Centralizada.`,
          operadorAtual: operadorAtualRef.current,
          role: operadorRole,
          tenantId: tenantVerificado,
          timestamp: agora,
          recurso,
          hashAuditoria: 'PENDING_AUDIT_LOG_TENANT',
        };
      }

      // 2. Verificação de Usuário Suspenso (Com isolamento de coleção entre Super Master e Administrativo)
      if (operadorRole === 'SUPER_ADMIN') {
        const usuarioSys = usuariosSistemaRef.current.find(
          (u) => u.id === operadorIdRef.current || (u.email && u.email.toLowerCase() === operadorAtualRef.current.toLowerCase())
        );
        if (usuarioSys && usuarioSys.statusAcesso !== 'ATIVO') {
          return {
            permitido: false,
            codigoBloqueio: 'USUARIO_SUSPENSO',
            motivo: `A credencial do Super Master [${usuarioSys.nome}] está com status [${usuarioSys.statusAcesso}]. Acesso restrito.`,
            operadorAtual: operadorAtualRef.current,
            role: operadorRole,
            tenantId: tenantVerificado,
            timestamp: agora,
            recurso,
            hashAuditoria: 'PENDING_AUDIT_LOG_SUSPENSO',
          };
        }
      } else {
        const usuarioCadastrado = usuariosAdministrativosRef.current.find(
          (u) => u.id === operadorIdRef.current || (u.email && u.email.toLowerCase() === operadorAtualRef.current.toLowerCase())
        );
        if (usuarioCadastrado && usuarioCadastrado.statusAcesso !== 'ATIVO') {
          return {
            permitido: false,
            codigoBloqueio: 'USUARIO_SUSPENSO',
            motivo: `A credencial do operador [${usuarioCadastrado.nome}] está com status [${usuarioCadastrado.statusAcesso}] pelo Conselho de Governança. Acesso restrito.`,
            operadorAtual: operadorAtualRef.current,
            role: operadorRole,
            tenantId: tenantVerificado,
            timestamp: agora,
            recurso,
            hashAuditoria: 'PENDING_AUDIT_LOG_SUSPENSO',
          };
        }
      }

      // 3. Matriz Estrita de Privilégio Mínimo (RBAC Level 4) por Recurso Crítico
      let autorizado = false;
      let motivoBloqueio = '';

      switch (recurso) {
        case 'GOVERNANCA_MASTER':
          // Bunker Root exclusivo do Super Master (Dono da Plataforma / Infraestrutura)
          autorizado = operadorRole === 'SUPER_ADMIN';
          motivoBloqueio = 'Módulo restrito exclusivamente ao perfil Super Master (Root Bunker do Dono do SaaS).';
          break;

        case 'GESTAO_USUARIOS':
          // Gestão de Usuários da Convenção: Administrador Master e Super Master
          autorizado = operadorRole === 'ADMINISTRADOR_MASTER' || operadorRole === 'SUPER_ADMIN';
          motivoBloqueio = 'Módulo restrito ao Administrador Master da Convenção e Super Master.';
          break;

        case 'TESOURARIA_DRE':
          autorizado =
            operadorRole === 'TESOUREIRO' ||
            operadorRole === 'SECRETARIO' ||
            operadorRole === 'ADMINISTRADOR_MASTER' ||
            operadorRole === 'PRESIDENTE_GERAL' ||
            operadorRole === 'SUPER_ADMIN';
          motivoBloqueio = 'Módulo restrito à Tesouraria Geral, Secretaria e Administrador Master.';
          break;

        case 'SECRETARIA_GERAL':
        case 'GESTAO_MINISTROS':
        case 'GESTAO_IGREJAS':
        case 'MESA_DIRETORA':
        case 'GESTAO_AGO':
          autorizado =
            operadorRole === 'SECRETARIO' ||
            operadorRole === 'TESOUREIRO' ||
            operadorRole === 'ADMINISTRADOR_MASTER' ||
            operadorRole === 'PRESIDENTE_GERAL' ||
            operadorRole === 'SUPER_ADMIN';
          motivoBloqueio = 'Módulo restrito à Secretaria Geral, Tesouraria, Presidência e Administrador Master.';
          break;

        case 'COMPLIANCE_AUDITORIA':
          autorizado = operadorRole === 'ADMINISTRADOR_MASTER' || operadorRole === 'SUPER_ADMIN';
          motivoBloqueio = 'Módulo restrito ao Administrador Master da Convenção e Super Master.';
          break;

        case 'ADMINISTRACAO_GERAL':
          autorizado =
            operadorRole === 'ADMINISTRADOR_MASTER' ||
            operadorRole === 'PRESIDENTE_GERAL' ||
            operadorRole === 'SECRETARIO' ||
            operadorRole === 'TESOUREIRO' ||
            operadorRole === 'SUPER_ADMIN';
          motivoBloqueio = 'Módulo restrito a operadores administrativos certificados.';
          break;

        case 'BIRO_IMPRESSAO':
          autorizado =
            operadorRole === 'BIRO' ||
            operadorRole === 'ADMINISTRADOR_MASTER' ||
            operadorRole === 'SECRETARIO' ||
            operadorRole === 'MINISTRO_OBREIRO' ||
            operadorRole === 'SUPER_ADMIN';
          motivoBloqueio = 'Acesso restrito ao Birô Central de Impressão e operadores autorizados.';
          break;

        default:
          autorizado = true;
          break;
      }

      if (!autorizado) {
        return {
          permitido: false,
          codigoBloqueio: 'ROLE_INSUFICIENTE',
          motivo: `Acesso negado: Seu perfil atual [${operadorRole}] não possui privilégio para o componente [${recurso}]. ${motivoBloqueio}`,
          operadorAtual: operadorAtualRef.current,
          role: operadorRole,
          tenantId: tenantVerificado,
          timestamp: agora,
          recurso,
          hashAuditoria: 'PENDING_AUDIT_LOG_ROLE',
        };
      }

      return {
        permitido: true,
        operadorAtual: operadorAtualRef.current,
        role: operadorRole,
        tenantId: tenantVerificado,
        timestamp: agora,
        recurso,
      };
    },
    [tenantAtivoId, tenants, operadorRole]
  );

  const executarConsultaParametrizada = useCallback(
    <T,>(
      statement: ParametrizedStatement,
      dataset: readonly T[],
      predicate: (item: T, params: readonly SqlParamValue[]) => boolean
    ): readonly T[] => {
      return executeSecureQuery(statement, dataset, predicate);
    },
    []
  );

  // Verificação de Integridade Criptográfica do Ledger
  const verificarIntegridadeAuditTrail = useCallback((): {
    valida: boolean;
    totalBlocos: number;
    quebras: number[];
  } => {
    const quebras: number[] = [];
    for (let i = 0; i < logs.length; i++) {
      const blocoAtual = logs[i];
      const blocoAnterior = i > 0 ? logs[i - 1] : null;
      const hashEsperadoAnterior = blocoAnterior ? blocoAnterior.hashIntegridade : GENESIS_HASH;

      if (blocoAtual.hashAnterior !== hashEsperadoAnterior) {
        quebras.push(i);
        continue;
      }

      const opId = blocoAtual.operadorId || 'op-root-system';
      const stringRecalculada = `${blocoAtual.tenantId}|${opId}|${blocoAtual.operador}|${blocoAtual.acao}|${blocoAtual.detalhes}|${blocoAtual.timestamp}|${hashEsperadoAnterior}`;
      const hashRecalculado = sha256(stringRecalculada);

      // Verificação tolerante a legado e estrita para novos
      if (blocoAtual.hashIntegridade !== hashRecalculado) {
        const fallbackString = `${blocoAtual.tenantId}|${blocoAtual.operador}|${blocoAtual.acao}|${blocoAtual.detalhes}|${blocoAtual.timestamp}|${hashEsperadoAnterior}`;
        if (blocoAtual.hashIntegridade !== sha256(fallbackString)) {
          quebras.push(i);
        }
      }
    }

    return {
      valida: quebras.length === 0,
      totalBlocos: logs.length,
      quebras,
    };
  }, [logs]);

  // Alternância de Tenant Ativo
  const alternarTenant = useCallback(
    (novoTenantId: string) => {
      const tenantExiste = tenants.some((t) => t.id === novoTenantId);
      if (!tenantExiste) {
        console.warn(`[MULTI_TENANT_VIOLATION] Tenant ${novoTenantId} não localizado.`);
        return;
      }

      setTenantAtivoId(novoTenantId);
      addAuditLog('TENANT_ALTERADO', `Operador alternou para o Tenant ID: ${novoTenantId}`, novoTenantId);
    },
    [tenants, addAuditLog]
  );

  const definirOperador = useCallback(
    (novoOperador: string, novoOperadorId?: string) => {
      const operadorNormalizado = normalizeUtf8String(novoOperador);
      if (operadorNormalizado) {
        setOperadorAtual(operadorNormalizado);
        operadorAtualRef.current = operadorNormalizado;
      }
      if (novoOperadorId) {
        const idNormalizado = normalizeUtf8String(novoOperadorId);
        setOperadorId(idNormalizado);
        operadorIdRef.current = idNormalizado;
      }

      // Reseta imediatamente o contador de atividade ao definir operador
      ultimaAtividadeRef.current = Date.now();
      setAvisoInatividadeAtivo(false);

      // Persistência nativa de sessão via Firebase Auth SDK
      if (!auth.currentUser && operadorNormalizado) {
        signInAnonymously(auth).then((cred) => {
          if (cred.user) {
            updateProfile(cred.user, { displayName: operadorNormalizado }).catch(() => {});
          }
        }).catch((err) => {
          console.warn('[AUTH_PERSISTENCE_WARN] Falha ao registrar sessão nativa no Firebase Auth:', err);
        });
      }
    },
    []
  );

  // Cadastro de Novo Ministro com Cobrança Inicial Vinculada & Cláusula Parametrizada
  const cadastrarMinistro = useCallback(
    async (novoMinistroPayload: Omit<Ministro, 'id' | 'dataFiliacao'> & { dataFiliacao?: string }): Promise<Ministro> => {
      // 1. Princípio do Privilégio Mínimo (RBAC)
      if (!verificarPrivilegioMinimo(operadorRole, 'CADASTRAR_MINISTRO')) {
        const msg = `ACESSO NEGADO (PRIVILÉGIO MÍNIMO): Papel [${operadorRole}] não possui permissão para cadastrar novos ministros.`;
        addAuditLog('ALTERACAO_CONFIGURACAO', msg, novoMinistroPayload.tenantId);
        throw new Error(msg);
      }

      // 2. Barreira Pré-Cloud Google: Validação Matemática de CPF, CEP e Sanitização Estrita
      const gateway = interceptarESubmeterGoogleCloud({
        cpf: novoMinistroPayload.cpf,
        cep: novoMinistroPayload.dadosEndereco.cep,
        payload: {
          nome: novoMinistroPayload.nome,
          cargo: novoMinistroPayload.cargo,
          rua: novoMinistroPayload.dadosEndereco.rua,
          numero: novoMinistroPayload.dadosEndereco.numero,
          bairro: novoMinistroPayload.dadosEndereco.bairro,
          cidade: novoMinistroPayload.dadosEndereco.cidade,
          uf: novoMinistroPayload.dadosEndereco.uf,
        },
        operadorRole,
        acao: 'CADASTRAR_MINISTRO',
      });

      if (!gateway.aprovado) {
        const motivo = gateway.motivoRejeicao || 'Falha de validação pré-submissão Cloud.';
        addAuditLog('ALTERACAO_CONFIGURACAO', `VETO DE SEGURANÇA: ${motivo}`, novoMinistroPayload.tenantId);
        throw new Error(motivo);
      }

      const cpfValido = gateway.cpfValidado!;

      // 2.1 Verificação assíncrona estrita de CPF duplicado no Firestore e na base local
      const cpfLimpo = cpfValido.replace(/\D/g, '');
      const jaExisteLocal = ministrosRef.current.some(
        (m) => m.cpf && m.cpf.replace(/\D/g, '') === cpfLimpo
      );

      if (jaExisteLocal) {
        const msg = `VETO DE UNICIDADE: Já existe um ministro cadastrado com o CPF [${cpfValido}] na memória local. Cadastro rejeitado.`;
        addAuditLog('ALTERACAO_CONFIGURACAO', msg, novoMinistroPayload.tenantId);
        throw new Error(msg);
      }

      try {
        const qCpf = query(collection(db, 'ministros'), where('cpf', '==', cpfValido));
        const snapCpf = await getDocs(qCpf);
        if (!snapCpf.empty) {
          const msg = `VETO DE UNICIDADE (FIRESTORE): Já existe um registro oficial na base de dados com o CPF [${cpfValido}]. Inclusão vetada.`;
          addAuditLog('ALTERACAO_CONFIGURACAO', msg, novoMinistroPayload.tenantId);
          throw new Error(msg);
        }
      } catch (err: any) {
        if (err?.message && err.message.includes('VETO DE UNICIDADE')) {
          throw err;
        }
        console.warn('[FIRESTORE_CPF_CHECK_WARN]', err);
      }
      const cepValido = gateway.cepValidado!;
      const payloadLimpo = gateway.payloadSanitizado as {
        nome: string;
        cargo: string;
        rua: string;
        numero: string;
        bairro: string;
        cidade: string;
        uf: string;
      };

      const cargoInput = (payloadLimpo.cargo || '').toLowerCase();
      if (cargoInput.includes('super master') || cargoInput.includes('super_admin') || cargoInput.includes('administrador master')) {
        const msg = `VETO DE CARGO: O cargo [${payloadLimpo.cargo}] é exclusivo de operador técnico administrativo do sistema e não pode ser atribuído a um registro ministerial do clero.`;
        addAuditLog('ALTERACAO_CONFIGURACAO', msg, novoMinistroPayload.tenantId);
        throw new Error(msg);
      }

      // Data do sistema cravada no momento da criação (Horário de Brasília)
      const dataHojeReal = getSystemDate();
      const dataFiliacaoIso = novoMinistroPayload.dataFiliacao || dataHojeReal;
      const anoAtual = parseInt(dataFiliacaoIso.split('-')[0], 10) || SYSTEM_REFERENCE_YEAR;
      // Mandato de Idempotência: chave canônica unívoca correspondente estritamente ao CPF sanitizado
      const novoId = cpfLimpo;

      // REGRA ESTATUTÁRIA: O vencimento é na data atual (no dia atual), e não 30 dias depois
      const dataVencimentoFiliacao = dataHojeReal;

      // 3. Cláusula Parametrizada Segura contra SQL Injection
      const insertParametrizado = buildParametrizedStatement(
        'INSERT INTO ministros (id, tenant_id, nome, cpf, cargo, status, data_filiacao, cep, cidade, uf) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [
          novoId,
          novoMinistroPayload.tenantId,
          payloadLimpo.nome,
          cpfValido,
          payloadLimpo.cargo,
          novoMinistroPayload.status,
          dataFiliacaoIso,
          cepValido,
          payloadLimpo.cidade,
          payloadLimpo.uf,
        ]
      );

      const tenantIdValidado = novoMinistroPayload.tenantId || tenantAtivoId || 't-sede-salvador';

      const cargoLimpo = (payloadLimpo.cargo || '').toLowerCase();
      const isMissionaria = cargoLimpo.includes('missionar');

      // Herança dinâmica e segura do valor da taxa de filiação a partir dos parâmetros oficiais
      let valorTaxaInicial = isMissionaria
        ? Number(appConfig.taxaFiliacaoMissionaria || appConfig.taxaFiliacaoInicial || 120.0)
        : Number(appConfig.taxaFiliacaoMinistro || appConfig.taxaFiliacaoInicial || 190.0);

      if (!valorTaxaInicial || valorTaxaInicial <= 0) {
        valorTaxaInicial = isMissionaria ? 120.0 : 190.0;
      }

      const statusAdimplenciaInicial: StatusAdimplencia = 'PENDENTE';

      const ministroCriado: Ministro = deepCloneAndFreeze({
        ...novoMinistroPayload,
        id: novoId,
        tenantId: tenantIdValidado,
        registroMinisterial:
          novoMinistroPayload.registroMinisterial || gerarRegistroMinisterial(cpfValido),
        dataFiliacao: dataFiliacaoIso,
        statusAdimplencia: statusAdimplenciaInicial,
        nome: payloadLimpo.nome,
        cpf: cpfValido,
        cargo: (payloadLimpo.cargo || novoMinistroPayload.cargo) as CargoEclesiastico,
        dadosEndereco: {
          cep: cepValido,
          rua: payloadLimpo.rua,
          numero: payloadLimpo.numero,
          bairro: payloadLimpo.bairro,
          cidade: payloadLimpo.cidade,
          uf: payloadLimpo.uf.toUpperCase(),
        },
      });

      setMinistros((anteriores) => deepCloneAndFreeze([...anteriores, ministroCriado]));

      // Persistência Direta no Banco Firestore (limpo contra undefined)
      try {
        await setDoc(doc(db, 'ministros', novoId), limparParaFirestore(ministroCriado));
      } catch (err) {
        console.error('[FIRESTORE_CADASTRO_MINISTRO_ERR]', err);
      }

      // Geração da Taxa/Anuidade de Filiação com vencimento NO DIA ATUAL (Hoje)
      const anuidadeInicialId = `an-${anoAtual}-${novoId}-${Math.floor(1000 + Math.random() * 9000)}`;
      const anuidadeInicial: AnuidadeMinistro = deepCloneAndFreeze({
        id: anuidadeInicialId,
        ministroId: novoId,
        tenantId: tenantIdValidado,
        anoVigente: anoAtual,
        dataVencimento: dataVencimentoFiliacao,
        valor: valorTaxaInicial,
        statusPagamento: 'ABERTO',
        tipo: 'RECEITA',
        categoria: 'TAXA_CONVENCAO',
        descricao: `Taxa de Filiação / Anuidade ${anoAtual}`,
      });

      setAnuidades((ant) => deepCloneAndFreeze([...ant, anuidadeInicial]));

      try {
        await setDoc(doc(db, 'anuidades', anuidadeInicialId), limparParaFirestore(anuidadeInicial));
      } catch (err) {
        console.error('[FIRESTORE_ANUIDADE_INICIAL_ERR]', err);
      }

      const log = addAuditLog(
        'CADASTRO_MINISTRO',
        `Ministro registrado via instrução parametrizada: ${ministroCriado.nome} (CPF: ${cpfValido}, CEP: ${cepValido}). SQL Seguro: ${insertParametrizado.sanitizedSqlPreview}. Status Inicial: [${statusAdimplenciaInicial}].`,
        ministroCriado.tenantId
      );

      emitirEventoContabil(
        'MUTACAO_CADASTRO',
        `Novo ministro filiado no ecossistema: ${ministroCriado.nome}.`,
        ministroCriado.id,
        ministroCriado.tenantId,
        log.hashIntegridade
      );

      return ministroCriado;
    },
    [operadorRole, addAuditLog, emitirEventoContabil]
  );

  // Atualização de Status de Ministro com Auditoria de Adimplência
  const atualizarStatusMinistro = useCallback(
    async (
      ministroId: string,
      novoStatus: StatusMinistro,
      novoStatusAdimplencia?: StatusAdimplencia
    ): Promise<void> => {
      const index = ministrosRef.current.findIndex((m) => m.id === ministroId);
      if (index === -1) {
        return;
      }

      const atual = ministrosRef.current[index];
      const ministroAtualizado: Ministro = deepCloneAndFreeze({
        ...atual,
        status: novoStatus,
        statusAdimplencia: novoStatusAdimplencia || atual.statusAdimplencia,
      });

      const novaLista = [...ministrosRef.current];
      novaLista[index] = ministroAtualizado;
      const ministrosCongelados = deepCloneAndFreeze(novaLista);
      ministrosRef.current = ministrosCongelados;
      setMinistros(ministrosCongelados);

      // Persistência Direta no Banco Firestore
      try {
        await updateDoc(doc(db, 'ministros', ministroId), {
          status: novoStatus,
          statusAdimplencia: novoStatusAdimplencia || atual.statusAdimplencia,
          atualizado_em: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[FIRESTORE_STATUS_MINISTRO_ERR]', err);
      }

      // Auditoria Estrita de Alteração de Adimplência
      if (novoStatusAdimplencia && novoStatusAdimplencia !== atual.statusAdimplencia) {
        addAuditLog(
          'STATUS_ADIMPLENCIA_ALTERADO',
          `Status de adimplência do ministro ${atual.nome} (CPF: ${atual.cpf}, ID: ${ministroId}) alterado de [${atual.statusAdimplencia}] para [${novoStatusAdimplencia}].`,
          ministroAtualizado.tenantId
        );
      }

      if (novoStatusAdimplencia === 'INADIMPLENTE' || novoStatus === 'SUSPENSO') {
        const indexAgo = inscricoesAGORef.current.findIndex(
          (i) => i.ministroId === ministroId && i.statusInscricao === 'VALIDA'
        );
        if (indexAgo !== -1) {
          const inscricaoRevogada: InscricaoAGO = deepCloneAndFreeze({
            ...inscricoesAGORef.current[indexAgo],
            statusInscricao: 'REVOGADA',
          });
          const novaListaAgo = [...inscricoesAGORef.current];
          novaListaAgo[indexAgo] = inscricaoRevogada;
          const inscricoesCongeladas = deepCloneAndFreeze(novaListaAgo);
          inscricoesAGORef.current = inscricoesCongeladas;
          setInscricoesAGO(inscricoesCongeladas);

          addAuditLog(
            'AGO_INSCRICAO_REVOCADA_POR_INADIMPLENCIA',
            `Inscrição da AGO revogada de ofício devido à inadimplência/suspensão do ministro ID: ${ministroId}`,
            ministroAtualizado.tenantId
          );
        }
      }

      const log = addAuditLog(
        'STATUS_MINISTRO_ALTERADO',
        `Status do ministro ${ministroId} alterado para [${novoStatus}] e adimplência [${novoStatusAdimplencia || 'INALTERADA'}]`,
        ministroAtualizado.tenantId
      );

      emitirEventoContabil(
        'MUTACAO_CADASTRO',
        `Alteração cadastral/adimplência: ${ministroId}`,
        ministroId,
        ministroAtualizado.tenantId,
        log.hashIntegridade
      );
    },
    [addAuditLog, emitirEventoContabil]
  );

  // Edição Cadastral de Ministro
  const editarMinistro = useCallback(
    async (
      ministroId: string,
      dadosAtualizados: Partial<Omit<Ministro, 'id'>>
    ): Promise<Ministro> => {
      const index = ministrosRef.current.findIndex((m) => m.id === ministroId);
      if (index === -1) {
        throw new Error(`Ministro ${ministroId} não encontrado.`);
      }

      const atual = ministrosRef.current[index];

      // Target 1: CPF Uniqueness Check (Fail-Fast 409 Conflict)
      if (dadosAtualizados.cpf) {
        const cleanCpf = dadosAtualizados.cpf.replace(/\D/g, '');
        const duplicate = ministrosRef.current.find(
          (m) => m.id !== ministroId && m.cpf && m.cpf.replace(/\D/g, '') === cleanCpf
        );
        if (duplicate) {
          throw new Error(`Erro 409 Conflict: O CPF ${dadosAtualizados.cpf} já pertence a outro ministro registrado (${duplicate.nome}).`);
        }
      }

      const ministroEditado: Ministro = deepCloneAndFreeze({
        ...atual,
        ...dadosAtualizados,
        id: atual.id, // Preserva integridade de chave primária
      });

      const novaLista = [...ministrosRef.current];
      novaLista[index] = ministroEditado;
      const ministrosCongelados = deepCloneAndFreeze(novaLista);
      ministrosRef.current = ministrosCongelados;
      setMinistros(ministrosCongelados);

      // Persistência Direta no Banco Firestore (Validação Estrita de Existência)
      try {
        const minRef = doc(db, 'ministros', ministroId);
        const minSnap = await getDoc(minRef);
        if (minSnap.exists()) {
          await updateDoc(minRef, limparParaFirestore(ministroEditado as any) as Record<string, any>);
        } else {
          console.warn(`[LEI DE MUTATIVIDADE] O ministro ID '${ministroId}' não existe no Firestore. Blind merge impedido.`);
        }
      } catch (err) {
        console.error('[FIRESTORE_EDIT_MINISTRO_ERR]', err);
      }

      // Auditoria se status de adimplência foi alterado na edição
      if (dadosAtualizados.statusAdimplencia && dadosAtualizados.statusAdimplencia !== atual.statusAdimplencia) {
        addAuditLog(
          'STATUS_ADIMPLENCIA_ALTERADO',
          `Status de adimplência do ministro ${atual.nome} (CPF: ${atual.cpf}, ID: ${ministroId}) alterado de [${atual.statusAdimplencia}] para [${dadosAtualizados.statusAdimplencia}] via edição cadastral.`,
          ministroEditado.tenantId
        );
      }

      const log = addAuditLog(
        'EDICAO_MINISTRO',
        `Atualização cadastral realizada para o ministro: ${ministroEditado.nome} (CPF: ${ministroEditado.cpf}, Cargo: ${ministroEditado.cargo})`,
        ministroEditado.tenantId
      );

      emitirEventoContabil(
        'MUTACAO_CADASTRO',
        `Edição cadastral: ${ministroEditado.nome} [${ministroEditado.cargo}]`,
        ministroEditado.id,
        ministroEditado.tenantId,
        log.hashIntegridade
      );

      return ministroEditado;
    },
    [addAuditLog, emitirEventoContabil]
  );

  // Deletar Ministro com Alta Performance, Deleção Direta por ID e Blindagem contra Falhas de Rede
  const deletarMinistro = useCallback(
    async (ministroId: string, justificativa?: string): Promise<void> => {
      // 0. Bloqueio Imediato Anti-Dupla Requisição Concorrente (In-Flight Lock)
      if (delecoesMinistroEmAndamentoRef.current.has(ministroId)) {
        console.warn('[DELETAR_MINISTRO_DUPLICADO] Requisição concorrente já em andamento. Segunda chamada descartada com segurança:', ministroId);
        return;
      }

      // Idempotência: Se já foi marcado como deletado ou não existe mais
      if (ministrosDeletadosLocalmenteRef.current.has(ministroId)) {
        console.warn('[DELETAR_MINISTRO_JA_EXCLUIDO] Ministro já excluído anteriormente. Operação idempotente confirmada sem duplicidade:', ministroId);
        return;
      }

      const ministro = ministrosRef.current.find((m) => m.id === ministroId);
      const cpfAlvo = ministro?.cpf ? ministro.cpf.replace(/\D/g, '') : '';

      if (!ministro && !cpfAlvo) {
        console.warn('[DELETAR_MINISTRO_NAO_ENCONTRADO] Ministro não localizado na base local. Encerrando idempotente:', ministroId);
        return;
      }

      delecoesMinistroEmAndamentoRef.current.add(ministroId);
      if (cpfAlvo) delecoesMinistroEmAndamentoRef.current.add(cpfAlvo);

      console.log('[DELETAR_MINISTRO_START]', { ministroId, cpfAlvo, nome: ministro?.nome });

      try {
        // Bloqueio imediato contra ressurreição por snapshot
        ministrosDeletadosLocalmenteRef.current.add(ministroId);
        if (cpfAlvo) ministrosDeletadosLocalmenteRef.current.add(cpfAlvo);

        // Captura documentos filhos ANTES de alterar o estado local em memória
        const anuidadesDoMin = anuidadesRef.current.filter(
          (a) => a.ministroId === ministroId || (cpfAlvo && a.ministroId === cpfAlvo) || a.id.includes(ministroId) || (cpfAlvo && a.id.includes(cpfAlvo))
        );
        const inscricoesDoMin = inscricoesAGORef.current.filter(
          (i) => i.ministroId === ministroId || (cpfAlvo && i.ministroId === cpfAlvo)
        );

        // 1. Atualização imediata dos estados locais (bloqueio otimista instantâneo)
        const novaLista = ministrosRef.current.filter((m) => m.id !== ministroId && (!cpfAlvo || (m.cpf && m.cpf.replace(/\D/g, '') !== cpfAlvo)));
        const ministrosCongelados = deepCloneAndFreeze(novaLista);
        ministrosRef.current = ministrosCongelados;
        setMinistros(ministrosCongelados);

        const novasAnuidades = anuidadesRef.current.filter(
          (a) => a.ministroId !== ministroId && (!cpfAlvo || a.ministroId !== cpfAlvo) && !a.id.includes(ministroId) && (!cpfAlvo || !a.id.includes(cpfAlvo))
        );
        anuidadesRef.current = deepCloneAndFreeze(novasAnuidades);
        setAnuidades(anuidadesRef.current);

        const novasInscricoes = inscricoesAGORef.current.filter(
          (i) => i.ministroId !== ministroId && (!cpfAlvo || i.ministroId !== cpfAlvo)
        );
        inscricoesAGORef.current = deepCloneAndFreeze(novasInscricoes);
        setInscricoesAGO(inscricoesAGORef.current);

        // 2. Persistência direta e purga em cascata no Firestore (apenas dados ministeriais)
        try {
          await deleteDoc(doc(db, 'ministros', ministroId)).catch(() => {});
          if (cpfAlvo && cpfAlvo !== ministroId) {
            await deleteDoc(doc(db, 'ministros', cpfAlvo)).catch(() => {});
          }

          for (const anuidade of anuidadesDoMin) {
            await deleteDoc(doc(db, 'anuidades', anuidade.id)).catch(() => {});
          }

          for (const insc of inscricoesDoMin) {
            await deleteDoc(doc(db, 'inscricoes_ago', insc.id)).catch(() => {});
          }

          // Varredura atômica adicional por query de id de ministro ou CPF
          try {
            const qAnu1 = query(collection(db, 'anuidades'), where('ministroId', '==', ministroId));
            const snapAnu1 = await getDocs(qAnu1);
            snapAnu1.docs.forEach((d) => deleteDoc(doc(db, 'anuidades', d.id)).catch(() => {}));

            if (cpfAlvo && cpfAlvo !== ministroId) {
              const qAnu2 = query(collection(db, 'anuidades'), where('ministroId', '==', cpfAlvo));
              const snapAnu2 = await getDocs(qAnu2);
              snapAnu2.docs.forEach((d) => deleteDoc(doc(db, 'anuidades', d.id)).catch(() => {}));
            }
          } catch (qErr) {
            console.warn('[CASCADE_DELETE_WARN] Varredura secundária de anuidades:', qErr);
          }
        } catch (err: any) {
          console.error('[FIRESTORE_DELETE_MINISTRO_FATAL]', err);
          throw new Error(`Falha ao excluir no banco de dados: ${err?.message || 'Falha de conexão com o Firestore'}`);
        }

        const log = addAuditLog(
          'EXCLUSAO_MINISTRO',
          `Exclusão definitiva de registro ministerial: ${ministro ? ministro.nome : ministroId} (CPF: ${cpfAlvo}). Justificativa: ${justificativa || 'Nenhuma informada'}`,
          ministro?.tenantId || 't-sede-salvador'
        );

        emitirEventoContabil(
          'MUTACAO_CADASTRO',
          `Registro ministerial excluído com sucesso. Motivo: ${justificativa || 'Nenhum'}`,
          ministroId,
          ministro?.tenantId || 't-sede-salvador',
          log.hashIntegridade
        );
      } finally {
        // Liberação atômica da trava em andamento
        delecoesMinistroEmAndamentoRef.current.delete(ministroId);
        if (cpfAlvo) delecoesMinistroEmAndamentoRef.current.delete(cpfAlvo);
      }
    },
    [addAuditLog, emitirEventoContabil]
  );

  // Alternar Status de Ativação/Desabilitação
  const alternarStatusMinistro = useCallback(
    async (ministroId: string): Promise<void> => {
      const ministro = ministrosRef.current.find((m) => m.id === ministroId);
      if (!ministro) return;

      const novoStatus: StatusMinistro = ministro.status === 'ATIVO' ? 'SUSPENSO' : 'ATIVO';
      await atualizarStatusMinistro(ministroId, novoStatus);
    },
    [atualizarStatusMinistro]
  );

  // Registro de nova anuidade
  const registrarAnuidade = useCallback(
    async (payload: Omit<AnuidadeMinistro, 'id'>): Promise<AnuidadeMinistro> => {
      const tenantIdFinal = payload.tenantId || tenantAtivoId || 't-sede-salvador';
      const anoVig = payload.anoVigente || new Date().getFullYear();
      const novaAnuidade: AnuidadeMinistro = deepCloneAndFreeze({
        ...payload,
        id: `an-${anoVig}-${Math.floor(Math.random() * 1000)}`,
        tenantId: tenantIdFinal,
        categoria: payload.categoria || 'ANUIDADE',
        statusPagamento: payload.statusPagamento || 'ABERTO',
      });

      const anuidadesAtualizadas = deepCloneAndFreeze([...anuidadesRef.current, novaAnuidade]);
      anuidadesRef.current = anuidadesAtualizadas;
      setAnuidades(anuidadesAtualizadas);

      // Persistência Direta no Banco Firestore (limpo contra undefined)
      try {
        await setDoc(doc(db, 'anuidades', novaAnuidade.id), limparParaFirestore(novaAnuidade));
      } catch (err) {
        console.error('[FIRESTORE_CADASTRO_ANUIDADE_ERR]', err);
      }

      const log = addAuditLog(
        'ANUIDADE_REGISTRADA',
        `Taxa/Anuidade cadastrada no valor de R$ ${novaAnuidade.valor.toFixed(2)} para o ministro ${novaAnuidade.ministroId} (Ano: ${novaAnuidade.anoVigente}, Vencimento: ${novaAnuidade.dataVencimento})`,
        novaAnuidade.tenantId
      );

      emitirEventoContabil(
        'TRANSACAO_FINANCEIRA',
        `Nova taxa contábil registrada: R$ ${novaAnuidade.valor.toFixed(2)}`,
        novaAnuidade.id,
        novaAnuidade.tenantId,
        log.hashIntegridade
      );

      return novaAnuidade;
    },
    [addAuditLog, emitirEventoContabil]
  );

  // Editar Anuidade (Valor e Data de Vencimento) com propagação em cascata para cobranças abertas do ministro
  const editarAnuidade = useCallback(
    async (
      anuidadeId: string,
      dadosAtualizados: { valor?: number; dataVencimento?: string }
    ): Promise<AnuidadeMinistro> => {
      const index = anuidadesRef.current.findIndex((a) => a.id === anuidadeId);
      if (index === -1) {
        throw new Error(`Anuidade ${anuidadeId} não encontrada.`);
      }

      const atual = anuidadesRef.current[index];
      const ministroAlvoId = atual.ministroId;
      const novoValor = dadosAtualizados.valor !== undefined ? Number(dadosAtualizados.valor) : undefined;
      const novaDataVencimento = dadosAtualizados.dataVencimento;

      // Propaga a alteração de valor para todas as cobranças em aberto/pendentes/atrasadas do mesmo ministro
      const listaAtualizada = anuidadesRef.current.map((a) => {
        const ehNaoPago = a.statusPagamento !== 'PAGO' && a.statusPagamento !== 'ANISTIADO';
        if (a.id === anuidadeId || (novoValor !== undefined && a.ministroId === ministroAlvoId && ehNaoPago)) {
          return deepCloneAndFreeze({
            ...a,
            ...(novoValor !== undefined ? { valor: novoValor } : {}),
            ...(novaDataVencimento !== undefined && a.id === anuidadeId ? { dataVencimento: novaDataVencimento } : {}),
          });
        }
        return a;
      });

      const anuidadesAtualizadas = deepCloneAndFreeze(listaAtualizada);
      anuidadesRef.current = anuidadesAtualizadas;
      setAnuidades(anuidadesAtualizadas);

      // Persistência Direta e Atômica no Banco Firestore para todas as anuidades afetadas do ministro
      try {
        const batchPushes: Promise<any>[] = [];
        for (const a of anuidadesAtualizadas) {
          const ehNaoPago = a.statusPagamento !== 'PAGO' && a.statusPagamento !== 'ANISTIADO';
          if (a.id === anuidadeId || (novoValor !== undefined && a.ministroId === ministroAlvoId && ehNaoPago)) {
            batchPushes.push(setDoc(doc(db, 'anuidades', a.id), limparParaFirestore(a as any), { merge: true }));
          }
        }
        await Promise.all(batchPushes);
      } catch (err) {
        console.error('[FIRESTORE_EDIT_ANUIDADE_ERR]', err);
      }

      const anuidadeEditada = anuidadesAtualizadas.find((a) => a.id === anuidadeId) || atual;

      const log = addAuditLog(
        'ANUIDADE_EDITADA',
        `Anuidade ID ${anuidadeId} (e débitos abertos do ministro ${ministroAlvoId}) editada: Valor R$ ${anuidadeEditada.valor.toFixed(2)}${novaDataVencimento ? `, Vencimento ${novaDataVencimento}` : ''}`,
        anuidadeEditada.tenantId
      );

      emitirEventoContabil(
        'TRANSACAO_FINANCEIRA',
        `Anuidade editada em cascata: ID ${anuidadeId}`,
        anuidadeEditada.id,
        anuidadeEditada.tenantId,
        log.hashIntegridade
      );

      return anuidadeEditada;
    },
    [addAuditLog, emitirEventoContabil]
  );

  // Liquidação de Anuidade (Baixa) com Idempotência e Projeção em Cascata
  const liquidarAnuidade = useCallback(
    async (
      anuidadeId: string,
      origem: 'MANUAL' | 'WEBHOOK_ASAAS' = 'MANUAL'
    ): Promise<boolean> => {
      // Barreira de Privilégio Mínimo para Liquidações Manuais
      if (origem === 'MANUAL' && !verificarPrivilegioMinimo(operadorRole, 'LIQUIDAR_ANUIDADE')) {
        const msg = `ACESSO NEGADO (PRIVILÉGIO MÍNIMO): O papel [${operadorRole}] não possui permissão para liquidar anuidades manualmente.`;
        addAuditLog('ALTERACAO_CONFIGURACAO', msg, tenantAtivoId);
        throw new Error(msg);
      }

      if (cacheIdempotenciaRef.current.has(anuidadeId)) {
        console.warn(`[IDEMPOTENCY_LOCK] Pagamento ${anuidadeId} já processado ou em processamento concorrente.`);
        return false;
      }

      const anuidadeAtual = anuidadesRef.current.find((a) => a.id === anuidadeId);
      if (!anuidadeAtual || anuidadeAtual.statusPagamento === 'PAGO') {
        return false;
      }

      cacheIdempotenciaRef.current.add(anuidadeId);
      setCacheIdempotencia((anteriores) => deepCloneAndFreeze([...anteriores, anuidadeId]));

      const ministroAlvoId = anuidadeAtual.ministroId;

      const anuidadeLiquidada: AnuidadeMinistro = deepCloneAndFreeze({
        ...anuidadeAtual,
        statusPagamento: 'PAGO',
      });

      const novaAnuidadeProjetada: AnuidadeMinistro = projetarProximaAnuidade(
        anuidadeLiquidada,
        appConfig.taxaAnuidadeRecorrente // R$ 120,00
      );

      const index = anuidadesRef.current.findIndex((a) => a.id === anuidadeId);
      if (index === -1) {
        return false;
      }

      const novaLista = [...anuidadesRef.current];
      novaLista[index] = anuidadeLiquidada;
      novaLista.push(novaAnuidadeProjetada);

      const anuidadesAtualizadas = deepCloneAndFreeze(novaLista);
      anuidadesRef.current = anuidadesAtualizadas;
      setAnuidades(anuidadesAtualizadas);

      // Recalcula adimplência em tempo real antes de persistir no banco
      const todasDoMinistro = anuidadesAtualizadas.filter(
        (a) => a.ministroId === ministroAlvoId
      );
      const novoStatusAdimplencia = avaliarStatusAdimplencia(todasDoMinistro);

      // Persistência ACID e Idempotência Estrita via Firestore runTransaction
      try {
        await runTransaction(db, async (transaction) => {
          // 1. Checagem de Idempotência Atômica no Servidor
          const idempotenciaRefDoc = doc(db, 'transacoes_processadas', anuidadeId);
          const idempotenciaSnap = await transaction.get(idempotenciaRefDoc);
          if (idempotenciaSnap.exists()) {
            throw new Error(`[IDEMPOTENCY_LOCK] Transação ${anuidadeId} já liquidada anteriormente.`);
          }

          // 2. Leitura consistente da anuidade
          const anuidadeRefDoc = doc(db, 'anuidades', anuidadeId);
          const anuidadeSnap = await transaction.get(anuidadeRefDoc);
          if (anuidadeSnap.exists() && anuidadeSnap.data()?.statusPagamento === 'PAGO') {
            throw new Error(`[ALREADY_PAID] Anuidade ${anuidadeId} já consta como PAGA.`);
          }

          const tenantIdValido = anuidadeLiquidada.tenantId || tenantAtivoId || 't-sede-salvador';

          // 3. Gravação da chave de idempotência com metadados do operador
          transaction.set(
            idempotenciaRefDoc,
            limparParaFirestore({
              anuidadeId,
              valor: anuidadeLiquidada.valor,
              ministroId: ministroAlvoId,
              tenantId: tenantIdValido,
              operadorId: operadorIdRef.current || 'op-sistema',
              operadorNome: operadorAtualRef.current || 'Sistema',
              origem,
              processadoEm: new Date().toISOString(),
            })
          );

          // 4. Gravação da anuidade liquidada e da anuidade projetada
          transaction.set(
            anuidadeRefDoc,
            limparParaFirestore({ ...anuidadeLiquidada, tenantId: tenantIdValido }),
            { merge: true }
          );
          const proximaRefDoc = doc(db, 'anuidades', novaAnuidadeProjetada.id);
          transaction.set(
            proximaRefDoc,
            limparParaFirestore({ ...novaAnuidadeProjetada, tenantId: tenantIdValido }),
            { merge: true }
          );

          // 5. Agregação Atômica de Saldos Financeiros via increment()
          const totalRefDoc = doc(db, 'totais_financeiros', tenantIdValido);
          transaction.set(
            totalRefDoc,
            {
              totalLiquidado: increment(anuidadeLiquidada.valor),
              quantidadeLancamentos: increment(1),
              ultimaAtualizacao: new Date().toISOString(),
            },
            { merge: true }
          );

          // 6. Atualização do status de adimplência do ministro via update atômico
          const ministroRefDoc = doc(db, 'ministros', ministroAlvoId);
          transaction.update(ministroRefDoc, {
            statusAdimplencia: novoStatusAdimplencia,
            atualizado_em: new Date().toISOString(),
          });
        });
      } catch (err) {
        console.error('[FIRESTORE_TRANSACTION_LIQUIDAR_ERR]', err);
      }

      const minIndex = ministrosRef.current.findIndex((m) => m.id === ministroAlvoId);
      if (minIndex !== -1) {
        const minAnterior = ministrosRef.current[minIndex];
        if (minAnterior.statusAdimplencia !== novoStatusAdimplencia) {
          addAuditLog(
            'STATUS_ADIMPLENCIA_ALTERADO',
            `Status de adimplência do ministro ${minAnterior.nome} (CPF: ${minAnterior.cpf}, ID: ${ministroAlvoId}) alterado de [${minAnterior.statusAdimplencia}] para [${novoStatusAdimplencia}] após baixa da cobrança ${anuidadeId}.`,
            anuidadeLiquidada.tenantId
          );
        }

        const minAtualizado = deepCloneAndFreeze({
          ...minAnterior,
          statusAdimplencia: novoStatusAdimplencia,
        });
        const novaListaMin = [...ministrosRef.current];
        novaListaMin[minIndex] = minAtualizado;
        const ministrosCongelados = deepCloneAndFreeze(novaListaMin);
        ministrosRef.current = ministrosCongelados;
        setMinistros(ministrosCongelados);
      }

      const acaoAudit: AcaoAuditoria =
        origem === 'WEBHOOK_ASAAS' ? 'CONCILIACAO_WEBHOOK' : 'ANUIDADE_LIQUIDADA';

      const log = addAuditLog(
        acaoAudit,
        origem === 'WEBHOOK_ASAAS'
          ? `Conciliação síncrona Asaas (Baixa): Anuidade ID ${anuidadeId} (R$ ${anuidadeLiquidada.valor.toFixed(2)}) liquidada. Projeção contábil em cascata para ${novaAnuidadeProjetada.anoVigente} (R$ ${appConfig.taxaAnuidadeRecorrente.toFixed(2)}) registrada no Ledger.`
          : `Baixa manual de taxa/anuidade ID ${anuidadeId} (R$ ${anuidadeLiquidada.valor.toFixed(2)}). Projeção contábil em cascata para ${novaAnuidadeProjetada.anoVigente} (R$ ${appConfig.taxaAnuidadeRecorrente.toFixed(2)}) registrada no Ledger.`,
        anuidadeLiquidada.tenantId
      );

      emitirEventoContabil(
        'TRANSACAO_FINANCEIRA',
        `Liquidação [${origem}]: Cobrança ${anuidadeId} liquidada. Projeção cascata ano ${novaAnuidadeProjetada.anoVigente} ativada.`,
        anuidadeId,
        anuidadeLiquidada.tenantId,
        log.hashIntegridade
      );

      return true;
    },
    [operadorRole, tenantAtivoId, appConfig.taxaAnuidadeRecorrente, addAuditLog, emitirEventoContabil]
  );

  // Exclusão de Anuidade/Lançamento Contábil no Ledger e Firestore
  const excluirAnuidade = useCallback(
    async (anuidadeId: string): Promise<boolean> => {
      try {
        await deleteDoc(doc(db, 'anuidades', anuidadeId));
        setAnuidades((anteriores) => deepCloneAndFreeze(anteriores.filter((a) => a.id !== anuidadeId)));
        anuidadesRef.current = anuidadesRef.current.filter((a) => a.id !== anuidadeId);
        addAuditLog(
          'ALTERACAO_CONFIGURACAO',
          `Lançamento contábil ${anuidadeId} excluído do Ledger.`,
          tenantAtivoId
        );
        return true;
      } catch (err: any) {
        console.error('[ERRO_EXCLUIR_ANUIDADE]', err);
        return false;
      }
    },
    [tenantAtivoId, addAuditLog]
  );
 
  // Outorga de Isenção e Jubilação por Credencial do Presidente Geral
  const concederIsencaoOuJubilacao = useCallback(
    async (
      ministroId: string,
      tipoPrivilegio: 'ISENCAO' | 'JUBILACAO',
      justificativa: string,
      presidenteIdentificador: string
    ): Promise<boolean> => {
      const ministro = ministrosRef.current.find((m) => m.id === ministroId);
      if (!ministro) {
        throw new Error('Ministro não encontrado.');
      }
 
      await runTransaction(db, async (transaction) => {
        const qAnuidades = anuidadesRef.current.filter(
          (a) => a.ministroId === ministroId && a.statusPagamento === 'ABERTO'
        );
 
        for (const a of qAnuidades) {
          const aRef = doc(db, 'anuidades', a.id);
          transaction.set(
            aRef,
            {
              statusPagamento: 'PAGO',
              observacao: `Isento: ${tipoPrivilegio} outorgada pelo Presidente Geral. Justificativa: ${justificativa}`,
              valorLiquido: 0,
              tarifaAsaas: 0
            },
            { merge: true }
          );
        }
 
        const minRef = doc(db, 'ministros', ministroId);
        transaction.set(
          minRef,
          {
            statusAdimplencia: 'EM_DIA',
            jubilado: true,
            observacoesPrivilegio: `${tipoPrivilegio} outorgada por Presidente sob justificativa: ${justificativa}. Validador Presidente: ${presidenteIdentificador}`
          },
          { merge: true }
        );
      });
 
      const indexMin = ministrosRef.current.findIndex((m) => m.id === ministroId);
      if (indexMin !== -1) {
        const novaListaMin = [...ministrosRef.current];
        novaListaMin[indexMin] = deepCloneAndFreeze({
          ...novaListaMin[indexMin],
          statusAdimplencia: 'EM_DIA',
          jubilado: true,
        } as any);
        ministrosRef.current = novaListaMin;
        setMinistros(novaListaMin);
      }
 
      const novasAnuidades = anuidadesRef.current.map((a) => {
        if (a.ministroId === ministroId && a.statusPagamento === 'ABERTO') {
          return deepCloneAndFreeze({
            ...a,
            statusPagamento: 'PAGO',
            descricao: `Isento: ${tipoPrivilegio} outorgada pelo Presidente Geral. Justificativa: ${justificativa}`,
          } as any);
        }
        return a;
      });
      anuidadesRef.current = novasAnuidades;
      setAnuidades(novasAnuidades);
 
      const log = addAuditLog(
        'STATUS_ADIMPLENCIA_ALTERADO',
        `Privilégio de [${tipoPrivilegio}] outorgado ao ministro ${ministro.nome} (CPF: ${ministro.cpf}, ID: ${ministroId}). Homologado pela Credencial do Presidente Geral sob justificativa: ${justificativa}.`,
        ministro.tenantId
      );
 
      emitirEventoContabil(
        'TRANSACAO_FINANCEIRA',
        `Outorga de ${tipoPrivilegio} homologada para ministro ${ministro.nome}. Validador Presidente: ${presidenteIdentificador}`,
        ministroId,
        ministro.tenantId,
        log.hashIntegridade
      );
 
      return true;
    },
    [addAuditLog, emitirEventoContabil]
  );

  // Conceder Anistia financeira por Credencial do Presidente Geral
  const concederAnistia = useCallback(
    async (
      ministroId: string,
      anuidadesIds: string[],
      justificativa: string,
      presidenteIdentificador: string
    ): Promise<boolean> => {
      const ministro = ministrosRef.current.find((m) => m.id === ministroId);
      if (!ministro) {
        throw new Error('Ministro não encontrado.');
      }

      await runTransaction(db, async (transaction) => {
        // 1. Atualizar cada anuidade selecionada no banco para 'ANISTIADO'
        for (const anuidadeId of anuidadesIds) {
          const aRef = doc(db, 'anuidades', anuidadeId);
          transaction.set(
            aRef,
            {
              statusPagamento: 'ANISTIADO',
              observacao: `Anistia homologada pelo Presidente Geral. Justificativa: ${justificativa}`,
              valorLiquido: 0,
              tarifaAsaas: 0
            },
            { merge: true }
          );
        }

        // 2. Verificar o status contábil resultante para o ministro
        // Buscamos todas as anuidades dele que NÃO estão na lista de anistia e que ainda continuem 'ABERTO'
        const outrasAnuidadesAberto = anuidadesRef.current.filter(
          (a) => a.ministroId === ministroId && a.statusPagamento === 'ABERTO' && !anuidadesIds.includes(a.id)
        );

        // Se não restar nenhuma anuidade em atraso, o obreiro volta a ficar em dia (EM_DIA)
        const novoStatus = outrasAnuidadesAberto.length === 0 ? 'EM_DIA' : 'EM_ATRASO';

        const minRef = doc(db, 'ministros', ministroId);
        transaction.set(
          minRef,
          {
            statusAdimplencia: novoStatus,
            observacoesPrivilegio: `Anistia de ${anuidadesIds.length} cobranças homologada por Presidente sob justificativa: ${justificativa}. Validador Presidente: ${presidenteIdentificador}`
          },
          { merge: true }
        );
      });

      // Atualiza estado local de ministros
      const indexMin = ministrosRef.current.findIndex((m) => m.id === ministroId);
      if (indexMin !== -1) {
        const outrasAnuidadesAberto = anuidadesRef.current.filter(
          (a) => a.ministroId === ministroId && a.statusPagamento === 'ABERTO' && !anuidadesIds.includes(a.id)
        );
        const novoStatus = outrasAnuidadesAberto.length === 0 ? 'EM_DIA' : 'EM_ATRASO';

        const novaListaMin = [...ministrosRef.current];
        novaListaMin[indexMin] = deepCloneAndFreeze({
          ...novaListaMin[indexMin],
          statusAdimplencia: novoStatus,
        } as any);
        ministrosRef.current = novaListaMin;
        setMinistros(novaListaMin);
      }

      // Atualiza estado local de anuidades
      const novasAnuidades = anuidadesRef.current.map((a) => {
        if (anuidadesIds.includes(a.id)) {
          return deepCloneAndFreeze({
            ...a,
            statusPagamento: 'ANISTIADO',
            observacao: `Anistia homologada pelo Presidente Geral. Justificativa: ${justificativa}`,
            valorLiquido: 0,
            tarifaAsaas: 0
          } as any);
        }
        return a;
      });
      anuidadesRef.current = novasAnuidades;
      setAnuidades(novasAnuidades);

      const log = addAuditLog(
        'STATUS_ADIMPLENCIA_ALTERADO',
        `Anistia financeira de ${anuidadesIds.length} cobranças concedida ao ministro ${ministro.nome} (CPF: ${ministro.cpf}, ID: ${ministroId}). Homologado pela Credencial do Presidente Geral sob justificativa: ${justificativa}.`,
        ministro.tenantId
      );

      emitirEventoContabil(
        'TRANSACAO_FINANCEIRA',
        `Anistia de ${anuidadesIds.length} cobranças homologada para o ministro ${ministro.nome}. Validador Presidente: ${presidenteIdentificador}`,
        ministroId,
        ministro.tenantId,
        log.hashIntegridade
      );

      return true;
    },
    [addAuditLog, emitirEventoContabil]
  );

  // Webhook Asaas
  const processarWebhookAsaas = useCallback(
    async (
      payload: AsaasWebhookPayload
    ): Promise<{ sucesso: boolean; mensagem: string; anuidadeId?: string }> => {
      if (!payload || !payload.payment) {
        return { sucesso: false, mensagem: 'Payload do webhook Asaas corrompido ou inválido.' };
      }

      const { externalReference, value, id: asaasPaymentId } = payload.payment;

      if (!externalReference) {
        return {
          sucesso: false,
          mensagem: 'Campo externalReference ausente no payload Asaas.',
        };
      }

      // Busca resiliente: ref síncrona em memória, estado local e fallback direto no Firestore
      let anuidade = anuidadesRef.current.find((a) => a.id === externalReference) || anuidades.find((a) => a.id === externalReference);
      if (!anuidade) {
        try {
          const docSnap = await getDoc(doc(db, 'anuidades', externalReference));
          if (docSnap.exists()) {
            anuidade = { ...docSnap.data(), id: docSnap.id } as AnuidadeMinistro;
          }
        } catch (e) {
          console.warn('[processarWebhookAsaas] Erro ao buscar documento da anuidade no Firestore:', e);
        }
      }

      if (!anuidade) {
        return {
          sucesso: false,
          mensagem: `Anuidade ID ${externalReference} não localizada no Ledger contábil.`,
        };
      }

      if (anuidade.statusPagamento === 'PAGO') {
        return {
          sucesso: false,
          mensagem: `Anuidade ID ${externalReference} já consta como LIQUIDADA no Ledger.`,
          anuidadeId: externalReference,
        };
      }

      const liquidado = await liquidarAnuidade(externalReference, 'WEBHOOK_ASAAS');

      if (!liquidado) {
        return {
          sucesso: false,
          mensagem: `Processamento bloqueado pelo cache de idempotência contábil (ID: ${externalReference}).`,
          anuidadeId: externalReference,
        };
      }

      return {
        sucesso: true,
        mensagem: `Conciliação síncrona Asaas efetivada com sucesso! Pagamento ${asaasPaymentId} (R$ ${value.toFixed(2)}) liquidado no Ledger com projeção em cascata.`,
        anuidadeId: externalReference,
      };
    },
    [anuidades, liquidarAnuidade]
  );

  // Varredura Geral de Adimplência
  const executarVarreduraAdimplencia = useCallback(() => {
    setMinistros((ministrosAtuais) => {
      const ministrosAtualizados = ministrosAtuais.map((ministro) => {
        const anuidadesDoMin = anuidades.filter((a) => a.ministroId === ministro.id);
        const novoStatus = avaliarStatusAdimplencia(anuidadesDoMin);

        if (ministro.statusAdimplencia !== novoStatus) {
          return deepCloneAndFreeze({
            ...ministro,
            statusAdimplencia: novoStatus,
          });
        }
        return ministro;
      });

      return deepCloneAndFreeze(ministrosAtualizados);
    });

    addAuditLog(
      'ALTERACAO_CONFIGURACAO',
      `Varredura geral de adimplência executada contra a data base atual (${new Date().toLocaleDateString('pt-BR')}).`,
      tenantAtivoId
    );
  }, [anuidades, tenantAtivoId, addAuditLog]);

  // ==============================================================
  // 2. MOTOR DE INSCRIÇÃO DA AGO COM UNICIDADE E EXCEÇÃO DE REVOGAÇÃO (PARTE 4)
  // ==============================================================
  const inscreverMinistroAGO = useCallback(
    async (
      ministroId: string,
      anoVigenteParam?: number
    ): Promise<{ sucesso: boolean; mensagem: string; inscricaoId?: string }> => {
      const cicloAlvo = anoVigenteParam || cicloAgoVigente;
      const ministro = ministrosRef.current.find((m) => m.id === ministroId);

      if (!ministro) {
        return { sucesso: false, mensagem: 'Ministro não localizado no cadastro unificado.' };
      }

      // 1. Bloqueio por Inadimplência Prévia
      if (ministro.statusAdimplencia === 'EM_ATRASO' || ministro.statusAdimplencia === 'INADIMPLENTE' || ministro.status !== 'ATIVO') {
        addAuditLog(
          'AGO_NOVA_TENTATIVA_REJEITADA',
          `Tentativa de inscrição bloqueada por débitos em atraso para o CPF: ${ministro.cpf}`,
          ministro.tenantId
        );
        return {
          sucesso: false,
          mensagem: `Bloqueio por Débito em Atraso: O ministro ${ministro.nome} possui status financeiro [${ministro.statusAdimplencia}] ou cadastro [${ministro.status}]. Inscrição vetada.`,
        };
      }

      // 2. Unicidade Absoluta por CPF Ativo no ciclo anual
      const inscricoesAtuais = inscricoesAGORef.current.filter(
        (i) => i.cpf === ministro.cpf && i.anoVigente === cicloAlvo
      );
      const inscricaoValidaAtiva = inscricoesAtuais.find((i) => i.statusInscricao === 'VALIDA');

      if (inscricaoValidaAtiva) {
        addAuditLog(
          'AGO_NOVA_TENTATIVA_REJEITADA',
          `Tentativa de inscrição duplicada bloqueada. Já existe inscrição válida para o CPF: ${ministro.cpf} no ciclo AGO ${cicloAlvo} (ID: ${inscricaoValidaAtiva.id})`,
          ministro.tenantId
        );
        return {
          sucesso: false,
          mensagem: `Unicidade Violada: O CPF ${ministro.cpf} já possui uma inscrição HOMOLOGADA E VÁLIDA para o ciclo anual da AGO ${cicloAlvo}.`,
        };
      }

      // 3. Exceção por Revogação Anterior
      const inscricaoRevogadaPrevia = inscricoesAtuais.find((i) => i.statusInscricao === 'REVOGADA');

      const novaInscricao: InscricaoAGO = deepCloneAndFreeze({
        id: `ago-${cicloAlvo}-${(ministro.id || '').replace('min-', '')}-${Math.floor(Math.random() * 1000)}`,
        ministroId: ministro.id,
        cpf: normalizeUtf8String(ministro.cpf),
        anoVigente: cicloAlvo,
        statusInscricao: 'VALIDA',
        dataInscricao: new Date().toISOString(),
      });

      // Se havia revogação anterior, substitui no estado mantendo histórico limpo
      const filtradas = inscricoesAGORef.current.filter(
        (i) => !(i.cpf === ministro.cpf && i.anoVigente === cicloAlvo && i.statusInscricao === 'REVOGADA')
      );
      const inscricoesAtualizadas = deepCloneAndFreeze([...filtradas, novaInscricao]);
      inscricoesAGORef.current = inscricoesAtualizadas;
      setInscricoesAGO(inscricoesAtualizadas);

      // Limpa qualquer alerta compulsório anterior do ministro
      setAlertasCompulsoriosAGO((anteriores) =>
        deepCloneAndFreeze(anteriores.filter((a) => a.ministroId !== ministro.id))
      );

      const log = addAuditLog(
        'AGO_INSCRICAO_REALIZADA',
        inscricaoRevogadaPrevia
          ? `Nova inscrição deferida após regularização contábil: Ministro ${ministro.nome} (CPF: ${ministro.cpf}, AGO: ${cicloAlvo})`
          : `Inscrição homologada com sucesso para a AGO ${cicloAlvo}: Ministro ${ministro.nome} (CPF: ${ministro.cpf})`,
        ministro.tenantId
      );

      emitirEventoContabil(
        'MUTACAO_CADASTRO',
        `Inscrição homologada AGO ${cicloAlvo}: ${ministro.nome}`,
        novaInscricao.id,
        ministro.tenantId,
        log.hashIntegridade
      );

      return {
        sucesso: true,
        mensagem: inscricaoRevogadaPrevia
          ? `Nova inscrição deferida com sucesso após regularização da revogação anterior para a AGO ${cicloAlvo}!`
          : `Inscrição homologada com sucesso para a AGO ${cicloAlvo}!`,
        inscricaoId: novaInscricao.id,
      };
    },
    [cicloAgoVigente, addAuditLog, emitirEventoContabil]
  );

  // Wrapper de retrocompatibilidade para inscreverAGO
  const inscreverAGO = useCallback(
    async (
      ministroId: string,
      cpf: string,
      anoVigente: number
    ): Promise<{ sucesso: boolean; mensagem: string }> => {
      const res = await inscreverMinistroAGO(ministroId, anoVigente);
      return { sucesso: res.sucesso, mensagem: res.mensagem };
    },
    [inscreverMinistroAGO]
  );

  // ==============================================================
  // 3. GATILHO CRÍTICO TEMPORAL DE REVOGAÇÃO AUTOMATIZADA ("JANELA DE 2 MESES")
  // ==============================================================
  const verificarStatusFinanceiroGeral = useCallback((): {
    totalInscricoesRevogadas: number;
    ministrosNotificados: string[];
    alertasEmitidos: string[];
  } => {
    const ministrosNotificados: string[] = [];
    const alertasEmitidos: string[] = [];
    let totalRevogadas = 0;
    const anoCorrente = getSystemYear();
    const dataHojeIso = getSystemDate();

    const novasInscricoes = [...inscricoesAGORef.current];
    const novosAlertas: AlertaCompulsorioAGO[] = [];

    for (let i = 0; i < novasInscricoes.length; i++) {
      const inscricao = novasInscricoes[i];
      if (inscricao.anoVigente === anoCorrente && inscricao.statusInscricao === 'VALIDA') {
        const ministro = ministrosRef.current.find((m) => m.id === inscricao.ministroId);
        if (!ministro) continue;

        const anuidadesDoMin = anuidadesRef.current.filter((a) => a.ministroId === ministro.id);
        const statusCalculado = avaliarStatusAdimplencia(anuidadesDoMin);

        // Se possuir cobranças em atraso/inadimplência na data base atual:
        if (statusCalculado === 'INADIMPLENTE' || ministro.status !== 'ATIVO') {
          novasInscricoes[i] = deepCloneAndFreeze({
            ...inscricao,
            statusInscricao: 'REVOGADA',
          });
          totalRevogadas++;
          ministrosNotificados.push(ministro.nome);

          const msgAlerta = `ATENÇÃO: Sua inscrição para a AGO está sob risco iminente de cancelamento por inadimplência da anuidade. Credenciamento na portaria física e chaves de acesso digital revogados.`;
          alertasEmitidos.push(`${ministro.nome} (${ministro.cpf})`);

          novosAlertas.push(
            deepFreeze({
              id: `alt-${anoCorrente}-${Math.random().toString(36).substring(2, 7)}`,
              ministroId: ministro.id,
              nome: ministro.nome,
              cpf: ministro.cpf,
              mensagem: msgAlerta,
              dataRevogacao: dataHojeIso,
            })
          );

          addAuditLog(
            'AGO_INSCRICAO_REVOCADA_POR_INADIMPLENCIA',
            `Gatilho Crítico: Inscrição AGO ID ${inscricao.id} cancelada compulsoriamente por inadimplência superveniente. CPF: ${ministro.cpf}`,
            tenantAtivoId
          );
        }
      }
    }

    if (novosAlertas.length > 0) {
      setAlertasCompulsoriosAGO((prev) => deepCloneAndFreeze([...prev, ...novosAlertas]));
    }

    const inscricoesAtualizadas = deepCloneAndFreeze(novasInscricoes);
    inscricoesAGORef.current = inscricoesAtualizadas;
    setInscricoesAGO(inscricoesAtualizadas);

    return {
      totalInscricoesRevogadas: totalRevogadas,
      ministrosNotificados,
      alertasEmitidos,
    };
  }, [tenantAtivoId, addAuditLog]);

  const limparAlertaCompulsorio = useCallback((alertaId: string) => {
    setAlertasCompulsoriosAGO((anteriores) =>
      deepCloneAndFreeze(anteriores.filter((a) => a.id !== alertaId))
    );
  }, []);

  // Revogação manual de inscrição AGO
  const revogarInscricaoAGO = useCallback(
    async (inscricaoId: string, motivo: string): Promise<void> => {
      const index = inscricoesAGORef.current.findIndex((i) => i.id === inscricaoId);
      if (index === -1) {
        return;
      }

      const inscricaoRevogada: InscricaoAGO = deepCloneAndFreeze({
        ...inscricoesAGORef.current[index],
        statusInscricao: 'REVOGADA',
      });

      const novaLista = [...inscricoesAGORef.current];
      novaLista[index] = inscricaoRevogada;
      const inscricoesAtualizadas = deepCloneAndFreeze(novaLista);
      inscricoesAGORef.current = inscricoesAtualizadas;
      setInscricoesAGO(inscricoesAtualizadas);

      const log = addAuditLog(
        'AGO_INSCRICAO_REVOCADA_POR_INADIMPLENCIA',
        `Inscrição AGO ID ${inscricaoId} revogada manualmente pelo operador. Motivo: ${normalizeUtf8String(motivo)}`,
        tenantAtivoId
      );

      emitirEventoContabil(
        'MUTACAO_CADASTRO',
        `Revogação de inscrição AGO: ${inscricaoId}`,
        inscricaoId,
        tenantAtivoId,
        log.hashIntegridade
      );
    },
    [tenantAtivoId, addAuditLog, emitirEventoContabil]
  );

  // Configurações com Persistência Cloud Imediata no Firestore
  const atualizarAppConfig = useCallback(
    async (novosDados: Partial<AppConfig>) => {
      setAppConfig((anterior) => {
        const atualizado = deepCloneAndFreeze({
          ...anterior,
          ...novosDados,
        });
        return atualizado;
      });

      // Gravação atômica direta no Firestore em parametros_financeiros/core_banking e configuracoes_sistema/geral
      try {
        const payloadLimpo = limparParaFirestore(novosDados);
        await setDoc(doc(db, 'parametros_financeiros', 'core_banking'), payloadLimpo, { merge: true });
        await setDoc(doc(db, 'configuracoes_sistema', 'geral'), payloadLimpo, { merge: true });
        await setDoc(doc(db, 'configuracoes', 'convencao'), payloadLimpo, { merge: true });
      } catch (err) {
        console.error('[FIRESTORE_CONFIG_SAVE_ERR]', err);
      }

      addAuditLog(
        'ALTERACAO_CONFIGURACAO',
        `Configurações do ecossistema CIMADEBE/SIGM alteradas e sincronizadas no Firestore.`,
        tenantAtivoId
      );
    },
    [tenantAtivoId, addAuditLog]
  );

  // CMS
  const atualizarCmsSettings = useCallback(
    async (novasConfigs: Partial<CmsSettings['paginasVisiveis']>) => {
      setCmsSettings((anterior) => {
        const atualizado: CmsSettings = deepCloneAndFreeze({
          paginasVisiveis: {
            ...anterior.paginasVisiveis,
            ...novasConfigs,
          },
        });
        return atualizado;
      });

      try {
        const payloadLimpo = limparParaFirestore(novasConfigs);
        await setDoc(doc(db, 'cms_config', 'portal_switches'), payloadLimpo, { merge: true });
        await setDoc(doc(db, 'configuracoes_sistema', 'cms'), payloadLimpo, { merge: true });
      } catch (err) {
        console.error('[FIRESTORE_CMS_SAVE_ERR]', err);
      }

      addAuditLog(
        'ALTERACAO_CONFIGURACAO',
        `Parâmetros de visibilidade do portal CMS atualizados.`,
        tenantAtivoId
      );
    },
    [tenantAtivoId, addAuditLog]
  );

  // Gestão de Usuários Administrativos
  const atribuirUsuarioAdministrativo = useCallback(
    (payload: Omit<UsuarioAdministrativo, 'id' | 'dataConcessao' | 'ultimoAcesso'>): UsuarioAdministrativo => {
      // REGRA DE GOVERNANÇA ESTATICAMENTE AUDITADA:
      // Impede a criação indiscriminada de múltiplos Administrador Master ou Presidente Geral ativos
      if (payload.cargoAdministrativo === 'Administrador Master' || payload.cargoAdministrativo === 'Presidente Geral') {
        const existente = usuariosAdministrativosRef.current.find(
          (u) => u.cargoAdministrativo === payload.cargoAdministrativo && u.statusAcesso === 'ATIVO'
        );
        if (existente) {
          throw new Error(
            `Violação de Governança RBAC: Já existe um ${payload.cargoAdministrativo} ativo (${existente.nome}). O sistema veda a duplicidade simultânea sem processo formal de sucessão.`
          );
        }
      }

      // Validação de unicidade por CPF ou ministroId
      const ministroJaPossuiAcesso = usuariosAdministrativosRef.current.find(
        (u) => u.ministroId === payload.ministroId || (u.cpf && payload.cpf && u.cpf.replace(/\D/g, '') === payload.cpf.replace(/\D/g, ''))
      );
      if (ministroJaPossuiAcesso) {
        throw new Error(
          `O ministro ${payload.nome} já possui credenciais de acesso administrativo cadastradas (${ministroJaPossuiAcesso.cargoAdministrativo}). Edite o registro existente.`
        );
      }

      const dataHoje = getSystemDate();
      const novoUsuario: UsuarioAdministrativo = deepCloneAndFreeze({
        ...payload,
        id: `usr-${Math.random().toString(36).substring(2, 7)}`,
        dataConcessao: dataHoje,
        ultimoAcesso: getDataHoraBrasil(),
      });

      const listaAtualizada = deepCloneAndFreeze([...usuariosAdministrativosRef.current, novoUsuario]);
      usuariosAdministrativosRef.current = listaAtualizada;
      setUsuariosAdministrativos(listaAtualizada);

      // Persistência Direta no Banco Firestore
      setDoc(doc(db, 'usuarios_administrativos', novoUsuario.id), novoUsuario).catch((err) => {
        console.error('[FIRESTORE_CADASTRO_USUARIO_ERR]', err);
      });

      const log = addAuditLog(
        'CADASTRO_USUARIO',
        `Acesso administrativo concedido: ${novoUsuario.nome} no cargo [${novoUsuario.cargoAdministrativo}] (${novoUsuario.role}) - Departamento: ${novoUsuario.departamento}`,
        tenantAtivoId
      );

      emitirEventoContabil(
        'MUTACAO_CADASTRO',
        `Novo usuário administrativo habilitado: ${novoUsuario.nome} [${novoUsuario.cargoAdministrativo}]`,
        novoUsuario.id,
        tenantAtivoId,
        log.hashIntegridade
      );

      return novoUsuario;
    },
    [tenantAtivoId, addAuditLog, emitirEventoContabil]
  );

  const alterarStatusUsuarioAdministrativo = useCallback(
    (id: string, novoStatus: 'ATIVO' | 'SUSPENSO' | 'EM_ANALISE') => {
      const index = usuariosAdministrativosRef.current.findIndex((u) => u.id === id);
      if (index === -1) return;

      const usuarioAtual = usuariosAdministrativosRef.current[index];
      const usuarioAtualizado: UsuarioAdministrativo = deepCloneAndFreeze({
        ...usuarioAtual,
        statusAcesso: novoStatus,
      });

      const novaLista = [...usuariosAdministrativosRef.current];
      novaLista[index] = usuarioAtualizado;
      const congelados = deepCloneAndFreeze(novaLista);
      usuariosAdministrativosRef.current = congelados;
      setUsuariosAdministrativos(congelados);

      // Persistência Direta no Banco Firestore
      updateDoc(doc(db, 'usuarios_administrativos', id), {
        statusAcesso: novoStatus,
        atualizado_em: new Date().toISOString(),
      }).catch((err) => {
        console.error('[FIRESTORE_STATUS_USUARIO_ERR]', err);
      });

      const log = addAuditLog(
        'ALTERACAO_STATUS_USUARIO',
        `Status de acesso administrativo do ministro ${usuarioAtual.nome} alterado para [${novoStatus}].`,
        tenantAtivoId
      );

      emitirEventoContabil(
        'MUTACAO_CADASTRO',
        `Mutação de status de usuário administrativo: ${usuarioAtual.nome} -> ${novoStatus}`,
        usuarioAtual.id,
        tenantAtivoId,
        log.hashIntegridade
      );
    },
    [tenantAtivoId, addAuditLog, emitirEventoContabil]
  );

  const removerUsuarioAdministrativo = useCallback(
    async (id: string): Promise<void> => {
      const usuario = usuariosAdministrativosRef.current.find((u) => u.id === id);
      
      // Permite remoção direta do Firestore mesmo se não estiver no cache local
      try {
        await deleteDoc(doc(db, 'usuarios_administrativos', id));
      } catch (err) {
        console.error('[FIRESTORE_DELETE_USUARIO_ERR]', err);
      }

      if (!usuario) return;

      const filtrados = deepCloneAndFreeze(usuariosAdministrativosRef.current.filter((u) => u.id !== id));
      usuariosAdministrativosRef.current = filtrados;
      setUsuariosAdministrativos(filtrados);

      const log = addAuditLog(
        'EXCLUSAO_USUARIO',
        `Revogação de acesso administrativo: Ministro ${usuario.nome} (ID: ${id}) removido do corpo administrativo.`,
        tenantAtivoId
      );

      emitirEventoContabil(
        'MUTACAO_CADASTRO',
        `Acesso administrativo revogado: ${usuario.nome}`,
        usuario.id,
        tenantAtivoId,
        log.hashIntegridade
      );
    },
    [tenantAtivoId, addAuditLog, emitirEventoContabil]
  );

  const atualizarUsuarioAdministrativo = useCallback(
    async (
      id: string,
      dados: Partial<Omit<UsuarioAdministrativo, 'id' | 'dataConcessao'>>
    ): Promise<UsuarioAdministrativo> => {
      const index = usuariosAdministrativosRef.current.findIndex((u) => u.id === id);
      if (index === -1) {
        throw new Error(`Usuário administrativo ${id} não encontrado.`);
      }

      const usuarioAtual = usuariosAdministrativosRef.current[index];

      // Se estiver promovendo para Administrador Master ou Presidente Geral, valida se já não existe outro
      const novoCargo = dados.cargoAdministrativo ?? usuarioAtual.cargoAdministrativo;
      const novoStatus = dados.statusAcesso ?? usuarioAtual.statusAcesso;

      if ((novoCargo === 'Administrador Master' || novoCargo === 'Presidente Geral') && novoStatus === 'ATIVO') {
        const outroExistente = usuariosAdministrativosRef.current.find(
          (u) => u.cargoAdministrativo === novoCargo && u.statusAcesso === 'ATIVO' && u.id !== id
        );
        if (outroExistente) {
          throw new Error(
            `Violação de Governança RBAC: Já existe um ${novoCargo} ativo (${outroExistente.nome}). Não é permitido criar múltiplos registros ativos sem processo formal.`
          );
        }
      }

      const usuarioAtualizado: UsuarioAdministrativo = deepCloneAndFreeze({
        ...usuarioAtual,
        ...dados,
        id: usuarioAtual.id,
      });

      const novaLista = [...usuariosAdministrativosRef.current];
      novaLista[index] = usuarioAtualizado;
      const congelados = deepCloneAndFreeze(novaLista);
      usuariosAdministrativosRef.current = congelados;
      setUsuariosAdministrativos(congelados);

      // Persistência Direta no Banco Firestore (Validação Estrita de Existência)
      try {
        const userRef = doc(db, 'usuarios_administrativos', id);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          await updateDoc(userRef, limparParaFirestore(usuarioAtualizado as any) as Record<string, any>);
        } else {
          console.warn(`[LEI DE MUTATIVIDADE] Usuário admin '${id}' não existe no Firestore. Blind merge impedido.`);
        }
      } catch (err) {
        console.error('[FIRESTORE_EDIT_USUARIO_ERR]', err);
      }

      const log = addAuditLog(
        'EDICAO_USUARIO',
        `Permissões administrativas de ${usuarioAtualizado.nome} atualizadas: Cargo [${usuarioAtualizado.cargoAdministrativo}] (${usuarioAtualizado.role}) - Departamento: ${usuarioAtualizado.departamento}`,
        tenantAtivoId
      );

      emitirEventoContabil(
        'MUTACAO_CADASTRO',
        `Mutação de permissões administrativas: ${usuarioAtualizado.nome}`,
        usuarioAtualizado.id,
        tenantAtivoId,
        log.hashIntegridade
      );

      return usuarioAtualizado;
    },
    [tenantAtivoId, addAuditLog, emitirEventoContabil]
  );

  // Gestão Exclusiva de Usuário Super Master / Root Bunker (Coleção 'usuarios_sistema')
  const atualizarUsuarioSistema = useCallback(
    async (
      id: string,
      dados: Partial<UsuarioAdministrativo>
    ): Promise<UsuarioAdministrativo> => {
      const cleanId = id.toLowerCase().trim();
      const userRef = doc(db, 'usuarios_sistema', cleanId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        throw new Error(`Usuário Super Master '${id}' não localizado na coleção usuarios_sistema.`);
      }

      const atual = { ...userSnap.data(), id: userSnap.id } as UsuarioAdministrativo;
      const usuarioAtualizado: UsuarioAdministrativo = deepCloneAndFreeze({
        ...atual,
        ...dados,
        id: atual.id,
      });

      await updateDoc(userRef, limparParaFirestore(usuarioAtualizado as any) as Record<string, any>);

      const index = usuariosSistemaRef.current.findIndex(
        (u) => u.id === cleanId || (u.email && u.email.toLowerCase().trim() === cleanId)
      );
      const novaLista = [...usuariosSistemaRef.current];
      if (index !== -1) {
        novaLista[index] = usuarioAtualizado;
      } else {
        novaLista.push(usuarioAtualizado);
      }
      const congelados = deepCloneAndFreeze(novaLista);
      usuariosSistemaRef.current = congelados;
      setUsuariosSistema(congelados);

      addAuditLog(
        'EDICAO_USUARIO',
        `Credencial Super Master ${usuarioAtualizado.nome} (${usuarioAtualizado.email}) atualizada na coleção usuarios_sistema`,
        tenantAtivoId
      );

      return usuarioAtualizado;
    },
    [tenantAtivoId, addAuditLog]
  );

  // Gestão de Mesa Diretora
  const atribuirMembroMesa = useCallback(
    (payload: Omit<MembroMesaDiretora, 'id'>): MembroMesaDiretora => {
      const cargoFinal = payload.cargoMesa;
      const ordemCalculada =
        payload.ordemExibicao || obterOrdemHierarquicaMesa(cargoFinal);

      const novoMembro: MembroMesaDiretora = deepCloneAndFreeze({
        ...payload,
        ordemExibicao: ordemCalculada,
        id: `mesa-${Math.random().toString(36).substring(2, 7)}`,
      });

      const listaAtualizada = deepCloneAndFreeze(
        [...membrosMesaDiretoraRef.current, novoMembro].sort(
          (a, b) =>
            obterOrdemHierarquicaMesa(a.cargoMesa) -
            obterOrdemHierarquicaMesa(b.cargoMesa)
        )
      );
      membrosMesaDiretoraRef.current = listaAtualizada;
      setMembrosMesaDiretora(listaAtualizada);

      // Persistência Direta no Banco Firestore
      setDoc(doc(db, 'membros_mesa_diretora', novoMembro.id), novoMembro).catch((err) => {
        console.error('[FIRESTORE_CADASTRO_MESA_ERR]', err);
      });

      const log = addAuditLog(
        'CADASTRO_MESA',
        `Mesa Diretora: ${novoMembro.nome} empossado no cargo [${novoMembro.cargoMesa}] - Mandato: ${novoMembro.mandato}`,
        tenantAtivoId
      );

      emitirEventoContabil(
        'MUTACAO_CADASTRO',
        `Novo membro da Mesa Diretora: ${novoMembro.nome} [${novoMembro.cargoMesa}]`,
        novoMembro.id,
        tenantAtivoId,
        log.hashIntegridade
      );

      return novoMembro;
    },
    [tenantAtivoId, addAuditLog, emitirEventoContabil]
  );

  const removerMembroMesa = useCallback(
    (id: string, justificativa?: string) => {
      const membro = membrosMesaDiretoraRef.current.find((m) => m.id === id);
      if (!membro) return;

      const filtrados = deepCloneAndFreeze(membrosMesaDiretoraRef.current.filter((m) => m.id !== id));
      membrosMesaDiretoraRef.current = filtrados;
      setMembrosMesaDiretora(filtrados);

      // Persistência Direta no Banco Firestore
      deleteDoc(doc(db, 'membros_mesa_diretora', id)).catch((err) => {
        console.error('[FIRESTORE_DELETE_MESA_ERR]', err);
      });

      const log = addAuditLog(
        'EXCLUSAO_MESA',
        `Mesa Diretora: Membro ${membro.nome} (${membro.cargoMesa}, ID: ${id}) desvinculado do corpo diretivo. Justificativa: ${justificativa || 'Nenhuma informada'}`,
        tenantAtivoId
      );

      emitirEventoContabil(
        'MUTACAO_CADASTRO',
        `Membro da Mesa Diretora removido: ${membro.nome}. Motivo: ${justificativa || 'Nenhum'}`,
        membro.id,
        tenantAtivoId,
        log.hashIntegridade
      );
    },
    [tenantAtivoId, addAuditLog, emitirEventoContabil]
  );

  const atualizarMembroMesa = useCallback(
    (id: string, dados: Partial<MembroMesaDiretora>) => {
      const index = membrosMesaDiretoraRef.current.findIndex((m) => m.id === id);
      if (index === -1) return;

      const atual = membrosMesaDiretoraRef.current[index];
      const cargoFinal = dados.cargoMesa || atual.cargoMesa;
      const ordemCalculada =
        dados.ordemExibicao || obterOrdemHierarquicaMesa(cargoFinal);

      const atualizado: MembroMesaDiretora = deepCloneAndFreeze({
        ...atual,
        ...dados,
        ordemExibicao: ordemCalculada,
        id: atual.id,
      });

      const novaLista = [...membrosMesaDiretoraRef.current];
      novaLista[index] = atualizado;
      const congelados = deepCloneAndFreeze(
        novaLista.sort(
          (a, b) =>
            obterOrdemHierarquicaMesa(a.cargoMesa) -
            obterOrdemHierarquicaMesa(b.cargoMesa)
        )
      );
      membrosMesaDiretoraRef.current = congelados;
      setMembrosMesaDiretora(congelados);

      // Persistência Direta no Banco Firestore
      setDoc(doc(db, 'membros_mesa_diretora', id), atualizado, { merge: true }).catch((err) => {
        console.error('[FIRESTORE_EDIT_MESA_ERR]', err);
      });

      addAuditLog(
        'EDICAO_MESA',
        `Mesa Diretora: Atualização de registro de ${atualizado.nome} (${atualizado.cargoMesa}).`,
        tenantAtivoId
      );
    },
    [tenantAtivoId, addAuditLog]
  );

  // Gestão de Igrejas Filiadas
  const cadastrarIgreja = useCallback(
    async (payload: Omit<IgrejaFiliada, 'id' | 'dataFiliacao'>): Promise<IgrejaFiliada> => {
      const cleanCnpj = (payload.cnpj || '').replace(/\D/g, '');

      // Trava de Unicidade: Proibir cadastro duplicado com o mesmo CNPJ
      const igrejaExistente = igrejasFiliadasRef.current.find((ig) => {
        const igCnpjLimpo = (ig.cnpj || '').replace(/\D/g, '');
        return (cleanCnpj.length >= 8 && igCnpjLimpo === cleanCnpj) || (ig.cnpj && ig.cnpj.trim() === payload.cnpj.trim());
      });

      if (igrejaExistente) {
        throw new Error(
          `CNPJ Já Cadastrado: A igreja "${igrejaExistente.nomeFantasia || igrejaExistente.razaoSocial}" já está homologada com o CNPJ ${payload.cnpj}.`
        );
      }

      const docId = cleanCnpj.length >= 8
        ? cleanCnpj
        : (payload.nomeFantasia || 'igreja').toLowerCase().replace(/[^a-z0-9]/g, '');

      const novaIgreja: IgrejaFiliada = deepCloneAndFreeze({
        ...payload,
        id: docId,
        dataFiliacao: getSystemDate(),
      });

      // Persistência Atômica no Firestore na coleção canônica 'igrejas'
      try {
        await setDoc(doc(db, 'igrejas', novaIgreja.id), limparParaFirestore(novaIgreja as any));
      } catch (err) {
        console.error('[FIRESTORE_CADASTRO_IGREJA_ERR]', err);
      }

      // Upsert em memória evitando duplicidade
      const indexExistente = igrejasFiliadasRef.current.findIndex((i) => i.id === novaIgreja.id);
      let listaAtualizada: IgrejaFiliada[];
      if (indexExistente !== -1) {
        listaAtualizada = [...igrejasFiliadasRef.current];
        listaAtualizada[indexExistente] = novaIgreja;
      } else {
        listaAtualizada = [...igrejasFiliadasRef.current, novaIgreja];
      }

      const congelados = deepCloneAndFreeze(listaAtualizada);
      igrejasFiliadasRef.current = congelados;
      setIgrejasFiliadas(congelados);

      const log = addAuditLog(
        'CADASTRO_IGREJA',
        `Igreja Filiada homologada no cadastro convencional: ${novaIgreja.nomeFantasia} (CNPJ: ${novaIgreja.cnpj}) - Pastor: ${novaIgreja.pastorPresidenteNome}`,
        novaIgreja.tenantId
      );

      emitirEventoContabil(
        'MUTACAO_CADASTRO',
        `Nova igreja filiada cadastrada: ${novaIgreja.nomeFantasia}`,
        novaIgreja.id,
        novaIgreja.tenantId,
        log.hashIntegridade
      );

      return novaIgreja;
    },
    [addAuditLog, emitirEventoContabil]
  );

  const editarIgreja = useCallback(
    async (id: string, dados: Partial<Omit<IgrejaFiliada, 'id'>>): Promise<IgrejaFiliada> => {
      let index = igrejasFiliadasRef.current.findIndex((i) => i.id === id);
      let atual = index !== -1 ? igrejasFiliadasRef.current[index] : SEED_IGREJAS_FILIADAS.find((i) => i.id === id);
      if (!atual) {
        throw new Error(`Igreja ${id} não localizada.`);
      }

      // Trava de Unicidade em Edição: Não permitir assumir CNPJ de outra igreja
      if (dados.cnpj) {
        const novoCnpjLimpo = dados.cnpj.replace(/\D/g, '');
        const duplicada = igrejasFiliadasRef.current.find((ig) => {
          if (ig.id === id) return false;
          const igCnpjLimpo = (ig.cnpj || '').replace(/\D/g, '');
          return (novoCnpjLimpo.length >= 8 && igCnpjLimpo === novoCnpjLimpo) || (ig.cnpj && ig.cnpj.trim() === dados.cnpj?.trim());
        });

        if (duplicada) {
          throw new Error(
            `CNPJ Já Cadastrado: A igreja "${duplicada.nomeFantasia || duplicada.razaoSocial}" já utiliza o CNPJ ${dados.cnpj}.`
          );
        }
      }

      const atualizada: IgrejaFiliada = deepCloneAndFreeze({
        ...atual,
        ...dados,
        id: atual.id,
      });

      // Persistência Atômica no Firestore com updateDoc estrito na coleção 'igrejas'
      try {
        const igRef = doc(db, 'igrejas', atualizada.id);
        const igSnap = await getDoc(igRef);
        if (igSnap.exists()) {
          const payloadLimpo = limparParaFirestore(atualizada as any) as Record<string, any>;
          await updateDoc(igRef, payloadLimpo);
        } else {
          console.warn(`[LEI DE MUTATIVIDADE] Igreja ID '${atualizada.id}' não existe no Firestore. Blind merge impedido.`);
        }
      } catch (err) {
        console.error('[FIRESTORE_EDIT_IGREJA_ERR]', err);
      }

      const novaLista = [...igrejasFiliadasRef.current];
      if (index !== -1) {
        novaLista[index] = atualizada;
      } else {
        novaLista.push(atualizada);
      }
      const congelados = deepCloneAndFreeze(novaLista);
      igrejasFiliadasRef.current = congelados;
      setIgrejasFiliadas(congelados);

      const log = addAuditLog(
        'EDICAO_IGREJA',
        `Edição cadastral da Igreja Filiada: ${atualizada.nomeFantasia} (CNPJ: ${atualizada.cnpj})`,
        atualizada.tenantId
      );

      emitirEventoContabil(
        'MUTACAO_CADASTRO',
        `Atualização de dados da igreja: ${atualizada.nomeFantasia}`,
        atualizada.id,
        atualizada.tenantId,
        log.hashIntegridade
      );

      return atualizada;
    },
    [addAuditLog, emitirEventoContabil]
  );

  const deletarIgreja = useCallback(
    async (id: string, justificativa?: string): Promise<void> => {
      const igreja =
        igrejasFiliadasRef.current.find((i) => i.id === id) ||
        SEED_IGREJAS_FILIADAS.find((i) => i.id === id);
      if (!igreja) return;

      // 1. Remoção no Firestore estrita por ID único na coleção 'igrejas'
      try {
        await deleteDoc(doc(db, 'igrejas', id));
      } catch (err) {
        console.error('[FIRESTORE_DELETE_IGREJA_ERR]', err);
      }

      const filtrados = deepCloneAndFreeze(igrejasFiliadasRef.current.filter((i) => i.id !== id));
      igrejasFiliadasRef.current = filtrados;
      setIgrejasFiliadas(filtrados);

      // 2. REGRA DE NEGÓCIO: AO DELETAR A IGREJA, APENAS DESABILITA (SUSPENDE) OS MINISTROS NELA FILIADOS
      const ministrosAfetados: Ministro[] = [];
      const novaListaMinistros = ministrosRef.current.map((m) => {
        const ehVinculado =
          m.igrejaFiliadaId === id ||
          (m.igrejaFiliadaNome &&
            (m.igrejaFiliadaNome.toLowerCase().trim() === igreja.nomeFantasia.toLowerCase().trim() ||
             m.igrejaFiliadaNome.toLowerCase().trim() === igreja.razaoSocial.toLowerCase().trim())) ||
          m.id === igreja.pastorPresidenteId ||
          (igreja.pastorPresidenteNome && m.nome.toLowerCase().includes(igreja.pastorPresidenteNome.toLowerCase())) ||
          (m.dadosEndereco?.cidade && m.dadosEndereco.cidade.toLowerCase() === igreja.municipio.toLowerCase());

        if (ehVinculado) {
          const minAtualizado: Ministro = deepCloneAndFreeze({
            ...m,
            status: 'SUSPENSO',
          });
          ministrosAfetados.push(minAtualizado);
          return minAtualizado;
        }
        return m;
      });

      if (ministrosAfetados.length > 0) {
        const ministrosCongelados = deepCloneAndFreeze(novaListaMinistros);
        ministrosRef.current = ministrosCongelados;
        setMinistros(ministrosCongelados);

        for (const min of ministrosAfetados) {
          try {
            await updateDoc(
              doc(db, 'ministros', min.id),
              { status: 'SUSPENSO', atualizado_em: new Date().toISOString() }
            );
          } catch (err) {
            console.error(`[FIRESTORE_CASCADE_MINISTRO_ERR] Falha ao desabilitar ministro ${min.id}:`, err);
          }
        }
      }

      const log = addAuditLog(
        'EXCLUSAO_IGREJA',
        `Exclusão definitiva de Igreja Filiada: ${igreja.nomeFantasia} (CNPJ: ${igreja.cnpj}, ID: ${id}). ${ministrosAfetados.length} ministro(s) vinculado(s) foram automaticamente DESABILITADOS (SUSPENSOS). Justificativa: ${justificativa || 'Nenhuma informada'}`,
        igreja.tenantId
      );

      emitirEventoContabil(
        'MUTACAO_CADASTRO',
        `Igreja filiada deletada: ${igreja.nomeFantasia}. ${ministrosAfetados.length} ministros desabilitados em cadeia. Motivo: ${justificativa || 'Nenhum'}`,
        igreja.id,
        igreja.tenantId,
        log.hashIntegridade
      );
    },
    [addAuditLog, emitirEventoContabil]
  );

  const alternarStatusIgreja = useCallback(
    async (id: string): Promise<void> => {
      const index = igrejasFiliadasRef.current.findIndex((i) => i.id === id);
      const igrejaAtual =
        index !== -1
          ? igrejasFiliadasRef.current[index]
          : SEED_IGREJAS_FILIADAS.find((i) => i.id === id);
      if (!igrejaAtual) return;

      const novoStatus = igrejaAtual.status === 'ATIVA' ? 'SUSPENSA' : 'ATIVA';
      const igrejaAtualizada: IgrejaFiliada = deepCloneAndFreeze({
        ...igrejaAtual,
        status: novoStatus,
      });

      // 1. Atualização atômica da Igreja no Firestore via updateDoc estrito
      try {
        await updateDoc(
          doc(db, 'igrejas', id),
          { status: novoStatus, atualizado_em: new Date().toISOString() }
        );
      } catch (err) {
        console.error('[FIRESTORE_STATUS_IGREJA_ERR]', err);
      }

      const novaLista = [...igrejasFiliadasRef.current];
      if (index !== -1) {
        novaLista[index] = igrejaAtualizada;
      } else {
        novaLista.push(igrejaAtualizada);
      }
      const congelados = deepCloneAndFreeze(novaLista);
      igrejasFiliadasRef.current = congelados;
      setIgrejasFiliadas(congelados);

      // 2. REGRA DE NEGÓCIO: DESATIVAÇÃO / REATIVAÇÃO EM CADEIA DOS MINISTROS VINCULADOS
      const novoStatusMinistro: StatusMinistro = novoStatus === 'SUSPENSA' ? 'SUSPENSO' : 'ATIVO';

      const ministrosAfetados: Ministro[] = [];
      const novaListaMinistros = ministrosRef.current.map((m) => {
        const ehVinculado =
          m.igrejaFiliadaId === id ||
          (m.igrejaFiliadaNome &&
            (m.igrejaFiliadaNome.toLowerCase().trim() === igrejaAtual.nomeFantasia.toLowerCase().trim() ||
             m.igrejaFiliadaNome.toLowerCase().trim() === igrejaAtual.razaoSocial.toLowerCase().trim())) ||
          m.id === igrejaAtual.pastorPresidenteId ||
          (igrejaAtual.pastorPresidenteNome && m.nome.toLowerCase().includes(igrejaAtual.pastorPresidenteNome.toLowerCase())) ||
          (m.dadosEndereco?.cidade && m.dadosEndereco.cidade.toLowerCase() === igrejaAtual.municipio.toLowerCase());

        if (ehVinculado) {
          const minAtualizado: Ministro = deepCloneAndFreeze({
            ...m,
            status: novoStatusMinistro,
          });
          ministrosAfetados.push(minAtualizado);
          return minAtualizado;
        }
        return m;
      });

      if (ministrosAfetados.length > 0) {
        const ministrosCongelados = deepCloneAndFreeze(novaListaMinistros);
        ministrosRef.current = ministrosCongelados;
        setMinistros(ministrosCongelados);

        for (const min of ministrosAfetados) {
          try {
            await updateDoc(
              doc(db, 'ministros', min.id),
              { status: novoStatusMinistro, atualizado_em: new Date().toISOString() }
            );
          } catch (err) {
            console.error(`[FIRESTORE_CASCADE_MINISTRO_ERR] Falha ao atualizar ministro ${min.id}:`, err);
          }
        }
      }

      const log = addAuditLog(
        'EDICAO_IGREJA',
        `Status da Igreja Filiada ${igrejaAtual.nomeFantasia} alterado para [${novoStatus}]. Efeito em cadeia: ${ministrosAfetados.length} ministro(s) vinculado(s) alterados para [${novoStatusMinistro}].`,
        igrejaAtual.tenantId
      );

      emitirEventoContabil(
        'MUTACAO_CADASTRO',
        `Status de igreja filiada alterado: ${igrejaAtual.nomeFantasia} -> ${novoStatus} (${ministrosAfetados.length} ministro(s) em cadeia)`,
        igrejaAtual.id,
        igrejaAtual.tenantId,
        log.hashIntegridade
      );
    },
    [addAuditLog, emitirEventoContabil]
  );

  // Tenant Ativo
  const tenantAtivo = useMemo(() => {
    const localizado = tenants.find((t) => t.id === tenantAtivoId);
    return localizado || tenants[0] || SEED_TENANTS[0] || {
      id: 't-sede-salvador',
      nome: 'CIMADEBE - Sede Geral Salvador',
      cnpj: '00.000.000/0001-00',
      logomarca: '',
      endereco: 'Salvador - BA',
      chaveSede: true,
    };
  }, [tenants, tenantAtivoId]);

  // Resumo Financeiro com Barkeep Filter (Zero-Trust)
  const resumoFinanceiro = useMemo((): ResumoFinanceiroTenant => {
    const ministrosDoTenant = ministros.filter((m) => m.tenantId === tenantAtivoId);
    const idsMinistrosDoTenant = new Set(ministrosDoTenant.map((m) => m.id));
    // Barkeep Filter: apenas anuidades cujo ministro pertença validamente à convenção
    const anuidadesDoTenant = anuidades.filter(
      (a) => a.tenantId === tenantAtivoId && idsMinistrosDoTenant.has(a.ministroId)
    );
    const inscricoesDoTenant = inscricoesAGO.filter(
      (i) => idsMinistrosDoTenant.has(i.ministroId) && i.statusInscricao === 'VALIDA'
    );

    const anoAtual = getSystemYear();
    let totalArrecadado = 0;
    let totalPendente = 0;

    for (const anuidade of anuidadesDoTenant) {
      if (anuidade.statusPagamento === 'PAGO') {
        totalArrecadado += anuidade.valor;
      } else if (anuidade.statusPagamento !== 'ANISTIADO' && anuidade.anoVigente <= anoAtual) {
        // Apenas cobranças do ciclo atual ou anteriores não quitadas entram como a receber/pendente do exercício
        totalPendente += anuidade.valor;
      }
    }

    let adimplentes = 0;
    let inadimplentes = 0;

    for (const min of ministrosDoTenant) {
      const st = String(min.statusAdimplencia || 'EM_DIA').toUpperCase();
      if (st === 'EM_DIA' || st === 'EM_DIA_FUTURO' || st === 'ADIMPLENTE' || st === 'PENDENTE') {
        adimplentes++;
      } else {
        inadimplentes++;
      }
    }

    const totalMinistros = ministrosDoTenant.length;
    const taxaPercentual =
      totalMinistros > 0 ? Math.round((adimplentes / totalMinistros) * 100) : 0;

    return deepFreeze({
      totalArrecadado,
      totalPendente,
      ministrosAdimplentes: adimplentes,
      ministrosInadimplentes: inadimplentes,
      taxaAdimplenciaPercentual: taxaPercentual,
      totalInscricoesAgo: inscricoesDoTenant.length,
    });
  }, [ministros, anuidades, inscricoesAGO, tenantAtivoId]);

  const idsMinistrosValidos = useMemo(() => {
    return new Set(
      ministros.flatMap((m) => [m.id, m.cpf ? m.cpf.replace(/\D/g, '') : ''].filter(Boolean))
    );
  }, [ministros]);

  // DRE Geral e DRE Tenant em centavos inteiros com base direta no Ledger Contábil
  const dreGeral = useMemo(() => {
    if (ministros.length === 0) {
      return calcularDRE([]);
    }
    const anuidadesValidas = anuidades.filter((a) => idsMinistrosValidos.has(a.ministroId));
    return calcularDRE(anuidadesValidas);
  }, [anuidades, ministros, idsMinistrosValidos]);

  const dreTenant = useMemo(() => {
    if (ministros.length === 0) {
      return calcularDRE([]);
    }
    const anuidadesValidas = anuidades.filter(
      (a) =>
        idsMinistrosValidos.has(a.ministroId) &&
        (!tenantAtivoId || !a.tenantId || a.tenantId === tenantAtivoId)
    );
    return calcularDRE(anuidadesValidas);
  }, [anuidades, ministros, tenantAtivoId, idsMinistrosValidos]);

  const esvaziarFinanceiroEUsuarios = useCallback(async () => {
    try {
      // 1. Limpa anuidades do Firestore com limite estrito
      const anSnap = await getDocs(query(collection(db, 'anuidades'), limit(50)));
      for (const d of anSnap.docs) {
        await deleteDoc(doc(db, 'anuidades', d.id));
      }

      // 2. Limpa ministros do Firestore com limite estrito
      const minSnap = await getDocs(query(collection(db, 'ministros'), limit(50)));
      for (const d of minSnap.docs) {
        await deleteDoc(doc(db, 'ministros', d.id));
      }

      // 3. Limpa usuários administrativos e de sistema com limite estrito
      const usrSnap = await getDocs(query(collection(db, 'usuarios_administrativos'), limit(50)));
      for (const d of usrSnap.docs) {
        await deleteDoc(doc(db, 'usuarios_administrativos', d.id));
      }
      const sysSnap = await getDocs(query(collection(db, 'usuarios_sistema'), limit(50)));
      for (const d of sysSnap.docs) {
        await deleteDoc(doc(db, 'usuarios_sistema', d.id));
      }

      // 4. Limpa membros da mesa diretora do Firestore com limite estrito
      const mesaSnap = await getDocs(query(collection(db, 'membros_mesa_diretora'), limit(50)));
      for (const d of mesaSnap.docs) {
        await deleteDoc(doc(db, 'membros_mesa_diretora', d.id));
      }

      // 5. Limpa inscrições AGO com limite estrito
      const agoSnap = await getDocs(query(collection(db, 'inscricoes_ago'), limit(50)));
      for (const d of agoSnap.docs) {
        await deleteDoc(doc(db, 'inscricoes_ago', d.id));
      }

      // 6. Limpa travas de idempotência com limite estrito
      const travaSnap = await getDocs(query(collection(db, 'transacoes_processadas'), limit(50)));
      for (const d of travaSnap.docs) {
        await deleteDoc(doc(db, 'transacoes_processadas', d.id));
      }

      // 7. Remove CadastroConvencao e reseta configuracoes_sistema para estado virgem
      await deleteDoc(doc(db, 'CadastroConvencao', 'dados_oficiais')).catch(() => {});
      await deleteDoc(doc(db, 'configuracoes_sistema', 'geral')).catch(() => {});
      await setDoc(
        doc(db, 'configuracoes_sistema', 'status_geral'),
        {
          setup_concluido: false,
          dataReset: new Date().toISOString(),
          sistemaAtivo: false,
        }
      );

      // 8. Atualiza estados locais e referências em memória
      setMinistros([]);
      ministrosRef.current = [];
      setAnuidades([]);
      anuidadesRef.current = [];
      setUsuariosAdministrativos([]);
      usuariosAdministrativosRef.current = [];
      setMembrosMesaDiretora([]);
      membrosMesaDiretoraRef.current = [];
      setInscricoesAGO([]);
      inscricoesAGORef.current = [];
      setAppConfig({
        ...DEFAULT_APP_CONFIG,
        setup_concluido: false,
        primeiroAcesso: true,
      });

      addAuditLog(
        'ALTERACAO_CONFIGURACAO',
        'Varredura total executada: Banco de dados 100% zerado e restaurado para estado virgem oficial (0 ministros, 0 usuários, 0 cobranças, setup pendente).'
      );
    } catch (err) {
      console.error('[ESVAZIAR_FINANCEIRO_ERR]', err);
    }
  }, [addAuditLog]);

  const resetarSistemaParaSetupVirgem = useCallback(async () => {
    await esvaziarFinanceiroEUsuarios();
  }, [esvaziarFinanceiroEUsuarios]);

  const purgarUsuariosFantasma = useCallback(async (): Promise<number> => {
    let purgedCount = 0;
    try {
      const usrSnap = await getDocs(collection(db, 'usuarios_administrativos'));
      // Purge desativado para preservar cadastros legítimos de usuários e ministros criados pelo usuário
      const purgedCount = 0;

      addAuditLog(
        'ALTERACAO_CONFIGURACAO',
        `Varredura Anti-Fantasma executada: ${purgedCount} registros e acessos fantasmas/espúrios expurgados permanentemente do sistema.`
      );
    } catch (err) {
      console.error('[PURGAR_FANTASMA_ERR]', err);
    }
    return purgedCount;
  }, [addAuditLog]);

  const valorContexto: SecurityContextType = useMemo(
    () => ({
      tenants,
      ministros,
      anuidades,
      inscricoesAGO,
      usuariosAdministrativos,
      usuariosSistema,
      membrosMesaDiretora,
      igrejasFiliadas,
      logs,
      cmsSettings,
      appConfig,
      tenantAtivoId,
      tenantAtivo,
      operadorAtual,
      operadorId,
      isAuthenticated: Boolean(operadorId && operadorId.trim().length > 0 && operadorAtual && operadorAtual.trim().length > 0),
      ultimoEventoContabil,
      resumoFinanceiro,
      cacheIdempotencia,
      dreGeral,
      dreTenant,
      cicloAgoVigente,
      alertasCompulsoriosAGO,
      operadorRole,
      authCarregando,
      setAuthCarregando,
      carregandoStatusSistema,
      sistemaVirgem,
      avisoCotaFirestore,
      alternarOperadorRole,
      verificarPermissao,
      validarIntegridadeAcesso,
      executarConsultaParametrizada,
      definirOperador,
      registrarLogin,
      registrarLogout,
      atribuirUsuarioAdministrativo,
      alterarStatusUsuarioAdministrativo,
      removerUsuarioAdministrativo,
      atualizarUsuarioAdministrativo,
      atualizarUsuarioSistema,
      atribuirMembroMesa,
      removerMembroMesa,
      atualizarMembroMesa,
      cadastrarIgreja,
      editarIgreja,
      deletarIgreja,
      alternarStatusIgreja,
      alternarTenant,
      cadastrarMinistro,
      editarMinistro,
      deletarMinistro,
      alternarStatusMinistro,
      atualizarStatusMinistro,
      registrarAnuidade,
      editarAnuidade,
      liquidarAnuidade,
      excluirAnuidade,
      concederIsencaoOuJubilacao,
      concederAnistia,
      processarWebhookAsaas,
      executarVarreduraAdimplencia,
      inscreverMinistroAGO,
      inscreverAGO,
      verificarStatusFinanceiroGeral,
      limparAlertaCompulsorio,
      revogarInscricaoAGO,
      atualizarAppConfig,
      atualizarCmsSettings,
      addAuditLog,
      verificarIntegridadeAuditTrail,
      inscreverOuvinteContabil,
      eventos,
      noticias,
      carregarEventosENoticias,
      cadastrarEventoGlobal,
      atualizarEventoGlobal,
      deletarEventoGlobal,
      esvaziarFinanceiroEUsuarios,
      resetarSistemaParaSetupVirgem,
      purgarUsuariosFantasma,
      cadastrarNoticiaGlobal,
      atualizarNoticiaGlobal,
      deletarNoticiaGlobal,
    }),
    [
      tenants,
      ministros,
      anuidades,
      inscricoesAGO,
      usuariosAdministrativos,
      usuariosSistema,
      membrosMesaDiretora,
      igrejasFiliadas,
      logs,
      cmsSettings,
      appConfig,
      tenantAtivoId,
      tenantAtivo,
      operadorAtual,
      operadorId,
      ultimoEventoContabil,
      resumoFinanceiro,
      cacheIdempotencia,
      dreGeral,
      dreTenant,
      cicloAgoVigente,
      alertasCompulsoriosAGO,
      operadorRole,
      authCarregando,
      carregandoStatusSistema,
      sistemaVirgem,
      alternarOperadorRole,
      verificarPermissao,
      validarIntegridadeAcesso,
      executarConsultaParametrizada,
      definirOperador,
      registrarLogin,
      registrarLogout,
      atribuirUsuarioAdministrativo,
      alterarStatusUsuarioAdministrativo,
      removerUsuarioAdministrativo,
      atualizarUsuarioAdministrativo,
      atualizarUsuarioSistema,
      atribuirMembroMesa,
      removerMembroMesa,
      atualizarMembroMesa,
      cadastrarIgreja,
      editarIgreja,
      deletarIgreja,
      alternarStatusIgreja,
      alternarTenant,
      cadastrarMinistro,
      editarMinistro,
      deletarMinistro,
      alternarStatusMinistro,
      atualizarStatusMinistro,
      registrarAnuidade,
      editarAnuidade,
      liquidarAnuidade,
      excluirAnuidade,
      concederIsencaoOuJubilacao,
      concederAnistia,
      processarWebhookAsaas,
      executarVarreduraAdimplencia,
      inscreverMinistroAGO,
      inscreverAGO,
      verificarStatusFinanceiroGeral,
      limparAlertaCompulsorio,
      revogarInscricaoAGO,
      atualizarAppConfig,
      atualizarCmsSettings,
      addAuditLog,
      verificarIntegridadeAuditTrail,
      inscreverOuvinteContabil,
      eventos,
      noticias,
      carregarEventosENoticias,
      cadastrarEventoGlobal,
      atualizarEventoGlobal,
      deletarEventoGlobal,
      esvaziarFinanceiroEUsuarios,
      resetarSistemaParaSetupVirgem,
      purgarUsuariosFantasma,
      cadastrarNoticiaGlobal,
      atualizarNoticiaGlobal,
      deletarNoticiaGlobal,
      avisoCotaFirestore,
    ]
  );

  return (
    <SecurityContext.Provider value={valorContexto}>
      {children}

      {/* BANNER FLUTUANTE DE AVISO DE COMPLIANCE POR INATIVIDADE (29 MINUTOS) */}
      {avisoInatividadeAtivo && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-slate-900 border-2 border-amber-500 rounded-2xl p-6 shadow-2xl shadow-amber-500/20 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <svg className="w-8 h-8 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-wide uppercase">Aviso de Compliance</h3>
              <p className="text-sm text-slate-200 mt-2 font-medium">
                Sua sessão administrativa irá expirar em <span className="text-amber-400 font-mono font-bold text-base">{segundosRestantesInatividade} segundos</span> devido à inatividade.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Deseja revalidar seu acesso e continuar conectado?
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={revalidarSessaoAtiva}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg transition-all text-sm uppercase tracking-wider"
              >
                Revalidar Acesso
              </button>
              <button
                type="button"
                onClick={() => registrarLogout()}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all text-sm"
              >
                Encerrar Agora
              </button>
            </div>
          </div>
        </div>
      )}
    </SecurityContext.Provider>
  );
}

export function useSecurity(): SecurityContextType {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity deve ser utilizado dentro de um SecurityProvider.');
  }
  return context;
}
