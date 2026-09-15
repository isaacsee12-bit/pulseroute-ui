import { alertAffectsRoute, crowdForRoute, disruptedAlerts } from './liveRail.js';

const WEIGHTS = {
  balanced: { time: 1, transfers: 5, walk: 0.65, crowdHigh: 13, crowdModerate: 5, disruption: 80 },
  fastest: { time: 1, transfers: 1.5, walk: 0.15, crowdHigh: 3, crowdModerate: 1, disruption: 75 },
  quiet: { time: 0.82, transfers: 3.5, walk: 0.45, crowdHigh: 30, crowdModerate: 11, disruption: 85 },
  simple: { time: 0.82, transfers: 14, walk: 0.4, crowdHigh: 7, crowdModerate: 3, disruption: 85 },
  accessible: { time: 0.78, transfers: 4, walk: 2.8, crowdHigh: 8, crowdModerate: 3, disruption: 85 },
};

const SESSION_BUCKET_KEY = 'pulseroute-demand-bucket';

function crowdPenalty(label, weights) {
  if (label === 'High') return weights.crowdHigh;
  if (label === 'Moderate') return weights.crowdModerate;
  return 0;
}

export function routeSignature(route) {
  const legs = route?.legs || route?.segments || [];
  const legSignature = legs.map(leg => `${leg.mode || ''}:${leg.service || leg.line || ''}:${leg.from || leg.stations?.[0] || ''}>${leg.to || leg.stations?.at(-1) || ''}`).join('|');
  return `${route?.origin || ''}:${route?.destination || ''}:${legSignature || route?.detail || ''}`;
}

export function routeUsesAffectedLine(route, line) {
  if (!line) return false;
  return Boolean(route?.lines?.includes(line) || (route?.legs || route?.segments || []).some(leg => leg.line === line));
}

function disruptionExposure(route, liveData, explicitLine = '') {
  if (explicitLine && routeUsesAffectedLine(route, explicitLine)) return true;
  return disruptedAlerts(liveData).some(alert => alertAffectsRoute(alert, route));
}

function getDemandBucket() {
  if (typeof window === 'undefined') return 0;
  try {
    const existing = Number(window.sessionStorage.getItem(SESSION_BUCKET_KEY));
    if (Number.isInteger(existing) && existing >= 0) return existing;
    const bytes = new Uint16Array(1);
    window.crypto?.getRandomValues?.(bytes);
    const next = Number(bytes[0] || Math.floor(Math.random() * 65536));
    window.sessionStorage.setItem(SESSION_BUCKET_KEY, String(next));
    return next;
  } catch {
    return 0;
  }
}

function enrichRoute(route, preference, liveData, explicitAffectedLine = '') {
  const weights = WEIGHTS[preference] || WEIGHTS.balanced;
  const crowd = crowdForRoute(liveData, route);
  const disrupted = disruptionExposure(route, liveData, explicitAffectedLine);
  const duration = Number(route?.durationMinutes || route?.baseMinutes || 0);
  const transfers = Number(route?.transfers || 0);
  const walking = Number(route?.walkingMinutes || 0);
  const cost = duration * weights.time
    + transfers * weights.transfers
    + walking * weights.walk
    + crowdPenalty(crowd.label, weights)
    + (disrupted ? weights.disruption : 0);

  return {
    ...route,
    crowdInfo: crowd,
    disruptionExposure: disrupted,
    routeCost: cost,
  };
}

function reasonFor(route, fastest, preference, spreadChoice = false) {
  const extra = Math.max(0, (route.durationMinutes || 0) - (fastest?.durationMinutes || route.durationMinutes || 0));
  const crowd = route.crowdInfo?.label;
  const hasBus = Boolean(route.hasBus || route.busServices?.length);
  const walk = Number(route.walkingMinutes || 0);

  if (route.disruptionExposure) return 'Uses a currently affected corridor; consider another option.';
  if (preference === 'fastest' && extra === 0) return crowd === 'High' ? 'Fastest route, but current LTA readings indicate heavier crowding.' : 'Fastest available route for this departure time.';
  if (preference === 'quiet' && crowd === 'Low') return extra ? `${extra} min slower than the fastest route, but current LTA readings are less crowded.` : 'Fast and currently less crowded based on available LTA readings.';
  if (preference === 'accessible' && walk <= 4) return `Prioritised for less walking${walk ? ` (${walk} min)` : ''}.`;
  if (preference === 'simple' && Number(route.transfers || 0) === 0) return 'Prioritised because it avoids transfers.';
  if (spreadChoice) return hasBus
    ? `${extra ? `${extra} min slower, but ` : ''}selected from viable alternatives to avoid concentrating everyone on the same rail route.`
    : `${extra ? `${extra} min slower, but ` : ''}selected from near-equivalent viable routes to help spread demand.`;
  if (hasBus && extra <= 10) return `${extra ? `${extra} min slower than the fastest route, but ` : ''}adds a viable bus alternative instead of relying only on rail.`;
  if (crowd === 'Low' && extra <= 8) return `${extra ? `${extra} min slower than the fastest route, but ` : ''}offers more crowding headroom.`;
  if (extra === 0) return 'Fastest available option with the current route inputs.';
  return `${extra} min slower than the fastest route, with a different transfer/walking trade-off.`;
}

