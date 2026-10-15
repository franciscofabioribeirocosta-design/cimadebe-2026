/**
 * Serviço de Integração Web Push API para Notificações e Alertas de Vencimento de Anuidades
 * CIMADEBE / SIGM - Convenção de Ministros
 * 
 * Segue o Protocolo de Segurança Zero-Trust & Execução Determinística:
 * - Camada 1: Validação Estrita de Parâmetros de Entrada
 * - Camada 2: Proteção de Leitura e Gravação Atômica
 * - Camada 3: Desacoplamento e Fallbacks Seguros
 * - Camada 4: Emissão Estática e Determinística
 */

import { Firestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { AnuidadeMinistro, Ministro } from '../types';
import { avaliarStatusCobranca, formatarDataBR, calcularDiferencaDias } from '../financialEngine';

export interface PushNotificationPayload {
  readonly title: string;
  readonly body: string;
  readonly icon?: string;
  readonly badge?: string;
  readonly tag?: string;
  readonly url?: string;
  readonly data?: Record<string, unknown>;
}

export interface ResultadoAlertaVencimento {
  readonly ministroId: string;
  readonly ministroNome: string;
  readonly anuidadeId: string;
  readonly anoVigente: number;
  readonly dataVencimento: string;
  readonly diasParaVencer: number;
  readonly statusCobranca: string;
  readonly valor: number;
  readonly mensagemEnviada: string;
  readonly sucesso: boolean;
}

export interface ResultadoCampanhaPush {
  readonly totalAnalisados: number;
  readonly totalNotificados: number;
  readonly totalEmAtraso: number;
  readonly totalPendentes30Dias: number;
  readonly detalhes: readonly ResultadoAlertaVencimento[];
}

/**
 * Verifica se o navegador atual suporta a Web Push API e Service Workers
 */
export function isWebPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && 'serviceWorker' in navigator;
}

/**
 * Retorna o status atual da permissão de notificação push
 */
export function obterStatusPermissaoPush(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (!isWebPushSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Registra o Service Worker do aplicativo se ainda não estiver registrado
 */
export async function registrarServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isWebPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    return registration;
  } catch (err) {
    console.warn('[WebPush] Falha ao registrar Service Worker /sw.js:', err);
    return null;
  }
}

/**
 * Solicita formalmente permissão do usuário para receber notificações Web Push
 */
export async function solicitarPermissaoWebPush(): Promise<{
  success: boolean;
  status: 'granted' | 'denied' | 'default' | 'unsupported';
  error?: string;
}> {
  if (!isWebPushSupported()) {
    return {
      success: false,
      status: 'unsupported',
      error: 'Seu navegador atual não suporta a Web Push API.'
    };
  }

  try {
    // 1. Registra o Service Worker
    await registrarServiceWorker();

    // 2. Solicita a permissão nativa do navegador
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      return { success: true, status: 'granted' };
    } else if (permission === 'denied') {
      return {
        success: false,
        status: 'denied',
        error: 'Permissão de notificações foi bloqueada no navegador. Permita nas configurações do site.'
      };
    } else {
      return {
        success: false,
        status: 'default',
        error: 'Solicitação de permissão de notificações dispensada.'
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      status: 'denied',
      error: `Erro ao solicitar permissão de notificações: ${msg}`
    };
  }
}

/**
 * Dispara uma notificação Push local através do Service Worker ativo (ou Notification API como fallback)
 */
