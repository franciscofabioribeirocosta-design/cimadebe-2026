import { Request, Response, NextFunction } from 'express';

/**
 * [DISJUNTOR DE REQUISIÇÕES E TELEMETRIA EM MEMÓRIA RAM - ZERO-TRUST]
 * Governança estrita contra loops de rede, ataques de força bruta e estouro de cotas.
 * Opera 100% em memória RAM volátil sem nenhuma dependência externa ou leituras no Firestore.
 */

interface RegistroAcesso {
  count: number;
  primeiroAcesso: number;
}

// Armazenamento em memória RAM estrita: Map<chave, RegistroAcesso>
const mapaRequisicoes = new Map<string, RegistroAcesso>();

// JANELA DE CONTROLE: 10 Segundos (10 * 1000 ms)
const JANELA_MS = 10 * 1000;

// LIMITE POR ORIGEM: Máximo de 15 requisições por IP / Rota dentro da janela de 10s
const LIMITE_MAXIMO_REQUISICOES = 15;

/**
 * Middleware Express: Disjuntor de Proteção de Cota e Prevenção de Loops
 */
export function interceptadorProtecaoCota(req: Request, res: Response, next: NextFunction) {
  const agora = Date.now();

  // Rastreamento em tempo real para o Super Master (com reset automático à meia-noite)
  try {
    if (!global.requestMetricsRegistry) {
      global.requestMetricsRegistry = {
        totalRequestsToday: 0,
        lastResetDate: new Date().toDateString(),
        endpointsCount: {},
        requestsLog: []
      };
    }
    const todayStr = new Date().toDateString();
    if (global.requestMetricsRegistry.lastResetDate !== todayStr) {
      global.requestMetricsRegistry.totalRequestsToday = 0;
      global.requestMetricsRegistry.lastResetDate = todayStr;
      global.requestMetricsRegistry.endpointsCount = {};
      global.requestMetricsRegistry.requestsLog = [];
    }
    global.requestMetricsRegistry.totalRequestsToday += 1;
    const cleanPath = req.path || req.originalUrl?.split('?')[0] || '/api';
    global.requestMetricsRegistry.endpointsCount[cleanPath] = (global.requestMetricsRegistry.endpointsCount[cleanPath] || 0) + 1;
  } catch {}

  // 1. Extração determinística do IP de origem (respeitando proxy reverso Cloud Run)
  const forwardedFor = req.headers['x-forwarded-for'];
  const ipCliente = (typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : null)
    || req.ip
    || req.socket.remoteAddress
    || '0.0.0.0';

  // 2. Extração determinística da rota/recurso alvo
  const rotaAlvo = req.originalUrl || req.baseUrl || req.path || '/api';

  // Chave única de rastreamento no disjuntor: IP + Rota
  const chaveRastreamento = `${ipCliente}::${rotaAlvo}`;

  // Purga estática de chaves expiradas para preservação da memória RAM
  if (mapaRequisicoes.size > 1500) {
    for (const [chave, registro] of mapaRequisicoes.entries()) {
      if (agora - registro.primeiroAcesso > JANELA_MS) {
        mapaRequisicoes.delete(chave);
      }
    }
  }

  const registroAtual = mapaRequisicoes.get(chaveRastreamento);

  if (!registroAtual) {
    // Primeiro acesso dentro de uma nova janela
    mapaRequisicoes.set(chaveRastreamento, {
      count: 1,
      primeiroAcesso: agora,
    });
    return next();
  }

  // Verifica se a janela de 10 segundos já expirou
  if (agora - registroAtual.primeiroAcesso > JANELA_MS) {
    // Reset da janela de controle
    registroAtual.count = 1;
    registroAtual.primeiroAcesso = agora;
    return next();
  }

  // Incrementa a contagem de requisições na janela ativa
  registroAtual.count += 1;

  // CORTE IMEDIATO (FAIL-FAST GATE): Se ultrapassar o limite, bloqueia no frame zero
  if (registroAtual.count > LIMITE_MAXIMO_REQUISICOES) {
    // Log de Telemetria instantâneo no Cloud Logging
    console.warn(
      `[DISJUNTOR COTA ATIVADO - RATE LIMIT 429] Bloqueio imediato disparado para IP: ${ipCliente} na Rota: ${rotaAlvo}. Requisições na janela de 10s: ${registroAtual.count}/${LIMITE_MAXIMO_REQUISICOES}`
    );

    return res.status(429).json({
      error: 'MUITAS_REQUISICOES',
      mensagem: 'Tráfego anormal detectado para este recurso. Aguarde 10 segundos antes de tentar novamente.',
      bloqueado: true,
    });
  }

  return next();
}

export default interceptadorProtecaoCota;
