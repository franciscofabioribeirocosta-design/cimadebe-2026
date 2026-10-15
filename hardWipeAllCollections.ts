/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Standalone Hard Wipe & System Reset Script (hardWipeAllCollections.ts)
 * Permanently erases all Firestore collections, subcollections, auth users, and resets setup status.
 */

import { adminDb, adminAuth } from './server/firebaseAdmin';

const TARGET_COLLECTIONS = [
  'membros',
  'ministros',
  'anuidades',
  'usuarios_sistema',
  'usuarios_administrativos',
  'CadastroConvencao',
  'configuracoes_sistema',
  'parametros_financeiros',
  'audit_logs',
  'financial_logs',
  'inscricoes_ago',
  'lancamentos_ago',
  'dre_ago_totais',
  'totais_financeiros',
  'eventos',
  'noticias',
  'cronograma_ago',
  'notificacoes',
  'biometric_credentials',
  'biometric_challenges'
];

export async function runHardWipe() {
  console.log('=================================================================');
  console.log('[HARD WIPE EXECUTION STARTED] Eradicating all Firestore & Auth records...');
  console.log('=================================================================');

  if (!adminDb) {
    console.error('[FATAL] adminDb is not initialized. Aborting hard wipe.');
    return;
  }

  // 1. Physical Collection & Subcollection Wipe using recursiveDelete or chunked batch
  for (const collectionName of TARGET_COLLECTIONS) {
    try {
      console.log(`[WIPE] Processing collection: "${collectionName}"...`);
      const collectionRef = adminDb.collection(collectionName);
      
      if (typeof adminDb.recursiveDelete === 'function') {
        await adminDb.recursiveDelete(collectionRef);
        console.log(`[SUCCESS] Recursive delete completed for collection: "${collectionName}"`);
      } else {
        let deletedCount = 0;
        let snapshot = await collectionRef.limit(500).get();
        while (!snapshot.empty) {
          const batch = adminDb.batch();
          snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
            deletedCount++;
          });
          await batch.commit();
          snapshot = await collectionRef.limit(500).get();
        }
        console.log(`[SUCCESS] Chunked batch delete completed for collection: "${collectionName}" (${deletedCount} docs)`);
      }
    } catch (err: any) {
      console.warn(`[WARN] Error wiping collection "${collectionName}":`, err?.message || err);
    }
  }

  // 2. Firebase Auth User Purge
  if (adminAuth) {
    try {
      console.log('[WIPE] Fetching Firebase Auth users for deletion...');
      let listUsersResult = await adminAuth.listUsers(1000);
      while (listUsersResult.users.length > 0) {
        const uids = listUsersResult.users.map((user) => user.uid);
        console.log(`[WIPE] Deleting batch of ${uids.length} Firebase Auth users...`);
        await adminAuth.deleteUsers(uids);
        if (listUsersResult.pageToken) {
          listUsersResult = await adminAuth.listUsers(1000, listUsersResult.pageToken);
        } else {
          break;
        }
      }
      console.log('[SUCCESS] All Firebase Auth users successfully purged.');
    } catch (err: any) {
      console.warn('[WARN] Error purging Firebase Auth users:', err?.message || err);
    }
  } else {
    console.warn('[WARN] adminAuth is not initialized. Skipping Auth user purge.');
  }

  // 3. State Force System Wizard Override (Reset Setup Status)
  try {
    console.log('[WIPE] Resetting system configuration status to unconfigured state...');
    await adminDb.collection('configuracoes_sistema').doc('status_geral').set({
      setup_concluido: false,
      sistemaAtivo: false,
      resetAt: new Date().toISOString(),
      reason: 'Hard Wipe Executive Command Executed'
    });
    console.log('[SUCCESS] System configuration reset successfully. Setup wizard will render on next boot.');
  } catch (err: any) {
    console.error('[FATAL] Failed to write status_geral reset:', err?.message || err);
  }

  console.log('=================================================================');
  console.log('[HARD WIPE COMPLETED] All databases and auth instances have been wiped.');
  console.log('=================================================================');
}
