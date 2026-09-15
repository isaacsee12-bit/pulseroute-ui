import { STATION_BY_CODE, STATION_BY_NAME } from '../data/mrtNetwork.js';

const DATAMALL_BASE = 'https://datamall2.mytransport.sg/ltaodataservice';
const CROWD_LINES = ['CCL', 'CEL', 'CGL', 'DTL', 'EWL', 'NEL', 'NSL', 'TEL'];
const levelMap = { l: 'Low', m: 'Moderate', h: 'High', na: 'Unavailable' };
const lineAlias = { CGL: 'EWL', CEL: 'CCL' };
const normaliseLine = line => lineAlias[line] || line;

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

async function dataMallGet(path, accountKey) {
  const key = String(accountKey || '').trim();
  if (!key) throw new DataMallRequestError('LTA DataMall Account Key is not configured.', 'not_configured');

  let response;
  try {
    response = await fetch(`${DATAMALL_BASE}/${path}`, {
      method: 'GET',
      headers: {
        AccountKey: key,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
  } catch {
    throw new DataMallRequestError(
      'Direct DataMall access is blocked in this browser or network. PulseRoute is using its local/demo data.',
      'cors_or_network',
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = response.status === 401 || response.status === 403 ? 'invalid_key' : 'connection_failed';
    throw new DataMallRequestError(
      code === 'invalid_key' ? 'LTA DataMall rejected the Account Key.' : `LTA DataMall returned HTTP ${response.status}.`,
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
      if (!cluster.AffectedSegments.length) {
        return [{ Status: cluster.Status, Message: sharedMessage }];
      }
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

export async function testLtaDataMallKey(accountKey) {
  const raw = await dataMallGet('TrainServiceAlerts', accountKey);
  normaliseAlerts(raw);
  return { ok: true };
}

export async function fetchLiveRail(accountKey) {
  const alertsRaw = await dataMallGet('TrainServiceAlerts', accountKey);
  const alerts = normaliseAlerts(alertsRaw);

  const crowdResults = await Promise.all(CROWD_LINES.map(async line => {
    try {
      const rows = await dataMallGet(`PCDRealTime?TrainLine=${encodeURIComponent(line)}`, accountKey);
      return [line, Array.isArray(rows) ? rows : []];
    } catch (error) {
      if (error?.code === 'cors_or_network' || error?.code === 'invalid_key') throw error;
      return [line, []];
    }
  }));

  return {
    configured: true,
    source: 'LTA DataMall — Live',
    fetchedAt: new Date().toISOString(),
    alerts,
    crowd: Object.fromEntries(crowdResults),
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
  return new Set((route?.stationSequence || []).flatMap(name => STATION_BY_NAME[name]?.codes || []));
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
