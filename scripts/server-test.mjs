import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../server/app.js';
import { createIntegrations } from '../server/integrations.js';

// Synthetic fixtures only; no real cloud values are loaded by these tests.
const fixtures = {
  ONEMAP_ACCESS_TOKEN: 'synthetic-onemap-private',
  LTA_ACCOUNT_KEY: 'synthetic-lta-private',
  GEMINI_API_KEY: 'synthetic-gemini-private',
  SUPABASE_URL: 'https://synthetic-project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic-private',
};
const readSecret = async name => fixtures[name];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function withServer(options, run) {
  const server = createApp({ readSecret, gapMs: 0, ...options }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('API injects secrets on fixed upstreams and never returns credentials or upstream errors', async () => {
  const calls = [];
  await withServer({ fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.includes('TrainServiceAlerts')) return json({ message: `Rejected ${fixtures.LTA_ACCOUNT_KEY}` }, 401);
    return json({ results: [{ LATITUDE: '1.353', LONGITUDE: '103.945' }], echo: fixtures.ONEMAP_ACCESS_TOKEN, access_token: fixtures.ONEMAP_ACCESS_TOKEN });
  } }, async base => {
    const response = await fetch(`${base}/api/onemap/search?searchVal=Tampines`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.echo, '[redacted]');
    assert.equal(data.access_token, undefined);
    assert.match(calls[0].url, /^https:\/\/www\.onemap\.gov\.sg\/api\/common\/elastic\/search\?/);
    assert.equal(calls[0].options.headers.Authorization, fixtures.ONEMAP_ACCESS_TOKEN);
    assert.equal(calls[0].options.redirect, 'error');
    const failed = await fetch(`${base}/api/lta/TrainServiceAlerts`);
    assert.equal(failed.status, 401);
    assert.equal(calls[1].options.headers.AccountKey, fixtures.LTA_ACCOUNT_KEY);
    assert.ok(!(await failed.text()).includes(fixtures.LTA_ACCOUNT_KEY));
    const injected = await fetch(`${base}/api/onemap/search?searchVal=a`, { headers: { Authorization: 'client-supplied' } });
    assert.equal(injected.status, 400);
    const arbitrary = await fetch(`${base}/api/onemap/search?searchVal=a&url=https://evil.invalid`);
    assert.equal(arbitrary.status, 400);
    assert.equal((await fetch(`${base}/api/lta/OtherEndpoint`)).status, 404);
    assert.equal((await fetch(`${base}/api/integrations/check`, { method: 'POST', headers: { Origin: 'https://evil.invalid' } })).status, 403);
    assert.equal(calls.length, 2);
  });
});

test('integration health reports actual successes, bad config, upstream outages, quota failures; coalesces probes', async () => {
  let calls = 0;
  let mode = 'success';
  let time = Date.now();
  const api = createIntegrations({ readSecret, gapMs: 0, now: () => time, fetchImpl: async url => {
    calls += 1;
    if (mode === 'failure') {
      if (url.includes('onemap')) return json({ error: 'Token expired' }, 401);
      if (url.includes('datamall')) return json({ fault: { faultstring: 'Quota violation' } }, 429);
      if (url.includes('googleapis')) return json({ error: 'Temporary failure' }, 503);
      return json({ error: 'Table missing' }, 404);
    }
    if (url.includes('onemap')) return json({ plan: { itineraries: [] } });
    if (url.includes('googleapis')) return json({ steps: [{ content: [{ type: 'text', text: 'OK' }] }] });
    if (url.includes('supabase.co')) return json([]);
    return json({ value: [] });
  } });
  const [a, b] = await Promise.all([api.check(), api.check()]);
  assert.deepEqual(a, b);
  assert.equal(calls, 4);
  assert.ok(Object.values(a.integrations).every(row => row.status === 'Connected'));
  mode = 'failure';
  time += 61_000;
  const failed = await api.check();
  assert.equal(failed.integrations.onemap.status, 'Misconfigured');
  assert.equal(failed.integrations.lta.status, 'Rate limited');
  assert.equal(failed.integrations.gemini.status, 'Unavailable');
  assert.equal(failed.integrations.community.status, 'Misconfigured');
  assert.ok(!Object.values(fixtures).some(value => JSON.stringify(failed).includes(value)));

  const missing = createIntegrations({ readSecret: async () => { throw new Error('Secret lookup details'); }, fetchImpl: () => assert.fail('Missing secrets must not call upstreams') });
  assert.ok(Object.values((await missing.check()).integrations).every(row => row.status === 'Misconfigured'));
});

