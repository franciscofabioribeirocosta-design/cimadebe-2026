/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Painel Administrativo de Gestão dos 4 Planos Oficiais da AGO (/admin -> Menu Plano AGO)
 * Design Estilo Banco Premium / Modern & Clean (Inspiração: Stripe, Nubank, Vercel)
 * Sincronização em Tempo Real (onSnapshot) & Isolamento de Responsabilidade (SRP)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { useSecurity } from '../SecurityContext';
import {
  PlanoAgo,
  PlanoAgoInput,
  ouvirPlanosAgo,
  salvarPlanoAgo,
  excluirPlanoAgo,
  sincronizarPlanosAgoPadrao,
} from '../services/planosAgoService';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Crown,
  DollarSign,
  Tag,
  Check,
  X,
  RefreshCw,
  Info,
  Award,
  Users,
  Eye,
  Sliders,
  CheckSquare,
  Lock,
} from 'lucide-react';

const TODOS_CARGOS_DISPONIVEIS = [
  'Pastor',
  'Evangelista',
  'Presbítero',
  'Missionária',
  'Pastor Recebido',
  'Pastor Ordenado',
  'Evangelista Recebido',
  'Evangelista Ordenado',
  'Presbítero Recebido',
  'Presbítero Ordenado',
  'Missionária Recebida',
  'Missionária Ordenada',
  'Diácono',
  'Membro',
];

