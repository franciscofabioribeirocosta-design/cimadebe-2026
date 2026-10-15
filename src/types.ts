/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Módulo de Tipagem Estrita TypeScript v5
 * Arquitetura de Isolamento Contábil e Rastreabilidade Criptográfica
 */

export type StatusMinistro = 'ATIVO' | 'SUSPENSO' | 'EM_ANALISE';

export type StatusAdimplencia =
  | 'EM_DIA'
  | 'EM_DIA_FUTURO'
  | 'PENDENTE'
  | 'EM_ATRASO'
  | 'ADIMPLENTE'
  | 'INADIMPLENTE';

export type StatusPagamento =
  | 'EM_DIA'
  | 'EM_DIA_FUTURO'
  | 'PENDENTE'
  | 'EM_ATRASO'
  | 'PAGO'
  | 'ABERTO'
  | 'ANISTIADO'
  | 'ATRASADA';

export type TipoTransacao = 'RECEITA' | 'DESPESA';

export type CategoriaTransacao = 'TAXA_CONVENCAO' | 'ANUIDADE' | 'INSCRICAO_AGO' | 'DESPESA_TAXA_GATEWAY';

export type StatusInscricaoAGO = 'VALIDA' | 'REVOGADA';

export const OPCOES_ESCOLARIDADE: readonly string[] = [
  'Ensino Fundamental Incompleto',
  'Ensino Fundamental Completo',
  'Ensino Médio Incompleto',
  'Ensino Médio Completo',
  'Ensino Técnico',
  'Superior Incompleto',
  'Superior Completo',
  'Bacharel em Teologia',
  'Pós-Graduação / Especialização',
  'Mestrado',
  'Doutorado',
];

export const OPCOES_PROFISSAO: readonly string[] = [
  'Ministro de Confissão Religiosa / Pastor',
  'Teólogo(a)',
  'Missionário(a)',
  'Evangelista',
  'Professor(a) / Educador(a)',
  'Administrador(a)',
  'Empresário(a) / Comerciante',
  'Advogado(a)',
  'Médico(a) / Profissional de Saúde',
  'Engenheiro(a)',
  'Contador(a) / Auditor(a)',
  'Servidor(a) Público(a)',
  'Aposentado(a)',
  'Autônomo(a) / Prestador(a) de Serviços',
  'Outra Profissão',
];

export interface EstadoBrasilItem {
  readonly uf: string;
  readonly nome: string;
}

export const ESTADOS_BRASIL: readonly EstadoBrasilItem[] = [
  { uf: 'AC', nome: 'Acre' },
  { uf: 'AL', nome: 'Alagoas' },
  { uf: 'AP', nome: 'Amapá' },
  { uf: 'AM', nome: 'Amazonas' },
  { uf: 'BA', nome: 'Bahia' },
  { uf: 'CE', nome: 'Ceará' },
  { uf: 'DF', nome: 'Distrito Federal' },
  { uf: 'ES', nome: 'Espírito Santo' },
  { uf: 'GO', nome: 'Goiás' },
  { uf: 'MA', nome: 'Maranhão' },
  { uf: 'MT', nome: 'Mato Grosso' },
  { uf: 'MS', nome: 'Mato Grosso do Sul' },
  { uf: 'MG', nome: 'Minas Gerais' },
  { uf: 'PA', nome: 'Pará' },
  { uf: 'PB', nome: 'Paraíba' },
  { uf: 'PR', nome: 'Paraná' },
  { uf: 'PE', nome: 'Pernambuco' },
  { uf: 'PI', nome: 'Piauí' },
  { uf: 'RJ', nome: 'Rio de Janeiro' },
  { uf: 'RN', nome: 'Rio Grande do Norte' },
  { uf: 'RS', nome: 'Rio Grande do Sul' },
  { uf: 'RO', nome: 'Rondônia' },
  { uf: 'RR', nome: 'Roraima' },
  { uf: 'SC', nome: 'Santa Catarina' },
  { uf: 'SP', nome: 'São Paulo' },
  { uf: 'SE', nome: 'Sergipe' },
  { uf: 'TO', nome: 'Tocantins' },
];

