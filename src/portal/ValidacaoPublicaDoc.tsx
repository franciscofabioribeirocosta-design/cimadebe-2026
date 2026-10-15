import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  RefreshCw,
  QrCode,
  FileCheck2,
  Calendar,
  User,
  Building2,
  Printer,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Award,
  ArrowLeft,
  FileText
} from 'lucide-react';

interface ValidacaoPublicaDocProps {
  codigoInicial?: string;
  onVoltar?: () => void;
}

interface DocumentoValidado {
  codigoValidacao: string;
  ministroId: string;
  ministroNome: string;
  ministroCpf: string;
  cargo: string;
  tipoDocumento: 'CERTIFICADO_ORDENACAO' | 'CARTA_RECOMENDACAO';
  tituloDocumento: string;
  dataEmissao: string;
  validoAte: string;
  emitidoPor: string;
  tenantId: string;
  statusNoMomento: string;
  hashIntegridade: string;
  finalidade?: string;
  destino?: string;
  qrCodeUrl: string;
}

interface RespostaValidacao {
  valido: boolean;
  mensagem: string;
  expirado?: boolean;
  ministroRegular?: boolean;
  documento?: DocumentoValidado;
  ministroInfo?: {
    nome: string;
    cargo: string;
    statusAcesso: string;
    statusAdimplencia: string;
    regular: boolean;
  };
}

