import { Router } from 'express';
import { adminDb } from './firebaseAdmin';
import { createUser, getCollectionRecords, getVerifiedFinancialLogs } from './userController';
import asaasRoutes from './asaasRoutes';
import superMasterRoutes from './superMasterRoutes';
import biroRoutes from './biroRoutes';
import { preCheckBiometrics, generateBiometricChallenge, verifyBiometricResponse } from './biometricController';
import { getPresidenteGeralOficial, validarOperadorEclesiastico } from './governanceController';
import { criarIgreja, deletarIgreja, listarIgrejas } from './igrejasController';
import { generateSvgCredential, getMinisterCredencialSvg } from './ministerCredentialController';
import { getOfficialCertificateSvg, getOfficialCertificatePdf, getOfficialCertificateData } from './certificateController';
import { generateBiometricChallenge as generateAuthChallenge, verifyBiometricAssertion, listBiometricDevices, revokeBiometricDevice } from './biometricAuthController';
import documentRoutes from './documentRoutes';
import { conciliarEventoManual, fecharExercicioContabil, listarEventosPendentes, listarFechamentos } from './treasuryOperationsController';
import { checkinMinistroAgo, abrirPautaAgo, fecharPautaAgo, registrarVotoAgo, getQuorumAgo } from './agoAssemblyController';
import { getDreDinamico, congelarExercicioDre, getLedgerRecentes } from './treasuryReportController';
import { checkoutAgoPayment } from './paymentController';
// Importação do middleware de autenticação (definido anteriormente)
// @ts-ignore
import authenticationMiddleware from './authenticationMiddleware';

const router = Router();

/**
 * COMPONENT 3: EXPRESS ROUTES WITH AUTH MIDDLEWARE INTEGRATION
 * Fluxo puramente linear: Human Request -> Auth Middleware -> Controller -> Response.
 */

// PILLAR 1: Official Documents & Public QR Code Validation Routes
router.use(documentRoutes);

// PILLAR 2: Treasury Operations (Reconciliation & DRE Fiscal Year Closure)
router.post('/treasury/reconcile-event', conciliarEventoManual);
router.post('/treasury/fechar-exercicio', fecharExercicioContabil);
router.get('/treasury/pending-events', listarEventosPendentes);
router.get('/treasury/fechamentos', listarFechamentos);

// Igrejas Filiadas (Idempotency & Isolated Deletions)
router.get('/igrejas', listarIgrejas);
router.post('/igrejas', criarIgreja);
router.delete('/igrejas/:id', deletarIgreja);

// Governança Eclesiástica Estrita (4 Cadeias Rígidas)
router.get('/governance/presidente-geral', getPresidenteGeralOficial);
router.post('/governance/validar-operador', validarOperadorEclesiastico);

// Minister Credential Vector SVG Generator (CR-80 PVC)
router.get('/credential/svg', generateSvgCredential);
router.get('/minister/credencial/svg/:ministroId', getMinisterCredencialSvg);
router.get('/minister/credencial/svg', getMinisterCredencialSvg);

// Official Certificate Matrix Generator (A4 Landscape)
router.get('/certificate/svg', getOfficialCertificateSvg);
router.get('/certificate/pdf', getOfficialCertificatePdf);
router.get('/certificate/data', getOfficialCertificateData);

// MÓDULO AGO: MOTOR DE QUÓRUM E VOTAÇÃO ELETRÔNICA ACID
router.post('/ago/checkin', checkinMinistroAgo);
router.post('/ago/pauta/abrir', abrirPautaAgo);
router.post('/ago/pauta/fechar', fecharPautaAgo);
router.post('/ago/voto/registrar', registrarVotoAgo);
router.get('/ago/quorum', getQuorumAgo);

// MÓDULO FINANCEIRO: RELATÓRIOS DA TESOURARIA E DRE ANUAL (-03:00)
router.get('/treasury/reports/dre/:ano', getDreDinamico);
router.post('/treasury/reports/dre/congelar', congelarExercicioDre);
router.get('/treasury/reports/ledger-recentes', getLedgerRecentes);

