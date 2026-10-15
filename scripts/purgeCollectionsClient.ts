import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const raw = fs.readFileSync(configPath, 'utf8');
const firebaseConfig = JSON.parse(raw);

console.log(`Connecting via client SDK to Project ID: ${firebaseConfig.projectId}, Database ID: ${firebaseConfig.firestoreDatabaseId}`);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

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
  'membros_mesa_diretora',
  'igrejas',
  'planos_ago',
  'lancamentos_ago'
];

async function deleteCollection(collectionPath: string) {
  const colRef = collection(db, collectionPath);
  const snapshot = await getDocs(colRef);
  
  if (snapshot.empty) {
    console.log(`Collection ${collectionPath} is empty.`);
    return;
  }
  
  console.log(`Deleting ${snapshot.size} documents in ${collectionPath}...`);
  for (const docSnap of snapshot.docs) {
    await deleteDoc(doc(db, collectionPath, docSnap.id));
  }
  console.log(`Collection ${collectionPath} completely deleted.`);
}

async function main() {
  console.log('--- STARTING CLIENT-SIDE FIRESTORE PURGE ---');
  for (const coll of COLLECTIONS) {
    try {
      await deleteCollection(coll);
    } catch (err: any) {
      console.error(`Error deleting ${coll}:`, err?.message || err);
    }
  }
  console.log('--- CLIENT-SIDE FIRESTORE PURGE COMPLETED ---');
}

main().catch((err) => {
  console.error('Client-side purge failed:', err);
  process.exit(1);
});
