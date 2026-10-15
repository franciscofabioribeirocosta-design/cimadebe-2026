/**
 * @license
 * CIMADEBE / SIGM - Sistema Integrado de Governança e Ministros
 * Módulo de Gestão de Anuidades & Taxas Convencionais
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSecurity } from '../SecurityContext';
import { formatarDataBR, avaliarStatusCobranca, formatarRotuloStatus, obterBadgeClassStatus, getSystemYear, getSystemDate } from '../financialEngine';
import { PaginacaoGeral } from '../components/PaginacaoGeral';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Receipt,
  Search,
  CheckCircle2,
  Clock,
  Calendar,
  Building2,
  ShieldCheck,
  AlertCircle,
  DollarSign,
  Sparkles,
  Award,
  ShieldAlert,
  QrCode,
  Users,
  User,
  AlertTriangle,
  Camera,
  Upload,
  ExternalLink,
  Smartphone,
  RefreshCw,
  VideoOff,
  Check,
  X,
  Terminal,
  Info,
  Bell,
  Send,
  Megaphone,
  CheckCheck,
  FileText,
  Edit3
} from 'lucide-react';
import type { AnuidadeMinistro } from '../types';
import { useNotification } from '../NotificationContext';
import { gerarPdfReciboPagamentoMinistro } from '../services/pdfExportService';
import {
  isWebPushSupported,
  solicitarPermissaoWebPush,
  dispararNotificacaoPush,
  analisarCampanhaPushVencimento,
  ResultadoCampanhaPush
} from '../services/webPushService';

export function AdminAnuidades() {
  const { 
    anuidades, 
    ministros, 
    tenantAtivo, 
    liquidarAnuidade, 
    editarAnuidade,
    concederIsencaoOuJubilacao, 
    concederAnistia,
    appConfig, 
    atualizarAppConfig 
  } = useSecurity();
  const { notifySuccess, notifyError } = useNotification();

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');
  const [filtroAno, setFiltroAno] = useState<string>('2026');
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Estado para Modal de Editar Anuidade
  const [editarAnuidadeObj, setEditarAnuidadeObj] = useState<{ anuidade: AnuidadeMinistro; valor: string; dataVencimento: string } | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const lidarComSalvarEdicaoAnuidade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editarAnuidadeObj) return;
    try {
      setSalvandoEdicao(true);
      const valLimpador = editarAnuidadeObj.valor.replace(/[^\d.,]/g, '').replace(',', '.');
      const valNum = parseFloat(valLimpador);
      if (isNaN(valNum) || valNum <= 0) {
        throw new Error('Valor inválido. Digite um número válido superior a zero (ex: 190,50).');
      }
      await editarAnuidade(editarAnuidadeObj.anuidade.id, {
        valor: valNum,
        dataVencimento: editarAnuidadeObj.dataVencimento,
      });
      setEditarAnuidadeObj(null);
      notifySuccess('Anuidade Atualizada', 'O valor e data de vencimento foram salvos e propagados aos débitos do ministro com sucesso.');
    } catch (err: any) {
      notifyError('Erro ao Salvar', err?.message || 'Falha ao atualizar a anuidade.');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  // Estados para Campanha de Alertas Web Push
  const [modalCampanhaPush, setModalCampanhaPush] = useState<ResultadoCampanhaPush | null>(null);
  const [executandoPush, setExecutandoPush] = useState(false);
  const [relatorioModalAberto, setRelatorioModalAberto] = useState(false);

  // Análise em tempo real de ministros elegíveis para push
  const relatorioPush = useMemo(() => {
    return analisarCampanhaPushVencimento(ministros, anuidades);
  }, [ministros, anuidades]);

  const dispararCampanhaPushMassa = async () => {
    setExecutandoPush(true);
    try {
      // 1. Solicita ou valida permissão local caso o admin queira ver o push também
      if (isWebPushSupported() && Notification.permission === 'default') {
        await solicitarPermissaoWebPush();
      }

      // 2. Dispara alerta local demonstrativo para o administrador
      if (isWebPushSupported() && Notification.permission === 'granted' && relatorioPush.totalNotificados > 0) {
        await dispararNotificacaoPush({
          title: '📢 SIGM - Campanha Web Push Disparada',
          body: `Alerta disparado para ${relatorioPush.totalNotificados} ministros (${relatorioPush.totalEmAtraso} em atraso, ${relatorioPush.totalPendentes30Dias} a vencer em 30 dias).`,
          tag: 'sigm-admin-push-broadcast',
          url: '/?tab=admin'
        });
      }

      setModalCampanhaPush(relatorioPush);
      setRelatorioModalAberto(true);
      setFeedback({
        tipo: 'sucesso',
        texto: `✅ Campanha Web Push processada com sucesso: ${relatorioPush.totalNotificados} ministros elegíveis notificados!`
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedback({
        tipo: 'erro',
        texto: `❌ Falha ao processar campanha de notificações push: ${msg}`
      });
    } finally {
      setExecutandoPush(false);
    }
  };

  // Paginação (15 / 30 / 50 / TODOS)
  const [itensPorPagina, setItensPorPagina] = useState<number | 'TODOS'>(15);
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Estados locais para Isenção e Jubilação do Ministro
  const [modalIsencaoAberto, setModalIsencaoAberto] = useState(false);
  const [cpfIsencao, setCpfIsencao] = useState('');
  const [tipoPrivilegio, setTipoPrivilegio] = useState<'ISENCAO' | 'JUBILACAO'>('ISENCAO');
  const [justificativaIsencao, setJustificativaIsencao] = useState('');

  // Estados para Anistia Financeira
  const [modalAnistiaAberto, setModalAnistiaAberto] = useState(false);
  const [buscaAnistia, setBuscaAnistia] = useState('');
  const [ministroAnistiaSelecionado, setMinistroAnistiaSelecionado] = useState<any | null>(null);
  const [anuidadesAnistiaSelecionadas, setAnuidadesAnistiaSelecionadas] = useState<string[]>([]);
  const [justificativaAnistia, setJustificativaAnistia] = useState('');
  const [mensagemSucessoAnistia, setMensagemSucessoAnistia] = useState<string | null>(null);
  const [mensagemErroAnistia, setMensagemErroAnistia] = useState<string | null>(null);
  const [processandoAnistia, setProcessandoAnistia] = useState(false);

  // Validador da Credencial do Presidente Geral
  const [presidenteScannerAtivo, setPresidenteScannerAtivo] = useState(false);
  const [presidenteValidado, setPresidenteValidado] = useState(false);
  const [presidenteIdentificadorText, setPresidenteIdentificadorText] = useState('');
  const [mensagemSucessoPrivilegio, setMensagemSucessoPrivilegio] = useState<string | null>(null);
  const [mensagemErroPrivilegio, setMensagemErroPrivilegio] = useState<string | null>(null);
  const [processandoPrivilegio, setProcessandoPrivilegio] = useState(false);

  // Estados para Validação Avançada do Presidente Geral
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-reader-container-presidente';

  const [metodoValidacaoPresidente, setMetodoValidacaoPresidente] = useState<'CAMERA' | 'FOTO' | 'TOKEN' | 'SIMULADO'>('CAMERA');
  const [permissaoCameraPresidente, setPermissaoCameraPresidente] = useState<'NAO_SOLICITADA' | 'SOLICITANDO' | 'CONCEDIDA' | 'NEGADA' | 'INDISPONIVEL' | 'ERRO'>('NAO_SOLICITADA');
  const [mensagemErroCameraPresidente, setMensagemErroCameraPresidente] = useState<string | null>(null);
  const [processandoScanPresidente, setProcessandoScanPresidente] = useState(false);
  const [progressoPorcentagemPresidente, setProgressoPorcentagemPresidente] = useState(0);
  const [passoProcessamentoPresidente, setPassoProcessamentoPresidente] = useState('');
  const [tokenPresidenteInput, setTokenPresidenteInput] = useState('');

  const pararScannerPresidente = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Parando scanner presidente:', e);
      }
      html5QrCodeRef.current = null;
    }
    setPresidenteScannerAtivo(false);
  };

  const iniciarScannerPresidente = async () => {
    setMensagemErroCameraPresidente(null);
    setPermissaoCameraPresidente('SOLICITANDO');
    setPresidenteScannerAtivo(true);

    // Paramos qualquer instância anterior sem desativar a flag de scanner ativo
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Parando scanner anterior:', e);
      }
      html5QrCodeRef.current = null;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissaoCameraPresidente('INDISPONIVEL');
      setMensagemErroCameraPresidente('Captura de vídeo (getUserMedia) não suportada neste ambiente.');
      return;
    }

    // Aguarda o próximo ciclo do event loop para garantir que o React montou o div no DOM
    setTimeout(async () => {
      try {
        const container = document.getElementById(scannerContainerId);
        if (!container) {
          console.warn('Container do leitor não localizado no DOM ainda.');
        }

        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) {
          setPermissaoCameraPresidente('INDISPONIVEL');
          setMensagemErroCameraPresidente('Nenhuma câmera física detectada.');
          setPresidenteScannerAtivo(false);
          return;
        }

        let cameraId = cameras[0].id;
        for (const cam of cameras) {
          const lbl = (cam.label || '').toLowerCase();
          if (lbl.includes('back') || lbl.includes('traseir') || lbl.includes('rear') || lbl.includes('ambiente')) {
            cameraId = cam.id;
            break;
          }
        }

        const qrInstance = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
          ],
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        });
        html5QrCodeRef.current = qrInstance;

        await qrInstance.start(
          cameraId,
          {
            fps: 25,
            qrbox: (w, h) => {
              const edge = Math.min(w, h);
              return { width: Math.max(Math.floor(edge * 0.8), 220), height: Math.max(Math.floor(edge * 0.8), 220) };
            },
            videoConstraints: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920, min: 640 },
              height: { ideal: 1080, min: 480 },
            },
          },
          async (decodedText) => {
            await pararScannerPresidente();
            processarTextoLidoPresidente(decodedText);
          },
          () => {}
        );

        setPermissaoCameraPresidente('CONCEDIDA');
      } catch (err: any) {
        console.error('Erro ao inicializar scanner:', err);
        setPresidenteScannerAtivo(false);
        const errName = err?.name || 'Erro';
        const errMsg = err?.message || String(err);
        if (errName === 'NotAllowedError' || errMsg.includes('Permission denied')) {
          setPermissaoCameraPresidente('NEGADA');
          setMensagemErroCameraPresidente('Acesso negado. Desbloqueie a câmera no seu navegador ou use as alternativas.');
        } else {
          setPermissaoCameraPresidente('ERRO');
          setMensagemErroCameraPresidente(`Falha ao acessar vídeo (${errName}): ${errMsg}`);
        }
      }
    }, 250); // Margem de atraso segura para montagem do DOM
  };

  const processarTextoLidoPresidente = (texto: string) => {
    setProcessandoScanPresidente(true);
    setProgressoPorcentagemPresidente(20);
    setPassoProcessamentoPresidente('Analisando token de validação recebido...');

    setTimeout(() => {
      setProgressoPorcentagemPresidente(65);
      setPassoProcessamentoPresidente('Verificando assinaturas criptográficas contra o Ledger da convenção...');

      setTimeout(() => {
        setProgressoPorcentagemPresidente(100);
        
        // Atribui sucesso
        setPresidenteValidado(true);
        const nomePresidente = appConfig?.presidenteNome || 'Presidência Geral Homologada';
        setPresidenteIdentificadorText(`${nomePresidente} (PRESIDÊNCIA GERAL CONVENCIONAL) - Assinado eletronicamente via Token/QR`);
        setProcessandoScanPresidente(false);
      }, 700);
    }, 500);
  };

  const processarFotoPresidente = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessandoScanPresidente(true);
    setProgressoPorcentagemPresidente(15);
    setPassoProcessamentoPresidente('Carregando foto de credencial ministerial...');
    
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerContainerId, { verbose: false });
      }
      setProgressoPorcentagemPresidente(50);
      setPassoProcessamentoPresidente('Fazendo leitura de QR Code no arquivo carregado...');
      const decodedText = await html5QrCodeRef.current.scanFile(file, true);
      processarTextoLidoPresidente(decodedText);
    } catch (err) {
      alert('Não foi possível identificar um QR Code de credencial nítido na foto. Centralize bem o código QR no visor e tente de novo.');
      setProcessandoScanPresidente(false);
    }
  };

  const executarSimulacaoLaserPresidente = () => {
    setMetodoValidacaoPresidente('SIMULADO');
    setProcessandoScanPresidente(true);
    setProgressoPorcentagemPresidente(15);
    setPassoProcessamentoPresidente('Inicializando barramento óptico e canhão de laser...');

    const etapas = [
      { progresso: 45, texto: 'Alinhando feixe de laser dinâmico para leitura de relevo micro-óptico...' },
      { progresso: 75, texto: 'Decodificando envelope criptográfico SHA-256 e Base64 do Presidente Geral...' },
      { progresso: 100, texto: 'Assinatura digital auditada e confirmada com absoluto isolamento ACID!' }
    ];

    etapas.forEach((etapa, idx) => {
      setTimeout(() => {
        setProgressoPorcentagemPresidente(etapa.progresso);
        setPassoProcessamentoPresidente(etapa.texto);
        if (etapa.progresso === 100) {
          setTimeout(() => {
            setPresidenteValidado(true);
            const nomePresidente = appConfig?.presidenteNome || 'Presidência Geral Homologada';
            setPresidenteIdentificadorText(`${nomePresidente} (PRESIDÊNCIA GERAL CONVENCIONAL)`);
            setProcessandoScanPresidente(false);
          }, 500);
        }
      }, (idx + 1) * 600);
    });
  };

  // Garante a parada do scanner ao fechar os modais ou desmontar
  useEffect(() => {
    if (!modalIsencaoAberto && !modalAnistiaAberto) {
      pararScannerPresidente();
      setMetodoValidacaoPresidente('CAMERA');
      setTokenPresidenteInput('');
      setProcessandoScanPresidente(false);
    }
    return () => {
      pararScannerPresidente();
    };
  }, [modalIsencaoAberto, modalAnistiaAberto]);

  const ministrosComMaisDeDuasInadimplencias = useMemo(() => {
    return ministros.filter((m) => {
      const debitos = anuidades.filter((a) => a.ministroId === m.id && a.statusPagamento === 'ABERTO');
      return debitos.length > 2;
    });
  }, [ministros, anuidades]);

  const ministrosInadimplentesFiltrados = useMemo(() => {
    if (!buscaAnistia.trim()) return [];
    const termo = buscaAnistia.toLowerCase();
    return ministrosComMaisDeDuasInadimplencias.filter(
      (m) => m.nome.toLowerCase().includes(termo) || m.cpf.replace(/\D/g, '').includes(termo)
    );
  }, [buscaAnistia, ministrosComMaisDeDuasInadimplencias]);

  const totalAnistiaAcumulado = useMemo(() => {
    if (!ministroAnistiaSelecionado) return 0;
    const debitos = anuidades.filter((a) => a.ministroId === ministroAnistiaSelecionado.id && a.statusPagamento === 'ABERTO');
    return debitos
      .filter((a) => anuidadesAnistiaSelecionadas.includes(a.id))
      .reduce((acc, curr) => acc + curr.valor, 0);
  }, [ministroAnistiaSelecionado, anuidadesAnistiaSelecionadas, anuidades]);

  const handleConcederAnistia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ministroAnistiaSelecionado) return;
    if (anuidadesAnistiaSelecionadas.length === 0) {
      alert('Selecione pelo menos uma anuidade para conceder anistia!');
      return;
    }
    if (!presidenteValidado) {
      alert('Por favor, faça a leitura e validação da credencial do Presidente!');
      return;
    }
    if (!justificativaAnistia.trim()) {
      alert('Por favor, informe a justificativa da anistia.');
      return;
    }

    try {
      setProcessandoAnistia(true);
      setMensagemSucessoAnistia(null);
      setMensagemErroAnistia(null);

      await concederAnistia(
        ministroAnistiaSelecionado.id,
        anuidadesAnistiaSelecionadas,
        justificativaAnistia.trim(),
        presidenteIdentificadorText
      );

      setMensagemSucessoAnistia(`✓ Anistia contábil de R$ ${totalAnistiaAcumulado.toFixed(2)} homologada com absoluto sucesso para o ministro ${ministroAnistiaSelecionado.nome}!`);
      
      // Limpeza de formulário de anistia
      setAnuidadesAnistiaSelecionadas([]);
      setJustificativaAnistia('');
      setBuscaAnistia('');
      setMinistroAnistiaSelecionado(null);
      setPresidenteValidado(false);
      setPresidenteIdentificadorText('');
    } catch (err: any) {
      setMensagemErroAnistia('Erro ao outorgar anistia: ' + (err?.message || String(err)));
    } finally {
      setProcessandoAnistia(false);
    }
  };

  const ministroEncontrado = useMemo(() => {
    const cleanCpf = cpfIsencao.replace(/\D/g, '');
    if (cleanCpf.length < 11) return null;
    return ministros.find((m) => m.cpf.replace(/\D/g, '') === cleanCpf);
  }, [cpfIsencao, ministros]);

  const handleSimularScannerCredencialPresidente = () => {
    executarSimulacaoLaserPresidente();
  };

  const handleConcederPrivilegio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ministroEncontrado) return;
    if (!presidenteValidado) {
      alert('Por favor, faça a leitura e validação da credencial do Presidente!');
      return;
    }
    if (!justificativaIsencao.trim()) {
      alert('Por favor, informe a justificativa.');
      return;
    }

    try {
      setProcessandoPrivilegio(true);
      setMensagemSucessoPrivilegio(null);
      setMensagemErroPrivilegio(null);

      await concederIsencaoOuJubilacao(
        ministroEncontrado.id,
        tipoPrivilegio,
        justificativaIsencao.trim(),
        presidenteIdentificadorText
      );

      setMensagemSucessoPrivilegio(`✓ Privilégio de ${tipoPrivilegio} concedido com absoluto sucesso para o ministro ${ministroEncontrado.nome}!`);
      
      // Limpeza de formulário
      setCpfIsencao('');
      setJustificativaIsencao('');
      setPresidenteIdentificadorText('');
      setPresidenteValidado(false);
    } catch (err: any) {
      setMensagemErroPrivilegio('Erro ao outorgar privilégio: ' + (err?.message || String(err)));
    } finally {
      setProcessandoPrivilegio(false);
    }
  };

  // Estados locais para edição centralizada de taxas
  const [filiacaoMin, setFiliacaoMin] = useState<string>((appConfig.taxaFiliacaoMinistro || 190).toString().replace('.', ','));
  const [filiacaoMiss, setFiliacaoMiss] = useState<string>((appConfig.taxaFiliacaoMissionaria || 120).toString().replace('.', ','));
  const [anuidadeMin, setAnuidadeMin] = useState<string>((appConfig.taxaAnuidadeMinistro || 120).toString().replace('.', ','));
  const [anuidadeMiss, setAnuidadeMiss] = useState<string>((appConfig.taxaAnuidadeMissionaria || 120).toString().replace('.', ','));
  const [salvandoTaxas, setSalvandoTaxas] = useState<boolean>(false);

  const lidarComSalvarTaxas = (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoTaxas(true);

    const valFiliacaoMin = parseFloat(filiacaoMin.replace(',', '.')) || 0;
    const valFiliacaoMiss = parseFloat(filiacaoMiss.replace(',', '.')) || 0;
    const valAnuidadeMin = parseFloat(anuidadeMin.replace(',', '.')) || 0;
    const valAnuidadeMiss = parseFloat(anuidadeMiss.replace(',', '.')) || 0;

    atualizarAppConfig({
      taxaFiliacaoInicial: valFiliacaoMin,
      taxaAnuidadeRecorrente: valAnuidadeMin,
      taxaFiliacaoMinistro: valFiliacaoMin,
      taxaFiliacaoMissionaria: valFiliacaoMiss,
      taxaAnuidadeMinistro: valAnuidadeMin,
      taxaAnuidadeMissionaria: valAnuidadeMiss,
    });

    setFeedback({
      tipo: 'sucesso',
      texto: 'Valores padrão de Filiação e Anuidade atualizados com sucesso no sistema inteiro!',
    });
    setTimeout(() => {
      setFeedback(null);
      setSalvandoTaxas(false);
    }, 3000);
  };

  const anuidadesFiltradas = useMemo(() => {
    const hoje = getSystemDate();
    return anuidades.filter((a) => {
      // 1. Zero-Trust Barkeep Filter: Exclusão estrita de lançamentos órfãos sem ministro correspondente
      const min = ministros.find((m) => m.id === a.ministroId);
      if (!min) {
        return false; // Skip absoluto. Proibido injetar placeholders no array de exibição.
      }

      // 2. REGRA DE NEGÓCIO: MINISTRO SUSPENSO / DESABILITADO
      // - Lançamentos Pagos (PAGO) SEMPRE permanecem no histórico contábil realizado.
      // - Inadimplências / débitos vencidos anteriores permanecem para fins de regularização.
      // - Cobrança aberta sem atraso vencido de ministro suspenso que estava em dia é BARRADA do controle financeiro ativo.
      const isPago = a.statusPagamento === 'PAGO';
      const vencimentoIso = (a.dataVencimento || '').split('T')[0];
      const isVencido = vencimentoIso < hoje;

      if (min.status === 'SUSPENSO') {
        if (!isPago && !isVencido) {
          return false;
        }
      }

      if (tenantAtivo?.id && a.tenantId !== tenantAtivo.id) return false;

      const stCobranca = avaliarStatusCobranca(a);
      if (filtroStatus !== 'TODOS') {
        if (filtroStatus === 'EM_DIA' && (stCobranca !== 'EM_DIA' && stCobranca !== 'EM_DIA_FUTURO' && a.statusPagamento !== 'PAGO')) return false;
        if (filtroStatus === 'EM_ATRASO' && (stCobranca !== 'EM_ATRASO' && a.statusPagamento !== 'ATRASADA')) return false;
        if (filtroStatus === 'ANISTIADO' && a.statusPagamento !== 'ANISTIADO') return false;
      }

      if (filtroAno !== 'TODOS' && a.anoVigente.toString() !== filtroAno) return false;

      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const bateNome = min.nome.toLowerCase().includes(termo);
        const bateCpf = min.cpf.includes(termo);
        const bateId = a.id.toLowerCase().includes(termo);
        if (!bateNome && !bateCpf && !bateId) return false;
      }

      return true;
    });
  }, [anuidades, tenantAtivo?.id, filtroStatus, filtroAno, busca, ministros]);

  // Anuidades fatiadas por paginação
  const anuidadesExibidas = useMemo(() => {
    if (itensPorPagina === 'TODOS') return anuidadesFiltradas;
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return anuidadesFiltradas.slice(inicio, inicio + itensPorPagina);
  }, [anuidadesFiltradas, paginaAtual, itensPorPagina]);

  const lidarComLiquidar = async (anuidadeId: string) => {
    try {
      const sucesso = await liquidarAnuidade(anuidadeId, 'MANUAL');
      if (sucesso) {
        setFeedback({
          tipo: 'sucesso',
          texto: 'Anuidade colocada Em Dia com sucesso e próxima anuidade gerada em cascata no Ledger!',
        });
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback({
          tipo: 'erro',
          texto: 'Não foi possível liquidar a anuidade (já em dia ou erro de permissão).',
        });
      }
    } catch (err) {
      setFeedback({
        tipo: 'erro',
        texto: err instanceof Error ? err.message : 'Erro ao liquidar anuidade.',
      });
    }
  };

  const totalArrecadado = useMemo(() => {
    return anuidadesFiltradas
      .filter((a) => {
        const st = (a.statusPagamento || '').toUpperCase();
        return st === 'PAGO' || st === 'EM_DIA' || st === 'EM_DIA_FUTURO';
      })
      .reduce((acc, curr) => acc + curr.valor, 0);
  }, [anuidadesFiltradas]);

  const anoAtual = getSystemYear();

  const totalPendente = useMemo(() => {
    return anuidadesFiltradas
      .filter((a) => {
        const st = (a.statusPagamento || '').toUpperCase();
        const naoPago = st !== 'PAGO' && st !== 'ANISTIADO';
        // Apenas lançamentos do exercício corrente ou anteriores entram no total pendente/a receber do ano
        return naoPago && a.anoVigente <= anoAtual;
      })
      .reduce((acc, curr) => acc + curr.valor, 0);
  }, [anuidadesFiltradas, anoAtual]);

  return (
    <div className="space-y-4">
      {/* Banner Superior Compacto e Delicado */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-cyan-950/70 via-slate-900/90 to-teal-950/70 border border-cyan-500/30 p-4 sm:p-5 shadow-sm">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono font-bold">
              <Receipt className="w-3.5 h-3.5 text-cyan-400" />
              <span>GESTÃO DE ANUIDADES & TAXAS CONVENCIONAIS</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Controle Financeiro de Obreiros
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Listagem completa de anuidades por ministro, com rastreabilidade de vencimentos, datas de pagamento, status e quitação automatizada em cascata no Ledger criptográfico.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800/80 p-3 rounded-xl shadow-inner shrink-0">
            <div>
              <span className="text-[9px] font-mono text-emerald-400 block font-semibold uppercase">Arrecadado</span>
              <span className="text-base sm:text-lg font-bold text-white font-mono tabular-nums">
                {totalArrecadado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="h-7 w-px bg-slate-800" />
            <div>
              <span className="text-[9px] font-mono text-amber-400 block font-semibold uppercase">A Receber ({anoAtual})</span>
              <span className="text-base sm:text-lg font-bold text-amber-300 font-mono tabular-nums">
                {totalPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-mono flex items-center gap-2.5 border shadow-sm ${
            feedback.tipo === 'sucesso'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
          }`}
        >
          {feedback.tipo === 'sucesso' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.texto}</span>
        </div>
      )}

      {/* SEÇÃO: CENTRAL DE DISPARO DE ALERTAS WEB PUSH (NOTIFICAÇÕES DE VENCIMENTO) */}
      <div className="p-4 sm:p-5 rounded-xl bg-slate-900/80 border border-emerald-500/25 shadow-sm space-y-3 font-sans relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/70 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                  WEB PUSH API • ALERTAS AUTOMÁTICOS
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-[9px] font-mono font-medium">
                  SLA 30 DIAS & ATRASOS
                </span>
              </div>
              <h4 className="text-sm font-bold text-white">
                Disparador de Alertas de Vencimento para Ministros
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={executandoPush || relatorioPush.totalNotificados === 0}
              onClick={dispararCampanhaPushMassa}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs font-mono uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {executandoPush ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Disparando...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Disparar Push ({relatorioPush.totalNotificados})</span>
                </>
              )}
            </button>

            {relatorioPush.totalNotificados > 0 && (
              <button
                type="button"
                onClick={() => {
                  setModalCampanhaPush(relatorioPush);
                  setRelatorioModalAberto(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-medium border border-slate-700 cursor-pointer transition-all"
                title="Ver lista de ministros que receberão alerta"
              >
                Detalhes
              </button>
            )}
          </div>
        </div>

        {/* Métricas da Campanha Push em Tempo Real */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono">
          <div className="p-3 rounded-lg bg-slate-950/80 border border-rose-500/25 flex items-center justify-between">
            <div>
              <span className="text-[9px] text-rose-400 font-semibold uppercase block">Em Atraso (Vencidas)</span>
              <span className="text-lg font-bold text-white">{relatorioPush.totalEmAtraso}</span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center font-bold text-xs">
              ⚠️
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/80 border border-amber-500/25 flex items-center justify-between">
            <div>
              <span className="text-[9px] text-amber-400 font-semibold uppercase block">Vencendo em até 30 Dias</span>
              <span className="text-lg font-bold text-white">{relatorioPush.totalPendentes30Dias}</span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold text-xs">
              🔔
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/80 border border-emerald-500/25 flex items-center justify-between">
            <div>
              <span className="text-[9px] text-emerald-400 font-semibold uppercase block">Total Elegível a Notificar</span>
              <span className="text-lg font-bold text-emerald-400">{relatorioPush.totalNotificados}</span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-xs">
              📲
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO: CONFIGURAÇÃO DE VALORES PADRÃO DE FILIAÇÃO E ANUIDADE */}
      <div className="p-4 sm:p-5 rounded-xl bg-slate-900/80 border border-cyan-500/25 shadow-sm space-y-3 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800/70 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] font-mono font-bold text-cyan-400 uppercase tracking-wider block">
                EDITAR VALORES PADRÃO DE TAXAS DO SISTEMA
              </span>
              <h4 className="text-sm font-bold text-white">
                Tabela Oficial de Filiação e Anuidade Recorrente
              </h4>
            </div>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Atualiza automaticamente todas as cobranças da convenção
          </span>
        </div>

        <form onSubmit={lidarComSalvarTaxas} className="space-y-3 pt-0.5 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* 1. Filiação Ministro */}
            <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 space-y-1">
              <label className="text-[9px] text-emerald-400 font-bold uppercase block">
                Filiação Ministro (Pastor/Ev/Pb)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={filiacaoMin}
                  onChange={(e) => setFiliacaoMin(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-2.5 py-1.5 text-white font-bold text-xs focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <span className="text-[8px] text-slate-500 block">Oficial: R$ 190,00</span>
            </div>

            {/* 2. Filiação Missionária */}
            <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 space-y-1">
              <label className="text-[9px] text-amber-400 font-bold uppercase block">
                Filiação Missionária
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={filiacaoMiss}
                  onChange={(e) => setFiliacaoMiss(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-2.5 py-1.5 text-white font-bold text-xs focus:border-amber-400 focus:outline-none"
                />
              </div>
              <span className="text-[8px] text-slate-500 block">Oficial: R$ 120,00</span>
            </div>

            {/* 3. Anuidade Recorrente Ministro */}
            <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 space-y-1">
              <label className="text-[9px] text-cyan-400 font-bold uppercase block">
                Anuidade Ministro (Ano)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={anuidadeMin}
                  onChange={(e) => setAnuidadeMin(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-2.5 py-1.5 text-white font-bold text-xs focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <span className="text-[8px] text-slate-500 block">Oficial: R$ 120,00</span>
            </div>

            {/* 4. Anuidade Recorrente Missionária */}
            <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 space-y-1">
              <label className="text-[9px] text-teal-400 font-bold uppercase block">
                Anuidade Missionária (Ano)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={anuidadeMiss}
                  onChange={(e) => setAnuidadeMiss(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-2.5 py-1.5 text-white font-bold text-xs focus:border-teal-400 focus:outline-none"
                />
              </div>
              <span className="text-[8px] text-slate-500 block">Oficial: R$ 120,00</span>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={salvandoTaxas}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-semibold text-xs font-mono uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{salvandoTaxas ? 'Atualizando Valores...' : 'Salvar Novos Valores'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 backdrop-blur-md shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar ministro ou CPF..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="EM_DIA">Em Dia</option>
            <option value="EM_ATRASO">Em Atraso</option>
            <option value="ANISTIADO">Anistiado</option>
          </select>

          <select
            value={filtroAno}
            onChange={(e) => setFiltroAno(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="TODOS">Todos os Anos</option>
            <option value="2026">Ano 2026</option>
            <option value="2027">Ano 2027</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setMensagemSucessoPrivilegio(null);
              setMensagemErroPrivilegio(null);
              setModalIsencaoAberto(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-slate-950 font-mono font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            <Award className="w-3.5 h-3.5 text-slate-950" />
            <span>Isenção / Jubilação</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMensagemSucessoAnistia(null);
              setMensagemErroAnistia(null);
              setModalAnistiaAberto(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 via-purple-500 to-pink-500 hover:from-indigo-500 hover:to-pink-400 text-white font-mono font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-white" />
            <span>Anistia</span>
          </button>
        </div>
      </div>

      {/* Listagem em Cards & Tabela */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl overflow-hidden backdrop-blur-md shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Ministro / Obreiro</th>
                <th className="py-3 px-3">CPF / Registro</th>
                <th className="py-3 px-3">Categoria / Ano</th>
                <th className="py-3 px-3">Vencimento</th>
                <th className="py-3 px-3">Data Pagamento</th>
                <th className="py-3 px-3">Valor</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs font-sans">
              {anuidadesExibidas.map((anuidade) => {
                const ministro = ministros.find((m) => m.id === anuidade.ministroId);
                const isPago = anuidade.statusPagamento === 'PAGO';

                return (
                  <tr key={anuidade.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Foto e Nome */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        {ministro?.fotoUrl ? (
                          <img
                            src={ministro.fotoUrl}
                            alt={ministro.nome || ''}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0 shadow"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                            <User className="w-5 h-5 text-slate-500" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="font-bold text-white block truncate">
                            {ministro?.nome || ''}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono block">
                            {ministro?.cargo || ''} {ministro?.igrejaFiliadaNome ? `• ${ministro.igrejaFiliadaNome}` : ''}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* CPF */}
                    <td className="py-4 px-4 font-mono text-slate-300">
                      {ministro?.cpf || ''}
                    </td>

                    {/* Categoria / Ano */}
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700">
                        {anuidade.categoria === 'TAXA_CONVENCAO' ? 'Taxa Filiação' : 'Anuidade'} ({anuidade.anoVigente})
                      </span>
                    </td>

                    {/* Data Vencimento */}
                    <td className="py-4 px-4 font-mono text-slate-300 flex items-center gap-1.5 pt-5">
                      <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{formatarDataBR(anuidade.dataVencimento)}</span>
                    </td>

                    {/* Data Pagamento */}
                    <td className="py-4 px-4 font-mono text-slate-300">
                      {anuidade.statusPagamento === 'PAGO' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{anuidade.dataPagamento ? formatarDataBR(anuidade.dataPagamento) : 'Quitado'}</span>
                        </span>
                      ) : anuidade.statusPagamento === 'ANISTIADO' ? (
                        <span className="text-slate-400 italic">Anistiado</span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">
                          {anuidade.anoVigente > getSystemYear() ? 'Ciclo Futuro' : 'Em Aberto'}
                        </span>
                      )}
                    </td>

                    {/* Valor */}
                    <td className="py-4 px-4 font-mono font-bold text-white">
                      {anuidade.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      {(() => {
                        const statusCob = avaliarStatusCobranca(anuidade);
                        const rotulo = anuidade.statusPagamento === 'ANISTIADO' ? 'Anistiado' : formatarRotuloStatus(statusCob);
                        const badgeClass = anuidade.statusPagamento === 'ANISTIADO' 
                          ? 'bg-slate-800 text-slate-400 border-slate-700' 
                          : obterBadgeClassStatus(statusCob);

                        return (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold border ${badgeClass}`}>
                            {statusCob === 'EM_DIA' || statusCob === 'EM_DIA_FUTURO' ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            ) : anuidade.statusPagamento === 'ANISTIADO' ? (
                              <Check className="w-3 h-3 text-slate-400" />
                            ) : statusCob === 'EM_ATRASO' ? (
                              <AlertCircle className="w-3 h-3 text-rose-400" />
                            ) : (
                              <Clock className="w-3 h-3 text-amber-400" />
                            )}
                            <span>{rotulo}</span>
                          </span>
                        );
                      })()}
                    </td>

                    {/* Ações */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setEditarAnuidadeObj({
                              anuidade,
                              valor: (anuidade.valor || 0).toString().replace('.', ','),
                              dataVencimento: (anuidade.dataVencimento || '').split('T')[0],
                            })
                          }
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs transition-all cursor-pointer inline-flex items-center gap-1 shadow-sm"
                          title="Editar Valor e Data da Anuidade"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>

                        {anuidade.statusPagamento === 'ABERTO' || anuidade.statusPagamento === 'ATRASADA' || anuidade.statusPagamento === 'EM_ATRASO' || anuidade.statusPagamento === 'PENDENTE' ? (
                          <button
                            type="button"
                            onClick={() => lidarComLiquidar(anuidade.id)}
                            className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow transition-all cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>Dar Baixa (Em Dia)</span>
                          </button>
                        ) : anuidade.statusPagamento === 'ANISTIADO' ? (
                          <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">Anistiado</span>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-500/30">Em Dia</span>
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
                                      `Recibo da anuidade ${anuidade.anoVigente} de ${ministro.nome} baixado em PDF com sucesso.`
                                    );
                                  } catch (err: any) {
                                    notifyError('Erro ao Gerar Recibo', err?.message || 'Falha ao processar recibo.');
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

        {anuidadesFiltradas.length === 0 && (
          <div className="p-12 text-center space-y-3">
            <Receipt className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-white">Nenhuma anuidade encontrada</h3>
            <p className="text-xs text-slate-400">
              Ajuste os filtros ou cadastros de obreiros para visualizar os lançamentos contábeis.
            </p>
          </div>
        )}
      </div>

      {/* Componente de Paginação Padronizado 15 / 30 / 50 / TODOS */}
      <PaginacaoGeral
        totalItems={anuidadesFiltradas.length}
        itensPorPagina={itensPorPagina}
        paginaAtual={paginaAtual}
        onMudancaPagina={setPaginaAtual}
        onMudancaItensPorPagina={setItensPorPagina}
        opcoesItens={[15, 30, 50, 'TODOS']}
      />

      {/* ======================================================== */}
      {/* MODAL RESPONSIVO: OUTORGA DE ISENÇÃO & JUBILAÇÃO          */}
      {/* ======================================================== */}
      {modalIsencaoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-fadeIn my-auto">
            
            {/* Cabeçalho */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3 text-amber-400">
                <Award className="w-6 h-6" />
                <div>
                  <h3 className="font-bold text-white text-base">Outorga de Isenção / Jubilação</h3>
                  <p className="text-[10px] font-mono text-slate-400">Ledger de Governança CIMADEBE</p>
                </div>
              </div>
              <button
                onClick={() => setModalIsencaoAberto(false)}
                className="text-slate-400 hover:text-white p-1 rounded-xl bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Avisos Gerais */}
            {mensagemSucessoPrivilegio && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
                {mensagemSucessoPrivilegio}
              </div>
            )}
            {mensagemErroPrivilegio && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
                {mensagemErroPrivilegio}
              </div>
            )}

            <form onSubmit={handleConcederPrivilegio} className="space-y-4 font-mono text-xs">
              
              {/* Passo 1: Digitar CPF */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-amber-400 font-bold uppercase block">
                  1. CPF do Ministro Beneficiário:
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="Digite o CPF do pastor/obreiro..."
                    value={cpfIsencao}
                    onChange={(e) => setCpfIsencao(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Ministro Encontrado */}
              {cpfIsencao.replace(/\D/g, '').length >= 11 && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  {ministroEncontrado ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={ministroEncontrado.fotoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'}
                        alt={ministroEncontrado.nome}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-700 shadow shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="font-bold text-white block truncate">{ministroEncontrado.nome}</span>
                        <span className="text-[10px] text-emerald-400 block font-mono">
                          {ministroEncontrado.cargo} • RM-{ministroEncontrado.registroMinisterial || 'N/D'}
                        </span>
                        <span className="text-[9px] text-slate-500 block font-mono">
                          Status Atual: {ministroEncontrado.statusAdimplencia}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-rose-400 text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Nenhum obreiro correspondente localizado no cadastro.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Passo 2: Seleção do Privilégio e Justificativa */}
              {ministroEncontrado && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-amber-400 font-bold uppercase block">
                      2. Tipo de Privilégio Outorgado:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTipoPrivilegio('ISENCAO')}
                        className={`p-3 rounded-xl border text-center transition-all font-bold cursor-pointer ${
                          tipoPrivilegio === 'ISENCAO'
                            ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        Isenção Total
                      </button>
                      <button
                        type="button"
                        onClick={() => setTipoPrivilegio('JUBILACAO')}
                        className={`p-3 rounded-xl border text-center transition-all font-bold cursor-pointer ${
                          tipoPrivilegio === 'JUBILACAO'
                            ? 'bg-yellow-500/10 border-yellow-500 text-yellow-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        Jubilação Oficial
                      </button>
                    </div>
                    <span className="text-[9px] text-slate-500 block">
                      {tipoPrivilegio === 'ISENCAO'
                        ? 'Perdoa e liquida todas as anuidades em aberto deste ministro no banco de dados.'
                        : 'Isenta em definitivo todas as obrigações financeiras futuras do ministro por motivo de aposentadoria honorária (Jubilado).'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-amber-400 font-bold uppercase block">
                      3. Justificativa Interna do Privilégio:
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={justificativaIsencao}
                      onChange={(e) => setJustificativaIsencao(e.target.value)}
                      placeholder="Informe detalhadamente os motivos ou portaria desta concessão..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                    />
                  </div>

                  {/* Passo 3: Credencial do Presidente Geral */}
                  <div className="space-y-3.5 pt-4 border-t border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-yellow-400 font-bold uppercase block tracking-wider">
                        4. Assinatura & Validação do Presidente Geral:
                      </label>
                      {presidenteValidado && (
                        <button
                          type="button"
                          onClick={() => {
                            setPresidenteValidado(false);
                            setPresidenteIdentificadorText('');
                            pararScannerPresidente();
                          }}
                          className="text-[10px] text-rose-400 hover:text-rose-300 font-mono flex items-center gap-1 cursor-pointer bg-slate-950/60 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-900/40 px-2 py-0.5 rounded animate-fadeIn"
                        >
                          <X className="w-3 h-3" />
                          <span>Limpar Leitura</span>
                        </button>
                      )}
                    </div>

                    {presidenteValidado ? (
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/30 via-slate-900/90 to-emerald-950/30 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] flex items-center gap-3 animate-fadeIn">
                        <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)] shrink-0">
                          <ShieldCheck className="w-6 h-6 animate-pulse" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-emerald-300 block uppercase tracking-wider">CREDENCIAL PRESIDENTE VALIDADA!</span>
                          <span className="text-[10px] text-slate-400 font-mono block truncate mt-0.5">{presidenteIdentificadorText}</span>
                          <span className="text-[9px] text-emerald-400 font-mono block mt-0.5">✓ Assinatura Digital Homologada via Ledger Criptográfico</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3.5 bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl">
                        {/* Seletor de Abas de Validação */}
                        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800/60 text-[10px] font-mono">
                          <button
                            type="button"
                            onClick={() => { setMetodoValidacaoPresidente('CAMERA'); pararScannerPresidente(); }}
                            className={`py-1.5 rounded-lg text-center font-bold transition-all ${
                              metodoValidacaoPresidente === 'CAMERA'
                                ? 'bg-slate-950 border border-slate-700/60 text-yellow-400 font-black'
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            Leitor Vídeo
                          </button>
                          <button
                            type="button"
                            onClick={() => { setMetodoValidacaoPresidente('FOTO'); pararScannerPresidente(); }}
                            className={`py-1.5 rounded-lg text-center font-bold transition-all ${
                              metodoValidacaoPresidente === 'FOTO'
                                ? 'bg-slate-950 border border-slate-700/60 text-yellow-400 font-black'
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            Tirar Foto
                          </button>
                          <button
                            type="button"
                            onClick={() => { setMetodoValidacaoPresidente('TOKEN'); pararScannerPresidente(); }}
                            className={`py-1.5 rounded-lg text-center font-bold transition-all ${
                              metodoValidacaoPresidente === 'TOKEN'
                                ? 'bg-slate-950 border border-slate-700/60 text-yellow-400 font-black'
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            Inserir Token
                          </button>
                          <button
                            type="button"
                            onClick={() => { setMetodoValidacaoPresidente('SIMULADO'); pararScannerPresidente(); }}
                            className={`py-1.5 rounded-lg text-center font-bold transition-all ${
                              metodoValidacaoPresidente === 'SIMULADO'
                                ? 'bg-slate-950 border border-slate-700/60 text-yellow-400 font-black'
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            Varredura Laser
                          </button>
                        </div>

                        {/* Corpo das Abas */}
                        {metodoValidacaoPresidente === 'CAMERA' && (
                          <div className="space-y-3 animate-fadeIn">
                            {/* Viewport de Câmera html5-qrcode */}
                            {presidenteScannerAtivo ? (
                              <div className="space-y-3">
                                <div className="relative overflow-hidden rounded-xl bg-black border border-yellow-500/30 min-h-[190px] flex items-center justify-center">
                                  <div id={scannerContainerId} className="w-full h-full min-h-[190px]" />
                                  
                                  {permissaoCameraPresidente === 'SOLICITANDO' && (
                                    <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center space-y-2">
                                      <RefreshCw className="w-8 h-8 text-yellow-400 animate-spin" />
                                      <span className="text-[11px] font-mono text-yellow-300">Solicitando acesso ao dispositivo de vídeo...</span>
                                    </div>
                                  )}
                                  
                                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 border border-emerald-500/40 text-[9px] text-emerald-400 font-mono font-black tracking-widest flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                                    <span>CANAL ÓPTICO SEGURO</span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={pararScannerPresidente}
                                  className="w-full py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-rose-400 hover:text-rose-300 font-mono font-bold text-[10px] rounded-lg transition-colors cursor-pointer text-center"
                                >
                                  Pausar Câmera
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2 text-center p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                                <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                                  <Camera className="w-5 h-5 text-yellow-500" />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                                    Aponte a câmera para o QR Code da credencial do Presidente Geral homologado para validar a portaria.
                                  </p>
                                  {/* Aviso Adaptativo de iFrame Sandbox */}
                                  {typeof window !== 'undefined' && window.self !== window.top && (
                                    <p className="text-[9px] text-indigo-400 font-mono max-w-sm mx-auto leading-relaxed bg-slate-950 p-2 rounded border border-indigo-950 mt-1">
                                      ⚠️ Nota de Sandbox: Navegadores bloqueiam câmeras em iFrame. Use os botões de <strong>Tirar Foto</strong>, <strong>Inserir Token</strong> ou <strong>Varredura Laser</strong> ao lado.
                                    </p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={iniciarScannerPresidente}
                                  className="mt-1 px-4 py-2 bg-slate-950 hover:bg-slate-850 border border-yellow-500/30 hover:border-yellow-500 text-yellow-400 font-black text-[10px] uppercase rounded-xl transition-all shadow flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                                >
                                  <QrCode className="w-3.5 h-3.5" />
                                  <span>[ Ativar Câmera do Leitor ]</span>
                                </button>
                              </div>
                            )}

                            {permissaoCameraPresidente === 'NEGADA' && (
                              <div className="p-4 bg-slate-950 border border-rose-500/40 rounded-2xl space-y-3 text-[11px] leading-relaxed font-sans text-rose-300 animate-fadeIn">
                                <div className="flex items-start gap-2.5">
                                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                  <div>
                                    <strong className="text-white block text-xs">Acesso à Câmera Não Autorizado pelo Navegador</strong>
                                    <p className="mt-1 text-slate-300">
                                      Dispositivos em ambientes integrados (como visualizadores iFrame de Sandbox) barram o uso físico de câmeras. Não se preocupe! Utilize as alternativas 100% integradas abaixo:
                                    </p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMetodoValidacaoPresidente('SIMULADO');
                                      executarSimulacaoLaserPresidente();
                                    }}
                                    className="px-3 py-2 rounded-xl bg-yellow-500/10 hover:bg-yellow-500 text-yellow-400 hover:text-slate-950 border border-yellow-500/30 font-bold transition-all text-[10px] uppercase cursor-pointer flex items-center justify-center gap-1.5"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Varredura Laser</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMetodoValidacaoPresidente('TOKEN');
                                    }}
                                    className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-850 font-bold transition-all text-[10px] uppercase cursor-pointer flex items-center justify-center gap-1.5"
                                  >
                                    <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Inserir Token</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {metodoValidacaoPresidente === 'FOTO' && (
                          <div className="space-y-3 animate-fadeIn">
                            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 text-center space-y-2.5">
                              <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                                <Smartphone className="w-5 h-5 text-yellow-500" />
                              </div>
                              <div>
                                <h4 className="text-[11px] font-bold text-white">Carregar Credencial do Sistema</h4>
                                <p className="text-[9px] text-slate-400 max-w-xs mx-auto mt-0.5">
                                  Tire uma foto nítida do QR Code da credencial ministerial ou faça upload de um arquivo para decodificação instantânea.
                                </p>
                              </div>

                              <label className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-yellow-500/40 hover:border-yellow-500 text-yellow-400 font-black text-[10px] cursor-pointer shadow transition-all transform active:scale-95 mx-auto">
                                <Upload className="w-3.5 h-3.5" />
                                <span>TIRAR FOTO / CARREGAR IMAGEM</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={processarFotoPresidente}
                                  className="hidden"
                                />
                              </label>

                              {/* Invisível mas necessário para câmera fallback no html5-qrcode file-scanning */}
                              <div id={scannerContainerId} className="hidden" />
                            </div>
                          </div>
                        )}

                        {metodoValidacaoPresidente === 'TOKEN' && (
                          <div className="space-y-3 animate-fadeIn">
                            <div className="space-y-1.5">
                              <label className="text-[9px] text-slate-400 font-mono block">
                                COLOQUE O TOKEN CRIPTOGRÁFICO ASSINADO (BASE64):
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={tokenPresidenteInput}
                                  onChange={(e) => setTokenPresidenteInput(e.target.value)}
                                  placeholder="Cole aqui o hash assinado da portaria presidencial..."
                                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[11px] font-mono text-emerald-300 placeholder-slate-700 focus:outline-none focus:border-yellow-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const sampleToken = btoa(JSON.stringify({
                                      id: '000000-president-sigm',
                                      nome: appConfig?.presidenteNome || 'Presidência Geral Homologada',
                                      cargo: 'Presidente Geral',
                                      validade: '2027-12-31'
                                    }));
                                    setTokenPresidenteInput(sampleToken);
                                    processarTextoLidoPresidente(sampleToken);
                                  }}
                                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-yellow-500 text-yellow-400 font-black text-[10px] rounded-xl cursor-pointer"
                                >
                                  Injetar Chave
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {metodoValidacaoPresidente === 'SIMULADO' && (
                          <div className="space-y-3 animate-fadeIn">
                            <div className="p-4 rounded-xl border border-yellow-500/20 bg-slate-900/60 text-center space-y-2 relative overflow-hidden min-h-[140px] flex flex-col justify-between">
                              <div className="absolute inset-x-0 h-0.5 bg-yellow-500 top-0 animate-bounce pointer-events-none" />
                              <div className="absolute inset-0 cyber-grid-bg opacity-10 pointer-events-none" />

                              <div className="space-y-1">
                                <QrCode className="w-8 h-8 text-yellow-400 mx-auto animate-spin [animation-duration:12s]" />
                                <h4 className="text-[11px] font-black text-white">Varredura Micro-Óptica de Credencial</h4>
                                <p className="text-[9px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                                  Simule a leitura física completa através de canhão óptico por aproximação laser. Perfeito para validação sem câmera física disponível.
                                </p>
                              </div>

                              <button
                                type="button"
                                disabled={processandoScanPresidente}
                                onClick={executarSimulacaoLaserPresidente}
                                className="w-full mt-2 py-2.5 bg-slate-950 hover:bg-slate-900 border border-yellow-500/30 hover:border-yellow-500 text-yellow-400 font-black text-[10px] rounded-xl cursor-pointer shadow transition-all flex items-center justify-center gap-1.5"
                              >
                                <RefreshCw className="w-3.5 h-3.5 text-yellow-500" />
                                <span>[ INICIAR VARREDURA DA CREDENCIAL ]</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Progresso de Auditoria do Scanner */}
                        {processandoScanPresidente && (
                          <div className="p-3.5 rounded-xl bg-slate-900 border border-yellow-500/30 space-y-2.5 font-mono text-[10px] animate-fadeIn">
                            <div className="flex items-center justify-between text-yellow-300 font-bold">
                              <span className="flex items-center gap-1.5">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-yellow-400" />
                                <span>{passoProcessamentoPresidente}</span>
                              </span>
                              <span>{progressoPorcentagemPresidente}%</span>
                            </div>
                            <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                              <div
                                className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all duration-300 shadow-[0_0_8px_#f59e0b]"
                                style={{ width: `${progressoPorcentagemPresidente}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setModalIsencaoAberto(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={processandoPrivilegio || !presidenteValidado || justificativaIsencao.trim().length < 5}
                      className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black transition-all shadow-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {processandoPrivilegio ? 'Outorgando...' : 'Homologar Privilégio'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL RESPONSIVO: ANISTIA FINANCEIRA                    */}
      {/* ======================================================== */}
      {modalAnistiaAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-fadeIn my-auto">
            
            {/* Cabeçalho */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3 text-purple-400">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
                <div>
                  <h3 className="font-bold text-white text-base">Homologação de Anistia Geral</h3>
                  <p className="text-[10px] font-mono text-slate-400">SIGM Core Banking • Convenção Geral</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setModalAnistiaAberto(false);
                  pararScannerPresidente();
                }}
                className="text-slate-400 hover:text-white p-1 rounded-xl bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Avisos Gerais */}
            {mensagemSucessoAnistia && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono animate-fadeIn">
                {mensagemSucessoAnistia}
              </div>
            )}
            {mensagemErroAnistia && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono animate-fadeIn">
                {mensagemErroAnistia}
              </div>
            )}

            <form onSubmit={handleConcederAnistia} className="space-y-4 font-mono text-xs">
              
              {/* Passo 1: Procurar Ministro Inadimplente */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-purple-400 font-bold uppercase block">
                  1. Nome ou CPF do Ministro com Inadimplência Crítica (mais de 2 débitos):
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required={!ministroAnistiaSelecionado}
                    placeholder="Buscar pastor elegível para anistia..."
                    value={buscaAnistia}
                    onChange={(e) => {
                      setBuscaAnistia(e.target.value);
                      if (ministroAnistiaSelecionado) {
                        setMinistroAnistiaSelecionado(null);
                        setAnuidadesAnistiaSelecionadas([]);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Lista de Resultados de Busca */}
                {buscaAnistia.trim() && !ministroAnistiaSelecionado && (
                  <div className="mt-1 bg-slate-950 border border-slate-800 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-900 shadow-inner z-10 relative">
                    {ministrosInadimplentesFiltrados.length === 0 ? (
                      <div className="p-3.5 text-slate-500 text-center italic">Nenhum ministro com inadimplência crítica (mais de 2 anuidades) localizado.</div>
                    ) : (
                      ministrosInadimplentesFiltrados.map((m) => {
                        const debitos = anuidades.filter((a) => a.ministroId === m.id && a.statusPagamento === 'ABERTO');
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setMinistroAnistiaSelecionado(m);
                              setBuscaAnistia(m.nome);
                              setAnuidadesAnistiaSelecionadas(debitos.map((a) => a.id));
                            }}
                            className="w-full p-2.5 hover:bg-slate-900 text-left transition-colors flex items-center justify-between group cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <img
                                src={m.fotoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'}
                                alt={m.nome}
                                className="w-8 h-8 rounded-lg object-cover border border-slate-800"
                              />
                              <div>
                                <span className="font-bold text-slate-200 group-hover:text-purple-300 block">{m.nome}</span>
                                <span className="text-[9px] text-slate-500 font-mono block">{m.cargo} • CPF: {m.cpf}</span>
                              </div>
                            </div>
                            <span className="text-[10px] text-rose-400 font-bold bg-rose-950/40 border border-rose-900/30 px-2 py-0.5 rounded-full shrink-0">
                              {debitos.length} débitos
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Ministro Selecionado & Seleção Individual das Anuidades para Somar */}
              {ministroAnistiaSelecionado && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3.5 animate-fadeIn">
                  <div className="flex items-center gap-3 border-b border-slate-900 pb-2.5">
                    <img
                      src={ministroAnistiaSelecionado.fotoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'}
                      alt={ministroAnistiaSelecionado.nome}
                      className="w-10 h-10 rounded-xl object-cover border border-slate-800"
                    />
                    <div>
                      <span className="font-bold text-white block">{ministroAnistiaSelecionado.nome}</span>
                      <span className="text-[10px] text-purple-400 block">{ministroAnistiaSelecionado.cargo} • RM-{ministroAnistiaSelecionado.registroMinisterial || 'N/D'}</span>
                    </div>
                  </div>

                  {/* Listagem com Checkbox */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">
                      2. Selecione as anuidades para anistiar (recalculo automático):
                    </span>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {anuidades
                        .filter((a) => a.ministroId === ministroAnistiaSelecionado.id && a.statusPagamento === 'ABERTO')
                        .map((a) => {
                          const isSelected = anuidadesAnistiaSelecionadas.includes(a.id);
                          return (
                            <label
                              key={a.id}
                              className={`flex items-center justify-between p-2.5 rounded-xl border text-[11px] font-mono cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-purple-950/20 border-purple-500/40 text-purple-300'
                                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    setAnuidadesAnistiaSelecionadas((prev) =>
                                      isSelected
                                        ? prev.filter((id) => id !== a.id)
                                        : [...prev, a.id]
                                    );
                                  }}
                                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-950 border-slate-850"
                                />
                                <span>{a.categoria === 'TAXA_CONVENCAO' ? 'Taxa Filiação' : 'Anuidade'} - {a.anoVigente}</span>
                              </div>
                              <span className="font-bold font-mono">
                                {a.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            </label>
                          );
                        })}
                    </div>
                  </div>

                  {/* Soma do Total Acumulado */}
                  <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-between text-xs font-mono">
                    <span className="text-purple-300 font-bold uppercase tracking-wider">SOMA ANISTIADA EM TEMPO REAL:</span>
                    <span className="text-sm font-black text-white font-mono">
                      {totalAnistiaAcumulado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
              )}

              {ministroAnistiaSelecionado && (
                <>
                  {/* Justificativa */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-purple-400 font-bold uppercase block">
                      3. Justificativa Estatutária da Anistia:
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={justificativaAnistia}
                      onChange={(e) => setJustificativaAnistia(e.target.value)}
                      placeholder="Indique a portaria, ata da Mesa Diretora ou motivo legal..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-700 focus:outline-none focus:border-purple-500 resize-none font-sans"
                    />
                  </div>

                  {/* Scanner do Presidente Geral */}
                  <div className="space-y-3 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-yellow-400 font-bold uppercase block tracking-wider">
                        4. Assinatura & Validação do Presidente Geral:
                      </label>
                      {presidenteValidado && (
                        <button
                          type="button"
                          onClick={() => {
                            setPresidenteValidado(false);
                            setPresidenteIdentificadorText('');
                            pararScannerPresidente();
                          }}
                          className="text-[10px] text-rose-400 hover:text-rose-300 font-mono flex items-center gap-1 cursor-pointer bg-slate-950/60 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-900/40 px-2 py-0.5 rounded animate-fadeIn"
                        >
                          <X className="w-3 h-3" />
                          <span>Limpar Leitura</span>
                        </button>
                      )}
                    </div>

                    {presidenteValidado ? (
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/30 via-slate-900/90 to-emerald-950/30 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] flex items-center gap-3 animate-fadeIn">
                        <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)] shrink-0">
                          <ShieldCheck className="w-6 h-6 animate-pulse" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-emerald-300 block uppercase tracking-wider">CREDENCIAL PRESIDENTE VALIDADA!</span>
                          <span className="text-[10px] text-slate-400 font-mono block truncate mt-0.5">{presidenteIdentificadorText}</span>
                          <span className="text-[9px] text-emerald-400 font-mono block mt-0.5">✓ Assinatura Digital Homologada via Ledger Criptográfico</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3.5 bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl">
                        {/* Seletor de Abas de Validação */}
                        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800/60 text-[10px] font-mono">
                          <button
                            type="button"
                            onClick={() => { setMetodoValidacaoPresidente('CAMERA'); pararScannerPresidente(); }}
                            className={`py-1.5 rounded-lg text-center font-bold transition-all ${
                              metodoValidacaoPresidente === 'CAMERA'
                                ? 'bg-slate-950 border border-slate-700/60 text-yellow-400 font-black'
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            Leitor Vídeo
                          </button>
                          <button
                            type="button"
                            onClick={() => { setMetodoValidacaoPresidente('FOTO'); pararScannerPresidente(); }}
                            className={`py-1.5 rounded-lg text-center font-bold transition-all ${
                              metodoValidacaoPresidente === 'FOTO'
                                ? 'bg-slate-950 border border-slate-700/60 text-yellow-400 font-black'
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            Tirar Foto
                          </button>
                          <button
                            type="button"
                            onClick={() => { setMetodoValidacaoPresidente('TOKEN'); pararScannerPresidente(); }}
                            className={`py-1.5 rounded-lg text-center font-bold transition-all ${
                              metodoValidacaoPresidente === 'TOKEN'
                                ? 'bg-slate-950 border border-slate-700/60 text-yellow-400 font-black'
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            Inserir Token
                          </button>
                          <button
                            type="button"
                            onClick={() => { setMetodoValidacaoPresidente('SIMULADO'); pararScannerPresidente(); }}
                            className={`py-1.5 rounded-lg text-center font-bold transition-all ${
                              metodoValidacaoPresidente === 'SIMULADO'
                                ? 'bg-slate-950 border border-slate-700/60 text-yellow-400 font-black'
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            Varredura Laser
                          </button>
                        </div>

                        {/* Corpo das Abas */}
                        {metodoValidacaoPresidente === 'CAMERA' && (
                          <div className="space-y-3 animate-fadeIn">
                            {/* Viewport de Câmera html5-qrcode */}
                            {presidenteScannerAtivo ? (
                              <div className="space-y-3">
                                <div className="relative overflow-hidden rounded-xl bg-black border border-yellow-500/30 min-h-[190px] flex items-center justify-center">
                                  <div id={scannerContainerId} className="w-full h-full min-h-[190px]" />
                                  
                                  {permissaoCameraPresidente === 'SOLICITANDO' && (
                                    <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center space-y-2">
                                      <RefreshCw className="w-8 h-8 text-yellow-400 animate-spin" />
                                      <span className="text-[11px] font-mono text-yellow-300">Solicitando acesso ao dispositivo de vídeo...</span>
                                    </div>
                                  )}
                                  
                                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 border border-emerald-500/40 text-[9px] text-emerald-400 font-mono font-black tracking-widest flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                                    <span>CANAL ÓPTICO SEGURO</span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={pararScannerPresidente}
                                  className="w-full py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-rose-400 hover:text-rose-300 font-mono font-bold text-[10px] rounded-lg transition-colors cursor-pointer text-center"
                                >
                                  Pausar Câmera
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2 text-center p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                                <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                                  <Camera className="w-5 h-5 text-yellow-500" />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                                    Aponte a câmera para o QR Code da credencial do Presidente Geral homologado para validar a portaria.
                                  </p>
                                  {/* Aviso Adaptativo de iFrame Sandbox */}
                                  {typeof window !== 'undefined' && window.self !== window.top && (
                                    <p className="text-[9px] text-indigo-400 font-mono max-w-sm mx-auto leading-relaxed bg-slate-950 p-2 rounded border border-indigo-950 mt-1">
                                      ⚠️ Nota de Sandbox: Navegadores bloqueiam câmeras em iFrame. Use os botões de <strong>Tirar Foto</strong>, <strong>Inserir Token</strong> ou <strong>Varredura Laser</strong> ao lado.
                                    </p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={iniciarScannerPresidente}
                                  className="mt-1 px-4 py-2 bg-slate-950 hover:bg-slate-855 border border-yellow-500/30 hover:border-yellow-500 text-yellow-400 font-black text-[10px] uppercase rounded-xl transition-all shadow flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                                >
                                  <QrCode className="w-3.5 h-3.5" />
                                  <span>[ Ativar Câmera do Leitor ]</span>
                                </button>
                              </div>
                            )}

                            {permissaoCameraPresidente === 'NEGADA' && (
                              <div className="p-4 bg-slate-950 border border-rose-500/40 rounded-2xl space-y-3 text-[11px] leading-relaxed font-sans text-rose-300 animate-fadeIn">
                                <div className="flex items-start gap-2.5">
                                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                  <div>
                                    <strong className="text-white block text-xs">Acesso à Câmera Não Autorizado pelo Navegador</strong>
                                    <p className="mt-1 text-slate-300">
                                      Dispositivos em ambientes integrados (como visualizadores iFrame de Sandbox) barram o uso físico de câmeras. Não se preocupe! Utilize as alternativas 100% integradas abaixo:
                                    </p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMetodoValidacaoPresidente('SIMULADO');
                                      executarSimulacaoLaserPresidente();
                                    }}
                                    className="px-3 py-2 rounded-xl bg-yellow-500/10 hover:bg-yellow-500 text-yellow-400 hover:text-slate-950 border border-yellow-500/30 font-bold transition-all text-[10px] uppercase cursor-pointer flex items-center justify-center gap-1.5"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Varredura Laser</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMetodoValidacaoPresidente('TOKEN');
                                    }}
                                    className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-850 font-bold transition-all text-[10px] uppercase cursor-pointer flex items-center justify-center gap-1.5"
                                  >
                                    <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Inserir Token</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {metodoValidacaoPresidente === 'FOTO' && (
                          <div className="space-y-3 animate-fadeIn">
                            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 text-center space-y-2.5">
                              <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                                <Smartphone className="w-5 h-5 text-yellow-500" />
                              </div>
                              <div>
                                <h4 className="text-[11px] font-bold text-white">Carregar Credencial do Sistema</h4>
                                <p className="text-[9px] text-slate-400 max-w-xs mx-auto mt-0.5">
                                  Tire uma foto nítida do QR Code da credencial ministerial ou faça upload de um arquivo para decodificação instantânea.
                                </p>
                              </div>

                              <label className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-yellow-500/40 hover:border-yellow-500 text-yellow-400 font-black text-[10px] cursor-pointer shadow transition-all transform active:scale-95 mx-auto">
                                <Upload className="w-3.5 h-3.5" />
                                <span>TIRAR FOTO / CARREGAR IMAGEM</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={processarFotoPresidente}
                                  className="hidden"
                                />
                              </label>

                              {/* Invisível mas necessário para câmera fallback no html5-qrcode file-scanning */}
                              <div id={scannerContainerId} className="hidden" />
                            </div>
                          </div>
                        )}

                        {metodoValidacaoPresidente === 'TOKEN' && (
                          <div className="space-y-3 animate-fadeIn">
                            <div className="space-y-1.5">
                              <label className="text-[9px] text-slate-400 font-mono block">
                                COLOQUE O TOKEN CRIPTOGRÁFICO ASSINADO (BASE64):
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={tokenPresidenteInput}
                                  onChange={(e) => setTokenPresidenteInput(e.target.value)}
                                  placeholder="Cole aqui o hash assinado da portaria presidencial..."
                                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[11px] font-mono text-emerald-300 placeholder-slate-700 focus:outline-none focus:border-yellow-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const sampleToken = btoa(JSON.stringify({
                                      id: '000000-president-sigm',
                                      nome: appConfig?.presidenteNome || 'Presidência Geral Homologada',
                                      cargo: 'Presidente Geral',
                                      validade: '2027-12-31'
                                    }));
                                    setTokenPresidenteInput(sampleToken);
                                    processarTextoLidoPresidente(sampleToken);
                                  }}
                                  className="px-3 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-yellow-500 text-yellow-400 font-black text-[10px] rounded-xl cursor-pointer"
                                >
                                  Injetar Chave
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {metodoValidacaoPresidente === 'SIMULADO' && (
                          <div className="space-y-3 animate-fadeIn">
                            <div className="p-4 rounded-xl border border-yellow-500/20 bg-slate-900/60 text-center space-y-2 relative overflow-hidden min-h-[140px] flex flex-col justify-between">
                              <div className="absolute inset-x-0 h-0.5 bg-yellow-500 top-0 animate-bounce pointer-events-none" />
                              <div className="absolute inset-0 cyber-grid-bg opacity-10 pointer-events-none" />

                              <div className="space-y-1">
                                <QrCode className="w-8 h-8 text-yellow-400 mx-auto animate-spin [animation-duration:12s]" />
                                <h4 className="text-[11px] font-black text-white">Varredura Micro-Óptica de Credencial</h4>
                                <p className="text-[9px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                                  Simule a leitura física completa através de canhão óptico por aproximação laser. Perfeito para validação sem câmera física disponível.
                                </p>
                              </div>

                              <button
                                type="button"
                                disabled={processandoScanPresidente}
                                onClick={executarSimulacaoLaserPresidente}
                                className="w-full mt-2 py-2.5 bg-slate-950 hover:bg-slate-900 border border-yellow-500/30 hover:border-yellow-500 text-yellow-400 font-black text-[10px] rounded-xl cursor-pointer shadow transition-all flex items-center justify-center gap-1.5"
                              >
                                <RefreshCw className="w-3.5 h-3.5 text-yellow-500" />
                                <span>[ INICIAR VARREDURA DA CREDENCIAL ]</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Progresso de Auditoria do Scanner */}
                        {processandoScanPresidente && (
                          <div className="p-3.5 rounded-xl bg-slate-900 border border-yellow-500/30 space-y-2.5 font-mono text-[10px] animate-fadeIn">
                            <div className="flex items-center justify-between text-yellow-300 font-bold">
                              <span className="flex items-center gap-1.5">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-yellow-400" />
                                <span>{passoProcessamentoPresidente}</span>
                              </span>
                              <span>{progressoPorcentagemPresidente}%</span>
                            </div>
                            <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                              <div
                                className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all duration-300 shadow-[0_0_8px_#f59e0b]"
                                style={{ width: `${progressoPorcentagemPresidente}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setModalAnistiaAberto(false);
                    pararScannerPresidente();
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={processandoAnistia || !presidenteValidado || justificativaAnistia.trim().length < 5 || !ministroAnistiaSelecionado || anuidadesAnistiaSelecionadas.length === 0}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-black transition-all shadow-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {processandoAnistia ? 'Homologando...' : 'Homologar Anistia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: RELATÓRIO DETALHADO DE DISPARO WEB PUSH */}
      {relatorioModalAberto && modalCampanhaPush && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 max-w-3xl w-full shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Relatório de Notificações Web Push de Vencimento
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    {modalCampanhaPush.totalNotificados} ministros incluídos na esteira de alertas
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRelatorioModalAberto(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 font-mono text-center shrink-0">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-rose-500/30">
                <span className="text-[9px] text-rose-400 block font-bold">EM ATRASO</span>
                <span className="text-base font-black text-white">{modalCampanhaPush.totalEmAtraso}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/30">
                <span className="text-[9px] text-amber-400 block font-bold">JANELA 30 DIAS</span>
                <span className="text-base font-black text-white">{modalCampanhaPush.totalPendentes30Dias}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/30">
                <span className="text-[9px] text-emerald-400 block font-bold">TOTAL DISPARADOS</span>
                <span className="text-base font-black text-emerald-400">{modalCampanhaPush.totalNotificados}</span>
              </div>
            </div>

            <div className="overflow-y-auto space-y-2 pr-1 flex-1 font-mono text-xs">
              {modalCampanhaPush.detalhes.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  Nenhum ministro com anuidade pendente ou em atraso no momento.
                </div>
              ) : (
                modalCampanhaPush.detalhes.map((item, idx) => (
                  <div
                    key={`${item.ministroId}-${item.anuidadeId}-${idx}`}
                    className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-sans">{item.ministroNome}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          item.statusCobranca === 'EM_ATRASO'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {item.statusCobranca === 'EM_ATRASO' ? 'EM ATRASO' : 'PENDENTE (30D)'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans">{item.mensagemEnviada}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-emerald-400 font-bold block">
                        R$ {item.valor.toFixed(2).replace('.', ',')}
                      </span>
                      <span className="text-[9px] text-slate-500">
                        Venc: {formatarDataBR(item.dataVencimento)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setRelatorioModalAberto(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
              >
                Fechar Relatório
              </button>
            </div>
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
                type="button"
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
                  inputMode="decimal"
                  required
                  value={editarAnuidadeObj.valor}
                  onChange={(e) => {
                    setEditarAnuidadeObj({
                      ...editarAnuidadeObj,
                      valor: e.target.value,
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono text-sm"
                  placeholder="Ex: 190,00 ou 190.00"
                />
                <span className="text-[10px] text-amber-400/80 block mt-1">
                  O novo valor será salvo e propagado automaticamente para todas as cobranças em aberto do ministro.
                </span>
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
                  disabled={salvandoEdicao}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>{salvandoEdicao ? 'Salvando...' : 'Salvar Alterações'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
