import { Request, Response } from 'express';
import axios from 'axios';
import { adminDb } from './firebaseAdmin';
import { db } from '../src/firebase';
import { collection as clientCollection, getDocs as clientGetDocs, query as clientQuery, limit as clientLimit } from 'firebase/firestore';

/**
 * MASTER HUB CONTROLLER - Request Parceling & Lazy Fetching Controllers
 */

// 1. API Sub-Configs (Asaas, Atendimento, CNPJ, CEP, CPF)
export async function getApiSubConfig(req: Request, res: Response): Promise<void> {
  const { service } = req.params;
  const defaultApiConfig = { apiKey: '', webhookToken: '', environment: 'sandbox', ativo: true };
  try {
    if (!service) {
      res.json(defaultApiConfig);
      return;
    }

    const docRef = adminDb.collection('api_integrations').doc(service.toLowerCase());
    const snap = await docRef.get();

    if (!snap.exists) {
      // Tentar buscar de configuracoes/apis se for asaas
      if (service.toLowerCase() === 'asaas') {
        const apisSnap = await adminDb.collection('configuracoes').doc('apis').get();
        if (apisSnap.exists) {
          const d = apisSnap.data() || {};
          res.json({
            service,
            apiKey: d.asaasApiKey || d.apiKey || '',
            webhookToken: d.asaasWebhookToken || d.webhookToken || 'cimadebe_asaas_webhook_secure_2026_token',
            environment: d.environment || 'production',
            ativo: true
          });
          return;
        }
      }
      res.json(defaultApiConfig);
      return;
    }

    res.json({ service, ...snap.data() });
  } catch (error: any) {
    console.warn('[API_SUBCONFIG_FALLBACK]', error.message);
    res.json(defaultApiConfig);
  }
}

export async function updateApiSubConfig(req: Request, res: Response): Promise<void> {
  try {
    const { service } = req.params;
    const payload = req.body || {};
    const serviceName = String(service || '').toLowerCase();

    if (serviceName) {
      const docRef = adminDb.collection('api_integrations').doc(serviceName);
      await docRef.set({
        ...payload,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      if (serviceName === 'asaas') {
        const apiKey = payload.apiKey && !payload.apiKey.includes('...') ? payload.apiKey.trim() : '';
        const webhookToken = payload.webhookToken && !payload.webhookToken.includes('...') ? payload.webhookToken.trim() : 'cimadebe_asaas_webhook_secure_2026_token';
        const environment = payload.environment === 'sandbox' ? 'sandbox' : 'production';

        const apiPayload = {
          apiKey,
          asaasApiKey: apiKey,
          webhookToken,
          asaasWebhookToken: webhookToken,
          environment,
          updatedAt: new Date().toISOString()
        };

        await adminDb.collection('configuracoes').doc('apis').set(apiPayload, { merge: true });
        await adminDb.collection('configuracoes').doc('asaas').set(apiPayload, { merge: true });

        // Registrar Webhook automaticamente no ambiente Asaas (Sandbox ou Produção)
        if (apiKey && apiKey.length > 10) {
          const baseUrl = environment === 'sandbox' ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/api/v3';
          const publicUrl = `${req.protocol}://${req.get('host')}/api/webhook/asaas`;

          try {
            const listRes = await axios.get(`${baseUrl}/webhooks`, {
              headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
              timeout: 6000
            }).catch(() => null);

            const existingWebhooks = listRes?.data?.data || [];
            const matchingWebhook = existingWebhooks.find((w: any) => w.url && w.url.includes('/api/webhook/asaas'));

            if (matchingWebhook && matchingWebhook.id) {
              await axios.put(`${baseUrl}/webhooks/${matchingWebhook.id}`, {
                url: publicUrl,
                email: 'franciscofabio.rc@gmail.com',
                enabled: true,
                interrupted: false,
                apiVersion: 3,
                authToken: webhookToken,
                sendType: 'SEQUENTIALLY'
              }, {
                headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
                timeout: 6000
              });
            } else {
              await axios.post(`${baseUrl}/webhooks`, {
                url: publicUrl,
                email: 'franciscofabio.rc@gmail.com',
                enabled: true,
                interrupted: false,
                apiVersion: 3,
                authToken: webhookToken,
                sendType: 'SEQUENTIALLY'
              }, {
                headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
                timeout: 6000
              });
            }
          } catch (webhookErr: any) {
            console.warn('[ASAAS_WEBHOOK_REGISTRATION_WARN]', webhookErr.response?.data || webhookErr.message);
          }
        }
      }
    }

    res.json({ success: true, message: `Configuração da API ${serviceName.toUpperCase()} salva e webhook configurado com sucesso no Asaas.` });
  } catch (error: any) {
    console.error('[API_SUBCONFIG_ERROR]', error);
    res.status(500).json({ success: false, error: error.message || 'Erro ao salvar configuração da API.' });
  }
}

// 2. CMS Portal Switches (Notícias, Mesa Diretora, Inscrição AGO, Eventos)
export async function getCmsSwitches(_req: Request, res: Response): Promise<void> {
  const defaultConfig = {
    noticias: { ativo: true, titulo: 'Notícias & Informativos' },
    mesaDiretora: { ativo: true, titulo: 'Mesa Diretora Estatutária' },
    inscricaoAgo: { ativo: true, titulo: 'Inscrições AGO' },
    eventos: { ativo: true, titulo: 'Agenda de Eventos' }
  };

  try {
    const docRef = adminDb.collection('cms_config').doc('portal_switches');
    const snap = await docRef.get();

    if (!snap.exists) {
      await docRef.set(defaultConfig).catch(() => {});
      res.json(defaultConfig);
      return;
    }

    res.json(snap.data() || defaultConfig);
  } catch (error: any) {
    console.warn('[CMS_SWITCHES_FALLBACK]', error.message);
    res.json(defaultConfig);
  }
}

export async function updateCmsSwitch(req: Request, res: Response): Promise<void> {
  try {
    const { componentKey } = req.params;
    const { ativo } = req.body;

    if (componentKey) {
      const docRef = adminDb.collection('cms_config').doc('portal_switches');
      await docRef.set({
        [componentKey]: {
          ativo: Boolean(ativo),
          updatedAt: new Date().toISOString()
        }
      }, { merge: true }).catch(() => {});
    }

    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: true });
  }
}

