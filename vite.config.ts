import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { crearCsp } from './main/politica-csp';
// Dos páginas, una por ventana de Electron. No hay servidor: los datos llegan por IPC.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true, headers: { 'Content-Security-Policy': crearCsp(true) } },
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
