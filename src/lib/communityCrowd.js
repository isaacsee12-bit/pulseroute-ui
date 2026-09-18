const LOCAL_REPORTS_KEY = 'pulseroute-community-crowd-local';
const CLIENT_TAG_KEY = 'pulseroute-community-client-tag';
const REPORT_WINDOW_MS = 30 * 60 * 1000;
const LOCAL_RETENTION_MS = 2 * 60 * 60 * 1000;
const REPORT_BUCKET_MS = 5 * 60 * 1000;

export const COMMUNITY_LEVELS = {
  green: { value: 0, label: 'Empty', routeLevel: 'Low' },
  yellow: { value: 1, label: 'Slightly crowded', routeLevel: 'Moderate' },
  red: { value: 2, label: 'Very crowded', routeLevel: 'High' },
};

export class CommunityCrowdError extends Error {
  constructor(message, code = 'connection_failed', status = null) {
    super(message);
    this.name = 'CommunityCrowdError';
    this.code = code;
    this.status = status;
  }
}

function safeJsonParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function decodeLegacyJwtRole(key) {
  const parts = String(key || '').split('.');
  if (parts.length !== 3 || typeof atob === 'undefined') return '';
  try {
    const normalised = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalised + '='.repeat((4 - normalised.length % 4) % 4);
    return JSON.parse(atob(padded))?.role || '';
  } catch {
    return '';
  }
}

function assertSafePublicKey(key) {
  const value = String(key || '').trim();
  if (!value) throw new CommunityCrowdError('Supabase Publishable Key is not configured.', 'not_configured');
  if (value.startsWith('sb_secret_') || decodeLegacyJwtRole(value) === 'service_role') {
    throw new CommunityCrowdError('Do not use a Supabase secret/service_role key in PulseRoute. Use a publishable key (or legacy anon key).', 'unsafe_key');
  }
  return value;
}

function normaliseProjectUrl(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) throw new CommunityCrowdError('Supabase Project URL is not configured.', 'not_configured');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new CommunityCrowdError('Enter a valid Supabase Project URL.', 'invalid_config');
  }
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new CommunityCrowdError('Supabase Project URL must use HTTP or HTTPS.', 'invalid_config');
  }
  return url.toString().replace(/\/$/, '');
}

function publicHeaders(key, extras = {}) {
  return {
    apikey: assertSafePublicKey(key),
    Accept: 'application/json',
    ...extras,
  };
}

async function supabaseRequest(config, tablePath, options = {}) {
  const base = normaliseProjectUrl(config?.supabaseUrl);
  const key = config?.supabasePublishableKey;
  let response;
  try {
    response = await fetch(`${base}/rest/v1/${tablePath}`, {
      ...options,
      headers: {
        ...publicHeaders(key),
        ...(options.headers || {}),
      },
      cache: 'no-store',
    });
  } catch {
    throw new CommunityCrowdError(
      'The browser could not reach the shared crowd service. PulseRoute can still keep crowd feedback locally on this device.',
      'cors_or_network',
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const apiCode = payload?.code || '';
    const message = payload?.message || payload?.hint || `Supabase returned HTTP ${response.status}.`;
    const code = apiCode === 'PGRST205' || response.status === 404
      ? 'schema_missing'
      : response.status === 401 || response.status === 403
        ? 'invalid_key'
        : response.status === 409
          ? 'rate_limited'
          : 'connection_failed';
    throw new CommunityCrowdError(message, code, response.status);
  }
  return payload;
}

function randomClientTag() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
}

export function getCommunityClientTag() {
  if (typeof window === 'undefined') return 'server';
  try {
    const saved = window.localStorage.getItem(CLIENT_TAG_KEY);
    if (saved) return saved;
    const next = randomClientTag();
    window.localStorage.setItem(CLIENT_TAG_KEY, next);
    return next;
  } catch {
    return randomClientTag();
  }
}

function readLocalReports() {
  if (typeof window === 'undefined') return [];
  try {
    const reports = safeJsonParse(window.localStorage.getItem(LOCAL_REPORTS_KEY) || '[]', []);
    const cutoff = Date.now() - LOCAL_RETENTION_MS;
    return Array.isArray(reports) ? reports.filter(report => new Date(report.reported_at).getTime() >= cutoff) : [];
  } catch {
    return [];
  }
}

function writeLocalReports(reports) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(reports.slice(-250)));
  } catch {
    // Local demo storage is optional.
  }
}

function reportBucket(now = Date.now()) {
  return Math.floor(now / REPORT_BUCKET_MS);
}

function createReport({ station, stationCode, line, level, clientTag = getCommunityClientTag(), now = Date.now() }) {
  const meta = COMMUNITY_LEVELS[level];
  if (!meta) throw new CommunityCrowdError('Choose a valid crowd level.', 'invalid_request');
  if (!station || !stationCode || !line) throw new CommunityCrowdError('Station and line are required for crowd feedback.', 'invalid_request');
  return {
    station: String(station),
    station_code: String(stationCode),
    line: String(line),
    crowd_level: level,
    crowd_value: meta.value,
    client_tag: clientTag,
    report_bucket: reportBucket(now),
    reported_at: new Date(now).toISOString(),
  };
}

