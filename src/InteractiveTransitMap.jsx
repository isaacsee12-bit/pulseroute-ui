import React, { useMemo, useRef, useState } from 'react';
import './transit-map.css';

const LTA_SYSTEM_MAP = 'https://www.lta.gov.sg/content/dam/ltagov/getting_around/public_transport/rail_network/pdf/SM_EN_(Ver210726)_CCL6.pdf';

const LINE_META = {
  DTL: { name: 'Downtown Line', color: '#005ec4' },
  CCL: { name: 'Circle Line', color: '#fa9e0d' },
  EWL: { name: 'East-West Line', color: '#009645' },
  NEL: { name: 'North East Line', color: '#9900aa' },
  NSL: { name: 'North-South Line', color: '#d42e12' },
  TEL: { name: 'Thomson-East Coast Line', color: '#9d5b25' },
};

const p = (name, code, x, y, major = false) => ({ name, code, x, y, major });

const ROUTES = {
  bus33: {
    title: 'DTL → CCL via MacPherson',
    subtitle: 'Tampines → MacPherson → Buona Vista',
    transfer: 'Transfer at MacPherson (DT26 / CC10)',
    segments: [
      {
        line: 'DTL',
        points: [
          p('Tampines', 'DT32', 900, 320, true),
          p('Tampines West', 'DT31', 845, 320),
          p('Bedok Reservoir', 'DT30', 790, 320),
          p('Bedok North', 'DT29', 735, 320),
          p('Kaki Bukit', 'DT28', 680, 320),
          p('Ubi', 'DT27', 625, 305),
          p('MacPherson', 'DT26', 570, 280, true),
        ],
      },
      {
        line: 'CCL',
        points: [
          p('MacPherson', 'CC10', 570, 280, true),
          p('Tai Seng', 'CC11', 600, 240),
          p('Bartley', 'CC12', 615, 195),
          p('Serangoon', 'CC13', 590, 150, true),
          p('Lorong Chuan', 'CC14', 540, 115),
          p('Bishan', 'CC15', 480, 100, true),
          p('Marymount', 'CC16', 415, 105),
          p('Caldecott', 'CC17', 355, 130, true),
          p('Botanic Gardens', 'CC19', 295, 170, true),
          p('Farrer Road', 'CC20', 245, 210),
          p('Holland Village', 'CC21', 205, 250),
          p('Buona Vista', 'CC22', 165, 290, true),
        ],
      },
    ],
    steps: [
      { line: 'DTL', code: 'DT32', station: 'Tampines' },
      { line: 'DTL', code: 'DT26', station: 'MacPherson' },
      { line: 'CCL', code: 'CC10', station: 'MacPherson' },
      { line: 'CCL', code: 'CC22', station: 'Buona Vista' },
    ],
  },
  bus168: {
    title: 'EWL → CCL via Paya Lebar',
    subtitle: 'Tampines → Paya Lebar → Buona Vista',
    transfer: 'Transfer at Paya Lebar (EW8 / CC9)',
    segments: [
      {
        line: 'EWL',
        points: [
          p('Tampines', 'EW2', 900, 330, true),
          p('Simei', 'EW3', 830, 330),
          p('Tanah Merah', 'EW4', 760, 330, true),
          p('Bedok', 'EW5', 690, 330),
          p('Kembangan', 'EW6', 620, 330),
          p('Eunos', 'EW7', 550, 330),
          p('Paya Lebar', 'EW8', 485, 330, true),
        ],
      },
      {
        line: 'CCL',
        points: [
          p('Paya Lebar', 'CC9', 485, 330, true),
          p('MacPherson', 'CC10', 455, 290, true),
          p('Tai Seng', 'CC11', 470, 245),
          p('Bartley', 'CC12', 500, 205),
          p('Serangoon', 'CC13', 515, 160, true),
          p('Lorong Chuan', 'CC14', 470, 120),
          p('Bishan', 'CC15', 420, 100, true),
          p('Marymount', 'CC16', 360, 105),
          p('Caldecott', 'CC17', 310, 130, true),
          p('Botanic Gardens', 'CC19', 260, 170, true),
          p('Farrer Road', 'CC20', 220, 210),
          p('Holland Village', 'CC21', 185, 250),
          p('Buona Vista', 'CC22', 150, 290, true),
        ],
      },
    ],
    steps: [
      { line: 'EWL', code: 'EW2', station: 'Tampines' },
      { line: 'EWL', code: 'EW8', station: 'Paya Lebar' },
      { line: 'CCL', code: 'CC9', station: 'Paya Lebar' },
      { line: 'CCL', code: 'CC22', station: 'Buona Vista' },
    ],
  },
  bedok: {
    title: 'DTL → CCL via Botanic Gardens',
    subtitle: 'Tampines → Botanic Gardens → Buona Vista',
    transfer: 'Transfer at Botanic Gardens (DT9 / CC19)',
    segments: [
      {
        line: 'DTL',
        points: [
          p('Tampines', 'DT32', 900, 300, true),
          p('Tampines West', 'DT31', 855, 300),
          p('Bedok Reservoir', 'DT30', 810, 300),
          p('Bedok North', 'DT29', 765, 300),
          p('Kaki Bukit', 'DT28', 720, 300),
          p('Ubi', 'DT27', 675, 300),
          p('MacPherson', 'DT26', 630, 285, true),
          p('Mattar', 'DT25', 595, 265),
          p('Geylang Bahru', 'DT24', 560, 245),
          p('Bendemeer', 'DT23', 525, 225),
          p('Jalan Besar', 'DT22', 490, 205),
          p('Bencoolen', 'DT21', 455, 225),
          p('Fort Canning', 'DT20', 425, 250),
          p('Chinatown', 'DT19', 445, 280, true),
          p('Telok Ayer', 'DT18', 480, 305),
          p('Downtown', 'DT17', 520, 325),
          p('Bayfront', 'DT16', 560, 330, true),
          p('Promenade', 'DT15', 600, 315, true),
          p('Bugis', 'DT14', 585, 280, true),
          p('Rochor', 'DT13', 555, 250),
          p('Little India', 'DT12', 520, 215, true),
          p('Newton', 'DT11', 475, 185, true),
          p('Stevens', 'DT10', 420, 160, true),
          p('Botanic Gardens', 'DT9', 350, 150, true),
        ],
      },
      {
        line: 'CCL',
        points: [
          p('Botanic Gardens', 'CC19', 350, 150, true),
          p('Farrer Road', 'CC20', 285, 190),
          p('Holland Village', 'CC21', 220, 235),
          p('Buona Vista', 'CC22', 165, 285, true),
        ],
      },
    ],
    steps: [
      { line: 'DTL', code: 'DT32', station: 'Tampines' },
      { line: 'DTL', code: 'DT9', station: 'Botanic Gardens' },
      { line: 'CCL', code: 'CC19', station: 'Botanic Gardens' },
      { line: 'CCL', code: 'CC22', station: 'Buona Vista' },
    ],
  },
};