test('server serializes crowd calls across browsers, caches per line, backs off and retains successful cache', async () => {
  let time = 2_000_000;
  let active = 0;
  let maxActive = 0;
  let calls = 0;
  let limited = false;
  const api = createIntegrations({ readSecret, now: () => time, gapMs: 0, fetchImpl: async () => {
    calls += 1;
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active -= 1;
    return limited ? json({ fault: { faultstring: 'Quota limit exceeded' } }, 429) : json({ value: [{ Station: 'EW2', CrowdLevel: 'h' }] });
  } });
  const get = line => api.lta('PCDRealTime', new URLSearchParams({ TrainLine: line }));
  await Promise.all([get('CCL'), get('EWL'), get('CCL')]);
  assert.equal(calls, 2);
  assert.equal(maxActive, 1);
  limited = true;
  await assert.rejects(get('DTL'), error => error.status === 429);
  await assert.rejects(get('NSL'), error => error.status === 429);
  assert.equal(calls, 3, 'No upstream requests during global crowd backoff');
  time += 600_001;
  await assert.rejects(get('DTL'), error => error.status === 429);
  time += 600_001;
  await assert.rejects(get('DTL'), error => error.status === 429);
  assert.equal(calls, 4, 'Second quota failure backs off for twenty minutes');
  time += 600_001;
  limited = false;
  assert.equal((await get('EWL')).value[0].Station, 'EW2');
});

test('community reports are validated and timestamps are controlled by server; Gemini model/prompt cannot be supplied by client', async () => {
  const calls = [];
  await withServer({ fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return json(url.includes('googleapis') ? { steps: [] } : []);
  } }, async base => {
    const post = (path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post('/api/community/reports', { station_code: 'FAKE' })).status, 400);
    assert.equal(calls.length, 0);
    const report = { station_code: 'EW2', station: 'spoofed', line: 'EWL', crowd_level: 'red', crowd_value: 0,
      client_tag: '00000000-0000-4000-8000-000000000001', reported_at: '2000-01-01', report_bucket: 1 };
    assert.equal((await post('/api/community/reports', report)).status, 201);
    const actual = JSON.parse(calls[0].options.body);
    assert.equal(actual.station, 'Tampines');
    assert.equal(actual.crowd_value, 2);
    assert.ok(Math.abs(new Date(actual.reported_at).getTime() - Date.now()) < 5_000);
    assert.equal(calls[0].options.headers.apikey, fixtures.SUPABASE_PUBLISHABLE_KEY);
    assert.equal((await post('/api/gemini/voice', { data: 'YXVkaW8=', mimeType: 'audio/webm', model: 'unapproved', input: 'unapproved prompt' })).status, 200);
    const voice = JSON.parse(calls[1].options.body);
    assert.equal(voice.model, 'gemini-3.5-flash-lite');
    assert.equal(voice.store, false);
    assert.ok(!JSON.stringify(voice).includes('unapproved'));
    assert.equal(calls[1].options.headers['x-goog-api-key'], fixtures.GEMINI_API_KEY);
    assert.equal((await post('/api/gemini/voice', { data: 'invalid!', mimeType: 'audio/webm' })).status, 400);
  });
});

test('Supabase configuration cannot become an arbitrary proxy or a service-role bypass', async () => {
  for (const overrides of [{ SUPABASE_URL: 'https://evil.invalid' }, { SUPABASE_PUBLISHABLE_KEY: 'sb_secret_not-allowed' }]) {
    const api = createIntegrations({ readSecret: async name => ({ ...fixtures, ...overrides })[name], fetchImpl: () => assert.fail('Unsafe config must never be used') });
    await assert.rejects(api.community(new URLSearchParams()), error => error.state === 'Misconfigured');
  }
});
