import React, { useMemo, useRef, useState } from 'react';
import './transit-map.css';

const VIEWBOX = { width: 1000, height: 560 };

const STATIONS = {
  'Jurong East': { x: 70, y: 310, code: 'EW24 / NS1' },
  Clementi: { x: 125, y: 310, code: 'EW23' },
  Dover: { x: 170, y: 310, code: 'EW22' },
  'Buona Vista': { x: 215, y: 310, code: 'EW21 / CC22' },
  Commonwealth: { x: 260, y: 310, code: 'EW20' },
  Queenstown: { x: 305, y: 310, code: 'EW19' },
  Redhill: { x: 350, y: 310, code: 'EW18' },
  'Tiong Bahru': { x: 390, y: 310, code: 'EW17' },
  'Outram Park': { x: 430, y: 310, code: 'EW16 / NE3 / TE17' },
  'Tanjong Pagar': { x: 475, y: 310, code: 'EW15' },
  'Raffles Place': { x: 520, y: 310, code: 'EW14 / NS26' },
  'City Hall': { x: 565, y: 310, code: 'EW13 / NS25' },
  Bugis: { x: 610, y: 310, code: 'EW12 / DT14' },
  Lavender: { x: 650, y: 310, code: 'EW11' },
  Kallang: { x: 690, y: 310, code: 'EW10' },
  Aljunied: { x: 725, y: 310, code: 'EW9' },
  'Paya Lebar': { x: 765, y: 310, code: 'EW8 / CC9' },
  Eunos: { x: 805, y: 310, code: 'EW7' },
  Kembangan: { x: 840, y: 310, code: 'EW6' },
  Bedok: { x: 875, y: 310, code: 'EW5' },
  'Tanah Merah': { x: 905, y: 285, code: 'EW4' },
  Simei: { x: 915, y: 250, code: 'EW3' },
  Tampines: { x: 900, y: 210, code: 'EW2 / DT32' },
  'Pasir Ris': { x: 860, y: 175, code: 'EW1' },

  'Holland Village': { x: 245, y: 260, code: 'CC21' },
  'Farrer Road': { x: 275, y: 205, code: 'CC20' },
  'Botanic Gardens': { x: 315, y: 155, code: 'CC19 / DT9' },
  Caldecott: { x: 385, y: 125, code: 'CC17 / TE9' },
  Marymount: { x: 430, y: 115, code: 'CC16' },
  Bishan: { x: 475, y: 120, code: 'CC15 / NS17' },
  'Lorong Chuan': { x: 530, y: 132, code: 'CC14' },
  Serangoon: { x: 590, y: 150, code: 'CC13 / NE12' },
  Bartley: { x: 630, y: 170, code: 'CC12' },
  'Tai Seng': { x: 665, y: 190, code: 'CC11' },
  MacPherson: { x: 700, y: 215, code: 'CC10 / DT26' },
  Dakota: { x: 735, y: 350, code: 'CC8' },
  Mountbatten: { x: 705, y: 372, code: 'CC7' },
  Stadium: { x: 670, y: 390, code: 'CC6' },
  'Nicoll Highway': { x: 630, y: 400, code: 'CC5' },
  Promenade: { x: 590, y: 405, code: 'CC4 / DT15' },
  Esplanade: { x: 555, y: 392, code: 'CC3' },
  'Bras Basah': { x: 520, y: 375, code: 'CC2' },
  'Dhoby Ghaut': { x: 500, y: 350, code: 'CC1 / NS24 / NE6' },
  'one-north': { x: 230, y: 355, code: 'CC23' },
  'Kent Ridge': { x: 250, y: 390, code: 'CC24' },
  'Haw Par Villa': { x: 275, y: 420, code: 'CC25' },
  'Pasir Panjang': { x: 305, y: 448, code: 'CC26' },
  'Labrador Park': { x: 335, y: 468, code: 'CC27' },
  'Telok Blangah': { x: 365, y: 478, code: 'CC28' },
  HarbourFront: { x: 395, y: 480, code: 'CC29 / NE1' },
  Keppel: { x: 425, y: 482, code: 'CC30' },
  Cantonment: { x: 455, y: 475, code: 'CC31' },
  'Prince Edward Road': { x: 485, y: 458, code: 'CC32' },
  'Marina Bay': { x: 520, y: 438, code: 'CC33 / NS27 / TE20' },
  Bayfront: { x: 555, y: 430, code: 'CE1 / DT16' },

  Stevens: { x: 350, y: 180, code: 'DT10 / TE11' },
  Newton: { x: 392, y: 210, code: 'DT11 / NS21' },
  'Little India': { x: 430, y: 242, code: 'DT12 / NE7' },
  Rochor: { x: 475, y: 270, code: 'DT13' },
  Downtown: { x: 515, y: 448, code: 'DT17' },
  'Telok Ayer': { x: 475, y: 430, code: 'DT18' },
  Chinatown: { x: 440, y: 400, code: 'DT19 / NE4' },
  'Fort Canning': { x: 430, y: 365, code: 'DT20' },
  Bencoolen: { x: 465, y: 335, code: 'DT21' },
  'Jalan Besar': { x: 515, y: 285, code: 'DT22' },
  Bendemeer: { x: 565, y: 260, code: 'DT23' },
  'Geylang Bahru': { x: 615, y: 240, code: 'DT24' },
  Mattar: { x: 660, y: 225, code: 'DT25' },
  Ubi: { x: 740, y: 225, code: 'DT27' },
  'Kaki Bukit': { x: 780, y: 235, code: 'DT28' },
  'Bedok North': { x: 815, y: 250, code: 'DT29' },
  'Bedok Reservoir': { x: 845, y: 267, code: 'DT30' },
  'Tampines West': { x: 875, y: 285, code: 'DT31' },

  Braddell: { x: 475, y: 160, code: 'NS18' },
  'Toa Payoh': { x: 470, y: 190, code: 'NS19' },
  Novena: { x: 430, y: 205, code: 'NS20' },
  Orchard: { x: 395, y: 278, code: 'NS22 / TE14' },
  Somerset: { x: 440, y: 320, code: 'NS23' },

  Woodleigh: { x: 570, y: 188, code: 'NE11' },
  'Potong Pasir': { x: 552, y: 218, code: 'NE10' },
  'Boon Keng': { x: 535, y: 248, code: 'NE9' },
  'Farrer Park': { x: 500, y: 268, code: 'NE8' },
  'Clarke Quay': { x: 465, y: 378, code: 'NE5' },
};

