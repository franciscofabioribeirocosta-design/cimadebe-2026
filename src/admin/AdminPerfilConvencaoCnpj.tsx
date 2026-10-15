/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção Geral
 * Componente: AdminPerfilConvencaoCnpj.tsx
 * Responsabilidade Única: Exibir o Card Oficial do CNPJ da Convenção, igrejas filiadas e a 'Aba Dados'
 * contendo o Quadro Geral de Ministros Filiados, comparações entre igrejas, gráficos financeiros
 * e exportação oficial para PDF (jsPDF).
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  Building2,
  Printer,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Shield,
  Users,
  DollarSign,
  TrendingUp,
  Award,
  ChevronRight,
  BadgeCheck,
  FileText,
  Sparkles,
  BarChart3,
  Layers,
  Download,
  Upload,
  PieChart as PieIcon,
  Trash2,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { compressImageBase64 } from '../utils/imageCompressor';
import { useSecurity } from '../SecurityContext';
import { useNotification } from '../NotificationContext';
import { AdminPerfilIgreja } from './AdminPerfilIgreja';
import {
  gerarPdfCartaoCnpj,
  gerarPdfRelatorioMinistros,
  gerarPdfRelatorioIgrejas,
} from '../services/pdfExportService';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import type { AppConfig, IgrejaFiliada, Ministro } from '../types';

interface AdminPerfilConvencaoCnpjProps {
  readonly onSelecionarIgreja: (igrejaId: string) => void;
}

