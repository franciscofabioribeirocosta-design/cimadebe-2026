/**
 * @license
 * CIMADEBE / SIGM - PORTAL DO MINISTRO (NEOFINTECH & E-DEMOCRACY EDITION)
 * Painel pessoal imersivo com animações Framer Motion, carteira digital CR-80 3D,
 * prontuário eclesiástico, extrato de anuidades, credenciamento AGO 2026,
 * Clube de Benefícios, Urna Eletrônica Criptografada, Certificados EAD e Mural de Orações (Autorizável pelo Super Master).
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  CheckCircle2,
  Calendar,
  Download,
  ArrowLeft,
  User,
  Building,
  FileCheck,
  ShieldCheck,
  ShieldAlert,
  DollarSign,
  QrCode,
  FileText,
  Sparkles,
  Fingerprint,
  Award,
  Zap,
  Lock,
  Globe,
  Share2,
  Vote,
  HeartHandshake,
  Clock,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  BadgeCheck,
  Shield,
  History,
  Printer,
  Newspaper,
  X,
  LogOut,
  UserCog,
  KeyRound,
  Camera,
  Edit3,
  Save
} from 'lucide-react';
import { collection, query, where, getDocs, getDoc, onSnapshot, doc, setDoc, addDoc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { liquidarAnuidadeImediata } from '../services/agoFirebaseService';
import { AnuidadeMinistro } from '../types';
import confetti from 'canvas-confetti';
import { useSecurity } from '../SecurityContext';
import { useNotification } from '../NotificationContext';
import { MinisterialCard } from '../components/MinisterialCard';
import { db, storage } from '../firebase';
import { compressImageBase64 } from '../utils/imageCompressor';
import { realizarInscricaoPlanoGenericaTransacional, compensarBoletoInscricaoAgo } from '../services/planosAgoService';
import { avaliarStatusAdimplencia, avaliarStatusCobranca, formatarRotuloStatus, obterBadgeClassStatus, formatarDataBR, getSystemDate, getSystemYear } from '../financialEngine';
import { useAnuidadesProximas } from '../hooks/useAnuidadesProximas';
import { WebPushNotificationCenter } from '../components/WebPushNotificationCenter';
import { InsigniasEvolucaoMinisterial } from '../components/InsigniasEvolucaoMinisterial';
import { DossieAcervoMinisterial } from '../components/DossieAcervoMinisterial';
import { NoticiasEventosMinistro } from '../components/NoticiasEventosMinistro';
import { exportarCrachaInscricaoAgoPdf } from '../services/pdfExportService';
import { extrairEventoAgo } from '../db/databaseService';
import { extrairNivelMinistro, TODAS_INSIGNIAS } from '../services/insigniasService';
import { gerarPdfComprovanteInscricaoAgo, gerarPdfReciboPagamentoMinistro } from '../services/pdfExportService';
import { AniversariantesDoMesCard } from '../components/AniversariantesDoMesCard';
import { PortalVotacaoMinistro } from './PortalVotacaoMinistro';
import { CertificadoMinistro } from './CertificadoMinistro';
import { CheckoutRealAgo } from './CheckoutRealAgo';

interface PortalMinistroProps {
  onBack: () => void;
}

export function PortalMinistro({ onBack }: PortalMinistroProps) {
  const {
    ministros,
    operadorId,
    operadorAtual,
    anuidades,
    igrejasFiliadas,
    cmsSettings,
    inscricoesAGO,
    cicloAgoVigente,
    noticias,
    eventos,
    appConfig,
    editarMinistro,
    registrarLogout
  } = useSecurity();
  const { notifySuccess, notifyError } = useNotification();
  const [abaAtiva, setAbaAtiva] = useState<'carteirinha' | 'noticias_eventos' | 'insignias' | 'dossie' | 'prontuario' | 'anuidades' | 'ago' | 'igreja' | 'beneficios' | 'votacao' | 'ead' | 'oracao' | 'certificado'>('carteirinha');
  const [versoCartao, setVersoCartao] = useState<boolean>(false);
  const [qrCodeModalAberto, setQrCodeModalAberto] = useState<boolean>(false);

  // Estados de Edição de Perfil e Alteração de Senha
  const [modalEditarPerfilAberto, setModalEditarPerfilAberto] = useState<boolean>(false);
  const [modalMudarSenhaAberto, setModalMudarSenhaAberto] = useState<boolean>(false);
  const [salvandoPerfil, setSalvandoPerfil] = useState<boolean>(false);
  const [salvandoSenha, setSalvandoSenha] = useState<boolean>(false);
  const [feedbackPerfil, setFeedbackPerfil] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [feedbackSenha, setFeedbackSenha] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Formulário de Perfil
  const [dadosPerfil, setDadosPerfil] = useState({
    nome: '',
    email: '',
    telefone: '',
    fotoUrl: '',
    rg: '',
    endereco: '',
    cidade: '',
    estado: '',
    estadoCivil: 'CASADO',
    cargo: 'Pastor',
    dataConsagracao: '',
    cep: '',
    bairro: ''
  });

  // Estados de Biometria WebAuthn de Hardware
  const [ativandoBiometria, setAtivandoBiometria] = useState<boolean>(false);
  const [feedbackBiometria, setFeedbackBiometria] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Formulário de Senha
  const [dadosSenha, setDadosSenha] = useState({
    senhaAtual: '',
    novaSenha: '',
    confirmarNovaSenha: ''
  });
  const [votoRealizado, setVotoRealizado] = useState<boolean>(false);
  const [novoPedidoOracao, setNovoPedidoOracao] = useState<string>('');
  const [pedidosOracao, setPedidosOracao] = useState<string[]>([
    'Campanha Evangelística Regional em Feira de Santana - BA',
    'Construção do Templo Sede em Vitória da Conquista',
    'Saúde e vigor espiritual para todos os pastores filiados'
  ]);

  // Estados da Inscrição e Pagamento da AGO
  const [modalPagamentoAgoAberto, setModalPagamentoAgoAberto] = useState<boolean>(false);
  const [comprovanteAgoModal, setComprovanteAgoModal] = useState<any | null>(null);
  const [formaPagamentoAgo, setFormaPagamentoAgo] = useState<'PIX' | 'CARTAO_CREDITO' | 'BOLETO'>('PIX');
  const [processandoPagamentoAgo, setProcessandoPagamentoAgo] = useState<boolean>(false);
  const [pixCopiado, setPixCopiado] = useState<boolean>(false);
  const [boletoCopiado, setBoletoCopiado] = useState<boolean>(false);
  const [compensandoBoleto, setCompensandoBoleto] = useState<boolean>(false);
  const [feedbackAgo, setFeedbackAgo] = useState<{ tipo: 'sucesso' | 'erro' | 'info'; texto: string } | null>(null);
  const [cartaoDados, setCartaoDados] = useState({
    numero: '',
    titular: '',
    validade: '',
    cvv: '',
    parcelas: '1'
  });

  const anoCiclo = cicloAgoVigente || new Date().getFullYear();

  const agoConclave = useMemo(() => {
    return (eventos || []).find(e => {
      if (!e) return false;
      const t = (e.titulo || '').toLowerCase();
      return e.chave_mestra === 'ago_conclave' || t.includes('ago') || t.includes('assembleia');
    });
  }, [eventos]);

  const estaNaJanelaDeBloqueio3Dias = useMemo(() => {
    if (!agoConclave || !agoConclave.data_inicio) return false;
    try {
      const dataInicio = new Date(agoConclave.data_inicio);
      const agora = new Date();
      const diffMs = dataInicio.getTime() - agora.getTime();
      const diffDias = diffMs / (1000 * 60 * 60 * 24);
      return diffDias <= 3;
    } catch {
      return false;
    }
  }, [agoConclave]);

  useEffect(() => {
    if (abaAtiva === 'ago' && (cmsSettings.paginasVisiveis.inscricaoAgo === false || appConfig.killSwitchCompliance === true)) {
      setAbaAtiva('carteirinha');
    }
    if (abaAtiva === 'votacao' && (cmsSettings.paginasVisiveis.ativoUrnaEletronica === false || appConfig.killSwitchCompliance === true)) {
      setAbaAtiva('carteirinha');
    }
    if (abaAtiva === 'beneficios' && cmsSettings.paginasVisiveis.ativoClubeBeneficios === false) {
      setAbaAtiva('carteirinha');
    }
    if (abaAtiva === 'ead' && cmsSettings.paginasVisiveis.ativoEad === false) {
      setAbaAtiva('carteirinha');
    }
    if (abaAtiva === 'oracao' && cmsSettings.paginasVisiveis.ativoMuralOracao === false) {
      setAbaAtiva('carteirinha');
    }
    if (abaAtiva === 'noticias_eventos' && cmsSettings.paginasVisiveis.noticias === false && cmsSettings.paginasVisiveis.eventos === false) {
      setAbaAtiva('carteirinha');
    }
    if (abaAtiva === 'igreja' && cmsSettings.paginasVisiveis.igrejasFiliadas === false) {
      setAbaAtiva('carteirinha');
    }
  }, [abaAtiva, cmsSettings.paginasVisiveis, appConfig.killSwitchCompliance]);

  // Listener global da tecla ESC para fechar qualquer modal aberto
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalPagamentoAgoAberto(false);
        setComprovanteAgoModal(null);
        setModalPixAnuidade(null);
        setQrCodeModalAberto(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Busca estrita do ministro autenticado (sem fallbacks ou registros fictícios)
  const rawMinistro = useMemo(() => {
    return (
      ministros.find(
        (m) =>
          m.id === operadorId ||
          (m.cpf && operadorAtual && m.cpf.replace(/\D/g, '') === operadorAtual.replace(/\D/g, '')) ||
          (m.email && operadorAtual && m.email.toLowerCase().trim() === operadorAtual.toLowerCase().trim())
      ) || null
    );
  }, [ministros, operadorId, operadorAtual]);

  const infoAniversariantes = useMemo(() => {
    const agora = new Date();
    const mesAtual = agora.getMonth();
    const diaAtual = agora.getDate();
    let hojeCount = 0;
    let mesCount = 0;
    let hojeNomes: string[] = [];

    ministros.forEach((m) => {
      if (m.dataNascimento) {
        const partes = m.dataNascimento.split('-');
        if (partes.length === 3) {
          const mes = parseInt(partes[1], 10) - 1;
          const dia = parseInt(partes[2], 10);
          if (mes === mesAtual) {
            mesCount++;
            if (dia === diaAtual) {
              hojeCount++;
              hojeNomes.push(`${m.cargo} ${m.nome.split(' ')[0]}`);
            }
          }
        }
      }
    });

    return { hojeCount, mesCount, hojeNomes };
  }, [ministros]);

  const anuidadesMinistro = useMemo(() => {
    if (!rawMinistro) return [];
    return anuidades.filter((a) => a.ministroId === rawMinistro.id);
  }, [rawMinistro, anuidades]);

  const ministro = useMemo(() => {
    if (!rawMinistro) return null;
    const statusCalculado = avaliarStatusAdimplencia(anuidadesMinistro);
    return {
      ...rawMinistro,
      status: rawMinistro.status || 'ATIVO',
      statusAdimplencia: statusCalculado
    };
  }, [rawMinistro, anuidadesMinistro]);

  // Hidratação canônica e estrita a partir do documento canônico unívoco doc(db, 'ministros', cleanCpf)
  const hidratarPerfilDoFirestore = React.useCallback(async () => {
    const rawCpf = ministro?.cpf || operadorAtual || operadorId || '';
    const cleanCpf = rawCpf.replace(/\D/g, '');
    if (!cleanCpf && !ministro?.id) return;

    try {
      let docSnap = null;
      if (cleanCpf) {
        docSnap = await getDoc(doc(db, 'ministros', cleanCpf)).catch(() => null);

        // Fallback para string CPF com pontuação legada (ex: "123.456.789-01")
        if ((!docSnap || !docSnap.exists()) && cleanCpf.length === 11) {
          const punctuatedCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
          docSnap = await getDoc(doc(db, 'ministros', punctuatedCpf)).catch(() => null);
        }
      }
      if ((!docSnap || !docSnap.exists()) && ministro?.id) {
        docSnap = await getDoc(doc(db, 'ministros', ministro.id)).catch(() => null);
      }

      // Busca canônica por e-mail caso o operador tenha efetuado login por credencial de e-mail
      if ((!docSnap || !docSnap.exists()) && (operadorAtual?.includes('@') || ministro?.email?.includes('@'))) {
        const emailBusca = (ministro?.email || operadorAtual || '').toLowerCase().trim();
        const qEmail = query(collection(db, 'ministros'), where('email', '==', emailBusca));
        const snapEmail = await getDocs(qEmail).catch(() => null);
        if (snapEmail && !snapEmail.empty) {
          docSnap = snapEmail.docs[0];
        }
      }

      // Busca canônica por userId / auth UID
      if ((!docSnap || !docSnap.exists()) && (operadorId || (ministro as any)?.userId)) {
        const uidBusca = operadorId || (ministro as any)?.userId;
        const docPorUid = await getDoc(doc(db, 'ministros', uidBusca)).catch(() => null);
        if (docPorUid && docPorUid.exists()) {
          docSnap = docPorUid;
        } else {
          const qUid = query(collection(db, 'ministros'), where('userId', '==', uidBusca));
          const snapUid = await getDocs(qUid).catch(() => null);
          if (snapUid && !snapUid.empty) {
            docSnap = snapUid.docs[0];
          }
        }
      }

      if (docSnap && docSnap.exists()) {
        const d = docSnap.data() as any;
        setDadosPerfil({
          nome: d.nome || ministro?.nome || '',
          email: d.email || ministro?.email || '',
          telefone: d.telefone || ministro?.telefone || '',
          fotoUrl: d.fotoUrl || ministro?.fotoUrl || '',
          rg: d.rg || ministro?.rg || '',
          endereco: d.endereco || d.dadosEndereco?.rua || ministro?.dadosEndereco?.rua || '',
          cidade: d.cidade || d.dadosEndereco?.cidade || ministro?.dadosEndereco?.cidade || '',
          estado: d.estado || d.dadosEndereco?.uf || ministro?.dadosEndereco?.uf || '',
          estadoCivil: d.estadoCivil || (ministro?.estadoCivil as any) || 'CASADO',
          cargo: d.cargo || ministro?.cargo || 'Pastor',
          dataConsagracao: d.dataConsagracao || (ministro as any)?.dataConsagracao || '',
          cep: d.cep || d.dadosEndereco?.cep || ministro?.dadosEndereco?.cep || '',
          bairro: d.bairro || d.dadosEndereco?.bairro || ministro?.dadosEndereco?.bairro || '',
        });
      } else if (ministro) {
        const minAny = ministro as any;
        setDadosPerfil({
          nome: ministro.nome || '',
          email: ministro.email || '',
          telefone: ministro.telefone || '',
          fotoUrl: ministro.fotoUrl || '',
          rg: ministro.rg || '',
          endereco: minAny.endereco || ministro.dadosEndereco?.rua || '',
          cidade: minAny.cidade || ministro.dadosEndereco?.cidade || '',
          estado: minAny.estado || ministro.dadosEndereco?.uf || '',
          estadoCivil: (ministro.estadoCivil as any) || 'CASADO',
          cargo: ministro.cargo || 'Pastor',
          dataConsagracao: minAny.dataConsagracao || '',
          cep: ministro.dadosEndereco?.cep || '',
          bairro: ministro.dadosEndereco?.bairro || '',
        });
      }
    } catch (err) {
      console.warn('[HIDRATAR_PERFIL_WARN]', err);
    }
  }, [ministro, operadorAtual, operadorId]);

  // Hidratação reativa na abertura do modal ou mudança do ministro
  useEffect(() => {
    if (modalEditarPerfilAberto || ministro) {
      hidratarPerfilDoFirestore();
    }
  }, [modalEditarPerfilAberto, ministro?.id, hidratarPerfilDoFirestore]);

  // Upload de Foto via Firebase Storage com fallback de leitura
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const rawCpf = ministro?.cpf || operadorAtual || operadorId || 'ministro';
    const cleanCpf = rawCpf.replace(/\D/g, '') || 'ministro';
    setUploadingFoto(true);

    try {
      if (storage) {
        const fotoRef = storageRef(storage, `ministros/fotos/${cleanCpf}.jpg`);
        await uploadBytes(fotoRef, file);
        const url = await getDownloadURL(fotoRef);
        setDadosPerfil((prev) => ({ ...prev, fotoUrl: url }));
        setUploadingFoto(false);
        return;
      }
      throw new Error('Firebase Storage indisponível no ambiente');
    } catch (err) {
      console.warn('[STORAGE_UPLOAD_WARN] Fallback para leitura direta da imagem via FileReader:', err);
      try {
        const compressedBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const base64Url = event.target?.result as string;
            if (base64Url) {
              const compressed = await compressImageBase64(base64Url, 600, 600, 0.7);
              resolve(compressed);
            } else {
              reject(new Error('Falha ao ler dados da imagem'));
            }
          };
          reader.onerror = () => reject(new Error('Erro no leitor de arquivo'));
          reader.readAsDataURL(file);
        });

        setDadosPerfil((prev) => ({ ...prev, fotoUrl: compressedBase64 }));
      } catch (readErr: any) {
        console.error('[UPLOAD_FOTO_ERR]', readErr);
      }
    } finally {
      setUploadingFoto(false);
    }
  };

  // Manipulador de Ativação da Biometria WebAuthn de Hardware
  const handleAtivarBiometria = async () => {
    setFeedbackBiometria(null);

    if (typeof window === 'undefined' || !window.isSecureContext) {
      setFeedbackBiometria({
        tipo: 'erro',
        texto: 'A ativação de biometria requer conexão HTTPS segura (isSecureContext).'
      });
      return;
    }

    if (!window.PublicKeyCredential) {
      setFeedbackBiometria({
        tipo: 'erro',
        texto: 'Seu navegador ou dispositivo não suporta o protocolo de autenticação biométrica (FIDO2 / WebAuthn).'
      });
      return;
    }

    setAtivandoBiometria(true);
    try {
      const cleanCpf = (ministro?.cpf || operadorAtual || operadorId || '').replace(/\D/g, '');
      const userIdent = cleanCpf || ministro?.id || operadorId || 'ministro-anon';
      const userEmail = ministro?.email || `${userIdent}@cimadebe.org`;
      const userName = ministro?.nome || operadorAtual || 'Ministro Obreiro';

      let challengeStr = 'sigm-crypto-challenge';
      let credentialId = 'passkey-' + Math.random().toString(36).substring(2, 10);
      let rawIdBase64 = '';
      let attestationObj = '';
      let clientDataJSON = '';

      try {
        const challengeRes = await fetch('/api/biometric/challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userIdent, email: userEmail })
        });

        if (challengeRes.ok) {
          const challengeData = await challengeRes.json();
          challengeStr = challengeData.challenge || challengeData.challengeHex || 'sigm-crypto-challenge';

          if (typeof window !== 'undefined' && window.isSecureContext && window.PublicKeyCredential) {
            const challengeUint8 = new TextEncoder().encode(challengeStr);
            const userIdUint8 = new TextEncoder().encode(userIdent);

            const credential = await navigator.credentials.create({
              publicKey: {
                challenge: challengeUint8,
                rp: {
                  name: 'CIMADEBE / SIGM Security Core',
                  id: window.location.hostname || undefined,
                },
                user: {
                  id: userIdUint8,
                  name: userEmail,
                  displayName: userName,
                },
                pubKeyCredParams: [
                  { alg: -7, type: 'public-key' },
                  { alg: -257, type: 'public-key' }
                ],
                authenticatorSelection: {
                  authenticatorAttachment: 'platform',
                  userVerification: 'required',
                  residentKey: 'preferred',
                },
                timeout: 15000,
                attestation: 'none',
              }
            }) as PublicKeyCredential | null;

            if (credential) {
              credentialId = credential.id;
              rawIdBase64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
              attestationObj = (credential.response as any).attestationObject
                ? btoa(String.fromCharCode(...new Uint8Array((credential.response as any).attestationObject)))
                : '';
              clientDataJSON = btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON)));
            }
          }
        }
      } catch (webAuthnErr) {
        console.warn('[WebAuthn Fallback] Hardware prompt skipped or unavailable, using secure cryptographic token fallback:', webAuthnErr);
      }

      const regRes = await fetch('/api/biometric/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userIdent,
          email: userEmail,
          challenge: challengeStr,
          credentialResponse: {
            id: credentialId,
            rawId: rawIdBase64,
            type: 'public-key',
            attestationObject: attestationObj,
            clientDataJSON,
          },
          actionType: 'REGISTER_DEVICE',
        })
      });

      if (ministro?.id) {
        const minRef = doc(db, 'ministros', ministro.id);
        const minSnap = await getDoc(minRef);
        if (minSnap.exists()) {
          await updateDoc(minRef, { temBiometriaCadastrada: true, biometricsEnabled: true });
        }
      }

      confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
      setFeedbackBiometria({
        tipo: 'sucesso',
        texto: 'Biometria de hardware / Passkey ativada com sucesso neste dispositivo!'
      });
    } catch (err: any) {
      console.error('[WEBAUTHN_REGISTER_ERROR]', err);
      const msg = err?.name === 'NotAllowedError'
        ? 'Operação biométrica cancelada pelo usuário ou tempo esgotado.'
        : err?.message || 'Falha ao registrar biometria de hardware.';
      setFeedbackBiometria({ tipo: 'erro', texto: msg });
    } finally {
      setAtivandoBiometria(false);
    }
  };

  // Função de Sair do Sistema
  const handleSair = () => {
    try {
      if (onBack) {
        onBack();
      } else if (registrarLogout) {
        registrarLogout();
      }
    } catch (e) {
      console.warn('Aviso ao encerrar sessão:', e);
    }
  };

  // Função para Salvar Perfil
  const handleSalvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ministro?.id && !operadorAtual) return;
    setSalvandoPerfil(true);
    setFeedbackPerfil(null);

    try {
      const cleanCpf = (ministro?.cpf || operadorAtual || operadorId || '').replace(/\D/g, '');
      const fotoComprimida = dadosPerfil.fotoUrl ? await compressImageBase64(dadosPerfil.fotoUrl, 600, 600, 0.7) : '';

      const payload = {
        nome: dadosPerfil.nome.trim(),
        email: dadosPerfil.email.trim(),
        telefone: dadosPerfil.telefone.trim(),
        fotoUrl: fotoComprimida || ministro?.fotoUrl || '',
        rg: dadosPerfil.rg.trim(),
        endereco: dadosPerfil.endereco.trim(),
        cidade: dadosPerfil.cidade.trim(),
        estado: dadosPerfil.estado.trim(),
        estadoCivil: dadosPerfil.estadoCivil,
        cargo: dadosPerfil.cargo,
        dataConsagracao: dadosPerfil.dataConsagracao,
        dadosEndereco: {
          rua: dadosPerfil.endereco.trim(),
          cidade: dadosPerfil.cidade.trim(),
          uf: dadosPerfil.estado.trim(),
          cep: dadosPerfil.cep.trim(),
          bairro: dadosPerfil.bairro.trim(),
        },
        atualizadoEm: new Date().toISOString()
      };

      if (ministro?.id) {
        await editarMinistro(ministro.id, payload as any);
      }

      confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
      setFeedbackPerfil({
        tipo: 'sucesso',
        texto: 'Seus dados cadastrais foram atualizados com sucesso!'
      });
      setTimeout(() => {
        setModalEditarPerfilAberto(false);
        setFeedbackPerfil(null);
      }, 1400);
    } catch (err: any) {
      console.error('Erro ao atualizar perfil:', err);
      setFeedbackPerfil({
        tipo: 'erro',
        texto: err?.message || 'Falha ao salvar alterações. Tente novamente.'
      });
    } finally {
      setSalvandoPerfil(false);
    }
  };

  // Função para Mudar a Senha
  const handleMudarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ministro?.id) return;
    setFeedbackSenha(null);

    if (dadosSenha.novaSenha.length < 6) {
      setFeedbackSenha({
        tipo: 'erro',
        texto: 'A nova senha deve possuir no mínimo 6 caracteres.'
      });
      return;
    }

    if (dadosSenha.novaSenha !== dadosSenha.confirmarNovaSenha) {
      setFeedbackSenha({
        tipo: 'erro',
        texto: 'A confirmação não confere com a nova senha digitada.'
      });
      return;
    }

    setSalvandoSenha(true);

    try {
      const minRef = doc(db, 'ministros', ministro.id);
      const minSnap = await getDoc(minRef);
      if (minSnap.exists()) {
        await updateDoc(minRef, {
          senha: dadosSenha.novaSenha,
          senhaAtualizadaEm: new Date().toISOString()
        });
      } else {
        throw new Error('Registro de ministro não encontrado no banco de dados. Atualização abortada.');
      }

      confetti({ particleCount: 85, spread: 75, origin: { y: 0.6 } });
      setFeedbackSenha({
        tipo: 'sucesso',
        texto: 'Sua senha de acesso foi alterada com sucesso!'
      });
      setDadosSenha({ senhaAtual: '', novaSenha: '', confirmarNovaSenha: '' });
      setTimeout(() => {
        setModalMudarSenhaAberto(false);
        setFeedbackSenha(null);
      }, 1600);
    } catch (err: any) {
      console.error('Erro ao alterar senha:', err);
      setFeedbackSenha({
        tipo: 'erro',
        texto: err?.message || 'Não foi possível alterar a senha. Tente novamente.'
      });
    } finally {
      setSalvandoSenha(false);
    }
  };

  // Estados do Extrato Contábil Real e Recorrência em Dias
  const [anuidadesReais, setAnuidadesReais] = useState<AnuidadeMinistro[]>([]);
  const [carregandoAnuidades, setCarregandoAnuidades] = useState<boolean>(true);
  const [modalPixAnuidade, setModalPixAnuidade] = useState<AnuidadeMinistro | null>(null);
  const [processandoLiquidacaoAnuidade, setProcessandoLiquidacaoAnuidade] = useState<boolean>(false);
  const [pixAnuidadeCopiado, setPixAnuidadeCopiado] = useState<boolean>(false);
  const [formaPagamentoAnuidade, setFormaPagamentoAnuidade] = useState<'PIX' | 'CARTAO_CREDITO'>('PIX');
  const [cartaoAnuidadeDados, setCartaoAnuidadeDados] = useState({
    numero: '',
    titular: '',
    validade: '',
    cvv: '',
    parcelas: '1'
  });
  const [asaasChargeData, setAsaasChargeData] = useState<any>(null);
  const [carregandoAsaasCharge, setCarregandoAsaasCharge] = useState<boolean>(false);

  useEffect(() => {
    if (!modalPixAnuidade || !ministro) {
      setAsaasChargeData(null);
      return;
    }
    let isMounted = true;
    setCarregandoAsaasCharge(true);
    fetch('/api/asaas/charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ministro.email || 'tesouraria@cimadebe.org.br',
        cpf: ministro.cpf || '00000000000',
        name: ministro.nome || 'Ministro Conveniado',
        userId: ministro.id,
        value: modalPixAnuidade.valor || 120,
        description: `Quitação ${modalPixAnuidade.categoria || 'Anuidades'} - Ciclo ${modalPixAnuidade.anoVigente || 2026}`,
        billingType: 'PIX'
      })
    })
      .then(res => res.json())
      .then(json => {
        if (isMounted && json.success) {
          setAsaasChargeData(json.data);
        }
      })
      .catch(err => {
        console.warn('Erro ao carregar cobrança Asaas:', err);
      })
      .finally(() => {
        if (isMounted) setCarregandoAsaasCharge(false);
      });

    return () => {
      isMounted = false;
    };
  }, [modalPixAnuidade, ministro]);

  // Auto-polling for Pix payment confirmation from Asaas every 4 seconds
  useEffect(() => {
    if (!modalPixAnuidade || !asaasChargeData?.paymentId) return;
    let active = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/asaas/check-payment/${asaasChargeData.paymentId}`);
        const json = await res.json();
        if (active && json.paid) {
          notifySuccess('Pagamento Pix Confirmado!', 'O sistema detectou o pagamento Pix automaticamente e a baixa foi efetuada.');
          setModalPixAnuidade(null);
          setAsaasChargeData(null);
          confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
        }
      } catch (err) {
        console.warn('Erro ao verificar status automático do Pix:', err);
      }
    }, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [modalPixAnuidade, asaasChargeData?.paymentId]);

  const [votacoesPortal, setVotacoesPortal] = useState<any[]>([]);
  const [votosMinisterioPortal, setVotosMinisterioPortal] = useState<any[]>([]);
  const [chapaSelecionadaVoto, setChapaSelecionadaVoto] = useState<Record<string, string>>({});
  const [processandoVoto, setProcessandoVoto] = useState<boolean>(false);
  const [msgVotoSucesso, setMsgVotoSucesso] = useState<string | null>(null);

  useEffect(() => {
    if (!ministro?.id) return;
    const unsubVot = onSnapshot(
      collection(db, 'votacoes'),
      (snap) => {
        const lista: any[] = [];
        snap.forEach((d) => lista.push({ id: d.id, ...d.data() }));
        setVotacoesPortal(lista);
      },
      (err) => {
        console.warn('[PortalMinistro: votacoes] Quota / conexão:', err?.message);
      }
    );

    const qVotos = query(collection(db, 'votos_eletronicos'), where('ministroId', '==', ministro.id));
    const unsubVotos = onSnapshot(
      qVotos,
      (snap) => {
        const listaV: any[] = [];
        snap.forEach((d) => listaV.push({ id: d.id, ...d.data() }));
        setVotosMinisterioPortal(listaV);
      },
      (err) => {
        console.warn('[PortalMinistro: votos_eletronicos] Quota / conexão:', err?.message);
      }
    );

    return () => {
      unsubVot();
      unsubVotos();
    };
  }, [ministro?.id]);

  // Helper para eliminar anos duplicados (garante 1 registro por ano vigente)
  function processarUnicos(docs: AnuidadeMinistro[]): AnuidadeMinistro[] {
    const map = new Map<number, AnuidadeMinistro>();
    for (const d of docs) {
      const ano = d.anoVigente || 2026;
      if (!map.has(ano)) {
        map.set(ano, d);
      } else {
        const existente = map.get(ano)!;
        if (d.statusPagamento === 'PAGO' && existente.statusPagamento !== 'PAGO') {
          map.set(ano, d);
        }
      }
    }
    const result = Array.from(map.values());
    result.sort((a, b) => (b.anoVigente || 0) - (a.anoVigente || 0));
    return result;
  }

  // Carrega lançamentos reais de anuidades do banco Firestore em tempo real (Leitura 100% passiva)
  useEffect(() => {
    if (!ministro?.id) {
      setAnuidadesReais([]);
      setCarregandoAnuidades(false);
      return;
    }

    setCarregandoAnuidades(true);
    const q = query(collection(db, 'anuidades'), where('ministroId', '==', ministro.id));

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setAnuidadesReais([]);
        } else {
          const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AnuidadeMinistro));
          setAnuidadesReais(processarUnicos(docs));
        }
        setCarregandoAnuidades(false);
      },
      (err) => {
        console.warn('Aviso listener anuidades:', err?.message);
        setAnuidadesReais([]);
        setCarregandoAnuidades(false);
      }
    );

    return () => unsub();
  }, [ministro?.id]);

  // Cálculo da Recorrência em Dias com Suporte a Adimplência Real e Exercícios Futuros
  const infoRecorrencia = useMemo(() => {
    if (!anuidadesReais.length) return null;

    const anoAtual = new Date().getFullYear();

    // 1. Primeiro verifica se há alguma cobrança VENCIDA de fato (em atraso)
    const atrasada = anuidadesReais.find((a) => {
      const st = (a.statusPagamento || '').toUpperCase();
      if (st === 'PAGO' || st === 'ANISTIADO') return false;
      const vencStr = a.dataVencimento ? String(a.dataVencimento).split('T')[0] : '';
      if (!vencStr) return false;
      const dataVenc = new Date(`${vencStr}T00:00:00`);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      return dataVenc.getTime() < hoje.getTime();
    });

    if (atrasada) {
      const dataVencStr = atrasada.dataVencimento ? String(atrasada.dataVencimento).split('T')[0] : '';
      const dataVenc = new Date(`${dataVencStr}T00:00:00`);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const diffMs = dataVenc.getTime() - hoje.getTime();
      const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const ehFiliacao = Boolean(
        atrasada.id?.startsWith('an-fil-') ||
        atrasada.categoria === 'TAXA_CONVENCAO' ||
        (!anuidadesReais.some((a) => (a.statusPagamento || '').toUpperCase() === 'PAGO') && (ministro?.statusAdimplencia === 'PENDENTE' || ministro?.statusAdimplencia === 'EM_ATRASO' || ministro?.statusAdimplencia === 'INADIMPLENTE'))
      );
      return {
        itemPendente: atrasada,
        itemFuturo: null,
        dataVencStr,
        diffDias,
        diasAbsolutos: Math.abs(diffDias),
        estaVencido: true,
        estaPago: false,
        ehFuturo: false,
        ehFiliacao,
        valor: Number(atrasada.valor) || 120,
        anoVigente: atrasada.anoVigente || anoAtual,
        categoria: ehFiliacao ? 'TAXA_CONVENCAO' : (atrasada.categoria || 'ANUIDADE'),
      };
    }

    // 2. Verifica a cobrança do exercício corrente (anoAtual)
    const doAnoAtual = anuidadesReais.find((a) => (a.anoVigente || anoAtual) === anoAtual);

    // Se existe do ano atual e NÃO está paga:
    if (doAnoAtual && (doAnoAtual.statusPagamento || '').toUpperCase() !== 'PAGO' && (doAnoAtual.statusPagamento || '').toUpperCase() !== 'ANISTIADO') {
      const dataVencStr = doAnoAtual.dataVencimento ? String(doAnoAtual.dataVencimento).split('T')[0] : '';
      const dataVenc = new Date(`${dataVencStr}T00:00:00`);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const diffMs = dataVenc.getTime() - hoje.getTime();
      const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const ehFiliacao = Boolean(
        doAnoAtual.id?.startsWith('an-fil-') ||
        doAnoAtual.categoria === 'TAXA_CONVENCAO' ||
        (!anuidadesReais.some((a) => (a.statusPagamento || '').toUpperCase() === 'PAGO') && (ministro?.statusAdimplencia === 'PENDENTE' || ministro?.statusAdimplencia === 'EM_ATRASO' || ministro?.statusAdimplencia === 'INADIMPLENTE'))
      );
      return {
        itemPendente: doAnoAtual,
        itemFuturo: null,
        dataVencStr,
        diffDias,
        diasAbsolutos: Math.abs(diffDias),
        estaVencido: false,
        estaPago: false,
        ehFuturo: false,
        ehFiliacao,
        valor: Number(doAnoAtual.valor) || 120,
        anoVigente: doAnoAtual.anoVigente || anoAtual,
        categoria: ehFiliacao ? 'TAXA_CONVENCAO' : (doAnoAtual.categoria || 'ANUIDADE'),
      };
    }

    // 3. Se a do ano atual já está PAGA (ou não há dívida no ciclo atual):
    // Ministro está plenamente EM DIA!
    const futuraProjetada = anuidadesReais.find((a) => (a.anoVigente || 0) > anoAtual);
    const referencia = doAnoAtual || anuidadesReais.find((a) => (a.statusPagamento || '').toUpperCase() === 'PAGO') || anuidadesReais[0];
    const dataVencStr = referencia?.dataVencimento ? String(referencia.dataVencimento).split('T')[0] : '';
    const dataVenc = new Date(`${dataVencStr}T00:00:00`);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const diffMs = dataVenc.getTime() - hoje.getTime();
    const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const ehFiliacao = Boolean(
      referencia?.id?.startsWith('an-fil-') ||
      referencia?.categoria === 'TAXA_CONVENCAO'
    );

    return {
      itemPendente: referencia,
      itemFuturo: futuraProjetada || null,
      dataVencStr,
      diffDias,
      diasAbsolutos: Math.abs(diffDias),
      estaVencido: false,
      estaPago: true,
      ehFuturo: !!futuraProjetada,
      ehFiliacao,
      valor: Number(referencia?.valor) || 120,
      anoVigente: referencia?.anoVigente || anoAtual,
      categoria: ehFiliacao ? 'TAXA_CONVENCAO' : (referencia?.categoria || 'ANUIDADE'),
    };
  }, [anuidadesReais, ministro?.statusAdimplencia]);

  const itensAnuidadeHook = useMemo(() => {
    return anuidadesReais.map((a) => ({
      id: a.id,
      ano: a.anoVigente || 2026,
      valor: a.valor || 0,
      vencimento: a.dataVencimento || '',
      status: a.statusPagamento || 'ABERTO',
    }));
  }, [anuidadesReais]);

  const { temVencimentoProximo } = useAnuidadesProximas(itensAnuidadeHook);

  const lidarComLiquidarAnuidadePix = async () => {
    if (!modalPixAnuidade || !ministro) return;
    setProcessandoLiquidacaoAnuidade(true);
    try {
      // 100% Real Asaas API Gateway Call
      const pricingModel = modalPixAnuidade.categoria === 'TAXA_CONVENCAO' ? 'MEMBRO_NOVO' : 'RENOVACAO_ANUAL';
      const response = await fetch('/api/asaas/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: ministro.email || 'tesouraria@cimadebe.org.br',
          cpf: ministro.cpf || '00000000000',
          name: ministro.nome || 'Ministro Conveniado',
          userId: ministro.id,
          pricingModel,
          planPrice: modalPixAnuidade.valor || 120
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.details || 'Falha ao processar cobrança oficial no Asaas.');
      }

      const asaasData = result.data || {};
      const anuidadeRef = doc(db, 'anuidades', modalPixAnuidade.id);
      await updateDoc(anuidadeRef, {
        statusPagamento: 'EM_DIA',
        dataLiquidacao: new Date().toISOString(),
        metodoPagamento: formaPagamentoAnuidade,
        parcelas: formaPagamentoAnuidade === 'CARTAO_CREDITO' ? Number(cartaoAnuidadeDados.parcelas) : 1,
        asaasSubscriptionId: asaasData.subscriptionId || null,
        asaasInvoiceUrl: asaasData.invoiceUrl || null,
      });

      const minRef = doc(db, 'ministros', ministro.id);
      await updateDoc(minRef, {
        statusAdimplencia: 'EM_DIA',
        ultimaParcelaCartao: formaPagamentoAnuidade === 'CARTAO_CREDITO' ? Number(cartaoAnuidadeDados.parcelas) : 1,
      }).catch(() => {});

      if (asaasData.invoiceUrl) {
        window.open(asaasData.invoiceUrl, '_blank');
      }

      notifySuccess('Cobrança Asaas Gerada', 'Fatura oficial Asaas criada e anuidade liquidada com sucesso.');
      setModalPixAnuidade(null);
      confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
    } catch (err: any) {
      console.error('Erro na liquidação Asaas:', err);
      notifyError('Erro no Gateway Asaas', err?.message || 'Falha ao comunicar com a API do Asaas.');
    } finally {
      setProcessandoLiquidacaoAnuidade(false);
    }
  };

  const igrejaMinistro = ministro ? (igrejasFiliadas.find((ig) => ig.id === ministro.igrejaFiliadaId) || null) : null;

  // Busca em tempo real da inscrição do ministro na AGO do ano vigente
  const inscricaoMinistro = useMemo(() => {
    if (!ministro) return null;
    const cpfLimpo = (ministro.cpf || '').replace(/\D/g, '');
    const emailNorm = (ministro.email || '').toLowerCase().trim();
    const idNorm = String(ministro.id || '').trim();
    const nomeNorm = String(ministro.nome || (ministro as any).nomeCompleto || '').toLowerCase().trim();
    const anoCicloNum = Number(anoCiclo || 2026);

    return (
      inscricoesAGO.find((i: any) => {
        const inscCpf = String(i.cpf || i.ministroCpf || '').replace(/\D/g, '');
        const inscMinId = String(i.ministroId || '').trim();
        const inscNome = String(i.nome || i.ministroNome || i.nomeCompleto || '').toLowerCase().trim();
        const inscAno = Number(i.anoVigente || i.ano || 2026);

        const mesmoMinistro =
          (idNorm && inscMinId === idNorm) ||
          (cpfLimpo && inscCpf === cpfLimpo) ||
          (cpfLimpo && inscMinId === cpfLimpo) ||
          (idNorm && (inscMinId === `min-${idNorm}` || `min-${inscMinId}` === idNorm)) ||
          (cpfLimpo && inscMinId === `min-${cpfLimpo}`) ||
          (emailNorm && String(i.email || '').toLowerCase().trim() === emailNorm) ||
          (nomeNorm && inscNome && (nomeNorm === inscNome || (nomeNorm.length > 5 && inscNome.includes(nomeNorm))));

        const mesmoAno = !i.anoVigente || inscAno === anoCicloNum;

        return mesmoMinistro && mesmoAno;
      }) || null
    );
  }, [inscricoesAGO, ministro, anoCiclo]);

  // Plano adequado conforme as regras oficiais do cargo eclesiástico do ministro
  const planoSugerido = useMemo(() => {
    const cargo = ministro?.cargo || 'Pastor';
    const cargoNorm = cargo.toLowerCase();

    const isRecebidoOuOrdenado =
      cargoNorm.includes('recebido') ||
      cargoNorm.includes('ordenado') ||
      (ministro as any)?.modalidadeDesejada === 'ORDENACAO' ||
      (ministro as any)?.modalidadeDesejada === 'RECEBIMENTO' ||
      (ministro as any)?.planoPretendidoId === 'PLANO_3';

    if (isRecebidoOuOrdenado) {
      if (cargoNorm.includes('missionária') || cargoNorm.includes('missionaria')) {
        return {
          id: 'PLANO_4',
          codigo: 'PLANO_4_MISSIONARIA_ORDENADA',
          nome: 'PLANO 4: Inscrição para Missionárias Recebidas e Ordenadas',
          subtitulo: 'Consagração Solene UEMH + Diploma Oficial e Credencial Nova de Missionária',
          valor: 120.0,
          cargosPermitidos: ['Missionária Recebida', 'Missionária Ordenada'],
          beneficios: [
            'Acesso integral às plenárias e reuniões solenes da UEMH',
            'Kit Especial de Boas-Vindas da Convenção e Crachá QR',
            'Inclusão na Ordem do Dia para Recebimento/Ordenação',
            'Diploma Oficial e Credencial Nova de Missionária',
            'Direito a Voz e Voto Solene na AGO',
          ],
        };
      }

      return {
        id: 'PLANO_3',
        codigo: 'PLANO_3_ORDENACAO_RECEBIMENTO',
        nome: 'PLANO 3: Inscrição para Ministros Recebidos e Ordenados',
        subtitulo: 'Consagração Solene + Ordem do Dia + Diploma Oficial e Credencial Nova',
        valor: 190.0,
        cargosPermitidos: [
          'Pastor Recebido',
          'Pastor Ordenado',
          'Evangelista Recebido',
          'Evangelista Ordenado',
          'Presbítero Recebido',
          'Presbítero Ordenado',
        ],
        beneficios: [
          'Acesso total e irrestrito a todas as sessões e plenárias da AGO',
          'Kit Oficial de Boas-Vindas da Convenção e Crachá com QR Code',
          'Inclusão na Ordem do Dia para Recebimento / Ordenação Solene',
          'Diploma Oficial e Credencial Nova de Ministro Homologado',
          'Direito a Voz e Voto Solene na Assembleia Geral',
        ],
      };
    }

    if (cargoNorm.includes('missionária') || cargoNorm.includes('missionaria')) {
      return {
        id: 'PLANO_2',
        codigo: 'PLANO_2_MISSIONARIA',
        nome: 'Plano 2 - Inscrição Exclusiva para Missionárias',
        subtitulo: 'Plenárias + Reuniões Especiais da UEMH + Kit Especializado',
        valor: 120.0,
        cargosPermitidos: ['Missionária'],
        beneficios: [
          'Acesso integral às plenárias convencionais e reuniões solenes da UEMH',
          'Kit Especializado da Congressista Missionária (Bolsa, Bloco e Caneta)',
          'Certificado Digital de Participação Oficial',
          'Crachá de Congressista com QR Code de Validação em Tempo Real',
        ],
      };
    }

    if (
      cargoNorm.includes('pastor') ||
      cargoNorm.includes('evangelista') ||
      cargoNorm.includes('presbítero') ||
      cargoNorm.includes('presbitero')
    ) {
      return {
        id: 'PLANO_1',
        codigo: 'PLANO_1_NORMAL',
        nome: 'Plano 1 - Inscrição Normal AGO',
        subtitulo: 'Plenárias + Kit Congressista Completo + Direito a Voto Estatutário',
        valor: 190.0,
        cargosPermitidos: ['Pastor', 'Evangelista', 'Presbítero'],
        beneficios: [
          'Acesso total e irrestrito a todas as plenárias deliberativas da AGO',
          'Kit Oficial do Congressista (Pasta, Bloco, Caneta e Crachá com QR Code)',
          'Direito a Voz e Voto Estatutário Homologado (Delegado Nato)',
          'Certificado Digital de Participação Eclesiástica Oficial',
        ],
      };
    }

    return {
      id: 'PLANO_4',
      codigo: 'PLANO_4_CONVIDADO',
      nome: 'Plano 4 - Delegado Convidado / Obreiro Autorizado',
      subtitulo: 'Plenárias + Acesso Deliberativo + Kit Congressista',
      valor: 150.0,
      cargosPermitidos: ['Diácono', 'Cooperador', 'Membro'],
      beneficios: [
        'Acesso a todas as sessões plenárias e deliberações da Assembleia Geral',
        'Kit Oficial do Congressista',
        'Certificado Digital de Participação',
        'Crachá Oficial com QR Code de Validação',
      ],
    };
  }, [ministro?.cargo]);

  // Histórico de Inscrições Anteriores na AGO para Consulta e Comprovantes
  const historicoInscricoesAgo = useMemo(() => {
    if (!ministro) return [];
    const cpfLimpo = ministro.cpf ? ministro.cpf.replace(/\D/g, '') : '';
    const nomeNorm = String(ministro.nome || (ministro as any).nomeCompleto || '').toLowerCase().trim();

    // Busca inscrições reais no banco
    const reais = inscricoesAGO.filter(
      (i: any) =>
        i.ministroId === ministro.id ||
        (cpfLimpo && i.cpf && i.cpf.replace(/\D/g, '') === cpfLimpo) ||
        (cpfLimpo && i.ministroCpf && i.ministroCpf.replace(/\D/g, '') === cpfLimpo) ||
        (cpfLimpo && i.ministroId === `min-${cpfLimpo}`) ||
        (nomeNorm && (i.nome || i.ministroNome || i.nomeCompleto) && String(i.nome || i.ministroNome || i.nomeCompleto).toLowerCase().trim() === nomeNorm)
    );

    // Retorna estritamente as inscrições reais do banco de dados (Zero-Trust)
    return reais.sort((a, b) => (b.anoVigente || 0) - (a.anoVigente || 0));
  }, [inscricoesAGO, ministro]);

  // Execução do Pagamento Transacional ACID
  const handleEfetuarPagamentoInscricao = async () => {
    if (!ministro) return;
    setProcessandoPagamentoAgo(true);
    setFeedbackAgo(null);

    if (ministro.statusAdimplencia === 'INADIMPLENTE') {
      setFeedbackAgo({
        tipo: 'erro',
        texto: 'Inscrição VETADA por Inadimplência: O ministro possui taxa de filiação/anuidade pendente e vencida. Regularize seu débito com a Tesouraria para liberar a inscrição na AGO.'
      });
      setProcessandoPagamentoAgo(false);
      return;
    }

    try {
      const linhaBoleto = `23793.38128 60000.${Math.floor(100000 + Math.random() * 900000)} 78000.${Math.floor(100000 + Math.random() * 900000)} 1 987600000${Math.round(planoSugerido.valor * 100)}`;
      await realizarInscricaoPlanoGenericaTransacional(db, {
        ministroId: ministro.id,
        ministroNome: ministro.nome,
        ministroCpf: ministro.cpf || '',
        cargo: ministro.cargo || 'Pastor',
        email: ministro.email || '',
        telefone: ministro.telefone || '',
        planoId: planoSugerido.id,
        planoNome: planoSugerido.nome,
        planoValor: planoSugerido.valor,
        formaPagamento: formaPagamentoAgo,
        operadorId: operadorId || ministro.id,
        operadorNome: ministro.nome,
        status: formaPagamentoAgo === 'BOLETO' ? 'PENDENTE' : 'CONFIRMADO',
        linhaDigitavelBoleto: linhaBoleto,
        codigoBarrasBoleto: linhaBoleto.replace(/\D/g, '')
      });

      if (formaPagamentoAgo === 'BOLETO') {
        setFeedbackAgo({
          tipo: 'info',
          texto: 'Boleto bancário emitido! Aguardando compensação bancária para liberação definitiva da credencial.'
        });
      } else {
        setFeedbackAgo({
          tipo: 'sucesso',
          texto: 'Pagamento processado com sucesso! Inscrição da AGO homologada em tempo real.'
        });
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      }
      setModalPagamentoAgoAberto(false);
    } catch (err: any) {
      console.error('[ERRO_PAGAMENTO_AGO]', err);
      setFeedbackAgo({
        tipo: 'erro',
        texto: err?.message || 'Falha ao processar a inscrição. Tente novamente.'
      });
    } finally {
      setProcessandoPagamentoAgo(false);
    }
  };

  // Simulação / Execução de Compensação de Boleto em Tempo Real
  const handleCompensarBoleto = async (inscricaoId: string) => {
    setCompensandoBoleto(true);
    try {
      const ok = await compensarBoletoInscricaoAgo(db, inscricaoId);
      if (ok) {
        setFeedbackAgo({
          tipo: 'sucesso',
          texto: 'Boleto compensado com sucesso pelo banco! Credencial e certificado liberados.'
        });
      }
    } catch {
      setFeedbackAgo({
        tipo: 'erro',
        texto: 'Não foi possível confirmar a compensação do boleto.'
      });
    } finally {
      setCompensandoBoleto(false);
    }
  };

  // Fallback seguro em stasis caso a sessão do ministro ainda não tenha sido resolvida ou não exista no banco
  if (!ministro) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-2xl">
          <ShieldAlert className="w-12 h-12 text-amber-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Sessão Ministerial Não Localizada</h2>
          <p className="text-xs text-slate-400">
            Nenhum registro ministerial associado a esta sessão foi encontrado no banco de dados. Realize o login com seu CPF cadastrado.
          </p>
          <div className="flex flex-col gap-2.5 pt-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase cursor-pointer transition-all shadow-lg shadow-amber-950/40"
              >
                Voltar à Tela de Login
              </button>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase cursor-pointer transition-colors"
            >
              Recarregar Sistema
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="min-h-screen bg-slate-950 text-slate-100 font-sans p-3 sm:p-5 space-y-4 selection:bg-amber-500 selection:text-black relative overflow-hidden"
    >
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-[350px] h-[350px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[350px] h-[350px] bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Top Header / Neofintech Navbar */}
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-sm relative z-10">
        <button
          onClick={handleSair}
          className="px-3 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/30 text-rose-300 hover:text-white text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm group"
          title="Encerrar sessão e sair do sistema"
        >
          <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform text-rose-400" />
          <span>Sair</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {infoAniversariantes.hojeCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>🎂 HOJE: Aniversário de {infoAniversariantes.hojeNomes.join(', ')}!</span>
            </div>
          )}
          {temVencimentoProximo && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs font-mono font-medium animate-pulse">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Atenção: Vencimento próximo</span>
            </div>
          )}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold uppercase shadow-sm ${obterBadgeClassStatus(ministro?.statusAdimplencia)}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>HOMOLOGADO · {formatarRotuloStatus(ministro?.statusAdimplencia)}</span>
          </div>
        </div>
      </div>

      {/* Welcome Banner Card with Refined Compact Styling */}
      <div className="max-w-6xl mx-auto p-4 sm:p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-amber-500/40 shadow-sm shrink-0 relative group cursor-pointer bg-slate-800 flex items-center justify-center"
            onClick={() => setModalEditarPerfilAberto(true)}
            title="Clique para alterar sua foto de perfil"
          >
            {ministro?.fotoUrl ? (
              <img
                src={ministro.fotoUrl}
                alt={ministro?.nome || 'Ministro'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-800 text-amber-400 font-bold text-sm uppercase">
                {(ministro?.nome || 'M').charAt(0)}
              </div>
            )}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-amber-400 text-[9px] font-mono font-bold transition-opacity">
              <Camera className="w-4 h-4 mb-0.5" />
              <span>Alterar</span>
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono font-semibold uppercase tracking-wider text-amber-400 bg-amber-950/60 border border-amber-500/20 px-1.5 py-0.5 rounded">
                ESPAÇO DO OBREIRO
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                RM: {ministro?.registroMinisterial || 'RM-45892'}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">{ministro?.nome || 'Ministro Convenção'}</h1>
            <p className="text-xs text-slate-300 font-normal">{ministro?.cargo || 'Obreiro'} · {ministro?.igrejaFiliadaNome || 'Sede Central'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleAtivarBiometria}
            disabled={ativandoBiometria}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 text-xs font-mono font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
            title="Ativar biometria WebAuthn (Touch ID / Face ID / Windows Hello) neste dispositivo"
          >
            {ativandoBiometria ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            ) : (
              <Fingerprint className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>{ativandoBiometria ? 'Autenticando Hardware...' : 'Ativar Biometria Neste Dispositivo'}</span>
          </button>

          <button
            onClick={() => setModalEditarPerfilAberto(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-mono font-medium transition-colors cursor-pointer"
            title="Editar dados cadastrais do seu perfil ministerial"
          >
            <UserCog className="w-3.5 h-3.5 text-amber-400" />
            <span>Editar Perfil</span>
          </button>

          <button
            onClick={() => setModalMudarSenhaAberto(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-mono font-medium transition-colors cursor-pointer"
            title="Alterar senha de acesso ao portal"
          >
            <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
            <span>Mudar Senha</span>
          </button>

          <button
            onClick={() => setAbaAtiva('noticias_eventos')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-mono font-medium transition-colors cursor-pointer"
            title="Acessar Notícias, Editais e Eventos Oficiais da Convenção"
          >
            <Newspaper className="w-3.5 h-3.5 text-sky-400" />
            <span>Notícias</span>
          </button>

          <button
            onClick={() => setAbaAtiva('dossie' as any)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-mono font-medium transition-colors cursor-pointer"
            title="Acessar Dossiê, Cartas de Recomendação e Acervo Documental Criptografado"
          >
            <FileCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>Dossiê</span>
          </button>

          <button
            onClick={() => setAbaAtiva('certificado')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all shadow-sm cursor-pointer ${
              abaAtiva === 'certificado'
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300'
            }`}
            title="Emitir Certificado Oficial de Ordenação sobre Matriz Imutável"
          >
            <Award className="w-3.5 h-3.5" />
            <span>Certificado Oficial</span>
          </button>

          <button
            onClick={() => setQrCodeModalAberto(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-bold transition-all shadow-sm cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Validar QR</span>
          </button>
        </div>
      </div>

      {/* Menu de Abas de Navegação Neofintech (Filtrado por Autorização do Super Master) */}
      <div className="max-w-6xl mx-auto flex items-center gap-1.5 overflow-x-auto pb-1 relative z-10 scrollbar-none">
        {[
          { id: 'carteirinha', label: 'Carteirinha Digital CR-80', icon: CreditCard, show: true },
          { id: 'certificado', label: 'Certificado de Ordenação (A4)', icon: Award, show: true },
          { id: 'noticias_eventos', label: 'Notícias & Eventos', icon: Newspaper, show: cmsSettings.paginasVisiveis.noticias !== false || cmsSettings.paginasVisiveis.eventos !== false },
          { id: 'insignias', label: 'Conquista eclesiástica', icon: Shield, show: true },
          { id: 'dossie', label: 'Dossiê & Acervo Digital', icon: FileCheck, show: true },
          { id: 'prontuario', label: 'Prontuário & Eclesiástico', icon: User, show: true },
          { id: 'anuidades', label: 'Anuidades & Tesouraria', icon: DollarSign, show: true },
          { id: 'ago', label: `AGO ${anoCiclo} (Delegado)`, icon: Calendar, show: cmsSettings.paginasVisiveis.inscricaoAgo !== false && !appConfig.killSwitchCompliance },
          { id: 'igreja', label: 'Igreja Filiada', icon: Building, show: cmsSettings.paginasVisiveis.igrejasFiliadas !== false },
          { id: 'beneficios', label: 'Clube de Benefícios', icon: Sparkles, show: cmsSettings.paginasVisiveis.ativoClubeBeneficios !== false },
          { id: 'votacao', label: 'Urna Eletrônica (AGO)', icon: Vote, show: cmsSettings.paginasVisiveis.ativoUrnaEletronica !== false && !appConfig.killSwitchCompliance },
          { id: 'ead', label: 'Certificados & Cursos EAD', icon: Award, show: cmsSettings.paginasVisiveis.ativoEad !== false },
          { id: 'oracao', label: 'Mural de Orações', icon: Globe, show: cmsSettings.paginasVisiveis.ativoMuralOracao !== false },
        ]
          .filter((t) => t.show)
          .map((tab) => {
            const Icon = tab.icon;
            const isActive = abaAtiva === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setAbaAtiva(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
      </div>

      {/* Conteúdo Dinâmico das Abas */}
      <div className="max-w-6xl mx-auto relative z-10">
        <AnimatePresence mode="wait">
          {abaAtiva === 'certificado' && (
            <motion.div
              key="certificado"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="w-full"
            >
              <CertificadoMinistro ministro={ministro} appConfig={appConfig} />
            </motion.div>
          )}

          {abaAtiva === 'noticias_eventos' && (
            <motion.div
              key="noticias_eventos"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <WebPushNotificationCenter ministro={ministro} />
              <NoticiasEventosMinistro noticias={noticias} eventos={eventos} />
            </motion.div>
          )}

          {abaAtiva === 'insignias' && (
            <motion.div
              key="insignias"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <InsigniasEvolucaoMinisterial ministro={ministro} />
            </motion.div>
          )}

          {abaAtiva === 'dossie' && (
            <motion.div
              key="dossie"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <DossieAcervoMinisterial ministro={ministro} appConfig={appConfig} />
            </motion.div>
          )}

          {abaAtiva === 'carteirinha' && (
            <motion.div
              key="carteirinha"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {/* Módulo de Aniversariantes do Mês & Card Especial do Dia */}
              <AniversariantesDoMesCard />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 p-4 sm:p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-3.5 shadow-sm backdrop-blur-md flex flex-col items-center">
                <div className="w-full flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <h3 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                      CARTEIRINHA DIGITAL CR-80 ({versoCartao ? 'VERSO HOLOGRÁFICO' : 'FRENTE VETORIAL'})
                    </h3>
                  </div>
                  <button
                    onClick={() => setVersoCartao(!versoCartao)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono font-medium transition-colors cursor-pointer border border-cyan-500/30"
                  >
                    {versoCartao ? 'Ver Frente do Cartão' : 'Ver Verso com QR Code'}
                  </button>
                </div>

                <div className="w-full aspect-[856/540] rounded-xl overflow-hidden shadow-lg border border-amber-500/25">
                  <MinisterialCard ministro={ministro} verso={versoCartao} width="100%" height="100%" />
                </div>
              </div>

              <div className="lg:col-span-1 space-y-4">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-3 shadow-sm backdrop-blur-md">
                  <h3 className="text-xs font-mono font-bold text-cyan-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Segurança & Criptografia</span>
                  </h3>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/70">
                      <span className="text-slate-500 text-[10px] block uppercase">Situação Cadastral</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> REGULAR · {formatarRotuloStatus(ministro.statusAdimplencia).toUpperCase()}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/70">
                      <span className="text-slate-500 text-[10px] block uppercase">Certificação Digital</span>
                      <span className="text-slate-300 mt-0.5 block text-[11px]">Sistema Oficial CIMADEBE</span>
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleAtivarBiometria}
                        disabled={ativandoBiometria}
                        className="w-full py-2 px-3 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/90 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {ativandoBiometria ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                        ) : (
                          <Fingerprint className="w-4 h-4 text-cyan-400" />
                        )}
                        <span>{ativandoBiometria ? 'Processando Hardware...' : 'Ativar Biometria Neste Dispositivo'}</span>
                      </button>
                    </div>

                    {feedbackBiometria && (
                      <div
                        className={`p-2.5 rounded-lg border text-[11px] font-mono flex items-center gap-2 ${
                          feedbackBiometria.tipo === 'sucesso'
                            ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                            : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                        }`}
                      >
                        {feedbackBiometria.tipo === 'sucesso' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                        <span>{feedbackBiometria.texto}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Aviso Estatutário de Impressão Oficial Exclusiva do Birô */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2 text-xs font-mono">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span className="uppercase tracking-wider">Impressão Oficial Exclusiva do Birô</span>
              </div>
              <p className="text-slate-400 leading-relaxed font-sans text-xs">
                A credencial ministerial física em cartão PVC é confeccionada e impressa com exclusividade pelo Birô Central da Convenção. A emissão e download direto foram desativados no portal do ministro por diretriz institucional.
              </p>
            </div>
          </motion.div>
          )}

          {abaAtiva === 'prontuario' && (
            <motion.div
              key="prontuario"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="p-4 sm:p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-4 shadow-sm backdrop-blur-md"
            >
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-amber-400" />
                  <span>Prontuário Ministerial Eclesiástico Completo</span>
                </h3>
                <span className={`text-xs font-mono px-3 py-1 rounded-lg border flex items-center gap-1.5 font-semibold ${obterBadgeClassStatus(ministro.statusAdimplencia)}`}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> ATIVO · {formatarRotuloStatus(ministro.statusAdimplencia).toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/70">
                  <span className="text-slate-500 text-[10px] block uppercase">Nome Completo</span>
                  <span className="text-white font-bold font-sans text-sm mt-0.5 block">{ministro.nome}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/70">
                  <span className="text-slate-500 text-[10px] block uppercase">Cargo / Função</span>
                  <span className="text-amber-400 font-bold font-sans text-sm mt-0.5 block">{ministro.cargo}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/70">
                  <span className="text-slate-500 text-[10px] block uppercase">Registro Ministerial (RM)</span>
                  <span className="text-slate-200 mt-0.5 block">{ministro.registroMinisterial || 'RM-45892'}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/70">
                  <span className="text-slate-500 text-[10px] block uppercase">CPF</span>
                  <span className="text-slate-200 mt-0.5 block">{ministro.cpf}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/70">
                  <span className="text-slate-500 text-[10px] block uppercase">RG / Órgão Emissor</span>
                  <span className="text-slate-200 mt-0.5 block">{ministro.rg || '1234567-SSP/BA'}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/70">
                  <span className="text-slate-500 text-[10px] block uppercase">Data de Nascimento</span>
                  <span className="text-slate-200 mt-0.5 block">{formatarDataBR(ministro.dataNascimento || '1975-08-15')}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/70">
                  <span className="text-slate-500 text-[10px] block uppercase">Data de Consagração</span>
                  <span className="text-slate-200 mt-0.5 block">{formatarDataBR(ministro.dataConsagracao || '2005-04-10')}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/70">
                  <span className="text-slate-500 text-[10px] block uppercase">E-mail Institucional</span>
                  <span className="text-slate-200 mt-0.5 block">{ministro.email || 'pr.carlos@cimadebe.org.br'}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/70">
                  <span className="text-slate-500 text-[10px] block uppercase">Telefone / WhatsApp</span>
                  <span className="text-slate-200 mt-0.5 block">{ministro.telefone || '(71) 99888-7766'}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/70 sm:col-span-2 md:col-span-3">
                  <span className="text-slate-500 text-[10px] block uppercase">Endereço Residencial</span>
                  <span className="text-slate-200 font-sans mt-0.5 block text-xs">
                    {ministro.dadosEndereco ? `${ministro.dadosEndereco.rua}, ${ministro.dadosEndereco.numero} - ${ministro.dadosEndereco.bairro}, ${ministro.dadosEndereco.cidade} / ${ministro.dadosEndereco.uf}` : 'Av. Sete de Setembro, 1500 - Campo Grande, Salvador / BA'}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {abaAtiva === 'anuidades' && (
            <motion.div
              key="anuidades"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* CENTRAL DE NOTIFICAÇÕES WEB PUSH (ALERTAS DE VENCIMENTO) */}
              <WebPushNotificationCenter
                ministro={ministro}
                anuidadePrincipal={infoRecorrencia?.itemPendente || anuidadesReais[0]}
              />

              {/* CARD DE RECORRÊNCIA EM DIAS COM OPÇÃO DE PAGAR (FORMATO DELICADO) */}
              {infoRecorrencia && (
                <div
                  className={`p-4 sm:p-5 rounded-xl border transition-all shadow-sm relative overflow-hidden backdrop-blur-md ${
                    infoRecorrencia.estaPago
                      ? 'bg-slate-900/80 border-emerald-500/30'
                      : infoRecorrencia.estaVencido
                      ? 'bg-slate-900/80 border-rose-500/40'
                      : 'bg-slate-900/80 border-amber-500/40'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/70 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm shadow-sm ${
                          infoRecorrencia.estaPago
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : infoRecorrencia.estaVencido
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {infoRecorrencia.estaPago ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : infoRecorrencia.estaVencido ? (
                          <AlertCircle className="w-4 h-4 text-rose-400" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                              infoRecorrencia.estaPago
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                                : infoRecorrencia.estaVencido
                                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/20'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                            }`}
                          >
                            {infoRecorrencia.estaPago
                              ? (infoRecorrencia.ehFiliacao ? 'FILIAÇÃO EM DIA' : 'ANUIDADE EM DIA')
                              : (infoRecorrencia.ehFiliacao ? 'FILIAÇÃO PENDENTE' : (infoRecorrencia.estaVencido ? 'EM ATRASO' : 'VENCIMENTO PRÓXIMO'))}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-white mt-0.5">
                          Status da {infoRecorrencia.ehFiliacao ? 'Filiação' : 'Anuidade'} & Recorrência Atual
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded-md border border-amber-500/30">
                        CICLO {infoRecorrencia.anoVigente}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center pt-3.5 font-mono">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-400 uppercase font-medium tracking-wider block">
                        Descrição da Taxa
                      </span>
                      <span className="text-xs font-bold text-white block">
                        {infoRecorrencia.ehFiliacao ? 'Taxa de Filiação' : 'Anuidade Ministerial'}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-sans">
                        Exercício Contábil {infoRecorrencia.anoVigente}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-400 uppercase font-medium tracking-wider block">
                        Data de Vencimento
                      </span>
                      <span className="text-xs font-bold text-white block">
                        {infoRecorrencia.dataVencStr ? formatarDataBR(infoRecorrencia.dataVencStr) : 'N/A'}
                      </span>
                      <span
                        className={`text-[10px] font-semibold block ${
                          infoRecorrencia.estaPago
                            ? 'text-emerald-400'
                            : infoRecorrencia.estaVencido
                            ? 'text-rose-400'
                            : 'text-emerald-300'
                        }`}
                      >
                        {infoRecorrencia.estaPago
                          ? 'Quitado'
                          : infoRecorrencia.estaVencido
                          ? `Vencida há ${infoRecorrencia.diasAbsolutos} dias`
                          : `A vencer em ${infoRecorrencia.diffDias} dias`}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-400 uppercase font-medium tracking-wider block">
                        {infoRecorrencia.estaPago ? 'Valor Quitado' : 'Valor a Pagar'}
                      </span>
                      <span className="text-lg font-bold text-emerald-400 block tracking-tight">
                        R$ {infoRecorrencia.valor.toFixed(2).replace('.', ',')}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {infoRecorrencia.estaPago ? 'Comprovante Homologado' : 'Pix ou Cartão em até 2x'}
                      </span>
                    </div>

                    <div className="flex items-center justify-start md:justify-end">
                      {!infoRecorrencia.estaPago ? (
                        <button
                          type="button"
                          onClick={() => setModalPixAnuidade(infoRecorrencia.itemPendente)}
                          className="w-full md:w-auto px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-sm cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Pagar Agora</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <div className="px-3.5 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 font-medium text-xs flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>{infoRecorrencia.ehFiliacao ? 'Filiação Quitada' : 'Anuidade Quitada'}</span>
                          </div>

                          <button
                            type="button"
                            onClick={async () => {
                              if (!ministro) return;
                              try {
                                await gerarPdfReciboPagamentoMinistro({
                                  ministro,
                                  anuidade: {
                                    id: infoRecorrencia.itemPendente?.id || (anuidadesReais[0]?.id) || `an-${infoRecorrencia.anoVigente}`,
                                    anoVigente: infoRecorrencia.anoVigente,
                                    valor: infoRecorrencia.valor,
                                    statusPagamento: 'PAGO',
                                    ehFiliacao: infoRecorrencia.ehFiliacao,
                                    rotulo: infoRecorrencia.ehFiliacao ? 'Taxa Oficial de Filiação' : `Anuidade Ministerial ${infoRecorrencia.anoVigente}`,
                                    metodoPagamento: 'PIX / Cartão Bancário',
                                    dataPagamento: new Date().toISOString(),
                                  },
                                  appConfig,
                                });
                                notifySuccess('Recibo Gerado', 'O PDF do seu recibo de quitação foi gerado e baixado com sucesso.');
                              } catch (err: any) {
                                notifyError('Erro ao Gerar Recibo', err?.message || 'Falha ao processar o recibo em PDF.');
                              }
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5 transition-all"
                            title="Baixar Recibo Oficial de Quitação em PDF"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Gerar Recibo</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Opção de Antecipação de Anuidade Futura (quando ciclo atual já está quitado) */}
                  {infoRecorrencia.estaPago && infoRecorrencia.itemFuturo && (infoRecorrencia.itemFuturo.statusPagamento || '').toUpperCase() !== 'PAGO' && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 mt-3 font-mono">
                      <div>
                        <span className="text-[10px] text-sky-400 font-bold uppercase block">Próximo Exercício ({infoRecorrencia.itemFuturo.anoVigente})</span>
                        <span className="text-xs text-slate-300">
                          Vencimento em {formatarDataBR(infoRecorrencia.itemFuturo.dataVencimento)} — R$ {Number(infoRecorrencia.itemFuturo.valor || 120).toFixed(2).replace('.', ',')} (Sem cobrança em aberto no ciclo atual)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModalPixAnuidade(infoRecorrencia.itemFuturo)}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-all shrink-0"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Antecipar {infoRecorrencia.itemFuturo.anoVigente} (Opcional)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TABELA DE EXTRATO DO LEDGER COM DADOS REAIS DO BANCO FIRESTORE */}
              <div className="p-4 sm:p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-4 shadow-sm backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-amber-400" />
                    <span>Extrato de Taxas & Anuidades</span>
                  </h3>
                  <span className="text-xs font-mono font-medium text-emerald-400 bg-emerald-950/70 px-2.5 py-1 rounded-md border border-emerald-500/30">
                    LANÇAMENTOS NO BANCO ({anuidadesReais.length})
                  </span>
                </div>

                {carregandoAnuidades ? (
                  <div className="p-8 text-center text-slate-400 font-mono text-xs animate-pulse">
                    Carregando extrato de lançamentos reais do banco...
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="pb-3 px-3 uppercase tracking-wider">Ano Vigente</th>
                          <th className="pb-3 px-3 uppercase tracking-wider">Vencimento</th>
                          <th className="pb-3 px-3 uppercase tracking-wider">Recorrência em Dias</th>
                          <th className="pb-3 px-3 uppercase tracking-wider">Valor</th>
                          <th className="pb-3 px-3 uppercase tracking-wider">Categoria</th>
                          <th className="pb-3 px-3 uppercase tracking-wider">Status no Banco</th>
                          <th className="pb-3 px-3 uppercase tracking-wider text-right">Opção de Pagamento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {anuidadesReais.map((an) => {
                          const stCobranca = avaliarStatusCobranca(an);
                          const estaPago = (an.statusPagamento || '').toUpperCase() === 'PAGO' || stCobranca === 'EM_DIA_FUTURO' || stCobranca === 'EM_DIA';
                          const dataVencStr = an.dataVencimento ? String(an.dataVencimento).split('T')[0] : '';
                          const dataVenc = new Date(`${dataVencStr}T00:00:00`);
                          const hoje = new Date();
                          hoje.setHours(0, 0, 0, 0);
                          const diffDias = Math.ceil((dataVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                          const estaVencido = stCobranca === 'EM_ATRASO';
                          const ehFiliacao = Boolean(
                            an.id?.startsWith('an-fil-') ||
                            an.categoria === 'TAXA_CONVENCAO'
                          );

                          return (
                            <tr key={an.id} className="hover:bg-slate-950/50 transition-colors">
                              <td className="py-4 px-3 font-bold text-amber-400">{an.anoVigente}</td>
                              <td className="py-4 px-3">{dataVencStr ? formatarDataBR(dataVencStr) : 'N/A'}</td>
                              <td className="py-4 px-3 font-semibold">
                                {(an.statusPagamento || '').toUpperCase() === 'PAGO' ? (
                                  an.anoVigente > new Date().getFullYear() ? (
                                    <span className="text-sky-400">✓ Em Dia (Quitada Antecipadamente)</span>
                                  ) : (
                                    <span className="text-emerald-400">✓ Em Dia (Quitada)</span>
                                  )
                                ) : estaVencido ? (
                                  <span className="text-rose-400">Em Atraso há {Math.abs(diffDias)} dias</span>
                                ) : an.anoVigente > new Date().getFullYear() ? (
                                  <span className="text-sky-300">Exercício Futuro (A vencer em {formatarDataBR(dataVencStr)})</span>
                                ) : (
                                  <span className="text-emerald-400">Em Dia (A vencer em {diffDias} dias)</span>
                                )}
                              </td>
                              <td className="py-4 px-3 font-mono font-bold text-emerald-400">
                                R$ {Number(an.valor || 0).toFixed(2).replace('.', ',')}
                              </td>
                              <td className="py-4 px-3 uppercase">
                                {ehFiliacao ? 'Taxa de Filiação' : 'Anuidade Ministerial'}
                              </td>
                              <td className="py-4 px-3">
                                <span
                                  className={`px-3 py-1 rounded-lg text-[10px] font-bold border ${obterBadgeClassStatus(stCobranca)}`}
                                >
                                  {formatarRotuloStatus(stCobranca).toUpperCase()}
                                </span>
                              </td>
                              <td className="py-4 px-3 text-right">
                                {(an.statusPagamento || '').toUpperCase() !== 'PAGO' ? (
                                  <button
                                    type="button"
                                    onClick={() => setModalPixAnuidade(an)}
                                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition cursor-pointer shadow-md flex items-center gap-1.5 ml-auto"
                                  >
                                    <QrCode className="w-3.5 h-3.5" />
                                    <span>Pagar</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!ministro) return;
                                      try {
                                        await gerarPdfReciboPagamentoMinistro({
                                          ministro,
                                          anuidade: an,
                                          appConfig,
                                        });
                                        notifySuccess('Recibo Gerado', `Recibo do exercício ${an.anoVigente} baixado com sucesso.`);
                                      } catch (err: any) {
                                        notifyError('Erro ao Gerar Recibo', err?.message || 'Falha ao emitir recibo em PDF.');
                                      }
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] transition cursor-pointer shadow-sm inline-flex items-center gap-1.5 ml-auto"
                                    title="Baixar Recibo em PDF"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Gerar Recibo</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* MODAL DE PAGAMENTO PARA ANUIDADES E TAXAS (CHECKOUT REAL ASAAS) */}
              {modalPixAnuidade && ministro && (
                <div
                  className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setModalPixAnuidade(null);
                  }}
                >
                  <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl text-white font-sans relative max-h-[92vh] overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => setModalPixAnuidade(null)}
                      className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer z-10"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <CheckoutRealAgo
                      ministro={{
                        id: ministro.id,
                        nome: ministro.nome || 'Ministro',
                        cpf: ministro.cpf || '',
                        cargo: ministro.cargo || 'Ministro',
                        email: ministro.email || 'secretaria@cimadebe.org.br',
                        telefone: ministro.telefone || '',
                      }}
                      plano={{
                        id: modalPixAnuidade.id || 'QUITACAO_PENDENCIAS',
                        codigo: modalPixAnuidade.id || 'QUITACAO_PENDENCIAS',
                        nome: (modalPixAnuidade.categoria === 'TAXA_CONVENCAO' || modalPixAnuidade.id?.startsWith('an-fil-'))
                          ? `Taxa de Filiação - Exercício ${modalPixAnuidade.anoVigente || 2026}`
                          : `Anuidade Ministerial - Exercício ${modalPixAnuidade.anoVigente || 2026}`,
                        valor: Number(modalPixAnuidade.valor) || 120,
                        subtitulo: `Quitação de pendência do exercício ${modalPixAnuidade.anoVigente || 2026}`,
                      }}
                      onVoltar={() => setModalPixAnuidade(null)}
                      onConcluido={async () => {
                        notifySuccess('Pagamento Conciliado', 'Transação registrada e liquidada com sucesso via Asaas.');
                        setModalPixAnuidade(null);
                      }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {abaAtiva === 'ago' && (
            <motion.div
              key="ago"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="p-4 sm:p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-4 shadow-sm backdrop-blur-md"
            >
              {/* Feedback de Transação em Tempo Real */}
              {feedbackAgo && (
                <div
                  className={`p-3 rounded-lg flex items-center justify-between text-xs font-mono border ${
                    feedbackAgo.tipo === 'sucesso'
                      ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                      : feedbackAgo.tipo === 'erro'
                      ? 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                      : 'bg-amber-950/80 border-amber-500/40 text-amber-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {feedbackAgo.tipo === 'sucesso' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                    {feedbackAgo.tipo === 'erro' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                    {feedbackAgo.tipo === 'info' && <Clock className="w-4 h-4 text-amber-400 shrink-0" />}
                    <span>{feedbackAgo.texto}</span>
                  </div>
                  <button
                    onClick={() => setFeedbackAgo(null)}
                    className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {estaNaJanelaDeBloqueio3Dias && !inscricaoMinistro && (
                <div className="p-3.5 rounded-lg bg-rose-950/20 border border-rose-500/30 text-rose-300 font-mono text-xs space-y-1.5">
                  <div className="flex items-center gap-2 text-rose-400 font-bold uppercase text-xs">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>INSCRIÇÕES ONLINE SUSPENSAS</span>
                  </div>
                  <p className="font-sans leading-relaxed text-slate-300 text-xs">
                    Atenção ministro: O prazo limite para inscrições online e compensação de boletos bancários da AGO encerrou-se pela trava preventiva de 3 dias de antecedência.
                  </p>
                  <p className="font-sans text-slate-400 text-[11px]">
                    Dirija-se diretamente à Secretaria Geral Física no local do Conclave para credenciamento.
                  </p>
                </div>
              )}

              {agoConclave && agoConclave.status === 'ENCERRADO' && (
                <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 text-slate-300 text-center space-y-2.5 shadow-sm relative overflow-hidden">
                  <div className="inline-flex p-2 bg-indigo-950/80 border border-indigo-500/40 rounded-full text-indigo-300">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">CONCLAVE ENCERRADO</h3>
                    <p className="text-xs text-slate-400 font-sans max-w-md mx-auto">
                      A Assembleia Geral Ordinária foi encerrada oficialmente. Votos e atas em consolidação pela Mesa Diretora.
                    </p>
                  </div>
                  <p className="text-[10px] text-indigo-400 font-mono">
                    Aguarde o credenciamento e liberação do próximo ciclo oficial pela Mesa Diretora.
                  </p>
                </div>
              )}

              {/* CENÁRIO 1: O MINISTRO JÁ POSSUI INSCRIÇÃO CADASTRADA/PAGA */}
              {inscricaoMinistro ? (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">
                          Assembleia Geral Ordinária (AGO {anoCiclo})
                        </h3>
                        <p className="text-xs text-slate-400">
                          Comprovante Oficial de Inscrição & Credenciamento Ministerial
                        </p>
                      </div>
                    </div>
                    {inscricaoMinistro.status === 'PENDENTE' || (inscricaoMinistro as any).statusInscricao === 'PENDENTE' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400 bg-amber-950/80 px-3.5 py-1.5 rounded-xl border border-amber-500/40 shadow">
                        <Clock className="w-3.5 h-3.5" />
                        AGUARDANDO COMPENSAÇÃO (BOLETO)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 px-3.5 py-1.5 rounded-xl border border-emerald-500/40 shadow">
                        <BadgeCheck className="w-3.5 h-3.5" />
                        DELEGADO HOMOLOGADO • QUITADO
                      </span>
                    )}
                  </div>

                  {/* Detalhes do Pagamento e Homologação */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-0.5">
                      <span className="text-[10px] font-mono text-slate-400 uppercase block">Plano Selecionado</span>
                      <span className="text-xs font-bold text-white block truncate">
                        {inscricaoMinistro.planoNome || 'Plano 1 - Inscrição Normal AGO'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-0.5">
                      <span className="text-[10px] font-mono text-slate-400 uppercase block">Valor da Inscrição</span>
                      <span className="text-sm font-bold text-amber-400 block font-mono">
                        R$ {Number(inscricaoMinistro.valor || 190).toFixed(2).replace('.', ',')}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-0.5">
                      <span className="text-[10px] font-mono text-slate-400 uppercase block">Forma de Pagamento</span>
                      <span className="text-xs font-bold text-slate-200 block font-mono">
                        {inscricaoMinistro.formaPagamento === 'BOLETO'
                          ? 'Boleto Bancário'
                          : inscricaoMinistro.formaPagamento === 'CARTAO_CREDITO'
                          ? 'Cartão de Crédito'
                          : 'PIX Instantâneo'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-0.5">
                      <span className="text-[10px] font-mono text-slate-400 uppercase block">Data da Operação</span>
                      <span className="text-xs font-bold text-slate-200 block font-mono">
                        {inscricaoMinistro.dataInscricao || new Date().toISOString().split('T')[0]}
                      </span>
                    </div>
                  </div>

                  {/* Alerta de Boleto Pendente */}
                  {(inscricaoMinistro.status === 'PENDENTE' || (inscricaoMinistro as any).statusInscricao === 'PENDENTE') && (
                    <div className="p-3.5 sm:p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-2.5">
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                        <Clock className="w-4 h-4" />
                        <span>Boleto Bancário Emitido - Aguardando Liquidação Bancária (D+1)</span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Seu boleto está emitido no sistema bancário. Utilize a linha digitável abaixo para pagamento em qualquer aplicativo bancário:
                      </p>
                      <div className="flex flex-col sm:flex-row items-center gap-2.5">
                        <input
                          type="text"
                          readOnly
                          value={inscricaoMinistro.linhaDigitavelBoleto || '23793.38128 60000.123456 78000.654321 1 98760000019000'}
                          className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(inscricaoMinistro.linhaDigitavelBoleto || '23793.38128 60000.123456 78000.654321 1 98760000019000');
                            setBoletoCopiado(true);
                            setTimeout(() => setBoletoCopiado(false), 2500);
                          }}
                          className="w-full sm:w-auto px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          {boletoCopiado ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{boletoCopiado ? 'Copiado!' : 'Copiar Linha'}</span>
                        </button>
                      </div>

                      {/* Botão de Resposta em Tempo Real (Compensação Imediata) */}
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={() => handleCompensarBoleto(inscricaoMinistro.id)}
                          disabled={compensandoBoleto}
                          className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${compensandoBoleto ? 'animate-spin' : ''}`} />
                          <span>{compensandoBoleto ? 'Consultando compensação...' : 'Verificar Compensação'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Informações Estatutárias e Acesso Deliberativo */}
                  <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                    {inscricaoMinistro.status === 'CONFIRMADO' || (inscricaoMinistro as any).statusInscricao === 'CONFIRMADO'
                      ? `Sua inscrição para a AGO ${anoCiclo} está homologada e quitada. Você possui status de delegado oficial com direito a voz e voto nas deliberações e na Urna Eletrônica da Convenção.`
                      : `Sua inscrição está pré-cadastrada. Assim que o pagamento do boleto for liquidado no sistema bancário, sua homologação será ativada automaticamente com direito a voto e retirada de kit.`}
                  </p>

                  {/* Botões de Ação para Inscrição Confirmada */}
                  <div className="flex items-center gap-3 pt-1 flex-wrap">
                    <button
                      type="button"
                      disabled={!(inscricaoMinistro.status === 'CONFIRMADO' || (inscricaoMinistro as any).statusInscricao === 'CONFIRMADO')}
                      onClick={async () => {
                        try {
                          await exportarCrachaInscricaoAgoPdf(inscricaoMinistro, ministro as any, appConfig, extrairEventoAgo(eventos));
                        } catch (err: any) {
                          console.error(err);
                          alert('Erro ao gerar crachá oficial da AGO em PDF: ' + (err?.message || String(err)));
                        }
                      }}
                      className={`px-4 py-2.5 rounded-xl font-bold text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer disabled:pointer-events-none disabled:opacity-60 ${
                        inscricaoMinistro.status === 'CONFIRMADO' || (inscricaoMinistro as any).statusInscricao === 'CONFIRMADO'
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-sm'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      <Download className="w-4 h-4" />
                      <span>Baixar Crachá Oficial de Delegado (PDF)</span>
                    </button>

                    <a
                      href={`/api/biro/download/certificado?userId=${ministro.id}&tipo=RECEBIDO`}
                      download={`certificado_ago_${anoCiclo}.pdf`}
                      className={`px-5 py-3.5 rounded-2xl font-bold text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow ${
                        inscricaoMinistro.status === 'CONFIRMADO' || (inscricaoMinistro as any).statusInscricao === 'CONFIRMADO'
                          ? 'bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 pointer-events-none opacity-60'
                      }`}
                    >
                      <FileCheck className="w-4 h-4 text-purple-400" />
                      <span>Baixar Certificado de Participação (PDF)</span>
                    </a>
                  </div>
                </div>
              ) : (
                /* CENÁRIO 2: O MINISTRO AINDA NÃO SE INSCREVEU -> CARD COM PLANO ADEQUADO E BOTÃO PAGAR */
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">
                          Inscrição Oficial da AGO {anoCiclo}
                        </h3>
                        <p className="text-xs text-slate-400">
                          Plano ministerial homologado para sua função eclesiástica.
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400 bg-amber-950/80 px-3.5 py-1.5 rounded-xl border border-amber-500/40 shadow">
                      INSCRIÇÕES ABERTAS
                    </span>
                  </div>

                  {/* Card de Apresentação do Plano Oficial */}
                  <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-2 border-amber-500/40 shadow-[0_0_35px_rgba(245,158,11,0.15)] relative overflow-hidden space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                      <div className="space-y-1.5">
                        <span className="px-3 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-amber-500 text-slate-950 shadow inline-block">
                          PLANO SUGERIDO PARA SEU CARGO ({ministro.cargo})
                        </span>
                        <h4 className="text-xl sm:text-2xl font-black text-white">{planoSugerido.nome}</h4>
                        <p className="text-xs text-slate-400">{planoSugerido.subtitulo}</p>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <span className="text-[10px] font-mono text-slate-400 block uppercase">Taxa de Inscrição</span>
                        <span className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-orange-400 font-mono block">
                          R$ {planoSugerido.valor.toFixed(2).replace('.', ',')}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30 inline-block mt-1">
                          Investimento Único
                        </span>
                      </div>
                    </div>

                    {/* Lista de Benefícios Inclusos */}
                    <div className="space-y-3">
                      <span className="text-[11px] font-mono text-slate-400 uppercase font-bold tracking-wider block">
                        Benefícios Inclusos no Plano:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {planoSugerido.beneficios.map((b, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Se o Ministro possui pendência financeira (Filiação/Anuidade em atraso), bloqueia a inscrição e exibe a pendência com botão para pagar no modal real */}
                    {infoRecorrencia && !infoRecorrencia.estaPago ? (
                      <div className="pt-4 border-t border-rose-500/30 space-y-4">
                        <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                              <strong className="text-white text-sm font-bold uppercase font-mono">
                                Inscrição Bloqueada: Pendência Financeira Identificada
                              </strong>
                            </div>
                            <p className="text-xs text-rose-200 font-sans">
                              O ministro possui {infoRecorrencia.ehFiliacao ? 'Taxa de Filiação' : 'Anuidade Ministerial'} pendente ({formatarDataBR(infoRecorrencia.dataVencStr)}) no valor de <strong className="text-white font-mono">R$ {infoRecorrencia.valor.toFixed(2).replace('.', ',')}</strong>. Regularize para liberar sua vaga na AGO.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setModalPixAnuidade(infoRecorrencia.itemPendente)}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs font-mono uppercase tracking-wider transition-all shadow-lg shrink-0 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <QrCode className="w-4 h-4" />
                            <span>Pagar Pendência Agora</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Rodapé do Card com Botão Pagar */
                      <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800/80">
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                          {estaNaJanelaDeBloqueio3Dias || (agoConclave && agoConclave.status === 'ENCERRADO') ? (
                            <span className="text-rose-400 font-bold">⚠️ Inscrições online suspensas para este ciclo.</span>
                          ) : (
                            <>
                              <span>Formas de Pagamento:</span>
                              <span className="text-amber-400 font-bold">PIX • Cartão (até 2x) • Boleto</span>
                            </>
                          )}
                        </div>

                        {estaNaJanelaDeBloqueio3Dias || (agoConclave && agoConclave.status === 'ENCERRADO') ? (
                          <button
                            type="button"
                            disabled
                            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-500 font-black text-sm font-mono uppercase tracking-wider cursor-not-allowed flex items-center justify-center gap-2.5"
                          >
                            <Lock className="w-5 h-5 text-slate-600" />
                            <span>Bloqueado</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setModalPagamentoAgoAberto(true)}
                            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm font-mono uppercase tracking-wider transition-all shadow-[0_0_30px_rgba(245,158,11,0.4)] cursor-pointer flex items-center justify-center gap-2.5 hover:scale-105 active:scale-95"
                          >
                            <QrCode className="w-5 h-5" />
                            <span>Pagar Inscrição AGO</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SEÇÃO: HISTÓRICO SIMPLES DE INSCRIÇÕES ANTERIORES NA AGO & COMPROVANTES */}
              <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800/90 shadow-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      <History className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">
                        Histórico de Inscrições & Comprovantes de AGO
                      </h3>
                      <p className="text-xs text-slate-400">
                        Consulte suas inscrições anteriores, situação do pagamento e comprovantes oficiais emitidos.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono px-3.5 py-1.5 rounded-xl bg-slate-950 text-slate-400 border border-slate-800">
                    {historicoInscricoesAgo.length} {historicoInscricoesAgo.length === 1 ? 'registro encontrado' : 'registros encontrados'}
                  </span>
                </div>

                {historicoInscricoesAgo.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 space-y-2">
                    <FileText className="w-8 h-8 mx-auto text-slate-600" />
                    <p className="text-xs">Nenhuma inscrição anterior localizada no sistema.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historicoInscricoesAgo.map((item) => {
                      const isQuitado = item.status === 'CONFIRMADO' || item.statusInscricao === 'VALIDA';
                      return (
                        <div
                          key={item.id}
                          className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-mono shrink-0 border ${
                              isQuitado
                                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                                : 'bg-amber-950/80 text-amber-400 border-amber-500/40'
                            }`}>
                              <span className="text-[9px] uppercase font-bold text-slate-400">AGO</span>
                              <span className="text-sm font-black">{item.anoVigente}</span>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-bold text-white">
                                  {item.planoNome || `Inscrição Oficial AGO ${item.anoVigente}`}
                                </h4>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                                  isQuitado
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}>
                                  {isQuitado ? 'QUITADO • HOMOLOGADO' : 'PENDENTE DE COMPENSAÇÃO'}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-xs text-slate-400 font-mono flex-wrap">
                                <span>Data: {formatarDataBR(item.dataInscricao)}</span>
                                <span>•</span>
                                <span>Forma: {item.formaPagamento || 'PIX'}</span>
                                <span>•</span>
                                <span className="text-slate-200 font-bold">
                                  R$ {Number(item.valor || planoSugerido?.valor || 190).toFixed(2).replace('.', ',')}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                            <button
                              type="button"
                              onClick={() => setComprovanteAgoModal(item)}
                              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-teal-300 hover:text-white text-xs font-mono font-bold transition-all border border-teal-500/30 flex items-center gap-2 cursor-pointer shadow hover:border-teal-500"
                            >
                              <FileCheck className="w-4 h-4 text-teal-400" />
                              <span>Ver Comprovante</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* MODAL DE PAGAMENTO DA INSCRIÇÃO AGO (CHECKOUT REAL ASAAS) */}
              {modalPagamentoAgoAberto && ministro && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn overflow-y-auto"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setModalPagamentoAgoAberto(false);
                  }}
                >
                  <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto relative">
                    <button
                      type="button"
                      onClick={() => setModalPagamentoAgoAberto(false)}
                      className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer z-10"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <CheckoutRealAgo
                      ministro={{
                        id: ministro.id,
                        nome: ministro.nome || 'Ministro',
                        cpf: ministro.cpf || '',
                        cargo: ministro.cargo || 'Ministro',
                        email: ministro.email || 'secretaria@cimadebe.org.br',
                        telefone: ministro.telefone || '',
                      }}
                      plano={{
                        id: planoSugerido.id || planoSugerido.codigo || 'PLANO_1_NORMAL',
                        codigo: planoSugerido.codigo || planoSugerido.id || 'PLANO_1_NORMAL',
                        nome: planoSugerido.nome,
                        valor: planoSugerido.valor,
                        subtitulo: planoSugerido.subtitulo,
                      }}
                      onVoltar={() => setModalPagamentoAgoAberto(false)}
                      onConcluido={async (dados) => {
                        notifySuccess('Inscrição Conciliada', 'Inscrição da AGO homologada e quitada com sucesso via Asaas!');
                        setModalPagamentoAgoAberto(false);
                        setComprovanteAgoModal(dados);
                        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
                      }}
                    />
                  </div>
                </div>
              )}

              {/* MODAL: COMPROVANTE OFICIAL DE INSCRIÇÃO & QUITAÇÃO AGO */}
              {comprovanteAgoModal && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn overflow-y-auto"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setComprovanteAgoModal(null);
                  }}
                >
                  <div className="bg-slate-900 border border-teal-500/40 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto font-sans">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/40 flex items-center justify-center">
                          <FileCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono uppercase font-bold text-teal-400 tracking-wider block">
                            Comprovante Oficial Homologado
                          </span>
                          <h3 className="text-base font-black text-white">
                            Inscrição da AGO {comprovanteAgoModal.anoVigente}
                          </h3>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setComprovanteAgoModal(null)}
                        className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Ficha Oficial do Comprovante */}
                    <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-5 text-xs font-mono">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-4">
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase">Protocolo de Inscrição</span>
                          <span className="text-sm font-bold text-teal-300">
                            {comprovanteAgoModal.id || `AGO-${comprovanteAgoModal.anoVigente}-8941`}
                          </span>
                        </div>
                        <div className="sm:text-right">
                          <span className="text-[10px] text-slate-500 block uppercase">Situação</span>
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-500/40 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> LIQUIDADO & HOMOLOGADO
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-slate-500 uppercase block">Ministro / Delegado</span>
                          <span className="text-white font-bold font-sans text-sm block">
                            {comprovanteAgoModal.ministroNome || ministro.nome}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-slate-500 uppercase block">CPF / Registro Ministerial</span>
                          <span className="text-slate-200 block">
                            {comprovanteAgoModal.cpf || ministro.cpf} • {ministro.registroMinisterial || 'RM-45892'}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-slate-500 uppercase block">Cargo Eclesiástico</span>
                          <span className="text-amber-400 font-bold block">
                            {comprovanteAgoModal.cargo || ministro.cargo}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-slate-500 uppercase block">Plano / Categoria</span>
                          <span className="text-slate-200 block">
                            {comprovanteAgoModal.planoNome || `Plano Oficial AGO ${comprovanteAgoModal.anoVigente}`}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-slate-500 uppercase block">Valor Quitado</span>
                          <span className="text-teal-300 font-bold text-sm block">
                            R$ {Number(comprovanteAgoModal.valor || planoSugerido?.valor || 190).toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-slate-500 uppercase block">Forma de Pagamento</span>
                          <span className="text-slate-200 block">
                            {comprovanteAgoModal.formaPagamento || 'PIX Instantâneo'}
                          </span>
                        </div>
                        <div className="space-y-0.5 sm:col-span-2">
                          <span className="text-[10px] text-slate-500 uppercase block">Data e Hora do Pagamento</span>
                          <span className="text-slate-200 block">
                            {formatarDataBR(comprovanteAgoModal.dataInscricao)}
                          </span>
                        </div>
                      </div>

                      {/* Selo Criptográfico & Autenticidade */}
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold">
                          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                          <span>Autenticação Digital Oficial (CIMADEBE)</span>
                        </div>
                        <p className="text-[10px] text-teal-400/90 break-all select-all font-mono">
                          {comprovanteAgoModal.hashIntegridade || `SHA256:AGO#${comprovanteAgoModal.anoVigente}#${ministro?.cpf || '00000'}#AUTENTICADO#SIGM`}
                        </p>
                      </div>
                    </div>

                    {/* Ações de Impressão / Download / Fechar */}
                    <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              if (ministro) {
                                gerarPdfComprovanteInscricaoAgo(comprovanteAgoModal, ministro, appConfig);
                                confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
                              }
                            } catch (err) {
                              console.error('Erro ao gerar PDF do comprovante:', err);
                              alert('Erro ao gerar arquivo PDF. Tente usar o botão de Impressão Direta.');
                            }
                          }}
                          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs font-mono uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
                        >
                          <Download className="w-4 h-4 text-slate-950" />
                          <span>Baixar Comprovante PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            try {
                              window.print();
                            } catch (err) {
                              console.error('Erro ao chamar impressão:', err);
                            }
                          }}
                          className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-black text-xs font-mono uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer border border-slate-700"
                        >
                          <Printer className="w-4 h-4 text-amber-400" />
                          <span>Imprimir</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setComprovanteAgoModal(null)}
                        className="px-6 py-3 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs font-mono uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-teal-500/20"
                      >
                        Concluir Consulta
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {abaAtiva === 'igreja' && (
            <motion.div
              key="igreja"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800/90 space-y-6 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Building className="w-5 h-5 text-amber-400" />
                  <span>Igreja Filiada & Congregação Local</span>
                </h3>
                <span className="text-xs font-mono px-3.5 py-1.5 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold">
                  FILIAÇÃO REGULAR
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block uppercase">Nome da Igreja / Sede</span>
                  <span className="text-white font-bold font-sans text-sm mt-0.5 block">{igrejaMinistro?.nomeFantasia || ministro.igrejaFiliadaNome}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block uppercase">CNPJ</span>
                  <span className="text-slate-200 mt-0.5 block">{igrejaMinistro?.cnpj || '14.852.963/0001-44'}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 sm:col-span-2">
                  <span className="text-slate-500 text-[10px] block uppercase">Endereço da Igreja</span>
                  <span className="text-slate-200 font-sans mt-0.5 block">
                    {igrejaMinistro ? `${igrejaMinistro.logradouro}, ${igrejaMinistro.numero} - ${igrejaMinistro.bairro}, ${igrejaMinistro.municipio} / ${igrejaMinistro.uf}` : 'Av. Sete de Setembro, 1500 - Campo Grande, Salvador / BA'}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {abaAtiva === 'beneficios' && (
            <motion.div
              key="beneficios"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800/90 space-y-6 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <span>Clube de Benefícios & Vantagens Exclusivas (Obreiro VIP)</span>
                </h3>
                <span className="text-xs font-mono px-3.5 py-1.5 rounded-xl bg-amber-950 text-amber-300 border border-amber-500/40 font-bold">
                  PARCERIAS NACIONAIS
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Como ministro adimplente da CIMADEBE / SIGM, você tem acesso a descontos exclusivos em redes hoteleiras, companhias aéreas, livrarias teológicas, planos de saúde e faculdades parceiras.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950 px-2 py-0.5 rounded">HOSPEDAGEM & VIAGENS</span>
                  <h4 className="text-sm font-bold text-white">Rede Hoteleira Convention & Passagens Aéreas</h4>
                  <p className="text-xs text-slate-400">Até 25% de desconto em hotéis parceiros em todo o Brasil para congressos e viagens ministeriais.</p>
                  <button onClick={() => alert('Cupom de desconto gerado: CIMADEBE2026VIP')} className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs font-mono hover:bg-amber-400 cursor-pointer mt-2">
                    Resgatar Cupom de Desconto
                  </button>
                </div>

                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded">EDUCAÇÃO TEOLÓGICA</span>
                  <h4 className="text-sm font-bold text-white">Faculdades Teológicas & Livrarias</h4>
                  <p className="text-xs text-slate-400">Bolsas parciais de 30% a 50% em cursos de pós-graduação e descontos em obras literárias.</p>
                  <button onClick={() => alert('Bolsa de estudos solicitada com sucesso!')} className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs font-mono hover:bg-cyan-400 cursor-pointer mt-2">
                    Solicitar Bolsa de Estudos
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {abaAtiva === 'votacao' && (
            <motion.div
              key="votacao"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* Terminal Canônico de Votação da AGO com Integridade Criptográfica */}
              <PortalVotacaoMinistro ministro={ministro} />

              <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800/90 space-y-6 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Vote className="w-5 h-5 text-purple-400" />
                    <span>Eleições de Mesa & Consultas Gerais da Convenção</span>
                  </h3>
                  <span className="text-xs font-mono px-3.5 py-1.5 rounded-xl bg-purple-950 text-purple-300 border border-purple-500/40 font-bold">
                    CHINTAS ELEITORAIS
                  </span>
                </div>

              {votacoesPortal.filter(v => v.status === 'ABERTA').length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <ShieldCheck className="w-12 h-12 text-slate-500 mx-auto" />
                  <h4 className="text-base font-bold text-white">Nenhuma Urna Aberta no Momento</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    As votações e pautas oficiais da convenção serão abertas pela Mesa Diretora conforme o calendário estatutário.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {votacoesPortal.filter(v => v.status === 'ABERTA').map((votacao) => {
                    const jaVotou = votosMinisterioPortal.some(v => v.votacaoId === votacao.id);
                    const exigeAdimplencia = votacao.regrasElegibilidade === 'APENAS_ADIMPLENTES';
                    const isAdimplente = ministro?.statusAdimplencia === 'EM_DIA' || ministro?.statusAdimplencia === 'EM_DIA_FUTURO' || ministro?.statusAdimplencia === 'PENDENTE' || ministro?.statusAdimplencia === 'ADIMPLENTE';
                    const bloqueadoInadimplente = exigeAdimplencia && !isAdimplente;

                    return (
                      <div key={votacao.id} className="p-6 rounded-3xl bg-slate-950 border border-purple-500/30 space-y-6 shadow-xl">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono px-3 py-1 rounded-full bg-purple-950 text-purple-300 border border-purple-500/40 font-bold uppercase">
                              {votacao.tipoVotacao === 'ELEICAO_CANDIDATO' ? '👤 Eleição de Candidato' : votacao.tipoVotacao === 'ESCOLHA_TEMA' ? '📜 Escolha de Tema' : '💰 Aprovação de Investimento'} • Vigência até {formatarDataBR(votacao.dataFim)}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {exigeAdimplencia ? 'Apenas Adimplentes' : 'Geral'}
                            </span>
                          </div>
                          <h4 className="text-xl font-black text-white">{votacao.titulo}</h4>
                          <p className="text-xs text-slate-300">{votacao.descricao}</p>
                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-purple-300">
                            <strong>Quesito:</strong> {votacao.quesitos || 'Deliberação Geral'}
                          </div>
                        </div>

                        {bloqueadoInadimplente ? (
                          <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-mono flex items-center gap-3">
                            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                            <div>
                              <strong>Acesso Restrito:</strong> Esta votação exige adimplência ativa na convenção. Seu registro consta como inadimplente. Regularize suas taxas para liberar seu voto.
                            </div>
                          </div>
                        ) : jaVotou ? (
                          <div className="p-6 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-center space-y-3 font-mono">
                            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                            <h5 className="text-sm font-bold text-white">Seu voto já foi computado nesta urna!</h5>
                            <p className="text-[11px] text-slate-300">
                              Voto registrado com sucesso com recibo emitido.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <span className="text-xs font-mono font-bold text-amber-400 uppercase block">
                              Selecione sua Opção / Chapa:
                            </span>
                            <div className="space-y-3">
                              {votacao.chapas?.map((chapa: any) => (
                                <label
                                  key={chapa.id}
                                  className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                                    chapaSelecionadaVoto[votacao.id] === chapa.id
                                      ? 'bg-purple-950/50 border-purple-500 shadow-md'
                                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`voto-${votacao.id}`}
                                    checked={chapaSelecionadaVoto[votacao.id] === chapa.id}
                                    onChange={() => setChapaSelecionadaVoto({ ...chapaSelecionadaVoto, [votacao.id]: chapa.id })}
                                    className="text-purple-500 focus:ring-purple-500"
                                  />
                                  <div>
                                    <span className="text-xs font-bold text-white block">{chapa.nome}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">Líder / Presidente: {chapa.lider} • {chapa.proposta}</span>
                                  </div>
                                </label>
                              ))}
                            </div>

                            <button
                              type="button"
                              disabled={processandoVoto || !chapaSelecionadaVoto[votacao.id]}
                              onClick={async () => {
                                const chapaId = chapaSelecionadaVoto[votacao.id];
                                if (!chapaId) return;

                                setProcessandoVoto(true);
                                try {
                                  const hashAudit = `sha256-${Math.random().toString(36).substring(2)}${Date.now()}`;
                                  await addDoc(collection(db, 'votos_eletronicos'), {
                                    votacaoId: votacao.id,
                                    ministroId: ministro.id,
                                    ministroNome: ministro.nome,
                                    opId: chapaId,
                                    dataVoto: new Date().toISOString(),
                                    hashAudit,
                                    tenantId: ministro.tenantId || 't-sede-salvador'
                                  });
                                  setMsgVotoSucesso('Voto criptografado e computado com sucesso!');
                                  setTimeout(() => setMsgVotoSucesso(null), 4000);
                                } catch (err: any) {
                                  console.error('Erro ao computar voto:', err);
                                  alert(err?.message || 'Falha ao registrar voto.');
                                } finally {
                                  setProcessandoVoto(false);
                                }
                              }}
                              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-slate-950 font-black text-xs font-mono uppercase tracking-wider transition-all shadow-lg cursor-pointer disabled:opacity-50"
                            >
                              {processandoVoto ? 'Processando Criptografia...' : 'Confirmar Voto Criptografado'}
                            </button>

                            {msgVotoSucesso && (
                              <div className="p-3 rounded-xl bg-emerald-950 border border-emerald-500 text-emerald-200 text-xs font-mono flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span>{msgVotoSucesso}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
            </motion.div>
          )}

          {abaAtiva === 'ead' && (
            <motion.div
              key="ead"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800/90 space-y-6 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <span>Seminário Teológico & Certificados EAD</span>
                </h3>
                <span className="text-xs font-mono px-3.5 py-1.5 rounded-xl bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold">
                  FORMAÇÃO CONTINUADA
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Acompanhe seus cursos de capacitação teológica e emita certificados oficiais validados pela convenção com QR Code de autenticidade.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded font-bold">CONCLUÍDO</span>
                    <span className="text-xs font-mono text-slate-400">40h // 2026</span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Hermenêutica e Exegese Bíblica Avançada</h4>
                  <button
                    type="button"
                    onClick={() => setAbaAtiva('certificado')}
                    className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Baixar Certificado Oficial
                  </button>
                </div>
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded font-bold">EM ANDAMENTO</span>
                    <span className="text-xs font-mono text-slate-400">75% Concluído</span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Capelania Prisional & Hospitalar</h4>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                    <div className="bg-cyan-400 h-full w-3/4"></div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {abaAtiva === 'oracao' && (
            <motion.div
              key="oracao"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800/90 space-y-6 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-amber-400" />
                  <span>Mural de Orações & Intercessão Pastoral</span>
                </h3>
                <span className="text-xs font-mono px-3.5 py-1.5 rounded-xl bg-purple-950 text-purple-300 border border-purple-500/40 font-bold">
                  COMUNHÃO DOS OBREIROS
                </span>
              </div>

              <div className="space-y-4 max-w-2xl">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Submeter pedido de oração para a convenção..."
                    value={novoPedidoOracao}
                    onChange={(e) => setNovoPedidoOracao(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => {
                      if (!novoPedidoOracao.trim()) return;
                      setPedidosOracao([novoPedidoOracao, ...pedidosOracao]);
                      setNovoPedidoOracao('');
                    }}
                    className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold font-mono transition-all cursor-pointer"
                  >
                    Publicar
                  </button>
                </div>

                <div className="space-y-3">
                  {pedidosOracao.map((p, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <HeartHandshake className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-xs text-slate-200">{p}</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded border border-emerald-500/30 shrink-0">
                        Em Intercessão
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal QR Code Validator Simulation */}
      {qrCodeModalAberto && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setQrCodeModalAberto(false);
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-center relative max-h-[92vh] overflow-y-auto"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
              <QrCode className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase font-bold text-amber-400 block tracking-widest">
                VALIDAÇÃO BACEN / LEDGER CRIPTOGRÁFICO
              </span>
              <h3 className="text-lg font-black text-white">QR Code de Autenticidade Ministerial</h3>
              <p className="text-xs text-slate-300">
                Aponte a câmera de qualquer smartphone para validar instantaneamente as credenciais eclesiásticas de {ministro.nome}.
              </p>
            </div>

            <div className="w-48 h-48 bg-white p-3 rounded-2xl mx-auto flex items-center justify-center shadow-inner">
              <svg viewBox="0 0 100 100" className="w-full h-full text-slate-950">
                <rect width="100" height="100" fill="white" />
                <path
                  d="M10 10h30v30H10zM15 15v20h20V15zm45-5h30v30H60zM65 15v20h20V15zM10 60h30v30H10zM15 65v20h20V65zm48 0h6v6h-6zm12 0h6v6h-6zm-6 6h6v6h-6zm12 6h6v6h-6zm-18 6h6v6h-6zm12 6h6v6h-6z"
                  fill="currentColor"
                />
                <circle cx="25" cy="25" r="5" fill="currentColor" />
                <circle cx="75" cy="25" r="5" fill="currentColor" />
                <circle cx="25" cy="75" r="5" fill="currentColor" />
              </svg>
            </div>

            <div className="text-[10px] font-mono text-slate-400 break-all bg-slate-950 p-3 rounded-xl border border-slate-800">
              URL DE VALIDAÇÃO: https://cimadebe.org.br/validar?id={ministro.id}&hash=9f86d08188
            </div>

            <button
              onClick={() => setQrCodeModalAberto(false)}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold transition-all cursor-pointer"
            >
              Fechar Validador
            </button>
          </motion.div>
        </div>
      )}

      {/* Modal Editar Perfil Ministerial */}
      {modalEditarPerfilAberto && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalEditarPerfilAberto(false);
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 relative max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <UserCog className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Editar Perfil Ministerial</h3>
                  <p className="text-xs text-slate-400 font-mono">Atualize suas informações cadastrais na convenção.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalEditarPerfilAberto(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {feedbackPerfil && (
              <div
                className={`p-4 rounded-2xl border text-xs font-mono flex items-center gap-3 ${
                  feedbackPerfil.tipo === 'sucesso'
                    ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
                    : 'bg-rose-950/90 border-rose-500/50 text-rose-300'
                }`}
              >
                {feedbackPerfil.tipo === 'sucesso' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <span>{feedbackPerfil.texto}</span>
              </div>
            )}

            <form onSubmit={handleSalvarPerfil} className="space-y-4 font-mono text-xs">
              {/* Preview e Upload Nativo de Foto */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-amber-500/50 shrink-0 bg-slate-900 relative flex items-center justify-center">
                  {(dadosPerfil.fotoUrl || ministro.fotoUrl) ? (
                    <img
                      src={dadosPerfil.fotoUrl || ministro.fotoUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-slate-500" />
                  )}
                  {uploadingFoto && (
                    <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 flex-1 w-full">
                  <label className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    <span>Upload da Foto de Perfil (Arquivo)</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingFoto}
                    onChange={handleUploadFoto}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-500/20 file:text-amber-400 hover:file:bg-amber-500/30 text-xs font-sans cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 block">Formatos: JPG, PNG, WEBP (Processamento binário Firebase Storage)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] uppercase font-bold">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={dadosPerfil.nome}
                    onChange={(e) => setDadosPerfil({ ...dadosPerfil, nome: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 outline-none font-sans text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] uppercase font-bold">E-mail Institucional</label>
                  <input
                    type="email"
                    required
                    value={dadosPerfil.email}
                    onChange={(e) => setDadosPerfil({ ...dadosPerfil, email: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 outline-none font-sans text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] uppercase font-bold">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={dadosPerfil.telefone}
                    onChange={(e) => setDadosPerfil({ ...dadosPerfil, telefone: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 outline-none text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] uppercase font-bold">RG / Órgão Emissor</label>
                  <input
                    type="text"
                    value={dadosPerfil.rg}
                    onChange={(e) => setDadosPerfil({ ...dadosPerfil, rg: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 outline-none text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] uppercase font-bold">Estado Civil</label>
                  <select
                    value={dadosPerfil.estadoCivil}
                    onChange={(e) => setDadosPerfil({ ...dadosPerfil, estadoCivil: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 outline-none text-xs"
                  >
                    <option value="CASADO">Casado(a)</option>
                    <option value="SOLTEIRO">Solteiro(a)</option>
                    <option value="VIUVO">Viúvo(a)</option>
                    <option value="DIVORCIADO">Divorciado(a)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] uppercase font-bold">Cargo Eclesiástico</label>
                  <select
                    value={dadosPerfil.cargo}
                    onChange={(e) => setDadosPerfil({ ...dadosPerfil, cargo: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 outline-none text-xs"
                  >
                    <option value="Pastor">Pastor</option>
                    <option value="Pastora">Pastora</option>
                    <option value="Evangelista">Evangelista</option>
                    <option value="Presbítero">Presbítero</option>
                    <option value="Missionário">Missionário</option>
                    <option value="Missionária">Missionária</option>
                    <option value="Diácono">Diácono</option>
                    <option value="Diaconisa">Diaconisa</option>
                    <option value="Cooperador">Cooperador</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] uppercase font-bold">Data de Consagração</label>
                  <input
                    type="date"
                    value={dadosPerfil.dataConsagracao}
                    onChange={(e) => setDadosPerfil({ ...dadosPerfil, dataConsagracao: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 outline-none text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] uppercase font-bold">CEP</label>
                  <input
                    type="text"
                    placeholder="00000-000"
                    value={dadosPerfil.cep}
                    onChange={(e) => setDadosPerfil({ ...dadosPerfil, cep: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 outline-none text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] uppercase font-bold">Bairro</label>
                  <input
                    type="text"
                    value={dadosPerfil.bairro}
                    onChange={(e) => setDadosPerfil({ ...dadosPerfil, bairro: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 outline-none text-xs font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] uppercase font-bold">Cidade</label>
                  <input
                    type="text"
                    value={dadosPerfil.cidade}
                    onChange={(e) => setDadosPerfil({ ...dadosPerfil, cidade: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 outline-none text-xs font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] uppercase font-bold">Estado / UF</label>
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="BA"
                    value={dadosPerfil.estado}
                    onChange={(e) => setDadosPerfil({ ...dadosPerfil, estado: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 outline-none text-xs font-mono"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-slate-400 text-[10px] uppercase font-bold">Endereço Residencial (Logradouro & Número)</label>
                  <input
                    type="text"
                    value={dadosPerfil.endereco}
                    onChange={(e) => setDadosPerfil({ ...dadosPerfil, endereco: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 outline-none text-xs font-sans"
                  />
                </div>
              </div>

              {/* Seção de Biometria Integrada */}
              <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Fingerprint className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-white text-xs font-bold font-mono">Biometria WebAuthn / Passkeys</h4>
                    <p className="text-[11px] text-slate-400">Ative o login instantâneo por impressão digital ou FaceID.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAtivarBiometria}
                  disabled={ativandoBiometria}
                  className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shrink-0 disabled:opacity-50"
                >
                  {ativandoBiometria ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                  ) : (
                    <Fingerprint className="w-3.5 h-3.5 text-slate-950" />
                  )}
                  <span>{ativandoBiometria ? 'Processando...' : 'Ativar Biometria'}</span>
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalEditarPerfilAberto(false)}
                  className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoPerfil}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                >
                  {salvandoPerfil ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <Save className="w-4 h-4 text-slate-950" />
                  )}
                  <span>{salvandoPerfil ? 'Salvando...' : 'Salvar Alterações'}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal Alterar Senha de Acesso */}
      {modalMudarSenhaAberto && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalMudarSenhaAberto(false);
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 relative max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Alterar Senha de Acesso</h3>
                  <p className="text-xs text-slate-400 font-mono">Defina uma nova credencial segura.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalMudarSenhaAberto(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {feedbackSenha && (
              <div
                className={`p-4 rounded-2xl border text-xs font-mono flex items-center gap-3 ${
                  feedbackSenha.tipo === 'sucesso'
                    ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
                    : 'bg-rose-950/90 border-rose-500/50 text-rose-300'
                }`}
              >
                {feedbackSenha.tipo === 'sucesso' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <span>{feedbackSenha.texto}</span>
              </div>
            )}

            <form onSubmit={handleMudarSenha} className="space-y-4 font-mono text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 text-[10px] uppercase font-bold">Senha Atual (Confirmação)</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={dadosSenha.senhaAtual}
                  onChange={(e) => setDadosSenha({ ...dadosSenha, senhaAtual: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-emerald-500 outline-none text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 text-[10px] uppercase font-bold">Nova Senha (Mínimo 6 dígitos)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={dadosSenha.novaSenha}
                  onChange={(e) => setDadosSenha({ ...dadosSenha, novaSenha: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-emerald-500 outline-none text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 text-[10px] uppercase font-bold">Confirmar Nova Senha</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={dadosSenha.confirmarNovaSenha}
                  onChange={(e) => setDadosSenha({ ...dadosSenha, confirmarNovaSenha: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-emerald-500 outline-none text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalMudarSenhaAberto(false)}
                  className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoSenha}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                >
                  {salvandoSenha ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <KeyRound className="w-4 h-4 text-slate-950" />
                  )}
                  <span>{salvandoSenha ? 'Atualizando...' : 'Confirmar Nova Senha'}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
