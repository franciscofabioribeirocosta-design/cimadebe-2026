import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Crown,
  Users,
  Shield,
  Plus,
  Search,
  Edit3,
  Trash2,
  Phone,
  Mail,
  Building2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Award,
  Sparkles,
  FileText,
  UserCheck,
  ChevronRight,
  Eye,
  Camera,
  Upload,
  Layers,
  Star,
  Compass,
} from 'lucide-react';
import { useSecurity } from '../SecurityContext';
import { PaginacaoGeral } from '../components/PaginacaoGeral';
import {
  CARGOS_MESA_DIRETORA_ESTATUTARIA,
  obterOrdemHierarquicaMesa,
  gerarRegistroMinisterial,
} from '../types';
import type { MembroMesaDiretora, Ministro } from '../types';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function AdminMesaDiretora() {
  const {
    membrosMesaDiretora,
    ministros,
    atribuirMembroMesa,
    removerMembroMesa,
    atualizarMembroMesa,
    appConfig,
    atualizarAppConfig,
  } = useSecurity();

  // Estados de busca e filtros
  const [busca, setBusca] = useState('');
  const [filtroCargo, setFiltroCargo] = useState('TODOS');
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Paginação (15 / 30 / 50 / TODOS)
  const [itensPorPagina, setItensPorPagina] = useState<number | 'TODOS'>(15);
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Modais
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);
  const [membroEmEdicao, setMembroEmEdicao] = useState<MembroMesaDiretora | null>(null);
  const [membroSelecionado, setMembroSelecionado] = useState<MembroMesaDiretora | null>(null);

  // Mandato Vigente Dinâmico
  const mandatoVigente = useMemo(() => {
    return (
      appConfig?.mandatoMesaDiretora ||
      (membrosMesaDiretora.length > 0 ? membrosMesaDiretora[0].mandato : '2024 - 2028')
    );
  }, [appConfig?.mandatoMesaDiretora, membrosMesaDiretora]);

  const [modalEditarMandatoAberto, setModalEditarMandatoAberto] = useState(false);
  const [modoEdicaoInlineMandato, setModoEdicaoInlineMandato] = useState(false);
  const [mandatoGeralInput, setMandatoGeralInput] = useState('2024 - 2028');
  const [salvandoMandatoGeral, setSalvandoMandatoGeral] = useState(false);

  // Estados para edição detalhada do membro
  const [nomeEdit, setNomeEdit] = useState('');
  const [igrejaEdit, setIgrejaEdit] = useState('');

  // Estados para inclusão direta (quando ministro não está na lista prévia)
  const [modoInclusao, setModoInclusao] = useState<'selecionar' | 'direto'>('selecionar');
  const [nomeNovoDireto, setNomeNovoDireto] = useState('');
  const [cpfNovoDireto, setCpfNovoDireto] = useState('');
  const [igrejaNovaDireto, setIgrejaNovaDireto] = useState('');

  // Formulário de Criação (Puxa do Ministro)
  const [ministroSelecionadoId, setMinistroSelecionadoId] = useState('');
  const [cargoMesa, setCargoMesa] = useState<string>('');
  const [mandato, setMandato] = useState('2024 - 2028');
  const [biografia, setBiografia] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');

  // Sincroniza mandato padrão com o mandato vigente
  useEffect(() => {
    if (mandatoVigente) {
      setMandato(mandatoVigente);
      setMandatoGeralInput(mandatoVigente);
    }
  }, [mandatoVigente]);

  // Se não houver ministros no quadro, comuta automaticamente para o modo de cadastro direto
  useEffect(() => {
    if (ministros.length === 0) {
      setModoInclusao('direto');
    }
  }, [ministros.length]);

  // Salvar Mandato Geral com persistência quádrupla resiliente (Context + Firestore + Biro Server + Membros)
  const salvarMandatoDireto = async (valor: string) => {
    if (!valor.trim() || salvandoMandatoGeral) return;
    setSalvandoMandatoGeral(true);
    try {
      const novoMandato = valor.trim();
      await atualizarAppConfig({ mandatoMesaDiretora: novoMandato });

      try {
        await fetch('/api/biro/salvar-configuracao-convencao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mandatoMesaDiretora: novoMandato })
        });
      } catch {
        // fallback silencioso
      }

      // Gravação direta no Firestore com updateDoc estrito (Prevenção de Documentos Fantasma)
      try {
        await updateDoc(doc(db, 'configuracoes_sistema', 'geral'), { mandatoMesaDiretora: novoMandato });
        await updateDoc(doc(db, 'configuracoes', 'convencao'), { mandatoMesaDiretora: novoMandato });
      } catch (errDb) {
        console.warn('[Direct Firestore Config Save]', errDb);
      }

      // Atualiza o mandato em todos os membros atuais da Mesa Diretora
      for (const m of membrosMesaDiretora) {
        atualizarMembroMesa(m.id, { mandato: novoMandato });
        try {
          await updateDoc(doc(db, 'membros_mesa_diretora', m.id), { mandato: novoMandato });
        } catch {
          // fallback
        }
      }

      setModoEdicaoInlineMandato(false);
      setModalEditarMandatoAberto(false);
      setFeedback({
        tipo: 'sucesso',
        texto: `Mandato Geral da Mesa Diretora atualizado para [${novoMandato}] com sucesso!`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro ao atualizar o mandato da Mesa Diretora.' });
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setSalvandoMandatoGeral(false);
    }
  };

  const lidarComSalvarMandatoGeral = async (e: React.FormEvent) => {
    e.preventDefault();
    await salvarMandatoDireto(mandatoGeralInput);
  };

  // Upload input ref
  const uploadFotoNovoRef = useRef<HTMLInputElement | null>(null);
  const uploadFotoEditRef = useRef<HTMLInputElement | null>(null);

  // Quando seleciona um ministro no select, preenche automaticamente os dados
  const lidarComSelecaoMinistro = (minId: string) => {
    setMinistroSelecionadoId(minId);
    const min = ministros.find((m) => m.id === minId);
    if (min) {
      const primeiroNome = min.nome
        .replace(/^(Pr\.|Ev\.|Pb\.|Mis\.)\s*/i, '')
        .toLowerCase()
        .split(' ')[0];
      setEmail(min.email || `${primeiroNome}.diretoria@cimadebe.org.br`);
      setTelefone(min.telefone || '(71) 98877-6655');
      setFotoUrl(min.fotoUrl || '');
      setBiografia(
        `Ministro ${min.cargo} empossado na Mesa Diretora Estatutária da CIMADEBE. Portador do Registro Ministerial ${
          min.registroMinisterial || gerarRegistroMinisterial(min.cpf)
        }, vinculado à congregação ${min.igrejaFiliadaNome || 'AD Central Salvador'}.`
      );
    }
  };

  // Processamento de Upload de Foto
  const lidarComUploadFoto = (
    e: React.ChangeEvent<HTMLInputElement>,
    tipo: 'novo' | 'edit'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({
        tipo: 'erro',
        texto: 'Por favor, selecione um arquivo de imagem válido (JPG, PNG ou WEBP).',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFeedback({
        tipo: 'erro',
        texto: 'A imagem deve ter no máximo 5MB.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        if (tipo === 'novo') {
          setFotoUrl(base64);
        } else if (membroEmEdicao) {
          setFotoUrl(base64);
        }
        setFeedback({
          tipo: 'sucesso',
          texto: 'Foto carregada com sucesso!',
        });
        setTimeout(() => setFeedback(null), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  // Submeter novo membro com suporte a seleção ou cadastro direto
  const lidarComSalvarMembro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cargoMesa) {
      setFeedback({ tipo: 'erro', texto: 'Selecione um cargo estatutário da Mesa Diretora.' });
      return;
    }

    let minNome = '';
    let minCpf = '';
    let minIgreja = '';
    let minFoto = fotoUrl;
    let minId = '';

    if (modoInclusao === 'selecionar') {
      const min = ministros.find((m) => m.id === ministroSelecionadoId);
      if (!min) {
        setFeedback({ tipo: 'erro', texto: 'Selecione um ministro filiado ou use a opção "Cadastrar Ministro Diretamente".' });
        return;
      }
      minId = min.id;
      minNome = min.nome;
      minCpf = min.cpf;
      minIgreja = min.igrejaFiliadaNome || 'AD Central Filiada';
      if (!minFoto) minFoto = min.fotoUrl;
    } else {
      if (!nomeNovoDireto.trim()) {
        setFeedback({ tipo: 'erro', texto: 'Informe o nome do ministro a ser empossado.' });
        return;
      }
      minNome = nomeNovoDireto.trim();
      minCpf = cpfNovoDireto.trim() || '000.000.000-00';
      minIgreja = igrejaNovaDireto.trim() || 'Igreja Filiada Oficial';
      minId = `dir-${Date.now()}`;
    }

    try {
      const ordemAuto = obterOrdemHierarquicaMesa(cargoMesa);
      const mandatoFinal = mandato.trim() || mandatoVigente;

      atribuirMembroMesa({
        ministroId: minId,
        nome: minNome,
        cpf: minCpf,
        cargoMesa,
        ordemExibicao: ordemAuto,
        mandato: mandatoFinal,
        fotoUrl:
          minFoto ||
          'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&h=300&q=80',
        igrejaFiliada: minIgreja,
        biografia,
        email,
        telefone,
      });

      // Se for Presidente Geral, sincroniza imediatamente com a Presidência Oficial da Convenção
      if (cargoMesa.toLowerCase().includes('presidente') && !cargoMesa.toLowerCase().includes('vice') && !cargoMesa.toLowerCase().includes('conselho') && !cargoMesa.toLowerCase().includes('ética') && !cargoMesa.toLowerCase().includes('etica')) {
        atualizarAppConfig({
          presidenteNome: minNome,
          presidenteMesa: minNome,
        });
      }

      setModalNovoAberto(false);
      setMinistroSelecionadoId('');
      setNomeNovoDireto('');
      setCpfNovoDireto('');
      setIgrejaNovaDireto('');
      setFotoUrl('');
      setFeedback({
        tipo: 'sucesso',
        texto: `${minNome} empossado com sucesso no cargo [${cargoMesa}] • Mandato [${mandatoFinal}]!`,
      });
      setTimeout(() => setFeedback(null), 4500);
    } catch (err: any) {
      setFeedback({
        tipo: 'erro',
        texto: err?.message || 'Erro ao registrar membro na Mesa Diretora.',
      });
    }
  };

  // Abrir modal de edição com todos os campos liberados
  const abrirModalEditar = (membro: MembroMesaDiretora, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMembroEmEdicao(membro);
    setNomeEdit(membro.nome);
    setIgrejaEdit(membro.igrejaFiliada || '');
    setCargoMesa(membro.cargoMesa);
    setMandato(membro.mandato || mandatoVigente);
    setBiografia(membro.biografia || '');
    setEmail(membro.email || '');
    setTelefone(membro.telefone || '');
    setFotoUrl(membro.fotoUrl || '');
    setModalEditarAberto(true);
  };

  // Salvar edição com hierarquia recalculada automaticamente e persistência no Firestore
  const lidarComSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membroEmEdicao) return;

    try {
      const ordemAuto = obterOrdemHierarquicaMesa(cargoMesa);
      const mandatoFinal = mandato.trim() || mandatoVigente;
      const nomeFinal = nomeEdit.trim() || membroEmEdicao.nome;
      const igrejaFinal = igrejaEdit.trim() || membroEmEdicao.igrejaFiliada;

      const dadosAtualizados: Partial<MembroMesaDiretora> = {
        nome: nomeFinal,
        igrejaFiliada: igrejaFinal,
        cargoMesa,
        mandato: mandatoFinal,
        biografia,
        email,
        telefone,
        fotoUrl: fotoUrl || membroEmEdicao.fotoUrl,
        ordemExibicao: ordemAuto,
      };

      atualizarMembroMesa(membroEmEdicao.id, dadosAtualizados);

      try {
        await updateDoc(doc(db, 'membros_mesa_diretora', membroEmEdicao.id), dadosAtualizados);
      } catch {
        await setDoc(doc(db, 'membros_mesa_diretora', membroEmEdicao.id), {
          ...membroEmEdicao,
          ...dadosAtualizados,
        }, { merge: true });
      }

      // Se for Presidente Geral, sincroniza imediatamente com a Presidência Oficial da Convenção
      if (cargoMesa.toLowerCase().includes('presidente') && !cargoMesa.toLowerCase().includes('vice') && !cargoMesa.toLowerCase().includes('conselho') && !cargoMesa.toLowerCase().includes('ética') && !cargoMesa.toLowerCase().includes('etica')) {
        atualizarAppConfig({
          presidenteNome: nomeFinal,
          presidenteMesa: nomeFinal,
        });
      }

      setModalEditarAberto(false);
      setFeedback({
        tipo: 'sucesso',
        texto: `Membro ${nomeFinal} atualizado com sucesso! Cargo: [${cargoMesa}] • Mandato: [${mandatoFinal}].`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({
        tipo: 'erro',
        texto: err?.message || 'Erro ao atualizar membro da Mesa Diretora.',
      });
    }
  };

  // Remover membro
  const lidarComRemoverMembro = (membro: MembroMesaDiretora, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const confirmacao = confirm(`Confirma a revogação da posse de ${membro.nome} da Mesa Diretora?`);
    if (!confirmacao) return;

    const justificativa = prompt('Informe a justificativa/motivo para revogar a posse do membro da Mesa Diretora:');
    if (justificativa === null) return; // Operação cancelada
    if (!justificativa.trim()) {
      alert('Por favor, informe uma justificativa válida para realizar a exclusão.');
      return;
    }

    removerMembroMesa(membro.id, justificativa.trim());
    setFeedback({
      tipo: 'sucesso',
      texto: `${membro.nome} desvinculado da Mesa Diretora com sucesso. Justificativa registrada.`,
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Abrir Detalhes
  const abrirDetalhes = (membro: MembroMesaDiretora) => {
    setMembroSelecionado(membro);
    setModalDetalhesAberto(true);
  };

  // Membros ordenados estritamente pela hierarquia estatutária
  const membrosOrdenados = useMemo(() => {
    return [...membrosMesaDiretora]
      .sort((a, b) => {
        const ordemA = obterOrdemHierarquicaMesa(a.cargoMesa);
        const ordemB = obterOrdemHierarquicaMesa(b.cargoMesa);
        return ordemA - ordemB;
      })
      .filter((m) => {
        if (!m) return false;
        const b = (busca || '').toLowerCase().trim();
        const nomeNorm = (m.nome || '').toLowerCase();
        const cargoNorm = (m.cargoMesa || '').toLowerCase();
        const cpfNorm = String(m.cpf || '');
        const igrejaNorm = (m.igrejaFiliada || '').toLowerCase();

        const bateBusca =
          !b ||
          nomeNorm.includes(b) ||
          cargoNorm.includes(b) ||
          cpfNorm.includes(b) ||
          igrejaNorm.includes(b);

        const bateCargo = filtroCargo === 'TODOS' || m.cargoMesa === filtroCargo;

        return bateBusca && bateCargo;
      });
  }, [membrosMesaDiretora, busca, filtroCargo]);

  // Membros fatiados por paginação
  const membrosExibidos = useMemo(() => {
    if (itensPorPagina === 'TODOS') return membrosOrdenados;
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return membrosOrdenados.slice(inicio, inicio + itensPorPagina);
  }, [membrosOrdenados, paginaAtual, itensPorPagina]);

  // Obter detalhes do ministro vinculado
  const obterMinistro = (ministroId: string): Ministro | undefined => {
    return ministros.find((m) => m.id === ministroId);
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
          <div className="flex items-center gap-2">
            {feedback.tipo === 'sucesso' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
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

      {/* Header Institucional de Governança */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-950 border border-amber-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                CORPO DIRETIVO ESTATUTÁRIO
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30">
                HIERARQUIA AUTOMÁTICA
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Mesa Diretora da Convenção
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Gestão executiva e representação eclesiástica superior. A ordem e precedência são atribuídas automaticamente conforme os cargos estatutários da Convenção Estadual.
            </p>
          </div>

          <button
            onClick={() => {
              setMinistroSelecionadoId('');
              setCargoMesa('');
              setFotoUrl('');
              setModalNovoAberto(true);
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-[0_0_25px_rgba(245,158,11,0.3)] transition-all cursor-pointer hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4 text-slate-950" />
            <span>Empossar Membro na Mesa</span>
          </button>
        </div>

        {/* Resumo Rápido de Composição */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          {/* Card 1: Composição da Mesa (Ministros Empossados) */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-amber-500/40 transition-all flex items-center justify-between group shadow-md">
            <div>
              <span className="text-[10px] font-mono text-slate-400 block uppercase tracking-wider">Composição da Mesa</span>
              <span className="text-xl font-black font-mono text-white mt-0.5 block">
                {membrosMesaDiretora.length} {membrosMesaDiretora.length === 1 ? 'Ministro Empossado' : 'Ministros Empossados'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setMinistroSelecionadoId('');
                setCargoMesa('');
                setFotoUrl('');
                setModalNovoAberto(true);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
              title="Empossar ou Gerenciar Ministros na Mesa Diretora"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Empossar</span>
            </button>
          </div>

          {/* Card 2: Mandato Vigente (Com Edição Inline e Modal) */}
          <div
            className={`p-3.5 rounded-2xl bg-slate-950/70 border transition-all shadow-md ${
              modoEdicaoInlineMandato ? 'border-amber-500 bg-slate-900 ring-2 ring-amber-500/30' : 'border-slate-800/80 hover:border-amber-500/50'
            }`}
          >
            {modoEdicaoInlineMandato ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  salvarMandatoDireto(mandatoGeralInput);
                }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                    Editar Mandato Vigente
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setModoEdicaoInlineMandato(false);
                      setMandatoGeralInput(mandatoVigente);
                    }}
                    className="text-slate-400 hover:text-white text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    autoFocus
                    value={mandatoGeralInput}
                    onChange={(e) => setMandatoGeralInput(e.target.value)}
                    placeholder="Ex: 2024 - 2028 ou 2026 - 2030"
                    className="w-full bg-slate-950 border border-amber-500/60 rounded-xl px-2.5 py-1.5 text-white font-mono text-sm font-bold focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={salvandoMandatoGeral}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {salvandoMandatoGeral ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block uppercase tracking-wider">
                    Mandato Vigente
                  </span>
                  <span className="text-xl font-black font-mono text-amber-400 mt-0.5 block">
                    {mandatoVigente}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMandatoGeralInput(mandatoVigente);
                      setModoEdicaoInlineMandato(true);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    title="Editar Mandato Diretamente"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMandatoGeralInput(mandatoVigente);
                      setModalEditarMandatoAberto(true);
                    }}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all cursor-pointer"
                    title="Abrir Detalhes do Mandato em Modal"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Critério de Ordenação */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[10px] font-mono text-slate-400 block uppercase">Critério de Ordenação</span>
            <span className="text-xs font-bold font-mono text-cyan-400 mt-1 block">
              Estatutário Regimental
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca Rápida */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, cargo, CPF ou congregação..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-sans"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={filtroCargo}
            onChange={(e) => setFiltroCargo(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-mono w-full md:w-auto"
          >
            <option value="TODOS">Todos os Cargos Estatutários</option>
            {CARGOS_MESA_DIRETORA_ESTATUTARIA.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid de Cartões Inovadores da Mesa Diretora */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {membrosExibidos.map((membro) => {
          const rank = obterOrdemHierarquicaMesa(membro.cargoMesa);
          const isPresidente = rank === 1;
          const isVice = rank >= 2 && rank <= 4;
          const isSecretario = rank >= 5 && rank <= 7;
          const isTesoureiro = rank >= 8 && rank <= 10;
          const ministroVinculado = obterMinistro(membro.ministroId);
          const rm = ministroVinculado?.registroMinisterial || gerarRegistroMinisterial(membro.cpf);

          return (
            <div
              key={membro.id}
              onClick={() => abrirDetalhes(membro)}
              className={`rounded-3xl p-6 transition-all duration-500 relative overflow-hidden flex flex-col justify-between group cursor-pointer border backdrop-blur-2xl shadow-2xl transform-gpu hover:-translate-y-2 hover:scale-[1.02] ${
                isPresidente
                  ? 'bg-gradient-to-br from-amber-950/70 via-slate-900/95 to-slate-950 border-2 border-amber-400 shadow-[0_0_50px_rgba(245,158,11,0.35)] ring-2 ring-amber-500/30'
                  : isVice
                  ? 'bg-gradient-to-b from-indigo-950/30 via-slate-900/90 to-slate-950 border-indigo-500/40 hover:border-indigo-400'
                  : isSecretario
                  ? 'bg-gradient-to-b from-cyan-950/30 via-slate-900/90 to-slate-950 border-cyan-500/40 hover:border-cyan-400'
                  : isTesoureiro
                  ? 'bg-gradient-to-b from-emerald-950/30 via-slate-900/90 to-slate-950 border-emerald-500/40 hover:border-emerald-400'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Efeito luminoso superior 3D */}
              <div
                className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
                  isPresidente
                    ? 'bg-amber-500/30 animate-pulse'
                    : isVice
                    ? 'bg-indigo-500/20'
                    : isSecretario
                    ? 'bg-cyan-500/20'
                    : isTesoureiro
                    ? 'bg-emerald-500/20'
                    : 'bg-slate-500/10'
                }`}
              />

              <div className="space-y-4 relative z-10">
                {/* Header do Cartão: Hierarquia Estatutária */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold border tracking-wider ${
                      isPresidente
                        ? 'bg-amber-500/30 text-amber-200 border-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                        : isVice
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        : isSecretario
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : isTesoureiro
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {isPresidente && <Crown className="w-4 h-4 text-amber-300 animate-bounce" />}
                    {isVice && <Star className="w-3.5 h-3.5 text-indigo-400" />}
                    {isSecretario && <FileText className="w-3.5 h-3.5 text-cyan-400" />}
                    {isTesoureiro && <Award className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>{membro.cargoMesa}</span>
                  </span>

                  <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded-lg border border-slate-800">
                    Mandato: {membro.mandato}
                  </span>
                </div>

                {/* Foto e Identificação Principal */}
                <div className="flex items-center gap-4 pt-1">
                  <div className="relative shrink-0">
                    <img
                      src={
                        membro.fotoUrl ||
                        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&h=300&q=80'
                      }
                      alt={membro.nome}
                      className={`w-18 h-18 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 shadow-lg group-hover:scale-105 transition-transform ${
                        isPresidente
                          ? 'border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.5)] ring-2 ring-amber-400/50'
                          : 'border-slate-700 group-hover:border-slate-500'
                      }`}
                    />
                    <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center text-[10px] font-mono font-bold text-white shadow">
                      {rank}º
                    </span>
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                      {membro.nome}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                      <span className="text-amber-400 font-bold">{rm}</span>
                    </div>
                    <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{membro.igrejaFiliada}</span>
                    </p>
                  </div>
                </div>

                {/* Biografia / Resumo */}
                <p className="text-xs text-slate-300/90 line-clamp-2 leading-relaxed bg-slate-950/50 p-3 rounded-2xl border border-slate-800/60 font-sans">
                  {membro.biografia || 'Membro do corpo diretivo da Convenção Estadual CIMADEBE.'}
                </p>

                {/* Contatos */}
                <div className="space-y-1.5 text-xs font-mono text-slate-400 pt-1">
                  {membro.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate text-slate-300">{membro.email}</span>
                    </div>
                  )}
                  {membro.telefone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-slate-300">{membro.telefone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Botões de Ação do Cartão */}
              <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-slate-800/80 text-xs relative z-10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirDetalhes(membro);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white font-medium transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ver Detalhes</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => abrirModalEditar(membro, e)}
                    className="p-2 rounded-xl bg-slate-800/80 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-300 transition-colors cursor-pointer"
                    title="Editar Membro"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => lidarComRemoverMembro(membro, e)}
                    className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-600/30 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                    title="Revogar Posse"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Controle de Paginação (15 / 30 / 50 / TODOS) */}
      <PaginacaoGeral
        totalItems={membrosOrdenados.length}
        itensPorPagina={itensPorPagina}
        paginaAtual={paginaAtual}
        onMudancaPagina={setPaginaAtual}
        onMudancaItensPorPagina={setItensPorPagina}
      />

      {membrosOrdenados.length === 0 && (
        <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-4">
          <Users className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Nenhum membro da Mesa Diretora encontrado</h3>
          <p className="text-xs text-slate-400">
            Ajuste os filtros de busca ou cadastre um novo membro empossado.
          </p>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL RESPONSIVO: NOVO MEMBRO NA MESA DIRETORA           */}
      {/* ======================================================== */}
      {modalNovoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-5 shadow-2xl animate-fadeIn my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Crown className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-white text-base">Empossar Novo Membro da Mesa</h3>
                  <p className="text-[11px] text-slate-400">
                    A ordem hierárquica é atribuída automaticamente de acordo com o cargo estatutário selecionado.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalNovoAberto(false)}
                className="text-slate-400 hover:text-white text-xs font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={lidarComSalvarMembro} className="space-y-4 text-xs">
              {/* Seletor de Modo de Inclusão */}
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setModoInclusao('selecionar')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    modoInclusao === 'selecionar'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Selecionar do Quadro ({ministros.length})
                </button>
                <button
                  type="button"
                  onClick={() => setModoInclusao('direto')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    modoInclusao === 'direto'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cadastrar Direto na Mesa
                </button>
              </div>

              {/* 1. Modo Selecionar do Quadro */}
              {modoInclusao === 'selecionar' ? (
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Selecionar Ministro Filiado *
                  </label>
                  {ministros.length === 0 ? (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 space-y-2">
                      <p>Nenhum ministro cadastrado no momento no quadro geral.</p>
                      <button
                        type="button"
                        onClick={() => setModoInclusao('direto')}
                        className="text-xs text-amber-400 font-bold underline cursor-pointer"
                      >
                        Clique aqui para preencher os dados do ministro diretamente
                      </button>
                    </div>
                  ) : (
                    <select
                      required={modoInclusao === 'selecionar'}
                      value={ministroSelecionadoId}
                      onChange={(e) => lidarComSelecaoMinistro(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 font-sans"
                    >
                      <option value="">-- Selecione o ministro no quadro de filiados --</option>
                      {ministros.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome}
                        </option>
                      ))}
                    </select>
                  )}

                  {ministroSelecionadoId && (() => {
                    const mSel = ministros.find((m) => m.id === ministroSelecionadoId);
                    if (!mSel) return null;
                    return (
                      <div className="mt-2 p-2.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-950 border border-amber-500/40 overflow-hidden flex items-center justify-center shrink-0">
                          {mSel.fotoUrl ? (
                            <img src={mSel.fotoUrl} alt={mSel.nome} className="w-full h-full object-cover" />
                          ) : (
                            <UserCheck className="w-5 h-5 text-amber-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-white truncate">{mSel.nome}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {mSel.cargo} • CPF: {mSel.cpf}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* Modo Cadastrar Direto */
                <div className="space-y-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">
                      Nome Completo do Ministro *
                    </label>
                    <input
                      type="text"
                      required={modoInclusao === 'direto'}
                      value={nomeNovoDireto}
                      onChange={(e) => setNomeNovoDireto(e.target.value)}
                      placeholder="Ex: Pr. Carlos Eduardo da Silva"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-sans"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        CPF do Ministro *
                      </label>
                      <input
                        type="text"
                        value={cpfNovoDireto}
                        onChange={(e) => setCpfNovoDireto(e.target.value)}
                        placeholder="000.000.000-00"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        Igreja Filiada / Sede *
                      </label>
                      <input
                        type="text"
                        value={igrejaNovaDireto}
                        onChange={(e) => setIgrejaNovaDireto(e.target.value)}
                        placeholder="Ex: AD Central Salvador"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-sans text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Cargo Estatutário (Hierarquia Automática) */}
              <div className="space-y-1.5">
                <label className="block text-slate-300 font-bold">
                  Cargo Estatutário da Mesa Diretora *
                </label>
                <select
                  required
                  value={cargoMesa}
                  onChange={(e) => setCargoMesa(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 font-sans"
                >
                  <option value="">-- Selecione o Cargo Estatutário Oficial --</option>
                  {CARGOS_MESA_DIRETORA_ESTATUTARIA.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {cargoMesa ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] font-mono text-amber-300">
                    <Award className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Hierarquia Oficial:{' '}
                      <strong>{obterOrdemHierarquicaMesa(cargoMesa)}º na Ordem Estatutária</strong>
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] font-mono text-slate-500">
                    Selecione o cargo para calcular automaticamente a hierarquia e precedência regimental.
                  </p>
                )}
              </div>

              {/* 3. Upload de Foto Oficial */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <label className="block text-slate-300 font-bold">Foto Oficial do Membro</label>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img
                      src={
                        fotoUrl ||
                        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80'
                      }
                      alt="Preview Foto"
                      className="w-16 h-16 rounded-2xl object-cover border border-slate-700"
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="file"
                      ref={uploadFotoNovoRef}
                      onChange={(e) => lidarComUploadFoto(e, 'novo')}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => uploadFotoNovoRef.current?.click()}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>Upload de Foto (Arquivo)</span>
                    </button>
                    <p className="text-[10px] text-slate-500 font-mono">JPG, PNG ou WEBP até 5MB</p>
                  </div>
                </div>
              </div>

              {/* 4. Mandato */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">Período do Mandato:</label>
                <input
                  type="text"
                  required
                  value={mandato}
                  onChange={(e) => setMandato(e.target.value)}
                  placeholder="Ex: 2024 - 2028"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* 5. Contatos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Email Institucional:</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Telefone / WhatsApp:</label>
                  <input
                    type="text"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* 6. Biografia */}
              <div>
                <label className="block text-slate-400 mb-1">Trajetória Ministerial / Biografia:</label>
                <textarea
                  rows={3}
                  value={biografia}
                  onChange={(e) => setBiografia(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-sans text-xs"
                />
              </div>

              {/* Botões */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalNovoAberto(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modoInclusao === 'selecionar' ? !ministroSelecionadoId : !nomeNovoDireto.trim()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-black transition-all shadow-md cursor-pointer"
                >
                  Confirmar Posse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL RESPONSIVO: EDITAR MEMBRO DA MESA                  */}
      {/* ======================================================== */}
      {modalEditarAberto && membroEmEdicao && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-5 shadow-2xl animate-fadeIn my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-white text-base">Editar Ministro Empossado</h3>
                  <p className="text-[11px] text-slate-400">
                    Edite o nome, congregação, cargo estatutário e período do mandato vigente.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalEditarAberto(false)}
                className="text-slate-400 hover:text-white text-xs font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={lidarComSalvarEdicao} className="space-y-4 text-xs">
              {/* Edição de Nome e Igreja */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Nome do Ministro:</label>
                  <input
                    type="text"
                    required
                    value={nomeEdit}
                    onChange={(e) => setNomeEdit(e.target.value)}
                    placeholder="Nome completo do ministro"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Igreja Filiada:</label>
                  <input
                    type="text"
                    value={igrejaEdit}
                    onChange={(e) => setIgrejaEdit(e.target.value)}
                    placeholder="Congregação / Sede"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500 font-sans"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-300 font-bold">Cargo Estatutário:</label>
                <select
                  value={cargoMesa}
                  onChange={(e) => setCargoMesa(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 font-sans"
                >
                  {CARGOS_MESA_DIRETORA_ESTATUTARIA.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-[11px] font-mono text-indigo-300">
                  <Award className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>
                    Nova Hierarquia Oficial:{' '}
                    <strong>{obterOrdemHierarquicaMesa(cargoMesa)}º na Ordem Estatutária</strong>
                  </span>
                </div>
              </div>

              {/* Upload de Foto */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <label className="block text-slate-300 font-bold">Foto Oficial (Upload)</label>
                <div className="flex items-center gap-4">
                  <img
                    src={fotoUrl || membroEmEdicao.fotoUrl}
                    alt="Foto do Membro"
                    className="w-16 h-16 rounded-2xl object-cover border border-slate-700"
                  />
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="file"
                      ref={uploadFotoEditRef}
                      onChange={(e) => lidarComUploadFoto(e, 'edit')}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => uploadFotoEditRef.current?.click()}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Trocar Foto (Arquivo)</span>
                    </button>
                    <p className="text-[10px] text-slate-500 font-mono">JPG, PNG ou WEBP até 5MB</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Período do Mandato:</label>
                <input
                  type="text"
                  value={mandato}
                  onChange={(e) => setMandato(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Email:</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Telefone:</label>
                  <input
                    type="text"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Biografia:</label>
                <textarea
                  rows={3}
                  value={biografia}
                  onChange={(e) => setBiografia(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500 font-sans text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalEditarAberto(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer"
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
      {/* MODAL EDITAR MANDATO GERAL DA MESA DIRETORA               */}
      {/* ======================================================== */}
      {modalEditarMandatoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-fadeIn my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Editar Mandato Vigente</h3>
                  <span className="text-xs text-slate-400">Mesa Diretora da Convenção</span>
                </div>
              </div>
              <button
                onClick={() => setModalEditarMandatoAberto(false)}
                className="text-slate-400 hover:text-white text-xs font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={lidarComSalvarMandatoGeral} className="space-y-4 text-xs font-mono">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="block text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                  Período / Ano do Mandato Estatutário *
                </label>
                <input
                  type="text"
                  required
                  value={mandatoGeralInput}
                  onChange={(e) => setMandatoGeralInput(e.target.value)}
                  placeholder="Ex: 2024 - 2028, 2025 - 2029 ou Triênio 2024/2027"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl p-3 text-white text-sm font-bold font-mono focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 font-sans leading-relaxed pt-1">
                  Este mandato será aplicado globalmente aos relatórios, crachás oficiais, certificados, cabeçalhos de liderança e a todos os membros homologados da Mesa Diretora.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalEditarMandatoAberto(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoMandatoGeral}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-md cursor-pointer transition-all disabled:opacity-50"
                >
                  {salvandoMandatoGeral ? 'Salvando...' : 'Atualizar Mandato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL DETALHES COMPLETOS DO MEMBRO                       */}
      {/* ======================================================== */}
      {modalDetalhesAberto && membroSelecionado && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-6 shadow-2xl animate-fadeIn my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Perfil do Membro da Mesa Diretora</h3>
              </div>
              <button
                onClick={() => setModalDetalhesAberto(false)}
                className="text-slate-400 hover:text-white text-xs font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <img
                src={membroSelecionado.fotoUrl}
                alt={membroSelecionado.nome}
                className="w-24 h-24 rounded-2xl object-cover border-2 border-amber-500/50 shadow-lg"
              />
              <div className="space-y-1 text-center sm:text-left flex-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {membroSelecionado.cargoMesa}
                </span>
                <h2 className="text-lg font-black text-white">{membroSelecionado.nome}</h2>
                <p className="text-xs font-mono text-slate-400">
                  CPF: {membroSelecionado.cpf} • Registro Ministerial:{' '}
                  <strong className="text-cyan-400">
                    {obterMinistro(membroSelecionado.ministroId)?.registroMinisterial ||
                      gerarRegistroMinisterial(membroSelecionado.cpf)}
                  </strong>
                </p>
                <p className="text-xs text-slate-300 flex items-center justify-center sm:justify-start gap-1 pt-1">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  {membroSelecionado.igrejaFiliada}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 block uppercase">Hierarquia Estatutária</span>
                <span className="text-sm font-bold text-amber-400">
                  {obterOrdemHierarquicaMesa(membroSelecionado.cargoMesa)}º Lugar na Precedência Estatutária
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 block uppercase">Trajetória e Biografia</span>
                <p className="text-slate-300 font-sans text-xs leading-relaxed">
                  {membroSelecionado.biografia || 'Sem biografia registrada.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 block uppercase">Email Oficial</span>
                  <span className="text-slate-200 block truncate">{membroSelecionado.email || 'Não cadastrado'}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 block uppercase">Telefone</span>
                  <span className="text-slate-200 block">{membroSelecionado.telefone || 'Não cadastrado'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModalDetalhesAberto(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer text-xs"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalDetalhesAberto(false);
                  abrirModalEditar(membroSelecionado);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all text-xs cursor-pointer"
              >
                Editar Dados
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
