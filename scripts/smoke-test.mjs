import assert from 'node:assert/strict';
import { buildSimulationReliefRoute } from '../src/data/demoRoutes.js';
import { nextTransfer, planMrtRoutes, transitLegLabel } from '../src/lib/mrtRouter.js';
import { normaliseOneMapItinerary } from '../src/lib/oneMapTransit.js';
import { chooseRerouteAlternative, rankRoutes } from '../src/lib/routeScoring.js';
import { aggregateCommunityReports } from '../src/lib/communityCrowd.js';
import { crowdIntelligenceForRoute } from '../src/lib/crowdIntelligence.js';

const oneMapFixture = {
  duration: 2100,
  startTime: 1789434000000,
  endTime: 1789436100000,
  walkTime: 300,
  walkDistance: 420,
  transfers: 1,
  fare: '1.90',
  legs: [
    {
      mode: 'WALK',
      duration: 180,
      distance: 210,
      from: { name: 'TAMPINES MRT STATION' },
      to: { name: 'Tampines Bus Interchange', stopCode: '75009' },
    },
    {
      mode: 'BUS',
      routeShortName: '23',
      duration: 720,
      distance: 5100,
      headsign: 'Rochor Stn',
      from: { name: 'Tampines Bus Interchange', stopCode: '75009' },
      to: { name: 'Bedok North MRT Station', stopCode: '84501' },
      intermediateStops: [{ name: 'Example Bus Stop', stopCode: '84001' }],
    },
    {
      mode: 'SUBWAY',
      routeShortName: 'DT',
      routeLongName: 'DOWNTOWN LINE',
      duration: 1200,
      from: { name: 'BEDOK NORTH MRT STATION', stopCode: 'DT29' },
      to: { name: 'BUGIS MRT STATION', stopCode: 'DT14' },
      intermediateStops: [{ name: 'MACPHERSON MRT STATION', stopCode: 'DT26' }],
    },
  ],
};

const parsed = normaliseOneMapItinerary(oneMapFixture, 0, 'Tampines', 'Bugis');
assert.deepEqual(parsed.legs.map(leg => leg.mode), ['WALK', 'BUS', 'SUBWAY']);
assert.equal(parsed.busServices[0], '23');
assert.equal(parsed.lines[0], 'DTL');
assert.equal(parsed.walkingMinutes, 5);
assert.equal(parsed.totalWalkDistanceMetres, 420);
assert.equal(parsed.transfers, 1);
assert.equal(parsed.hasBus, true);
assert.equal(parsed.hasWalking, true);
assert.equal(parsed.legs[1].fromStopCode, '75009');

const local = planMrtRoutes('Bugis', 'Paya Lebar', { departureTime: '09:00' });
assert.ok(local.length >= 1, 'Local MRT fallback should route Bugis to Paya Lebar');
assert.equal(local[0].sourceKind, 'model');
assert.ok(local[0].legs.every(leg => leg.mode === 'SUBWAY'));

const railTransferFixture = {
  legs: [
    {
      mode: 'SUBWAY',
      from: 'Tampines West',
      to: 'Tampines',
      service: 'DTL',
      line: 'DTL',
      label: 'Downtown Line',
      durationMinutes: 2,
    },
    {
      mode: 'SUBWAY',
      from: 'Tampines',
      to: 'Jurong East',
      service: 'EWL',
      line: 'EWL',
      label: 'East-West Line',
      durationMinutes: 52,
    },
  ],
};
const tampinesTransfer = nextTransfer(railTransferFixture);
assert.equal(tampinesTransfer.station, 'Tampines');
assert.equal(tampinesTransfer.fromLine, 'Downtown Line');
assert.equal(tampinesTransfer.toLine, 'East-West Line');
assert.equal(transitLegLabel(railTransferFixture.legs[0]), 'Downtown Line');
assert.ok(!tampinesTransfer.fromLine.startsWith('Bus '), 'Rail line must never be labelled as a bus merely because service contains DTL');

const simulated = buildSimulationReliefRoute(local[0], 'EWL', '09:00');
assert.ok(simulated, 'Multimodal hackathon simulation should exist for Bugis to Paya Lebar');
assert.equal(simulated.sourceKind, 'simulation');
assert.deepEqual(simulated.legs.map(leg => leg.mode), ['WALK', 'BUS', 'WALK']);
assert.equal(simulated.legs[1].service, '7');
assert.equal(simulated.legs[1].fromStopCode, '01112');
assert.equal(simulated.legs[1].toStopCode, '82011');