const LINES = {
  EWL: {
    name: 'East-West Line',
    color: '#009645',
    stations: ['Jurong East', 'Clementi', 'Dover', 'Buona Vista', 'Commonwealth', 'Queenstown', 'Redhill', 'Tiong Bahru', 'Outram Park', 'Tanjong Pagar', 'Raffles Place', 'City Hall', 'Bugis', 'Lavender', 'Kallang', 'Aljunied', 'Paya Lebar', 'Eunos', 'Kembangan', 'Bedok', 'Tanah Merah', 'Simei', 'Tampines', 'Pasir Ris'],
  },
  CCL: {
    name: 'Circle Line',
    color: '#fa9e0d',
    stations: ['Buona Vista', 'Holland Village', 'Farrer Road', 'Botanic Gardens', 'Caldecott', 'Marymount', 'Bishan', 'Lorong Chuan', 'Serangoon', 'Bartley', 'Tai Seng', 'MacPherson', 'Paya Lebar', 'Dakota', 'Mountbatten', 'Stadium', 'Nicoll Highway', 'Promenade', 'Esplanade', 'Bras Basah', 'Dhoby Ghaut'],
    loopStations: ['Buona Vista', 'one-north', 'Kent Ridge', 'Haw Par Villa', 'Pasir Panjang', 'Labrador Park', 'Telok Blangah', 'HarbourFront', 'Keppel', 'Cantonment', 'Prince Edward Road', 'Marina Bay', 'Bayfront', 'Promenade'],
  },
  DTL: {
    name: 'Downtown Line',
    color: '#005ec4',
    stations: ['Botanic Gardens', 'Stevens', 'Newton', 'Little India', 'Rochor', 'Bugis', 'Promenade', 'Bayfront', 'Downtown', 'Telok Ayer', 'Chinatown', 'Fort Canning', 'Bencoolen', 'Jalan Besar', 'Bendemeer', 'Geylang Bahru', 'Mattar', 'MacPherson', 'Ubi', 'Kaki Bukit', 'Bedok North', 'Bedok Reservoir', 'Tampines West', 'Tampines'],
  },
  NSL: {
    name: 'North-South Line',
    color: '#d42e12',
    stations: ['Bishan', 'Braddell', 'Toa Payoh', 'Novena', 'Newton', 'Orchard', 'Somerset', 'Dhoby Ghaut', 'City Hall', 'Raffles Place', 'Marina Bay'],
  },
  NEL: {
    name: 'North East Line',
    color: '#9900aa',
    stations: ['Serangoon', 'Woodleigh', 'Potong Pasir', 'Boon Keng', 'Farrer Park', 'Little India', 'Dhoby Ghaut', 'Clarke Quay', 'Chinatown', 'Outram Park', 'HarbourFront'],
  },
};

