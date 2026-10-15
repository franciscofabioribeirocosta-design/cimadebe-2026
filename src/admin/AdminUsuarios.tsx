import React, { useState, useMemo } from 'react';
import { PaginacaoGeral } from '../components/PaginacaoGeral';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  Users,
  Key,
  Lock,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Scale,
  FileText,
  DollarSign,
  Crown,
  Eye,
  EyeOff,
  Building2,
  Mail,
  Phone,
  Clock,
  Sparkles,
  Trash2,
  UserCog,
  ChevronRight,
  Filter,
  Edit3,
  X,
  Award,
  BadgeCheck,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useSecurity } from '../SecurityContext';
import { useNotification } from '../NotificationContext';
import { gerarRegistroMinisterial } from '../types';
import type {
  UsuarioAdministrativo,
  CargoAdministrativo,
  OperadorRole,
  Ministro,
  MembroMesaDiretora,
} from '../types';

// ============================================================================
// FUNÇÃO UTILITÁRIA DE AUDITORIA E VALIDAÇÃO DE SEGURANÇA DE SENHA (SRP)
// ============================================================================
export interface AnaliseSegurancaSenha {
  score: number;
  nivel: 'MUITO_FRACA' | 'FRACA' | 'MEDIA' | 'FORTE' | 'MUITO_FORTE';
  label: string;
  corTexto: string;
  corBarra: string;
  temMinimo8: boolean;
  temRecomendado12: boolean;
  temMaiuscula: boolean;
  temMinuscula: boolean;
  temNumero: boolean;
  temEspecial: boolean;
  semSequenciaObvia: boolean;
  confereConfirmacao: boolean;
  atendeRequisitosMinimos: boolean;
}

export function analisarSegurancaSenha(senha: string, confirmarSenha?: string): AnaliseSegurancaSenha {
  const s = senha || '';
  const temMinimo8 = s.length >= 8;
  const temRecomendado12 = s.length >= 12;
  const temMaiuscula = /[A-Z]/.test(s);
  const temMinuscula = /[a-z]/.test(s);
  const temNumero = /[0-9]/.test(s);
  const temEspecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(s);

  // Verificação contra sequências e palavras óbvias/fracas
  const palavrasFracas = ['1234', 'senha', 'admin', 'brasil', 'igreja', 'convencao', 'cimadebe', '123456', 'qwerty', '1111', '0000'];
  const sMinuscula = s.toLowerCase();
  const possuiSequenciaObvia = palavrasFracas.some((p) => sMinuscula.includes(p));
  const semSequenciaObvia = !possuiSequenciaObvia;

  let score = 0;
  if (temMinimo8) score += 20;
  if (temRecomendado12) score += 10;
  if (temMaiuscula) score += 20;
  if (temMinuscula) score += 20;
  if (temNumero) score += 15;
  if (temEspecial) score += 15;
  if (semSequenciaObvia && s.length > 0) score += 0;
  else if (!semSequenciaObvia) score = Math.max(10, score - 30);

  let nivel: 'MUITO_FRACA' | 'FRACA' | 'MEDIA' | 'FORTE' | 'MUITO_FORTE' = 'MUITO_FRACA';
  let corTexto = 'text-rose-400';
  let corBarra = 'bg-rose-500';
  let label = 'Muito Fraca';

  if (score >= 90) {
    nivel = 'MUITO_FORTE';
    corTexto = 'text-emerald-400';
    corBarra = 'bg-gradient-to-r from-emerald-500 to-teal-400';
    label = 'Excelente • Padrão Bancário';
  } else if (score >= 70) {
    nivel = 'FORTE';
    corTexto = 'text-emerald-300';
    corBarra = 'bg-emerald-500';
    label = 'Forte';
  } else if (score >= 50) {
    nivel = 'MEDIA';
    corTexto = 'text-amber-400';
    corBarra = 'bg-amber-500';
    label = 'Média';
  } else if (score >= 25) {
    nivel = 'FRACA';
    corTexto = 'text-orange-400';
    corBarra = 'bg-orange-500';
    label = 'Fraca';
  }

  const confereConfirmacao = Boolean(confirmarSenha !== undefined ? confirmarSenha && confirmarSenha === s : true);
  const atendeRequisitosMinimos = temMinimo8 && temMaiuscula && temMinuscula && temNumero && temEspecial && semSequenciaObvia;

  return {
    score,
    nivel,
    label,
    corTexto,
    corBarra,
    temMinimo8,
    temRecomendado12,
    temMaiuscula,
    temMinuscula,
    temNumero,
    temEspecial,
    semSequenciaObvia,
    confereConfirmacao,
    atendeRequisitosMinimos,
  };
}

export function gerarSenhaSeguraAleatoria(): string {
  const maiusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minusculas = 'abcdefghijkmnpqrstuvwxyz';
  const numeros = '23456789';
  const especiais = '!@#$%&*_-+=';
  const sortear = (conjunto: string) => conjunto[Math.floor(Math.random() * conjunto.length)];

  let result = [
    sortear(maiusculas),
    sortear(maiusculas),
    sortear(minusculas),
    sortear(minusculas),
    sortear(numeros),
    sortear(numeros),
    sortear(especiais),
    sortear(especiais),
  ];

  const todos = maiusculas + minusculas + numeros + especiais;
  while (result.length < 14) {
    result.push(sortear(todos));
  }

  return result.sort(() => Math.random() - 0.5).join('');
}