export type AcaoAuditoria =
  | 'LOGIN_REALIZADO'
  | 'LOGOUT_REALIZADO'
  | 'AUTENTICACAO_WEBAUTHN'
  | 'VIOLACAO_SEGURANCA'
  | 'ACESSO_NEGADO'
  | 'STATUS_ADIMPLENCIA_ALTERADO'
  | 'AGO_INSCRICAO_REALIZADA'
  | 'AGO_INSCRICAO_REVOCADA_POR_INADIMPLENCIA'
  | 'AGO_NOVA_TENTATIVA_REJEITADA'
  | 'CONCILIACAO_WEBHOOK'
  | 'ALTERACAO_CONFIGURACAO'
  | 'MINISTRO_CADASTRADO'
  | 'CADASTRO_MINISTRO'
  | 'EDICAO_MINISTRO'
  | 'EXCLUSAO_MINISTRO'
  | 'STATUS_MINISTRO_ALTERADO'
  | 'ANUIDADE_REGISTRADA'
  | 'ANUIDADE_EDITADA'
  | 'ANUIDADE_LIQUIDADA'
  | 'ANUIDADE_BAIXA_PIX'
  | 'CADASTRO_IGREJA'
  | 'EDICAO_IGREJA'
  | 'EXCLUSAO_IGREJA'
  | 'CADASTRO_USUARIO'
  | 'EDICAO_USUARIO'
  | 'EXCLUSAO_USUARIO'
  | 'ALTERACAO_STATUS_USUARIO'
  | 'CADASTRO_MESA'
  | 'EDICAO_MESA'
  | 'EXCLUSAO_MESA'
  | 'CADASTRO_EVENTO'
  | 'EDICAO_EVENTO'
  | 'EXCLUSAO_EVENTO'
  | 'RESTAURACAO_EVENTO'
  | 'CADASTRO_NOTICIA'
  | 'EDICAO_NOTICIA'
  | 'EXCLUSAO_NOTICIA'
  | 'RESTAURACAO_NOTICIA'
  | 'TENANT_ALTERADO'
  | 'HOMOLOGACAO_INSCRICAO_AGO'
  | 'CRIACAO_PLANO_AGO'
  | 'EDICAO_PLANO_AGO'
  | 'EXCLUSAO_PLANO_AGO';

export interface EnderecoMinistro {
  readonly cep: string;
  readonly rua: string;
  readonly numero: string;
  readonly bairro: string;
  readonly cidade: string;
  readonly uf: string;
}

export interface Tenant {
  readonly id: string;
  readonly nome: string;
  readonly cnpj: string;
  readonly logomarca: string;
  readonly endereco: string;
  readonly chaveSede: boolean;
}

export type CargoEclesiastico = 'Pastor' | 'Evangelista' | 'Presbítero' | 'Missionária';

export const CARGOS_ECLESIASTICOS: readonly CargoEclesiastico[] = Object.freeze([
  'Pastor',
  'Evangelista',
  'Presbítero',
  'Missionária',
]);

export interface DocumentoAnexoMinistro {
  readonly id: string;
  readonly nome: string;
  readonly tipo: 'RG_CNH' | 'CPF' | 'CERTIFICADO_CONSAGRACAO' | 'COMPROVANTE_RESIDENCIA' | 'CERTIDAO_CASAMENTO' | 'OUTROS';
  readonly dataUpload: string;
  readonly arquivoUrl: string; // Base64 Data URL
  readonly tamanho?: string;
}

export function gerarRegistroMinisterial(cpf?: string | null): string {
  if (!cpf || typeof cpf !== 'string') {
    return 'RM-000.000-00';
  }
  const digitos = cpf.replace(/\D/g, '');
  if (digitos.length >= 8) {
    const parte1 = digitos.slice(0, 3);
    const parte2 = digitos.slice(3, 6);
    const parteFinal = digitos.slice(-2);
    return `RM-${parte1}.${parte2}-${parteFinal}`;
  }
  return `RM-000.000-00`;
}

