/**
 * @license
 * CIMADEBE / SIGM - Image & Payload Compressor
 * Otimizador de Imagens (Canvas HTML5) para Conformidade Estrita com Limites de Tamanho do Firestore (1 MB max)
 */

export function compressImageBase64(
  dataUrl: string,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve) => {
    // Se a imagem já for muito pequena (< 150 KB), não precisa reprocessar
    if (!dataUrl || dataUrl.length < 150000) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl.substring(0, 300000));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        console.log(`🖼️ [COMPRESSOR SIGM]: Imagem original (${(dataUrl.length / 1024 / 1024).toFixed(2)} MB) comprimida para (${(compressedDataUrl.length / 1024).toFixed(2)} KB).`);

        resolve(compressedDataUrl);
      } catch (err) {
        console.warn('Falha no compressor de canvas, aplicando corte de segurança:', err);
        resolve(dataUrl.substring(0, 300000));
      }
    };

    img.onerror = () => {
      resolve(dataUrl.substring(0, 300000));
    };

    img.src = dataUrl;
  });
}

/**
 * Sanitiza e limita o payload do documento para garantir conformidade estrita com o limite de 1 MB do Firestore
 * e remover quaisquer valores "undefined" que causam exceção no Firestore setDoc/updateDoc.
 */
export function sanitizarPayloadParaFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') {
    if (typeof obj === 'string' && obj.startsWith('data:') && obj.length > 500000) {
      return obj.substring(0, 500000);
    }
    return obj;
  }

  const resultado: any = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (typeof value === 'string') {
        if (value.startsWith('data:') && value.length > 500000) {
          resultado[key] = value.substring(0, 500000);
        } else {
          resultado[key] = value;
        }
      } else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
        resultado[key] = sanitizarPayloadParaFirestore(value);
      } else {
        resultado[key] = value;
      }
    }
  }

  return resultado;
}