// Rota protegida de criação de usuário
router.post('/users', authenticationMiddleware, createUser);

// Rota protegida de leitura segura de coleções (com stasis para tabelas vazias)
router.get('/data/:collectionName', authenticationMiddleware, getCollectionRecords);

// Rota protegida de agregação financeira estrita com Barkeep Filter (Zero-Trust)
router.get('/financeiro/verified-logs', authenticationMiddleware, getVerifiedFinancialLogs);

// ============================================================================
// PILLAR 1: TRAVA DE IDEMPOTÊNCIA NO WEBHOOK DO ASAAS (ZERO-TRUST STRICT PROTOCOL)
// ============================================================================
router.post(['/webhook/asaas', '/api/webhook/asaas'], async (req, res) => {
  try {
    const eventId = req.body?.id ? String(req.body.id).trim() : '';
    if (!eventId) {
      return res.status(200).json({ received: true, error: 'MISSING_EVENT_ID' });
    }

    // 1. Verificação prévia de idempotência ANTES de rodar qualquer cálculo
    const transacaoRef = adminDb.collection('transacoes_processadas').doc(eventId);
    const transacaoSnap = await transacaoRef.get();

    if (transacaoSnap.exists) {
      // Aborta imediatamente e retorna HTTP 200 OK sem reprocessar
      return res.status(200).json({ received: true, alreadyProcessed: true });
    }

    const body = req.body || {};
    const payment = body.payment || {};
    const externalRef = String(payment.externalReference || payment.customer || '').trim();
    const valorOriginal = Number(payment.value || body.value || 0);
    const toCents = (val: number | string): number => Math.round(Number(val || 0) * 100);
    const valorCentavos = toCents(valorOriginal);
    const timestampIso = new Date().toISOString();

    // 2. Executa writeBatch atômico
    const batch = adminDb.batch();

    // 1. Salve o ID em transacoes_processadas/${eventId} com timestamp do servidor
    batch.set(transacaoRef, {
      id: eventId,
      eventId,
      event: body.event || 'PAYMENT_RECEIVED',
      timestamp: timestampIso,
      processedAt: timestampIso,
      payload: {
        paymentId: payment.id || null,
        value: valorOriginal,
        valorCentavos,
      },
    });

    // 2. Altere o status da anuidade ou da inscrição da AGO correspondente para 'PAGO' e injete a dataPagamento
    let ministroId = '';
    let igrejaId = 't-sede-salvador';
    let tipoOperacao: 'RECEITA_ANUIDADE' | 'RECEITA_AGO' | 'TAXA_FILIACAO' = 'RECEITA_ANUIDADE';

    if (externalRef) {
      if (externalRef.startsWith('ago-') || externalRef.includes('ago')) {
        tipoOperacao = 'RECEITA_AGO';
        const cleanRefId = externalRef.replace(/^ago-(2026-)?/, '').trim();
        ministroId = cleanRefId;

        // Liquida a inscrição oficial da AGO no Firestore
        const inscricaoRef = adminDb.collection('inscricoes_ago').doc(`${cleanRefId}_2026`);
        const inscricaoSnap = await inscricaoRef.get();
        if (inscricaoSnap.exists) {
          batch.update(inscricaoRef, {
            status: 'CONFIRMADO',
            statusInscricao: 'CONFIRMADO',
            statusPagamento: 'PAGO',
            dataPagamento: timestampIso,
            dataLiquidacao: timestampIso,
            asaasPaymentId: payment.id || '',
            metodoPagamento: payment.billingType || 'PIX',
            atualizadoEm: timestampIso,
          });
        }

        if (ministroId) {
          const minRef = adminDb.collection('ministros').doc(ministroId);
          batch.update(minRef, {
            status: 'ATIVO',
            statusAdimplencia: 'ADIMPLENTE',
            statusInscricaoAgo: 'CONFIRMADO',
            dataUltimaAnuidadePago: timestampIso,
          });
        }
      } else {
        const anuidadeRef = adminDb.collection('anuidades').doc(externalRef);
        const anuidadeSnap = await anuidadeRef.get();
        if (anuidadeSnap.exists) {
          const anuData = anuidadeSnap.data() || {};
          ministroId = String(anuData.ministroId || '');
          igrejaId = String(anuData.igrejaId || anuData.tenantId || 't-sede-salvador');
          batch.update(anuidadeRef, {
            statusPagamento: 'PAGO',
            status: 'PAGO',
            dataPagamento: timestampIso,
            dataLiquidacao: timestampIso,
            asaasPaymentId: payment.id || '',
          });

          if (ministroId) {
            const minRef = adminDb.collection('ministros').doc(ministroId);
            batch.update(minRef, {
              status: 'ATIVO',
              statusAdimplencia: 'ADIMPLENTE',
              dataUltimaAnuidadePago: timestampIso,
            });
          }
        } else {
          const minRef = adminDb.collection('ministros').doc(externalRef);
          const minSnap = await minRef.get();
          if (minSnap.exists) {
            ministroId = externalRef;
            batch.update(minRef, {
              status: 'ATIVO',
              statusAdimplencia: 'ADIMPLENTE',
              dataUltimaAnuidadePago: timestampIso,
            });
          }
        }
      }
    }

    // 3. Escreva a receita em formato de centavos inteiros (toCents()) no Livro Caixa Imutável (financial_ledger)
    const ledgerRef = adminDb.collection('financial_ledger').doc(`led_evt_${eventId}`);
    batch.set(ledgerRef, {
      id: `led_evt_${eventId}`,
      eventId,
      timestamp: timestampIso,
      operadorEmail: 'asaas_webhook@system.cimadebe.org',
      ministroId: ministroId || 'NA',
      igrejaId: igrejaId || 't-sede-salvador',
      valorCentavos,
      tipoOperacao,
      metodoPagamento: payment.billingType || 'PIX',
      descricao: `Receita liquidada via Asaas Webhook: ${payment.id || eventId}`,
    });

    await batch.commit();

    return res.status(200).json({ received: true, alreadyProcessed: false });
  } catch (err: any) {
    console.error('[WEBHOOK ASAAS FATAL]', err?.message || err);
    return res.status(200).json({ received: true, error: err?.message || 'Handled' });
  }
});

