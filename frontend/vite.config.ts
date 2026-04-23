import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// NOTE: We intentionally do NOT inject GEMINI_API_KEY into the browser bundle.
// API keys must never be exposed client-side. The frontend calls /api/enhance
// on a server proxy (see frontend/server/) which holds the key server-side.
export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: process.env.BCAL_API_URL || 'http://localhost:8787',
          changeOrigin: true,
        },
      },
    },
  };
});
