import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let projectId = process.env.FIREBASE_PROJECT_ID || 'ai-studio-cimadebesigmcore';
let databaseId = process.env.FIRESTORE_DATABASE_ID || '(default)';

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
if (fs.existsSync(configPath)) {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const cfg = JSON.parse(raw);
    if (cfg.projectId) projectId = cfg.projectId;
    if (cfg.firestoreDatabaseId) databaseId = cfg.firestoreDatabaseId;
  } catch (e) {
    console.warn('Could not parse config path:', e);
  }
}

console.log(`Connecting to Project ID: ${projectId}, Database ID: ${databaseId}`);

const app = getApps().length === 0 ? initializeApp({ projectId }) : getApps()[0];
const db = getFirestore(app, databaseId);
const auth = getAuth(app);

const COLLECTIONS = [
  'membros',
  'ministros',
  'anuidades',
  'usuarios_sistema',
  'usuarios_administrativos',
  'CadastroConvencao',
  'configuracoes_sistema',
  'parametros_financeiros',
  'audit_logs',
  'eventos',
  'noticias',
  'inscricoes_ago',
  'logs_auditoria_ago_filiacao',
  'pagamentos_filiacao',
  'transacoes_processadas',
  'totais_financeiros',
  'chaves_licenca_sistema',
  'cms_config',
  'transacoes_processadas'
];

async function deleteCollection(collectionPath: string) {
  const collectionRef = db.collection(collectionPath);
  const snapshot = await collectionRef.limit(100).get();
  
  if (snapshot.size === 0) {
    console.log(`Collection ${collectionPath} is already empty.`);
    return;
  }
  
  console.log(`Deleting ${snapshot.size} documents in ${collectionPath}...`);
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  // Recurse until empty
  await deleteCollection(collectionPath);
}

async function purgeAuthUsers() {
  console.log('Purging Firebase Authentication users...');
  let pageToken: string | undefined = undefined;
  let count = 0;
  
  do {
    const listUsersResult = await auth.listUsers(100, pageToken);
    const uids = listUsersResult.users.map((user) => user.uid);
    
    if (uids.length > 0) {
      await auth.deleteUsers(uids);
      count += uids.length;
      console.log(`Deleted ${uids.length} users.`);
    }
    
    pageToken = listUsersResult.pageToken;
  } while (pageToken);
  
  console.log(`Auth purge completed. Total users deleted: ${count}`);
}

async function main() {
  console.log('--- STARTING ARCHITECTURE PURGE ---');
  
  for (const coll of COLLECTIONS) {
    try {
      console.log(`Purging Firestore collection: ${coll}`);
      await deleteCollection(coll);
    } catch (err: any) {
      console.error(`Error purging ${coll}:`, err?.message || err);
    }
  }
  
  try {
    await purgeAuthUsers();
  } catch (err: any) {
    console.error('Error purging Auth users:', err?.message || err);
  }
  
  console.log('--- ARCHITECTURE PURGE SUCCEEDED ---');
}

main().catch((err) => {
  console.error('Purge script failed:', err);
  process.exit(1);
});
