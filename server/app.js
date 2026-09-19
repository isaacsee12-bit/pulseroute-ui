import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { STATION_BY_CODE } from '../src/data/mrtNetwork.js';
import { createIntegrations, IntegrationError } from './integrations.js';

export function createApp(options) {
  const app = express();
  const integrations = createIntegrations(options);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'microphone=(self)' });
    next();
  });
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    // Same-origin API only; never accept provider headers or browser credentials.
    if (req.headers.origin && req.headers.origin !== `${req.protocol}://${req.get('host')}`
      && req.headers.origin !== `https://${req.get('host')}`) return res.status(403).json({ message: 'Same-origin requests required.' });
    if (['authorization', 'accountkey', 'x-goog-api-key', 'apikey'].some(name => req.headers[name])) return res.status(400).json({ message: 'Client credentials are not accepted.' });
    next();
  });
  // Aggregate per-instance limits work without trusting caller-supplied forwarded IPs.
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 600, keyGenerator: () => 'instance', standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'Cloud integration rate limited.' } }));
  app.use('/api/gemini', rateLimit({ windowMs: 60_000, limit: 12, keyGenerator: () => 'voice', standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'Voice planning rate limited.' } }));
  let activeVoice = 0;
  app.use('/api/gemini/voice', (req, res, next) => {
    if (activeVoice >= 2) return res.status(429).json({ message: 'Voice planning is busy. Please retry shortly.' });
    activeVoice += 1;
    res.once('close', () => { activeVoice -= 1; });
    next();
  }, express.json({ limit: '28mb' }));
  app.use('/api', express.json({ limit: '16kb' }));

  function params(req, allowed) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (!allowed.includes(key) || typeof value !== 'string' || value.length > 250) throw new IntegrationError(400);
      query.set(key, value);
    }
    return query;
  }
  app.post('/api/integrations/check', async (req, res) => res.json(await integrations.check()));
  app.get('/api/onemap/search', async (req, res) => {
    const query = params(req, ['searchVal', 'returnGeom', 'getAddrDetails', 'pageNum']);
    if (!query.get('searchVal')) throw new IntegrationError(400);
    res.json(await integrations.oneMap('search', query));
  });
  app.get('/api/onemap/route', async (req, res) => {
    const query = params(req, ['start', 'end', 'routeType', 'date', 'time', 'mode', 'maxWalkDistance', 'numItineraries', 'maxTransfers', 'showIntermediateStops']);
    if (!['start', 'end'].every(key => /^\d{1,3}\.\d+,\d{1,3}\.\d+$/.test(query.get(key) || '')) || query.get('routeType') !== 'pt') throw new IntegrationError(400);
    res.json(await integrations.oneMap('route', query));
  });
  for (const [path, keys] of [['TrainServiceAlerts', []], ['PCDRealTime', ['TrainLine']], ['v3/BusArrival', ['BusStopCode', 'ServiceNo']]]) {
    app.get(`/api/lta/${path}`, async (req, res) => {
      const query = params(req, keys);
      if (path === 'v3/BusArrival' && !/^\d{5}$/.test(query.get('BusStopCode') || '')) throw new IntegrationError(400);
      res.json(await integrations.lta(path, query));
    });
  }
  app.post('/api/gemini/voice', async (req, res) => res.json(await integrations.voice(req.body || {})));
  app.get('/api/community/reports', async (req, res) => {
    // The client cannot choose a table, SQL expression, or unbounded result window.
    const query = new URLSearchParams({ select: 'id,station,station_code,line,crowd_level,crowd_value,client_tag,reported_at',
      reported_at: `gte.${new Date(Date.now() - 30 * 60_000).toISOString()}`, order: 'reported_at.desc', limit: '1000' });
    res.json(await integrations.community(query));
  });
  app.post('/api/community/reports', async (req, res) => {
    const body = req.body || {};
    const station = STATION_BY_CODE[body.station_code];
    const level = { green: 0, yellow: 1, red: 2 }[body.crowd_level];
    const prefix = { NS: 'NSL', EW: 'EWL', CG: 'EWL', NE: 'NEL', CC: 'CCL', DT: 'DTL', TE: 'TEL' };
    const line = prefix[String(body.station_code).slice(0, 2)];
    if (!station || level === undefined || !line || body.line !== line
      || !/^[a-f0-9-]{32,36}$/i.test(body.client_tag || '')) throw new IntegrationError(400);
    const now = Date.now();
    res.status(201).json(await integrations.community(new URLSearchParams(), {
      station: station.name, station_code: body.station_code, line, crowd_level: body.crowd_level,
      crowd_value: level, client_tag: body.client_tag, report_bucket: Math.floor(now / 300_000), reported_at: new Date(now).toISOString(),
    }));
  });
  app.use('/api', (req, res) => res.status(404).json({ message: 'API endpoint not found.' }));
  app.use((error, req, res, next) => {
    const status = error instanceof IntegrationError ? error.status : error.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 500;
    res.status(status).json({ message: status === 400 ? 'Invalid request.' : status === 413 ? 'Request too large.' : error instanceof IntegrationError ? error.message : 'Cloud service unavailable.',
      ...(error instanceof IntegrationError ? { state: error.state } : {}) });
  });
  return app;
}