export const PROFISSOES_CIVIS: readonly string[] = Object.freeze([
  'Ministro de Confissão Religiosa / Pastor',
  'Administrador',
  'Advogado',
  'Analista de Sistemas / TI',
  'Assistente Social',
  'Autônomo',
  'Bancário',
  'Comerciante / Lojista',
  'Contador / Contabilista',
  'Corretor de Imóveis',
  'Dentista / Odontólogo',
  'Designer Gráfico',
  'Economista',
  'Educador / Professor',
  'Eletricista',
  'Empresário / Microempresário',
  'Enfermeiro / Técnico de Enfermagem',
  'Engenheiro Civil',
  'Engenheiro Eletricista / Mecânico',
  'Farmacêutico',
  'Fisioterapeuta',
  'Funcionário Público / Servidor',
  'Jornalista / Comunicador',
  'Médico',
  'Militar / Policial / Bombeiro',
  'Motorista / Condutor',
  'Nutricionista',
  'Pedagogo',
  'Pedreiro / Mestre de Obras',
  'Psicólogo',
  'Publicitário / Marketing',
  'Radialista / Locutor',
  'Representante Comercial',
  'Secretário Executivo',
  'Segurança Privada',
  'Técnico em Edificações',
  'Técnico em Informática',
  'Teólogo / Pesquisador Bíblico',
  'Vendedor / Balconista',
  'Vigilante',
  'Outra Profissão',
]);

export interface Ministro {
  readonly id: string;
  readonly tenantId: string;
  readonly nome: string;
  readonly cpf: string;
  readonly dataNascimento?: string;
  readonly nacionalidade?: string;
  readonly naturalidade?: string;
  readonly estadoCivil?: 'CASADO' | 'CASADA' | 'SOLTEIRO' | 'SOLTEIRA' | 'VIUVO' | 'VIUVA' | 'DIVORCIADO' | 'DIVORCIADA';
  readonly nomeConjuge?: string;
  readonly escolaridade?: string;
  readonly profissao?: string;
  readonly email?: string;
  readonly telefone?: string;
  readonly cargo: CargoEclesiastico;
  readonly igrejaFiliadaId?: string;
  readonly igrejaFiliadaNome?: string;
  readonly dataConsagracao?: string;
  readonly localConsagracao?: string;
  readonly estadoConsagracao?: string;
  readonly cidadeConsagracao?: string;
  readonly pastorConsagrante?: string;
  readonly ehPresidenteIgreja?: boolean;
  readonly igrejaPresidenteNome?: string;
  readonly registroMinisterial?: string;
  readonly status: StatusMinistro;
  readonly dataFiliacao: string;
  readonly statusAdimplencia: StatusAdimplencia;
  readonly dadosEndereco: EnderecoMinistro;
  readonly endereco?: string;
  readonly cidade?: string;
  readonly estado?: string;
  readonly fotoUrl: string;
  readonly senha?: string;
  readonly documentos?: readonly DocumentoAnexoMinistro[];
  readonly statusPrivilegio?: 'ISENTO' | 'JUBILADO';
  readonly temBiometriaCadastrada?: boolean;
  readonly biometricsEnabled?: boolean;
}

export interface AnuidadeMinistro {
  readonly id: string;
  readonly ministroId: string;
  readonly tenantId: string;
  readonly anoVigente: number;
  readonly dataVencimento: string;
  readonly valor: number;
  readonly statusPagamento: StatusPagamento;
  readonly tipo: TipoTransacao;
  readonly categoria: CategoriaTransacao;
  readonly descricao?: string;
  readonly tarifaAsaas?: number;
  readonly valorLiquido?: number;
  readonly dataLiquidacao?: string;
  readonly dataPagamento?: string;
  readonly nomeMinistro?: string;
  readonly asaasInvoiceUrl?: string;
  readonly asaasSubscriptionId?: string;
}

export interface InscricaoAGO {
  readonly id: string;
  readonly ministroId: string;
  readonly cpf?: string;
  readonly ministroCpf?: string;
  readonly ministroNome?: string;
  readonly cargo?: string;
  readonly anoVigente: number;
  readonly statusInscricao?: StatusInscricaoAGO;
  readonly status?: 'CONFIRMADO' | 'PENDENTE' | 'CANCELADO';
  readonly dataInscricao: string;
  readonly valor?: number;
  readonly planoId?: string;
  readonly planoNome?: string;
  readonly formaPagamento?: string;
  readonly direitoVotoHomologado?: boolean;
  readonly kitCongressistaReservado?: boolean;
  readonly chaveIdempotencia?: string;
  readonly hashIntegridade?: string;
  readonly linhaDigitavelBoleto?: string;
  readonly codigoBarrasBoleto?: string;
}

