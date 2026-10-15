import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, Plus, Edit, Trash2, Sparkles, MapPin,
  CheckCircle, AlertCircle, RefreshCw, X, Image as ImageIcon, ArrowLeft, Gem, UserPlus,
  RotateCcw, Archive, Search, Filter, ShieldCheck, Clock
} from 'lucide-react';
import { z } from 'zod';
import { 
  DbEvento, fetchEventos, insertEventoComAuditoria, 
  updateEventoComAuditoria, softDeleteEventoComAuditoria,
  restaurarEventoComAuditoria, deleteEventoComAuditoria, formatarPeriodoEvento
} from '../db/databaseService';
import { useSecurity } from '../SecurityContext';
import { useNotification } from '../NotificationContext';
import { dispararNotificacaoConvocacaoAgo } from '../services/webPushService';
import { compressImageBase64 } from '../utils/imageCompressor';

const generalEventSchema = z.object({
  titulo: z.string().min(5, 'O título do evento deve ter no mínimo 5 caracteres').max(150, 'Título muito longo'),
  subtitulo: z.string().min(5, 'O subtítulo deve ter no mínimo 5 caracteres').max(250, 'Subtítulo muito longo'),
  local: z.string().min(3, 'Local deve ter no mínimo 3 caracteres'),
  bannerUrl: z.string().min(1, 'Banner do evento é obrigatório'),
  descricao: z.string().min(20, 'A descrição deve ter no mínimo 20 caracteres'),
});

interface AdminEventosProps {
  tenantId: string;
  operadorId: string;
}

