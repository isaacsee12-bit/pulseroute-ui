import { STATION_BY_CODE } from '../data/mrtNetwork.js';

const levelMap = { l: 'Low', m: 'Moderate', h: 'High', na: 'Unavailable' };

export async function fetchLiveRail() {
  const response = await fetch('/api/live-rail', { cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'Live LTA rail data is unavailable.');
    error.status = response.status;
    error.configurationRequired = response.status === 503;
    throw error;
  }
  return payload;
}

export function disruptedAlerts(payload) {
  return (payload?.alerts || []).filter(alert => Number(alert?.Status) === 2);
}

export function affectedLines(payload) {
  return [...new Set(disruptedAlerts(payload).map(alert => alert.Line).filter(Boolean))];
}

export function crowdRows(payload) {
  if (!payload?.crowd) return [];
  return Object.entries(payload.crowd).flatMap(([line, rows]) =>
    (Array.isArray(rows) ? rows : []).map(row => ({
      line,
      code: row.Station,
      station: STATION_BY_CODE[row.Station]?.name || row.Station,
      level: levelMap[String(row.CrowdLevel || '').toLowerCase()] || row.CrowdLevel || 'Unavailable',
      startTime: row.StartTime || '',
      endTime: row.EndTime || '',
    })),
  );
}

export function crowdForRoute(payload, route) {
  const codes = new Set((route?.stationSequence || []).flatMap(name => STATION_BY_CODE[name]?.codes || []));
  const stationNames = new Set(route?.stationSequence || []);
  const rows = crowdRows(payload).filter(row => stationNames.has(row.station) || codes.has(row.code));
  if (!rows.length) return { label: 'Unknown', source: payload?.configured ? 'LTA has no crowd reading for this route' : 'Demo estimate' };
  if (rows.some(row => row.level === 'High')) return { label: 'High', source: 'LTA Station Crowd Density' };
  if (rows.some(row => row.level === 'Moderate')) return { label: 'Moderate', source: 'LTA Station Crowd Density' };
  return { label: 'Low', source: 'LTA Station Crowd Density' };
}

export function alertAffectsRoute(alert, route) {
  if (!alert || !route) return false;
  if (alert.Line && route.lines?.includes(alert.Line)) return true;
  const affectedCodes = String(alert.Stations || '').split(',').map(value => value.trim()).filter(Boolean);
  const routeCodes = new Set((route.stationSequence || []).flatMap(name => STATION_BY_CODE[name]?.codes || []));
  return affectedCodes.some(code => routeCodes.has(code));
}
