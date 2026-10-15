import React, { useState, useMemo, useRef, useEffect } from 'react';
import { formatarDataBR, formatarRotuloStatus, obterBadgeClassStatus, gerarPixBacenBrcode } from '../financialEngine';
import { DossieMinisterialModal } from '../components/DossieMinisterialModal';
import { MinisterialCard } from '../components/MinisterialCard';
import { EmblemasEvolucaoAgo3D } from '../components/EmblemasEvolucaoAgo3D';
import { AdimplenciaBadge } from '../components/AdimplenciaBadge';
import { gerarPdfReciboPagamentoMinistro } from '../services/pdfExportService';
import { CheckoutRealAgo } from '../portal/CheckoutRealAgo';
import {
  ArrowLeft,
  User,
  Shield,
  CreditCard,
  Calendar,
  Building2,
  MapPin,
  Mail,
  Phone,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  FileText,
  DollarSign,
  Download,
  Copy,
  Check,
  Award,
  Vote,
  ExternalLink,
  Plus,
  RefreshCw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  QrCode,
  Edit3,
  Sparkles,
  BookOpen,
  Briefcase,
  Heart,
  BadgeCheck,
  Upload,
  Camera,
  Paperclip,
  Trash2,
  Eye,
  X,
  Loader2,
} from 'lucide-react';
import { useSecurity } from '../SecurityContext';
import { useNotification } from '../NotificationContext';
import { gerarRegistroMinisterial } from '../types';
import type {
  Ministro,
  AnuidadeMinistro,
  InscricaoAGO,
  StatusMinistro,
  StatusAdimplencia,
  DocumentoAnexoMinistro,
} from '../types';

interface AdminPerfilMinistroProps {
  readonly ministroId: string;
  readonly onVoltar: () => void;
  readonly onEditar?: (ministro: Ministro) => void;
  readonly onAcessarPortal?: (ministroId: string) => void;
}

