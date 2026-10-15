/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Módulo Criptográfico e de Sanitização UTF-8 Nativa
 */

/**
 * Normaliza e sanitiza qualquer string de entrada no formato UTF-8 canônico NFC
 * prevenindo truncamento, injeções ou corrupção de caracteres especiais e acentuações.
 */
export function normalizeUtf8String(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  try {
    return input.normalize('NFC').trim();
  } catch {
    return input.trim();
  }
}

/**
 * Congelamento recursivo em profundidade (Deep Freeze)
 * Garante imutabilidade inviolável de nível contábil bancário.
 */
export function deepFreeze<T>(target: T): T {
  if (target === null || typeof target !== 'object') {
    return target;
  }

  const propNames = Object.getOwnPropertyNames(target);
  for (const name of propNames) {
    const value = (target as Record<string, unknown>)[name];
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }

  return Object.freeze(target);
}

/**
 * Clona profundamente utilizando structuredClone e aplica congelamento recursivo.
 */
export function deepCloneAndFreeze<T>(obj: T): T {
  const cloned = structuredClone(obj);
  return deepFreeze(cloned);
}

/**
 * Implementação pura e síncrona do algoritmo criptográfico SHA-256 (FIPS 180-4).
 * Utilizada para geração de hashes encadeados de blocos de auditoria em memória.
 */
export function sha256(ascii: string): string {
  const normalized = normalizeUtf8String(ascii);

  // Constantes de inicialização dos 8 buffers de 32 bits
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  // Constantes de rodada K (primeiros 32 bits das partes fracionárias das raízes cúbicas dos primeiros 64 primos)
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  // Codificação UTF-8 em bytes
  const bytes: number[] = [];
  for (let i = 0; i < normalized.length; i++) {
    let charCode = normalized.charCodeAt(i);
    if (charCode < 0x80) {
      bytes.push(charCode);
    } else if (charCode < 0x800) {
      bytes.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
    } else if (charCode < 0xd800 || charCode >= 0xe000) {
      bytes.push(0xe0 | (charCode >> 12), 0x80 | ((charCode >> 6) & 0x3f), 0x80 | (charCode & 0x3f));
    } else {
      // Par substituto UTF-16
      i++;
      charCode = 0x10000 + (((charCode & 0x3ff) << 10) | (normalized.charCodeAt(i) & 0x3ff));
      bytes.push(
        0xf0 | (charCode >> 18),
        0x80 | ((charCode >> 12) & 0x3f),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f)
      );
    }
  }

  // Preenchimento de bits (Padding)
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) {
    bytes.push(0x00);
  }

  // Comprimento original em 64 bits (Big Endian)
  bytes.push(
    0, 0, 0, Math.floor(bitLength / 0x100000000),
    (bitLength >>> 24) & 0xff,
    (bitLength >>> 16) & 0xff,
    (bitLength >>> 8) & 0xff,
    bitLength & 0xff
  );

  // Processamento de blocos de 512 bits
  const w = new Uint32Array(64);

  const rightRotate = (value: number, amount: number) => {
    return (value >>> amount) | (value << (32 - amount));
  };

  for (let chunkIndex = 0; chunkIndex < bytes.length; chunkIndex += 64) {
    for (let i = 0; i < 16; i++) {
      const offset = chunkIndex + i * 4;
      w[i] =
        (bytes[offset] << 24) |
        (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) |
        bytes[offset + 3];
    }

    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + k[i] + w[i]) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const toHex = (val: number) => val.toString(16).padStart(8, '0');
  return `${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}${toHex(h5)}${toHex(h6)}${toHex(h7)}`;
}

/**
 * Gera o hash criptográfico SHA-256 de integridade contábil/cadastral.
 */
export function gerarHashIntegridade(dados: string): string {
  return sha256(dados);
}

/**
 * Codifica uma string em Base64 com suporte estrito a UTF-8 (TextEncoder).
 */
export function utf8ToBase64(str: string): string {
  const normalized = normalizeUtf8String(str);
  const bytes = new TextEncoder().encode(normalized);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodifica uma string Base64 em UTF-8 com tratamento de exceções (TextDecoder).
 */
export function base64ToUtf8(base64: string): string {
  try {
    const cleaned = base64.trim().replace(/^https?:\/\/cimadebe\.org\.br\/?(?:validar\/)?/i, '');
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    throw new Error('Formato Base64 inválido ou corrompido');
  }
}
