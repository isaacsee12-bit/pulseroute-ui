const STORAGE_KEY = 'pulseroute-api-credentials';
const LEGACY_STORAGE_KEY = 'pulseroute-api-keys';

const emptyKeys = {
  oneMapToken: '',
  ltaDataMallKey: '',
  supabaseUrl: '',
  supabasePublishableKey: '',
};

export function loadApiKeys() {
  if (typeof window === 'undefined') return { ...emptyKeys };
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '{}');
    return {
      oneMapToken: typeof saved.oneMapToken === 'string' ? saved.oneMapToken : '',
      ltaDataMallKey: typeof saved.ltaDataMallKey === 'string' ? saved.ltaDataMallKey : '',
      supabaseUrl: typeof saved.supabaseUrl === 'string' ? saved.supabaseUrl : '',
      supabasePublishableKey: typeof saved.supabasePublishableKey === 'string' ? saved.supabasePublishableKey : '',
    };
  } catch {
    return { ...emptyKeys };
  }
}

export function saveApiKeys(keys) {
  const next = {
    oneMapToken: String(keys?.oneMapToken || '').trim(),
    ltaDataMallKey: String(keys?.ltaDataMallKey || '').trim(),
    supabaseUrl: String(keys?.supabaseUrl || '').trim(),
    supabasePublishableKey: String(keys?.supabasePublishableKey || '').trim(),
  };

  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  }
  return next;
}

export function clearApiKeys() {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  }
  return { ...emptyKeys };
}

export function hasOneMapToken(keys) {
  return Boolean(keys?.oneMapToken?.trim());
}

export function hasLtaKey(keys) {
  return Boolean(keys?.ltaDataMallKey?.trim());
}

export function hasCommunityStore(keys) {
  return Boolean(keys?.supabaseUrl?.trim() && keys?.supabasePublishableKey?.trim());
}

function decodeBase64Url(value) {
  if (typeof window === 'undefined' || !value) return null;
  try {
    const normalised = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalised + '='.repeat((4 - (normalised.length % 4)) % 4);
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
}

export function oneMapTokenExpiry(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const payload = decodeBase64Url(parts[1]);
  if (!payload?.exp || !Number.isFinite(Number(payload.exp))) return null;
  const date = new Date(Number(payload.exp) * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isOneMapTokenExpired(token) {
  const expiry = oneMapTokenExpiry(token);
  return expiry ? expiry.getTime() <= Date.now() : false;
}
