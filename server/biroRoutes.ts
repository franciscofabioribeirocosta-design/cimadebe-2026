import { Router } from 'express';
import {
  biroOperatorLogin,
  verificarCredenciaisBiro,
  salvarCredenciaisBiro,
  getAgoInscritos,
  getMinistrosCredenciais,
  atualizarValidadeCredencial,
  getInscritosCertificados,
  getInscritosCrachas,
  downloadCredencialSVG,
  downloadCrachaPDF,
  downloadCertificadoPDF,
  downloadPanfletoPDF,
  downloadModeloCertificadoSVG,
  salvarModeloCertificadoSVG,
  getConfiguracaoConvencao,
  salvarConfiguracaoConvencao,
  downloadCertificateSVG,
  downloadBiroPDF
} from './biroController';

const router = Router();

// AUTENTICAÇÃO E CREDENCIAIS DO BIRÔ
router.post('/login', biroOperatorLogin);
router.get('/status-credenciais', verificarCredenciaisBiro);
router.post('/salvar-credenciais', salvarCredenciaisBiro);

// 1. MENU CREDENCIAIS (Para cada ministro no sistema com validade dinâmica)
router.get('/ministros-credenciais', getMinistrosCredenciais);
router.post('/atualizar-validade', atualizarValidadeCredencial);

// 2. MENU CERTIFICADOS (Inscritos do Plano 3 e 4 com botões Ordenado / Recebido)
router.get('/inscritos-certificados', getInscritosCertificados);
router.get('/modelo-certificado-svg', downloadModeloCertificadoSVG);
router.get('/download/modelo-certificado', downloadModeloCertificadoSVG);
router.post('/salvar-modelo-certificado', salvarModeloCertificadoSVG);

// 3. MENU CRACHÁS (Inscritos da AGO em geral, Plano 3 e Plano 4)
router.get('/inscritos-crachas', getInscritosCrachas);
router.get('/ago-inscritos', getAgoInscritos);
router.get('/inscritos-ago', getAgoInscritos);

// 4. MENU PANFLETO (Panfleto específico para cada AGO em PDF)
router.get('/download/panfleto', downloadPanfletoPDF);
router.get('/panfleto-pdf', downloadPanfletoPDF);

// 5. CONFIGURAÇÃO PADRÃO PARA CADA NOVA CONVENÇÃO
router.get('/config-convencao', getConfiguracaoConvencao);
router.post('/salvar-config-convencao', salvarConfiguracaoConvencao);

// DOWNLOADS DIRETOS
router.get('/download/credencial', downloadCredencialSVG);
router.get('/credencial-svg', downloadCredencialSVG);

router.get('/download/cracha', downloadCrachaPDF);
router.get('/cracha-pdf', downloadCrachaPDF);

router.get('/download/certificado', downloadCertificadoPDF);
router.get('/certificado-pdf', downloadCertificadoPDF);
router.get('/certificate-svg', downloadCertificateSVG);

router.get('/download/pdf', downloadBiroPDF);

export default router;
