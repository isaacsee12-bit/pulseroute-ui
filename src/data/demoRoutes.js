function addMinutes(clockValue, minutesToAdd) {
  const [hours, minutes] = String(clockValue || '09:00').split(':').map(Number);
  const total = ((Number.isFinite(hours) ? hours : 9) * 60 + (Number.isFinite(minutes) ? minutes : 0) + minutesToAdd) % 1440;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

const reverse = value => value.toLowerCase();

export function buildSimulationReliefRoute(activeRoute, affectedLine, departureTime = '09:00') {
  if (!activeRoute || affectedLine !== 'EWL') return null;
  const origin = reverse(activeRoute.origin || '');
  const destination = reverse(activeRoute.destination || '');

  // This scenario uses a real, currently operating Bus 7 corridor and real bus-stop codes,
  // but the walking/travel durations below are deliberately illustrative. The UI always
  // labels the whole route as Simulation and never presents these durations as OneMap/LTA data.
  if (origin !== 'bugis' || destination !== 'paya lebar') return null;

  const legs = [
    {
      mode: 'WALK',
      from: 'Bugis MRT',
      to: 'Opp Bugis Stn Exit C',
      durationMinutes: 3,
      distanceMetres: null,
      service: '',
      line: 'WALK',
      label: 'Walk',
      headsign: '',
      stopCount: null,
      departure: '',
      arrival: '',
      fromStopCode: '',
      toStopCode: '01112',
      stations: ['Bugis MRT', 'Opp Bugis Stn Exit C'],
    },
    {
      mode: 'BUS',
      from: 'Opp Bugis Stn Exit C',
      to: 'Aft Paya Lebar Quarter',
      durationMinutes: 21,
      distanceMetres: null,
      service: '7',
      line: 'BUS',
      label: 'Bus 7',
      headsign: 'Bedok Int',
      stopCount: null,
      departure: '',
      arrival: '',
      fromStopCode: '01112',
      toStopCode: '82011',
      stations: ['Opp Bugis Stn Exit C', 'Aft Paya Lebar Quarter'],
    },
    {
      mode: 'WALK',
      from: 'Aft Paya Lebar Quarter',
      to: 'Paya Lebar MRT',
      durationMinutes: 4,
      distanceMetres: null,
      service: '',
      line: 'WALK',
      label: 'Walk',
      headsign: '',
      stopCount: null,
      departure: '',
      arrival: '',
      fromStopCode: '82011',
      toStopCode: '',
      stations: ['Aft Paya Lebar Quarter', 'Paya Lebar MRT'],
    },
  ];

  const durationMinutes = legs.reduce((sum, leg) => sum + leg.durationMinutes, 0);
  return {
    id: `simulation-bugis-paya-lebar-bus7-${departureTime}`,
    source: 'Simulation',
    sourceKind: 'simulation',
    simulation: true,
    shortTitle: 'Walk → Bus 7 → Walk',
    title: 'Walk → Bus 7 → Walk',
    detail: 'Bugis MRT → Bus 7 → Paya Lebar MRT',
    durationMinutes,
    baseMinutes: durationMinutes,
    departure: addMinutes(departureTime, 0),
    arrival: addMinutes(departureTime, durationMinutes),
    transfers: 0,
    walkingMinutes: 7,
    totalWalkDistanceMetres: null,
    confidence: 78,
    confidenceSource: 'Simulation estimate',
    reliability: 0.78,
    crowdLabel: 'Lower expected',
    lines: [],
    busServices: ['7'],
    hasBus: true,
    hasWalking: true,
    legs,
    segments: legs,
    stationSequence: ['Bugis', 'Paya Lebar'],
    origin: 'Bugis',
    destination: 'Paya Lebar',
    rerouteReason: 'Simulation: avoids the affected East-West Line and demonstrates a bus-and-walk relief option instead of shifting everyone to another MRT route.',
    simulationNote: 'Bus 7 and the listed stops are real; the displayed walking and journey durations are illustrative hackathon simulation values.',
  };
}
