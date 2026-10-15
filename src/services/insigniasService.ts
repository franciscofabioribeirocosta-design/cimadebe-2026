/**
 * Serviço de Insígnias e Evolução Eclesiástica Ministerial
 * CIMADEBE / SIGM - Sistema Integrado de Governança e Ministros
 * Edição de Pedras Preciosas & Joalheria Sacra 3D
 */

import { Ministro } from '../types';

export interface InsigniaOrdenacao {
  readonly id: string;
  readonly nivel: number;
  readonly cargo: string;
  readonly titulo: string;
  readonly subtitulo: string;
  readonly pedraPreciosa: string;
  readonly lapidacao: string;
  readonly versiculoChave: string;
  readonly referenciaBiblica: string;
  readonly corPrimaria: string;
  readonly corSecundaria: string;
  readonly corGlow: string;
  readonly badgeBg: string;
  readonly iconeSimbolo: string;
  readonly prerrogativas: readonly string[];
  readonly grauAutoridade: string;
  readonly descricaoSimbolica: string;
}

export const TODAS_INSIGNIAS: readonly InsigniaOrdenacao[] = Object.freeze([
  {
    id: 'cooperador',
    nivel: 1,
    cargo: 'Cooperador',
    titulo: 'Insígnia de Safira Celeste & Altar',
    subtitulo: 'Consagrado ao Serviço do Altar & Apoio Litúrgico',
    pedraPreciosa: 'Safira Azul Celeste & Zircônia Diamantada',
    lapidacao: 'Lapidação Escudo Tridimensional (Trilliant Cut)',
    versiculoChave: '"Porque os que servirem bem como diáconos adquirirão para si uma boa posição..."',
    referenciaBiblica: '1 Timóteo 3:13',
    corPrimaria: '#38bdf8', // Cyan / Sapphire
    corSecundaria: '#0284c7',
    corGlow: 'rgba(56, 189, 248, 0.45)',
    badgeBg: 'from-sky-950/90 via-slate-900/90 to-slate-950',
    iconeSimbolo: '💎',
    grauAutoridade: 'Nível I • Auxiliar da Casa do Senhor',
    prerrogativas: [
      'Auxílio direto nos serviços litúrgicos e celebrações',
      'Atuação na recepção, ordem e acolhimento do rebanho',
      'Participação ativa nas vigílias e frentes de oração',
      'Acesso ao prontuário eclesiástico digital'
    ],
    descricaoSimbolica: 'A Safira Celeste representa a firmeza no trono de Deus, a pureza do serviço inicial e a consagração no altar.'
  },
  {
    id: 'diacono',
    nivel: 2,
    cargo: 'Diácono',
    titulo: 'Insígnia de Topázio Imperial & Água-Marinha',
    subtitulo: 'Ordenado para a Diaconia, Ação Social & Mesa da Ceia',
    pedraPreciosa: 'Topázio Dourado Imperial & Água-Marinha Ceilão',
    lapidacao: 'Lapidação Almofada (Cushion Cut) com Facetas Cristalinas',
    versiculoChave: '"Escolhei, pois, irmãos, dentre vós, sete homens de boa reputação, cheios do Espírito Santo e de sabedoria..."',
    referenciaBiblica: 'Atos 6:3',
    corPrimaria: '#06b6d4', // Cyan / Topaz
    corSecundaria: '#0891b2',
    corGlow: 'rgba(6, 182, 212, 0.45)',
    badgeBg: 'from-cyan-950/90 via-slate-900/90 to-slate-950',
    iconeSimbolo: '💎',
    grauAutoridade: 'Nível II • Oficial da Diaconia e Socorro',
    prerrogativas: [
      'Serviço oficial da Santa Ceia do Senhor e Batismos',
      'Gestão e socorro na beneficência social eclesiástica',
      'Zelo do templo e do patrimônio convencional',
      'Voz consultiva nas reuniões ministeriais locais'
    ],
    descricaoSimbolica: 'O Topázio Imperial dourado e a Água-Marinha expressam a misericórdia pura, o serviço da comunhão e a dignidade diaconal.'
  },
  {
    id: 'presbitero',
    nivel: 3,
    cargo: 'Presbítero',
    titulo: 'Insígnia de Esmeralda Nobre de Judá',
    subtitulo: 'Consagrado para a Doutrinação, Unção dos Enfermos & Governo Local',
    pedraPreciosa: 'Esmeralda Nobre Colombiana & Chamas de Diamante',
    lapidacao: 'Lapidação Esmeralda Octogonal em Degraus (Emerald Step Cut)',
    versiculoChave: '"Os presbíteros que governam bem sejam tidos por dignos de duplicada honra, especialmente os que trabalham na palavra e na doutrina."',
    referenciaBiblica: '1 Timóteo 5:17',
    corPrimaria: '#10b981', // Esmeralda
    corSecundaria: '#059669',
    corGlow: 'rgba(16, 185, 129, 0.5)',
    badgeBg: 'from-emerald-950/90 via-slate-900/90 to-slate-950',
    iconeSimbolo: '💎',
    grauAutoridade: 'Nível III • Magistério Eclesiástico & Unção',
    prerrogativas: [
      'Ministração de unção aos enfermos e imposição de mãos',
      'Dirigência e pastoreio de congregações filiadas',
      'Ensino da sã doutrina bíblica e celebração de ordenanças',
      'Voto e voz deliberativa nas assembleias da convenção'
    ],
    descricaoSimbolica: 'A Esmeralda Nobre simboliza a vida eterna, o azeite da unção e o vigor perpétuo do ensino da Palavra de Deus.'
  },
  {
    id: 'evangelista',
    nivel: 4,
    cargo: 'Evangelista',
    titulo: 'Insígnia de Ametista Real & Jaspe de Fogo',
    subtitulo: 'Ordenado para Missões Globais, Cruzadas & Plantação de Igrejas',
    pedraPreciosa: 'Ametista Real Sagrada & Jaspe Carmesim Pentecostal',
    lapidacao: 'Lapidação Marquise Côncava & Prisma de Fogo',
    versiculoChave: '"Tu, porém, sê sóbrio em tudo, sofre as aflições, faze a obra de um evangelista, cumpre o teu ministério."',
    referenciaBiblica: '2 Timóteo 4:5',
    corPrimaria: '#a855f7', // Púrpura Ametista
    corSecundaria: '#7e22ce',
    corGlow: 'rgba(168, 85, 247, 0.5)',
    badgeBg: 'from-purple-950/90 via-slate-900/90 to-slate-950',
    iconeSimbolo: '💎',
    grauAutoridade: 'Nível IV • Arauto de Missões & Expansão',
    prerrogativas: [
      'Liderança de cruzadas evangelísticas e frentes missionárias',
      'Abertura e plantação de novos templos e campos',
      'Conferencista oficial nos eventos e congressos convencionais',
      'Direito estatutário pleno na Assembleia Geral Ordinária'
    ],
    descricaoSimbolica: 'A Ametista Real reflete o sacerdócio do mensageiro e o fogo da graça que incendeia as nações com as Boas Novas.'
  },
  {
    id: 'pastor',
    nivel: 5,
    cargo: 'Pastor',
    titulo: 'Insígnia de Diamante Brilhante & Rubi Real',
    subtitulo: 'Ordenação Plena • Governo, Apascentamento & Aliança Sacerdotal',
    pedraPreciosa: 'Diamante Lapidação Brilhante 58 Facetas & Rubis Sangue-de-Pombo',
    lapidacao: 'Lapidação Brilhante Clássica Solitária (Brilliant Round Cut) com Cravação em Ouro 24k',
    versiculoChave: '"Apascentai o rebanho de Deus que está entre vós, tendo cuidado dele, não por força, mas voluntariamente segundo Deus..."',
    referenciaBiblica: '1 Pedro 5:2',
    corPrimaria: '#f59e0b', // Ouro Solar / Âmbar Diamante
    corSecundaria: '#d97706',
    corGlow: 'rgba(245, 158, 11, 0.55)',
    badgeBg: 'from-amber-950/90 via-slate-900/90 to-slate-950',
    iconeSimbolo: '💎',
    grauAutoridade: 'Nível V • Sumo Ministério Pastoral Pleno',
    prerrogativas: [
      'Presidência de campos eclesiásticos e conselhos de ministros',
      'Ordenação e unção de novos obreiros e oficiais',
      'Celebração de casamentos, consagrações e todos os atos litúrgicos',
      'Elegibilidade para cargos executivos na Mesa Diretora',
      'Delegado nato com direito a voto com peso estatutário na AGO'
    ],
    descricaoSimbolica: 'O Diamante Lapidado com a Coroa de Rubis representa a pureza inquebrantável do governo pastoral, a autoridade e o amor do Supremo Pastor.'
  },
  {
    id: 'presidente',
    nivel: 6,
    cargo: 'Bispo / Presidente',
    titulo: 'Insígnia Patriarcal de Ônix Real & 12 Gemas da Nova Jerusalém',
    subtitulo: 'Presidência Geral, Chave Patriarcal & Governança Continental',
    pedraPreciosa: 'Diamante Negro Ônix Imperial & Pectoral das 12 Pedras Preciosas',
    lapidacao: 'Lapidação Imperial Multifacetada com Engaste em Platina Pura',
    versiculoChave: '"Aquele que é fiel no pouco sobre o muito será colocado..."',
    referenciaBiblica: 'Mateus 25:21',
    corPrimaria: '#38bdf8', // Platina Diamante
    corSecundaria: '#e0e7ff',
    corGlow: 'rgba(224, 231, 255, 0.65)',
    badgeBg: 'from-indigo-950/90 via-slate-900/90 to-slate-950',
    iconeSimbolo: '💎',
    grauAutoridade: 'Nível VI • Alta Magistratura Convencional',
    prerrogativas: [
      'Presidência Geral da Convenção Estadual e Interestadual',
      'Homologação de credenciais e decretos convencionais',
      'Assinatura e selo em todos os diplomas e registros da CIMADEBE / SIGM',
      'Representação solene perante poderes públicos e organismos mundiais'
    ],
    descricaoSimbolica: 'O Ônix Imperial e as doze pedras do peitoral sacerdotal condensam a plenitude da alta magistratura e governança convencional.'
  }
]);