// TASK CODE 06 (FINAL): COMPLETE ASAAS SYSTEM INTEGRATION ROUTES
router.use('/asaas', asaasRoutes);
router.post('/payment/checkout-ago', checkoutAgoPayment);

// SUPER MASTER COMMAND CENTER ROUTES (ISOLATED SAAS)
router.use('/supermaster', superMasterRoutes);

// TASK CODE 08: SUPER MASTER PRINTING BUREAU (AGO CERTIFICATES)
router.use('/biro', biroRoutes);

// TASK CODE 05: ADVANCED BIOMETRIC AUTHENTICATION (WEBAUTHN / PASSKEYS FLOW)
router.post('/biometrics/pre-check', preCheckBiometrics);
router.post('/biometrics/challenge', generateAuthChallenge);
router.post('/biometric/challenge', generateAuthChallenge);
router.post('/biometrics/verify', verifyBiometricResponse);
router.post('/biometrics/register', verifyBiometricAssertion);
router.post('/biometric/register', verifyBiometricAssertion);

// BANK-GRADE WEBAUTHN / FIDO2 GOVERNANCE AUTH GATEWAY
router.post('/biometrics/auth/challenge', generateAuthChallenge);
router.post('/biometrics/auth/verify', verifyBiometricAssertion);
router.get('/biometrics/devices', listBiometricDevices);
router.post('/biometrics/revoke', revokeBiometricDevice);

export default router;