export interface AuditLog {
  readonly id: string;
  readonly timestamp: string;
  readonly tenantId: string;
  readonly operador: string;
  readonly operadorId: string;
  readonly acao: AcaoAuditoria;
  readonly detalhes: string;
  readonly hashIntegridade: string;
  readonly hashAnterior?: string;
}

export interface CmsPaginasVisiveis {
  readonly home: boolean;
  readonly quemSomos: boolean;
  readonly mesaDiretora: boolean;
  readonly igrejasFiliadas: boolean;
  readonly inscricaoAgo: boolean;
  readonly eventos: boolean;
  readonly noticias: boolean;
  readonly validacaoCredenciais: boolean;
  readonly contatos: boolean;
  readonly ativoClubeBeneficios: boolean;
  readonly ativoUrnaEletronica: boolean;
  readonly ativoEad: boolean;
  readonly ativoMuralOracao: boolean;
}

export interface CmsSettings {
  readonly paginasVisiveis: CmsPaginasVisiveis;
}

export interface ApiKeysConfig {
  readonly asaas: string;
  readonly gemini: string;
  readonly viaCep: string;
}

export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly pass: string;
  readonly remetenteEmail: string;
  readonly remetenteNome: string;
  readonly sslTls: boolean;
}

export interface AppConfig {
  readonly nomeConvencao: string;
  readonly nomeFantasia?: string;
  readonly sigla?: string;
  readonly cnpj: string;
  readonly logomarca: string;
  readonly endereco: string;
  readonly telefoneConvencao?: string;
  readonly anoCriacao?: string;
  readonly registroRcpj?: string;
  readonly taxaFiliacaoInicial: number;
  readonly taxaAnuidadeRecorrente: number;
  readonly taxaFiliacaoMinistro: number;
  readonly taxaFiliacaoMissionaria: number;
  readonly taxaAnuidadeMinistro: number;
  readonly taxaAnuidadeMissionaria: number;
  readonly presidenteNome?: string;
  readonly presidenteMesa?: string;
  readonly mandatoMesaDiretora?: string;
  readonly apiKeys: ApiKeysConfig;
  readonly smtp: SmtpConfig;
  readonly primeiroAcesso: boolean;
  readonly killSwitchCompliance: boolean;
  readonly setup_concluido?: boolean;
}

export type TipoNotificacaoContabil =
  | 'MUTACAO_CADASTRO'
  | 'TRANSACAO_FINANCEIRA'
  | 'AUDITORIA_INTEGRIDADE'
  | 'ALERTA_COMPLIANCE';

export interface EventoContabil {
  readonly id: string;
  readonly timestamp: string;
  readonly tipo: TipoNotificacaoContabil;
  readonly tenantId: string;
  readonly mensagem: string;
  readonly entidadeId: string;
  readonly hashIntegridade: string;
}

export interface FiltrosMinistro {
  readonly busca: string;
  readonly cargo: string;
  readonly status: string;
  readonly adimplencia: string;
}

export interface ResumoFinanceiroTenant {
  readonly totalArrecadado: number;
  readonly totalPendente: number;
  readonly ministrosAdimplentes: number;
  readonly ministrosInadimplentes: number;
  readonly taxaAdimplenciaPercentual: number;
  readonly totalInscricoesAgo: number;
}

export interface AsaasPaymentWebhookData {
  readonly id: string;
  readonly customer: string;
  readonly value: number;
  readonly netValue: number;
  readonly billingType: string;
  readonly status: string;
  readonly confirmedDate: string;
  readonly externalReference: string;
  readonly description: string;
}

export interface AsaasWebhookPayload {
  readonly event: string;
  readonly payment: AsaasPaymentWebhookData;
}

export interface DemonstrativoResultadoExercicio {
  readonly faturamentoBrutoCentavos: number;
  readonly faturamentoLiquidoCentavos: number;
  readonly taxasGatewayCentavos: number;
  readonly receitaTaxaConvencaoCentavos: number;
  readonly receitaAnuidadesCentavos: number;
  readonly previsaoReceberCentavos: number;
  readonly faturamentoBruto: number;
  readonly faturamentoLiquido: number;
  readonly taxasGateway: number;
  readonly receitaTaxaConvencao: number;
  readonly receitaAnuidades: number;
  readonly previsaoReceber: number;
}

