const STORAGE_KEY = 'pulseroute-api-keys';

const emptyKeys = { googleMapsApiKey: '', ltaDataMallKey: '' };

export function loadApiKeys() {
  if (typeof window === 'undefined') return { ...emptyKeys };
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '{}');
    return {
      googleMapsApiKey: typeof saved.googleMapsApiKey === 'string' ? saved.googleMapsApiKey : '',
      ltaDataMallKey: typeof saved.ltaDataMallKey === 'string' ? saved.ltaDataMallKey : '',
    };
  } catch {
    return { ...emptyKeys };
  }
}

export function saveApiKeys(keys) {
  const next = {
    googleMapsApiKey: String(keys?.googleMapsApiKey || '').trim(),
    ltaDataMallKey: String(keys?.ltaDataMallKey || '').trim(),
  };
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function clearApiKeys() {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(STORAGE_KEY);
  return { ...emptyKeys };
}

export function apiKeyHeaders(keys = loadApiKeys()) {
  const headers = {};
  if (keys.googleMapsApiKey) headers['X-PulseRoute-Google-Key'] = keys.googleMapsApiKey;
  if (keys.ltaDataMallKey) headers['X-PulseRoute-LTA-Key'] = keys.ltaDataMallKey;
  return headers;
}

export function hasGoogleKey(keys) {
  return Boolean(keys?.googleMapsApiKey?.trim());
}

export function hasLtaKey(keys) {
  return Boolean(keys?.ltaDataMallKey?.trim());
}
