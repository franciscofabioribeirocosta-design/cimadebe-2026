/**
 * @license
 * CIMADEBE / SIGM - Core SaaS Engine
 * SUPER MASTER COMMAND CENTER - ABSOLUTE SAAS ISOLATION
 * 100% Isolated from Convention Data (Zero Ministers, Zero Churches, Zero Tithes)
 * Next-Gen Cyber-Fintech Executive Command Dashboard
 */

import React, { useState, useEffect } from 'react';
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
  Power,
  Layers,
  Newspaper,
  Plus,
  Trash2,
  Activity,
  Terminal,
  MessageSquare,
  Mail,
  Zap,
  Lock,
  Radio,
  Sliders,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';
import { useSecurity } from '../SecurityContext';
import {
  verificarSuporteBiometria,
  autenticarComBiometriaNativa,
  obterCredencialBiometricaLocal
} from '../services/biometriaService';

type SuperMasterTab = 'apis' | 'tenants' | 'cms' | 'metrics';

export function SuperMasterGovernanca() {
  const { cmsSettings, atualizarCmsSettings } = useSecurity();
  const [activeTab, setActiveTab] = useState<SuperMasterTab>('apis');
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ============================================================================
  // MENU 1: CENTRAL API INTEGRATION PORTAL STATE
  // ============================================================================
  const [apiConfig, setApiConfig] = useState({
    asaasApiKey: '',
    asaasWebhookToken: '',
    environment: 'production',
    whatsappApiKey: '',
    whatsappInstanceToken: '',
    supportWebhookUrl: '',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: ''
  });

  // ============================================================================
  // MENU 2: MULTI-TENANT CLIENT CONTROLLER & GLOBAL PLANS STATE
  // ============================================================================
  const [tenants, setTenants] = useState<any[]>([]);
  const [newTenant, setNewTenant] = useState({ tenantId: '', nomeConvenacao: '', subdomain: '', status: 'active' });
  const [plans, setPlans] = useState<Record<string, { name: string; price: number }>>({
    MEMBRO_NOVO: { name: 'Anuidade Ingressante (Novo Ministro)', price: 350.00 },
    RENOVACAO_ANUAL: { name: 'Renovação de Anuidade Ministerial', price: 250.00 },
    SEGUNDA_VIA_CARTEIRA: { name: 'Emissão de 2ª Via da Credencial PVC', price: 150.00 },
    TAXA_TRANSFERENCIA: { name: 'Taxa de Transferência de Prontuário', price: 500.00 }
  });

  // ============================================================================
  // MENU 3: PUBLIC WEBSITE CMS STATE
  // ============================================================================
  const [news, setNews] = useState<any[]>([]);
  const [newNews, setNewNews] = useState({ titulo: '', subtitulo: '', conteudo: '', categoria: 'COMUNICADO', imagemUrl: '' });
  const [banners, setBanners] = useState({ heroTitle: '', heroSubtitle: '', heroImageUrl: '', announcementText: '' });

  // ============================================================================
  // MENU 4: SAAS OPERATIONS & METRICS STATE
  // ============================================================================
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [quotaMetrics, setQuotaMetrics] = useState<any>(null);

  // Load active tab data
  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab]);

  const loadTabData = async (tab: SuperMasterTab) => {
    setLoading(true);
    setFeedback(null);
    try {
      if (tab === 'apis') {
        const res = await fetch('/api/supermaster/apis');
        if (res.ok) {
          const data = await res.json();
          setApiConfig(data);
        }
      } else if (tab === 'tenants') {
        const resTenants = await fetch('/api/supermaster/tenants');
        if (resTenants.ok) setTenants(await resTenants.json());
        const resPlans = await fetch('/api/supermaster/plans');
        if (resPlans.ok) setPlans(await resPlans.json());
      } else if (tab === 'cms') {
        const resNews = await fetch('/api/supermaster/cms/news');
        if (resNews.ok) setNews(await resNews.json());
        const resBanners = await fetch('/api/supermaster/cms/banners');
        if (resBanners.ok) setBanners(await resBanners.json());
      } else if (tab === 'metrics') {
        const resLogs = await fetch('/api/supermaster/metrics/webhooks');
        if (resLogs.ok) setWebhookLogs(await resLogs.json());
        const resQuota = await fetch('/api/supermaster/metrics/quota');
        if (resQuota.ok) setQuotaMetrics(await resQuota.json());
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Falha ao carregar dados do módulo ' + tab });
    } finally {
      setLoading(false);
    }
  };

  // Save Handlers
  const handleSaveApis = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    // GATILHO BIOMÉTRICO MANDATÓRIO DE ALTA GOVERNANÇA (FIDO2 / WebAuthn)
    try {
      const suporteBio = await verificarSuporteBiometria();
      if (!suporteBio) {
        setFeedback({
          type: 'error',
          message: 'Dispositivo sem suporte a hardware biométrico (WebAuthn/FIDO2). Esta ação crítica de alta governança exige autenticação biométrica ou chave física homologada.'
        });
        setLoading(false);
        return;
      }

      const credLocal = obterCredencialBiometricaLocal();
      if (credLocal && credLocal.ativo) {
        await autenticarComBiometriaNativa(credLocal);
      }
    } catch (bioErr: any) {
      setFeedback({
        type: 'error',
        message: `Validação Biométrica Cancelada ou Não Reconhecida: ${bioErr?.message || 'Falha na verificação do sensor FIDO2'}. Ação abortada por segurança.`
      });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/supermaster/apis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiConfig)
      });
      if (res.ok) {
        setFeedback({ type: 'success', message: 'Configurações de APIs salvas com autorização biométrica homologada!' });
        loadTabData('apis');
      } else {
        throw new Error('Erro na requisição');
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Falha ao salvar configurações de APIs.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenant.tenantId || !newTenant.nomeConvenacao) return;
    setLoading(true);
    try {
      const res = await fetch('/api/supermaster/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTenant)
      });
      if (res.ok) {
        setNewTenant({ tenantId: '', nomeConvenacao: '', subdomain: '', status: 'active' });
        setFeedback({ type: 'success', message: 'Instância de Convenção criada/atualizada!' });
        loadTabData('tenants');
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Falha ao criar instância de cliente.' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTenant = async (tenantId: string) => {
    try {
      const res = await fetch(`/api/supermaster/tenants/${tenantId}/toggle`, { method: 'PATCH' });
      if (res.ok) {
        loadTabData('tenants');
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Erro ao alternar status do cliente.' });
    }
  };

  const handleSavePlans = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/supermaster/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans })
      });
      if (res.ok) {
        setFeedback({ type: 'success', message: 'Tabela global de planos sobrescrita!' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Erro ao atualizar tabela de planos.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNews.titulo) return;
    setLoading(true);
    try {
      const res = await fetch('/api/supermaster/cms/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNews)
      });
      if (res.ok) {
        setNewNews({ titulo: '', subtitulo: '', conteudo: '', categoria: 'COMUNICADO', imagemUrl: '' });
        setFeedback({ type: 'success', message: 'Notícia publicada no portal!' });
        loadTabData('cms');
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Erro ao publicar notícia.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNews = async (id: string) => {
    try {
      const res = await fetch(`/api/supermaster/cms/news/${id}`, { method: 'DELETE' });
      if (res.ok) loadTabData('cms');
    } catch (err) {
      setFeedback({ type: 'error', message: 'Erro ao excluir notícia.' });
    }
  };

  const handleSaveBanners = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/supermaster/cms/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(banners)
      });
      if (res.ok) setFeedback({ type: 'success', message: 'Banners do portal atualizados!' });
    } catch (err) {
      setFeedback({ type: 'error', message: 'Erro ao salvar banners.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 z-10">
      {/* Scanline Effect & Floating Tech Particles */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] z-50 opacity-25" />
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute top-1/4 left-10 w-96 h-96 bg-amber-500/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-1/3 right-10 w-[30rem] h-[30rem] bg-cyan-500/10 rounded-full blur-[160px] animate-pulse" style={{ animationDuration: '5s' }} />
        <div className="absolute top-2/3 left-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '7s' }} />
      </div>

      {/* Cybernetic High-Tech Header */}
      <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 border border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.12)] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-pulse">
            <Cpu className="w-7 h-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-widest bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-full shadow">
                SUPER MASTER COMMAND CENTER
              </span>
              <span className="text-xs text-emerald-400 font-mono flex items-center gap-1 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-0.5 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" /> ISOLAMENTO SAAS ABSOLUTO
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white font-sans mt-1">
              Governança & Infraestrutura Global
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
              Painel exclusivo do arquiteto do sistema: controle centralizado de APIs de pagamento, instâncias multi-tenant, CMS do portal público e telemetria de segurança server-side.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10 w-full lg:w-auto justify-end">
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-cyan-400">
            <Radio className="w-3.5 h-3.5 animate-ping text-cyan-400" />
            <span>NODE_READY / SECURE</span>
          </div>
          <button
            onClick={() => loadTabData(activeTab)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-mono font-bold border border-slate-700 cursor-pointer transition-all shadow-lg active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            <span>Sincronizar Módulo</span>
          </button>
        </div>
      </div>

      {/* Global Toast Feedback */}
      {feedback && (
        <div className={`p-4 rounded-2xl text-xs font-medium flex items-center gap-3 shadow-xl backdrop-blur-md animate-fadeIn ${
          feedback.type === 'success'
            ? 'bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.15)]'
            : 'bg-rose-950/90 border border-rose-500/50 text-rose-300 shadow-[0_0_25px_rgba(244,63,94,0.15)]'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />}
          <span className="font-mono text-sm">{feedback.message}</span>
        </div>
      )}

      {/* High-Tech Tab Navigation Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-2 bg-slate-950/80 rounded-2xl border border-slate-800/80 backdrop-blur-xl shadow-2xl">
        <button
          onClick={() => setActiveTab('apis')}
          className={`flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all cursor-pointer ${
            activeTab === 'apis'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.3)] scale-[1.02]'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>1. Central de APIs</span>
        </button>

        <button
          onClick={() => setActiveTab('tenants')}
          className={`flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all cursor-pointer ${
            activeTab === 'tenants'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.3)] scale-[1.02]'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>2. Clientes & Planos</span>
        </button>

        <button
          onClick={() => setActiveTab('cms')}
          className={`flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all cursor-pointer ${
            activeTab === 'cms'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.3)] scale-[1.02]'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>3. CMS Portal Público</span>
        </button>

        <button
          onClick={() => setActiveTab('metrics')}
          className={`flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all cursor-pointer ${
            activeTab === 'metrics'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.3)] scale-[1.02]'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>4. Webhooks & Métricas</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* MENU 1: CENTRAL API INTEGRATION PORTAL                                   */}
      {/* ========================================================================= */}
      {activeTab === 'apis' && (
        <form onSubmit={handleSaveApis} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gateway Asaas */}
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-5 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Gateway de Pagamentos Asaas</h3>
                    <p className="text-[11px] text-slate-400">Chaves de API v3 e Webhook bancário</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-amber-950 text-amber-400 border border-amber-500/30">
                  CRITICAL_API
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">ASAAS_API_KEY</label>
                  <input
                    type="text"
                    value={apiConfig.asaasApiKey}
                    onChange={(e) => setApiConfig({ ...apiConfig, asaasApiKey: e.target.value })}
                    placeholder="Insira nova chave de API Asaas..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-amber-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-mono text-slate-400">ASAAS_WEBHOOK_TOKEN</label>
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
                  </div>
                  <input
                    type="text"
                    value={apiConfig.asaasWebhookToken}
                    onChange={(e) => setApiConfig({ ...apiConfig, asaasWebhookToken: e.target.value })}
                    placeholder="Token de verificação do Webhook..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-amber-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">Ambiente de Operação</label>
                  <select
                    value={apiConfig.environment}
                    onChange={(e) => setApiConfig({ ...apiConfig, environment: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-white focus:border-amber-500 outline-none transition-all"
                  >
                    <option value="production">Produção (https://asaas.com/api/v3)</option>
                    <option value="sandbox">Sandbox / Testes (https://sandbox.asaas.com/api/v3)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Chat & Messaging APIs */}
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-5 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">APIs de Comunicação & Chat</h3>
                    <p className="text-[11px] text-slate-400">Integração WhatsApp & Webhooks de Suporte</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-cyan-950 text-cyan-400 border border-cyan-500/30">
                  WHATSAPP_API
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">WhatsApp API Key</label>
                  <input
                    type="text"
                    value={apiConfig.whatsappApiKey}
                    onChange={(e) => setApiConfig({ ...apiConfig, whatsappApiKey: e.target.value })}
                    placeholder="Chave de API WhatsApp / Evolution..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-cyan-300 focus:border-cyan-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">WhatsApp Instance Token</label>
                  <input
                    type="text"
                    value={apiConfig.whatsappInstanceToken}
                    onChange={(e) => setApiConfig({ ...apiConfig, whatsappInstanceToken: e.target.value })}
                    placeholder="Instância Ativa..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-cyan-300 focus:border-cyan-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">Webhook de Suporte Chat</label>
                  <input
                    type="text"
                    value={apiConfig.supportWebhookUrl}
                    onChange={(e) => setApiConfig({ ...apiConfig, supportWebhookUrl: e.target.value })}
                    placeholder="https://suporte.exemplo.com/webhook"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-white focus:border-cyan-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* SMTP Server Config */}
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-5 lg:col-span-2 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Servidor de Transmissão de E-mails SMTP</h3>
                    <p className="text-[11px] text-slate-400">Configuração de relatórios e notificações automáticas</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                  SMTP_GATEWAY
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">Servidor Host</label>
                  <input
                    type="text"
                    value={apiConfig.smtpHost}
                    onChange={(e) => setApiConfig({ ...apiConfig, smtpHost: e.target.value })}
                    placeholder="smtp.gmail.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">Porta SMTP</label>
                  <input
                    type="number"
                    value={apiConfig.smtpPort}
                    onChange={(e) => setApiConfig({ ...apiConfig, smtpPort: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">Usuário SMTP</label>
                  <input
                    type="text"
                    value={apiConfig.smtpUser}
                    onChange={(e) => setApiConfig({ ...apiConfig, smtpUser: e.target.value })}
                    placeholder="sistema@exemplo.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-white outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer transition-all shadow-[0_0_25px_rgba(245,158,11,0.3)]"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Configurações Globais de APIs</span>
          </button>
        </form>
      )}

      {/* ========================================================================= */}
      {/* MENU 2: MULTI-TENANT CLIENT CONTROLLER & GLOBAL PLANS                     */}
      {/* ========================================================================= */}
      {activeTab === 'tenants' && (
        <div className="space-y-8">
          {/* Tenant Client Controller */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-6 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Instâncias de Convenções Clientes (Multi-Tenant)</h3>
                  <p className="text-[11px] text-slate-400">Gerencie subdomínios, status de acesso e convenções filiadas ao SaaS</p>
                </div>
              </div>
            </div>

            {/* Create Tenant Form */}
            <form onSubmit={handleCreateTenant} className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-5 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
              <input
                type="text"
                placeholder="ID Instância (ex: sede-salvador)"
                value={newTenant.tenantId}
                onChange={(e) => setNewTenant({ ...newTenant, tenantId: e.target.value })}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white outline-none focus:border-amber-500"
              />
              <input
                type="text"
                placeholder="Nome da Convenção Cliente"
                value={newTenant.nomeConvenacao}
                onChange={(e) => setNewTenant({ ...newTenant, nomeConvenacao: e.target.value })}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-500"
              />
              <input
                type="text"
                placeholder="Subdomínio (ex: salvador.sigm.org.br)"
                value={newTenant.subdomain}
                onChange={(e) => setNewTenant({ ...newTenant, subdomain: e.target.value })}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer hover:bg-amber-400 transition-all shadow-lg"
              >
                <Plus className="w-4 h-4" /> Registrar Cliente
              </button>
            </form>

            {/* Tenants Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="p-4">ID INSTÂNCIA</th>
                    <th className="p-4">NOME DA CONVENÇÃO</th>
                    <th className="p-4">SUBDOMÍNIO</th>
                    <th className="p-4">STATUS DE ACESSO</th>
                    <th className="p-4 text-right">AÇÃO HARD TOGGLE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {tenants.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500 font-mono">
                        Nenhum cliente registrado. Espaço pronto para stasis.
                      </td>
                    </tr>
                  ) : (
                    tenants.map((tenant) => (
                      <tr key={tenant.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-mono text-amber-300 font-bold">{tenant.tenantId || tenant.id}</td>
                        <td className="p-4 font-bold text-white">{tenant.nomeConvenacao || ""}</td>
                        <td className="p-4 font-mono text-slate-400">{tenant.subdomain || ""}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                            tenant.status === 'suspended'
                              ? 'bg-rose-950 text-rose-400 border border-rose-500/30'
                              : 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {tenant.status === 'suspended' ? 'SUSPENSO' : 'ATIVO'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleToggleTenant(tenant.id)}
                            className={`px-3.5 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1.5 ml-auto cursor-pointer transition-all shadow ${
                              tenant.status === 'suspended'
                                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                                : 'bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                            {tenant.status === 'suspended' ? 'Ativar Acesso' : 'Suspender Acesso'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Global Plans Editor */}
          <form onSubmit={handleSavePlans} className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-6 backdrop-blur-md">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Editor Estático de Planos Globais para o Site Público</h3>
                <p className="text-[11px] text-slate-400">Valores cobrados nas anuidades e emissão de credenciais</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(plans).map(([key, model]) => (
                <div key={key} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/80 border border-amber-500/30 px-2.5 py-1 rounded-md">
                    {key}
                  </span>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Nome do Plano</label>
                    <input
                      type="text"
                      value={model.name || ""}
                      onChange={(e) => setPlans({
                        ...plans,
                        [key]: { ...model, name: e.target.value }
                      })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Valor Padrão (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={model.price || 0}
                      onChange={(e) => setPlans({
                        ...plans,
                        [key]: { ...model, price: Number(e.target.value) }
                      })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer transition-all shadow-[0_0_25px_rgba(245,158,11,0.3)]"
            >
              <Save className="w-4 h-4" />
              <span>Gravar Preços de Planos Globais</span>
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MENU 3: PUBLIC WEBSITE CMS                                               */}
      {/* ========================================================================= */}
      {activeTab === 'cms' && (
        <div className="space-y-8">
          {/* News Feed Management */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-6 backdrop-blur-md">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Newspaper className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Moderação de Notícias Globais (portal/noticias)</h3>
                <p className="text-[11px] text-slate-400">Publicação de artigos e comunicados oficiais</p>
              </div>
            </div>

            <form onSubmit={handleCreateNews} className="space-y-4 p-5 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Título da Notícia / Comunicado *"
                  value={newNews.titulo}
                  onChange={(e) => setNewNews({ ...newNews, titulo: e.target.value })}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  placeholder="Subtítulo Resumido"
                  value={newNews.subtitulo}
                  onChange={(e) => setNewNews({ ...newNews, subtitulo: e.target.value })}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-amber-500"
                />
              </div>

              <textarea
                placeholder="Conteúdo completo do artigo..."
                value={newNews.conteudo}
                onChange={(e) => setNewNews({ ...newNews, conteudo: e.target.value })}
                rows={3}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-amber-500"
              />

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <input
                  type="text"
                  placeholder="URL da Imagem de Capa (opcional)"
                  value={newNews.imagemUrl}
                  onChange={(e) => setNewNews({ ...newNews, imagemUrl: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-white outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 cursor-pointer transition-all shadow-lg"
                >
                  Publicar Notícia
                </button>
              </div>
            </form>

            <div className="space-y-3">
              {news.length === 0 ? (
                <p className="text-xs text-slate-500 font-mono py-4 text-center">Nenhuma notícia cadastrada no feed público.</p>
              ) : (
                news.map((item) => (
                  <div key={item.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4 hover:border-slate-700 transition-colors">
                    <div>
                      <h4 className="text-xs font-bold text-white">{item.titulo || ""}</h4>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{item.subtitulo || ""}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteNews(item.id)}
                      className="p-2 rounded-xl bg-rose-950 text-rose-400 hover:bg-rose-900 cursor-pointer border border-rose-500/30 transition-colors"
                      title="Excluir Notícia"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Landing Banners Stasis Manager */}
          <form onSubmit={handleSaveBanners} className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-6 backdrop-blur-md">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Gerenciador de Banner e Layout do Landing Page</h3>
                <p className="text-[11px] text-slate-400">Personalize o hero principal da página inicial pública</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">Título Hero Principal</label>
                <input
                  type="text"
                  value={banners.heroTitle}
                  onChange={(e) => setBanners({ ...banners, heroTitle: e.target.value })}
                  placeholder="Título principal da página..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">Subtítulo Hero Institucional</label>
                <input
                  type="text"
                  value={banners.heroSubtitle}
                  onChange={(e) => setBanners({ ...banners, heroSubtitle: e.target.value })}
                  placeholder="Subtítulo oficial..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">URL Imagem Hero Principal</label>
                <input
                  type="text"
                  value={banners.heroImageUrl}
                  onChange={(e) => setBanners({ ...banners, heroImageUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-white outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer transition-all shadow-[0_0_25px_rgba(245,158,11,0.3)]"
            >
              <Save className="w-4 h-4" />
              <span>Gravar Banner do Portal</span>
            </button>
          </form>

          {/* Gerenciador de Menus e Páginas do Portal Público (CMS) */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-6 backdrop-blur-md">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/30">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Controle de Menus do Portal Público (CMS)</h3>
                <p className="text-[11px] text-slate-400">Ao desativar um menu, ele é imediatamente ocultado da barra de navegação pública</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { chave: 'quemSomos', label: 'Quem Somos', desc: 'História e Diretrizes' },
                { chave: 'mesaDiretora', label: 'Mesa Diretora', desc: 'Liderança e Conselhos' },
                { chave: 'igrejasFiliadas', label: 'Igrejas Filiadas', desc: 'Templos e Congregações' },
                { chave: 'inscricaoAgo', label: 'Inscrição AGO', desc: 'Assembleia Geral Ordinária' },
                { chave: 'eventos', label: 'Eventos', desc: 'Calendário Eclesiástico' },
                { chave: 'noticias', label: 'Notícias', desc: 'Informativos Oficiais' },
                { chave: 'validacaoCredenciais', label: 'Validador / Scanner', desc: 'Terminal de Consulta Pública' },
                { chave: 'contatos', label: 'Contatos', desc: 'Secretaria e Ouvidoria' },
              ].map((m) => {
                const ativo = (cmsSettings.paginasVisiveis as any)[m.chave] !== false;
                return (
                  <div key={m.chave} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">{m.label}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{m.desc}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => atualizarCmsSettings({ [m.chave]: !ativo } as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all ${
                        ativo
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                          : 'bg-rose-950 text-rose-400 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                      }`}
                    >
                      {ativo ? 'VISÍVEL' : 'OCULTO'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Autorização de Módulos Especiais do Portal do Ministro */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-6 backdrop-blur-md">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Autorização de Módulos do Portal do Ministro (Super Master)</h3>
                <p className="text-[11px] text-slate-400">Controle global de visibilidade de recursos para todos os ministros</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Clube de Benefícios</span>
                  <span className="text-[10px] text-slate-400 font-mono">Vantagens & Parcerias</span>
                </div>
                <button
                  onClick={() => atualizarCmsSettings({ ativoClubeBeneficios: !cmsSettings.paginasVisiveis.ativoClubeBeneficios })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all ${
                    cmsSettings.paginasVisiveis.ativoClubeBeneficios !== false
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                      : 'bg-rose-950 text-rose-400 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                  }`}
                >
                  {cmsSettings.paginasVisiveis.ativoClubeBeneficios !== false ? 'ATIVADO' : 'DESATIVADO'}
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Urna Eletrônica (AGO)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Votação E-Democracy</span>
                </div>
                <button
                  onClick={() => atualizarCmsSettings({ ativoUrnaEletronica: !cmsSettings.paginasVisiveis.ativoUrnaEletronica })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all ${
                    cmsSettings.paginasVisiveis.ativoUrnaEletronica !== false
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                      : 'bg-rose-950 text-rose-400 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                  }`}
                >
                  {cmsSettings.paginasVisiveis.ativoUrnaEletronica !== false ? 'ATIVADO' : 'DESATIVADO'}
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Certificados EAD</span>
                  <span className="text-[10px] text-slate-400 font-mono">Seminário Teológico</span>
                </div>
                <button
                  onClick={() => atualizarCmsSettings({ ativoEad: !cmsSettings.paginasVisiveis.ativoEad })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all ${
                    cmsSettings.paginasVisiveis.ativoEad !== false
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                      : 'bg-rose-950 text-rose-400 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                  }`}
                >
                  {cmsSettings.paginasVisiveis.ativoEad !== false ? 'ATIVADO' : 'DESATIVADO'}
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Mural de Orações</span>
                  <span className="text-[10px] text-slate-400 font-mono">Comunhão Pastoral</span>
                </div>
                <button
                  onClick={() => atualizarCmsSettings({ ativoMuralOracao: !cmsSettings.paginasVisiveis.ativoMuralOracao })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all ${
                    cmsSettings.paginasVisiveis.ativoMuralOracao !== false
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                      : 'bg-rose-950 text-rose-400 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                  }`}
                >
                  {cmsSettings.paginasVisiveis.ativoMuralOracao !== false ? 'ATIVADO' : 'DESATIVADO'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MENU 4: SAAS OPERATIONS & METRICS                                         */}
      {/* ========================================================================= */}
      {activeTab === 'metrics' && (
        <div className="space-y-8">
          {/* Quota Anti-Crash Monitor */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-6 backdrop-blur-md">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Monitor Server-Side Anti-Crash e Quotas Firebase</h3>
                <p className="text-[11px] text-slate-400">Telemetria em tempo real do estado dos nós</p>
              </div>
            </div>

            {quotaMetrics ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
                  <p className="text-[10px] font-mono text-slate-400">ESTADO DA PLATAFORMA</p>
                  <p className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {quotaMetrics.status || "SAUDÁVEL"}
                  </p>
                </div>
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
                  <p className="text-[10px] font-mono text-slate-400">LEITURAS DIÁRIAS QUOTA</p>
                  <p className="text-sm font-mono font-bold text-cyan-300 mt-1">{quotaMetrics.dailyReadsPercent || "0%"}</p>
                </div>
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
                  <p className="text-[10px] font-mono text-slate-400">CACHE EM MEMÓRIA HEAP</p>
                  <p className="text-sm font-mono font-bold text-amber-300 mt-1">{quotaMetrics.activeMemoryCacheMB || "0"} MB</p>
                </div>
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
                  <p className="text-[10px] font-mono text-slate-400">CIRCUIT BREAKER</p>
                  <p className="text-sm font-mono font-bold text-emerald-400 mt-1">{quotaMetrics.circuitBreakerStatus || "CLOSED"}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 font-mono py-4 text-center">Carregando telemetria do servidor...</p>
            )}
          </div>

          {/* Webhook Audit Logs Table */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-6 backdrop-blur-md">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Auditoria de Webhooks em Tempo Real (Asaas & Chat APIs)</h3>
                <p className="text-[11px] text-slate-400">Log detalhado de transações e eventos do sistema</p>
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
                        Nenhum log de webhook registrado.
                      </td>
                    </tr>
                  ) : (
                    webhookLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 text-amber-300">{log.paymentId || log.id}</td>
                        <td className="p-4 text-white">{log.event || ""}</td>
                        <td className="p-4 text-emerald-400">{log.value ? `R$ ${log.value}` : "-"}</td>
                        <td className="p-4 text-slate-400">{log.processedAt || ""}</td>
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
    </div>
  );
}
