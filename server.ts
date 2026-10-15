import express from 'express';
import path from 'path';
import fs from 'fs';
import biroRoutes from './server/biroRoutes';
import superMasterRoutes from './server/superMasterRoutes';
import masterHubRoutes from './server/masterHubRoutes';
import ministerFinanceRoutes from './server/ministerFinanceRoutes';
import ministerRoutes from './server/ministerRoutes';
import mainRouter from './server/router';
import { handleAsaasWebhook } from './server/asaasWebhook';
import { createServer as createViteServer } from 'vite';
import { getApiConfig, updateApiConfig } from './server/superMasterController';
import { interceptadorProtecaoCota } from './server/rateLimitInterceptor';

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  const portArgIndex = process.argv.indexOf('--port');
  const portArg = portArgIndex !== -1 ? process.argv[portArgIndex + 1] : null;
  const PORT = Number(portArg) || 3000;

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ limit: '20mb', extended: true }));

  // Safe router mounting
  try {
    // DISJUNTOR NATIVO DE REQUISIÇÕES (RATE LIMITER / PROTEÇÃO DE COTA ZERO-TRUST)
    app.use('/api', interceptadorProtecaoCota);

    // WEBHOOKS ASAAS: Resposta direta HTTP 200 { received: true } sem 302
    app.post(['/webhook/asaas', '/webhook', '/api/webhook/asaas', '/api/asaas/webhook'], handleAsaasWebhook);

    // MAPEAMENTO CENTRALIZADO DE APIS (configuracoes/apis)
    app.get(['/configuracoes/apis', '/api/configuracoes/apis'], getApiConfig);
    app.post(['/configuracoes/apis', '/api/configuracoes/apis'], updateApiConfig);

    app.use('/api/supermaster', superMasterRoutes);
    app.use('/api/masterhub', masterHubRoutes);
    app.use('/api/minister-finance', ministerFinanceRoutes);
    app.use('/api/minister', ministerRoutes);
    app.use('/api/biro', biroRoutes);
    app.use('/api', mainRouter);
  } catch (err) {
    console.error('[CRITICAL BOOT GUARD WARN] Error mounting API routes:', err);
  }

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'OK', service: 'CIMADEBE / SIGM Core Server', timestamp: new Date().toISOString() });
  });

  const isRunningFromDist = process.argv[1] ? process.argv[1].includes('dist') : false;
  const isProduction = process.env.NODE_ENV === 'production' || isRunningFromDist;
  
  const scriptDir = process.argv[1] ? path.dirname(path.resolve(process.argv[1])) : '';
  const candidatePaths = [
    path.resolve('dist'),
    scriptDir,
    path.resolve(scriptDir, '..', 'dist'),
    path.resolve(process.cwd(), 'dist'),
  ];
  let distPath = path.resolve('dist');
  for (const cand of candidatePaths) {
    if (cand && fs.existsSync(path.join(cand, 'index.html'))) {
      distPath = cand;
      break;
    }
  }
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  if (isProduction || (hasDist && process.env.npm_lifecycle_event !== 'dev')) {
    console.log('[PROD SERVER] Serving pre-compiled production assets from:', distPath);

    // Serve os assets de forma explícita na raiz do servidor
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      immutable: true,
      maxAge: '1y',
      fallthrough: false,
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      }
    }));

    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        }
      }
    }));

    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true }
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.warn('[VITE DEV SERVER WARN] Vite middleware failed, serving static fallback:', err);
      if (hasDist) {
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }
    }
  }

  // ABSOLUTE PORT 3000 BINDING LAW: Listen on 0.0.0.0:3000 unconditionally
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[BOOT GUARD ACTIVE] Server running and bound to http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[CRITICAL BOOT FATAL] Top-level server boot error caught:', err);
});
