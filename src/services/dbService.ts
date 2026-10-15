import { doc, getDoc, setDoc, Firestore } from 'firebase/firestore';

export interface ApisConfig {
  asaasApiKey?: string;
  asaasWebhookToken?: string;
  environment?: 'sandbox' | 'production';
  whatsappApiKey?: string;
  whatsappInstanceToken?: string;
  supportWebhookUrl?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  updatedAt?: string;
}

/**
 * Retrieves the centralized APIs configuration from 'configuracoes/apis'.
 * @param db Firestore client instance.
 */
export async function getApisConfig(db: Firestore): Promise<ApisConfig | null> {
  try {
    const docRef = doc(db, 'configuracoes', 'apis');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as ApisConfig;
    }
    return null;
  } catch (error) {
    console.error('[dbService] Failed to retrieve API configuration:', error);
    throw error;
  }
}

/**
 * Updates the centralized APIs configuration inside 'configuracoes/apis'.
 * @param db Firestore client instance.
 * @param data Partial configuration data to write.
 */
export async function updateApisConfig(db: Firestore, data: Partial<ApisConfig>): Promise<void> {
  try {
    const docRef = doc(db, 'configuracoes', 'apis');
    await setDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.error('[dbService] Failed to write API configuration:', error);
    throw error;
  }
}
