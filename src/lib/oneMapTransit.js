const ONEMAP_SEARCH_URL = 'https://www.onemap.gov.sg/api/common/elastic/search';
const ONEMAP_ROUTE_URL = 'https://www.onemap.gov.sg/api/public/routingsvc/route';

export class OneMapRequestError extends Error {
  constructor(message, code = 'connection_failed', status = null) {
    super(message);
    this.name = 'OneMapRequestError';
    this.code = code;
    this.status = status;
  }
}

function classifyOneMapError(message, status) {
  const text = String(message || '').toLowerCase();
  if (text.includes('expired') || text.includes('session expired')) return 'expired_token';
  if (text.includes('invalid') && text.includes('token')) return 'invalid_token';
  if (text.includes('authentication') || status === 401 || status === 403) return 'invalid_token';
  return 'connection_failed';
}

function authHeaders(token) {
  return {
    Authorization: String(token || '').trim(),
    Accept: 'application/json',
  };
}

async function fetchJson(url, token) {
  if (!String(token || '').trim()) {
    throw new OneMapRequestError('OneMap Access Token is not configured.', 'not_configured');
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: authHeaders(token),
      cache: 'no-store',
    });
  } catch (error) {
    throw new OneMapRequestError(
      'The browser could not reach OneMap directly. This can be caused by CORS, a network policy, or a temporary OneMap outage.',
      'connection_failed',
    );
  }

  const payload = await response.json().catch(() => ({}));
  const apiError = payload?.error || payload?.message;
  if (!response.ok || apiError) {
    const message = apiError || `OneMap returned HTTP ${response.status}.`;
    throw new OneMapRequestError(message, classifyOneMapError(message, response.status), response.status);
  }
  return payload;
}

export async function searchOneMap(searchVal, token, pageNum = 1) {
  const params = new URLSearchParams({
    searchVal: String(searchVal || '').trim(),
    returnGeom: 'Y',
    getAddrDetails: 'Y',
    pageNum: String(pageNum),
  });
  return fetchJson(`${ONEMAP_SEARCH_URL}?${params.toString()}`, token);
}

export async function testOneMapToken(token) {
  const payload = await searchOneMap('Tampines MRT Station', token, 1);
  if (!Array.isArray(payload?.results)) {
    throw new OneMapRequestError('OneMap returned an unexpected Search response.', 'connection_failed');
  }
  return {
    ok: true,
    resultCount: payload.results.length,
  };
}

function stationSearchScore(result, stationName) {
  const expected = String(stationName || '').toLowerCase();
  const search = String(result?.SEARCHVAL || '').toLowerCase();
  const address = String(result?.ADDRESS || '').toLowerCase();
  let score = 0;
  if (search.includes(expected)) score += 5;
  if (address.includes(expected)) score += 3;
  if (search.includes('mrt')) score += 2;
  if (address.includes('mrt')) score += 1;
  return score;
}

export async function resolveMrtStationWithOneMap(stationName, token) {
  const payload = await searchOneMap(`${stationName} MRT Station`, token, 1);
  const results = Array.isArray(payload?.results) ? payload.results : [];
  if (!results.length) {
    throw new OneMapRequestError(`OneMap Search could not resolve ${stationName} MRT Station.`, 'not_found');
  }

  const result = [...results].sort((a, b) => stationSearchScore(b, stationName) - stationSearchScore(a, stationName))[0];
  const latitude = Number(result.LATITUDE);
  const longitude = Number(result.LONGITUDE);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new OneMapRequestError(`OneMap Search did not return valid coordinates for ${stationName}.`, 'invalid_response');
  }

  return {
    name: stationName,
    latitude,
    longitude,
    address: result.ADDRESS || result.SEARCHVAL || stationName,
    source: 'OneMap Search',
  };
}

function singaporeDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}