const INTERCHANGE_CODES = {
  Tampines: 'EW2 · DT32',
  MacPherson: 'CC10 · DT26',
  'Paya Lebar': 'EW8 · CC9',
  Serangoon: 'CC13 · NE12',
  Bishan: 'CC15 · NS17',
  Caldecott: 'CC17 · TE9',
  'Botanic Gardens': 'CC19 · DT9',
  'Buona Vista': 'EW21 · CC22',
  Newton: 'DT11 · NS21',
  'Little India': 'DT12 · NE7',
  Bugis: 'EW12 · DT14',
  Promenade: 'CC4 · DT15',
  Bayfront: 'CE1 · DT16',
  Chinatown: 'DT19 · NE4',
  Stevens: 'DT10 · TE11',
  'Tanah Merah': 'EW4',
};

const CONNECTIONS = {
  Tampines: [{ line: 'EWL', dx1: -82, dy1: 0, dx2: 82, dy2: 0 }],
  MacPherson: [],
  'Paya Lebar': [],
  Serangoon: [{ line: 'NEL', dx1: -42, dy1: 42, dx2: 42, dy2: -42 }],
  Bishan: [{ line: 'NSL', dx1: 0, dy1: -60, dx2: 0, dy2: 60 }],
  Caldecott: [{ line: 'TEL', dx1: 0, dy1: -58, dx2: 0, dy2: 58 }],
  'Botanic Gardens': [],
  Newton: [{ line: 'NSL', dx1: -36, dy1: -44, dx2: 36, dy2: 44 }],
  'Little India': [{ line: 'NEL', dx1: -45, dy1: 30, dx2: 45, dy2: -30 }],
  Bugis: [{ line: 'EWL', dx1: -55, dy1: 0, dx2: 55, dy2: 0 }],
  'Buona Vista': [{ line: 'EWL', dx1: -88, dy1: 0, dx2: 88, dy2: 0 }],
};