const IMPORTANT_LABELS = new Set([
  'Jurong East', 'Buona Vista', 'Botanic Gardens', 'Bishan', 'Serangoon', 'MacPherson',
  'Paya Lebar', 'Tampines', 'Bugis', 'Little India', 'Dhoby Ghaut', 'Outram Park',
  'Raffles Place', 'City Hall', 'Marina Bay', 'HarbourFront', 'Bedok', 'Pasir Ris',
]);

const ROUTE_DEFS = {
  bus33: {
    name: 'Recommended: DTL → CCL',
    segments: [
      { line: 'DTL', from: 'Tampines', to: 'MacPherson' },
      { line: 'CCL', from: 'MacPherson', to: 'Buona Vista' },
    ],
  },
  bus168: {
    name: 'Alternative: EWL → CCL',
    segments: [
      { line: 'EWL', from: 'Tampines', to: 'Paya Lebar' },
      { line: 'CCL', from: 'Paya Lebar', to: 'Buona Vista' },
    ],
  },
  bedok: {
    name: 'Alternative: DTL via Botanic Gardens',
    segments: [
      { line: 'DTL', from: 'Tampines', to: 'Botanic Gardens' },
      { line: 'CCL', from: 'Botanic Gardens', to: 'Buona Vista' },
    ],
  },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pathFromNames(names) {
  return names
    .map((name, index) => {
      const station = STATIONS[name];
      return `${index === 0 ? 'M' : 'L'} ${station.x} ${station.y}`;
    })
    .join(' ');
}

function segmentNames(lineId, from, to) {
  const line = LINES[lineId];
  const candidates = [line.stations, line.loopStations].filter(Boolean);
  for (const list of candidates) {
    const a = list.indexOf(from);
    const b = list.indexOf(to);
    if (a !== -1 && b !== -1) {
      return a <= b ? list.slice(a, b + 1) : list.slice(b, a + 1).reverse();
    }
  }
  return [];
}

function Station({ name, zoom, selectedNames, disruptedNames }) {
  const station = STATIONS[name];
  const isSelected = selectedNames.has(name);
  const isDisrupted = disruptedNames.has(name);
  const isInterchange = station.code.includes('/');
  const showLabel = IMPORTANT_LABELS.has(name) || zoom >= 1.42;
  const labelAbove = station.y > 390 || ['Buona Vista', 'Paya Lebar', 'Tampines', 'Jurong East', 'City Hall'].includes(name);

  return (
    <g className={`transit-station ${isSelected ? 'is-selected' : ''} ${isDisrupted ? 'is-disrupted' : ''}`}>
      <title>{`${name} (${station.code})`}</title>
      {isSelected && <circle cx={station.x} cy={station.y} r="10" className="station-selected-halo" />}
      <circle cx={station.x} cy={station.y} r={isInterchange ? 5.5 : 4.2} className="station-node" />
      {showLabel && (
        <g className="station-label-group">
          <text
            x={station.x}
            y={station.y + (labelAbove ? -11 : 18)}
            textAnchor="middle"
            className="station-name"
          >
            {name}
          </text>
          {(IMPORTANT_LABELS.has(name) || zoom >= 1.7) && (
            <text
              x={station.x}
              y={station.y + (labelAbove ? -22 : 30)}
              textAnchor="middle"
              className="station-code"
            >
              {station.code}
            </text>
          )}
        </g>
      )}
    </g>
  );
}

export default function InteractiveTransitMap({ activeRoute = 'bus33' }) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [legendOpen, setLegendOpen] = useState(false);

  const route = ROUTE_DEFS[activeRoute] || ROUTE_DEFS.bus33;
  const selectedSegments = useMemo(
    () => route.segments.map(segment => ({ ...segment, names: segmentNames(segment.line, segment.from, segment.to) })),
    [route],
  );

  const selectedNames = useMemo(() => {
    const set = new Set();
    selectedSegments.forEach(segment => segment.names.forEach(name => set.add(name)));
    return set;
  }, [selectedSegments]);

  const disruptionNames = useMemo(() => new Set(segmentNames('EWL', 'Jurong East', 'Buona Vista')), []);
  const allStationNames = useMemo(() => Array.from(new Set(Object.values(LINES).flatMap(line => [...line.stations, ...(line.loopStations || [])]))), []);

  const toViewBoxPoint = event => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * VIEWBOX.width,
      y: ((event.clientY - rect.top) / rect.height) * VIEWBOX.height,
    };
  };

  const onPointerDown = event => {
    if (zoom <= 1) return;
    const point = toViewBoxPoint(event);
    dragRef.current = { point, pan };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = event => {
    if (!dragRef.current) return;
    const point = toViewBoxPoint(event);
    setPan({
      x: dragRef.current.pan.x + (point.x - dragRef.current.point.x),
      y: dragRef.current.pan.y + (point.y - dragRef.current.point.y),
    });
  };

  const onPointerUp = event => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const setSafeZoom = next => {
    const value = clamp(next, 1, 2.35);
    setZoom(value);
    if (value === 1) setPan({ x: 0, y: 0 });
  };

  const resetMap = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const transform = `translate(${pan.x} ${pan.y}) translate(${VIEWBOX.width / 2} ${VIEWBOX.height / 2}) scale(${zoom}) translate(${-VIEWBOX.width / 2} ${-VIEWBOX.height / 2})`;

  return (
    <section className="interactive-map-card" aria-label="Interactive Singapore MRT route map">
      <div className="interactive-map-header">
        <div>
          <h3>Route map</h3>
          <p>Focused Singapore MRT schematic · station order and interchanges follow the current network · not to scale</p>
        </div>
        <div className="interactive-map-route-chip">
          <span className="route-chip-dot" />
          {route.name}
        </div>
      </div>

      <div className="interactive-map-stage">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
          role="img"
          aria-label="Singapore MRT schematic showing the selected route and the East-West Line disruption"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={resetMap}
          onWheel={event => {
            event.preventDefault();
            setSafeZoom(zoom + (event.deltaY < 0 ? 0.15 : -0.15));
          }}
        >
          <rect width={VIEWBOX.width} height={VIEWBOX.height} className="map-water" />
          <path
            className="map-land"
            d="M52 218 C95 90 240 66 355 77 C475 28 660 52 745 91 C846 94 946 151 965 252 C988 374 889 490 760 497 C632 535 520 514 405 522 C293 535 177 493 110 430 C42 367 25 289 52 218 Z"
          />
          <g className="map-grid" opacity=".55">
            <path d="M70 150H930M70 230H930M70 310H930M70 390H930M70 470H930" />
            <path d="M150 90V500M300 75V515M450 70V520M600 70V520M750 80V510M900 125V455" />
          </g>

          <g transform={transform} className={zoom > 1 ? 'is-zoomed' : ''}>
            {Object.entries(LINES).map(([lineId, line]) => (
              <React.Fragment key={lineId}>
                <path d={pathFromNames(line.stations)} className="transit-line-halo" />
                <path d={pathFromNames(line.stations)} className="transit-line" style={{ stroke: line.color }} />
                {line.loopStations && (
                  <>
                    <path d={pathFromNames(line.loopStations)} className="transit-line-halo" />
                    <path d={pathFromNames(line.loopStations)} className="transit-line" style={{ stroke: line.color }} />
                  </>
                )}
              </React.Fragment>
            ))}

            <path d={pathFromNames(segmentNames('EWL', 'Jurong East', 'Buona Vista'))} className="disruption-halo" />
            <path d={pathFromNames(segmentNames('EWL', 'Jurong East', 'Buona Vista'))} className="disruption-line" />

            {selectedSegments.map((segment, index) => (
              <React.Fragment key={`${segment.line}-${segment.from}-${segment.to}`}>
                <path d={pathFromNames(segment.names)} className="selected-route-halo" />
                <path d={pathFromNames(segment.names)} className="selected-route-line" />
                {index === selectedSegments.length - 1 && null}
              </React.Fragment>
            ))}

            {allStationNames.map(name => (
              <Station
                key={name}
                name={name}
                zoom={zoom}
                selectedNames={selectedNames}
                disruptedNames={disruptionNames}
              />
            ))}

            <g transform={`translate(${STATIONS.Tampines.x - 36} ${STATIONS.Tampines.y - 54})`}>
              <rect width="78" height="28" rx="8" className="endpoint-tag endpoint-start" />
              <text x="39" y="18" textAnchor="middle" className="endpoint-text">Start · Tampines</text>
            </g>
            <g transform={`translate(${STATIONS['Buona Vista'].x - 44} ${STATIONS['Buona Vista'].y + 18})`}>
              <rect width="92" height="28" rx="8" className="endpoint-tag endpoint-end" />
              <text x="46" y="18" textAnchor="middle" className="endpoint-text">Buona Vista</text>
            </g>

            <g transform="translate(95 252)">
              <rect width="152" height="42" rx="10" className="disruption-card-bg" />
              <circle cx="20" cy="21" r="10" className="disruption-alert-dot" />
              <text x="20" y="25" textAnchor="middle" className="disruption-alert-mark">!</text>
              <text x="39" y="17" className="disruption-card-title">EWL disruption</text>
              <text x="39" y="31" className="disruption-card-copy">Jurong East ↔ Buona Vista</text>
            </g>
          </g>
        </svg>

        <div className="map-control-stack" aria-label="Map controls">
          <button type="button" onClick={() => setSafeZoom(zoom + 0.2)} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => setSafeZoom(zoom - 0.2)} aria-label="Zoom out">−</button>
          <button type="button" onClick={resetMap} aria-label="Reset map">↺</button>
        </div>

        <div className="map-zoom-readout">{Math.round(zoom * 100)}%</div>

        <button type="button" className="network-legend-toggle" onClick={() => setLegendOpen(value => !value)}>
          <span className="legend-layers">≡</span>
          Legend
          <span className={legendOpen ? 'legend-caret open' : 'legend-caret'}>⌄</span>
        </button>

        {legendOpen && (
          <div className="network-legend-panel">
            {Object.entries(LINES).map(([id, line]) => (
              <div className="network-legend-row" key={id}>
                <span className="network-legend-swatch" style={{ background: line.color }} />
                <strong>{id}</strong>
                <span>{line.name}</span>
              </div>
            ))}
            <div className="network-legend-row">
              <span className="network-legend-swatch selected" />
              <strong>Route</strong>
              <span>Selected recommendation</span>
            </div>
            <div className="network-legend-row">
              <span className="network-legend-swatch disrupted" />
              <strong>Alert</strong>
              <span>No-service segment</span>
            </div>
          </div>
        )}

        <div className="map-instruction">Scroll or use +/− to zoom · drag when zoomed · double-click to reset</div>
      </div>
    </section>
  );
}
