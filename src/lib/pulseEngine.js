const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const preferenceWeights = {
  balanced: { time: 0.28, reliability: 0.27, crowd: 0.24, transfers: 0.11, walking: 0.05, accessibility: 0.05 },
  fastest: { time: 0.47, reliability: 0.23, crowd: 0.12, transfers: 0.1, walking: 0.05, accessibility: 0.03 },
  quiet: { time: 0.16, reliability: 0.22, crowd: 0.42, transfers: 0.08, walking: 0.06, accessibility: 0.06 },
  simple: { time: 0.2, reliability: 0.24, crowd: 0.18, transfers: 0.28, walking: 0.05, accessibility: 0.05 },
  accessible: { time: 0.16, reliability: 0.24, crowd: 0.2, transfers: 0.12, walking: 0.08, accessibility: 0.2 },
};

function scoreRoute(route, preference = 'balanced', profile = {}) {
  const weights = preferenceWeights[preference] || preferenceWeights.balanced;
  const timeScore = clamp(1 - (route.baseMinutes - 48) / 24);
  const transferScore = clamp(1 - route.transfers / 3);
  const walkingScore = clamp(1 - route.walkingMinutes / 16);
  const reliabilityScore = clamp(route.reliability - route.disruptedExposure * 0.5);
  const crowdScore = clamp(route.crowdHeadroom);
  const accessibilityScore = clamp(route.accessibility);

  let score =
    timeScore * weights.time +
    reliabilityScore * weights.reliability +
    crowdScore * weights.crowd +
    transferScore * weights.transfers +
    walkingScore * weights.walking +
    accessibilityScore * weights.accessibility;

  if (profile.avoidCrowds) score += crowdScore * 0.08;
  if (profile.stepFree) score += accessibilityScore * 0.07;
  if (profile.maxWalking && route.walkingMinutes > profile.maxWalking) score -= 0.12;
  score -= route.disruptedExposure * 0.15;

  const confidence = Math.round(clamp(reliabilityScore * 0.62 + crowdScore * 0.2 + timeScore * 0.18) * 100);
  const reasons = [];
  if (route.disruptedExposure < 0.05) reasons.push('avoids disrupted section');
  if (route.crowdHeadroom >= 0.4) reasons.push('more spare capacity');
  if (route.reliability >= 0.94) reasons.push('high reliability');
  if (route.walkingMinutes <= 4) reasons.push('low walking');

  return {
    ...route,
    score: Math.round(clamp(score, 0, 1) * 100),
    confidence,
    reasons: reasons.slice(0, 2),
    crowdLabel: route.crowdHeadroom >= 0.4 ? 'Less crowded' : route.crowdHeadroom >= 0.32 ? 'Moderate' : 'Busier',
  };
}

export function rankRoutes(routes, preference = 'balanced', profile = {}) {
  return routes
    .map(route => scoreRoute(route, preference, profile))
    .sort((a, b) => b.score - a.score || a.baseMinutes - b.baseMinutes);
}

export function allocateDemand(alternatives, displacedDemand, interventionStrength = 100) {
  const baseline = alternatives.map((item, index) => ({
    ...item,
    baselineShare: index === 1 ? 0.58 : index === 0 ? 0.19 : index === 2 ? 0.11 : index === 3 ? 0.08 : 0.04,
  }));

  const attractiveness = alternatives.map(item => {
    const spare = Math.max(0, item.capacity - item.baseLoad);
    const headroom = spare / item.capacity;
    const typeBoost = item.id === 'delay' ? 0.72 : item.id === 'bus' ? 0.82 : 1;
    return Math.max(0.05, headroom * typeBoost);
  });
  const attractivenessTotal = attractiveness.reduce((sum, value) => sum + value, 0);
  const targetShares = attractiveness.map(value => value / attractivenessTotal);
  const blend = clamp(interventionStrength / 100);

  let shares = baseline.map((item, index) => item.baselineShare * (1 - blend) + targetShares[index] * blend);
  const shareTotal = shares.reduce((sum, value) => sum + value, 0);
  shares = shares.map(value => value / shareTotal);

  const results = alternatives.map((item, index) => {
    const allocated = Math.round(displacedDemand * shares[index]);
    const projectedLoad = item.baseLoad + allocated;
    const utilisation = projectedLoad / item.capacity;
    return {
      ...item,
      share: shares[index],
      allocated,
      projectedLoad,
      utilisation,
      overloaded: projectedLoad > item.capacity,
    };
  });

  const baselineResults = baseline.map(item => {
    const allocated = Math.round(displacedDemand * item.baselineShare);
    return {
      ...item,
      allocated,
      projectedLoad: item.baseLoad + allocated,
      utilisation: (item.baseLoad + allocated) / item.capacity,
    };
  });

  const beforeOverload = baselineResults.reduce((sum, item) => sum + Math.max(0, item.projectedLoad - item.capacity), 0);
  const afterOverload = results.reduce((sum, item) => sum + Math.max(0, item.projectedLoad - item.capacity), 0);
  const avoided = Math.max(0, beforeOverload - afterOverload);
  const acceptanceRate = Math.round(48 + blend * 26);

  return {
    results,
    baselineResults,
    beforeOverload,
    afterOverload,
    avoided,
    acceptanceRate,
    displacedDemand,
  };
}
