import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vite configuration for the store admin panel.
 * Port, bind host and API proxy target come from environment variables. The defaults are the local development
 * values (port 5174 on localhost, API on http://localhost:8080) and nothing is bound to all interfaces.
 * Set STORE_ADMIN_HOST to expose the dev server deliberately, and VITE_API_PROXY_TARGET to point at another API.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.STORE_ADMIN_PORT || 5100);
  const host = env.STORE_ADMIN_HOST || '0.0.0.0';
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8080';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port,
      host,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-icons': ['lucide-react'],
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
  };
});
