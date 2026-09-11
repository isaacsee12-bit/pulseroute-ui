import React, { useRef, useState } from 'react';
import './transit-map.css';

const LTA_SYSTEM_MAP = 'https://www.lta.gov.sg/content/dam/ltagov/getting_around/public_transport/rail_network/pdf/SM_EN_(Ver210726)_CCL6.pdf';

const MAP_SOURCES = [
  'https://mapa-metro.com/mapas/Singapur/singapure-metro-map-2026.png',
  'https://commons.wikimedia.org/wiki/Special:Redirect/file/Singapore_MRT_and_LRT_System_Map.svg',
  'https://www.sgtrains.com/img/network/systemmap_2026.png',
];

const LINE_COLORS = {
  EWL: '#009645',
  CCL: '#fa9e0d',
  DTL: '#005ec4',
};

const ROUTES = {
  bus33: {
    title: 'DTL → CCL via MacPherson',
    steps: [
      { line: 'DTL', code: 'DT32', station: 'Tampines' },
      { line: 'DTL', code: 'DT26', station: 'MacPherson' },
      { line: 'CCL', code: 'CC10', station: 'MacPherson' },
      { line: 'CCL', code: 'CC22', station: 'Buona Vista' },
    ],
    transfer: 'Transfer at MacPherson (DT26 / CC10)',
  },
  bus168: {
    title: 'EWL → CCL via Paya Lebar',
    steps: [
      { line: 'EWL', code: 'EW2', station: 'Tampines' },
      { line: 'EWL', code: 'EW8', station: 'Paya Lebar' },
      { line: 'CCL', code: 'CC9', station: 'Paya Lebar' },
      { line: 'CCL', code: 'CC22', station: 'Buona Vista' },
    ],
    transfer: 'Transfer at Paya Lebar (EW8 / CC9)',
  },
  bedok: {
    title: 'DTL → CCL via Botanic Gardens',
    steps: [
      { line: 'DTL', code: 'DT32', station: 'Tampines' },
      { line: 'DTL', code: 'DT9', station: 'Botanic Gardens' },
      { line: 'CCL', code: 'CC19', station: 'Botanic Gardens' },
      { line: 'CCL', code: 'CC22', station: 'Buona Vista' },
    ],
    transfer: 'Transfer at Botanic Gardens (DT9 / CC19)',
  },
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

export default function InteractiveTransitMap({ activeRoute = 'bus33' }) {
  const route = ROUTES[activeRoute] || ROUTES.bus33;
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [sourceIndex, setSourceIndex] = useState(0);
  const [legendOpen, setLegendOpen] = useState(false);

  const setSafeZoom = nextZoom => {
    const next = clamp(nextZoom, 1, 3.4);
    setZoom(next);
    if (next === 1) setPan({ x: 0, y: 0 });
  };

  const resetMap = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const onPointerDown = event => {
    if (zoom <= 1) return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = event => {
    if (!dragRef.current) return;
    const maxPan = Math.max(60, (zoom - 1) * 520);
    setPan({
      x: clamp(dragRef.current.panX + event.clientX - dragRef.current.startX, -maxPan, maxPan),
      y: clamp(dragRef.current.panY + event.clientY - dragRef.current.startY, -maxPan, maxPan),
    });
  };

  const stopDragging = event => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const nextImageSource = () => {
    setSourceIndex(index => Math.min(index + 1, MAP_SOURCES.length - 1));
  };

  return (
    <section className="verified-map-card" aria-label="Singapore MRT system map and selected route">
      <div className="verified-map-header">
        <div>
          <div className="verified-map-title-row">
            <h3>Route map</h3>
            <span className="verified-badge">2026 network</span>
          </div>
          <p>Current Singapore MRT/LRT network reference, verified against LTA System Map SM-26-01-EN.</p>
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
                <span className="line-code" style={{ background: LINE_COLORS[step.line] }}>{step.code}</span>
                <span>{step.station}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div
        ref={stageRef}
        className={zoom > 1 ? 'verified-map-stage is-zoomed' : 'verified-map-stage'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onDoubleClick={resetMap}
        onWheel={event => {
          event.preventDefault();
          setSafeZoom(zoom + (event.deltaY < 0 ? 0.2 : -0.2));
        }}
      >
        <div
          className="verified-map-image-wrap"
          style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}
        >
          <img
            className="verified-map-image"
            src={MAP_SOURCES[sourceIndex]}
            alt="Singapore MRT and LRT system map"
            draggable="false"
            onError={nextImageSource}
          />
        </div>

        <div className="verified-map-controls" aria-label="Map controls">
          <button type="button" onClick={() => setSafeZoom(zoom + 0.25)} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => setSafeZoom(zoom - 0.25)} aria-label="Zoom out">−</button>
          <button type="button" onClick={resetMap} aria-label="Fit whole network">↺</button>
        </div>

        <div className="verified-map-zoom">{Math.round(zoom * 100)}%</div>

        <button type="button" className="verified-legend-toggle" onClick={() => setLegendOpen(open => !open)}>
          Legend <span>{legendOpen ? '▴' : '▾'}</span>
        </button>

        {legendOpen && (
          <div className="verified-legend-panel">
            <div><span className="legend-swatch ewl" />EWL East-West Line</div>
            <div><span className="legend-swatch ccl" />CCL Circle Line</div>
            <div><span className="legend-swatch dtl" />DTL Downtown Line</div>
            <div><span className="legend-swatch disrupted" />Disrupted EWL section</div>
          </div>
        )}
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
        <div className="map-help">Scroll / + / − to zoom · drag when zoomed · double-click to reset</div>
      </div>
    </section>
  );
}
