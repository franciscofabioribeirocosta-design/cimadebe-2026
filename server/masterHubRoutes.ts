import { Router } from 'express';
import {
  getApiSubConfig,
  updateApiSubConfig,
  syncAsaasWebhookEndpoint,
  getCmsSwitches,
  updateCmsSwitch,
  getRbacMatrix,
  getPaginatedLogs
} from './masterHubController';

const router = Router();

// MENU 1: API Sub-Configs & Webhook Sync
router.post('/apis/asaas/sync-webhook', syncAsaasWebhookEndpoint);
router.get('/apis/:service', getApiSubConfig);
router.post('/apis/:service', updateApiSubConfig);

// MENU 2: CMS Portal Switches (Notícias, Mesa Diretora, Inscrição AGO, Eventos)
router.get('/cms/switches', getCmsSwitches);
router.patch('/cms/switches/:componentKey', updateCmsSwitch);

// MENU 3: RBAC Matrix
router.get('/rbac/matrix', getRbacMatrix);

// MENU 4: Strict Paginated Logs (.limit(10))
router.get('/logs', getPaginatedLogs);

export default router;
