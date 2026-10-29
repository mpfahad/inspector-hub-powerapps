import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// IRPPMS dev ports — do not use 5173/4000 (reserved by contract app)
const WEB_PORT = Number(process.env.IRPPMS_WEB_PORT ?? 5180);
const API_PORT = Number(process.env.IRPPMS_API_PORT ?? 4100);
const API_URL = process.env.IRPPMS_API_URL ?? `http://localhost:${API_PORT}`;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: WEB_PORT,
    strictPort: true,
    proxy: {
      '/api': {
        target: API_URL,
        changeOrigin: true,
      },
    },
  },
});
