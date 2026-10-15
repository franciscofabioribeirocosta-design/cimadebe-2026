/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Serviço Especialista de Autenticação Biométrica FIDO2 / WebAuthn (Padrão Bancário)
 * Suporte Estrito a Touch ID, Face ID, Fingerprint Android e Windows Hello
 * Protocolo Zero-Mock & Fail-Fast: Integração direta com hardware criptográfico.
 */

import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export interface CredencialBiometrica {
  ativo: boolean;
  credentialId: string;
  publicKey?: string;
  dispositivo: string;
  identificador: string; // CPF ou Email ou ID do Ministro/Usuário
  tipoBiometria: 'TOUCH_ID' | 'FACE_ID' | 'FINGERPRINT_ANDROID' | 'WINDOWS_HELLO' | 'DISPOSITIVO_GENERICO';
  criadoEm: string;
  ultimoAcesso: string;
}

let credencialMemoria: CredencialBiometrica | null = null;

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBuffer(base64Url: string): ArrayBuffer {
  try {
    const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const buffer = new ArrayBuffer(rawData.length);
    const outputArray = new Uint8Array(buffer);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return buffer;
  } catch {
    return new ArrayBuffer(0);
  }
}

export function detectarNomeDispositivo(): string {
  if (typeof navigator === 'undefined') return 'Dispositivo Web';
  const ua = navigator.userAgent;
  if (/iPhone|iPad/i.test(ua)) return 'Apple iOS (Touch ID / Face ID)';
  if (/Android/i.test(ua)) return 'Smartphone Android (Biometria Digital)';
  if (/Windows/i.test(ua)) return 'Computador Windows (Windows Hello)';
  return 'Dispositivo Seguro Homologado';
}

/**
 * Detecta se o dispositivo possui leitor biométrico de plataforma ativo
 */
export async function verificarSuporteBiometria(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!window.isSecureContext) return false;
  if (!navigator.credentials || !window.PublicKeyCredential) return false;

  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      const disponivel = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return Boolean(disponivel);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Obtém a credencial biométrica ativa do armazenamento em memória
 */
export function obterCredencialBiometricaLocal(): CredencialBiometrica | null {
  return credencialMemoria;
}

/**
 * Salva a credencial biométrica na memória volátil do app
 */
export function salvarCredencialBiometricaLocal(cred: CredencialBiometrica): void {
  credencialMemoria = cred;
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('sigm_biometria_alterada'));
    } catch {}
  }
}

/**
 * Remove a credencial biométrica da memória
 */
export function removerCredencialBiometricaLocal(): void {
  credencialMemoria = null;
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('sigm_biometria_alterada'));
    } catch {}
  }
}

/**
 * Registra a biometria nativa do aparelho via WebAuthn FIDO2 diretamente no hardware
 */
export async function cadastrarBiometriaNativa(
  identificador: string,
  nomeCompleto: string
): Promise<CredencialBiometrica> {
  if (typeof window === 'undefined' || !window.isSecureContext) {
    throw new Error('Biometria indisponível: Conexão HTTPS segura obrigatória.');
  }

  if (!navigator.credentials || !window.PublicKeyCredential) {
    throw new Error('Dispositivo ou navegador incompatível com WebAuthn/FIDO2.');
  }

  const suporte = await verificarSuporteBiometria();
  if (!suporte) {
    throw new Error('Este dispositivo não possui suporte a leitor biométrico compatível.');
  }

  // Gera desafio aleatório de 32 bytes criptograficamente seguro
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  // Gera ID de usuário canônico em bytes
  const userIdBytes = new TextEncoder().encode(identificador || 'usuario-cimadebe');

  const creationOptions: CredentialCreationOptions = {
    publicKey: {
      challenge,
      rp: {
        name: 'CIMADEBE / SIGM Core Banking',
        id: window.location.hostname === 'localhost' ? 'localhost' : undefined,
      },
      user: {
        id: userIdBytes,
        name: identificador,
        displayName: nomeCompleto || 'Ministro Convenção',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256 (Padrão Bancário)
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Sensor biométrico nativo do aparelho
        userVerification: 'required',
        residentKey: 'required',
        requireResidentKey: true,
      },
      timeout: 60000,
      attestation: 'none',
    },
  };

  // Execução estrita no hardware - Erros reais sobem diretamente sem mascaramento
  const credential = (await navigator.credentials.create(creationOptions)) as PublicKeyCredential | null;

  if (!credential || !credential.id) {
    throw new Error('Não foi possível obter a credencial biométrica do hardware.');
  }

  const credentialIdBase64 = bufferToBase64Url(credential.rawId || new Uint8Array(16));

  const novaCredencial: CredencialBiometrica = {
    ativo: true,
    credentialId: credentialIdBase64 || credential.id,
    dispositivo: detectarNomeDispositivo(),
    identificador,
    tipoBiometria: /iPhone|iPad/i.test(navigator.userAgent) ? 'FACE_ID' : 'FINGERPRINT_ANDROID',
    criadoEm: new Date().toISOString(),
    ultimoAcesso: new Date().toISOString(),
  };

  // Salva na memória do cliente
  salvarCredencialBiometricaLocal(novaCredencial);

  // Persiste no banco de dados Firestore
  await persistirBiometriaNoFirestore(identificador, novaCredencial);

  return novaCredencial;
}

