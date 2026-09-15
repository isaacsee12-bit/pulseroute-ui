function parseDurationSeconds(value) {
  if (!value) return 0;
  const match = String(value).match(/^([0-9.]+)s$/);
  return match ? Number(match[1]) : 0;
}

function toClockText(isoOrText) {
  if (!isoOrText) return '';
  if (/^[0-9]{1,2}:[0-9]{2}/.test(isoOrText)) return isoOrText;
  const date = new Date(isoOrText);
  if (Number.isNaN(date.getTime())) return String(isoOrText);
  return new Intl.DateTimeFormat('en-SG', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Singapore' }).format(date);
}

function lineCodeFromTransitLine(line = {}) {
  const text = `${line.nameShort || ''} ${line.name || ''}`.toUpperCase();
  const match = text.match(/\b(NSL|EWL|NEL|CCL|DTL|TEL)\b/);
  if (match) return match[1];
  if (text.includes('NORTH SOUTH')) return 'NSL';
  if (text.includes('EAST WEST')) return 'EWL';
  if (text.includes('NORTH EAST')) return 'NEL';
  if (text.includes('CIRCLE')) return 'CCL';
  if (text.includes('DOWNTOWN')) return 'DTL';
  if (text.includes('THOMSON')) return 'TEL';
  return line.nameShort || line.name || 'Transit';
}

function stationName(stopName = '') {
  return stopName.replace(/\s+(MRT|LRT)\s+Station.*$/i, '').replace(/\s+Station$/i, '').trim() || stopName;
}

export function normaliseGoogleRoutes(payload, origin, destination) {
  const routes = payload?.routes || [];
  return routes.map((route, index) => {
    const steps = (route.legs || []).flatMap(leg => leg.steps || []);
    const transitSteps = steps.filter(step => step.transitDetails);
    const segments = transitSteps.map(step => {
      const details = step.transitDetails || {};
      const dep = stationName(details.stopDetails?.departureStop?.name || origin);
      const arr = stationName(details.stopDetails?.arrivalStop?.name || destination);
      return {
        line: lineCodeFromTransitLine(details.transitLine),
        label: details.transitLine?.nameShort || details.transitLine?.name || 'Transit',
        mode: details.transitLine?.vehicle?.type || step.travelMode || 'TRANSIT',
        stations: [dep, arr],
        stopCount: details.stopCount || 0,
        headsign: details.headsign || '',
        departure: toClockText(details.stopDetails?.departureTime || details.localizedValues?.departureTime?.time?.text),
        arrival: toClockText(details.stopDetails?.arrivalTime || details.localizedValues?.arrivalTime?.time?.text),
      };
    });
    const lines = [...new Set(segments.map(segment => segment.line))];
    const stationSequence = [origin, ...segments.map(segment => segment.stations[1]), destination].filter((name, i, arr) => name && (i === 0 || name !== arr[i - 1]));
    const durationMinutes = Math.max(1, Math.round(parseDurationSeconds(route.duration) / 60));
    const lastSegment = segments[segments.length - 1];
    const firstSegment = segments[0];
    const transferStations = segments.slice(0, -1).map(segment => segment.stations[1]);
    const title = segments.map(segment => segment.label).filter(Boolean).join(' → ') || 'Google transit route';

    return {
      id: `google-${index}`,
      source: 'Google Maps Routes API',
      shortTitle: title,
      title,
      detail: transferStations.length ? `${origin} → ${transferStations.join(' → ')} → ${destination}` : `${origin} → ${destination}`,
      durationMinutes,
      baseMinutes: durationMinutes,
      arrival: lastSegment?.arrival || route.localizedValues?.duration?.text || '',
      departure: firstSegment?.departure || '',
      transfers: Math.max(0, transitSteps.length - 1),
      walkingMinutes: Math.round(steps.filter(step => step.travelMode === 'WALK').reduce((sum, step) => sum + parseDurationSeconds(step.staticDuration), 0) / 60),
      confidence: 92,
      reliability: 0.92,
      crowdLabel: 'Crowding from LTA when available',
      score: Math.max(50, 105 - durationMinutes),
      lines,
      segments,
      stationSequence,
      origin,
      destination,
      googleRoute: true,
    };
  });
}

export async function fetchGoogleTransitRoutes({ origin, destination, arrivalIso, preference }) {
  const params = new URLSearchParams({ origin, destination, arrivalIso, preference });
  const response = await fetch(`/api/transit-route?${params.toString()}`, { cache: 'no-store' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.error || 'Google transit routing is unavailable.');
    error.status = response.status;
    error.configurationRequired = response.status === 503;
    throw error;
  }
  const payload = await response.json();
  return normaliseGoogleRoutes(payload, origin, destination);
}

function singaporeDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}

export function singaporeArrivalIso(clockValue) {
  const [hour, minute] = String(clockValue || '09:50').split(':').map(Number);
  const now = new Date();
  const parts = singaporeDateParts(now);
  const hh = String(Number.isFinite(hour) ? hour : 9).padStart(2, '0');
  const mm = String(Number.isFinite(minute) ? minute : 50).padStart(2, '0');
  let candidate = new Date(`${parts.year}-${parts.month}-${parts.day}T${hh}:${mm}:00+08:00`);

  if (candidate.getTime() <= now.getTime() + 5 * 60 * 1000) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
    const next = singaporeDateParts(candidate);
    return `${next.year}-${next.month}-${next.day}T${hh}:${mm}:00+08:00`;
  }

  return `${parts.year}-${parts.month}-${parts.day}T${hh}:${mm}:00+08:00`;
}
