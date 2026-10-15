import { Request, Response } from 'express';
import axios from 'axios';
import { adminDb } from './firebaseAdmin';
import { db } from '../src/firebase';
import { doc as clientDoc, getDoc as clientGetDoc } from 'firebase/firestore';

/**
 * 4 PRICING MODELS FOR MINISTERIAL SUBSCRIPTIONS
 */
export const PRICING_MODELS: Record<string, { name: string; defaultPrice: number; description: string }> = {
  MEMBRO_NOVO: {
    name: 'Anuidade Ingressante (Novo Ministro)',
    defaultPrice: 350.00,
    description: 'Inscrição e Anuidade Ministerial Inicial SIGM/CIMADEBE'
  },
  RENOVACAO_ANUAL: {
    name: 'Renovação de Anuidade Ministerial',
    defaultPrice: 250.00,
    description: 'Renovação Anual do Quadro de Ministros Adimplentes'
  },
  SEGUNDA_VIA_CARTEIRA: {
    name: 'Emissão de 2ª Via da Credencial PVC',
    defaultPrice: 150.00,
    description: 'Reemissão Físico-Digital da Carteira Ministerial com QR Code'
  },
  TAXA_TRANSFERENCIA: {
    name: 'Taxa de Transferência de Prontuário',
    defaultPrice: 500.00,
    description: 'Transferência e Homologação de Registro Inter-Eclesiástico'
  }
};

/**
 * Helper to fetch dynamic Asaas credentials from Firestore (configuracoes/asaas)
 * or fallback to environment variables.
 */
export async function getAsaasCredentials() {
  try {
    // 1. Tentar via Client SDK (Firestore Web com credenciais canônicas do applet)
    if (db) {
      try {
        const snap = await clientGetDoc(clientDoc(db, 'configuracoes', 'apis'));
        if (snap && snap.exists()) {
          const data = snap.data() || {};
          const apiKey = data.apiKey || data.asaasApiKey || process.env.ASAAS_API_KEY;
          const webhookToken = data.webhookToken || data.asaasWebhookToken || process.env.ASAAS_WEBHOOK_TOKEN;
          const environment = data.environment || 'production';
          const baseUrl = data.baseUrl || (environment === 'sandbox' ? 'https://sandbox.asaas.com/api/v3' : 'https://asaas.com/api/v3');

          if (apiKey && webhookToken) {
            return { apiKey, webhookToken, baseUrl, environment, source: 'FIRESTORE' };
          }
        }
      } catch {
        // Fallback silencioso para próxima camada
      }
    }

    // 2. Tentar via Admin SDK caso autenticado no ambiente
    if (adminDb) {
      try {
        const configSnap = await adminDb.collection('configuracoes').doc('apis').get();
        if (configSnap && configSnap.exists) {
          const data = configSnap.data() || {};
          const apiKey = data.apiKey || data.asaasApiKey || process.env.ASAAS_API_KEY;
          const webhookToken = data.webhookToken || data.asaasWebhookToken || process.env.ASAAS_WEBHOOK_TOKEN;
          const environment = data.environment || 'production';
          const baseUrl = data.baseUrl || (environment === 'sandbox' ? 'https://sandbox.asaas.com/api/v3' : 'https://asaas.com/api/v3');

          if (apiKey && webhookToken) {
            return { apiKey, webhookToken, baseUrl, environment, source: 'FIRESTORE' };
          }
        }
      } catch {
        // Fallback silencioso para env vars
      }
    }
  } catch {
    // Stasis de segurança
  }

  // Fallback to environment variables
  const apiKey = process.env.ASAAS_API_KEY;
  const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
  const baseUrl = process.env.ASAAS_URL || 'https://asaas.com/api/v3';

  if (!apiKey || !webhookToken) {
    return null;
  }

  return { apiKey, webhookToken, baseUrl, environment: 'ENV_FALLBACK', source: 'ENVIRONMENT' };
}

/**
 * FILE 1: ASAAS CHARGE CREATION CONTROLLER
 * Handles subscription generation with dynamic credentials, 4 pricing models validation, and Firebase Admin SDK.
 */