export function saveLocalCrowdReport(input) {
  const next = createReport(input);
  const reports = readLocalReports();
  const duplicate = reports.find(report =>
    report.client_tag === next.client_tag
    && report.station_code === next.station_code
    && report.line === next.line
    && report.report_bucket === next.report_bucket,
  );
  if (duplicate) {
    throw new CommunityCrowdError('You already reported this station in the last 5 minutes.', 'rate_limited');
  }
  const stored = { ...next, id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`, local: true };
  writeLocalReports([...reports, stored]);
  return stored;
}

export async function testCommunityCrowdConnection(config) {
  await supabaseRequest(config, 'crowd_reports?select=id&limit=1', { method: 'GET' });
  return { ok: true };
}

export async function fetchSharedCrowdReports(config, minutes = 30) {
  const since = new Date(Date.now() - Math.max(1, minutes) * 60 * 1000).toISOString();
  const params = new URLSearchParams({
    select: 'id,station,station_code,line,crowd_level,crowd_value,client_tag,reported_at',
    reported_at: `gte.${since}`,
    order: 'reported_at.desc',
    limit: '1000',
  });
  const payload = await supabaseRequest(config, `crowd_reports?${params.toString()}`, { method: 'GET' });
  return Array.isArray(payload) ? payload : [];
}

export async function submitCrowdReport(input, config) {
  const report = createReport(input);
  const configured = Boolean(String(config?.supabaseUrl || '').trim() && String(config?.supabasePublishableKey || '').trim());

  if (!configured) {
    return { report: saveLocalCrowdReport(input), shared: false, mode: 'local' };
  }

  try {
    const payload = await supabaseRequest(config, 'crowd_reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(report),
    });
    return {
      report: Array.isArray(payload) ? payload[0] || report : report,
      shared: true,
      mode: 'shared',
    };
  } catch (error) {
    if (error?.code === 'rate_limited') throw error;
    const local = saveLocalCrowdReport(input);
    return {
      report: local,
      shared: false,
      mode: 'local',
      warning: error?.message || 'Shared crowd service unavailable.',
    };
  }
}

function weightForAge(ageMs) {
  const minutes = ageMs / 60_000;
  if (minutes < 0 || minutes > 30) return 0;
  if (minutes <= 5) return 1;
  if (minutes <= 10) return 0.75;
  if (minutes <= 20) return 0.4;
  return 0.15;
}

function confidenceForCount(count) {
  if (count >= 8) return 'High confidence';
  if (count >= 3) return 'Moderate confidence';
  return 'Limited reports';
}

export function aggregateCommunityReports(reports, now = Date.now()) {
  const latestByClient = new Map();

  for (const report of Array.isArray(reports) ? reports : []) {
    const reportedAt = new Date(report?.reported_at).getTime();
    if (!Number.isFinite(reportedAt) || now - reportedAt > REPORT_WINDOW_MS) continue;
    const client = report?.client_tag || report?.id || Math.random().toString(36);
    const key = `${report?.station_code || report?.station}::${report?.line || ''}::${client}`;
    const existing = latestByClient.get(key);
    if (!existing || new Date(existing.reported_at).getTime() < reportedAt) latestByClient.set(key, report);
  }

  const groups = new Map();
  for (const report of latestByClient.values()) {
    const level = COMMUNITY_LEVELS[report.crowd_level];
    if (!level) continue;
    const reportedAt = new Date(report.reported_at).getTime();
    const weight = weightForAge(now - reportedAt);
    if (!weight) continue;
    const key = `${report.station_code || report.station}::${report.line || ''}`;
    const group = groups.get(key) || {
      station: report.station,
      stationCode: report.station_code,
      line: report.line,
      weightedValue: 0,
      totalWeight: 0,
      reportCount: 0,
      lastReportedAt: '',
    };
    group.weightedValue += level.value * weight;
    group.totalWeight += weight;
    group.reportCount += 1;
    if (!group.lastReportedAt || new Date(group.lastReportedAt).getTime() < reportedAt) group.lastReportedAt = report.reported_at;
    groups.set(key, group);
  }

  return [...groups.values()].map(group => {
    const score = group.totalWeight ? group.weightedValue / group.totalWeight : 0;
    const level = score > 1.35 ? 'red' : score > 0.5 ? 'yellow' : 'green';
    return {
      station: group.station,
      stationCode: group.stationCode,
      line: group.line,
      level,
      label: COMMUNITY_LEVELS[level].label,
      routeLevel: COMMUNITY_LEVELS[level].routeLevel,
      score: Number(score.toFixed(2)),
      reportCount: group.reportCount,
      confidence: confidenceForCount(group.reportCount),
      lastReportedAt: group.lastReportedAt,
    };
  }).sort((a, b) => b.score - a.score || b.reportCount - a.reportCount);
}

export async function fetchCommunityCrowd(config) {
  const configured = Boolean(String(config?.supabaseUrl || '').trim() && String(config?.supabasePublishableKey || '').trim());
  const localReports = readLocalReports();

  if (!configured) {
    return {
      configured: false,
      mode: 'local',
      source: 'Community demo — this browser',
      reports: localReports,
      aggregates: aggregateCommunityReports(localReports),
      fetchedAt: new Date().toISOString(),
      error: '',
    };
  }

  try {
    const reports = await fetchSharedCrowdReports(config);
    return {
      configured: true,
      mode: 'shared',
      source: 'Community',
      reports,
      aggregates: aggregateCommunityReports(reports),
      fetchedAt: new Date().toISOString(),
      error: '',
    };
  } catch (error) {
    return {
      configured: true,
      mode: 'local',
      source: 'Community demo — this browser',
      reports: localReports,
      aggregates: aggregateCommunityReports(localReports),
      fetchedAt: new Date().toISOString(),
      error: error?.message || 'Shared crowd service unavailable.',
      reason: error?.code || 'connection_failed',
    };
  }
}

export function communityAggregateForStation(state, stationCode, line = '') {
  const rows = state?.aggregates || [];
  return rows.find(row => row.stationCode === stationCode && (!line || row.line === line))
    || rows.find(row => row.stationCode === stationCode)
    || null;
}