export interface AlertaCompulsorioAGO {
  readonly id: string;
  readonly ministroId: string;
  readonly nome: string;
  readonly cpf: string;
  readonly mensagem: string;
  readonly dataRevogacao: string;
}

export interface DocumentoSecretariaVirtual {
  readonly id: string;
  readonly titulo: string;
  readonly categoria: 'ATA' | 'CERTIFICADO' | 'DECLARACAO' | 'REGIMENTO';
  readonly dataEmissao: string;
  readonly tamanho: string;
  readonly hashCertificacao: string;
}

// ==========================================
// GOVERNANÇA: CONTROLE DE ACESSO (RBAC)
// ==========================================
export type OperadorRole =
  | 'SUPER_ADMIN'
  | 'ADMINISTRADOR_MASTER'
  | 'PRESIDENTE_GERAL'
  | 'SECRETARIO'
  | 'TESOUREIRO'
  | 'MINISTRO_OBREIRO'
  | 'CONSULTA_PUBLICA'
  | 'BIRO';

export type PermissaoSistema =
  | 'CADASTRAR_MINISTRO'
  | 'EDITAR_MINISTRO'
  | 'LIQUIDAR_ANUIDADE'
  | 'CONCILIAR_WEBHOOK'
  | 'HOMOLOGAR_AGO'
  | 'REVOGAR_AGO'
  | 'EXPORTAR_BIRO_SVG'
  | 'ALTERAR_CONFIGURACOES_TAXAS'
  | 'ALTERAR_KILL_SWITCH'
  | 'VISUALIZAR_AUDIT_LOGS'
  | 'DOWNLOAD_DOCUMENTOS_OFICIAIS'
  | 'CONSULTAR_PUBLICO';

export type CargoAdministrativo =
  | 'Presidente Geral'
  | 'Administrador Master'
  | 'Secretário'
  | 'Tesoureiro';

export interface UsuarioAdministrativo {
  readonly id: string;
  readonly ministroId: string;
  readonly nome: string;
  readonly cpf: string;
  readonly email: string;
  readonly telefone: string;
  readonly cargoMinisterial: string;
  readonly igrejaFiliada: string;
  readonly role: OperadorRole;
  readonly cargoAdministrativo: CargoAdministrativo;
  readonly departamento: string;
  readonly statusAcesso?: 'ATIVO' | 'SUSPENSO' | 'EM_ANALISE';
  readonly status?: string;
  readonly dataConcessao: string;
  readonly ultimoAcesso: string;
  readonly fotoUrl?: string;
  readonly permissoesEspeciais: readonly string[];
  readonly senhaAcesso?: string;
  readonly temBiometriaCadastrada?: boolean;
  readonly biometricsEnabled?: boolean;
}

export interface MembroMesaDiretora {
  readonly id: string;
  readonly ministroId: string;
  readonly nome: string;
  readonly cpf: string;
  readonly cargoMesa: string;
  readonly ordemExibicao: number;
  readonly mandato: string;
  readonly fotoUrl: string;
  readonly igrejaFiliada: string;
  readonly biografia?: string;
  readonly email?: string;
  readonly telefone?: string;
}

export const CARGOS_MESA_DIRETORA_ESTATUTARIA: readonly string[] = Object.freeze([
  'Presidente Geral',
  '1º Vice-Presidente',
  '2º Vice-Presidente',
  '3º Vice-Presidente',
  '1º Secretário Geral',
  '2º Secretário',
  '3º Secretário',
  '1º Tesoureiro Geral',
  '2º Tesoureiro',
  '3º Tesoureiro',
  'Presidente do Conselho Fiscal',
  'Relator do Conselho Fiscal',
  'Membro do Conselho Fiscal',
  'Presidente da Comissão de Ética',
  'Relator da Comissão de Ética',
  'Membro da Comissão de Ética',
  'Assessor Especial da Presidência',
  'Consultor Jurídico Eclesiástico',
]);

