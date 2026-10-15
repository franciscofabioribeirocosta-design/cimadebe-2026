import { Router, Request, Response } from 'express';
import { createPlanSubscription, createAsaasCharge, checkAsaasPaymentStatus, getAsaasCredentials, PRICING_MODELS } from './asaasController';
import { handleAsaasWebhook } from './asaasWebhook';

const router = Router();

/**
 * FILE 3: ASAAS EXPRESS ROUTES SETUP
 * Linear routing linking charge generation, webhook receiver, and configuration check endpoints.
 */

// 1. Subscription & Charge Creation Endpoints
router.post('/subscription', createPlanSubscription);
router.post('/charge', createAsaasCharge);
router.get('/check-payment/:paymentId', checkAsaasPaymentStatus);

// 2. Webhook Handler Endpoint (Pure HTTP 200, Anti-302 Loop)
router.post('/webhook', handleAsaasWebhook);

// 3. Pricing Models Endpoint
router.get('/pricing-models', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: PRICING_MODELS
  });
});

// 4. Config Health Check Endpoint (Validates presence of dynamic Firestore credentials)
router.get('/config-check', async (_req: Request, res: Response) => {
  try {
    const creds = await getAsaasCredentials();
    if (!creds) {
      res.status(500).json({
        configured: false,
        error: 'Asaas credentials missing in Firestore (configuracoes/asaas) and environment variables.'
      });
      return;
    }

    res.status(200).json({
      configured: true,
      source: creds.source,
      environment: creds.environment,
      baseUrl: creds.baseUrl,
      apiKeyMasked: creds.apiKey ? creds.apiKey.substring(0, 8) + '...' : null,
      webhookTokenConfigured: Boolean(creds.webhookToken)
    });
  } catch (err: any) {
    res.status(500).json({ configured: false, error: err?.message || 'Check failed' });
  }
});

export default router;
