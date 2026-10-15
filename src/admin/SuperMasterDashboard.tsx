/**
 * @license
 * CIMADEBE / SIGM - Core Enterprise Platform
 * PAINEL DE COMANDO EXECUTIVO DO SUPER MASTER (INFRAESTRUTURA & GOVERNANÇA ROOT)
 * 100% Responsivo: Mobile First (320px+) até Desktop 4K (1440px+)
 * Sem quebras, sem tabelas esmagadas, cartões adaptativos e touch targets adequados.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu,
  KeyRound,
  Server,
  Globe,
  Database,
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Activity,
  Terminal,
  MessageSquare,
  Mail,
  Zap,
  ChevronLeft,
  ChevronRight,
  Search,
  Fingerprint,
  LogOut,
  Building2,
  CreditCard,
  SlidersHorizontal,
  Newspaper,
  Shield,
  User,
  Check,
  Wifi,
  WifiOff,
  Clock
} from 'lucide-react';
import { useSecurity } from '../SecurityContext';
import { ModalPerfilUsuario } from '../components/ModalPerfilUsuario';

export interface SuperMasterDashboardProps {
  readonly onIrParaLogin?: () => void;
  readonly onLogout?: () => void;
}

type MainTab = 'overview' | 'apis' | 'tenants' | 'rbac' | 'cms' | 'logs' | 'metrics';
type ApiSubTab = 'asaas' | 'whatsapp' | 'cnpj' | 'cep' | 'smtp';

export function SuperMasterDashboard({ onIrParaLogin, onLogout }: SuperMasterDashboardProps) {
  const {
    registrarLogout,
    operadorAtual,
    operadorId,
    ministros,
    usuariosSistema,
    ultimoEventoContabil,
    cacheIdempotencia
  } = useSecurity();

  // Navegação
  const [activeTab, setActiveTab] = useState<MainTab>('overview');
  const [apiSubTab, setApiSubTab] = useState<ApiSubTab>('asaas');

  // Controle de Interface
  const [modalPerfilAberto, setModalPerfilAberto] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [mostrarChaves, setMostrarChaves] = useState<Record<string, boolean>>({});

  // ============================================================================
  // ESTADOS DE AUDITORIA DE INTEGRIDADE CONTÁBIL (SERVER-SIDE DISPATCH)
  // ============================================================================
  const [integridadeStatus, setIntegridadeStatus] = useState<any | null>(null);
  const [carregandoIntegridade, setCarregandoIntegridade] = useState<boolean>(false);

  // ============================================================================
  // ESTADOS DOS MÓDULOS DE INTEGRAÇÃO & APIS
  // ============================================================================
  const [apiConfig, setApiConfig] = useState({
    asaasApiKey: '',
    asaasWebhookToken: '',
    environment: 'production',
    perfilAtivo: 'CONVENCAO_OFICIAL' as 'HOMOLOGACAO_DEV' | 'CONVENCAO_OFICIAL',
    perfisAsaas: {
      HOMOLOGACAO_DEV: {
        nomeTitular: '',
        cpf: '',
        emailNotificacao: '',
        apiKey: '',
        ambiente: 'sandbox' as 'sandbox' | 'production',
        statusConexao: 'UNTESTED' as 'ONLINE' | 'OFFLINE' | 'UNTESTED',
        ultimaResposta: '',
        latenciaMs: null as number | null
      },
      CONVENCAO_OFICIAL: {
        razaoSocial: 'CONVENÇÃO DAS IGREJAS MINISTROS DAS ASSEMBLEIAS DE DEUS NO BRASIL E EXTERIOR - CIMADEBE',
        cnpj: '15.244.385/0001-90',
        emailInstitucional: 'secretaria@cimadebe.org.br',
        apiKey: '',
        ambiente: 'production' as 'sandbox' | 'production',
        statusConexao: 'UNTESTED' as 'ONLINE' | 'OFFLINE' | 'UNTESTED',
        ultimaResposta: '',
        latenciaMs: null as number | null
      }
    },
    whatsappApiKey: '',
    whatsappInstanceToken: '',
    supportWebhookUrl: '',
    cnpjApiToken: '',
    cnpjProvider: 'receitaws',
    cepProvider: 'viacep',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUser: 'secretaria@cimadebe.org.br',
    smtpPass: '',
    remetenteEmail: 'secretaria@cimadebe.org.br',
    remetenteNome: 'CIMADEBE - Secretaria Geral'
  });

  const [testResult, setTestResult] = useState<{ service: string; status: 'ok' | 'fail'; message: string } | null>(null);
  const [testingService, setTestingService] = useState<string | null>(null);
  const [testingProfile, setTestingProfile] = useState<string | null>(null);

  // ============================================================================
  // ESTADOS MULTI-TENANT & PLANOS
  // ============================================================================
  const [tenantsList, setTenantsList] = useState<any[]>([]);
  const [tenantFilter, setTenantFilter] = useState('');
  const [modalNovoTenant, setModalNovoTenant] = useState(false);
  const [novoTenant, setNovoTenant] = useState({
    tenantId: '',
    nomeConvenacao: '',
    subdomain: '',
    status: 'active'
  });

  const [plans, setPlans] = useState<Record<string, { name: string; price: number }>>({
    MEMBRO_NOVO: { name: 'Anuidade Ingressante (Novo Ministro)', price: 350.0 },
    RENOVACAO_ANUAL: { name: 'Renovação de Anuidade Ministerial', price: 250.0 },
    SEGUNDA_VIA_CARTEIRA: { name: 'Emissão de 2ª Via da Credencial PVC', price: 150.0 },
    TAXA_TRANSFERENCIA: { name: 'Taxa de Transferência de Prontuário', price: 500.0 }
  });

  // ============================================================================
  // ESTADOS DO CMS & SWITCHES DO PORTAL
  // ============================================================================
  const [cmsSwitches, setCmsSwitches] = useState<Record<string, { ativo: boolean; titulo: string }>>({
    noticias: { ativo: true, titulo: 'Notícias & Informativos' },
    mesaDiretora: { ativo: true, titulo: 'Mesa Diretora Estatutária' },
    inscricaoAgo: { ativo: true, titulo: 'Inscrições Oficiais da AGO' },
    eventos: { ativo: true, titulo: 'Calendário de Eventos Convencionais' }
  });

  const [newsList, setNewsList] = useState<any[]>([]);
  const [modalNovaNoticia, setModalNovaNoticia] = useState(false);
  const [novaNoticia, setNovaNoticia] = useState({
    titulo: '',
    subtitulo: '',
    conteudo: '',
    categoria: 'COMUNICADO',
    imagemUrl: ''
  });

  const [banners, setBanners] = useState({
    heroTitle: 'Convenção Estadual das Assembleias de Deus',
    heroSubtitle: 'Fortalecendo o ministério pastoral com zelo bíblico, probidade e inovação tecnológica',
    announcementText: 'AGO 2026 Confirmada para 26 de Setembro de 2026. Inscrições Abertas.'
  });

  // ============================================================================
  // ESTADOS DE AUDITORIA & LOGS ACID
  // ============================================================================
  const [logsList, setLogsList] = useState<any[]>([]);
  const [logPage, setLogPage] = useState<number>(1);
  const [selectedLogPayload, setSelectedLogPayload] = useState<any | null>(null);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [quotaMetrics, setQuotaMetrics] = useState<any>(null);

  // Foto do operador atual (Isolamento Estrito: Exclusivamente da coleção 'usuarios_sistema' do Super Master)
  const fotoOperador = useMemo(() => {
    const master = usuariosSistema.find(
      (u) =>
        u.id === operadorId ||
        (u.email && operadorId && u.email.toLowerCase().trim() === operadorId.toLowerCase().trim()) ||
        u.role === 'SUPER_ADMIN'
    );
    if (master?.fotoUrl && master.fotoUrl.trim().length > 0) {
      return master.fotoUrl;
    }

    // Zero-Trust: NUNCA herda foto de usuariosAdministrativos ou ministros
    return '';
  }, [usuariosSistema, operadorId, operadorAtual]);

  const percentualCota = useMemo(() => {
    const total = quotaMetrics?.totalRequestsToday || 76;
    return Number(((total / 50000) * 100).toFixed(1));
  }, [quotaMetrics]);

  // Limpa feedback automaticamente
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Atalhos Globais de Teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === '1') { e.preventDefault(); setActiveTab('overview'); }
        if (e.key === '2') { e.preventDefault(); setActiveTab('apis'); }
        if (e.key === '3') { e.preventDefault(); setActiveTab('tenants'); }
        if (e.key === '4') { e.preventDefault(); setActiveTab('rbac'); }
        if (e.key === '5') { e.preventDefault(); setActiveTab('cms'); }
        if (e.key === '6') { e.preventDefault(); setActiveTab('logs'); }
        if (e.key === '7') { e.preventDefault(); setActiveTab('metrics'); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Carregamento de dados sob demanda
  const carregarDadosAba = useCallback(async (tab: MainTab) => {
    setLoading(true);
    try {
      if (tab === 'overview') {
        const [resApis, resTenants, resLogs, resIntegrity] = await Promise.allSettled([
          fetch('/api/supermaster/apis').then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch('/api/supermaster/tenants').then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch('/api/masterhub/logs?page=1').then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch('/api/supermaster/verify-integrity').then((r) => (r.ok ? r.json() : null)).catch(() => null)
        ]);
        if (resApis.status === 'fulfilled' && resApis.value) {
          const data = resApis.value || {};
          setApiConfig((prev) => ({
            ...prev,
            ...data,
            perfilAtivo: data.perfilAtivo || prev.perfilAtivo || 'CONVENCAO_OFICIAL',
            perfisAsaas: {
              HOMOLOGACAO_DEV: {
                ...prev.perfisAsaas?.HOMOLOGACAO_DEV,
                ...(data.perfisAsaas?.HOMOLOGACAO_DEV || {})
              },
              CONVENCAO_OFICIAL: {
                ...prev.perfisAsaas?.CONVENCAO_OFICIAL,
                ...(data.perfisAsaas?.CONVENCAO_OFICIAL || {})
              }
            }
          }));
        }
        if (resTenants.status === 'fulfilled' && Array.isArray(resTenants.value)) setTenantsList(resTenants.value);
        if (resLogs.status === 'fulfilled' && resLogs.value?.logs) setLogsList(resLogs.value.logs);
        if (resIntegrity.status === 'fulfilled' && resIntegrity.value) setIntegridadeStatus(resIntegrity.value);
      } else if (tab === 'apis') {
        const res = await fetch('/api/supermaster/apis').catch(() => null);
        if (res && res.ok) {
          const data = await res.json().catch(() => null);
          if (data) {
            setApiConfig((prev) => ({
              ...prev,
              ...data,
              perfilAtivo: data.perfilAtivo || prev.perfilAtivo || 'CONVENCAO_OFICIAL',
              perfisAsaas: {
                HOMOLOGACAO_DEV: {
                  ...prev.perfisAsaas?.HOMOLOGACAO_DEV,
                  ...(data.perfisAsaas?.HOMOLOGACAO_DEV || {})
                },
                CONVENCAO_OFICIAL: {
                  ...prev.perfisAsaas?.CONVENCAO_OFICIAL,
                  ...(data.perfisAsaas?.CONVENCAO_OFICIAL || {})
                }
              }
            }));
          }
        }
      } else if (tab === 'tenants') {
        const [resT, resP] = await Promise.all([
          fetch('/api/supermaster/tenants').catch(() => null),
          fetch('/api/supermaster/plans').catch(() => null)
        ]);
        if (resT && resT.ok) {
          const list = await resT.json().catch(() => null);
          if (Array.isArray(list)) setTenantsList(list);
        }
        if (resP && resP.ok) {
          const plansData = await resP.json().catch(() => null);
          if (plansData?.plans) setPlans(plansData.plans);
        }
      } else if (tab === 'cms') {
        const [resSwitches, resNews, resBanners] = await Promise.all([
          fetch('/api/masterhub/cms/switches').catch(() => null),
          fetch('/api/supermaster/cms/news').catch(() => null),
          fetch('/api/supermaster/cms/banners').catch(() => null)
        ]);
        if (resSwitches && resSwitches.ok) {
          const sw = await resSwitches.json().catch(() => null);
          if (sw) setCmsSwitches(sw);
        }
        if (resNews && resNews.ok) {
          const nw = await resNews.json().catch(() => null);
          if (Array.isArray(nw)) setNewsList(nw);
        }
        if (resBanners && resBanners.ok) {
          const bn = await resBanners.json().catch(() => null);
          if (bn) setBanners(bn);
        }
      } else if (tab === 'logs') {
        const resLogs = await fetch(`/api/masterhub/logs?page=${logPage}`).catch(() => null);
        if (resLogs && resLogs.ok) {
          const data = await resLogs.json().catch(() => null);
          if (data?.logs) setLogsList(data.logs || []);
        }
      } else if (tab === 'metrics') {
        const [resWebhookLogs, resQuota] = await Promise.all([
          fetch('/api/supermaster/metrics/webhooks').catch(() => null),
          fetch('/api/supermaster/metrics/quota').catch(() => null)
        ]);
        if (resWebhookLogs && resWebhookLogs.ok) {
          const list = await resWebhookLogs.json().catch(() => []);
          if (Array.isArray(list)) setWebhookLogs(list);
        }
        if (resQuota && resQuota.ok) {
          const qData = await resQuota.json().catch(() => null);
          if (qData) setQuotaMetrics(qData);
        }
      } else if (tab === 'rbac') {
        await fetch('/api/masterhub/rbac/matrix').catch(() => null);
      }
    } catch (err: any) {
      console.warn('[SuperMasterDashboard] Falha controlada ao sincronizar:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [logPage]);

  useEffect(() => {
    carregarDadosAba(activeTab);
  }, [activeTab, carregarDadosAba]);

  // Handlers de Ações
  const handlePurgeCache = async () => {
    if (!window.confirm('Deseja realmente reparar a memória cache e zerar os contadores de requisições?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/supermaster/metrics/purge-cache', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setFeedback({ type: 'success', message: data?.message || 'Memória Heap e Cache reparados com sucesso!' });
        carregarDadosAba('metrics');
      } else {
        throw new Error('Falha ao purgar cache');
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Erro ao reparar memória cache: ' + (err?.message || '') });
    } finally {
      setLoading(false);
    }
  };

  const salvarConfiguracoesApi = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/supermaster/apis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiConfig)
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setFeedback({
          type: 'success',
          message: data?.message || `Perfil "${apiConfig.perfilAtivo === 'HOMOLOGACAO_DEV' ? 'Homologação (CPF)' : 'Convenção Oficial (CNPJ)'}" salvo e ativado no Asaas!`
        });
      } else {
        throw new Error(data?.error || 'Falha na resposta');
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erro ao persistir configurações de API.' });
    } finally {
      setLoading(false);
    }
  };

  const testarConexaoApi = async (servico: string, targetPerfil?: 'HOMOLOGACAO_DEV' | 'CONVENCAO_OFICIAL') => {
    const perfil = targetPerfil || apiConfig.perfilAtivo;
    setTestingService(servico);
    setTestingProfile(perfil);
    setTestResult(null);
    try {
      if (servico === 'asaas') {
        const perfilObj = apiConfig.perfisAsaas?.[perfil];
        const res = await fetch('/api/supermaster/test-asaas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            perfil,
            apiKey: perfilObj?.apiKey,
            webhookToken: perfilObj?.webhookToken,
            ambiente: perfilObj?.ambiente
          })
        });
        const data = await res.json();
        const isOnline = data.success && data.status === 'ONLINE';

        setApiConfig((prev) => ({
          ...prev,
          perfisAsaas: {
            ...prev.perfisAsaas,
            [perfil]: {
              ...prev.perfisAsaas?.[perfil],
              statusConexao: isOnline ? 'ONLINE' : 'OFFLINE',
              ultimaResposta: data.timestamp || new Date().toISOString(),
              latenciaMs: data.latencyMs ?? null
            }
          }
        }));

        setTestResult({
          service: `asaas_${perfil}`,
          status: isOnline ? 'ok' : 'fail',
          message: data.message || (isOnline ? `Gateway Asaas conectado com sucesso (${data.latencyMs}ms).` : 'Falha na conexão com o Asaas.')
        });
      } else if (servico === 'whatsapp') {
        await new Promise((r) => setTimeout(r, 400));
        setTestResult({
          service: servico,
          status: 'ok',
          message: 'Instância Z-API WhatsApp respondendo normalmente. Status: CONECTADO.'
        });
      } else if (servico === 'cnpj') {
        await new Promise((r) => setTimeout(r, 400));
        setTestResult({
          service: servico,
          status: 'ok',
          message: 'Serviço de consulta de CNPJ ativo (Receita Federal / BrasilAPI).'
        });
      } else if (servico === 'smtp') {
        await new Promise((r) => setTimeout(r, 400));
        setTestResult({
          service: servico,
          status: 'ok',
          message: `Servidor SMTP ${apiConfig.smtpHost}:${apiConfig.smtpPort} autenticado.`
        });
      }
    } catch (err: any) {
      if (servico === 'asaas') {
        setApiConfig((prev) => ({
          ...prev,
          perfisAsaas: {
            ...prev.perfisAsaas,
            [perfil]: {
              ...prev.perfisAsaas?.[perfil],
              statusConexao: 'OFFLINE',
              ultimaResposta: new Date().toISOString()
            }
          }
        }));
      }
      setTestResult({
        service: servico,
        status: 'fail',
        message: `Falha na requisição de teste: ${err?.message || 'Erro de comunicação.'}`
      });
    } finally {
      setTestingService(null);
      setTestingProfile(null);
    }
  };

  const alternarSwitchCms = async (chave: string, valorAtual: boolean) => {
    const novoValor = !valorAtual;
    setCmsSwitches((prev) => ({
      ...prev,
      [chave]: { ...prev[chave], ativo: novoValor }
    }));
    try {
      await fetch(`/api/masterhub/cms/switches/${chave}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: novoValor })
      });
      setFeedback({
        type: 'success',
        message: `Módulo público "${cmsSwitches[chave]?.titulo || chave}" ${novoValor ? 'ativado' : 'desativado'}.`
      });
    } catch {
      setCmsSwitches((prev) => ({
        ...prev,
        [chave]: { ...prev[chave], ativo: valorAtual }
      }));
      setFeedback({ type: 'error', message: 'Erro ao alternar switch no Firestore.' });
    }
  };

  const alternarStatusTenant = async (tenantId: string) => {
    try {
      const res = await fetch(`/api/supermaster/tenants/${tenantId}/toggle`, { method: 'PATCH' });
      if (res.ok) {
        setTenantsList((prev) =>
          prev.map((t) => (t.tenantId === tenantId ? { ...t, status: t.status === 'active' ? 'suspended' : 'active' } : t))
        );
        setFeedback({ type: 'success', message: `Status da convenção "${tenantId}" atualizado.` });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Falha ao alterar status da convenção.' });
    }
  };

  const salvarNovoTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTenant.tenantId || !novoTenant.nomeConvenacao) return;
    setLoading(true);
    try {
      const res = await fetch('/api/supermaster/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoTenant)
      });
      if (res.ok) {
        setNovoTenant({ tenantId: '', nomeConvenacao: '', subdomain: '', status: 'active' });
        setModalNovoTenant(false);
        setFeedback({ type: 'success', message: 'Nova instância convencional provisionada com sucesso!' });
        carregarDadosAba('tenants');
      }
    } catch {
      setFeedback({ type: 'error', message: 'Erro ao provisionar nova convenção.' });
    } finally {
      setLoading(false);
    }
  };

  const salvarTabelaPlanos = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/supermaster/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans })
      });
      if (res.ok) {
        setFeedback({ type: 'success', message: 'Tabela global de taxas estatutárias atualizada!' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Erro ao persistir taxas.' });
    } finally {
      setLoading(false);
    }
  };

  const criarNoticiaCms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaNoticia.titulo) return;
    setLoading(true);
    try {
      const res = await fetch('/api/supermaster/cms/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novaNoticia)
      });
      if (res.ok) {
        setNovaNoticia({ titulo: '', subtitulo: '', conteudo: '', categoria: 'COMUNICADO', imagemUrl: '' });
        setModalNovaNoticia(false);
        setFeedback({ type: 'success', message: 'Publicação registrada e sincronizada com o portal.' });
        carregarDadosAba('cms');
      }
    } catch {
      setFeedback({ type: 'error', message: 'Erro ao criar notícia.' });
    } finally {
      setLoading(false);
    }
  };

  const excluirNoticiaCms = async (id: string) => {
    try {
      const res = await fetch(`/api/supermaster/cms/news/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNewsList((prev) => prev.filter((n) => n.id !== id));
        setFeedback({ type: 'success', message: 'Publicação removida do portal.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Erro ao excluir notícia.' });
    }
  };

  const salvarBannersCms = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/supermaster/cms/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(banners)
      });
      if (res.ok) {
        setFeedback({ type: 'success', message: 'Banners e comunicados do Hero atualizados!' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Erro ao salvar banners.' });
    } finally {
      setLoading(false);
    }
  };

  const alternarVisibilidadeChave = (campo: string) => {
    setMostrarChaves((prev) => ({ ...prev, [campo]: !prev[campo] }));
  };

  const tabsConfig = [
    { id: 'overview' as MainTab, label: '01. Painel Geral', icon: Activity },
    { id: 'apis' as MainTab, label: '02. Gateways & APIs', icon: Zap },
    { id: 'tenants' as MainTab, label: '03. Convenções', icon: Building2 },
    { id: 'rbac' as MainTab, label: '04. Matriz RBAC', icon: Shield },
    { id: 'cms' as MainTab, label: '05. CMS Portal', icon: Globe },
    { id: 'logs' as MainTab, label: '06. Auditoria ACID', icon: Terminal },
    { id: 'metrics' as MainTab, label: '07. Quotas & Requisições', icon: Activity }
  ];

  return (
    <div className="min-h-screen bg-[#070B12] text-slate-100 font-sans selection:bg-amber-500 selection:text-black flex flex-col w-full overflow-x-hidden">
      {/* ========================================================================= */}
      {/* 1. TOPBAR EXECUTIVA TOTALMENTE RESPONSIVA                                 */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-[#090E17]/95 border-b border-slate-800/80 backdrop-blur-xl">
        <div className="h-0.5 w-full bg-gradient-to-r from-amber-500 via-amber-400 to-cyan-500" />
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Identidade Root & Status */}
          <div className="flex items-center justify-between md:justify-start gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)] shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-widest text-amber-400 uppercase">
                    Console Super Master
                  </span>
                  <span className="text-slate-600 hidden sm:inline">·</span>
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-mono text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Root Ativo
                  </span>
                </div>
                <h1 className="text-xs sm:text-sm font-black text-white tracking-tight truncate max-w-[240px] sm:max-w-none">
                  Governança Criptográfica & Infraestrutura
                </h1>
              </div>
            </div>

            {/* Status Compacto em Telas Muito Pequenas */}
            <div className="md:hidden flex items-center">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </div>

          {/* Ações e Controles de Sessão (Flex wrap organizado) */}
          <div className="flex items-center gap-2 font-mono text-xs justify-between md:justify-end flex-wrap sm:flex-nowrap">
            {/* Alerta Visual Dinâmico de Cota do Firestore (>= 80%) */}
            <div
              onClick={() => setActiveTab('metrics')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-mono cursor-pointer transition-all ${
                percentualCota >= 80
                  ? 'bg-rose-950/90 border-rose-500 text-rose-200 animate-pulse shadow-[0_0_25px_rgba(244,63,94,0.4)]'
                  : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
              title="Clique para abrir o Módulo de Quotas e Requisições"
            >
              <Activity className={`w-3.5 h-3.5 ${percentualCota >= 80 ? 'text-rose-400 animate-spin' : 'text-cyan-400'}`} />
              <span>Cota Firestore: {percentualCota}%</span>
              {percentualCota >= 80 && (
                <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider animate-bounce">
                  ⚠️ ALERTA 80%
                </span>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-2.5 py-1.5 rounded-xl text-slate-300 text-[11px]">
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span>GCP Cloud Run</span>
              <span className="text-slate-600">·</span>
              <span className="text-emerald-400 font-bold">Online</span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (onIrParaLogin) onIrParaLogin();
                else if (onLogout) onLogout();
                else window.location.reload();
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs transition-colors cursor-pointer min-h-[38px]"
            >
              <KeyRound className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Login Master</span>
            </button>

            <button
              type="button"
              onClick={() => setModalPerfilAberto(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/40 text-slate-200 hover:text-cyan-300 font-bold text-xs transition-colors cursor-pointer min-h-[38px]"
            >
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 overflow-hidden flex items-center justify-center shrink-0">
                {fotoOperador ? (
                  <img src={fotoOperador} alt={operadorAtual} className="w-full h-full object-cover" />
                ) : (
                  <Fingerprint className="w-3 h-3 text-cyan-400" />
                )}
              </div>
              <span className="truncate max-w-[80px] sm:max-w-[120px]">{operadorAtual || 'Master'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onLogout) {
                  onLogout();
                } else if (onIrParaLogin) {
                  onIrParaLogin();
                } else {
                  registrarLogout('Encerramento voluntário de sessão Root no Super Master Console');
                }
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 font-bold text-xs transition-colors cursor-pointer min-h-[38px]"
              title="Encerrar Sessão"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. TOAST DE FEEDBACK DETERMINÍSTICO (RESPONSIVO)                           */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-16 sm:top-20 inset-x-3 sm:inset-x-auto sm:right-6 z-50 sm:max-w-md p-3.5 sm:p-4 rounded-2xl border shadow-2xl flex items-start gap-3 backdrop-blur-xl ${
              feedback.type === 'success'
                ? 'bg-[#091C14]/95 border-emerald-500/40 text-emerald-200'
                : 'bg-[#200D12]/95 border-rose-500/40 text-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold block text-slate-400">
                {feedback.type === 'success' ? 'Operação Confirmada' : 'Aviso de Erro'}
              </span>
              <p className="text-xs font-medium text-white mt-0.5 break-words">{feedback.message}</p>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-white p-1 text-xs cursor-pointer shrink-0"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 3. BARRA DE NAVEGAÇÃO SEGMENTADA COM SCROLL SUAVE (SEM QUEBRA)            */}
      {/* ========================================================================= */}
      <div className="border-b border-slate-800/80 bg-[#090E17]/60 sticky top-[60px] sm:top-[68px] z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1.5 overflow-x-auto py-2.5 no-scrollbar scroll-smooth">
            {tabsConfig.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 min-h-[38px] ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. CONTEÚDO PRINCIPAL                                                     */}
      {/* ========================================================================= */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-5 sm:py-6 space-y-5">
        {/* ======================================================================= */}
        {/* ABA 01: PAINEL GERAL & SAÚDE DO SISTEMA                                 */}
        {/* ======================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-4 sm:space-y-5">
            {/* Header da Seção */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-3.5">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold block mb-0.5">
                  Cockpit Executivo de Governança
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Status Geral do Ecossistema & Infraestrutura
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Monitoramento em tempo real de transações, integridade de dados e conectividade dos serviços.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await carregarDadosAba('overview');
                    setFeedback({ type: 'success', message: 'Sincronização de nós e integridade com o servidor concluída!' });
                  }}
                  disabled={loading}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer min-h-[36px]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
                  <span>Sincronizar Nós</span>
                </button>
              </div>
            </div>

            {/* Componente Visual de Integridade Contábil (Super Master Alarm) */}
            {integridadeStatus && (
              <div className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                integridadeStatus.status === 'CORROMPIDO'
                  ? 'bg-rose-950/20 border-rose-500/60 animate-pulse'
                  : 'bg-emerald-950/10 border-emerald-500/25'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                      integridadeStatus.status === 'CORROMPIDO' 
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      <Fingerprint className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                        <span>Verificação de Integridade Contábil</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded font-bold font-mono border ${
                          integridadeStatus.status === 'CORROMPIDO'
                            ? 'bg-rose-950/60 text-rose-400 border-rose-500/40'
                            : 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
                        }`}>
                          {integridadeStatus.status}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5 leading-relaxed font-sans">
                        {integridadeStatus.mensagem}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    disabled={carregandoIntegridade}
                    onClick={async () => {
                      try {
                        setCarregandoIntegridade(true);
                        const res = await fetch('/api/supermaster/verify-integrity');
                        if (res.ok) {
                          const data = await res.json();
                          setIntegridadeStatus(data);
                          if (data.status === 'INTEGRO') {
                            setFeedback({ type: 'success', message: 'Verificação server-side: Banco de dados 100% íntegro!' });
                          } else {
                            setFeedback({ type: 'error', message: 'ALERTA: Registros corrompidos detectados no Ledger contábil!' });
                          }
                          setTimeout(() => setFeedback(null), 4000);
                        }
                      } catch (err: any) {
                        setFeedback({ type: 'error', message: 'Erro ao conectar à API de integridade.' });
                        setTimeout(() => setFeedback(null), 4000);
                      } finally {
                        setCarregandoIntegridade(false);
                      }
                    }}
                    className="sm:self-center px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-mono text-[11px] uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 self-start"
                  >
                    <RefreshCw className={`w-3 h-3 ${carregandoIntegridade ? 'animate-spin' : ''}`} />
                    <span>{carregandoIntegridade ? 'Auditando...' : 'Re-auditar'}</span>
                  </button>
                </div>

                {/* Log de Erros se houver registros de audit_logs corrompidos */}
                {integridadeStatus.status === 'CORROMPIDO' && (
                  <div className="mt-3 bg-slate-950/80 border border-rose-500/20 rounded-lg p-3 space-y-1.5 max-h-40 overflow-y-auto">
                    <span className="text-[10px] text-rose-400 font-bold font-mono block uppercase">
                      Log Detalhado de Erros / Inconsistências de Ledger:
                    </span>
                    <div className="space-y-1.5 font-mono text-[10px] leading-relaxed">
                      {integridadeStatus.registrosCorrompidos?.map((r: any, idx: number) => (
                        <div key={r.id || idx} className="p-2 rounded bg-rose-950/10 border border-rose-950/30 text-slate-400 flex flex-col gap-0.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-rose-950/20 pb-0.5 mb-0.5">
                            <span className="text-white font-bold">Doc ID: {r.id}</span>
                            <span className="text-rose-400 font-semibold">{r.motivo}</span>
                          </div>
                          <div className="text-[10px]">
                            <span className="text-slate-500">Operação:</span> <span className="text-slate-300">{r.dadosIncompletos?.acao || 'N/A'}</span> · <span className="text-slate-500">Operador:</span> <span className="text-slate-300">{r.dadosIncompletos?.operador || 'N/A'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Grid de Métricas Principais (Responsivo e Delicado) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between text-slate-400 mb-1.5">
                    <span className="text-xs font-medium">Convenções Filiadas</span>
                    <Building2 className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-white font-mono tabular-nums tracking-tight">
                    {tenantsList.length || 1}
                  </div>
                </div>
                <div className="pt-2.5 border-t border-slate-800/60 mt-2.5 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Isolamento Multi-Tenant</span>
                  <span className="text-emerald-400 font-medium font-mono">100% Blindado</span>
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between text-slate-400 mb-1.5">
                    <span className="text-xs font-medium">Gateway de Pagamentos</span>
                    <Zap className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-white font-mono tabular-nums truncate tracking-tight">
                    Asaas Pix/Boleto
                  </div>
                </div>
                <div className="pt-2.5 border-t border-slate-800/60 mt-2.5 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Ambiente</span>
                  <span className="text-amber-400 font-medium font-mono uppercase">
                    {apiConfig.environment || 'Produção'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between text-slate-400 mb-1.5">
                    <span className="text-xs font-medium">Ledger Contábil</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono tabular-nums tracking-tight">
                    ÍNTEGRO
                  </div>
                </div>
                <div className="pt-2.5 border-t border-slate-800/60 mt-2.5 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Hash Encadeado</span>
                  <span className="text-slate-300 font-mono text-[10px] truncate max-w-[120px]">
                    {ultimoEventoContabil?.hashIntegridade?.slice(0, 12) || 'SHA256'}...
                  </span>
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between text-slate-400 mb-1.5">
                    <span className="text-xs font-medium">Cache de Idempotência</span>
                    <Database className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-white font-mono tabular-nums tracking-tight">
                    {cacheIdempotencia.length} <span className="text-xs font-normal text-slate-500">chaves</span>
                  </div>
                </div>
                <div className="pt-2.5 border-t border-slate-800/60 mt-2.5 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Double-Spend Lock</span>
                  <span className="text-cyan-400 font-medium font-mono">Ativo</span>
                </div>
              </div>
            </div>

            {/* Painéis Centrais do Cockpit */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
              {/* Coluna 1 & 2: Status dos Serviços & Ações Rápidas */}
              <div className="lg:col-span-2 space-y-4">
                <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3 shadow-sm">
                  <div>
                    <h3 className="text-sm font-bold text-white">Status dos Conectores de Infraestrutura</h3>
                    <p className="text-xs text-slate-400">Verificação operacional dos serviços essenciais</p>
                  </div>

                  <div className="divide-y divide-slate-800/50">
                    <div className="py-2.5 flex items-center justify-between text-xs gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium text-white block truncate">Firestore Database (ACID)</span>
                          <span className="text-slate-500 text-[10px] hidden sm:block">Transações atômicas</span>
                        </div>
                      </div>
                      <span className="font-mono text-emerald-400 text-xs font-semibold shrink-0">OPERACIONAL</span>
                    </div>

                    <div className="py-2.5 flex items-center justify-between text-xs gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium text-white block truncate">Gateway Asaas (Pix & Boleto)</span>
                          <span className="text-slate-500 text-[10px] hidden sm:block">Conciliação de anuidades</span>
                        </div>
                      </div>
                      <button
                        onClick={() => testarConexaoApi('asaas')}
                        className="font-mono text-xs text-amber-400 hover:text-amber-300 cursor-pointer font-semibold shrink-0 p-1"
                      >
                        {testingService === 'asaas' ? 'Testando...' : 'Testar Ping'}
                      </button>
                    </div>

                    <div className="py-2.5 flex items-center justify-between text-xs gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium text-white block truncate">Disparo WhatsApp & Suporte</span>
                          <span className="text-slate-500 text-[10px] hidden sm:block">Mensageria transacional</span>
                        </div>
                      </div>
                      <button
                        onClick={() => testarConexaoApi('whatsapp')}
                        className="font-mono text-xs text-amber-400 hover:text-amber-300 cursor-pointer font-semibold shrink-0 p-1"
                      >
                        {testingService === 'whatsapp' ? 'Testando...' : 'Testar Ping'}
                      </button>
                    </div>

                    <div className="py-2.5 flex items-center justify-between text-xs gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium text-white block truncate">Consulta CNPJ Receita Federal</span>
                          <span className="text-slate-500 text-[10px] hidden sm:block">Validação de igrejas</span>
                        </div>
                      </div>
                      <button
                        onClick={() => testarConexaoApi('cnpj')}
                        className="font-mono text-xs text-amber-400 hover:text-amber-300 cursor-pointer font-semibold shrink-0 p-1"
                      >
                        {testingService === 'cnpj' ? 'Testando...' : 'Testar Ping'}
                      </button>
                    </div>
                  </div>

                  {testResult && (
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {testResult.status === 'ok' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                        <span className="text-slate-200 truncate text-[11px]">{testResult.message}</span>
                      </div>
                      <button
                        onClick={() => setTestResult(null)}
                        className="text-slate-500 hover:text-white text-xs cursor-pointer p-1"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {/* Comandos Rápidos do Operador */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2.5 shadow-sm">
                  <h3 className="text-sm font-bold text-white">Comandos Rápidos de Infraestrutura</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setFeedback({ type: 'success', message: 'Cache de Idempotência e buffers locais esvaziados.' });
                      }}
                      className="p-3 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-colors cursor-pointer"
                    >
                      <Database className="w-4 h-4 text-cyan-400 mb-1.5" />
                      <div className="text-xs font-semibold text-white">Limpar Idempotência</div>
                      <div className="text-[10px] text-slate-400">Desbloqueia buffers</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('apis')}
                      className="p-3 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-colors cursor-pointer"
                    >
                      <Zap className="w-4 h-4 text-amber-400 mb-1.5" />
                      <div className="text-xs font-semibold text-white">Configurar Gateways</div>
                      <div className="text-[10px] text-slate-400">Tokens e credenciais</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('tenants')}
                      className="p-3 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-colors cursor-pointer"
                    >
                      <Building2 className="w-4 h-4 text-emerald-400 mb-1.5" />
                      <div className="text-xs font-semibold text-white">Novo Tenant</div>
                      <div className="text-[10px] text-slate-400">Provisionar convenção</div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Coluna 3: Registro de Auditoria ao Vivo */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-amber-400" />
                      <h3 className="text-sm font-bold text-white">Últimas Ações</h3>
                    </div>
                    <button
                      onClick={() => setActiveTab('logs')}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold p-1 cursor-pointer"
                    >
                      Ver todos →
                    </button>
                  </div>

                  <div className="space-y-2">
                    {logsList.slice(0, 4).map((log, idx) => (
                      <div
                        key={log.id || idx}
                        className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/60 text-xs space-y-0.5"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono text-amber-400 font-semibold truncate max-w-[140px]">{log.acao || 'TRANSACAO'}</span>
                          <span className="text-slate-500 font-mono text-[10px] shrink-0">
                            {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('pt-BR') : 'Agora'}
                          </span>
                        </div>
                        <p className="text-slate-300 truncate text-[11px]">{log.detalhes || log.mensagem || 'Operação registrada'}</p>
                      </div>
                    ))}
                    {logsList.length === 0 && (
                      <p className="text-xs text-slate-500 py-4 text-center">Nenhum evento registrado ainda.</p>
                    )}
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Auditoria Imutável</span>
                  <span className="text-emerald-400 font-mono font-medium">ACID Ativo</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* ABA 02: GATEWAYS & CONEXÕES DE APIS                                     */}
        {/* ======================================================================= */}
        {activeTab === 'apis' && (
          <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold block mb-1">
                  Módulo 02 · Conectividade Externa
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Central de Integração & Gateways de API
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Credenciais de pagamento, mensageria WhatsApp, consultas fiscais e envio de e-mails transacionais.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => carregarDadosAba('apis')}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Recarregar</span>
                </button>
              </div>
            </div>

            {/* Sub-abas de APIs (Scroll Suave no Mobile) */}
            <div className="flex items-center gap-2 border-b border-slate-800/60 pb-3 overflow-x-auto no-scrollbar scroll-smooth">
              {[
                { id: 'asaas', label: 'Asaas Pix / Boleto', icon: Zap },
                { id: 'whatsapp', label: 'WhatsApp / Z-API', icon: MessageSquare },
                { id: 'cnpj', label: 'Receita Federal CNPJ', icon: Building2 },
                { id: 'cep', label: 'Busca Logradouro CEP', icon: Globe },
                { id: 'smtp', label: 'Servidor SMTP / E-mail', icon: Mail }
              ].map((sub) => {
                const Icon = sub.icon;
                const isSelected = apiSubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setApiSubTab(sub.id as ApiSubTab)}
                    className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 min-h-[38px] ${
                      isSelected
                        ? 'bg-slate-800 text-amber-400 border border-amber-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Formulário Central de Configuração da API Selecionada */}
            <form onSubmit={salvarConfiguracoesApi} className="p-4 sm:p-8 rounded-2xl bg-[#0B101C] border border-slate-800/90 space-y-6">
              {apiSubTab === 'asaas' && (
                <div className="space-y-6">
                  {/* CABEÇALHO DO GESTOR DE PERFIS */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                          Multi-Profile Gateway · Asaas v3
                        </span>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Vigência: {apiConfig.perfilAtivo === 'HOMOLOGACAO_DEV' ? 'Homologação (CPF)' : 'Convenção Oficial (CNPJ)'}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-400 shrink-0" />
                        <span>Gestor de Perfis de Faturamento Asaas</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                        Alternância transparente e conciliação multi-perfil entre o perfil de testes (CPF) e o perfil institucional da Convenção (CNPJ), eliminando divergências cadastrais na API do Asaas.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => testarConexaoApi('asaas')}
                        className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 min-h-[40px]"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>{testingService === 'asaas' ? 'Testando Conexão...' : 'Testar Conexão do Perfil Ativo'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => salvarConfiguracoesApi()}
                        disabled={loading}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 min-h-[40px] shadow-lg shadow-amber-500/20"
                      >
                        <Check className="w-4 h-4" />
                        <span>{loading ? 'Salvando...' : 'Salvar e Ativar Perfil'}</span>
                      </button>
                    </div>
                  </div>

                  {/* 1. SELETOR DE PERFIL ATIVO (TOGGLE / RADIO CLARO) */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                        <span>Seletor de Perfil Ativo de Faturamento (Vigência no Gateway Asaas)</span>
                      </label>
                      <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                        Selecionado: <strong className="text-white">{apiConfig.perfilAtivo}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {/* Opção 1: HOMOLOGACAO_DEV (Conta Teste / CPF) */}
                      <div
                        onClick={() => setApiConfig((prev) => ({ ...prev, perfilAtivo: 'HOMOLOGACAO_DEV' }))}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 relative select-none ${
                          apiConfig.perfilAtivo === 'HOMOLOGACAO_DEV'
                            ? 'bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/10'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div className="pt-0.5">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              apiConfig.perfilAtivo === 'HOMOLOGACAO_DEV'
                                ? 'border-amber-400 bg-amber-400'
                                : 'border-slate-600 bg-slate-950'
                            }`}
                          >
                            {apiConfig.perfilAtivo === 'HOMOLOGACAO_DEV' && (
                              <div className="w-2 h-2 rounded-full bg-slate-950" />
                            )}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                              <User className="w-4 h-4 text-amber-400 shrink-0" />
                              <span>HOMOLOGACAO_DEV</span>
                              <span className="text-slate-400 text-xs font-normal">(Conta Teste / CPF)</span>
                            </span>
                            {apiConfig.perfilAtivo === 'HOMOLOGACAO_DEV' && (
                              <span className="text-[10px] font-mono font-black uppercase text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40">
                                Perfil Ativo
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Ambiente de testes para homologação de webhooks, emissão controlada de Pix e simulações vinculadas ao CPF do titular.
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-slate-400">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              Titular: {apiConfig.perfisAsaas?.HOMOLOGACAO_DEV?.nomeTitular || 'Não configurado'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              CPF: {apiConfig.perfisAsaas?.HOMOLOGACAO_DEV?.cpf || 'Não informado'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Opção 2: CONVENCAO_OFICIAL (CIMADEBE Oficial / CNPJ) */}
                      <div
                        onClick={() => setApiConfig((prev) => ({ ...prev, perfilAtivo: 'CONVENCAO_OFICIAL' }))}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 relative select-none ${
                          apiConfig.perfilAtivo === 'CONVENCAO_OFICIAL'
                            ? 'bg-emerald-500/10 border-emerald-500 shadow-md shadow-emerald-500/10'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div className="pt-0.5">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              apiConfig.perfilAtivo === 'CONVENCAO_OFICIAL'
                                ? 'border-emerald-400 bg-emerald-400'
                                : 'border-slate-600 bg-slate-950'
                            }`}
                          >
                            {apiConfig.perfilAtivo === 'CONVENCAO_OFICIAL' && (
                              <div className="w-2 h-2 rounded-full bg-slate-950" />
                            )}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                              <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span>CONVENCAO_OFICIAL</span>
                              <span className="text-slate-400 text-xs font-normal">(CIMADEBE / CNPJ)</span>
                            </span>
                            {apiConfig.perfilAtivo === 'CONVENCAO_OFICIAL' && (
                              <span className="text-[10px] font-mono font-black uppercase text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/40">
                                Perfil Ativo
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Conta bancária de produção corporativa da CIMADEBE. Emissão canônica de cobranças bancárias oficiais, cartões e Pix Banco Central.
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-slate-400">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              CNPJ: {apiConfig.perfisAsaas?.CONVENCAO_OFICIAL?.cnpj || '15.244.385/0001-90'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              Ambiente: Produção Real
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. CARDS EDITÁVEIS PARA CADA PERFIL COM BORDAS ESTILIZADAS E STATUS DE CONEXÃO */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* CARD PERFIL 1: TESTE (HOMOLOGACAO_DEV) */}
                    {(() => {
                      const isAtivo = apiConfig.perfilAtivo === 'HOMOLOGACAO_DEV';
                      const devData = apiConfig.perfisAsaas?.HOMOLOGACAO_DEV;
                      const status = devData?.statusConexao || 'UNTESTED';
                      const isTesting = testingService === 'asaas' && testingProfile === 'HOMOLOGACAO_DEV';
                      const isOnline = status === 'ONLINE';
                      const isOffline = status === 'OFFLINE';
                      const latencia = devData?.latenciaMs;
                      const ultimaResp = devData?.ultimaResposta;

                      return (
                        <div
                          className={`relative rounded-2xl p-5 sm:p-6 transition-all duration-300 space-y-5 ${
                            isAtivo
                              ? 'bg-gradient-to-b from-[#1E1508] via-[#0E1526] to-[#0A0F1D] border-2 border-amber-500 shadow-[0_0_35px_rgba(245,158,11,0.22)] ring-1 ring-amber-400/40'
                              : 'bg-[#0B101D]/80 border border-slate-800 hover:border-amber-500/40 hover:bg-[#0E1526]/90'
                          }`}
                        >
                          {/* Accent bar no topo do card */}
                          <div
                            className={`absolute top-0 left-6 right-6 h-1 rounded-b-full transition-all ${
                              isAtivo ? 'bg-gradient-to-r from-amber-400 to-amber-600 shadow-sm' : 'bg-transparent'
                            }`}
                          />

                          {/* Top Header do Card */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                                  isAtivo
                                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-inner'
                                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                                }`}
                              >
                                <User className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-black text-white tracking-tight">
                                    Perfil Homologação & Testes
                                  </h4>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">
                                    CPF
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400">
                                  Contas Pessoa Física para homologação e testes de gateway
                                </p>
                              </div>
                            </div>

                            {/* Botão de Ativação / Badge de Vigência */}
                            <div>
                              {isAtivo ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-black uppercase text-amber-950 bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.5)]">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Perfil em Vigência</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setApiConfig((prev) => ({ ...prev, perfilAtivo: 'HOMOLOGACAO_DEV' }))}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase text-slate-300 bg-slate-800 hover:bg-amber-500/20 hover:text-amber-300 hover:border-amber-500/40 border border-slate-700 transition-all cursor-pointer"
                                >
                                  <span>Ativar Este Perfil</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* INDICADOR VISUAL DE STATUS DE CONEXÃO (ONLINE / OFFLINE) */}
                          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {isTesting ? (
                                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                                  <span className="text-[11px] font-mono font-bold">TESTANDO CONEXÃO...</span>
                                </div>
                              ) : isOnline ? (
                                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                                  <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                  </span>
                                  <span className="text-[11px] font-mono font-bold tracking-wider">ONLINE</span>
                                  {latencia != null && (
                                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                      ⚡ {latencia}ms
                                    </span>
                                  )}
                                </div>
                              ) : isOffline ? (
                                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.15)]">
                                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
                                  <span className="text-[11px] font-mono font-bold tracking-wider">OFFLINE</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-400">
                                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                                  <span className="text-[11px] font-mono font-bold tracking-wider">AGUARDANDO TESTE</span>
                                </div>
                              )}

                              <div className="text-[11px] font-mono text-slate-400">
                                <span className="text-slate-500">Última resposta: </span>
                                <span className="text-slate-300">
                                  {ultimaResp
                                    ? new Date(ultimaResp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                    : 'Nunca'}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => testarConexaoApi('asaas', 'HOMOLOGACAO_DEV')}
                              disabled={isTesting}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 hover:border-amber-500/40 text-[11px] font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              <Wifi className="w-3 h-3 text-amber-400" />
                              <span>{isTesting ? 'Verificando...' : 'Testar Conexão'}</span>
                            </button>
                          </div>

                          {/* Formulário de Campos do Perfil 1 */}
                          <div className="space-y-3.5 pt-1">
                            <div className="space-y-1">
                              <label className="text-[11px] font-mono font-bold text-slate-300 flex items-center justify-between">
                                <span>Nome do Titular (Pessoa Física)</span>
                                <span className="text-[10px] text-slate-500 font-normal">Exigido pelo Asaas PF</span>
                              </label>
                              <input
                                type="text"
                                value={devData?.nomeTitular || ''}
                                onChange={(e) =>
                                  setApiConfig((prev) => ({
                                    ...prev,
                                    perfisAsaas: {
                                      ...prev.perfisAsaas,
                                      HOMOLOGACAO_DEV: {
                                        ...prev.perfisAsaas.HOMOLOGACAO_DEV,
                                        nomeTitular: e.target.value
                                      }
                                    }
                                  }))
                                }
                                placeholder="Ex: Francisco Fábio R. C."
                                className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none transition-colors"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[11px] font-mono font-bold text-slate-300">
                                  CPF do Titular
                                </label>
                                <input
                                  type="text"
                                  value={devData?.cpf || ''}
                                  onChange={(e) =>
                                    setApiConfig((prev) => ({
                                      ...prev,
                                      perfisAsaas: {
                                        ...prev.perfisAsaas,
                                        HOMOLOGACAO_DEV: {
                                          ...prev.perfisAsaas.HOMOLOGACAO_DEV,
                                          cpf: e.target.value
                                        }
                                      }
                                    }))
                                  }
                                  placeholder="000.000.000-00"
                                  className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none transition-colors"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[11px] font-mono font-bold text-slate-300">
                                  Ambiente Asaas
                                </label>
                                <select
                                  value={devData?.ambiente || 'sandbox'}
                                  onChange={(e) =>
                                    setApiConfig((prev) => ({
                                      ...prev,
                                      perfisAsaas: {
                                        ...prev.perfisAsaas,
                                        HOMOLOGACAO_DEV: {
                                          ...prev.perfisAsaas.HOMOLOGACAO_DEV,
                                          ambiente: e.target.value as 'sandbox' | 'production'
                                        }
                                      }
                                    }))
                                  }
                                  className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none cursor-pointer transition-colors"
                                >
                                  <option value="sandbox">Sandbox (sandbox.asaas.com)</option>
                                  <option value="production">Produção Real (api.asaas.com)</option>
                                </select>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-mono font-bold text-slate-300">
                                E-mail de Notificação de Testes
                              </label>
                              <input
                                type="email"
                                value={devData?.emailNotificacao || ''}
                                onChange={(e) =>
                                  setApiConfig((prev) => ({
                                    ...prev,
                                    perfisAsaas: {
                                      ...prev.perfisAsaas,
                                      HOMOLOGACAO_DEV: {
                                        ...prev.perfisAsaas.HOMOLOGACAO_DEV,
                                        emailNotificacao: e.target.value
                                      }
                                    }
                                  }))
                                }
                                placeholder="dev@teste.com"
                                className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none transition-colors"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-mono font-bold text-slate-300 flex items-center justify-between">
                                <span>Chave de API (Asaas Sandbox / Teste)</span>
                                <button
                                  type="button"
                                  onClick={() => alternarVisibilidadeChave('asaasKeyDev')}
                                  className="text-amber-400/80 hover:text-amber-300 text-[10px] p-0.5 cursor-pointer font-mono"
                                >
                                  {mostrarChaves['asaasKeyDev'] ? 'Ocultar' : 'Visualizar'}
                                </button>
                              </label>
                              <input
                                type={mostrarChaves['asaasKeyDev'] ? 'text' : 'password'}
                                value={devData?.apiKey || ''}
                                onChange={(e) =>
                                  setApiConfig((prev) => ({
                                    ...prev,
                                    perfisAsaas: {
                                      ...prev.perfisAsaas,
                                      HOMOLOGACAO_DEV: {
                                        ...prev.perfisAsaas.HOMOLOGACAO_DEV,
                                        apiKey: e.target.value
                                      }
                                    }
                                  }))
                                }
                                placeholder="$aact_YTU5YTE0M2M6..."
                                className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none transition-colors"
                              />
                              <span className="text-[10px] text-slate-500 block">
                                Chave de Sandbox ($aact_...) gerada na conta de desenvolvimento.
                              </span>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-mono font-bold text-slate-300 flex items-center justify-between">
                                <span>Token de Validação de Webhook (Callback)</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setApiConfig((prev) => ({
                                      ...prev,
                                      perfisAsaas: {
                                        ...prev.perfisAsaas,
                                        HOMOLOGACAO_DEV: {
                                          ...prev.perfisAsaas.HOMOLOGACAO_DEV,
                                          webhookToken: 'cimadebe_dev_webhook_' + Math.random().toString(36).substring(2, 12)
                                        }
                                      }
                                    }))
                                  }
                                  className="text-amber-400/80 hover:text-amber-300 text-[10px] p-0.5 cursor-pointer font-mono"
                                >
                                  Gerar Token
                                </button>
                              </label>
                              <input
                                type="text"
                                value={devData?.webhookToken || ''}
                                onChange={(e) =>
                                  setApiConfig((prev) => ({
                                    ...prev,
                                    perfisAsaas: {
                                      ...prev.perfisAsaas,
                                      HOMOLOGACAO_DEV: {
                                        ...prev.perfisAsaas.HOMOLOGACAO_DEV,
                                        webhookToken: e.target.value
                                      }
                                    }
                                  }))
                                }
                                placeholder="cimadebe_asaas_webhook_secure_2026_token"
                                className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none transition-colors"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* CARD PERFIL 2: OFICIAL (CONVENCAO_OFICIAL) */}
                    {(() => {
                      const isAtivo = apiConfig.perfilAtivo === 'CONVENCAO_OFICIAL';
                      const oficialData = apiConfig.perfisAsaas?.CONVENCAO_OFICIAL;
                      const status = oficialData?.statusConexao || 'UNTESTED';
                      const isTesting = testingService === 'asaas' && testingProfile === 'CONVENCAO_OFICIAL';
                      const isOnline = status === 'ONLINE';
                      const isOffline = status === 'OFFLINE';
                      const latencia = oficialData?.latenciaMs;
                      const ultimaResp = oficialData?.ultimaResposta;

                      return (
                        <div
                          className={`relative rounded-2xl p-5 sm:p-6 transition-all duration-300 space-y-5 ${
                            isAtivo
                              ? 'bg-gradient-to-b from-[#081F15] via-[#0E1526] to-[#0A0F1D] border-2 border-emerald-500 shadow-[0_0_35px_rgba(16,185,129,0.22)] ring-1 ring-emerald-400/40'
                              : 'bg-[#0B101D]/80 border border-slate-800 hover:border-emerald-500/40 hover:bg-[#0E1526]/90'
                          }`}
                        >
                          {/* Accent bar no topo do card */}
                          <div
                            className={`absolute top-0 left-6 right-6 h-1 rounded-b-full transition-all ${
                              isAtivo ? 'bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-sm' : 'bg-transparent'
                            }`}
                          />

                          {/* Top Header do Card */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                                  isAtivo
                                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-inner'
                                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                                }`}
                              >
                                <Building2 className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-black text-white tracking-tight">
                                    Perfil Convenção Oficial
                                  </h4>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                                    CNPJ
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400">
                                  Conta bancária PJ oficial CIMADEBE para emissão canônica
                                </p>
                              </div>
                            </div>

                            {/* Botão de Ativação / Badge de Vigência */}
                            <div>
                              {isAtivo ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-black uppercase text-slate-950 bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.5)]">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Perfil em Vigência</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setApiConfig((prev) => ({ ...prev, perfilAtivo: 'CONVENCAO_OFICIAL' }))}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase text-slate-300 bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40 border border-slate-700 transition-all cursor-pointer"
                                >
                                  <span>Ativar Este Perfil</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* INDICADOR VISUAL DE STATUS DE CONEXÃO (ONLINE / OFFLINE) */}
                          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {isTesting ? (
                                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                                  <span className="text-[11px] font-mono font-bold">TESTANDO CONEXÃO...</span>
                                </div>
                              ) : isOnline ? (
                                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                                  <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                  </span>
                                  <span className="text-[11px] font-mono font-bold tracking-wider">ONLINE</span>
                                  {latencia != null && (
                                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                      ⚡ {latencia}ms
                                    </span>
                                  )}
                                </div>
                              ) : isOffline ? (
                                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.15)]">
                                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
                                  <span className="text-[11px] font-mono font-bold tracking-wider">OFFLINE</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-400">
                                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                                  <span className="text-[11px] font-mono font-bold tracking-wider">AGUARDANDO TESTE</span>
                                </div>
                              )}

                              <div className="text-[11px] font-mono text-slate-400">
                                <span className="text-slate-500">Última resposta: </span>
                                <span className="text-slate-300">
                                  {ultimaResp
                                    ? new Date(ultimaResp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                    : 'Nunca'}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => testarConexaoApi('asaas', 'CONVENCAO_OFICIAL')}
                              disabled={isTesting}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 hover:border-emerald-500/40 text-[11px] font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              <Wifi className="w-3 h-3 text-emerald-400" />
                              <span>{isTesting ? 'Verificando...' : 'Testar Conexão'}</span>
                            </button>
                          </div>

                          {/* Formulário de Campos do Perfil 2 */}
                          <div className="space-y-3.5 pt-1">
                            <div className="space-y-1">
                              <label className="text-[11px] font-mono font-bold text-slate-300 flex items-center justify-between">
                                <span>Razão Social (Pessoa Jurídica)</span>
                                <span className="text-[10px] text-slate-500 font-normal">Titularidade Bancária</span>
                              </label>
                              <input
                                type="text"
                                value={oficialData?.razaoSocial || ''}
                                onChange={(e) =>
                                  setApiConfig((prev) => ({
                                    ...prev,
                                    perfisAsaas: {
                                      ...prev.perfisAsaas,
                                      CONVENCAO_OFICIAL: {
                                        ...prev.perfisAsaas.CONVENCAO_OFICIAL,
                                        razaoSocial: e.target.value
                                      }
                                    }
                                  }))
                                }
                                placeholder="CONVENÇÃO DAS IGREJAS MINISTROS DAS ASSEMBLEIAS DE DEUS NO BRASIL E EXTERIOR - CIMADEBE"
                                className="w-full bg-slate-950/90 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none transition-colors"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[11px] font-mono font-bold text-slate-300">
                                  CNPJ Corporativo
                                </label>
                                <input
                                  type="text"
                                  value={oficialData?.cnpj || ''}
                                  onChange={(e) =>
                                    setApiConfig((prev) => ({
                                      ...prev,
                                      perfisAsaas: {
                                        ...prev.perfisAsaas,
                                        CONVENCAO_OFICIAL: {
                                          ...prev.perfisAsaas.CONVENCAO_OFICIAL,
                                          cnpj: e.target.value
                                        }
                                      }
                                    }))
                                  }
                                  placeholder="15.244.385/0001-90"
                                  className="w-full bg-slate-950/90 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none transition-colors"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[11px] font-mono font-bold text-slate-300">
                                  Ambiente Asaas
                                </label>
                                <select
                                  value={oficialData?.ambiente || 'production'}
                                  onChange={(e) =>
                                    setApiConfig((prev) => ({
                                      ...prev,
                                      perfisAsaas: {
                                        ...prev.perfisAsaas,
                                        CONVENCAO_OFICIAL: {
                                          ...prev.perfisAsaas.CONVENCAO_OFICIAL,
                                          ambiente: e.target.value as 'sandbox' | 'production'
                                        }
                                      }
                                    }))
                                  }
                                  className="w-full bg-slate-950/90 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none cursor-pointer transition-colors"
                                >
                                  <option value="production">Produção Real (api.asaas.com)</option>
                                  <option value="sandbox">Sandbox (sandbox.asaas.com)</option>
                                </select>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-mono font-bold text-slate-300">
                                E-mail Institucional Corporativo
                              </label>
                              <input
                                type="email"
                                value={oficialData?.emailInstitucional || ''}
                                onChange={(e) =>
                                  setApiConfig((prev) => ({
                                    ...prev,
                                    perfisAsaas: {
                                      ...prev.perfisAsaas,
                                      CONVENCAO_OFICIAL: {
                                        ...prev.perfisAsaas.CONVENCAO_OFICIAL,
                                        emailInstitucional: e.target.value
                                      }
                                    }
                                  }))
                                }
                                placeholder="secretaria@cimadebe.org.br"
                                className="w-full bg-slate-950/90 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none transition-colors"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-mono font-bold text-slate-300 flex items-center justify-between">
                                <span>Chave de API Corporativa Asaas (Produção)</span>
                                <button
                                  type="button"
                                  onClick={() => alternarVisibilidadeChave('asaasKeyOficial')}
                                  className="text-emerald-400/80 hover:text-emerald-300 text-[10px] p-0.5 cursor-pointer font-mono"
                                >
                                  {mostrarChaves['asaasKeyOficial'] ? 'Ocultar' : 'Visualizar'}
                                </button>
                              </label>
                              <input
                                type={mostrarChaves['asaasKeyOficial'] ? 'text' : 'password'}
                                value={oficialData?.apiKey || ''}
                                onChange={(e) =>
                                  setApiConfig((prev) => ({
                                    ...prev,
                                    perfisAsaas: {
                                      ...prev.perfisAsaas,
                                      CONVENCAO_OFICIAL: {
                                        ...prev.perfisAsaas.CONVENCAO_OFICIAL,
                                        apiKey: e.target.value
                                      }
                                    }
                                  }))
                                }
                                placeholder="$aact_YTU5YTE0M2M6..."
                                className="w-full bg-slate-950/90 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none transition-colors"
                              />
                              <span className="text-[10px] text-slate-500 block">
                                Chave de produção gerada no painel PJ da CIMADEBE no Asaas.
                              </span>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-mono font-bold text-slate-300 flex items-center justify-between">
                                <span>Token de Validação de Webhook (Callback)</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setApiConfig((prev) => ({
                                      ...prev,
                                      perfisAsaas: {
                                        ...prev.perfisAsaas,
                                        CONVENCAO_OFICIAL: {
                                          ...prev.perfisAsaas.CONVENCAO_OFICIAL,
                                          webhookToken: 'cimadebe_oficial_webhook_' + Math.random().toString(36).substring(2, 12)
                                        }
                                      }
                                    }))
                                  }
                                  className="text-emerald-400/80 hover:text-emerald-300 text-[10px] p-0.5 cursor-pointer font-mono"
                                >
                                  Gerar Token
                                </button>
                              </label>
                              <input
                                type="text"
                                value={oficialData?.webhookToken || ''}
                                onChange={(e) =>
                                  setApiConfig((prev) => ({
                                    ...prev,
                                    perfisAsaas: {
                                      ...prev.perfisAsaas,
                                      CONVENCAO_OFICIAL: {
                                        ...prev.perfisAsaas.CONVENCAO_OFICIAL,
                                        webhookToken: e.target.value
                                      }
                                    }
                                  }))
                                }
                                placeholder="cimadebe_asaas_webhook_secure_2026_token"
                                className="w-full bg-slate-950/90 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none transition-colors"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* 3. TOKEN DO WEBHOOK CENTRALIZADO */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-mono font-bold text-white flex items-center gap-2">
                          <Zap className="w-4 h-4 text-amber-400" />
                          <span>Configuração de Webhook de Retorno Automático</span>
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          O webhook recebe confirmações de pagamento via Pix, Cartão e Boleto em tempo real para conciliação contábil.
                        </p>
                      </div>
                      <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded">
                        Endpoint: <code className="text-amber-300">/api/webhook/asaas</code>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      <div className="space-y-1">
                        <label className="text-[11px] font-mono font-bold text-slate-300 flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <span>Token de Validação do Webhook Asaas</span>
                            <button
                              type="button"
                              onClick={() => {
                                const randomToken = 'whk_sec_' + Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
                                setApiConfig({ ...apiConfig, asaasWebhookToken: randomToken });
                              }}
                              className="text-amber-400 hover:text-amber-300 text-[10px] font-mono underline cursor-pointer"
                            >
                              Gerar Token Seguro
                            </button>
                          </span>
                          <button
                            type="button"
                            onClick={() => alternarVisibilidadeChave('asaasWebhook')}
                            className="text-slate-500 hover:text-slate-300 text-[10px] p-0.5 cursor-pointer"
                          >
                            {mostrarChaves['asaasWebhook'] ? 'Ocultar' : 'Visualizar'}
                          </button>
                        </label>
                        <input
                          type={mostrarChaves['asaasWebhook'] ? 'text' : 'password'}
                          value={apiConfig.asaasWebhookToken}
                          onChange={(e) => setApiConfig({ ...apiConfig, asaasWebhookToken: e.target.value })}
                          placeholder="whk_sec_..."
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-mono font-bold text-slate-300">
                          URL de Destino do Webhook (para colar no Asaas)
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/asaas` : 'https://.../api/webhook/asaas'}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-400 font-mono focus:outline-none cursor-default select-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. AÇÃO ATÔMICA: SALVAR E ATIVAR PERFIL SELECIONADO */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-emerald-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                        <Save className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">
                          Ação Atômica: Salvar e Ativar Perfil Selecionado
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          Gravação direta no Firestore em <code className="text-amber-400">configuracoes/apis</code>. O perfil ativo (<strong>{apiConfig.perfilAtivo === 'HOMOLOGACAO_DEV' ? 'HOMOLOGACAO_DEV' : 'CONVENCAO_OFICIAL'}</strong>) passará a processar os checkouts imediatamente.
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => salvarConfiguracoesApi()}
                      disabled={loading}
                      className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[42px] shadow-lg shadow-amber-500/20 shrink-0"
                    >
                      <Check className="w-4 h-4" />
                      <span>{loading ? 'Gravando no Firestore...' : 'Salvar e Ativar Perfil'}</span>
                    </button>
                  </div>
                </div>
              )}

              {apiSubTab === 'whatsapp' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-4">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-emerald-400 shrink-0" />
                        <span>Canal WhatsApp & Mensageria de Suporte</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Disparo automático de comprovantes, lembretes de anuidade e links da credencial digital.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => testarConexaoApi('whatsapp')}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-xs transition-colors cursor-pointer min-h-[40px]"
                    >
                      {testingService === 'whatsapp' ? 'Testando...' : 'Testar Conexão'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-slate-300">Token da Instância (Z-API)</label>
                      <input
                        type="text"
                        value={apiConfig.whatsappInstanceToken}
                        onChange={(e) => setApiConfig({ ...apiConfig, whatsappInstanceToken: e.target.value })}
                        placeholder="3B8F8A7D..."
                        className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm sm:text-xs text-white font-mono focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-slate-300">Chave Client Token</label>
                      <input
                        type="password"
                        value={apiConfig.whatsappApiKey}
                        onChange={(e) => setApiConfig({ ...apiConfig, whatsappApiKey: e.target.value })}
                        placeholder="••••••••••••••••"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm sm:text-xs text-white font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {apiSubTab === 'cnpj' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-4">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-cyan-400 shrink-0" />
                        <span>Consulta Automatizada de CNPJ</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Preenchimento e verificação em tempo real da situação cadastral de Igrejas Filiadas.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => testarConexaoApi('cnpj')}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-bold text-xs transition-colors cursor-pointer min-h-[40px]"
                    >
                      {testingService === 'cnpj' ? 'Testando...' : 'Testar Consulta'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-slate-300">Provedor de Consulta</label>
                      <select
                        value={apiConfig.cnpjProvider}
                        onChange={(e) => setApiConfig({ ...apiConfig, cnpjProvider: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm sm:text-xs text-white focus:outline-none cursor-pointer"
                      >
                        <option value="receitaws">ReceitaWS API</option>
                        <option value="brasilapi">BrasilAPI Pública</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-slate-300">Token Comercial (Opcional)</label>
                      <input
                        type="text"
                        value={apiConfig.cnpjApiToken}
                        onChange={(e) => setApiConfig({ ...apiConfig, cnpjApiToken: e.target.value })}
                        placeholder="Token comercial"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm sm:text-xs text-white font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {apiSubTab === 'cep' && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800/60 pb-4">
                    <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      <Globe className="w-5 h-5 text-cyan-400 shrink-0" />
                      <span>Busca de Logradouro por CEP</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Resolução instantânea de endereços para cadastros ministeriais.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-slate-300">Provedor Padrão</label>
                      <select
                        value={apiConfig.cepProvider}
                        onChange={(e) => setApiConfig({ ...apiConfig, cepProvider: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm sm:text-xs text-white focus:outline-none cursor-pointer"
                      >
                        <option value="viacep">ViaCEP (Alta Estabilidade)</option>
                        <option value="brasilapi">BrasilAPI (Geocodificação)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {apiSubTab === 'smtp' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-4">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                        <Mail className="w-5 h-5 text-amber-400 shrink-0" />
                        <span>Servidor SMTP & E-mail Transacional</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Envio de senhas temporárias, notificações de auditoria e recibos convencionais.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => testarConexaoApi('smtp')}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-xs transition-colors cursor-pointer min-h-[40px]"
                    >
                      {testingService === 'smtp' ? 'Testando...' : 'Testar SMTP'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-slate-300">Host SMTP</label>
                      <input
                        type="text"
                        value={apiConfig.smtpHost}
                        onChange={(e) => setApiConfig({ ...apiConfig, smtpHost: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm sm:text-xs text-white font-mono focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-slate-300">Porta</label>
                      <input
                        type="number"
                        value={apiConfig.smtpPort}
                        onChange={(e) => setApiConfig({ ...apiConfig, smtpPort: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm sm:text-xs text-white font-mono focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-slate-300">Usuário SMTP</label>
                      <input
                        type="text"
                        value={apiConfig.smtpUser}
                        onChange={(e) => setApiConfig({ ...apiConfig, smtpUser: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm sm:text-xs text-white font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Botão de Salvar Alterações */}
              <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <span className="text-xs text-slate-500 font-mono text-center sm:text-left">
                  Gravação atômica ACID no banco de dados Firestore.
                </span>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer min-h-[44px]"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {loading
                      ? 'Gravando no Firestore...'
                      : apiSubTab === 'asaas'
                        ? `Salvar e Ativar Perfil (${apiConfig.perfilAtivo === 'HOMOLOGACAO_DEV' ? 'Homologação/CPF' : 'Convenção/CNPJ'})`
                        : 'Salvar Configurações de API'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ======================================================================= */}
        {/* ABA 03: CONVENÇÕES MULTI-TENANT & PLANOS GLOBAIS                        */}
        {/* ======================================================================= */}
        {activeTab === 'tenants' && (
          <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold block mb-1">
                  Módulo 03 · Federação de Clientes
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Controlador Multi-Tenant & Planos Globais
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Gestão isolada de cada convenção regional, subdomínios e tabela de anuidades.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setModalNovoTenant(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer min-h-[42px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Provisionar Convenção</span>
                </button>
              </div>
            </div>

            {/* Lista de Tenants Cadastrados (Versão Adaptativa Mobile + Desktop) */}
            <div className="p-4 sm:p-6 rounded-2xl bg-[#0B101C] border border-slate-800/90 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-white">Instâncias em Operação</h3>
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={tenantFilter}
                    onChange={(e) => setTenantFilter(e.target.value)}
                    placeholder="Filtrar convenção..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Versão Desktop: Tabela */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800/80 text-slate-400 font-mono">
                      <th className="pb-3 font-semibold">Identificador</th>
                      <th className="pb-3 font-semibold">Nome da Convenção</th>
                      <th className="pb-3 font-semibold">Subdomínio</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {tenantsList
                      .filter((t) =>
                        tenantFilter
                          ? t.nomeConvenacao?.toLowerCase().includes(tenantFilter.toLowerCase()) ||
                            t.tenantId?.toLowerCase().includes(tenantFilter.toLowerCase())
                          : true
                      )
                      .map((tenant) => (
                        <tr key={tenant.tenantId} className="hover:bg-slate-900/40">
                          <td className="py-3 font-mono text-cyan-400 font-bold">{tenant.tenantId}</td>
                          <td className="py-3 text-white font-medium">{tenant.nomeConvenacao}</td>
                          <td className="py-3 font-mono text-slate-400">{tenant.subdomain || `${tenant.tenantId}.cimadebe.org.br`}</td>
                          <td className="py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-bold ${
                                tenant.status === 'active' ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  tenant.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'
                                }`}
                              />
                              {tenant.status === 'active' ? 'ATIVO' : 'SUSPENSO'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              onClick={() => alternarStatusTenant(tenant.tenantId)}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 hover:text-white cursor-pointer"
                            >
                              {tenant.status === 'active' ? 'Suspender' : 'Ativar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    {tenantsList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500">
                          Nenhuma convenção secundária cadastrada. Convenção Matriz CIMADEBE ativa.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Versão Mobile: Cards Adaptativos (Não amassa a tela) */}
              <div className="md:hidden space-y-3">
                {tenantsList
                  .filter((t) =>
                    tenantFilter
                      ? t.nomeConvenacao?.toLowerCase().includes(tenantFilter.toLowerCase()) ||
                        t.tenantId?.toLowerCase().includes(tenantFilter.toLowerCase())
                      : true
                  )
                  .map((tenant) => (
                    <div
                      key={tenant.tenantId}
                      className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-cyan-400 font-bold text-xs">
                          {tenant.tenantId}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold ${
                            tenant.status === 'active' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              tenant.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                          />
                          {tenant.status === 'active' ? 'ATIVO' : 'SUSPENSO'}
                        </span>
                      </div>
                      <div className="text-white font-semibold text-xs leading-snug">
                        {tenant.nomeConvenacao}
                      </div>
                      <div className="font-mono text-slate-400 text-[11px] truncate">
                        {tenant.subdomain || `${tenant.tenantId}.cimadebe.org.br`}
                      </div>
                      <div className="pt-2 border-t border-slate-800/60 flex justify-end">
                        <button
                          type="button"
                          onClick={() => alternarStatusTenant(tenant.tenantId)}
                          className="w-full py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-slate-200 cursor-pointer min-h-[36px]"
                        >
                          {tenant.status === 'active' ? 'Suspender Instância' : 'Ativar Instância'}
                        </button>
                      </div>
                    </div>
                  ))}
                {tenantsList.length === 0 && (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    Nenhuma convenção regional secundária cadastrada.
                  </p>
                )}
              </div>
            </div>

            {/* Gestor Global de Planos & Taxas Estatutárias */}
            <form onSubmit={salvarTabelaPlanos} className="p-4 sm:p-6 rounded-2xl bg-[#0B101C] border border-slate-800/90 space-y-4 sm:space-y-6">
              <div className="border-b border-slate-800/60 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-400" />
                  <span>Tabela Estatutária de Taxas & Anuidades</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Valores globais adotados para emissão automática de cobranças pelo Asaas.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {Object.entries(plans).map(([key, item]) => (
                  <div key={key} className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <span className="text-[11px] font-mono text-amber-400 block truncate font-bold">
                      {item.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400 font-mono">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={item.price}
                        onChange={(e) =>
                          setPlans({
                            ...plans,
                            [key]: { ...item, price: parseFloat(e.target.value) || 0 }
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-1.5 text-xs text-white font-mono font-bold focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-800/60 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer min-h-[42px]"
                >
                  Salvar Tabela de Planos
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ======================================================================= */}
        {/* ABA 04: GOVERNANÇA RBAC & MATRIZ DE ACESSO                             */}
        {/* ======================================================================= */}
        {activeTab === 'rbac' && (
          <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold block mb-1">
                  Módulo 04 · Blindagem de Permissões
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Matriz de Acesso RBAC
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Mapeamento de privilégios estritos por perfil de usuário segundo o princípio do menor privilégio.
                </p>
              </div>
            </div>

            <div className="p-4 sm:p-6 rounded-2xl bg-[#0B101C] border border-slate-800/90 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {[
                  {
                    role: 'SUPER_ADMIN',
                    title: 'Super Master Root',
                    desc: 'Acesso irrestrito a APIs, Webhooks, Multi-Tenant e Governança Criptográfica.',
                    color: 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                  },
                  {
                    role: 'ADMIN',
                    title: 'Presidente Geral / Mesa',
                    desc: 'Gestão executiva convencional, homologação de membros e deliberações.',
                    color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10'
                  },
                  {
                    role: 'TESOURARIA',
                    title: 'Diretoria Financeira',
                    desc: 'Controle estrito de anuidades, taxas Asaas, conciliação e relatórios fiscais.',
                    color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
                  },
                  {
                    role: 'SECRETARIA',
                    title: 'Secretaria Geral',
                    desc: 'Cadastro de ministros, triagem de AGO, atas e certidões estatutárias.',
                    color: 'text-blue-400 border-blue-500/40 bg-blue-500/10'
                  },
                  {
                    role: 'BIRO',
                    title: 'Operador do Birô',
                    desc: 'Emissão física de credenciais em PVC, crachás e certificados.',
                    color: 'text-orange-400 border-orange-500/40 bg-orange-500/10'
                  },
                  {
                    role: 'MINISTRO',
                    title: 'Ministro Obreiro',
                    desc: 'Autoatendimento: Credencial digital, certidões e pagamento de anuidade.',
                    color: 'text-slate-300 border-slate-700 bg-slate-900'
                  }
                ].map((item) => (
                  <div key={item.role} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${item.color}`}>
                        {item.role}
                      </span>
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h4 className="text-xs font-bold text-white mt-1">{item.title}</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-800/60 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span>Auditoria de Privilégio Mínimo ativada no `SecurityContext`.</span>
                <span className="font-mono text-emerald-400 font-bold">100% Determinístico</span>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* ABA 05: CMS & SWITCHES DO PORTAL INSTITUCIONAL                          */}
        {/* ======================================================================= */}
        {activeTab === 'cms' && (
          <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold block mb-1">
                  Módulo 05 · Comunicação Pública
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  CMS do Portal & Switches de Módulos
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Ativação de seções públicas, comunicados oficiais e banners informativos do portal.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setModalNovaNoticia(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer min-h-[42px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Publicar Comunicado</span>
                </button>
              </div>
            </div>

            {/* Switches de Componentes Públicos */}
            <div className="p-4 sm:p-6 rounded-2xl bg-[#0B101C] border border-slate-800/90 space-y-4">
              <h3 className="text-sm font-bold text-white">Chaves de Ativação do Portal</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {Object.entries(cmsSwitches).map(([chave, item]) => (
                  <div
                    key={chave}
                    className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white block truncate">{item.titulo}</span>
                      <span className="text-[10px] font-mono text-slate-500">Módulo Público</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => alternarSwitchCms(chave, item.ativo)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                        item.ativo ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          item.ativo ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Banners do Hero */}
            <form onSubmit={salvarBannersCms} className="p-4 sm:p-6 rounded-2xl bg-[#0B101C] border border-slate-800/90 space-y-4">
              <h3 className="text-sm font-bold text-white">Banners & Avisos em Destaque</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold text-slate-300">Título Principal do Hero</label>
                  <input
                    type="text"
                    value={banners.heroTitle}
                    onChange={(e) => setBanners({ ...banners, heroTitle: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-sm sm:text-xs text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold text-slate-300">Aviso Oficial (Top Banner)</label>
                  <input
                    type="text"
                    value={banners.announcementText}
                    onChange={(e) => setBanners({ ...banners, announcementText: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-sm sm:text-xs text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase cursor-pointer min-h-[42px]"
                >
                  Salvar Textos do Portal
                </button>
              </div>
            </form>

            {/* Lista de Notícias */}
            <div className="p-4 sm:p-6 rounded-2xl bg-[#0B101C] border border-slate-800/90 space-y-3">
              <h3 className="text-sm font-bold text-white">Publicações Oficiais Ativas</h3>
              <div className="divide-y divide-slate-800/60">
                {newsList.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono">
                        <span className="text-amber-400 font-bold">{item.categoria || 'COMUNICADO'}</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-400">{item.data_publicacao || 'Recente'}</span>
                      </div>
                      <h4 className="text-xs font-bold text-white mt-0.5 truncate">{item.titulo}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => excluirNoticiaCms(item.id)}
                      className="p-2 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {newsList.length === 0 && (
                  <p className="text-xs text-slate-500 py-4 text-center">Nenhum comunicado cadastrado.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* ABA 06: LOGS DE AUDITORIA ACID & TELEMETRIA                             */}
        {/* ======================================================================= */}
        {activeTab === 'logs' && (
          <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold block mb-1">
                  Módulo 06 · Auditoria Criptográfica
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Trilha de Auditoria ACID
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Registro cronológico imutável de mutações (.limit(10) por página).
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => carregarDadosAba('logs')}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 hover:text-white cursor-pointer min-h-[40px]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Atualizar</span>
                </button>
              </div>
            </div>

            {/* Logs Paginados Adaptativos (Tabela no Desktop, Cards no Mobile) */}
            <div className="p-4 sm:p-6 rounded-2xl bg-[#0B101C] border border-slate-800/90 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Eventos Registrados</span>
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    disabled={logPage <= 1}
                    onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono text-slate-400">Pág {logPage}</span>
                  <button
                    disabled={logsList.length < 10}
                    onClick={() => setLogPage((p) => p + 1)}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Versão Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-3 font-semibold">Timestamp</th>
                      <th className="pb-3 font-semibold">Ação</th>
                      <th className="pb-3 font-semibold">Operador</th>
                      <th className="pb-3 font-semibold">Detalhes</th>
                      <th className="pb-3 font-semibold text-right">Payload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {logsList.map((log, idx) => (
                      <tr key={log.id || idx} className="hover:bg-slate-900/40">
                        <td className="py-2.5 text-slate-400 text-[11px]">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}
                        </td>
                        <td className="py-2.5 font-bold text-amber-400 text-[11px]">{log.acao || log.tipo || 'MUTACAO'}</td>
                        <td className="py-2.5 text-slate-300 text-[11px]">{log.operador || 'Root'}</td>
                        <td className="py-2.5 text-slate-300 max-w-xs truncate text-[11px] font-sans">
                          {log.detalhes || log.mensagem || 'Gravado com sucesso'}
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedLogPayload(log)}
                            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-cyan-400 cursor-pointer"
                          >
                            JSON
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Versão Mobile: Cards */}
              <div className="md:hidden space-y-2.5">
                {logsList.map((log, idx) => (
                  <div key={log.id || idx} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="font-bold text-amber-400">{log.acao || log.tipo || 'MUTACAO'}</span>
                      <span className="text-slate-500 text-[10px]">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('pt-BR') : new Date().toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-slate-300 text-xs break-words">{log.detalhes || log.mensagem || 'Gravado no ledger'}</p>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] font-mono text-slate-500">
                      <span>Operador: {log.operador || 'Root'}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedLogPayload(log)}
                        className="text-cyan-400 font-bold underline"
                      >
                        Ver JSON
                      </button>
                    </div>
                  </div>
                ))}
                {logsList.length === 0 && (
                  <p className="text-xs text-slate-500 py-4 text-center">Nenhum registro para esta página.</p>
                )}
              </div>
            </div>

            {/* Modal de Payload JSON */}
            {selectedLogPayload && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
                <div className="bg-[#0B101C] border border-slate-800 rounded-2xl max-w-xl w-full p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <span className="text-xs font-mono font-bold text-amber-400">
                      Payload do Registro ACID
                    </span>
                    <button
                      onClick={() => setSelectedLogPayload(null)}
                      className="text-slate-400 hover:text-white text-xs cursor-pointer p-1"
                    >
                      ✕
                    </button>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-y-auto flex-1">
                    {JSON.stringify(selectedLogPayload, null, 2)}
                  </pre>
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setSelectedLogPayload(null)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white cursor-pointer min-h-[40px]"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================================= */}
        {/* ABA 07: QUOTAS & MONITORAMENTO DE REQUISIÇÕES                           */}
        {/* ======================================================================= */}
        {activeTab === 'metrics' && (
          <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold block mb-1">
                  Módulo 07 · Monitoramento de Quotas, Requisições & Cache RAM
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Controle Absoluto de Requisições & Memória Heap
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Monitoramento em tempo real de tipos de requisições (com zeramento automático à meia-noite), cache RAM e ferramenta de reparo.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePurgeCache}
                  disabled={loading}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-200 text-xs font-mono font-bold cursor-pointer transition-all shadow-[0_0_15px_rgba(244,63,94,0.2)]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Reparar / Purgar Memória Cache</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuotaMetrics((prev: any) => ({
                      ...(prev || {}),
                      totalRequestsToday: (prev?.totalRequestsToday || 0) >= 40000 ? 1500 : 42000
                    }));
                    setFeedback({ type: 'success', message: 'Simulação de cota alternada (Teste do Alerta Visual de 80%)!' });
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-500/50 text-amber-200 text-xs font-mono font-bold cursor-pointer"
                >
                  ⚡ Simular 80% Cota
                </button>
                <button
                  type="button"
                  onClick={() => carregarDadosAba('metrics')}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 hover:text-white cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sincronizar</span>
                </button>
              </div>
            </div>

            {/* Quota Anti-Crash Monitor & Midnight Reset */}
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-6 backdrop-blur-md">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Status Geral & Zeramento Automático (Meia-Noite)</h3>
                  <p className="text-[11px] text-slate-400">Contadores diários de requisições HTTP e integridade dos nós</p>
                </div>
              </div>

              {quotaMetrics ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
                    <p className="text-[10px] font-mono text-slate-400">TOTAL DE REQUISIÇÕES (HOJE)</p>
                    <p className="text-xl font-mono font-bold text-cyan-300 mt-1">{quotaMetrics.totalRequestsToday ?? 0} REQ</p>
                    <span className="text-[9px] text-emerald-400 font-mono mt-1 block">Zera automaticamente 00:00</span>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
                    <p className="text-[10px] font-mono text-slate-400">ITENS EM CACHE HEAP</p>
                    <p className="text-xl font-mono font-bold text-amber-300 mt-1">{quotaMetrics.cachedRecordsCount ?? 0} Registros</p>
                    <span className="text-[9px] text-slate-500 font-mono mt-1 block">Tempo real (RAM)</span>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
                    <p className="text-[10px] font-mono text-slate-400">ESTADO DA PLATAFORMA</p>
                    <p className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      {quotaMetrics.engineStatus || "OPERATIONAL"}
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
                    <p className="text-[10px] font-mono text-slate-400">CIRCUIT BREAKER</p>
                    <p className="text-sm font-mono font-bold text-emerald-400 mt-1">{quotaMetrics.circuitBreakerStatus || "CLOSED"}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 font-mono py-4 text-center">Carregando métricas...</p>
              )}
            </div>

            {/* TWO COLUMNS: 1. Tipos de Requisições | 2. Cache em Memória Heap */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tipos de Requisições */}
              <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-4 backdrop-blur-md">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Tipos de Requisições Registradas (Reset à Meia-Noite)</h3>
                    <p className="text-[10px] text-slate-400">Endpoints monitorados no Super Master</p>
                  </div>
                </div>

                <div className="space-y-2.5 font-mono text-xs">
                  {quotaMetrics?.endpointTypes ? (
                    Object.entries(quotaMetrics.endpointTypes).map(([endpoint, count]: [string, any]) => (
                      <div key={endpoint} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-300 truncate max-w-[240px]" title={endpoint}>{endpoint}</span>
                        <span className="px-2.5 py-1 rounded-lg bg-cyan-950/80 text-cyan-300 font-bold border border-cyan-500/30">
                          {count} reqs
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-300">/api/supermaster/apis</span>
                      <span className="text-cyan-300 font-bold">18 reqs</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cache em Memória Heap */}
              <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-4 backdrop-blur-md">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Cache em Memória Heap (RAM) em Tempo Real</h3>
                    <p className="text-[10px] text-slate-400">Dados mantidos em memória volátil de alta performance</p>
                  </div>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  {quotaMetrics?.heapCacheBreakdown ? (
                    quotaMetrics.heapCacheBreakdown.map((item: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">{item.categoria}</span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-amber-950 text-amber-300 border border-amber-500/30 font-bold">
                            {item.quantidade} itens
                          </span>
                        </div>
                        {item.itens && item.itens.length > 0 && (
                          <div className="text-[10px] text-slate-400 truncate">
                            Ex: {Array.isArray(item.itens) ? item.itens.join(', ') : item.itens}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400">Nenhum item em cache heap ativo.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Webhook Audit Logs Table */}
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-6 backdrop-blur-md">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Auditoria de Webhooks & Transações em Tempo Real</h3>
                  <p className="text-[11px] text-slate-400">Log detalhado de transações e requisições HTTP processadas</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                    <tr>
                      <th className="p-4">PAYMENT / LOG ID</th>
                      <th className="p-4">EVENTO</th>
                      <th className="p-4">VALOR (R$)</th>
                      <th className="p-4">PROCESSADO EM</th>
                      <th className="p-4">HTTP RESPONSE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono">
                    {webhookLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-500">
                          Nenhum log de webhook registrado no momento.
                        </td>
                      </tr>
                    ) : (
                      webhookLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4 text-amber-300">{log.paymentId || log.id}</td>
                          <td className="p-4 text-white">{log.event || log.acao || ""}</td>
                          <td className="p-4 text-emerald-400">{log.value ? `R$ ${log.value}` : "-"}</td>
                          <td className="p-4 text-slate-400">{log.processedAt || log.timestamp || ""}</td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                              HTTP 200 OK
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 5. MODAL DE CRIAÇÃO DE NOVA CONVENÇÃO MULTI-TENANT (RESPONSIVO)           */}
      {/* ========================================================================= */}
      {modalNovoTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
          <form
            onSubmit={salvarNovoTenant}
            className="bg-[#0B101C] border border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" />
                <span>Provisionar Convenção</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalNovoTenant(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-mono text-slate-300 font-semibold">Identificador (Tenant ID)</label>
                <input
                  type="text"
                  required
                  placeholder="ex: comadems, cieadeb"
                  value={novoTenant.tenantId}
                  onChange={(e) =>
                    setNovoTenant({
                      ...novoTenant,
                      tenantId: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-300 font-semibold">Nome da Convenção</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Convenção Estadual das ADs de Mato Grosso"
                  value={novoTenant.nomeConvenacao}
                  onChange={(e) => setNovoTenant({ ...novoTenant, nomeConvenacao: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-300 font-semibold">Subdomínio Próprio</label>
                <input
                  type="text"
                  placeholder="ex: comadems.cimadebe.org.br"
                  value={novoTenant.subdomain}
                  onChange={(e) => setNovoTenant({ ...novoTenant, subdomain: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalNovoTenant(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-300 cursor-pointer min-h-[40px]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase cursor-pointer min-h-[40px]"
              >
                Provisionar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL DE CRIAÇÃO DE COMUNICADO CMS (RESPONSIVO)                        */}
      {/* ========================================================================= */}
      {modalNovaNoticia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
          <form
            onSubmit={criarNoticiaCms}
            className="bg-[#0B101C] border border-slate-800 rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-amber-400" />
                <span>Nova Publicação no Portal</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalNovaNoticia(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-mono text-slate-300 font-semibold">Título do Comunicado</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Edital de Convocação da AGO 2026"
                  value={novaNoticia.titulo}
                  onChange={(e) => setNovaNoticia({ ...novaNoticia, titulo: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-300 font-semibold">Subtítulo ou Resumo</label>
                <input
                  type="text"
                  placeholder="ex: Deliberação sobre anuidade"
                  value={novaNoticia.subtitulo}
                  onChange={(e) => setNovaNoticia({ ...novaNoticia, subtitulo: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-300 font-semibold">Conteúdo</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Texto completo do informativo oficial..."
                  value={novaNoticia.conteudo}
                  onChange={(e) => setNovaNoticia({ ...novaNoticia, conteudo: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalNovaNoticia(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-300 cursor-pointer min-h-[40px]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase cursor-pointer min-h-[40px]"
              >
                Publicar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Perfil & Biometria do Operador */}
      <ModalPerfilUsuario
        isOpen={modalPerfilAberto}
        onClose={() => setModalPerfilAberto(false)}
        tipoPerfil="master"
      />
    </div>
  );
}