export function ValidacaoPublicaDoc({ codigoInicial, onVoltar }: ValidacaoPublicaDocProps) {
  const [codigoInput, setCodigoInput] = useState<string>(() => {
    if (codigoInicial) return codigoInicial;
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.includes('/validar/')) {
        const seg = path.split('/validar/')[1];
        if (seg) return decodeURIComponent(seg.split('/')[0]);
      }
      const params = new URLSearchParams(window.location.search);
      const q = params.get('codigo') || params.get('validar') || params.get('doc');
      if (q) return q;
    }
    return '';
  });

  const [carregando, setCarregando] = useState<boolean>(false);
  const [resultado, setResultado] = useState<RespostaValidacao | null>(null);
  const [copiado, setCopiado] = useState<boolean>(false);

  const executarValidacao = useCallback(async (cod: string) => {
    const codLimpo = (cod || '').trim().toUpperCase();
    if (!codLimpo) return;

    setCarregando(true);
    setResultado(null);

    try {
      const res = await fetch(`/api/validar/${encodeURIComponent(codLimpo)}`);
      const data: RespostaValidacao = await res.json();
      setResultado(data);
    } catch (err: any) {
      setResultado({
        valido: false,
        mensagem: 'Erro de conexão ao verificar autenticidade do documento junto ao servidor.',
      });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (codigoInput.trim().length >= 6) {
      executarValidacao(codigoInput);
    }
  }, []);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (codigoInput.trim()) {
      executarValidacao(codigoInput);
    }
  };

  const copiarCodigo = () => {
    if (!resultado?.documento?.codigoValidacao) return;
    navigator.clipboard.writeText(resultado.documento.codigoValidacao);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const formatarData = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const mascararCpf = (cpf?: string) => {
    if (!cpf) return '***.***.***-**';
    const limpo = cpf.replace(/\D/g, '');
    if (limpo.length === 11) {
      return `${limpo.slice(0, 3)}.***.***-${limpo.slice(9, 11)}`;
    }
    return cpf;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-80 bg-gradient-to-b from-cyan-500/10 via-emerald-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* Header com Identidade Institucional */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/50">
            <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold">
              CIMADEBE / SIGM · CORE OFICIAL
            </div>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Portal Público de Validação de Documentos
            </h1>
          </div>
        </div>

        {onVoltar && (
          <button
            onClick={onVoltar}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Portal</span>
          </button>
        )}
      </header>

      {/* Conteúdo Central */}
      <main className="max-w-3xl w-full mx-auto flex-1 flex flex-col justify-start space-y-6 z-10">
        {/* Barra de Busca de Validação por Código */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-xl backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-cyan-400" />
              <span>Código Criptográfico do Documento</span>
            </label>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              Selo SHA-256
            </span>
          </div>

          <form onSubmit={handleBuscar} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={codigoInput}
                onChange={(e) => setCodigoInput(e.target.value.toUpperCase())}
                placeholder="Ex: DOC-CERT-2026-A1B2C3D4 ou DOC-REC-2026-..."
                className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-cyan-300 font-mono text-xs sm:text-sm font-bold tracking-wider placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 transition-all uppercase"
              />
            </div>
            <button
              type="submit"
              disabled={carregando || !codigoInput.trim()}
              className="h-11 px-6 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {carregando ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validando...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Verificar Autenticidade</span>
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
            Aponte a câmera para o QR Code impresso no documento oficial ou digite o código alfanumérico estampado no carimbo de segurança.
          </p>
        </div>

        {/* Resposta da Validação */}
        <AnimatePresence mode="wait">
          {carregando && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center space-y-3"
            >
              <RefreshCw className="w-8 h-8 mx-auto text-cyan-400 animate-spin" />
              <div className="text-sm font-semibold text-white">Consultando Livro Oficial de Registros...</div>
              <div className="text-xs text-slate-400 font-mono">Verificando assinatura criptográfica e regularidade ministerial ativa</div>
            </motion.div>
          )}

          {!carregando && resultado && (
            <motion.div
              key="resultado"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {/* CENÁRIO 1: DOCUMENTO 100% VÁLIDO E REGULAR */}
              {resultado.valido && resultado.documento && (
                <div className="p-6 sm:p-8 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 shadow-2xl backdrop-blur-md space-y-6">
                  {/* Banner de Homologação */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-500/20 pb-5">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                        <Award className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>DOCUMENTO OFICIAL AUTÊNTICO & REGULAR</span>
                        </div>
                        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mt-1">
                          {resultado.documento.tituloDocumento}
                        </h2>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <button
                        onClick={copiarCodigo}
                        className="h-8 px-3 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Copiar Código"
                      >
                        {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiado ? 'Copiado!' : 'Copiar Código'}</span>
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="h-8 px-3 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimir</span>
                      </button>
                    </div>
                  </div>

                  {/* Dados Estruturados do Obreiro e Documento */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                      <span className="text-[10px] font-mono uppercase text-slate-500 block">Ministro Titular</span>
                      <div className="text-sm font-bold text-white flex items-center gap-1.5">
                        <User className="w-4 h-4 text-emerald-400" />
                        <span>{resultado.documento.ministroNome}</span>
                      </div>
                      <div className="text-[11px] font-mono text-cyan-400">
                        CPF: {mascararCpf(resultado.documento.ministroCpf)}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                      <span className="text-[10px] font-mono uppercase text-slate-500 block">Cargo Eclesiástico</span>
                      <div className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                        <FileCheck2 className="w-4 h-4 text-amber-400" />
                        <span>{resultado.documento.cargo}</span>
                      </div>
                      <div className="text-[11px] font-mono text-emerald-400">
                        Situação Canônica: ATIVO / EM DIA
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                      <span className="text-[10px] font-mono uppercase text-slate-500 block">Data de Emissão</span>
                      <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{formatarData(resultado.documento.dataEmissao)}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">Assinado Digitalmente</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                      <span className="text-[10px] font-mono uppercase text-slate-500 block">Validade Estatutária</span>
                      <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Válido até {formatarData(resultado.documento.validoAte)}</span>
                      </div>
                      <span className="text-[10px] text-emerald-500 font-mono">Em Vigor Sem Restrições</span>
                    </div>
                  </div>

                  {/* Informações de Finalidade (se houver) */}
                  {(resultado.documento.finalidade || resultado.documento.destino) && (
                    <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 text-xs space-y-1">
                      {resultado.documento.destino && (
                        <div>
                          <span className="text-slate-500 font-mono text-[10px] uppercase">Destino / Igreja: </span>
                          <span className="text-white font-semibold">{resultado.documento.destino}</span>
                        </div>
                      )}
                      {resultado.documento.finalidade && (
                        <div>
                          <span className="text-slate-500 font-mono text-[10px] uppercase">Finalidade Estatutária: </span>
                          <span className="text-slate-300">{resultado.documento.finalidade}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Selo Criptográfico & Hash de Integridade */}
                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-emerald-500/20 font-mono text-[10px] space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Lock className="w-3 h-3" />
                        <span>Assinatura Digital SHA-256</span>
                      </span>
                      <span className="text-slate-500">Emitido por: {resultado.documento.emitidoPor}</span>
                    </div>
                    <div className="text-cyan-300 font-bold break-all select-all">
                      {resultado.documento.hashIntegridade}
                    </div>
                  </div>
                </div>
              )}

              {/* CENÁRIO 2: DOCUMENTO NÃO ENCONTRADO, EXPIRADO OU COM MINISTRO SUSPENSO */}
              {!resultado.valido && (
                <div className="p-6 sm:p-8 rounded-2xl bg-rose-950/40 border border-rose-500/40 shadow-2xl backdrop-blur-md space-y-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400 shrink-0 shadow-[0_0_20px_rgba(244,63,94,0.3)]">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1 text-[11px] font-mono font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/30">
                        <span>DOCUMENTO NÃO HOMOLOGADO OU REVOGADO</span>
                      </div>
                      <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                        Aviso de Não Autenticidade ou Inadimplência
                      </h2>
                      <p className="text-xs text-rose-200 leading-relaxed font-sans">
                        {resultado.mensagem}
                      </p>
                    </div>
                  </div>

                  {resultado.documento && (
                    <div className="p-3.5 rounded-xl bg-slate-950/80 border border-rose-500/20 text-xs space-y-1 font-mono">
                      <div className="text-slate-400">
                        Documento: <span className="text-white">{resultado.documento.tituloDocumento}</span>
                      </div>
                      <div className="text-slate-400">
                        Ministro: <span className="text-white">{resultado.documento.ministroNome}</span>
                      </div>
                      <div className="text-slate-400">
                        Emitido em: <span className="text-slate-300">{formatarData(resultado.documento.dataEmissao)}</span>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 text-[11px] text-slate-400 font-sans border-t border-slate-800">
                    Em caso de dúvidas sobre a autenticidade deste documento, entre em contato diretamente com a Secretaria Geral da Convenção através dos canais oficiais.
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto text-center text-[10px] font-mono text-slate-500 pt-6 border-t border-slate-900 z-10">
        CIMADEBE / SIGM · Sistema Integrado de Governança e Ministros · Certificação Criptográfica Atômica em Tempo Real
      </footer>
    </div>
  );
}