export function extrairNivelMinistro(cargo?: string): number {
  if (!cargo) return 1;
  const c = cargo.toLowerCase().trim();
  if (c.includes('presidente') || c.includes('bispo')) return 6;
  if (c.includes('pastor') || c.includes('pastora')) return 5;
  if (c.includes('evangelista') || c.includes('missionária') || c.includes('missionario')) return 4;
  if (c.includes('presbítero') || c.includes('presbitero')) return 3;
  if (c.includes('diácono') || c.includes('diacono')) return 2;
  return 1;
}

export interface HistoricoInsigniaMinistro {
  readonly insignia: InsigniaOrdenacao;
  readonly desbloqueada: boolean;
  readonly dataConsagracao?: string;
  readonly ataNumero?: string;
}

export function montarHistoricoInsignias(ministro: Ministro): readonly HistoricoInsigniaMinistro[] {
  const nivelAtual = extrairNivelMinistro(ministro.cargo);
  const dataOrdenacaoBase = ministro.dataConsagracao || '2016-09-26';
  const anoBase = new Date(dataOrdenacaoBase).getFullYear() || 2016;

  return TODAS_INSIGNIAS.map((insignia) => {
    const desbloqueada = insignia.nivel <= nivelAtual;
    const anoEstimado = Math.max(anoBase - (nivelAtual - insignia.nivel) * 3, 2005);
    const dataEstimada = `${anoEstimado}-06-15`;

    return {
      insignia,
      desbloqueada,
      dataConsagracao: desbloqueada ? (insignia.nivel === nivelAtual ? dataOrdenacaoBase : dataEstimada) : undefined,
      ataNumero: desbloqueada ? `ATA-${anoEstimado}-${100 + insignia.nivel * 42}` : undefined,
    };
  });
}
