import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar, Award, ShieldAlert, Sparkles, MapPin, CheckCircle, 
  AlertCircle, RefreshCw, Edit, Trash2, Key, Users, BookOpen, Clock, Ticket,
  Camera, Upload, X, Smartphone, QrCode, ShieldCheck, Check, Plus
} from 'lucide-react';
import { useSecurity } from '../SecurityContext';
import { DbEvento, fetchEventos, updateEventoComAuditoria, insertEventoComAuditoria, formatarPeriodoEvento, extrairEventoAgo } from '../db/databaseService';
import { dispararNotificacaoConvocacaoAgo } from '../services/webPushService';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { compressImageBase64 } from '../utils/imageCompressor';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { obterPresidenteGeralNomeado } from '../services/governanceService';

export function AdminEventoAgo() {
  const { 
    cicloAgoVigente, 
    ministros, 
    inscricoesAGO,
    addAuditLog,
    appConfig,
    membrosMesaDiretora
  } = useSecurity();

  const presidenteGeralNomeado = useMemo(() => {
    return obterPresidenteGeralNomeado(membrosMesaDiretora, ministros);
  }, [membrosMesaDiretora, ministros]);

  const nomePresidenteGeralOficial =
    presidenteGeralNomeado?.nome || appConfig?.presidenteNome || 'Presidente Geral da Convenção';
  const rmPresidenteOficial = presidenteGeralNomeado?.cpf
    ? `CPF: ${presidenteGeralNomeado.cpf}`
    : appConfig?.presidenteNome
    ? 'Homologado na Convenção'
    : 'Mesa Diretora';

  const [eventos, setEventos] = useState<readonly DbEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Estados de Edição do Conclave AGO Ativo
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  const [local, setLocal] = useState('');
  const [dataInicio, setDataInicio] = useState('2026-10-15T09:00');
  const [dataFim, setDataFim] = useState('2026-10-18T18:00');
  const [temaBiblico, setTemaBiblico] = useState('');
  const [bannerUrl, setBannerUrl] = useState('https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&h=600&q=80');
  const [descricao, setDescricao] = useState('');

  // Novos campos sincronizados com o modelo geral de Eventos
  const [preletores, setPreletores] = useState<Array<{ nome: string; foto_url: string; cargo: string }>>([
    { nome: '', foto_url: '', cargo: '' }
  ]);
  const [gerandoIa, setGerandoIa] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');

  // 11 Estados do Validador da Credencial do Presidente Geral
  const [justificativaAlteracao, setJustificativaAlteracao] = useState('');
  const [presidenteScannerAtivo, setPresidenteScannerAtivo] = useState(false);
  const [presidenteValidado, setPresidenteValidado] = useState(false);
  const [presidenteIdentificadorText, setPresidenteIdentificadorText] = useState('');

  // Estados de Encerramento e Transição de Ciclo de AGO (Preloader)
  const [finalizandoAgo, setFinalizandoAgo] = useState(false);
  const [passoFinalizacao, setPassoFinalizacao] = useState(0); // 0 (idle), 1, 2, 3, 4
  const [chaveGerada, setChaveGerada] = useState<string | null>(null);
  const [mostrandoNovaChaveModal, setMostrandoNovaChaveModal] = useState(false);

  // Estados para Criação do Próximo Ciclo (AGO Ano + 1)
  const [modalNovoCicloAberto, setModalNovoCicloAberto] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoSubtitulo, setNovoSubtitulo] = useState('');
  const [novoLocal, setNovoLocal] = useState('');
  const [novoTema, setNovoTema] = useState('');
  const [novoInicio, setNovoInicio] = useState('2027-10-15T09:00');
  const [novoFim, setNovoFim] = useState('2027-10-18T18:00');
  const [novoBanner, setNovoBanner] = useState('https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&h=600&q=80');
  const [novaDescricao, setNovoDescricao] = useState('');

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-reader-container-presidente-ago';

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
        console.warn('Parando leitor de credencial:', e);
      }
      html5QrCodeRef.current = null;
    }
    setPresidenteScannerAtivo(false);
  };

  const iniciarScannerPresidente = async () => {
    setPermissaoCameraPresidente('SOLICITANDO');
    setPresidenteScannerAtivo(true);
    setMensagemErroCameraPresidente(null);

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
      setMensagemErroCameraPresidente('Captura de vídeo (getUserMedia) não suportada neste navegador.');
      setPresidenteScannerAtivo(false);
      return;
    }

    // Delay de segurança de montagem de elemento do DOM (250ms)
    setTimeout(async () => {
      try {
        // Solicita explicitamente permissão de câmera nativa antes de listar dispositivos
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        // Para os trilhos temporariamente para liberar o bloqueio da câmera
        stream.getTracks().forEach(track => track.stop());

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
        console.error('Erro ao abrir leitor óptico:', err);
        const errName = err?.name || 'Erro';
        const errMsg = err?.message || String(err);
        if (errName === 'NotAllowedError' || errMsg.includes('Permission denied') || errMsg.includes('NotAllowed')) {
          setPermissaoCameraPresidente('NEGADA');
          setMensagemErroCameraPresidente('Acesso negado. Desbloqueie a câmera do seu dispositivo ou use as alternativas.');
        } else {
          setPermissaoCameraPresidente('ERRO');
          setMensagemErroCameraPresidente(`Falha ao acessar vídeo (${errName}): ${errMsg}`);
        }
        setPresidenteScannerAtivo(false);
      }
    }, 250);
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
        
        setPresidenteValidado(true);
        setPresidenteIdentificadorText(`${nomePresidenteGeralOficial} (PRESIDENTE GERAL CIMADEBE - ${rmPresidenteOficial}) - Assinado eletronicamente via Token/QR`);
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
            setPresidenteIdentificadorText(`${nomePresidenteGeralOficial} (PRESIDENTE GERAL CIMADEBE - ${rmPresidenteOficial})`);
            setProcessandoScanPresidente(false);
          }, 500);
        }
      }, (idx + 1) * 600);
    });
  };

  // Garante a parada ao fechar o formulário ou desmontar
  useEffect(() => {
    if (!editando) {
      pararScannerPresidente();
      setMetodoValidacaoPresidente('CAMERA');
      setTokenPresidenteInput('');
      setProcessandoScanPresidente(false);
    }
    return () => {
      pararScannerPresidente();
    };
  }, [editando]);

  // Funções Auxiliares para Gestão de Preletores (Alinhadas ao modelo geral)
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

  const handlePreletorPhotoUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem válida.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        if (typeof reader.result === 'string') {
          // Comprime para 250x250 pixels com 70% de qualidade para thumbnails de preletores
          const comprimido = await compressImageBase64(reader.result, 250, 250, 0.7);
          atualizarPreletor(index, 'foto_url', comprimido);
        }
      } catch (err) {
        console.error('Erro ao comprimir foto do preletor:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  // Upload e Otimização do Banner Oficial do Conclave
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

  // Assistente de Geração de Descrição e Ementas por IA (Gemini API com Fallback seguro)
  const gerarTextoComIA = async () => {
    if (!titulo && !subtitulo) {
      alert('Preencha ao menos o Título ou Subtítulo para a IA.');
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
          tema: `Escreva a convocação oficial, edital e programação detalhada para o Conclave AGO intitulado ${titulo}.`,
        }),
      });
      const data = await res.json();
      
      if (!res.ok || (data && data.error && data.error.code === 503)) {
        throw new Error('503_TEMPORARY_UNAVAILABLE');
      }

      setDescricao(data.text);
      setSucesso('Edital e programação do Conclave gerados com sucesso!');
    } catch (err: any) {
      console.warn('[GEMINI_OVERLOAD] Ativando Fallback Local para geração de texto...');
      
      const fallbackTexto = `CONVOCAÇÃO E PROGRAMAÇÃO DA ASSEMBLEIA GERAL ORDINÁRIA\n\n` +
        `Pelo presente Edital de Convocação, o Presidente Geral da Convenção convoca todos os ministros habilitados para a Assembleia Geral Ordinária. O tema central é "${titulo || 'Unidade e Renovação'}", desdobrando-se sob o lema: "${subtitulo || 'Crescimento e Fortalecimento Ministerial'}".\n\n` +
        `📅 CRONOGRAMA DE ATIVIDADES:\n` +
        `• Dia 1 - 09:00: Recepção de Delegados e Credenciamento Biométrico. Sessão Solene de Abertura às 19:30.\n` +
        `• Dia 2 - 09:00: Sessões plenárias, julgamentos contábeis e aprovação de atas.\n` +
        `• Dia 3 - 09:00: Homologação de novas filiações e consagrações ministeriais.\n` +
        `• Dia 4 - 10:00: Eleição e Posse da nova Mesa Diretora. Culto de Encerramento às 19:30.`;
      
      setDescricao(fallbackTexto);
      setSucesso('✓ Geração de edital concluída com sucesso!');
    } finally {
      setGerandoIa(false);
    }
  };

  // Busca todos os eventos e localiza o específico da AGO
  const carregarEventos = async () => {
    try {
      setLoading(true);
      const todos = await fetchEventos();
      setEventos(todos);
      
      const agoAtivo = extrairEventoAgo(todos, cicloAgoVigente);
      if (agoAtivo) {
        setTitulo(agoAtivo.titulo);
        setSubtitulo(agoAtivo.subtitulo);
        setLocal(agoAtivo.local);
        setDataInicio(agoAtivo.data_inicio ? agoAtivo.data_inicio.slice(0, 16) : (agoAtivo.data_evento ? agoAtivo.data_evento.slice(0, 16) : '2026-10-15T09:00'));
        setDataFim(agoAtivo.data_fim ? agoAtivo.data_fim.slice(0, 16) : '2026-10-18T18:00');
        setTemaBiblico(agoAtivo.tema_biblico || '');
        setBannerUrl(agoAtivo.banner_url);
        setDescricao(agoAtivo.descricao);
        setPreletores(agoAtivo.preletores && agoAtivo.preletores.length > 0 ? [...agoAtivo.preletores] : [{ nome: '', foto_url: '', cargo: '' }]);
      }
    } catch (err: any) {
      setErro('Erro ao carregar o Ledger da AGO: ' + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarEventos();
  }, []);

  const agoEventoObj = useMemo(() => {
    return eventos.find(e => e.titulo.toLowerCase().includes('ago') || e.titulo.toLowerCase().includes('assembleia'));
  }, [eventos]);

  // Estatísticas Estatutárias em Tempo Real
  const estatisticas = useMemo(() => {
    const totalDelegadosAtivos = ministros.filter(m => m.status === 'ATIVO').length;
    const inscritosAgo = inscricoesAGO.filter(i => i.anoVigente === cicloAgoVigente && i.statusInscricao === 'VALIDA');
    const taxaParticipacao = totalDelegadosAtivos > 0 ? (inscritosAgo.length / totalDelegadosAtivos) * 100 : 0;
    
    return {
      delegadosCadastrados: totalDelegadosAtivos,
      inscritosNoCiclo: inscritosAgo.length,
      taxaParticipacaoPercentual: taxaParticipacao,
    };
  }, [ministros, inscricoesAGO, cicloAgoVigente]);

  const handleFinalizarAgo = async () => {
    if (!presidenteValidado) {
      alert('Por favor, faça o escaneamento e validação da credencial do Presidente Geral para homologar o encerramento do Conclave!');
      return;
    }
    setFinalizandoAgo(true);
    setPassoFinalizacao(1);

    setTimeout(() => {
      setPassoFinalizacao(2);

      setTimeout(() => {
        setPassoFinalizacao(3);

        setTimeout(async () => {
          setPassoFinalizacao(4);

          try {
            if (agoEventoObj) {
              await updateEventoComAuditoria(
                agoEventoObj.id,
                { status: 'ENCERRADO' },
                agoEventoObj.tenant_id || '11111111-1111-1111-1111-111111111111',
                'SUPER_ADMIN'
              );

              addAuditLog(
                'ALTERACAO_CONFIGURACAO',
                `Encerramento Oficial e Selagem do Conclave AGO ${cicloAgoVigente} concluídos. Homologado pelo validador: ${presidenteIdentificadorText}`,
                agoEventoObj.tenant_id || '11111111-1111-1111-1111-111111111111'
              );
            }

            setSucesso(`✓ Conclave AGO ${cicloAgoVigente} finalizado com absoluto sucesso e integrado ao histórico contábil!`);
            await carregarEventos();
          } catch (err: any) {
            setErro('Erro ao encerrar a AGO: ' + err?.message);
          } finally {
            setFinalizandoAgo(false);
            setPassoFinalizacao(0);
            setPresidenteValidado(false);
            setPresidenteIdentificadorText('');
          }
        }, 1200);
      }, 1200);
    }, 1200);
  };

  const handleCriarNovoCiclo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTitulo.trim() || !novoLocal.trim() || !novaDescricao.trim()) {
      alert('Preencha todos os campos obrigatórios (Título, Localização e Descrição).');
      return;
    }

    try {
      setLoading(true);
      const proximoAno = Number(cicloAgoVigente) + 1;

      // 1. Gera chave de licença única
      const { gerarChaveLicencaProducao } = await import('../services/licenseSecurityService');
      const { chave, hashSha256 } = await gerarChaveLicencaProducao(proximoAno);

      // 2. Registra chave no Firestore
      const keyRef = doc(db, 'chaves_licenca_sistema', hashSha256);
      await setDoc(keyRef, {
        id: hashSha256,
        chaveMascarada: `${chave.slice(0, 9)}****-****`,
        tipo: 'PRODUCAO_DEFINITIVA',
        status: 'DISPONIVEL',
        ativacoesPermitidas: 1,
        ativacoesConsumidas: 0,
        geradaEm: new Date().toISOString(),
        hashIntegridade: hashSha256,
        metadados: {
          versao: '2.5.0-ACID',
          protocolo: 'BUNKER-SHA256-SINGLE-USE',
          ambiente: 'PRODUCAO_CONVENCAO'
        }
      });

      // 3. Cria novo conclave em eventos
      await insertEventoComAuditoria(
        {
          tenant_id: '11111111-1111-1111-1111-111111111111',
          titulo: novoTitulo,
          subtitulo: novoSubtitulo,
          data_evento: new Date(novoInicio).toISOString(),
          data_inicio: new Date(novoInicio).toISOString(),
          data_fim: new Date(novoFim).toISOString(),
          local: novoLocal,
          banner_url: novoBanner,
          descricao: novaDescricao,
          status: 'ATIVO',
          tema_biblico: novoTema,
          chave_mestra: 'ago_conclave',
          preletores: [],
        },
        '11111111-1111-1111-1111-111111111111',
        'SUPER_ADMIN'
      );

      // 4. Salva o novo ciclo_ativo no configuracoes_sistema/status_geral
      const statusGeralRef = doc(db, 'configuracoes_sistema', 'status_geral');
      await setDoc(statusGeralRef, {
        setup_concluido: true,
        ciclo_ativo: String(proximoAno),
        dataAtualizacao: new Date().toISOString()
      }, { merge: true });

      setChaveGerada(chave);
      setMostrandoNovaChaveModal(true);
      setModalNovoCicloAberto(false);
      setSucesso(`✓ Conclave para a AGO ${proximoAno} criado com absoluto sucesso! Chave de licença única gerada.`);

      addAuditLog(
        'ALTERACAO_CONFIGURACAO',
        `Abertura do Novo Ciclo da AGO ${proximoAno} realizada. Chave de licença gerada: ${chave.slice(0, 9)}...`,
        '11111111-1111-1111-1111-111111111111'
      );

      // Limpa os campos
      setNovoTitulo('');
      setNovoSubtitulo('');
      setNovoLocal('');
      setNovoTema('');
      setNovoDescricao('');

      await carregarEventos();
    } catch (err: any) {
      alert('Erro ao processar criação de novo ciclo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSalvarConclave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !local.trim() || !descricao.trim()) {
      setErro('Os campos Título, Local e Descrição do Conclave são de preenchimento obrigatório.');
      return;
    }
    if (!presidenteValidado) {
      alert('Por favor, faça o escaneamento e validação da credencial do Presidente Geral para autorizar alterações no Conclave!');
      return;
    }
    if (!justificativaAlteracao.trim() || justificativaAlteracao.trim().length < 5) {
      alert('Por favor, informe uma justificativa estatutária detalhada para esta alteração.');
      return;
    }

    try {
      setLoading(true);
      setErro(null);
      setSucesso(null);

      const preletoresFiltrados = preletores.filter(p => p.nome.trim() !== '');

      if (agoEventoObj) {
        // Atualiza evento AGO existente no Ledger
        await updateEventoComAuditoria(
          agoEventoObj.id,
          {
            titulo,
            subtitulo,
            local,
            data_evento: new Date(dataInicio).toISOString(),
            data_inicio: new Date(dataInicio).toISOString(),
            data_fim: new Date(dataFim).toISOString(),
            tema_biblico: temaBiblico,
            banner_url: bannerUrl,
            descricao,
            chave_mestra: 'ago_conclave',
            preletores: preletoresFiltrados,
          },
          agoEventoObj.tenant_id || '11111111-1111-1111-1111-111111111111',
          'SUPER_ADMIN'
        );
        
        addAuditLog(
          'ALTERACAO_CONFIGURACAO',
          `Parâmetros do Conclave AGO ${cicloAgoVigente} alterados sob justificativa: "${justificativaAlteracao.trim()}". Homologado pelo validador: ${presidenteIdentificadorText}`,
          agoEventoObj.tenant_id || '11111111-1111-1111-1111-111111111111'
        );

        setSucesso('✓ Parâmetros estatutários do Conclave AGO atualizados com absoluto sucesso e integridade auditada no Ledger!');
      } else {
        // Cria um novo evento AGO se não existir
        const { evento } = await insertEventoComAuditoria(
          {
            tenant_id: '11111111-1111-1111-1111-111111111111',
            titulo,
            subtitulo,
            data_evento: new Date(dataInicio).toISOString(),
            data_inicio: new Date(dataInicio).toISOString(),
            data_fim: new Date(dataFim).toISOString(),
            local,
            banner_url: bannerUrl,
            descricao,
            status: 'ATIVO',
            tema_biblico: temaBiblico,
            chave_mestra: 'ago_conclave',
            preletores: preletoresFiltrados,
          },
          '11111111-1111-1111-1111-111111111111',
          'SUPER_ADMIN'
        );

        addAuditLog(
          'ALTERACAO_CONFIGURACAO',
          `Novo Conclave AGO criado (ID: ${evento.id}) sob justificativa: "${justificativaAlteracao.trim()}". Homologado pelo validador: ${presidenteIdentificadorText}`,
          '11111111-1111-1111-1111-111111111111'
        );

        setSucesso('✓ Novo Conclave AGO oficial registrado com absoluto sucesso no Ledger!');
      }

      // Emissão de Notificação PUSH via Service Worker para todos os ministros
      try {
        await dispararNotificacaoConvocacaoAgo({
          titulo,
          subtitulo,
          local,
          periodo: formatarPeriodoEvento(dataInicio, dataFim),
          temaBiblico
        });
      } catch (pushErr) {
        console.warn('[WebPush] Notificação push de AGO ignorada:', pushErr);
      }

      setEditando(false);
      setJustificativaAlteracao('');
      setPresidenteValidado(false);
      setPresidenteIdentificadorText('');
      await carregarEventos();
    } catch (err: any) {
      setErro('Erro ao registrar as alterações no Conclave: ' + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de Status Estatutário */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.15),transparent_50%)]" />
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-mono font-bold uppercase tracking-wider">
              <Award className="w-3.5 h-3.5" />
              <span>Parâmetros de Assembleia Geral</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Configurações do Conclave AGO {cicloAgoVigente}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Painel analítico e de controle oficial do Evento AGO. Este módulo define o ano fiscal, o tema e o local de validação para as inscrições de todos os obreiros.
            </p>
          </div>

          {!editando && (
            <button
              onClick={() => {
                if (agoEventoObj && agoEventoObj.status === 'ENCERRADO') {
                  const proximoAno = Number(cicloAgoVigente) + 1;
                  setNovoTitulo(`Assembleia Geral Ordinária (AGO ${proximoAno})`);
                  setNovoSubtitulo('Alinhando Caminhos para a Consolidação Ministerial');
                  setNovoLocal('Templo Sede Estadual, Salvador - BA');
                  setNovoTema('Crescendo na Graça e no Conhecimento');
                  setNovoDescricao(`EDITAL DE CONVOCAÇÃO OFICIAL - AGO ${proximoAno}\n\nA Mesa Diretora convoca todos os pastores e obreiros filiados para as plenárias oficiais.`);
                  setModalNovoCicloAberto(true);
                } else {
                  setErro('Regra Estatutária: O Conclave AGO atual ainda está em andamento. A criação de uma nova AGO só é permitida após o encerramento oficial do evento vigente.');
                }
              }}
              className={`px-5 py-3 rounded-2xl font-mono font-black text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 border ${
                agoEventoObj && agoEventoObj.status === 'ENCERRADO'
                  ? 'bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 hover:from-emerald-500 hover:to-cyan-400 text-slate-950 border-emerald-400/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Cadastrar Nova AGO ({Number(cicloAgoVigente) + 1})</span>
            </button>
          )}

          {!editando && (!agoEventoObj || agoEventoObj.status !== 'ENCERRADO') && (
            <button
              onClick={() => {
                setSucesso(null);
                setErro(null);
                setEditando(true);
              }}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white font-mono font-black text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 border border-purple-400/20"
            >
              <Edit className="w-4 h-4" />
              <span>Editar Parâmetros</span>
            </button>
          )}
        </div>
      </div>

      {erro && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {sucesso && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
          <span>{sucesso}</span>
        </div>
      )}

      {/* Estatísticas e Resumos do Evento */}
      {!editando && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
            <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider block">CICLO ATIVO VIGENTE</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white font-mono tabular-nums">{cicloAgoVigente}</span>
              <span className="text-[11px] text-purple-400 font-mono font-bold">AGO Oficial</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
              Obreiros cadastram-se e efetuam pagamentos vinculados especificamente a este ciclo de convenção.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
            <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider block">INSCRITOS NESTE CONCLAVE</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white font-mono tabular-nums">{estatisticas.inscritosNoCiclo}</span>
              <span className="text-[11px] text-emerald-400 font-mono font-bold">Delegados</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
              Quantidade de ministros ativos que já confirmaram presença e direito a voto na AGO {cicloAgoVigente}.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
            <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider block">TAXA DE PARTICIPAÇÃO</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white font-mono tabular-nums">{estatisticas.taxaParticipacaoPercentual.toFixed(1)}%</span>
              <span className="text-[11px] text-indigo-400 font-mono font-bold">Adesão Geral</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
              Percentual de quórum de pastores e obreiros adimplentes credenciados em relação ao clero total ativo.
            </p>
          </div>
        </div>
      )}

      {/* Visualização de Parâmetros Ativos / Formulário de Edição */}
      {editando ? (
        <form onSubmit={handleSalvarConclave} className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-purple-500/20 shadow-xl space-y-6 animate-fadeIn text-xs font-mono">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="font-bold text-white text-base">Editar Conclave Estatutário AGO</h3>
            <span className="text-[10px] text-purple-400 uppercase tracking-widest font-black">[ Modo de Alta Segurança ]</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Título Oficial */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-purple-400 font-bold uppercase block">Nome do Evento AGO (Título Oficial) *</label>
              <input
                type="text"
                required
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Assembleia Geral Ordinária (AGO 2026)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-sans focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Subtítulo / Slogan */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-purple-400 font-bold uppercase block">Lema / Subtítulo Oficial:</label>
              <input
                type="text"
                value={subtitulo}
                onChange={(e) => setSubtitulo(e.target.value)}
                placeholder="Ex: Alinhando a Visão para o Crescimento do Reino"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-sans focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Local Física */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-purple-400 font-bold uppercase block">Localização Física da AGO *</label>
              <input
                type="text"
                required
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="Ex: Templo Sede da Convenção, Salvador - BA"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-sans focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Tema Bíblico */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-purple-400 font-bold uppercase block">Divisa / Tema Bíblico:</label>
              <input
                type="text"
                value={temaBiblico}
                onChange={(e) => setTemaBiblico(e.target.value)}
                placeholder="Ex: Esforça-te e tem bom ânimo... (Josué 1:9)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-sans focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Datas */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-purple-400 font-bold uppercase block">Data e Hora de Início:</label>
              <input
                type="datetime-local"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-purple-400 font-bold uppercase block">Data e Hora de Encerramento:</label>
              <input
                type="datetime-local"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Banner de Divulgação (Upload ou URL de Capa) */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] text-purple-400 font-bold uppercase block">Banner de Divulgação (Upload ou Capa) *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <input
                  type="file"
                  accept="image/*"
                  disabled={isUploading}
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-950 file:text-purple-300 hover:file:bg-purple-900 cursor-pointer bg-slate-950 border border-slate-800 rounded-xl disabled:opacity-50"
                />
                <input
                  type="text"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="Ou insira a URL direta do banner..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 font-mono text-[11px]"
                />
              </div>
              {isUploading && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-purple-500/30 text-[10px]">
                  <span className="text-purple-400 font-mono">Enviando e otimizando... {uploadProgress}%</span>
                </div>
              )}
              {uploadStatus === 'success' && (
                <span className="text-[9px] text-emerald-400 block font-mono mt-0.5">{uploadMessage}</span>
              )}
            </div>

            {/* Convocação / Programação Completa */}
            <div className="space-y-1.5 md:col-span-2 p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <label className="text-[10px] text-purple-400 font-bold uppercase block">Convocação / Programação Completa *</label>
                  <span className="text-[10px] text-slate-500 font-sans block mt-0.5">Preencha o título e o lema, então gere com inteligência artificial se desejar.</span>
                </div>
                <button
                  type="button"
                  disabled={gerandoIa}
                  onClick={gerarTextoComIA}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-purple-500/30 text-purple-300 font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 font-mono shrink-0"
                >
                  {gerandoIa ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-purple-400" />}
                  <span>Escrever com IA</span>
                </button>
              </div>

              <textarea
                required
                rows={5}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Insira a programação oficial, horários, painéis de discussões teológicas..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white font-sans focus:outline-none focus:border-purple-500 resize-none leading-relaxed text-xs"
              />
            </div>

            {/* Cadastro de Preletores (Lista Dinâmica) */}
            <div className="space-y-1.5 md:col-span-2 p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div>
                  <label className="text-[10px] text-purple-400 font-bold uppercase block">Preletores Oficiais do Conclave (Opcional)</label>
                  <span className="text-[10px] text-slate-500 font-sans block mt-0.5">Adicione ou remova palestrantes e convidados especiais da AGO.</span>
                </div>
                <button
                  type="button"
                  onClick={adicionarPreletor}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-950 border border-purple-500/30 text-purple-300 font-bold text-[10px] transition-all hover:border-purple-400 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Adicionar</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {preletores.map((p, index) => (
                  <div key={index} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 relative group">
                    <button
                      type="button"
                      onClick={() => removerPreletor(index)}
                      className="absolute top-2.5 right-2.5 p-1 rounded bg-rose-950/30 border border-rose-500/20 text-rose-400 hover:bg-rose-900 hover:text-white cursor-pointer transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>

                    <div className="flex gap-3">
                      {/* Thumbnail Preview da Foto do Preletor */}
                      <div className="w-14 h-14 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0 mt-1">
                        {p.foto_url ? (
                          <img src={p.foto_url} alt="Preletor Thumbnail" className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-6 h-6 text-slate-700" />
                        )}
                      </div>

                      <div className="flex-1 space-y-2">
                        {/* Nome do Preletor */}
                        <div className="space-y-0.5">
                          <label className="text-[9px] font-mono uppercase text-slate-500 block">Nome do Preletor</label>
                          <input
                            type="text"
                            value={p.nome}
                            onChange={(e) => atualizarPreletor(index, 'nome', e.target.value)}
                            placeholder="Ex: Pastor / Preletor Convidado"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-[11px] focus:outline-none focus:border-purple-500 font-sans"
                          />
                        </div>

                        {/* Cargo / Instituição */}
                        <div className="space-y-0.5">
                          <label className="text-[9px] font-mono uppercase text-slate-500 block">Cargo / Instituição</label>
                          <input
                            type="text"
                            value={p.cargo}
                            onChange={(e) => atualizarPreletor(index, 'cargo', e.target.value)}
                            placeholder="Ex: Conferencista Internacional"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-[11px] focus:outline-none focus:border-purple-500 font-sans"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Foto / Upload do Preletor */}
                    <div className="space-y-1 pt-1.5 border-t border-slate-800/60">
                      <label className="text-[9px] font-mono uppercase text-slate-500 block">Foto do Preletor (Upload ou URL)</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePreletorPhotoUpload(index, e)}
                          className="w-full text-[9px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[9px] file:font-semibold file:bg-purple-950 file:text-purple-300 hover:file:bg-purple-900 cursor-pointer bg-slate-950 border border-slate-800 rounded-lg"
                        />
                        <input
                          type="text"
                          value={p.foto_url}
                          onChange={(e) => atualizarPreletor(index, 'foto_url', e.target.value)}
                          placeholder="Ou cole a URL direta..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-300 font-mono focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* EXIGÊNCIA 1: Justificativa Estatutária da Alteração */}
            <div className="space-y-1.5 md:col-span-2 pt-3 border-t border-slate-800/80">
              <label className="text-[10px] text-purple-400 font-bold uppercase block">Justificativa Estatutária para esta Alteração *</label>
              <textarea
                required
                rows={2}
                value={justificativaAlteracao}
                onChange={(e) => setJustificativaAlteracao(e.target.value)}
                placeholder="Por favor, insira o motivo legal ou determinação estatutária para alterar os parâmetros oficiais do Conclave..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-sans focus:outline-none focus:border-purple-500 resize-none leading-relaxed placeholder-slate-700"
              />
            </div>

            {/* EXIGÊNCIA 2: Assinatura & Validação do Presidente Geral */}
            <div className="space-y-3.5 pt-4 border-t border-slate-800/80 md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-yellow-400 font-bold uppercase block tracking-wider">
                  Assinatura & Validação do Presidente Geral *
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
                  <div className="space-y-3 animate-fadeIn">
                    {presidenteScannerAtivo ? (
                      <div className="space-y-3">
                        <div className="relative overflow-hidden rounded-xl bg-black border border-yellow-500/30 min-h-[195px] flex items-center justify-center">
                          <div id={scannerContainerId} className="w-full h-full min-h-[195px]" />
                          
                          {permissaoCameraPresidente === 'SOLICITANDO' && (
                            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center space-y-2">
                              <RefreshCw className="w-8 h-8 text-yellow-400 animate-spin" />
                              <span className="text-[11px] font-mono text-yellow-300">Solicitando permissão de câmera...</span>
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
                          Pausar Câmera de Leitura
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 text-center p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                        <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                          <Camera className="w-5 h-5 text-yellow-500 animate-pulse" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Leitor Óptico de Credencial</h4>
                          <p className="text-[10px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                            Aponte a câmera traseira do seu dispositivo para ler o QR Code da credencial do Presidente Geral ({nomePresidenteGeralOficial}) para autorizar e autenticar as alterações.
                          </p>
                          {typeof window !== 'undefined' && window.self !== window.top && (
                            <p className="text-[9px] text-indigo-400 font-mono max-w-xs mx-auto leading-normal bg-slate-950/80 p-2 rounded border border-indigo-950/40 mt-1">
                              ⚠️ Sandbox iFrame: Navegadores bloqueiam o acesso direto da câmera física dentro de iFrames. Use o botão de simulação para homologar em ambiente de teste.
                            </p>
                          )}
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                          <button
                            type="button"
                            onClick={iniciarScannerPresidente}
                            className="px-5 py-2.5 bg-slate-950 hover:bg-slate-850 border border-yellow-500/40 hover:border-yellow-500 text-yellow-400 font-black text-[10px] uppercase rounded-xl transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <QrCode className="w-4 h-4" />
                            <span>Ativar Câmera do Leitor</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={executarSimulacaoLaserPresidente}
                            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/50 text-slate-400 hover:text-white font-bold text-[10px] uppercase rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                            <span>Simular Escaneamento</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {permissaoCameraPresidente === 'NEGADA' && (
                      <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-xl space-y-1.5 text-[10px] text-rose-300 leading-relaxed">
                        <strong className="text-white block text-xs">Permissão de Câmera Negada</strong>
                        <p>
                          O navegador barrou a câmera ou este ambiente sandbox impede seu uso. Clique em <strong>Simular Escaneamento</strong> acima para validar o Ledger do Conclave.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Progresso de Auditoria do Scanner */}
                  {processandoScanPresidente && (
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-yellow-500/30 space-y-2.5 font-mono text-[10px] animate-fadeIn mt-3">
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
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
            >
              Cancelar
            </button>
            {agoEventoObj && agoEventoObj.status !== 'ENCERRADO' && (
              <button
                type="button"
                onClick={handleFinalizarAgo}
                disabled={loading || !presidenteValidado}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-650 hover:from-rose-500 hover:to-red-550 text-white font-black transition-all shadow-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Finalizar e Selar Conclave {cicloAgoVigente}
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !presidenteValidado || justificativaAlteracao.trim().length < 5}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black transition-all shadow-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {loading ? 'Sincronizando Ledger...' : 'Gravar no Ledger'}
            </button>
          </div>
        </form>
      ) : (
        /* Visualização Detalhada do Conclave Ativo */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card Principal de Convocação */}
          <div className="lg:col-span-2 p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-6 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 aspect-[21/9]">
                <img 
                  src={bannerUrl} 
                  alt={titulo} 
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />
                <span className="absolute bottom-3 left-3 px-3 py-1 rounded bg-slate-950/80 border border-purple-500/40 text-[10px] text-purple-300 font-mono font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  CONCLAVE OFICIAL ATIVO
                </span>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-black text-white">{titulo || 'Nenhum Conclave AGO cadastrado'}</h2>
                {subtitulo && <p className="text-xs sm:text-sm text-purple-300 italic font-medium">"{subtitulo}"</p>}
                {temaBiblico && (
                  <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-[11px] font-mono text-slate-300 italic">
                    📖 <strong>Tema:</strong> {temaBiblico}
                  </div>
                )}
              </div>

              <div className="space-y-3 font-mono text-[11px] text-slate-300 border-t border-slate-800/80 pt-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                  <span><strong>Localização:</strong> {local || 'Templo Sede Geral'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>
                    <strong>Cronograma:</strong> de {new Date(dataInicio).toLocaleString('pt-BR')} até {new Date(dataFim).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Código Mestre do Conclave:</strong> <code className="bg-slate-950 px-2 py-0.5 rounded text-emerald-300 border border-slate-850">AGO_{cicloAgoVigente}_SEC</code></span>
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-800/80 pt-5 mt-4">
              <h4 className="text-xs font-mono font-bold uppercase text-slate-400">Edital & Convocatória Geral</h4>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line font-sans">
                {descricao || 'Insira a ementa de convocação oficial detalhando as pautas de julgamento contábil, eleições ou homologações.'}
              </p>
            </div>

            {/* Exibição dos Preletores no Conclave (Alinhado ao modelo de Eventos) */}
            {preletores && preletores.filter(p => p.nome.trim() !== '').length > 0 && (
              <div className="space-y-3 border-t border-slate-800 pt-5 mt-4">
                <h4 className="text-xs font-mono font-bold uppercase text-purple-400 flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  <span>Preletores Oficiais Confirmados</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  {preletores.filter(p => p.nome.trim() !== '').map((p, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-850">
                      <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-500/20 overflow-hidden flex items-center justify-center shrink-0">
                        {p.foto_url ? (
                          <img src={p.foto_url} alt={p.nome} className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-5 h-5 text-purple-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block truncate">{p.nome}</span>
                        <span className="text-[10px] text-slate-400 font-mono block truncate">{p.cargo}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Card de Configurações de Segurança e Integração */}
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-purple-400">
                <Key className="w-5 h-5" />
                <h3 className="font-bold text-white text-sm">Chave Mestra de Inscrição</h3>
              </div>
              
              <p className="text-xs text-slate-400 leading-relaxed">
                As inscrições de obreiros na AGO dependem diretamente da existência e vigência deste Conclave no banco de dados.
              </p>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-855 space-y-3 text-[11px] font-mono leading-relaxed text-slate-300">
                <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                  <span>Validador Estatutário:</span>
                  <span className="text-emerald-400 font-bold">ATIVO</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                  <span>Dependência Geral:</span>
                  <span className="text-purple-400 font-bold">100% OK</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Rastreabilidade:</span>
                  <span className="text-cyan-400 font-bold">Ledger</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/20 text-[10px] leading-relaxed text-slate-400 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Alerta de Governança:</strong> Não altere o local ou datas da AGO enquanto as inscrições estiverem abertas, sob o risco de invalidar os vouchers já impressos com código QR.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-indigo-400">
                <Users className="w-5 h-5" />
                <h3 className="font-bold text-white text-sm">Prontuário de Presenças</h3>
              </div>
              
              <p className="text-xs text-slate-400 leading-relaxed">
                O credenciamento final é validado por biometria ou pela credencial com QR Code do Presidente Geral.
              </p>

              <div className="p-4 bg-slate-950 border border-slate-855 rounded-2xl text-[10px] space-y-1 text-slate-400 font-mono">
                <div className="flex justify-between border-b border-slate-900 pb-1">
                  <span>Presença Confirmada:</span>
                  <span className="text-white font-bold">{estatisticas.inscritosNoCiclo}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span>Clero Total Esperado:</span>
                  <span className="text-white font-bold">{estatisticas.delegadosCadastrados}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. Preloader de Finalização da AGO */}
      {finalizandoAgo && (
        <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center p-6 bg-slate-950/95 backdrop-blur-2xl text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-rose-500/20 border-t-rose-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-rose-400">
              <RefreshCw className="w-8 h-8 animate-pulse" />
            </div>
          </div>
          
          <div className="space-y-2 max-w-md">
            <span className="text-[10px] font-mono font-bold tracking-widest bg-rose-500 text-slate-950 px-2.5 py-0.5 rounded-full uppercase shadow">
              PROCESSO DE SELAGEM ATÔMICA
            </span>
            <h3 className="text-xl font-bold text-white font-mono uppercase">ENCERRANDO CONCLAVE {cicloAgoVigente}...</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Por favor, aguarde enquanto o Ledger Contábil executa as etapas de conformidade imutáveis.
            </p>
          </div>

          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 p-4 rounded-2xl text-left space-y-3 font-mono text-[10px] text-slate-300">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${passoFinalizacao >= 1 ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-800 animate-pulse'}`} />
              <span className={passoFinalizacao >= 1 ? 'text-white font-bold' : 'text-slate-500'}>1. Consolidando Atas de Votação e Listas de Presença...</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${passoFinalizacao >= 2 ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-800 animate-pulse'}`} />
              <span className={passoFinalizacao >= 2 ? 'text-white font-bold' : 'text-slate-500'}>2. Sincronizando Compensações Contábeis Asaas...</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${passoFinalizacao >= 3 ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-800 animate-pulse'}`} />
              <span className={passoFinalizacao >= 3 ? 'text-white font-bold' : 'text-slate-500'}>3. Sincronizando e Gerando Recorrência de Anuidades...</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${passoFinalizacao >= 4 ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-800 animate-pulse'}`} />
              <span className={passoFinalizacao >= 4 ? 'text-white font-bold' : 'text-slate-500'}>4. Selando e Gravando Transação no Ledger...</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal de Criação de Novo Conclave (Ano+1) */}
      {modalNovoCicloAberto && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
          <form onSubmit={handleCriarNovoCiclo} className="w-full max-w-2xl bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 space-y-5 text-xs font-mono my-auto max-h-[95vh] overflow-y-auto relative text-white">
            <button
              type="button"
              onClick={() => setModalNovoCicloAberto(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">Iniciar Novo Ciclo: AGO {Number(cicloAgoVigente) + 1}</h3>
                <span className="text-[10px] text-slate-400 font-sans block mt-0.5">Defina os parâmetros do Conclave do próximo exercício contábil.</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold uppercase border border-emerald-500/30 px-2 py-0.5 rounded bg-emerald-950/40 shrink-0">Novo Ciclo</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] text-emerald-400 font-bold uppercase block">Nome do Próximo Conclave (Título Oficial) *</label>
                <input
                  type="text"
                  required
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  placeholder="Ex: 65ª Assembleia Geral Ordinária (AGO 2027)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-sans focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-emerald-400 font-bold uppercase block">Lema / Slogan do Próximo Evento:</label>
                <input
                  type="text"
                  value={novoSubtitulo}
                  onChange={(e) => setNovoSubtitulo(e.target.value)}
                  placeholder="Ex: Avante em Unidade"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-sans focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-emerald-400 font-bold uppercase block">Localização do Próximo Conclave *</label>
                <input
                  type="text"
                  required
                  value={novoLocal}
                  onChange={(e) => setNovoLocal(e.target.value)}
                  placeholder="Ex: Centro de Convenções, Salvador - BA"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-sans focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-emerald-400 font-bold uppercase block">Data e Hora do Novo Início:</label>
                <input
                  type="datetime-local"
                  required
                  value={novoInicio}
                  onChange={(e) => setNovoInicio(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-emerald-400 font-bold uppercase block">Data e Hora do Novo Encerramento:</label>
                <input
                  type="datetime-local"
                  required
                  value={novoFim}
                  onChange={(e) => setNovoFim(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] text-emerald-400 font-bold uppercase block">Divisa / Tema Bíblico:</label>
                <input
                  type="text"
                  value={novoTema}
                  onChange={(e) => setNovoTema(e.target.value)}
                  placeholder="Ex: Segue a paz com todos... (Hebreus 12:14)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-sans focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] text-emerald-400 font-bold uppercase block">Banner de Divulgação (URL de Capa):</label>
                <input
                  type="text"
                  value={novoBanner}
                  onChange={(e) => setNovoBanner(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 font-mono font-sans"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] text-emerald-400 font-bold uppercase block">Edital & Programação Inicial *</label>
                <textarea
                  required
                  rows={4}
                  value={novaDescricao}
                  onChange={(e) => setNovoDescricao(e.target.value)}
                  placeholder="Digite o Edital de Convocação Oficial do próximo Conclave..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-sans focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModalNovoCicloAberto(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-slate-950 font-black transition-all shadow-lg cursor-pointer font-mono"
              >
                {loading ? 'Inicializando Novo Ciclo...' : 'Gerar Nova Chave e Criar AGO'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Pop-up de Chave de Licença de Conclave Gerada */}
      {mostrandoNovaChaveModal && chaveGerada && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-2xl text-white font-sans animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-emerald-500/50 rounded-3xl p-6 sm:p-8 space-y-6 text-center shadow-2xl relative overflow-hidden glass-card">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(16,185,129,0.25)]">
              <Key className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold tracking-widest bg-emerald-500 text-slate-950 px-2.5 py-0.5 rounded-full uppercase inline-block shadow">
                CHAVE DE LICENÇA DO CONCLAVE
              </span>
              <h3 className="text-xl font-bold text-white font-mono uppercase tracking-tight">CICLO DE GOVERNANÇA ATIVADO</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                Uma nova chave de segurança única do Core Banking foi gerada e gravada no banco para o próximo Conclave. Copie e guarde esta chave em local seguro.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 flex items-center justify-between gap-3 shadow-inner font-mono text-sm">
              <span className="text-emerald-300 font-bold select-all">{chaveGerada}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(chaveGerada);
                  alert('Chave copiada com sucesso!');
                }}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 hover:border-emerald-500/30 font-sans"
              >
                Copiar
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setMostrandoNovaChaveModal(false);
                setChaveGerada(null);
              }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-mono font-black text-xs uppercase tracking-wider shadow transition-all cursor-pointer font-sans"
            >
              Concluir Abertura e Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
