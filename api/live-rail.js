const LTA_CROWD_LINES = ['NSL', 'EWL', 'CGL', 'NEL', 'CCL', 'CEL', 'DTL', 'TEL'];
let memoryCache = { expiresAt: 0, payload: null };

async function ltaGet(path, key) {
  const response = await fetch(`https://datamall2.mytransport.sg/ltaodataservice/${path}`, {
    headers: {
      AccountKey: key,
      Accept: 'application/json',
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`LTA DataMall ${path} returned ${response.status}`);
  return payload?.value ?? payload;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const key = process.env.LTA_DATAMALL_KEY;
  if (!key) {
    res.status(503).json({ configured: false, error: 'LTA_DATAMALL_KEY is not configured on the server.' });
    return;
  }

  if (memoryCache.payload && Date.now() < memoryCache.expiresAt) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(memoryCache.payload);
    return;
  }

  try {
    const [alerts, ...crowdResponses] = await Promise.all([
      ltaGet('TrainServiceAlerts', key),
      ...LTA_CROWD_LINES.map(line => ltaGet(`PCDRealTime?TrainLine=${encodeURIComponent(line)}`, key).catch(() => [])),
    ]);

    const crowd = Object.fromEntries(
      LTA_CROWD_LINES.map((line, index) => [line, Array.isArray(crowdResponses[index]) ? crowdResponses[index] : []]),
    );
    const payload = {
      configured: true,
      fetchedAt: new Date().toISOString(),
      alerts: Array.isArray(alerts) ? alerts : alerts ? [alerts] : [],
      crowd,
    };

    memoryCache = { expiresAt: Date.now() + 60_000, payload };
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(payload);
  } catch (error) {
    res.status(502).json({ configured: true, error: 'Unable to retrieve live LTA rail data.', details: error instanceof Error ? error.message : String(error) });
  }
}
