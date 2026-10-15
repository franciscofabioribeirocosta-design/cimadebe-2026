/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * [ETAPA 3 DE 5] - Interface Premium de Busca, Triagem e Exibição de Planos da AGO
 * Estilo Stripe/Nubank, SRP, com suporte a máscara de CPF, KillSwitch e Progressão por Cargo
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  buscarMinistroPorCPF,
  verificarInscricaoAtiva,
} from '../services/agoFirebaseService';
import {
  buscarPlanosAgo,
  filtrarPlanosParaMembroExistente,
  PlanoAgo,
} from '../services/planosAgoService';
import { db } from '../firebase';
import { validarElegibilidadeCargo } from '../services/planosAgoService';
import { Etapa4NovoCadastroAgo } from './Etapa4NovoCadastroAgo';
import { CrachaCredencialAgoModal } from '../components/CrachaCredencialAgoModal';
import { DossieMinisterialModal } from '../components/DossieMinisterialModal';
import { useSecurity } from '../SecurityContext';
import { extrairEventoAgo } from '../db/databaseService';
import type { Ministro } from '../types';
import { FormStepper, StepItem } from '../components/FormStepper';

const STEPS_AGO_TRIAGEM: StepItem[] = [
  { id: 'BUSCA_CPF', label: '1. Busca CPF', sublabel: 'Consulta de Obreiro' },
  { id: 'SELECAO_PLANO', label: '2. Plano & Modalidade', sublabel: 'Elegibilidade de Cargo' },
  { id: 'PAGAMENTO', label: '3. Efetivação AGO', sublabel: 'Pagamento & Credencial' },
];
import {
  Search,
  ShieldCheck,
  AlertCircle,
  UserCheck,
  CheckCircle2,
  Crown,
  ChevronRight,
  Download,
  QrCode,
  Shield,
  Award,
  RefreshCw,
} from 'lucide-react';

// Função utilitária para aplicar máscara de CPF em tempo real (000.000.000-00)
function aplicarMascaraCPF(valor: string): string {
  const apenasNumeros = valor.replace(/\D/g, '').slice(0, 11);
  if (apenasNumeros.length <= 3) return apenasNumeros;
  if (apenasNumeros.length <= 6) {
    return `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3)}`;
  }
  if (apenasNumeros.length <= 9) {
    return `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3, 6)}.${apenasNumeros.slice(6)}`;
  }
  return `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3, 6)}.${apenasNumeros.slice(6, 9)}-${apenasNumeros.slice(9)}`;
}

