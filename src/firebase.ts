import { initializeApp } from 'firebase/app';
import { getFirestore, setLogLevel } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);

setLogLevel('error');

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

let storageInstance: any = null;
try {
  storageInstance = getStorage(app);
} catch (err) {
  console.warn('[FIREBASE STORAGE] Storage não provisionado no projeto. Modo Base64 ativo:', err);
}

export const storage = storageInstance;