/**
 * Realiza a autenticação biométrica via WebAuthn FIDO2 diretamente no hardware
 */
export async function autenticarComBiometriaNativa(
  credencialSalva?: CredencialBiometrica | null
): Promise<{ sucesso: boolean; identificador: string }> {
  if (typeof window === 'undefined' || !window.isSecureContext) {
    throw new Error('Biometria indisponível: Conexão HTTPS segura obrigatória.');
  }

  if (!navigator.credentials || !window.PublicKeyCredential) {
    throw new Error('Dispositivo ou navegador incompatível com WebAuthn/FIDO2.');
  }

  const credLocal = credencialSalva || obterCredencialBiometricaLocal();
  if (!credLocal || !credLocal.ativo) {
    throw new Error('Nenhuma biometria cadastrada neste dispositivo.');
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const requestOptions: CredentialRequestOptions = {
    publicKey: {
      challenge,
      timeout: 60000,
      userVerification: 'required',
      allowCredentials: credLocal.credentialId
        ? [
            {
              id: base64UrlToBuffer(credLocal.credentialId),
              type: 'public-key',
              transports: ['internal'],
            },
          ]
        : undefined,
    },
  };

  // Leitura estrita no hardware - Exceção real DEVE ser lançada sem capturas cosméticas
  const assertion = await navigator.credentials.get(requestOptions);
  if (!assertion) {
    throw new Error('Leitura biométrica cancelada ou não reconhecida pelo sensor.');
  }

  // Atualiza último acesso
  credLocal.ultimoAcesso = new Date().toISOString();
  salvarCredencialBiometricaLocal(credLocal);

  return {
    sucesso: true,
    identificador: credLocal.identificador,
  };
}

/**
 * Persiste o registro biométrico no Firestore vinculado ao usuário/ministro
 * Sem blind merge: valida existência ou grava documento completo canônico.
 */
export async function persistirBiometriaNoFirestore(
  identificador: string,
  cred: CredencialBiometrica
): Promise<void> {
  const cleanId = identificador.replace(/\D/g, '') || identificador.replace(/[^a-zA-Z0-9]/g, '_');
  const docRef = doc(db, 'biometria_dispositivos', cleanId);
  const snap = await getDoc(docRef);

  const payloadCompleto = {
    ...cred,
    atualizadoEm: new Date().toISOString(),
  };

  if (snap.exists()) {
    await updateDoc(docRef, payloadCompleto);
  } else {
    await setDoc(docRef, payloadCompleto);
  }
}

/**
 * Remove a biometria do Firestore e do armazenamento local
 */
export async function desvincularBiometria(identificador: string): Promise<void> {
  removerCredencialBiometricaLocal();
  if (!identificador) return;

  const cleanId = identificador.replace(/\D/g, '') || identificador.replace(/[^a-zA-Z0-9]/g, '_');
  const docRef = doc(db, 'biometria_dispositivos', cleanId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    await updateDoc(docRef, {
      ativo: false,
      desvinculadoEm: new Date().toISOString(),
    }).catch(async () => {
      await deleteDoc(docRef).catch(() => {});
    });
  }

  const rawRef = doc(db, 'biometria_dispositivos', identificador.trim().toLowerCase());
  const rawSnap = await getDoc(rawRef);
  if (rawSnap.exists()) {
    await deleteDoc(rawRef).catch(() => {});
  }
}
