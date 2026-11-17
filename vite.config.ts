import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' hace que la app funcione igual en tu ordenador y publicada en GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173 },
  build: { chunkSizeWarningLimit: 1500 },
});
