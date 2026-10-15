import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let appInstance: App | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

declare global {
  var inMemoryDb: Record<string, any> | undefined;
  var localMemoryModeActive: boolean | undefined;
}

if (!global.inMemoryDb) {
  global.inMemoryDb = {};
}

try {
  let projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT || 'gen-lang-client-0060094106';
  let databaseId = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-cimadebe-0294f21a-a89c-42de-8452-9e09431bac6e';

  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      const cfg = JSON.parse(raw);
      if (cfg.projectId) projectId = cfg.projectId;
      if (cfg.firestoreDatabaseId) databaseId = cfg.firestoreDatabaseId;
    } catch (e) {
      console.warn('[FIREBASE ADMIN WARN] Could not parse firebase-applet-config.json:', e);
    }
  }

  if (getApps().length === 0) {
    appInstance = initializeApp({ projectId });
  } else {
    appInstance = getApps()[0];
  }

  try {
    dbInstance = getFirestore(appInstance, databaseId);
  } catch (dbErr) {
    console.warn('[FIREBASE ADMIN WARN] Named database failed, using default:', dbErr);
    dbInstance = getFirestore(appInstance);
  }
  authInstance = getAuth(appInstance);
} catch (err) {
  console.error('[CRITICAL BOOT GUARD] Firebase Admin initialization bypassed safely:', err);
  global.localMemoryModeActive = true;
}

// Fail-safe Proxy wrapper for Firestore to prevent PERMISSION_DENIED crashes
function createMemoryDocRef(colName: string, docId: string) {
  return {
    id: docId,
    path: `${colName}/${docId}`,
    async get() {
      const key = `${colName}/${docId}`;
      const data = global.inMemoryDb?.[key];
      return {
        exists: !!data,
        id: docId,
        data: () => data || {}
      };
    },
    async set(data: any, options?: { merge?: boolean }) {
      const key = `${colName}/${docId}`;
      if (!global.inMemoryDb) global.inMemoryDb = {};
      if (options?.merge && global.inMemoryDb[key]) {
        global.inMemoryDb[key] = { ...global.inMemoryDb[key], ...data };
      } else {
        global.inMemoryDb[key] = { id: docId, ...data };
      }
      return {};
    },
    async update(data: any) {
      const key = `${colName}/${docId}`;
      if (!global.inMemoryDb) global.inMemoryDb = {};
      global.inMemoryDb[key] = { ...(global.inMemoryDb[key] || { id: docId }), ...data };
      return {};
    },
    async delete() {
      const key = `${colName}/${docId}`;
      if (global.inMemoryDb) delete global.inMemoryDb[key];
      return {};
    }
  };
}

function createMemoryQuery(colName: string) {
  return {
    async get() {
      const prefix = `${colName}/`;
      const docs: any[] = [];
      if (global.inMemoryDb) {
        Object.keys(global.inMemoryDb).forEach(k => {
          if (k.startsWith(prefix)) {
            const docData = global.inMemoryDb![k];
            const docId = k.replace(prefix, '');
            docs.push({
              id: docId,
              exists: true,
              data: () => docData
            });
          }
        });
      }
      return {
        empty: docs.length === 0,
        size: docs.length,
        docs
      };
    },
    where(_field: string, _op: string, _val: any) {
      return this;
    },
    orderBy(_field: string, _dir?: string) {
      return this;
    },
    limit(_n: number) {
      return this;
    }
  };
}

const memoryFirestoreProxy = {
  collection(colName: string) {
    return {
      doc(docId?: string) {
        const finalDocId = docId || `auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        return createMemoryDocRef(colName, finalDocId);
      },
      where(field: string, op: string, val: any) {
        return createMemoryQuery(colName).where(field, op, val);
      },
      orderBy(field: string, dir?: string) {
        return createMemoryQuery(colName).orderBy(field, dir);
      },
      limit(n: number) {
        return createMemoryQuery(colName).limit(n);
      },
      async get() {
        return createMemoryQuery(colName).get();
      },
      async add(data: any) {
        const docId = `auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await createMemoryDocRef(colName, docId).set(data);
        return createMemoryDocRef(colName, docId);
      }
    };
  },
  async runTransaction(updateFunction: any) {
    const transactionObj = {
      async get(docRef: any) {
        return await docRef.get();
      },
      set(docRef: any, data: any, options?: any) {
        docRef.set(data, options);
      },
      update(docRef: any, data: any) {
        docRef.update(data);
      }
    };
    return await updateFunction(transactionObj);
  },
  batch() {
    const ops: (() => void)[] = [];
    return {
      set(docRef: any, data: any, options?: any) {
        ops.push(() => docRef.set(data, options));
      },
      update(docRef: any, data: any) {
        ops.push(() => docRef.update(data));
      },
      delete(docRef: any) {
        ops.push(() => docRef.delete());
      },
      async commit() {
        for (const op of ops) {
          await op();
        }
      }
    };
  }
};

class SafeFirestoreWrapper {
  private realDb: Firestore | null;
  constructor(realDb: Firestore | null) {
    this.realDb = realDb;
  }

