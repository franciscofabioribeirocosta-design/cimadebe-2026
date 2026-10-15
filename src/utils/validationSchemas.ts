/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção Geral
 * Zod Validation Schemas for Strict Input Sanitization (Pillar 1)
 */

import { z } from 'zod';

export const cpfSchema = z.string()
  .transform(val => val.replace(/\D/g, ''))
  .refine(val => val.length === 11, {
    message: 'O CPF deve conter exatamente 11 dígitos numéricos.'
  });

export const cnpjSchema = z.string()
  .transform(val => val.replace(/\D/g, ''))
  .refine(val => val.length === 14, {
    message: 'O CNPJ deve conter exatamente 14 dígitos numéricos.'
  });

export const emailSchema = z.string()
  .trim()
  .toLowerCase()
  .email({ message: 'E-mail inválido.' });

export const ministroRegistroSchema = z.object({
  nome: z.string().min(3, { message: 'O nome completo é obrigatório.' }),
  cpf: cpfSchema,
  email: emailSchema,
  cargo: z.string().min(2, { message: 'Cargo eclesiástico obrigatório.' }),
});

export const igrejaRegistroSchema = z.object({
  razaoSocial: z.string().min(3, { message: 'Razão social obrigatória.' }),
  cnpj: cnpjSchema,
  email: emailSchema,
});