export async function createPlanSubscription(req: Request, res: Response): Promise<void> {
  try {
    // 1. LAYER 1: FAIL-FAST DYNAMIC CREDENTIALS CHECK
    const creds = await getAsaasCredentials();
    if (!creds) {
      res.status(500).json({
        error: 'Fail-Fast Configuration Error: Asaas credentials missing in Firestore (configuracoes/asaas) and environment variables.'
      });
      return;
    }

    // 2. LAYER 1: FAIL-FAST INPUT VALIDATION FOR THE 4 PRICING MODELS
    const { email, cpf, name, userId, pricingModel, planPrice } = req.body || {};

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Fail-Fast Input Error: Valid email parameter is required.' });
      return;
    }

    const cleanCpf = String(cpf || '').replace(/\D/g, '');
    if (!cleanCpf || cleanCpf.length < 11) {
      res.status(400).json({ error: 'Fail-Fast Input Error: Valid CPF parameter (11 digits) is required.' });
      return;
    }

    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      res.status(400).json({ error: 'Fail-Fast Input Error: Valid name parameter is required.' });
      return;
    }

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      res.status(400).json({ error: 'Fail-Fast Input Error: Valid userId parameter is required.' });
      return;
    }

    // Resolve Price and Plan Description across the 4 pricing models
    let resolvedPrice: number = 0;
    let resolvedDescription: string = 'Anuidade Ministerial SIGM / CIMADEBE';

    if (pricingModel && PRICING_MODELS[pricingModel]) {
      const model = PRICING_MODELS[pricingModel];
      resolvedPrice = Number(planPrice) > 0 ? Number(planPrice) : model.defaultPrice;
      resolvedDescription = `${model.name} - ${name.trim()}`;
    } else if (planPrice && !isNaN(Number(planPrice)) && Number(planPrice) > 0) {
      resolvedPrice = Number(planPrice);
      resolvedDescription = `Anuidade Ministerial Customizada - ${name.trim()}`;
    } else {
      res.status(400).json({
        error: 'Fail-Fast Input Error: Invalid pricing model or numeric planPrice. Allowed models: ' + Object.keys(PRICING_MODELS).join(', ')
      });
      return;
    }

    // 3. LAYER 2: FIRESTORE IMMUTABILITY & STASIS CHECK (FIREBASE ADMIN SDK)
    const userRef = adminDb.collection('ministros').doc(userId.trim());
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      res.status(404).json({ error: 'Stasis Error: Target minister document not found in Firestore.' });
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      'access_token': creds.apiKey
    };

    // 4. Resolve or Create Asaas Customer
    let customerId: string | null = null;
    try {
      const searchRes = await axios.get(`${creds.baseUrl}/customers?cpfCnpj=${cleanCpf}`, { headers });
      if (searchRes.data?.data && Array.isArray(searchRes.data.data) && searchRes.data.data.length > 0) {
        customerId = searchRes.data.data[0].id;
      } else {
        const createCustRes = await axios.post(`${creds.baseUrl}/customers`, {
          name: name.trim(),
          email: email.trim(),
          cpfCnpj: cleanCpf,
          notificationDisabled: false
        }, { headers });
        customerId = createCustRes.data?.id || null;
      }
    } catch (custErr: any) {
      res.status(502).json({
        error: 'Asaas Gateway Error: Failed to resolve customer record in Asaas.',
        details: custErr?.response?.data || custErr.message
      });
      return;
    }

    if (!customerId) {
      res.status(502).json({ error: 'Asaas Gateway Error: No customer identifier returned by gateway.' });
      return;
    }

    // 5. Generate Asaas Subscription
    let subscriptionData: any = null;
    try {
      const subResponse = await axios.post(`${creds.baseUrl}/subscriptions`, {
        customer: customerId,
        billingType: 'UNDEFINED',
        value: resolvedPrice,
        nextDueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        cycle: 'YEARLY',
        description: resolvedDescription,
        externalReference: userId.trim()
      }, { headers });

      subscriptionData = subResponse.data;
    } catch (subErr: any) {
      res.status(502).json({
        error: 'Asaas Gateway Error: Failed to generate plan subscription.',
        details: subErr?.response?.data || subErr.message
      });
      return;
    }

    // 6. LAYER 3 & 4: TRANSACTIONAL UPDATE IN FIRESTORE VIA ADMIN SDK
    await userRef.update({
      asaasCustomerId: customerId,
      asaasSubscriptionId: subscriptionData.id,
      statusPagamento: 'ABERTO',
      valorAnuidade: resolvedPrice,
      tipoAnuidade: pricingModel || 'CUSTOM',
      dataUltimaCobranca: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      message: 'Asaas plan subscription created successfully.',
      data: {
        subscriptionId: subscriptionData.id,
        customerId,
        value: subscriptionData.value,
        pricingModel: pricingModel || 'CUSTOM',
        invoiceUrl: subscriptionData.invoiceUrl || null,
        bankSlipUrl: subscriptionData.bankSlipUrl || null,
        status: subscriptionData.status
      }
    });

  } catch (error: any) {
    res.status(500).json({
      error: 'Internal Server Error during Asaas subscription creation.',
      details: error?.message || 'Unknown error'
    });
  }
}

/**
 * FILE 2: CREATE ASAAS DIRECT CHARGE & PIX QR CODE
 * Creates a direct payment in Asaas and retrieves the official Pix payload and QR code image.
 */
