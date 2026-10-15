import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distServerPath = path.join(__dirname, 'dist', 'server.js');

if (fs.existsSync(distServerPath)) {
  await import('./dist/server.js');
} else {
  console.log('[BOOTSTRAP] dist/server.js not found, falling back to server.ts directly.');
  await import('./server.ts');
}
