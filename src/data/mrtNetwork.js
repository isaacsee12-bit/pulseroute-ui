export const LINE_META = {
  NSL: { name: 'North-South Line', color: '#d42e12' },
  EWL: { name: 'East-West Line', color: '#009645' },
  NEL: { name: 'North East Line', color: '#9900aa' },
  CCL: { name: 'Circle Line', color: '#fa9e0d' },
  DTL: { name: 'Downtown Line', color: '#005ec4' },
  TEL: { name: 'Thomson-East Coast Line', color: '#9d5b25' },
};

const s = (code, name) => ({ code, name });

export const LINE_SEQUENCES = [
  {
    id: 'NSL',
    line: 'NSL',
    stations: [
      s('NS1', 'Jurong East'), s('NS2', 'Bukit Batok'), s('NS3', 'Bukit Gombak'), s('NS4', 'Choa Chu Kang'),
      s('NS5', 'Yew Tee'), s('NS7', 'Kranji'), s('NS8', 'Marsiling'), s('NS9', 'Woodlands'), s('NS10', 'Admiralty'),
      s('NS11', 'Sembawang'), s('NS12', 'Canberra'), s('NS13', 'Yishun'), s('NS14', 'Khatib'), s('NS15', 'Yio Chu Kang'),
      s('NS16', 'Ang Mo Kio'), s('NS17', 'Bishan'), s('NS18', 'Braddell'), s('NS19', 'Toa Payoh'), s('NS20', 'Novena'),
      s('NS21', 'Newton'), s('NS22', 'Orchard'), s('NS23', 'Somerset'), s('NS24', 'Dhoby Ghaut'), s('NS25', 'City Hall'),
      s('NS26', 'Raffles Place'), s('NS27', 'Marina Bay'), s('NS28', 'Marina South Pier'),
    ],
  },
  {
    id: 'EWL-main',
    line: 'EWL',
    stations: [
      s('EW1', 'Pasir Ris'), s('EW2', 'Tampines'), s('EW3', 'Simei'), s('EW4', 'Tanah Merah'), s('EW5', 'Bedok'),
      s('EW6', 'Kembangan'), s('EW7', 'Eunos'), s('EW8', 'Paya Lebar'), s('EW9', 'Aljunied'), s('EW10', 'Kallang'),
      s('EW11', 'Lavender'), s('EW12', 'Bugis'), s('EW13', 'City Hall'), s('EW14', 'Raffles Place'), s('EW15', 'Tanjong Pagar'),
      s('EW16', 'Outram Park'), s('EW17', 'Tiong Bahru'), s('EW18', 'Redhill'), s('EW19', 'Queenstown'), s('EW20', 'Commonwealth'),
      s('EW21', 'Buona Vista'), s('EW22', 'Dover'), s('EW23', 'Clementi'), s('EW24', 'Jurong East'), s('EW25', 'Chinese Garden'),
      s('EW26', 'Lakeside'), s('EW27', 'Boon Lay'), s('EW28', 'Pioneer'), s('EW29', 'Joo Koon'), s('EW30', 'Gul Circle'),
      s('EW31', 'Tuas Crescent'), s('EW32', 'Tuas West Road'), s('EW33', 'Tuas Link'),
    ],
  },
  {
    id: 'EWL-Changi',
    line: 'EWL',
    stations: [s('EW4', 'Tanah Merah'), s('CG1', 'Expo'), s('CG2', 'Changi Airport')],
  },
  {
    id: 'NEL',
    line: 'NEL',
    stations: [
      s('NE1', 'HarbourFront'), s('NE3', 'Outram Park'), s('NE4', 'Chinatown'), s('NE5', 'Clarke Quay'),
      s('NE6', 'Dhoby Ghaut'), s('NE7', 'Little India'), s('NE8', 'Farrer Park'), s('NE9', 'Boon Keng'),
      s('NE10', 'Potong Pasir'), s('NE11', 'Woodleigh'), s('NE12', 'Serangoon'), s('NE13', 'Kovan'),
      s('NE14', 'Hougang'), s('NE15', 'Buangkok'), s('NE16', 'Sengkang'), s('NE17', 'Punggol'),
    ],
  },
  {
    id: 'CCL-loop',
    line: 'CCL',
    stations: [
      s('CC4', 'Promenade'), s('CC5', 'Nicoll Highway'), s('CC6', 'Stadium'), s('CC7', 'Mountbatten'), s('CC8', 'Dakota'),
      s('CC9', 'Paya Lebar'), s('CC10', 'MacPherson'), s('CC11', 'Tai Seng'), s('CC12', 'Bartley'), s('CC13', 'Serangoon'),
      s('CC14', 'Lorong Chuan'), s('CC15', 'Bishan'), s('CC16', 'Marymount'), s('CC17', 'Caldecott'), s('CC19', 'Botanic Gardens'),
      s('CC20', 'Farrer Road'), s('CC21', 'Holland Village'), s('CC22', 'Buona Vista'), s('CC23', 'one-north'), s('CC24', 'Kent Ridge'),
      s('CC25', 'Haw Par Villa'), s('CC26', 'Pasir Panjang'), s('CC27', 'Labrador Park'), s('CC28', 'Telok Blangah'),
      s('CC29', 'HarbourFront'), s('CC30', 'Keppel'), s('CC31', 'Cantonment'), s('CC32', 'Prince Edward Road'),
      s('CC33', 'Marina Bay'), s('CC34', 'Bayfront'), s('CC4', 'Promenade'),
    ],
  },
  {
    id: 'CCL-Dhoby',
    line: 'CCL',
    stations: [s('CC4', 'Promenade'), s('CC3', 'Esplanade'), s('CC2', 'Bras Basah'), s('CC1', 'Dhoby Ghaut')],
  },
  {
    id: 'DTL',
    line: 'DTL',
    stations: [
      s('DT1', 'Bukit Panjang'), s('DT2', 'Cashew'), s('DT3', 'Hillview'), s('DT4', 'Hume'), s('DT5', 'Beauty World'),
      s('DT6', 'King Albert Park'), s('DT7', 'Sixth Avenue'), s('DT8', 'Tan Kah Kee'), s('DT9', 'Botanic Gardens'),
      s('DT10', 'Stevens'), s('DT11', 'Newton'), s('DT12', 'Little India'), s('DT13', 'Rochor'), s('DT14', 'Bugis'),
      s('DT15', 'Promenade'), s('DT16', 'Bayfront'), s('DT17', 'Downtown'), s('DT18', 'Telok Ayer'), s('DT19', 'Chinatown'),
      s('DT20', 'Fort Canning'), s('DT21', 'Bencoolen'), s('DT22', 'Jalan Besar'), s('DT23', 'Bendemeer'), s('DT24', 'Geylang Bahru'),
      s('DT25', 'Mattar'), s('DT26', 'MacPherson'), s('DT27', 'Ubi'), s('DT28', 'Kaki Bukit'), s('DT29', 'Bedok North'),
      s('DT30', 'Bedok Reservoir'), s('DT31', 'Tampines West'), s('DT32', 'Tampines'), s('DT33', 'Tampines East'),
      s('DT34', 'Upper Changi'), s('DT35', 'Expo'),
    ],
  },
  {
    id: 'TEL',
    line: 'TEL',
    stations: [
      s('TE1', 'Woodlands North'), s('TE2', 'Woodlands'), s('TE3', 'Woodlands South'), s('TE4', 'Springleaf'), s('TE5', 'Lentor'),
      s('TE6', 'Mayflower'), s('TE7', 'Bright Hill'), s('TE8', 'Upper Thomson'), s('TE9', 'Caldecott'), s('TE11', 'Stevens'),
      s('TE12', 'Napier'), s('TE13', 'Orchard Boulevard'), s('TE14', 'Orchard'), s('TE15', 'Great World'), s('TE16', 'Havelock'),
      s('TE17', 'Outram Park'), s('TE18', 'Maxwell'), s('TE19', 'Shenton Way'), s('TE20', 'Marina Bay'),
      s('TE22', 'Gardens by the Bay'), s('TE23', 'Tanjong Rhu'), s('TE24', 'Katong Park'), s('TE25', 'Tanjong Katong'),
      s('TE26', 'Marine Parade'), s('TE27', 'Marine Terrace'), s('TE28', 'Siglap'), s('TE29', 'Bayshore'),
    ],
  },
];

