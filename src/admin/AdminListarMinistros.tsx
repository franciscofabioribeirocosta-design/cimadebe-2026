import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MinisterialCard } from '../components/MinisterialCard';
import { PaginacaoGeral } from '../components/PaginacaoGeral';
import { DossieMinisterialModal } from '../components/DossieMinisterialModal';
import { validarCPF } from '../security/validationAndSanitization';
import { exportarPdfTabelaMinistrosFiltrados } from '../services/pdfExportService';
import { getSystemDate, formatarDataBR } from '../financialEngine';
import {
  Users,
  Search,
  Filter,
  UserCheck,
  UserX,
  Edit3,
  Trash2,
  Eye,
  Plus,
  Shield,
  Building2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  ChevronRight,
  MapPin,
  RefreshCw,
  Upload,
  Image as ImageIcon,
  X,
  Camera,
  Award,
  Calendar,
  BookOpen,
  Briefcase,
  Heart,
  Phone,
  Mail,
  CreditCard,
  Download,
  Paperclip,
  Check,
  Crown,
  Sparkles,
  BadgeCheck,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  User,
  ExternalLink,
  LayoutGrid,
} from 'lucide-react';
import { useSecurity } from '../SecurityContext';
import { useNotification } from '../NotificationContext';
import { consultarCep, consultarMunicipiosIbge } from '../utils/lookup';
import { formatarRotuloStatus, obterBadgeClassStatus } from '../financialEngine';
import { AdimplenciaBadge } from '../components/AdimplenciaBadge';
import { z } from 'zod';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const schemaMinistroEdicao = z.object({
  nome: z.string().min(3, 'Nome do ministro deve ter no mínimo 3 caracteres').trim(),
  cpf: z
    .string()
    .transform((val) => val.replace(/\D/g, ''))
    .refine((val) => val.length === 11, 'CPF deve conter exatamente 11 dígitos numéricos'),
  email: z.string().email('E-mail inválido').toLowerCase().trim().or(z.literal('')),
  cargo: z.string().min(2, 'Cargo ministerial é obrigatório').trim(),
  telefone: z.string().optional(),
});
import {
  CARGOS_ECLESIASTICOS,
  PROFISSOES_CIVIS,
  OPCOES_ESCOLARIDADE,
  ESTADOS_BRASIL,
  gerarRegistroMinisterial,
} from '../types';
import type {
  Ministro,
  StatusMinistro,
  StatusAdimplencia,
  CargoEclesiastico,
  DocumentoAnexoMinistro,
  IgrejaFiliada,
} from '../types';

function renderValidadorSenha(senha: string) {
  const minLength = senha.length >= 6;
  const hasUpper = /[A-Z]/.test(senha);
  const hasLower = /[a-z]/.test(senha);
  const hasNumber = /\d/.test(senha);

  return (
    <div className="mt-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-[11px] font-mono">
      <div className="text-slate-400 font-bold mb-1">Requisitos de Segurança da Senha:</div>
      <div className={`flex items-center gap-1.5 ${minLength ? 'text-emerald-400' : 'text-slate-500'}`}>
        <span>{minLength ? '✓' : '•'}</span> Mínimo de 6 caracteres
      </div>
      <div className={`flex items-center gap-1.5 ${hasUpper ? 'text-emerald-400' : 'text-slate-500'}`}>
        <span>{hasUpper ? '✓' : '•'}</span> Pelo menos uma letra maiúscula (A-Z)
      </div>
      <div className={`flex items-center gap-1.5 ${hasLower ? 'text-emerald-400' : 'text-slate-500'}`}>
        <span>{hasLower ? '✓' : '•'}</span> Pelo menos uma letra minúscula (a-z)
      </div>
      <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400' : 'text-slate-500'}`}>
        <span>{hasNumber ? '✓' : '•'}</span> Pelo menos um número (0-9)
      </div>
    </div>
  );
}

// Mapeamento e Estilização Exclusiva de Cores para Membros da Mesa Diretora
function obterEstiloMesa(ministro: Ministro, membrosMesa: readonly any[]) {
  const minCpfLimpo = (ministro.cpf || '').replace(/\D/g, '');
  const membro = membrosMesa.find(
    (m) =>
      (m.ministroId && m.ministroId === ministro.id) ||
      (m.cpf && minCpfLimpo.length >= 8 && m.cpf.replace(/\D/g, '') === minCpfLimpo)
  );

  if (!membro) return null;

  const cargoLower = (membro.cargoMesa || '').toLowerCase();

  // 1. Presidente Geral / Presidente da Mesa (Dourado Nobre)
  if (
    cargoLower.includes('presidente geral') ||
    cargoLower.includes('presidente da mesa') ||
    cargoLower === 'presidente'
  ) {
    return {
      cargoMesa: membro.cargoMesa || 'Presidente Geral da Mesa',
      badgeClass:
        'bg-gradient-to-r from-amber-500/25 to-yellow-500/20 text-amber-300 border border-amber-400/60 shadow-[0_0_10px_rgba(245,158,11,0.25)] font-black',
      rowClass:
        'bg-gradient-to-r from-amber-950/40 via-amber-900/15 to-slate-900/90 border-l-4 border-l-amber-400 hover:from-amber-950/60 hover:to-slate-850',
      photoClass:
        'ring-2 ring-amber-400 border-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.5)]',
      icon: Crown,
      iconColor: 'text-amber-400',
    };
  }

  // 2. Vice-Presidentes (Índigo / Púrpura Real)
  if (cargoLower.includes('vice-presidente') || cargoLower.includes('vice presidente')) {
    return {
      cargoMesa: membro.cargoMesa,
      badgeClass:
        'bg-gradient-to-r from-indigo-500/25 to-purple-500/20 text-indigo-300 border border-indigo-400/60 shadow-[0_0_10px_rgba(99,102,241,0.25)] font-bold',
      rowClass:
        'bg-gradient-to-r from-indigo-950/40 via-indigo-900/15 to-slate-900/90 border-l-4 border-l-indigo-400 hover:from-indigo-950/60 hover:to-slate-850',
      photoClass:
        'ring-2 ring-indigo-400 border-indigo-400 shadow-[0_0_14px_rgba(99,102,241,0.5)]',
      icon: Award,
      iconColor: 'text-indigo-400',
    };
  }

  // 3. Secretários (Verde Esmeralda / Teal Executivo)
  if (cargoLower.includes('secretár') || cargoLower.includes('secretar')) {
    return {
      cargoMesa: membro.cargoMesa,
      badgeClass:
        'bg-gradient-to-r from-teal-500/25 to-emerald-500/20 text-teal-300 border border-teal-400/60 shadow-[0_0_10px_rgba(20,184,166,0.25)] font-bold',
      rowClass:
        'bg-gradient-to-r from-teal-950/40 via-teal-900/15 to-slate-900/90 border-l-4 border-l-teal-400 hover:from-teal-950/60 hover:to-slate-850',
      photoClass:
        'ring-2 ring-teal-400 border-teal-400 shadow-[0_0_14px_rgba(20,184,166,0.5)]',
      icon: FileText,
      iconColor: 'text-teal-400',
    };
  }

  // 4. Tesoureiros (Verde Ciano / Financeiro)
  if (cargoLower.includes('tesoureir') || cargoLower.includes('financeir')) {
    return {
      cargoMesa: membro.cargoMesa,
      badgeClass:
        'bg-gradient-to-r from-emerald-500/25 to-cyan-500/20 text-emerald-300 border border-emerald-400/60 shadow-[0_0_10px_rgba(16,185,129,0.25)] font-bold',
      rowClass:
        'bg-gradient-to-r from-emerald-950/40 via-emerald-900/15 to-slate-900/90 border-l-4 border-l-emerald-400 hover:from-emerald-950/60 hover:to-slate-850',
      photoClass:
        'ring-2 ring-emerald-400 border-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.5)]',
      icon: DollarSign,
      iconColor: 'text-emerald-400',
    };
  }

  // 5. Conselho Fiscal, Ética ou Jurídico (Violeta / Púrpura)
  if (
    cargoLower.includes('fiscal') ||
    cargoLower.includes('ética') ||
    cargoLower.includes('jurídic') ||
    cargoLower.includes('conselho') ||
    cargoLower.includes('disciplina')
  ) {
    return {
      cargoMesa: membro.cargoMesa,
      badgeClass:
        'bg-gradient-to-r from-violet-500/25 to-purple-500/20 text-violet-300 border border-violet-400/60 shadow-[0_0_10px_rgba(139,92,246,0.25)] font-bold',
      rowClass:
        'bg-gradient-to-r from-violet-950/40 via-violet-900/15 to-slate-900/90 border-l-4 border-l-violet-400 hover:from-violet-950/60 hover:to-slate-850',
      photoClass:
        'ring-2 ring-violet-400 border-violet-400 shadow-[0_0_14px_rgba(139,92,246,0.5)]',
      icon: Shield,
      iconColor: 'text-violet-400',
    };
  }

  // 6. Outros Cargos Estatutários da Mesa (Azul Celeste)
  return {
    cargoMesa: membro.cargoMesa,
    badgeClass:
      'bg-gradient-to-r from-sky-500/25 to-blue-500/20 text-sky-300 border border-sky-400/60 shadow-[0_0_10px_rgba(14,165,233,0.25)] font-bold',
    rowClass:
      'bg-gradient-to-r from-sky-950/40 via-sky-900/15 to-slate-900/90 border-l-4 border-l-sky-400 hover:from-sky-950/60 hover:to-slate-850',
    photoClass:
      'ring-2 ring-sky-400 border-sky-400 shadow-[0_0_14px_rgba(14,165,233,0.5)]',
    icon: Sparkles,
    iconColor: 'text-sky-400',
  };
}

interface AdminListarMinistrosProps {
  readonly onSelecionarMinistro?: (ministroId: string) => void;
  readonly onAcessarPortal?: (ministroId: string) => void;
  readonly filtroInicialAdimplencia?: string;
}