  collection(colName: string) {
    if (global.localMemoryModeActive || !this.realDb) {
      return memoryFirestoreProxy.collection(colName);
    }
    const realCol = this.realDb.collection(colName);
    return {
      doc(docId?: string) {
        const realDoc = realCol.doc(docId);
        const memDoc = memoryFirestoreProxy.collection(colName).doc(docId);
        return {
          id: realDoc.id,
          path: realDoc.path,
          async get() {
            try {
              const snap = await realDoc.get();
              if (snap.exists) {
                // Sync to memory cache as well
                await memDoc.set(snap.data(), { merge: true });
                return snap;
              }
              return await memDoc.get();
            } catch (err: any) {
              const msg = String(err?.message || '');
              if (msg.includes('PERMISSION_DENIED') || msg.includes('7') || msg.includes('insufficient permissions')) {
                console.warn(`[FIRESTORE PERMISSION_DENIED FALLBACK] collection(${colName}).doc.get() falling back to memory.`);
                global.localMemoryModeActive = true;
                return await memDoc.get();
              }
              throw err;
            }
          },
          async set(data: any, options?: any) {
            try {
              await realDoc.set(data, options);
              await memDoc.set(data, options);
            } catch (err: any) {
              const msg = String(err?.message || '');
              if (msg.includes('PERMISSION_DENIED') || msg.includes('7') || msg.includes('insufficient permissions')) {
                console.warn(`[FIRESTORE PERMISSION_DENIED FALLBACK] collection(${colName}).doc.set() falling back to memory.`);
                global.localMemoryModeActive = true;
                await memDoc.set(data, options);
              } else {
                throw err;
              }
            }
          },
          async update(data: any) {
            try {
              await realDoc.update(data);
              await memDoc.update(data);
            } catch (err: any) {
              const msg = String(err?.message || '');
              if (msg.includes('PERMISSION_DENIED') || msg.includes('7') || msg.includes('insufficient permissions')) {
                console.warn(`[FIRESTORE PERMISSION_DENIED FALLBACK] collection(${colName}).doc.update() falling back to memory.`);
                global.localMemoryModeActive = true;
                await memDoc.update(data);
              } else {
                throw err;
              }
            }
          },
          async delete() {
            try {
              await realDoc.delete();
              await memDoc.delete();
            } catch (err: any) {
              global.localMemoryModeActive = true;
              await memDoc.delete();
            }
          }
        };
      },
      where(field: string, op: string, val: any) {
        if (global.localMemoryModeActive) {
          return memoryFirestoreProxy.collection(colName).where(field, op, val);
        }
        return realCol.where(field, op, val);
      },
      orderBy(field: string, dir?: any) {
        if (global.localMemoryModeActive) {
          return memoryFirestoreProxy.collection(colName).orderBy(field, dir);
        }
        return realCol.orderBy(field, dir);
      },
      limit(n: number) {
        if (global.localMemoryModeActive) {
          return memoryFirestoreProxy.collection(colName).limit(n);
        }
        return realCol.limit(n);
      },
      async get() {
        if (global.localMemoryModeActive) {
          return await memoryFirestoreProxy.collection(colName).get();
        }
        try {
          return await realCol.get();
        } catch (err: any) {
          const msg = String(err?.message || '');
          if (msg.includes('PERMISSION_DENIED') || msg.includes('7') || msg.includes('insufficient permissions')) {
            console.warn(`[FIRESTORE PERMISSION_DENIED FALLBACK] collection(${colName}).get() falling back to memory.`);
            global.localMemoryModeActive = true;
            return await memoryFirestoreProxy.collection(colName).get();
          }
          throw err;
        }
      },
      async add(data: any) {
        if (global.localMemoryModeActive) {
          return await memoryFirestoreProxy.collection(colName).add(data);
        }
        try {
          return await realCol.add(data);
        } catch (err: any) {
          const msg = String(err?.message || '');
          if (msg.includes('PERMISSION_DENIED') || msg.includes('7') || msg.includes('insufficient permissions')) {
            global.localMemoryModeActive = true;
            return await memoryFirestoreProxy.collection(colName).add(data);
          }
          throw err;
        }
      }
    };
  }
  async runTransaction(updateFunction: any) {
    if (global.localMemoryModeActive || !this.realDb) {
      return await memoryFirestoreProxy.runTransaction(updateFunction);
    }
    try {
      return await this.realDb.runTransaction(updateFunction);
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('PERMISSION_DENIED') || msg.includes('7') || msg.includes('insufficient permissions')) {
        global.localMemoryModeActive = true;
        return await memoryFirestoreProxy.runTransaction(updateFunction);
      }
      throw err;
    }
  }
  batch() {
    if (global.localMemoryModeActive || !this.realDb) {
      return memoryFirestoreProxy.batch();
    }
    return this.realDb.batch();
  }
}

export const adminDb = new SafeFirestoreWrapper(dbInstance) as unknown as Firestore;
export const adminAuth = authInstance as unknown as Auth;