export const UPCOMING_STATIONS = [
  { code: 'DT36', name: 'Xilin', note: 'DTL3e — scheduled for H2 2026; not included in operational routing until LTA confirms opening.' },
  { code: 'DT37 / TE31', name: 'Sungei Bedok', note: 'DTL3e / TEL5 — scheduled for H2 2026; not included in operational routing until LTA confirms opening.' },
  { code: 'TE30', name: 'Bedok South', note: 'TEL5 — scheduled for H2 2026; not included in operational routing until LTA confirms opening.' },
  { code: 'TE10', name: 'Mount Pleasant', note: 'Opening date to be advised by LTA.' },
  { code: 'TE21', name: 'Marina South', note: 'Opening date to be advised by LTA.' },
  { code: 'TE22A', name: "Founders' Memorial", note: 'To open with the Founders’ Memorial development.' },
  { code: 'CC18', name: 'Bukit Brown', note: 'Future station; not operational.' },
];

const stationMap = new Map();
for (const sequence of LINE_SEQUENCES) {
  for (const station of sequence.stations) {
    const existing = stationMap.get(station.name) || { name: station.name, codes: [], lines: [] };
    if (!existing.codes.includes(station.code)) existing.codes.push(station.code);
    if (!existing.lines.includes(sequence.line)) existing.lines.push(sequence.line);
    stationMap.set(station.name, existing);
  }
}

export const MRT_STATIONS = Array.from(stationMap.values())
  .map(station => ({ ...station, label: `${station.name} (${station.codes.join(' / ')})` }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const STATION_BY_NAME = Object.fromEntries(MRT_STATIONS.map(station => [station.name, station]));
export const STATION_BY_CODE = Object.fromEntries(MRT_STATIONS.flatMap(station => station.codes.map(code => [code, station])));

function normalise(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function levenshtein(a, b) {
  const left = normalise(a);
  const right = normalise(b);
  if (!left) return right.length;
  if (!right) return left.length;
  const prev = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i += 1) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const old = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (left[i - 1] === right[j - 1] ? 0 : 1));
      last = old;
    }
  }
  return prev[right.length];
}

export function searchStations(query, limit = 7) {
  const q = normalise(query);
  if (!q) return MRT_STATIONS.slice(0, limit);
  return MRT_STATIONS
    .map(station => {
      const name = normalise(station.name);
      const codeText = normalise(station.codes.join(' '));
      let score = 100;
      if (name === q || codeText === q) score = 0;
      else if (name.startsWith(q) || codeText.startsWith(q)) score = 1;
      else if (name.includes(q) || codeText.includes(q)) score = 2;
      else {
        const distance = Math.min(levenshtein(q, name), ...station.codes.map(code => levenshtein(q, code)));
        score = 3 + distance / Math.max(q.length, name.length);
      }
      return { ...station, score };
    })
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function stationNameFromCode(code) {
  return STATION_BY_CODE[code]?.name || code;
}
