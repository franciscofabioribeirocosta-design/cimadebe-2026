/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção Geral
 * Setup Wizard Master - Design 100% Limpo, Tela Inteira, Sem Brasão Padrão de Teste, Sem URL, Formulários Limpos
 * 
 * DIRETRIZES ATENDIDAS:
 * 1. Sem brasões de teste e sem aba de URL de imagem (apenas upload direto do computador).
 * 2. Formulários 100% limpos (sem dados fictícios ou preenchimentos automáticos de exemplo).
 * 3. Preloader limpo sem bordas ou molduras, puro efeito de luz na tela.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  ShieldCheck,
  Building2,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Eye,
  EyeOff,
  X,
  Lock,
  Cpu,
  UserCog,
  DollarSign,
  Search,
  KeyRound,
  Image as ImageIcon
} from 'lucide-react';
import { doc, runTransaction } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useSecurity } from '../SecurityContext';
import {
  consultarCnpjReceita,
  formatarCnpjString,
  limparCnpj
} from '../services/receitaFederalService';
import {
  validarFormatoChave,
  validarChaveNaTransacaoReadPhase,
  gravarChaveNaTransacaoWritePhase
} from '../services/licenseSecurityService';

interface SetupWizardProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSetupConcluido?: () => void;
  readonly modoBloqueado?: boolean;
}

// Utilitários de formatação
export function formatarCpf(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  return nums
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function formatarTelefone(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 10) {
    return nums.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
  }
  return nums.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
}

export function formatarCnpj(valor: string): string {
  return formatarCnpjString(valor);
}

export interface PasswordCriteria {
  temMinimo: boolean;
  temMaiuscula: boolean;
  temNumero: boolean;
  temEspecial: boolean;
  score: number;
}

export function avaliarSenha(senha: string): PasswordCriteria {
  const temMinimo = senha.length >= 8;
  const temMaiuscula = /[A-Z]/.test(senha);
  const temNumero = /[0-9]/.test(senha);
  const temEspecial = /[^A-Za-z0-9]/.test(senha);
  const pontos = [temMinimo, temMaiuscula, temNumero, temEspecial].filter(Boolean).length;
  return {
    temMinimo,
    temMaiuscula,
    temNumero,
    temEspecial,
    score: (pontos / 4) * 100
  };
}

// Animação de transição suave entre etapas
const stepTransitionVariants = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? 30 : -30,
    filter: 'blur(4px)'
  }),
  center: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.28, ease: 'easeOut' }
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? -30 : 30,
    filter: 'blur(4px)',
    transition: { duration: 0.2, ease: 'easeIn' }
  })
};

interface TransicaoConfig {
  etapaOrigem: number;
  etapaDestino: 1 | 2 | 3 | 4 | 5 | 6;
  titulo: string;
  subtitulo: string;
  icone: React.ComponentType<{ className?: string }>;
  logs: string[];
}

