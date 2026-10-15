import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Download,
  RotateCcw,
  CheckCircle2,
  Clock,
  Lock,
  Search,
  Database,
  Save,
  X,
  Eye,
  Sparkles,
  AlertCircle,
  Tag,
  FileCheck
} from 'lucide-react';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import {
  DocumentoAcervo,
  MODELOS_DOCUMENTOS_PADRAO,
  emitirDocumentoPdfCriptografado,
  seedModelosDocumentosIniciais
} from '../services/dossieDocumentosService';
import { useSecurity } from '../SecurityContext';
import { useNotification } from '../NotificationContext';
import { DocumentoTimbrado3D } from '../components/DocumentoTimbrado3D';
import confetti from 'canvas-confetti';

export const AdminModelosDocumentos: React.FC = () => {
  const { ministros, appConfig, operadorAtual } = useSecurity();
  const { notifySuccess, notifyError, notifyWarning } = useNotification();

  const [modelos, setModelos] = useState<DocumentoAcervo[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [busca, setBusca] = useState<string>('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODOS');
  
  // Estado do Modal de Criação / Edição
  const [modalAberto, setModalAberto] = useState<boolean>(false);
  const [modeloEmEdicao, setModeloEmEdicao] = useState<Partial<DocumentoAcervo> | null>(null);
  const [salvando, setSalvando] = useState<boolean>(false);

  // Estado de Prévia / Teste de Emissão
  const [modalPreviaAberto, setModalPreviaAberto] = useState<boolean>(false);
  const [modeloPrevia, setModeloPrevia] = useState<DocumentoAcervo | null>(null);
  const [ministroTesteId, setMinistroTesteId] = useState<string>(ministros[0]?.id || '');
  const [testandoEmissao, setTestandoEmissao] = useState<boolean>(false);
  const [mostrarPrevia3D, setMostrarPrevia3D] = useState<boolean>(false);

  // Sincronização em tempo real com o Firestore (coleção 'modelos_documentos')
  useEffect(() => {
    setCarregando(true);
    const unsubscribe = onSnapshot(
      collection(db, 'modelos_documentos'),
      (snap) => {
        if (!snap.empty) {
          const lista = snap.docs.map((d) => ({ ...d.data(), id: d.id } as DocumentoAcervo));
          lista.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
          setModelos(lista);
        } else {
          // Se vazio, auto-semeia os modelos oficiais no Firestore
          seedModelosDocumentosIniciais().then(() => {
            setModelos([...MODELOS_DOCUMENTOS_PADRAO]);
          });
        }
        setCarregando(false);
      },
      (err) => {
        console.warn('[AdminModelosDocumentos] Erro onSnapshot Firestore:', err);
        setModelos([...MODELOS_DOCUMENTOS_PADRAO]);
        setCarregando(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Filtro de modelos
  const modelosFiltrados = useMemo(() => {
    return modelos.filter((m) => {
      const matchCat =
        filtroCategoria === 'TODOS' ||
        m.categoria === filtroCategoria ||
        (filtroCategoria === 'INSTITUCIONAL' && m.categoria === 'LEGAL');

      const b = (busca || '').toLowerCase().trim();
      const matchBusca =
        !b ||
        (m.titulo || '').toLowerCase().includes(b) ||
        (m.subtitulo || '').toLowerCase().includes(b) ||
        (m.descricao || '').toLowerCase().includes(b);

      return matchCat && matchBusca;
    });
  }, [modelos, filtroCategoria, busca]);

  const abrirCriacao = () => {
    setModeloEmEdicao({
      id: `doc-${Date.now().toString(36)}`,
      tipo: 'NOVO_DOCUMENTO',
      titulo: '',
      subtitulo: '',
      categoria: 'INDIVIDUAL',
      icone: '📄',
      prazoValidadeDias: 30,
      exigeAdimplencia: true,
      ordem: modelos.length + 1,
      descricao: '',
      conteudoModelo: `A Mesa Diretora da {{CONVENCAO}} (CNPJ: {{CNPJ}}), no uso de suas atribuições estatutárias, CERTIFICA que o Ministro {{NOME_MINISTRO}}, portador do CPF nº {{CPF}} e Registro Ministerial {{REGISTRO}}, na função canônica de {{CARGO}} atuante em {{IGREJA}}, encontra-se plenamente ativo e regular perante esta Convenção Geral.`
    });
    setModalAberto(true);
  };

  const abrirEdicao = (m: DocumentoAcervo) => {
    setModeloEmEdicao({ ...m });
    setModalAberto(true);
  };

  const inserirTagNoModelo = (tag: string) => {
    if (!modeloEmEdicao) return;
    const atual = modeloEmEdicao.conteudoModelo || '';
    setModeloEmEdicao({
      ...modeloEmEdicao,
      conteudoModelo: `${atual} ${tag}`
    });
  };

  const salvarModelo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modeloEmEdicao || !modeloEmEdicao.titulo || !modeloEmEdicao.id) {
      notifyError('Campos Obrigatórios', 'Preencha o título e o identificador do documento.');
      return;
    }

    setSalvando(true);
    try {
      const docId = modeloEmEdicao.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const payload: DocumentoAcervo = {
        id: docId,
        tipo: modeloEmEdicao.tipo || 'DOCUMENTO_OFICIAL',
        titulo: modeloEmEdicao.titulo.trim(),
        subtitulo: modeloEmEdicao.subtitulo?.trim() || 'Documento Oficial Convencional',
        categoria: (modeloEmEdicao.categoria as any) || 'INDIVIDUAL',
        icone: modeloEmEdicao.icone?.trim() || '📄',
        prazoValidadeDias: Number(modeloEmEdicao.prazoValidadeDias) || undefined,
        exigeAdimplencia: modeloEmEdicao.exigeAdimplencia !== false,
        ordem: Number(modeloEmEdicao.ordem) || 99,
        descricao: modeloEmEdicao.descricao?.trim() || 'Documento oficial do banco de dados.',
        conteudoModelo: modeloEmEdicao.conteudoModelo?.trim() || '',
        atualizado_em: new Date().toISOString()
      };

      await setDoc(doc(db, 'modelos_documentos', docId), payload);

      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      notifySuccess('Modelo Salvo no Firestore', `O documento "${payload.titulo}" foi gravado com sucesso no banco de dados.`);
      setModalAberto(false);
      setModeloEmEdicao(null);
    } catch (err: any) {
      notifyError('Erro ao Salvar no Banco', err?.message || 'Falha ao persistir no Firestore.');
    } finally {
      setSalvando(false);
    }
  };

  const excluirModelo = async (id: string, titulo: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o modelo "${titulo}" do banco de dados?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'modelos_documentos', id));
      notifySuccess('Modelo Removido', `O modelo foi excluído do Firestore.`);
    } catch (err: any) {
      notifyError('Erro ao Excluir', err?.message || 'Falha na exclusão do Firestore.');
    }
  };

  const restaurarPadroes = async () => {
    if (!window.confirm('Deseja restaurar e sincronizar todos os 7 modelos canônicos padrão no Firestore?')) {
      return;
    }

    try {
      await seedModelosDocumentosIniciais();
      confetti({ particleCount: 60, spread: 70 });
      notifySuccess('Modelos Restaurados', 'Todos os modelos canônicos foram sincronizados no Firestore.');
    } catch (err: any) {
      notifyError('Falha ao Restaurar', err?.message || 'Erro no seed do Firestore.');
    }
  };

  const testarEmissaoPdf = async (m: DocumentoAcervo) => {
    const ministroAlvo = ministros.find((min) => min.id === ministroTesteId) || ministros[0];
    if (!ministroAlvo) {
      notifyError('Nenhum Ministro Encontrado', 'Cadastre ao menos um ministro para testar a emissão.');
      return;
    }

    setTestandoEmissao(true);
    try {
      await emitirDocumentoPdfCriptografado(m, ministroAlvo, appConfig);
      confetti({ particleCount: 50, spread: 60 });
      notifySuccess('PDF Emitido com Sucesso!', `O documento foi gerado com as informações de ${ministroAlvo.nome}.`);
    } catch (err: any) {
      notifyError('Erro ao Gerar PDF', err?.message || 'Falha na renderização do PDF.');
    } finally {
      setTestandoEmissao(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Executivo */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-teal-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-widest bg-teal-500/10 border border-teal-500/40 text-teal-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" /> GESTÃO DE ACERVO DOCUMENTAL
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-widest bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                COLEÇÃO: modelos_documentos
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Cadastro e Edição de Modelos de Documentos
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Gerencie os modelos canônicos de cartas de recomendação, certidões, portarias e atas armazenadas no banco de dados. Configure prazos de validade, textos com tags dinâmicas e regras de adimplência.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={restaurarPadroes}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer"
              title="Restaurar os modelos canônicos no banco"
            >
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>Restaurar Padrões</span>
            </button>

            <button
              type="button"
              onClick={abrirCriacao}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_20px_rgba(20,184,166,0.35)] transition-all cursor-pointer hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Modelo de Documento</span>
            </button>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="mt-6 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'TODOS', label: 'Todos os Modelos' },
              { id: 'INDIVIDUAL', label: 'Cartas & Certidões' },
              { id: 'PASTORAL', label: 'Portarias & Atos' },
              { id: 'INSTITUCIONAL', label: 'Institucionais & Legais' }
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFiltroCategoria(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                  filtroCategoria === cat.id
                    ? 'bg-teal-500 text-slate-950 font-black shadow-[0_0_15px_rgba(20,184,166,0.3)]'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar modelos cadastrados..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500/50 font-mono transition-colors"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid de Modelos Cadastrados no Banco */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {modelosFiltrados.map((item) => (
          <div
            key={item.id}
            className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-teal-500/40 transition-all shadow-xl flex flex-col justify-between space-y-4 group"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{item.icone}</span>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-400 bg-teal-950 px-2.5 py-0.5 rounded-full border border-teal-500/30 block w-max">
                      {item.categoria}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {item.prazoValidadeDias ? (
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2.5 py-0.5 rounded-full border border-cyan-500/30 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Validade: {item.prazoValidadeDias} dias
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                      Permanente
                    </span>
                  )}

                  {item.exigeAdimplencia ? (
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-950 px-2 py-0.5 rounded-full border border-amber-500/30">
                      Exige Em Dia
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
                      Livre
                    </span>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-lg font-bold text-white group-hover:text-teal-300 transition-colors">
                  {item.titulo}
                </h4>
                <p className="text-xs font-mono text-slate-400">{item.subtitulo}</p>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                {item.descricao}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[10px] font-mono text-slate-500">
                ID Firestore: <strong>{item.id}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModeloPrevia(item);
                    setModalPreviaAberto(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Ver prévia do texto e testar PDF"
                >
                  <Eye className="w-3.5 h-3.5 text-teal-400" />
                  <span>Prévia & Teste</span>
                </button>

                <button
                  type="button"
                  onClick={() => abrirEdicao(item)}
                  className="px-3 py-1.5 rounded-xl bg-teal-500/10 hover:bg-teal-500 text-teal-300 hover:text-slate-950 border border-teal-500/30 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Editar modelo no Firestore"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>

                <button
                  type="button"
                  onClick={() => excluirModelo(item.id, item.titulo)}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-mono flex items-center gap-1 transition-all cursor-pointer"
                  title="Excluir modelo do banco"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: CRIAÇÃO & EDIÇÃO DE MODELO NO FIRESTORE */}
      {modalAberto && modeloEmEdicao && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-xl animate-fadeIn overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget && !salvando) setModalAberto(false);
          }}
        >
          <div className="bg-slate-900 border-2 border-teal-500/40 rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl space-y-6 relative overflow-hidden max-h-[92vh] flex flex-col my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-mono font-bold text-teal-400 uppercase tracking-widest flex items-center gap-2">
                <Database className="w-4 h-4" />
                {modeloEmEdicao.id ? `EDITAR MODELO NO FIRESTORE` : 'CRIAR NOVO MODELO DE DOCUMENTO'}
              </span>

              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Fechar</span>
              </button>
            </div>

            <form onSubmit={salvarModelo} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-mono text-slate-400 uppercase block font-bold">
                    Título Oficial do Documento *
                  </label>
                  <input
                    type="text"
                    required
                    value={modeloEmEdicao.titulo || ''}
                    onChange={(e) => setModeloEmEdicao({ ...modeloEmEdicao, titulo: e.target.value })}
                    placeholder="Ex: Carta Oficial de Recomendação & Transferência"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-slate-400 uppercase block font-bold">
                    ID no Firestore (Slug) *
                  </label>
                  <input
                    type="text"
                    required
                    value={modeloEmEdicao.id || ''}
                    onChange={(e) => setModeloEmEdicao({ ...modeloEmEdicao, id: e.target.value })}
                    placeholder="ex: carta-recomendacao"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-teal-300 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-mono text-slate-400 uppercase block font-bold">
                    Subtítulo Explicativo
                  </label>
                  <input
                    type="text"
                    value={modeloEmEdicao.subtitulo || ''}
                    onChange={(e) => setModeloEmEdicao({ ...modeloEmEdicao, subtitulo: e.target.value })}
                    placeholder="Ex: Apresentação Eclesiástica para Convenções e Igrejas"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-slate-400 uppercase block font-bold">
                    Categoria
                  </label>
                  <select
                    value={modeloEmEdicao.categoria || 'INDIVIDUAL'}
                    onChange={(e) => setModeloEmEdicao({ ...modeloEmEdicao, categoria: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                  >
                    <option value="INDIVIDUAL">INDIVIDUAL (Carta / Pessoal)</option>
                    <option value="PASTORAL">PASTORAL (Portaria / Investidura)</option>
                    <option value="INSTITUCIONAL">INSTITUCIONAL (Certificado / Diploma)</option>
                    <option value="LEGAL">LEGAL (Estatuto / Cartório)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-slate-400 uppercase block font-bold">
                    Ícone Emoji
                  </label>
                  <input
                    type="text"
                    value={modeloEmEdicao.icone || '📄'}
                    onChange={(e) => setModeloEmEdicao({ ...modeloEmEdicao, icone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-center text-base text-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-slate-400 uppercase block font-bold">
                    Validade (Dias)
                  </label>
                  <input
                    type="number"
                    value={modeloEmEdicao.prazoValidadeDias || ''}
                    onChange={(e) => setModeloEmEdicao({ ...modeloEmEdicao, prazoValidadeDias: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Vazio = Permanente"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-slate-400 uppercase block font-bold">
                    Ordem Exibição
                  </label>
                  <input
                    type="number"
                    value={modeloEmEdicao.ordem || 1}
                    onChange={(e) => setModeloEmEdicao({ ...modeloEmEdicao, ordem: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 font-mono"
                  />
                </div>

                <div className="space-y-1 flex flex-col justify-center pt-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-slate-300">
                    <input
                      type="checkbox"
                      checked={modeloEmEdicao.exigeAdimplencia !== false}
                      onChange={(e) => setModeloEmEdicao({ ...modeloEmEdicao, exigeAdimplencia: e.target.checked })}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span>Exige "Em Dia"</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono text-slate-400 uppercase block font-bold">
                  Descrição Curta para o Ministro
                </label>
                <input
                  type="text"
                  value={modeloEmEdicao.descricao || ''}
                  onChange={(e) => setModeloEmEdicao({ ...modeloEmEdicao, descricao: e.target.value })}
                  placeholder="Explicação do propósito do documento exibida no card do portal..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Editor de Texto do Modelo com Inserção de Tags */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-[11px] font-mono text-teal-400 uppercase block font-bold">
                    Texto Canônico do Documento (Corpo do PDF)
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    Clique nas tags para inserir dados dinâmicos:
                  </span>
                </div>

                {/* Botões de Inserção de Tags */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { tag: '{{NOME_MINISTRO}}', label: 'Nome' },
                    { tag: '{{CARGO}}', label: 'Cargo' },
                    { tag: '{{CPF}}', label: 'CPF' },
                    { tag: '{{REGISTRO}}', label: 'RM' },
                    { tag: '{{IGREJA}}', label: 'Igreja' },
                    { tag: '{{DATA_CONSAGRACAO}}', label: 'Consagração' },
                    { tag: '{{VALIDADE}}', label: 'Data Validade' },
                    { tag: '{{CONVENCAO}}', label: 'Nome Convenção' },
                    { tag: '{{CNPJ}}', label: 'CNPJ' }
                  ].map((t) => (
                    <button
                      key={t.tag}
                      type="button"
                      onClick={() => inserirTagNoModelo(t.tag)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-teal-900/60 hover:text-teal-300 text-slate-300 border border-slate-700 text-[10px] font-mono transition-colors cursor-pointer"
                    >
                      + {t.label}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={6}
                  required
                  value={modeloEmEdicao.conteudoModelo || ''}
                  onChange={(e) => setModeloEmEdicao({ ...modeloEmEdicao, conteudoModelo: e.target.value })}
                  placeholder="Digite o texto canônico oficial..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500 font-mono leading-relaxed resize-y"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  disabled={salvando}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvando}
                  className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs font-mono uppercase tracking-wider flex items-center gap-2 shadow-lg cursor-pointer"
                >
                  {salvando ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Gravando no Firestore...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Salvar no Banco de Dados</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRÉVIA DO MODELO & TESTE DE EMISSÃO DE PDF */}
      {modalPreviaAberto && modeloPrevia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-xl animate-fadeIn overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget && !testandoEmissao) setModalPreviaAberto(false);
          }}
        >
          <div className="bg-slate-900 border-2 border-teal-500/40 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-5 relative overflow-hidden max-h-[92vh] flex flex-col my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-mono font-bold text-teal-400 uppercase tracking-widest flex items-center gap-2">
                <Eye className="w-4 h-4" /> PRÉVIA & TESTE DE EMISSÃO DE PDF
              </span>
              <button
                type="button"
                onClick={() => setModalPreviaAberto(false)}
                className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Fechar</span>
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              <div>
                <h4 className="text-lg font-black text-white">{modeloPrevia.titulo}</h4>
                <p className="text-xs font-mono text-slate-400">{modeloPrevia.subtitulo}</p>
              </div>

              {/* Seletor de Ministro para Teste */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-[10px] font-mono text-teal-400 uppercase font-bold block">
                  Selecione um Ministro para Preencher as Variáveis no Teste:
                </label>
                <select
                  value={ministroTesteId}
                  onChange={(e) => setMinistroTesteId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                >
                  {ministros.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} — {m.cargo} ({m.registroMinisterial || 'Sem RM'}) • {m.statusAdimplencia}
                    </option>
                  ))}
                </select>
              </div>

              {/* Texto do Modelo */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-line">
                {modeloPrevia.conteudoModelo}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setModalPreviaAberto(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono cursor-pointer"
              >
                Voltar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMostrarPrevia3D(true)}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs font-mono uppercase tracking-wider flex items-center gap-2 shadow transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Visualizar em Papel 3D</span>
                </button>

                <button
                  type="button"
                  onClick={() => testarEmissaoPdf(modeloPrevia)}
                  disabled={testandoEmissao}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black text-xs font-mono uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  {testandoEmissao ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Gerando PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Baixar PDF de Teste</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3D TIMBRADO DO ADMINISTRATIVO */}
      {mostrarPrevia3D && modeloPrevia && (
        <DocumentoTimbrado3D
          modelo={modeloPrevia}
          ministro={
            ministros.find((m) => m.id === ministroTesteId) ||
            ministros[0] || {
              id: 'min-teste',
              nome: 'Pastor Titular Teste',
              cargo: 'Pastor Presidente',
              cpf: '000.000.000-00',
              registroMinisterial: 'RM-039.279-26',
              statusAdimplencia: 'EM_DIA',
              status: 'ATIVO',
              tenantId: 't-sede-salvador'
            }
          }
          appConfig={appConfig}
          onFechar={() => setMostrarPrevia3D(false)}
        />
      )}
    </div>
  );
};
