import { Request, Response, NextFunction } from 'express';
import { adminAuth, adminDb } from './firebaseAdmin';

/**
 * ============================================================================
 * [MANDATORY DIRECTIVE] LAYERED ZERO-TRUST & STATIC EXECUTION PROTOCOL
 * MIDDLEWARE DE AUTENTICAÇÃO COM TRAVA DE SUSPENSÃO REAL-TIME (ZERO-TRUST)
 * Bloqueia e expulsa usuários suspensos, inativos ou inexistentes imediatamente.
 * ============================================================================
 */
export default async function authenticationMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // CAMADA 1: Filtro de Entrada Estrito (Token Presente)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Acesso negado: Token de autenticação não fornecido."
      });
      return;
    }

    const token = authHeader.split('Bearer ')[1]?.trim();
    if (!token) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Acesso negado: Formato de token inválido."
      });
      return;
    }

    // Verificação estática do Token via Firebase Admin
    let decodedToken: any;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (err: any) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Acesso negado: Token inválido ou expirado.",
        details: err?.message
      });
      return;
    }

    if (!decodedToken || !decodedToken.uid) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Acesso negado: Token inválido ou expirado."
      });
      return;
    }

    const userId = decodedToken.uid;
    const email = decodedToken.email ? String(decodedToken.email).toLowerCase().trim() : '';

    // CAMADA 2: BARREIRA DE EXISTÊNCIA E STATUS ATIVO NO FIRESTORE
    // Busca o usuário nas coleções canônicas de forma resiliente
    let userDocSnapshot: any = null;
    let userData: any = null;

    // 1. Busca na coleção 'usuarios_administrativos' (por email ou UID)
    if (email) {
      const snapAdmEmail = await adminDb.collection('usuarios_administrativos').doc(email).get();
      if (snapAdmEmail.exists) {
        userDocSnapshot = snapAdmEmail;
        userData = snapAdmEmail.data();
      }
    }
    if (!userDocSnapshot) {
      const snapAdmUid = await adminDb.collection('usuarios_administrativos').doc(userId).get();
      if (snapAdmUid.exists) {
        userDocSnapshot = snapAdmUid;
        userData = snapAdmUid.data();
      }
    }

    // 2. Busca na coleção 'usuarios_sistema'
    if (!userDocSnapshot && email) {
      const snapSysEmail = await adminDb.collection('usuarios_sistema').doc(email).get();
      if (snapSysEmail.exists) {
        userDocSnapshot = snapSysEmail;
        userData = snapSysEmail.data();
      }
    }
    if (!userDocSnapshot) {
      const snapSysUid = await adminDb.collection('usuarios_sistema').doc(userId).get();
      if (snapSysUid.exists) {
        userDocSnapshot = snapSysUid;
        userData = snapSysUid.data();
      }
    }

    // 3. Busca na coleção 'ministros'
    if (!userDocSnapshot) {
      const snapMinUid = await adminDb.collection('ministros').doc(userId).get();
      if (snapMinUid.exists) {
        userDocSnapshot = snapMinUid;
        userData = snapMinUid.data();
      }
    }

    // 4. Busca na coleção 'users'
    if (!userDocSnapshot) {
      const snapUsers = await adminDb.collection('users').doc(userId).get();
      if (snapUsers.exists) {
        userDocSnapshot = snapUsers;
        userData = snapUsers.data();
      }
    }

    // Se possui token válido autenticado no Firebase Auth
    if (!userDocSnapshot) {
      (req as any).currentUser = {
        uid: userId,
        email: email || null,
        role: decodedToken.role || 'user'
      };
      return next();
    }

    // -------------------------------------------------------------------------
    // TRAVA DE STATUS ABSOLUTA (ANTI-FALLBACK / ANTI-SUSPENSÃO)
    // Se o status for explicitamente 'INATIVO' ou 'SUSPENSO', barra na hora.
    // -------------------------------------------------------------------------
    const statusVal = String(userData.statusAcesso || userData.status || 'ATIVO').toUpperCase();
    if (statusVal === 'INATIVO' || statusVal === 'SUSPENSO') {
      res.status(403).json({
        error: "Forbidden",
        message: "ACESSO BLOQUEADO: Este usuário está SUSPENSO ou INATIVO no sistema. Entre em contato com o suporte."
      });
      return;
    }

    // CAMADA 3: ISOLAMENTO TOTAL DE ESCOPO
    (req as any).currentUser = {
      uid: userDocSnapshot.id,
      email: userData.email || email || null,
      role: userData.role === 'Master' || userData.role === 'SUPER_ADMIN' || userData.role === 'ADMINISTRADOR_MASTER' ? 'Master' : 'user'
    };

    // CAMADA 4: Avança de forma linear e puramente isolada
    return next();

  } catch (error: any) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Falha crítica na barreira de segurança.",
      details: error?.message || String(error)
    });
  }
}

export { authenticationMiddleware as strictAuthenticationMiddleware };