export function AdminPerfilMinistro({
  ministroId,
  onVoltar,
  onEditar,
  onAcessarPortal,
}: AdminPerfilMinistroProps) {
  const {
    ministros,
    anuidades,
    inscricoesAGO,
    liquidarAnuidade,
    registrarAnuidade,
    editarAnuidade,
    processarWebhookAsaas,
    inscreverMinistroAGO,
    editarMinistro,
    appConfig,
    cicloAgoVigente,
    operadorAtual,
    igrejasFiliadas,
  } = useSecurity();
  const { notifySuccess, notifyError } = useNotification();

  // Localiza ministro
  const ministro = useMemo(() => {
    return ministros.find((m) => m.id === ministroId);
  }, [ministros, ministroId]);

  // Anuidades geradas para este ministro (com deduplicação estrita por ano vigente)
  const anuidadesDoMinistro = useMemo(() => {
    const doMin = anuidades.filter((a) => a.ministroId === ministroId);
    const map = new Map<number, AnuidadeMinistro>();
    for (const a of doMin) {
      const ano = a.anoVigente || 2026;
      if (!map.has(ano)) {
        map.set(ano, a);
      } else {
        const existente = map.get(ano)!;
        if (a.statusPagamento === 'PAGO' && existente.statusPagamento !== 'PAGO') {
          map.set(ano, a);
        }
      }
    }
    const result = Array.from(map.values());
    result.sort((a, b) => b.anoVigente - a.anoVigente);
    return result;
  }, [anuidades, ministroId]);

  // Igreja Presidida pelo Ministro (caso seja Pastor Presidente)
  const igrejaPresidida = useMemo(() => {
    if (ministro?.ehPresidenteIgreja && ministro.igrejaPresidenteNome) {
      return { nomeFantasia: ministro.igrejaPresidenteNome } as any;
    }
    return (igrejasFiliadas || []).find((ig) => {
      if (ig.pastorPresidenteId && ig.pastorPresidenteId === ministro?.id) return true;
      if (ig.pastorPresidenteCpf && ministro?.cpf && ig.pastorPresidenteCpf.replace(/\D/g, '') === ministro.cpf.replace(/\D/g, '')) return true;
      const nomePastor = (ig.pastorPresidenteNome || '').trim().toLowerCase();
      const nomeMin = (ministro?.nome || '').trim().toLowerCase();
      if (nomePastor && nomeMin && (nomePastor === nomeMin || nomeMin.includes(nomePastor) || nomePastor.includes(nomeMin))) return true;
      return false;
    });
  }, [igrejasFiliadas, ministro]);

  // Inscrições / Participações na AGO (Exclusivamente a partir da 1ª AGO 2026, sem registros anteriores)
  const participacoesAGODoMinistro = useMemo(() => {
    return inscricoesAGO
      .filter((i) => (
        (i.ministroId && i.ministroId === ministroId) || 
        (ministro && ministro.cpf && i.cpf && ministro.cpf.trim() !== '' && i.cpf === ministro.cpf)
      ) && i.anoVigente >= 2026)
      .sort((a, b) => b.anoVigente - a.anoVigente);
  }, [inscricoesAGO, ministroId, ministro]);

  // Estados locais
  const [copiadoPixId, setCopiadoPixId] = useState<string | null>(null);
  const [processandoAcao, setProcessandoAcao] = useState(false);
  const [feedbackMensagem, setFeedbackMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Modal para Nova Anuidade
  const [modalNovaAnuidade, setModalNovaAnuidade] = useState(false);
  const [novoAnoAnuidade, setNovoAnoAnuidade] = useState<number>(new Date().getFullYear());
  const [novoValorAnuidade, setNovoValorAnuidade] = useState<string>((appConfig.taxaAnuidadeRecorrente || 280).toString().replace('.', ','));

  // Modal para Visualizar Certificado / Credencial AGO
  const [modalCertificadoAGO, setModalCertificadoAGO] = useState<InscricaoAGO | null>(null);
  const [modalDossie, setModalDossie] = useState<boolean>(false);

  // Modal para Emissão de Documento Oficial com QR Code
  const [modalEmitirDoc, setModalEmitirDoc] = useState<boolean>(false);
  const [tipoDocEmissao, setTipoDocEmissao] = useState<'CERTIFICADO_ORDENACAO' | 'CARTA_RECOMENDACAO'>('CERTIFICADO_ORDENACAO');
  const [finalidadeDoc, setFinalidadeDoc] = useState<string>('');
  const [destinoDoc, setDestinoDoc] = useState<string>('');
  const [emitindoDoc, setEmitindoDoc] = useState<boolean>(false);
  const [docEmitidoResultado, setDocEmitidoResultado] = useState<any>(null);

  // Modal para Upload de Documento Direto
  const [modalUploadDocAberto, setModalUploadDocAberto] = useState(false);
  const [tipoDocNovo, setTipoDocNovo] = useState<DocumentoAnexoMinistro['tipo']>('RG_CNH');
  const [nomeDocNovo, setNomeDocNovo] = useState('');
  const [arquivoBase64Novo, setArquivoBase64Novo] = useState('');
  const [tamanhoDocNovo, setTamanhoDocNovo] = useState('');

  // Visualizador de Documento
  const [documentoVisualizar, setDocumentoVisualizar] = useState<DocumentoAnexoMinistro | null>(null);

  // Estados para o Modal de Credencial 3D
  const [modalCredencial3d, setModalCredencial3d] = useState<boolean>(false);
  const [rotX, setRotX] = useState<number>(0);
  const [rotY, setRotY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);

  // Auto Rotação do Palco 3D
  useEffect(() => {
    let animId: number;
    if (autoRotate && modalCredencial3d) {
      const loop = () => {
        setRotY((prev) => (prev + 0.8) % 360);
        animId = requestAnimationFrame(loop);
      };
      animId = requestAnimationFrame(loop);
    }
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [autoRotate, modalCredencial3d]);

  // Controles de Arrastar com Mouse no Palco 3D
  const lidarComMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setAutoRotate(false);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const lidarComMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    setRotY((prev) => (prev + deltaX * 0.5) % 360);
    setRotX((prev) => Math.max(-60, Math.min(60, prev - deltaY * 0.5)));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const lidarComMouseUp = () => {
    setIsDragging(false);
  };

  // Controles de Toque para Dispositivos Móveis
  const lidarComTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setAutoRotate(false);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const lidarComTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - dragStart.x;
    const deltaY = e.touches[0].clientY - dragStart.y;
    setRotY((prev) => (prev + deltaX * 0.6) % 360);
    setRotX((prev) => Math.max(-60, Math.min(60, prev - deltaY * 0.6)));
    setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const lidarComTouchEnd = () => {
    setIsDragging(false);
  };

  // Ref para upload de foto e arquivo
  const inputUploadFotoPerfilRef = useRef<HTMLInputElement | null>(null);
  const inputUploadDocRef = useRef<HTMLInputElement | null>(null);

  // Estados Asaas e Edição de Anuidade
  const [asaasModal, setAsaasModal] = useState<{ anuidade: AnuidadeMinistro; metodo: 'PIX' | 'CARTAO' | 'BOLETO' } | null>(null);
  const [pixCopiadoModal, setPixCopiadoModal] = useState<boolean>(false);
  const [asaasCargaReal, setAsaasCargaReal] = useState<any>(null);
  const [carregandoCargaReal, setCarregandoCargaReal] = useState<boolean>(false);
  const [editarAnuidadeObj, setEditarAnuidadeObj] = useState<{ anuidade: AnuidadeMinistro; valor: string; dataVencimento: string } | null>(null);

  const fecharModalAsaas = () => {
    setAsaasModal(null);
    setAsaasCargaReal(null);
    setFeedbackMensagem(null);
  };

  const buscarCobrancaReal = async () => {
    if (!asaasModal || !ministro) return;
    setCarregandoCargaReal(true);
    try {
      const res = await fetch('/api/payment/checkout-ago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ministroId: ministro.id,
          cpf: ministro.cpf,
          nome: ministro.nome,
          email: ministro.email || `ministro.${ministro.id}@cimadebe.org.br`,
          telefone: ministro.telefone || '71999999999',
          cargo: ministro.cargo || 'Ministro',
          billingType: asaasModal.metodo === 'CARTAO' ? 'CREDIT_CARD' : asaasModal.metodo,
          planoId: 'PLANO_1_NORMAL',
          planoNome: `Anuidade ${asaasModal.anuidade.anoVigente || '2026'}`,
          valorCustom: asaasModal.anuidade.valor,
        }),
      });
      const textRes = await res.text();
      let data: any = {};
      try {
        data = textRes ? JSON.parse(textRes) : {};
      } catch {
        data = { error: textRes || 'Erro no servidor de pagamento (Resposta inválida).' };
      }

      if (res.ok && data.success) {
        setAsaasCargaReal(data);
      } else {
        setFeedbackMensagem({ tipo: 'erro', texto: data.error || 'Erro ao gerar cobrança real no Asaas.' });
      }
    } catch (err: any) {
      setFeedbackMensagem({ tipo: 'erro', texto: err?.message || 'Falha de comunicação com o servidor Asaas.' });
    } finally {
      setCarregandoCargaReal(false);
    }
  };

  // Pagamento real via API Asaas Produção
  const lidarComPagamentoAsaas = async (anuidadeId: string, metodo: string) => {
    if (!ministro) return;
    try {
      setProcessandoAcao(true);

      const res = await fetch('/api/payment/checkout-ago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ministroId: ministro.id,
          cpf: ministro.cpf,
          nome: ministro.nome,
          email: ministro.email || `ministro.${ministro.id}@cimadebe.org.br`,
          telefone: ministro.telefone || '71999999999',
          cargo: ministro.cargo || 'Ministro',
          billingType: metodo === 'CARTAO' ? 'CREDIT_CARD' : metodo,
          planoId: 'PLANO_1_NORMAL',
          planoNome: `Anuidade ${asaasModal?.anuidade.anoVigente || '2026'}`,
          valorCustom: asaasModal?.anuidade.valor || 120,
        }),
      });

      const textRes = await res.text();
      let data: any = {};
      try {
        data = textRes ? JSON.parse(textRes) : {};
      } catch {
        data = { error: textRes || 'Erro no servidor de pagamento (Resposta inválida).' };
      }

      if (res.ok && data.success) {
        setAsaasModal(null);
        setFeedbackMensagem({
          tipo: 'sucesso',
          texto: `Cobrança Asaas (${metodo}) gerada e processada com sucesso no Asaas Produção! ID: ${data.paymentId}`,
        });
        setTimeout(() => setFeedbackMensagem(null), 5000);
      } else {
        setFeedbackMensagem({ tipo: 'erro', texto: data.error || 'Falha ao processar pagamento real no Asaas.' });
      }
    } catch (err: any) {
      setFeedbackMensagem({ tipo: 'erro', texto: err?.message || 'Erro de conexão com o servidor de pagamento Asaas.' });
    } finally {
      setProcessandoAcao(false);
    }
  };

  // Salvar Edição de Anuidade
  const lidarComSalvarEdicaoAnuidade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editarAnuidadeObj) return;
    try {
      setProcessandoAcao(true);
      const valLimpador = editarAnuidadeObj.valor.replace(/[^\d.,]/g, '').replace(',', '.');
      const valNum = parseFloat(valLimpador);
      if (isNaN(valNum) || valNum <= 0) {
        throw new Error('Valor inválido. Insira um número válido superior a zero (ex: 190,50).');
      }
      await editarAnuidade(editarAnuidadeObj.anuidade.id, {
        valor: valNum,
        dataVencimento: editarAnuidadeObj.dataVencimento,
      });
      setEditarAnuidadeObj(null);
      setFeedbackMensagem({
        tipo: 'sucesso',
        texto: 'Anuidade atualizada com sucesso (valor e data alterados).',
      });
      setTimeout(() => setFeedbackMensagem(null), 4000);
    } catch (err: any) {
      setFeedbackMensagem({ tipo: 'erro', texto: err?.message || 'Erro ao editar anuidade.' });
    } finally {
      setProcessandoAcao(false);
    }
  };

  // Emissão de Documento Oficial com QR Code Criptográfico
  const lidarComEmitirDocumento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ministro || emitindoDoc) return;

    setEmitindoDoc(true);
    setDocEmitidoResultado(null);

    try {
      const res = await fetch('/api/documentos/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ministroId: ministro.id,
          tipoDocumento: tipoDocEmissao,
          operadorEmail: operadorAtual || 'secretaria@cimadebe.org.br',
          tenantId: ministro.tenantId,
          finalidade: finalidadeDoc || undefined,
          destino: destinoDoc || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.erro || 'Falha ao emitir documento oficial.');
      }

      setDocEmitidoResultado(data.documento);
      notifySuccess('Documento Emitido', `Documento oficial emitido com QR Code [${data.documento.codigoValidacao}].`);
    } catch (err: any) {
      notifyError('Veto na Emissão', err?.message || 'Erro ao emitir documento.');
    } finally {
      setEmitindoDoc(false);
    }
  };

  if (!ministro) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">Ministro não localizado</h3>
        <p className="text-xs text-slate-400">O registro ministerial pode ter sido removido ou não existe.</p>
        <button
          onClick={onVoltar}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Listagem</span>
        </button>
      </div>
    );
  }

  const rmFormatado = ministro.registroMinisterial || gerarRegistroMinisterial(ministro.cpf);

  // Copiar código Pix
  const lidarComCopiarPix = (anuidadeId: string, chave: string) => {
    navigator.clipboard.writeText(chave);
    setCopiadoPixId(anuidadeId);
    setTimeout(() => setCopiadoPixId(null), 3000);
  };

  // Liquidação de anuidade com feedback
  const lidarComLiquidar = async (anuidadeId: string) => {
    try {
      setProcessandoAcao(true);
      await liquidarAnuidade(anuidadeId, 'MANUAL');
      setFeedbackMensagem({
        tipo: 'sucesso',
        texto: 'Anuidade liquidada e reconciliada no Ledger contábil com sucesso!',
      });
      notifySuccess('Liquidação Concluída', 'Anuidade liquidada e reconciliada no Ledger contábil.');
      setTimeout(() => setFeedbackMensagem(null), 4000);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao liquidar anuidade.';
      setFeedbackMensagem({
        tipo: 'erro',
        texto: msg,
      });
      notifyError('Erro na Liquidação', msg);
    } finally {
      setProcessandoAcao(false);
    }
  };

  // Gerar nova anuidade
  const lidarComCriarAnuidade = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setProcessandoAcao(true);
      const valorFormatado = parseFloat(String(novoValorAnuidade).replace(',', '.')) || 0;
      await registrarAnuidade({
        ministroId: ministro.id,
        tenantId: ministro.tenantId,
        anoVigente: Number(novoAnoAnuidade),
        dataVencimento: `${novoAnoAnuidade}-03-31`,
        valor: valorFormatado,
        statusPagamento: 'ABERTO',
        tipo: 'RECEITA',
        categoria: 'ANUIDADE',
      });
      setModalNovaAnuidade(false);
      setFeedbackMensagem({
        tipo: 'sucesso',
        texto: `Anuidade ${novoAnoAnuidade} gerada com sucesso para ${ministro.nome}!`,
      });
      notifySuccess('Anuidade Emitida', `Anuidade ${novoAnoAnuidade} gerada para ${ministro.nome}.`);
      setTimeout(() => setFeedbackMensagem(null), 4000);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao gerar anuidade.';
      setFeedbackMensagem({
        tipo: 'erro',
        texto: msg,
      });
      notifyError('Falha ao Gerar Anuidade', msg);
    } finally {
      setProcessandoAcao(false);
    }
  };

  // Inscrição na AGO
  const lidarComInscreverAGO = async () => {
    try {
      setProcessandoAcao(true);
      const res = await inscreverMinistroAGO(ministro.id, cicloAgoVigente);
      if (res.sucesso) {
        setFeedbackMensagem({
          tipo: 'sucesso',
          texto: res.mensagem || `Ministro inscrito na AGO ${cicloAgoVigente} com sucesso!`,
        });
        notifySuccess('Inscrição na AGO Realizada', res.mensagem || `Inscrito na AGO ${cicloAgoVigente} com sucesso.`);
      } else {
        setFeedbackMensagem({
          tipo: 'erro',
          texto: res.mensagem || 'Não foi possível inscrever o ministro na AGO.',
        });
        notifyError('Rejeição na Inscrição AGO', res.mensagem || 'Não foi possível inscrever o ministro.');
      }
      setTimeout(() => setFeedbackMensagem(null), 4000);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao inscrever na AGO.';
      setFeedbackMensagem({
        tipo: 'erro',
        texto: msg,
      });
      notifyError('Erro na Operação', msg);
    } finally {
      setProcessandoAcao(false);
    }
  };

  // Upload Direto de Foto de Perfil
  const lidarComUploadFotoPerfil = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedbackMensagem({
        tipo: 'erro',
        texto: 'Por favor, selecione uma imagem válida (JPG, PNG ou WEBP).',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const finalBase64 = ctx
          ? (ctx.drawImage(img, 0, 0, width, height), canvas.toDataURL('image/jpeg', 0.85))
          : (event.target?.result as string);

        try {
          await editarMinistro(ministro.id, { fotoUrl: finalBase64 });
          setFeedbackMensagem({
            tipo: 'sucesso',
            texto: 'Foto oficial do ministro atualizada com sucesso!',
          });
          setTimeout(() => setFeedbackMensagem(null), 3000);
        } catch (err: any) {
          setFeedbackMensagem({
            tipo: 'erro',
            texto: err?.message || 'Erro ao atualizar foto.',
          });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Upload de Arquivo para Anexo de Documento
  const lidarComUploadArquivoDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setFeedbackMensagem({
        tipo: 'erro',
        texto: 'O documento deve ter no máximo 10MB.',
      });
      return;
    }

    const tamanhoStr =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    if (!nomeDocNovo) {
      setNomeDocNovo(file.name);
    }
    setTamanhoDocNovo(tamanhoStr);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string;
      setArquivoBase64Novo(b64);
    };
    reader.readAsDataURL(file);
  };

  // Salvar Anexo de Documento
  const lidarComSalvarDocumentoAnexo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arquivoBase64Novo) {
      setFeedbackMensagem({
        tipo: 'erro',
        texto: 'Selecione um arquivo de documento para anexar.',
      });
      return;
    }

    try {
      const novoDoc: DocumentoAnexoMinistro = {
        id: `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        nome: nomeDocNovo || `Documento_${tipoDocNovo}`,
        tipo: tipoDocNovo,
        dataUpload: new Date().toISOString().split('T')[0],
        arquivoUrl: arquivoBase64Novo,
        tamanho: tamanhoDocNovo || '1.0 MB',
      };

      const docsAtualizados = [...(ministro.documentos || []), novoDoc];
      await editarMinistro(ministro.id, { documentos: docsAtualizados });

      setModalUploadDocAberto(false);
      setNomeDocNovo('');
      setArquivoBase64Novo('');
      setTamanhoDocNovo('');
      setFeedbackMensagem({
        tipo: 'sucesso',
        texto: `Documento [${novoDoc.nome}] anexado com sucesso ao prontuário ministerial!`,
      });
      notifySuccess('Documento Anexado', `Documento [${novoDoc.nome}] salvo no prontuário do ministro.`);
      setTimeout(() => setFeedbackMensagem(null), 4000);
    } catch (err: any) {
      setFeedbackMensagem({
        tipo: 'erro',
        texto: 'Erro ao anexar documento.',
      });
      notifyError('Erro ao Anexar', 'Não foi possível gravar o anexo no banco de dados.');
    }
  };

  // Remover Anexo de Documento
  const lidarComRemoverDocumento = async (docId: string, docNome: string) => {
    if (confirm(`Confirma a remoção do documento [${docNome}]?`)) {
      try {
        const docsRestantes = (ministro.documentos || []).filter((d) => d.id !== docId);
        await editarMinistro(ministro.id, { documentos: docsRestantes });
        setFeedbackMensagem({
          tipo: 'sucesso',
          texto: `Documento [${docNome}] removido com sucesso.`,
        });
        notifySuccess('Documento Removido', `O anexo [${docNome}] foi excluído com sucesso.`);
        setTimeout(() => setFeedbackMensagem(null), 3000);
      } catch (err: any) {
        setFeedbackMensagem({
          tipo: 'erro',
          texto: 'Erro ao remover documento.',
        });
        notifyError('Erro na Remoção', 'Falha ao excluir o documento do prontuário.');
      }
    }
  };

  if (!ministro) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">Ministro não localizado</h3>
        <p className="text-xs text-slate-400">O prontuário ministerial pode ter sido desabilitado ou não existe no banco.</p>
        <button
          onClick={onVoltar}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Listagem</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Botão de Voltar e Ações de Topo */}
      <div className="flex items-center justify-between">
        <button
          onClick={onVoltar}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Listagem</span>
        </button>

        <div className="flex items-center gap-2">
          {onAcessarPortal && (
            <button
              onClick={() => onAcessarPortal(ministroId)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-slate-950 text-xs font-black transition-all shadow-md cursor-pointer"
              title="Acessar Portal como este Ministro"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Acessar Portal</span>
            </button>
          )}

          <button
            onClick={() => setModalDossie(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-black transition-all shadow-md cursor-pointer"
            title="Abrir Dossiê Ministerial Consolidado"
          >
            <Shield className="w-4 h-4" />
            <span>Dossiê Ministerial</span>
          </button>

          <button
            onClick={() => {
              setModalEmitirDoc(true);
              setDocEmitidoResultado(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 text-xs font-black transition-all shadow-md cursor-pointer"
            title="Emitir Certificado ou Carta de Recomendação com QR Code"
          >
            <QrCode className="w-4 h-4" />
            <span>Emitir Documento (QR Code)</span>
          </button>

          {/* Botão removido e transferido para o Birô Gráfico */}

          {onEditar && (
            <button
              onClick={() => onEditar(ministro)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all shadow-md cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>Editar Cadastro Completo</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMensagem && (
        <div
          className={`p-4 rounded-2xl border text-xs font-mono flex items-center justify-between shadow-xl animate-fadeIn ${
            feedbackMensagem.tipo === 'sucesso'
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackMensagem.tipo === 'sucesso' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{feedbackMensagem.texto}</span>
          </div>
          <button
            onClick={() => setFeedbackMensagem(null)}
            className="text-slate-400 hover:text-white font-mono cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Banner de Ministro Suspenso / Desabilitado */}
      {ministro.status === 'SUSPENSO' && (
        <div className="p-4 rounded-2xl bg-rose-950/90 border border-rose-500/60 text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs shadow-xl animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <strong className="text-white block font-sans text-sm">MINISTRO SUSPENSO / DESABILITADO</strong>
              <span>Este obreiro encontra-se suspenso (por desativação da congregação filiada ou veto convencional). Todas as prerrogativas estão suspensas.</span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-rose-900 border border-rose-400 text-[10px] font-bold text-white uppercase shrink-0 w-fit">
            MINISTRO SUSPENSO
          </span>
        </div>
      )}

      {/* Cartão de Perfil Principal do Ministro */}
      <div className={`p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 shadow-2xl relative overflow-hidden ${ministro.status === 'SUSPENSO' ? 'opacity-70 grayscale filter hover:grayscale-0 hover:opacity-100 transition-all' : ''}`}>
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          {/* Foto + Informações Principais */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 w-full lg:w-auto">
            <div className="relative group">
              <img
                src={
                  ministro.fotoUrl ||
                  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&h=300&q=80'
                }
                alt={ministro.nome}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover border-2 border-slate-700 shadow-2xl group-hover:border-emerald-500/50 transition-colors"
              />
              <input
                type="file"
                ref={inputUploadFotoPerfilRef}
                onChange={lidarComUploadFotoPerfil}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => inputUploadFotoPerfilRef.current?.click()}
                className="absolute inset-0 bg-slate-950/70 rounded-3xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[10px] text-white font-bold transition-opacity cursor-pointer"
                title="Trocar Foto"
              >
                <Camera className="w-5 h-5 text-emerald-400 mb-1" />
                <span>Upload Foto</span>
              </button>

              <span
                className={`absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border shadow-lg ${
                  ministro.status === 'ATIVO'
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50'
                    : 'bg-rose-950 text-rose-400 border-rose-500/50'
                }`}
              >
                {ministro.status}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-0.5 rounded-xl">
                  {(ministro.cargo || 'Ministro Obreiro').toUpperCase()}
                </span>
                <span className="text-[11px] font-mono font-bold text-amber-400 bg-slate-950 px-2.5 py-0.5 rounded-xl border border-slate-800">
                  REGISTRO MINISTERIAL: {rmFormatado}
                </span>
                {igrejaPresidida && (
                  <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-300 bg-cyan-950/90 border border-cyan-500/40 px-2.5 py-0.5 rounded-xl flex items-center gap-1 shadow-sm">
                    <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                    Presidente de Igreja ({igrejaPresidida.nomeFantasia || igrejaPresidida.razaoSocial})
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
                {ministro.nome}
              </h1>

              <p className="text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                <Building2 className="w-4 h-4 text-emerald-400" />
                Igreja Filiada:{' '}
                <span className="text-white font-bold">
                  {ministro.igrejaFiliadaNome || 'Assembleia de Deus Filiada'}
                </span>
              </p>
            </div>
          </div>

          {/* Badges de Regularidade & Ações */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-800">
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-center min-w-[180px] space-y-1">
              <span className="text-[9px] font-mono text-slate-500 block uppercase">
                Situação Financeira
              </span>
              <AdimplenciaBadge status={ministro.statusAdimplencia} />
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center gap-3 min-w-[160px]">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[9px] font-mono text-slate-500 block uppercase">
                  Data de Filiação
                </span>
                <span className="text-xs font-bold font-mono text-white">
                  {formatarDataBR(ministro.dataFiliacao)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Grade 1: Documentos Civis & Identificação Pessoal Completa */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80 text-xs font-mono">
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Documento CPF</span>
            <span className="text-sm font-bold text-white flex items-center gap-2 font-mono">
              <FileText className="w-4 h-4 text-emerald-400" />
              {ministro.cpf}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Registro Ministerial</span>
            <span className="text-xs font-bold text-slate-200 block font-mono">
              {rmFormatado}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Nascimento & Naturalidade</span>
            <span className="text-xs font-bold text-slate-200 block">
              {ministro.dataNascimento ? formatarDataBR(ministro.dataNascimento) : 'Não informada'} • {ministro.naturalidade || 'Bahia'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Estado Civil & Cônjuge</span>
            <span className="text-xs font-bold text-slate-200 block">
              {ministro.estadoCivil || 'CASADO'} {ministro.nomeConjuge ? `(${ministro.nomeConjuge})` : ''}
            </span>
          </div>
        </div>

        {/* Grade 2: Dados Eclesiásticos & Formação */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 text-xs font-mono">
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
            <span className="text-[10px] text-cyan-400 block uppercase font-bold">Consagração Ministerial</span>
            <span className="text-xs font-bold text-slate-200 block">
              Data: {formatarDataBR(ministro.dataConsagracao || '2015-06-12')}
            </span>
            <span className="text-[10px] text-slate-400 block">
              Local: {ministro.localConsagracao || 'Salvador / BA'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
            <span className="text-[10px] text-cyan-400 block uppercase font-bold">Pastor Consagrante</span>
            <span className="text-xs font-bold text-slate-200 block font-sans">
              {ministro.pastorConsagrante || 'Não informado'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
            <span className="text-[10px] text-cyan-400 block uppercase font-bold">Profissão & Escolaridade</span>
            <span className="text-xs font-bold text-slate-200 block font-sans truncate">
              {ministro.profissao || 'Ministro de Confissão Religiosa / Pastor'}
            </span>
            <span className="text-[10px] text-slate-400 block font-sans truncate">
              {ministro.escolaridade || 'Bacharel em Teologia'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
            <span className="text-[10px] text-cyan-400 block uppercase font-bold">Contato & Telefone</span>
            <span className="text-xs text-slate-300 block truncate flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {ministro.email || (ministro.nome ? `${ministro.nome.toLowerCase().replace(/\s+/g, '.')}@cimadebe.org.br` : 'ministro@cimadebe.org.br')}
            </span>
            <span className="text-xs text-slate-400 block flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {ministro.telefone || '(71) 98888-7766'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1 sm:col-span-2 lg:col-span-4">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Endereço Residencial</span>
            <span className="text-xs text-slate-300 flex items-center gap-1.5 font-sans">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              {ministro.dadosEndereco?.rua || 'Avenida Central'}, {ministro.dadosEndereco?.numero || 'S/N'}, {ministro.dadosEndereco?.bairro || 'Centro'} - {ministro.dadosEndereco?.cidade || 'Salvador'} / {ministro.dadosEndereco?.uf || 'BA'} (CEP: {ministro.dadosEndereco?.cep || '40000-000'})
            </span>
          </div>
        </div>
      </div>



      {/* ======================================================== */}
      {/* SEÇÃO: DOCUMENTOS OFICIAIS ANEXADOS / UPLOAD             */}
      {/* ======================================================== */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-400 bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.5 rounded">
                PRONTUÁRIO & COMPLIANCE
              </span>
            </div>
            <h2 className="text-xl font-black text-white mt-1 flex items-center gap-2">
              <Paperclip className="w-5 h-5 text-cyan-400" />
              Documentos Oficiais Anexados ({(ministro.documentos || []).length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Certificados de consagração, RG/CPF digitalizados, ata e comprovantes anexados ao cadastro do ministro.
            </p>
          </div>

          <button
            onClick={() => {
              setNomeDocNovo('');
              setArquivoBase64Novo('');
              setTamanhoDocNovo('');
              setModalUploadDocAberto(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition-all cursor-pointer w-fit"
          >
            <Upload className="w-4 h-4" />
            <span>Upload de Documento</span>
          </button>
        </div>

        {/* Grade de Documentos Anexados */}
        {(ministro.documentos || []).length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(ministro.documentos || []).map((doc) => (
              <div
                key={doc.id}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-cyan-500/40 transition-colors flex flex-col justify-between space-y-3 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-white text-xs truncate max-w-[170px]" title={doc.nome}>
                        {doc.nome}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        Tipo: {doc.tipo}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => lidarComRemoverDocumento(doc.id, doc.nome)}
                    className="text-slate-500 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                    title="Excluir documento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-900">
                  <span>Enviado: {doc.dataUpload}</span>
                  {doc.tamanho && <span className="text-slate-400">{doc.tamanho}</span>}
                </div>

                {/* Ações de Download e Visualização */}
                <div className="flex items-center gap-2 pt-1">
                  {doc.arquivoUrl && doc.arquivoUrl.startsWith('data:') ? (
                    <a
                      href={doc.arquivoUrl}
                      download={doc.nome}
                      className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Baixar</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setFeedbackMensagem({
                          tipo: 'sucesso',
                          texto: `Documento [${doc.nome}] autenticado no prontuário digital.`,
                        });
                        setTimeout(() => setFeedbackMensagem(null), 3000);
                      }}
                      className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Certificado</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-2">
            <Paperclip className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">Nenhum documento anexado ao cadastro deste ministro.</p>
            <button
              onClick={() => {
                setNomeDocNovo('');
                setArquivoBase64Novo('');
                setModalUploadDocAberto(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Anexar Primeiro Documento</span>
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* SEÇÃO 1: LISTAGEM COM A SUA ANUIDADE GERADA              */}
      {/* ======================================================== */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">
                FINANCEIRO / ASAAS CORE
              </span>
            </div>
            <h2 className="text-xl font-black text-white mt-1 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              Anuidades & Taxas Convencionais Geradas ({anuidadesDoMinistro.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Histórico completo de cobranças, taxas de filiação e anuidades associadas a este ministro.
            </p>
          </div>

          <button
            onClick={() => setModalNovaAnuidade(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all cursor-pointer w-fit"
          >
            <Plus className="w-4 h-4" />
            <span>Gerar Anuidade</span>
          </button>
        </div>

        {/* Tabela Responsiva de Anuidades */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                <th className="pb-3 font-bold">Identificador / Ano</th>
                <th className="pb-3 font-bold">Categoria</th>
                <th className="pb-3 font-bold">Vencimento</th>
                <th className="pb-3 font-bold">Valor</th>
                <th className="pb-3 font-bold">Status</th>
                <th className="pb-3 font-bold text-right">Ações & Liquidação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {anuidadesDoMinistro.map((anuidade) => {
                const pixMock = `00020126580014BR.GOV.BCB.PIX0136cimadebe-anu-${anuidade.id}520400005303986540${anuidade.valor.toFixed(2)}5802BR5916CIMADEBE SALVADOR6008SALVADOR62070503***6304`;
                const copiado = copiadoPixId === anuidade.id;

                return (
                  <tr key={anuidade.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4">
                      <div className="font-bold text-white">{anuidade.anoVigente}</div>
                      <span className="text-[10px] text-slate-500">{anuidade.id}</span>
                    </td>

                    <td className="py-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 text-[10px]">
                        {anuidade.categoria === 'ANUIDADE' ? 'Anuidade Convencional' : 'Taxa de Filiação'}
                      </span>
                    </td>

                    <td className="py-4 text-slate-300">
                      {formatarDataBR(anuidade.dataVencimento)}
                    </td>

                    <td className="py-4 font-bold text-white">
                      R$ {anuidade.valor.toFixed(2)}
                    </td>

                    <td className="py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
                          anuidade.statusPagamento === 'PAGO'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                            : anuidade.statusPagamento === 'ANISTIADO'
                            ? 'bg-slate-800 text-slate-400 border-slate-700/60'
                            : 'bg-amber-950 text-amber-400 border-amber-500/40'
                        }`}
                      >
                        {anuidade.statusPagamento === 'PAGO' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ) : anuidade.statusPagamento === 'ANISTIADO' ? (
                          <Check className="w-3 h-3 text-slate-400" />
                        ) : (
                          <Clock className="w-3 h-3 text-amber-400" />
                        )}
                        {anuidade.statusPagamento === 'PAGO' ? 'LIQUIDADA' : anuidade.statusPagamento === 'ANISTIADO' ? 'ANISTIADO' : 'ABERTA'}
                      </span>
                    </td>

                      <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {anuidade.statusPagamento === 'ABERTO' ? (
                          <>
                            <button
                              onClick={() => setAsaasModal({ anuidade, metodo: 'PIX' })}
                              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                              title="Efetuar Pagamento via Asaas"
                            >
                              <CreditCard className="w-3.5 h-3.5 text-teal-200" />
                              <span>Pagar</span>
                            </button>

                            <button
                              onClick={() => setEditarAnuidadeObj({ anuidade, valor: anuidade.valor.toString().replace('.', ','), dataVencimento: anuidade.dataVencimento })}
                              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                              title="Editar Valor e Vencimento"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                            </button>

                            <button
                              onClick={() => lidarComLiquidar(anuidade.id)}
                              disabled={processandoAcao}
                              className="px-2 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-bold transition-all cursor-pointer shadow"
                              title="Liquidar Manualmente"
                            >
                              Liquidar
                            </button>
                          </>
                        ) : anuidade.statusPagamento === 'ANISTIADO' ? (
                          <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded border border-slate-850">
                            Anistiado
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/80 px-2 py-1 rounded-lg border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> Conciliado
                            </span>
                            {ministro && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await gerarPdfReciboPagamentoMinistro({
                                      ministro,
                                      anuidade: {
                                        id: anuidade.id,
                                        anoVigente: anuidade.anoVigente,
                                        valor: anuidade.valor,
                                        statusPagamento: 'PAGO',
                                        categoria: anuidade.categoria,
                                        dataPagamento: anuidade.dataPagamento || new Date().toISOString(),
                                        dataVencimento: anuidade.dataVencimento,
                                        rotulo:
                                          anuidade.categoria === 'TAXA_CONVENCAO'
                                            ? 'Taxa Oficial de Filiação'
                                            : `Anuidade Ministerial ${anuidade.anoVigente}`,
                                      },
                                      appConfig,
                                    });
                                    notifySuccess(
                                      'Recibo Gerado',
                                      `Recibo do exercício ${anuidade.anoVigente} baixado com sucesso em PDF.`
                                    );
                                  } catch (err: any) {
                                    notifyError('Erro ao Gerar Recibo', err?.message || 'Falha ao emitir recibo.');
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-[10px] transition-all cursor-pointer shadow-sm inline-flex items-center gap-1"
                                title="Baixar Recibo Oficial de Quitação em PDF"
                              >
                                <FileText className="w-3 h-3 text-emerald-400" />
                                <span>Gerar Recibo</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SEÇÃO: HISTÓRICO DE PARTICIPAÇÕES • TRILHA AGO (PERFIL)  */}
      {/* ======================================================== */}
      <EmblemasEvolucaoAgo3D
        ministroNome={ministro.nome}
        anosInscritos={participacoesAGODoMinistro
          .filter((p) => p.statusInscricao === 'VALIDA' || p.status === 'CONFIRMADO')
          .map((p) => p.anoVigente)}
        participacoes={participacoesAGODoMinistro}
        cicloVigente={cicloAgoVigente}
        onClickCredencial={() => {
          setModalCredencial3d(true);
        }}
      />



      {/* ======================================================== */}
      {/* MODAL: GERAR NOVA ANUIDADE                               */}
      {/* ======================================================== */}
      {modalNovaAnuidade && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl animate-fadeIn my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Gerar Anuidade Convencional</h3>
              </div>
              <button
                onClick={() => setModalNovaAnuidade(false)}
                className="text-slate-400 hover:text-white text-xs font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={lidarComCriarAnuidade} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1">Ministro Titular:</label>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-sans font-bold">
                  {ministro.nome} ({rmFormatado})
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Ano Vigente:</label>
                  <input
                    type="number"
                    required
                    min={2020}
                    max={2030}
                    value={novoAnoAnuidade}
                    onChange={(e) => setNovoAnoAnuidade(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Valor (R$):</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={novoValorAnuidade}
                    onChange={(e) => setNovoValorAnuidade(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalNovaAnuidade(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processandoAcao}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black transition-all shadow-md cursor-pointer"
                >
                  Confirmar Emissão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: UPLOAD DE NOVO DOCUMENTO ANEXO                   */}
      {/* ======================================================== */}
      {modalUploadDocAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fadeIn my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-base">Anexar Documento ao Prontuário</h3>
              </div>
              <button
                onClick={() => setModalUploadDocAberto(false)}
                className="text-slate-400 hover:text-white text-xs font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={lidarComSalvarDocumentoAnexo} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Tipo de Documento *</label>
                <select
                  value={tipoDocNovo}
                  onChange={(e: any) => setTipoDocNovo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="RG_CNH">RG ou CNH Digitalizada</option>
                  <option value="CPF">Comprovante de Inscrição CPF</option>
                  <option value="CERTIFICADO_CONSAGRACAO">Certificado / Ata de Consagração</option>
                  <option value="COMPROVANTE_RESIDENCIA">Comprovante de Residência</option>
                  <option value="CERTIDAO_CASAMENTO">Certidão de Casamento / Nascimento</option>
                  <option value="OUTROS">Diploma Teológico / Outro Documento</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Título / Nome do Documento</label>
                <input
                  type="text"
                  value={nomeDocNovo}
                  onChange={(e) => setNomeDocNovo(e.target.value)}
                  placeholder="Ex: Certificado_Consagracao_Pastor.pdf"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-500 font-sans"
                />
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="block text-slate-300 font-bold">Arquivo (PDF ou Imagem) *</label>
                <input
                  type="file"
                  ref={inputUploadDocRef}
                  onChange={lidarComUploadArquivoDoc}
                  accept="application/pdf,image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => inputUploadDocRef.current?.click()}
                  className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Paperclip className="w-4 h-4 text-cyan-400" />
                  <span>{arquivoBase64Novo ? 'Arquivo Selecionado ✓' : 'Escolher Arquivo no Dispositivo'}</span>
                </button>
                {tamanhoDocNovo && (
                  <p className="text-[10px] text-slate-400 text-center font-mono">Tamanho: {tamanhoDocNovo}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalUploadDocAberto(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!arquivoBase64Novo}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold transition-all shadow-md cursor-pointer"
                >
                  Salvar Documento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: PAGAMENTO ASAAS (PIX / CARTÃO / BOLETO)          */}
      {/* ======================================================== */}
      {asaasModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-teal-500/40 rounded-3xl max-w-2xl w-full p-4 sm:p-8 space-y-4 shadow-2xl animate-fadeIn my-auto font-mono text-xs relative max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-teal-400" />
                <h3 className="font-bold text-white text-base">Checkout Asaas API - Quitação de Anuidade</h3>
              </div>
              <button
                onClick={fecharModalAsaas}
                className="text-slate-400 hover:text-white cursor-pointer font-bold text-base"
              >
                ✕
              </button>
            </div>
            <CheckoutRealAgo
              ministro={{
                id: ministro.id,
                nome: ministro.nome,
                cpf: ministro.cpf,
                cargo: ministro.cargo,
                email: ministro.email,
                telefone: ministro.telefone,
              }}
              plano={{
                id: asaasModal.anuidade.id,
                nome: `Anuidade ${asaasModal.anuidade.anoVigente || '2026'}`,
                valor: asaasModal.anuidade.valor,
              }}
              onVoltar={fecharModalAsaas}
              onConcluido={(dados) => {
                fecharModalAsaas();
                window.location.reload();
              }}
            />
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDITAR VALOR E VENCIMENTO DA ANUIDADE            */}
      {/* ======================================================== */}
      {editarAnuidadeObj && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fadeIn my-auto font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Editar Anuidade (Valor & Data)</h3>
              </div>
              <button
                onClick={() => setEditarAnuidadeObj(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={lidarComSalvarEdicaoAnuidade} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1">Identificador / Ano:</label>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold">
                  Anuidade {editarAnuidadeObj.anuidade.anoVigente} (ID: {editarAnuidadeObj.anuidade.id})
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Valor (R$):</label>
                <input
                  type="text"
                  required
                  value={editarAnuidadeObj.valor}
                  onChange={(e) => {
                    setEditarAnuidadeObj({
                      ...editarAnuidadeObj,
                      valor: e.target.value,
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono"
                  placeholder="Ex: 190,00 ou 190.00"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Data de Vencimento:</label>
                <input
                  type="date"
                  required
                  value={editarAnuidadeObj.dataVencimento}
                  onChange={(e) => setEditarAnuidadeObj({ ...editarAnuidadeObj, dataVencimento: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditarAnuidadeObj(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processandoAcao}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black transition-all shadow-md cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal do Dossiê Ministerial Consolidado */}
      {modalDossie && ministro && (
        <DossieMinisterialModal
          ministro={ministro}
          anuidades={anuidades}
          inscricoesAgo={inscricoesAGO}
          onClose={() => setModalDossie(false)}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL: EMISSÃO DE DOCUMENTO OFICIAL COM QR CODE          */}
      {/* ======================================================== */}
      {modalEmitirDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl animate-fadeIn my-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Emissão de Documento Oficial</h3>
                  <span className="text-[10px] text-cyan-400 font-mono">Validação Criptográfica SHA-256 & QR Code</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setModalEmitirDoc(false);
                  setDocEmitidoResultado(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Verificação Estrita de Elegibilidade Canônica */}
            {(() => {
              const isAtivo = (ministro.status || '').toUpperCase() === 'ATIVO';
              const isAdimplente = ['EM_DIA', 'ANISTIADO', 'ADIMPLENTE', 'EM_DIA_FUTURO'].includes((ministro.statusAdimplencia || '').toUpperCase());
              const elegivel = isAtivo && isAdimplente;

              return (
                <div className="space-y-4">
                  {!elegivel ? (
                    <div className="p-4 rounded-2xl bg-rose-950/70 border border-rose-500/40 text-rose-200 space-y-1.5">
                      <div className="flex items-center gap-2 text-rose-400 font-bold uppercase tracking-wider text-[11px]">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Veto de Compliance Eclesiástico</span>
                      </div>
                      <p className="leading-relaxed">
                        A emissão com QR Code está bloqueada: O ministro precisa estar com status <strong className="text-white">ATIVO</strong> (atual: {ministro.status}) e situação financeira <strong className="text-white">EM DIA</strong> ou <strong className="text-white">ANISTIADO</strong> (atual: {formatarRotuloStatus(ministro.statusAdimplencia)}).
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-200 flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <span className="font-bold text-white block">Ministro 100% Elegível</span>
                        <span className="text-[11px] text-emerald-300">Status Ativo e Adimplência confirmada no Ledger.</span>
                      </div>
                    </div>
                  )}

                  {!docEmitidoResultado ? (
                    <form onSubmit={lidarComEmitirDocumento} className="space-y-4">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1.5 font-mono">
                          SELECIONE O TIPO DE DOCUMENTO:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setTipoDocEmissao('CERTIFICADO_ORDENACAO')}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                              tipoDocEmissao === 'CERTIFICADO_ORDENACAO'
                                ? 'bg-cyan-950/60 border-cyan-500 text-white shadow-md'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            <span className="font-bold text-white block">Certificado de Ordenação</span>
                            <span className="text-[10px] text-slate-400 font-mono">Consagração Ministerial (5 anos)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setTipoDocEmissao('CARTA_RECOMENDACAO')}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                              tipoDocEmissao === 'CARTA_RECOMENDACAO'
                                ? 'bg-cyan-950/60 border-cyan-500 text-white shadow-md'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            <span className="font-bold text-white block">Carta de Recomendação</span>
                            <span className="text-[10px] text-slate-400 font-mono">Regularidade Eclesiástica (90 dias)</span>
                          </button>
                        </div>
                      </div>

                      {tipoDocEmissao === 'CARTA_RECOMENDACAO' && (
                        <div className="space-y-3 pt-1">
                          <div>
                            <label className="block text-slate-300 font-semibold mb-1">Destino / Igreja Alvo:</label>
                            <input
                              type="text"
                              value={destinoDoc}
                              onChange={(e) => setDestinoDoc(e.target.value)}
                              placeholder="Ex: Assembleia de Deus em São Paulo - SP"
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-500"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-300 font-semibold mb-1">Finalidade da Carta:</label>
                            <input
                              type="text"
                              value={finalidadeDoc}
                              onChange={(e) => setFinalidadeDoc(e.target.value)}
                              placeholder="Ex: Ministração de Conferência Eclesiástica"
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => setModalEmitirDoc(false)}
                          className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={emitindoDoc || !elegivel}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black transition-all shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {emitindoDoc ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Selando Criptograficamente...</span>
                            </>
                          ) : (
                            <>
                              <Award className="w-4 h-4" />
                              <span>Emitir com Selo SHA-256 e QR Code</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-white flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            {docEmitidoResultado.tituloDocumento}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-900 border border-emerald-400/40 text-emerald-300 font-mono text-[10px] font-bold">
                            SELADO
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase">Código de Validação</span>
                            <span className="text-cyan-300 font-bold select-all">{docEmitidoResultado.codigoValidacao}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase">Validade</span>
                            <span className="text-white font-bold">{new Date(docEmitidoResultado.validoAte).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-mono">Hash SHA-256</span>
                          <span className="text-[10px] text-slate-300 font-mono break-all select-all block bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                            {docEmitidoResultado.hashIntegridade}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2">
                        <a
                          href={`/validar/${docEmitidoResultado.codigoValidacao}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-center text-xs flex items-center justify-center gap-2 shadow-md transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Abrir Validação Pública</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => {
                            setDocEmitidoResultado(null);
                            setModalEmitirDoc(false);
                          }}
                          className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
                        >
                          Concluir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