export function AdminListarMinistros({
  onSelecionarMinistro = () => {},
  onAcessarPortal,
  filtroInicialAdimplencia = 'TODOS',
}: AdminListarMinistrosProps = {}) {
  const {
    ministros,
    igrejasFiliadas,
    editarMinistro,
    deletarMinistro,
    alternarStatusMinistro,
    cadastrarMinistro,
    editarIgreja,
    tenantAtivoId,
    membrosMesaDiretora,
    appConfig,
    anuidades,
    inscricoesAGO,
  } = useSecurity();
  const { notifySuccess, notifyError, notifyWarning } = useNotification();

  // Estados de Filtro e Busca
  const [busca, setBusca] = useState('');
  const [filtroCargo, setFiltroCargo] = useState('TODOS');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [filtroAdimplencia, setFiltroAdimplencia] = useState(filtroInicialAdimplencia || 'TODOS');
  const [modoVisualizacao, setModoVisualizacao] = useState<'cards' | 'tabela'>('cards');

  useEffect(() => {
    if (filtroInicialAdimplencia) {
      setFiltroAdimplencia(filtroInicialAdimplencia);
      setPaginaAtual(1);
    }
  }, [filtroInicialAdimplencia]);

  // Estado Modal Dossiê Ministerial
  const [ministroDossie, setMinistroDossie] = useState<Ministro | null>(null);

  // Paginação (15 / 30 / 50 / TODOS)
  const [itensPorPagina, setItensPorPagina] = useState<number | 'TODOS'>(15);
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Estados de Modais
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [ministroEmEdicao, setMinistroEmEdicao] = useState<Ministro | null>(null);
  const [modalDeletarAberto, setModalDeletarAberto] = useState(false);
  const [ministroParaDeletar, setMinistroParaDeletar] = useState<Ministro | null>(null);
  const [justificativaDelecao, setJustificativaDelecao] = useState('');
  const [deletandoMinistro, setDeletandoMinistro] = useState(false);
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [abaFormulario, setAbaFormulario] = useState<'pessoal' | 'eclesiastico' | 'contato' | 'documentos'>('pessoal');
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Referência para os inputs de upload de foto e documentos
  const inputUploadNovoFotoRef = useRef<HTMLInputElement | null>(null);
  const inputUploadEditFotoRef = useRef<HTMLInputElement | null>(null);
  const inputUploadNovoDocRef = useRef<HTMLInputElement | null>(null);
  const inputUploadEditDocRef = useRef<HTMLInputElement | null>(null);

  // Estado para visualizador de documento
  const [documentoVisualizar, setDocumentoVisualizar] = useState<DocumentoAnexoMinistro | null>(null);

  // Documento temporário para anexo
  const [novoDocTipo, setNovoDocTipo] = useState<DocumentoAnexoMinistro['tipo']>('RG_CNH');
  const [novoDocNomeCustom, setNovoDocNomeCustom] = useState('');

  // Formulário de Edição - Campos Completos
  const [editNome, setEditNome] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editDataNascimento, setEditDataNascimento] = useState('1980-01-01');
  const [editNacionalidade, setEditNacionalidade] = useState('Brasileira');
  const [editNaturalidade, setEditNaturalidade] = useState('Salvador / BA');
  const [editEstadoCivil, setEditEstadoCivil] = useState<'CASADO' | 'CASADA' | 'SOLTEIRO' | 'SOLTEIRA' | 'VIUVO' | 'VIUVA' | 'DIVORCIADO' | 'DIVORCIADA'>('CASADO');
  const [editNomeConjuge, setEditNomeConjuge] = useState('');
  const [editEscolaridade, setEditEscolaridade] = useState('Superior em Teologia');
  const [editProfissao, setEditProfissao] = useState('Ministro de Confissão Religiosa / Pastor');
  const [editProfissaoCustom, setEditProfissaoCustom] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [editSenha, setEditSenha] = useState('');
  const [editCargo, setEditCargo] = useState<CargoEclesiastico>('Pastor');
  const [editIgrejaFiliadaId, setEditIgrejaFiliadaId] = useState('');
  const [editIgrejaFiliadaNome, setEditIgrejaFiliadaNome] = useState('');
  const [editDataConsagracao, setEditDataConsagracao] = useState('2010-01-01');
  const [editPastorConsagrante, setEditPastorConsagrante] = useState('');
  const [editRegistroMinisterial, setEditRegistroMinisterial] = useState('RM-123.456-01');
  const [editFotoUrl, setEditFotoUrl] = useState('');
  const [editStatus, setEditStatus] = useState<StatusMinistro>('ATIVO');
  const [editStatusAdimplencia, setEditStatusAdimplencia] = useState<StatusAdimplencia>('ADIMPLENTE');
  const [editCep, setEditCep] = useState('40000-000');
  const [editRua, setEditRua] = useState('Avenida Central');
  const [editNumero, setEditNumero] = useState('100');
  const [editBairro, setEditBairro] = useState('Centro');
  const [editCidade, setEditCidade] = useState('Salvador');
  const [editUf, setEditUf] = useState('BA');
  const [editDocumentos, setEditDocumentos] = useState<DocumentoAnexoMinistro[]>([]);

  // Formulário de Novo Cadastro - Campos Completos
  const [novoNome, setNovoNome] = useState('');
  const [novoCpf, setNovoCpf] = useState('');
  const [novoDataNascimento, setNovoDataNascimento] = useState('1985-05-20');
  const [novoNacionalidade, setNovoNacionalidade] = useState('Brasileira');
  const [novoNaturalidade, setNovoNaturalidade] = useState('Salvador / BA');
  const [novoEstadoCivil, setNovoEstadoCivil] = useState<'CASADO' | 'CASADA' | 'SOLTEIRO' | 'SOLTEIRA' | 'VIUVO' | 'VIUVA' | 'DIVORCIADO' | 'DIVORCIADA'>('CASADO');
  const [novoNomeConjuge, setNovoNomeConjuge] = useState('');
  const [novoEscolaridade, setNovoEscolaridade] = useState('Bacharel em Teologia');
  const [novoProfissao, setNovoProfissao] = useState('Ministro de Confissão Religiosa / Pastor');
  const [novoProfissaoCustom, setNovoProfissaoCustom] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('(71) 98877-6655');
  const [novoSenha, setNovoSenha] = useState('123456');
  const [novoCargo, setNovoCargo] = useState<CargoEclesiastico>('Pastor');
  const [novoIgrejaFiliadaId, setNovoIgrejaFiliadaId] = useState('');
  const [novoIgrejaFiliadaNome, setNovoIgrejaFiliadaNome] = useState('');
  const [novoEhPresidenteIgreja, setNovoEhPresidenteIgreja] = useState(false);
  const [novoDataConsagracao, setNovoDataConsagracao] = useState('2015-06-12');
  const [novoEstadoConsagracao, setNovoEstadoConsagracao] = useState('BA');
  const [novoCidadeConsagracao, setNovoCidadeConsagracao] = useState('Salvador');
  const [novoCidadesConsagracaoLista, setNovoCidadesConsagracaoLista] = useState<string[]>(['Salvador', 'Feira de Santana', 'Vitória da Conquista']);
  const [carregandoNovoCidades, setCarregandoNovoCidades] = useState(false);
  const [novoLocalConsagracao, setNovoLocalConsagracao] = useState('Salvador - BA');
  const [novoPastorConsagrante, setNovoPastorConsagrante] = useState('');

  // Estados de Consagração para Edição
  const [editEstadoConsagracao, setEditEstadoConsagracao] = useState('BA');
  const [editCidadeConsagracao, setEditCidadeConsagracao] = useState('Salvador');
  const [editCidadesConsagracaoLista, setEditCidadesConsagracaoLista] = useState<string[]>(['Salvador', 'Feira de Santana', 'Vitória da Conquista']);
  const [carregandoEditCidades, setCarregandoEditCidades] = useState(false);
  const [editLocalConsagracao, setEditLocalConsagracao] = useState('Salvador - BA');
  const [editEhPresidenteIgreja, setEditEhPresidenteIgreja] = useState(false);

  // Mapeamento de Ministros que são Presidentes de Igrejas Filiadas
  const mapaIgrejasPresidentes = useMemo(() => {
    const mapa = new Map<string, IgrejaFiliada>();
    (igrejasFiliadas || []).forEach((ig) => {
      if (ig.pastorPresidenteId) {
        mapa.set(ig.pastorPresidenteId, ig);
      }
      if (ig.pastorPresidenteCpf) {
        const clean = ig.pastorPresidenteCpf.replace(/\D/g, '');
        if (clean) mapa.set(clean, ig);
      }
      const nome = (ig.pastorPresidenteNome || '').trim().toLowerCase();
      if (nome && nome.length > 3) {
        mapa.set(nome, ig);
      }
    });
    return mapa;
  }, [igrejasFiliadas]);

  const obterIgrejaPresidida = (m: Ministro): IgrejaFiliada | undefined => {
    if (m.ehPresidenteIgreja && m.igrejaPresidenteNome) {
      return { nomeFantasia: m.igrejaPresidenteNome } as IgrejaFiliada;
    }
    if (mapaIgrejasPresidentes.has(m.id)) return mapaIgrejasPresidentes.get(m.id);
    const cleanCpf = (m.cpf || '').replace(/\D/g, '');
    if (cleanCpf && mapaIgrejasPresidentes.has(cleanCpf)) return mapaIgrejasPresidentes.get(cleanCpf);
    const cleanNome = (m.nome || '').trim().toLowerCase();
    if (cleanNome && mapaIgrejasPresidentes.has(cleanNome)) return mapaIgrejasPresidentes.get(cleanNome);
    return undefined;
  };

  // Carregar Cidades do IBGE para Novo Ministro
  useEffect(() => {
    async function carregarCidadesNovo() {
      if (!novoEstadoConsagracao) return;
      setCarregandoNovoCidades(true);
      try {
        const lista = await consultarMunicipiosIbge(novoEstadoConsagracao);
        setNovoCidadesConsagracaoLista(lista);
        if (lista.length > 0 && !lista.includes(novoCidadeConsagracao)) {
          setNovoCidadeConsagracao(lista[0]);
        }
      } catch {
        setNovoCidadesConsagracaoLista([]);
      } finally {
        setCarregandoNovoCidades(false);
      }
    }
    carregarCidadesNovo();
  }, [novoEstadoConsagracao]);

  // Carregar Cidades do IBGE para Edição de Ministro
  useEffect(() => {
    async function carregarCidadesEdit() {
      if (!editEstadoConsagracao) return;
      setCarregandoEditCidades(true);
      try {
        const lista = await consultarMunicipiosIbge(editEstadoConsagracao);
        setEditCidadesConsagracaoLista(lista);
        if (lista.length > 0 && !lista.includes(editCidadeConsagracao)) {
          setEditCidadeConsagracao(lista[0]);
        }
      } catch {
        setEditCidadesConsagracaoLista([]);
      } finally {
        setCarregandoEditCidades(false);
      }
    }
    carregarCidadesEdit();
  }, [editEstadoConsagracao]);
  const [novoRegistroMinisterial, setNovoRegistroMinisterial] = useState('RM-000.000-00');
  const [novoDataFiliacao, setNovoDataFiliacao] = useState(getSystemDate());
  const [novoFotoUrl, setNovoFotoUrl] = useState('');
  const [novoCep, setNovoCep] = useState('40000-000');
  const [novoRua, setNovoRua] = useState('Avenida Principal');
  const [novoNumero, setNovoNumero] = useState('500');
  const [novoBairro, setNovoBairro] = useState('Centro');
  const [novoCidade, setNovoCidade] = useState('Salvador');
  const [novoUf, setNovoUf] = useState('BA');
  const [novoDocumentos, setNovoDocumentos] = useState<DocumentoAnexoMinistro[]>([]);
  const [novoCpfValidoStatus, setNovoCpfValidoStatus] = useState<{ checked: boolean; valido: boolean; mensagem?: string } | null>(null);
  const [editCpfValidoStatus, setEditCpfValidoStatus] = useState<{ checked: boolean; valido: boolean; mensagem?: string } | null>(null);

  // Atualizar CPF e RM automaticamente com Validação Matemática em Tempo Real
  const lidarComMudancaCpfNovo = (valor: string) => {
    setNovoCpf(valor);
    if (valor.replace(/\D/g, '').length >= 8) {
      setNovoRegistroMinisterial(gerarRegistroMinisterial(valor));
    }
    const apenasDigitos = valor.replace(/\D/g, '');
    if (apenasDigitos.length === 0) {
      setNovoCpfValidoStatus(null);
      return;
    }
    const res = validarCPF(valor);
    setNovoCpfValidoStatus({
      checked: true,
      valido: res.valido,
      mensagem: res.mensagemErro || (res.valido ? 'CPF Válido e Matematicamente Correto!' : 'CPF Inválido'),
    });
  };

  const lidarComMudancaCpfEdit = (valor: string) => {
    setEditCpf(valor);
    if (valor.replace(/\D/g, '').length >= 8) {
      setEditRegistroMinisterial(gerarRegistroMinisterial(valor));
    }
    const apenasDigitos = valor.replace(/\D/g, '');
    if (apenasDigitos.length === 0) {
      setEditCpfValidoStatus(null);
      return;
    }
    const res = validarCPF(valor);
    setEditCpfValidoStatus({
      checked: true,
      valido: res.valido,
      mensagem: res.mensagemErro || (res.valido ? 'CPF Válido e Matematicamente Correto!' : 'CPF Inválido'),
    });
  };

  // Processamento de Upload de Foto com Otimização em Alta Qualidade (Canvas Base64)
  const lidarComUploadFoto = (
    e: React.ChangeEvent<HTMLInputElement>,
    tipo: 'novo' | 'edit'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({
        tipo: 'erro',
        texto: 'Formato inválido. Por favor, selecione uma imagem (JPG, PNG ou WEBP).',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
          if (tipo === 'novo') {
            setNovoFotoUrl(compressedBase64);
          } else {
            setEditFotoUrl(compressedBase64);
          }
        } else {
          const rawBase64 = event.target?.result as string;
          if (tipo === 'novo') {
            setNovoFotoUrl(rawBase64);
          } else {
            setEditFotoUrl(rawBase64);
          }
        }

        setFeedback({
          tipo: 'sucesso',
          texto: 'Foto oficial carregada e processada com sucesso!',
        });
        setTimeout(() => setFeedback(null), 3000);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Processamento de Upload de Documentos Anexos
  const lidarComUploadDocumento = (
    e: React.ChangeEvent<HTMLInputElement>,
    tipo: 'novo' | 'edit'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setFeedback({
        tipo: 'erro',
        texto: 'O documento não deve ultrapassar 10MB.',
      });
      return;
    }

    const tamanhoFormatado =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result as string;
      if (base64Url) {
        const docObj: DocumentoAnexoMinistro = {
          id: `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          nome: novoDocNomeCustom || file.name,
          tipo: novoDocTipo,
          dataUpload: new Date().toISOString().split('T')[0],
          arquivoUrl: base64Url,
          tamanho: tamanhoFormatado,
        };

        if (tipo === 'novo') {
          setNovoDocumentos((ant) => [...ant, docObj]);
        } else {
          setEditDocumentos((ant) => [...ant, docObj]);
        }

        setNovoDocNomeCustom('');
        setFeedback({
          tipo: 'sucesso',
          texto: `Documento [${docObj.nome}] anexado com sucesso!`,
        });
        setTimeout(() => setFeedback(null), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  // Remover documento anexado
  const removerDocAnexo = (id: string, tipo: 'novo' | 'edit') => {
    if (tipo === 'novo') {
      setNovoDocumentos((ant) => ant.filter((d) => d.id !== id));
    } else {
      setEditDocumentos((ant) => ant.filter((d) => d.id !== id));
    }
  };

  // Filtragem dos ministros
  const ministrosFiltrados = useMemo(() => {
    return ministros.filter((m) => {
      const bateBusca =
        !busca.trim() ||
        (m.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
        (m.cpf || '').includes(busca) ||
        (m.cargo || '').toLowerCase().includes(busca.toLowerCase()) ||
        (m.rg && m.rg.includes(busca)) ||
        (m.registroMinisterial && m.registroMinisterial.toLowerCase().includes(busca.toLowerCase())) ||
        (m.igrejaFiliadaNome && m.igrejaFiliadaNome.toLowerCase().includes(busca.toLowerCase())) ||
        (m.dadosEndereco?.cidade && m.dadosEndereco.cidade.toLowerCase().includes(busca.toLowerCase()));

      const bateCargo = filtroCargo === 'TODOS' || m.cargo === filtroCargo;
      const bateStatus = filtroStatus === 'TODOS' || m.status === filtroStatus;
      const bateAdimplencia =
        filtroAdimplencia === 'TODOS' ||
        m.statusAdimplencia === filtroAdimplencia ||
        (filtroAdimplencia === 'EM_DIA' && (m.statusAdimplencia === 'ADIMPLENTE' || m.statusAdimplencia === 'EM_DIA')) ||
        (filtroAdimplencia === 'EM_ATRASO' && (m.statusAdimplencia === 'INADIMPLENTE' || m.statusAdimplencia === 'EM_ATRASO'));

      return bateBusca && bateCargo && bateStatus && bateAdimplencia;
    });
  }, [ministros, busca, filtroCargo, filtroStatus, filtroAdimplencia]);

  // Lista fatiada por paginação
  const ministrosExibidos = useMemo(() => {
    if (itensPorPagina === 'TODOS') return ministrosFiltrados;
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return ministrosFiltrados.slice(inicio, inicio + itensPorPagina);
  }, [ministrosFiltrados, paginaAtual, itensPorPagina]);

  // Estatísticas
  const total = ministros.length;
  const ativos = ministros.filter((m) => m.status === 'ATIVO').length;
  const pastores = ministros.filter((m) => m.cargo === 'Pastor').length;
  const evangelistas = ministros.filter((m) => m.cargo === 'Evangelista').length;
  const presbiteros = ministros.filter((m) => m.cargo === 'Presbítero').length;
  const missionarias = ministros.filter((m) => m.cargo === 'Missionária').length;
  const adimplentes = ministros.filter((m) => m.statusAdimplencia === 'EM_DIA' || m.statusAdimplencia === 'EM_DIA_FUTURO' || m.statusAdimplencia === 'ADIMPLENTE').length;

  // Abrir Modal de Edição
  const abrirModalEditar = (ministro: Ministro, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMinistroEmEdicao(ministro);
    setEditNome(ministro.nome);
    setEditCpf(ministro.cpf);
    setEditRg(ministro.rg || '');
    setEditOrgaoEmissor(ministro.orgaoEmissor || 'SSP/BA');
    setEditDataNascimento(ministro.dataNascimento || '1980-01-01');
    setEditNacionalidade(ministro.nacionalidade || 'Brasileira');
    setEditNaturalidade(ministro.naturalidade || 'Bahia - BA');
    setEditEstadoCivil(ministro.estadoCivil || 'CASADO');
    setEditNomeConjuge(ministro.nomeConjuge || '');
    setEditEscolaridade(ministro.escolaridade || 'Superior em Teologia');
    setEditProfissao(ministro.profissao || 'Ministro de Confissão Religiosa / Pastor');
    setEditProfissaoCustom('');
    setEditEmail(ministro.email || '');
    setEditTelefone(ministro.telefone || '');
    setEditCargo(ministro.cargo);
    setEditIgrejaFiliadaId(ministro.igrejaFiliadaId || '');
    setEditIgrejaFiliadaNome(ministro.igrejaFiliadaNome || '');
    setEditDataConsagracao(ministro.dataConsagracao || '2010-01-01');

    // Parse inteligente de Estado e Cidade de Consagração
    const loc = ministro.localConsagracao || '';
    let estadoCons = ministro.estadoConsagracao || 'BA';
    let cidadeCons = ministro.cidadeConsagracao || 'Salvador';
    if (loc.includes(' - ')) {
      const parts = loc.split(' - ');
      cidadeCons = parts[0].trim();
      estadoCons = parts[1].trim();
    } else if (loc.includes('/')) {
      const parts = loc.split('/');
      cidadeCons = parts[0].trim();
      estadoCons = parts[1].trim();
    }
    setEditEstadoConsagracao(estadoCons);
    setEditCidadeConsagracao(cidadeCons);
    setEditLocalConsagracao(`${cidadeCons} - ${estadoCons}`);

    setEditPastorConsagrante(ministro.pastorConsagrante || '');
    setEditRegistroMinisterial(ministro.registroMinisterial || gerarRegistroMinisterial(ministro.cpf));
    setEditFotoUrl(ministro.fotoUrl || '');
    setEditStatus(ministro.status);
    setEditStatusAdimplencia(ministro.statusAdimplencia);
    setEditCep(ministro.dadosEndereco?.cep || '40000-000');
    setEditRua(ministro.dadosEndereco?.rua || 'Avenida Central');
    setEditNumero(ministro.dadosEndereco?.numero || '100');
    setEditBairro(ministro.dadosEndereco?.bairro || 'Centro');
    setEditCidade(ministro.dadosEndereco?.cidade || 'Salvador');
    setEditUf(ministro.dadosEndereco?.uf || 'BA');
    setEditDocumentos(ministro.documentos ? [...ministro.documentos] : []);
    setEditEhPresidenteIgreja(Boolean(ministro.ehPresidenteIgreja));
    setAbaFormulario('pessoal');
    setModalEditarAberto(true);
  };

  // Salvar Edição
  const lidarComSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ministroEmEdicao || salvandoEdicao) return;

    // 1. Validação Rígida via Schema Zod (Fail-Fast antes da rede)
    const validacaoZod = schemaMinistroEdicao.safeParse({
      nome: editNome,
      cpf: editCpf,
      email: editEmail,
      cargo: editCargo,
      telefone: editTelefone,
    });

    if (!validacaoZod.success) {
      const primeiroErro = validacaoZod.error.issues[0]?.message || 'Dados inválidos no formulário do ministro.';
      setFeedback({ tipo: 'erro', texto: primeiroErro });
      notifyError('Validação Rejeitada', primeiroErro);
      return;
    }

    setSalvandoEdicao(true);
    try {
      const profissaoFinal =
        editProfissao === 'Outra Profissão' && editProfissaoCustom.trim()
          ? editProfissaoCustom.trim()
          : editProfissao;

      const localConsFormatado = `${editCidadeConsagracao} - ${editEstadoConsagracao}`;
      const idSanitizado = ministroEmEdicao.id.trim();

      const payloadLimpo: Record<string, any> = {
        nome: editNome.trim(),
        cpf: editCpf.replace(/\D/g, ''),
        dataNascimento: editDataNascimento || '',
        nacionalidade: (editNacionalidade || 'Brasileira').trim(),
        naturalidade: (editNaturalidade || '').trim(),
        estadoCivil: editEstadoCivil,
        escolaridade: editEscolaridade || '',
        profissao: profissaoFinal || '',
        email: (editEmail || '').toLowerCase().trim(),
        telefone: (editTelefone || '').trim(),
        cargo: editCargo,
        igrejaFiliadaId: editIgrejaFiliadaId || '',
        igrejaFiliadaNome: editIgrejaFiliadaNome || '',
        ehPresidenteIgreja: Boolean(editEhPresidenteIgreja),
        dataConsagracao: editDataConsagracao || '',
        localConsagracao: localConsFormatado,
        cidadeConsagracao: editCidadeConsagracao || '',
        estadoConsagracao: editEstadoConsagracao || '',
        pastorConsagrante: (editPastorConsagrante || '').trim(),
        registroMinisterial: editRegistroMinisterial || gerarRegistroMinisterial(editCpf),
        fotoUrl: editFotoUrl || ministroEmEdicao.fotoUrl || '',
        status: editStatus,
        statusAdimplencia: editStatusAdimplencia,
        atualizado_em: new Date().toISOString(),
      };

      if (editNomeConjuge && (editEstadoCivil === 'CASADO' || editEstadoCivil === 'CASADA')) {
        payloadLimpo.nomeConjuge = editNomeConjuge.trim();
      }
      if (editSenha && editSenha.trim().length >= 6) {
        payloadLimpo.senha = editSenha.trim();
      }
      if (editDocumentos && editDocumentos.length > 0) {
        payloadLimpo.documentos = editDocumentos;
      }
      if (editCep || editRua || editCidade) {
        payloadLimpo.dadosEndereco = {
          cep: (editCep || '').trim(),
          rua: (editRua || '').trim(),
          numero: (editNumero || '').trim(),
          bairro: (editBairro || '').trim(),
          cidade: (editCidade || '').trim(),
          uf: (editUf || 'BA').trim().toUpperCase(),
        };
      }

      // EXPURGO DE MERGES CEGOS: Exclusivamente updateDoc com ID estrito no Firestore
      await updateDoc(doc(db, 'ministros', idSanitizado), payloadLimpo);

      await editarMinistro(idSanitizado, payloadLimpo as any);

      if (editEhPresidenteIgreja && editIgrejaFiliadaId) {
        try {
          await editarIgreja(editIgrejaFiliadaId, {
            pastorPresidenteId: ministroEmEdicao.id,
            pastorPresidenteNome: editNome.trim(),
            pastorPresidenteCpf: editCpf.trim(),
          });
        } catch (err) {
          console.warn('[VINCULO_PRESIDENTE_ERR]', err);
        }
      }

      setModalEditarAberto(false);
      setFeedback({
        tipo: 'sucesso',
        texto: `Registro ministerial de ${editNome} atualizado com sucesso!`,
      });
      notifySuccess('Ministro Atualizado', `O registro ministerial de ${editNome} foi atualizado.`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao salvar alterações do ministro.';
      setFeedback({
        tipo: 'erro',
        texto: msg,
      });
      notifyError('Erro na Atualização', msg);
    } finally {
      setSalvandoEdicao(false);
    }
  };

  // Confirmar Exclusão
  const abrirModalDeletar = (ministro: Ministro, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMinistroParaDeletar(ministro);
    setJustificativaDelecao('');
    setModalDeletarAberto(true);
  };
 
  const lidarComConfirmarDelecao = async () => {
    if (!ministroParaDeletar || deletandoMinistro) return;
    if (!justificativaDelecao.trim()) {
      notifyWarning('Justificativa Requerida', 'Informe uma justificativa válida para realizar a exclusão.');
      return;
    }

    try {
      setDeletandoMinistro(true);
      await deletarMinistro(ministroParaDeletar.id, justificativaDelecao.trim());
      setModalDeletarAberto(false);
      setJustificativaDelecao('');
      setFeedback({
        tipo: 'sucesso',
        texto: `Ministro ${ministroParaDeletar.nome} excluído do cadastro com sucesso.`,
      });
      notifySuccess('Ministro Excluído', `Registro de ${ministroParaDeletar.nome} removido do banco.`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao deletar ministro.';
      setFeedback({
        tipo: 'erro',
        texto: msg,
      });
      notifyError('Erro na Exclusão', msg);
    } finally {
      setDeletandoMinistro(false);
    }
  };

  // Alternar Status (Habilitar / Desabilitar)
  const lidarComAlternarStatus = async (ministro: Ministro, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await alternarStatusMinistro(ministro.id);
      const novoStatus = ministro.status === 'ATIVO' ? 'SUSPENSO' : 'ATIVO';
      setFeedback({
        tipo: 'sucesso',
        texto: `Status de ${ministro.nome} alterado para ${novoStatus}.`,
      });
      notifySuccess('Status Modificado', `Status de ${ministro.nome} alterado para ${novoStatus}.`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao alternar status do ministro.';
      setFeedback({
        tipo: 'erro',
        texto: msg,
      });
      notifyError('Erro no Status', msg);
    }
  };

  // Cadastrar Novo Ministro
  const lidarComCadastrarNovo = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validação da Aba 1 (Pessoal)
    if (!novoNome.trim()) {
      setAbaFormulario('pessoal');
      setFeedback({ tipo: 'erro', texto: 'Por favor, informe o Nome Completo do ministro.' });
      return;
    }
    const cpfLimpo = novoCpf.replace(/\D/g, '');
    if (!novoCpf.trim() || cpfLimpo.length !== 11 || !validarCPF(novoCpf)) {
      setAbaFormulario('pessoal');
      setFeedback({ tipo: 'erro', texto: 'Por favor, informe um CPF válido com 11 dígitos para o ministro.' });
      return;
    }

    // 2. Validação da Aba 3 (Endereço & Contato)
    if (!novoTelefone.trim()) {
      setAbaFormulario('contato');
      setFeedback({ tipo: 'erro', texto: 'Por favor, informe o Telefone / WhatsApp do ministro.' });
      return;
    }
    if (!novoSenha.trim() || novoSenha.length < 6) {
      setAbaFormulario('contato');
      setFeedback({ tipo: 'erro', texto: 'Por favor, defina uma senha de acesso com no mínimo 6 caracteres para o portal do ministro.' });
      return;
    }
    if (!novoCep.trim()) {
      setAbaFormulario('contato');
      setFeedback({ tipo: 'erro', texto: 'Por favor, informe o CEP do endereço do ministro.' });
      return;
    }
    if (!novoCidade.trim() || !novoUf.trim()) {
      setAbaFormulario('contato');
      setFeedback({ tipo: 'erro', texto: 'Por favor, informe a Cidade e o Estado (UF) do ministro.' });
      return;
    }

    setSalvandoNovo(true);
    try {
      const igrejaEscolhida = igrejasFiliadas.find((i) => i.id === novoIgrejaFiliadaId);
      const igrejaNome = igrejaEscolhida
        ? igrejaEscolhida.nomeFantasia
        : novoIgrejaFiliadaNome || 'AD Sede Filiada Salvador';

      const profissaoFinal =
        novoProfissao === 'Outra Profissão' && novoProfissaoCustom.trim()
          ? novoProfissaoCustom.trim()
          : novoProfissao;

      const rmFinal = novoRegistroMinisterial || gerarRegistroMinisterial(novoCpf);

      await cadastrarMinistro({
        tenantId: tenantAtivoId,
        nome: novoNome.trim(),
        cpf: novoCpf.trim(),
        dataNascimento: novoDataNascimento,
        nacionalidade: novoNacionalidade,
        naturalidade: novoNaturalidade,
        estadoCivil: novoEstadoCivil,
        nomeConjuge:
          novoEstadoCivil === 'CASADO' || novoEstadoCivil === 'CASADA'
            ? novoNomeConjuge
            : undefined,
        escolaridade: novoEscolaridade,
        profissao: profissaoFinal,
        email: novoEmail || `${novoNome.toLowerCase().replace(/\s+/g, '.')}@cimadebe.org.br`,
        telefone: novoTelefone,
        cargo: novoCargo,
        senha: novoSenha,
        igrejaFiliadaId: novoIgrejaFiliadaId,
        igrejaFiliadaNome: igrejaNome,
        ehPresidenteIgreja: novoEhPresidenteIgreja,
        igrejaPresidenteNome: novoEhPresidenteIgreja ? igrejaNome : undefined,
        dataConsagracao: novoDataConsagracao,
        localConsagracao: `${novoCidadeConsagracao} - ${novoEstadoConsagracao}`,
        cidadeConsagracao: novoCidadeConsagracao,
        estadoConsagracao: novoEstadoConsagracao,
        pastorConsagrante: novoPastorConsagrante,
        registroMinisterial: rmFinal,
        dataFiliacao: novoDataFiliacao || getSystemDate(),
        status: 'ATIVO',
        statusAdimplencia: 'PENDENTE',
        documentos: novoDocumentos,
        fotoUrl: novoFotoUrl || '',
        dadosEndereco: {
          cep: novoCep,
          rua: novoRua,
          numero: novoNumero,
          bairro: novoBairro,
          cidade: novoCidade,
          uf: novoUf.toUpperCase(),
        },
      });

      if (novoEhPresidenteIgreja && novoIgrejaFiliadaId) {
        try {
          await editarIgreja(novoIgrejaFiliadaId, {
            pastorPresidenteId: novoCpf.replace(/\D/g, ''),
            pastorPresidenteNome: novoNome.trim(),
            pastorPresidenteCpf: novoCpf.trim(),
          });
        } catch (err) {
          console.warn('[VINCULO_PRESIDENTE_ERR]', err);
        }
      }

      setModalNovoAberto(false);
      setNovoNome('');
      setNovoCpf('');
      setNovoFotoUrl('');
      setNovoEmail('');
      setNovoTelefone('');
      setNovoSenha('');
      setNovoDocumentos([]);
      setFeedback({
        tipo: 'sucesso',
        texto: `Ministro ${novoNome} cadastrado com sucesso! Registro Ministerial: ${rmFinal}.`,
      });
      notifySuccess('Ministro Cadastrado', `Ministro ${novoNome} cadastrado com sucesso! RM: ${rmFinal}`);
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao cadastrar novo ministro.';
      setFeedback({
        tipo: 'erro',
        texto: msg,
      });
      notifyError('Erro no Cadastro', msg);
    } finally {
      setSalvandoNovo(false);
    }
  };

  const lidarComExportarPdf = () => {
    try {
      exportarPdfTabelaMinistrosFiltrados(
        ministrosFiltrados,
        {
          busca,
          cargo: filtroCargo,
          status: filtroStatus,
          adimplencia: filtroAdimplencia,
        },
        appConfig
      );
      notifySuccess('Relatório Gerado', `Exportado PDF com ${ministrosFiltrados.length} ministros.`);
    } catch (err: any) {
      notifyError('Erro na Exportação', err?.message || 'Falha ao gerar relatório PDF.');
    }
  };

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

      {/* Header Institucional de Listagem com Métricas Compacto e Delicado */}
      <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono font-bold tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">
                GESTÃO PASTORAL & CREDENCIAMENTO
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-white mt-1">
              Quadro Geral de Ministros Filiados
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Registro Ministerial (RM), dados biográficos, upload de foto/documentos e controle financeiro.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={lidarComExportarPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold text-xs shadow-sm transition-all cursor-pointer w-fit"
              title="Exportar listagem filtrada em formato PDF oficial"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar PDF ({ministrosFiltrados.length})</span>
            </button>

            <button
              onClick={() => {
                setNovoNome('');
                setNovoCpf('');
                setNovoFotoUrl('');
                setNovoDocumentos([]);
                setNovoRegistroMinisterial('RM-000.000-00');
                setNovoDataFiliacao(getSystemDate());
                setAbaFormulario('pessoal');
                setModalNovoAberto(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-sm transition-all cursor-pointer w-fit"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Ministro</span>
            </button>
          </div>
        </div>

        {/* Grade de Indicadores de Cargos Exclusivos Adaptável */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-2 sm:gap-2.5 min-w-0">
          <div className="p-2.5 sm:p-3 rounded-lg bg-slate-950/80 border border-slate-800/80">
            <span className="text-[9px] font-mono text-slate-400 block uppercase">Total Geral</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-white mt-0.5 tabular-nums">{total}</div>
            <span className="text-[10px] text-emerald-400 font-mono">{ativos} Ativos</span>
          </div>

          <div className="p-2.5 sm:p-3 rounded-lg bg-slate-950/80 border border-slate-800/80">
            <span className="text-[9px] font-mono text-cyan-400 block uppercase font-bold">Pastores</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-cyan-400 mt-0.5 tabular-nums">{pastores}</div>
            <span className="text-[10px] text-slate-500 font-mono">Consagrados</span>
          </div>

          <div className="p-2.5 sm:p-3 rounded-lg bg-slate-950/80 border border-slate-800/80">
            <span className="text-[9px] font-mono text-indigo-400 block uppercase font-bold">Evangelistas</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-indigo-400 mt-0.5 tabular-nums">{evangelistas}</div>
            <span className="text-[10px] text-slate-500 font-mono">Ordenados</span>
          </div>

          <div className="p-2.5 sm:p-3 rounded-lg bg-slate-950/80 border border-slate-800/80">
            <span className="text-[9px] font-mono text-amber-400 block uppercase font-bold">Presbíteros</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-amber-400 mt-0.5 tabular-nums">{presbiteros}</div>
            <span className="text-[10px] text-slate-500 font-mono">Consagrados</span>
          </div>

          <div className="p-2.5 sm:p-3 rounded-lg bg-slate-950/80 border border-slate-800/80">
            <span className="text-[9px] font-mono text-pink-400 block uppercase font-bold">Missionárias</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-pink-400 mt-0.5 tabular-nums">{missionarias}</div>
            <span className="text-[10px] text-slate-500 font-mono">Consagradas</span>
          </div>

          <div className="p-2.5 sm:p-3 rounded-lg bg-slate-950/80 border border-slate-800/80">
            <span className="text-[9px] font-mono text-emerald-400 block uppercase font-bold">Adimplência</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400 mt-0.5 tabular-nums">{adimplentes}</div>
            <span className="text-[10px] text-emerald-400 font-mono">
              {total > 0 ? Math.round((adimplentes / total) * 100) : 0}% Regular
            </span>
          </div>
        </div>
      </div>

      {/* Banner Elegante do Pastor Presidente Geral */}
      {(() => {
        // 1. Busca se há membro formalmente empossado na Mesa Diretora no cargo de Presidente Geral
        const membroPresidente = membrosMesaDiretora.find((m) => {
          if (!m.cargoMesa) return false;
          const cargo = m.cargoMesa.toLowerCase();
          return (
            (cargo === 'presidente geral' || cargo === 'presidente' || cargo === 'pastor presidente') &&
            !cargo.includes('vice') &&
            !cargo.includes('conselho') &&
            !cargo.includes('ética') &&
            !cargo.includes('etica') &&
            !cargo.includes('fiscal')
          );
        });

        // Se não houver presidente formalmente empossado na Mesa, não renderiza absolutamente nada
        if (!membroPresidente || !membroPresidente.nome || membroPresidente.nome.trim() === '') {
          return null;
        }

        // 2. Localiza se existe ministro com esse id ou CPF cadastrado
        const ministroVinculado = ministros.find(
          (m) =>
            (membroPresidente.ministroId && m.id === membroPresidente.ministroId) ||
            (membroPresidente.cpf && m.cpf === membroPresidente.cpf) ||
            (m.nome || '').toLowerCase() === (membroPresidente.nome || '').toLowerCase()
        );

        const presidente = {
          id: ministroVinculado?.id || membroPresidente.ministroId || membroPresidente.id,
          nome: ministroVinculado?.nome || membroPresidente.nome,
          cpf: ministroVinculado?.cpf || membroPresidente.cpf || '',
          registroMinisterial: ministroVinculado?.registroMinisterial || (membroPresidente.cpf ? gerarRegistroMinisterial(membroPresidente.cpf) : 'N/A'),
          cargo: membroPresidente.cargoMesa || 'Presidente Geral',
          igrejaFiliadaNome:
            ministroVinculado?.igrejaFiliadaNome ||
            membroPresidente.igrejaFiliada ||
            appConfig?.nomeConvencao ||
            'Convenção Geral',
          fotoUrl: ministroVinculado?.fotoUrl || membroPresidente.fotoUrl || '',
          temPerfilMinistro: Boolean(ministroVinculado),
        };

        return (
          <div className="relative rounded-xl p-4 sm:p-5 bg-gradient-to-br from-amber-950/60 via-slate-900/90 to-slate-950 border border-amber-500/40 shadow-sm overflow-hidden">
            {/* Efeitos de brilho e partículas de fundo */}
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-4 justify-between">
              <div className="flex items-center gap-3.5 text-center md:text-left flex-col md:flex-row">
                <div className="relative shrink-0">
                  {presidente.fotoUrl ? (
                    <img
                      src={presidente.fotoUrl}
                      alt={presidente.nome}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-amber-400/80 shadow-md bg-slate-950"
                    />
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-amber-600 to-yellow-700 text-white font-bold text-xl flex items-center justify-center border border-amber-400/80 shadow-md">
                      {presidente.nome ? presidente.nome.charAt(0) : 'P'}
                    </div>
                  )}
                  <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-500 border border-slate-950 flex items-center justify-center text-slate-950 shadow">
                    <Crown className="w-3.5 h-3.5 fill-slate-950" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider bg-amber-500/20 text-amber-200 border border-amber-400/50 flex items-center gap-1">
                      <Crown className="w-3 h-3 text-amber-300" />
                      PRESIDENTE GERAL ESTATUTÁRIO
                    </span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-500/30">
                      Mandato {appConfig?.mandatoMesaDiretora || '2024 - 2028'}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-white font-sans tracking-tight">
                    {presidente.nome}
                  </h2>
                  <p className="text-[11px] font-mono text-amber-300 flex items-center justify-center md:justify-start gap-1.5">
                    <span>RM: <strong>{presidente.registroMinisterial}</strong></span>
                    <span>•</span>
                    <span>CPF: {presidente.cpf}</span>
                  </p>
                  <p className="text-xs text-slate-300 flex items-center justify-center md:justify-start gap-1">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{presidente.igrejaFiliadaNome}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2">
                <button
                  onClick={() => {
                    if (presidente.temPerfilMinistro) {
                      onSelecionarMinistro(presidente.id);
                    } else {
                      setFeedback({
                        tipo: 'sucesso',
                        texto: `Presidência Geral Oficial (${presidente.nome}): Registro ativo conforme Estatuto e Cadastro Oficial da Convenção.`,
                      });
                      setTimeout(() => setFeedback(null), 4000);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Ver Perfil</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Barra de Filtros e Busca */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar Nome, CPF, RM ou Cidade..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Filtro por Cargo Estrito */}
          <select
            value={filtroCargo}
            onChange={(e) => setFiltroCargo(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
          >
            <option value="TODOS">Todos os Cargos</option>
            {CARGOS_ECLESIASTICOS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Filtro de Status */}
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="ATIVO">Ativo</option>
            <option value="SUSPENSO">Suspenso</option>
            <option value="EM_ANALISE">Em Análise</option>
          </select>

          {/* Filtro de Adimplência */}
          <select
            value={filtroAdimplencia}
            onChange={(e) => setFiltroAdimplencia(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
          >
            <option value="TODOS">Toda Adimplência</option>
            <option value="EM_DIA">Em Dia</option>
            <option value="EM_ATRASO">Em Atraso</option>
          </select>

          <button
            onClick={lidarComExportarPdf}
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-emerald-400 border border-slate-800 hover:border-emerald-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            title="Exportar PDF desta busca"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setModoVisualizacao('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                modoVisualizacao === 'cards' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Grade em Cartões de Alta Densidade"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              onClick={() => setModoVisualizacao('tabela')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                modoVisualizacao === 'tabela' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Tabela Compacta"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tabela</span>
            </button>
          </div>
        </div>
      </div>

      {/* Visualização: Cartões de Alta Densidade vs Tabela */}
      {modoVisualizacao === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {ministrosExibidos.map((ministro) => {
            const rm = ministro.registroMinisterial || gerarRegistroMinisterial(ministro.cpf);
            const membroMesaEstilo = obterEstiloMesa(ministro, membrosMesaDiretora);
            const igrejaPresidida = obterIgrejaPresidida(ministro);

            return (
              <div
                key={ministro.id}
                onClick={() => onSelecionarMinistro(ministro.id)}
                className={`p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 shadow-xl transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                  ministro.status === 'SUSPENSO' ? 'opacity-50 grayscale' : ''
                }`}
              >
                {/* Topo do Cartão: Foto + Nome + Status Adimplência */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {ministro.fotoUrl && ministro.fotoUrl.trim() !== '' ? (
                      <img
                        src={ministro.fotoUrl}
                        alt={ministro.nome}
                        className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-700 shadow-md shrink-0 bg-slate-950"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                        {ministro.nome ? ministro.nome.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="font-bold text-white text-sm truncate font-sans" title={ministro.nome}>
                        {ministro.nome}
                      </h4>
                      <span className="text-[11px] font-mono text-emerald-400 block font-bold">{rm}</span>
                    </div>
                  </div>
                  <AdimplenciaBadge status={ministro.statusAdimplencia} />
                </div>

                {/* Informações Centrais (Cargo, Igreja, Consagração) */}
                <div className="space-y-2 text-xs font-mono text-slate-300 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Cargo:</span>
                    <span className="font-bold text-white px-2 py-0.5 rounded-lg bg-indigo-950/80 text-indigo-300 border border-indigo-500/30">
                      {ministro.cargo}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Igreja:</span>
                    <span className="text-white truncate max-w-[160px]" title={ministro.igrejaFiliadaNome || 'AD Sede'}>
                      {ministro.igrejaFiliadaNome || 'AD Sede'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Consagração:</span>
                    <span className="text-slate-200">
                      {ministro.cidadeConsagracao || 'Salvador'} - {ministro.estadoConsagracao || 'BA'}
                    </span>
                  </div>
                </div>

                {/* Rodapé / Ações do Cartão */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800" onClick={(e) => e.stopPropagation()}>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${ministro.status === 'ATIVO' ? 'text-emerald-400 bg-emerald-950/60' : 'text-rose-400 bg-rose-950/60'}`}>
                    {ministro.status}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setMinistroDossie(ministro)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors cursor-pointer"
                      title="Dossiê Ministerial"
                    >
                      <Shield className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onSelecionarMinistro(ministro.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 transition-colors cursor-pointer"
                      title="Ver Perfil"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => abrirModalEditar(ministro, e)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 transition-colors cursor-pointer"
                      title="Editar"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[10px] uppercase">
                <th className="py-4 px-6 font-bold">Foto / Ministro</th>
                <th className="py-4 px-4 font-bold">Cargo & Eclesiástico</th>
                <th className="py-4 px-4 font-bold">Registro Ministerial (RM)</th>
                <th className="py-4 px-4 font-bold">Igreja Filiada / Cidade</th>
                <th className="py-4 px-4 font-bold">Consagração (Cidade/UF)</th>
                <th className="py-4 px-4 font-bold">Situação Contábil</th>
                <th className="py-4 px-4 font-bold">Status</th>
                <th className="py-4 px-6 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {ministrosExibidos.map((ministro) => {
                const rm = ministro.registroMinisterial || gerarRegistroMinisterial(ministro.cpf);
                const membroMesaEstilo = obterEstiloMesa(ministro, membrosMesaDiretora);
                const igrejaPresidida = obterIgrejaPresidida(ministro);

                return (
                  <tr
                    key={ministro.id}
                    onClick={() => onSelecionarMinistro(ministro.id)}
                    className={`transition-colors cursor-pointer group ${
                      ministro.status === 'SUSPENSO'
                        ? 'bg-slate-950/80 opacity-50 grayscale filter hover:grayscale-0 hover:opacity-100'
                        : membroMesaEstilo
                        ? membroMesaEstilo.rowClass
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Foto + Nome + CPF + Indicador de Mesa Diretora + Badge Presidente de Igreja */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3.5">
                        {ministro.fotoUrl && ministro.fotoUrl.trim() !== '' ? (
                          <div className="relative shrink-0">
                            <img
                              src={ministro.fotoUrl}
                              alt={ministro.nome}
                              className={`w-11 h-11 rounded-full object-cover border-2 shadow-lg shadow-black/40 ring-1 shrink-0 transition-all duration-300 bg-slate-950/80 backdrop-blur-md ${
                                membroMesaEstilo
                                  ? membroMesaEstilo.photoClass
                                  : 'border-slate-700/80 group-hover:border-emerald-500/80 ring-white/10'
                              }`}
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                            {membroMesaEstilo && (
                              <div className="absolute -top-1 -right-1 p-0.5 rounded-full bg-slate-950 border border-amber-400 shadow-md">
                                <membroMesaEstilo.icon className={`w-3 h-3 ${membroMesaEstilo.iconColor}`} />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            className={`w-11 h-11 rounded-full bg-gradient-to-br from-slate-800/90 via-slate-900/90 to-slate-950/90 border text-emerald-400 font-sans font-black text-sm flex items-center justify-center shadow-lg shadow-black/40 ring-1 shrink-0 transition-all duration-300 backdrop-blur-md ${
                              membroMesaEstilo
                                ? membroMesaEstilo.photoClass
                                : 'border-slate-700/80 group-hover:border-emerald-500/80 ring-white/10'
                            }`}
                          >
                            {ministro?.nome && typeof ministro.nome === 'string' && ministro.nome.trim().length > 0 ? (
                              ministro.nome.trim().charAt(0).toUpperCase()
                            ) : (
                              <User className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        )}
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-white group-hover:text-emerald-300 transition-colors truncate max-w-xs font-sans">
                              {ministro.nome}
                            </span>
                            {membroMesaEstilo && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] ${membroMesaEstilo.badgeClass}`}
                                title={`Membro Homologado da Mesa Diretora: ${membroMesaEstilo.cargoMesa}`}
                              >
                                <membroMesaEstilo.icon className={`w-3 h-3 ${membroMesaEstilo.iconColor} shrink-0`} />
                                <span>{membroMesaEstilo.cargoMesa}</span>
                              </span>
                            )}
                            {igrejaPresidida && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-950/90 text-cyan-300 border border-cyan-500/40 shadow-sm"
                                title={`Pastor Presidente da Igreja: ${igrejaPresidida.nomeFantasia || igrejaPresidida.razaoSocial}`}
                              >
                                <Building2 className="w-3 h-3 text-cyan-400 shrink-0" />
                                <span>Presidente de Igreja ({igrejaPresidida.nomeFantasia || igrejaPresidida.razaoSocial})</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                            <span>CPF: {ministro.cpf}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Cargo Eclesiástico & Mesa */}
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-bold border ${
                            ministro.cargo === 'Pastor'
                              ? 'bg-cyan-950/80 text-cyan-400 border-cyan-500/30'
                              : ministro.cargo === 'Evangelista'
                              ? 'bg-indigo-950/80 text-indigo-400 border-indigo-500/30'
                              : ministro.cargo === 'Presbítero'
                              ? 'bg-amber-950/80 text-amber-400 border-amber-500/30'
                              : 'bg-pink-950/80 text-pink-400 border-pink-500/30'
                          }`}
                        >
                          {ministro.cargo}
                        </span>
                        {membroMesaEstilo && (
                          <div className="text-[10px] font-mono text-slate-300 flex items-center gap-1">
                            <span className="text-amber-400">★</span>
                            <span className="truncate max-w-[140px]">{membroMesaEstilo.cargoMesa}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Registro Ministerial */}
                    <td className="py-4 px-4">
                      <div className="font-bold text-emerald-400 font-mono tracking-wider">{rm}</div>
                      <span className="text-[10px] text-slate-500 font-mono">Filiado em {formatarDataBR(ministro.dataFiliacao)}</span>
                    </td>

                    {/* Igreja Filiada */}
                    <td className="py-4 px-4">
                      <div className="text-slate-200 truncate max-w-[200px] font-sans">
                        {ministro.igrejaFiliadaNome || 'AD Sede Salvador'}
                      </div>
                      <span className="text-[10px] text-slate-400 font-sans">
                        {ministro.dadosEndereco?.cidade || 'Salvador'} - {ministro.dadosEndereco?.uf || 'BA'}
                      </span>
                    </td>

                    {/* Consagração (Cidade / UF) */}
                    <td className="py-4 px-4">
                      <div className="text-slate-200 font-sans font-medium">
                        {ministro.cidadeConsagracao || (ministro.localConsagracao ? ministro.localConsagracao.split(' - ')[0] : 'Salvador')}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {ministro.estadoConsagracao || (ministro.localConsagracao && ministro.localConsagracao.includes(' - ') ? ministro.localConsagracao.split(' - ')[1] : 'BA')}
                        {ministro.dataConsagracao ? ` • ${formatarDataBR(ministro.dataConsagracao)}` : ''}
                      </span>
                    </td>

                    {/* Situação Financeira */}
                    <td className="py-4 px-4">
                      <AdimplenciaBadge status={ministro.statusAdimplencia} />
                    </td>

                    {/* Status Cadastral */}
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          ministro.status === 'ATIVO'
                            ? 'text-emerald-400 bg-emerald-950/60'
                            : 'text-rose-400 bg-rose-950/60'
                        }`}
                      >
                        {ministro.status}
                      </span>
                    </td>

                    {/* Ações */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setMinistroDossie(ministro)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                          title="Abrir Dossiê Ministerial Consolidado"
                        >
                          <Shield className="w-4 h-4 text-amber-400" />
                        </button>
                        <button
                          onClick={() => onSelecionarMinistro(ministro.id)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="Ver Perfil Completo"
                        >
                          <Eye className="w-4 h-4 text-cyan-400" />
                        </button>
                        {onAcessarPortal && (
                          <button
                            onClick={() => onAcessarPortal(ministro.id)}
                            className="p-2 rounded-xl bg-purple-950 hover:bg-purple-900 text-purple-300 hover:text-white transition-colors cursor-pointer border border-purple-500/40"
                            title="Acessar Portal do Ministro"
                          >
                            <ExternalLink className="w-4 h-4 text-purple-400" />
                          </button>
                        )}
                        {/* Botão removido para o Birô Gráfico */}
                        <button
                          onClick={(e) => abrirModalEditar(ministro, e)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="Editar Cadastro Completo"
                        >
                          <Edit3 className="w-4 h-4 text-amber-400" />
                        </button>
                        <button
                          onClick={(e) => lidarComAlternarStatus(ministro, e)}
                          className={`p-2 rounded-xl transition-colors cursor-pointer ${
                            ministro.status === 'ATIVO'
                              ? 'bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400'
                              : 'bg-slate-800 hover:bg-emerald-950 text-slate-400 hover:text-emerald-400'
                          }`}
                          title={ministro.status === 'ATIVO' ? 'Suspender Ministro' : 'Reativar Ministro'}
                        >
                          {ministro.status === 'ATIVO' ? (
                            <UserX className="w-4 h-4" />
                          ) : (
                            <UserCheck className="w-4 h-4 text-emerald-400" />
                          )}
                        </button>
                        <button
                          onClick={(e) => abrirModalDeletar(ministro, e)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                          title="Excluir Ministro"
                        >
                          <Trash2 className="w-4 h-4 text-rose-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Controle de Paginação (15 / 30 / 50 / TODOS) */}
      <PaginacaoGeral
        totalItems={ministrosFiltrados.length}
        itensPorPagina={itensPorPagina}
        paginaAtual={paginaAtual}
        onMudancaPagina={setPaginaAtual}
        onMudancaItensPorPagina={setItensPorPagina}
      />

      {/* ======================================================== */}
      {/* MODAL RESPONSIVO: NOVO CADASTRO COMPLETO DE MINISTRO     */}
      {/* ======================================================== */}
      {modalNovoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl animate-fadeIn my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold tracking-widest uppercase block">
                  CONVENÇÃO ESTADUAL CIMADEBE
                </span>
                <h3 className="text-xl font-black text-white mt-0.5">Novo Cadastro Ministerial</h3>
              </div>
              <button
                onClick={() => setModalNovoAberto(false)}
                className="text-slate-400 hover:text-white text-sm font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Abas de Navegação do Formulário */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-mono">
              <button
                type="button"
                onClick={() => setAbaFormulario('pessoal')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  abaFormulario === 'pessoal'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                1. Dados Pessoais & Civis
              </button>
              <button
                type="button"
                onClick={() => setAbaFormulario('eclesiastico')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  abaFormulario === 'eclesiastico'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                2. Dados Eclesiásticos & RM
              </button>
              <button
                type="button"
                onClick={() => setAbaFormulario('contato')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  abaFormulario === 'contato'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                3. Endereço & Contato
              </button>
              <button
                type="button"
                onClick={() => setAbaFormulario('documentos')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  abaFormulario === 'documentos'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                4. Foto & Documentos ({novoDocumentos.length})
              </button>
            </div>

            <form onSubmit={lidarComCadastrarNovo} className="space-y-4 text-xs font-mono">
              {/* ABA 1: DADOS PESSOAIS */}
              {abaFormulario === 'pessoal' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-slate-300 font-bold mb-1">Nome Completo *</label>
                      <input
                        type="text"
                        required
                        value={novoNome}
                        onChange={(e) => setNovoNome(e.target.value)}
                        placeholder="Ex: Pr. João Silva"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">CPF *</label>
                      <input
                        type="text"
                        required
                        value={novoCpf}
                        onChange={(e) => lidarComMudancaCpfNovo(e.target.value)}
                        placeholder="000.000.000-00"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                      {novoCpfValidoStatus && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.2 }}
                          className={`mt-2 p-2 rounded-xl text-[11px] font-mono flex items-center gap-2 border shadow-lg ${
                            novoCpfValidoStatus.valido
                              ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
                              : 'bg-rose-950/90 border-rose-500/60 text-rose-200'
                          }`}
                        >
                          {novoCpfValidoStatus.valido ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                          )}
                          <span>{novoCpfValidoStatus.mensagem}</span>
                        </motion.div>
                      )}
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Data de Nascimento</label>
                      <input
                        type="date"
                        value={novoDataNascimento}
                        onChange={(e) => setNovoDataNascimento(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Naturalidade (Estado)</label>
                      <select
                        value={novoNaturalidade}
                        onChange={(e) => setNovoNaturalidade(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">Selecione o Estado</option>
                        {ESTADOS_BRASIL.map((est) => (
                          <option key={est.uf} value={`${est.nome} - ${est.uf}`}>
                            {est.uf} - {est.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Estado Civil</label>
                      <select
                        value={novoEstadoCivil}
                        onChange={(e: any) => {
                          const val = e.target.value;
                          setNovoEstadoCivil(val);
                          if (val !== 'CASADO' && val !== 'CASADA') {
                            setNovoNomeConjuge('');
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="CASADO">Casado(a)</option>
                        <option value="SOLTEIRO">Solteiro(a)</option>
                        <option value="VIUVO">Viúvo(a)</option>
                        <option value="DIVORCIADO">Divorciado(a)</option>
                      </select>
                    </div>

                    {(novoEstadoCivil === 'CASADO' || novoEstadoCivil === 'CASADA') && (
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Nome do Cônjuge</label>
                        <input
                          type="text"
                          value={novoNomeConjuge}
                          onChange={(e) => setNovoNomeConjuge(e.target.value)}
                          placeholder="Nome completo do esposo(a)"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans"
                        />
                      </div>
                    )}

                    <div className="sm:col-span-2 space-y-2">
                      <label className="block text-slate-300 font-bold">Profissão Civil (Puxe as Profissões) *</label>
                      <select
                        value={novoProfissao}
                        onChange={(e) => setNovoProfissao(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans"
                      >
                        {PROFISSOES_CIVIS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>

                      {novoProfissao === 'Outra Profissão' && (
                        <input
                          type="text"
                          value={novoProfissaoCustom}
                          onChange={(e) => setNovoProfissaoCustom(e.target.value)}
                          placeholder="Digite o nome da sua profissão civil..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans"
                        />
                      )}
                    </div>

                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="block text-slate-300 font-bold mb-1">Escolaridade / Formação *</label>
                      <select
                        value={novoEscolaridade}
                        onChange={(e) => setNovoEscolaridade(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans"
                      >
                        {OPCOES_ESCOLARIDADE.map((esc) => (
                          <option key={esc} value={esc}>{esc}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setModalNovoAberto(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer text-xs"
                    >
                      Cancelar
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAbaFormulario('eclesiastico')}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        Próximo: Dados Eclesiásticos
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        type="submit"
                        disabled={salvandoNovo}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-lg disabled:opacity-50"
                      >
                        {salvandoNovo ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Gravando...</span>
                          </>
                        ) : (
                          <span>Concluir Cadastro</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 2: DADOS ECLESIÁSTICOS */}
              {abaFormulario === 'eclesiastico' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        Cargo Eclesiástico (Cargos Oficiais) *
                      </label>
                      <select
                        value={novoCargo}
                        onChange={(e: any) => setNovoCargo(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans font-bold"
                      >
                        {CARGOS_ECLESIASTICOS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        Registro Ministerial (Calculado do CPF: RM-123.456-01) *
                      </label>
                      <input
                        type="text"
                        required
                        value={novoRegistroMinisterial}
                        onChange={(e) => setNovoRegistroMinisterial(e.target.value)}
                        placeholder="Ex: RM-123.456-01"
                        className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl p-2.5 text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-slate-300 font-bold mb-1">Igreja Filiada de Vínculo</label>
                      <select
                        value={novoIgrejaFiliadaId}
                        onChange={(e) => {
                          const igId = e.target.value;
                          setNovoIgrejaFiliadaId(igId);
                          const ig = igrejasFiliadas.find((i) => i.id === igId);
                          if (ig) {
                            setNovoIgrejaFiliadaNome(ig.nomeFantasia);
                            const cleanMinCpf = novoCpf.replace(/\D/g, '');
                            const cleanIgCpf = (ig.pastorPresidenteCpf || '').replace(/\D/g, '');
                            const minNomeLimpo = novoNome.trim().toLowerCase();
                            const igPastorLimpo = (ig.pastorPresidenteNome || '').trim().toLowerCase();
                            if (
                              (cleanMinCpf && cleanIgCpf && cleanMinCpf === cleanIgCpf) ||
                              (minNomeLimpo && igPastorLimpo && (minNomeLimpo === igPastorLimpo || igPastorLimpo.includes(minNomeLimpo) || minNomeLimpo.includes(igPastorLimpo)))
                            ) {
                              setNovoEhPresidenteIgreja(true);
                            }
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans"
                      >
                        <option value="">-- Selecione ou informe o nome da igreja --</option>
                        {igrejasFiliadas.map((ig) => (
                          <option key={ig.id} value={ig.id}>
                            {ig.nomeFantasia} {ig.pastorPresidenteNome ? `(Resp. CNPJ: ${ig.pastorPresidenteNome})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2 p-3.5 rounded-xl border border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-white font-bold text-sm flex items-center gap-1.5">
                          <BadgeCheck className="w-4 h-4 text-emerald-400" />
                          Presidente de Igreja (Responsável no CNPJ)
                        </span>
                        <span className="text-xs text-slate-400 block mt-0.5">
                          Marca este ministro como Pastor Presidente / Responsável legal da Igreja Filiada nos registros e credenciais oficiais.
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={novoEhPresidenteIgreja}
                          onChange={(e) => setNovoEhPresidenteIgreja(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Data da Consagração / Ordenação</label>
                      <input
                        type="date"
                        value={novoDataConsagracao}
                        onChange={(e) => setNovoDataConsagracao(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Data da Filiação Convencional *</label>
                      <input
                        type="date"
                        required
                        value={novoDataFiliacao}
                        onChange={(e) => setNovoDataFiliacao(e.target.value)}
                        className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl p-2.5 text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">Formato DD/MM/AAAA — Selecionada: {formatarDataBR(novoDataFiliacao)}</span>
                    </div>

                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Estado da Consagração</label>
                        <select
                          value={novoEstadoConsagracao}
                          onChange={(e) => setNovoEstadoConsagracao(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans"
                        >
                          {ESTADOS_BRASIL.map((est) => (
                            <option key={est.uf} value={est.uf}>
                              {est.uf} - {est.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Cidade da Consagração</label>
                        {novoCidadesConsagracaoLista.length > 0 ? (
                          <select
                            value={novoCidadeConsagracao}
                            onChange={(e) => setNovoCidadeConsagracao(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans"
                          >
                            {novoCidadesConsagracaoLista.map((cid) => (
                              <option key={cid} value={cid}>
                                {cid}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={novoCidadeConsagracao}
                            onChange={(e) => setNovoCidadeConsagracao(e.target.value)}
                            placeholder={carregandoNovoCidades ? 'Carregando cidades do IBGE...' : 'Informe a cidade'}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
                          />
                        )}
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-slate-300 font-bold mb-1">Pastor Consagrante</label>
                      <input
                        type="text"
                        value={novoPastorConsagrante}
                        onChange={(e) => setNovoPastorConsagrante(e.target.value)}
                        placeholder="Ex: Pr. João Silva"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setAbaFormulario('pessoal')}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold text-xs cursor-pointer"
                    >
                      Voltar: Dados Pessoais
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAbaFormulario('contato')}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        Próximo: Endereço & Contato
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        type="submit"
                        disabled={salvandoNovo}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-lg disabled:opacity-50"
                      >
                        {salvandoNovo ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Gravando...</span>
                          </>
                        ) : (
                          <span>Concluir Cadastro</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 3: ENDEREÇO & CONTATO */}
              {abaFormulario === 'contato' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">E-mail de Notificações</label>
                      <input
                        type="email"
                        value={novoEmail}
                        onChange={(e) => setNovoEmail(e.target.value)}
                        placeholder="ministro@cimadebe.org.br"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Telefone / WhatsApp *</label>
                      <input
                        type="text"
                        required
                        value={novoTelefone}
                        onChange={(e) => setNovoTelefone(e.target.value)}
                        placeholder="(71) 98877-6655"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-slate-300 font-bold mb-1">Criar Senha de Acesso do Ministro *</label>
                      <input
                        type="password"
                        required
                        value={novoSenha}
                        onChange={(e) => setNovoSenha(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                      {renderValidadorSenha(novoSenha)}
                      <span className="text-[10px] text-slate-500 mt-1 block font-mono">
                        Esta senha permitirá ao ministro acessar o seu portal privado.
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-300 font-bold">CEP *</label>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!novoCep) return;
                            const d = await consultarCep(novoCep);
                            if (d) {
                              setNovoRua(d.rua);
                              setNovoBairro(d.bairro);
                              setNovoCidade(d.cidade);
                              setNovoUf(d.uf);
                              setNovoCep(d.cep);
                              setFeedback({ tipo: 'sucesso', texto: 'Endereço puxado pelo CEP com sucesso!' });
                              setTimeout(() => setFeedback(null), 3000);
                            }
                          }}
                          className="text-[10px] text-emerald-400 font-bold hover:underline cursor-pointer"
                        >
                          🔍 Buscar CEP
                        </button>
                      </div>
                      <input
                        type="text"
                        required
                        value={novoCep}
                        onChange={(e) => setNovoCep(e.target.value)}
                        placeholder="40000-000"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Cidade / UF *</label>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          required
                          value={novoCidade}
                          onChange={(e) => setNovoCidade(e.target.value)}
                          placeholder="Cidade"
                          className="col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans"
                        />
                        <input
                          type="text"
                          required
                          maxLength={2}
                          value={novoUf}
                          onChange={(e) => setNovoUf(e.target.value.toUpperCase())}
                          placeholder="BA"
                          className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-mono uppercase text-center"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Logradouro / Rua</label>
                      <input
                        type="text"
                        value={novoRua}
                        onChange={(e) => setNovoRua(e.target.value)}
                        placeholder="Ex: Avenida Principal"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Número / Bairro</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={novoNumero}
                          onChange={(e) => setNovoNumero(e.target.value)}
                          placeholder="Nº"
                          className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-mono"
                        />
                        <input
                          type="text"
                          value={novoBairro}
                          onChange={(e) => setNovoBairro(e.target.value)}
                          placeholder="Bairro"
                          className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setAbaFormulario('eclesiastico')}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold text-xs cursor-pointer"
                    >
                      Voltar: Dados Eclesiásticos
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAbaFormulario('documentos')}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        Próximo: Foto & Documentos
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        type="submit"
                        disabled={salvandoNovo}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-lg disabled:opacity-50"
                      >
                        {salvandoNovo ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Gravando...</span>
                          </>
                        ) : (
                          <span>Concluir Cadastro</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 4: FOTO & UPLOAD DE DOCUMENTOS */}
              {abaFormulario === 'documentos' && (
                <div className="space-y-5">
                  {/* Upload de Foto 3x4 */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <span className="text-[11px] font-bold text-emerald-400 block uppercase">
                      1. Foto Oficial do Ministro (Upload)
                    </span>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        {novoFotoUrl ? (
                          <img
                            src={novoFotoUrl}
                            alt="Preview Foto"
                            className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-lg bg-slate-900"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 bg-slate-900">
                            <Camera className="w-6 h-6 mb-1 text-slate-400" />
                            <span className="text-[9px] font-mono">Sem Foto</span>
                          </div>
                        )}
                        {novoFotoUrl && (
                          <button
                            type="button"
                            onClick={() => setNovoFotoUrl('')}
                            className="absolute -top-1 -right-1 p-1 bg-rose-600 rounded-full text-white cursor-pointer"
                            title="Remover foto"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5 flex-1">
                        <input
                          type="file"
                          ref={inputUploadNovoFotoRef}
                          onChange={(e) => lidarComUploadFoto(e, 'novo')}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => inputUploadNovoFotoRef.current?.click()}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer"
                        >
                          <Camera className="w-4 h-4 text-emerald-400" />
                          <span>Selecionar Foto (JPG / PNG)</span>
                        </button>
                        <p className="text-[10px] text-slate-500">Foto nítida em alta resolução para credencial.</p>
                      </div>
                    </div>
                  </div>

                  {/* Upload de Documentos Anexos */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <span className="text-[11px] font-bold text-cyan-400 block uppercase">
                      2. Documentos Oficiais Anexados (Upload de Arquivos)
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={novoDocTipo}
                        onChange={(e: any) => setNovoDocTipo(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-white text-xs font-mono"
                      >
                        <option value="RG_CNH">RG ou CNH</option>
                        <option value="CPF">Comprovante de CPF</option>
                        <option value="CERTIFICADO_CONSAGRACAO">Certificado / Ata de Consagração</option>
                        <option value="COMPROVANTE_RESIDENCIA">Comprovante de Residência</option>
                        <option value="CERTIDAO_CASAMENTO">Certidão de Casamento / Nascimento</option>
                        <option value="OUTROS">Diploma Teológico / Outros</option>
                      </select>

                      <input
                        type="text"
                        value={novoDocNomeCustom}
                        onChange={(e) => setNovoDocNomeCustom(e.target.value)}
                        placeholder="Nome do documento (opcional)"
                        className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-white text-xs font-sans"
                      />

                      <div>
                        <input
                          type="file"
                          ref={inputUploadNovoDocRef}
                          onChange={(e) => lidarComUploadDocumento(e, 'novo')}
                          accept="application/pdf,image/*"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => inputUploadNovoDocRef.current?.click()}
                          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition-all cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Anexar Arquivo</span>
                        </button>
                      </div>
                    </div>

                    {/* Lista de Documentos Anexados */}
                    {novoDocumentos.length > 0 ? (
                      <div className="space-y-1.5 pt-2">
                        {novoDocumentos.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Paperclip className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <span className="font-bold text-white truncate">{doc.nome}</span>
                              <span className="text-[10px] text-slate-500 font-mono">({doc.tipo})</span>
                              {doc.tamanho && (
                                <span className="text-[10px] text-slate-400 font-mono">• {doc.tamanho}</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removerDocAnexo(doc.id, 'novo')}
                              className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                              title="Remover documento"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 font-mono italic">
                        Nenhum documento anexado ainda. Anexe RG/CNH, comprovante de residência e certificados.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setAbaFormulario('contato')}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold text-xs cursor-pointer"
                    >
                      Voltar: Endereço & Contato
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setModalNovoAberto(false)}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer text-xs"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={salvandoNovo}
                        className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black transition-all shadow-lg cursor-pointer text-xs flex items-center gap-2 disabled:opacity-50"
                      >
                        {salvandoNovo ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Gravando no Banco...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Concluir Cadastro Ministerial</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL RESPONSIVO: EDITAR MINISTRO                        */}
      {/* ======================================================== */}
      {modalEditarAberto && ministroEmEdicao && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl animate-fadeIn my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-mono text-amber-400 font-bold tracking-widest uppercase block">
                  ATUALIZAÇÃO DE REGISTRO MINISTERIAL
                </span>
                <h3 className="text-xl font-black text-white mt-0.5">Editar: {editNome}</h3>
              </div>
              <button
                onClick={() => setModalEditarAberto(false)}
                className="text-slate-400 hover:text-white text-sm font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Abas */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-mono">
              <button
                type="button"
                onClick={() => setAbaFormulario('pessoal')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  abaFormulario === 'pessoal'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                1. Dados Civis
              </button>
              <button
                type="button"
                onClick={() => setAbaFormulario('eclesiastico')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  abaFormulario === 'eclesiastico'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                2. Cargo & RM
              </button>
              <button
                type="button"
                onClick={() => setAbaFormulario('contato')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  abaFormulario === 'contato'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                3. Endereço & Contato
              </button>
              <button
                type="button"
                onClick={() => setAbaFormulario('documentos')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  abaFormulario === 'documentos'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                4. Foto & Anexos ({editDocumentos.length})
              </button>
            </div>

            <form onSubmit={lidarComSalvarEdicao} className="space-y-4 text-xs font-mono">
              {abaFormulario === 'pessoal' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-slate-300 font-bold mb-1">Nome Completo *</label>
                      <input
                        type="text"
                        required
                        value={editNome}
                        onChange={(e) => setEditNome(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-sans text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">CPF *</label>
                      <input
                        type="text"
                        required
                        value={editCpf}
                        onChange={(e) => lidarComMudancaCpfEdit(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono"
                      />
                      {editCpfValidoStatus && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.2 }}
                          className={`mt-2 p-2 rounded-xl text-[11px] font-mono flex items-center gap-2 border shadow-lg ${
                            editCpfValidoStatus.valido
                              ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
                              : 'bg-rose-950/90 border-rose-500/60 text-rose-200'
                          }`}
                        >
                          {editCpfValidoStatus.valido ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                          )}
                          <span>{editCpfValidoStatus.mensagem}</span>
                        </motion.div>
                      )}
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Data de Nascimento</label>
                      <input
                        type="date"
                        value={editDataNascimento}
                        onChange={(e) => setEditDataNascimento(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Naturalidade (Estado)</label>
                      <select
                        value={editNaturalidade}
                        onChange={(e) => setEditNaturalidade(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="">Selecione o Estado</option>
                        {ESTADOS_BRASIL.map((est) => (
                          <option key={est.uf} value={`${est.nome} - ${est.uf}`}>
                            {est.uf} - {est.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Estado Civil</label>
                      <select
                        value={editEstadoCivil}
                        onChange={(e: any) => {
                          const val = e.target.value;
                          setEditEstadoCivil(val);
                          if (val !== 'CASADO' && val !== 'CASADA') {
                            setEditNomeConjuge('');
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="CASADO">Casado(a)</option>
                        <option value="SOLTEIRO">Solteiro(a)</option>
                        <option value="VIUVO">Viúvo(a)</option>
                        <option value="DIVORCIADO">Divorciado(a)</option>
                      </select>
                    </div>

                    {(editEstadoCivil === 'CASADO' || editEstadoCivil === 'CASADA') && (
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Nome do Cônjuge</label>
                        <input
                          type="text"
                          value={editNomeConjuge}
                          onChange={(e) => setEditNomeConjuge(e.target.value)}
                          placeholder="Nome completo do esposo(a)"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-sans"
                        />
                      </div>
                    )}

                    <div className="sm:col-span-2 space-y-2">
                      <label className="block text-slate-300 font-bold">Profissão Civil (Puxe as Profissões) *</label>
                      <select
                        value={editProfissao}
                        onChange={(e) => setEditProfissao(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-sans"
                      >
                        {PROFISSOES_CIVIS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      {editProfissao === 'Outra Profissão' && (
                        <input
                          type="text"
                          value={editProfissaoCustom}
                          onChange={(e) => setEditProfissaoCustom(e.target.value)}
                          placeholder="Digite o nome da sua profissão..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-sans"
                        />
                      )}
                    </div>

                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="block text-slate-300 font-bold">Escolaridade / Formação *</label>
                      <select
                        value={editEscolaridade}
                        onChange={(e) => setEditEscolaridade(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-sans"
                      >
                        {OPCOES_ESCOLARIDADE.map((esc) => (
                          <option key={esc} value={esc}>{esc}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setAbaFormulario('eclesiastico')}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
                    >
                      Avançar: Dados Eclesiásticos
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {abaFormulario === 'eclesiastico' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        Cargo Eclesiástico (Cargos Oficiais) *
                      </label>
                      <select
                        value={editCargo}
                        onChange={(e: any) => setEditCargo(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-sans font-bold"
                      >
                        {CARGOS_ECLESIASTICOS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        Registro Ministerial (RM) *
                      </label>
                      <input
                        type="text"
                        required
                        value={editRegistroMinisterial}
                        onChange={(e) => setEditRegistroMinisterial(e.target.value)}
                        className="w-full bg-slate-950 border border-amber-500/50 rounded-xl p-2.5 text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-slate-300 font-bold mb-1">Igreja Filiada</label>
                      <select
                        value={editIgrejaFiliadaId}
                        onChange={(e) => {
                          const igId = e.target.value;
                          setEditIgrejaFiliadaId(igId);
                          const ig = igrejasFiliadas.find((i) => i.id === igId);
                          if (ig) {
                            setEditIgrejaFiliadaNome(ig.nomeFantasia);
                            const cleanMinCpf = editCpf.replace(/\D/g, '');
                            const cleanIgCpf = (ig.pastorPresidenteCpf || '').replace(/\D/g, '');
                            const minNomeLimpo = editNome.trim().toLowerCase();
                            const igPastorLimpo = (ig.pastorPresidenteNome || '').trim().toLowerCase();
                            if (
                              (cleanMinCpf && cleanIgCpf && cleanMinCpf === cleanIgCpf) ||
                              (minNomeLimpo && igPastorLimpo && (minNomeLimpo === igPastorLimpo || igPastorLimpo.includes(minNomeLimpo) || minNomeLimpo.includes(igPastorLimpo)))
                            ) {
                              setEditEhPresidenteIgreja(true);
                            }
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-sans"
                      >
                        <option value="">-- Selecione a igreja filiada --</option>
                        {igrejasFiliadas.map((ig) => (
                          <option key={ig.id} value={ig.id}>
                            {ig.nomeFantasia} {ig.pastorPresidenteNome ? `(Resp. CNPJ: ${ig.pastorPresidenteNome})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2 p-3.5 rounded-xl border border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-white font-bold text-sm flex items-center gap-1.5">
                          <BadgeCheck className="w-4 h-4 text-amber-400" />
                          Presidente de Igreja (Responsável no CNPJ)
                        </span>
                        <span className="text-xs text-slate-400 block mt-0.5">
                          Marca este ministro como Pastor Presidente / Responsável legal da Igreja Filiada nos registros e credenciais oficiais.
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={editEhPresidenteIgreja}
                          onChange={(e) => setEditEhPresidenteIgreja(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Status Cadastral</label>
                      <select
                        value={editStatus}
                        onChange={(e: any) => setEditStatus(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="ATIVO">Ativo</option>
                        <option value="SUSPENSO">Suspenso</option>
                        <option value="EM_ANALISE">Em Análise</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Status Financeiro</label>
                      <select
                        value={editStatusAdimplencia}
                        onChange={(e: any) => setEditStatusAdimplencia(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="EM_DIA">Em Dia</option>
                        <option value="EM_ATRASO">Em Atraso</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Data Consagração</label>
                      <input
                        type="date"
                        value={editDataConsagracao}
                        onChange={(e) => setEditDataConsagracao(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Pastor Consagrante</label>
                      <input
                        type="text"
                        value={editPastorConsagrante}
                        onChange={(e) => setEditPastorConsagrante(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-sans"
                      />
                    </div>

                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Estado da Consagração</label>
                        <select
                          value={editEstadoConsagracao}
                          onChange={(e) => setEditEstadoConsagracao(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-sans"
                        >
                          {ESTADOS_BRASIL.map((est) => (
                            <option key={est.uf} value={est.uf}>
                              {est.uf} - {est.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Cidade da Consagração</label>
                        {editCidadesConsagracaoLista.length > 0 ? (
                          <select
                            value={editCidadeConsagracao}
                            onChange={(e) => setEditCidadeConsagracao(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-sans"
                          >
                            {editCidadesConsagracaoLista.map((cid) => (
                              <option key={cid} value={cid}>
                                {cid}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={editCidadeConsagracao}
                            onChange={(e) => setEditCidadeConsagracao(e.target.value)}
                            placeholder={carregandoEditCidades ? 'Carregando cidades do IBGE...' : 'Informe a cidade'}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setAbaFormulario('pessoal')}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold text-xs cursor-pointer"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbaFormulario('contato')}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
                    >
                      Avançar: Endereço & Contato
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {abaFormulario === 'contato' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">E-mail</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono text-[11px]"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Telefone / WhatsApp</label>
                      <input
                        type="text"
                        value={editTelefone}
                        onChange={(e) => setEditTelefone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-slate-300 font-bold mb-1">Editar / Redefinir Senha de Acesso</label>
                      <input
                        type="text"
                        value={editSenha}
                        onChange={(e) => setEditSenha(e.target.value)}
                        placeholder="Deixe em branco para manter a senha atual"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono"
                      />
                      {editSenha && renderValidadorSenha(editSenha)}
                      <span className="text-[10px] text-slate-500 mt-1 block font-mono">
                        Informe uma nova senha caso deseje redefinir o acesso deste ministro ao portal.
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-300 font-bold">CEP</label>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!editCep) return;
                            const d = await consultarCep(editCep);
                            if (d) {
                              setEditRua(d.rua);
                              setEditBairro(d.bairro);
                              setEditCidade(d.cidade);
                              setEditUf(d.uf);
                              setEditCep(d.cep);
                              setFeedback({ tipo: 'sucesso', texto: 'Endereço puxado pelo CEP com sucesso!' });
                              setTimeout(() => setFeedback(null), 3000);
                            }
                          }}
                          className="text-[10px] text-amber-400 font-bold hover:underline cursor-pointer"
                        >
                          🔍 Buscar CEP
                        </button>
                      </div>
                      <input
                        type="text"
                        value={editCep}
                        onChange={(e) => setEditCep(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Cidade / UF</label>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={editCidade}
                          onChange={(e) => setEditCidade(e.target.value)}
                          className="col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-sans"
                        />
                        <input
                          type="text"
                          maxLength={2}
                          value={editUf}
                          onChange={(e) => setEditUf(e.target.value.toUpperCase())}
                          className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono uppercase text-center"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Rua / Logradouro</label>
                      <input
                        type="text"
                        value={editRua}
                        onChange={(e) => setEditRua(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Número / Bairro</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={editNumero}
                          onChange={(e) => setEditNumero(e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono"
                        />
                        <input
                          type="text"
                          value={editBairro}
                          onChange={(e) => setEditBairro(e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-sans"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setAbaFormulario('eclesiastico')}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold text-xs cursor-pointer"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbaFormulario('documentos')}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
                    >
                      Avançar: Foto & Anexos
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {abaFormulario === 'documentos' && (
                <div className="space-y-5">
                  {/* Foto Upload */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <span className="text-[11px] font-bold text-amber-400 block uppercase">
                      1. Foto Oficial do Ministro (Upload)
                    </span>
                    <div className="flex items-center gap-4">
                      {editFotoUrl || ministroEmEdicao.fotoUrl ? (
                        <img
                          src={editFotoUrl || ministroEmEdicao.fotoUrl}
                          alt="Foto"
                          className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-500/40 shadow-lg bg-slate-900"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 bg-slate-900">
                          <Camera className="w-6 h-6 mb-1 text-slate-400" />
                          <span className="text-[9px] font-mono">Sem Foto</span>
                        </div>
                      )}
                      <div className="space-y-1.5 flex-1">
                        <input
                          type="file"
                          ref={inputUploadEditFotoRef}
                          onChange={(e) => lidarComUploadFoto(e, 'edit')}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => inputUploadEditFotoRef.current?.click()}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer"
                        >
                          <Camera className="w-4 h-4 text-amber-400" />
                          <span>Substituir Foto Oficial</span>
                        </button>
                        <p className="text-[10px] text-slate-500 font-mono">Formatos aceitos: JPG, PNG, WEBP (até 5MB).</p>
                      </div>
                    </div>
                  </div>

                  {/* Documentos Anexos */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <span className="text-[11px] font-bold text-cyan-400 block uppercase">
                      2. Documentos Anexados do Ministro
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={novoDocTipo}
                        onChange={(e: any) => setNovoDocTipo(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-white text-xs font-mono"
                      >
                        <option value="RG_CNH">RG ou CNH</option>
                        <option value="CPF">Comprovante de CPF</option>
                        <option value="CERTIFICADO_CONSAGRACAO">Certificado / Ata de Consagração</option>
                        <option value="COMPROVANTE_RESIDENCIA">Comprovante de Residência</option>
                        <option value="CERTIDAO_CASAMENTO">Certidão de Casamento / Nascimento</option>
                        <option value="OUTROS">Diploma Teológico / Outros</option>
                      </select>

                      <input
                        type="text"
                        value={novoDocNomeCustom}
                        onChange={(e) => setNovoDocNomeCustom(e.target.value)}
                        placeholder="Nome do arquivo..."
                        className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-white text-xs font-sans"
                      />

                      <div>
                        <input
                          type="file"
                          ref={inputUploadEditDocRef}
                          onChange={(e) => lidarComUploadDocumento(e, 'edit')}
                          accept="application/pdf,image/*"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => inputUploadEditDocRef.current?.click()}
                          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition-all cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Anexar Arquivo</span>
                        </button>
                      </div>
                    </div>

                    {editDocumentos.length > 0 ? (
                      <div className="space-y-1.5 pt-2">
                        {editDocumentos.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Paperclip className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <span className="font-bold text-white truncate">{doc.nome}</span>
                              <span className="text-[10px] text-slate-500 font-mono">({doc.tipo})</span>
                              {doc.tamanho && (
                                <span className="text-[10px] text-slate-400 font-mono">• {doc.tamanho}</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removerDocAnexo(doc.id, 'edit')}
                              className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                              title="Remover anexo"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 font-mono italic">
                        Nenhum documento anexado ainda.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setAbaFormulario('contato')}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold text-xs cursor-pointer"
                    >
                      Voltar
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setModalEditarAberto(false)}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={salvandoEdicao}
                        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black transition-all shadow-lg cursor-pointer disabled:opacity-50 flex items-center gap-2"
                      >
                        {salvandoEdicao && <RefreshCw className="w-4 h-4 animate-spin" />}
                        <span>{salvandoEdicao ? 'Salvando...' : 'Salvar Alterações'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL DELETAR MINISTRO                                   */}
      {/* ======================================================== */}
      {modalDeletarAberto && ministroParaDeletar && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fadeIn my-auto">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-white text-base">Confirmar Exclusão de Ministro</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Você está prestes a excluir o registro ministerial de{' '}
              <strong className="text-white">{ministroParaDeletar.nome}</strong> (RM:{' '}
              {ministroParaDeletar.registroMinisterial || gerarRegistroMinisterial(ministroParaDeletar.cpf)}). Esta
              operação registrará um log de mutação no Ledger contábil.
            </p>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-rose-400 font-bold uppercase block">JUSTIFICATIVA OBRIGATÓRIA:</label>
              <textarea
                required
                rows={3}
                placeholder="Informe detalhadamente a justificativa para exclusão definitiva deste ministro do cadastro..."
                value={justificativaDelecao}
                onChange={(e) => setJustificativaDelecao(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500/50 resize-none font-mono"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setModalDeletarAberto(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={lidarComConfirmarDelecao}
                disabled={deletandoMinistro || !justificativaDelecao.trim() || justificativaDelecao.trim().length < 5}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {deletandoMinistro ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <span>Confirmar Exclusão</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal do Dossiê Ministerial Consolidado */}
      {ministroDossie && (
        <DossieMinisterialModal
          ministro={ministroDossie}
          anuidades={anuidades}
          inscricoesAgo={inscricoesAGO}
          onClose={() => setMinistroDossie(null)}
        />
      )}
    </div>
  );
}
