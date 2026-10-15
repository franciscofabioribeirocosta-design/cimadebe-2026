/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Hook React para Autenticação Biométrica FIDO2 / WebAuthn (useBiometricAuth.ts)
 */

import { useState, useCallback } from 'react';

export interface UseBiometricAuthOptions {
  email?: string;
  userId?: string;
  actionType?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function useBiometricAuth() {
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [actionTitle, setActionTitle] = useState<string>('Autorização Presidencial Requerida');

  const bufferToBase64Url = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  const challengeToUint8Array = (challengeStr: string): Uint8Array => {
    // If hex string or base64
    if (/^[0-9a-fA-F]+$/.test(challengeStr) && challengeStr.length % 2 === 0) {
      const bytes = new Uint8Array(challengeStr.length / 2);
      for (let i = 0; i < challengeStr.length; i += 2) {
        bytes[i / 2] = parseInt(challengeStr.substring(i, i + 2), 16);
      }
      return bytes;
    }
    // Base64url / text fallback
    const padding = '='.repeat((4 - (challengeStr.length % 4)) % 4);
    const base64 = (challengeStr + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const triggerBiometricAuth = useCallback(async (options: UseBiometricAuthOptions): Promise<boolean> => {
    const { email, userId, actionType = 'GOVERNANCE_ACTION', onSuccess, onError } = options;
    setIsVerifying(true);
    setErrorMsg(null);

    try {
      if (!window.PublicKeyCredential) {
        throw new Error('WebAuthn / Passkeys não são suportados neste navegador ou dispositivo.');
      }

      // 1. Fetch challenge from backend
      const resChallenge = await fetch('/api/biometrics/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, userId })
      });

      if (!resChallenge.ok) {
        const errJson = await resChallenge.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao gerar desafio biométrico no servidor.');
      }

      const challengeData = await resChallenge.json();
      const challengeBuffer = challengeToUint8Array(challengeData.challenge || challengeData.challengeHex);

      // 2. Trigger native hardware sensor (TouchID / FaceID / Windows Hello)
      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge: challengeBuffer.buffer as ArrayBuffer,
        timeout: 60000,
        userVerification: 'required',
        rpId: window.location.hostname
      };

      const assertion = (await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
      })) as PublicKeyCredential;

      if (!assertion) {
        throw new Error('A verificação biométrica foi cancelada pelo usuário.');
      }

      const response = assertion.response as AuthenticatorAssertionResponse;

      const credentialResponse = {
        id: assertion.id,
        rawId: bufferToBase64Url(assertion.rawId),
        authenticatorData: bufferToBase64Url(response.authenticatorData),
        clientDataJSON: bufferToBase64Url(response.clientDataJSON),
        signature: bufferToBase64Url(response.signature)
      };

      // 3. Send verification payload to backend
      const resVerify = await fetch('/api/biometrics/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          userId,
          challenge: challengeData.challengeHex || challengeData.challenge,
          credentialResponse,
          actionType
        })
      });

      if (!resVerify.ok) {
        const errJson = await resVerify.json().catch(() => ({}));
        throw new Error(errJson.error || 'A assinatura biométrica FIDO2 foi rejeitada pelo servidor.');
      }

      setIsVerifying(false);
      setModalOpen(false);
      if (onSuccess) onSuccess();
      return true;

    } catch (err: any) {
      console.error('[USE BIOMETRIC AUTH ERROR]:', err);
      const msg = err?.message || 'Erro desconhecido na autenticação biométrica.';
      setErrorMsg(msg);
      setIsVerifying(false);
      if (onError) onError(msg);
      return false;
    }
  }, []);

  return {
    isVerifying,
    modalOpen,
    setModalOpen,
    errorMsg,
    actionTitle,
    setActionTitle,
    triggerBiometricAuth
  };
}
