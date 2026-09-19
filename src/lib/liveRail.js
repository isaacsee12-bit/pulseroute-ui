import { STATION_BY_CODE, STATION_BY_NAME } from '../data/mrtNetwork.js';

const DATAMALL_BASE = '/api/lta';
const CROWD_LINES = ['CCL', 'CEL', 'CGL', 'DTL', 'EWL', 'NEL', 'NSL', 'TEL'];
export const CROWD_REFRESH_MS = 5 * 60 * 1000;
export const CROWD_REQUEST_GAP_MS = 350;
const CROWD_BACKOFF_STEPS_MS = [10, 20, 30].map(minutes => minutes * 60 * 1000);
const levelMap = { l: 'Low', m: 'Moderate', h: 'High', na: 'Unavailable' };
const lineAlias = { CGL: 'EWL', CEL: 'CCL' };
const normaliseLine = line => lineAlias[line] || line;
const loadLabels = {
  SEA: 'Seats available',
  SDA: 'Standing available',
  LSD: 'Limited standing',
};

export class DataMallRequestError extends Error {
  constructor(message, code = 'connection_failed', status = null) {
    super(message);
    this.name = 'DataMallRequestError';
    this.code = code;
    this.status = status;
  }
}

function unwrap(payload) {
  return payload?.value ?? payload;
}