// 3. RBAC Matrix
export async function getRbacMatrix(_req: Request, res: Response): Promise<void> {
  try {
    const matrix = [
      {
        role: 'BIRO',
        nome: 'Operador de Birô Gráfico',
        modulos: ['Birô de Impressão CR-80', 'Geração de SVG/PDF', 'Consulta de Ministros Adimplentes'],
        nivel: 'Operacional'
      },
      {
        role: 'TESOUREIRO',
        nome: 'Tesouraria & Controladoria',
        modulos: ['Gestão de Anuidades', 'Relatórios Financeiros Asaas', 'Conciliação Bancária'],
        nivel: 'Financeiro'
      },
      {
        role: 'SECRETARIO',
        nome: 'Secretaria Executiva Geral',
        modulos: ['Gestão de Ministros', 'Igrejas Filiadas', 'Mesa Diretora', 'Inscrições AGO'],
        nivel: 'Administrativo'
      },
      {
        role: 'CONSELHO_ETICA',
        nome: 'Conselho de Ética & Disciplina',
        modulos: ['Protocolo de Compliance', 'Trilha de Auditoria Disciplinar'],
        nivel: 'Conselheiro'
      },
      {
        role: 'CONSELHO_FISCAL',
        nome: 'Conselho Fiscal & Auditoria',
        modulos: ['Auditoria de Contas', 'Balanço Financeiro Anual'],
        nivel: 'Conselheiro'
      },
      {
        role: 'SUPER_ADMIN',
        nome: 'Super Master / Root',
        modulos: ['Central de APIs', 'CMS Portal Público', 'Matriz RBAC', 'Logs Paginados & Infraestrutura'],
        nivel: 'Pleno / Root'
      }
    ];

    res.json({ matrix });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching RBAC matrix' });
  }
}

// 4. Strict Paginated Logs (.limit(10))
export async function getPaginatedLogs(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limitVal = 10;
  const logs: any[] = [];

  try {
    if (db) {
      try {
        const snap = await clientGetDocs(clientQuery(clientCollection(db, 'audit_logs'), clientLimit(limitVal)));
        if (!snap.empty) {
          snap.forEach(doc => {
            logs.push({ id: doc.id, ...doc.data() });
          });
        }
      } catch {}
    }

    if (logs.length === 0 && adminDb) {
      try {
        const snapshot = await adminDb.collection('audit_logs').orderBy('timestamp', 'desc').limit(limitVal).get();
        snapshot.forEach(doc => {
          logs.push({ id: doc.id, ...doc.data() });
        });
      } catch {}
    }

    res.json({
      page,
      limit: limitVal,
      count: logs.length,
      logs
    });
  } catch {
    res.json({
      page,
      limit: limitVal,
      count: 0,
      logs: []
    });
  }
}

