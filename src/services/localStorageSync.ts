/**
 * @license
 * CIMADEBE / SIGM - Core Banking
 * Strict Zero-Storage Protocol: All LocalStorage and SessionStorage usage has been permanently purged.
 * Operates strictly in-memory (ephemeral state).
 */

import { Ministro, AnuidadeMinistro } from '../types';
import { DbEvento, DbNoticia } from '../db/databaseService';

export class LocalStorageSyncService {
  public static getMinistrosLocais(): readonly Ministro[] {
    return [];
  }

  public static saveMinistrosLocais(_ministros: readonly Ministro[]): void {
    // No-op: Zero localStorage persistence
  }

  public static getAnuidadesLocais(): readonly AnuidadeMinistro[] {
    return [];
  }

  public static saveAnuidadesLocais(_anuidades: readonly AnuidadeMinistro[]): void {
    // No-op: Zero localStorage persistence
  }

  public static getEventosLocais(): readonly DbEvento[] {
    return [];
  }

  public static saveEventosLocais(_eventos: readonly DbEvento[]): void {
    // No-op: Zero localStorage persistence
  }

  public static getNoticiasLocais(): readonly DbNoticia[] {
    return [];
  }

  public static saveNoticiasLocais(_noticias: readonly DbNoticia[]): void {
    // No-op: Zero localStorage persistence
  }
}
