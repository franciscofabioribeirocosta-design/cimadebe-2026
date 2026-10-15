import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/', // Essencial para evitar erros de Tipo MIME e caminhos quebrados
  build: {
    outDir: 'dist',
    emptyOutDir: true, // Purga resíduos de builds velhos
    sourcemap: false,   // Remove mapas de código pesados que estouram o upload
    minify: 'esbuild',  // Minificação super rápida
    chunkSizeWarningLimit: 2500
  }
});
