const FIELD_MASK = [
  'routes.duration',
  'routes.localizedValues',
  'routes.legs.steps.travelMode',
  'routes.legs.steps.staticDuration',
  'routes.legs.steps.localizedValues',
  'routes.legs.steps.navigationInstruction',
  'routes.legs.steps.transitDetails',
].join(',');

const preferenceMap = {
  simple: 'FEWER_TRANSFERS',
  accessible: 'LESS_WALKING',
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'GOOGLE_MAPS_API_KEY is not configured on the server.' });
    return;
  }

  const { origin, destination, arrivalIso, preference = 'balanced' } = req.query || {};
  if (!origin || !destination || !arrivalIso) {
    res.status(400).json({ error: 'origin, destination and arrivalIso are required.' });
    return;
  }

  const transitPreferences = preferenceMap[preference]
    ? { routingPreference: preferenceMap[preference] }
    : undefined;

  const body = {
    origin: { address: `${origin} MRT Station, Singapore` },
    destination: { address: `${destination} MRT Station, Singapore` },
    travelMode: 'TRANSIT',
    computeAlternativeRoutes: true,
    arrivalTime: arrivalIso,
    languageCode: 'en',
    units: 'METRIC',
    ...(transitPreferences ? { transitPreferences } : {}),
  };

  try {
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      res.status(response.status).json({ error: payload?.error?.message || 'Google Routes request failed.', details: payload?.error || null });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(payload);
  } catch (error) {
    res.status(502).json({ error: 'Unable to reach Google Routes API.', details: error instanceof Error ? error.message : String(error) });
  }
}
