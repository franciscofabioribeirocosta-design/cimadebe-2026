import { build as viteBuild } from 'vite';
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

async function runBuild() {
  console.log('🚀 Starting deterministic build process...');

  try {
    // 1. Run Vite build for frontend
    console.log('📦 Building frontend with Vite...');
    await viteBuild();
    console.log('✅ Vite frontend build completed successfully.');

    // 2. Build server with Esbuild
    console.log('📦 Building server with Esbuild...');
    await esbuild.build({
      entryPoints: ['server.ts'],
      bundle: true,
      platform: 'node',
      format: 'esm',
      packages: 'external',
      outfile: 'dist/server.js',
      target: 'esnext',
      minify: true,
      sourcemap: false,
    });
    console.log('✅ Esbuild server build completed successfully.');

    // 3. Verify artifacts existence and non-emptiness
    const indexHtmlPath = path.resolve('dist/index.html');
    const serverJsPath = path.resolve('dist/server.js');

    if (!fs.existsSync(indexHtmlPath) || fs.statSync(indexHtmlPath).size === 0) {
      throw new Error('Build failure: dist/index.html is missing or empty.');
    }

    if (!fs.existsSync(serverJsPath) || fs.statSync(serverJsPath).size === 0) {
      throw new Error('Build failure: dist/server.js is missing or empty.');
    }

    console.log('🎉 Build artifacts verified successfully! dist/index.html and dist/server.js are present and valid.');
  } catch (error) {
    console.error('❌ Build process failed:', error);
    process.exit(1);
  }
}

runBuild();
