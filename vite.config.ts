import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { crearCsp } from './main/politica-csp';
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'comal-manual-pdf',
      generateBundle() {
        const pdf = readFileSync(resolve('output/pdf/Comal++_Manual_de_usuario_0.4.0.pdf'));
        if (pdf.subarray(0, 5).toString() !== '%PDF-')
          throw new Error('El manual PDF no es válido.');
        this.emitFile({ type: 'asset', fileName: 'manual/manual-usuario-0.4.0.pdf', source: pdf });
      },
    },
  ],
  server: {
    port: 5173,
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