const liveData = {
  configured: true,
  alerts: [],
  crowd: {
    EWL: [{ Station: 'EW2', CrowdLevel: 'h' }],
    DTL: [{ Station: 'DT26', CrowdLevel: 'l' }],
  },
};
const fastCrowded = {
  id: 'fast', durationMinutes: 20, transfers: 0, walkingMinutes: 0,
  stationSequence: ['Tampines'], lines: ['EWL'], legs: [{ mode: 'SUBWAY', line: 'EWL', from: 'Tampines', to: 'Simei' }],
};
const slowerQuiet = {
  id: 'quiet', durationMinutes: 25, transfers: 1, walkingMinutes: 2,
  stationSequence: ['MacPherson'], lines: ['DTL'], legs: [{ mode: 'SUBWAY', line: 'DTL', from: 'MacPherson', to: 'Ubi' }],
};
assert.equal(rankRoutes([fastCrowded, slowerQuiet], 'fastest', liveData, { disableDemandSpread: true })[0].id, 'fast');
assert.equal(rankRoutes([fastCrowded, slowerQuiet], 'quiet', liveData, { disableDemandSpread: true })[0].id, 'quiet');
assert.equal(rankRoutes([fastCrowded, slowerQuiet], 'simple', liveData, { disableDemandSpread: true })[0].id, 'fast');


const crowdNow = Date.UTC(2026, 8, 18, 12, 0, 0);
const communityReports = ['a', 'b', 'c'].map((client, index) => ({
  id: `report-${client}`,
  station: 'Tampines',
  station_code: 'EW2',
  line: 'EWL',
  crowd_level: 'red',
  crowd_value: 2,
  client_tag: `00000000-0000-4000-8000-00000000000${index + 1}`,
  reported_at: new Date(crowdNow - index * 60_000).toISOString(),
}));
const communityState = {
  configured: true,
  mode: 'shared',
  aggregates: aggregateCommunityReports(communityReports, crowdNow),
};
assert.equal(communityState.aggregates[0].label, 'Very crowded');
assert.equal(communityState.aggregates[0].reportCount, 3);
assert.equal(communityState.aggregates[0].confidence, 'Moderate confidence');

const communityCrowd = crowdIntelligenceForRoute(null, communityState, fastCrowded);
assert.equal(communityCrowd.label, 'High');
assert.match(communityCrowd.source, /Community/);
assert.equal(
  rankRoutes([fastCrowded, slowerQuiet], 'quiet', null, { communityCrowd: communityState, disableDemandSpread: true })[0].id,
  'quiet',
  'Three recent red community reports should materially penalise the affected route in Less crowded mode',
);

const active = { ...fastCrowded, origin: 'Tampines', destination: 'Bugis' };
const busAlternative = {
  id: 'bus-alt', origin: 'Tampines', destination: 'Bugis', durationMinutes: 26, transfers: 1, walkingMinutes: 4,
  stationSequence: ['MacPherson'], lines: ['DTL'], hasBus: true, busServices: ['23'],
  legs: [{ mode: 'BUS', service: '23', line: 'BUS', from: 'Tampines', to: 'Bedok North' }, { mode: 'SUBWAY', line: 'DTL', from: 'Bedok North', to: 'Bugis' }],
};
const railAlternative = {
  id: 'rail-alt', origin: 'Tampines', destination: 'Bugis', durationMinutes: 25, transfers: 1, walkingMinutes: 0,
  stationSequence: ['MacPherson'], lines: ['DTL'],
  legs: [{ mode: 'SUBWAY', line: 'DTL', from: 'Tampines', to: 'Bugis' }],
};
const reroute = chooseRerouteAlternative([railAlternative, busAlternative], active, { affectedLine: 'EWL', conditionType: 'disruption', liveData });
assert.equal(reroute.id, 'bus-alt');
assert.match(reroute.rerouteReason, /bus alternative/i);

console.log('PulseRoute smoke tests passed: local fallback, multimodal routes, preferences, community crowd aggregation, and disruption rerouting.');