export async function createAsaasCharge(req: Request, res: Response): Promise<void> {
  try {
    const creds = await getAsaasCredentials();
    if (!creds) {
      res.status(500).json({ error: 'Fail-Fast Configuration Error: Asaas credentials missing.' });
      return;
    }

    const { email, cpf, name, userId, value, description, billingType } = req.body || {};
    if (!email || !cpf || !name || !value) {
      res.status(400).json({ error: 'Fail-Fast Input Error: email, cpf, name, and value are required.' });
      return;
    }

    const cleanCpf = String(cpf).replace(/\D/g, '');
    const headers = { 'Content-Type': 'application/json', 'access_token': creds.apiKey };

    // 1. Resolve or Create Customer in Asaas
    let customerId: string | null = null;
    try {
      const searchRes = await axios.get(`${creds.baseUrl}/customers?cpfCnpj=${cleanCpf}`, { headers });
      if (searchRes.data?.data && Array.isArray(searchRes.data.data) && searchRes.data.data.length > 0) {
        customerId = searchRes.data.data[0].id;
      } else {
        const createCustRes = await axios.post(`${creds.baseUrl}/customers`, {
          name: name.trim(),
          email: email.trim(),
          cpfCnpj: cleanCpf,
          notificationDisabled: false
        }, { headers });
        customerId = createCustRes.data?.id || null;
      }
    } catch (custErr: any) {
      res.status(502).json({ error: 'Asaas Gateway Error: Failed to resolve customer.', details: custErr?.response?.data || custErr.message });
      return;
    }

    if (!customerId) {
      res.status(502).json({ error: 'Asaas Gateway Error: No customer identifier returned.' });
      return;
    }

    // 2. Create Charge in Asaas
    const bType = billingType || 'PIX';
    const chargeRes = await axios.post(`${creds.baseUrl}/payments`, {
      customer: customerId,
      billingType: bType,
      value: Number(value),
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: description || 'Cobrança Oficial CIMADEBE / SIGM',
      externalReference: userId || cleanCpf
    }, { headers });

    const chargeData = chargeRes.data;
    let pixPayload = null;
    let pixQrCodeImage = null;

    if (bType === 'PIX' && chargeData.id) {
      try {
        const pixRes = await axios.get(`${creds.baseUrl}/payments/${chargeData.id}/pixQrCode`, { headers });
        pixPayload = pixRes.data?.payload || null;
        pixQrCodeImage = pixRes.data?.encodedImage ? `data:image/png;base64,${pixRes.data.encodedImage}` : null;
      } catch (pixErr) {
        console.warn('Warning: Could not fetch Pix QR Code from Asaas immediately:', pixErr);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        paymentId: chargeData.id,
        customerId,
        value: chargeData.value,
        status: chargeData.status,
        invoiceUrl: chargeData.invoiceUrl,
        bankSlipUrl: chargeData.bankSlipUrl,
        pixPayload,
        pixQrCodeImage
      }
    });

  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error during Asaas charge creation.', details: err?.response?.data || err.message });
  }
}

/**
 * FILE 3: CHECK ASAAS PAYMENT STATUS & AUTO-SETTLE IN FIRESTORE
 * Queries Asaas API for payment status, and if paid, automatically settles in Firestore.
 */
export async function checkAsaasPaymentStatus(req: Request, res: Response): Promise<void> {
  try {
    const { paymentId } = req.params;
    if (!paymentId) {
      res.status(400).json({ error: 'paymentId is required.' });
      return;
    }

    const creds = await getAsaasCredentials();
    if (!creds) {
      res.status(500).json({ error: 'Asaas credentials missing.' });
      return;
    }

    const headers = { 'Content-Type': 'application/json', 'access_token': creds.apiKey };
    const payRes = await axios.get(`${creds.baseUrl}/payments/${paymentId}`, { headers });
    const paymentData = payRes.data;

    const status = paymentData.status; // PENDING, RECEIVED, CONFIRMED, RECEIVED_IN_CASH
    const isPaid = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(status);

    if (isPaid && paymentData.externalReference && adminDb) {
      const userId = paymentData.externalReference;
      try {
        const userRef = adminDb.collection('ministros').doc(userId);
        await userRef.update({ statusAdimplencia: 'EM_DIA' });

        const anuidadesSnap = await adminDb.collection('anuidades')
          .where('ministroId', '==', userId)
          .where('statusPagamento', 'in', ['ABERTO', 'PENDENTE', 'EM_ATRASO'])
          .get();

        const nowIso = new Date().toISOString();
        const batch = adminDb.batch();
        anuidadesSnap.forEach(docSnap => {
          batch.update(docSnap.ref, {
            statusPagamento: 'EM_DIA',
            dataLiquidacao: nowIso,
            asaasPaymentId: paymentId
          });
        });
        await batch.commit();
      } catch (dbErr) {
        console.warn('Error auto-updating Firestore on payment check:', dbErr);
      }
    }

    res.status(200).json({
      success: true,
      paid: isPaid,
      status,
      payment: paymentData
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to check payment status', details: err?.response?.data || err.message });
  }
}