export const HIERARQUIA_MESA_DIRETORA: Record<string, number> = Object.freeze({
  'Presidente Geral': 1,
  'Presidente': 1,
  'Pastor Presidente': 1,
  '1º Vice-Presidente': 2,
  '2º Vice-Presidente': 3,
  '3º Vice-Presidente': 4,
  '1º Secretário Geral': 5,
  '1º Secretário': 5,
  '2º Secretário': 6,
  '3º Secretário': 7,
  '1º Tesoureiro Geral': 8,
  '1º Tesoureiro': 8,
  '2º Tesoureiro': 9,
  '3º Tesoureiro': 10,
  'Presidente do Conselho Fiscal': 11,
  'Relator do Conselho Fiscal': 12,
  'Membro do Conselho Fiscal': 13,
  'Presidente da Comissão de Ética': 14,
  'Relator da Comissão de Ética': 15,
  'Membro da Comissão de Ética': 16,
  'Assessor Especial da Presidência': 17,
  'Consultor Jurídico Eclesiástico': 18,
});

export function obterOrdemHierarquicaMesa(cargoMesa?: string | null): number {
  if (!cargoMesa || typeof cargoMesa !== 'string') {
    return 99;
  }
  if (HIERARQUIA_MESA_DIRETORA[cargoMesa] !== undefined) {
    return HIERARQUIA_MESA_DIRETORA[cargoMesa];
  }
  const key = Object.keys(HIERARQUIA_MESA_DIRETORA).find((k) =>
    cargoMesa.toLowerCase().includes(k.toLowerCase())
  );
  return key ? HIERARQUIA_MESA_DIRETORA[key] : 99;
}

export interface IgrejaFiliada {
  readonly id: string;
  readonly tenantId: string;
  readonly razaoSocial: string;
  readonly nomeFantasia: string;
  readonly cnpj: string;
  readonly dataAbertura: string;
  readonly naturezaJuridica: string;
  readonly cnaePrincipal: string;
  readonly situacaoCadastral: 'ATIVA' | 'BAIXADA' | 'SUSPENSA';
  readonly logradouro: string;
  readonly numero: string;
  readonly complemento?: string;
  readonly bairro: string;
  readonly municipio: string;
  readonly uf: string;
  readonly cep: string;
  readonly email: string;
  readonly telefone: string;
  readonly pastorPresidenteId: string;
  readonly pastorPresidenteNome: string;
  readonly pastorPresidenteCpf?: string;
  readonly logoUrl: string;
  readonly status: 'ATIVA' | 'SUSPENSA';
  readonly dataFiliacao: string;
}

export interface ValidacaoEntradaResultado {
  readonly valido: boolean;
  readonly formatado: string;
  readonly valorLimpo: string;
  readonly mensagemErro?: string;
  readonly sanitizado: string;
}

export type SqlParamValue = string | number | boolean | null;

export interface ParametrizedStatement {
  readonly sql: string;
  readonly params: readonly SqlParamValue[];
  readonly sanitizedSqlPreview: string;
  readonly timestamp: string;
}

export type RecursoCritico =
  | 'TESOURARIA_DRE'
  | 'SECRETARIA_GERAL'
  | 'GOVERNANCA_MASTER'
  | 'ADMINISTRACAO_GERAL'
  | 'GESTAO_USUARIOS'
  | 'GESTAO_MINISTROS'
  | 'GESTAO_IGREJAS'
  | 'MESA_DIRETORA'
  | 'GESTAO_AGO'
  | 'BIRO_IMPRESSAO'
  | 'COMPLIANCE_AUDITORIA';

export interface ResultadoVerificacaoIntegridade {
  readonly permitido: boolean;
  readonly motivo?: string;
  readonly codigoBloqueio?:
    | 'TENANT_INVALIDO'
    | 'ROLE_INSUFICIENTE'
    | 'USUARIO_SUSPENSO'
    | 'CHAVE_INTEGRIDADE_VIOLADA'
    | 'SESSAO_EXPIRADA'
    | 'SETUP_NAO_CONCLUIDO';
  readonly operadorAtual: string;
  readonly role: OperadorRole;
  readonly tenantId: string;
  readonly timestamp: string;
  readonly recurso: RecursoCritico;
  readonly hashAuditoria?: string;
}



