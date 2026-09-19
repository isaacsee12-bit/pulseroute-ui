export function loadIntegrations() {
  // Remove legacy saved credentials without ever reading their contents.
  try {
    for (const storage of [window.sessionStorage, window.localStorage]) {
      storage.removeItem('pulseroute-api-credentials');
      storage.removeItem('pulseroute-api-keys');
    }
  } catch { /* Storage may be disabled. */ }
  return {};
}

export async function checkIntegrations() {
  try {
    const response = await fetch('/api/integrations/check', { method: 'POST' });
    if (!response.ok) throw new Error();
    const payload = await response.json();
    const statuses = ['Connected', 'Unavailable', 'Misconfigured', 'Rate limited'];
    return Object.fromEntries(['onemap', 'lta', 'gemini', 'community'].map(id => [id, {
      status: statuses.includes(payload.integrations?.[id]?.status) ? payload.integrations[id].status : 'Unavailable',
    }]));
  } catch {
    return Object.fromEntries(['onemap', 'lta', 'gemini', 'community'].map(id => [id, { status: 'Unavailable' }]));
  }
}

// Health is advisory: actual operations still retry transient outages.
export const canUseOneMap = state => state?.onemap?.status !== 'Misconfigured';
export const canUseLta = state => state?.lta?.status !== 'Misconfigured';
