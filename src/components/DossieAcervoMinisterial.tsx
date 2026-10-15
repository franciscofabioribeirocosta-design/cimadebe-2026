import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Download,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Lock,
  CheckCircle2,
  Clock,
  Sparkles,
  Share2,
  ExternalLink,
  Award,
  AlertCircle,
  FileCheck,
  Database,
  Search,
  Filter,
  Eye,
  X
} from 'lucide-react';
import { Ministro, AppConfig } from '../types';
import {
  DocumentoAcervo,
  MODELOS_DOCUMENTOS_PADRAO,
  inscreverModelosDocumentos,
  emitirDocumentoPdfCriptografado
} from '../services/dossieDocumentosService';
import { formatarRotuloStatus } from '../financialEngine';
import { useNotification } from '../NotificationContext';
import { DocumentoTimbrado3D } from './DocumentoTimbrado3D';
import confetti from 'canvas-confetti';

interface DossieAcervoProps {
  readonly ministro: Ministro;
  readonly appConfig?: AppConfig;
}

export const DossieAcervoMinisterial: React.FC<DossieAcervoProps> = ({ ministro, appConfig }) => {
  const { notifySuccess, notifyError } = useNotification();
  const [modelos, setModelos] = useState<DocumentoAcervo[]>([...MODELOS_DOCUMENTOS_PADRAO]);
  const [carregandoModelos, setCarregandoModelos] = useState<boolean>(true);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODOS');
  const [busca, setBusca] = useState<string>('');
  const [modeloPrevia, setModeloPrevia] = useState<DocumentoAcervo | null>(null);
  const [baixandoDocId, setBaixandoDocId] = useState<string | null>(null);
  const [historicoEmissoes, setHistoricoEmissoes] = useState<
    Array<{ id: string; docTitulo: string; dataEmissao: string; validade?: string; hash: string }>
  >([]);

  // Carrega e sincroniza modelos existentes do banco de dados (Firestore)
  useEffect(() => {
    setCarregandoModelos(true);
    const unsubscribe = inscreverModelosDocumentos((lista) => {
      setModelos(lista);
      setCarregandoModelos(false);
    });
    return () => unsubscribe();
  }, []);

  // Regra Estrita: Somente ministros em dia podem emitir cartas e certidões
  const estaEmDia =
    ministro.statusAdimplencia === 'EM_DIA' ||
    ministro.statusAdimplencia === 'EM_DIA_FUTURO' ||
    ministro.statusAdimplencia === 'ADIMPLENTE';

  // Modelos filtrados
  const modelosFiltrados = useMemo(() => {
    return modelos.filter((m) => {
      const matchCategoria =
        filtroCategoria === 'TODOS' ||
        (filtroCategoria === 'INDIVIDUAL' && m.categoria === 'INDIVIDUAL') ||
        (filtroCategoria === 'PASTORAL' && m.categoria === 'PASTORAL') ||
        (filtroCategoria === 'INSTITUCIONAL' && (m.categoria === 'INSTITUCIONAL' || m.categoria === 'LEGAL'));

      const matchBusca =
        !busca.trim() ||
        m.titulo.toLowerCase().includes(busca.toLowerCase()) ||
        m.subtitulo.toLowerCase().includes(busca.toLowerCase()) ||
        m.descricao.toLowerCase().includes(busca.toLowerCase());

      return matchCategoria && matchBusca;
    });
  }, [modelos, filtroCategoria, busca]);

  const handleBaixarDocumento = async (docConfig: DocumentoAcervo) => {
    if (docConfig.exigeAdimplencia !== false && !estaEmDia) {
      notifyError(
        'Acesso Bloqueado por Débito Pendente',
        'A emissão de cartas de recomendação, certidões e portarias exige situação financeira "Em Dia". Regularize sua anuidade na aba Tesouraria.'
      );
      return;
    }

    setBaixandoDocId(docConfig.id);
    try {
      const res = await emitirDocumentoPdfCriptografado(docConfig, ministro, appConfig);

      setHistoricoEmissoes((prev) => [
        {
          id: `${docConfig.id}-${Date.now()}`,
          docTitulo: docConfig.titulo,
          dataEmissao: res.dataEmissao,
          validade: res.dataValidade,
          hash: res.hashAuditoria
        },
        ...prev.slice(0, 4)
      ]);

      confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
      notifySuccess(
        '📄 Documento Criptografado Emitido com Sucesso!',
        docConfig.prazoValidadeDias
          ? `Válido até ${res.dataValidade} (${docConfig.prazoValidadeDias} dias). Arquivo protegido contra adulteração.`
          : 'Documento oficial do banco de dados salvo no seu dispositivo.'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notifyError('Falha na Emissão do Documento', msg);
    } finally {
      setBaixandoDocId(null);
    }
  };

  return (
    <div className="space-y-8 font-sans animate-fadeIn">
      {/* BANNER DE STATUS DE CONFORMIDADE & ADIMPLÊNCIA */}
      <div
        className={`p-6 sm:p-8 rounded-3xl border transition-all shadow-2xl backdrop-blur-xl relative overflow-hidden ${
          estaEmDia
            ? 'bg-gradient-to-r from-emerald-950/80 via-slate-900/90 to-slate-950 border-emerald-500/40 shadow-emerald-950/30'
            : 'bg-gradient-to-r from-rose-950/80 via-slate-900/90 to-slate-950 border-rose-500/50 shadow-rose-950/30'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-lg ${
                estaEmDia
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
              }`}
            >
              {estaEmDia ? <ShieldCheck className="w-7 h-7" /> : <ShieldAlert className="w-7 h-7" />}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider ${
                    estaEmDia
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  SITUAÇÃO FINANCEIRA • {formatarRotuloStatus(ministro.statusAdimplencia)}
                </span>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Database className="w-3 h-3" /> Modelos Ativos: {modelos.length} no Firestore
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-white">
                {estaEmDia
                  ? 'Dossiê & Acervo de Modelos Oficiais (Banco de Dados)'
                  : 'Acesso Restrito ao Acervo de Documentos'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                {estaEmDia
                  ? 'Modelos oficiais sincronizados em tempo real do banco de dados da convenção. Emissão instantânea de cartas de recomendação, portarias, certidões e atos com criptografia SHA-256 e prazo de validade dinâmico.'
                  : 'A emissão de cartas de recomendação, certidões negativas e transferências é prerrogativa exclusiva de ministros com situação financeira Em Dia. Regularize suas anuidades para desbloquear o acervo.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* BARRA DE CONTROLE: FILTROS & BUSCA NO BANCO */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-none">
          {[
            { id: 'TODOS', label: 'Todos os Modelos' },
            { id: 'INDIVIDUAL', label: 'Cartas & Certidões' },
            { id: 'PASTORAL', label: 'Portarias & Atos' },
            { id: 'INSTITUCIONAL', label: 'Institucionais & Legais' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFiltroCategoria(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                filtroCategoria === cat.id
                  ? 'bg-amber-500 text-slate-950 font-black shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar modelo de documento..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 font-mono transition-colors"
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

      {/* GRID DE MODELOS DE DOCUMENTOS DO BANCO */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-black text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" />
              <span>Modelos Eclesiásticos Disponíveis ({modelosFiltrados.length})</span>
            </h4>
            <p className="text-xs text-slate-400">
              PDFs protegidos contra conversão e adulteração, gerados dinamicamente a partir dos registros do banco de dados Firestore.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modelosFiltrados.map((item) => {
            const bloqueado = item.exigeAdimplencia !== false && !estaEmDia;
            return (
              <div
                key={item.id}
                className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/90 hover:border-amber-500/40 transition-all shadow-xl backdrop-blur-xl flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{item.icone}</span>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                        {item.categoria}
                      </span>
                    </div>

                    {item.prazoValidadeDias ? (
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-500/30 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Validade: {item.prazoValidadeDias} dias
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                        Permanente
                      </span>
                    )}
                  </div>

                  <h5 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                    {item.titulo}
                  </h5>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {item.descricao}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[10px] font-mono text-slate-500">
                    ID: {item.id}
                  </span>

                  <div className="flex items-center gap-2">
                    {item.conteudoModelo && (
                      <button
                        type="button"
                        onClick={() => setModeloPrevia(item)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5"
                        title="Ver texto do modelo"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                        <span>Prévia</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleBaixarDocumento(item)}
                      disabled={baixandoDocId === item.id || bloqueado}
                      className={`px-4 py-2 rounded-xl font-bold text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                        !bloqueado
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 hover:scale-105 active:scale-95'
                          : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                      }`}
                    >
                      {baixandoDocId === item.id ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                          <span>Gerando...</span>
                        </>
                      ) : (
                        <>
                          {!bloqueado ? <Download className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          <span>{!bloqueado ? 'Baixar PDF' : 'Bloqueado'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL DE PRÉVIA DO DOCUMENTO EM PAPEL TIMBRADO 3D (COM DADOS REAIS DO MINISTRO) */}
      {modeloPrevia && (
        <DocumentoTimbrado3D
          modelo={modeloPrevia}
          ministro={ministro}
          appConfig={appConfig}
          onFechar={() => setModeloPrevia(null)}
        />
      )}

      {/* HISTÓRICO DE EMISSÕES RECENTES */}
      {historicoEmissoes.length > 0 && (
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/90 space-y-4 shadow-xl backdrop-blur-xl">
          <h4 className="text-sm font-black text-white flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <span>Registro de Documentos Emitidos Nesta Sessão</span>
          </h4>

          <div className="space-y-2 font-mono text-xs">
            {historicoEmissoes.map((h) => (
              <div
                key={h.id}
                className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <span className="font-bold text-white block">{h.docTitulo}</span>
                  <span className="text-[10px] text-slate-400 block">
                    Hash: <strong className="text-emerald-400">{h.hash}</strong>
                  </span>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <span className="text-[10px] text-slate-400 block">Emitido em: {h.dataEmissao}</span>
                  {h.validade && (
                    <span className="text-[10px] text-amber-400 font-bold block">
                      Válido até: {h.validade}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
