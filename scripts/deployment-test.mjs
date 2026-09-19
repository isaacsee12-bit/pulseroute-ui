import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const base = process.env.TEST_BASE_URL;
if (!base?.startsWith('https://')) throw new Error('Set TEST_BASE_URL to the deployed HTTPS origin.');
const api = async (path, options) => {
  const response = await fetch(`${base}${path}`, { ...options, signal: AbortSignal.timeout(60_000) });
  return { status: response.status, data: await response.json() };
};

assert.equal((await api('/api/health')).data.ok, true);
const health = await api('/api/integrations/check', { method: 'POST' });
assert.equal(health.status, 200);
console.log('Deployed integrations:', JSON.stringify(health.data.integrations));
for (const id of ['onemap', 'gemini']) assert.equal(health.data.integrations[id].status, 'Connected');
assert.ok(['Connected', 'Rate limited'].includes(health.data.integrations.lta.status));
const arrival = await api('/api/lta/v3/BusArrival?BusStopCode=01112&ServiceNo=7');
assert.equal(arrival.status, 200);
assert.ok(Array.isArray(arrival.data.Services));
console.log(`Bus Arrival v3: HTTP 200, ${arrival.data.Services.length} service(s).`);

// Exercise real audio parsing without requesting a user's microphone recording.
// The generated test phrase is held in memory and is not a credential.
if (process.platform === 'win32') {
  const speechCommand = "Add-Type -AssemblyName System.Speech; $voice = New-Object System.Speech.Synthesis.SpeechSynthesizer; $voice.Rate = -2; $stream = New-Object System.IO.MemoryStream; $voice.SetOutputToWaveStream($stream); $voice.Speak('Bring me from City Hall MRT station to Orchard MRT station'); $voice.Dispose(); [Convert]::ToBase64String($stream.ToArray()); $stream.Dispose()";
  const data = execFileSync('powershell.exe', ['-NoProfile', '-Command', speechCommand], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim();
  const voice = await api('/api/gemini/voice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, mimeType: 'audio/wav' }) });
  assert.equal(voice.status, 200);
  const texts = voice.data.steps.flatMap(step => step.content || []).filter(item => item.type === 'text').map(item => item.text);
  const intent = JSON.parse(texts.at(-1));
  assert.equal(intent.origin, 'City Hall');
  assert.equal(intent.destination, 'Orchard');
  console.log('Gemini audio planning: correctly parsed City Hall → Orchard.');
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const exposure = [];
  const crowdResponses = [];
  page.on('pageerror', () => errors.push('Browser runtime error'));
  page.on('request', request => {
    const url = new URL(request.url());
    const headers = request.headers();
    if (['authorization', 'accountkey', 'x-goog-api-key', 'apikey'].some(key => headers[key])) exposure.push('credential header');
    if (/onemap\.gov\.sg|mytransport\.sg|generativelanguage\.googleapis\.com|supabase\.co/.test(url.hostname)) exposure.push('direct provider call');
  });
  page.on('response', response => {
    if (response.url().includes('/api/lta/PCDRealTime')) crowdResponses.push(response.status());
  });
  await page.goto(`${base}/#settings`);
  await page.getByText('Managed securely on Google Cloud').waitFor();
  await page.getByRole('button', { name: 'Check integrations', exact: true }).waitFor();
  assert.equal(await page.locator('main input').count(), 0);
  await page.screenshot({ path: 'test-results/deployed-settings.png', fullPage: true });
  await page.getByRole('button', { name: 'Plan a Trip', exact: true }).click();
  await page.getByRole('button', { name: 'Get Routes' }).click();
  await page.locator('.route-card-tags .source-badge.onemap').first().waitFor({ timeout: 60_000 });
  assert.ok(await page.locator('.route-card-v2').count() > 0);
  console.log('Deployed UI: OneMap route cards rendered after Get Routes.');
  await page.getByRole('button', { name: 'Start this route' }).click();
  await page.getByRole('button', { name: 'Load multimodal demo' }).click();
  await page.getByRole('button', { name: 'Simulate disruption' }).click();
  await page.getByRole('button', { name: 'Switch route', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Switch route', exact: true }).click();
  await page.getByText('Journey on track', { exact: true }).waitFor();
  console.log('Deployed UI: My Journey disruption and Switch route succeeded.');
  await page.getByRole('button', { name: 'Live Updates', exact: true }).click();
  await page.screenshot({ path: 'test-results/deployed-live.png', fullPage: true });
  console.log(`Crowd API observations: ${crowdResponses.length} response(s), HTTP states ${[...new Set(crowdResponses)].join(', ')}.`);
  assert.deepEqual(errors, []);
  assert.deepEqual(exposure, []);
  console.log('Deployed browser: no runtime errors, provider credential headers, or direct provider requests.');
} finally { await browser.close(); }
