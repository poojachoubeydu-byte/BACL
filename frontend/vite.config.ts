import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// NOTE: We intentionally do NOT inject GEMINI_API_KEY into the browser bundle.
// API keys must never be exposed client-side. The frontend calls /api/enhance
// on a server proxy (see frontend/server/) which holds the key server-side.
export default defineConfig(({command}) => {
  // Production default: deploy under the `/BACL/` sub-path of GitHub Pages.
  // Override with VITE_BASE_PATH when deploying to a root domain (e.g.
  // Cloudflare Pages with a custom domain): set VITE_BASE_PATH=/.
  // In `vite` (dev server) we always serve from root for HMR ergonomics.
  const base =
    process.env.VITE_BASE_PATH ?? (command === 'build' ? '/BACL/' : '/');

  return {
    base,
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
