import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { crearCsp } from './main/politica-csp';
import { APP_CONFIG } from './shared/app-config';
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'comal-manual-pdf',
      generateBundle() {
        const pdf = readFileSync(resolve(APP_CONFIG.manual.source));
        if (pdf.subarray(0, 5).toString() !== '%PDF-')
          throw new Error('El manual PDF no es válido.');
        this.emitFile({ type: 'asset', fileName: APP_CONFIG.manual.served, source: pdf });
      },
    },
  ],
  server: {
    host: APP_CONFIG.devServer.host,
    port: APP_CONFIG.devServer.port,
    strictPort: true,
    headers: { 'Content-Security-Policy': crearCsp(true), 'Cache-Control': 'no-store' },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        operador: resolve('vistas/operador/index.html'),
        publica: resolve('vistas/publica/index.html'),
      },
    },
  },
});