function formatarMoeda(val: number): string {
  return (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface Etapa3Props {
  readonly cicloAGO?: string;
  readonly onProsseguirPagamento?: (ministro: Ministro, planoSelecionado: PlanoAgo, modalidade?: string) => void;
}

export function Etapa3BuscaTriagemAgo({ cicloAGO = '2026', onProsseguirPagamento }: Etapa3Props) {
  const { ministros, anuidades, inscricoesAGO, eventos } = useSecurity();
  const eventoAgo = extrairEventoAgo(eventos, cicloAGO);
  const [cpfInput, setCpfInput] = useState<string>('');
  const [carregando, setCarregando] = useState<boolean>(false);
  const [erroMensagem, setErroMensagem] = useState<string | null>(null);
  const [ministroLocalizado, setMinistroLocalizado] = useState<Ministro | null>(null);
  const [inscricaoAtiva, setInscricaoAtiva] = useState<any | null>(null);
  const [todosPlanosDoBanco, setTodosPlanosDoBanco] = useState<PlanoAgo[]>([]);
  const [planosDisponiveis, setPlanosDisponiveis] = useState<PlanoAgo[]>([]);
  const [planoSelecionadoId, setPlanoSelecionadoId] = useState<string>('');
  const [modalidadeOrdenacao, setModalidadeOrdenacao] = useState<boolean>(false);
  const [mostrarNovoCadastro, setMostrarNovoCadastro] = useState<boolean>(false);

  const [tipoConsagracao, setTipoConsagracao] = useState<'ORDENADO' | 'RECEBIMENTO'>('ORDENADO');
  const [dossieEticaAnexo, setDossieEticaAnexo] = useState<string>('');
  const [modalCracha, setModalCracha] = useState<boolean>(false);
  const [modalDossie, setModalDossie] = useState<boolean>(false);

  const executarBuscaCPF = async (cpfParaBuscar: string) => {
    const limpo = cpfParaBuscar.replace(/\D/g, '');
    if (!limpo || limpo.length < 11) {
      setErroMensagem('Por favor, informe um CPF válido com 11 dígitos.');
      return;
    }

    setCarregando(true);
    setErroMensagem(null);
    setMinistroLocalizado(null);
    setInscricaoAtiva(null);
    setPlanosDisponiveis([]);
    setMostrarNovoCadastro(false);

    try {
      // 1. Busca Ministro no Firestore/Memória e valida KillSwitch de Compliance / Status Ativo
      const ministro = await buscarMinistroPorCPF(cpfParaBuscar, ministros);
      if (!ministro) {
        setMostrarNovoCadastro(true);
        setCarregando(false);
        return;
      }

      setMinistroLocalizado(ministro);

      // 2. Verifica se já possui inscrição ativa para o ciclo AGO
      const inscricao = await verificarInscricaoAtiva(ministro.id, cicloAGO, undefined, inscricoesAGO);
      setInscricaoAtiva(inscricao);

      if (!inscricao) {
        // 3. Busca os planos diretamente do Firestore sem mocks
        const planosDoBanco = await buscarPlanosAgo(db);
        setTodosPlanosDoBanco(planosDoBanco);
        const calculados = filtrarPlanosParaMembroExistente(planosDoBanco, ministro.cargo || '');
        setPlanosDisponiveis(calculados);
        if (calculados.length > 0) {
          setPlanoSelecionadoId(calculados[0].id);
        }
      }
    } catch (err: any) {
      console.error('Erro na triagem AGO:', err);
      setErroMensagem(err?.message || 'Falha ao buscar e validar o ministro.');
    } finally {
      setCarregando(false);
    }
  };

  const lidarComMudancaCPF = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatado = aplicarMascaraCPF(e.target.value);
    setCpfInput(formatado);
    setErroMensagem(null);

    // Auto-busca instantânea ao completar 11 dígitos numéricos
    const digitos = formatado.replace(/\D/g, '');
    if (digitos.length === 11) {
      executarBuscaCPF(formatado);
    } else if (digitos.length === 0) {
      setMinistroLocalizado(null);
      setInscricaoAtiva(null);
      setPlanosDisponiveis([]);
      setMostrarNovoCadastro(false);
    }
  };

  const lidarComBusca = async (e: React.FormEvent) => {
    e.preventDefault();
    await executarBuscaCPF(cpfInput);
  };

  if (mostrarNovoCadastro) {
    return (
      <div className="space-y-6">
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-mono flex items-center justify-between max-w-4xl mx-auto">
          <span>CPF não localizado na base de ministros ativos. Novos ministros acessam exclusivamente o <strong>Plano 3</strong> (Recebido ou Ordenado):</span>
          <button
            type="button"
            onClick={() => setMostrarNovoCadastro(false)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold cursor-pointer"
          >
            Voltar à Busca
          </button>
        </div>
        <Etapa4NovoCadastroAgo
          cpfInicial={cpfInput}
          onCadastroConcluido={(dados: any, plano: any) => {
            if (onProsseguirPagamento) {
              onProsseguirPagamento(
                {
                  id: dados.id,
                  nome: dados.nome,
                  cpf: dados.cpf,
                  cargo: dados.cargo,
                  email: dados.email,
                  telefone: dados.telefone,
                  fotoUrl: dados.fotoUrl || '',
                } as any,
                plano,
                dados.modalidadeDesejada
              );
            }
          }}
        />
      </div>
    );
  }

  const lidarComProsseguir = () => {
    if (!ministroLocalizado) return;

    if (ministroLocalizado.statusAdimplencia === 'INADIMPLENTE') {
      setErroMensagem(`Inscrição VETADA por Inadimplência: O ministro ${ministroLocalizado.nome} possui taxa de filiação/anuidade vencida. Regularize sua situação junto à Tesouraria para liberar a inscrição na AGO.`);
      return;
    }

    if (!planoSelecionadoId) {
      setErroMensagem('Atenção: Por favor, selecione um dos planos elegíveis disponíveis antes de avançar para o pagamento.');
      return;
    }

    const plano = (todosPlanosDoBanco.length > 0 ? todosPlanosDoBanco : planosDisponiveis).find((p) => p.id === planoSelecionadoId);
    if (!plano) {
      setErroMensagem('Atenção: Selecione um plano válido para continuar.');
      return;
    }

    const validacao = validarElegibilidadeCargo(plano as any, ministroLocalizado.cargo);
    if (!validacao.elegivel) {
      setErroMensagem(`Atenção: O plano ${plano.nome} não é compatível com o seu cargo (${ministroLocalizado.cargo}). Por favor, selecione um plano elegível.`);
      return;
    }

    if (onProsseguirPagamento) {
      onProsseguirPagamento(
        {
          ...ministroLocalizado,
          fotoUrl: ministroLocalizado.fotoUrl || '',
          ehMembroExistente: true,
        } as any,
        plano,
        tipoConsagracao || (modalidadeOrdenacao ? 'ORDENACAO' : 'INSCRICAO')
      );
    }
  };

  const currentStepId = !ministroLocalizado
    ? 'BUSCA_CPF'
    : inscricaoAtiva
    ? 'PAGAMENTO'
    : 'SELECAO_PLANO';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 p-4 sm:p-6 pb-32 font-sans text-white">
      {/* Stepper de Progresso da Inscrição AGO */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-emerald-500/30 shadow-2xl backdrop-blur-xl">
        <FormStepper steps={STEPS_AGO_TRIAGEM} currentStepId={currentStepId} />
      </div>

      {/* 1. ESTADO INICIAL (FORMULÁRIO DE ENTRADA STRIPE/NUBANK DARK) */}
      <div className="p-8 sm:p-10 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6 text-center backdrop-blur-xl">
        <div className="max-w-md mx-auto space-y-2">
          <span className="text-[10px] font-mono font-bold tracking-widest text-indigo-400 bg-indigo-950/80 border border-indigo-500/30 px-3 py-1 rounded-full uppercase">
            {(eventoAgo?.titulo || 'AGO 2026').toUpperCase()} • CREDENCIAMENTO DIGITAL
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Consulta de Elegibilidade Pastoral
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Informe seu CPF para verificar adimplência, status de filiação e acessar os planos de inscrição disponíveis.
          </p>
        </div>

        <form onSubmit={lidarComBusca} className="max-w-md mx-auto flex flex-col sm:flex-row gap-3 pt-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={cpfInput}
              onChange={lidarComMudancaCPF}
              placeholder="000.000.000-00"
              maxLength={14}
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-11 pr-4 py-3.5 text-white font-mono text-sm focus:border-indigo-500 focus:bg-slate-900 focus:outline-none transition-all shadow-inner"
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all duration-300 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {carregando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Buscar Obreiro</span>}
          </button>
        </form>
      </div>

      {/* 2. ERROS E KILLSWITCH DE COMPLIANCE */}
      <AnimatePresence>
        {erroMensagem && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-5 rounded-2xl bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs font-mono flex items-start gap-3 shadow-xl max-w-2xl mx-auto"
          >
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-black uppercase tracking-wider block text-rose-300">Atenção • Bloqueio de Compliance</span>
              <p className="leading-relaxed font-sans text-xs">{erroMensagem}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. ESTADO DE CARREGAMENTO (SKELETON LOADER PULSANTE) */}
      {carregando && (
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl max-w-3xl mx-auto animate-pulse space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-800" />
            <div className="space-y-2 flex-1">
              <div className="h-5 bg-slate-800 rounded w-1/3" />
              <div className="h-4 bg-slate-800 rounded w-1/2" />
            </div>
          </div>
          <div className="h-32 bg-slate-950 rounded-2xl w-full" />
        </div>
      )}

      {/* 3. ESTADO PERFIL DE MINISTRO ATIVO LOCALIZADO */}
      {!carregando && ministroLocalizado && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6 max-w-3xl mx-auto"
        >
          {/* Card de Identificação do Ministro com Foto Real do Banco de Dados */}
          <div className="p-6 sm:p-7 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {ministroLocalizado.fotoUrl ? (
                <img
                  src={ministroLocalizado.fotoUrl}
                  alt={ministroLocalizado.nome}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500/50 shadow-md shrink-0 bg-slate-950"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-black text-xl flex items-center justify-center shadow-md shrink-0">
                  {ministroLocalizado.nome?.charAt(0) || 'M'}
                </div>
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-950/80 border border-indigo-500/30 px-2.5 py-0.5 rounded uppercase">
                    {ministroLocalizado.cargo}
                  </span>
                  {ministroLocalizado.statusAdimplencia === 'INADIMPLENTE' ? (
                    <span className="text-[10px] font-mono text-rose-400 bg-rose-950/90 border border-rose-500/50 px-2.5 py-0.5 rounded font-bold">
                      ● INADIMPLENTE (DÉBITO PENDENTE)
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-0.5 rounded font-bold">
                      ● ATIVO & ADIMPLENTE
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-black text-white leading-tight">
                  {ministroLocalizado.nome}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Registro: {ministroLocalizado.id} • CPF: {ministroLocalizado.cpf}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setModalDossie(true)}
              className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
              title="Abrir Dossiê Ministerial Consolidado"
            >
              <Shield className="w-4 h-4" />
              <span>Ver Dossiê Ministerial</span>
            </button>
          </div>

          {/* Tomada de Decisão Visual (SRP): Inscrição Ativa vs. Nova Inscrição / Planos */}
          {inscricaoAtiva ? (
            <div className="p-8 rounded-3xl bg-slate-900 text-white shadow-2xl space-y-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="max-w-md mx-auto space-y-2">
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">
                  CREDENCIAMENTO CONFIRMADO • AGO {cicloAGO}
                </span>
                <h3 className="text-xl font-black">Você já possui uma inscrição ativa!</h3>
                <p className="text-xs text-slate-300">
                  Sua adesão ao {inscricaoAtiva.planoNome || 'Plano Oficial'} foi validada com sucesso pelo Core Banking.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalCracha(true)}
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-mono font-black text-xs uppercase tracking-wider shadow-xl transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Visualizar / Baixar Passaporte & Credencial AGO</span>
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {ministroLocalizado.statusAdimplencia === 'INADIMPLENTE' && (
                <div className="p-5 rounded-2xl bg-rose-950/90 border-2 border-rose-500 text-rose-200 text-xs font-mono space-y-2 shadow-xl">
                  <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    <span>INSCRIÇÃO VETADA • MINISTRO EM INADIMPLÊNCIA</span>
                  </div>
                  <p className="text-slate-300 font-sans text-xs leading-relaxed">
                    Identificamos taxa de filiação/anuidade com vencimento expirado no registro do ministro <strong>{ministroLocalizado.nome}</strong>. Por determinação estatutária da Mesa Diretora, a inscrição da AGO permanece bloqueada até a liquidação da pendência financeira na Tesouraria.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between px-1 border-b border-slate-800 pb-3">
                <h3 className="text-base font-black text-white font-sans">
                  Planos Oficiais • Obreiro ({ministroLocalizado.cargo})
                </h3>
                <span className="text-xs font-mono text-emerald-400 font-bold">● Elegibilidade Verificada</span>
              </div>

              {/* Grid de Cards dos Planos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(todosPlanosDoBanco.length > 0 ? todosPlanosDoBanco : planosDisponiveis).map((plano: PlanoAgo) => {
                  const validacao = validarElegibilidadeCargo(plano as any, ministroLocalizado.cargo);
                  const elegivel = validacao.elegivel;
                  const selecionado = planoSelecionadoId === plano.id;

                  if (!elegivel) {
                    return (
                      <div
                        key={plano.id}
                        className="p-6 rounded-3xl bg-slate-950/40 border border-slate-800/50 opacity-20 grayscale cursor-not-allowed pointer-events-none select-none relative space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded-full uppercase">
                            {plano.codigo} • BLOQUEADO
                          </span>
                          <span className="text-xl font-mono font-bold text-slate-600">
                            {formatarMoeda(plano.valor)}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-slate-500 line-through leading-snug">
                            {plano.nome}
                          </h4>
                          <span className="text-[10px] text-slate-600 font-sans block mt-1 leading-tight">
                            Permitido apenas para: {plano.cargosPermitidos.join(', ')}
                          </span>
                        </div>

                        <div className="pt-3 border-t border-slate-800/50 flex items-center justify-between text-[10px] font-mono text-slate-600">
                          <span>🔒 Plano Incompatível (Sem acesso)</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={plano.id}
                      onClick={() => setPlanoSelecionadoId(plano.id)}
                      className={`p-6 sm:p-7 rounded-3xl transition-all duration-300 relative flex flex-col justify-between backdrop-blur-xl ${
                        selecionado
                          ? 'bg-gradient-to-b from-emerald-950/90 via-slate-900 to-slate-900 border-2 border-emerald-500 shadow-[0_0_35px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400/50 cursor-pointer'
                          : 'bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 cursor-pointer'
                      }`}
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950 border border-emerald-500/40 px-3 py-1 rounded-full uppercase">
                            {plano.codigo} • PLANO ELEGÍVEL
                          </span>
                          {selecionado && (
                            <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-900/80 border border-emerald-400/60 px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              SELECIONADO
                            </span>
                          )}
                        </div>

                        {/* Destaque do Valor em Grande Escala */}
                        <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/30 flex items-center justify-between gap-4">
                          <div>
                            <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-widest block">
                              VALOR DA TAXA
                            </span>
                            <span className="text-[10px] text-slate-400 font-sans block">Investimento para AGO 2026</span>
                          </div>
                          <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight shrink-0">
                            {formatarMoeda(plano.valor)}
                          </div>
                        </div>

                        {/* Título do Plano & Descrições em Letras Miúdas */}
                        <div className="space-y-1 pt-1">
                          <h4 className="text-base font-black text-white leading-snug">
                            {plano.nome}
                          </h4>
                          <span className="text-[11px] text-slate-300 font-sans leading-relaxed block">
                            Inscrição homologada e direito a plenárias na Assembleia Geral Ordinária.
                          </span>
                          <span className="text-[10px] text-slate-400 font-sans leading-tight block pt-1 border-t border-slate-800/80">
                            <strong className="text-slate-300">Cargos permitidos:</strong> {plano.cargosPermitidos.join(', ')}
                          </span>
                        </div>
                      </div>

                      <div className="pt-5 mt-5 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          {selecionado ? '✓ Plano Esverdeado Ativo' : 'Clique para selecionar este plano'}
                        </span>
                        <div
                          className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                            selecionado ? 'bg-emerald-500 border-emerald-500 text-slate-950 font-bold text-xs' : 'border-slate-700 text-transparent'
                          }`}
                        >
                          ✓
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* SEÇÃO DE MODALIDADE COM CARDS BRILHANTES PARA OS DOIS ÚLTIMOS PLANOS (PLANO 3 E PLANO 4) */}
              {(planoSelecionadoId === 'PLANO_3' ||
                planoSelecionadoId === 'PLANO_4' ||
                ministroLocalizado.cargo === 'Presbítero' ||
                ministroLocalizado.cargo === 'Evangelista' ||
                ministroLocalizado.cargo?.includes('Missionária')) && (
                <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.15)] space-y-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest block">
                      SELEÇÃO DE MODALIDADE MINISTERIAL
                    </span>
                    <h4 className="text-base font-black text-white">Escolha sua Modalidade de Consagração</h4>
                    <p className="text-xs text-slate-400">Selecione o tipo de ingresso no presbitério/pastorado para envio ao Conselho de Ética:</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Card ORDENADO (Ativado por padrão) */}
                    <div
                      onClick={() => setTipoConsagracao('ORDENADO')}
                      className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${
                        tipoConsagracao === 'ORDENADO'
                          ? 'bg-emerald-950/90 border-2 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${
                        tipoConsagracao === 'ORDENADO' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-slate-900 text-slate-400'
                      }`}>
                        <Crown className="w-6 h-6" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-sm font-black text-white block">ORDENADO</span>
                        <span className="text-[11px] text-slate-300 font-sans block leading-tight">
                          Consagração Solene a Pastor no Culto de Ordenação da AGO.
                        </span>
                      </div>
                    </div>

                    {/* Card RECEBIDO */}
                    <div
                      onClick={() => setTipoConsagracao('RECEBIMENTO')}
                      className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${
                        tipoConsagracao === 'RECEBIMENTO'
                          ? 'bg-indigo-950/90 border-2 border-indigo-400 shadow-[0_0_25px_rgba(99,102,241,0.3)] ring-1 ring-indigo-400'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${
                        tipoConsagracao === 'RECEBIMENTO' ? 'bg-indigo-500 text-white shadow-md' : 'bg-slate-900 text-slate-400'
                      }`}>
                        <Award className="w-6 h-6" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-sm font-black text-white block">RECEBIDO</span>
                        <span className="text-[11px] text-slate-300 font-sans block leading-tight">
                          Reconhecimento de ministério vindo de outra convenção fidedigna.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ANEXO PARA CONSELHO DE ÉTICA E DOUTRINA */}
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
                    <div className="flex items-center gap-2 text-indigo-400">
                      <Shield className="w-4 h-4 shrink-0" />
                      <span className="font-bold text-white uppercase">Anexo de Documentação para o Conselho de Ética *</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                      Anexe a ata de recomendação da igreja local ou cartas de anuência para homologação da comissão de ética.
                    </p>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setDossieEticaAnexo(e.target.files[0].name);
                        }
                      }}
                      className="hidden"
                      id="upload-dossie-etica"
                    />
                    <label
                      htmlFor="upload-dossie-etica"
                      className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer text-xs transition-all shadow-md"
                    >
                      {dossieEticaAnexo ? `✓ Dossiê Anexado: ${dossieEticaAnexo}` : 'Anexar Dossiê para Conselho de Ética (PDF/Imagem)'}
                    </label>
                  </div>
                </div>
              )}

              {/* Botão de Ação Final */}
              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={lidarComProsseguir}
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-mono font-black text-xs uppercase tracking-wider shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all duration-300 cursor-pointer flex items-center gap-2.5"
                >
                  <span>Prosseguir para Pagamento da Inscrição</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Modal da Credencial/Passaporte VIP */}
      {modalCracha && (inscricaoAtiva || ministroLocalizado) && (
        <CrachaCredencialAgoModal
          evento={eventoAgo}
          inscricao={{
            id: inscricaoAtiva?.id || `CRED-${ministroLocalizado?.id}`,
            ministroNome: ministroLocalizado?.nome || 'Ministro',
            ministroCpf: ministroLocalizado?.cpf || '000.000.000-00',
            cargo: ministroLocalizado?.cargo || 'Obreiro',
            planoNome: inscricaoAtiva?.planoNome || 'Plano Oficial AGO 2026',
            valor: inscricaoAtiva?.valor || 190.0,
            fotoUrl: (ministroLocalizado as any)?.fotoUrl,
            dataInscricao: inscricaoAtiva?.dataInscricao || new Date().toISOString().split('T')[0],
          }}
          onClose={() => setModalCracha(false)}
        />
      )}

      {/* Modal do Dossiê Ministerial Consolidado */}
      {modalDossie && ministroLocalizado && (
        <DossieMinisterialModal
          ministro={ministroLocalizado}
          anuidades={anuidades}
          inscricoesAgo={inscricoesAGO}
          onClose={() => setModalDossie(false)}
        />
      )}
    </div>
  );
}
