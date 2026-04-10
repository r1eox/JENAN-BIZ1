import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://192.168.1.10:5000', // ← ضع هنا IP السيرفر الفعلي في شبكتك
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://192.168.1.10:5000', // ← ضع هنا IP السيرفر الفعلي في شبكتك
        changeOrigin: true
      }
    }
  }
});
