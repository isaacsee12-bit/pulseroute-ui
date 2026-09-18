import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const ltaProxy = {
  target: 'https://datamall2.mytransport.sg',
  changeOrigin: true,
  secure: true,
  rewrite: path => path.replace(/^\/lta-proxy/, '/ltaodataservice'),
  configure(proxy) {
    proxy.on('proxyReq', proxyReq => {
      proxyReq.removeHeader('origin');
      proxyReq.removeHeader('referer');
    });
  },
};

const geminiProxy = {
  target: 'https://generativelanguage.googleapis.com',
  changeOrigin: true,
  secure: true,
  rewrite: path => path.replace(/^\/gemini-proxy/, ''),
  configure(proxy) {
    proxy.on('proxyReq', proxyReq => {
      proxyReq.removeHeader('origin');
      proxyReq.removeHeader('referer');
    });
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/lta-proxy': ltaProxy,
      '/gemini-proxy': geminiProxy,
    },
  },
  preview: {
    proxy: {
      '/lta-proxy': ltaProxy,
      '/gemini-proxy': geminiProxy,
    },
  },
});
