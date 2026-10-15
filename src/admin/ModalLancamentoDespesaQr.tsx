/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Módulo de Lançamento de Despesas AGO / AdminLancarDespesas com Scanner html5-qrcode
 * Console de Diagnóstico e Logs de Depuração de Permissões de Câmera e Políticas de Segurança do Navegador/iFrame
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../firebase';
import {
  X,
  QrCode,
  Camera,
  Sparkles,
  Check,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Calendar,
  DollarSign,
  FileText,
  RefreshCw,
  Zap,
  Layers,
  VideoOff,
  Video,
  ShieldCheck,
  ShieldAlert,
  Terminal,
  Copy,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Smartphone,
  Info,
  Bug,
} from 'lucide-react';
import { parseNfceQrCode, NfceParsedData } from '../utils/nfceQrParser';
import { CENTROS_CUSTO_AGO } from './AdminDreAgo';
import { registrarLancamentoAgoTransacional } from '../services/dreAgoService';

export type StatusPermissaoCamera =
  | 'NAO_SOLICITADA'
  | 'SOLICITANDO'
  | 'CONCEDIDA'
  | 'NEGADA'
  | 'INDISPONIVEL'
  | 'ERRO';

export interface LogDepuracaoItem {
  timestamp: string;
  tipo: 'INFO' | 'SUCESSO' | 'AVISO' | 'ERRO';
  categoria: string;
  mensagem: string;
  detalhes?: any;
}

interface ModalLancamentoDespesaQrProps {
  readonly aberto: boolean;
  readonly onFechar: () => void;
  readonly onSucesso?: (mensagem: string) => void;
  readonly onQrCodeProcessado?: (dadosJson: NfceParsedData) => void;
}

