/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Motor de Quórum e Votação Eletrônica da Assembleia Geral Ordinária (AGO)
 * Protocolo: Estase de Leitura, Contratos Estritos ACID e Integridade Criptográfica (SHA-256).
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import { adminDb } from './firebaseAdmin';
import { db } from '../src/firebase';
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  runTransaction,
  collection,
  query,
  where,
  getCountFromServer,
  limit,
  getDocs,
} from 'firebase/firestore';

/**
 * 1. CHECK-IN DE PRESENÇA (CONTROLE DE QUÓRUM)
 * Endpoint POST /api/ago/checkin
 * Payload: { ministroId, operadorEmail, tenantId }
 * - Valida se o ministro está 'ATIVO' e 'ADIMPLENTE'.
 * - Executa updateDoc mudando presencaAgoVigente: true e dataCheckin: ISO.
 * - Retorna o quórum atualizado lendo a contagem total de presentes via count().
 */
export async function checkinMinistroAgo(req: Request, res: Response): Promise<any> {
  try {
    const { ministroId, operadorEmail, tenantId } = req.body || {};
    const cleanMinistroId = String(ministroId || '').trim();

    if (!cleanMinistroId) {
      return res.status(400).json({ error: 'Parâmetro ministroId é obrigatório para o check-in de presença.' });
    }

    // Busca o documento do ministro
    let minDocRef = doc(db, 'ministros', cleanMinistroId);
    let minSnap = await getDoc(minDocRef);

    // Se não encontrou por ID direto, tenta por CPF limpo
    if (!minSnap.exists()) {
      const cleanCpf = cleanMinistroId.replace(/\D/g, '');
      if (cleanCpf) {
        const qCpf = query(collection(db, 'ministros'), where('cpf', '==', cleanMinistroId), limit(1));
        const qSnap = await getDocs(qCpf);
        if (!qSnap.empty) {
          minDocRef = qSnap.docs[0].ref;
          minSnap = qSnap.docs[0];
        }
      }
    }

    if (!minSnap.exists()) {
      return res.status(404).json({ error: 'Ministro não encontrado no registro canônico do Firestore.' });
    }

    const minData = minSnap.data() || {};
    const status = String(minData.status || '').toUpperCase();
    const statusAdimplencia = String(minData.statusAdimplencia || 'ADIMPLENTE').toUpperCase();

    // Verificação estrita de elegibilidade estatutária
    const isAtivo = status === 'ATIVO';
    const isAdimplente = statusAdimplencia === 'ADIMPLENTE' || statusAdimplencia === 'EM_DIA' || statusAdimplencia === 'EM_DIA_FUTURO';

    if (!isAtivo) {
      return res.status(403).json({
        error: `ACESSO NEGADO (HTTP 403): O cadastro ministerial encontra-se [${status}]. Apenas ministros ATIVOS podem registrar presença deliberativa.`,
        status,
      });
    }

    if (!isAdimplente) {
      return res.status(403).json({
        error: `ACESSO NEGADO (HTTP 403): O ministro encontra-se [${statusAdimplencia}]. Check-in bloqueado até regularização financeira junto à Tesouraria Geral.`,
        statusAdimplencia,
      });
    }

    const dataCheckin = new Date().toISOString();

    // Executa updateDoc estrito (sem merge cego) no documento do ministro
    await updateDoc(minDocRef, {
      presencaAgoVigente: true,
      dataCheckin,
      checkinOperador: String(operadorEmail || 'secretaria@cimadebe.org').trim(),
      checkinTenantId: String(tenantId || 't-sede-salvador').trim(),
    });

    // Retorna a contagem canônica de quórum via getCountFromServer
    let quorumPresentes = 0;
    try {
      const qPresentes = query(collection(db, 'ministros'), where('presencaAgoVigente', '==', true));
      const countSnap = await getCountFromServer(qPresentes);
      quorumPresentes = countSnap.data().count;
    } catch (countErr) {
      console.warn('[QUORUM_COUNT_WARN]', countErr);
    }

    return res.status(200).json({
      success: true,
      message: `Presença de ${minData.nome || cleanMinistroId} confirmada na Plenária da AGO.`,
      ministro: {
        id: minSnap.id,
        nome: minData.nome,
        cargo: minData.cargo,
        cpf: minData.cpf,
        presencaAgoVigente: true,
        dataCheckin,
      },
      quorum: {
        presentes: quorumPresentes,
      },
    });
  } catch (err: any) {
    console.error('[AGO_CHECKIN_ERROR]:', err);
    return res.status(500).json({ error: 'Erro ao processar check-in de presença na AGO.', details: err?.message });
  }
}

