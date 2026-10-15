import { Router } from 'express';
import {
  downloadRecomendacaoPDF,
  downloadTransferenciaPDF,
  downloadRegularidadePDF
} from './ministerDocsController';
import { getMinisterCredencialSvg } from './ministerCredentialController';
// @ts-ignore
import authenticationMiddleware from './authenticationMiddleware';

/**
 * MINISTER ROUTES DISPATCHER (Append-only extension)
 * Manages private minister portal document download endpoints protected by authentication middleware.
 */

const router = Router();

router.get('/download/recomendacao', authenticationMiddleware, downloadRecomendacaoPDF);
router.get('/download/transferencia', authenticationMiddleware, downloadTransferenciaPDF);
router.get('/download/regularidade', authenticationMiddleware, downloadRegularidadePDF);

// ROTA DE COMPILAÇÃO BASE64 E VETORIAL SVG (PADRÃO CR-80)
router.get('/credencial/svg/:ministroId', getMinisterCredencialSvg);
router.get('/credencial/svg', getMinisterCredencialSvg);

export default router;
