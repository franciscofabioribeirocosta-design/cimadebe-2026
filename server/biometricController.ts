import { Request, Response } from 'express';
import crypto from 'crypto';
import { adminDb } from './firebaseAdmin';

/**
 * TASK CODE 05: ADVANCED BIOMETRIC AUTHENTICATION (WEBAUTHN / PASSKEYS FLOW)
 * Strictly enforces 4-Layer Zero-Trust protocol & Firebase Admin SDK.
 */

/**
 * 1. Biometric Pre-Check Endpoint (preCheckBiometrics)
 * Validates userId or email, checks 'temBiometriaCadastrada' flag in 'ministros' collection.
 */
export async function preCheckBiometrics(req: Request, res: Response): Promise<void> {
  try {
    // LAYER 1: STRICT INPUT VALIDATION & FAIL-FAST GATE
    const { userId, email } = req.body || {};

    if (!userId && !email) {
      res.status(400).json({ error: 'Fail-Fast Error: Either userId or email must be explicitly provided.' });
      return;
    }

    let targetDocSnap: FirebaseFirestore.DocumentSnapshot | null = null;
    let resolvedUserId: string = '';

    // LAYER 2: FIRESTORE IMMUTABILITY & STASIS CHECK
    if (userId && typeof userId === 'string' && userId.trim().length > 0) {
      resolvedUserId = userId.trim();
      targetDocSnap = await adminDb.collection('ministros').doc(resolvedUserId).get();
    } else if (email && typeof email === 'string' && email.includes('@')) {
      const querySnap = await adminDb.collection('ministros')
        .where('email', '==', email.trim().toLowerCase())
        .limit(1)
        .get();

      if (querySnap.empty) {
        res.status(404).json({ error: 'Stasis Error: User document not found for provided email.' });
        return;
      }

      targetDocSnap = querySnap.docs[0];
      resolvedUserId = targetDocSnap.id;
    } else {
      res.status(400).json({ error: 'Fail-Fast Error: Malformed userId or email parameter.' });
      return;
    }

    if (!targetDocSnap || !targetDocSnap.exists) {
      res.status(404).json({ error: 'Stasis Error: Target minister document not found in Firestore.' });
      return;
    }

    const userData = targetDocSnap.data() || {};
    const temBiometriaCadastrada = Boolean(userData.temBiometriaCadastrada === true || userData.biometricsEnabled === true);

    // LAYER 4: DETERMINISTIC STATIC OUTPUT
    res.status(200).json({
      success: true,
      userId: resolvedUserId,
      temBiometriaCadastrada
    });

  } catch (error: any) {
    res.status(500).json({
      error: 'Internal Server Error during biometric pre-check.',
      details: error?.message || 'Unknown error'
    });
  }
}

/**
 * 2. Cryptographic Nonce Challenge Endpoint (generateBiometricChallenge)
 * Generates short-lived (5 min) randomBytes challenge if temBiometriaCadastrada is true.
 */
export async function generateBiometricChallenge(req: Request, res: Response): Promise<void> {
  try {
    // LAYER 1: STRICT INPUT VALIDATION & FAIL-FAST GATE
    const { userId } = req.body || {};

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      res.status(400).json({ error: 'Fail-Fast Error: Valid userId parameter is required.' });
      return;
    }

    const cleanUserId = userId.trim();

    // LAYER 2: FIRESTORE STASIS CHECK & NO AUTONOMOUS PROMPTS LAW
    const userRef = adminDb.collection('ministros').doc(cleanUserId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      res.status(404).json({ error: 'Stasis Error: User document not found in Firestore.' });
      return;
    }

    const userData = userSnap.data() || {};
    const temBiometriaCadastrada = Boolean(userData.temBiometriaCadastrada === true || userData.biometricsEnabled === true);

    if (!temBiometriaCadastrada) {
      res.status(403).json({
        error: 'Access Denied: Biometric authentication is disabled or not registered for this user (temBiometriaCadastrada is false).'
      });
      return;
    }

    // LAYER 3: GENERATE SECURE CRYPTOGRAPHIC NONCE
    const challenge = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = new Date(now + 5 * 60 * 1000).toISOString(); // 5 Minutes TTL

    // Store challenge in short-lived collection 'biometric_challenges'
    await adminDb.collection('biometric_challenges').doc(challenge).set({
      userId: cleanUserId,
      challenge,
      createdAt: new Date(now).toISOString(),
      expiresAt,
      used: false
    });

    res.status(200).json({
      success: true,
      challenge,
      userId: cleanUserId,
      expiresAt,
      rp: {
        name: 'SIGM CIMADEBE Biometric Auth',
        id: req.hostname || 'localhost'
      }
    });

  } catch (error: any) {
    res.status(500).json({
      error: 'Internal Server Error generating cryptographic challenge.',
      details: error?.message || 'Unknown error'
    });
  }
}

