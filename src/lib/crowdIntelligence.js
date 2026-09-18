import { STATION_BY_NAME } from '../data/mrtNetwork.js';
import { crowdForRoute } from './liveRail.js';

const LINE_PREFIX = { NS: 'NSL', EW: 'EWL', CG: 'EWL', NE: 'NEL', CC: 'CCL', DT: 'DTL', TE: 'TEL' };
const severity = { Low: 0, Moderate: 1, High: 2, Unknown: -1 };

function lineForCode(code = '') {
  return LINE_PREFIX[String(code).slice(0, 2)] || '';
}

function routeStationCodes(route) {
  const rows = [];
  const routeLines = new Set(route?.lines || []);
  for (const name of route?.stationSequence || []) {
    const station = STATION_BY_NAME[name];
    for (const code of station?.codes || []) {
      const line = lineForCode(code);
      if (!routeLines.size || routeLines.has(line)) rows.push({ station: name, stationCode: code, line });
    }
  }

  for (const leg of route?.legs || route?.segments || []) {
    for (const code of [leg?.fromStopCode, leg?.toStopCode, ...(leg?.intermediateStops || []).map(stop => stop?.stopCode)]) {
      const line = lineForCode(code);
      if (line) rows.push({ station: '', stationCode: code, line });
    }
  }

  const seen = new Set();
  return rows.filter(row => {
    const key = `${row.stationCode}::${row.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function communityCrowdForRoute(communityState, route) {
  const routeCodes = routeStationCodes(route);
  const candidates = (communityState?.aggregates || []).filter(row =>
    routeCodes.some(item => item.stationCode === row.stationCode && (!row.line || !item.line || item.line === row.line)),
  );
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => (severity[b.routeLevel] ?? -1) - (severity[a.routeLevel] ?? -1) || b.reportCount - a.reportCount)[0];
}

function levelFromScore(score) {
  if (score >= 1.5) return 'High';
  if (score >= 0.5) return 'Moderate';
  return 'Low';
}

export function crowdIntelligenceForRoute(liveData, communityState, route) {
  const official = crowdForRoute(liveData, route);
  const community = communityCrowdForRoute(communityState, route);
  const officialSeverity = severity[official.label] ?? -1;
  const communitySeverity = community ? severity[community.routeLevel] ?? -1 : -1;
  const communityUsable = Boolean(community && community.reportCount >= 3);

  if (officialSeverity < 0 && !communityUsable) {
    return {
      label: 'Unknown',
      source: community
        ? `Community · ${community.reportCount} recent report${community.reportCount === 1 ? '' : 's'} (limited)`
        : official.source,
      official,
      community,
    };
  }

  if (officialSeverity < 0 && communityUsable) {
    return {
      label: community.routeLevel,
      source: `Community · ${community.reportCount} recent reports`,
      official,
      community,
    };
  }

  if (!communityUsable) {
    return {
      label: official.label,
      source: official.source,
      official,
      community,
    };
  }

  const communityWeight = community.reportCount >= 8 ? 0.65 : 0.4;
  const officialWeight = 1 - communityWeight;
  const combined = levelFromScore(officialSeverity * officialWeight + communitySeverity * communityWeight);
  return {
    label: combined,
    source: 'LTA + Community',
    official,
    community,
  };
}
