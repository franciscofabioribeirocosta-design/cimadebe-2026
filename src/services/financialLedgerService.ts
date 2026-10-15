/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção Geral
 * Livro Caixa Imutável de Entrada Única (Financial Ledger - Pillar 2)
 */

import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface LedgerEntryPayload {
  eventId: string;
  operadorEmail: string;
  ministroId?: string;
  igrejaId?: string;
  valorCentavos: number; // Strictly integer in centavos
  tipoOperacao: 'RECEITA_ANUIDADE' | 'RECEITA_AGO' | 'TAXA_FILIACAO';
  metadata?: Record<string, any>;
}

export async function registrarEntradaFinancialLedger(payload: LedgerEntryPayload): Promise<void> {
  if (!payload.eventId || typeof payload.valorCentavos !== 'number' || Math.round(payload.valorCentavos) !== payload.valorCentavos) {
    throw new Error('[FinancialLedger] Invalid ledger payload: valorCentavos must be an integer.');
  }

  const batch = writeBatch(db);
  const ledgerDocRef = doc(db, 'financial_ledger', `led_evt_${payload.eventId}`);

  batch.set(ledgerDocRef, {
    eventId: payload.eventId,
    timestamp: new Date().toISOString(),
    serverTimestamp: serverTimestamp(),
    operadorEmail: payload.operadorEmail || 'sistema@cimadebe.org.br',
    ministroId: payload.ministroId || null,
    igrejaId: payload.igrejaId || null,
    valorCentavos: Math.round(payload.valorCentavos),
    tipoOperacao: payload.tipoOperacao,
    metadata: payload.metadata || {},
    imutavel: true,
  });

  await batch.commit();
}
