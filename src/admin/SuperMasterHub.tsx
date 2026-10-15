import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu,
  Globe,
  Shield,
  FileText,
  Check,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Key,
  Server,
  Layers,
  Sliders,
  CheckCircle2,
  XCircle,
  Database,
  Lock,
  UserCheck,
  Crown
} from 'lucide-react';

export function SuperMasterHub() {
  const [activeTab, setActiveTab] = useState<'apis' | 'cms' | 'rbac' | 'logs'>('apis');

  // Menu 1 States (APIs & Sub-tabs)
  const [apiSubTab, setApiSubTab] = useState<'asaas' | 'atendimento' | 'cnpj' | 'cep' | 'cpf'>('asaas');
  const [apiData, setApiData] = useState<any>({ apiKey: '', webhookToken: '', environment: 'sandbox', ativo: true });
  const [apiLoading, setApiLoading] = useState(false);
  const [webhookSyncing, setWebhookSyncing] = useState(false);
  const [apiFeedback, setApiFeedback] = useState<string | null>(null);

  const handleSyncWebhook = async () => {
    setWebhookSyncing(true);
    setApiFeedback(null);
    try {
      const res = await fetch('/api/masterhub/apis/asaas/sync-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setApiFeedback('Webhook configurado e registrado com sucesso no Asaas!');
      } else {
        setApiFeedback('Erro ao registrar webhook: ' + (json.error || 'Erro desconhecido'));
      }
    } catch {
      setApiFeedback('Erro de conexão ao registrar webhook no Asaas.');
    } finally {
      setWebhookSyncing(false);
    }
  };

  // Menu 2 States (CMS Switches)
  const [cmsSwitches, setCmsSwitches] = useState<any>({
    noticias: { ativo: true, titulo: 'Notícias & Informativos' },
    mesaDiretora: { ativo: true, titulo: 'Mesa Diretora Estatutária' },
    inscricaoAgo: { ativo: true, titulo: 'Inscrições AGO' },
    eventos: { ativo: true, titulo: 'Agenda de Eventos' },
    ativoClubeBeneficios: { ativo: false, titulo: 'Portal Ministro: Clube de Benefícios (Desabilitado)' },
    ativoEad: { ativo: false, titulo: 'Portal Ministro: Certificado EAD (Desabilitado)' }
  });
  const [cmsLoading, setCmsLoading] = useState(false);

  // Menu 3 States (RBAC Matrix)
  const [rbacMatrix, setRbacMatrix] = useState<any[]>([]);
  const [rbacLoading, setRbacLoading] = useState(false);

  // Menu 4 States (Paginated Logs, limit 10)
  const [logs, setLogs] = useState<any[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);

  // LAZY FETCHING: Fetch only what is needed for the active tab / subtab
  const fetchApiSubConfig = useCallback(async (sub: string) => {
    setApiLoading(true);
    setApiFeedback(null);
    try {
      const res = await fetch(`/api/masterhub/apis/${sub}`);
      const json = await res.json();
      setApiData(json);
    } catch {
      setApiFeedback('Erro ao carregar configuração da API.');
    } finally {
      setApiLoading(false);
    }
  }, []);

  const fetchCmsSwitches = useCallback(async () => {
    setCmsLoading(true);
    try {
      const res = await fetch('/api/masterhub/cms/switches');
      const json = await res.json();
      setCmsSwitches(json);
    } catch {
      // fallback
    } finally {
      setCmsLoading(false);
    }
  }, []);

  const fetchRbacMatrix = useCallback(async () => {
    setRbacLoading(true);
    try {
      const res = await fetch('/api/masterhub/rbac/matrix');
      const json = await res.json();
      setRbacMatrix(json.matrix || []);
    } catch {
      // fallback
    } finally {
      setRbacLoading(false);
    }
  }, []);

  const fetchPaginatedLogs = useCallback(async (page: number) => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/masterhub/logs?page=${page}`);
      const json = await res.json();
      setLogs(json.logs || []);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  // Trigger lazy fetching on tab / subtab change
  useEffect(() => {
    if (activeTab === 'apis') {
      fetchApiSubConfig(apiSubTab);
    } else if (activeTab === 'cms') {
      fetchCmsSwitches();
    } else if (activeTab === 'rbac') {
      fetchRbacMatrix();
    } else if (activeTab === 'logs') {
      fetchPaginatedLogs(logPage);
    }
  }, [activeTab, apiSubTab, logPage, fetchApiSubConfig, fetchCmsSwitches, fetchRbacMatrix, fetchPaginatedLogs]);

  // Global Keyboard Navigation for Power Users (Ctrl+1, Ctrl+2, Ctrl+3, Ctrl+4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === '1') {
          e.preventDefault();
          setActiveTab('apis');
        } else if (e.key === '2') {
          e.preventDefault();
          setActiveTab('cms');
        } else if (e.key === '3') {
          e.preventDefault();
          setActiveTab('rbac');
        } else if (e.key === '4') {
          e.preventDefault();
          setActiveTab('logs');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSaveApi = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiLoading(true);
    try {
      const res = await fetch(`/api/masterhub/apis/${apiSubTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData)
      });
      if (res.ok) {
        setApiFeedback('Configuração salva com sucesso!');
      } else {
        setApiFeedback('Erro ao salvar configuração.');
      }
    } catch {
      setApiFeedback('Erro de conexão ao salvar.');
    } finally {
      setApiLoading(false);
    }
  };

  const handleToggleCms = async (key: string, currentVal: boolean) => {
    const newVal = !currentVal;
    // Optimistic update
    setCmsSwitches((prev: any) => ({
      ...prev,
      [key]: { ...prev[key], ativo: newVal }
    }));

    try {
      await fetch(`/api/masterhub/cms/switches/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: newVal })
      });
    } catch {
      // revert on error
      setCmsSwitches((prev: any) => ({
        ...prev,
        [key]: { ...prev[key], ativo: currentVal }
      }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans">
      {/* Header */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800/80 p-6 rounded-3xl backdrop-blur-md shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                SUPER MASTER <span className="text-amber-400">HUB MODULAR</span>
              </h1>
              <p className="text-xs text-slate-400 font-mono">
                Arquitetura Otimizada com Requisições Parceladas (Lazy Fetching & ACID Integrity)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              COTAS DE BANCO ATIVAS
            </span>
          </div>
        </div>

        {/* Navigation Menus */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-900/60 p-2 rounded-2xl border border-slate-800/80 backdrop-blur-md">
          <button
            onClick={() => setActiveTab('apis')}
            className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer ${
              activeTab === 'apis'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              <span>1. Central APIs</span>
            </div>
            <span className="text-[9px] font-mono opacity-75 bg-black/30 px-1.5 py-0.5 rounded">Ctrl+1</span>
          </button>
          <button
            onClick={() => setActiveTab('cms')}
            className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer ${
              activeTab === 'cms'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span>2. CMS Portal</span>
            </div>
            <span className="text-[9px] font-mono opacity-75 bg-black/30 px-1.5 py-0.5 rounded">Ctrl+2</span>
          </button>
          <button
            onClick={() => setActiveTab('rbac')}
            className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer ${
              activeTab === 'rbac'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>3. Matriz RBAC</span>
            </div>
            <span className="text-[9px] font-mono opacity-75 bg-black/30 px-1.5 py-0.5 rounded">Ctrl+3</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>4. Logs & Paginação</span>
            </div>
            <span className="text-[9px] font-mono opacity-75 bg-black/30 px-1.5 py-0.5 rounded">Ctrl+4</span>
          </button>
        </div>

        {/* TAB CONTENT WITH ANIMATED TRANSITIONS */}
        <AnimatePresence mode="wait">
          {/* MENU 1: CENTRAL DE APIS */}
          {activeTab === 'apis' && (
            <motion.div
              key="tab-apis"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md space-y-6 shadow-xl"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Server className="w-5 h-5 text-amber-400" />
                    Central de Integração de APIs (Lazy Fetching Parcelado)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Selecione abaixo o serviço para carregar e atualizar seus parâmetros de forma isolada.
                  </p>
                </div>

                {/* Sub-Tabs for APIs */}
                <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {(['asaas', 'atendimento', 'cnpj', 'cep', 'cpf'] as const).map((sub) => (
                    <button
                      key={sub}
                      onClick={() => setApiSubTab(sub)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase transition-all cursor-pointer ${
                        apiSubTab === sub
                          ? 'bg-amber-500 text-slate-950 font-bold shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>

              {apiLoading ? (
                <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                  <span className="text-xs font-mono">Carregando dados da API [{apiSubTab.toUpperCase()} ]...</span>
                </div>
              ) : (
                <form onSubmit={handleSaveApi} className="space-y-4 max-w-2xl text-xs">
                  {apiFeedback && (
                    <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{apiFeedback}</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-slate-400 font-mono text-[10px] uppercase">
                      Chave de Acesso / Token Principal ({apiSubTab.toUpperCase()})
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <Key className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={apiData.apiKey || ''}
                        onChange={(e) => setApiData({ ...apiData, apiKey: e.target.value })}
                        placeholder="Insira a chave de integração ou token"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-2.5 text-white font-mono placeholder:text-slate-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-400 font-mono text-[10px] uppercase">
                      Webhook / Token de Callback
                    </label>
                    <input
                      type="text"
                      value={apiData.webhookToken || ''}
                      onChange={(e) => setApiData({ ...apiData, webhookToken: e.target.value })}
                      placeholder="Token secreto para validação de webhooks"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-white font-mono placeholder:text-slate-600 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-slate-400 font-mono text-[10px] uppercase">
                        Ambiente
                      </label>
                      <select
                        value={apiData.environment || 'sandbox'}
                        onChange={(e) => setApiData({ ...apiData, environment: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none"
                      >
                        <option value="sandbox">Sandbox / Homologação</option>
                        <option value="production">Produção Oficial</option>
                      </select>
                    </div>

                    <div className="space-y-1 flex flex-col justify-end">
                      <label className="flex items-center gap-2 cursor-pointer p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                        <input
                          type="checkbox"
                          checked={apiData.ativo ?? true}
                          onChange={(e) => setApiData({ ...apiData, ativo: e.target.checked })}
                          className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0"
                        />
                        <span className="font-bold text-white">Serviço Ativo</span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={apiLoading}
                      className="py-2.5 px-6 rounded-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-md transition-all cursor-pointer flex items-center gap-2"
                    >
                      <Layers className="w-4 h-4" />
                      <span>Salvar Configuração ({apiSubTab.toUpperCase()})</span>
                    </button>

                    {apiSubTab === 'asaas' && (
                      <button
                        type="button"
                        onClick={handleSyncWebhook}
                        disabled={webhookSyncing}
                        className="py-2.5 px-6 rounded-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md transition-all cursor-pointer flex items-center gap-2"
                      >
                        {webhookSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                        <span>Configurar / Sincronizar Webhook no Asaas</span>
                      </button>
                    )}
                  </div>
                </form>
              )}
            </motion.div>
          )}

          {/* MENU 2: CMS PORTAL PÚBLICO & PAGE SWITCHES */}
          {activeTab === 'cms' && (
            <motion.div
              key="tab-cms"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md space-y-6 shadow-xl"
            >
              <div className="border-b border-slate-800 pb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-cyan-400" />
                  CMS Portal Público & Page Switches Instantâneos
                </h2>
                <p className="text-xs text-slate-400">
                  Ative ou desative os componentes do portal público em tempo real sem recarregar a aplicação.
                </p>
              </div>

              {cmsLoading ? (
                <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
                  <span className="text-xs font-mono">Carregando interruptores do CMS...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(cmsSwitches).map(([key, val]: [string, any]) => (
                    <div
                      key={key}
                      className="bg-slate-950/80 border border-slate-800/80 p-5 rounded-2xl flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <span className="text-xs font-mono uppercase text-cyan-400">{key}</span>
                        <h3 className="text-sm font-bold text-white">{val.titulo || key}</h3>
                        <p className="text-[10px] text-slate-400">
                          Status atual: {val.ativo ? 'Exibido no Portal' : 'Ocultado / Inativo'}
                        </p>
                      </div>

                      <button
                        onClick={() => handleToggleCms(key, val.ativo)}
                        className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                          val.ativo ? 'bg-cyan-600' : 'bg-slate-800'
                        }`}
                      >
                        <motion.div
                          layout
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className={`w-6 h-6 rounded-full bg-white shadow-md`}
                          animate={{ x: val.ativo ? 24 : 0 }}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* MENU 3: MATRIZ RBAC */}
          {activeTab === 'rbac' && (
            <motion.div
              key="tab-rbac"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md space-y-6 shadow-xl"
            >
              <div className="border-b border-slate-800 pb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  Matriz de Autoria e Ética de Acesso (RBAC Executive Checklist)
                </h2>
                <p className="text-xs text-slate-400">
                  Visão executiva dos níveis convencionais, papéis e módulos autorizados no sistema.
                </p>
              </div>

              {rbacLoading ? (
                <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                  <span className="text-xs font-mono">Carregando matriz de permissões...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rbacMatrix.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950/80 border border-slate-800/80 p-5 rounded-2xl space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                          {item.role}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">{item.nivel}</span>
                      </div>
                      <h3 className="text-sm font-bold text-white">{item.nome}</h3>
                      <div className="space-y-1.5 pt-2 border-t border-slate-900">
                        <span className="text-[10px] font-mono text-slate-500 uppercase">Módulos Permitidos:</span>
                        <ul className="space-y-1">
                          {item.modulos?.map((mod: string, mIdx: number) => (
                            <li key={mIdx} className="text-xs text-slate-300 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>{mod}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* MENU 4: LOGS & PAGINAÇÃO (.limit(10)) */}
          {activeTab === 'logs' && (
            <motion.div
              key="tab-logs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md space-y-6 shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    Operações & Logs Paginados (Strict Limit 10)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Trilha de auditoria e eventos operacionais protegidos contra estouro de cota de leitura.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchPaginatedLogs(logPage)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                    title="Atualizar Logs"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {logsLoading ? (
                <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                  <span className="text-xs font-mono">Carregando lote de logs (limit 10)...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/90 text-slate-400 font-mono border-b border-slate-800">
                        <tr>
                          <th className="p-3">ID / AÇÃO</th>
                          <th className="p-3">OPERADOR</th>
                          <th className="p-3">DETALHES</th>
                          <th className="p-3">TIMESTAMP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {logs.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-slate-500">
                              Nenhum registro encontrado nesta página.
                            </td>
                          </tr>
                        ) : (
                          logs.map((log: any) => (
                            <tr key={log.id} className="hover:bg-slate-900/50 transition-colors">
                              <td className="p-3 font-mono text-cyan-400">{log.acao || log.id}</td>
                              <td className="p-3 text-slate-300">{log.operadorNome || log.operadorId || 'Sistema'}</td>
                              <td className="p-3 text-slate-400 max-w-xs truncate">{log.detalhes || log.mensagem || '-'}</td>
                              <td className="p-3 font-mono text-slate-500">{log.timestamp ? new Date(log.timestamp).toLocaleString('pt-BR') : '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs font-mono text-slate-400">
                      Página {logPage} (Lote de 10 registros por requisição)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                        disabled={logPage === 1 || logsLoading}
                        className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Anterior</span>
                      </button>
                      <button
                        onClick={() => setLogPage((p) => p + 1)}
                        disabled={logs.length < 10 || logsLoading}
                        className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                      >
                        <span>Próximo</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
