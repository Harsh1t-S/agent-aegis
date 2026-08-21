import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const API_ORIGIN = process.env.AEGIS_API_ORIGIN ?? 'https://aegis-api-harsh1t.vercel.app';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    // Same-origin `/api` in dev as in production, so the browser never issues a
    // cross-origin preflight. The API's CORS policy does not allow this origin
    // and does not permit PATCH at all, which is why direct calls fail.
    proxy: {
      '/api': {
        target: API_ORIGIN,
        changeOrigin: true,
      },
    },
  },
});
