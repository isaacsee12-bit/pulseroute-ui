import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const ltaProxy = {
  target: 'https://datamall2.mytransport.sg',
  changeOrigin: true,
  secure: true,
  rewrite: path => path.replace(/^\/lta-proxy/, '/ltaodataservice'),
  configure(proxy) {
    proxy.on('proxyReq', proxyReq => {
      // The browser calls Vite on the same origin, so CORS is not involved.
      // Keep browser-origin metadata out of the upstream DataMall request.
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
    },
  },
  preview: {
    proxy: {
      '/lta-proxy': ltaProxy,
    },
  },
});