async function dataMallGet(path) {
  let response;
  try {
    response = await fetch(`${DATAMALL_BASE}/${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
  } catch {
    throw new DataMallRequestError(
      'The LTA cloud integration could not be reached. Please try again.',
      'backend_unavailable',
    );
  }

  const contentType = response.headers.get('content-type') || '';
  if (response.status === 404 || (!contentType.includes('json') && response.ok)) {
    throw new DataMallRequestError(
      'The LTA cloud integration is unavailable.',
      'backend_unavailable',
      response.status,
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const faultText = [
      payload?.fault?.faultstring,
      payload?.error?.message,
      payload?.message,
      payload?.Message,
    ].filter(Boolean).join(' ');
    const quotaLimited = response.status === 429 || /rate\s*limit|quota\s*(limit|violation|exceeded)/i.test(faultText);
    const code = quotaLimited
      ? 'rate_limited'
      : response.status === 401 || response.status === 403
        ? 'invalid_key'
        : response.status === 502 || response.status === 504
          ? 'upstream_failed'
          : 'connection_failed';
    throw new DataMallRequestError(
      code === 'rate_limited'
        ? 'LTA DataMall temporarily rate-limited the crowd-density request. PulseRoute will back off before retrying.'
        : code === 'invalid_key'
          ? 'The LTA cloud integration is misconfigured.'
          : code === 'upstream_failed'
            ? 'The cloud service could not reach LTA DataMall.'
            : `LTA DataMall returned HTTP ${response.status}.`,
      code,
      response.status,
    );
  }
  return unwrap(payload);
}

function messageText(message) {
  if (typeof message === 'string') return message;
  if (message?.Content) return message.Content;
  if (message?.Message) return message.Message;
  return '';
}

function latestMessage(messages) {
  if (!Array.isArray(messages)) return messageText(messages);
  return messages.map(messageText).filter(Boolean).at(-1) || '';
}

function normaliseAlerts(raw) {
  if (!raw) return [];
  const clusters = Array.isArray(raw) ? raw : [raw];
  return clusters.flatMap(cluster => {
    if (!cluster || typeof cluster !== 'object') return [];

    if (Array.isArray(cluster.AffectedSegments)) {
      const sharedMessage = latestMessage(cluster.Message);
      if (!cluster.AffectedSegments.length) return [{ Status: cluster.Status, Message: sharedMessage }];
      return cluster.AffectedSegments.map(segment => ({
        ...segment,
        Status: segment.Status ?? cluster.Status,
        Message: latestMessage(segment.Message) || sharedMessage,
      }));
    }

    return [{
      ...cluster,
      Message: latestMessage(cluster.Message) || messageText(cluster.Message),
    }];
  });
}

function wait(milliseconds) {
  if (!milliseconds) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export function crowdBackoffMs(consecutiveRateLimits = 1) {
  const index = Math.max(0, Math.min(CROWD_BACKOFF_STEPS_MS.length - 1, Number(consecutiveRateLimits || 1) - 1));
  return CROWD_BACKOFF_STEPS_MS[index];
}

export function mergeCrowdSnapshots(previous = {}, incoming = {}) {
  return { ...(previous || {}), ...(incoming || {}) };
}

export async function fetchTrainServiceAlerts() {
  const alertsRaw = await dataMallGet('TrainServiceAlerts');
  return {
    alerts: normaliseAlerts(alertsRaw),
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchCrowdDensity({ requestGapMs = CROWD_REQUEST_GAP_MS } = {}) {
  const crowd = {};
  const failures = [];
  const attemptedLines = [];

  for (let index = 0; index < CROWD_LINES.length; index += 1) {
    const line = CROWD_LINES[index];
    attemptedLines.push(line);
    try {
      const rows = await dataMallGet(`PCDRealTime?TrainLine=${encodeURIComponent(line)}`);
      crowd[line] = Array.isArray(rows) ? rows : [];
    } catch (error) {
      if (error?.code === 'invalid_key' || error?.code === 'backend_unavailable') throw error;
      failures.push({
        line,
        code: error?.code || 'connection_failed',
        message: error?.message || 'Crowd-density request failed.',
        status: error?.status ?? null,
      });

      // A quota failure applies to the account, so stop immediately instead of
      // burning the remaining line requests in the same refresh.
      if (error?.code === 'rate_limited' || error?.code === 'upstream_failed') break;
    }

    if (index < CROWD_LINES.length - 1) await wait(requestGapMs);
  }

  const rateLimited = failures.some(item => item.code === 'rate_limited');
  const successfulLines = Object.keys(crowd);
  const rowCount = successfulLines.reduce((sum, line) => sum + crowd[line].length, 0);
  const state = rateLimited
    ? 'rate_limited'
    : failures.length
      ? 'partial'
      : rowCount
        ? 'ok'
        : 'empty';

  return {
    crowd,
    fetchedAt: new Date().toISOString(),
    successfulLines,
    attemptedLines,
    failures,
    status: {
      state,
      rowCount,
      successfulLineCount: successfulLines.length,
      attemptedLineCount: attemptedLines.length,
      failedLines: failures.map(item => item.line),
      message: rateLimited
        ? 'LTA crowd-density requests were temporarily rate-limited.'
        : failures.length
          ? 'Some LTA crowd-density line requests failed; existing readings can be retained for those lines.'
          : rowCount
            ? 'LTA crowd-density refresh succeeded.'
            : 'LTA returned no crowd-density rows for this refresh.',
    },
  };
}

export async function fetchLiveRail() {
  const alertsResult = await fetchTrainServiceAlerts();
  const crowdResult = await fetchCrowdDensity();
  return {
    configured: true,
    source: 'LTA DataMall — Live',
    fetchedAt: alertsResult.fetchedAt,
    alerts: alertsResult.alerts,
    crowd: crowdResult.crowd,
    crowdFetchedAt: crowdResult.fetchedAt,
    crowdStatus: crowdResult.status,
  };
}

function busArrivalMinutes(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((date.getTime() - Date.now()) / 60_000));
}

function normaliseBusArrivalBus(bus) {
  if (!bus || !bus.EstimatedArrival) return null;
  const minutes = busArrivalMinutes(bus.EstimatedArrival);
  return {
    estimatedArrival: bus.EstimatedArrival,
    minutes,
    display: minutes == null ? 'Unavailable' : minutes < 1 ? 'Arr' : `${minutes} min`,
    loadCode: bus.Load || '',
    occupancy: loadLabels[bus.Load] || '',
    monitored: String(bus.Monitored || ''),
    feature: bus.Feature || '',
    type: bus.Type || '',
  };
}

export async function fetchBusArrival(busStopCode, serviceNo) {
  const stop = String(busStopCode || '').trim();
  const service = String(serviceNo || '').trim();
  if (!/^\d{5}$/.test(stop)) throw new DataMallRequestError('A valid five-digit bus stop code is required.', 'invalid_request');

  const params = new URLSearchParams({ BusStopCode: stop });
  if (service) params.set('ServiceNo', service);
  const payload = await dataMallGet(`v3/BusArrival?${params.toString()}`);
  const services = Array.isArray(payload?.Services) ? payload.Services : [];
  const selected = service ? services.find(item => String(item.ServiceNo) === service) : services[0];
  if (!selected) return null;

  return {
    source: 'LTA DataMall — Live',
    serviceNo: selected.ServiceNo || service,
    operator: selected.Operator || '',
    nextBus: normaliseBusArrivalBus(selected.NextBus),
    nextBus2: normaliseBusArrivalBus(selected.NextBus2),
    nextBus3: normaliseBusArrivalBus(selected.NextBus3),
  };
}

export function disruptedAlerts(payload) {
  return (payload?.alerts || []).filter(alert => Number(alert?.Status) === 2);
}

export function affectedLines(payload) {
  return [...new Set(disruptedAlerts(payload).map(alert => normaliseLine(alert.Line)).filter(Boolean))];
}

export function crowdRows(payload) {
  if (!payload?.crowd) return [];
  return Object.entries(payload.crowd).flatMap(([line, rows]) =>
    (Array.isArray(rows) ? rows : []).map(row => ({
      line: normaliseLine(line),
      sourceLine: line,
      code: row.Station,
      station: STATION_BY_CODE[row.Station]?.name || row.Station,
      level: levelMap[String(row.CrowdLevel || '').toLowerCase()] || row.CrowdLevel || 'Unavailable',
      startTime: row.StartTime || '',
      endTime: row.EndTime || '',
    })),
  );
}

function routeCodes(route) {
  const names = new Set(route?.stationSequence || []);
  const codes = new Set([...names].flatMap(name => STATION_BY_NAME[name]?.codes || []));
  for (const leg of route?.legs || route?.segments || []) {
    for (const candidate of [leg.fromStopCode, leg.toStopCode, ...(leg.intermediateStops || []).map(stop => stop.stopCode)]) {
      if (/^(NS|EW|NE|CC|DT|TE|CG)\d{1,2}[A-Z]?$/.test(String(candidate || ''))) codes.add(candidate);
    }
  }
  return codes;
}

export function crowdForRoute(payload, route) {
  const codes = routeCodes(route);
  const stationNames = new Set(route?.stationSequence || []);
  const rows = crowdRows(payload).filter(row => stationNames.has(row.station) || codes.has(row.code));
  if (!rows.length) {
    return {
      label: 'Unknown',
      source: payload?.configured ? 'No current LTA crowd reading for this route' : 'Live LTA data unavailable',
    };
  }
  if (rows.some(row => row.level === 'High')) return { label: 'High', source: 'LTA DataMall — Live' };
  if (rows.some(row => row.level === 'Moderate')) return { label: 'Moderate', source: 'LTA DataMall — Live' };
  return { label: 'Low', source: 'LTA DataMall — Live' };
}

export function alertAffectsRoute(alert, route) {
  if (!alert || !route) return false;
  if (alert.Line && route.lines?.includes(normaliseLine(alert.Line))) return true;
  const affectedCodes = String(alert.Stations || '')
    .split(',')
    .flatMap(value => value.split('|'))
    .map(value => value.trim())
    .filter(Boolean);
  const codes = routeCodes(route);
  return affectedCodes.some(code => codes.has(code));
}
