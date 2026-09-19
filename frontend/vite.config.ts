import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const API_ORIGIN = process.env.AEGIS_API_ORIGIN ?? 'http://127.0.0.1:8000';

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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'auth-vendor': ['@supabase/supabase-js'],
          'motion-vendor': ['framer-motion'],
        },
      },
    },
  },
  server: {
    // Same-origin `/api` in development matches production and keeps sessions,
    // workspace headers and error handling on the same path in both environments.
    proxy: {
      '/api': {
        target: API_ORIGIN,
        changeOrigin: true,
      },
    },
  },
});