export function ModalLancamentoDespesaQr({
  aberto,
  onFechar,
  onSucesso,
  onQrCodeProcessado,
}: ModalLancamentoDespesaQrProps) {
  // Estado do Modo de Auto-Gravação
  const [modoAutoLaunch, setModoAutoLaunch] = useState<boolean>(false);

  // Estados do Formulário de Lançamento Contábil
  const [descricao, setDescricao] = useState<string>('');
  const [valor, setValor] = useState<string>('');
  const [data, setData] = useState<string>(new Date().toISOString().split('T')[0]);
  const [centroCusto, setCentroCusto] = useState<string>('Infraestrutura & Locação Centro de Convenções');
  const [chaveNfce, setChaveNfce] = useState<string>('');

  // Estados do Gerenciador de Permissão e Scanner html5-qrcode
  const [permissaoCamera, setPermissaoCamera] = useState<StatusPermissaoCamera>('NAO_SOLICITADA');
  const [scannerAtivo, setScannerAtivo] = useState<boolean>(false);
  const [processandoScan, setProcessandoScan] = useState<boolean>(false);
  const [mensagemErroCamera, setMensagemErroCamera] = useState<string | null>(null);
  const [dadosUltimoJson, setDadosUltimoJson] = useState<NfceParsedData | null>(null);
  const [salvando, setSalvando] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro' | 'info'; texto: string } | null>(null);

  // Estados do Painel de Diagnóstico e Logs de Depuração
  const [painelLogsAberto, setPainelLogsAberto] = useState<boolean>(false);
  const [logsDepuracao, setLogsDepuracao] = useState<LogDepuracaoItem[]>([]);
  const [executandoDiagnostico, setExecutandoDiagnostico] = useState<boolean>(false);
  const [copiadoLogs, setCopiadoLogs] = useState<boolean>(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-reader-container-dre-ago';

  const processandoScanRef = useRef<boolean>(false);
  const processarJsonExtracaoNfceRef = useRef<any>(null);

  // Função para adicionar logs de depuração estruturados
  const adicionarLog = useCallback(
    (tipo: 'INFO' | 'SUCESSO' | 'AVISO' | 'ERRO', categoria: string, mensagem: string, detalhes?: any) => {
      const agora = new Date();
      const horaStr = agora.toTimeString().split(' ')[0] + '.' + String(agora.getMilliseconds()).padStart(3, '0');
      const novoItem: LogDepuracaoItem = {
        timestamp: horaStr,
        tipo,
        categoria,
        mensagem,
        detalhes,
      };

      console.log(`[DRE-SCANNER][${categoria}][${tipo}] ${mensagem}`, detalhes ?? '');
      setLogsDepuracao((prev) => [...prev.slice(-49), novoItem]);
    },
    []
  );

  // Limpeza de formulário
  const limparFormulario = () => {
    setDescricao('');
    setValor('');
    setData(new Date().toISOString().split('T')[0]);
    setCentroCusto('Infraestrutura & Locação Centro de Convenções');
    setChaveNfce('');
    setDadosUltimoJson(null);
    setFeedback(null);
    setMensagemErroCamera(null);
  };

  // Parar scanner e liberar recursos de câmera
  const pararScanner = useCallback(async () => {
    adicionarLog('INFO', 'CICLO_SCANNER', 'Solicitada interrupção do scanner html5-qrcode...');
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
          adicionarLog('SUCESSO', 'CICLO_SCANNER', 'Scanner html5-qrcode parado com sucesso.');
        }
        await html5QrCodeRef.current.clear();
      } catch (e: any) {
        adicionarLog('AVISO', 'CICLO_SCANNER', 'Limpeza suave de scanner finalizada', e?.message);
      }
      html5QrCodeRef.current = null;
    }
    setScannerAtivo(false);
  }, [adicionarLog]);

  // Executa diagnóstico aprofundado de Políticas de Segurança do Navegador e Sandbox
  const executarDiagnosticoPoliticas = useCallback(async () => {
    setExecutandoDiagnostico(true);
    adicionarLog('INFO', 'DIAGNOSTICO', '=== INICIANDO AUDITORIA DE POLÍTICAS DE SEGURANÇA E CÂMERA ===');

    try {
      // 1. Contexto Seguro (HTTPS)
      const isSecure = typeof window !== 'undefined' && window.isSecureContext;
      const protocol = typeof window !== 'undefined' ? window.location.protocol : 'unknown';
      const host = typeof window !== 'undefined' ? window.location.host : 'unknown';
      adicionarLog(
        isSecure ? 'SUCESSO' : 'ERRO',
        'HTTPS_CONTEXT',
        `SecureContext: ${isSecure ? 'ATIVO (HTTPS Seguro)' : 'INSEGURO (Câmera bloqueada pelo navegador sem HTTPS)'}`,
        { protocol, host, isSecure }
      );

      // 2. Detecção de iFrame Sandbox / Permissions Policy
      const isIframe = typeof window !== 'undefined' && window.self !== window.top;
      if (isIframe) {
        adicionarLog(
          'AVISO',
          'IFRAME_SANDBOX',
          'Aplicação em execução dentro de um <iframe> (Ambiente Sandbox). Se o iframe pai não possuir allow="camera", o navegador bloqueará com NotAllowedError automaticamente.',
          { isIframe, origin: window.location.origin }
        );
      } else {
        adicionarLog('SUCESSO', 'IFRAME_SANDBOX', 'Aplicação em execução na janela principal (Top-Level window).');
      }

      // 3. Suporte a navigator.mediaDevices
      const hasMediaDevices = typeof navigator !== 'undefined' && !!navigator.mediaDevices;
      const hasGetUserMedia = hasMediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
      adicionarLog(
        hasGetUserMedia ? 'SUCESSO' : 'ERRO',
        'API_SUPORTE',
        `navigator.mediaDevices.getUserMedia: ${hasGetUserMedia ? 'DISPONÍVEL' : 'NÃO SUPORTADO'}`,
        { userAgent: navigator.userAgent }
      );

      // 4. Consulta via Permissions API (se suportada)
      if (typeof navigator !== 'undefined' && 'permissions' in navigator && navigator.permissions.query) {
        try {
          const permStatus = await navigator.permissions.query({ name: 'camera' as any });
          adicionarLog(
            permStatus.state === 'granted'
              ? 'SUCESSO'
              : permStatus.state === 'denied'
              ? 'ERRO'
              : 'INFO',
            'PERMISSIONS_API',
            `Estado da permissão de câmera no navegador: [${permStatus.state.toUpperCase()}]`,
            { state: permStatus.state }
          );

          permStatus.onchange = () => {
            adicionarLog(
              'INFO',
              'PERMISSIONS_API',
              `Permissão alterada pelo usuário no navegador: [${permStatus.state.toUpperCase()}]`
            );
          };
        } catch (permErr: any) {
          adicionarLog('AVISO', 'PERMISSIONS_API', 'Permissions API query para câmera não suportada diretamente neste navegador.', permErr?.message);
        }
      }

      // 5. Enumeração de dispositivos de vídeo
      if (hasMediaDevices && navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === 'videoinput');
          adicionarLog(
            videoDevices.length > 0 ? 'SUCESSO' : 'AVISO',
            'DISPOSITIVOS',
            `Dispositivos de vídeo detectados: ${videoDevices.length}`,
            videoDevices.map((d) => ({ label: d.label || '(Rótulo oculto antes da permissão)', id: d.deviceId }))
          );
        } catch (devErr: any) {
          adicionarLog('AVISO', 'DISPOSITIVOS', 'Não foi possível enumerar dispositivos antes da permissão.', devErr?.message);
        }
      }

      // 6. Teste de chamada direta a getUserMedia
      if (hasGetUserMedia) {
        adicionarLog('INFO', 'TESTE_GUM', 'Testando solicitação direta ao navegador via navigator.mediaDevices.getUserMedia()...');
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          });
          adicionarLog('SUCESSO', 'TESTE_GUM', 'Stream de vídeo obtido com sucesso pelo navegador! Permissão CONCEDIDA.');
          // Libera tracks do teste
          stream.getTracks().forEach((track) => track.stop());
        } catch (gumErr: any) {
          adicionarLog(
            'ERRO',
            'TESTE_GUM',
            `Falha ao obter stream de vídeo: ${gumErr.name} - ${gumErr.message}`,
            { name: gumErr.name, message: gumErr.message, stack: gumErr.stack }
          );
        }
      }
    } catch (err: any) {
      adicionarLog('ERRO', 'DIAGNOSTICO', 'Erro inesperado durante auditoria de diagnóstico', err?.message);
    } finally {
      setExecutandoDiagnostico(false);
      adicionarLog('INFO', 'DIAGNOSTICO', '=== AUDITORIA DE POLÍTICAS CONCLUÍDA ===');
    }
  }, [adicionarLog]);

  // Monitora abertura do modal para rodar diagnóstico inicial
  useEffect(() => {
    if (aberto) {
      adicionarLog('INFO', 'MODAL', 'Modal de Lançamento de Despesas aberto.');
      executarDiagnosticoPoliticas();
    } else {
      pararScanner();
      setPermissaoCamera('NAO_SOLICITADA');
    }
  }, [aberto, pararScanner, executarDiagnosticoPoliticas, adicionarLog]);

  // Callback de Processamento do JSON / Dados Extraídos do QR Code da Nota Fiscal
  const processarJsonExtracaoNfce = useCallback(
    async (resultadoBruto: string) => {
      if (!resultadoBruto || processandoScanRef.current) return;
      processandoScanRef.current = true;
      setProcessandoScan(true);
      adicionarLog('INFO', 'EXTRACAO_JSON', 'Payload bruto recebido do QR Code', { payloadLength: resultadoBruto.length });

      try {
        await pararScanner();

        // Extrai e normaliza os dados do JSON ou URL da SEFAZ
        const dadosExtraidos: NfceParsedData = parseNfceQrCode(resultadoBruto);
        setDadosUltimoJson(dadosExtraidos);

        adicionarLog('SUCESSO', 'EXTRACAO_JSON', `Dados da Nota Fiscal decodificados [Formato: ${dadosExtraidos.formatoDetectado}]`, dadosExtraidos);

        // Atualiza campos do formulário
        const valorFormatado = dadosExtraidos.valor > 0 ? dadosExtraidos.valor.toFixed(2) : '';
        setValor(valorFormatado);
        setData(dadosExtraidos.data);
        setDescricao(dadosExtraidos.descricao || 'Despesa Nota Fiscal NFC-e');
        setCentroCusto(dadosExtraidos.centroCustoSugerido || 'Infraestrutura & Locação Centro de Convenções');
        if (dadosExtraidos.chaveAcesso) {
          setChaveNfce(dadosExtraidos.chaveAcesso);
        }

        setFeedback({
          tipo: 'sucesso',
          texto: `QR Code processado (${dadosExtraidos.formatoDetectado})! ${
            dadosExtraidos.valor > 0 ? `Valor: R$ ${dadosExtraidos.valor.toFixed(2)}` : 'Verifique os dados abaixo.'
          }`,
        });

        if (onQrCodeProcessado) {
          onQrCodeProcessado(dadosExtraidos);
        }

        if (modoAutoLaunch && dadosExtraidos.valor > 0) {
          adicionarLog('INFO', 'AUTO_GRAVACAO', 'Modo Auto-Gravar ativo. Gravando transação no Firestore...');
          await gravarDespesaNoFirestore({
            descricao: dadosExtraidos.descricao,
            valor: dadosExtraidos.valor,
            data: dadosExtraidos.data,
            centroCusto: dadosExtraidos.centroCustoSugerido,
            chaveNfce: dadosExtraidos.chaveAcesso,
          });
        }
      } catch (err: any) {
        adicionarLog('ERRO', 'EXTRACAO_JSON', 'Falha ao interpretar dados da Nota Fiscal', err?.message);
        setFeedback({
          tipo: 'erro',
          texto: 'Não foi possível interpretar os dados da Nota Fiscal automaticamente. Preencha manualmente.',
        });
      } finally {
        processandoScanRef.current = false;
        setProcessandoScan(false);
      }
    },
    [modoAutoLaunch, pararScanner, onQrCodeProcessado, adicionarLog]
  );

  useEffect(() => {
    processarJsonExtracaoNfceRef.current = processarJsonExtracaoNfce;
  }, [processarJsonExtracaoNfce]);

  // Inicialização do html5-qrcode e Gerenciamento Granular de Permissão de Câmera
  const iniciarScannerCamera = async () => {
    setMensagemErroCamera(null);
    setFeedback(null);
    setPermissaoCamera('SOLICITANDO');
    adicionarLog('INFO', 'HTML5_QRCODE', 'Iniciando fluxo de ativação da câmera com html5-qrcode...');

    await pararScanner();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissaoCamera('INDISPONIVEL');
      const errTxt = 'API de captura de vídeo (navigator.mediaDevices.getUserMedia) não suportada neste ambiente.';
      setMensagemErroCamera(errTxt);
      adicionarLog('ERRO', 'HTML5_QRCODE', errTxt);
      return;
    }

    try {
      const container = document.getElementById(scannerContainerId);
      if (!container) {
        setPermissaoCamera('ERRO');
        const errTxt = `Contêiner DOM #${scannerContainerId} não encontrado.`;
        setMensagemErroCamera(errTxt);
        adicionarLog('ERRO', 'HTML5_QRCODE', errTxt);
        return;
      }

      adicionarLog('INFO', 'HTML5_QRCODE', 'Solicitando câmeras disponíveis via Html5Qrcode.getCameras()...');
      
      // 1. Obtém as câmeras físicas (isto força o pop-up de permissão nativa do navegador!)
      const cameras = await Html5Qrcode.getCameras();
      
      if (!cameras || cameras.length === 0) {
        setPermissaoCamera('INDISPONIVEL');
        setMensagemErroCamera('Nenhuma câmera física ou webcam foi encontrada conectada ao dispositivo.');
        adicionarLog('ERRO', 'HTML5_QRCODE', 'Nenhuma câmera encontrada.');
        return;
      }

      adicionarLog('SUCESSO', 'HTML5_QRCODE', `Câmeras encontradas: ${cameras.length}`, cameras);

      // 2. Escolhe a melhor câmera: procura por câmera traseira ("back", "traseira", "rear", "environment")
      let cameraIdSelecionada = cameras[0].id;
      let labelSelecionada = cameras[0].label || 'Câmera Padrão';

      for (const cam of cameras) {
        const lbl = (cam.label || '').toLowerCase();
        if (lbl.includes('back') || lbl.includes('traseir') || lbl.includes('rear') || lbl.includes('ambiente') || lbl.includes('extern')) {
          cameraIdSelecionada = cam.id;
          labelSelecionada = cam.label;
          adicionarLog('INFO', 'HTML5_QRCODE', `Câmera traseira identificada e selecionada: ${cam.label}`);
          break;
        }
      }

      adicionarLog('INFO', 'HTML5_QRCODE', `Instanciando Html5Qrcode para o contêiner #${scannerContainerId}...`);
      const qrInstance = new Html5Qrcode(scannerContainerId, { verbose: false });
      html5QrCodeRef.current = qrInstance;

      const scanConfig = {
        fps: 12,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      const aoEscanearSucesso = async (decodedText: string) => {
        adicionarLog('SUCESSO', 'HTML5_QRCODE', 'Código QR capturado com sucesso pelo leitor óptico!');
        if (processarJsonExtracaoNfceRef.current) {
          await processarJsonExtracaoNfceRef.current(decodedText);
        }
      };

      const aoEscanearErro = () => {
        // Frame sem QR
      };

      adicionarLog('INFO', 'HTML5_QRCODE', `Iniciando scanner na câmera: "${labelSelecionada}" (ID: ${cameraIdSelecionada})...`);
      
      await qrInstance.start(
        cameraIdSelecionada,
        scanConfig,
        aoEscanearSucesso,
        aoEscanearErro
      );

      setPermissaoCamera('CONCEDIDA');
      setScannerAtivo(true);
      adicionarLog('SUCESSO', 'HTML5_QRCODE', `Scanner iniciado com sucesso na câmera: "${labelSelecionada}"!`);
      return;
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      const errorName = err?.name || 'ErroDesconhecido';
      adicionarLog('ERRO', 'HTML5_QRCODE', `Falha crítica na inicialização do scanner: ${errorName} - ${errorMsg}`, {
        name: errorName,
        message: errorMsg,
        stack: err?.stack,
      });

      setScannerAtivo(false);

      if (
        errorName === 'NotAllowedError' ||
        errorMsg.includes('NotAllowedError') ||
        errorMsg.includes('Permission denied') ||
        errorMsg.includes('Permission dismissed')
      ) {
        setPermissaoCamera('NEGADA');
        const isIframe = typeof window !== 'undefined' && window.self !== window.top;
        setMensagemErroCamera(
          isIframe
            ? 'Permissão negada pelo navegador ou política do iFrame sandbox. Desbloqueie a câmera no ícone de cadeado da URL ou abra em janela dedicada.'
            : 'Permissão de câmera negada pelo navegador. Clique no ícone de cadeado/configurações do site na barra de endereços para permitir a câmera.'
        );
      } else if (errorName === 'NotFoundError' || errorMsg.includes('DevicesNotFoundError')) {
        setPermissaoCamera('INDISPONIVEL');
        setMensagemErroCamera('Nenhuma câmera física ou webcam foi encontrada conectada ao dispositivo.');
      } else {
        setPermissaoCamera('ERRO');
        setMensagemErroCamera(`Falha ao acessar vídeo (${errorName}): ${errorMsg}`);
      }
    }
  };

  // Processamento de Arquivo de Foto Nativo (Fallback 100% Funcional contra Bloqueios de iFrame/Navegador)
  const processarFotoNativa = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (processandoScanRef.current) return;
    processandoScanRef.current = true;
    setProcessandoScan(true);

    adicionarLog('INFO', 'FALLBACK_FOTO', `Arquivo de foto capturado pela câmera nativa: ${file.name} (${file.size} bytes)`);
    setFeedback({ tipo: 'info', texto: 'Processando foto capturada da Nota Fiscal...' });

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerContainerId, { verbose: false });
      }

      const decodedText = await html5QrCodeRef.current.scanFile(file, true);
      adicionarLog('SUCESSO', 'FALLBACK_FOTO', 'QR Code extraído da foto com sucesso!');
      
      processandoScanRef.current = false;
      setProcessandoScan(false);
      
      await processarJsonExtracaoNfce(decodedText);
    } catch (err: any) {
      adicionarLog('AVISO', 'FALLBACK_FOTO', 'Não foi possível ler QR Code nítido na imagem', err?.message);
      setFeedback({
        tipo: 'erro',
        texto: 'Não foi possível detectar o QR Code na foto. Aproxime mais a câmera do código impresso.',
      });
      processandoScanRef.current = false;
      setProcessandoScan(false);
    }
  };

  // Gravação Atômica da Despesa no Firestore com runTransaction() e Chave de Idempotência
  const gravarDespesaNoFirestore = async (dados: {
    descricao: string;
    valor: number;
    data: string;
    centroCusto: string;
    chaveNfce?: string;
  }) => {
    setSalvando(true);
    adicionarLog('INFO', 'FIRESTORE_ACID', 'Iniciando gravação atômica com runTransaction()...');
    try {
      const timestampAtual = Date.now();
      const novoId = `desp-ago-${timestampAtual}`;
      const chaveIdempotencia = `idemp_desp_${timestampAtual}_${Math.random().toString(36).substring(2, 9)}`;

      await registrarLancamentoAgoTransacional(
        db,
        {
          id: novoId,
          tipo: 'DESPESA',
          descricao: dados.descricao.trim() || 'Despesa Operacional AGO',
          valor: dados.valor,
          valorLiquido: dados.valor,
          tarifaAsaas: 0,
          data: dados.data,
          centroCusto: dados.centroCusto,
          chaveNfce: dados.chaveNfce || null,
          status: 'CONFIRMADO',
          origemLancamento: dados.chaveNfce ? 'QR_CODE_NFCE' : 'MANUAL',
        },
        chaveIdempotencia
      );

      adicionarLog('SUCESSO', 'FIRESTORE_ACID', `Transação ${novoId} consolidada no Firestore ACID com chave ${chaveIdempotencia}`);

      setFeedback({
        tipo: 'sucesso',
        texto: 'Despesa registrada e consolidada atomicamente no DRE AGO!',
      });

      if (onSucesso) {
        onSucesso('Despesa registrada e consolidada atomicamente no DRE AGO!');
      }

      setTimeout(() => {
        limparFormulario();
        onFechar();
      }, 1200);
    } catch (err: any) {
      adicionarLog('ERRO', 'FIRESTORE_ACID', 'Erro na gravação atômica do Firestore', err?.message);
      setFeedback({
        tipo: 'erro',
        texto: 'Falha na gravação bancária atômica da despesa. Tente novamente.',
      });
    } finally {
      setSalvando(false);
    }
  };

  // Submissão do Formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(valor.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      setFeedback({ tipo: 'erro', texto: 'Por favor, informe um valor de despesa válido.' });
      return;
    }

    if (!descricao.trim()) {
      setFeedback({ tipo: 'erro', texto: 'Informe uma descrição para o lançamento.' });
      return;
    }

    await gravarDespesaNoFirestore({
      descricao,
      valor: val,
      data,
      centroCusto,
      chaveNfce: chaveNfce || undefined,
    });
  };

  // Copiar logs de depuração para a área de transferência
  const copiarLogs = () => {
    const textoLogs = logsDepuracao
      .map((l) => `[${l.timestamp}] [${l.tipo}] [${l.categoria}] ${l.mensagem} ${l.detalhes ? JSON.stringify(l.detalhes) : ''}`)
      .join('\n');

    navigator.clipboard.writeText(textoLogs);
    setCopiadoLogs(true);
    setTimeout(() => setCopiadoLogs(false), 2000);
  };

  if (!aberto) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8"
        >
          {/* Header do Modal */}
          <div className="p-6 bg-gradient-to-r from-rose-950/60 via-slate-900 to-indigo-950/60 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-bold tracking-wider text-rose-400 uppercase">
                    DRE AGO 2026 • DESPESAS OPERACIONAIS
                  </span>
                  <span className="text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded">
                    html5-qrcode v2.3
                  </span>
                </div>
                <h3 className="text-lg font-black text-white mt-0.5">
                  Lançamento com Leitor de QR Code NFC-e
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                pararScanner();
                onFechar();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Feedback Banner */}
            {feedback && (
              <div
                className={`p-3.5 rounded-2xl border text-xs font-mono flex items-center gap-2 ${
                  feedback.tipo === 'sucesso'
                    ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
                    : feedback.tipo === 'erro'
                    ? 'bg-rose-950/90 border-rose-500/60 text-rose-200'
                    : 'bg-indigo-950/90 border-indigo-500/60 text-indigo-200'
                }`}
              >
                {feedback.tipo === 'sucesso' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                {feedback.tipo === 'erro' && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
                {feedback.tipo === 'info' && <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />}
                <span>{feedback.texto}</span>
              </div>
            )}

            {/* SEÇÃO DO SCANNER HTML5-QRCODE & ESTADO DE PERMISSÃO */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Camera className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-mono font-bold text-white uppercase">
                    Scanner de Câmera em Tempo Real
                  </span>
                  {/* Badge de Status de Permissão */}
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      permissaoCamera === 'CONCEDIDA'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30'
                        : permissaoCamera === 'NEGADA'
                        ? 'bg-rose-950/80 text-rose-300 border-rose-500/30'
                        : permissaoCamera === 'SOLICITANDO'
                        ? 'bg-amber-950/80 text-amber-300 border-amber-500/30'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    {permissaoCamera === 'CONCEDIDA' && '● CÂMERA ATIVA'}
                    {permissaoCamera === 'NEGADA' && '✕ PERMISSÃO NEGADA'}
                    {permissaoCamera === 'SOLICITANDO' && '⏳ SOLICITANDO ACESSO...'}
                    {permissaoCamera === 'NAO_SOLICITADA' && 'AGUARDANDO ATIVAÇÃO'}
                    {permissaoCamera === 'INDISPONIVEL' && 'DISPOSITIVO INDISPONÍVEL'}
                    {permissaoCamera === 'ERRO' && 'FALHA NA CÂMERA'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Botão para Abrir Console de Diagnóstico */}
                  <button
                    type="button"
                    onClick={() => setPainelLogsAberto(!painelLogsAberto)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px] cursor-pointer transition-colors"
                  >
                    <Bug className="w-3.5 h-3.5 text-amber-400" />
                    <span>Logs & Políticas</span>
                    {painelLogsAberto ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {/* Toggle Lançamento Automático Direto */}
                  <label className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={modoAutoLaunch}
                      onChange={(e) => setModoAutoLaunch(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 bg-slate-900 border-slate-700"
                    />
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>Auto-Gravar</span>
                    </span>
                  </label>
                </div>
              </div>

              {/* Viewport de Vídeo do html5-qrcode */}
              <div className="relative overflow-hidden rounded-2xl bg-black min-h-[260px] flex flex-col items-center justify-center border border-slate-800 shadow-inner">
                {/* Contêiner DOM permanente para a câmera */}
                <div
                  id={scannerContainerId}
                  className="w-full h-full min-h-[260px]"
                />

                {/* Painel Inicial antes da ativação - Adaptativo dependendo do iFrame Sandbox */}
                {!scannerAtivo && (permissaoCamera === 'NAO_SOLICITADA' || permissaoCamera === 'SOLICITANDO') && (
                  <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center text-center p-5 sm:p-6 space-y-4">
                    <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.2)]">
                      <Camera className="w-8 h-8 animate-pulse" />
                    </div>
                    
                    <div className="max-w-md space-y-2">
                      <h4 className="text-sm font-black text-white">Leitor de QR Code de Nota Fiscal (NFC-e)</h4>
                      
                      {/* APENAS exibe o aviso do iFrame se realmente estiver rodando dentro do iFrame Sandbox */}
                      {typeof window !== 'undefined' && window.self !== window.top ? (
                        <div className="p-3.5 rounded-xl bg-slate-900/90 border-2 border-indigo-500/50 text-[11px] text-slate-300 leading-relaxed font-sans text-left space-y-2 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
                          <span className="font-black text-indigo-400 flex items-center gap-1.5 uppercase">
                            🌐 SOLUÇÃO DEFINITIVA (ABRIR EM NOVA ABA):
                          </span>
                          <p>
                            Como esta aplicação está rodando em ambiente de testes (<strong>iFrame Sandbox</strong>), o navegador bloqueia a câmera nativamente para proteger sua privacidade.
                          </p>
                          <p className="text-emerald-400 font-bold">
                            💡 Clique no botão azul abaixo para abrir em uma Nova Aba fora do iFrame. Lá, o navegador liberará o pop-up de câmera para você escanear normalmente com vídeo contínuo!
                          </p>
                          <button
                            type="button"
                            onClick={() => window.open(window.location.href, '_blank')}
                            className="w-full mt-1.5 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-black shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer animate-pulse"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>ABRIR EM NOVA ABA (Câmera Liberada)</span>
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                          Aponte sua câmera para o QR Code da nota fiscal eletrônica (NFC-e) para realizar a leitura e o lançamento contábil imediato.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md pt-1">
                      {/* Exibição condicional de botões */}
                      {typeof window !== 'undefined' && window.self !== window.top ? (
                        <>
                          {/* Método 1: Captura Nativa (Câmera do Sistema) */}
                          <label className="flex-1 w-full px-5 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-slate-950 font-mono text-xs font-black cursor-pointer shadow-[0_0_25px_rgba(16,185,129,0.35)] transition-all flex items-center justify-center gap-2 group transform active:scale-95 text-center">
                            <Smartphone className="w-4 h-4 text-slate-950 animate-bounce" />
                            <span>MÉTODO 1: TIRAR FOTO DA NOTA</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={processarFotoNativa}
                              className="hidden"
                            />
                          </label>

                          <button
                            type="button"
                            disabled={permissaoCamera === 'SOLICITANDO'}
                            onClick={iniciarScannerCamera}
                            className="w-full sm:w-auto px-4 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5"
                          >
                            {permissaoCamera === 'SOLICITANDO' ? (
                              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                            ) : (
                              <Camera className="w-4 h-4 text-slate-400" />
                            )}
                            <span>Método 2: Tentar Vídeo</span>
                          </button>
                        </>
                      ) : (
                        // Fora do iFrame (Aba Limpa): Exibe o botão principal de Ativar Câmera e Escanear com GLOW!
                        <button
                          type="button"
                          disabled={permissaoCamera === 'SOLICITANDO'}
                          onClick={iniciarScannerCamera}
                          className="flex-1 w-full px-6 py-4 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-mono text-xs font-black cursor-pointer shadow-[0_0_25px_rgba(244,63,94,0.4)] transition-all flex items-center justify-center gap-2 transform active:scale-95"
                        >
                          {permissaoCamera === 'SOLICITANDO' ? (
                            <RefreshCw className="w-4.5 h-4.5 animate-spin text-white" />
                          ) : (
                            <Camera className="w-4.5 h-4.5 text-white" />
                          )}
                          <span>[ ATIVAR CÂMERA E ESCANEAR ]</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Painel de Permissão Negada ou Erro com Ações de Desbloqueio */}
                {(permissaoCamera === 'NEGADA' || permissaoCamera === 'INDISPONIVEL' || permissaoCamera === 'ERRO') && (
                  <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                      <VideoOff className="w-6 h-6" />
                    </div>
                    <div className="max-w-md space-y-1">
                      <p className="font-bold text-white text-sm">
                        {permissaoCamera === 'NEGADA' ? 'Permissão de Câmera Bloqueada no Navegador' : 'Câmera Indisponível'}
                      </p>
                      <p className="text-slate-400 text-xs">
                        {mensagemErroCamera || 'O navegador rejeitou a solicitação de vídeo em tempo real (NotAllowedError).'}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900 border-2 border-indigo-500/50 max-w-md text-left text-xs font-sans text-slate-300 space-y-2.5 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
                      <span className="font-black text-indigo-400 flex items-center gap-1.5 uppercase text-xs font-mono">
                        🌐 SOLUÇÃO RÁPIDA: ABRIR EM NOVA ABA
                      </span>
                      <p className="leading-relaxed">
                        Se a permissão foi negada automaticamente por conta do <strong>iFrame Sandbox</strong> do ambiente, clique no botão azul abaixo para abrir em uma janela limpa, onde o navegador solicitará a permissão de câmera normalmente!
                      </p>
                      <button
                        type="button"
                        onClick={() => window.open(window.location.href, '_blank')}
                        className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-black shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4 animate-bounce" />
                        <span>ABRIR EM NOVA ABA (Câmera Liberada)</span>
                      </button>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 max-w-md text-left text-xs font-sans text-slate-300 space-y-2">
                      <span className="font-black text-amber-400 flex items-center gap-1.5 uppercase text-xs font-mono">
                        <Smartphone className="w-4 h-4" /> 📲 SE ESTIVER NO CHROME DO CELULAR:
                      </span>
                      <p className="leading-relaxed">
                        Caso o bloqueio persista mesmo fora do iFrame, limpe a permissão salva:
                      </p>
                      <div className="space-y-1.5 pl-1.5 font-mono text-[11px] text-slate-400">
                        <p>1. No Chrome, toque no ícone de <strong>Controles (Cadeado)</strong> à esquerda da URL.</p>
                        <p>2. Toque em <strong>"Permissões"</strong> ou <strong>"Configurações do Site"</strong>.</p>
                        <p>3. Ative a chave de <strong>Câmera</strong> para <strong>"Permitir"</strong>.</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={iniciarScannerCamera}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold cursor-pointer transition-all shadow-lg flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Solicitar Permissão Novamente</span>
                      </button>

                      <label className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold cursor-pointer transition-all shadow-lg flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Tirar Foto da Nota (Câmera Nativa)</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={processarFotoNativa}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {scannerAtivo && (
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
                  <span className="flex items-center gap-1.5 text-rose-400 font-bold">
                    <QrCode className="w-4 h-4 animate-pulse" />
                    Aponte para o QR Code da Nota Fiscal
                  </span>
                  <button
                    type="button"
                    onClick={pararScanner}
                    className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-rose-300 hover:text-white hover:bg-rose-600/30 text-[11px] cursor-pointer"
                  >
                    Pausar Câmera
                  </button>
                </div>
              )}
            </div>

            {/* PAINEL RECOLHÍVEL DE DIAGNÓSTICO E LOGS DE DEPURACÃO */}
            {painelLogsAberto && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white uppercase text-[11px]">
                      Console de Auditoria & Logs de Depuração ({logsDepuracao.length} eventos)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={executarDiagnosticoPoliticas}
                      disabled={executandoDiagnostico}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${executandoDiagnostico ? 'animate-spin' : ''}`} />
                      <span>Re-executar Testes</span>
                    </button>

                    <button
                      type="button"
                      onClick={copiarLogs}
                      className="px-2.5 py-1 rounded-lg bg-indigo-950 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 text-[10px] cursor-pointer flex items-center gap-1"
                    >
                      {copiadoLogs ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiadoLogs ? 'Copiado!' : 'Copiar Logs'}</span>
                    </button>
                  </div>
                </div>

                {/* Caixa de Logs com Rolagem */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 max-h-52 overflow-y-auto space-y-1.5 text-[11px]">
                  {logsDepuracao.length === 0 ? (
                    <span className="text-slate-500 italic">Nenhum log registrado ainda.</span>
                  ) : (
                    logsDepuracao.map((log, i) => {
                      const corTexto =
                        log.tipo === 'SUCESSO'
                          ? 'text-emerald-400'
                          : log.tipo === 'ERRO'
                          ? 'text-rose-400 font-bold'
                          : log.tipo === 'AVISO'
                          ? 'text-amber-400'
                          : 'text-cyan-300';

                      return (
                        <div key={i} className="flex items-start gap-2 leading-tight">
                          <span className="text-slate-500 text-[10px] shrink-0">{log.timestamp}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${
                            log.tipo === 'SUCESSO' ? 'bg-emerald-950 text-emerald-300' :
                            log.tipo === 'ERRO' ? 'bg-rose-950 text-rose-300' :
                            log.tipo === 'AVISO' ? 'bg-amber-950 text-amber-300' : 'bg-slate-950 text-cyan-300'
                          }`}>
                            {log.categoria}
                          </span>
                          <span className={`${corTexto} flex-1`}>{log.mensagem}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* CARD DE DETALHES DO JSON EXTRAÍDO SE DETECTADO */}
            {dadosUltimoJson && (
              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-indigo-300">
                  <span className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    Dados JSON / NFC-e Extraídos com Sucesso
                  </span>
                  <span className="text-[10px] bg-indigo-900/60 border border-indigo-500/30 px-2 py-0.5 rounded text-indigo-200">
                    {dadosUltimoJson.formatoDetectado}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-slate-300">
                  <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">VALOR IDENTIFICADO:</span>
                    <strong className="text-emerald-400 text-sm">R$ {dadosUltimoJson.valor.toFixed(2)}</strong>
                  </div>
                  <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">DATA EMISSÃO:</span>
                    <strong className="text-white">{dadosUltimoJson.data}</strong>
                  </div>
                  <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800 truncate">
                    <span className="text-slate-500 text-[10px] block">CENTRO SUGERIDO:</span>
                    <strong className="text-cyan-300 truncate">{dadosUltimoJson.centroCustoSugerido}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* FORMULÁRIO DE LANÇAMENTO CONTÁBIL */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Valor da Despesa */}
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">
                    VALOR DA DESPESA (R$) *
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 absolute left-3 top-3.5 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="0,00"
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 pl-9 text-white font-mono text-sm focus:border-rose-500 focus:outline-none font-bold"
                    />
                  </div>
                </div>

                {/* Data do Documento */}
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">
                    DATA DA NOTA / DESPESA *
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-3.5 text-slate-500" />
                    <input
                      type="date"
                      required
                      value={data}
                      onChange={(e) => setData(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 pl-9 text-white font-mono text-sm focus:border-rose-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Descrição do Lançamento */}
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  DESCRIÇÃO DO LANÇAMENTO *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Sinal Locação Centro de Convenções Salvador"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-xs focus:border-rose-500 focus:outline-none font-medium"
                />
              </div>

              {/* Centro de Custo */}
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  CENTRO DE CUSTO AGO *
                </label>
                <select
                  value={centroCusto}
                  onChange={(e) => setCentroCusto(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-xs focus:border-rose-500 focus:outline-none font-mono"
                >
                  {CENTROS_CUSTO_AGO.filter((cc) => cc !== 'TODOS').map((cc) => (
                    <option key={cc} value={cc}>
                      {cc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chave NFC-e de Auditoria SEFAZ */}
              {chaveNfce && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                  <span className="truncate">
                    Chave NFC-e: <strong className="text-white">{chaveNfce}</strong>
                  </span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">
                    SEFAZ Válida
                  </span>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    pararScanner();
                    limparFormulario();
                    onFechar();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvando}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-mono text-xs font-black shadow-[0_0_20px_rgba(244,63,94,0.35)] transition-all cursor-pointer flex items-center gap-2"
                >
                  {salvando ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Gravando no DRE...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar Lançamento</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// Alias de exportação para compatibilidade com o nome 'AdminLancarDespesas'
export const AdminLancarDespesas = ModalLancamentoDespesaQr;
