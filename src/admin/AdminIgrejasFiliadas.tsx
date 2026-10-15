import React, { useState, useMemo, useRef } from 'react';
import { formatarDataBR } from '../financialEngine';
import {
  Building2,
  Search,
  Filter,
  Plus,
  Edit3,
  Trash2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Mail,
  Phone,
  Calendar,
  Shield,
  FileText,
  BadgeCheck,
  ChevronRight,
  Power,
  Image as ImageIcon,
  Upload,
  Camera,
  RefreshCw,
  X,
  Download,
  DollarSign,
  CreditCard,
  QrCode,
  Lock,
  Gift,
  FileCheck,
  Copy,
  Check,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { useSecurity } from '../SecurityContext';
import { useNotification } from '../NotificationContext';
import { PaginacaoGeral } from '../components/PaginacaoGeral';
import { consultarCep, consultarCnpj } from '../utils/lookup';
import { exportarPdfTabelaIgrejasFiltradas } from '../services/pdfExportService';
import type { IgrejaFiliada, Ministro } from '../types';
import { GoogleMapsIgrejasView } from '../components/GoogleMapsIgrejasView';
import { z } from 'zod';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const schemaIgrejaEdicao = z.object({
  razaoSocial: z.string().min(2, 'Razão social deve ter no mínimo 2 caracteres').trim(),
  nomeFantasia: z.string().min(2, 'Nome fantasia deve ter no mínimo 2 caracteres').trim(),
  cnpj: z
    .string()
    .transform((val) => val.replace(/\D/g, ''))
    .refine((val) => val.length === 14, 'CNPJ deve conter exatamente 14 dígitos numéricos'),
  municipio: z.string().min(2, 'Município é obrigatório').trim(),
  uf: z.string().length(2, 'UF deve conter 2 letras').toUpperCase().trim(),
  email: z.string().email('E-mail institucional inválido').toLowerCase().trim().or(z.literal('')),
  telefone: z.string().optional(),
});

interface AdminIgrejasFiliadasProps {
  readonly onSelecionarIgreja: (igrejaId: string) => void;
}

export function AdminIgrejasFiliadas({
  onSelecionarIgreja,
}: AdminIgrejasFiliadasProps) {
  const {
    igrejasFiliadas,
    ministros,
    anuidades,
    cadastrarIgreja,
    editarIgreja,
    deletarIgreja,
    editarMinistro,
    alternarStatusIgreja,
    registrarAnuidade,
    liquidarAnuidade,
    concederAnistia,
    operadorAtual,
    tenantAtivoId,
    appConfig,
  } = useSecurity();
  const { notifySuccess, notifyError, notifyWarning } = useNotification();

  // Estados de busca e filtros
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [filtroCidade, setFiltroCidade] = useState('TODAS');
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Estados de Visualização de Mapa Interativo
  const [modoVisualizacao, setModoVisualizacao] = useState<'lista' | 'mapa'>('lista');
  const [igrejaSelecionadaNoMapa, setIgrejaSelecionadaNoMapa] = useState<IgrejaFiliada | null>(null);

  // Paginação (15 / 30 / 50 / TODOS)
  const [itensPorPagina, setItensPorPagina] = useState<number | 'TODOS'>(15);
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Modais
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [igrejaEmEdicao, setIgrejaEmEdicao] = useState<IgrejaFiliada | null>(null);
  const [modalDeletarAberto, setModalDeletarAberto] = useState(false);
  const [igrejaParaDeletar, setIgrejaParaDeletar] = useState<IgrejaFiliada | null>(null);
  const [justificativaDelecao, setJustificativaDelecao] = useState('');
  const [modalDesativarAberto, setModalDesativarAberto] = useState(false);
  const [igrejaParaDesativar, setIgrejaParaDesativar] = useState<IgrejaFiliada | null>(null);
  const [desativando, setDesativando] = useState(false);

  // Modal de Regularização: Pagamento & Anistia da Igreja
  const [modalRegularizacaoAberto, setModalRegularizacaoAberto] = useState(false);
  const [igrejaRegularizacao, setIgrejaRegularizacao] = useState<IgrejaFiliada | null>(null);
  const [abaRegularizacao, setAbaRegularizacao] = useState<'PAGAMENTO' | 'ANISTIA'>('PAGAMENTO');
  const [metodoPagamentoReg, setMetodoPagamentoReg] = useState<'PIX' | 'CARTAO'>('PIX');
  const [parcelasCartaoReg, setParcelasCartaoReg] = useState<number>(1);
  const [ministrosSelecionadosReg, setMinistrosSelecionadosReg] = useState<string[]>([]);
  const [justificativaAnistia, setJustificativaAnistia] = useState('Resolução da Mesa Diretora / AGO');
  const [presidenteValidador, setPresidenteValidador] = useState(operadorAtual || 'Presidência Geral CIMADEBE');
  const [processandoAcaoReg, setProcessandoAcaoReg] = useState(false);
  const [chavePixCopiadaReg, setChavePixCopiadaReg] = useState(false);

  // Estados de Carregamento Rápido Anti-Double-Click
  const [salvandoNova, setSalvandoNova] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [deletando, setDeletando] = useState(false);

  // Campos do Formulário CNPJ
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [dataAbertura, setDataAbertura] = useState('2010-01-01');
  const [naturezaJuridica, setNaturezaJuridica] = useState('322-0 - Organização Religiosa');
  const [cnaePrincipal, setCnaePrincipal] = useState('94.91-0-00 - Atividades de organizações religiosas');
  const [situacaoCadastral, setSituacaoCadastral] = useState<'ATIVA' | 'BAIXADA' | 'SUSPENSA'>('ATIVA');
  const [logradouro, setLogradouro] = useState('Avenida Principal');
  const [numero, setNumero] = useState('100');
  const [complemento, setComplemento] = useState('Templo Sede');
  const [bairro, setBairro] = useState('Centro');
  const [municipio, setMunicipio] = useState('Salvador');
  const [uf, setUf] = useState('BA');
  const [cep, setCep] = useState('40000-000');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('(71) 3321-0000');
  const [pastorPresidenteId, setPastorPresidenteId] = useState('');
  const [pastorPresidenteNomeManual, setPastorPresidenteNomeManual] = useState('');
  const [nomeResponsavelCnpj, setNomeResponsavelCnpj] = useState('');
  const [cpfResponsavelCnpj, setCpfResponsavelCnpj] = useState('');
  const [logoUrl, setLogoUrl] = useState(
    'https://images.unsplash.com/photo-1548625361-195fe578cb66?auto=format&fit=crop&w=300&h=300&q=80'
  );

  const uploadLogoNovoRef = useRef<HTMLInputElement | null>(null);
  const uploadLogoEditRef = useRef<HTMLInputElement | null>(null);

  const [carregandoCnpj, setCarregandoCnpj] = useState(false);
  const [carregandoCep, setCarregandoCep] = useState(false);

  // Consulta automática completa do CNPJ com vínculo do Pastor Presidente
  const lidarComConsultaCnpj = async (cnpjParaConsultar?: string) => {
    const valor = (typeof cnpjParaConsultar === 'string' ? cnpjParaConsultar : cnpj).trim();
    const digitos = valor.replace(/\D/g, '');
    if (digitos.length < 14) {
      setFeedback({ tipo: 'erro', texto: 'Informe os 14 dígitos do CNPJ para realizar a consulta.' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    setCarregandoCnpj(true);
    try {
      const dados = await consultarCnpj(digitos);
      if (dados) {
        setRazaoSocial(dados.razaoSocial);
        setNomeFantasia(dados.nomeFantasia);
        setCnpj(dados.cnpj);
        setDataAbertura(dados.dataAbertura);
        setNaturezaJuridica(dados.naturezaJuridica);
        setCnaePrincipal(dados.cnaePrincipal);
        setSituacaoCadastral(dados.situacaoCadastral);
        setLogradouro(dados.logradouro);
        setNumero(dados.numero);
        if (dados.complemento) setComplemento(dados.complemento);
        setBairro(dados.bairro);
        setMunicipio(dados.municipio);
        setUf(dados.uf);
        setCep(dados.cep);
        if (dados.email) setEmail(dados.email);
        if (dados.telefone) setTelefone(dados.telefone);
        if (dados.nomeResponsavel) setNomeResponsavelCnpj(dados.nomeResponsavel);
        if (dados.cpfResponsavel) setCpfResponsavelCnpj(dados.cpfResponsavel);

        // Vínculo inteligente com Ministros cadastrados
        let ministroVinculado: Ministro | undefined;
        const cleanCpfResp = (dados.cpfResponsavel || '').replace(/\D/g, '');
        const nomeRespLimpo = (dados.nomeResponsavel || '').toLowerCase().trim();

        if (cleanCpfResp) {
          ministroVinculado = ministros.find(
            (m) => (m.cpf || '').replace(/\D/g, '') === cleanCpfResp
          );
        }

        if (!ministroVinculado && nomeRespLimpo && nomeRespLimpo.length >= 4) {
          ministroVinculado = ministros.find((m) => {
            const minNomeLimpo = (m.nome || '').toLowerCase().trim();
            return (
              minNomeLimpo === nomeRespLimpo ||
              minNomeLimpo.includes(nomeRespLimpo) ||
              nomeRespLimpo.includes(minNomeLimpo)
            );
          });
        }

        if (ministroVinculado) {
          setPastorPresidenteId(ministroVinculado.id);
          setPastorPresidenteNomeManual(ministroVinculado.nome);
          setFeedback({
            tipo: 'sucesso',
            texto: `CNPJ puxado com sucesso! Responsável legal "${dados.nomeResponsavel || ministroVinculado.nome}" identificado na Convenção como Ministro (${ministroVinculado.cargo}) e vinculado como Presidente da Igreja!`,
          });
        } else if (dados.nomeResponsavel) {
          setPastorPresidenteNomeManual(dados.nomeResponsavel);
          setFeedback({
            tipo: 'sucesso',
            texto: `Dados do CNPJ puxados com sucesso! Responsável pelo CNPJ: "${dados.nomeResponsavel}".`,
          });
        } else {
          setFeedback({
            tipo: 'sucesso',
            texto: 'Todos os dados disponíveis do CNPJ foram carregados da Receita Federal!',
          });
        }
        setTimeout(() => setFeedback(null), 5000);
      }
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro ao consultar CNPJ na Receita Federal.' });
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setCarregandoCnpj(false);
    }
  };

  const lidarComConsultaCep = async () => {
    if (!cep.trim()) {
      setFeedback({ tipo: 'erro', texto: 'Informe o CEP para buscar.' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    setCarregandoCep(true);
    try {
      const dados = await consultarCep(cep);
      if (dados) {
        setLogradouro(dados.rua);
        setBairro(dados.bairro);
        setMunicipio(dados.cidade);
        setUf(dados.uf);
        setCep(dados.cep);
        setFeedback({ tipo: 'sucesso', texto: 'Endereço puxado pelo CEP com sucesso!' });
        setTimeout(() => setFeedback(null), 3500);
      }
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro ao buscar CEP.' });
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setCarregandoCep(false);
    }
  };

  const lidarComUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({
        tipo: 'erro',
        texto: 'Selecione uma imagem válida (JPG, PNG ou SVG).',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setLogoUrl(base64);
        setFeedback({
          tipo: 'sucesso',
          texto: 'Logomarca carregada com sucesso!',
        });
        setTimeout(() => setFeedback(null), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  // Cidades únicas para o filtro
  const cidadesDisponiveis = useMemo(() => {
    const setCidades = new Set(
      (igrejasFiliadas || [])
        .map((i) => i?.municipio)
        .filter((m): m is string => Boolean(m && typeof m === 'string' && m.trim().length > 0))
    );
    return Array.from(setCidades);
  }, [igrejasFiliadas]);

  // Lista filtrada com proteção de nulidade absoluta (Zero-Trust)
  const igrejasFiltradas = useMemo(() => {
    const buscaNorm = (busca || '').toLowerCase().trim();
    return (igrejasFiliadas || []).filter((i) => {
      if (!i) return false;
      const nomeFantasiaNorm = (i.nomeFantasia || '').toLowerCase();
      const razaoSocialNorm = (i.razaoSocial || '').toLowerCase();
      const cnpjNorm = String(i.cnpj || '');
      const municipioNorm = (i.municipio || '').toLowerCase();
      const pastorNorm = (i.pastorPresidenteNome || '').toLowerCase();

      const bateBusca =
        !buscaNorm ||
        nomeFantasiaNorm.includes(buscaNorm) ||
        razaoSocialNorm.includes(buscaNorm) ||
        cnpjNorm.includes(buscaNorm) ||
        municipioNorm.includes(buscaNorm) ||
        pastorNorm.includes(buscaNorm);

      const bateStatus = filtroStatus === 'TODOS' || i.status === filtroStatus;
      const bateCidade = filtroCidade === 'TODAS' || i.municipio === filtroCidade;

      return bateBusca && bateStatus && bateCidade;
    });
  }, [igrejasFiliadas, busca, filtroStatus, filtroCidade]);

  // Lista de igrejas fatiada por paginação
  const igrejasExibidas = useMemo(() => {
    if (itensPorPagina === 'TODOS') return igrejasFiltradas;
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return igrejasFiltradas.slice(inicio, inicio + itensPorPagina);
  }, [igrejasFiltradas, paginaAtual, itensPorPagina]);

  // Mapeamento financeiro em tempo real por Igreja (Ministros vinculados, pendências e total inadimplente)
  const dadosFinanceirosPorIgreja = useMemo(() => {
    const mapa = new Map<
      string,
      {
        totalInadimplente: number;
        qtdInadimplentes: number;
        ministrosInadimplentes: Array<{
          id: string;
          nome: string;
          cpf: string;
          cargo: string;
          valor: number;
          anuidadeId?: string;
          ehFiliacao: boolean;
          rotulo: string;
        }>;
        totalMinistros: number;
      }
    >();

    const valorPadrao = appConfig?.taxaAnuidadeRecorrente || 120.0;
    const taxaFiliacaoPadrao = appConfig?.taxaFiliacaoInicial || 120.0;
    const hoje = new Date().toISOString().split('T')[0];

    for (const igreja of (igrejasFiliadas || [])) {
      if (!igreja) continue;
      const igrejaNomeFantasia = (igreja.nomeFantasia || '').toLowerCase().trim();
      const igrejaRazaoSocial = (igreja.razaoSocial || '').toLowerCase().trim();
      const pastorNome = (igreja.pastorPresidenteNome || '').toLowerCase().trim();
      const igrejaCidade = (igreja.municipio || '').toLowerCase().trim();

      const ministrosDaIgreja = (ministros || []).filter((m) => {
        if (!m) return false;
        const minIgrejaNome = (m.igrejaFiliadaNome || '').toLowerCase().trim();
        const minNome = (m.nome || '').toLowerCase().trim();
        const minCidade = (m.dadosEndereco?.cidade || '').toLowerCase().trim();

        return (
          (m.igrejaFiliadaId && m.igrejaFiliadaId === igreja.id) ||
          (minIgrejaNome.length > 0 &&
            ((igrejaNomeFantasia.length > 0 && minIgrejaNome === igrejaNomeFantasia) ||
             (igrejaRazaoSocial.length > 0 && minIgrejaNome === igrejaRazaoSocial))) ||
          (igreja.pastorPresidenteId && m.id === igreja.pastorPresidenteId) ||
          (pastorNome.length > 0 && minNome.length > 0 && minNome.includes(pastorNome)) ||
          (minCidade.length > 0 && igrejaCidade.length > 0 && minCidade === igrejaCidade)
        );
      });

      const listaInadimplentes: Array<{
        id: string;
        nome: string;
        cpf: string;
        cargo: string;
        valor: number;
        anuidadeId?: string;
        ehFiliacao: boolean;
        rotulo: string;
      }> = [];

      let somaInadimplente = 0;

      for (const m of ministrosDaIgreja) {
        // Regra estrita: apenas anuidades efetivamente inadimplentes (status ATRASADO, ATRASADA ou INADIMPLENTE) - SEM PENDENTES / ABERTOS
        const anuidadeInadimplente = anuidades.find((a) => {
          if (a.ministroId !== m.id) return false;
          const st = (a.statusPagamento || '').trim().toUpperCase();
          return (
            st === 'ATRASADO' ||
            st === 'ATRASADA' ||
            st === 'INADIMPLENTE'
          );
        });

        const statusMin = (m.statusAdimplencia || '').trim().toUpperCase();
        const ministroInadimplente =
          statusMin === 'INADIMPLENTE' ||
          statusMin === 'EM_ATRASO' ||
          Boolean(anuidadeInadimplente);

        if (ministroInadimplente) {
          const ehFiliacao =
            (anuidadeInadimplente &&
              (anuidadeInadimplente.categoria === 'TAXA_CONVENCAO' ||
                anuidadeInadimplente.id?.startsWith('an-fil-') ||
                anuidadeInadimplente.tipo === 'RECEITA')) ||
            (!anuidadeInadimplente && (statusMin === 'EM_ATRASO' || statusMin === 'INADIMPLENTE'));

          const valor = anuidadeInadimplente
            ? Number(anuidadeInadimplente.valor || valorPadrao)
            : ehFiliacao
            ? taxaFiliacaoPadrao
            : valorPadrao;

          somaInadimplente += valor;
          listaInadimplentes.push({
            id: m.id,
            nome: m.nome,
            cpf: m.cpf,
            cargo: m.cargo,
            valor,
            anuidadeId: anuidadeInadimplente?.id,
            ehFiliacao,
            rotulo: ehFiliacao
              ? 'Taxa de Filiação'
              : `Anuidade (${anuidadeInadimplente?.anoVigente || new Date().getFullYear()})`,
          });
        }
      }

      mapa.set(igreja.id, {
        totalInadimplente: somaInadimplente,
        qtdInadimplentes: listaInadimplentes.length,
        ministrosInadimplentes: listaInadimplentes,
        totalMinistros: ministrosDaIgreja.length,
      });
    }

    return mapa;
  }, [igrejasFiliadas, ministros, anuidades, appConfig]);

  // Abrir Modal de Regularização (Pagar / Anistia)
  const abrirModalRegularizacao = (igreja: IgrejaFiliada, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const dados = dadosFinanceirosPorIgreja.get(igreja.id);
    setIgrejaRegularizacao(igreja);
    setMinistrosSelecionadosReg((dados?.ministrosInadimplentes || []).map((m) => m.id));
    setAbaRegularizacao('PAGAMENTO');
    setMetodoPagamentoReg('PIX');
    setParcelasCartaoReg(1);
    setJustificativaAnistia('Resolução homologada pela Mesa Diretora / AGO da Convenção');
    setPresidenteValidador(operadorAtual || 'Presidência Geral CIMADEBE');
    setModalRegularizacaoAberto(true);
  };

  // Alternar seleção de ministro no modal de regularização
  const alternarSelecaoMinistroReg = (minId: string) => {
    setMinistrosSelecionadosReg((prev) =>
      prev.includes(minId) ? prev.filter((id) => id !== minId) : [...prev, minId]
    );
  };

  // Selecionar todos os ministros inadimplentes no modal
  const selecionarTodosMinistrosReg = () => {
    if (!igrejaRegularizacao) return;
    const dados = dadosFinanceirosPorIgreja.get(igrejaRegularizacao.id);
    const todos = (dados?.ministrosInadimplentes || []).map((m) => m.id);
    setMinistrosSelecionadosReg(todos);
  };

  // Executar Quitação / Pagamento no modal de regularização
  const lidarComExecutarPagamentoReg = async () => {
    if (!igrejaRegularizacao || ministrosSelecionadosReg.length === 0 || processandoAcaoReg) return;
    const dados = dadosFinanceirosPorIgreja.get(igrejaRegularizacao.id);
    if (!dados) return;

    const selecionados = dados.ministrosInadimplentes.filter((m) => ministrosSelecionadosReg.includes(m.id));
    const total = selecionados.reduce((acc, m) => acc + m.valor, 0);

    setProcessandoAcaoReg(true);
    try {
      for (const m of selecionados) {
        let anuidadeId = m.anuidadeId;
        if (!anuidadeId) {
          const anoAtual = new Date().getFullYear();
          const nova = await registrarAnuidade({
            ministroId: m.id,
            tenantId: tenantAtivoId,
            anoVigente: anoAtual,
            dataVencimento: `${anoAtual}-12-31`,
            valor: m.valor,
            statusPagamento: 'ABERTO',
            tipo: 'RECEITA',
            categoria: m.ehFiliacao ? 'TAXA_CONVENCAO' : 'ANUIDADE',
          });
          anuidadeId = nova.id;
        }

        if (anuidadeId) {
          await liquidarAnuidade(anuidadeId, 'MANUAL');
        }
      }

      const metodoDesc =
        metodoPagamentoReg === 'CARTAO'
          ? `Cartão de Crédito (${parcelasCartaoReg}x de R$ ${(total / parcelasCartaoReg).toFixed(2)})`
          : 'PIX Instantâneo';

      notifySuccess(
        'Pagamento Concluído',
        `Quitação de R$ ${total.toFixed(2)} (${metodoDesc}) realizada com sucesso para ${selecionados.length} ministro(s) da igreja ${igrejaRegularizacao.nomeFantasia}.`
      );

      setFeedback({
        tipo: 'sucesso',
        texto: `Pagamento de R$ ${total.toFixed(2)} liquidado no Ledger com sucesso para ${selecionados.length} ministro(s)!`,
      });
      setTimeout(() => setFeedback(null), 4000);
      setModalRegularizacaoAberto(false);
    } catch (err: any) {
      notifyError('Erro no Pagamento', err?.message || 'Falha ao processar pagamento unificado.');
    } finally {
      setProcessandoAcaoReg(false);
    }
  };

  // Executar Anistia no modal de regularização
  const lidarComExecutarAnistiaReg = async () => {
    if (!igrejaRegularizacao || ministrosSelecionadosReg.length === 0 || processandoAcaoReg) return;
    if (!justificativaAnistia.trim()) {
      notifyWarning('Campo Obrigatório', 'Informe a justificativa estatutária da anistia.');
      return;
    }

    const dados = dadosFinanceirosPorIgreja.get(igrejaRegularizacao.id);
    if (!dados) return;

    const selecionados = dados.ministrosInadimplentes.filter((m) => ministrosSelecionadosReg.includes(m.id));

    setProcessandoAcaoReg(true);
    try {
      for (const m of selecionados) {
        let anuidadeId = m.anuidadeId;
        if (!anuidadeId) {
          const anoAtual = new Date().getFullYear();
          const nova = await registrarAnuidade({
            ministroId: m.id,
            tenantId: tenantAtivoId,
            anoVigente: anoAtual,
            dataVencimento: `${anoAtual}-12-31`,
            valor: m.valor,
            statusPagamento: 'ABERTO',
            tipo: 'RECEITA',
            categoria: m.ehFiliacao ? 'TAXA_CONVENCAO' : 'ANUIDADE',
          });
          anuidadeId = nova.id;
        }

        if (anuidadeId) {
          await concederAnistia(
            m.id,
            [anuidadeId],
            justificativaAnistia.trim(),
            presidenteValidador.trim() || 'Presidência Geral CIMADEBE'
          );
        }
      }

      notifySuccess(
        'Anistia Homologada',
        `Anistia concedida com sucesso para ${selecionados.length} ministro(s) da igreja ${igrejaRegularizacao.nomeFantasia}.`
      );

      setFeedback({
        tipo: 'sucesso',
        texto: `Anistia homologada com sucesso para ${selecionados.length} ministro(s) da igreja ${igrejaRegularizacao.nomeFantasia}!`,
      });
      setTimeout(() => setFeedback(null), 4000);
      setModalRegularizacaoAberto(false);
    } catch (err: any) {
      notifyError('Erro na Anistia', err?.message || 'Falha ao homologar anistia.');
    } finally {
      setProcessandoAcaoReg(false);
    }
  };

  // Copiar Chave PIX do Modal de Regularização
  const copiarChavePixReg = (valor: number) => {
    const chave = `00020126580014br.gov.bcb.pix0136tesouraria@cimadebe.org.br520400005303986540${valor.toFixed(2)}5802BR5925CIMADEBE ESTADUAL SALVADOR6009SALVADOR62070503***6304`;
    navigator.clipboard.writeText(chave);
    setChavePixCopiadaReg(true);
    setTimeout(() => setChavePixCopiadaReg(false), 3000);
  };

  // Abrir Modal de Edição
  const abrirModalEditar = (igreja: IgrejaFiliada, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIgrejaEmEdicao(igreja);
    setRazaoSocial(igreja.razaoSocial);
    setNomeFantasia(igreja.nomeFantasia);
    setCnpj(igreja.cnpj);
    setDataAbertura(igreja.dataAbertura);
    setNaturezaJuridica(igreja.naturezaJuridica);
    setCnaePrincipal(igreja.cnaePrincipal);
    setSituacaoCadastral(igreja.situacaoCadastral);
    setLogradouro(igreja.logradouro);
    setNumero(igreja.numero);
    setComplemento(igreja.complemento || '');
    setBairro(igreja.bairro);
    setMunicipio(igreja.municipio);
    setUf(igreja.uf);
    setCep(igreja.cep);
    setEmail(igreja.email);
    setTelefone(igreja.telefone);
    setPastorPresidenteId(igreja.pastorPresidenteId);
    setLogoUrl(igreja.logoUrl);
    setModalEditarAberto(true);
  };

  // Salvar Edição
  const lidarComSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaEmEdicao || salvandoEdicao) return;

    // 1. Validação Rígida via Schema Zod (Fail-Fast antes de bater na rede)
    const validacaoZod = schemaIgrejaEdicao.safeParse({
      razaoSocial,
      nomeFantasia,
      cnpj,
      municipio,
      uf,
      email,
      telefone,
    });

    if (!validacaoZod.success) {
      const primeiroErro = validacaoZod.error.issues[0]?.message || 'Dados inválidos no formulário.';
      setFeedback({ tipo: 'erro', texto: primeiroErro });
      notifyError('Validação Rejeitada', primeiroErro);
      return;
    }

    // Verificação de CNPJ duplicado em outras igrejas
    const cleanCnpjEdicao = (cnpj || '').replace(/\D/g, '');
    const igrejaComMesmoCnpj = igrejasFiliadas.find((ig) => {
      if (ig.id === igrejaEmEdicao.id) return false;
      const igCnpjLimpo = (ig.cnpj || '').replace(/\D/g, '');
      return (cleanCnpjEdicao.length >= 8 && igCnpjLimpo === cleanCnpjEdicao) || (ig.cnpj && ig.cnpj.trim() === cnpj.trim());
    });

    if (igrejaComMesmoCnpj) {
      const alerta = `Não é possível salvar: O CNPJ ${cnpj} já está vinculado à igreja "${igrejaComMesmoCnpj.nomeFantasia || igrejaComMesmoCnpj.razaoSocial}".`;
      setFeedback({ tipo: 'erro', texto: alerta });
      notifyWarning('CNPJ Já Cadastrado', alerta);
      return;
    }

    setSalvandoEdicao(true);

    const pastor = ministros.find((m) => m.id === pastorPresidenteId);
    const pastorNome = pastor
      ? pastor.nome
      : (pastorPresidenteNomeManual.trim() || nomeResponsavelCnpj.trim() || igrejaEmEdicao.pastorPresidenteNome);
    const pastorCpf = pastor ? (pastor.cpf || '') : cpfResponsavelCnpj;

    try {
      const idSanitizado = igrejaEmEdicao.id.trim();
      const payloadLimpo: Record<string, any> = {
        razaoSocial: razaoSocial.trim(),
        nomeFantasia: nomeFantasia.trim(),
        cnpj: cleanCnpjEdicao,
        dataAbertura: dataAbertura.trim(),
        naturezaJuridica: naturezaJuridica.trim(),
        cnaePrincipal: cnaePrincipal.trim(),
        situacaoCadastral,
        logradouro: logradouro.trim(),
        numero: numero.trim(),
        complemento: (complemento || '').trim(),
        bairro: bairro.trim(),
        municipio: municipio.trim(),
        uf: uf.trim().toUpperCase(),
        cep: (cep || '').trim(),
        email: (email || '').toLowerCase().trim(),
        telefone: (telefone || '').trim(),
        pastorPresidenteId: pastor ? pastor.id : igrejaEmEdicao.pastorPresidenteId,
        pastorPresidenteNome: pastorNome,
        pastorPresidenteCpf: pastorCpf,
        logoUrl: logoUrl || '',
        atualizado_em: new Date().toISOString(),
      };

      // EXPURGO DE MERGES CEGOS: Exclusivamente updateDoc com ID estrito no Firestore
      await updateDoc(doc(db, 'igrejas', idSanitizado), payloadLimpo);

      await editarIgreja(idSanitizado, payloadLimpo as any);

      if (pastor) {
        editarMinistro(pastor.id, {
          ehPresidenteIgreja: true,
          igrejaPresidenteNome: nomeFantasia || razaoSocial,
          igrejaFiliadaId: igrejaEmEdicao.id,
          igrejaFiliadaNome: nomeFantasia,
        }).catch((err) => console.warn('[VINCULO_PRESIDENTE_ERR]', err));
      }

      setModalEditarAberto(false);
      setFeedback({
        tipo: 'sucesso',
        texto: `Igreja filiada ${nomeFantasia} atualizada com sucesso!`,
      });
      notifySuccess('Igreja Atualizada', `Os dados de ${nomeFantasia} foram atualizados no banco.`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao editar igreja.';
      setFeedback({
        tipo: 'erro',
        texto: msg,
      });
      notifyError('Erro na Atualização', msg);
    } finally {
      setSalvandoEdicao(false);
    }
  };

  // Cadastrar Nova Igreja
  const lidarComSalvarNova = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvandoNova) return;

    // Verificação Instantânea de CNPJ Duplicado
    const cleanCnpjNovo = (cnpj || '').replace(/\D/g, '');
    const igrejaJaCadastrada = igrejasFiliadas.find((ig) => {
      const igCnpjLimpo = (ig.cnpj || '').replace(/\D/g, '');
      return (cleanCnpjNovo.length >= 8 && igCnpjLimpo === cleanCnpjNovo) || (ig.cnpj && ig.cnpj.trim() === cnpj.trim());
    });

    if (igrejaJaCadastrada) {
      const alerta = `CNPJ Já Cadastrado: A igreja "${igrejaJaCadastrada.nomeFantasia || igrejaJaCadastrada.razaoSocial}" já está homologada com o CNPJ ${cnpj}.`;
      setFeedback({ tipo: 'erro', texto: alerta });
      notifyWarning('CNPJ Já Cadastrado', alerta);
      return;
    }

    setSalvandoNova(true);

    const pastor = ministros.find((m) => m.id === pastorPresidenteId);
    const pastorNome = pastor
      ? pastor.nome
      : (pastorPresidenteNomeManual.trim() || nomeResponsavelCnpj.trim() || 'Pastor Responsável a Designar');
    const pastorCpf = pastor ? (pastor.cpf || '') : cpfResponsavelCnpj;

    try {
      const criada = await cadastrarIgreja({
        tenantId: tenantAtivoId,
        razaoSocial,
        nomeFantasia,
        cnpj,
        dataAbertura,
        naturezaJuridica,
        cnaePrincipal,
        situacaoCadastral,
        logradouro,
        numero,
        complemento,
        bairro,
        municipio,
        uf,
        cep,
        email: email || (nomeFantasia ? `contato@${nomeFantasia.toLowerCase().replace(/\s+/g, '')}.org.br` : ''),
        telefone,
        pastorPresidenteId: pastor ? pastor.id : '',
        pastorPresidenteNome: pastorNome,
        pastorPresidenteCpf: pastorCpf,
        logoUrl: logoUrl || '',
        status: 'ATIVA',
      });

      if (pastor) {
        editarMinistro(pastor.id, {
          ehPresidenteIgreja: true,
          igrejaPresidenteNome: criada.nomeFantasia || criada.razaoSocial,
          igrejaFiliadaId: criada.id,
          igrejaFiliadaNome: criada.nomeFantasia,
        }).catch((err) => console.warn('[VINCULO_PRESIDENTE_ERR]', err));
      }

      setModalNovoAberto(false);
      setFeedback({
        tipo: 'sucesso',
        texto: `Igreja Filiada ${criada.nomeFantasia} homologada com sucesso no cadastro convencional!`,
      });
      notifySuccess('Igreja Filiada Homologada', `A igreja ${criada.nomeFantasia} foi cadastrada com sucesso.`);
      setTimeout(() => setFeedback(null), 4000);

      // Limpar formulário
      setRazaoSocial('');
      setNomeFantasia('');
      setCnpj('');
    } catch (err: any) {
      const msg = err?.message || 'Erro ao cadastrar igreja.';
      setFeedback({
        tipo: 'erro',
        texto: msg,
      });
      notifyError('Erro no Cadastro', msg);
    } finally {
      setSalvandoNova(false);
    }
  };

  // Alternar Status (Habilitar / Suspender Igreja)
  const lidarComAlternarStatus = async (igreja: IgrejaFiliada, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const dadosFin = dadosFinanceirosPorIgreja.get(igreja.id);
    const totalInadimplente = dadosFin?.totalInadimplente || 0;
    const tentandoHabilitar = igreja.status === 'SUSPENSA';

    // REGRA DE NEGÓCIO ESTATUTÁRIA:
    // A igreja só pode ser HABILITADA (de SUSPENSA para ATIVA) caso haja o pagamento dos valores existentes (totalInadimplente === 0).
    // Se a igreja estiver ATIVA, ela PODE ser DESABILITADA (suspensa) a qualquer momento pelo administrador.
    if (tentandoHabilitar && totalInadimplente > 0) {
      const msg = 'A igreja só pode ser habilitada caso haja o pagamento dos valores existente.';
      setFeedback({
        tipo: 'erro',
        texto: msg,
      });
      notifyWarning('Habilitação Bloqueada', msg);
      return;
    }

    if (!tentandoHabilitar) {
      setIgrejaParaDesativar(igreja);
      setModalDesativarAberto(true);
      return;
    }

    try {
      await alternarStatusIgreja(igreja.id);
      const msgAcao = `Igreja ${igreja.nomeFantasia} foi HABILITADA (ATIVA) com sucesso.`;

      setFeedback({
        tipo: 'sucesso',
        texto: msgAcao,
      });
      notifySuccess('Status Alterado', msgAcao);
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao alternar status da igreja.';
      setFeedback({
        tipo: 'erro',
        texto: msg,
      });
      notifyError('Erro no Status', msg);
    }
  };

  const lidarComConfirmarDesativacao = async () => {
    if (!igrejaParaDesativar || desativando) return;
    setDesativando(true);
    try {
      await alternarStatusIgreja(igrejaParaDesativar.id);
      setModalDesativarAberto(false);
      const msgAcao = `Igreja ${igrejaParaDesativar.nomeFantasia} foi DESABILITADA (SUSPENSA) e os ministros vinculados foram suspensos em cadeia.`;
      setFeedback({
        tipo: 'sucesso',
        texto: msgAcao,
      });
      notifySuccess('Status Alterado', msgAcao);
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao alternar status da igreja.';
      setFeedback({
        tipo: 'erro',
        texto: msg,
      });
      notifyError('Erro no Status', msg);
    } finally {
      setDesativando(false);
      setIgrejaParaDesativar(null);
    }
  };

  // Abrir Modal Deletar
  const abrirModalDeletar = (igreja: IgrejaFiliada, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIgrejaParaDeletar(igreja);
    setJustificativaDelecao('');
    setModalDeletarAberto(true);
  };
 
  const lidarComConfirmarDelecao = async () => {
    if (!igrejaParaDeletar || deletando) return;
    if (!justificativaDelecao.trim()) {
      notifyWarning('Justificativa Requerida', 'Informe uma justificativa válida para realizar a exclusão.');
      return;
    }
    setDeletando(true);
 
    try {
      await deletarIgreja(igrejaParaDeletar.id, justificativaDelecao.trim());
      setModalDeletarAberto(false);
      setJustificativaDelecao('');
      setFeedback({
        tipo: 'sucesso',
        texto: `Igreja ${igrejaParaDeletar.nomeFantasia} excluída da convenção.`,
      });
      notifySuccess('Igreja Removida', `A igreja ${igrejaParaDeletar.nomeFantasia} foi descredenciada.`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao deletar igreja.';
      setFeedback({
        tipo: 'erro',
        texto: msg,
      });
      notifyError('Erro na Exclusão', msg);
    } finally {
      setDeletando(false);
    }
  };

  const lidarComExportarPdf = () => {
    try {
      exportarPdfTabelaIgrejasFiltradas(
        igrejasFiltradas,
        {
          busca,
          cidade: filtroCidade,
          status: filtroStatus,
        },
        appConfig
      );
      notifySuccess('Relatório Gerado', `Exportado PDF com ${igrejasFiltradas.length} congregações.`);
    } catch (err: any) {
      notifyError('Erro na Exportação', err?.message || 'Falha ao exportar PDF das igrejas.');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Feedback Alerta */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold shadow-lg animate-fadeIn ${
            feedback.tipo === 'sucesso'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-300'
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

      {/* Top Banner das Igrejas Filiadas */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-teal-950/40 to-slate-950 border border-teal-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">
                REDE DE COMUNHÃO
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                • Cartão CNPJ Oficial & Ministros Vinculados
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white mt-1 flex items-center gap-2.5">
              <Building2 className="w-7 h-7 text-emerald-400" />
              Igrejas Filiadas ({igrejasFiliadas.length})
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Relação oficial de todas as congregações e templos federados à CIMADEBE.
              Clique em qualquer card para visualizar o <strong>Perfil Completo da Igreja</strong> e todos os seus ministros.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={lidarComExportarPdf}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-emerald-400 border border-emerald-500/40 font-bold text-xs shadow-lg transition-all cursor-pointer"
              title="Exportar listagem filtrada de congregações em PDF"
            >
              <Download className="w-4 h-4" />
              <span>Exportar PDF ({igrejasFiltradas.length})</span>
            </button>

            <button
              onClick={() => {
                setRazaoSocial('');
                setNomeFantasia('');
                setCnpj('');
                setModalNovoAberto(true);
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Igreja Filiada</span>
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome, razão social, CNPJ, cidade ou pastor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Filtro Cidade */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-mono text-slate-500">MUNICÍPIO:</span>
            <select
              aria-label="Filtrar por Município"
              value={filtroCidade}
              onChange={(e) => setFiltroCidade(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-1"
            >
              <option value="TODAS" className="bg-slate-900 text-white">Todos os Municípios</option>
              {cidadesDisponiveis.map((cid) => (
                <option key={cid} value={cid} className="bg-slate-900 text-white">{cid}</option>
              ))}
            </select>
          </div>

          {/* Filtro Status */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <span className="text-[10px] font-mono text-slate-500">STATUS:</span>
            <select
              aria-label="Filtrar por Status da Igreja"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-1"
            >
              <option value="TODOS" className="bg-slate-900 text-white">Todos</option>
              <option value="ATIVA" className="bg-slate-900 text-white">Ativas</option>
              <option value="SUSPENSA" className="bg-slate-900 text-white">Suspensas</option>
            </select>
          </div>

          <button
            onClick={lidarComExportarPdf}
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-emerald-400 border border-slate-800 hover:border-emerald-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            title="Exportar PDF desta busca"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>

      {/* Seletor de Modo de Visualização (Lista vs Mapa Geográfico) */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-900/80 border border-slate-800 rounded-2xl p-3 px-5 gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-white font-bold">Modo de Exibição das Congregações:</span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setModoVisualizacao('lista')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              modoVisualizacao === 'lista'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Lista em Cards ({igrejasFiltradas.length})</span>
          </button>
          <button
            onClick={() => setModoVisualizacao('mapa')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              modoVisualizacao === 'mapa'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>🗺️ Mapa Interativo Geográfico</span>
          </button>
        </div>
      </div>

      {/* Visualização de Mapa Interativo do Google Maps */}
      {modoVisualizacao === 'mapa' && (
        <GoogleMapsIgrejasView igrejas={igrejasFiltradas} onSelecionarIgreja={onSelecionarIgreja} />
      )}

      {/* Listagem de Igrejas Filiadas em Grade Adaptável */}
      {modoVisualizacao === 'lista' && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-3 sm:gap-3.5 min-w-0">
        {igrejasExibidas.map((igreja) => {
          const ehAtiva = igreja.status === 'ATIVA';
          const dadosFin = dadosFinanceirosPorIgreja.get(igreja.id) || {
            totalInadimplente: 0,
            qtdInadimplentes: 0,
            ministrosInadimplentes: [],
            totalMinistros: 0,
          };
          const totalInadimplente = dadosFin.totalInadimplente;
          const qtdInadimplentes = dadosFin.qtdInadimplentes;
          const estaDevendo = totalInadimplente > 0;

          return (
            <div
              key={igreja.id}
              onClick={() => onSelecionarIgreja(igreja.id)}
              className={`p-3.5 sm:p-4 rounded-xl border transition-all flex flex-col justify-between shadow-sm group cursor-pointer relative overflow-hidden min-w-0 ${
                !ehAtiva
                  ? estaDevendo
                    ? 'bg-slate-900 border-rose-900/60 hover:border-rose-500/50'
                    : 'bg-slate-900/60 border-slate-800/80 opacity-60 hover:opacity-90'
                  : 'bg-slate-900/70 border-slate-800/80 hover:border-emerald-500/40'
              }`}
            >
              <div className="space-y-3">
                {/* Header: Logo, Status e Nome */}
                <div className="flex items-start justify-between gap-2.5">
                  <img
                    src={igreja.logoUrl}
                    alt={igreja.nomeFantasia}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-700 bg-slate-950 shadow-sm group-hover:border-emerald-400 transition-colors shrink-0"
                  />

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1.5 ${
                      ehAtiva
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                        : 'bg-rose-950 text-rose-400 border-rose-500/40'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${ehAtiva ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}
                    />
                    {igreja.status}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-white text-base group-hover:text-emerald-300 transition-colors font-sans">
                    {igreja.nomeFantasia}
                  </h3>
                  <span className="text-[11px] text-slate-400 block font-mono">
                    CNPJ: {igreja.cnpj}
                  </span>
                </div>

                {/* Pastor Responsável e Cidade */}
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <BadgeCheck className="w-4 h-4 shrink-0" />
                    <span className="truncate">{igreja.pastorPresidenteNome}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{igreja.municipio} / {igreja.uf} ({igreja.bairro})</span>
                  </div>
                </div>

                {/* BLOCO DE DESTAQUE: VALORES INADIMPLENTES & PENDÊNCIAS (Some se a igreja não estiver devendo nada) */}
                {estaDevendo && (
                  <div className="p-3 rounded-2xl border text-xs font-mono space-y-1.5 transition-all bg-amber-950/40 border-amber-500/50 shadow-sm shadow-amber-950/20">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                        Débitos Inadimplentes
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-amber-950 text-amber-300 border-amber-500/40">
                        {qtdInadimplentes} pendente(s)
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between pt-0.5">
                      <span className="text-base font-black font-mono tracking-tight text-amber-400">
                        R$ {totalInadimplente.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {dadosFin.totalMinistros} ministro(s)
                      </span>
                    </div>
                  </div>
                )}

                {/* Razão Social & Situação */}
                <div className="text-[11px] text-slate-400 space-y-1 font-mono">
                  <div className="truncate">
                    <span className="text-slate-600">Razão:</span> {igreja.razaoSocial}
                  </div>
                  <div>
                    <span className="text-slate-600">Filiação:</span> {formatarDataBR(igreja.dataFiliacao)}
                  </div>
                </div>
              </div>

              {/* Ações Rápidas no Card */}
              <div
                className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onSelecionarIgreja(igreja.id)}
                    className="px-2.5 py-1.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Ver Perfil</span>
                  </button>

                  {/* Botão Pagar / Regularizar: Some se não estiver devendo nada. Se estiver devendo, fica verde e não fica opaco */}
                  {estaDevendo && (
                    <button
                      type="button"
                      onClick={(e) => abrirModalRegularizacao(igreja, e)}
                      title="Abrir opções de Pagamento unificado e Regularização dos débitos"
                      className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 shadow-md shadow-emerald-950/40 cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-white" />
                      <span>Pagar</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => abrirModalEditar(igreja, e)}
                    className="p-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-cyan-400 transition-all cursor-pointer"
                    title="Editar Igreja"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {/* Botão de Alternar Status (Power): Reflete status Ativa/Suspensa e regras de bloqueio */}
                  <button
                    onClick={(e) => lidarComAlternarStatus(igreja, e)}
                    className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                      ehAtiva
                        ? 'bg-emerald-950 hover:bg-rose-950 border-emerald-500/60 hover:border-rose-500 text-emerald-400 hover:text-rose-400 shadow-md shadow-emerald-950/40'
                        : estaDevendo
                        ? 'bg-rose-950 hover:bg-rose-900 border-rose-500 text-rose-300 shadow-md shadow-rose-950/50'
                        : 'bg-slate-900 hover:bg-emerald-950 border-slate-700 hover:border-emerald-500 text-slate-400 hover:text-emerald-400'
                    }`}
                    title={
                      ehAtiva
                        ? 'Igreja Ativa: Clique para Suspender/Desabilitar'
                        : estaDevendo
                        ? 'Igreja Suspensa com Pendências: A igreja só pode ser habilitada caso haja o pagamento dos valores existentes.'
                        : 'Igreja Suspensa: Clique para Habilitar/Ativar'
                    }
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => abrirModalDeletar(igreja, e)}
                    className="p-1.5 rounded-xl bg-slate-950 hover:bg-rose-950/80 border border-slate-800 hover:border-rose-500/50 text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                    title="Deletar Igreja"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Controle de Paginação (15 / 30 / 50 / TODOS) */}
      <PaginacaoGeral
        totalItems={igrejasFiltradas.length}
        itensPorPagina={itensPorPagina}
        paginaAtual={paginaAtual}
        onMudancaPagina={setPaginaAtual}
        onMudancaItensPorPagina={setItensPorPagina}
      />

      {igrejasFiltradas.length === 0 && (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-3xl space-y-3">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-300">Nenhuma igreja filiada encontrada</h3>
          <p className="text-xs text-slate-500">Tente buscar por outros termos ou cadastre uma nova igreja.</p>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL RESPONSIVO: CADASTRAR IGREJA (CARTÃO CNPJ) */}
      {/* ======================================================== */}
      {modalNovoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-5 shadow-2xl animate-fadeIn my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Cadastrar Nova Igreja Filiada</h3>
                  <span className="text-xs text-slate-400">Dados cadastrais completos do Cartão CNPJ e logotipo</span>
                </div>
              </div>
              <button
                onClick={() => setModalNovoAberto(false)}
                className="text-slate-400 hover:text-white text-xs font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={lidarComSalvarNova} className="space-y-4 text-xs font-mono">
              {/* Seção 1: CNPJ em Primeiro Lugar (Busca e Preenchimento Automático) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/60 via-slate-950 to-slate-950 border-2 border-emerald-500/60 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-emerald-300 font-black uppercase flex items-center gap-1.5 tracking-wider">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    1. Informe Primeiro o CNPJ (Preenchimento Automático)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                    RECEITA FEDERAL / BRASILAPI
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
                  <div className="flex-1">
                    <label className="block text-slate-300 font-bold mb-1">
                      CNPJ da Igreja Filiada (14 dígitos):
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="00.000.000/0001-00"
                      value={cnpj}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCnpj(v);
                        const clean = v.replace(/\D/g, '');
                        if (clean.length === 14) {
                          lidarComConsultaCnpj(clean);
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-base font-bold tracking-wider font-mono focus:outline-none focus:border-emerald-400 shadow-inner"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => lidarComConsultaCnpj()}
                    disabled={carregandoCnpj}
                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 text-slate-950 ${carregandoCnpj ? 'animate-spin' : ''}`} />
                    <span>{carregandoCnpj ? 'Consultando...' : 'Puxar Dados do CNPJ'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                  💡 Digite o CNPJ para preencher automaticamente Razão Social, Nome Fantasia, Endereço Completo, Contatos, e identificar se o Pastor Presidente já é ministro cadastrado na Convenção.
                </p>
              </div>

              {/* Seção 2: Pastor Presidente / Responsável pelo CNPJ */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase block flex items-center gap-1">
                    <BadgeCheck className="w-3.5 h-3.5 text-cyan-400" />
                    2. Pastor Presidente / Responsável pelo CNPJ
                  </span>
                  {nomeResponsavelCnpj && (
                    <span className="text-[10px] font-mono text-slate-400">
                      Sócio/Presidente RFB: <strong className="text-white">{nomeResponsavelCnpj}</strong>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Vincular a Ministro Cadastrado:</label>
                    <select
                      value={pastorPresidenteId}
                      onChange={(e) => {
                        const mId = e.target.value;
                        setPastorPresidenteId(mId);
                        const min = ministros.find((m) => m.id === mId);
                        if (min) {
                          setPastorPresidenteNomeManual(min.nome);
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-500 font-sans"
                    >
                      <option value="">-- Selecione o ministro que preside a igreja --</option>
                      {ministros.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome} ({m.cargo}) - CPF: {m.cpf}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Nome do Pastor Presidente:</label>
                    <input
                      type="text"
                      required
                      placeholder="Nome do Pastor Presidente ou Responsável"
                      value={pastorPresidenteNomeManual}
                      onChange={(e) => setPastorPresidenteNomeManual(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-500 font-sans"
                    />
                  </div>
                </div>

                {pastorPresidenteId && (
                  <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/40 flex items-center gap-2 text-cyan-300 text-[11px] font-sans">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>
                      Este ministro será identificado na Convenção com o badge <strong>Presidente de Igreja ({nomeFantasia || razaoSocial || 'Filiada'})</strong>.
                    </span>
                  </div>
                )}
              </div>

              {/* Seção 3: Identificação Cadastral RFB */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">
                  3. Dados Oficiais da Entidade Religiosa (Puxados do CNPJ)
                </span>

                <div>
                  <label className="block text-slate-400 mb-1">Razão Social Oficial:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: IGREJA EVANGÉLICA ASSEMBLEIA DE DEUS TEMPLO CENTRAL"
                    value={razaoSocial}
                    onChange={(e) => setRazaoSocial(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Nome Fantasia:</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: AD Templo Central"
                      value={nomeFantasia}
                      onChange={(e) => setNomeFantasia(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Data de Abertura:</label>
                    <input
                      type="date"
                      required
                      value={dataAbertura}
                      onChange={(e) => setDataAbertura(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white text-[11px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Situação Cadastral:</label>
                    <select
                      value={situacaoCadastral}
                      onChange={(e) => setSituacaoCadastral(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white text-[11px]"
                    >
                      <option value="ATIVA">ATIVA</option>
                      <option value="SUSPENSA">SUSPENSA</option>
                      <option value="BAIXADA">BAIXADA</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Natureza Jurídica:</label>
                    <input
                      type="text"
                      value={naturezaJuridica}
                      onChange={(e) => setNaturezaJuridica(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white text-[11px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">CNAE Principal:</label>
                  <input
                    type="text"
                    value={cnaePrincipal}
                    onChange={(e) => setCnaePrincipal(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white text-[11px]"
                  />
                </div>
              </div>

              {/* Seção 4: Endereço Sede */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">
                  4. Localização, Contatos & Logomarca
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      placeholder="Logradouro / Avenida"
                      required
                      value={logradouro}
                      onChange={(e) => setLogradouro(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white text-[11px]"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Número"
                      required
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white text-[11px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <input
                      type="text"
                      placeholder="Complemento"
                      value={complemento}
                      onChange={(e) => setComplemento(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white text-[11px]"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Bairro"
                      required
                      value={bairro}
                      onChange={(e) => setBairro(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white text-[11px]"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Município"
                      required
                      value={municipio}
                      onChange={(e) => setMunicipio(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white text-[11px]"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-400">CEP:</span>
                      <button
                        type="button"
                        onClick={lidarComConsultaCep}
                        className="text-[10px] text-emerald-400 hover:underline font-bold cursor-pointer"
                      >
                        {carregandoCep ? 'Buscando...' : '🔍 Buscar CEP'}
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="CEP"
                      required
                      value={cep}
                      onChange={(e) => setCep(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white text-[11px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-slate-400 mb-1">E-mail Institucional:</label>
                    <input
                      type="email"
                      placeholder="contato@igreja.org.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white text-[11px]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Telefone da Igreja:</label>
                    <input
                      type="text"
                      placeholder="(71) 3321-0000"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white text-[11px]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Logomarca da Igreja:</label>
                    <div className="flex items-center gap-2">
                      <img
                        src={logoUrl}
                        alt="Logo Preview"
                        className="w-9 h-9 rounded-lg object-cover border border-slate-700 bg-slate-900"
                      />
                      <input
                        type="file"
                        ref={uploadLogoNovoRef}
                        onChange={lidarComUploadLogo}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => uploadLogoNovoRef.current?.click()}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Upload className="w-3 h-3 text-emerald-400" />
                        <span>Upload Logo</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  disabled={salvandoNova}
                  onClick={() => setModalNovoAberto(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoNova}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {salvandoNova && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{salvandoNova ? 'Homologando...' : 'Confirmar Homologação'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL RESPONSIVO: EDITAR IGREJA */}
      {/* ======================================================== */}
      {modalEditarAberto && igrejaEmEdicao && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-5 shadow-2xl animate-fadeIn my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Edit3 className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-base">Editar {igrejaEmEdicao.nomeFantasia}</h3>
              </div>
              <button
                onClick={() => setModalEditarAberto(false)}
                className="text-slate-400 hover:text-white text-xs font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={lidarComSalvarEdicao} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1">Razão Social:</label>
                <input
                  type="text"
                  required
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-500 font-sans font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Nome Fantasia:</label>
                  <input
                    type="text"
                    required
                    value={nomeFantasia}
                    onChange={(e) => setNomeFantasia(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-500 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">CNPJ:</label>
                  <input
                    type="text"
                    required
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Pastor Presidente:</label>
                  <select
                    value={pastorPresidenteId}
                    onChange={(e) => setPastorPresidenteId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-500 font-sans"
                  >
                    {ministros.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome} ({m.cargo})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Logomarca Oficial (Upload):</label>
                  <div className="flex items-center gap-3">
                    <img
                      src={logoUrl}
                      alt="Logo Preview"
                      className="w-10 h-10 rounded-xl object-cover border border-slate-700 bg-slate-950"
                    />
                    <input
                      type="file"
                      ref={uploadLogoEditRef}
                      onChange={lidarComUploadLogo}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => uploadLogoEditRef.current?.click()}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Trocar Logo</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="col-span-2">
                  <input
                    type="text"
                    placeholder="Logradouro"
                    value={logradouro}
                    onChange={(e) => setLogradouro(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-[11px]"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Município"
                    value={municipio}
                    onChange={(e) => setMunicipio(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-[11px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  disabled={salvandoEdicao}
                  onClick={() => setModalEditarAberto(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoEdicao}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {salvandoEdicao && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{salvandoEdicao ? 'Salvando...' : 'Salvar Alterações'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL RESPONSIVO: CONFIRMAR DELEÇÃO */}
      {/* ======================================================== */}
      {modalDeletarAberto && igrejaParaDeletar && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-fadeIn">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Confirmar Exclusão</h3>
                <span className="text-xs text-slate-400">Operação com registro em Ledger</span>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Tem certeza que deseja desvincular e remover a igreja{' '}
              <strong className="text-white">{igrejaParaDeletar.nomeFantasia}</strong> (CNPJ: {igrejaParaDeletar.cnpj}) do cadastro da convenção?
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-rose-400 font-bold uppercase block">JUSTIFICATIVA OBRIGATÓRIA:</label>
              <textarea
                required
                rows={3}
                placeholder="Informe detalhadamente a justificativa para exclusão definitiva desta igreja do cadastro..."
                value={justificativaDelecao}
                onChange={(e) => setJustificativaDelecao(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500/50 resize-none font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                disabled={deletando}
                onClick={() => setModalDeletarAberto(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={lidarComConfirmarDelecao}
                disabled={deletando || !justificativaDelecao.trim() || justificativaDelecao.trim().length < 5}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deletando && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{deletando ? 'Excluindo...' : 'Sim, Excluir Igreja'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL RESPONSIVO: CONFIRMAR DESATIVAÇÃO (SUSPENSÃO) */}
      {/* ======================================================== */}
      {modalDesativarAberto && igrejaParaDesativar && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-fadeIn">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Confirmar Desativação</h3>
                <span className="text-xs text-slate-400">Suspensão de Igreja Filiada e Ministros</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Deseja realmente desabilitar a igreja <strong className="text-white">"{igrejaParaDesativar.nomeFantasia}"</strong>?
              <br /><br />
              <span className="text-amber-400 font-bold">ATENÇÃO:</span> Se desabilitar esta igreja filiada, ela só poderá ser reativada caso haja o pagamento de débitos ativos e regularização estatutária.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                disabled={desativando}
                onClick={() => setModalDesativarAberto(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={lidarComConfirmarDesativacao}
                disabled={desativando}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-all shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {desativando && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{desativando ? 'Desabilitando...' : 'Sim, Desabilitar Igreja'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL RESPONSIVO: REGULARIZAÇÃO, PAGAMENTO & ANISTIA */}
      {/* ======================================================== */}
      {modalRegularizacaoAberto && igrejaRegularizacao && (() => {
        const dadosFin = dadosFinanceirosPorIgreja.get(igrejaRegularizacao.id) || {
          totalInadimplente: 0,
          qtdInadimplentes: 0,
          ministrosInadimplentes: [],
          totalMinistros: 0,
        };

        const ministrosAlvo = dadosFin.ministrosInadimplentes;
        const ministrosSelecionadosObj = ministrosAlvo.filter((m) =>
          ministrosSelecionadosReg.includes(m.id)
        );
        const totalSelecionado = ministrosSelecionadosObj.reduce(
          (acc, m) => acc + m.valor,
          0
        );

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-3xl w-full p-5 sm:p-7 space-y-5 shadow-2xl animate-fadeIn my-auto max-h-[90vh] overflow-y-auto">
              {/* Topo do Modal */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">
                        REGULARIZAÇÃO DA CONGREGAÇÃO
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/40">
                        CONGREGAÇÃO ATIVA / EM DIAS
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-white mt-0.5 font-sans">
                      {igrejaRegularizacao.nomeFantasia}
                    </h3>
                    <span className="text-xs text-slate-400 font-mono">
                      CNPJ: {igrejaRegularizacao.cnpj} • Pastor: {igrejaRegularizacao.pastorPresidenteNome}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setModalRegularizacaoAberto(false)}
                  className="text-slate-400 hover:text-white text-sm font-mono cursor-pointer p-1"
                >
                  ✕
                </button>
              </div>

              {/* Seletor de Abas: Pagamento vs Anistia */}
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setAbaRegularizacao('PAGAMENTO')}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    abaRegularizacao === 'PAGAMENTO'
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>1. Efetuar Pagamento</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAbaRegularizacao('ANISTIA')}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    abaRegularizacao === 'ANISTIA'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Gift className="w-4 h-4" />
                  <span>2. Conceder Anistia Convencional</span>
                </button>
              </div>

              {/* Relação de Ministros Inadimplentes da Igreja */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 font-mono flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    Selecione os Ministros para Regularização ({ministrosSelecionadosReg.length} de {ministrosAlvo.length}):
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selecionarTodosMinistrosReg}
                      className="text-[11px] font-mono text-emerald-400 hover:underline cursor-pointer font-bold"
                    >
                      Selecionar Todos
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => setMinistrosSelecionadosReg([])}
                      className="text-[11px] font-mono text-slate-400 hover:underline cursor-pointer"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                {ministrosAlvo.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-center space-y-1">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <span className="text-xs font-bold text-white block">Nenhum débito inadimplente localizado!</span>
                    <span className="text-[11px] text-slate-400">Todos os ministros vinculados a esta igreja estão 100% em dia.</span>
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/80 rounded-2xl bg-slate-950 border border-slate-800 p-2">
                    {ministrosAlvo.map((m) => {
                      const selecionado = ministrosSelecionadosReg.includes(m.id);
                      return (
                        <div
                          key={m.id}
                          onClick={() => alternarSelecaoMinistroReg(m.id)}
                          className={`p-2.5 rounded-xl flex items-center justify-between text-xs font-mono transition-colors cursor-pointer ${
                            selecionado ? 'bg-indigo-950/40 text-white' : 'hover:bg-slate-900/60 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selecionado}
                              onChange={() => {}}
                              className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                            />
                            <div>
                              <span className="font-bold text-white block">{m.nome}</span>
                              <span className="text-[10px] text-slate-400">
                                {m.cargo} • CPF: {m.cpf} • {m.rotulo}
                              </span>
                            </div>
                          </div>
                          <span className="font-bold text-amber-400 font-mono text-sm">
                            R$ {m.valor.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* CONTEÚDO DA ABA 1: PAGAMENTO */}
              {abaRegularizacao === 'PAGAMENTO' && (
                <div className="space-y-4 pt-2 border-t border-slate-800">
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-white font-mono block">
                      Forma de Pagamento (PIX ou Cartão de Crédito até 6x):
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setMetodoPagamentoReg('PIX')}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer space-y-1 ${
                          metodoPagamentoReg === 'PIX'
                            ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <QrCode className="w-5 h-5 text-emerald-400" />
                          <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                            INSTANTÂNEO
                          </span>
                        </div>
                        <span className="text-xs font-bold block text-white font-sans">PIX Oficial CIMADEBE</span>
                        <span className="text-[10px] text-slate-400 block font-mono">Quitação contábil imediata</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMetodoPagamentoReg('CARTAO')}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer space-y-1 ${
                          metodoPagamentoReg === 'CARTAO'
                            ? 'bg-cyan-950/60 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <CreditCard className="w-5 h-5 text-cyan-400" />
                          <span className="text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded">
                            ATÉ 6X
                          </span>
                        </div>
                        <span className="text-xs font-bold block text-white font-sans">Cartão de Crédito</span>
                        <span className="text-[10px] text-slate-400 block font-mono">Parcelamento de 1x a 6x</span>
                      </button>
                    </div>
                  </div>

                  {/* PIX Copia e Cola */}
                  {metodoPagamentoReg === 'PIX' && (
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-2 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-400 font-bold">Chave PIX Oficial (Copia e Cola):</span>
                        <span className="text-slate-400 text-[10px]">Banco Santander / SIGM</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 break-all select-all">
                        00020126580014br.gov.bcb.pix0136tesouraria@cimadebe.org.br520400005303986540{totalSelecionado.toFixed(2)}5802BR5925CIMADEBE ESTADUAL SALVADOR6009SALVADOR62070503***6304
                      </div>
                      <button
                        type="button"
                        onClick={() => copiarChavePixReg(totalSelecionado)}
                        className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-400 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {chavePixCopiadaReg ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>Chave PIX Copiada com Sucesso!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copiar Chave PIX</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Parcelamento Cartão em até 6x */}
                  {metodoPagamentoReg === 'CARTAO' && (
                    <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/30 space-y-3 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-cyan-400 font-bold">Plano de Parcelamento no Cartão:</span>
                        <span className="text-slate-400 text-[10px]">Em até 6x sem encargos</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[1, 2, 3, 4, 5, 6].map((p) => {
                          const valorParcela = totalSelecionado / p;
                          const selecionado = parcelasCartaoReg === p;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setParcelasCartaoReg(p)}
                              className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                                selecionado
                                  ? 'bg-cyan-950/80 border-cyan-400 text-white font-bold shadow-md shadow-cyan-950'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                              }`}
                            >
                              <span className="block text-xs font-bold">{p}x {p === 1 ? 'à vista' : ''}</span>
                              <span className={`block text-[11px] ${selecionado ? 'text-cyan-300 font-bold' : 'text-slate-400'}`}>
                                R$ {valorParcela.toFixed(2)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Total e Ação de Pagamento */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block font-mono">
                        TOTAL A LIQUIDAR ({ministrosSelecionadosReg.length} ministros):
                      </span>
                      <span className="text-2xl font-black text-emerald-400 font-mono">
                        R$ {totalSelecionado.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setModalRegularizacaoAberto(false)}
                        className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                      >
                        Cancelar
                      </button>

                      <button
                        type="button"
                        onClick={lidarComExecutarPagamentoReg}
                        disabled={processandoAcaoReg || totalSelecionado <= 0}
                        className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                      >
                        {processandoAcaoReg ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Liquidando no Ledger...</span>
                          </>
                        ) : (
                          <>
                            <BadgeCheck className="w-4 h-4" />
                            <span>Confirmar Pagamento Único (R$ {totalSelecionado.toFixed(2)})</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* CONTEÚDO DA ABA 2: ANISTIA */}
              {abaRegularizacao === 'ANISTIA' && (
                <div className="space-y-4 pt-2 border-t border-slate-800">
                  <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-400 font-bold">
                      <Shield className="w-4 h-4" />
                      <span>Termo de Concessão de Anistia Estatutária</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      A concessão de Anistia perdoa os débitos em aberto dos ministros selecionados, alterando seus status para <strong>ANISTIADO / EM DIA</strong> e emitindo um evento contábil irrevogável no Ledger da Convenção sob chancela da Presidência Geral.
                    </p>
                  </div>

                  <div className="space-y-3 font-mono text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase font-bold block">
                        JUSTIFICATIVA DA ANISTIA (OBRIGATÓRIO):
                      </label>
                      <textarea
                        required
                        rows={2}
                        value={justificativaAnistia}
                        onChange={(e) => setJustificativaAnistia(e.target.value)}
                        placeholder="Informe a deliberação da Mesa Diretora, resolução de AGO ou despacho presidencial..."
                        className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/60 resize-none text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase font-bold block">
                        PRESIDENTE / VALIDADOR AUTORIZADOR:
                      </label>
                      <input
                        type="text"
                        required
                        value={presidenteValidador}
                        onChange={(e) => setPresidenteValidador(e.target.value)}
                        placeholder="Nome do Presidente Geral ou Secretário Executivo"
                        className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                      />
                    </div>
                  </div>

                  {/* Ação de Anistia */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block font-mono">
                        TOTAL DE DÉBITOS ANISTIADOS:
                      </span>
                      <span className="text-2xl font-black text-amber-400 font-mono">
                        R$ {totalSelecionado.toFixed(2)} ({ministrosSelecionadosReg.length} ministros)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setModalRegularizacaoAberto(false)}
                        className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                      >
                        Cancelar
                      </button>

                      <button
                        type="button"
                        onClick={lidarComExecutarAnistiaReg}
                        disabled={processandoAcaoReg || ministrosSelecionadosReg.length === 0 || !justificativaAnistia.trim()}
                        className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition-all shadow-xl shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                      >
                        {processandoAcaoReg ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Homologando Anistia...</span>
                          </>
                        ) : (
                          <>
                            <Gift className="w-4 h-4" />
                            <span>Homologar Anistia Contábil</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
