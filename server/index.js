import express from 'express';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createSecretReader } from './secrets.js';

const app = createApp({ readSecret: createSecretReader() });
const dev = process.argv.includes('--dev');
if (dev) {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  const dist = fileURLToPath(new URL('../dist/', import.meta.url));
  app.use(express.static(dist, { index: false }));
  app.get('/{*path}', (req, res) => res.sendFile(`${dist}/index.html`, { headers: { 'Cache-Control': 'no-cache' } }));
}
const server = app.listen(Number(process.env.PORT || (dev ? 5173 : 8080)), '0.0.0.0', () => {
  console.log('PulseRoute server ready.');
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