function formatarMoeda(val: number): string {
  return (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function AdminPlanosAgo() {
  const { operadorAtual, operadorId, addAuditLog } = useSecurity();

  // Estados em Tempo Real (onSnapshot)
  const [planos, setPlanos] = useState<PlanoAgo[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro' | 'info'; texto: string } | null>(null);

  // Estados do Modal de Criação / Edição
  const [modalAberto, setModalAberto] = useState<boolean>(false);
  const [planoEmEdicao, setPlanoEmEdicao] = useState<PlanoAgo | null>(null);
  const [salvando, setSalvando] = useState<boolean>(false);

  // Campos do Formulário do Plano
  const [formCodigo, setFormCodigo] = useState<string>('');
  const [formNome, setFormNome] = useState<string>('');
  const [formSubtitulo, setFormSubtitulo] = useState<string>('');
  const [formValor, setFormValor] = useState<string>('190');
  const [formCargos, setFormCargos] = useState<string[]>([]);
  const [formBeneficios, setFormBeneficios] = useState<string[]>(['']);
  const [formDestaque, setFormDestaque] = useState<boolean>(false);
  const [formBadge, setFormBadge] = useState<string>('');
  const [formAtivo, setFormAtivo] = useState<boolean>(true);
  const [formOrdem, setFormOrdem] = useState<number>(1);

  // Estado para confirmação de exclusão
  const [planoParaExcluir, setPlanoParaExcluir] = useState<PlanoAgo | null>(null);
  const [excluindo, setExcluindo] = useState<boolean>(false);

  const handleSincronizarSeed = async () => {
    try {
      setFeedback({ tipo: 'info', texto: 'Sincronizando os 4 Planos Oficiais da AGO no Firestore...' });
      await sincronizarPlanosAgoPadrao(db);
      setFeedback({ tipo: 'sucesso', texto: 'Os 4 Planos Oficiais da AGO foram sincronizados e restaurados com sucesso!' });
      addAuditLog('ALTERACAO_CONFIGURACAO', `Sincronização seed dos 4 Planos da AGO executada por ${operadorAtual}`);
    } catch (err: any) {
      setFeedback({ tipo: 'erro', texto: err?.message || 'Erro ao sincronizar planos.' });
    }
  };

  // 1. Sincronização em Tempo Real (onSnapshot) com a coleção planos_ago
  useEffect(() => {
    setCarregando(true);
    const unsubscribe = ouvirPlanosAgo(
      db,
      (docs) => {
        setPlanos(docs);
        setCarregando(false);
      },
      (err) => {
        console.error('Erro ao escutar planos da AGO do Firestore:', err);
        setErro('Falha na sincronização em tempo real com o banco de dados.');
        setCarregando(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Abre Modal para Cadastro
  const abrirNovoPlano = () => {
    setPlanoEmEdicao(null);
    setFormCodigo(`PLANO_${planos.length + 1}`);
    setFormNome('');
    setFormSubtitulo('');
    setFormValor('190');
    setFormCargos(['Pastor', 'Evangelista', 'Presbítero']);
    setFormBeneficios(['Acesso total às sessões e plenárias', 'Kit do Congressista Completo', 'Direito a Voto', 'Certificado Digital']);
    setFormDestaque(false);
    setFormBadge('');
    setFormAtivo(true);
    setFormOrdem(planos.length + 1);
    setFeedback(null);
    setModalAberto(true);
  };

  // Abre Modal para Edição
  const abrirEditarPlano = (p: PlanoAgo) => {
    setPlanoEmEdicao(p);
    setFormCodigo(p.codigo || p.id);
    setFormNome(p.nome);
    setFormSubtitulo(p.subtitulo || '');
    setFormValor(String(p.valor));
    setFormCargos(p.cargosPermitidos || []);
    setFormBeneficios(p.beneficios && p.beneficios.length > 0 ? [...p.beneficios] : ['']);
    setFormDestaque(Boolean(p.destaque));
    setFormBadge(p.badgeDestaque || '');
    setFormAtivo(p.ativo ?? true);
    setFormOrdem(p.ordem ?? 1);
    setFeedback(null);
    setModalAberto(true);
  };

  // Toggle Cargo
  const toggleCargo = (cargo: string) => {
    setFormCargos((prev) =>
      prev.includes(cargo) ? prev.filter((c) => c !== cargo) : [...prev, cargo]
    );
  };

  // Adicionar campo de benefício
  const adicionarBeneficio = () => {
    setFormBeneficios((prev) => [...prev, '']);
  };

  // Alterar benefício específico
  const alterarBeneficio = (index: number, valor: string) => {
    setFormBeneficios((prev) => {
      const novo = [...prev];
      novo[index] = valor;
      return novo;
    });
  };

  // Remover benefício
  const removerBeneficio = (index: number) => {
    setFormBeneficios((prev) => prev.filter((_, i) => i !== index));
  };

  // Salvar Plano
  const lidarComSalvar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formNome.trim()) {
      setFeedback({ tipo: 'erro', texto: 'Informe o nome oficial do plano.' });
      return;
    }

    if (formCargos.length === 0) {
      setFeedback({ tipo: 'erro', texto: 'Selecione ao menos um cargo eclesiástico permitido.' });
      return;
    }

    const beneficiosLimpos = formBeneficios.map((b) => b.trim()).filter(Boolean);
    if (beneficiosLimpos.length === 0) {
      setFeedback({ tipo: 'erro', texto: 'Adicione pelo menos um benefício para o plano.' });
      return;
    }

    setSalvando(true);
    setFeedback(null);

    try {
      const payload: PlanoAgoInput = {
        codigo: formCodigo.trim().toUpperCase(),
        nome: formNome.trim(),
        subtitulo: formSubtitulo.trim(),
        valor: parseFloat(formValor) || 0,
        cargosPermitidos: formCargos,
        beneficios: beneficiosLimpos,
        destaque: formDestaque,
        badgeDestaque: formBadge.trim(),
        ativo: formAtivo,
        ordem: Number(formOrdem) || 1,
      };

      await salvarPlanoAgo(db, planoEmEdicao?.id || null, payload);

      addAuditLog(
        planoEmEdicao ? 'EDICAO_PLANO_AGO' : 'CRIACAO_PLANO_AGO',
        `Plano AGO '${payload.nome}' (${payload.codigo}) ${planoEmEdicao ? 'atualizado' : 'cadastrado'} por ${operadorAtual} - Valor: R$ ${payload.valor}`,
        'TENANT_SEDE_GERAL'
      );

      setFeedback({
        tipo: 'sucesso',
        texto: `Plano '${payload.nome}' salvo e sincronizado em tempo real no banco de dados!`,
      });

      setModalAberto(false);
    } catch (err: any) {
      console.error('Erro ao salvar plano:', err);
      setFeedback({
        tipo: 'erro',
        texto: err?.message || 'Falha ao salvar o plano no Firestore.',
      });
    } finally {
      setSalvando(false);
    }
  };

  // Excluir Plano (com verificação de inscritos)
  const lidarComExcluir = async () => {
    if (!planoParaExcluir) return;

    setExcluindo(true);
    try {
      const resultado = await excluirPlanoAgo(db, planoParaExcluir.id);
      addAuditLog(
        'EXCLUSAO_PLANO_AGO',
        `Plano AGO '${planoParaExcluir.nome}' (${planoParaExcluir.id}) excluído por ${operadorAtual}`,
        'TENANT_SEDE_GERAL'
      );
      setFeedback({ tipo: 'sucesso', texto: resultado.mensagem });
      setPlanoParaExcluir(null);
    } catch (err: any) {
      console.error('Erro ao excluir plano:', err);
      setFeedback({ tipo: 'erro', texto: err?.message || 'Não foi possível excluir o plano.' });
      setPlanoParaExcluir(null);
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* HEADER DO MÓDULO (Inspiração Stripe/Vercel) */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-indigo-500/30 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shrink-0 shadow-[0_0_25px_rgba(99,102,241,0.3)]">
            <Layers className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold tracking-widest text-indigo-400 bg-indigo-950/80 border border-indigo-500/30 px-2.5 py-0.5 rounded uppercase">
                PAINEL ADMINISTRATIVO • AGO 2026
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-0.5 rounded inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> FIRESTORE REAL-TIME ON SNAPSHOT
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight">
              Gestão Dinâmica dos Planos da AGO
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mt-1">
              Cadastre, edite e configure as permissões de cargos, valores e benefícios dos 4 planos oficiais. Todas as alterações refletem instantaneamente no portal de inscrição.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSincronizarSeed}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-mono font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-yellow-300" />
            <span>Restaurar 4 Planos Padrão AGO</span>
          </button>
          <button
            type="button"
            onClick={abrirNovoPlano}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-mono font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Novo Plano</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-mono flex items-center gap-2.5 ${
            feedback.tipo === 'sucesso'
              ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
              : feedback.tipo === 'erro'
              ? 'bg-rose-950/90 border-rose-500/60 text-rose-200'
              : 'bg-indigo-950/90 border-indigo-500/60 text-indigo-200'
          }`}
        >
          {feedback.tipo === 'sucesso' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          {feedback.tipo === 'erro' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
          {feedback.tipo === 'info' && <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin shrink-0" />}
          <span className="leading-relaxed">{feedback.texto}</span>
        </div>
      )}

      {/* CARDS DINÂMICOS & TABELA MODERNA DOS PLANOS */}
      <div className="space-y-6">
        {carregando && planos.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse space-y-4"
              >
                <div className="h-6 bg-slate-800 rounded-lg w-1/3" />
                <div className="h-10 bg-slate-800 rounded-lg w-2/3" />
                <div className="h-20 bg-slate-800 rounded-lg w-full" />
              </div>
            ))}
          </div>
        ) : planos.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-3xl space-y-3">
            <Layers className="w-12 h-12 mx-auto text-indigo-400 opacity-50" />
            <h3 className="text-base font-bold text-white">Nenhum plano cadastrado no banco</h3>
            <p className="text-xs text-slate-400">
              Clique em "Cadastrar Novo Plano" ou "Sincronizar Seed" para carregar a estrutura dos 4 Planos Oficiais da AGO.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {planos.map((p) => {
              const isDestaque = Boolean(p.destaque);

              return (
                <div
                  key={p.id}
                  className={`p-6 sm:p-7 rounded-3xl bg-slate-900/90 border transition-all duration-300 relative flex flex-col justify-between shadow-xl ${
                    isDestaque
                      ? 'border-indigo-500/70 shadow-[0_0_30px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/40'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Badge de Destaque / Ordenação */}
                  {isDestaque && (
                    <div className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-indigo-500 text-slate-950 text-[10px] font-mono font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5" />
                      <span>{p.badgeDestaque || 'Destaque Oficial'}</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* 1. PRIMEIRO O VALOR EM DESTAQUE NO TOPO DO CARD */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/90 border border-emerald-500/30 flex items-center justify-between gap-4 shadow-inner">
                      <div>
                        <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-widest block">
                          VALOR
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans block">Taxa Oficial AGO 2026</span>
                      </div>
                      <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight shrink-0">
                        {formatarMoeda(p.valor)}
                      </div>
                    </div>

                    {/* 2. ABAIXO AS INFORMAÇÕES */}
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-950/80 px-2.5 py-0.5 rounded border border-indigo-500/30">
                          {p.codigo || p.id}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                            p.ativo
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-950 text-slate-400 border-slate-800'
                          }`}
                        >
                          {p.ativo ? '● ATIVO' : '○ INATIVO'}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-lg font-black text-white leading-snug">
                          {p.nome}
                        </h3>
                        {p.subtitulo && (
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed font-sans">{p.subtitulo}</p>
                        )}
                      </div>
                    </div>

                    {/* Cargos Permitidos */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-bold flex items-center gap-1">
                        <Users className="w-3 h-3 text-indigo-400" />
                        Cargos Permitidos ({p.cargosPermitidos?.length || 0}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {p.cargosPermitidos && p.cargosPermitidos.length > 0 ? (
                          p.cargosPermitidos.map((c) => (
                            <span
                              key={c}
                              className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-[10px] font-mono font-medium"
                            >
                              {c}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">Todos os cargos</span>
                        )}
                      </div>
                    </div>

                    {/* Benefícios Inclusos */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-bold flex items-center gap-1">
                        <Award className="w-3 h-3 text-amber-400" />
                        Benefícios Inclusos ({p.beneficios?.length || 0}):
                      </span>
                      <div className="space-y-1 text-xs">
                        {p.beneficios?.map((b, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-slate-300">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="leading-tight">{b}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Ações Administrativas */}
                  <div className="pt-5 mt-5 border-t border-slate-800 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-mono text-slate-500">
                      Ordem de Exibição: #{p.ordem ?? 1}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => abrirEditarPlano(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono font-bold transition-all cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPlanoParaExcluir(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-xs font-mono font-bold transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Deletar</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DE CADASTRO / EDIÇÃO */}
      {modalAberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden">
          <div className="w-full max-w-2xl max-h-[92dvh] bg-slate-900 border border-indigo-500/40 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
            {/* Cabeçalho Fixo do Modal */}
            <div className="shrink-0 flex items-center justify-between border-b border-slate-800 px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-900/95 z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase block">
                    {planoEmEdicao ? 'EDIÇÃO DE PLANO' : 'NOVO PLANO AGO'}
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-white truncate max-w-[200px] sm:max-w-md">
                    {planoEmEdicao ? `Editar ${planoEmEdicao.nome}` : 'Cadastrar Novo Plano da AGO'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corpo com Scroll Suave */}
            <form id="formPlanoAgo" onSubmit={lidarComSalvar} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs font-mono overscroll-contain">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">CÓDIGO IDENTIFICADOR *</label>
                  <input
                    type="text"
                    required
                    value={formCodigo}
                    onChange={(e) => setFormCodigo(e.target.value.toUpperCase())}
                    placeholder="Ex: PLANO_1"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-bold">VALOR OFICIAL (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formValor}
                    onChange={(e) => setFormValor(e.target.value)}
                    placeholder="190.00"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-bold focus:border-indigo-500 focus:outline-none text-emerald-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">NOME OFICIAL DO PLANO *</label>
                <input
                  type="text"
                  required
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder="Ex: PLANO 1: Inscrição Normal para Ministros"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-indigo-500 focus:outline-none font-sans text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">SUBTÍTULO / DESCRIÇÃO RESUMIDA</label>
                <input
                  type="text"
                  value={formSubtitulo}
                  onChange={(e) => setFormSubtitulo(e.target.value)}
                  placeholder="Ex: Plenárias + Kit Congressista + Direito a Voto"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-indigo-500 focus:outline-none font-sans"
                />
              </div>

              {/* Seletor de Cargos Permitidos */}
              <div className="space-y-2 pt-2">
                <label className="block text-slate-400 font-bold">
                  CARGOS ECLESIÁSTICOS PERMITIDOS * ({formCargos.length} selecionados)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-950 rounded-2xl border border-slate-800 max-h-36 sm:max-h-40 overflow-y-auto">
                  {TODOS_CARGOS_DISPONIVEIS.map((cargo) => {
                    const selecionado = formCargos.includes(cargo);
                    return (
                      <button
                        type="button"
                        key={cargo}
                        onClick={() => toggleCargo(cargo)}
                        className={`p-2 rounded-xl text-[11px] font-mono text-left flex items-center justify-between transition-all cursor-pointer ${
                          selecionado
                            ? 'bg-indigo-950 border border-indigo-500 text-indigo-200 font-bold'
                            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="truncate">{cargo}</span>
                        {selecionado && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lista de Benefícios Dinâmica */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-400 font-bold">
                    BENEFÍCIOS INCLUSOS NO PLANO *
                  </label>
                  <button
                    type="button"
                    onClick={adicionarBeneficio}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer py-1 px-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Benefício
                  </button>
                </div>

                <div className="space-y-2 max-h-40 sm:max-h-48 overflow-y-auto pr-1">
                  {formBeneficios.map((ben, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        value={ben}
                        onChange={(e) => alterarBeneficio(idx, e.target.value)}
                        placeholder={`Benefício ${idx + 1}`}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-sans text-xs focus:border-indigo-500 focus:outline-none"
                      />
                      {formBeneficios.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removerBeneficio(idx)}
                          className="p-2.5 rounded-xl bg-slate-950 hover:bg-rose-950 text-slate-500 hover:text-rose-400 border border-slate-800 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Opções Extras: Destaque & Ativo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-800">
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="chkDestaque"
                    checked={formDestaque}
                    onChange={(e) => setFormDestaque(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="chkDestaque" className="text-white font-bold cursor-pointer">
                    Destacar Plano
                  </label>
                </div>

                {formDestaque && (
                  <div>
                    <label className="block text-slate-400 mb-1">TEXTO DO BADGE</label>
                    <input
                      type="text"
                      value={formBadge}
                      onChange={(e) => setFormBadge(e.target.value)}
                      placeholder="Ex: Recebimento / Ordenação"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-white text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-slate-400 mb-1">ORDEM</label>
                  <input
                    type="number"
                    value={formOrdem}
                    onChange={(e) => setFormOrdem(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-white text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </form>

            {/* Rodapé Fixo de Ações com Safe-Area */}
            <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-800 bg-slate-950/95 backdrop-blur-md flex items-center justify-end gap-3 z-10 pb-[env(safe-area-inset-bottom,12px)]">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold cursor-pointer transition-colors text-xs"
              >
                Cancelar
              </button>

              <button
                type="submit"
                form="formPlanoAgo"
                disabled={salvando}
                className="px-5 sm:px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 cursor-pointer disabled:opacity-50 flex items-center gap-2 transition-all text-xs"
              >
                {salvando && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{salvando ? 'Salvando no Firestore...' : 'Salvar Plano'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO COM VALIDAÇÃO DE SEGURANÇA */}
      {planoParaExcluir && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden">
          <div className="w-full max-w-md max-h-[90dvh] bg-slate-900 border border-rose-500/40 rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-7 space-y-5 font-mono text-xs flex flex-col animate-fadeIn">
            <div className="flex items-center gap-3 text-rose-400 shrink-0">
              <div className="p-2.5 rounded-2xl bg-rose-950/80 border border-rose-500/40">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-rose-400 font-bold uppercase block">CONFIRMAÇÃO CRÍTICA</span>
                <h4 className="text-base font-black text-white font-sans">Excluir Plano da AGO?</h4>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 overflow-y-auto">
              <p className="text-slate-300 font-sans">
                Você está prestes a excluir o plano <strong>{planoParaExcluir.nome}</strong> ({formatarMoeda(planoParaExcluir.valor)}).
              </p>
              <p className="text-[11px] text-slate-400 font-sans">
                O sistema verificará no Firestore se há inscrições homologadas associadas a este plano. Caso existam registros históricos, a deleção será <strong>bloqueada</strong> por compliance contábil.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setPlanoParaExcluir(null)}
                className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold cursor-pointer text-xs"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={lidarComExcluir}
                disabled={excluindo}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer flex items-center gap-2 text-xs"
              >
                {excluindo && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{excluindo ? 'Verificando...' : 'Confirmar Exclusão'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