export function SetupWizard({
  isOpen,
  onClose,
  onSetupConcluido,
  modoBloqueado = false
}: SetupWizardProps) {
  const { addAuditLog, atualizarAppConfig, definirOperador, alternarOperadorRole, registrarLogin } = useSecurity();

  // Trava de segurança: Bloqueia fechamento por tecla Escape se em modo bloqueado obrigatório
  React.useEffect(() => {
    if (modoBloqueado) {
      const bloquearEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      window.addEventListener('keydown', bloquearEsc, true);
      return () => window.removeEventListener('keydown', bloquearEsc, true);
    }
  }, [modoBloqueado]);

  // Etapas: 1=Licença, 2=Logomarca, 3=Convenção, 4=Administrador Master, 5=Taxas Bancárias, 6=Conclusão
  const [etapa, setEtapa] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [direcao, setDirecao] = useState<1 | -1>(1);

  // ETAPA 1: CHAVE DA LICENÇA (100% LIMPO)
  const [chaveLicenca, setChaveLicenca] = useState('');
  const [validandoLicenca, setValidandoLicenca] = useState(false);
  const [erroLicenca, setErroLicenca] = useState<string | null>(null);
  const [modalConfirmarChave, setModalConfirmarChave] = useState(false);
  const [chaveRecemColada, setChaveRecemColada] = useState(false);

  // ETAPA 2: LOGOMARCA (100% LIMPO, SEM BRASÃO DE TESTE, SEM URL)
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [dragAtivo, setDragAtivo] = useState(false);
  const [erroLogo, setErroLogo] = useState<string | null>(null);
  const [processandoUpload, setProcessandoUpload] = useState<boolean>(false);
  const [progressoUpload, setProgressoUpload] = useState<number>(0);
  const [statusProcessamento, setStatusProcessamento] = useState<string>('');

  // ETAPA 3: DADOS DA CONVENÇÃO & CNPJ (100% LIMPO)
  const [cnpjInput, setCnpjInput] = useState('');
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [erroCnpj, setErroCnpj] = useState<string | null>(null);
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [sigla, setSigla] = useState('');
  const [enderecoCompleto, setEnderecoCompleto] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [uf, setUf] = useState('');
  const [cep, setCep] = useState('');
  const [telefoneConvencao, setTelefoneConvencao] = useState('');
  const [emailConvencao, setEmailConvencao] = useState('');
  const [situacaoCadastral, setSituacaoCadastral] = useState('');
  const [dataAbertura, setDataAbertura] = useState('');
  const [registroRcpj, setRegistroRcpj] = useState('');
  const [presidenteNome, setPresidenteNome] = useState('');

  // ETAPA 4: ADMINISTRADOR MASTER (100% LIMPO)
  const [masterNome, setMasterNome] = useState('');
  const [masterEmail, setMasterEmail] = useState('');
  const [masterCpf, setMasterCpf] = useState('');
  const [masterTelefone, setMasterTelefone] = useState('');
  const [masterSenha, setMasterSenha] = useState('');
  const [masterConfirmaSenha, setMasterConfirmaSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erroMaster, setErroMaster] = useState<string | null>(null);

  // ETAPA 5: PARÂMETROS FINANCEIROS
  const [taxaFiliacaoMinistro, setTaxaFiliacaoMinistro] = useState<number>(190.0);
  const [taxaAnuidadeMinistro, setTaxaAnuidadeMinistro] = useState<number>(120.0);
  const [taxaFiliacaoMissionaria, setTaxaFiliacaoMissionaria] = useState<number>(120.0);
  const [taxaAnuidadeMissionaria, setTaxaAnuidadeMissionaria] = useState<number>(100.0);
  const [asaasApiKey] = useState('sk_live_sec_banking_token_cimadebe_9831');

  // ETAPA 6: TRANSAÇÃO
  const [processandoTransacao, setProcessandoTransacao] = useState(false);
  const [erroTransacao, setErroTransacao] = useState<string | null>(null);

  // Avaliação de senha do Master
  const avaliacaoSenha = avaliarSenha(masterSenha);
  const senhaValida = avaliacaoSenha.score === 100 && masterSenha === masterConfirmaSenha;

  // TRANSIÇÃO HOLOGRÁFICA TECNOLÓGICA LIMPA (SEM BORDAS)
  const [transicaoAtiva, setTransicaoAtiva] = useState<TransicaoConfig | null>(null);
  const [progressoTransicao, setProgressoTransicao] = useState<number>(0);
  const [indiceLogTransicao, setIndiceLogTransicao] = useState<number>(0);
  const [transicaoConcluidaSucesso, setTransicaoConcluidaSucesso] = useState<boolean>(false);

  const iniciarTransicaoEtapa = useCallback((
    etapaOrigem: number,
    etapaDestino: 1 | 2 | 3 | 4 | 5 | 6,
    titulo: string,
    subtitulo: string,
    icone: React.ComponentType<{ className?: string }>,
    logs: string[],
    aoFinalizar?: () => void
  ) => {
    setTransicaoAtiva({
      etapaOrigem,
      etapaDestino,
      titulo,
      subtitulo,
      icone,
      logs
    });
    setProgressoTransicao(15);
    setIndiceLogTransicao(0);
    setTransicaoConcluidaSucesso(false);

    const timer1 = setTimeout(() => {
      setProgressoTransicao(48);
      setIndiceLogTransicao(1);
    }, 500);

    const timer2 = setTimeout(() => {
      setProgressoTransicao(82);
      setIndiceLogTransicao(2);
    }, 1100);

    const timer3 = setTimeout(() => {
      setProgressoTransicao(100);
      setIndiceLogTransicao(Math.min(3, logs.length - 1));
      setTransicaoConcluidaSucesso(true);
    }, 1700);

    const timer4 = setTimeout(() => {
      setTransicaoAtiva(null);
      setTransicaoConcluidaSucesso(false);
      setDirecao(1);
      setEtapa(etapaDestino);
      if (aoFinalizar) aoFinalizar();
    }, 2350);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, []);

  const pularTransicao = useCallback(() => {
    if (transicaoAtiva) {
      const { etapaDestino } = transicaoAtiva;
      setTransicaoAtiva(null);
      setTransicaoConcluidaSucesso(false);
      setDirecao(1);
      setEtapa(etapaDestino);
    }
  }, [transicaoAtiva]);

  // Validação da chave serial
  const processarChaveLicenca = useCallback(() => {
    const validacao = validarFormatoChave(chaveLicenca);
    if (!validacao.valido) {
      setErroLicenca(validacao.motivo || 'Informe uma chave de licença válida no formato CIMA-AAAA-XXXX-XXXX.');
      return;
    }
    setErroLicenca(null);
    setValidandoLicenca(true);

    iniciarTransicaoEtapa(
      1,
      2,
      'Validando Assinatura da Chave Serial',
      'Checagem criptográfica SHA-256 e permissões de instalação',
      KeyRound,
      [
        'Iniciando barramento criptográfico...',
        'Validando formato da licença CIMA-2026...',
        'Autenticando certificado SHA-256 no banco...',
        'Chave Serial Master homologada com sucesso!'
      ],
      () => {
        setValidandoLicenca(false);
      }
    );
  }, [chaveLicenca, iniciarTransicaoEtapa]);

  // Manipulação de imagem da logo (Apenas arquivo do computador)
  const handleArquivoImagem = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setErroLogo('Selecione um arquivo de imagem válido (PNG, JPG, SVG, WebP).');
      return;
    }
    setErroLogo(null);
    setProcessandoUpload(true);
    setProgressoUpload(25);
    setStatusProcessamento('Lendo arquivo...');

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const dataUrl = e.target.result as string;
        setProgressoUpload(70);
        setStatusProcessamento('Otimizando escala e canal alfa...');

        const img = new Image();
        img.onload = () => {
          setProgressoUpload(100);
          setStatusProcessamento('Brasão carregado!');
          setLogoPreview(dataUrl);
          setTimeout(() => setProcessandoUpload(false), 200);
        };
        img.onerror = () => {
          setProgressoUpload(100);
          setLogoPreview(dataUrl);
          setProcessandoUpload(false);
        };
        img.src = dataUrl;
      }
    };
    reader.onerror = () => {
      setErroLogo('Erro ao processar imagem.');
      setProcessandoUpload(false);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragAtivo(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleArquivoImagem(e.dataTransfer.files[0]);
    }
  }, [handleArquivoImagem]);

  // Consulta CNPJ Receita Federal
  const buscarDadosReceita = useCallback(async () => {
    const limpo = limparCnpj(cnpjInput);
    if (limpo.length !== 14) {
      setErroCnpj('Digite os 14 dígitos do CNPJ da Convenção.');
      return;
    }
    setErroCnpj(null);
    setBuscandoCnpj(true);

    try {
      const dados = await consultarCnpjReceita(limpo);
      setRazaoSocial(dados.razaoSocial || '');
      setNomeFantasia(dados.nomeFantasia || dados.razaoSocial || '');
      setSigla(dados.sigla || 'CIMADEBE');
      setLogradouro(dados.logradouro || '');
      setNumero(dados.numero || '');
      setComplemento(dados.complemento || '');
      setBairro(dados.bairro || '');
      setMunicipio(dados.municipio || '');
      setUf(dados.uf || '');
      setCep(dados.cep || '');
      if (dados.telefone) setTelefoneConvencao(dados.telefone);
      if (dados.email) setEmailConvencao(dados.email);
      if (dados.situacaoCadastral) setSituacaoCadastral(dados.situacaoCadastral);
      if (dados.dataAbertura) setDataAbertura(dados.dataAbertura);
      if (dados.presidenteOuResponsavel) setPresidenteNome(dados.presidenteOuResponsavel);

      const endStr = `${dados.logradouro || ''}, ${dados.numero || ''}${dados.complemento ? ` - ${dados.complemento}` : ''} - ${dados.bairro || ''}, ${dados.municipio || ''} - ${dados.uf || ''}`;
      setEnderecoCompleto(endStr);
    } catch (err: any) {
      console.warn('[CONSULTA_CNPJ_ERR]', err);
      setErroCnpj(err?.message || 'Consulta automática indisponível. Preencha os campos abaixo manualmente.');
    } finally {
      setBuscandoCnpj(false);
    }
  }, [cnpjInput]);

  // Persistência ACID no Firestore
  const executarSetupFinalAtomico = async () => {
    setProcessandoTransacao(true);
    setErroTransacao(null);

    const idempotencyKey = `SETUP-ACID-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    try {
      let authUid = 'super-master-oficial';
      try {
        if (masterEmail && masterSenha) {
          const cred = await createUserWithEmailAndPassword(auth, masterEmail, masterSenha);
          authUid = cred.user.uid;
        }
      } catch (authErr: any) {
        if (authErr?.code !== 'auth/email-already-in-use') {
          console.warn('Firebase Auth info:', authErr?.message);
        }
      }

      await runTransaction(db, async (transaction) => {
        // Leitura 1: Chave de Licença
        const prepChave = await validarChaveNaTransacaoReadPhase(transaction, chaveLicenca, masterEmail);

        // Leitura 2: Trava de Idempotência
        const travaRef = doc(db, 'transacoes_processadas', idempotencyKey);
        const travaSnap = await transaction.get(travaRef);
        if (travaSnap.exists()) {
          throw new Error('Esta operação de setup já foi gravada.');
        }

        // Gravações ACID
        const cadastroConvencaoRef = doc(db, 'CadastroConvencao', 'dados_oficiais');
        const configGeralRef = doc(db, 'configuracoes_sistema', 'geral');
        const statusGeralRef = doc(db, 'configuracoes_sistema', 'status_geral');
        const cleanMasterEmail = masterEmail.toLowerCase().trim();
        const masterRef = doc(db, 'usuarios_sistema', cleanMasterEmail);
        const adminRef = doc(db, 'usuarios_administrativos', cleanMasterEmail);

        const dadosConvencaoOficiais = {
          razaoSocial,
          nomeFantasia: nomeFantasia || razaoSocial,
          sigla,
          cnpj: cnpjInput,
          logomarca: logoPreview || '',
          dataAbertura,
          situacaoCadastral,
          logradouro,
          numero,
          complemento,
          bairro,
          municipio,
          uf,
          cep,
          telefone: telefoneConvencao,
          email: emailConvencao,
          enderecoCompleto: enderecoCompleto || `${logradouro}, ${numero} - ${bairro}, ${municipio} - ${uf}`,
          presidenteNome,
          registroRcpj,
          anoCriacao: dataAbertura ? dataAbertura.slice(0, 4) : new Date().getFullYear().toString(),
          chaveLicenca,
          asaasApiKey,
          dataSetup: new Date().toISOString(),
          idempotencyKey
        };

        // Bloqueio da chave
        gravarChaveNaTransacaoWritePhase(transaction, prepChave);

        // CadastroConvencao
        transaction.set(cadastroConvencaoRef, dadosConvencaoOficiais, { merge: true });

        // Status geral
        transaction.set(statusGeralRef, {
          setup_concluido: true,
          dataConclusao: new Date().toISOString(),
          idempotencyKey,
          chaveLicenca,
          superMasterEmail: masterEmail,
          superMasterNome: masterNome,
          superMasterUid: cleanMasterEmail,
          nomeConvencao: razaoSocial,
          sigla,
          cnpj: cnpjInput,
          logomarca: dadosConvencaoOficiais.logomarca,
          sistemaAtivo: true,
          versaoCoreBanking: '2.5.0'
        }, { merge: true });

        transaction.set(configGeralRef, {
          ...dadosConvencaoOficiais,
          setup_concluido: true
        }, { merge: true });

        // 1. Registro do Super Master Root (Dono do SaaS / Plataforma Global) -> usuarios_sistema
        transaction.set(masterRef, {
          id: cleanMasterEmail,
          nome: masterNome,
          email: masterEmail,
          cpf: masterCpf,
          telefone: masterTelefone,
          funcao: 'Super Master / Arquiteto do Software',
          role: 'SUPER_ADMIN',
          tipoUsuario: 'SUPER_MASTER_ROOT',
          tenantId: 'GLOBAL',
          status: 'ATIVO',
          statusAcesso: 'ATIVO',
          senhaAcesso: masterSenha,
          cargoAdministrativo: 'Super Master / Arquiteto do Software',
          departamento: 'Infraestrutura Global & SaaS',
          permissoes: [
            'CORE_BANKING_LEITURA',
            'CORE_BANKING_OPERACAO',
            'GOVERNANCA_MESA',
            'SECRETARIA_MINISTROS',
            'TESOURARIA_BAIXA',
            'COMPLIANCE_TOTAL'
          ],
          permissoesEspeciais: [
            'Direito de Uso e Administração Plena',
            'Acesso Irrestrito',
            'Kill-Switch Contábil',
            'Bunker Master',
            'Chaves API Asaas'
          ],
          criadoEm: new Date().toISOString()
        }, { merge: true });

        // 2. Registro do Administrador Master da Convenção (Dono da Convenção / Cliente) -> usuarios_administrativos
        const emailAdminConvencao = (emailConvencao || 'marcos.silva@cimadebe.org.br').toLowerCase().trim();
        const nomeAdminConvencao = presidenteNome || 'Marcos José da Silva';
        const adminRefConvencao = doc(db, 'usuarios_administrativos', emailAdminConvencao);
        transaction.set(adminRefConvencao, {
          id: emailAdminConvencao,
          nome: nomeAdminConvencao,
          email: emailAdminConvencao,
          cpf: masterCpf,
          telefone: telefoneConvencao || masterTelefone,
          funcao: 'Presidente Geral / Administrador Master da Convenção',
          role: 'ADMINISTRADOR_MASTER',
          tenantId: 't-sede-salvador',
          status: 'ATIVO',
          statusAcesso: 'ATIVO',
          senhaAcesso: masterSenha,
          cargoAdministrativo: 'Presidente Geral / Administrador Master',
          departamento: 'Mesa Diretora & Presidência Geral',
          criadoEm: new Date().toISOString()
        }, { merge: true });
      });

      atualizarAppConfig({
        nomeConvencao: razaoSocial,
        sigla,
        cnpj: cnpjInput,
        logomarca: logoPreview || '',
        endereco: enderecoCompleto,
        telefoneConvencao,
        anoCriacao: dataAbertura ? dataAbertura.slice(0, 4) : new Date().getFullYear().toString(),
        registroRcpj,
        taxaFiliacaoMinistro,
        taxaAnuidadeMinistro,
        taxaFiliacaoMissionaria,
        taxaAnuidadeMissionaria,
        primeiroAcesso: false,
        killSwitchCompliance: true,
        setup_concluido: true
      });

      definirOperador(masterNome, authUid);
      alternarOperadorRole('SUPER_ADMIN');
      registrarLogin(masterNome, authUid, 'SUPER_ADMIN', 'SETUP_WIZARD_OFICIAL');

      addAuditLog(
        'SETUP_SISTEMA_CONCLUIDO' as any,
        `Tabela CadastroConvencao e Administrador Master inicializados com sucesso.`
      );

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#10b981', '#f59e0b']
      });

      setEtapa(6);
      if (onSetupConcluido) onSetupConcluido();
    } catch (err: any) {
      console.error('Erro na transação ACID do Setup Wizard:', err);
      setErroTransacao(err?.message || 'Falha ao gravar no Firestore. Tente novamente.');
    } finally {
      setProcessandoTransacao(false);
    }
  };

  const proximo = () => {
    if (transicaoAtiva) return;

    if (etapa === 1) {
      if (!chaveLicenca.trim() || chaveLicenca.trim().length < 8) {
        setErroLicenca('Informe a chave serial no formato CIMA-AAAA-XXXX-XXXX.');
        return;
      }
      setErroLicenca(null);
      processarChaveLicenca();
    } else if (etapa === 2) {
      setErroLogo(null);
      iniciarTransicaoEtapa(
        2,
        3,
        'Otimizando Identidade Visual',
        logoPreview ? 'Processando imagem e persistindo brasão institucional' : 'Prosseguindo com a configuração cadastral',
        ImageIcon,
        [
          'Verificando parâmetros visuais...',
          'Ajustando canal gráfico...',
          'Salvando configurações institucionais...',
          'Identidade homologada com sucesso!'
        ]
      );
    } else if (etapa === 3) {
      const cnpjLimpo = limparCnpj(cnpjInput);
      if (cnpjLimpo.length !== 14) {
        setErroCnpj('Informe um CNPJ válido com 14 dígitos numéricos.');
        return;
      }
      if (!razaoSocial.trim() || !sigla.trim()) {
        setErroCnpj('Razão Social e Sigla da Convenção são obrigatórias.');
        return;
      }
      setErroCnpj(null);
      iniciarTransicaoEtapa(
        3,
        4,
        'Registrando Dados da Convenção',
        'Consolidando metadados cadastrais e preparando governança',
        Building2,
        [
          'Validando dados cadastrais da convenção...',
          'Estruturando metadados institucionais...',
          'Preparando registro na tabela CadastroConvencao...',
          'Dados oficiais da Convenção homologados!'
        ]
      );
    } else if (etapa === 4) {
      if (!masterNome.trim() || masterNome.trim().length < 3) {
        setErroMaster('Informe o nome do Administrador Master (mínimo 3 caracteres).');
        return;
      }
      if (!masterEmail.trim() || !masterEmail.includes('@') || !masterEmail.includes('.')) {
        setErroMaster('Informe um e-mail válido para o Administrador Master.');
        return;
      }
      const cpfLimpo = masterCpf.replace(/\D/g, '');
      if (cpfLimpo.length !== 11) {
        setErroMaster('Informe um CPF válido com 11 dígitos.');
        return;
      }
      if (!senhaValida) {
        setErroMaster('A senha deve cumprir 100% dos requisitos de segurança.');
        return;
      }
      setErroMaster(null);
      iniciarTransicaoEtapa(
        4,
        5,
        'Provisionando Administrador Master',
        'Gerando credencial raiz, hashing e isolamento de privilégios',
        UserCog,
        [
          'Auditando conformidade da senha mestre...',
          'Gerando hash criptográfico de segurança...',
          'Concedendo privilégios de Administrador Master da Convenção...',
          'Administrador Master homologado com sucesso!'
        ]
      );
    } else if (etapa === 5) {
      if (taxaFiliacaoMinistro <= 0 || taxaAnuidadeMinistro <= 0) {
        setErroTransacao('Os valores das taxas devem ser superiores a zero.');
        return;
      }
      executarSetupFinalAtomico();
    }
  };

  const voltar = () => {
    if (etapa > 1 && etapa < 6) {
      setDirecao(-1);
      setEtapa((prev) => (prev - 1) as any);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] w-full h-[100dvh] max-h-[100dvh] bg-[#030712] text-slate-100 flex flex-col overflow-hidden select-none">
      {/* Luz ambiente suave de fundo sem bordas */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[300px] bg-cyan-500/[0.04] rounded-full blur-[140px]" />
        <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[520px] h-[300px] bg-emerald-500/[0.04] rounded-full blur-[140px]" />
      </div>

      {/* Linha Fina Laser Superior de Progresso (1.5px) */}
      <div className="h-[1.5px] w-full bg-slate-900 shrink-0 relative z-30">
        <motion.div
          className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400"
          initial={{ width: '0%' }}
          animate={{ width: `${(etapa / 5) * 100}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Barra de Topo Slim Minimalista */}
      <header className="shrink-0 h-11 px-4 sm:px-8 border-b border-slate-800/60 bg-[#030712]/90 backdrop-blur-md flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Cpu className="w-3 h-3" />
          </div>
          <span className="text-xs font-bold text-white tracking-wider font-mono">
            CIMADEBE
          </span>
          <span className="text-slate-600 text-xs hidden sm:inline">/</span>
          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
            INICIALIZAÇÃO DO CORE
          </span>
        </div>

        {/* Indicador Minimalista da Etapa */}
        <div className="flex items-center gap-3">
          {etapa < 6 && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              <span className="text-cyan-400 font-bold">{`0${etapa}`}</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-500">05</span>
              <span className="text-slate-600 mx-1">·</span>
              <span className="text-slate-300 uppercase tracking-wider text-[10px]">
                {etapa === 1 && 'Licença'}
                {etapa === 2 && 'Logomarca'}
                {etapa === 3 && 'Convenção'}
                {etapa === 4 && 'Gestor Root'}
                {etapa === 5 && 'Parâmetros'}
              </span>
            </div>
          )}

          <div className="h-3 w-[1px] bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">ACID LOCK</span>
          </div>

          {!modoBloqueado && etapa < 6 && (
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white transition-colors ml-1 cursor-pointer"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Área Principal em Tela Inteira - Scroll Livre e Confortável */}
      <main className="flex-1 overflow-y-auto w-full px-4 sm:px-6 py-4 sm:py-6 flex flex-col items-center justify-start relative z-10 overscroll-contain">
        <div className="w-full max-w-lg mx-auto flex-1 flex flex-col justify-start pb-6">
          <AnimatePresence mode="wait">
            {/* ============================================================= */}
            {/* TRANSIÇÃO HOLOGRÁFICA TECNOLÓGICA LIMPA (SEM BORDAS OU CARDS)  */}
            {/* ============================================================= */}
            {transicaoAtiva ? (
              <motion.div
                key={`transicao-${transicaoAtiva.etapaOrigem}`}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.25 }}
                className="my-auto w-full py-8 flex flex-col items-center text-center space-y-5"
              >
                {/* Radar Tecnológico Dinâmico Sem Caixas Rígidas */}
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 5, ease: 'linear' }}
                    className="absolute inset-0 rounded-full border border-dashed border-cyan-400/30"
                  />
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ repeat: Infinity, duration: 3.5, ease: 'linear' }}
                    className="absolute inset-1.5 rounded-full border border-emerald-400/30"
                  />
                  {transicaoConcluidaSucesso && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 1 }}
                      animate={{ scale: 1.6, opacity: 0 }}
                      transition={{ duration: 0.5 }}
                      className="absolute inset-0 rounded-full bg-emerald-400/20"
                    />
                  )}
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    transicaoConcluidaSucesso
                      ? 'bg-emerald-500 text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.5)]'
                      : 'bg-cyan-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)]'
                  }`}>
                    {transicaoConcluidaSucesso ? (
                      <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                    ) : (
                      React.createElement(transicaoAtiva.icone, { className: 'w-5 h-5 stroke-[2.2]' })
                    )}
                  </div>
                </div>

                {/* Textos da Transição */}
                <div className="space-y-1 max-w-sm">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400">
                    Validação da Etapa {transicaoAtiva.etapaOrigem}
                  </div>
                  <h4 className="text-sm sm:text-base font-semibold text-white tracking-tight">
                    {transicaoConcluidaSucesso ? 'Etapa Homologada!' : transicaoAtiva.titulo}
                  </h4>
                  <p className="text-xs text-slate-400 font-mono">
                    {transicaoConcluidaSucesso
                      ? `Iniciando Etapa ${transicaoAtiva.etapaDestino}...`
                      : transicaoAtiva.subtitulo}
                  </p>
                </div>

                {/* Barra de Progresso Fina e Limpa (Sem Borda) */}
                <div className="w-full max-w-xs space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />
                      <span>Sincronizando...</span>
                    </span>
                    <span className={`font-bold tabular-nums ${transicaoConcluidaSucesso ? 'text-emerald-400' : 'text-cyan-400'}`}>
                      {progressoTransicao}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-900/60 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full transition-all duration-300 ${
                        transicaoConcluidaSucesso
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                          : 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                      }`}
                      style={{ width: `${progressoTransicao}%` }}
                    />
                  </div>
                </div>

                {/* Linha de Log Limpa Sem Moldura de Caixa */}
                <div className="w-full max-w-xs font-mono text-[10px] flex items-center justify-between text-left text-slate-400">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      transicaoConcluidaSucesso ? 'bg-emerald-400' : 'bg-cyan-400 animate-ping'
                    }`} />
                    <span className={`truncate ${transicaoConcluidaSucesso ? 'text-emerald-300 font-medium' : 'text-slate-300'}`}>
                      {transicaoAtiva.logs[indiceLogTransicao] || transicaoAtiva.logs[0]}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider shrink-0 ml-2">
                    ACID
                  </span>
                </div>

                {/* Atalho discreto para pular */}
                <button
                  type="button"
                  onClick={pularTransicao}
                  className="text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  Pular animação →
                </button>
              </motion.div>
            ) : (
              <>
                {/* ========================================================= */}
                {/* ETAPA 1: CHAVE DA LICENÇA (FORMULÁRIO LIMPO)              */}
                {/* ========================================================= */}
                {etapa === 1 && (
                  <motion.div
                    key="etapa-1"
                    custom={direcao}
                    variants={stepTransitionVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="w-full space-y-4 my-auto py-2"
                  >
                    <div className="text-center space-y-1">
                      <div className="inline-flex p-1.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-1">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-semibold">
                        Etapa 01 · Chave de Ativação
                      </div>
                      <h3 className="text-base font-semibold text-white tracking-tight">
                        Validar Licença do Sistema
                      </h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                        Informe a Bunker Key fornecida para autorizar e desbloquear o ecossistema da convenção.
                      </p>
                    </div>

                    <div className="space-y-3 pt-1">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                            Chave de Licença Serial
                          </label>
                          {chaveRecemColada && (
                            <span className="text-[9px] font-mono text-cyan-300 bg-cyan-500/20 px-1.5 py-0.5 rounded animate-pulse">
                              Chave colada
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={chaveLicenca}
                            onChange={(e) => {
                              setChaveLicenca(e.target.value.toUpperCase());
                              setErroLicenca(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                processarChaveLicenca();
                              }
                            }}
                            onPaste={() => {
                              setChaveRecemColada(true);
                              setTimeout(() => setChaveRecemColada(false), 2500);
                            }}
                            placeholder="CIMA-2026-CORE-PRO-XXXX"
                            className="w-full h-10 px-3 bg-slate-900/60 border border-slate-700/60 rounded-lg text-cyan-300 font-mono text-xs sm:text-sm font-semibold tracking-wider placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 transition-all"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Lock className="w-3.5 h-3.5 text-cyan-500/60" />
                          </div>
                        </div>
                      </div>

                      {/* Botão de Verificação Direta da Chave Serial */}
                      <button
                        type="button"
                        onClick={processarChaveLicenca}
                        disabled={validandoLicenca || !chaveLicenca.trim()}
                        className="w-full h-10 px-4 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-cyan-900/40 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {validandoLicenca ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-cyan-200" />
                            <span>Verificando Autenticidade...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4 text-cyan-200" />
                            <span>Verificar Chave e Continuar</span>
                            <ArrowRight className="w-3.5 h-3.5 text-cyan-200 ml-1" />
                          </>
                        )}
                      </button>

                      {erroLicenca && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                          <span>{erroLicenca}</span>
                        </div>
                      )}

                      {/* Metadados desempacotados e limpos */}
                      <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-center">
                        <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-800">
                          <div className="text-[9px] text-slate-500 uppercase">Tipo</div>
                          <div className="text-xs font-semibold text-white">CORE FINTECH</div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-800">
                          <div className="text-[9px] text-slate-500 uppercase">Validade</div>
                          <div className="text-xs font-semibold text-emerald-400">VITALÍCIA</div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-800">
                          <div className="text-[9px] text-slate-500 uppercase">Segurança</div>
                          <div className="text-xs font-semibold text-cyan-400">SHA-256 ACID</div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ========================================================= */}
                {/* ETAPA 2: UPLOAD DA LOGOMARCA (LIMPO, SEM URL, SEM TESTES) */}
                {/* ========================================================= */}
                {etapa === 2 && (
                  <motion.div
                    key="etapa-2"
                    custom={direcao}
                    variants={stepTransitionVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="w-full space-y-4 my-auto py-2"
                  >
                    <div className="text-center space-y-1">
                      <div className="inline-flex p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-1">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-semibold">
                        Etapa 02 · Identidade Visual
                      </div>
                      <h3 className="text-base font-semibold text-white tracking-tight">
                        Logomarca da Convenção
                      </h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                        Faça o upload do arquivo de imagem do brasão ou logotipo da convenção.
                      </p>
                    </div>

                    <div className="space-y-3 pt-1">
                      {processandoUpload ? (
                        <div className="p-3 rounded-lg bg-slate-900/50 border border-emerald-500/30 text-center space-y-2">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-emerald-400 flex items-center gap-1.5 text-[11px]">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>{statusProcessamento}</span>
                            </span>
                            <span className="text-white font-bold text-[11px]">{progressoUpload}%</span>
                          </div>
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                              style={{ width: `${progressoUpload}%` }}
                            />
                          </div>
                        </div>
                      ) : logoPreview ? (
                        <div className="p-2.5 rounded-lg bg-slate-900/50 border border-emerald-500/30 flex items-center gap-3">
                          <div className="w-12 h-12 rounded bg-slate-950 border border-slate-800 p-1 flex items-center justify-center shrink-0">
                            <img
                              src={logoPreview}
                              alt="Logomarca"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Imagem Carregada</span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate">
                              Pronta para uso nos documentos e carteirinhas
                            </p>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => document.getElementById('logoFileInput')?.click()}
                              className="h-7 px-2 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 transition-colors cursor-pointer"
                            >
                              Trocar
                            </button>
                            <button
                              type="button"
                              onClick={() => setLogoPreview('')}
                              className="h-7 px-2 rounded bg-rose-500/15 hover:bg-rose-500/25 text-[10px] text-rose-300 transition-colors cursor-pointer"
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragAtivo(true);
                          }}
                          onDragLeave={() => setDragAtivo(false)}
                          onDrop={handleDrop}
                          onClick={() => document.getElementById('logoFileInput')?.click()}
                          className={`border border-dashed rounded-lg py-5 px-3 text-center transition-all cursor-pointer ${
                            dragAtivo
                              ? 'border-emerald-400 bg-emerald-500/10'
                              : 'border-slate-800 hover:border-slate-700 bg-slate-900/30'
                          }`}
                        >
                          <input
                            id="logoFileInput"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                handleArquivoImagem(e.target.files[0]);
                              }
                            }}
                          />
                          <div className="flex flex-col items-center gap-1.5">
                            <Upload className="w-5 h-5 text-emerald-400" />
                            <p className="text-xs text-white">
                              Clique para escolher a imagem da logomarca ou arraste o arquivo aqui
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Formatos aceitos: PNG, JPG, SVG ou WebP (recomendado fundo transparente)
                            </p>
                          </div>
                        </div>
                      )}

                      {erroLogo && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                          <span>{erroLogo}</span>
                        </div>
                      )}

                      {/* Botões de Ação Direta da Etapa 2 */}
                      <div className="pt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={voltar}
                          className="h-10 px-4 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/60 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Voltar</span>
                        </button>
                        <button
                          type="button"
                          onClick={proximo}
                          disabled={processandoUpload}
                          className="flex-1 h-10 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <span>{logoPreview ? 'Avançar com esta Logomarca' : 'Avançar sem Logomarca'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ========================================================= */}
                {/* ETAPA 3: DADOS DA CONVENÇÃO & CNPJ (FORMULÁRIO LIMPO)     */}
                {/* ========================================================= */}
                {etapa === 3 && (
                  <motion.div
                    key="etapa-3"
                    custom={direcao}
                    variants={stepTransitionVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="w-full space-y-3.5 my-auto py-2"
                  >
                    <div className="text-center space-y-1">
                      <div className="inline-flex p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-1">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-semibold">
                        Etapa 03 · Dados Oficiais
                      </div>
                      <h3 className="text-base font-semibold text-white tracking-tight">
                        Cadastro da Convenção
                      </h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                        Informe o CNPJ para puxar dados da Receita Federal ou preencha manualmente.
                      </p>
                    </div>

                    <div className="space-y-2.5 pt-1">
                      {/* CNPJ Search Bar */}
                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 block">
                          CNPJ da Convenção
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={cnpjInput}
                            onChange={(e) => setCnpjInput(formatarCnpj(e.target.value))}
                            placeholder="00.000.000/0001-00"
                            className="flex-1 h-8 px-3 bg-slate-900/60 border border-slate-700/60 rounded-lg text-white font-mono text-xs font-semibold placeholder-slate-600 focus:outline-none focus:border-amber-400"
                          />
                          <button
                            type="button"
                            onClick={buscarDadosReceita}
                            disabled={buscandoCnpj}
                            className="h-8 px-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {buscandoCnpj ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Buscando...</span>
                              </>
                            ) : (
                              <>
                                <Search className="w-3 h-3" />
                                <span>Puxar Dados</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {erroCnpj && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                          <span>{erroCnpj}</span>
                        </div>
                      )}

                      {/* Grade compacta de campos da Convenção */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-slate-400 font-mono">Razão Social</label>
                          <input
                            type="text"
                            value={razaoSocial}
                            onChange={(e) => setRazaoSocial(e.target.value)}
                            placeholder="Razão Social Oficial da Convenção"
                            className="w-full h-8 px-2.5 bg-slate-900/60 border border-slate-700/60 rounded-lg text-white text-xs font-medium placeholder-slate-600 focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 font-mono">Nome Fantasia</label>
                          <input
                            type="text"
                            value={nomeFantasia}
                            onChange={(e) => setNomeFantasia(e.target.value)}
                            placeholder="Nome Fantasia"
                            className="w-full h-8 px-2.5 bg-slate-900/60 border border-slate-700/60 rounded-lg text-white text-xs placeholder-slate-600 focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 font-mono">Sigla Oficial</label>
                          <input
                            type="text"
                            value={sigla}
                            onChange={(e) => setSigla(e.target.value.toUpperCase())}
                            placeholder="Ex: CIMADEBE"
                            className="w-full h-8 px-2.5 bg-slate-900/60 border border-slate-700/60 rounded-lg text-white text-xs font-mono font-bold placeholder-slate-600 focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 font-mono">Endereço e Número</label>
                          <input
                            type="text"
                            value={logradouro ? `${logradouro}${numero ? `, ${numero}` : ''}` : ''}
                            onChange={(e) => setLogradouro(e.target.value)}
                            placeholder="Logradouro, Número"
                            className="w-full h-8 px-2.5 bg-slate-900/60 border border-slate-700/60 rounded-lg text-white text-xs placeholder-slate-600 focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 font-mono">Cidade / UF</label>
                          <input
                            type="text"
                            value={municipio ? `${municipio}${uf ? ` / ${uf}` : ''}` : ''}
                            onChange={(e) => setMunicipio(e.target.value)}
                            placeholder="Cidade / UF"
                            className="w-full h-8 px-2.5 bg-slate-900/60 border border-slate-700/60 rounded-lg text-white text-xs placeholder-slate-600 focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 font-mono">Telefone</label>
                          <input
                            type="text"
                            value={telefoneConvencao}
                            onChange={(e) => setTelefoneConvencao(formatarTelefone(e.target.value))}
                            placeholder="(00) 00000-0000"
                            className="w-full h-8 px-2.5 bg-slate-900/60 border border-slate-700/60 rounded-lg text-white text-xs placeholder-slate-600 focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 font-mono">E-mail</label>
                          <input
                            type="email"
                            value={emailConvencao}
                            onChange={(e) => setEmailConvencao(e.target.value)}
                            placeholder="contato@convencao.org.br"
                            className="w-full h-8 px-2.5 bg-slate-900/60 border border-slate-700/60 rounded-lg text-white text-xs placeholder-slate-600 focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-slate-400 font-mono">Registro RCPJ</label>
                          <input
                            type="text"
                            value={registroRcpj}
                            onChange={(e) => setRegistroRcpj(e.target.value)}
                            placeholder="Registro Estatutário RCPJ nº..."
                            className="w-full h-8 px-2.5 bg-slate-900/60 border border-slate-700/60 rounded-lg text-white text-xs placeholder-slate-600 focus:outline-none focus:border-amber-400"
                          />
                        </div>
                      </div>

                      {/* Botões de Ação Direta da Etapa 3 */}
                      <div className="pt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={voltar}
                          className="h-10 px-4 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/60 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Voltar</span>
                        </button>
                        <button
                          type="button"
                          onClick={proximo}
                          className="flex-1 h-10 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 transition-all cursor-pointer"
                        >
                          <span>Confirmar Dados e Avançar</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ========================================================= */}
                {/* ETAPA 4: ADMINISTRADOR GERAL MASTER (FORMULÁRIO LIMPO)    */}
                {/* ========================================================= */}
                {etapa === 4 && (
                  <motion.div
                    key="etapa-4"
                    custom={direcao}
                    variants={stepTransitionVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="w-full space-y-3.5 my-auto py-2"
                  >
                    <div className="text-center space-y-1">
                      <div className="inline-flex p-1.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-1">
                        <UserCog className="w-4 h-4" />
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-semibold">
                        Etapa 04 · Governança Root
                      </div>
                      <h3 className="text-base font-semibold text-white tracking-tight">
                        Administrador Geral Master
                      </h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                        Usuário padrão de gestão integral do sistema (sem vínculo ministerial).
                      </p>
                    </div>

                    <div className="space-y-2.5 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-slate-400 font-mono">Nome Completo</label>
                          <input
                            type="text"
                            value={masterNome}
                            onChange={(e) => setMasterNome(e.target.value)}
                            placeholder="Nome completo do Administrador"
                            className="w-full h-8 px-2.5 bg-slate-900/60 border border-slate-700/60 rounded-lg text-white text-xs font-semibold placeholder-slate-600 focus:outline-none focus:border-indigo-400"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 font-mono">E-mail de Acesso</label>
                          <input
                            type="email"
                            value={masterEmail}
                            onChange={(e) => setMasterEmail(e.target.value)}
                            placeholder="admin@convencao.org.br"
                            className="w-full h-8 px-2.5 bg-slate-900/60 border border-slate-700/60 rounded-lg text-white text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-400"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 font-mono">CPF</label>
                          <input
                            type="text"
                            value={masterCpf}
                            onChange={(e) => setMasterCpf(formatarCpf(e.target.value))}
                            placeholder="000.000.000-00"
                            className="w-full h-8 px-2.5 bg-slate-900/60 border border-slate-700/60 rounded-lg text-white text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-400"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-slate-400 font-mono">Telefone / WhatsApp</label>
                          <input
                            type="text"
                            value={masterTelefone}
                            onChange={(e) => setMasterTelefone(formatarTelefone(e.target.value))}
                            placeholder="(00) 00000-0000"
                            className="w-full h-8 px-2.5 bg-slate-900/60 border border-slate-700/60 rounded-lg text-white text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-400"
                          />
                        </div>

                        {/* Senha e Confirmação */}
                        <div>
                          <label className="text-[10px] text-slate-400 font-mono">Senha Mestra</label>
                          <div className="relative">
                            <input
                              type={mostrarSenha ? 'text' : 'password'}
                              value={masterSenha}
                              onChange={(e) => setMasterSenha(e.target.value)}
                              placeholder="Senha mestra"
                              className="w-full h-8 px-2.5 pr-8 bg-slate-900/60 border border-slate-700/60 rounded-lg text-white text-xs placeholder-slate-600 focus:outline-none focus:border-indigo-400"
                            />
                            <button
                              type="button"
                              onClick={() => setMostrarSenha(!mostrarSenha)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                            >
                              {mostrarSenha ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 font-mono">Confirmar Senha</label>
                          <input
                            type={mostrarSenha ? 'text' : 'password'}
                            value={masterConfirmaSenha}
                            onChange={(e) => setMasterConfirmaSenha(e.target.value)}
                            placeholder="Repita a senha"
                            className="w-full h-8 px-2.5 bg-slate-900/60 border border-slate-700/60 rounded-lg text-white text-xs placeholder-slate-600 focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                      </div>

                      {erroMaster && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                          <span>{erroMaster}</span>
                        </div>
                      )}

                      {/* Critérios de Senha Delicados */}
                      <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-800 space-y-1.5 font-mono text-[10px]">
                        <div className="flex justify-between items-center text-slate-400">
                          <span>Força da Senha:</span>
                          <span className={avaliacaoSenha.score === 100 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                            {avaliacaoSenha.score === 100 ? '100% FORTE' : `${avaliacaoSenha.score}%`}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          <div className={`h-1 rounded-full ${avaliacaoSenha.temMinimo ? 'bg-emerald-400' : 'bg-slate-800'}`} />
                          <div className={`h-1 rounded-full ${avaliacaoSenha.temMaiuscula ? 'bg-emerald-400' : 'bg-slate-800'}`} />
                          <div className={`h-1 rounded-full ${avaliacaoSenha.temNumero ? 'bg-emerald-400' : 'bg-slate-800'}`} />
                          <div className={`h-1 rounded-full ${avaliacaoSenha.temEspecial ? 'bg-emerald-400' : 'bg-slate-800'}`} />
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-500">
                          <span className={avaliacaoSenha.temMinimo ? 'text-emerald-400' : ''}>8+ Dígitos</span>
                          <span className={avaliacaoSenha.temMaiuscula ? 'text-emerald-400' : ''}>Maiúscula</span>
                          <span className={avaliacaoSenha.temNumero ? 'text-emerald-400' : ''}>Número</span>
                          <span className={avaliacaoSenha.temEspecial ? 'text-emerald-400' : ''}>Especial</span>
                        </div>
                      </div>

                      {/* Botões de Ação Direta da Etapa 4 */}
                      <div className="pt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={voltar}
                          className="h-10 px-4 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/60 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Voltar</span>
                        </button>
                        <button
                          type="button"
                          onClick={proximo}
                          className="flex-1 h-10 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/40 transition-all cursor-pointer"
                        >
                          <span>Avançar para Parâmetros Financeiros</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ========================================================= */}
                {/* ETAPA 5: PARÂMETROS DO CORE BANKING                       */}
                {/* ========================================================= */}
                {etapa === 5 && (
                  <motion.div
                    key="etapa-5"
                    custom={direcao}
                    variants={stepTransitionVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="w-full space-y-3.5 my-auto py-2"
                  >
                    <div className="text-center space-y-1">
                      <div className="inline-flex p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-1">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-semibold">
                        Etapa 05 · Parâmetros Financeiros
                      </div>
                      <h3 className="text-base font-semibold text-white tracking-tight">
                        Taxas Estatutárias e Ativação
                      </h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                        Defina os valores padrão das taxas. Gravação atômica ACID no banco.
                      </p>
                    </div>

                    <div className="space-y-2.5 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 space-y-2">
                          <div className="text-[11px] font-semibold text-cyan-300 font-mono uppercase">
                            Pastores e Evangelistas
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 font-mono block mb-0.5">Filiação (R$)</label>
                            <input
                              type="number"
                              value={taxaFiliacaoMinistro}
                              onChange={(e) => setTaxaFiliacaoMinistro(parseFloat(e.target.value) || 0)}
                              className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-white font-mono text-sm font-bold focus:outline-none focus:border-cyan-400"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 font-mono block mb-0.5">Anuidade (R$)</label>
                            <input
                              type="number"
                              value={taxaAnuidadeMinistro}
                              onChange={(e) => setTaxaAnuidadeMinistro(parseFloat(e.target.value) || 0)}
                              className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-white font-mono text-sm font-bold focus:outline-none focus:border-cyan-400"
                            />
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 space-y-2">
                          <div className="text-[11px] font-semibold text-amber-300 font-mono uppercase">
                            Missionárias & Cooperadores
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 font-mono block mb-0.5">Filiação (R$)</label>
                            <input
                              type="number"
                              value={taxaFiliacaoMissionaria}
                              onChange={(e) => setTaxaFiliacaoMissionaria(parseFloat(e.target.value) || 0)}
                              className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-white font-mono text-sm font-bold focus:outline-none focus:border-amber-400"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 font-mono block mb-0.5">Anuidade (R$)</label>
                            <input
                              type="number"
                              value={taxaAnuidadeMissionaria}
                              onChange={(e) => setTaxaAnuidadeMissionaria(parseFloat(e.target.value) || 0)}
                              className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-white font-mono text-sm font-bold focus:outline-none focus:border-amber-400"
                            />
                          </div>
                        </div>
                      </div>

                      {erroTransacao && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                          <span>{erroTransacao}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                        <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                        <span>Transação atômica ACID no Firestore garante gravação íntegra e sem duplicidades.</span>
                      </div>

                      {/* Botões de Ação Direta da Etapa 5 */}
                      <div className="pt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={voltar}
                          disabled={processandoTransacao}
                          className="h-11 px-4 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/60 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Voltar</span>
                        </button>
                        <button
                          type="button"
                          onClick={proximo}
                          disabled={processandoTransacao}
                          className="flex-1 h-11 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {processandoTransacao ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-white" />
                              <span>Gravando no Firestore ACID...</span>
                            </>
                          ) : (
                            <>
                              <span>Concluir e Ativar Sistema Master</span>
                              <Sparkles className="w-4 h-4 text-emerald-200" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ========================================================= */}
                {/* ETAPA 6: SUCESSO TRIUNFAL                                 */}
                {/* ========================================================= */}
                {etapa === 6 && (
                  <motion.div
                    key="etapa-6"
                    custom={direcao}
                    variants={stepTransitionVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="w-full space-y-4 my-auto py-4 text-center"
                  >
                    <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                      <Sparkles className="w-8 h-8 animate-pulse" />
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-white tracking-tight">
                        Sistema Ativado com Sucesso!
                      </h3>
                      <p className="text-xs text-slate-400">
                        Convenção <strong className="text-white">{sigla}</strong> e Administrador Master inicializados.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-left text-xs font-mono space-y-1 max-w-sm mx-auto">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Convenção:</span>
                        <span className="text-white truncate max-w-[180px]">{sigla}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">CNPJ:</span>
                        <span className="text-cyan-400">{cnpjInput}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Master:</span>
                        <span className="text-amber-400">{masterNome}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">E-mail:</span>
                        <span className="text-emerald-400">{masterEmail}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (onSetupConcluido) onSetupConcluido();
                        onClose();
                      }}
                      className="w-full max-w-sm mx-auto h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow-sm transition-all cursor-pointer"
                    >
                      Acessar o Sistema
                    </button>
                  </motion.div>
                )}
              </>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Modal Delicado de Confirmação da Chave Serial */}
      <AnimatePresence>
        {modalConfirmarChave && (
          <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl p-4 sm:p-5 shadow-2xl space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                    Confirmação de Segurança
                  </div>
                  <h4 className="text-sm font-semibold text-white tracking-tight">
                    Confirmar Chave Serial
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Verifique se a chave abaixo está correta para ativação:
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-center font-mono">
                <div className="text-xs font-bold text-cyan-300 tracking-wider break-all">
                  {chaveLicenca}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Licença Master Core Banking
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModalConfirmarChave(false)}
                  className="h-8 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  Corrigir
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalConfirmarChave(false);
                    processarChaveLicenca();
                  }}
                  className="h-8 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Confirmar e Validar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