export function oneMapDepartureParameters(clockValue) {
  const [hour, minute] = String(clockValue || '09:00').split(':').map(Number);
  const now = new Date();
  const nowParts = singaporeDateParts(now);
  const hh = String(Number.isFinite(hour) ? hour : Number(nowParts.hour)).padStart(2, '0');
  const mm = String(Number.isFinite(minute) ? minute : Number(nowParts.minute)).padStart(2, '0');
  let candidate = new Date(`${nowParts.year}-${nowParts.month}-${nowParts.day}T${hh}:${mm}:00+08:00`);

  if (candidate.getTime() < now.getTime() - 60_000) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }
  const parts = singaporeDateParts(candidate);
  return {
    date: `${parts.month}-${parts.day}-${parts.year}`,
    time: `${hh}:${mm}:00`,
  };
}

function seconds(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function clockFromEpoch(value) {
  if (value == null || value === '') return '';
  let numeric = Number(value);
  let date;
  if (Number.isFinite(numeric)) {
    if (numeric < 10_000_000_000) numeric *= 1000;
    date = new Date(numeric);
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function cleanPlaceName(value, fallback = '') {
  return String(value || fallback)
    .replace(/\s+(MRT|LRT)\s+Station.*$/i, '')
    .replace(/\s+Station$/i, '')
    .trim() || fallback;
}

function transitLineCode(leg) {
  const mode = String(leg?.mode || '').toUpperCase();
  if (mode === 'BUS') return 'BUS';

  const raw = `${leg?.routeShortName || ''} ${leg?.route || ''} ${leg?.routeLongName || ''}`.toUpperCase();
  const direct = raw.match(/\b(NSL|EWL|NEL|CCL|DTL|TEL)\b/);
  if (direct) return direct[1];
  const stationCode = raw.match(/\b(NS|EW|NE|CC|DT|TE)\d{1,2}[A-Z]?\b/);
  if (stationCode) {
    return { NS: 'NSL', EW: 'EWL', NE: 'NEL', CC: 'CCL', DT: 'DTL', TE: 'TEL' }[stationCode[0].slice(0, 2)] || mode;
  }
  if (raw.includes('NORTH SOUTH')) return 'NSL';
  if (raw.includes('EAST WEST')) return 'EWL';
  if (raw.includes('NORTH EAST')) return 'NEL';
  if (raw.includes('CIRCLE')) return 'CCL';
  if (raw.includes('DOWNTOWN')) return 'DTL';
  if (raw.includes('THOMSON')) return 'TEL';
  return mode || 'TRANSIT';
}

function legLabel(leg, line) {
  if (line === 'BUS') {
    const service = leg?.routeShortName || leg?.route;
    return service ? `Bus ${service}` : 'Bus';
  }
  return leg?.routeShortName || leg?.route || line;
}

function normaliseOneMapItinerary(itinerary, index, origin, destination) {
  const legs = Array.isArray(itinerary?.legs) ? itinerary.legs : [];
  const routeLegs = legs.filter(leg => String(leg?.mode || '').toUpperCase() !== 'WALK');
  const walkingLegs = legs.filter(leg => String(leg?.mode || '').toUpperCase() === 'WALK');
  const durationMinutes = Math.max(1, Math.round(seconds(itinerary?.duration) / 60));

  const segments = routeLegs.map(leg => {
    const line = transitLineCode(leg);
    const from = cleanPlaceName(leg?.from?.name, origin);
    const to = cleanPlaceName(leg?.to?.name, destination);
    const intermediate = Array.isArray(leg?.intermediateStops)
      ? leg.intermediateStops.map(stop => cleanPlaceName(stop?.name)).filter(Boolean)
      : [];
    return {
      line,
      label: legLabel(leg, line),
      mode: String(leg?.mode || 'TRANSIT').toUpperCase(),
      stations: [from, ...intermediate, to].filter((name, stationIndex, array) => name && (stationIndex === 0 || name !== array[stationIndex - 1])),
      stopCount: intermediate.length + 1,
      headsign: leg?.headsign || '',
      departure: clockFromEpoch(leg?.startTime || leg?.from?.departure),
      arrival: clockFromEpoch(leg?.endTime || leg?.to?.arrival),
      distanceMetres: Number.isFinite(Number(leg?.distance)) ? Math.round(Number(leg.distance)) : null,
      durationSeconds: seconds(leg?.duration),
      geometry: leg?.legGeometry?.points || null,
    };
  });

  const lines = [...new Set(segments.map(segment => segment.line).filter(line => line && line !== 'WALK'))];
  const transferStations = segments.slice(0, -1).map(segment => segment.stations[segment.stations.length - 1]).filter(Boolean);
  const stationSequence = [origin, ...segments.flatMap(segment => segment.stations.slice(1)), destination]
    .filter((name, stationIndex, array) => name && (stationIndex === 0 || name !== array[stationIndex - 1]));
  const walkingMinutes = Math.round(walkingLegs.reduce((sum, leg) => sum + seconds(leg?.duration), 0) / 60);
  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];
  const title = segments.length
    ? segments.map(segment => segment.label).join(' → ')
    : 'OneMap public-transport route';

  return {
    id: `onemap-${index}-${durationMinutes}-${lines.join('-')}`,
    source: 'OneMap',
    sourceKind: 'onemap',
    oneMapRoute: true,
    shortTitle: title,
    title,
    detail: transferStations.length
      ? `${origin} → ${transferStations.join(' → ')} → ${destination}`
      : `${origin} → ${destination}`,
    durationMinutes,
    baseMinutes: durationMinutes,
    arrival: clockFromEpoch(itinerary?.endTime || lastLeg?.endTime || lastLeg?.to?.arrival),
    departure: clockFromEpoch(itinerary?.startTime || firstLeg?.startTime || firstLeg?.from?.departure),
    transfers: Math.max(0, segments.length - 1),
    walkingMinutes,
    confidence: 90,
    confidenceSource: 'PulseRoute estimate',
    reliability: 0.9,
    crowdLabel: 'LTA crowd data when available',
    score: Math.max(45, 105 - durationMinutes - Math.max(0, segments.length - 1) * 2),
    lines,
    segments,
    stationSequence,
    origin,
    destination,
    totalWalkDistanceMetres: Math.round(walkingLegs.reduce((sum, leg) => sum + (Number(leg?.distance) || 0), 0)),
    geometry: legs.map(leg => leg?.legGeometry?.points).filter(Boolean),
    instructions: legs.map(leg => ({
      mode: String(leg?.mode || '').toUpperCase(),
      from: cleanPlaceName(leg?.from?.name),
      to: cleanPlaceName(leg?.to?.name),
      route: leg?.routeShortName || leg?.route || '',
      headsign: leg?.headsign || '',
      durationSeconds: seconds(leg?.duration),
      distanceMetres: Number(leg?.distance) || 0,
    })),
  };
}

export async function fetchOneMapTransitRoutes({ origin, destination, departureTime, token }) {
  const [start, end] = await Promise.all([
    resolveMrtStationWithOneMap(origin, token),
    resolveMrtStationWithOneMap(destination, token),
  ]);
  const departure = oneMapDepartureParameters(departureTime);
  const params = new URLSearchParams({
    start: `${start.latitude},${start.longitude}`,
    end: `${end.latitude},${end.longitude}`,
    routeType: 'pt',
    date: departure.date,
    time: departure.time,
    mode: 'TRANSIT',
    maxWalkDistance: '1000',
    numItineraries: '3',
  });

  const payload = await fetchJson(`${ONEMAP_ROUTE_URL}?${params.toString()}`, token);
  const itineraries = Array.isArray(payload?.plan?.itineraries) ? payload.plan.itineraries : [];
  return itineraries.map((itinerary, index) => normaliseOneMapItinerary(itinerary, index, origin, destination));
}