const DISRUPTION_STATIONS = [
  ['EW24 / NS1', 'Jurong East'],
  ['EW23', 'Clementi'],
  ['EW22', 'Dover'],
  ['EW21 / CC22', 'Buona Vista'],
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pathFromPoints(points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function lineColorsForStation(route, stationName) {
  const colors = [];
  route.segments.forEach(segment => {
    if (segment.points.some(point => point.name === stationName)) {
      const color = LINE_META[segment.line].color;
      if (!colors.includes(color)) colors.push(color);
    }
  });
  return colors;
}

function stationLabelPosition(point) {
  if (point.name === 'Tampines') return { dx: 0, dy: -24, anchor: 'middle' };
  if (point.name === 'Buona Vista') return { dx: 0, dy: 31, anchor: 'middle' };
  if (['MacPherson', 'Paya Lebar', 'Botanic Gardens'].includes(point.name)) return { dx: 16, dy: -14, anchor: 'start' };
  if (['Serangoon', 'Bishan', 'Caldecott', 'Newton', 'Stevens'].includes(point.name)) return { dx: 0, dy: -22, anchor: 'middle' };
  return { dx: 0, dy: 21, anchor: 'middle' };
}

export default function InteractiveTransitMap({ activeRoute = 'bus33' }) {
  const route = ROUTES[activeRoute] || ROUTES.bus33;
  const dragRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [legendOpen, setLegendOpen] = useState(false);

  const stations = useMemo(() => {
    const map = new Map();
    route.segments.forEach(segment => {
      segment.points.forEach(point => {
        const existing = map.get(point.name);
        map.set(point.name, existing ? { ...existing, major: existing.major || point.major } : point);
      });
    });
    return Array.from(map.values());
  }, [route]);

  const stationNames = useMemo(() => new Set(stations.map(station => station.name)), [stations]);
  const transferStation = route.steps[1].station;

  const setSafeZoom = nextZoom => {
    const next = clamp(nextZoom, 1, 2.6);
    setZoom(next);
    if (next === 1) setPan({ x: 0, y: 0 });
  };

  const resetMap = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const onPointerDown = event => {
    if (zoom <= 1) return;
    dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = event => {
    if (!dragRef.current) return;
    const maxPan = (zoom - 1) * 360;
    setPan({
      x: clamp(dragRef.current.panX + event.clientX - dragRef.current.x, -maxPan, maxPan),
      y: clamp(dragRef.current.panY + event.clientY - dragRef.current.y, -maxPan, maxPan),
    });
  };

  const stopDragging = event => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const transform = `translate(${pan.x} ${pan.y}) translate(500 230) scale(${zoom}) translate(-500 -230)`;

  return (
    <section className="focused-map-card" aria-label="Focused Singapore MRT route schematic">
      <div className="focused-map-header">
        <div>
          <div className="focused-map-title-row">
            <h3>Route map</h3>
            <span className="verified-badge">LTA-verified topology</span>
          </div>
          <p>Only your journey is emphasised. Station order, codes and interchanges are verified against the current LTA network; schematic is not to geographic scale.</p>
        </div>
        <a className="official-map-link" href={LTA_SYSTEM_MAP} target="_blank" rel="noreferrer">Open official LTA map ↗</a>
      </div>

      <div className="selected-route-summary">
        <div className="selected-route-heading">
          <span className="selected-route-kicker">Selected route</span>
          <strong>{route.title}</strong>
          <small>{route.transfer}</small>
        </div>
        <div className="route-step-strip" aria-label={route.title}>
          {route.steps.map((step, index) => (
            <React.Fragment key={`${step.line}-${step.code}-${index}`}>
              {index > 0 && <span className="route-step-arrow">→</span>}
              <div className="route-step">
                <span className="line-code" style={{ background: LINE_META[step.line].color }}>{step.code}</span>
                <span>{step.station}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div
        className={zoom > 1 ? 'focused-map-stage is-zoomed' : 'focused-map-stage'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onDoubleClick={resetMap}
        onWheel={event => {
          event.preventDefault();
          setSafeZoom(zoom + (event.deltaY < 0 ? 0.16 : -0.16));
        }}
      >
        <svg viewBox="0 0 1000 460" role="img" aria-label={`${route.title}: ${route.subtitle}`}>
          <defs>
            <linearGradient id="focusedWater" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#eaf6fb" />
              <stop offset="100%" stopColor="#dcecf6" />
            </linearGradient>
            <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#274b70" floodOpacity=".16" />
            </filter>
          </defs>

          <rect width="1000" height="460" rx="16" fill="url(#focusedWater)" />
          <path className="focused-island" d="M72 236 C112 112 242 58 370 72 C485 39 656 51 757 98 C861 108 942 173 955 269 C965 350 896 410 805 413 C712 444 612 426 515 438 C395 449 279 432 184 392 C91 353 43 296 72 236 Z" />
          <g className="focused-city-grid">
            <path d="M105 170H900M92 235H924M84 300H914M120 365H850" />
            <path d="M190 105V395M330 75V420M470 65V430M610 75V425M750 95V405M875 135V365" />
          </g>

          <g transform={transform}>
            {stations.map(station => {
              const connections = CONNECTIONS[station.name] || [];
              return connections.map((connection, index) => (
                <g key={`${station.name}-${connection.line}-${index}`} className="muted-connection">
                  <line
                    x1={station.x + connection.dx1}
                    y1={station.y + connection.dy1}
                    x2={station.x + connection.dx2}
                    y2={station.y + connection.dy2}
                    stroke={LINE_META[connection.line].color}
                  />
                  <text
                    x={station.x + connection.dx2 + 7}
                    y={station.y + connection.dy2 + 4}
                    className="muted-line-label"
                    fill={LINE_META[connection.line].color}
                  >
                    {connection.line}
                  </text>
                </g>
              ));
            })}

            {stationNames.has('Buona Vista') && (
              <g className="disrupted-map-segment">
                <line x1="58" y1="290" x2="165" y2="290" />
                <g transform="translate(68 246)">
                  <rect width="176" height="34" rx="9" />
                  <circle cx="17" cy="17" r="9" />
                  <text x="17" y="21" textAnchor="middle" className="disrupted-mark">!</text>
                  <text x="33" y="14" className="disrupted-title">EWL no service</text>
                  <text x="33" y="27" className="disrupted-copy">Jurong East → Buona Vista</text>
                </g>
              </g>
            )}

            {route.segments.map(segment => (
              <g key={`${activeRoute}-${segment.line}`} className="active-route-segment">
                <path d={pathFromPoints(segment.points)} className="active-route-underlay" />
                <path d={pathFromPoints(segment.points)} className="active-route-line" style={{ stroke: LINE_META[segment.line].color }} />
              </g>
            ))}

            {stations.map(station => {
              const colors = lineColorsForStation(route, station.name);
              const isTransfer = station.name === transferStation;
              const isEndpoint = station.name === 'Tampines' || station.name === 'Buona Vista';
              const showLabel = station.major || zoom >= 1.52;
              const label = stationLabelPosition(station);
              return (
                <g key={station.name} className={`focused-station ${isTransfer ? 'is-transfer' : ''} ${isEndpoint ? 'is-endpoint' : ''}`}>
                  <title>{`${station.name} — ${INTERCHANGE_CODES[station.name] || station.code}`}</title>
                  {(isTransfer || isEndpoint) && <circle cx={station.x} cy={station.y} r="12" className="station-halo" />}
                  {colors.length > 1 && <circle cx={station.x} cy={station.y} r="8" fill="white" stroke={colors[1]} strokeWidth="4" />}
                  <circle cx={station.x} cy={station.y} r={isTransfer || isEndpoint ? 6.5 : 4.2} fill={colors[0] || '#18335d'} className="station-dot" />
                  {showLabel && (
                    <g className="focused-station-label">
                      <text x={station.x + label.dx} y={station.y + label.dy} textAnchor={label.anchor} className="focused-station-name">{station.name}</text>
                      <text x={station.x + label.dx} y={station.y + label.dy + 12} textAnchor={label.anchor} className="focused-station-code">{INTERCHANGE_CODES[station.name] || station.code}</text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        <div className="focused-map-controls" aria-label="Map controls">
          <button type="button" onClick={() => setSafeZoom(zoom + 0.2)} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => setSafeZoom(zoom - 0.2)} aria-label="Zoom out">−</button>
          <button type="button" onClick={resetMap} aria-label="Reset route map">↺</button>
        </div>
        <div className="focused-map-zoom">{Math.round(zoom * 100)}%</div>

        <button type="button" className="focused-legend-toggle" onClick={() => setLegendOpen(open => !open)}>
          Legend <span>{legendOpen ? '▴' : '▾'}</span>
        </button>

        {legendOpen && (
          <div className="focused-legend-panel">
            {route.segments.map(segment => (
              <div key={segment.line}>
                <span className="focused-legend-swatch" style={{ background: LINE_META[segment.line].color }} />
                <strong>{segment.line}</strong>
                <span>{LINE_META[segment.line].name}</span>
              </div>
            ))}
            <div>
              <span className="focused-legend-swatch muted" />
              <strong>Context</strong>
              <span>Other intersecting lines</span>
            </div>
            <div>
              <span className="focused-legend-swatch disrupted" />
              <strong>Alert</strong>
              <span>Disrupted EWL section</span>
            </div>
          </div>
        )}

        <div className="focused-map-note">Scroll or +/− to inspect all stations · drag when zoomed · double-click to reset</div>
      </div>

      <div className="map-status-row">
        <div className="disruption-route-block">
          <div className="disruption-route-title"><span>!</span><strong>EWL disruption segment</strong></div>
          <div className="disruption-stations">
            {DISRUPTION_STATIONS.map(([code, name], index) => (
              <React.Fragment key={code}>
                {index > 0 && <span className="disruption-arrow">→</span>}
                <span className="disruption-station"><b>{code}</b>{name}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="route-focus-assurance">Full network intentionally de-emphasised</div>
      </div>
    </section>
  );
}