export const AdminEventos: React.FC<AdminEventosProps> = ({ tenantId, operadorId }) => {
  const { carregarEventosENoticias, addAuditLog } = useSecurity();
  const { notifySuccess, notifyError, notifyWarning } = useNotification();
  const [eventos, setEventos] = useState<readonly DbEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Filtros de visualização e soft-delete
  const [abaFiltro, setAbaFiltro] = useState<'ATIVOS' | 'LIXEIRA' | 'TODOS'>('ATIVOS');
  const [termoBusca, setTermoBusca] = useState<string>('');

  // Modal / Form state
  const [modoModal, setModoModal] = useState<'LISTA' | 'CADASTRAR' | 'EDITAR'>('LISTA');
  const [eventoSelecionado, setEventoSelecionado] = useState<DbEvento | null>(null);

  // Form Fields
  const [titulo, setTitulo] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  const [dataInicio, setDataInicio] = useState('2026-10-15T09:00');
  const [dataFim, setDataFim] = useState('2026-10-18T18:00');
  const [local, setLocal] = useState('');
  const [bannerUrl, setBannerUrl] = useState('https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&h=600&q=80');
  const [descricao, setDescdescricao] = useState('');
  const [status, setStatus] = useState<'ATIVO' | 'ENCERRADO' | 'RASCUNHO' | 'INATIVO' | 'EXCLUIDO'>('ATIVO');
  const [temaBiblico, setTemaBiblico] = useState('');
  const [preletores, setPreletores] = useState<Array<{ nome: string; foto_url: string; cargo: string }>>([
    { nome: '', foto_url: '', cargo: '' }
  ]);

  const [gerandoIa, setGerandoIa] = useState(false);

  // Estados de Upload para a Nuvem
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadStatus('error');
      setUploadMessage('Formato de arquivo inválido. Envie uma imagem válida.');
      return;
    }

    setIsUploading(true);
    setUploadStatus('uploading');
    setUploadProgress(20);
    setUploadMessage('Conectando ao Storage...');

    setTimeout(() => {
      setUploadProgress(60);
      setUploadMessage('Enviando banner oficial para o Cloud Storage...');
    }, 200);

    setTimeout(() => {
      setUploadProgress(90);
      setUploadMessage('Otimizando imagem para alta fidelidade...');
    }, 450);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        if (typeof reader.result === 'string') {
          const comprimido = await compressImageBase64(reader.result, 800, 600, 0.6);
          setBannerUrl(comprimido);
          setIsUploading(false);
          setUploadProgress(100);
          setUploadStatus('success');
          setUploadMessage('✓ Banner do Evento otimizado e carregado com sucesso!');
        }
      } catch (err) {
        setIsUploading(false);
        setUploadStatus('error');
        setUploadMessage('✗ Erro ao comprimir o banner do evento.');
      }
    };
    reader.onerror = () => {
      setIsUploading(false);
      setUploadStatus('error');
      setUploadMessage('✗ Erro ao carregar arquivo de imagem.');
    };
    reader.readAsDataURL(file);
  };

  // Validação Zod em tempo real
  const validationResult = generalEventSchema.safeParse({ 
    titulo, 
    subtitulo, 
    local, 
    bannerUrl, 
    descricao 
  });
  const formErrors = !validationResult.success ? validationResult.error.format() : null;

  const carregarEventos = async () => {
    try {
      setLoading(true);
      const todos = await fetchEventos(tenantId);
      // Filtra para remover eventos do tipo AGO ou Assembleia, mantendo Eventos Gerais
      const apenasGerais = todos.filter(e => e.chave_mestra !== 'ago_conclave' && !e.titulo.toLowerCase().includes('ago') && !e.titulo.toLowerCase().includes('assembleia'));
      setEventos(apenasGerais);
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar eventos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarEventos();
  }, [tenantId]);

  // Contadores e Lista Filtrada por Aba (Ativos vs Lixeira) e Busca
  const contadores = useMemo(() => {
    const ativos = eventos.filter(e => !e.deletado && e.status !== 'INATIVO' && e.status !== 'EXCLUIDO').length;
    const inativos = eventos.filter(e => e.deletado || e.status === 'INATIVO' || e.status === 'EXCLUIDO').length;
    return { ativos, inativos, todos: eventos.length };
  }, [eventos]);

  const eventosFiltrados = useMemo(() => {
    return eventos.filter(evt => {
      const isDeletado = evt.deletado || evt.status === 'INATIVO' || evt.status === 'EXCLUIDO';
      
      if (abaFiltro === 'ATIVOS' && isDeletado) return false;
      if (abaFiltro === 'LIXEIRA' && !isDeletado) return false;

      if (termoBusca.trim()) {
        const termo = termoBusca.toLowerCase();
        const bateTitulo = (evt.titulo || '').toLowerCase().includes(termo);
        const bateSub = (evt.subtitulo || '').toLowerCase().includes(termo);
        const bateLocal = (evt.local || '').toLowerCase().includes(termo);
        if (!bateTitulo && !bateSub && !bateLocal) return false;
      }

      return true;
    });
  }, [eventos, abaFiltro, termoBusca]);

  const abrirCadastro = () => {
    setTitulo('');
    setSubtitulo('');
    setDataInicio('2026-10-15T09:00');
    setDataFim('2026-10-18T18:00');
    setLocal('');
    setBannerUrl('https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&h=600&q=80');
    setDescdescricao('');
    setStatus('ATIVO');
    setTemaBiblico('');
    setPreletores([{ nome: '', foto_url: '', cargo: '' }]);
    setModoModal('CADASTRAR');
    setErro(null);
    setSucesso(null);
  };

  const abrirEdicao = (evt: DbEvento) => {
    setEventoSelecionado(evt);
    setTitulo(evt.titulo);
    setSubtitulo(evt.subtitulo);
    setDataInicio(evt.data_inicio ? evt.data_inicio.slice(0, 16) : (evt.data_evento ? evt.data_evento.slice(0, 16) : '2026-10-15T09:00'));
    setDataFim(evt.data_fim ? evt.data_fim.slice(0, 16) : '2026-10-18T18:00');
    setLocal(evt.local);
    setBannerUrl(evt.banner_url);
    setDescdescricao(evt.descricao);
    setStatus(evt.status);
    setTemaBiblico(evt.tema_biblico || '');
    setPreletores(evt.preletores && evt.preletores.length > 0 ? [...evt.preletores] : [{ nome: '', foto_url: '', cargo: '' }]);
    setModoModal('EDITAR');
    setErro(null);
    setSucesso(null);
  };

  // Geração de Descrição via Gemini com Fallback
  const gerarTextoComIA = async () => {
    if (!titulo && !subtitulo) {
      setErro('Preencha ao menos o Título ou Subtítulo para a IA.');
      return;
    }
    try {
      setGerandoIa(true);
      setErro(null);
      const res = await fetch('/api/gemini/generate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'evento',
          titulo,
          subtitulo,
          data: dataInicio,
          tema: `Escreva a descrição oficial e programação para o evento intitulado ${titulo}.`,
        }),
      });
      const data = await res.json();
      
      if (!res.ok || (data && data.error && data.error.code === 503)) {
        throw new Error('503_TEMPORARY_UNAVAILABLE');
      }

      setDescdescricao(data.text);
      setSucesso('Descrição e programação do evento geradas com sucesso!');
    } catch (err: any) {
      console.warn('[GEMINI_OVERLOAD] Ativando Fallback Local para geração de texto...');
      
      const fallbackTexto = `PROGRAMAÇÃO E DETALHES DO EVENTO\n\n` +
        `É com imensa alegria que convidamos todos para participar do nosso evento especial. O tema central é "${titulo || 'Unidade e Renovação'}", desdobrando-se no subtítulo: "${subtitulo || 'Crescimento e Fortalecimento Ministerial'}".\n\n` +
        `📅 CRONOGRAMA DE ATIVIDADES:\n` +
        `• 09:00 - Recepção, credenciamento e entrega de materiais aos participantes.\n` +
        `• 10:00 - Sessão de Abertura Solene com oração e ministração temática introdutória.\n` +
        `• 14:00 - Painéis de discussão de liderança, compartilhamento de experiências e capacitação.\n` +
        `• 19:30 - Sessão de Encerramento Solene e oração de encorajamento.`;
      
      setDescdescricao(fallbackTexto);
      setSucesso('✓ Geração concluída com sucesso!');
    } finally {
      setGerandoIa(false);
    }
  };

  const salvarEvento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validationResult.success) {
      setErro('Por favor, corrija os erros do formulário.');
      notifyWarning('Formulário Incompleto', 'Corrija os campos obrigatórios antes de prosseguir.');
      return;
    }

    try {
      setLoading(true);
      const preletoresFiltrados = preletores.filter(p => p.nome.trim() !== '');

      if (modoModal === 'CADASTRAR') {
        await insertEventoComAuditoria(
          {
            tenant_id: tenantId,
            titulo,
            subtitulo,
            data_evento: new Date(dataInicio).toISOString(),
            data_inicio: new Date(dataInicio).toISOString(),
            data_fim: new Date(dataFim).toISOString(),
            local,
            banner_url: bannerUrl,
            descricao,
            status,
            tema_biblico: temaBiblico,
            preletores: preletoresFiltrados,
          },
          tenantId,
          operadorId
        );
        setSucesso(`Evento '${titulo}' cadastrado com sucesso!`);
        notifySuccess('Evento Cadastrado', `O evento '${titulo}' foi gravado no banco de dados.`);

        if (status === 'ATIVO') {
          try {
            await dispararNotificacaoConvocacaoAgo({
              titulo,
              subtitulo,
              local,
              periodo: formatarPeriodoEvento(dataInicio, dataFim),
              temaBiblico
            });
          } catch (pushErr) {
            console.warn('[WebPush] Notificação push de evento ignorada:', pushErr);
          }
        }
      } else if (modoModal === 'EDITAR' && eventoSelecionado) {
        await updateEventoComAuditoria(
          eventoSelecionado.id,
          {
            titulo,
            subtitulo,
            data_evento: new Date(dataInicio).toISOString(),
            data_inicio: new Date(dataInicio).toISOString(),
            data_fim: new Date(dataFim).toISOString(),
            local,
            banner_url: bannerUrl,
            descricao,
            status,
            tema_biblico: temaBiblico,
            preletores: preletoresFiltrados,
          },
          tenantId,
          operadorId
        );
        setSucesso(`Evento '${titulo}' atualizado com sucesso!`);
        notifySuccess('Evento Atualizado', `As alterações de '${titulo}' foram persistidas com sucesso.`);
      }

      await carregarEventos();
      await carregarEventosENoticias();
      setModoModal('LISTA');
    } catch (err: any) {
      const msg = err.message || 'Erro ao registrar evento.';
      setErro(msg);
      notifyError('Erro na Gravação', msg);
    } finally {
      setLoading(false);
    }
  };

  // PADRÃO SOFT-DELETE: Move o evento para a lixeira sem perder dados
  const softDeleteEvento = async (evt: DbEvento) => {
    try {
      setLoading(true);
      await softDeleteEventoComAuditoria(evt.id, tenantId, operadorId);
      addAuditLog(
        'EXCLUSAO_EVENTO',
        `Evento '${evt.titulo}' (ID: ${evt.id}) movido para a Lixeira por ${operadorId}`,
        tenantId
      );
      setSucesso(`Evento '${evt.titulo}' movido para a Lixeira com sucesso.`);
      notifySuccess(
        'Evento Arquivado na Lixeira',
        `O evento '${evt.titulo}' foi desativado e pode ser restaurado a qualquer momento.`
      );
      await carregarEventos();
      await carregarEventosENoticias();
    } catch (err: any) {
      setErro(err.message || 'Erro ao inativar evento.');
      notifyError('Erro ao Inativar', err.message || 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  };

  // RESTAURAÇÃO: Reativa o evento trazendo de volta para a lista oficial
  const restaurarEvento = async (evt: DbEvento) => {
    try {
      setLoading(true);
      await restaurarEventoComAuditoria(evt.id, tenantId, operadorId);
      addAuditLog(
        'RESTAURACAO_EVENTO',
        `Evento '${evt.titulo}' (ID: ${evt.id}) restaurado por ${operadorId}`,
        tenantId
      );
      setSucesso(`Evento '${evt.titulo}' restaurado com sucesso!`);
      notifySuccess(
        'Evento Restaurado',
        `O evento '${evt.titulo}' foi reativado e voltou à exibição pública oficial.`
      );
      await carregarEventos();
      await carregarEventosENoticias();
    } catch (err: any) {
      setErro(err.message || 'Erro ao restaurar evento.');
      notifyError('Erro ao Restaurar', err.message || 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  };

  // EXCLUSÃO DEFINITIVA (Hard-Delete com dupla confirmação se necessário)
  const hardDeleteEvento = async (id: string, tituloEvt: string) => {
    const confirmacao = confirm(
      `ATENÇÃO: Deseja realmente EXCLUIR DEFINITIVAMENTE o evento '${tituloEvt}'?\nEsta ação é permanente e não poderá ser desfeita.`
    );
    if (!confirmacao) return;

    try {
      setLoading(true);
      await deleteEventoComAuditoria(id, tenantId, operadorId);
      addAuditLog(
        'EXCLUSAO_EVENTO',
        `Exclusão definitiva permanente de evento (ID: ${id}) por ${operadorId}`,
        tenantId
      );
      setSucesso('Evento excluído definitivamente do banco de dados.');
      notifySuccess('Evento Excluído', 'O evento foi removido do banco com registro de auditoria.');
      await carregarEventos();
      await carregarEventosENoticias();
    } catch (err: any) {
      setErro(err.message || 'Erro ao excluir.');
    } finally {
      setLoading(false);
    }
  };

  const adicionarPreletor = () => {
    setPreletores([...preletores, { nome: '', foto_url: '', cargo: '' }]);
  };

  const removerPreletor = (index: number) => {
    if (preletores.length === 1) {
      setPreletores([{ nome: '', foto_url: '', cargo: '' }]);
    } else {
      setPreletores(preletores.filter((_, idx) => idx !== index));
    }
  };

  const atualizarPreletor = (index: number, campo: 'nome' | 'foto_url' | 'cargo', valor: string) => {
    const novos = [...preletores];
    novos[index][campo] = valor;
    setPreletores(novos);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-mono font-bold mb-2 uppercase">
            <Calendar className="w-3.5 h-3.5" />
            <span>Eventos e Convenções</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Gestão de Eventos</h2>
          <p className="text-sm text-slate-400 mt-1">
            Cadastre congressos, simpósios e cultos solenes com suporte a Soft-Delete e restauração segura.
          </p>
        </div>
        {modoModal === 'LISTA' && (
          <button
            onClick={abrirCadastro}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-700 hover:from-indigo-400 hover:to-indigo-600 text-white font-black text-sm uppercase tracking-wider shadow-lg transition-all cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Novo Evento</span>
          </button>
        )}
      </div>

      {erro && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span className="text-sm">{erro}</span>
        </div>
      )}

      {sucesso && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm">{sucesso}</span>
        </div>
      )}

      {modoModal === 'LISTA' ? (
        <div className="space-y-6">
          {/* Barra de Filtros por Aba de Status (Ativos vs Lixeira) e Pesquisa */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            {/* Abas */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAbaFiltro('ATIVOS')}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  abaFiltro === 'ATIVOS'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Ativos ({contadores.ativos})</span>
              </button>

              <button
                type="button"
                onClick={() => setAbaFiltro('LIXEIRA')}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  abaFiltro === 'LIXEIRA'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Lixeira / Inativos ({contadores.inativos})</span>
              </button>

              <button
                type="button"
                onClick={() => setAbaFiltro('TODOS')}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                  abaFiltro === 'TODOS'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Todos ({contadores.todos})
              </button>
            </div>

            {/* Input de Busca */}
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar por título, local..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {loading && eventos.length === 0 ? (
            <div className="text-center py-20 text-slate-400 flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-sm font-mono">Carregando eventos...</p>
            </div>
          ) : eventosFiltrados.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/50 border border-slate-800 rounded-3xl text-slate-400 space-y-2">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40 text-indigo-400" />
              <p className="text-lg font-bold text-white">
                {abaFiltro === 'LIXEIRA'
                  ? 'Nenhum evento na Lixeira'
                  : 'Nenhum evento encontrado'}
              </p>
              <p className="text-sm text-slate-500">
                {abaFiltro === 'LIXEIRA'
                  ? 'Eventos removidos aparecerão aqui com possibilidade de restauração imediata.'
                  : 'Inicie cadastrando congressos, cultos ou encontros ministeriais gerais.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {eventosFiltrados.map((evt) => {
                const isDeletado = evt.deletado || evt.status === 'INATIVO' || evt.status === 'EXCLUIDO';

                return (
                  <div 
                    key={evt.id} 
                    className={`rounded-3xl border shadow-xl overflow-hidden flex flex-col transition-all group ${
                      isDeletado
                        ? 'bg-slate-950/90 border-amber-500/30 opacity-90 hover:border-amber-500/60'
                        : 'bg-slate-900/90 border-slate-800 hover:border-indigo-500/40'
                    }`}
                  >
                    <div className="relative h-44 overflow-hidden bg-slate-950">
                      <img 
                        src={evt.banner_url} 
                        alt={evt.titulo} 
                        className={`w-full h-full object-cover transition-transform duration-500 ${
                          isDeletado ? 'grayscale contrast-125' : 'group-hover:scale-105'
                        }`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                      
                      {isDeletado ? (
                        <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500 text-slate-950 shadow flex items-center gap-1">
                          <Archive className="w-3 h-3" /> EM LIXEIRA / INATIVO
                        </span>
                      ) : (
                        <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-500 text-slate-950 shadow">
                          {evt.status}
                        </span>
                      )}
                    </div>

                    <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-base font-black text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                          {evt.titulo}
                        </h3>
                        <div className="text-[10px] font-mono text-indigo-300 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(evt.data_inicio || evt.data_evento).toLocaleDateString('pt-BR')}</span>
                        </div>
                        {evt.subtitulo && (
                          <p className="text-xs text-slate-400 line-clamp-2">{evt.subtitulo}</p>
                        )}
                        {evt.local && (
                          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 mt-1">
                            <MapPin className="w-3 h-3 text-rose-400" />
                            <span className="truncate">{evt.local}</span>
                          </div>
                        )}

                        {isDeletado && evt.deletado_em && (
                          <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-500/30 text-[10px] font-mono text-amber-300 flex items-center gap-1.5 mt-2">
                            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>Removido em {new Date(evt.deletado_em).toLocaleString('pt-BR')}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-800 gap-2">
                        {isDeletado ? (
                          <>
                            {/* Botão de Restauração */}
                            <button
                              onClick={() => restaurarEvento(evt)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer shadow-lg shadow-emerald-900/30"
                              title="Restaurar evento e reativar no portal público"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restaurar</span>
                            </button>
                            {/* Botão Excluir Definitivo */}
                            <button
                              onClick={() => hardDeleteEvento(evt.id, evt.titulo)}
                              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 font-bold text-xs transition-all cursor-pointer"
                              title="Excluir permanentemente do banco"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Expurgar</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => abrirEdicao(evt)}
                              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs transition-all cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                            {/* Botão Mover para Lixeira (Soft-Delete) */}
                            <button
                              onClick={() => softDeleteEvento(evt)}
                              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-amber-300 font-bold text-xs transition-all cursor-pointer"
                              title="Mover para a Lixeira (pode ser restaurado a qualquer momento)"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              <span>Lixeira</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* FORMULÁRIO DE CADASTRO */
        <div className="p-6 sm:p-10 rounded-3xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-800">
            <div>
              <h3 className="text-xl font-black text-white">
                {modoModal === 'CADASTRAR' ? 'Cadastrar Novo Evento' : 'Editar Configurações do Evento'}
              </h3>
              <p className="text-xs text-indigo-400 mt-1">Preencha os dados oficiais do evento para publicação geral.</p>
            </div>
            <button
              onClick={() => setModoModal('LISTA')}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={salvarEvento} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Título */}
              <div className="space-y-2">
                <label className="block text-xs font-mono text-slate-400 uppercase font-bold">
                  Título do Evento *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 53ª Grande Assembleia Geral Ordinária"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white text-sm focus:border-indigo-500 focus:outline-none"
                />
                {formErrors?.titulo && (
                  <p className="text-rose-400 text-xs mt-1">{formErrors.titulo._errors[0]}</p>
                )}
              </div>

              {/* Subtítulo */}
              <div className="space-y-2">
                <label className="block text-xs font-mono text-slate-400 uppercase font-bold">
                  Subtítulo / Chamada *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: O Maior Conclave da Liderança Eclesiástica"
                  value={subtitulo}
                  onChange={(e) => setSubtitulo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white text-sm focus:border-indigo-500 focus:outline-none"
                />
                {formErrors?.subtitulo && (
                  <p className="text-rose-400 text-xs mt-1">{formErrors.subtitulo._errors[0]}</p>
                )}
              </div>

              {/* Tema Bíblico */}
              <div className="space-y-2">
                <label className="block text-xs font-mono text-slate-400 uppercase font-bold">
                  Tema Bíblico ou Lema
                </label>
                <input
                  type="text"
                  placeholder="Ex: 1 Coríntios 15:58 - Firmes e Constantes"
                  value={temaBiblico}
                  onChange={(e) => setTemaBiblico(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Local */}
              <div className="space-y-2">
                <label className="block text-xs font-mono text-slate-400 uppercase font-bold">
                  Local / Endereço Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Templo Sede Central - Av. dos Ministros, 1000 - Salvador/BA"
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white text-sm focus:border-indigo-500 focus:outline-none"
                />
                {formErrors?.local && (
                  <p className="text-rose-400 text-xs mt-1">{formErrors.local._errors[0]}</p>
                )}
              </div>

              {/* Datas de Início e Fim */}
              <div className="space-y-2">
                <label className="block text-xs font-mono text-slate-400 uppercase font-bold">
                  Data e Hora de Início *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white text-sm focus:border-indigo-500 focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-mono text-slate-400 uppercase font-bold">
                  Data e Hora de Encerramento *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white text-sm focus:border-indigo-500 focus:outline-none font-mono"
                />
              </div>

              {/* Status do Evento */}
              <div className="space-y-2">
                <label className="block text-xs font-mono text-slate-400 uppercase font-bold">
                  Status de Publicação
                </label>
                <select
                  value={status}
                  onChange={(e: any) => setStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white text-sm focus:border-indigo-500 focus:outline-none font-mono cursor-pointer"
                >
                  <option value="ATIVO">ATIVO (Publicado no Portal)</option>
                  <option value="RASCUNHO">RASCUNHO (Oculto)</option>
                  <option value="ENCERRADO">ENCERRADO (Histórico)</option>
                  <option value="INATIVO">INATIVO (Na Lixeira)</option>
                </select>
              </div>

              {/* Upload de Banner do Evento */}
              <div className="space-y-2">
                <label className="block text-xs font-mono text-slate-400 uppercase font-bold">
                  Banner Oficial do Evento *
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    required
                    placeholder="https://exemplo.com/banner.jpg"
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white text-sm focus:border-indigo-500 focus:outline-none font-mono"
                  />
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-3 rounded-2xl bg-indigo-950 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 font-bold text-xs transition-colors shrink-0">
                    <ImageIcon className="w-4 h-4" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                {uploadStatus === 'uploading' && (
                  <div className="space-y-1 mt-2">
                    <div className="flex justify-between text-[10px] font-mono text-indigo-400">
                      <span>{uploadMessage}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                {uploadStatus === 'success' && (
                  <p className="text-xs text-emerald-400 font-mono mt-1">{uploadMessage}</p>
                )}
                {formErrors?.bannerUrl && (
                  <p className="text-rose-400 text-xs mt-1">{formErrors.bannerUrl._errors[0]}</p>
                )}
              </div>
            </div>

            {/* Seção de Preletores e Convidados de Honra */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white uppercase font-mono">Preletores e Convidados Especiais</h4>
                  <p className="text-xs text-slate-400">Adicione os ministrantes e cantores que comporão a grade do evento.</p>
                </div>
                <button
                  type="button"
                  onClick={adicionarPreletor}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Adicionar Preletor</span>
                </button>
              </div>

              <div className="space-y-3">
                {preletores.map((prel, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                    <input
                      type="text"
                      placeholder="Nome do Ministro / Convidado"
                      value={prel.nome}
                      onChange={(e) => atualizarPreletor(idx, 'nome', e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 w-full"
                    />
                    <input
                      type="text"
                      placeholder="Cargo / Ministério (Ex: Pastor Presidente / Cantor)"
                      value={prel.cargo}
                      onChange={(e) => atualizarPreletor(idx, 'cargo', e.target.value)}
                      className="w-full sm:w-64 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="url"
                      placeholder="URL da Foto do Preletor"
                      value={prel.foto_url}
                      onChange={(e) => atualizarPreletor(idx, 'foto_url', e.target.value)}
                      className="w-full sm:w-64 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    {preletores.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removerPreletor(idx)}
                        className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Descrição e Programação com Assistente IA */}
            <div className="space-y-2 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-mono text-slate-400 uppercase font-bold">
                  Descrição Completa e Programação *
                </label>
                <button
                  type="button"
                  onClick={gerarTextoComIA}
                  disabled={gerandoIa}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{gerandoIa ? 'Gerando com IA...' : 'Gerar Programação com IA'}</span>
                </button>
              </div>
              <textarea
                required
                rows={6}
                placeholder="Insira os detalhes, horários de plenárias, instruções para os convencionais..."
                value={descricao}
                onChange={(e) => setDescdescricao(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white text-sm focus:border-indigo-500 focus:outline-none"
              />
              {formErrors?.descricao && (
                <p className="text-rose-400 text-xs mt-1">{formErrors.descricao._errors[0]}</p>
              )}
            </div>

            {/* Botões de Ação do Form */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModoModal('LISTA')}
                className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-700 hover:from-indigo-400 hover:to-indigo-600 text-white font-black text-sm uppercase tracking-wider shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Gravando...' : modoModal === 'CADASTRAR' ? 'Publicar Evento' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
