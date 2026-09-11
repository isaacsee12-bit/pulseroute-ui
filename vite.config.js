import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    {
      name: 'pulseroute-source-compat',
      enforce: 'pre',
      transform(code, id) {
        if (!id.replace(/\\/g, '/').endsWith('/src/main.jsx')) return null;

        const fixed = code
          .replace(/^\s*Walking,\s*$/m, '')
          .replace("route.type === 'walk' ? Walking : Bus", "route.type === 'walk' ? MapPin : Bus");

        return fixed === code ? null : { code: fixed, map: null };
      },
    },
    react(),
  ],
});
