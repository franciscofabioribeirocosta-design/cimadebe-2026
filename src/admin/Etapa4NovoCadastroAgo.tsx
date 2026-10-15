/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * [ADMIN/PORTAL] Etapa4NovoCadastroAgo.tsx
 * Cadastro Oficial de Inscrição de Ministro na AGO 2026
 * Completo com todos os campos exigidos no estatuto da convenção:
 * - Escolha de Modalidade (RECEBIDO / ORDENADO)
 * - Seleção de Planos Adequados com Destaque do Valor
 * - Dados Pessoais & Civis completos
 * - Dados Eclesiásticos & Foto 3x4
 * - Endereço Completo com ViaCEP integrado
 * - Meios de Pagamento da Taxa (PIX, Cartão, Boleto)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { compressImageBase64 } from '../utils/imageCompressor';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  Calendar,
  FileText,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Award,
  Crown,
  Users,
  QrCode,
  Copy,
  Check,
  Upload,
  Camera,
  Search,
  RefreshCw,
  Sparkles,
  Shield,
  BadgeCheck,
  DollarSign,
  Paperclip,
  X,
  ExternalLink,
} from 'lucide-react';
import { db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { DocumentoAnexoMinistro } from '../types';
import {
  buscarPlanosAgo,
  filtrarPlanosParaNovoCadastro,
  validarElegibilidadeCargo,
  PlanoAgo,
} from '../services/planosAgoService';
import { salvarPreCadastroNovoMinistro } from '../services/agoFirebaseService';
import { consultarCep } from '../utils/lookup';
import { CrachaCredencialAgoModal } from '../components/CrachaCredencialAgoModal';
import { useSecurity } from '../SecurityContext';

export interface Etapa4NovoCadastroAgoProps {
  onVoltar?: () => void;
  onVoltarBusca?: () => void;
  onConcluido?: (dados: any) => void;
  onCadastroConcluido?: (dados: any, plano?: any) => void;
  cpfInicial?: string;
  planoInicialId?: string;
  isPortal?: boolean;
}

const ESTADOS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const CARGOS_OPCOES = [
  'Pastor',
  'Pastor Presidente',
  'Evangelista',
  'Presbítero',
  'Missionária',
  'Diácono',
  'Diaconisa',
  'Cooperador',
  'Cantor(a) / Obreiro(a)',
];

const PROFISSOES_CIVIS_LISTA = [
  'Administrador(a)',
  'Advogado(a)',
  'Agricultor(a)',
  'Analista de Sistemas / TI',
  'Assistente Social',
  'Autônomo(a)',
  'Bancário(a)',
  'Comerciante / Empresário(a)',
  'Contador(a)',
  'Corretor(a)',
  'Enfermeiro(a)',
  'Engenheiro(a)',
  'Estudante',
  'Funcionário(a) Público(a)',
  'Médico(a)',
  'Militar / Policial',
  'Motorista',
  'Pastor de Tempo Integral',
  'Pedagogo(a)',
  'Professor(a)',
  'Psicólogo(a)',
  'Técnico(a)',
  'Trabalhador(a) da Construção Civil',
  'Vendedor(a)',
  'Aposentado(a)',
  'Do Lar',
  'Outra Profissão',
];

const OPCOES_ESCOLARIDADE_LISTA = [
  'Ensino Fundamental Incompleto',
  'Ensino Fundamental Completo',
  'Ensino Médio Incompleto',
  'Ensino Médio Completo',
  'Ensino Superior Incompleto',
  'Ensino Superior Completo',
  'Pós-Graduação / Especialização',
  'Mestrado',
  'Doutorado',
  'Teologia Básica',
  'Bacharel em Teologia (Seminário Maior)',
];

function formatarMoeda(val: number): string {
  return (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function aplicarMascaraCpf(valor: string): string {
  const apenasNumeros = valor.replace(/\D/g, '').slice(0, 11);
  if (apenasNumeros.length <= 3) return apenasNumeros;
  if (apenasNumeros.length <= 6) {
    return `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3)}`;
  }
  if (apenasNumeros.length <= 9) {
    return `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3, 6)}.${apenasNumeros.slice(6)}`;
  }
  return `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3, 6)}.${apenasNumeros.slice(6, 9)}-${apenasNumeros.slice(9)}`;
}

function aplicarMascaraTelefone(valor: string): string {
  const num = valor.replace(/\D/g, '').slice(0, 11);
  if (num.length <= 2) return num ? `(${num}` : '';
  if (num.length <= 7) return `(${num.slice(0, 2)}) ${num.slice(2)}`;
  return `(${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7)}`;
}

function aplicarMascaraCep(valor: string): string {
  const num = valor.replace(/\D/g, '').slice(0, 8);
  if (num.length <= 5) return num;
  return `${num.slice(0, 5)}-${num.slice(5)}`;
}

export function Etapa4NovoCadastroAgo({
  onVoltar,
  onVoltarBusca,
  onConcluido,
  onCadastroConcluido,
  cpfInicial = '',
  planoInicialId = '',
  isPortal = false,
}: Etapa4NovoCadastroAgoProps) {
  const { igrejasFiliadas } = useSecurity();
  const [planos, setPlanos] = useState<PlanoAgo[]>([]);
  const [carregandoPlanos, setCarregandoPlanos] = useState<boolean>(true);

  // 1. MODALIDADE (RECEBIDO vs ORDENADO) & PLANO
  const [modalidadeConsagracao, setModalidadeConsagracao] = useState<'RECEBIDO' | 'ORDENADO'>('ORDENADO');
  const [planoId, setPlanoId] = useState<string>(planoInicialId);

  // 2. DADOS PESSOAIS & CIVIS
  const [nomeCompleto, setNomeCompleto] = useState<string>('');
  const [cpf, setCpf] = useState<string>(cpfInicial ? aplicarMascaraCpf(cpfInicial) : '');
  const [dataNascimento, setDataNascimento] = useState<string>('');
  const [naturalidade, setNaturalidade] = useState<string>('');
  const [nacionalidade, setNacionalidade] = useState<string>('Brasileira');
  const [estadoCivil, setEstadoCivil] = useState<string>('CASADO');
  const [nomeConjuge, setNomeConjuge] = useState<string>('');
  const [escolaridade, setEscolaridade] = useState<string>('Ensino Médio Completo');
  const [profissao, setProfissao] = useState<string>('Autônomo(a)');
  const [profissaoCustom, setProfissaoCustom] = useState<string>('');

  // 3. DADOS ECLESIÁSTICOS
  const [cargoDesejado, setCargoDesejado] = useState<string>('Presbítero');
  const [igrejaSede, setIgrejaSede] = useState<string>('');
  const [dataConsagracao, setDataConsagracao] = useState<string>('');
  const [pastorConsagrante, setPastorConsagrante] = useState<string>('');
  const [fotoUrl, setFotoUrl] = useState<string>('');

  // 3.1 DOCUMENTOS OFICIAIS (UPLOAD DE ANEXOS ESTATUTÁRIOS)
  const [documentosAnexos, setDocumentosAnexos] = useState<DocumentoAnexoMinistro[]>([]);
  const [novoDocTipo, setNovoDocTipo] = useState<DocumentoAnexoMinistro['tipo']>('RG_CNH');
  const [novoDocNomeCustom, setNovoDocNomeCustom] = useState<string>('');
  const [erroUploadDoc, setErroUploadDoc] = useState<string | null>(null);

  // 4. ENDEREÇO & CONTATO
  const [email, setEmail] = useState<string>('');
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [cep, setCep] = useState<string>('');
  const [rua, setRua] = useState<string>('');
  const [numero, setNumero] = useState<string>('');
  const [complemento, setComplemento] = useState<string>('');
  const [bairro, setBairro] = useState<string>('');
  const [cidade, setCidade] = useState<string>('');
  const [uf, setUf] = useState<string>('BA');
  const [buscandoCep, setBuscandoCep] = useState<boolean>(false);

  // 5. MEIO DE PAGAMENTO
  const [formaPagamento, setFormaPagamento] = useState<'PIX' | 'CARTAO_CREDITO' | 'BOLETO'>('PIX');
  const [parcelasCartao, setParcelasCartao] = useState<number>(1);
  const [chavePixCopiada, setChavePixCopiada] = useState<boolean>(false);
  const [asaasChargeData, setAsaasChargeData] = useState<any>(null);
  const [carregandoAsaasCharge, setCarregandoAsaasCharge] = useState<boolean>(false);

  // ESTADOS DE CONTROLE
  const [enviando, setEnviando] = useState<boolean>(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [dadosSalvosSucesso, setDadosSalvosSucesso] = useState<any>(null);

  // Carrega planos reais do Firestore
  useEffect(() => {
    async function carregar() {
      try {
        setCarregandoPlanos(true);
        const lista = await buscarPlanosAgo(db);
        setPlanos(lista || []);
      } catch (err) {
        console.error('Erro ao buscar planos AGO:', err);
      } finally {
        setCarregandoPlanos(false);
      }
    }
    carregar();
  }, []);

  // Filtra dinamicamente os planos ADEQUADOS ao cargo e à modalidade
  const planosAdequados = useMemo(() => {
    if (!planos || planos.length === 0) return [];

    if (cargoDesejado) {
      const filtrados = filtrarPlanosParaNovoCadastro(planos, cargoDesejado);
      if (filtrados.length > 0) return filtrados;
    }

    // Caso o cargo ainda não tenha plano específico ou seja outro, foca nos planos de candidatos (3 e 4)
    const planosCandidatos = planos.filter(
      (p) => p.id === 'PLANO_3' || p.id === 'PLANO_4' || p.codigo?.includes('3') || p.codigo?.includes('4')
    );
    return planosCandidatos.length > 0 ? planosCandidatos : planos;
  }, [planos, cargoDesejado]);

  // Sincroniza plano selecionado com o plano adequado
  useEffect(() => {
    if (planosAdequados.length > 0) {
      const planoExiste = planosAdequados.find((p) => p.id === planoId);
      if (!planoExiste) {
        setPlanoId(planosAdequados[0].id);
      }
    }
  }, [planosAdequados, planoId]);

  const planoSelecionado = useMemo(() => {
    return planos.find((p) => p.id === planoId) || planosAdequados[0] || null;
  }, [planos, planosAdequados, planoId]);

  // Integração com Asaas Real: busca cobrança Pix / Boleto no backend quando o plano ou dados mudam
  useEffect(() => {
    if (!planoSelecionado || !planoSelecionado.valor) return;
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length < 11) return;

    let cancelado = false;
    setCarregandoAsaasCharge(true);

    fetch('/api/asaas/charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim() || 'secretaria@cimadebe.org.br',
        cpf: cleanCpf,
        name: nomeCompleto.trim() || 'Ministro Inscrito',
        userId: cleanCpf,
        value: planoSelecionado.valor,
        description: `Inscrição AGO 2026 - ${planoSelecionado.nome} (${modalidadeConsagracao})`,
        billingType: formaPagamento === 'BOLETO' ? 'BOLETO' : 'PIX',
      }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelado && json.success && json.data) {
          setAsaasChargeData(json.data);
        }
      })
      .catch((err) => {
        console.warn('Cobrança Asaas API fallback:', err);
      })
      .finally(() => {
        if (!cancelado) setCarregandoAsaasCharge(false);
      });

    return () => {
      cancelado = true;
    };
  }, [planoSelecionado, cpf, nomeCompleto, email, formaPagamento, modalidadeConsagracao]);

  // Upload e compressão de foto 3x4 do ministro
  const getFieldClass = (value: string, isRequired: boolean = true) => {
    const base = 'w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950/80 text-white transition-all focus:outline-none focus:ring-1 font-sans';
    if (!isRequired && !value) {
      return `${base} border border-slate-800 focus:border-slate-600 focus:ring-slate-600`;
    }
    if (value && value.trim().length > 0) {
      return `${base} border border-emerald-500/60 focus:border-emerald-400 focus:ring-emerald-400`;
    }
    return `${base} border border-amber-500/60 focus:border-amber-400 focus:ring-amber-400`;
  };

  // Função para upload de documentos comprobatórios para o Firebase Storage
  const lidarComUploadDocumento = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErroUploadDoc('O documento não pode ultrapassar 10MB.');
      return;
    }

    const tamanhoFormatado =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    try {
      const cleanCpf = cpf.replace(/\D/g, '') || `temp-${Date.now()}`;
      const rawUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve(event.target?.result as string || '');
        };
        reader.readAsDataURL(file);
      });

      const arquivoUrl = file.type.startsWith('image/')
        ? await compressImageBase64(rawUrl, 1000, 1000, 0.7)
        : rawUrl;

      const novoDoc: DocumentoAnexoMinistro = {
        id: `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        nome: novoDocNomeCustom.trim() || file.name,
        tipo: novoDocTipo,
        dataUpload: new Date().toISOString().split('T')[0],
        arquivoUrl,
        tamanho: tamanhoFormatado,
      };
      setDocumentosAnexos((ant) => [...ant, novoDoc]);
      setNovoDocNomeCustom('');
      setErroUploadDoc(null);
    } catch (err: any) {
      console.error('Erro ao ler documento:', err);
      setErroUploadDoc('Erro ao anexar documento.');
    }
    e.target.value = '';
  };

  const removerDocumentoAnexo = (docId: string) => {
    setDocumentosAnexos((ant) => ant.filter((d) => d.id !== docId));
  };

  const lidarComFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErroForm('Por favor, selecione um arquivo de imagem válido (JPG ou PNG).');
      return;
    }

    try {
      const rawUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve(event.target?.result as string || '');
        };
        reader.readAsDataURL(file);
      });
      const downloadUrl = await compressImageBase64(rawUrl, 800, 800, 0.7);
      setFotoUrl(downloadUrl);
      setErroForm(null);
    } catch (err: any) {
      console.error('Erro ao processar foto:', err);
      setErroForm('Erro ao processar imagem da foto.');
    }
  };

  // Busca de endereço inteligente por CEP (ViaCEP)
  const executarBuscaCep = async (cepAlvo: string) => {
    const digitos = cepAlvo.replace(/\D/g, '');
    if (digitos.length !== 8) return;

    setBuscandoCep(true);
    try {
      const resultado = await consultarCep(digitos);
      if (resultado) {
        if (resultado.rua) setRua(resultado.rua);
        if (resultado.bairro) setBairro(resultado.bairro);
        if (resultado.cidade) setCidade(resultado.cidade);
        if (resultado.uf) setUf(resultado.uf.toUpperCase());
        setErroForm(null);
      }
    } catch (err: any) {
      console.warn('Falha na consulta do CEP:', err?.message);
    } finally {
      setBuscandoCep(false);
    }
  };

  const lidarComEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroForm(null);

    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setErroForm('Por favor, informe um CPF válido com 11 dígitos.');
      return;
    }

    if (!nomeCompleto.trim()) {
      setErroForm('Por favor, informe o Nome Completo do ministro.');
      return;
    }

    if (!email.trim() || !whatsapp.trim()) {
      setErroForm('Por favor, informe o E-mail e WhatsApp para contato e credenciamento.');
      return;
    }

    if (!cargoDesejado) {
      setErroForm('Por favor, selecione o cargo eclesiástico do ministro.');
      return;
    }

    if (!igrejaSede.trim()) {
      setErroForm('Por favor, selecione a Igreja Filiada.');
      return;
    }

    if (!cidade.trim() || !uf.trim()) {
      setErroForm('Por favor, informe a Cidade e o Estado (UF) de residência.');
      return;
    }

    try {
      setEnviando(true);

      const rm = `RM-${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}-${cleanCpf.slice(9, 11)}`;
      const ministroId = cleanCpf || `min-${Date.now()}`;
      const profissaoFinal = profissao === 'Outra Profissão' && profissaoCustom.trim() ? profissaoCustom.trim() : profissao;

      const payload = {
        id: ministroId,
        nome: nomeCompleto.trim(),
        nomeCompleto: nomeCompleto.trim(),
        cpf: aplicarMascaraCpf(cleanCpf),
        dataNascimento,
        naturalidade: naturalidade.trim(),
        nacionalidade: nacionalidade.trim() || 'Brasileira',
        estadoCivil,
        nomeConjuge: (estadoCivil === 'CASADO' || estadoCivil === 'CASADA') ? nomeConjuge.trim() : '',
        escolaridade,
        profissao: profissaoFinal,
        email: email.trim().toLowerCase(),
        telefone: whatsapp.trim(),
        whatsapp: whatsapp.trim(),
        cargo: cargoDesejado,
        cargoDesejado,
        registroMinisterial: rm,
        igrejaFiliadaNome: igrejaSede.trim(),
        dataConsagracao,
        pastorConsagrante: pastorConsagrante.trim(),
        fotoUrl: fotoUrl || '',
        documentos: documentosAnexos,
        modalidadeConsagracao,
        planoId: planoSelecionado?.id || planoId || 'PLANO_3',
        planoNome: planoSelecionado?.nome || 'Plano de Inscrição AGO',
        valor: planoSelecionado?.valor || 380,
        formaPagamento,
        parcelasCartao: formaPagamento === 'CARTAO_CREDITO' ? Math.min(Math.max(parcelasCartao, 1), 2) : 1,
        dadosEndereco: {
          cep: cep.trim(),
          rua: rua.trim(),
          numero: numero.trim(),
          complemento: complemento.trim(),
          bairro: bairro.trim(),
          cidade: cidade.trim(),
          estado: uf.trim().toUpperCase(),
        },
        endereco: `${rua.trim()}, ${numero.trim()}${complemento.trim() ? ` - ${complemento.trim()}` : ''} - ${bairro.trim()}, ${cidade.trim()}/${uf.trim().toUpperCase()}`,
        cidade: cidade.trim(),
        estado: uf.trim().toUpperCase(),
        status: 'ATIVO',
        statusAdimplencia: 'ADIMPLENTE',
        statusInscricaoAgo: 'CONFIRMADO',
        dataInscricao: new Date().toISOString(),
      };

      const resultadoId = await salvarPreCadastroNovoMinistro(payload);
      const ministroRealId = resultadoId || ministroId;

      // Disparar Esteira Oficial Asaas POST /api/payment/checkout-ago
      let asaasData: any = {};
      try {
        const resAsaas = await fetch('/api/payment/checkout-ago', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ministroId: ministroRealId,
            cpf: cleanCpf,
            nome: nomeCompleto.trim(),
            email: email.trim().toLowerCase(),
            telefone: whatsapp.trim(),
            cargo: cargoDesejado,
            billingType: formaPagamento,
            installmentCount: formaPagamento === 'CARTAO_CREDITO' ? Math.min(Math.max(parcelasCartao, 1), 2) : 1,
            planoId: planoSelecionado?.id || planoId || 'PLANO_3',
            planoNome: planoSelecionado?.nome || 'Plano de Inscrição AGO',
            valorCustom: planoSelecionado?.valor || 380,
          }),
        });
        const resJson = await resAsaas.json();
        if (resAsaas.ok && resJson.success) {
          asaasData = resJson;
          setAsaasChargeData(resJson);
        }
      } catch (asaasErr) {
        console.warn('Aviso Asaas checkout em Etapa4:', asaasErr);
      }

      const objSalvo = {
        ...payload,
        id: ministroRealId,
        ministroId: ministroRealId,
        ministroNome: nomeCompleto.trim(),
        ministroCpf: aplicarMascaraCpf(cleanCpf),
      };

      if (onCadastroConcluido) {
        onCadastroConcluido(objSalvo, planoSelecionado);
      } else if (onConcluido) {
        onConcluido(objSalvo);
      } else {
        setDadosSalvosSucesso(objSalvo);
      }
    } catch (err: any) {
      console.error('Erro ao salvar cadastro do ministro na AGO:', err);
      setErroForm(err.message || 'Falha ao salvar o cadastro. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  // TELA DE CONCLUSÃO COM CRACHÁ OFICIAL E AÇÕES
  if (dadosSalvosSucesso) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="bg-slate-900 border border-emerald-500/50 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/40 shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-1.5 max-w-lg mx-auto">
            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950 border border-emerald-500/40 px-3 py-1 rounded-full uppercase tracking-wider inline-block">
              CADASTRO MINISTERIAL HOMOLOGADO • AGO 2026
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Inscrição Realizada com Sucesso!
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              O cadastro do ministro <strong className="text-white">{dadosSalvosSucesso.nomeCompleto}</strong> foi gravado no banco oficial com todos os dados estatutários e a taxa vinculada.
            </p>
          </div>

          {/* Resumo da Inscrição */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left font-mono text-xs max-w-md mx-auto space-y-2">
            <div className="flex justify-between text-slate-400">
              <span>Registro Ministerial:</span>
              <strong className="text-emerald-400">{dadosSalvosSucesso.registroMinisterial}</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Modalidade:</span>
              <strong className="text-white">{dadosSalvosSucesso.modalidadeConsagracao}</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Plano Contratado:</span>
              <strong className="text-white">{dadosSalvosSucesso.planoNome}</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Investimento:</span>
              <strong className="text-emerald-400">{formatarMoeda(dadosSalvosSucesso.valor)}</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Forma de Pagamento:</span>
              <strong className="text-slate-200">{dadosSalvosSucesso.formaPagamento}</strong>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <CrachaCredencialAgoModal
              inscricao={dadosSalvosSucesso}
              triggerButtonText="Visualizar Crachá Oficial da Portaria"
            />
            <button
              type="button"
              onClick={() => {
                if (onCadastroConcluido) {
                  onCadastroConcluido(dadosSalvosSucesso, planoSelecionado);
                } else if (onConcluido) {
                  onConcluido(dadosSalvosSucesso);
                } else if (onVoltarBusca) {
                  onVoltarBusca();
                } else if (onVoltar) {
                  onVoltar();
                }
              }}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-mono font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <span>Concluir e Voltar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Topo do Formulário */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest block">
            CONVENÇÃO CIMADEBE • CONCLAVE AGO 2026
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
            <Award className="w-6 h-6 text-emerald-400" />
            <span>Ficha Oficial de Cadastro & Inscrição Ministerial</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Preencha todos os dados exigidos pelo estatuto convencional. Campos obrigatórios possuem bordas sinalizadas.
          </p>
        </div>

        <button
          type="button"
          onClick={onVoltarBusca || onVoltar}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer"
        >
          Voltar
        </button>
      </div>

      {erroForm && (
        <div className="p-4 bg-rose-950/80 border border-rose-500/60 rounded-2xl text-rose-200 text-xs font-mono flex items-center gap-3 shadow-xl">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{erroForm}</span>
        </div>
      )}

      <form onSubmit={lidarComEnvio} className="space-y-6">
        {/* =================================================================== */}
        {/* SEÇÃO 1: MODALIDADE (RECEBIDO / ORDENADO) & SELEÇÃO DE PLANO ADEQUADO */}
        {/* =================================================================== */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Crown className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                1. Modalidade de Consagração & Plano Oficial da AGO
              </h3>
              <span className="text-[11px] text-slate-400">
                Selecione o tipo de ingresso e o plano homologado para o seu cargo.
              </span>
            </div>
          </div>

          {/* A ESCOLHA RECEBIDO E ORDENADO (DE FORMA IDÊNTICA AO ORIGINAL) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              Escolha a Modalidade Ministerial *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* ORDENADO */}
              <div
                onClick={() => setModalidadeConsagracao('ORDENADO')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                  modalidadeConsagracao === 'ORDENADO'
                    ? 'bg-emerald-950/80 border-2 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                    modalidadeConsagracao === 'ORDENADO'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                    <span>ORDENADO</span>
                    {modalidadeConsagracao === 'ORDENADO' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </h4>
                  <span className="text-[11px] text-slate-300 font-sans leading-tight block mt-0.5">
                    Consagração e ordenação ministerial ao presbitério/pastorado na AGO 2026.
                  </span>
                </div>
              </div>

              {/* RECEBIDO */}
              <div
                onClick={() => setModalidadeConsagracao('RECEBIDO')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                  modalidadeConsagracao === 'RECEBIDO'
                    ? 'bg-emerald-950/80 border-2 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                    modalidadeConsagracao === 'RECEBIDO'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                    <span>RECEBIDO</span>
                    {modalidadeConsagracao === 'RECEBIDO' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </h4>
                  <span className="text-[11px] text-slate-300 font-sans leading-tight block mt-0.5">
                    Recepção de ministro já consagrado procedente de outra convenção/ministério.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* SEÇÃO 2: DADOS PESSOAIS & CIVIS (COMPLETO CONFORME EXIGIDO)         */}
        {/* =================================================================== */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-4 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <User className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                2. Dados Pessoais & Civis do Ministro
              </h3>
              <span className="text-[11px] text-slate-400">
                Identificação civil requerida para emissão do Registro Ministerial (RM) e Certificado.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Nome Completo */}
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Nome Completo do Ministro *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Pr. João Pereira dos Santos"
                value={nomeCompleto}
                onChange={(e) => setNomeCompleto(e.target.value)}
                className={getFieldClass(nomeCompleto)}
              />
            </div>

            {/* CPF */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>CPF *</span>
                <span className="text-[10px] text-cyan-400 font-mono flex items-center gap-1">🔒 Bloqueado (Integridade Cadastral)</span>
              </label>
              <input
                type="text"
                required
                readOnly
                disabled
                maxLength={14}
                placeholder="000.000.000-00"
                value={cpf}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700/80 rounded-xl text-slate-400 font-mono text-sm cursor-not-allowed select-none opacity-90 shadow-inner"
              />
            </div>


            {/* Data de Nascimento */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Data de Nascimento *
              </label>
              <input
                type="date"
                required
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                className={getFieldClass(dataNascimento)}
              />
            </div>

            {/* Naturalidade (Estado) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Naturalidade (Estado de Origem)
              </label>
              <select
                value={naturalidade}
                onChange={(e) => setNaturalidade(e.target.value)}
                className={getFieldClass(naturalidade, false)}
              >
                <option value="">-- Selecione o Estado --</option>
                {ESTADOS_BRASIL.map((ufItem) => (
                  <option key={ufItem} value={ufItem}>
                    {ufItem}
                  </option>
                ))}
              </select>
            </div>

            {/* Nacionalidade */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Nacionalidade
              </label>
              <input
                type="text"
                value={nacionalidade}
                onChange={(e) => setNacionalidade(e.target.value)}
                placeholder="Brasileira"
                className={getFieldClass(nacionalidade, false)}
              />
            </div>

            {/* Estado Civil */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Estado Civil *
              </label>
              <select
                value={estadoCivil}
                onChange={(e) => {
                  const val = e.target.value;
                  setEstadoCivil(val);
                  if (val !== 'CASADO' && val !== 'CASADA') {
                    setNomeConjuge('');
                  }
                }}
                className={getFieldClass(estadoCivil)}
              >
                <option value="CASADO">Casado(a)</option>
                <option value="SOLTEIRO">Solteiro(a)</option>
                <option value="VIUVO">Viúvo(a)</option>
                <option value="DIVORCIADO">Divorciado(a)</option>
              </select>
            </div>

            {/* Nome do Cônjuge (se casado) */}
            {(estadoCivil === 'CASADO' || estadoCivil === 'CASADA') && (
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  Nome do Cônjuge (Esposa/Esposo)
                </label>
                <input
                  type="text"
                  placeholder="Nome completo do cônjuge"
                  value={nomeConjuge}
                  onChange={(e) => setNomeConjuge(e.target.value)}
                  className={getFieldClass(nomeConjuge, false)}
                />
              </div>
            )}

            {/* Escolaridade / Formação */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Escolaridade / Formação *
              </label>
              <select
                value={escolaridade}
                onChange={(e) => setEscolaridade(e.target.value)}
                className={getFieldClass(escolaridade)}
              >
                {OPCOES_ESCOLARIDADE_LISTA.map((esc) => (
                  <option key={esc} value={esc}>
                    {esc}
                  </option>
                ))}
              </select>
            </div>

            {/* Profissão Civil */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Profissão Civil *
              </label>
              <select
                value={profissao}
                onChange={(e) => setProfissao(e.target.value)}
                className={getFieldClass(profissao)}
              >
                {PROFISSOES_CIVIS_LISTA.map((prof) => (
                  <option key={prof} value={prof}>
                    {prof}
                  </option>
                ))}
              </select>
              {profissao === 'Outra Profissão' && (
                <input
                  type="text"
                  placeholder="Digite sua profissão civil..."
                  value={profissaoCustom}
                  onChange={(e) => setProfissaoCustom(e.target.value)}
                  className={`mt-1.5 ${getFieldClass(profissaoCustom)}`}
                />
              )}
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* SEÇÃO 3: DADOS ECLESIÁSTICOS & FOTO 3X4                            */}
        {/* =================================================================== */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-4 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                3. Dados Eclesiásticos & Registro Ministerial
              </h3>
              <span className="text-[11px] text-slate-400">
                Informações de consagração e filiação para os livros oficiais da Convenção.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Cargo Eclesiástico Desejado */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Cargo Eclesiástico *
              </label>
              <select
                value={cargoDesejado}
                onChange={(e) => setCargoDesejado(e.target.value)}
                className={getFieldClass(cargoDesejado)}
              >
                {CARGOS_OPCOES.map((cargoItem) => (
                  <option key={cargoItem} value={cargoItem}>
                    {cargoItem}
                  </option>
                ))}
              </select>
            </div>

            {/* Igrejas Filiadas */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Igrejas Filiadas *
              </label>
              <select
                value={igrejaSede}
                onChange={(e) => setIgrejaSede(e.target.value)}
                className={getFieldClass(igrejaSede)}
              >
                <option value="">Selecione a Igreja Filiada...</option>
                {igrejasFiliadas.map((ig) => {
                  const nomeIgreja = ig.nomeFantasia || ig.razaoSocial || 'Igreja Filiada';
                  const local = ig.municipio ? ` (${ig.municipio}/${ig.uf})` : '';
                  const labelCompleto = `${nomeIgreja}${local}`;
                  return (
                    <option key={ig.id} value={labelCompleto}>
                      {labelCompleto}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Data da Consagração */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Data da Consagração / Ordenação
              </label>
              <input
                type="date"
                value={dataConsagracao}
                onChange={(e) => setDataConsagracao(e.target.value)}
                className={getFieldClass(dataConsagracao, false)}
              />
            </div>

            {/* Pastor Consagrante */}
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Pastor Consagrante / Responsável
              </label>
              <input
                type="text"
                placeholder="Ex: Pr. Presidente José da Silva"
                value={pastorConsagrante}
                onChange={(e) => setPastorConsagrante(e.target.value)}
                className={getFieldClass(pastorConsagrante, false)}
              />
            </div>

            {/* Foto Oficial 3x4 */}
            <div className="sm:col-span-2 p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Foto Oficial do Ministro (3x4 para Credencial)</span>
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Preview */}
                <div className="relative shrink-0">
                  {fotoUrl ? (
                    <img
                      src={fotoUrl}
                      alt="Prévia da Foto"
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-500 shadow-md bg-slate-900"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-slate-900 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500">
                      <User className="w-8 h-8" />
                      <span className="text-[9px] font-mono mt-0.5">Sem Foto</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition border border-slate-700 shadow-md">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span>Selecionar Foto 3x4 do Computador/Celular</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={lidarComFotoUpload}
                    />
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Formatos suportados: JPG, PNG. A foto será impressa na Credencial e Crachá da Portaria.
                  </p>
                </div>
              </div>
            </div>

            {/* SEÇÃO DE UPLOAD DE DOCUMENTOS COMPROBATÓRIOS */}
            <div className="sm:col-span-2 p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-cyan-400 flex items-center gap-2 uppercase font-mono">
                  <Paperclip className="w-4 h-4" />
                  <span>Upload de Documentos Comprobatórios (RG, CNH, CPF, Atas)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {documentosAnexos.length} documento(s) anexado(s)
                </span>
              </div>

              {erroUploadDoc && (
                <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs font-mono">
                  {erroUploadDoc}
                </div>
              )}

              {/* Controles de Anexo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <select
                  value={novoDocTipo}
                  onChange={(e: any) => setNovoDocTipo(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white text-xs font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="RG_CNH">RG ou CNH</option>
                  <option value="CPF">Comprovante de CPF</option>
                  <option value="CERTIFICADO_CONSAGRACAO">Certificado / Ata de Consagração</option>
                  <option value="COMPROVANTE_RESIDENCIA">Comprovante de Residência</option>
                  <option value="CERTIDAO_CASAMENTO">Certidão de Casamento / Nascimento</option>
                  <option value="OUTROS">Diploma Teológico / Outros</option>
                </select>

                <input
                  type="text"
                  value={novoDocNomeCustom}
                  onChange={(e) => setNovoDocNomeCustom(e.target.value)}
                  placeholder="Descrição do arquivo (opcional)"
                  className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white text-xs font-sans focus:outline-none focus:border-cyan-500"
                />

                <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold cursor-pointer transition shadow-sm">
                  <Upload className="w-4 h-4" />
                  <span>Anexar Documento</span>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={lidarComUploadDocumento}
                  />
                </label>
              </div>

              {/* Lista dos Documentos Anexados */}
              {documentosAnexos.length > 0 ? (
                <div className="space-y-2 pt-1">
                  {documentosAnexos.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Paperclip className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="font-bold text-white truncate">{doc.nome}</span>
                        <span className="text-[10px] text-slate-400 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {doc.tipo}
                        </span>
                        {doc.tamanho && (
                          <span className="text-[10px] text-slate-500 font-mono">• {doc.tamanho}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removerDocumentoAnexo(doc.id)}
                        className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-950/40 transition cursor-pointer"
                        title="Remover documento"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 font-mono italic">
                  Nenhum documento complementar anexado ainda. Anexe seus documentos civis e ministeriais acima.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* SEÇÃO 4: ENDEREÇO RESIDENCIAL COMPLETO & CONTATO                    */}
        {/* =================================================================== */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-4 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <MapPin className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                4. Endereço Residencial Completo & Contato
              </h3>
              <span className="text-[11px] text-slate-400">
                Endereço para remessa da credencial física e correspondências institucionais.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* E-mail */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                E-mail Oficial *
              </label>
              <input
                type="email"
                required
                placeholder="ministro@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={getFieldClass(email)}
              />
            </div>

            {/* WhatsApp / Telefone */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                WhatsApp / Telefone *
              </label>
              <input
                type="text"
                required
                placeholder="(00) 00000-0000"
                value={whatsapp}
                onChange={(e) => setWhatsapp(aplicarMascaraTelefone(e.target.value))}
                className={getFieldClass(whatsapp)}
              />
            </div>

            {/* CEP com Busca Automática */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 block">
                  CEP *
                </label>
                <button
                  type="button"
                  onClick={() => executarBuscaCep(cep)}
                  disabled={buscandoCep}
                  className="text-[10px] font-mono text-emerald-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  {buscandoCep ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                  <span>{buscandoCep ? 'Buscando...' : 'Buscar CEP'}</span>
                </button>
              </div>
              <input
                type="text"
                required
                maxLength={9}
                placeholder="00000-000"
                value={cep}
                onChange={(e) => {
                  const formatado = aplicarMascaraCep(e.target.value);
                  setCep(formatado);
                  if (formatado.replace(/\D/g, '').length === 8) {
                    executarBuscaCep(formatado);
                  }
                }}
                className={getFieldClass(cep)}
              />
            </div>

            {/* Estado (UF) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Estado (UF) *
              </label>
              <select
                value={uf}
                onChange={(e) => setUf(e.target.value.toUpperCase())}
                className={getFieldClass(uf)}
              >
                {ESTADOS_BRASIL.map((sigla) => (
                  <option key={sigla} value={sigla}>
                    {sigla}
                  </option>
                ))}
              </select>
            </div>

            {/* Cidade */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Cidade *
              </label>
              <input
                type="text"
                required
                placeholder="Informe a cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className={getFieldClass(cidade)}
              />
            </div>

            {/* Bairro */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Bairro *
              </label>
              <input
                type="text"
                required
                placeholder="Informe o bairro"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                className={getFieldClass(bairro)}
              />
            </div>

            {/* Rua / Logradouro */}
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Logradouro / Rua *
              </label>
              <input
                type="text"
                required
                placeholder="Avenida, Rua ou Estrada"
                value={rua}
                onChange={(e) => setRua(e.target.value)}
                className={getFieldClass(rua)}
              />
            </div>

            {/* Número e Complemento */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Número *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: 123 ou S/N"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className={getFieldClass(numero)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Complemento
              </label>
              <input
                type="text"
                placeholder="Apto, Bloco, Casa 2"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                className={getFieldClass(complemento, false)}
              />
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* BARRA DE AÇÃO INFERIOR & SUBMISSÃO DO CADASTRO                       */}
        {/* =================================================================== */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="text-center sm:text-left">
            <span className="text-[10px] font-mono text-slate-400 uppercase block">
              PLANO ESCOLHIDO:
            </span>
            <span className="text-lg font-mono font-black text-emerald-400 tracking-tight">
              {planoSelecionado?.nome || 'Plano AGO'} ({formatarMoeda(planoSelecionado?.valor || 380)})
            </span>
            <span className="text-[11px] text-slate-400 font-sans block">
              Modalidade: <strong>{modalidadeConsagracao}</strong> • Próxima etapa: Pagamento Seguro Asaas
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onVoltarBusca || onVoltar}
              className="w-full sm:w-auto px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={enviando}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-mono font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {enviando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando no Banco...</span>
                </>
              ) : (
                <>
                  <span>Pagamento</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default Etapa4NovoCadastroAgo;
