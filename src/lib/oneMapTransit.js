const ONEMAP_SEARCH_URL = '/api/onemap/search';
const ONEMAP_ROUTE_URL = '/api/onemap/route';

const RAIL_LINES = {
  NS: { code: 'NSL', name: 'North-South Line' },
  EW: { code: 'EWL', name: 'East-West Line' },
  NE: { code: 'NEL', name: 'North East Line' },
  CC: { code: 'CCL', name: 'Circle Line' },
  DT: { code: 'DTL', name: 'Downtown Line' },
  TE: { code: 'TEL', name: 'Thomson-East Coast Line' },
};

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

async function fetchJson(url) {
  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    throw new OneMapRequestError(
      'The OneMap cloud integration could not be reached. Local MRT routing is still available.',
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

export async function searchOneMap(searchVal, pageNum = 1) {
  const params = new URLSearchParams({
    searchVal: String(searchVal || '').trim(),
    returnGeom: 'Y',
    getAddrDetails: 'Y',
    pageNum: String(pageNum),
  });
  return fetchJson(`${ONEMAP_SEARCH_URL}?${params.toString()}`);
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

export async function resolveMrtStationWithOneMap(stationName) {
  const payload = await searchOneMap(`${stationName} MRT Station`);
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

  if (candidate.getTime() < now.getTime() - 60_000) candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  const parts = singaporeDateParts(candidate);
  return { date: `${parts.month}-${parts.day}-${parts.year}`, time: `${hh}:${mm}:00` };
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

function railLineMeta(leg) {
  const raw = `${leg?.routeShortName || ''} ${leg?.route || ''} ${leg?.routeLongName || ''}`.toUpperCase();
  for (const [prefix, meta] of Object.entries(RAIL_LINES)) {
    if (new RegExp(`(^|\\s)${prefix}(\\s|$)`).test(raw)) return meta;
  }
  if (raw.includes('NORTH SOUTH')) return RAIL_LINES.NS;
  if (raw.includes('EAST WEST')) return RAIL_LINES.EW;
  if (raw.includes('NORTH EAST')) return RAIL_LINES.NE;
  if (raw.includes('CIRCLE')) return RAIL_LINES.CC;
  if (raw.includes('DOWNTOWN')) return RAIL_LINES.DT;
  if (raw.includes('THOMSON')) return RAIL_LINES.TE;
  return null;
}

function normaliseLeg(leg, index, origin, destination) {
  const mode = String(leg?.mode || 'TRANSIT').toUpperCase();
  const rail = mode === 'SUBWAY' || mode === 'RAIL' ? railLineMeta(leg) : null;
  const service = mode === 'BUS' ? String(leg?.routeShortName || leg?.route || '').trim() : '';
  const line = mode === 'WALK' ? 'WALK' : mode === 'BUS' ? 'BUS' : rail?.code || mode;
  const label = mode === 'WALK'
    ? 'Walk'
    : mode === 'BUS'
      ? (service ? `Bus ${service}` : 'Bus')
      : rail?.name || leg?.routeLongName || leg?.routeShortName || leg?.route || line;
  const from = cleanPlaceName(leg?.from?.name, index === 0 ? origin : '');
  const to = cleanPlaceName(leg?.to?.name, destination);
  const intermediateStops = Array.isArray(leg?.intermediateStops)
    ? leg.intermediateStops.map(stop => ({
      name: cleanPlaceName(stop?.name),
      stopCode: stop?.stopCode || '',
      departure: clockFromEpoch(stop?.departure),
      arrival: clockFromEpoch(stop?.arrival),
    })).filter(stop => stop.name)
    : [];
  const durationSeconds = seconds(leg?.duration);
  const distanceMetres = Number.isFinite(Number(leg?.distance)) ? Math.round(Number(leg.distance)) : null;

  return {
    mode,
    from,
    to,
    durationMinutes: durationSeconds ? Math.max(1, Math.round(durationSeconds / 60)) : null,
    durationSeconds,
    distanceMetres,
    service,
    line,
    label,
    headsign: leg?.headsign || '',
    stopCount: Array.isArray(leg?.intermediateStops) ? intermediateStops.length + 1 : null,
    departure: clockFromEpoch(leg?.startTime || leg?.from?.departure),
    arrival: clockFromEpoch(leg?.endTime || leg?.to?.arrival),
    fromStopCode: leg?.from?.stopCode || '',
    toStopCode: leg?.to?.stopCode || '',
    intermediateStops,
    geometry: leg?.legGeometry?.points || null,
    stations: [from, ...intermediateStops.map(stop => stop.name), to]
      .filter((name, stationIndex, array) => name && (stationIndex === 0 || name !== array[stationIndex - 1])),
  };
}

export function normaliseOneMapItinerary(itinerary, index, origin, destination) {
  const rawLegs = Array.isArray(itinerary?.legs) ? itinerary.legs : [];
  const legs = rawLegs.map((leg, legIndex) => normaliseLeg(leg, legIndex, origin, destination));
  const transitLegs = legs.filter(leg => leg.mode !== 'WALK');
  const walkLegs = legs.filter(leg => leg.mode === 'WALK');
  const durationMinutes = Math.max(1, Math.round(seconds(itinerary?.duration) / 60));
  const itineraryWalkSeconds = seconds(itinerary?.walkTime);
  const walkingMinutes = itineraryWalkSeconds
    ? Math.round(itineraryWalkSeconds / 60)
    : Math.round(walkLegs.reduce((sum, leg) => sum + (leg.durationSeconds || 0), 0) / 60);
  const itineraryWalkDistance = Number(itinerary?.walkDistance);
  const totalWalkDistanceMetres = Number.isFinite(itineraryWalkDistance)
    ? Math.round(itineraryWalkDistance)
    : Math.round(walkLegs.reduce((sum, leg) => sum + (leg.distanceMetres || 0), 0));
  const actualTransfers = Number(itinerary?.transfers);
  const transfers = Number.isFinite(actualTransfers) ? actualTransfers : Math.max(0, transitLegs.length - 1);
  const railLines = [...new Set(transitLegs.map(leg => leg.line).filter(line => Object.values(RAIL_LINES).some(meta => meta.code === line)))];
  const busServices = [...new Set(transitLegs.filter(leg => leg.mode === 'BUS').map(leg => leg.service).filter(Boolean))];
  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];
  const visibleServices = transitLegs.map(leg => leg.label).filter(Boolean);
  const title = visibleServices.length ? visibleServices.join(' → ') : walkLegs.length ? 'Walk' : 'OneMap public-transport route';
  const transferPlaces = transitLegs.slice(0, -1).map(leg => leg.to).filter(Boolean);
  const railStops = legs
    .filter(leg => leg.mode === 'SUBWAY' || leg.mode === 'RAIL')
    .flatMap(leg => [leg.from, ...leg.intermediateStops.map(stop => stop.name), leg.to])
    .filter(Boolean);
  const stationSequence = [origin, ...railStops, destination]
    .filter((name, stationIndex, array) => name && (stationIndex === 0 || name !== array[stationIndex - 1]));

  return {
    id: `onemap-${index}-${durationMinutes}-${railLines.join('-')}-${busServices.join('-')}`,
    source: 'OneMap',
    sourceKind: 'onemap',
    oneMapRoute: true,
    shortTitle: title,
    title,
    detail: transferPlaces.length
      ? `${origin} → ${transferPlaces.join(' → ')} → ${destination}`
      : `${origin} → ${destination}`,
    durationMinutes,
    baseMinutes: durationMinutes,
    arrival: clockFromEpoch(itinerary?.endTime || lastLeg?.arrival),
    departure: clockFromEpoch(itinerary?.startTime || firstLeg?.departure),
    transfers,
    walkingMinutes,
    totalWalkDistanceMetres: totalWalkDistanceMetres || 0,
    confidence: 90,
    confidenceSource: 'PulseRoute estimate',
    reliability: 0.9,
    crowdLabel: 'LTA crowd data when available',
    score: Math.max(45, 105 - durationMinutes - transfers * 2),
    lines: railLines,
    busServices,
    hasBus: busServices.length > 0,
    hasWalking: walkLegs.length > 0,
    legs,
    segments: legs,
    stationSequence,
    origin,
    destination,
    geometry: legs.map(leg => leg.geometry).filter(Boolean),
    fare: itinerary?.fare ?? null,
  };
}

export async function fetchOneMapTransitRoutes({ origin, destination, departureTime }) {
  const [start, end] = await Promise.all([
    resolveMrtStationWithOneMap(origin),
    resolveMrtStationWithOneMap(destination),
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
    maxTransfers: '3',
    showIntermediateStops: 'true',
  });

  const payload = await fetchJson(`${ONEMAP_ROUTE_URL}?${params.toString()}`);
  const itineraries = Array.isArray(payload?.plan?.itineraries) ? payload.plan.itineraries : [];
  return itineraries.map((itinerary, itineraryIndex) => normaliseOneMapItinerary(itinerary, itineraryIndex, origin, destination));
}