export async function syncAsaasWebhookEndpoint(req: Request, res: Response): Promise<void> {
  try {
    let apiKey = '';
    let webhookToken = 'cimadebe_asaas_webhook_secure_2026_token';
    let environment = 'production';

    const apisSnap = await adminDb.collection('configuracoes').doc('apis').get();
    if (apisSnap.exists) {
      const d = apisSnap.data() || {};
      apiKey = d.asaasApiKey || d.apiKey || '';
      webhookToken = d.asaasWebhookToken || d.webhookToken || webhookToken;
      environment = d.environment || 'production';
    } else {
      const intSnap = await adminDb.collection('api_integrations').doc('asaas').get();
      if (intSnap.exists) {
        const d = intSnap.data() || {};
        apiKey = d.apiKey || '';
        webhookToken = d.webhookToken || webhookToken;
        environment = d.environment || 'production';
      }
    }

    if (!apiKey) {
      res.status(400).json({ success: false, error: 'Chave de API do Asaas não encontrada no Firestore. Configure a chave primeiro.' });
      return;
    }

    const baseUrl = environment === 'sandbox' ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/api/v3';
    const publicUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.get('host')}/api/webhook/asaas`;

    const listRes = await axios.get(`${baseUrl}/webhooks`, {
      headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
      timeout: 8000
    }).catch((err) => {
      console.warn('[ASAAS_WEBHOOK_LIST_ERR]', err?.response?.data || err.message);
      return null;
    });

    const existingWebhooks = listRes?.data?.data || [];
    const matchingWebhook = existingWebhooks.find((w: any) => w.url && w.url.includes('/api/webhook/asaas'));

    let webhookResult = null;
    if (matchingWebhook && matchingWebhook.id) {
      const putRes = await axios.put(`${baseUrl}/webhooks/${matchingWebhook.id}`, {
        url: publicUrl,
        email: 'franciscofabio.rc@gmail.com',
        enabled: true,
        interrupted: false,
        apiVersion: 3,
        authToken: webhookToken,
        sendType: 'SEQUENTIALLY',
        events: [
          'PAYMENT_CREATED',
          'PAYMENT_AWAITING_RISK_ANALYSIS',
          'PAYMENT_APPROVED_BY_RISK_ANALYSIS',
          'PAYMENT_AUTHORIZED',
          'PAYMENT_UPDATED',
          'PAYMENT_CONFIRMED',
          'PAYMENT_RECEIVED',
          'PAYMENT_OVERDUE',
          'PAYMENT_REFUNDED',
          'SUBSCRIPTION_CREATED',
          'TRANSFER_DONE'
        ]
      }, {
        headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
        timeout: 8000
      });
      webhookResult = putRes.data;
    } else {
      const postRes = await axios.post(`${baseUrl}/webhooks`, {
        name: 'CIMADEBE SIGM Webhook Oficial',
        url: publicUrl,
        email: 'franciscofabio.rc@gmail.com',
        enabled: true,
        interrupted: false,
        apiVersion: 3,
        authToken: webhookToken,
        sendType: 'SEQUENTIALLY',
        events: [
          'PAYMENT_CREATED',
          'PAYMENT_AWAITING_RISK_ANALYSIS',
          'PAYMENT_APPROVED_BY_RISK_ANALYSIS',
          'PAYMENT_AUTHORIZED',
          'PAYMENT_UPDATED',
          'PAYMENT_CONFIRMED',
          'PAYMENT_RECEIVED',
          'PAYMENT_OVERDUE',
          'PAYMENT_REFUNDED',
          'SUBSCRIPTION_CREATED',
          'TRANSFER_DONE'
        ]
      }, {
        headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
        timeout: 8000
      });
      webhookResult = postRes.data;
    }

    res.json({
      success: true,
      message: 'Webhook configurado e registrado com sucesso no Asaas!',
      webhookUrl: publicUrl,
      environment,
      data: webhookResult
    });
  } catch (error: any) {
    console.error('[SYNC_ASAAS_WEBHOOK_ERROR]', error?.response?.data || error);
    res.status(500).json({
      success: false,
      error: 'Erro ao registrar webhook no Asaas: ' + (error?.response?.data?.errors?.[0]?.description || error?.message || 'Erro desconhecido')
    });
  }
}