export function AdminPerfilConvencaoCnpj({
  onSelecionarIgreja,
}: AdminPerfilConvencaoCnpjProps) {
  const {
    appConfig,
    atualizarAppConfig,
    igrejasFiliadas,
    ministros,
    anuidades,
    operadorRole,
  } = useSecurity();
  const { notifySuccess, notifyError } = useNotification();

  // Abas internas: 'igrejas' vs 'dados'
  const [abaAtiva, setAbaAtiva] = useState<'igrejas' | 'dados'>('igrejas');

  // Estados locais
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [processandoUpload, setProcessandoUpload] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Formulário de edição da convenção (inicializado com dados reais, SEM fallbacks de URL externa)
  const [nomeConvencao, setNomeConvencao] = useState(appConfig.nomeConvencao || '');
  const [nomeFantasia, setNomeFantasia] = useState(appConfig.nomeFantasia || '');
  const [cnpj, setCnpj] = useState(appConfig.cnpj || '');
  const [endereco, setEndereco] = useState(appConfig.endereco || '');
  const [telefone, setTelefone] = useState(appConfig.telefoneConvencao || '');
  const [logoUrl, setLogoUrl] = useState(appConfig.logomarca || '');
  const uploadLogoRef = useRef<HTMLInputElement>(null);

  // Abrir Modal de Edição sincronizando os dados reais atuais do appConfig
  const abrirModalEdicao = () => {
    setNomeConvencao(appConfig.nomeConvencao || '');
    setNomeFantasia(appConfig.nomeFantasia || '');
    setCnpj(appConfig.cnpj || '');
    setEndereco(appConfig.endereco || '');
    setTelefone(appConfig.telefoneConvencao || '');
    setLogoUrl(appConfig.logomarca || '');
    setFeedback(null);
    setModalEditarAberto(true);
  };

  // Processamento estrito de arquivo de imagem do dispositivo (PNG, JPG, SVG, WebP)
  const processarArquivoImagem = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({
        tipo: 'erro',
        texto: 'Por favor, selecione um arquivo de imagem válido (PNG, JPG, JPEG, SVG ou WebP).',
      });
      return;
    }

    setProcessandoUpload(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const rawBase64 = event.target?.result as string;
        if (rawBase64) {
          // Otimiza via canvas para conformidade de payload do Firestore
          const otimizada = await compressImageBase64(rawBase64, 600, 600, 0.75);
          setLogoUrl(otimizada);
          setFeedback({
            tipo: 'sucesso',
            texto: 'Imagem da logomarca carregada com sucesso do seu dispositivo!',
          });
          setTimeout(() => setFeedback(null), 3500);
        }
        setProcessandoUpload(false);
      };
      reader.onerror = () => {
        setFeedback({ tipo: 'erro', texto: 'Falha ao ler o arquivo de imagem selecionado.' });
        setProcessandoUpload(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setFeedback({ tipo: 'erro', texto: 'Erro ao processar imagem da logomarca.' });
      setProcessandoUpload(false);
    }
  };

  const lidarComUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processarArquivoImagem(file);
    }
    // Reseta o input para permitir selecionar o mesmo arquivo novamente se desejar
    if (e.target) {
      e.target.value = '';
    }
  };

  const lidarComDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processarArquivoImagem(file);
    }
  };

  // Igreja selecionada para drill-down
  const [igrejaSelecionadaId, setIgrejaSelecionadaId] = useState<string | null>(null);

  // Estatísticas gerais para a Aba Dados
  const totalMinistrosGeral = ministros.length;
  const ministrosAdimplentesGeral = ministros.filter((m) => {
    const st = String(m.statusAdimplencia || 'EM_DIA').toUpperCase();
    return st === 'EM_DIA' || st === 'EM_DIA_FUTURO' || st === 'ADIMPLENTE' || st === 'PENDENTE';
  }).length;
  const ministrosInadimplentesGeral = totalMinistrosGeral - ministrosAdimplentesGeral;

  const totalPorCargoGeral = useMemo(() => {
    const contagem: Record<string, number> = { Pastor: 0, Evangelista: 0, Presbítero: 0, Missionária: 0 };
    ministros.forEach((m) => {
      if (contagem[m.cargo] !== undefined) {
        contagem[m.cargo]++;
      } else {
        contagem[m.cargo] = 1;
      }
    });
    return contagem;
  }, [ministros]);

  // Comparação entre igrejas
  const dadosComparativosIgrejas = useMemo(() => {
    return igrejasFiliadas.map((ig) => {
      const igNome = (ig.nomeFantasia || '').toLowerCase().trim();
      const minIgreja = ministros.filter(
        (m) =>
          (m.igrejaFiliadaId && m.igrejaFiliadaId === ig.id) ||
          (igNome.length > 0 && m.igrejaFiliadaNome && m.igrejaFiliadaNome.toLowerCase().trim() === igNome)
      );
      const adimplentes = minIgreja.filter((m) => {
        const st = String(m.statusAdimplencia || 'EM_DIA').toUpperCase();
        return st === 'EM_DIA' || st === 'EM_DIA_FUTURO' || st === 'ADIMPLENTE' || st === 'PENDENTE';
      }).length;
      const receitaEstimada = minIgreja.length * 150.0;

      return {
        nome: ig.nomeFantasia,
        municipio: ig.municipio,
        totalMinistros: minIgreja.length,
        adimplentes,
        receita: receitaEstimada,
      };
    });
  }, [igrejasFiliadas, ministros]);

  const lidarComSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      await atualizarAppConfig({
        ...appConfig,
        nomeConvencao,
        nomeFantasia,
        cnpj,
        endereco,
        telefoneConvencao: telefone,
        logomarca: logoUrl,
      });
      setFeedback({ tipo: 'sucesso', texto: 'Informações e logomarca da Convenção atualizadas com sucesso no banco de dados!' });
      notifySuccess('Convenção Atualizada', 'Os dados cadastrais e fiscais da Convenção foram gravados com sucesso.');
      setModalEditarAberto(false);
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({ tipo: 'erro', texto: 'Erro ao atualizar informações da convenção.' });
      notifyError('Erro na Atualização', err.message || 'Falha ao salvar dados da convenção.');
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setSalvando(false);
    }
  };

  if (igrejaSelecionadaId) {
    return (
      <AdminPerfilIgreja
        igrejaId={igrejaSelecionadaId}
        onVoltar={() => setIgrejaSelecionadaId(null)}
      />
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold ${
            feedback.tipo === 'sucesso'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.tipo === 'sucesso' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.texto}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white text-xs cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Bloco Superior: Cartão CNPJ da Convenção (Diferencial & Bonito com Botões PDF) */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-[0_0_50px_rgba(6,182,212,0.12)]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {appConfig.logomarca ? (
              <img
                src={appConfig.logomarca}
                alt={appConfig.nomeFantasia || 'Convenção'}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-contain p-1 border-2 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.25)] bg-slate-950 shrink-0"
              />
            ) : (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.25)] bg-slate-950 flex flex-col items-center justify-center text-cyan-400 shrink-0">
                <Building2 className="w-10 h-10" />
                <span className="text-[10px] font-mono mt-1 text-slate-400">Convenção</span>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-400 bg-cyan-950/80 border border-cyan-500/30 px-2.5 py-0.5 rounded">
                  SEDE NACIONAL • MATRIZ
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">
                  SITUAÇÃO ATIVA
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {appConfig.nomeFantasia || 'CIMADEBE'}
              </h1>

              <p className="text-xs text-slate-400 font-mono">
                Razão Social: <span className="text-slate-200 font-bold">{appConfig.nomeConvencao}</span>
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-300 pt-1">
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  CNPJ: {appConfig.cnpj}
                </span>
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  {appConfig.endereco}
                </span>
              </div>
            </div>
          </div>

          {/* Botões de Ação & Exportação PDF */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full lg:w-auto">
            <button
              onClick={() => gerarPdfCartaoCnpj(appConfig)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Exportar CNPJ (PDF)</span>
            </button>

            <button
              onClick={abrirModalEdicao}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all shadow cursor-pointer"
            >
              <Edit3 className="w-4 h-4 text-cyan-400" />
              <span>Editar Informações</span>
            </button>
          </div>
        </div>
      </section>

      {/* Seletor de Abas & Botões de Relatórios PDF */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAbaAtiva('igrejas')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              abaAtiva === 'igrejas'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Igrejas Filiadas ({igrejasFiliadas.length})</span>
          </button>

          <button
            onClick={() => setAbaAtiva('dados')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              abaAtiva === 'dados'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Aba Dados & Quadro Geral de Ministros</span>
          </button>
        </div>

        {/* Botões de Exportação de Relatórios PDF */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => gerarPdfRelatorioMinistros(ministros, appConfig.nomeConvencao)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-400 text-xs font-bold transition-all cursor-pointer shadow"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Relatório de Ministros (PDF)</span>
          </button>

          <button
            onClick={() => gerarPdfRelatorioIgrejas(igrejasFiliadas, appConfig.nomeConvencao)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-400 text-xs font-bold transition-all cursor-pointer shadow"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Relatório de Igrejas (PDF)</span>
          </button>
        </div>
      </div>

      {/* Conteúdo da Aba Igrejas */}
      {abaAtiva === 'igrejas' && (
        <section className="space-y-6">
          {igrejasFiliadas.length === 0 ? (
            <div className="text-center py-12 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
              <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-slate-300">Nenhuma igreja filiada cadastrada no momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {igrejasFiliadas.map((igreja) => {
                const igNome = (igreja.nomeFantasia || '').toLowerCase().trim();
                const ministrosDaIgreja = ministros.filter(
                  (m) =>
                    (m.igrejaFiliadaId && m.igrejaFiliadaId === igreja.id) ||
                    (igNome.length > 0 && m.igrejaFiliadaNome && m.igrejaFiliadaNome.toLowerCase().trim() === igNome)
                );

                return (
                  <div
                    key={igreja.id}
                    onClick={() => setIgrejaSelecionadaId(igreja.id)}
                    className="group rounded-3xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 p-6 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] flex flex-col justify-between space-y-4"
                  >
                    <div className="flex items-start gap-4">
                      {igreja.logoUrl ? (
                        <img
                          src={igreja.logoUrl}
                          alt={igreja.nomeFantasia}
                          className="w-14 h-14 rounded-2xl object-cover border border-slate-700 bg-slate-950 shrink-0 group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl border border-slate-700 bg-slate-950 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-105 transition-transform">
                          <Building2 className="w-6 h-6" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.5 rounded">
                            {igreja.municipio} / {igreja.uf}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400 font-bold">
                            {igreja.situacaoCadastral}
                          </span>
                        </div>
                        <h4 className="text-base font-black text-white truncate group-hover:text-cyan-300 transition-colors">
                          {igreja.nomeFantasia}
                        </h4>
                        <p className="text-xs text-slate-400 font-mono truncate">{igreja.razaoSocial}</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Ministros</span>
                        <span className="text-sm font-bold text-white flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-cyan-400" />
                          {ministrosDaIgreja.length}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">CNPJ</span>
                        <span className="text-xs font-bold text-slate-300 truncate block">{igreja.cnpj}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 text-xs font-bold text-cyan-400 group-hover:translate-x-1 transition-transform">
                      <span>Acessar Painel da Igreja</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Conteúdo da Aba Dados & Quadro Geral de Ministros */}
      {abaAtiva === 'dados' && (
        <section className="space-y-8">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              Quadro Geral de Ministros Filiados & Comparações Financeiras
            </h3>
            <p className="text-xs text-slate-400">
              Visão consolidada de toda a convenção, estatísticas por cargo e análises comparativas entre igrejas.
            </p>
          </div>

          {/* Cards Resumo Geral */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Total de Ministros</span>
              <div className="text-2xl font-black text-white font-mono">{totalMinistrosGeral}</div>
              <span className="text-[10px] font-mono text-cyan-400">Cadastrados na Convenção</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Ministros Adimplentes</span>
              <div className="text-2xl font-black text-emerald-400 font-mono">{ministrosAdimplentesGeral}</div>
              <span className="text-[10px] font-mono text-emerald-400">Regularidade em dia</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Ministros Pendentes</span>
              <div className="text-2xl font-black text-amber-400 font-mono">{ministrosInadimplentesGeral}</div>
              <span className="text-[10px] font-mono text-amber-400">Requer regularização</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Igrejas Filiadas</span>
              <div className="text-2xl font-black text-teal-400 font-mono">{igrejasFiliadas.length}</div>
              <span className="text-[10px] font-mono text-teal-400">Rede eclesiástica ativa</span>
            </div>
          </div>

          {/* Cards de Contagem por Cargo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-mono">Pastores</span>
                <div className="text-xl font-bold text-white">{totalPorCargoGeral['Pastor'] || 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-cyan-500/20 text-cyan-400">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-mono">Evangelistas</span>
                <div className="text-xl font-bold text-white">{totalPorCargoGeral['Evangelista'] || 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-mono">Presbíteros</span>
                <div className="text-xl font-bold text-white">{totalPorCargoGeral['Presbítero'] || 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-mono">Missionárias</span>
                <div className="text-xl font-bold text-white">{totalPorCargoGeral['Missionária'] || 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Gráficos Comparativos entre Igrejas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                Comparativo de Ministros por Igreja Filiada
              </h4>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosComparativosIgrejas}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="nome" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                    />
                    <Legend />
                    <Bar dataKey="totalMinistros" name="Total de Ministros" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="adimplentes" name="Adimplentes" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Comparativo Financeiro Estimado (R$) por Igreja
              </h4>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosComparativosIgrejas}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="nome" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                      formatter={(val: any) => [`R$ ${Number(val).toFixed(2)}`, 'Receita Estimada']}
                    />
                    <Legend />
                    <Bar dataKey="receita" name="Receita (R$)" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Modal de Edição da Convenção */}
      {modalEditarAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-cyan-400" />
                Editar Informações da Convenção
              </h3>
              <button
                onClick={() => setModalEditarAberto(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={lidarComSalvarEdicao} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1">NOME DA CONVENÇÃO (RAZÃO SOCIAL)</label>
                <input
                  type="text"
                  required
                  value={nomeConvencao}
                  onChange={(e) => setNomeConvencao(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">NOME FANTASIA</label>
                <input
                  type="text"
                  required
                  value={nomeFantasia}
                  onChange={(e) => setNomeFantasia(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">CNPJ</label>
                  <input
                    type="text"
                    required
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">TELEFONE</label>
                  <input
                    type="text"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">ENDEREÇO SEDE</label>
                <input
                  type="text"
                  required
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* UPLOAD DE IMAGEM DO DISPOSITIVO (SEM URL) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-300 font-bold tracking-wide">
                    LOGOMARCA OFICIAL DA CONVENÇÃO
                  </label>
                  {logoUrl && (
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 font-bold">
                      <CheckCircle2 className="w-3 h-3" /> Imagem Carregada
                    </span>
                  )}
                </div>

                <input
                  type="file"
                  ref={uploadLogoRef}
                  onChange={lidarComUploadLogo}
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  className="hidden"
                />

                {/* Dropzone de Upload de Imagem */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={lidarComDrop}
                  className={`relative rounded-2xl border-2 border-dashed transition-all p-5 flex flex-col items-center justify-center text-center gap-3 ${
                    isDragging
                      ? 'border-cyan-400 bg-cyan-950/40'
                      : 'border-slate-700 hover:border-cyan-500/60 bg-slate-950/80 hover:bg-slate-950'
                  }`}
                >
                  {processandoUpload ? (
                    <div className="py-6 flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                      <span className="text-xs text-cyan-300 font-bold">Processando e otimizando imagem do dispositivo...</span>
                    </div>
                  ) : logoUrl ? (
                    <div className="w-full flex flex-col sm:flex-row items-center gap-4">
                      <div className="w-24 h-24 rounded-2xl border-2 border-cyan-500/40 bg-slate-900 p-1 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                        <img
                          src={logoUrl}
                          alt="Logomarca da Convenção"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 text-center sm:text-left space-y-2 w-full">
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">
                            ARQUIVO LOCAL CARREGADO
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Imagem da logomarca pronta para ser gravada na Convenção.
                        </p>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => uploadLogoRef.current?.click()}
                            className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Trocar Imagem</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setLogoUrl('')}
                            className="px-3 py-1.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remover</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 space-y-3 w-full">
                      <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto shadow-inner">
                        <Upload className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-white">
                          Arraste e solte o arquivo da logomarca aqui
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          ou clique no botão abaixo para escolher do computador ou celular
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => uploadLogoRef.current?.click()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/20 cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Selecionar Imagem do Dispositivo</span>
                      </button>
                      <p className="text-[10px] text-slate-500 font-mono pt-1">
                        Formatos aceitos: PNG, JPG, JPEG, SVG ou WebP • Upload 100% direto via arquivo (sem URL)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => setModalEditarAberto(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando || processandoUpload}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black uppercase tracking-wider cursor-pointer shadow-lg shadow-cyan-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {salvando ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Salvar Alterações</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
