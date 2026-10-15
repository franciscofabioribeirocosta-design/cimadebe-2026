import { Router } from 'express';
import {
  getApiConfig,
  updateApiConfig,
  testAsaasConnection,
  getTenants,
  upsertTenant,
  toggleTenantStatus,
  getGlobalPlans,
  updateGlobalPlans,
  getGlobalNews,
  upsertGlobalNews,
  deleteGlobalNews,
  getLandingBanners,
  updateLandingBanners,
  getWebhookAuditLogs,
  getQuotaAntiCrashStatus,
  purgeHeapMemoryCache,
  verifyIntegrity,
  downloadCredencialSVG,
  downloadCrachaPDF,
  downloadCertificadoPDF,
  initiateSystemSetup,
  checkSetupState,
  verifyLogin
} from './superMasterController';
import {
  downloadRecomendacaoPDF,
  downloadTransferenciaPDF,
  downloadRegularidadePDF
} from './ministerDocsController';

const router = Router();

// MENU 1: CENTRAL API INTEGRATION PORTAL
router.get('/apis', getApiConfig);
router.post('/apis', updateApiConfig);
router.post('/apis/test-asaas', testAsaasConnection);
router.post('/test-asaas', testAsaasConnection);
router.post('/setup', initiateSystemSetup);
router.get('/check-setup', checkSetupState);
router.post('/verify-login', verifyLogin);

// MENU 2: MULTI-TENANT CLIENT CONTROLLER & GLOBAL PLANS
router.get('/tenants', getTenants);
router.post('/tenants', upsertTenant);
router.patch('/tenants/:tenantId/toggle', toggleTenantStatus);
router.get('/plans', getGlobalPlans);
router.post('/plans', updateGlobalPlans);

// MENU 3: PUBLIC WEBSITE CMS
router.get('/cms/news', getGlobalNews);
router.post('/cms/news', upsertGlobalNews);
router.delete('/cms/news/:newsId', deleteGlobalNews);
router.get('/cms/banners', getLandingBanners);
router.post('/cms/banners', updateLandingBanners);

// MENU 4: SAAS OPERATIONS & INFRASTRUCTURE METRICS
router.get('/metrics/webhooks', getWebhookAuditLogs);
router.get('/metrics/quota', getQuotaAntiCrashStatus);
router.post('/metrics/purge-cache', purgeHeapMemoryCache);
router.get('/verify-integrity', verifyIntegrity);

// MENU 5: AGO PRINTING & CREDENTIAL DOWNLOAD ROUTES
router.get('/download/credencial', downloadCredencialSVG);
router.get('/download/cracha', downloadCrachaPDF);
router.get('/download/certificado', downloadCertificadoPDF);

// MINISTER SELF-SERVICE PDF DOWNLOAD ROUTES
router.get('/download/recomendacao', downloadRecomendacaoPDF);
router.get('/download/transferencia', downloadTransferenciaPDF);
router.get('/download/regularidade', downloadRegularidadePDF);

export default router;