export async function dispararNotificacaoPush(payload: PushNotificationPayload): Promise<boolean> {
  if (!isWebPushSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  const { title, body, icon = '/icon-192.png', badge = '/badge-72.png', tag = 'sigm-push', url = '/', data = {} } = payload;
  const tipo = (data as any)?.tipo || '';

  let actions: any[] = [
    { action: 'abrir', title: '🔍 Ver Detalhes' },
    { action: 'fechar', title: '✖ Fechar' }
  ];

  if (tipo === 'noticia') {
    actions = [
      { action: 'abrir_noticia', title: '📖 Ler Notícia' },
      { action: 'fechar', title: '✖ Fechar' }
    ];
  } else if (tipo === 'ago_convocacao') {
    actions = [
      { action: 'abrir_ago', title: '🗳️ Ver Convocação & Inscrever-se' },
      { action: 'fechar', title: '✖ Fechar' }
    ];
  } else if (tipo === 'anuidade') {
    actions = [
      { action: 'pagar', title: '💳 Regularizar Anuidade' },
      { action: 'fechar', title: '✖ Fechar' }
    ];
  }

  try {
    let registration = await navigator.serviceWorker?.getRegistration();
    if (!registration) {
      registration = (await registrarServiceWorker()) || undefined;
    }

    if (registration && (registration.active || registration.installing || registration.waiting)) {
      // Método padrão via Service Worker
      const options: any = {
        body,
        icon,
        badge,
        tag,
        renotify: true,
        data: { ...data, url, tipo },
        actions
      };
      await registration.showNotification(title, options);
      return true;
    } else {
      // Fallback direto via Notification API se o SW ainda estiver inicializando
      const notif = new Notification(title, {
        body,
        icon,
        tag,
        data: { ...data, url, tipo }
      });
      notif.onclick = () => {
        window.focus();
        if (url && typeof window !== 'undefined') {
          window.location.href = url;
        }
        notif.close();
      };
      return true;
    }
  } catch (err) {
    console.warn('[WebPush] Falha ao emitir notificação push via Service Worker:', err);
    return false;
  }
}

/**
 * Emite notificação push via Service Worker para nova notícia ou comunicado publicado
 */
export async function dispararNotificacaoNovaNoticia({
  titulo,
  subtitulo,
  id,
  categoria,
  autor
}: {
  titulo: string;
  subtitulo?: string;
  id?: string;
  categoria?: string;
  autor?: string;
}): Promise<boolean> {
  if (!titulo) return false;
  const corpo = subtitulo && subtitulo.trim().length > 0
    ? `${subtitulo.slice(0, 150)}`
    : `Um novo comunicado oficial foi publicado pela Secretaria Geral da Convenção. Clique para ler na íntegra.`;

  return dispararNotificacaoPush({
    title: `📰 Comunicado Oficial: ${titulo.slice(0, 48)}`,
    body: corpo,
    tag: `noticia-${id || Date.now()}`,
    url: `/?tab=noticias`,
    data: {
      tipo: 'noticia',
      noticiaId: id,
      categoria: categoria || 'Comunicado Oficial',
      autor: autor || 'Mesa Diretora'
    }
  });
}

/**
 * Emite notificação push via Service Worker para nova convocação ou edital da AGO publicado
 */
export async function dispararNotificacaoConvocacaoAgo({
  titulo,
  subtitulo,
  local,
  periodo,
  id,
  temaBiblico
}: {
  titulo: string;
  subtitulo?: string;
  local?: string;
  periodo?: string;
  id?: string;
  temaBiblico?: string;
}): Promise<boolean> {
  if (!titulo) return false;
  const partesCorpo = [
    subtitulo ? subtitulo : 'Convocação oficial da Mesa Diretora para todos os ministros e delegados convencionais.',
    periodo ? `📅 Período: ${periodo}` : '',
    local ? `📍 Local: ${local}` : '',
    temaBiblico ? `📖 Tema: ${temaBiblico}` : ''
  ].filter(Boolean);

  return dispararNotificacaoPush({
    title: `🏛️ Convocação Oficial AGO: ${titulo.slice(0, 42)}`,
    body: partesCorpo.join('\n'),
    tag: `ago-convocacao-${id || Date.now()}`,
    url: `/?tab=ago`,
    data: {
      tipo: 'ago_convocacao',
      eventoId: id,
      local,
      temaBiblico
    }
  });
}

/**
 * Dispara notificação push específica de alerta de vencimento para o ministro
 */
export async function dispararAlertaVencimentoAnuidade({
  ministroNome,
  anoVigente,
  dataVencimento,
  valor,
  statusCalculado
}: {
  ministroNome: string;
  anoVigente: number;
  dataVencimento: string;
  valor: number;
  statusCalculado?: string;
}): Promise<boolean> {
  if (!ministroNome || !dataVencimento || !anoVigente) return false;

  const hojeIso = new Date().toISOString().split('T')[0];
  const dias = calcularDiferencaDias(dataVencimento, hojeIso);
  const dataFormatada = formatarDataBR(dataVencimento);
  const valorFormatado = `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;

  let titulo = `📢 SIGM - Anuidade Ministerial ${anoVigente}`;
  let mensagem = '';
  let tag = `anuidade-${anoVigente}`;

  if (statusCalculado === 'EM_ATRASO' || dias < 0) {
    const diasAtraso = Math.abs(dias);
    titulo = `⚠️ SIGM - Anuidade ${anoVigente} em Atraso`;
    mensagem = `Prezado(a) ${ministroNome}, sua anuidade ${anoVigente} (${valorFormatado}) venceu em ${dataFormatada} (${diasAtraso} ${diasAtraso === 1 ? 'dia' : 'dias'} de atraso). Regularize para manter sua credencial ativa.`;
    tag = `anuidade-atraso-${anoVigente}`;
  } else if (dias === 0) {
    titulo = `🔔 SIGM - Vencimento Hoje: Anuidade ${anoVigente}`;
    mensagem = `Prezado(a) ${ministroNome}, sua anuidade ministerial ${anoVigente} (${valorFormatado}) vence hoje (${dataFormatada}). Pague via Pix ou Cartão em até 2x.`;
    tag = `anuidade-hoje-${anoVigente}`;
  } else if (dias <= 30) {
    titulo = `📅 SIGM - Vencimento em ${dias} ${dias === 1 ? 'dia' : 'dias'}: Anuidade ${anoVigente}`;
    mensagem = `Prezado(a) ${ministroNome}, lembramos que sua anuidade ${anoVigente} (${valorFormatado}) vence em ${dataFormatada} (restam ${dias} dias). Garanta sua adimplência.`;
    tag = `anuidade-pendente-${anoVigente}`;
  } else {
    mensagem = `Olá ${ministroNome}, sua anuidade ${anoVigente} no valor de ${valorFormatado} tem vencimento programado para ${dataFormatada}.`;
  }

  return dispararNotificacaoPush({
    title: titulo,
    body: mensagem,
    tag,
    url: '/?tab=anuidade',
    data: {
      anoVigente,
      dataVencimento,
      valor,
      ministroNome
    }
  });
}

/**
 * Salva a preferência de push do ministro no Firestore com validação estrita (Layer 1 & 2)
 */
export async function salvarPreferenciaPushMinistro(
  db: Firestore,
  ministroId: string,
  ativo: boolean
): Promise<boolean> {
  if (!db || !ministroId || typeof ministroId !== 'string' || ministroId.trim().length === 0) {
    return false;
  }

  try {
    const minRef = doc(db, 'ministros', ministroId);
    await updateDoc(minRef, {
      notificacoesPushAtivas: Boolean(ativo),
      ultimaAtualizacaoPush: serverTimestamp()
    });
    return true;
  } catch (err) {
    console.warn('[WebPush] Falha ao persistir preferência push no Firestore:', err);
    return false;
  }
}

/**
 * Motor de análise e envio de alertas em lote para o Painel Administrativo
 */
export function analisarCampanhaPushVencimento(
  ministros: readonly Ministro[],
  anuidades: readonly AnuidadeMinistro[]
): ResultadoCampanhaPush {
  // Layer 1 Validation
  if (!Array.isArray(ministros) || !Array.isArray(anuidades)) {
    return {
      totalAnalisados: 0,
      totalNotificados: 0,
      totalEmAtraso: 0,
      totalPendentes30Dias: 0,
      detalhes: []
    };
  }

  const ministrosMap = new Map<string, Ministro>();
  for (const m of ministros) {
    if (m && m.id) {
      ministrosMap.set(m.id, m);
    }
  }

  const detalhes: ResultadoAlertaVencimento[] = [];
  let totalEmAtraso = 0;
  let totalPendentes30Dias = 0;

  for (const anuidade of anuidades) {
    if (!anuidade || !anuidade.ministroId) continue;
    if (anuidade.statusPagamento === 'PAGO' || anuidade.statusPagamento === 'ANISTIADO') continue;

    const ministro = ministrosMap.get(anuidade.ministroId);
    if (!ministro) continue;

    // Regras de Isenção
    if (ministro.statusPrivilegio === 'ISENTO' || ministro.statusPrivilegio === 'JUBILADO') continue;

    const stCobranca = avaliarStatusCobranca(anuidade);
    const hojeIso = new Date().toISOString().split('T')[0];
    const dias = calcularDiferencaDias(anuidade.dataVencimento, hojeIso);
    const dataBR = formatarDataBR(anuidade.dataVencimento);
    const valorFmt = `R$ ${Number(anuidade.valor || 0).toFixed(2).replace('.', ',')}`;

    if (stCobranca === 'EM_ATRASO' || dias < 0) {
      totalEmAtraso++;
      const diasAtraso = Math.abs(dias);
      detalhes.push({
        ministroId: ministro.id,
        ministroNome: ministro.nome,
        anuidadeId: anuidade.id,
        anoVigente: anuidade.anoVigente,
        dataVencimento: anuidade.dataVencimento,
        diasParaVencer: dias,
        statusCobranca: 'EM_ATRASO',
        valor: anuidade.valor,
        mensagemEnviada: `⚠️ Alerta de Atraso (${diasAtraso}d): Anuidade ${anuidade.anoVigente} vencida em ${dataBR} (${valorFmt})`,
        sucesso: true
      });
    } else if (dias >= 0 && dias <= 30 && (anuidade.statusPagamento || '').toUpperCase() !== 'PAGO') {
      totalPendentes30Dias++;
      detalhes.push({
        ministroId: ministro.id,
        ministroNome: ministro.nome,
        anuidadeId: anuidade.id,
        anoVigente: anuidade.anoVigente,
        dataVencimento: anuidade.dataVencimento,
        diasParaVencer: dias,
        statusCobranca: 'PENDENTE',
        valor: anuidade.valor,
        mensagemEnviada: `🔔 Alerta Preventivo (restam ${dias}d): Anuidade ${anuidade.anoVigente} vence em ${dataBR} (${valorFmt})`,
        sucesso: true
      });
    }
  }

  return {
    totalAnalisados: ministros.length,
    totalNotificados: detalhes.length,
    totalEmAtraso,
    totalPendentes30Dias,
    detalhes
  };
}