export function AdminUsuarios() {
  const {
    usuariosAdministrativos = [],
    ministros = [],
    membrosMesaDiretora = [],
    atribuirUsuarioAdministrativo,
    atualizarUsuarioAdministrativo,
    alterarStatusUsuarioAdministrativo,
    removerUsuarioAdministrativo,
    alternarOperadorRole,
    operadorRole,
    purgarUsuariosFantasma,
  } = useSecurity() || {};
  const { notifySuccess, notifyError, notifyWarning } = useNotification();

  // Estados locais de filtro e busca
  const [busca, setBusca] = useState('');
  const [filtroCargo, setFiltroCargo] = useState<string>('TODOS');
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');
  const [modoVisualizacao, setModoVisualizacao] = useState<'tabela' | 'cards'>('tabela');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState<number | 'TODOS'>(15);

  // Modais
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [modalDeletarAberto, setModalDeletarAberto] = useState(false);

  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<UsuarioAdministrativo | null>(null);
  const [usuarioParaDeletar, setUsuarioParaDeletar] = useState<UsuarioAdministrativo | null>(null);

  // Estados do Formulário de Concessão (Puxado do Ministro Selecionado)
  const [ministroSelecionadoId, setMinistroSelecionadoId] = useState('');
  const [origemSelecao, setOrigemSelecao] = useState<'mesa' | 'ministros'>('mesa');
  const [cargoAdminSelecionado, setCargoAdminSelecionado] = useState<CargoAdministrativo>('Secretário');
  const [departamento, setDepartamento] = useState('Secretaria Geral & Atas Convencionais');
  const [emailCorporativo, setEmailCorporativo] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  const [senhaCopiada, setSenhaCopiada] = useState(false);
  const [copiadoGeral, setCopiadoGeral] = useState(false);
  const [credenciaisCriadasModal, setCredenciaisCriadasModal] = useState<{
    nome: string;
    email: string;
    senha: string;
    cargo: string;
    role: string;
    telefone: string;
  } | null>(null);
  const [permissoesSelecionadas, setPermissoesSelecionadas] = useState<string[]>([
    'Acesso ao Painel Administrativo',
    'Visualização de Relatórios',
  ]);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Análise e Validação de Segurança de Senha em Tempo Real
  const analiseSenha = useMemo(() => {
    return analisarSegurancaSenha(senha, confirmarSenha);
  }, [senha, confirmarSenha]);

  // Função para gerar senha criptograficamente forte automática
  const gerarSenhaAutomatica = () => {
    const novaSenha = gerarSenhaSeguraAleatoria();
    setSenha(novaSenha);
    setConfirmarSenha(novaSenha);
    setMostrarSenha(true);
    setMostrarConfirmarSenha(true);
  };

  // Estados para redefinição/criação de senha no modal de edição
  const [redefinirSenhaEdicao, setRedefinirSenhaEdicao] = useState(false);
  const [novaSenhaEdicao, setNovaSenhaEdicao] = useState('');
  const [confirmarSenhaEdicao, setConfirmarSenhaEdicao] = useState('');
  const [mostrarSenhaEdicao, setMostrarSenhaEdicao] = useState(false);
  const [mostrarConfirmarSenhaEdicao, setMostrarConfirmarSenhaEdicao] = useState(false);
  const [senhaEdicaoCopiada, setSenhaEdicaoCopiada] = useState(false);

  const analiseSenhaEdicao = useMemo(() => {
    return analisarSegurancaSenha(novaSenhaEdicao, confirmarSenhaEdicao);
  }, [novaSenhaEdicao, confirmarSenhaEdicao]);

  const gerarSenhaAutomaticaEdicao = () => {
    const novaSenha = gerarSenhaSeguraAleatoria();
    setNovaSenhaEdicao(novaSenha);
    setConfirmarSenhaEdicao(novaSenha);
    setMostrarSenhaEdicao(true);
    setMostrarConfirmarSenhaEdicao(true);
  };

  // Mapeamento de Role baseado no Cargo Administrativo (Desacoplado)
  const mapaRolePorCargo: Record<CargoAdministrativo, OperadorRole> = {
    'Presidente Geral': 'PRESIDENTE_GERAL',
    'Administrador Master': 'ADMINISTRADOR_MASTER',
    Secretário: 'SECRETARIO',
    Tesoureiro: 'TESOUREIRO',
  };

  // Mapeamento de cores e ícones para cada cargo administrativo
  const configuracaoCargo: Record<
    CargoAdministrativo,
    {
      corBadge: string;
      corBorda: string;
      corTexto: string;
      icone: React.ReactNode;
      descricao: string;
    }
  > = {
    'Presidente Geral': {
      corBadge: 'bg-amber-950/80 text-amber-300 border-amber-500/50',
      corBorda: 'border-amber-500/30',
      corTexto: 'text-amber-400',
      icone: <Crown className="w-4 h-4 text-amber-400" />,
      descricao: 'Presidente da Convenção (Mesa Diretora)',
    },
    'Administrador Master': {
      corBadge: 'bg-purple-950/80 text-purple-300 border-purple-500/50',
      corBorda: 'border-purple-500/30',
      corTexto: 'text-purple-400',
      icone: <Shield className="w-4 h-4 text-purple-400" />,
      descricao: 'Administrador Primário do Sistema',
    },
    Secretário: {
      corBadge: 'bg-blue-950/80 text-blue-300 border-blue-500/50',
      corBorda: 'border-blue-500/30',
      corTexto: 'text-blue-400',
      icone: <FileText className="w-4 h-4 text-blue-400" />,
      descricao: 'Secretaria Virtual, Homologação de AGO, Atas e Certidões',
    },
    Tesoureiro: {
      corBadge: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50',
      corBorda: 'border-emerald-500/30',
      corTexto: 'text-emerald-400',
      icone: <DollarSign className="w-4 h-4 text-emerald-400" />,
      descricao: 'Tesouraria Contábil, Integração Asaas, Liquidações e DRE',
    },
  };

  // Sugestões de departamentos quando troca de cargo
  const lidarComTrocaCargo = (cargo: CargoAdministrativo) => {
    setCargoAdminSelecionado(cargo);
    if (cargo === 'Presidente Geral') {
      setDepartamento('Mesa Diretora & Presidência');
      setPermissoesSelecionadas(['Homologação AGO', 'Expedição de Certidões', 'Liderança Convencional']);
    } else if (cargo === 'Administrador Master') {
      setDepartamento('Administração Técnica do Sistema');
      setPermissoesSelecionadas(['Acesso Irrestrito', 'Kill-Switch Contábil', 'Bunker Master', 'Chaves API Asaas']);
    } else if (cargo === 'Secretário') {
      setDepartamento('Secretaria Geral & Atas Convencionais');
      setPermissoesSelecionadas(['Homologação AGO', 'Expedição de Certidões', 'Cadastro Geral de Ministros']);
    } else {
      setDepartamento('Tesouraria Geral & Finanças Asaas');
      setPermissoesSelecionadas(['Liquidação de Cobranças', 'Conciliação Webhook Pix', 'Emissão de DRE']);
    }
  };

  // Quando o ministro é selecionado, puxa automaticamente todas as informações
  const lidarComSelecaoMinistro = (minId: string) => {
    setMinistroSelecionadoId(minId);
    const min = ministros.find((m) => m.id === minId);
    if (min) {
      const primeiroNome = min.nome
        .replace(/^(Pr\.|Ev\.|Pb\.|Mis\.)\s*/i, '')
        .toLowerCase()
        .split(' ')[0];

      setEmailCorporativo(min.email || `${primeiroNome}.${cargoAdminSelecionado.toLowerCase().replace(/\s+/g, '')}@cimadebe.org.br`);
      setTelefone(min.telefone || '(71) 98877-6655');
    }
  };

  // Ministro atualmente selecionado para preview no modal
  const ministroSelecionadoObj = useMemo(() => {
    return ministros.find((m) => m.id === ministroSelecionadoId) || null;
  }, [ministros, ministroSelecionadoId]);

  // Submissão do novo usuário administrativo
  const lidarComSalvarUsuario = (e: React.FormEvent) => {
    e.preventDefault();
    const ministro = ministros.find((m) => m.id === ministroSelecionadoId);
    if (!ministro) {
      setFeedback({ tipo: 'erro', texto: 'Selecione um ministro filiado.' });
      return;
    }

    const emailFinal = emailCorporativo || `${ministro.nome.toLowerCase().split(' ')[1] || 'obreiro'}@cimadebe.org.br`;
    const telefoneFinal = ministro.telefone || '(71) 98888-0000';

    // Verificação de unicidade para evitar duplicidade de usuários
    const jaExiste = usuariosAdministrativos.some(
      (u) =>
        u.ministroId === ministro.id ||
        (u.cpf && u.cpf.replace(/\D/g, '') === ministro.cpf.replace(/\D/g, ''))
    );

    if (jaExiste) {
      setFeedback({
        tipo: 'erro',
        texto: `O ministro ${ministro.nome} (CPF: ${ministro.cpf}) já possui um acesso de usuário cadastrado. Edite o usuário existente em vez de criar outro.`,
      });
      return;
    }

    // Verificação de unicidade: Impede múltiplos Administrador Master ou Presidente Geral ativos
    if (cargoAdminSelecionado === 'Administrador Master' || cargoAdminSelecionado === 'Presidente Geral') {
      const cargoExistenteAtivo = usuariosAdministrativos.find(
        (u) => u.cargoAdministrativo === cargoAdminSelecionado && u.statusAcesso === 'ATIVO'
      );
      if (cargoExistenteAtivo) {
        const msg = `Violação RBAC: Já existe um ${cargoAdminSelecionado} ativo (${cargoExistenteAtivo.nome}). O sistema veda a criação de múltiplos registros ativos para este cargo.`;
        setFeedback({ tipo: 'erro', texto: msg });
        notifyWarning('Cargo Único Já Cadastrado', msg);
        return;
      }
    }

    if (!analiseSenha.atendeRequisitosMinimos) {
      setFeedback({
        tipo: 'erro',
        texto: 'A senha criada deve atender a todos os requisitos de segurança obrigatórios (mínimo 8 caracteres, maiúsculas, minúsculas, números e caracteres especiais).',
      });
      return;
    }

    if (senha !== confirmarSenha) {
      setFeedback({
        tipo: 'erro',
        texto: 'A confirmação de senha não confere com a senha digitada.',
      });
      return;
    }

    try {
      atribuirUsuarioAdministrativo({
        ministroId: ministro.id,
        nome: ministro.nome,
        cpf: ministro.cpf,
        email: emailFinal,
        telefone: telefoneFinal,
        cargoMinisterial: ministro.cargo,
        igrejaFiliada: ministro.igrejaFiliadaNome || 'AD Central Filiada CIMADEBE',
        role: mapaRolePorCargo[cargoAdminSelecionado],
        cargoAdministrativo: cargoAdminSelecionado,
        departamento: departamento || 'Corpo Administrativo',
        statusAcesso: 'ATIVO',
        fotoUrl: '', // Zero-Trust: Foto de usuário administrativo NÃO é herdada de ministro. O usuário define sua própria foto no perfil.
        permissoesEspeciais: permissoesSelecionadas,
        senhaAcesso: senha,
      });

      // Abre modal apresentando as credenciais de acesso ao administrador para repasse seguro
      setCredenciaisCriadasModal({
        nome: ministro.nome,
        email: emailFinal,
        senha: senha,
        cargo: cargoAdminSelecionado,
        role: mapaRolePorCargo[cargoAdminSelecionado],
        telefone: telefoneFinal,
      });

      setModalNovoAberto(false);
      setFeedback({
        tipo: 'sucesso',
        texto: `Acesso administrativo concedido com sucesso para o ministro ${ministro.nome} (${ministro.cargo})!`,
      });
      notifySuccess('Acesso Concedido', `Acesso administrativo concedido para ${ministro.nome}.`);
      setTimeout(() => setFeedback(null), 5000);

      // Limpa campos
      setMinistroSelecionadoId('');
      setEmailCorporativo('');
      setTelefone('');
      setSenha('');
      setConfirmarSenha('');
    } catch (err: any) {
      const msg = err?.message || 'Erro ao conceder acesso administrativo.';
      setFeedback({
        tipo: 'erro',
        texto: msg,
      });
      notifyError('Erro na Concessão', msg);
    }
  };

  // Abrir Modal de Edição
  const abrirModalEditar = (usuario: UsuarioAdministrativo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setUsuarioEmEdicao(usuario);
    setCargoAdminSelecionado(usuario.cargoAdministrativo);
    setDepartamento(usuario.departamento);
    setEmailCorporativo(usuario.email);
    setTelefone(usuario.telefone);
    setPermissoesSelecionadas([...(usuario.permissoesEspeciais || [])]);
    setRedefinirSenhaEdicao(false);
    setNovaSenhaEdicao('');
    setConfirmarSenhaEdicao('');
    setModalEditarAberto(true);
  };

  // Salvar Edição de Usuário
  const lidarComSalvarEdicao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioEmEdicao) return;

    if (redefinirSenhaEdicao) {
      if (!analiseSenhaEdicao.atendeRequisitosMinimos) {
        setFeedback({
          tipo: 'erro',
          texto: 'A nova senha deve atender a todos os requisitos de segurança obrigatórios (mínimo 8 caracteres, maiúsculas, minúsculas, números, caracteres especiais e sem termos óbvios).',
        });
        notifyWarning('Senha Fraca', 'A senha precisa atender aos requisitos de segurança obrigatórios.');
        return;
      }
      if (novaSenhaEdicao !== confirmarSenhaEdicao) {
        setFeedback({
          tipo: 'erro',
          texto: 'A confirmação de senha não coincide com a nova senha digitada.',
        });
        notifyWarning('Senhas Divergentes', 'A confirmação não coincide com a nova senha.');
        return;
      }
    }

    try {
      const dadosAtualizacao: any = {
        cargoAdministrativo: cargoAdminSelecionado,
        role: mapaRolePorCargo[cargoAdminSelecionado],
        departamento,
        email: emailCorporativo,
        telefone: usuarioEmEdicao.telefone,
        permissoesEspeciais: permissoesSelecionadas,
      };

      if (redefinirSenhaEdicao && novaSenhaEdicao) {
        dadosAtualizacao.senhaAcesso = novaSenhaEdicao;
      }

      atualizarUsuarioAdministrativo(usuarioEmEdicao.id, dadosAtualizacao);

      if (redefinirSenhaEdicao && novaSenhaEdicao) {
        setCredenciaisCriadasModal({
          nome: usuarioEmEdicao.nome,
          email: emailCorporativo,
          senha: novaSenhaEdicao,
          cargo: cargoAdminSelecionado,
          role: mapaRolePorCargo[cargoAdminSelecionado],
          telefone: usuarioEmEdicao.telefone,
        });
      }

      setModalEditarAberto(false);
      setRedefinirSenhaEdicao(false);
      setNovaSenhaEdicao('');
      setConfirmarSenhaEdicao('');
      setFeedback({
        tipo: 'sucesso',
        texto: `Permissões de ${usuarioEmEdicao.nome} atualizadas com sucesso!`,
      });
      notifySuccess('Usuário Atualizado', `Permissões de ${usuarioEmEdicao.nome} foram salvas.`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao atualizar usuário.';
      setFeedback({
        tipo: 'erro',
        texto: msg,
      });
      notifyError('Erro na Atualização', msg);
    }
  };

  // Confirmar Deleção
  const abrirModalDeletar = (usuario: UsuarioAdministrativo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setUsuarioParaDeletar(usuario);
    setModalDeletarAberto(true);
  };

  const lidarComConfirmarDelecao = async () => {
    if (!usuarioParaDeletar) return;

    try {
      await removerUsuarioAdministrativo(usuarioParaDeletar.id);
      setModalDeletarAberto(false);
      setFeedback({
        tipo: 'sucesso',
        texto: `Acesso administrativo de ${usuarioParaDeletar.nome} revogado com sucesso.`,
      });
      notifySuccess('Acesso Revogado', `Credenciais administrativas de ${usuarioParaDeletar.nome} foram canceladas.`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao revogar acesso.';
      setFeedback({
        tipo: 'erro',
        texto: msg,
      });
      notifyError('Erro na Revogação', msg);
    }
  };

  // Ações de Higienização de Duplicatas
  const [limpandoDuplicatas, setLimpandoDuplicatas] = useState(false);
  const [purgandoFantasmas, setPurgandoFantasmas] = useState(false);

  const lidarComHigienizarDuplicatas = async () => {
    setLimpandoDuplicatas(true);
    try {
      const vistos = new Set<string>();
      let removidos = 0;
      for (const u of usuariosAdministrativos) {
        const chave = (u.cpf && u.cpf.replace(/\D/g, '')) || u.email.toLowerCase().trim() || u.id;
        if (vistos.has(chave)) {
          await removerUsuarioAdministrativo(u.id);
          removidos++;
        } else {
          vistos.add(chave);
        }
      }

      if (removidos > 0) {
        setFeedback({
          tipo: 'sucesso',
          texto: `Higienização concluída com sucesso! ${removidos} registro(s) duplicado(s) removido(s).`,
        });
      } else {
        setFeedback({
          tipo: 'sucesso',
          texto: 'Nenhuma duplicata detectada. Todos os acessos administrativos estão consolidados e íntegros.',
        });
      }
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({
        tipo: 'erro',
        texto: err?.message || 'Erro ao higienizar duplicatas.',
      });
    } finally {
      setLimpandoDuplicatas(false);
    }
  };

  const lidarComPurgarFantasmas = async () => {
    setPurgandoFantasmas(true);
    try {
      const count = await purgarUsuariosFantasma();
      if (count > 0) {
        setFeedback({
          tipo: 'sucesso',
          texto: `Expurgo concluído com sucesso! ${count} usuário(s) e acesso(s) fantasma(s) removidos permanentemente.`,
        });
        notifySuccess('Expurgo Realizado', `${count} registros fantasmas expurgados.`);
      } else {
        setFeedback({
          tipo: 'sucesso',
          texto: 'Nenhum usuário ou acesso fantasma detectado. A base está 100% limpa e auditada.',
        });
        notifySuccess('Base Íntegra', 'Nenhum registro fantasma encontrado.');
      }
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback({
        tipo: 'erro',
        texto: err?.message || 'Erro ao expurgar usuários fantasmas.',
      });
      notifyError('Erro no Expurgo', err?.message || 'Falha ao expurgar fantasmas.');
    } finally {
      setPurgandoFantasmas(false);
    }
  };

  // Filtragem
  const usuariosFiltrados = useMemo(() => {
    // Deduplicação defensiva na listagem
    const vistos = new Set<string>();
    const unicos: UsuarioAdministrativo[] = [];
    for (const u of usuariosAdministrativos) {
      const chave = (u.cpf && u.cpf.replace(/\D/g, '')) || u.email.toLowerCase().trim() || u.id;
      if (!vistos.has(chave)) {
        vistos.add(chave);
        unicos.push(u);
      }
    }

    return unicos.filter((u) => {
      if (!u) return false;
      const b = (busca || '').toLowerCase().trim();
      const nomeNorm = (u.nome || '').toLowerCase();
      const cpfNorm = String(u.cpf || '');
      const emailNorm = (u.email || '').toLowerCase();
      const depNorm = (u.departamento || '').toLowerCase();
      const cargoMinNorm = (u.cargoMinisterial || '').toLowerCase();
      const igrejaNorm = (u.igrejaFiliada || '').toLowerCase();

      const bateBusca =
        !b ||
        nomeNorm.includes(b) ||
        cpfNorm.includes(b) ||
        emailNorm.includes(b) ||
        depNorm.includes(b) ||
        cargoMinNorm.includes(b) ||
        igrejaNorm.includes(b);

      const bateCargo = filtroCargo === 'TODOS' || u.cargoAdministrativo === filtroCargo;
      const bateStatus = filtroStatus === 'TODOS' || u.statusAcesso === filtroStatus;

      return bateBusca && bateCargo && bateStatus;
    });
  }, [usuariosAdministrativos, busca, filtroCargo, filtroStatus]);

  // Fatiamento dos usuários por página
  const usuariosExibidos = useMemo(() => {
    if (itensPorPagina === 'TODOS') return usuariosFiltrados;
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return usuariosFiltrados.slice(inicio, inicio + itensPorPagina);
  }, [usuariosFiltrados, paginaAtual, itensPorPagina]);

  // Estatísticas Rápidas
  const totalUsuarios = usuariosAdministrativos.length;
  const totalAtivos = usuariosAdministrativos.filter((u) => u.statusAcesso === 'ATIVO').length;
  const totalAdmins = usuariosAdministrativos.filter(
    (u) =>
      u.cargoAdministrativo === 'Administrador Master' ||
      u.cargoAdministrativo === 'Presidente Geral' ||
      u.role === 'ADMINISTRADOR_MASTER' ||
      u.role === 'PRESIDENTE_GERAL'
  ).length;
  const totalSecretarios = usuariosAdministrativos.filter((u) => u.cargoAdministrativo === 'Secretário').length;
  const totalTesoureiros = usuariosAdministrativos.filter((u) => u.cargoAdministrativo === 'Tesoureiro').length;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-mono flex items-center justify-between shadow-xl animate-fadeIn ${
            feedback.tipo === 'sucesso'
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.tipo === 'sucesso' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{feedback.texto}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white font-mono cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Banner de Governança e Usuários */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-widest text-indigo-400 bg-indigo-950/80 border border-indigo-500/30 px-2 py-0.5 rounded">
                GOVERNANÇA & RBAC
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                • Puxado de Ministros e Mesa Diretora
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white mt-1 flex items-center gap-2">
              <UserCog className="w-7 h-7 text-indigo-400" />
              Gestão de Usuários Administrativos
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Usuários cadastrados no corpo administrativo da convenção. Ao conceder acesso, as informações são puxadas diretamente do cadastro do ministro selecionado.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={lidarComPurgarFantasmas}
              disabled={purgandoFantasmas}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-white text-xs font-bold transition-all border border-rose-500/40 cursor-pointer disabled:opacity-50"
              title="Expurgar permanentemente todos os usuários fantasmas e acessos espúrios"
            >
              <Trash2 className={`w-4 h-4 text-rose-400 ${purgandoFantasmas ? 'animate-spin' : ''}`} />
              <span>{purgandoFantasmas ? 'Expurgando...' : 'Expurgar Fantasmas'}</span>
            </button>

            <button
              onClick={lidarComHigienizarDuplicatas}
              disabled={limpandoDuplicatas}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all border border-slate-700 cursor-pointer disabled:opacity-50"
              title="Consolidar e remover quaisquer registros duplicados"
            >
              <RefreshCw className={`w-4 h-4 text-cyan-400 ${limpandoDuplicatas ? 'animate-spin' : ''}`} />
              <span>{limpandoDuplicatas ? 'Higienizando...' : 'Higienizar Duplicatas'}</span>
            </button>

            <button
              onClick={() => {
                setMinistroSelecionadoId('');
                setModalNovoAberto(true);
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold transition-all shadow-[0_0_25px_rgba(99,102,241,0.3)] cursor-pointer hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>Conceder Acesso</span>
            </button>
          </div>
        </div>

        {/* Grade de Contadores por Perfil */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] font-mono text-slate-400 block uppercase">Total de Acessos</span>
            <span className="text-lg font-black text-white font-mono">{totalUsuarios}</span>
            <span className="text-[9px] text-emerald-400 block font-mono">{totalAtivos} ativos</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/60 border border-amber-500/20">
            <span className="text-[10px] font-mono text-amber-400 block uppercase flex items-center gap-1">
              <Crown className="w-3 h-3" /> Presidente / Master
            </span>
            <span className="text-lg font-black text-amber-300 font-mono">{totalAdmins}</span>
            <span className="text-[9px] text-slate-500 block font-mono">Mesa Diretora (Unicidade 1:1)</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/60 border border-blue-500/20">
            <span className="text-[10px] font-mono text-blue-400 block uppercase flex items-center gap-1">
              <FileText className="w-3 h-3" /> Secretário
            </span>
            <span className="text-lg font-black text-blue-300 font-mono">{totalSecretarios}</span>
            <span className="text-[9px] text-slate-500 block font-mono">Secretaria Geral</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/60 border border-emerald-500/20">
            <span className="text-[10px] font-mono text-emerald-400 block uppercase flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Tesoureiro
            </span>
            <span className="text-lg font-black text-emerald-300 font-mono">{totalTesoureiros}</span>
            <span className="text-[9px] text-slate-500 block font-mono">Finanças & Asaas</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros, Pesquisa e Alternância de Visualização */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF, cargo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-mono text-slate-500">CARGO:</span>
            <select
              value={filtroCargo}
              onChange={(e) => setFiltroCargo(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-1"
            >
              <option value="TODOS" className="bg-slate-900 text-white">Todos os Cargos</option>
              <option value="Presidente Geral" className="bg-slate-900 text-white">Presidente Geral</option>
              <option value="Administrador Master" className="bg-slate-900 text-white">Administrador Master</option>
              <option value="Secretário" className="bg-slate-900 text-white">Secretário</option>
              <option value="Tesoureiro" className="bg-slate-900 text-white">Tesoureiro</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <span className="text-[10px] font-mono text-slate-500">STATUS:</span>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-1"
            >
              <option value="TODOS" className="bg-slate-900 text-white">Todos</option>
              <option value="ATIVO" className="bg-slate-900 text-white">Ativos</option>
              <option value="SUSPENSO" className="bg-slate-900 text-white">Suspensos</option>
              <option value="EM_ANALISE" className="bg-slate-900 text-white">Em Análise</option>
            </select>
          </div>

          {/* Alternador de Visualização */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
            <button
              onClick={() => setModoVisualizacao('tabela')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                modoVisualizacao === 'tabela'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tabela
            </button>
            <button
              onClick={() => setModoVisualizacao('cards')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                modoVisualizacao === 'cards'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cartões
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. VISUALIZAÇÃO EM TABELA (FOTO, NOME, CPF, CARGO, NÍVEL, AÇÕES) */}
      {/* ======================================================== */}
      {modoVisualizacao === 'tabela' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[10px] uppercase">
                  <th className="py-4 px-6 font-bold">Foto / Usuário</th>
                  <th className="py-4 px-4 font-bold">CPF</th>
                  <th className="py-4 px-4 font-bold">Cargo Eclesiástico</th>
                  <th className="py-4 px-4 font-bold">Nível de Acesso (Perfil)</th>
                  <th className="py-4 px-4 font-bold">Departamento</th>
                  <th className="py-4 px-4 font-bold">Status</th>
                  <th className="py-4 px-6 font-bold text-right">Ações (Editar / Deletar)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {usuariosExibidos.map((usuario) => {
                  const config = configuracaoCargo[usuario.cargoAdministrativo] || configuracaoCargo['Administrador Master'];
                  const isMasterAdmin = usuario.cargoAdministrativo === 'Administrador Master' || usuario.role === 'ADMINISTRADOR_MASTER' || usuario.cargoAdministrativo === 'Presidente Geral' || usuario.role === 'PRESIDENTE_GERAL';
                  const isSoleMaster = isMasterAdmin && totalAdmins <= 1;

                  return (
                    <tr
                      key={usuario.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Foto + Nome */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              usuario.fotoUrl ||
                              'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80'
                            }
                            alt={usuario.nome}
                            className="w-11 h-11 rounded-2xl object-cover border border-slate-700 shrink-0 group-hover:border-indigo-500 transition-colors shadow"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-white group-hover:text-indigo-300 transition-colors font-sans truncate max-w-xs">
                              {usuario.nome}
                            </div>
                            <span className="text-[11px] text-slate-400 truncate block">
                              {usuario.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* CPF */}
                      <td className="py-4 px-4">
                        <span className="font-mono text-slate-200 font-bold">{usuario.cpf}</span>
                      </td>

                      {/* Cargo Eclesiástico */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-bold border ${
                            usuario.cargoMinisterial === 'Pastor'
                              ? 'bg-cyan-950/80 text-cyan-400 border-cyan-500/30'
                              : usuario.cargoMinisterial === 'Evangelista'
                              ? 'bg-indigo-950/80 text-indigo-400 border-indigo-500/30'
                              : usuario.cargoMinisterial === 'Presbítero'
                              ? 'bg-amber-950/80 text-amber-400 border-amber-500/30'
                              : 'bg-pink-950/80 text-pink-400 border-pink-500/30'
                          }`}
                        >
                          {usuario.cargoMinisterial || 'Pastor'}
                        </span>
                      </td>

                      {/* Nível de Acesso (Cargo Administrativo & Role) */}
                      <td className="py-4 px-4">
                        <div className="space-y-0.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold border ${config.corBadge}`}
                          >
                            {config.icone}
                            {usuario.cargoAdministrativo}
                          </span>
                          <span className="text-[9px] text-slate-500 block font-mono">
                            NÍVEL: {usuario.role}
                          </span>
                        </div>
                      </td>

                      {/* Departamento */}
                      <td className="py-4 px-4">
                        <div className="text-slate-300 truncate max-w-[180px] font-sans text-xs">
                          {usuario.departamento}
                        </div>
                        <span className="text-[10px] text-slate-500 truncate block font-sans">
                          {usuario.igrejaFiliada}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
                            usuario.statusAcesso === 'ATIVO'
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                              : 'bg-rose-950 text-rose-400 border-rose-500/40'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              usuario.statusAcesso === 'ATIVO'
                                ? 'bg-emerald-400 animate-pulse'
                                : 'bg-rose-400'
                            }`}
                          />
                          {usuario.statusAcesso}
                        </span>
                      </td>

                      {/* Ações: Editar e Deletar */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botão de Editar */}
                          <button
                            onClick={(e) => abrirModalEditar(usuario, e)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-300 transition-colors cursor-pointer"
                            title="Editar Acesso e Permissões"
                          >
                            <Edit3 className="w-4 h-4 text-indigo-400" />
                          </button>

                          {/* Alternar Status */}
                          <button
                            onClick={() =>
                              alterarStatusUsuarioAdministrativo(
                                usuario.id,
                                usuario.statusAcesso === 'ATIVO' ? 'SUSPENSO' : 'ATIVO'
                              )
                            }
                            className={`p-2 rounded-xl transition-colors cursor-pointer ${
                              usuario.statusAcesso === 'ATIVO'
                                ? 'bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400'
                                : 'bg-slate-800 hover:bg-emerald-950 text-slate-400 hover:text-emerald-400'
                            }`}
                            title={usuario.statusAcesso === 'ATIVO' ? 'Suspender Usuário' : 'Reativar Usuário'}
                          >
                            {usuario.statusAcesso === 'ATIVO' ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4 text-emerald-400" />
                            )}
                          </button>

                          {/* Testar Role */}
                          <button
                            onClick={() => alternarOperadorRole(usuario.role)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-cyan-600/30 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                            title={`Simular visão do papel: ${usuario.role}`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Botão de Deletar / Revogar (Protegido apenas se for o único Administrador Master) */}
                          {!isSoleMaster ? (
                            <button
                              onClick={(e) => abrirModalDeletar(usuario, e)}
                              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                              title={isMasterAdmin ? 'Revogar Acesso Duplicado/Secundário' : 'Revogar e Deletar Acesso'}
                            >
                              <Trash2 className="w-4 h-4 text-rose-400" />
                            </button>
                          ) : (
                            <span
                              className="px-2.5 py-1 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold flex items-center gap-1 opacity-90 shadow-sm"
                              title="Único Administrador Master Ativo (Protegido por Regra Estatutária)"
                            >
                              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>Protegido</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ======================================================== */
        /* 2. VISUALIZAÇÃO EM CARTÕES                               */
        /* ======================================================== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {usuariosExibidos.map((usuario) => {
            const config = configuracaoCargo[usuario.cargoAdministrativo] || configuracaoCargo['Administrador Master'];
            const isMasterAdmin = usuario.cargoAdministrativo === 'Administrador Master' || usuario.role === 'ADMINISTRADOR_MASTER' || usuario.cargoAdministrativo === 'Presidente Geral' || usuario.role === 'PRESIDENTE_GERAL';
            const isSoleMaster = isMasterAdmin && totalAdmins <= 1;

            return (
              <div
                key={usuario.id}
                className={`p-6 rounded-3xl bg-slate-900/90 border ${config.corBorda} hover:border-indigo-500/50 transition-all flex flex-col justify-between shadow-xl group relative overflow-hidden`}
              >
                <div className="space-y-4">
                  {/* Header do Card */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={usuario.fotoUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&h=200&q=80'}
                        alt={usuario.nome}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-700 shadow-md group-hover:border-indigo-500 transition-colors"
                      />
                      <div className="min-w-0">
                        <h3 className="font-bold text-white text-base group-hover:text-indigo-300 transition-colors font-sans truncate">
                          {usuario.nome}
                        </h3>
                        <span className="text-xs text-amber-400 font-bold block font-sans">
                          {usuario.cargoMinisterial}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono block">
                          CPF: {usuario.cpf}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[9px] font-mono font-bold flex items-center gap-1 ${
                        usuario.statusAcesso === 'ATIVO'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                          : 'bg-rose-950 text-rose-400 border border-rose-500/40'
                      }`}
                    >
                      {usuario.statusAcesso}
                    </span>
                  </div>

                  {/* Nível de Acesso */}
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold border flex items-center gap-1.5 ${config.corBadge}`}
                      >
                        {config.icone}
                        {usuario.cargoAdministrativo}
                      </span>
                      <span className="text-[9px] font-mono text-indigo-300">
                        {usuario.role}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 font-sans">
                      <span className="text-slate-500 font-mono text-[9px] block">DEPARTAMENTO:</span>
                      {usuario.departamento}
                    </div>
                  </div>

                  {/* Contatos */}
                  <div className="space-y-1.5 text-xs text-slate-400 font-mono">
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate text-slate-300">{usuario.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{usuario.telefone}</span>
                    </div>
                  </div>

                  {/* Permissões */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">
                      Permissões:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(usuario.permissoesEspeciais || []).map((perm, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-300 font-mono"
                        >
                          ✓ {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Botões de Ação do Card */}
                <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => abrirModalEditar(usuario, e)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    <button
                      onClick={() => alternarOperadorRole(usuario.role)}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-all cursor-pointer"
                      title="Testar Role"
                    >
                      <Eye className="w-4 h-4 text-cyan-400" />
                    </button>
                  </div>

                  {!isSoleMaster ? (
                    <button
                      onClick={(e) => abrirModalDeletar(usuario, e)}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition-all cursor-pointer"
                      title={isMasterAdmin ? 'Revogar Acesso Duplicado/Secundário' : 'Deletar Acesso'}
                    >
                      <Trash2 className="w-4 h-4 text-rose-400" />
                    </button>
                  ) : (
                    <span
                      className="px-2 py-1 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold flex items-center gap-1 opacity-90 shadow-sm"
                      title="Único Administrador Master Ativo (Protegido por Regra Estatutária)"
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Protegido</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Componente de Paginação Padronizado 15 / 30 / 50 / TODOS */}
      <PaginacaoGeral
        totalItems={usuariosFiltrados.length}
        itensPorPagina={itensPorPagina}
        paginaAtual={paginaAtual}
        onMudancaPagina={setPaginaAtual}
        onMudancaItensPorPagina={setItensPorPagina}
        opcoesItens={[15, 30, 50, 'TODOS']}
      />

      {usuariosFiltrados.length === 0 && (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-3xl space-y-3">
          <Users className="w-12 h-12 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-white">Nenhum usuário administrativo localizado.</p>
          <p className="text-xs text-slate-400">Ajuste os filtros de busca ou conceda acesso a um ministro.</p>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL RESPONSIVO: CONCEDER ACESSO ADMINISTRATIVO         */}
      {/* (AS INFORMAÇÕES SÃO PUXADAS DO MINISTRO SELECIONADO)     */}
      {/* ======================================================== */}
      {modalNovoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-5 shadow-2xl animate-fadeIn relative my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Conceder Acesso Administrativo</h3>
                  <span className="text-xs text-slate-400">
                    As informações biográficas e eclesiásticas são puxadas do ministro selecionado
                  </span>
                </div>
              </div>
              <button
                onClick={() => setModalNovoAberto(false)}
                className="text-slate-400 hover:text-white text-sm font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={lidarComSalvarUsuario} className="space-y-4 text-xs font-mono">
              {/* Opção de Origem: Puxar da Mesa Diretora ou do Quadro Geral de Ministros */}
              <div className="flex items-center gap-2 p-1 bg-slate-950 border border-slate-800 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setOrigemSelecao('mesa')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    origemSelecao === 'mesa'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>Puxar da Mesa Diretora ({membrosMesaDiretora.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrigemSelecao('ministros')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    origemSelecao === 'ministros'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Quadro Geral de Ministros ({ministros.length})</span>
                </button>
              </div>

              {/* 1. Seleção do Ministro (Apresenta APENAS o Nome no select; as informações completas aparecem abaixo) */}
              <div className="space-y-1.5">
                <label className="block text-slate-300 font-bold uppercase text-[11px]">
                  1. Selecionar Ministro para Conceder Acesso *
                </label>

                {origemSelecao === 'mesa' ? (
                  <select
                    required
                    value={ministroSelecionadoId}
                    onChange={(e) => lidarComSelecaoMinistro(e.target.value)}
                    className="w-full bg-slate-950 border border-amber-500/40 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 font-sans text-xs"
                  >
                    <option value="">-- Selecione o ministro da Mesa Diretora --</option>
                    {membrosMesaDiretora.map((m) => (
                      <option key={m.id} value={m.ministroId}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    required
                    value={ministroSelecionadoId}
                    onChange={(e) => lidarComSelecaoMinistro(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 font-sans text-xs"
                  >
                    <option value="">-- Selecione o ministro filiado --</option>
                    {ministros.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* CARD DE INFORMAÇÕES AUTOMATICAMENTE PUXADAS DO MINISTRO QUANDO SELECIONADO */}
              {ministroSelecionadoObj ? (
                <div className="p-4 rounded-2xl bg-slate-950/90 border border-indigo-500/40 space-y-3.5 animate-fadeIn shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Dados do Ministro Selecionado:</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      ID: {ministroSelecionadoObj.id}
                    </span>
                  </div>

                  <div className="flex items-start gap-4">
                    <img
                      src={
                        ministroSelecionadoObj.fotoUrl ||
                        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&h=200&q=80'
                      }
                      alt={ministroSelecionadoObj.nome}
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500/40 shadow shrink-0"
                    />

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/30">
                          {ministroSelecionadoObj.cargo}
                        </span>
                        <span className="text-[10px] text-amber-400 font-bold font-mono">
                          {ministroSelecionadoObj.registroMinisterial || gerarRegistroMinisterial(ministroSelecionadoObj.cpf)}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                          {ministroSelecionadoObj.status}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-slate-900 text-slate-300 border border-slate-700">
                          {ministroSelecionadoObj.statusAdimplencia || 'ADIMPLENTE'}
                        </span>
                      </div>
                      <h4 className="text-sm sm:text-base font-bold text-white font-sans truncate">
                        {ministroSelecionadoObj.nome}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-slate-400 font-mono flex-wrap">
                        <span>CPF: <strong className="text-slate-200">{ministroSelecionadoObj.cpf}</strong></span>
                        <span>•</span>
                        <span>RG: <strong className="text-slate-200">{ministroSelecionadoObj.rg || 'SSP/BA'}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Informações de Lotação Eclesiástica e Contatos Oficiais */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-slate-800/80">
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-0.5">
                      <span className="text-[9px] text-slate-500 uppercase block">Igreja Filiada</span>
                      <span className="text-slate-200 font-bold truncate block">
                        {ministroSelecionadoObj.igrejaFiliadaNome || 'AD Central Filiada CIMADEBE'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-emerald-500/30 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-emerald-400 uppercase font-bold flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-400" />
                          Telefone do Ministro (Vinculado)
                        </span>
                        <span className="text-[9px] text-slate-400">Sem redigitação</span>
                      </div>
                      <span className="text-emerald-300 font-bold truncate block flex items-center gap-1.5 text-xs">
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        {ministroSelecionadoObj.telefone || '(71) 98888-0000'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-0.5 sm:col-span-2">
                      <span className="text-[9px] text-slate-500 uppercase block">E-mail Cadastrado na Convenção</span>
                      <span className="text-slate-300 font-mono truncate block">
                        {ministroSelecionadoObj.email || 'Não informado'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-1.5 animate-fadeIn">
                  <div className="flex items-center justify-center gap-2 text-indigo-400 font-sans text-xs">
                    <UserCheck className="w-4 h-4" />
                    <span className="font-bold">Nenhum ministro selecionado</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Selecione o ministro no campo acima para carregar automaticamente todas as informações biográficas, eclesiásticas e o telefone vinculado.
                  </p>
                </div>
              )}

              {/* 2. Seleção de Cargo Administrativo (RBAC) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-300 font-bold uppercase text-[11px]">
                    2. Cargo Administrativo & Nível de Acesso (Perfil RBAC) *
                  </label>
                  {usuariosAdministrativos.some(
                    (u) => (u.cargoAdministrativo === 'Administrador Master' || u.cargoAdministrativo === 'Presidente Geral') && u.statusAcesso === 'ATIVO'
                  ) && (
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-950/70 px-2 py-0.5 rounded-lg border border-amber-500/30 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-amber-400" /> Cargos Principais Ocupados
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {(['Presidente Geral', 'Administrador Master', 'Secretário', 'Tesoureiro'] as CargoAdministrativo[]).map(
                    (cargo) => {
                      const cargoOcupado = (cargo === 'Administrador Master' || cargo === 'Presidente Geral') && usuariosAdministrativos.some(
                        (u) => u.cargoAdministrativo === cargo && u.statusAcesso === 'ATIVO'
                      );

                      return (
                        <button
                          type="button"
                          key={cargo}
                          disabled={cargoOcupado}
                          onClick={() => lidarComTrocaCargo(cargo)}
                          className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                            cargoOcupado
                              ? 'opacity-40 cursor-not-allowed bg-slate-950/50 border-slate-800 text-slate-500'
                              : cargoAdminSelecionado === cargo
                              ? 'bg-indigo-600 text-white border-indigo-400 shadow cursor-pointer'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white cursor-pointer'
                          }`}
                        >
                          <span className="block font-sans">{cargo}</span>
                          <span className="text-[9px] font-mono text-indigo-200/70 block mt-0.5">
                            {mapaRolePorCargo[cargo]} {cargoOcupado ? '(Bloqueado - Já Ativo)' : ''}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* 3. Departamento e Email Corporativo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-400 text-[10px] uppercase font-bold">
                    Departamento / Comissão:
                  </label>
                  <input
                    type="text"
                    required
                    value={departamento}
                    onChange={(e) => setDepartamento(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-400 text-[10px] uppercase font-bold">
                    Email Corporativo de Acesso:
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="usuario@cimadebe.org.br"
                    value={emailCorporativo}
                    onChange={(e) => setEmailCorporativo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* 4. CRIAÇÃO DE SENHA COM MEDIDOR DE SEGURANÇA E REGRAS EXPLÍCITAS */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-indigo-500/30 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-emerald-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white font-sans">
                        Criar Senha de Acesso do Operador
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Padrão bancário com verificação e apresentação ao administrador
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={gerarSenhaAutomatica}
                    className="px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] font-mono flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto shadow"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Gerar Senha Automática Segura</span>
                  </button>
                </div>

                {/* Campos de Senha e Confirmação */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
                      <label>Senha de Acesso *</label>
                      {senha && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(senha);
                            setSenhaCopiada(true);
                            setTimeout(() => setSenhaCopiada(false), 2500);
                          }}
                          className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer font-mono lowercase"
                        >
                          {senhaCopiada ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{senhaCopiada ? 'copiada!' : 'copiar'}</span>
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={mostrarSenha ? 'text' : 'password'}
                        required
                        placeholder="Digite a senha..."
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-3 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenha(!mostrarSenha)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                        title={mostrarSenha ? 'Ocultar senha' : 'Ver senha'}
                      >
                        {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-400 text-[10px] uppercase font-bold">
                      Confirmar Senha *
                    </label>
                    <div className="relative">
                      <input
                        type={mostrarConfirmarSenha ? 'text' : 'password'}
                        required
                        placeholder="Repita a senha..."
                        value={confirmarSenha}
                        onChange={(e) => setConfirmarSenha(e.target.value)}
                        className={`w-full bg-slate-900 border rounded-xl pl-3 pr-10 py-2.5 text-xs text-white focus:outline-none font-mono ${
                          confirmarSenha
                            ? analiseSenha.confereConfirmacao
                              ? 'border-emerald-500/60 focus:border-emerald-500'
                              : 'border-rose-500/60 focus:border-rose-500'
                            : 'border-slate-800 focus:border-indigo-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                        title={mostrarConfirmarSenha ? 'Ocultar senha' : 'Ver senha'}
                      >
                        {mostrarConfirmarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* MEDIDOR DE FORÇA DA SENHA */}
                {senha && (
                  <div className="space-y-2 pt-1 animate-fadeIn">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">Nível de Segurança da Senha:</span>
                      <span className={`font-bold flex items-center gap-1 ${analiseSenha.corTexto}`}>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {analiseSenha.label} ({analiseSenha.score}%)
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                      <div
                        className={`h-full transition-all duration-300 ${analiseSenha.corBarra}`}
                        style={{ width: `${analiseSenha.score}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* REGRAS DE SEGURANÇA QUE DEVE SEGUIR (CHECKLIST DINÂMICO) */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider block">
                    Regras Obrigatórias de Segurança da Senha:
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] font-mono">
                    <div className={`flex items-center gap-2 ${analiseSenha.temMinimo8 ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {analiseSenha.temMinimo8 ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                      <span>Mínimo de 8 caracteres {analiseSenha.temRecomendado12 && '(12+ ideal ✓)'}</span>
                    </div>

                    <div className={`flex items-center gap-2 ${analiseSenha.temMaiuscula ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {analiseSenha.temMaiuscula ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                      <span>Ao menos 1 letra maiúscula (A-Z)</span>
                    </div>

                    <div className={`flex items-center gap-2 ${analiseSenha.temMinuscula ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {analiseSenha.temMinuscula ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                      <span>Ao menos 1 letra minúscula (a-z)</span>
                    </div>

                    <div className={`flex items-center gap-2 ${analiseSenha.temNumero ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {analiseSenha.temNumero ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                      <span>Ao menos 1 dígito numérico (0-9)</span>
                    </div>

                    <div className={`flex items-center gap-2 ${analiseSenha.temEspecial ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {analiseSenha.temEspecial ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                      <span>Ao menos 1 caractere especial (!@#$%&*_-+=)</span>
                    </div>

                    <div className={`flex items-center gap-2 ${senha ? (analiseSenha.semSequenciaObvia ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'}`}>
                      {senha && analiseSenha.semSequenciaObvia ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                      <span>Sem termos óbvios (ex: 1234, admin, senha)</span>
                    </div>

                    <div className={`flex items-center gap-2 ${confirmarSenha ? (analiseSenha.confereConfirmacao ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'}`}>
                      {confirmarSenha && analiseSenha.confereConfirmacao ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>
                        {confirmarSenha
                          ? analiseSenha.confereConfirmacao
                            ? 'Confirmação confere ✓'
                            : 'Senhas não coincidem'
                          : 'Confirmação obrigatória'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalNovoAberto(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!ministroSelecionadoId || !analiseSenha.atendeRequisitosMinimos || !analiseSenha.confereConfirmacao}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Conceder Acesso</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL DE APRESENTAÇÃO DE CREDENCIAIS GERADAS AO ADMIN     */}
      {/* ======================================================== */}
      {credenciaisCriadasModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative my-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-sans">
                    Acesso Concedido com Sucesso!
                  </h3>
                  <span className="text-xs text-emerald-400 font-mono">
                    Credenciais prontas para apresentação ao ministro
                  </span>
                </div>
              </div>
              <button
                onClick={() => setCredenciaisCriadasModal(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Informações da Conta Criada */}
            <div className="space-y-3 font-mono text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Ministro Operador</span>
                <span className="text-white font-bold text-sm block font-sans">{credenciaisCriadasModal.nome}</span>
                <span className="text-indigo-400 text-[11px] block">{credenciaisCriadasModal.cargo} ({credenciaisCriadasModal.role})</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] uppercase font-bold block">E-mail Corporativo de Login</span>
                <span className="text-cyan-300 font-bold text-sm block">{credenciaisCriadasModal.email}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 text-[10px] uppercase font-bold flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" />
                    <span>Senha de Acesso Gerada</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/40">
                    PADRÃO BANCÁRIO
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-white font-black text-sm tracking-wider font-mono">
                    {credenciaisCriadasModal.senha}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(credenciaisCriadasModal.senha);
                      setSenhaCopiada(true);
                      setTimeout(() => setSenhaCopiada(false), 2500);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Copiar Senha"
                  >
                    {senhaCopiada ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Telefone Vinculado (WhatsApp)</span>
                <span className="text-slate-300 font-bold block">{credenciaisCriadasModal.telefone}</span>
              </div>
            </div>

            {/* Ações de Apresentação e Envio */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const mensagem = `🏛️ *CONVENÇÃO CIMADEBE / SIGM*\nOlá, ${credenciaisCriadasModal.nome}!\nSeu acesso administrativo ao ecossistema foi concedido:\n\n👤 *Cargo:* ${credenciaisCriadasModal.cargo}\n📧 *E-mail de Login:* ${credenciaisCriadasModal.email}\n🔑 *Senha de Acesso:* ${credenciaisCriadasModal.senha}\n\nAcesse o portal e efetue o login para começar.`;
                  navigator.clipboard.writeText(mensagem);
                  setCopiadoGeral(true);
                  setTimeout(() => setCopiadoGeral(false), 3000);
                }}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs font-mono flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer"
              >
                {copiadoGeral ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-white" />}
                <span>{copiadoGeral ? 'Mensagem de Acesso Copiada!' : 'Copiar Mensagem para Envio ao Ministro'}</span>
              </button>

              <button
                type="button"
                onClick={() => setCredenciaisCriadasModal(null)}
                className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold transition-all cursor-pointer"
              >
                Concluir & Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL RESPONSIVO: EDITAR USUÁRIO ADMINISTRATIVO          */}
      {/* ======================================================== */}
      {modalEditarAberto && usuarioEmEdicao && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-5 shadow-2xl animate-fadeIn relative my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Editar Acesso: {usuarioEmEdicao.nome}</h3>
                  <span className="text-xs text-slate-400">
                    Cargo Eclesiástico: {usuarioEmEdicao.cargoMinisterial} • CPF: {usuarioEmEdicao.cpf}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setModalEditarAberto(false)}
                className="text-slate-400 hover:text-white text-sm font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={lidarComSalvarEdicao} className="space-y-4 text-xs font-mono">
              {/* Foto & Identificação */}
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <img
                  src={usuarioEmEdicao.fotoUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80'}
                  alt={usuarioEmEdicao.nome}
                  className="w-14 h-14 rounded-2xl object-cover border border-slate-700 shadow"
                />
                <div>
                  <h4 className="font-bold text-white text-sm font-sans">{usuarioEmEdicao.nome}</h4>
                  <p className="text-[11px] text-amber-400 font-sans">{usuarioEmEdicao.cargoMinisterial}</p>
                  <p className="text-[10px] text-slate-500">{usuarioEmEdicao.igrejaFiliada}</p>
                </div>
              </div>

              {/* Cargo Administrativo */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-300 font-bold uppercase text-[10px]">
                    Nível de Acesso (Cargo Administrativo):
                  </label>
                  {usuariosAdministrativos.some(
                    (u) =>
                      (u.cargoAdministrativo === 'Administrador Master' || u.cargoAdministrativo === 'Presidente Geral') &&
                      u.statusAcesso === 'ATIVO' &&
                      u.id !== usuarioEmEdicao.id
                  ) && (
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-950/70 px-2 py-0.5 rounded-lg border border-amber-500/30 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-amber-400" /> Cargos Principais Ocupados
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {(['Presidente Geral', 'Administrador Master', 'Secretário', 'Tesoureiro'] as CargoAdministrativo[]).map(
                    (cargo) => {
                      const cargoOcupado =
                        (cargo === 'Administrador Master' || cargo === 'Presidente Geral') &&
                        usuariosAdministrativos.some(
                          (u) =>
                            u.cargoAdministrativo === cargo &&
                            u.statusAcesso === 'ATIVO' &&
                            u.id !== usuarioEmEdicao.id
                        );

                      return (
                        <button
                          type="button"
                          key={cargo}
                          disabled={cargoOcupado}
                          onClick={() => lidarComTrocaCargo(cargo)}
                          className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                            cargoOcupado
                              ? 'opacity-40 cursor-not-allowed bg-slate-950/50 border-slate-800 text-slate-500'
                              : cargoAdminSelecionado === cargo
                              ? 'bg-indigo-600 text-white border-indigo-400 shadow cursor-pointer'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white cursor-pointer'
                          }`}
                        >
                          <span className="block font-sans">{cargo}</span>
                          <span className="text-[9px] font-mono text-indigo-200/70 block mt-0.5">
                            {mapaRolePorCargo[cargo]} {cargoOcupado ? '(Bloqueado)' : ''}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Departamento e Contato */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-400 text-[10px] uppercase font-bold">Departamento:</label>
                  <input
                    type="text"
                    required
                    value={departamento}
                    onChange={(e) => setDepartamento(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500 font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-400 text-[10px] uppercase font-bold">Email:</label>
                  <input
                    type="email"
                    required
                    value={emailCorporativo}
                    onChange={(e) => setEmailCorporativo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Telefone Oficial Vinculado ao Ministro (Read-only) */}
              <div className="space-y-1">
                <label className="block text-slate-400 text-[10px] uppercase font-bold">
                  Telefone Oficial (Vinculado ao Ministro):
                </label>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/30 text-emerald-400 font-mono text-xs flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="font-bold">{usuarioEmEdicao.telefone || '(71) 98888-0000'}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans">
                    Sincronizado automaticamente do cadastro do ministro
                  </span>
                </div>
              </div>

              {/* Opção de Redefinir Senha do Usuário com Segurança Bancária */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="text-xs font-bold text-white block font-sans">
                        Redefinir Senha de Acesso
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Crie uma nova senha segura para o operador se necessário
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRedefinirSenhaEdicao(!redefinirSenhaEdicao);
                      if (!redefinirSenhaEdicao) {
                        setNovaSenhaEdicao('');
                        setConfirmarSenhaEdicao('');
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                      redefinirSenhaEdicao
                        ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                        : 'bg-indigo-950 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-900'
                    }`}
                  >
                    {redefinirSenhaEdicao ? 'Cancelar Troca de Senha' : 'Trocar Senha'}
                  </button>
                </div>

                {redefinirSenhaEdicao && (
                  <div className="space-y-3 pt-2 border-t border-slate-800 animate-fadeIn">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={gerarSenhaAutomaticaEdicao}
                        className="px-2.5 py-1 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-[10px] font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3 text-emerald-400" />
                        <span>Gerar Senha Automática</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold">
                          <label>Nova Senha *</label>
                          {novaSenhaEdicao && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(novaSenhaEdicao);
                                setSenhaEdicaoCopiada(true);
                                setTimeout(() => setSenhaEdicaoCopiada(false), 2000);
                              }}
                              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono text-[9px] lowercase cursor-pointer"
                            >
                              {senhaEdicaoCopiada ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              <span>{senhaEdicaoCopiada ? 'copiada!' : 'copiar'}</span>
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type={mostrarSenhaEdicao ? 'text' : 'password'}
                            value={novaSenhaEdicao}
                            onChange={(e) => setNovaSenhaEdicao(e.target.value)}
                            placeholder="Nova senha..."
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-3 pr-9 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setMostrarSenhaEdicao(!mostrarSenhaEdicao)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                          >
                            {mostrarSenhaEdicao ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-slate-400 text-[10px] uppercase font-bold">Confirmar Nova Senha *</label>
                        <div className="relative">
                          <input
                            type={mostrarConfirmarSenhaEdicao ? 'text' : 'password'}
                            value={confirmarSenhaEdicao}
                            onChange={(e) => setConfirmarSenhaEdicao(e.target.value)}
                            placeholder="Repita a senha..."
                            className={`w-full bg-slate-900 border rounded-xl pl-3 pr-9 py-2 text-xs text-white focus:outline-none font-mono ${
                              confirmarSenhaEdicao
                                ? analiseSenhaEdicao.confereConfirmacao
                                  ? 'border-emerald-500/60'
                                  : 'border-rose-500/60'
                                : 'border-slate-800'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setMostrarConfirmarSenhaEdicao(!mostrarConfirmarSenhaEdicao)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                          >
                            {mostrarConfirmarSenhaEdicao ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Medidor de força na edição */}
                    {novaSenhaEdicao && (
                      <div className="space-y-1.5 pt-1 animate-fadeIn">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-slate-400">Segurança da Nova Senha:</span>
                          <span className={`font-bold flex items-center gap-1 ${analiseSenhaEdicao.corTexto}`}>
                            <ShieldCheck className="w-3 h-3" />
                            {analiseSenhaEdicao.label} ({analiseSenhaEdicao.score}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                          <div
                            className={`h-full transition-all duration-300 ${analiseSenhaEdicao.corBarra}`}
                            style={{ width: `${analiseSenhaEdicao.score}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Checklist de regras na edição */}
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5 text-[10px] font-mono">
                      <span className="text-slate-400 font-bold uppercase block">Regras para a Nova Senha:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        <div className={`flex items-center gap-1.5 ${analiseSenhaEdicao.temMinimo8 ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {analiseSenhaEdicao.temMinimo8 ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <AlertTriangle className="w-3 h-3 shrink-0" />}
                          <span>Mínimo 8 caracteres (12+ ideal)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${analiseSenhaEdicao.temMaiuscula ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {analiseSenhaEdicao.temMaiuscula ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <AlertTriangle className="w-3 h-3 shrink-0" />}
                          <span>Ao menos 1 maiúscula (A-Z)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${analiseSenhaEdicao.temMinuscula ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {analiseSenhaEdicao.temMinuscula ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <AlertTriangle className="w-3 h-3 shrink-0" />}
                          <span>Ao menos 1 minúscula (a-z)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${analiseSenhaEdicao.temNumero ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {analiseSenhaEdicao.temNumero ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <AlertTriangle className="w-3 h-3 shrink-0" />}
                          <span>Ao menos 1 número (0-9)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${analiseSenhaEdicao.temEspecial ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {analiseSenhaEdicao.temEspecial ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <AlertTriangle className="w-3 h-3 shrink-0" />}
                          <span>Ao menos 1 especial (!@#$...)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${confirmarSenhaEdicao ? (analiseSenhaEdicao.confereConfirmacao ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'}`}>
                          {confirmarSenhaEdicao && analiseSenhaEdicao.confereConfirmacao ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <AlertTriangle className="w-3 h-3 shrink-0" />}
                          <span>Confirmação confere</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Botões */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalEditarAberto(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL RESPONSIVO: CONFIRMAR EXCLUSÃO / REVOGAÇÃO         */}
      {/* ======================================================== */}
      {modalDeletarAberto && usuarioParaDeletar && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fadeIn my-auto">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-white text-base">Revogar Acesso Administrativo</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Você está prestes a revogar as permissões administrativas do ministro{' '}
              <strong className="text-white">{usuarioParaDeletar.nome}</strong> ({usuarioParaDeletar.cargoMinisterial} - CPF:{' '}
              {usuarioParaDeletar.cpf}) no cargo de{' '}
              <strong className="text-rose-300">{usuarioParaDeletar.cargoAdministrativo}</strong>.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setModalDeletarAberto(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={lidarComConfirmarDelecao}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-lg cursor-pointer"
              >
                Confirmar Revogação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