/**
 * 2. ABERTURA DE PAUTA PARA VOTAÇÃO
 * Endpoint POST /api/ago/pauta/abrir
 * Payload: { pautaId, titulo, descricao, operadorEmail }
 * Registra em ago_pautas/${pautaId}: descricao, status: 'VOTACAO_ABERTA', votosFavor: 0, votosContra: 0, abstencoes: 0.
 */
export async function abrirPautaAgo(req: Request, res: Response): Promise<any> {
  try {
    const { pautaId, titulo, descricao, operadorEmail } = req.body || {};
    const cleanPautaId = String(pautaId || `pauta_${Date.now()}`).trim();

    if (!cleanPautaId) {
      return res.status(400).json({ error: 'Parâmetro pautaId é obrigatório para abertura de pauta.' });
    }

    const pautaDocRef = doc(db, 'ago_pautas', cleanPautaId);
    const pautaExistente = await getDoc(pautaDocRef);

    const agoraIso = new Date().toISOString();

    const payloadPauta = {
      id: cleanPautaId,
      titulo: String(titulo || 'Pauta Deliberativa da Assembleia Geral').trim(),
      descricao: String(descricao || '').trim(),
      status: 'VOTACAO_ABERTA',
      votosFavor: 0,
      votosContra: 0,
      abstencoes: 0,
      totalVotos: 0,
      abertaEm: agoraIso,
      operadorAbertura: String(operadorEmail || 'mesa_diretora@cimadebe.org').trim(),
    };

    if (pautaExistente.exists()) {
      // Reabre pauta existente zerando ou mantendo contadores
      await updateDoc(pautaDocRef, {
        descricao: payloadPauta.descricao,
        titulo: payloadPauta.titulo,
        status: 'VOTACAO_ABERTA',
        reabertaEm: agoraIso,
      });
    } else {
      await setDoc(pautaDocRef, payloadPauta);
    }

    return res.status(200).json({
      success: true,
      message: `Pauta [${payloadPauta.titulo}] aberta com sucesso para votação na Plenária.`,
      pauta: payloadPauta,
    });
  } catch (err: any) {
    console.error('[AGO_ABRIR_PAUTA_ERROR]:', err);
    return res.status(500).json({ error: 'Erro ao abrir pauta para votação.', details: err?.message });
  }
}

/**
 * 2.1 FECHAMENTO DE PAUTA
 * Endpoint POST /api/ago/pauta/fechar
 * Payload: { pautaId, operadorEmail }
 */
export async function fecharPautaAgo(req: Request, res: Response): Promise<any> {
  try {
    const { pautaId, operadorEmail } = req.body || {};
    const cleanPautaId = String(pautaId || '').trim();

    if (!cleanPautaId) {
      return res.status(400).json({ error: 'Parâmetro pautaId é obrigatório.' });
    }

    const pautaDocRef = doc(db, 'ago_pautas', cleanPautaId);
    const pautaSnap = await getDoc(pautaDocRef);

    if (!pautaSnap.exists()) {
      return res.status(404).json({ error: 'Pauta não encontrada.' });
    }

    const agoraIso = new Date().toISOString();
    await updateDoc(pautaDocRef, {
      status: 'VOTACAO_ENCERRADA',
      encerradaEm: agoraIso,
      operadorEncerramento: String(operadorEmail || 'mesa_diretora@cimadebe.org').trim(),
    });

    const dadosAtualizados = (await getDoc(pautaDocRef)).data();

    return res.status(200).json({
      success: true,
      message: `Votação da pauta encerrada com sucesso.`,
      pauta: dadosAtualizados,
    });
  } catch (err: any) {
    console.error('[AGO_FECHAR_PAUTA_ERROR]:', err);
    return res.status(500).json({ error: 'Erro ao encerrar votação da pauta.', details: err?.message });
  }
}

