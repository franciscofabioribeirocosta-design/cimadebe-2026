/**
 * @license
 * CIMADEBE / SIGM - Birô de Impressão Industrial & Gráfica (Standalone Operator House)
 * Componente: BiroDashboard.tsx
 * Arquitetura Desacoplada e Autônoma:
 * 1. Menu: Credencial com foto e nome (Frente / Verso SVG para cada ministro com validade dinâmica Atualizada / Vencida)
 * 2. Menu: Certificado com foto e nome (Ordenado / Recebido em PDF para inscritos Plano 3 e 4 + Área para Modelo SVG)
 * 3. Menu: Crachá com foto e nome (Baixar crachá PDF para inscritos da AGO / Plano 3 e 4)
 * 4. Menu: Panfleto (Panfleto específico para cada AGO em PDF com campos configuráveis)
 * 5. Padrão para Cada Nova Convenção (Parametrização multi-convenção sem código residual ou sujeira)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer,
  Download,
  FileText,
  Lock,
  User,
  KeyRound,
  RefreshCw,
  LogOut,
  AlertCircle,
  CheckCircle2,
  FileCheck,
  Search,
  Calendar,
  Settings,
  Upload,
  Clock,
  Sparkles,
  Layers,
  Sliders,
  Check,
  X,
  Eye
} from 'lucide-react';
import { MinisterialCard } from './components/MinisterialCard';
import { CrachaCredencialAgoModal } from './components/CrachaCredencialAgoModal';

type AbaBiro = 'credencial' | 'certificado' | 'cracha' | 'panfleto' | 'antigos-ministro' | 'convencao';

interface MinistroCredencial {
  readonly id: string;
  readonly nome: string;
  readonly cargo: string;
  readonly cpf: string;
  readonly rg?: string;
  readonly registroMinisterial: string;
  readonly igreja?: string;
  readonly fotoUrl?: string;
  readonly validadeCredencial: string;
  readonly statusValidade: 'ATUALIZADA' | 'VENCIDA';
  readonly status: string;
  readonly statusAdimplencia: string;
}

interface InscritoCertificado {
  readonly id: string;
  readonly ministroId: string;
  readonly nome: string;
  readonly cargo: string;
  readonly cpf: string;
  readonly igreja?: string;
  readonly fotoUrl?: string;
  readonly tipo: 'ORDENADO' | 'RECEBIDO';
  readonly plano: string;
  readonly statusPagamento: string;
}

interface InscritoCracha {
  readonly id: string;
  readonly ministroId: string;
  readonly nome: string;
  readonly cargo: string;
  readonly cpf: string;
  readonly igreja?: string;
  readonly fotoUrl?: string;
  readonly plano: string;
  readonly registro: string;
  readonly statusPagamento: string;
}

interface ConfigConvencao {
  razaoSocial: string;
  sigla: string;
  cnpj: string;
  presidenteGeral: string;
  secretarioGeral: string;
  anoVigente: number;
  temaPadrao: string;
}

export function BiroDashboard() {
  // Estado de Autenticação do Operador do Birô
  const [sessionToken, setSessionToken] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [operadorLogin, setOperadorLogin] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [usuario, setUsuario] = useState<string>('');
  const [senha, setSenha] = useState<string>('');
  const [dbStatusInfo, setDbStatusInfo] = useState<string>('');

  // Aba Ativa do Birô
  const [abaAtiva, setAbaAtiva] = useState<AbaBiro>('credencial');

  // Dados das Listas
  const [ministrosCredenciais, setMinistrosCredenciais] = useState<MinistroCredencial[]>([]);
  const [inscritosCertificados, setInscritosCertificados] = useState<InscritoCertificado[]>([]);
  const [inscritosCrachas, setInscritosCrachas] = useState<InscritoCracha[]>([]);
  const [loadingDados, setLoadingDados] = useState<boolean>(false);
  const [buscaTermo, setBuscaTermo] = useState<string>('');

  // Feedback Visual
  const [feedbackAcao, setFeedbackAcao] = useState<{ id?: string; msg: string; tipo: 'sucesso' | 'erro' } | null>(null);

  // Modal / Edição de Validade da Credencial
  const [modalValidade, setModalValidade] = useState<{ aberto: boolean; ministroId: string; nome: string; dataAtual: string } | null>(null);
  const [novaDataValidade, setNovaDataValidade] = useState<string>('');
  const [salvandoValidade, setSalvandoValidade] = useState<boolean>(false);

  // Modal Visualizador da Credencial Oficial
  const [visualizadorCredencial, setVisualizadorCredencial] = useState<{ aberto: boolean; ministro: MinistroCredencial | null; verso: boolean } | null>(null);

  // Modal Crachá Oficial AGO (Mesmo modelo exibido e baixado pelo ministro)
  const [crachaModalInscrito, setCrachaModalInscrito] = useState<any | null>(null);

  // Formulário do Panfleto AGO
  const [panfletoAno, setPanfletoAno] = useState<string>('2026');
  const [panfletoTema, setPanfletoTema] = useState<string>('Avivamento, Unidade e Expansão Ministerial');
  const [panfletoLocal, setPanfletoLocal] = useState<string>('Centro de Convenções Oficial • Sede Convenial');
  const [uploadModeloSvg, setUploadModeloSvg] = useState<string>('');
  const [salvandoModeloSvg, setSalvandoModeloSvg] = useState<boolean>(false);

  // Configuração Multi-Convenção
  const [configConvencao, setConfigConvencao] = useState<ConfigConvencao>({
    razaoSocial: 'CONVENÇÃO CIMADEBE',
    sigla: 'CIMADEBE / SIGM',
    cnpj: '00.000.000/0001-00',
    presidenteGeral: 'Presidente da Convenção',
    secretarioGeral: 'Secretário Geral',
    anoVigente: 2026,
    temaPadrao: 'Avivamento, Unidade e Expansão Ministerial'
  });
  const [salvandoConfig, setSalvandoConfig] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // CARREGAR DADOS DE ACORDO COM A ABA ATIVA
  // ---------------------------------------------------------------------------
  const carregarDadosAba = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingDados(true);

    try {
      if (abaAtiva === 'credencial' || abaAtiva === 'antigos-ministro') {
        const res = await fetch(`/api/biro/ministros-credenciais${buscaTermo ? `?search=${encodeURIComponent(buscaTermo)}` : ''}`);
        if (res.ok) {
          const text = await res.text();
          const dados = text ? JSON.parse(text) : [];
          setMinistrosCredenciais(Array.isArray(dados) ? dados : []);
        } else {
          setMinistrosCredenciais([]);
        }
      } else if (abaAtiva === 'certificado') {
        const res = await fetch(`/api/biro/inscritos-certificados${buscaTermo ? `?search=${encodeURIComponent(buscaTermo)}` : ''}`);
        if (res.ok) {
          const text = await res.text();
          const dados = text ? JSON.parse(text) : [];
          setInscritosCertificados(Array.isArray(dados) ? dados : []);
        } else {
          setInscritosCertificados([]);
        }
      } else if (abaAtiva === 'cracha') {
        const res = await fetch(`/api/biro/inscritos-crachas${buscaTermo ? `?search=${encodeURIComponent(buscaTermo)}` : ''}`);
        if (res.ok) {
          const text = await res.text();
          const dados = text ? JSON.parse(text) : [];
          setInscritosCrachas(Array.isArray(dados) ? dados : []);
        } else {
          setInscritosCrachas([]);
        }
      } else if (abaAtiva === 'convencao') {
        const res = await fetch('/api/biro/config-convencao');
        if (res.ok) {
          const text = await res.text();
          const dados = text ? JSON.parse(text) : {};
          if (dados && dados.sigla) {
            setConfigConvencao(dados);
          }
        }
      }
    } catch (err: any) {
      console.warn('[BiroDashboard] Falha ao carregar dados:', err?.message);
    } finally {
      setLoadingDados(false);
    }
  }, [isAuthenticated, abaAtiva, buscaTermo]);

  useEffect(() => {
    if (isAuthenticated) {
      carregarDadosAba();
    }
  }, [isAuthenticated, abaAtiva, carregarDadosAba]);

  // ---------------------------------------------------------------------------
  // LOGIN DO OPERADOR DO BIRÔ
  // ---------------------------------------------------------------------------
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const usuarioLimpo = usuario.trim();
    const senhaLimpa = senha.trim();

    if (!usuarioLimpo || !senhaLimpa) {
      setAuthError('Preencha o usuário e a senha do operador do birô.');
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch('/api/biro/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: usuarioLimpo, senha: senhaLimpa }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok || !data.authenticated || !data.token) {
        throw new Error(data.error || 'Credenciais de operador inválidas.');
      }

      setSessionToken(data.token);
      setOperadorLogin(data.operador || usuarioLimpo);
      setIsAuthenticated(true);
      setUsuario('');
      setSenha('');
    } catch (err: any) {
      setSessionToken('');
      setIsAuthenticated(false);
      setAuthError(err.message || 'Falha na barreira de autenticação do Birô.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setSessionToken('');
    setIsAuthenticated(false);
    setOperadorLogin('');
    setUsuario('');
    setSenha('');
    setMinistrosCredenciais([]);
    setInscritosCertificados([]);
    setInscritosCrachas([]);
    setFeedbackAcao(null);
  };

  // ---------------------------------------------------------------------------
  // DOWNLOAD DIRETO DE ARQUIVOS
  // ---------------------------------------------------------------------------
  const dispararDownload = async (url: string, nomeArquivo: string, itemId: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        let msgErro = `Erro HTTP ${res.status} ao gerar arquivo.`;
        try {
          const text = await res.text();
          const errData = text ? JSON.parse(text) : {};          if (errData?.error) {
            msgErro = `${errData.error} (${res.status})`;
          } else if (errData?.details) {
            msgErro = `${errData.details} (${res.status})`;
          }
        } catch {}
        throw new Error(msgErro);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      setFeedbackAcao({
        id: itemId,
        msg: `Download concluído com sucesso: ${nomeArquivo}`,
        tipo: 'sucesso',
      });
      setTimeout(() => setFeedbackAcao(null), 3000);
    } catch (err: any) {
      setFeedbackAcao({
        id: itemId,
        msg: err.message || 'Falha no download.',
        tipo: 'erro',
      });
      setTimeout(() => setFeedbackAcao(null), 3500);
    }
  };

  const baixarSvgDireto = (lado: 'frente' | 'verso') => {
    try {
      const containerId = lado === 'frente' ? 'svg-frente-container' : 'svg-verso-container';
      const container = document.getElementById(containerId);
      const svgEl = container?.querySelector('svg');
      if (!svgEl) {
        throw new Error('Elemento SVG da credencial não localizado.');
      }
      const svgContent = new XMLSerializer().serializeToString(svgEl);
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const reg = visualizadorCredencial?.ministro?.registroMinisterial || visualizadorCredencial?.ministro?.id || 'credencial';
      link.download = `credencial_${lado}_${reg}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      setFeedbackAcao({
        msg: `Download do vetor SVG (${lado.toUpperCase()}) concluído com sucesso!`,
        tipo: 'sucesso',
      });
      setTimeout(() => setFeedbackAcao(null), 3000);
    } catch (err: any) {
      setFeedbackAcao({
        msg: err.message || 'Falha ao exportar vetor SVG.',
        tipo: 'erro',
      });
    }
  };

  // ---------------------------------------------------------------------------
  // ATUALIZAR VALIDADE DA CREDENCIAL DO MINISTRO
  // ---------------------------------------------------------------------------
  const salvarNovaValidade = async () => {
    if (!modalValidade || !novaDataValidade.trim()) return;
    setSalvandoValidade(true);

    try {
      const res = await fetch('/api/biro/atualizar-validade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ministroId: modalValidade.ministroId,
          novaDataValidade: novaDataValidade.trim(),
        }),
      });

      const text = await res.text();
      const dados = text ? JSON.parse(text) : {};      if (!res.ok) {
        throw new Error(dados.error || 'Falha ao atualizar validade.');
      }

      setFeedbackAcao({
        id: modalValidade.ministroId,
        msg: dados.mensagem || `Validade atualizada para ${dados.validadeCredencial}`,
        tipo: 'sucesso',
      });

      setModalValidade(null);
      setNovaDataValidade('');
      carregarDadosAba();
    } catch (err: any) {
      setFeedbackAcao({
        id: modalValidade.ministroId,
        msg: err.message || 'Erro ao atualizar data de validade.',
        tipo: 'erro',
      });
    } finally {
      setSalvandoValidade(false);
    }
  };

  // ---------------------------------------------------------------------------
  // SALVAR MODELO SVG DE CERTIFICADO ENVIADO PELO USUÁRIO
  // ---------------------------------------------------------------------------
  const handleArquivoSvgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const conteudo = event.target?.result as string;
      if (conteudo && (conteudo.includes('<svg') || conteudo.includes('<?xml'))) {
        setUploadModeloSvg(conteudo);
        setFeedbackAcao({
          msg: `Arquivo "${file.name}" carregado com sucesso! Clique em "Aplicar Novo SVG" para salvar e ativar.`,
          tipo: 'sucesso',
        });
      } else {
        setFeedbackAcao({
          msg: 'O arquivo selecionado não contém código SVG válido.',
          tipo: 'erro',
        });
      }
    };
    reader.readAsText(file);
  };

  const handleSalvarModeloSvg = async () => {
    if (!uploadModeloSvg.trim()) return;
    setSalvandoModeloSvg(true);

    try {
      const res = await fetch('/api/biro/salvar-modelo-certificado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ svgContent: uploadModeloSvg.trim() }),
      });

      const text = await res.text();
      const dados = text ? JSON.parse(text) : {};      if (!res.ok) throw new Error(dados.error || 'Falha ao salvar modelo SVG.');

      setFeedbackAcao({
        msg: 'Modelo SVG de certificado recebido e salvo com sucesso! Toda a convenção adotou a nova matriz.',
        tipo: 'sucesso',
      });
      setUploadModeloSvg('');
    } catch (err: any) {
      setFeedbackAcao({
        msg: err.message || 'Erro ao salvar modelo SVG.',
        tipo: 'erro',
      });
    } finally {
      setSalvandoModeloSvg(false);
    }
  };

  // ---------------------------------------------------------------------------
  // SALVAR PADRÃO DE CONFIGURAÇÃO PARA CADA NOVA CONVENÇÃO
  // ---------------------------------------------------------------------------
  const handleSalvarConfigConvencao = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoConfig(true);

    try {
      const res = await fetch('/api/biro/salvar-config-convencao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configConvencao),
      });

      const text = await res.text();
      const dados = text ? JSON.parse(text) : {};      if (!res.ok) throw new Error(dados.error || 'Falha ao salvar configuração.');

      setFeedbackAcao({
        msg: 'Padrão da convenção salvo com sucesso! Todos os documentos do Birô foram sincronizados.',
        tipo: 'sucesso',
      });
    } catch (err: any) {
      setFeedbackAcao({
        msg: err.message || 'Erro ao salvar configuração da convenção.',
        tipo: 'erro',
      });
    } finally {
      setSalvandoConfig(false);
    }
  };

  // ---------------------------------------------------------------------------
  // TELA DE LOGIN DO OPERADOR DO BIRÔ
  // ---------------------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-100">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Printer className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Birô de Impressão • Operador
            </h1>
            <p className="text-xs text-slate-400">
              Acesso exclusivo à casa de expedição física: Credenciais, Certificados, Crachás e Panfletos da Convenção.
            </p>
          </div>

          {authError && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 font-mono mb-1 font-semibold">
                USUÁRIO DO BIRÔ
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="ex: biro"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl pl-10 pr-3.5 py-2.5 text-white placeholder:text-slate-600 focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1 font-semibold">
                CHAVE DE ACESSO
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl pl-10 pr-3.5 py-2.5 text-white placeholder:text-slate-600 focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2"
            >
              {authLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validando Chave...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Liberar Console do Birô</span>
                </>
              )}
            </button>

            <div className="pt-3 border-t border-slate-800/80 space-y-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setUsuario('biro');
                  setSenha('biro2026');
                }}
                className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline block mx-auto cursor-pointer"
              >
                Preencher Credencial Padrão (biro / biro2026)
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setDbStatusInfo('Verificando credenciais no banco...');
                    const res = await fetch('/api/biro/status-credenciais');
                    const text = await res.text();
                    let data: any = {};
                    try {
                      data = text ? JSON.parse(text) : {};
                    } catch {
                      throw new Error(`Resposta não-JSON do servidor: ${text.substring(0, 80)}`);
                    }
                    if (!res.ok) {
                      throw new Error(data.error || data.message || `Erro HTTP ${res.status}`);
                    }
                    setDbStatusInfo(`Banco: Config doc existe? ${data.existsInDb ? 'Sim' : 'Não (usando padrão)'} | Usuário: ${data.username}`);
                  } catch (e: any) {
                    setDbStatusInfo('Erro ao verificar banco: ' + (e?.message || 'Falha de rede'));
                  }
                }}
                className="text-[11px] font-mono text-teal-400 hover:text-teal-300 underline block mx-auto cursor-pointer"
              >
                Verificar Credenciais no Banco de Dados
              </button>
              {dbStatusInfo && (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-mono mt-2 text-left break-words">
                  {dbStatusInfo}
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // PAINEL PRINCIPAL DO BIRÔ (AUTENTICADO)
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header Topbar */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Printer className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 font-bold uppercase">
              <span>BIRÔ DE IMPRESSÃO INDUSTRIAL</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400">EXPEDIÇÃO ATIVA</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Console Gráfico • CIMADEBE / SIGM
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {operadorLogin && (
            <span className="font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              Operador: <strong className="text-white">{operadorLogin}</strong>
            </span>
          )}
          <button
            type="button"
            onClick={carregarDadosAba}
            disabled={loadingDados}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Atualizar Dados"
          >
            <RefreshCw className={`w-4 h-4 ${loadingDados ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer flex items-center gap-1.5 font-bold"
            title="Sair do Birô"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      </header>

      {/* Navegação de Abas do Birô: Os 4 Menus Solicitados + Padrão Nova Convenção */}
      <nav className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl">
        {/* Menu 1: Credencial com foto e nome */}
        <button
          type="button"
          onClick={() => { setAbaAtiva('credencial'); setBuscaTermo(''); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            abaAtiva === 'credencial'
              ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Credencial com foto e nome</span>
        </button>

        {/* Menu 2: Certificado com foto e nome */}
        <button
          type="button"
          onClick={() => { setAbaAtiva('certificado'); setBuscaTermo(''); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            abaAtiva === 'certificado'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Certificado com foto e nome</span>
        </button>

        {/* Menu 3: Crachá com foto e nome */}
        <button
          type="button"
          onClick={() => { setAbaAtiva('cracha'); setBuscaTermo(''); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            abaAtiva === 'cracha'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Crachá com foto e nome</span>
        </button>

        {/* Menu 4: Panfleto */}
        <button
          type="button"
          onClick={() => { setAbaAtiva('panfleto'); setBuscaTermo(''); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            abaAtiva === 'panfleto'
              ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Panfleto</span>
        </button>

        {/* Menu Antigos Ministros */}
        <button
          type="button"
          onClick={() => { setAbaAtiva('antigos-ministro'); setBuscaTermo(''); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            abaAtiva === 'antigos-ministro'
              ? 'bg-purple-500 text-slate-950 shadow-lg shadow-purple-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Antigos Ministros (Ordenação & 5 Anos)</span>
        </button>

        {/* Menu 5: Padrão para Nova Convenção */}
        <button
          type="button"
          onClick={() => setAbaAtiva('convencao')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ml-auto ${
            abaAtiva === 'convencao'
              ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Padrão Nova Convenção</span>
        </button>
      </nav>

      {/* Alerta de Feedback de Ações */}
      {feedbackAcao && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
            feedbackAcao.tipo === 'sucesso'
              ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/80 border border-rose-500/40 text-rose-300'
          }`}
        >
          {feedbackAcao.tipo === 'sucesso' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedbackAcao.msg}</span>
        </div>
      )}

      {/* ======================================================================= */}
      {/* ABA 1: CREDENCIAL COM FOTO E NOME (FRENTE E VERSO SVG PARA CADA MINISTRO)*/}
      {/* ======================================================================= */}
      {abaAtiva === 'credencial' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Credenciais Ministeriais em SVG (CorelDRAW / Gráfica)</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {ministrosCredenciais.length} Ministros no Sistema
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Gere Frente e Verso em SVG vetorial puro. A validade atualiza automaticamente: se a data mudar, o status acompanha como <strong>Atualizada</strong> ou <strong>Vencida</strong>.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={buscaTermo}
                onChange={(e) => setBuscaTermo(e.target.value)}
                placeholder="Buscar ministro por nome..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
            {ministrosCredenciais.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <Layers className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs">Nenhum ministro cadastrado ou encontrado com o termo informado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-mono text-[11px] uppercase">
                      <th className="py-3 px-4 w-16">Foto</th>
                      <th className="py-3 px-4">Nome do Ministro</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {ministrosCredenciais.map((m) => {
                      const temFoto = Boolean(m.fotoUrl && m.fotoUrl.trim().length > 0);

                      return (
                        <tr
                          key={m.id}
                          onClick={() => setVisualizadorCredencial({ aberto: true, ministro: m, verso: false })}
                          className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-4">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                              {temFoto ? (
                                <img
                                  src={m.fotoUrl}
                                  alt={m.nome}
                                  className="w-full h-full object-cover"
                                />
                              ) : null}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-bold text-white">{m.nome}</div>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setVisualizadorCredencial({ aberto: true, ministro: m, verso: false });
                              }}
                              className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-mono text-xs font-bold transition-all inline-flex items-center gap-1.5 border border-amber-500/30 cursor-pointer shadow"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ver Credencial</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* ABA 2: CERTIFICADO COM FOTO E NOME (PLANO 3 E PLANO 4: ORDENADO / RECEBIDO)*/}
      {/* ======================================================================= */}
      {abaAtiva === 'certificado' && (
        <div className="space-y-4">
          {/* Card de Gestão do Modelo SVG */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 font-bold uppercase">
                  <Sparkles className="w-4 h-4" />
                  <span>MODELO DO CERTIFICADO (PRONTO PARA SVG)</span>
                </div>
                <h3 className="text-base font-black text-white">
                  Template Eclesiástico de Ordenação & Recepção
                </h3>
                <p className="text-xs text-slate-400 max-w-2xl">
                  O sistema já está 100% pronto para gerar o certificado em PDF. Quando você enviar o modelo definitivo em SVG, basta anexar ou colar abaixo e todo o Birô adotará o novo layout instantaneamente.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    dispararDownload(
                      '/api/biro/modelo-certificado-svg',
                      'modelo_certificado_oficial.svg',
                      'modelo-svg'
                    )
                  }
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs font-mono flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Modelo Atual (SVG)</span>
                </button>
              </div>
            </div>

            {/* Campo Pronto para Enviar o Modelo SVG Definitivo */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <label className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-mono text-xs font-bold border border-amber-500/40 flex items-center gap-2 cursor-pointer transition-colors shrink-0">
                  <Upload className="w-4 h-4" />
                  <span>Selecionar Arquivo SVG</span>
                  <input
                    type="file"
                    accept=".svg"
                    onChange={handleArquivoSvgUpload}
                    className="hidden"
                  />
                </label>

                <input
                  type="text"
                  value={uploadModeloSvg}
                  onChange={(e) => setUploadModeloSvg(e.target.value)}
                  placeholder="Ou cole o código SVG do modelo aqui..."
                  className="flex-1 w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none"
                />

                <button
                  type="button"
                  onClick={handleSalvarModeloSvg}
                  disabled={salvandoModeloSvg || !uploadModeloSvg.trim()}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-emerald-400 font-mono text-xs font-bold border border-emerald-500/30 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Upload className="w-4 h-4" />
                  <span>{salvandoModeloSvg ? 'Gravando...' : 'Aplicar Novo SVG'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tabela dos Inscritos Plano 3 e 4 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Inscritos Homologados nos Planos 3 e 4</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {inscritosCertificados.length} Candidatos Aptos
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Lista estrita puxada dos inscritos do Plano 3 (Ministros) e Plano 4 (Missionárias) para impressão do certificado em PDF.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={buscaTermo}
                onChange={(e) => setBuscaTermo(e.target.value)}
                placeholder="Filtrar por nome ou CPF..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
            {inscritosCertificados.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <FileCheck className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs">Nenhum inscrito dos Planos 3 e 4 encontrado com pagamento confirmado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-mono text-[11px] uppercase">
                      <th className="py-3 px-4 w-16">Foto</th>
                      <th className="py-3 px-4">Nome do Candidato</th>
                      <th className="py-3 px-4">Plano / Categoria</th>
                      <th className="py-3 px-4">Igreja Filiada</th>
                      <th className="py-3 px-4 text-right">Botões de Certificado (PDF)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {inscritosCertificados.map((c) => {
                      const temFoto = Boolean(c.fotoUrl && c.fotoUrl.trim().length > 0);

                      return (
                        <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                              {temFoto ? (
                                <img
                                  src={c.fotoUrl}
                                  alt={c.nome}
                                  className="w-full h-full object-cover"
                                />
                              ) : null}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-bold text-white">{c.nome}</div>
                            {c.cpf && <div className="text-[11px] font-mono text-slate-500">CPF: {c.cpf}</div>}
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-mono text-emerald-400">{c.plano}</div>
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
                              {c.tipo}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono text-slate-400">
                            {c.igreja || 'Igreja Filiada'}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-2">
                              {/* Botão Ordenado */}
                              <button
                                type="button"
                                onClick={() =>
                                  dispararDownload(
                                    `/api/biro/download/certificado?userId=${encodeURIComponent(c.ministroId || c.id)}&tipo=ORDENADO`,
                                    `certificado_ordenado_${c.id}.pdf`,
                                    c.id
                                  )
                                }
                                className="px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 font-mono text-[11px] font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-emerald-500/40"
                                title="Baixar Certificado de Obreiro Ordenado em PDF"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Ordenado (PDF)</span>
                              </button>

                              {/* Botão Recebido */}
                              <button
                                type="button"
                                onClick={() =>
                                  dispararDownload(
                                    `/api/biro/download/certificado?userId=${encodeURIComponent(c.ministroId || c.id)}&tipo=RECEBIDO`,
                                    `certificado_recebido_${c.id}.pdf`,
                                    c.id
                                  )
                                }
                                className="px-3 py-1.5 rounded-lg bg-teal-950/80 hover:bg-teal-900 text-teal-300 font-mono text-[11px] font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-teal-500/40"
                                title="Baixar Certificado de Obreiro Recebido em PDF"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Recebido (PDF)</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* ABA 3: CRACHÁ COM FOTO E NOME (INSCRITOS DA AGO / PLANO 3 E PLANO 4)    */}
      {/* ======================================================================= */}
      {abaAtiva === 'cracha' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Crachás Oficiais de Delegados da AGO (Formato A6 em PDF)</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {inscritosCrachas.length} Delegados
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Puxado dos inscritos da AGO em geral, com prioridade e destaque aos Planos 3 e 4.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={buscaTermo}
                onChange={(e) => setBuscaTermo(e.target.value)}
                placeholder="Filtrar por nome ou cargo..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
            {inscritosCrachas.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <User className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs">Nenhum delegado com inscrição confirmada na AGO.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-mono text-[11px] uppercase">
                      <th className="py-3 px-4 w-16">Foto</th>
                      <th className="py-3 px-4">Nome do Delegado</th>
                      <th className="py-3 px-4">Cargo / Matrícula</th>
                      <th className="py-3 px-4">Plano da Inscrição</th>
                      <th className="py-3 px-4 text-right">Ação de Impressão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {inscritosCrachas.map((cr) => {
                      const temFoto = Boolean(cr.fotoUrl && cr.fotoUrl.trim().length > 0);

                      return (
                        <tr key={cr.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                              {temFoto ? (
                                <img
                                  src={cr.fotoUrl}
                                  alt={cr.nome}
                                  className="w-full h-full object-cover"
                                />
                              ) : null}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-bold text-white">{cr.nome}</div>
                            {cr.cpf && <div className="text-[11px] font-mono text-slate-500">CPF: {cr.cpf}</div>}
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-mono text-amber-400">{cr.cargo}</div>
                            <div className="text-[11px] font-mono text-slate-500">Matrícula: {cr.registro}</div>
                          </td>

                          <td className="py-3 px-4 font-mono text-slate-300">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700">
                              {cr.plano}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setCrachaModalInscrito(cr)}
                              className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-mono text-[11px] font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer border border-amber-500/30"
                              title="Visualizar e Baixar Crachá Oficial do Ministro"
                            >
                              <User className="w-3.5 h-3.5" />
                              <span>Ver / Baixar Crachá</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* ABA: ANTIGOS MINISTROS (CERTIFICADO DE ORDENAÇÃO E CONSAGRAÇÃO 5 ANOS)  */}
      {/* ======================================================================= */}
      {abaAtiva === 'antigos-ministro' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Antigos Ministros — Certificados de Ordenação & Consagração (5 Anos)</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {ministrosCredenciais.length} Ministros Cadastrados
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Menu dedicado à emissão dos certificados oficiais para antigos ministros: Certificado de Ordenação e Consagração Ministerial (5 anos) em PDF.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={buscaTermo}
                onChange={(e) => setBuscaTermo(e.target.value)}
                placeholder="Filtrar ministro por nome ou CPF..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
            {ministrosCredenciais.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <FileCheck className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs">Nenhum ministro encontrado no sistema.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-mono text-[11px] uppercase">
                      <th className="py-3 px-4 w-16">Foto</th>
                      <th className="py-3 px-4">Nome do Ministro</th>
                      <th className="py-3 px-4">Cargo / Registro</th>
                      <th className="py-3 px-4">Igreja Filiada</th>
                      <th className="py-3 px-4 text-right">Certificados (PDF)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {ministrosCredenciais.map((m) => {
                      const temFoto = Boolean(m.fotoUrl && m.fotoUrl.trim().length > 0);
                      return (
                        <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                              {temFoto ? (
                                <img
                                  src={m.fotoUrl}
                                  alt={m.nome}
                                  className="w-full h-full object-cover"
                                />
                              ) : null}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-bold text-white">{m.nome}</div>
                            {m.cpf && <div className="text-[11px] font-mono text-slate-500">CPF: {m.cpf}</div>}
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-mono text-cyan-400">{m.cargo}</div>
                            <div className="text-[11px] font-mono text-slate-400">Reg: {m.registroMinisterial}</div>
                          </td>

                          <td className="py-3 px-4 font-mono text-slate-400">
                            {m.igreja || 'Igreja Filiada'}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-2">
                              {/* Certificado de Ordenação */}
                              <button
                                type="button"
                                onClick={() =>
                                  dispararDownload(
                                    `/api/biro/download/certificado?userId=${encodeURIComponent(m.id)}&tipo=ORDENADO`,
                                    `certificado_ordenacao_${m.id}.pdf`,
                                    m.id
                                  )
                                }
                                className="px-3 py-1.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 text-purple-300 font-mono text-[11px] font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-purple-500/40"
                                title="Baixar Certificado de Ordenação em PDF"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Certificado Ordenação</span>
                              </button>

                              {/* Consagração Ministerial (5 anos) */}
                              <button
                                type="button"
                                onClick={() =>
                                  dispararDownload(
                                    `/api/biro/download/certificado?userId=${encodeURIComponent(m.id)}&tipo=CONSAGRACAO_5_ANOS`,
                                    `consagracao_ministerial_5_anos_${m.id}.pdf`,
                                    m.id
                                  )
                                }
                                className="px-3 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 text-amber-300 font-mono text-[11px] font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-amber-500/40"
                                title="Baixar Certificado de Consagração Ministerial (5 anos) em PDF"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Consagração (5 Anos)</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* ABA 4: PANFLETO ESPECÍFICO PARA CADA AGO (IMPRESSO EM PDF)             */}
      {/* ======================================================================= */}
      {abaAtiva === 'panfleto' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-teal-400 font-bold uppercase">
                  <FileText className="w-4 h-4" />
                  <span>EXPEDIÇÃO EDITORIAL DA CONVENÇÃO</span>
                </div>
                <h2 className="text-lg font-black text-white">
                  Panfleto Oficial da Assembleia Geral Ordinária (AGO)
                </h2>
                <p className="text-xs text-slate-400">
                  Criado especificamente para cada AGO. Configure os dados da convenção ou anexe seu modelo para geração em PDF de alta resolução para impressão industrial.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 font-mono mb-1 font-semibold">
                      ANO VIGENTE DA AGO
                    </label>
                    <input
                      type="text"
                      value={panfletoAno}
                      onChange={(e) => setPanfletoAno(e.target.value)}
                      placeholder="2026"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-mono mb-1 font-semibold">
                      LOCAL DO EVENTO / SEDE
                    </label>
                    <input
                      type="text"
                      value={panfletoLocal}
                      onChange={(e) => setPanfletoLocal(e.target.value)}
                      placeholder="Centro de Convenções Oficial"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3.5 py-2.5 text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1 font-semibold">
                    TEMA CENTRAL DA ASSEMBLEIA
                  </label>
                  <input
                    type="text"
                    value={panfletoTema}
                    onChange={(e) => setPanfletoTema(e.target.value)}
                    placeholder="Avivamento, Unidade e Expansão Ministerial"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3.5 py-2.5 text-white font-bold focus:outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      dispararDownload(
                        `/api/biro/download/panfleto?ano=${encodeURIComponent(panfletoAno)}&tema=${encodeURIComponent(panfletoTema)}&local=${encodeURIComponent(panfletoLocal)}`,
                        `panfleto_oficial_ago_${panfletoAno}.pdf`,
                        'panfleto-pdf'
                      )
                    }
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-teal-500/20 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Gerar e Baixar Panfleto em PDF</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
              <h3 className="text-xs font-mono font-bold text-teal-400 uppercase flex items-center gap-2">
                <Upload className="w-4 h-4" />
                <span>CAMPO PRONTO PARA MODELO EXTERNO</span>
              </h3>
              <p className="text-xs text-slate-400">
                Quando você enviar o modelo gráfico do panfleto, o sistema já possui o slot pronto para anexar e distribuir automaticamente aos ministros.
              </p>
              <div className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 text-center space-y-2">
                <FileText className="w-6 h-6 mx-auto text-slate-500" />
                <span className="text-[11px] font-mono text-slate-400 block">
                  Aguardando upload do modelo SVG/PDF da AGO {panfletoAno}
                </span>
                <span className="text-[10px] text-teal-400 font-bold block">
                  [Slot Pronto & Configurado]
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* ABA 5: PADRÃO PARA NOVA CONVENÇÃO (MULTI-TENANT & ZERO-SUJEIRA)        */}
      {/* ======================================================================= */}
      {abaAtiva === 'convencao' && (
        <div className="max-w-3xl space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 font-bold uppercase">
                <Sliders className="w-4 h-4" />
                <span>ARQUITETURA DE MULTI-CONVENÇÃO</span>
              </div>
              <h2 className="text-lg font-black text-white">
                Padrão para Cada Nova Convenção
              </h2>
              <p className="text-xs text-slate-400">
                Como solicitado: para cada nova convenção ou AGO, basta atualizar os parâmetros abaixo. Todas as credenciais, certificados, crachás e panfletos obedecerão automaticamente a este padrão central sem duplicação de regras ou sujeira residual no código.
              </p>
            </div>

            <form onSubmit={handleSalvarConfigConvencao} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-mono mb-1 font-semibold">
                    RAZÃO SOCIAL DA CONVENÇÃO
                  </label>
                  <input
                    type="text"
                    value={configConvencao.razaoSocial}
                    onChange={(e) => setConfigConvencao({ ...configConvencao, razaoSocial: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-white focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1 font-semibold">
                    SIGLA CONVENIAL
                  </label>
                  <input
                    type="text"
                    value={configConvencao.sigla}
                    onChange={(e) => setConfigConvencao({ ...configConvencao, sigla: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-mono mb-1 font-semibold">
                    PRESIDENTE DA MESA
                  </label>
                  <input
                    type="text"
                    value={configConvencao.presidenteGeral}
                    onChange={(e) => setConfigConvencao({ ...configConvencao, presidenteGeral: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-white focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1 font-semibold">
                    SECRETÁRIO GERAL
                  </label>
                  <input
                    type="text"
                    value={configConvencao.secretarioGeral}
                    onChange={(e) => setConfigConvencao({ ...configConvencao, secretarioGeral: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-mono mb-1 font-semibold">
                    ANO VIGENTE DA CONVENÇÃO
                  </label>
                  <input
                    type="number"
                    value={configConvencao.anoVigente}
                    onChange={(e) => setConfigConvencao({ ...configConvencao, anoVigente: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1 font-semibold">
                    CNPJ REGISTRAL
                  </label>
                  <input
                    type="text"
                    value={configConvencao.cnpj}
                    onChange={(e) => setConfigConvencao({ ...configConvencao, cnpj: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1 font-semibold">
                  TEMA OFICIAL DA CONVENÇÃO / AGO
                </label>
                <input
                  type="text"
                  value={configConvencao.temaPadrao}
                  onChange={(e) => setConfigConvencao({ ...configConvencao, temaPadrao: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-white focus:outline-none"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={salvandoConfig}
                  className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg cursor-pointer flex items-center gap-2"
                >
                  {salvandoConfig ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sincronizando Padrão...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Salvar Padrão para Esta Convenção</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* MODAL DE EDIÇÃO DE VALIDADE DA CREDENCIAL                              */}
      {/* ======================================================================= */}
      {modalValidade && modalValidade.aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold">
                <Calendar className="w-4 h-4" />
                <span>ATUALIZAR VALIDADE</span>
              </div>
              <button
                type="button"
                onClick={() => setModalValidade(null)}
                className="text-slate-500 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white">{modalValidade.nome}</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Validade atual registrada: <strong className="text-cyan-400">{modalValidade.dataAtual}</strong>
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block text-slate-400 font-mono font-semibold">
                NOVA DATA DE VENCIMENTO (DD/MM/AAAA)
              </label>
              <input
                type="text"
                value={novaDataValidade}
                onChange={(e) => setNovaDataValidade(e.target.value)}
                placeholder="ex: 31/12/2026"
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 block">
                O sistema calculará automaticamente o status: se a nova data for futura, será <strong>Atualizada</strong>; caso contrário, <strong>Vencida</strong>.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModalValidade(null)}
                className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarNovaValidade}
                disabled={salvandoValidade || !novaDataValidade.trim()}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {salvandoValidade ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Salvar Validade</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* MODAL VISUALIZADOR DA CREDENCIAL OFICIAL (MINISTERIAL CARD)             */}
      {/* ======================================================================= */}
      {visualizadorCredencial && visualizadorCredencial.aberto && visualizadorCredencial.ministro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-slate-900 border border-amber-500/40 p-3 sm:p-6 space-y-4 sm:space-y-6 shadow-2xl animate-fadeIn my-auto box-border">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-black text-white truncate">Visualizador Oficial da Credencial</h3>
                  <p className="text-xs text-slate-400 truncate">
                    Titular: <strong className="text-amber-300">{visualizadorCredencial.ministro.nome}</strong> • Padrão CR-80 Original
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end shrink-0 flex-wrap">
                {/* Botão Alternar Frente / Verso */}
                <button
                  type="button"
                  onClick={() =>
                    setVisualizadorCredencial((prev) => (prev ? { ...prev, verso: !prev.verso } : null))
                  }
                  className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Alternar para {visualizadorCredencial.verso ? 'Frente (Anverso)' : 'Verso (Reverso)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVisualizadorCredencial(null)}
                  className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800 hover:bg-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Renderização Dupla (Frente e Verso) Herdada do Terminal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 p-3 sm:p-4 bg-slate-950/85 rounded-2xl border border-slate-800 shadow-inner">
              <div className="space-y-2 text-center min-w-0">
                <span className="text-xs font-mono font-bold text-cyan-400 block uppercase">Frente (Anverso)</span>
                <div id="svg-frente-container" className="w-full shadow-2xl rounded-xl overflow-hidden bg-white max-w-full">
                  <MinisterialCard
                    ministro={{
                      id: visualizadorCredencial.ministro.id,
                      nome: visualizadorCredencial.ministro.nome,
                      cargo: visualizadorCredencial.ministro.cargo as any,
                      cpf: visualizadorCredencial.ministro.cpf,
                      registroMinisterial: visualizadorCredencial.ministro.registroMinisterial,
                      fotoUrl: visualizadorCredencial.ministro.fotoUrl,
                      igrejaFiliadaNome: visualizadorCredencial.ministro.igreja,
                      status: visualizadorCredencial.ministro.status as any,
                      statusAdimplencia: visualizadorCredencial.ministro.statusAdimplencia as any,
                      dataConsagracao: visualizadorCredencial.ministro.validadeCredencial,
                    }}
                    verso={false}
                    width="100%"
                    height="auto"
                  />
                </div>
              </div>

              <div className="space-y-2 text-center min-w-0">
                <span className="text-xs font-mono font-bold text-emerald-400 block uppercase">Verso (Reverso)</span>
                <div id="svg-verso-container" className="w-full shadow-2xl rounded-xl overflow-hidden bg-white max-w-full">
                  <MinisterialCard
                    ministro={{
                      id: visualizadorCredencial.ministro.id,
                      nome: visualizadorCredencial.ministro.nome,
                      cargo: visualizadorCredencial.ministro.cargo as any,
                      cpf: visualizadorCredencial.ministro.cpf,
                      registroMinisterial: visualizadorCredencial.ministro.registroMinisterial,
                      fotoUrl: visualizadorCredencial.ministro.fotoUrl,
                      igrejaFiliadaNome: visualizadorCredencial.ministro.igreja,
                      status: visualizadorCredencial.ministro.status as any,
                      statusAdimplencia: visualizadorCredencial.ministro.statusAdimplencia as any,
                      dataConsagracao: visualizadorCredencial.ministro.validadeCredencial,
                    }}
                    verso={true}
                    width="100%"
                    height="auto"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs font-mono text-slate-400">
              <span className="text-center sm:text-left">Exportação Vetorial Pura (SVG / Blob)</span>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => baixarSvgDireto('frente')}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow text-xs font-mono"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Frente (SVG)</span>
                </button>

                <button
                  type="button"
                  onClick={() => baixarSvgDireto('verso')}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow text-xs font-mono"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Verso (SVG)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DO CRACHÁ OFICIAL DO MINISTRO (IGUAL AO PORTAL DO MINISTRO) */}
      {crachaModalInscrito && (
        <CrachaCredencialAgoModal
          inscricao={crachaModalInscrito}
          ministro={{
            id: crachaModalInscrito.ministroId || crachaModalInscrito.id,
            nome: crachaModalInscrito.nome,
            cpf: crachaModalInscrito.cpf,
            cargo: crachaModalInscrito.cargo,
            fotoUrl: crachaModalInscrito.fotoUrl,
            registroMinisterial: crachaModalInscrito.registro,
          }}
          onClose={() => setCrachaModalInscrito(null)}
        />
      )}
    </div>
  );
}

export default BiroDashboard;
