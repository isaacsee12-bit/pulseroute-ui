import { test, expect } from '@playwright/test';

test('Cloud dashboard shows backend statuses; legacy secrets are removed; offline rerouting remains usable', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let checks = 0;
  await page.addInitScript(() => {
    sessionStorage.setItem('pulseroute-api-credentials', JSON.stringify({ oneMapToken: 'synthetic-legacy-value' }));
    localStorage.setItem('pulseroute-api-keys', 'synthetic-legacy-value');
  });
  await page.route('**/api/**', route => {
    const request = route.request();
    expect(request.headers()).not.toHaveProperty('authorization');
    expect(request.headers()).not.toHaveProperty('accountkey');
    expect(request.headers()).not.toHaveProperty('x-goog-api-key');
    expect(request.url()).not.toContain('synthetic-legacy-value');
    if (request.url().includes('/integrations/check')) {
      checks += 1;
      return route.fulfill({ json: { integrations: {
        onemap: { status: 'Misconfigured' }, lta: { status: 'Rate limited' },
        gemini: { status: 'Unavailable' }, community: { status: 'Connected' },
      } } });
    }
    return route.fulfill({ status: 503, json: { message: 'Cloud integration unavailable.' } });
  });
  await page.goto('/#settings');
  await expect(page.getByRole('heading', { name: 'Cloud Integrations' })).toBeVisible();
  await expect(page.locator('.credential-status')).toHaveText(['Misconfigured', 'Rate limited', 'Unavailable', 'Connected']);
  await expect(page.locator('main input')).toHaveCount(0);
  await expect(page.getByText('Managed securely on Google Cloud')).toBeVisible();
  await page.getByRole('button', { name: 'Check integrations', exact: true }).click();
  await expect.poll(() => checks).toBe(2);
  expect(await page.evaluate(() => sessionStorage.getItem('pulseroute-api-credentials'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('pulseroute-api-keys'))).toBeNull();

  await page.getByRole('button', { name: 'My Journey', exact: true }).click();
  await page.getByRole('button', { name: 'Green · Empty' }).click();
  await expect(page.locator('.community-feedback-status')).toContainText('Saved on this browser only');
  await page.getByRole('button', { name: 'Load multimodal demo' }).click();
  await page.getByRole('button', { name: 'Simulate disruption' }).click();
  await expect(page.locator('.reroute-panel')).toContainText('Simulation');
  await expect(page.locator('.reroute-panel')).toContainText('Bus 7');
  await page.getByRole('button', { name: 'Switch route', exact: true }).click();
  await expect(page.locator('.journey-status')).toContainText('Journey on track');
  await expect(page.locator('.journey-status')).toContainText('Simulation');

  await page.getByRole('button', { name: 'About', exact: true }).click();
  await expect(page.locator('.architecture')).toHaveText('Browser→Cloud Run→OneMap + LTA + Gemini + Community');
  expect(errors).toEqual([]);
});

test('production server serves the SPA, API health and JSON API 404s', async ({ request }) => {
  expect((await request.get('/')).status()).toBe(200);
  expect((await request.get('/api/health')).status()).toBe(200);
  const missing = await request.get('/api/not-a-provider');
  expect(missing.status()).toBe(404);
  expect(missing.headers()['content-type']).toContain('application/json');
});