export function rankRoutes(routes, preference = 'balanced', liveData = null, options = {}) {
  if (!Array.isArray(routes) || !routes.length) return [];
  const enriched = routes.map(route => enrichRoute(route, preference, liveData, options.affectedLine));
  const fastest = [...enriched].sort((a, b) => (a.durationMinutes || Infinity) - (b.durationMinutes || Infinity))[0];
  let ordered = [...enriched].sort((a, b) => a.routeCost - b.routeCost || a.durationMinutes - b.durationMinutes);

  let spreadChoiceId = '';
  if (preference === 'balanced' && ordered.length > 1 && !options.disableDemandSpread) {
    const bestCost = ordered[0].routeCost;
    const viable = ordered.filter(route => !route.disruptionExposure
      && route.routeCost <= bestCost + 7
      && route.durationMinutes <= fastest.durationMinutes + 12);
    if (viable.length > 1) {
      const chosen = viable[getDemandBucket() % viable.length];
      spreadChoiceId = chosen.id;
      ordered = [chosen, ...ordered.filter(route => route.id !== chosen.id)];
    }
  }

  return ordered.map((route, index) => ({
    ...route,
    recommended: index === 0,
    recommendationReason: reasonFor(route, fastest, preference, index === 0 && route.id === spreadChoiceId),
    fastestDifferenceMinutes: Math.max(0, (route.durationMinutes || 0) - (fastest.durationMinutes || 0)),
    scoringPreference: preference,
  }));
}

function modeDiversity(route, activeRoute) {
  const activeModes = new Set((activeRoute?.legs || activeRoute?.segments || []).map(leg => leg.mode));
  const routeModes = new Set((route?.legs || route?.segments || []).map(leg => leg.mode));
  let score = 0;
  if (routeModes.has('BUS') && !activeModes.has('BUS')) score += 16;
  if (routeModes.has('WALK')) score += 5;
  if ([...routeModes].some(mode => !activeModes.has(mode))) score += 5;
  return score;
}

export function chooseRerouteAlternative(routes, activeRoute, { affectedLine = '', conditionType = 'disruption', liveData = null } = {}) {
  const activeSignature = routeSignature(activeRoute);
  const candidates = (routes || [])
    .filter(route => routeSignature(route) !== activeSignature)
    .map(route => {
      const crowd = crowdForRoute(liveData, route);
      const usesAffected = routeUsesAffectedLine(route, affectedLine);
      const extraMinutes = (route.durationMinutes || 0) - (activeRoute?.durationMinutes || 0);
      let score = 100 - Math.max(0, extraMinutes) * 1.2 - Number(route.transfers || 0) * 3 - Number(route.walkingMinutes || 0) * 0.35;
      if (conditionType === 'disruption') score += usesAffected ? -100 : 50;
      if (conditionType === 'crowding') score += crowd.label === 'Low' ? 25 : crowd.label === 'Moderate' ? 8 : crowd.label === 'High' ? -25 : 0;
      score += modeDiversity(route, activeRoute);
      return { route, crowd, usesAffected, score };
    })
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) return null;
  const chosen = candidates[0];
  const route = chosen.route;
  const hasBus = Boolean(route.hasBus || route.busServices?.length);
  const walk = Number(route.walkingMinutes || 0);
  let rerouteReason = conditionType === 'disruption' && !chosen.usesAffected
    ? `Avoids the affected ${affectedLine || 'rail'} corridor.`
    : conditionType === 'crowding' && chosen.crowd.label === 'Low'
      ? 'Uses an alternative with lower current LTA crowd readings.'
      : 'Provides a meaningfully different route under the changed conditions.';
  if (hasBus) rerouteReason += ' Includes a bus alternative rather than shifting everyone to the same rail path.';
  else if (walk > 0) rerouteReason += ' Uses walking to reach a different connection.';

  return { ...route, rerouteReason };
}
