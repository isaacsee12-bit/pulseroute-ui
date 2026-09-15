export const DEMO_STATIONS = [
  'Tampines',
  'Paya Lebar',
  'MacPherson',
  'Botanic Gardens',
  'Buona Vista',
  'Jurong East',
];

export const ROUTE_OPTIONS = [
  {
    id: 'bus33',
    title: 'Downtown Line → Circle Line',
    shortTitle: 'DTL → CCL via MacPherson',
    detail: 'Tampines (DT32) → MacPherson (DT26/CC10) → Buona Vista (CC22)',
    lines: ['DTL', 'CCL'],
    arrival: '9:42 AM',
    baseMinutes: 52,
    transfers: 1,
    walkingMinutes: 4,
    reliability: 0.93,
    crowdHeadroom: 0.44,
    accessibility: 0.96,
    capacityPer15Min: 5200,
    currentLoad: 2860,
    disruptedExposure: 0,
    color: '#0878f9',
  },
  {
    id: 'bus168',
    title: 'East-West Line → Circle Line',
    shortTitle: 'EWL → CCL via Paya Lebar',
    detail: 'Tampines (EW2) → Paya Lebar (EW8/CC9) → Buona Vista (CC22)',
    lines: ['EWL', 'CCL'],
    arrival: '9:45 AM',
    baseMinutes: 55,
    transfers: 1,
    walkingMinutes: 3,
    reliability: 0.86,
    crowdHeadroom: 0.29,
    accessibility: 0.97,
    capacityPer15Min: 4700,
    currentLoad: 3340,
    disruptedExposure: 0.12,
    color: '#009645',
  },
  {
    id: 'bedok',
    title: 'DTL via Botanic Gardens → CCL',
    shortTitle: 'DTL → CCL via Botanic Gardens',
    detail: 'Tampines (DT32) → Botanic Gardens (DT9/CC19) → Buona Vista (CC22)',
    lines: ['DTL', 'CCL'],
    arrival: '9:46 AM',
    baseMinutes: 56,
    transfers: 1,
    walkingMinutes: 5,
    reliability: 0.95,
    crowdHeadroom: 0.36,
    accessibility: 0.94,
    capacityPer15Min: 4900,
    currentLoad: 3135,
    disruptedExposure: 0,
    color: '#fa9e0d',
  },
];

export const LINE_STATUS = [
  { code: 'EWL', name: 'East-West Line', status: 'Major disruption', severity: 'critical', detail: 'No service between Jurong East and Buona Vista.' },
  { code: 'DTL', name: 'Downtown Line', status: 'Running normally', severity: 'good', detail: 'Higher demand expected through MacPherson.' },
  { code: 'CCL', name: 'Circle Line', status: 'Running normally', severity: 'good', detail: 'Moderate crowding around Buona Vista.' },
  { code: 'NSL', name: 'North-South Line', status: 'Running normally', severity: 'good', detail: 'No major service impact.' },
  { code: 'TEL', name: 'Thomson-East Coast Line', status: 'Running normally', severity: 'good', detail: 'No major service impact.' },
];

export const CROWDING = [
  { station: 'Tampines', level: 86, label: 'High', note: 'Eastbound platforms busier than usual' },
  { station: 'Paya Lebar', level: 74, label: 'High', note: 'Interchange transfer demand elevated' },
  { station: 'MacPherson', level: 61, label: 'Moderate', note: 'DTL → CCL transfer demand rising' },
  { station: 'Buona Vista', level: 68, label: 'Moderate', note: 'Crowding near CCL platforms' },
];

export const INCIDENT = {
  id: 'ewl-track-fault',
  title: 'East-West Line disruption',
  severity: 'Major delay',
  segment: 'Jurong East ↔ Buona Vista',
  description: 'No train service between Jurong East and Buona Vista due to a track fault. Free regular bus alternatives and unaffected rail corridors should absorb displaced demand.',
  startedAt: '7:48 AM',
  recovery: 'Service recovery under assessment',
  affectedJourneys: 12480,
  affectedStations: 4,
};

export const OPERATOR_ALTERNATIVES = [
  { id: 'bus33', label: 'DTL → CCL', capacity: 5200, baseLoad: 2860 },
  { id: 'bus168', label: 'EWL → CCL', capacity: 4700, baseLoad: 3340 },
  { id: 'bedok', label: 'DTL via Botanic Gardens', capacity: 4900, baseLoad: 3135 },
  { id: 'bus', label: 'Parallel bus services', capacity: 2500, baseLoad: 1120 },
  { id: 'delay', label: 'Delay departure', capacity: 3400, baseLoad: 900 },
];

export const ABOUT_PILLARS = [
  {
    title: 'Commuter decision support',
    copy: 'Convert a network disruption into a small set of personalised, explainable actions instead of sending everyone to the same fastest alternative.',
  },
  {
    title: 'Network-aware balancing',
    copy: 'Score viable alternatives using reliability, crowding, spare capacity and commuter preferences, then spread demand across the network.',
  },
  {
    title: 'Operator feedback loop',
    copy: 'Give operators a view of predicted passenger movements, overloaded nodes, recommendation acceptance and the effect of intervention strength.',
  },
];