/**
 * 3. VOTO ELETRÔNICO AUDITÁVEL (ACID TRANSACTION)
 * Endpoint POST /api/ago/voto/registrar
 * Payload: { pautaId, ministroId, opcao: 'FAVOR' | 'CONTRA' | 'ABSTENCAO' }
 * Executa uma transação atômica (runTransaction):
 *   1. Verifica se o ministro possui presencaAgoVigente === true. Se falso, barra.
 *   2. Verifica na coleção ago_votos_computados se o ministroId já votou nesta pautaId. Se já votou, falha imediatamente por idempotência.
 *   3. Incrementa o contador da opção na pauta correspondente e grava o recibo do voto em ago_votos_computados/${pautaId}_${ministroId} com hash criptográfico SHA-256.
 */
export async function registrarVotoAgo(req: Request, res: Response): Promise<any> {
  try {
    const { pautaId, ministroId, opcao } = req.body || {};
    const cleanPautaId = String(pautaId || '').trim();
    const cleanMinistroId = String(ministroId || '').trim();
    const cleanOpcao = String(opcao || '').toUpperCase().trim();

    if (!cleanPautaId || !cleanMinistroId) {
      return res.status(400).json({ error: 'Os parâmetros pautaId e ministroId são obrigatórios.' });
    }

    if (cleanOpcao !== 'FAVOR' && cleanOpcao !== 'CONTRA' && cleanOpcao !== 'ABSTENCAO') {
      return res.status(400).json({
        error: "Opção de voto inválida. Os valores permitidos são: 'FAVOR', 'CONTRA' ou 'ABSTENCAO'.",
      });
    }

    const agoraIso = new Date().toISOString();
    const votoReciboId = `${cleanPautaId}_${cleanMinistroId}`;

    const pautaDocRef = doc(db, 'ago_pautas', cleanPautaId);
    const minDocRef = doc(db, 'ministros', cleanMinistroId);
    const votoDocRef = doc(db, 'ago_votos_computados', votoReciboId);

    // Execução da Transação Atômica ACID
    const resultadoTransacao = await runTransaction(db, async (transaction) => {
      // 1. Leitura da Pauta
      const pautaSnap = await transaction.get(pautaDocRef);
      if (!pautaSnap.exists()) {
        throw new Error('PAUTA_NAO_ENCONTRADA: A pauta especificada não existe.');
      }
      const pautaData = pautaSnap.data() || {};
      if (pautaData.status !== 'VOTACAO_ABERTA') {
        throw new Error('VOTACAO_ENCERRADA: Esta pauta não está mais aberta para recebimento de votos.');
      }

      // 2. Leitura e Verificação do Ministro (Presença Obrigatória)
      const minSnap = await transaction.get(minDocRef);
      if (!minSnap.exists()) {
        throw new Error('MINISTRO_NAO_ENCONTRADO: Prontuário do ministro não localizado.');
      }
      const minData = minSnap.data() || {};
      if (minData.presencaAgoVigente !== true) {
        throw new Error('PRESENCA_NAO_CONFIRMADA: Ministro não realizou check-in de presença na Plenária da AGO.');
      }

      // 3. Trava de Idempotência: Verifica se já votou nesta pauta
      const votoSnap = await transaction.get(votoDocRef);
      if (votoSnap.exists()) {
        throw new Error('VOTO_JA_COMPUTADO: Ministro já exerceu o voto nesta pauta deliberativa (Duplo voto proibido).');
      }

      // 4. Cálculo Criptográfico SHA-256 do Recibo
      const hashData = `${votoReciboId}|${cleanOpcao}|${agoraIso}|${minData.cpf || cleanMinistroId}`;
      const hashSha256 = crypto.createHash('sha256').update(hashData).digest('hex');

      // 5. Incremento Atômico da Pauta
      const votosFavorAtual = Number(pautaData.votosFavor || 0);
      const votosContraAtual = Number(pautaData.votosContra || 0);
      const abstencoesAtual = Number(pautaData.abstencoes || 0);
      const totalVotosAtual = Number(pautaData.totalVotos || 0);

      const novoVotosFavor = cleanOpcao === 'FAVOR' ? votosFavorAtual + 1 : votosFavorAtual;
      const novoVotosContra = cleanOpcao === 'CONTRA' ? votosContraAtual + 1 : votosContraAtual;
      const novoAbstencoes = cleanOpcao === 'ABSTENCAO' ? abstencoesAtual + 1 : abstencoesAtual;
      const novoTotal = totalVotosAtual + 1;

      transaction.update(pautaDocRef, {
        votosFavor: novoVotosFavor,
        votosContra: novoVotosContra,
        abstencoes: novoAbstencoes,
        totalVotos: novoTotal,
        ultimoVotoEm: agoraIso,
      });

      // 6. Gravação do Recibo Auditável
      transaction.set(votoDocRef, {
        id: votoReciboId,
        pautaId: cleanPautaId,
        ministroId: cleanMinistroId,
        ministroNome: minData.nome || 'DELEGADO AGO',
        ministroCpf: minData.cpf || '000.000.000-00',
        opcao: cleanOpcao,
        timestamp: agoraIso,
        hashSha256,
      });

      return {
        reciboId: votoReciboId,
        hashSha256,
        opcao: cleanOpcao,
        totalVotos: novoTotal,
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Voto computado com sucesso na Urna Eletrônica da Plenária.',
      recibo: resultadoTransacao,
    });
  } catch (err: any) {
    console.error('[AGO_VOTO_REGISTRAR_ERROR]:', err);
    const msg = err?.message || '';

    if (msg.includes('PRESENCA_NAO_CONFIRMADA')) {
      return res.status(403).json({
        error: 'ACESSO NEGADO (HTTP 403): O seu check-in de presença não foi confirmado na portaria da AGO.',
      });
    }

    if (msg.includes('VOTO_JA_COMPUTADO')) {
      return res.status(409).json({
        error: 'CONFLITO (HTTP 409): Seu voto já foi registrado para esta pauta deliberativa.',
      });
    }

    if (msg.includes('VOTACAO_ENCERRADA')) {
      return res.status(400).json({
        error: 'A votação desta pauta já se encontra encerrada.',
      });
    }

    return res.status(500).json({
      error: 'Falha atômica ao processar voto na urna.',
      details: msg,
    });
  }
}

/**
 * 4. CONSULTA CONSOLIDADA DE QUÓRUM E PAUTAS
 * Endpoint GET /api/ago/quorum
 */
export async function getQuorumAgo(req: Request, res: Response): Promise<any> {
  try {
    let totalMinistros = 0;
    let presentes = 0;

    try {
      const qTotal = query(collection(db, 'ministros'), where('status', '==', 'ATIVO'));
      const countTotal = await getCountFromServer(qTotal);
      totalMinistros = countTotal.data().count;

      const qPres = query(collection(db, 'ministros'), where('presencaAgoVigente', '==', true));
      const countPres = await getCountFromServer(qPres);
      presentes = countPres.data().count;
    } catch (countErr) {
      console.warn('[QUORUM_FETCH_WARN]', countErr);
    }

    return res.status(200).json({
      quorun: {
        totalMinistrosAtivos: totalMinistros,
        presentes,
        percentualPresenca: totalMinistros > 0 ? Number(((presentes / totalMinistros) * 100).toFixed(1)) : 0,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao consultar quórum.', details: err?.message });
  }
}