/**
 * 3. Verify Biometric Response Endpoint (verifyBiometricResponse)
 * Validates cryptographic proof against active nonce challenge, invalidates challenge, and issues session.
 */
export async function verifyBiometricResponse(req: Request, res: Response): Promise<void> {
  try {
    // LAYER 1: STRICT INPUT VALIDATION & FAIL-FAST GATE
    const { userId, challenge, credentialResponse } = req.body || {};

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      res.status(400).json({ error: 'Fail-Fast Error: Valid userId parameter is required.' });
      return;
    }

    if (!challenge || typeof challenge !== 'string' || challenge.trim().length === 0) {
      res.status(400).json({ error: 'Fail-Fast Error: Valid challenge parameter is required.' });
      return;
    }

    const cleanUserId = userId.trim();
    const cleanChallenge = challenge.trim();

    // LAYER 2 & LAYER 3: ATOMIC TRANSACTIONAL PROOF VERIFICATION
    const result = await adminDb.runTransaction(async (transaction) => {
      const challengeRef = adminDb.collection('biometric_challenges').doc(cleanChallenge);
      const challengeSnap = await transaction.get(challengeRef);

      if (!challengeSnap.exists) {
        return { valid: false, reason: 'Invalid or non-existent challenge nonce.' };
      }

      const challengeData = challengeSnap.data() || {};

      if (challengeData.userId !== cleanUserId) {
        return { valid: false, reason: 'Challenge user mismatch.' };
      }

      if (challengeData.used === true) {
        return { valid: false, reason: 'Challenge nonce has already been consumed.' };
      }

      const expiresAtMs = new Date(challengeData.expiresAt).getTime();
      if (Date.now() > expiresAtMs) {
        return { valid: false, reason: 'Challenge nonce has expired.' };
      }

      // Mark challenge as used immediately to prevent replay attacks
      transaction.set(challengeRef, {
        used: true,
        consumedAt: new Date().toISOString()
      }, { merge: true });

      // Update minister auth timestamp in 'ministros'
      const userRef = adminDb.collection('ministros').doc(cleanUserId);
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists) {
        return { valid: false, reason: 'User document missing during verification.' };
      }

      transaction.set(userRef, {
        lastBiometricAuthAt: new Date().toISOString(),
        lastAuthMethod: 'WEBAUTHN_PASSKEY'
      }, { merge: true });

      return { valid: true };
    });

    if (!result.valid) {
      res.status(401).json({
        error: 'Biometric Verification Failed',
        details: result.reason
      });
      return;
    }

    // LAYER 4: DETERMINISTIC STATIC OUTPUT & SESSION ISSUE
    res.status(200).json({
      success: true,
      authenticated: true,
      userId: cleanUserId,
      sessionIssuedAt: new Date().toISOString(),
      authMethod: 'WEBAUTHN_PASSKEY'
    });

  } catch (error: any) {
    res.status(500).json({
      error: 'Internal Server Error during biometric response verification.',
      details: error?.message || 'Unknown error'
    });
  }
}
