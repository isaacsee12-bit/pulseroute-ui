import { LINE_META, LINE_SEQUENCES, STATION_BY_NAME } from '../data/mrtNetwork.js';

const BASE_EDGE_MINUTES = 2.35;
const TRANSFER_MINUTES = 5;

const graph = new Map();
function addEdge(from, to, line) {
  if (!graph.has(from)) graph.set(from, []);
  graph.get(from).push({ from, to, line, minutes: BASE_EDGE_MINUTES });
}

for (const sequence of LINE_SEQUENCES) {
  for (let i = 0; i < sequence.stations.length - 1; i += 1) {
    const a = sequence.stations[i].name;
    const b = sequence.stations[i + 1].name;
    addEdge(a, b, sequence.line);
    addEdge(b, a, sequence.line);
  }
}

function stateKey(station, line) {
  return `${station}::${line || 'START'}`;
}

function canonicalEdge(edge) {
  const pair = [edge.from, edge.to].sort().join('~');
  return `${pair}::${edge.line}`;
}

function parseClock(value) {
  const [hours, minutes] = String(value || '09:50').split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 9) * 60 + (Number.isFinite(minutes) ? minutes : 50);
}

function clockText(totalMinutes) {
  const wrapped = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function pathSignature(path) {
  return path.edges.map(edge => `${edge.from}>${edge.to}:${edge.line}`).join('|');
}

function dijkstra(origin, destination, options = {}) {
  const avoidLines = new Set(options.avoidLines || []);
  const bannedEdges = new Set(options.bannedEdges || []);
  const linePenalties = options.linePenalties || {};
  const queue = [{ station: origin, line: null, cost: 0, edges: [] }];
  const best = new Map([[stateKey(origin, null), 0]]);

  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift();
    const key = stateKey(current.station, current.line);
    if (current.cost > (best.get(key) ?? Infinity)) continue;
    if (current.station === destination && current.edges.length) return current;

    for (const edge of graph.get(current.station) || []) {
      if (avoidLines.has(edge.line)) continue;
      if (bannedEdges.has(canonicalEdge(edge))) continue;
      const transferPenalty = current.line && current.line !== edge.line ? TRANSFER_MINUTES : 0;
      const linePenalty = Number(linePenalties[edge.line] || 0);
      const nextCost = current.cost + edge.minutes + transferPenalty + linePenalty;
      const nextKey = stateKey(edge.to, edge.line);
      if (nextCost >= (best.get(nextKey) ?? Infinity)) continue;
      best.set(nextKey, nextCost);
      queue.push({ station: edge.to, line: edge.line, cost: nextCost, edges: [...current.edges, edge] });
    }
  }
  return null;
}

function segmentsFromEdges(edges) {
  const segments = [];
  for (const edge of edges) {
    const last = segments[segments.length - 1];
    if (!last || last.line !== edge.line) {
      segments.push({ line: edge.line, stations: [edge.from, edge.to] });
    } else if (last.stations[last.stations.length - 1] !== edge.to) {
      last.stations.push(edge.to);
    }
  }
  return segments;
}

function buildRoute(path, index, arrivalTime = '09:50', source = 'PulseRoute MRT graph') {
  const segments = segmentsFromEdges(path.edges);
  const stationSequence = [path.edges[0]?.from, ...path.edges.map(edge => edge.to)].filter(Boolean);
  const transfers = Math.max(0, segments.length - 1);
  const durationMinutes = Math.max(1, Math.round(path.cost));
  const arrivalMinute = parseClock(arrivalTime);
  const departureMinute = arrivalMinute - durationMinutes;
  const lineNames = segments.map(segment => segment.line);
  const transferStations = segments.slice(0, -1).map(segment => segment.stations[segment.stations.length - 1]);
  const title = lineNames.length ? lineNames.join(' → ') : 'MRT';
  const detail = transferStations.length
    ? `${stationSequence[0]} → ${transferStations.join(' → ')} → ${stationSequence[stationSequence.length - 1]}`
    : `${stationSequence[0]} → ${stationSequence[stationSequence.length - 1]}`;
  const confidence = Math.max(74, Math.min(94, 93 - transfers * 3 - Math.max(0, durationMinutes - 55) * 0.16));

  return {
    id: `mrt-${index}-${pathSignature(path)}`,
    source,
    shortTitle: title,
    title: lineNames.map(code => LINE_META[code]?.name || code).join(' → '),
    detail,
    durationMinutes,
    baseMinutes: durationMinutes,
    arrival: clockText(arrivalMinute),
    departure: clockText(departureMinute),
    transfers,
    walkingMinutes: 0,
    confidence: Math.round(confidence),
    reliability: confidence / 100,
    crowdLabel: 'Crowding checked separately',
    score: Math.max(50, 100 - durationMinutes - transfers * 5),
    lines: lineNames,
    segments,
    stationSequence,
    origin: stationSequence[0],
    destination: stationSequence[stationSequence.length - 1],
    googleRoute: false,
  };
}

function uniquePaths(paths) {
  const seen = new Set();
  return paths.filter(path => {
    if (!path) return false;
    const signature = pathSignature(path);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

export function planMrtRoutes(origin, destination, options = {}) {
  if (!STATION_BY_NAME[origin] || !STATION_BY_NAME[destination] || origin === destination) return [];
  const best = dijkstra(origin, destination, options);
  if (!best) return [];

  const candidates = [best];
  for (const edge of best.edges) {
    const alt = dijkstra(origin, destination, { ...options, bannedEdges: [...(options.bannedEdges || []), canonicalEdge(edge)] });
    if (alt) candidates.push(alt);
  }

  for (const line of new Set(best.edges.map(edge => edge.line))) {
    const alt = dijkstra(origin, destination, { ...options, linePenalties: { ...(options.linePenalties || {}), [line]: 1.4 } });
    if (alt) candidates.push(alt);
  }

  return uniquePaths(candidates)
    .sort((a, b) => a.cost - b.cost)
    .slice(0, 3)
    .map((path, index) => buildRoute(path, index, options.arrivalTime));
}

export function buildReroute(origin, destination, affectedLine, arrivalTime = '09:50', mode = 'disruption') {
  const options = mode === 'disruption'
    ? { avoidLines: affectedLine ? [affectedLine] : [], arrivalTime }
    : { linePenalties: affectedLine ? { [affectedLine]: 2.4 } : {}, arrivalTime };
  return planMrtRoutes(origin, destination, options)[0] || planMrtRoutes(origin, destination, { arrivalTime })[0] || null;
}

export function routeUsesLine(route, line) {
  return Boolean(route?.lines?.includes(line));
}

export function currentLeg(route) {
  return route?.segments?.[0] || null;
}

export function nextTransfer(route) {
  if (!route?.segments || route.segments.length < 2) return null;
  const first = route.segments[0];
  return {
    station: first.stations[first.stations.length - 1],
    fromLine: first.line,
    toLine: route.segments[1].line,
    minutes: Math.max(3, Math.round((first.stations.length - 1) * BASE_EDGE_MINUTES)),
  };
}
