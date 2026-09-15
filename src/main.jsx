import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  ArrowRight,
  BusFront,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CloudOff,
  Database,
  Eye,
  EyeOff,
  Footprints,
  Info,
  KeyRound,
  MapPin,
  Menu,
  Navigation,
  RefreshCw,
  Route as RouteIcon,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  TrainFront,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react';
import './app-v2.css';
import { LINE_META, MRT_STATIONS, UPCOMING_STATIONS, searchStations } from './data/mrtNetwork.js';
import { buildSimulationReliefRoute } from './data/demoRoutes.js';
import { buildReroute, currentLeg, planMrtRoutes } from './lib/mrtRouter.js';
import {
  fetchOneMapTransitRoutes,
  OneMapRequestError,
  testOneMapToken,
} from './lib/oneMapTransit.js';
import {
  alertAffectsRoute,
  crowdForRoute,
  crowdRows,
  DataMallRequestError,
  disruptedAlerts,
  fetchBusArrival,
  fetchLiveRail,
  testLtaDataMallKey,
} from './lib/liveRail.js';
import { chooseRerouteAlternative, rankRoutes, routeSignature } from './lib/routeScoring.js';
import {
  clearApiKeys,
  hasLtaKey,
  hasOneMapToken,
  isOneMapTokenExpired,
  loadApiKeys,
  oneMapTokenExpiry,
  saveApiKeys,
} from './lib/apiKeys.js';

const NAV = [
  ['plan', 'Plan a Trip'],
  ['live', 'Live Updates'],
  ['journey', 'My Journey'],
  ['about', 'About'],
  ['settings', 'Settings'],
];

const PREFS = [
  ['balanced', 'Balanced'],
  ['fastest', 'Fastest'],
  ['quiet', 'Less crowded'],
  ['simple', 'Fewer transfers'],
  ['accessible', 'Less walking'],
];

const lineAlias = { CGL: 'EWL', CEL: 'CCL' };
const normaliseLine = line => lineAlias[line] || line;
const lineColor = line => LINE_META[normaliseLine(line)]?.color || '#38557c';

function singaporeClock(offsetMinutes = 10) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Singapore',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(Date.now() + offsetMinutes * 60 * 1000));
}

function fmtFetchedAt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function fmtExpiry(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}

function formatDistance(value) {
  const metres = Number(value || 0);
  if (!metres) return '';
  return metres >= 1000 ? `${(metres / 1000).toFixed(metres >= 10000 ? 0 : 1)} km` : `${Math.round(metres)} m`;
}

function alertMessage(alert) {
  if (!alert) return '';
  return alert.Message || alert.message || `${alert.Line || 'Train'} service disruption${alert.Stations ? ` affecting ${alert.Stations}` : ''}.`;
}

function resolveStationInput(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const exact = MRT_STATIONS.find(station =>
    station.name.toLowerCase() === text.toLowerCase()
    || station.codes.some(code => code.toLowerCase() === text.toLowerCase()),
  );
  if (exact) return exact.name;
  const candidate = searchStations(text, 1)[0];
  return candidate && candidate.score <= 3.36 ? candidate.name : null;
}

function sortRoutes(routes, preference, liveData) {
  return rankRoutes(routes, preference, liveData);
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark"><TrainFront size={21} strokeWidth={2.7} /></div>
      <div><div className="brand-name">PulseRoute</div><div className="brand-tag">Smarter journeys. A more resilient city.</div></div>
    </div>
  );
}

function TopBar({ page, navigate, liveState }) {
  const [open, setOpen] = useState(false);
  const connected = Boolean(liveState.data?.configured);
  return (
    <header className="topbar-v2">
      <button type="button" className="brand-button" onClick={() => navigate('plan')}><Brand /></button>
      <nav className={`nav-v2 ${open ? 'open' : ''}`} aria-label="Primary navigation">
        {NAV.map(([id, label]) => (
          <button key={id} type="button" className={page === id ? 'active' : ''} onClick={() => { navigate(id); setOpen(false); }}>{label}</button>
        ))}
      </nav>
      <div className="topbar-actions">
        <span className={`data-pill ${connected ? 'connected' : 'offline'}`}><span />{connected ? 'LTA DataMall — Live' : 'Live data unavailable'}</span>
        <span className="singapore-label"><MapPin size={15} /> Singapore</span>
        <button type="button" className="mobile-menu" onClick={() => setOpen(value => !value)} aria-label="Toggle navigation"><Menu size={21} /></button>
      </div>
    </header>
  );
}

function PageHeading({ eyebrow, title, copy, action }) {
  return (
    <div className="page-heading">
      <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div>
      {action}
    </div>
  );
}

function StationAutocomplete({ label, value, onChange }) {
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const suggestions = useMemo(() => searchStations(value, 7), [value]);

  const choose = station => {
    onChange(station.name);
    setFocused(false);
    setActiveIndex(0);
  };

  return (
    <label className="station-field">
      <MapPin size={18} />
      <span className="station-field-body">
        <small>{label}</small>
        <input
          value={value}
          onChange={event => { onChange(event.target.value); setFocused(true); setActiveIndex(0); }}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onKeyDown={event => {
            if (!focused || !suggestions.length) return;
            if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex(index => (index + 1) % suggestions.length); }
            if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex(index => (index - 1 + suggestions.length) % suggestions.length); }
            if (event.key === 'Enter') { event.preventDefault(); choose(suggestions[activeIndex]); }
            if (event.key === 'Escape') setFocused(false);
          }}
          autoComplete="off"
          spellCheck="false"
          aria-autocomplete="list"
        />
      </span>
      {value && <button type="button" className="field-clear" onMouseDown={event => event.preventDefault()} onClick={() => onChange('')} aria-label={`Clear ${label}`}><X size={15} /></button>}
      {focused && (
        <div className="station-suggestions" role="listbox">
          {suggestions.map((station, index) => (
            <button key={station.name} type="button" className={index === activeIndex ? 'active' : ''} onMouseDown={event => event.preventDefault()} onClick={() => choose(station)}>
              <Search size={14} /><span><b>{station.name}</b><small>{station.codes.join(' · ')}</small></span>
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

function SourceBadge({ route }) {
  const kind = route?.sourceKind === 'simulation' || route?.simulation
    ? 'simulation'
    : route?.sourceKind === 'onemap' || route?.oneMapRoute
      ? 'onemap'
      : 'model';
  const label = kind === 'simulation' ? 'Simulation' : kind === 'onemap' ? 'OneMap' : 'PulseRoute network model';
  return <span className={`source-badge ${kind}`}>{label}</span>;
}

function routeModeChips(route) {
  const legs = route?.legs || route?.segments || [];
  const chips = [];
  if (legs.some(leg => leg.mode === 'BUS')) chips.push(['bus', route.busServices?.length ? `Bus ${route.busServices.join(', ')}` : 'Bus']);
  if (legs.some(leg => leg.mode === 'SUBWAY' || leg.mode === 'RAIL')) chips.push(['train', route.lines?.join(' · ') || 'MRT']);
  if (legs.some(leg => leg.mode === 'WALK')) chips.push(['walk', 'Walking']);
  return chips;
}

function RouteCard({ route, selected, recommended, onSelect, onStart, liveData }) {
  const crowd = route.crowdInfo || crowdForRoute(liveData, route);
  const walkDistance = formatDistance(route.totalWalkDistanceMetres);
  const modeChips = routeModeChips(route);
  return (
    <article className={`route-card-v2 ${selected ? 'selected' : ''} ${recommended ? 'recommended' : ''}`}>
      <button type="button" className="route-card-select" onClick={onSelect}>
        <div className="route-card-heading">
          <div className="route-card-tags">{recommended && <span className="recommended-tag"><Sparkles size={13} /> Recommended</span>}<SourceBadge route={route} /></div>
          <h3>{route.shortTitle}</h3>
          <p>{route.detail}</p>
        </div>
        <ChevronRight size={21} />
      </button>
      <div className="route-card-secondary">
        {modeChips.map(([kind, label]) => <span className={`mode-chip ${kind}`} key={`${kind}-${label}`}>{kind === 'bus' ? <BusFront size={12} /> : kind === 'walk' ? <Footprints size={12} /> : <TrainFront size={12} />}{label}</span>)}
      </div>
      <div className="route-metrics-v2">
        <span><Clock3 /><b>{route.durationMinutes} min</b><small>{route.arrival ? `Arrive ${route.arrival}` : 'Estimated duration'}</small></span>
        <span><Footprints /><b>{route.walkingMinutes ? `${route.walkingMinutes} min walk` : 'No walking'}</b><small>{walkDistance || (route.walkingMinutes ? 'Walking included' : 'MRT fallback')}</small></span>
        <span><RouteIcon /><b>{route.transfers}</b><small>{route.transfers === 1 ? 'transfer' : 'transfers'}</small></span>
        <span><Users /><b>{crowd.label}</b><small>{crowd.source}</small></span>
      </div>
      {route.recommendationReason && <div className={`route-explanation ${route.simulation ? 'simulation' : ''}`}><Info />{route.recommendationReason}</div>}
      {route.simulationNote && <div className="simulation-note">{route.simulationNote}</div>}
      {selected && <button type="button" className="primary-button start-button" onClick={onStart}>Start this route <ArrowRight size={17} /></button>}
    </article>
  );
}

function LegModeIcon({ mode }) {
  if (mode === 'WALK') return <Footprints size={17} />;
  if (mode === 'BUS') return <BusFront size={17} />;
  return <TrainFront size={17} />;
}

function BusArrivalInline({ leg, credentials }) {
  const [state, setState] = useState({ data: null, error: '', loading: false });
  const canLoad = hasLtaKey(credentials) && leg?.mode === 'BUS' && /^\d{5}$/.test(String(leg?.fromStopCode || '')) && Boolean(leg?.service);

  useEffect(() => {
    let cancelled = false;
    if (!canLoad) {
      setState({ data: null, error: '', loading: false });
      return () => { cancelled = true; };
    }
    setState({ data: null, error: '', loading: true });
    fetchBusArrival(leg.fromStopCode, leg.service, credentials.ltaDataMallKey)
      .then(data => { if (!cancelled) setState({ data, error: '', loading: false }); })
      .catch(error => { if (!cancelled) setState({ data: null, error: error?.code === 'cors_or_network' ? 'Live bus arrival blocked by browser/network policy.' : 'Live bus arrival unavailable.', loading: false }); });
    return () => { cancelled = true; };
  }, [canLoad, leg?.fromStopCode, leg?.service, credentials.ltaDataMallKey]);

  if (!canLoad) return null;
  if (state.loading) return <div className="bus-live-inline unavailable"><RefreshCw className="spin" size={13} /> Checking LTA Bus Arrival…</div>;
  if (state.data?.nextBus) return <div className="bus-live-inline"><span className="source-badge lta">LTA DataMall — Live</span><b>Next Bus {state.data.serviceNo}: {state.data.nextBus.display}</b>{state.data.nextBus.occupancy && <span>{state.data.nextBus.occupancy}</span>}</div>;
  if (state.error) return <div className="bus-live-inline unavailable"><Info size={13} />{state.error}</div>;
  return null;
}

function RouteDiagram({ route, credentials }) {
  const legs = route?.legs || route?.segments || [];
  if (!legs.length) return null;
  return (
    <section className="route-diagram card-surface multimodal-diagram">
      <div className="section-title"><div><span>Route detail</span><h2>{route.origin} → {route.destination}</h2></div><SourceBadge route={route} /></div>
      <div className="leg-timeline">
        {legs.map((leg, index) => {
          const mode = String(leg.mode || 'TRANSIT').toUpperCase();
          const isWalk = mode === 'WALK';
          const isBus = mode === 'BUS';
          const from = leg.from || leg.stations?.[0] || '';
          const to = leg.to || leg.stations?.at(-1) || '';
          const distance = formatDistance(leg.distanceMetres);
          const lineMeta = LINE_META[normaliseLine(leg.line)];
          const serviceTitle = isWalk ? 'Walk' : isBus ? (leg.service ? `Bus ${leg.service}` : 'Bus') : (lineMeta?.name || leg.label || leg.line || 'Train');
          const iconStyle = !isWalk && !isBus ? { background: lineColor(leg.line) } : undefined;
          return (
            <div className="route-leg-row" key={`${mode}-${leg.service || leg.line}-${index}`}>
              <div className={`leg-icon ${isWalk ? 'walk' : isBus ? 'bus' : 'train'}`} style={iconStyle}><LegModeIcon mode={mode} /></div>
              <div className="leg-service"><b>{serviceTitle}</b>{leg.headsign && <small>towards {leg.headsign}</small>}{!isWalk && !isBus && leg.line && <small>{leg.line}</small>}</div>
              <div className="leg-path"><b>{from || 'Start'} → {to || 'Next stop'}</b><div className="leg-meta">{leg.durationMinutes != null && <span><Clock3 size={11} />{leg.durationMinutes} min</span>}{distance && <span>{distance}</span>}{leg.stopCount != null && leg.stopCount > 0 && <span>{leg.stopCount} stop{leg.stopCount === 1 ? '' : 's'}</span>}{(leg.departure || leg.arrival) && <span>{leg.departure || '—'} → {leg.arrival || '—'}</span>}</div></div>
              {isBus && <BusArrivalInline leg={leg} credentials={credentials} />}
            </div>
          );
        })}
      </div>
      {route.simulationNote && <div className="simulation-note">{route.simulationNote}</div>}
    </section>
  );
}

function ExternalDataNotice({ credentials, navigate, compact = false }) {
  const oneMapReady = hasOneMapToken(credentials);
  const ltaReady = hasLtaKey(credentials);
  if (oneMapReady && ltaReady) return null;
  return (
    <div className={`setup-notice ${compact ? 'compact' : ''}`}>
      <KeyRound size={19} />
      <div>
        <b>Optional official data connections</b>
        <p>PulseRoute always works with its local MRT network model. Add a OneMap Access Token for multimodal public-transport routes and an LTA DataMall Account Key for live rail data and optional bus arrivals.</p>
        <button type="button" className="text-button" onClick={() => navigate('settings')}>Open Settings →</button>
      </div>
    </div>
  );
}

function PlanPage({ liveState, activeJourney, setActiveJourney, navigate, credentials }) {
  const initialDeparture = activeJourney?.targetDeparture || singaporeClock(10);
  const initialFrom = activeJourney?.origin || 'Tampines';
  const initialTo = activeJourney?.destination || 'Buona Vista';
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [departure, setDeparture] = useState(initialDeparture);
  const [preference, setPreference] = useState('balanced');
  const [routes, setRoutes] = useState(() => planMrtRoutes(initialFrom, initialTo, { departureTime: initialDeparture }));
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const orderedRoutes = useMemo(() => sortRoutes(routes, preference, liveState.data), [routes, preference, liveState.data]);
  const selected = orderedRoutes.find(route => route.id === selectedId) || orderedRoutes[0];

  useEffect(() => {
    if (orderedRoutes.length && !orderedRoutes.some(route => route.id === selectedId)) setSelectedId(orderedRoutes[0].id);
  }, [orderedRoutes, selectedId]);

  const getRoutes = async () => {
    setError('');
    setMessage('');
    const resolvedFrom = resolveStationInput(from);
    const resolvedTo = resolveStationInput(to);
    if (!resolvedFrom || !resolvedTo) {
      setError('Choose valid MRT stations from the suggestions. You can type a station name or code, including approximate spelling.');
      return;
    }
    if (resolvedFrom === resolvedTo) {
      setError('Origin and destination must be different stations.');
      return;
    }

    setFrom(resolvedFrom);
    setTo(resolvedTo);
    const localRoutes = sortRoutes(
      planMrtRoutes(resolvedFrom, resolvedTo, { departureTime: departure }),
      preference,
      liveState.data,
    );
    if (!localRoutes.length) {
      setError('No MRT route could be found between those stations.');
      return;
    }
    setRoutes(localRoutes);
    setSelectedId(localRoutes[0].id);

    if (!hasOneMapToken(credentials)) {
      setMessage('Using PulseRoute’s MRT-only network fallback. Add a OneMap Access Token in Settings to request multimodal public-transport routes with bus and walking legs.');
      return;
    }

    setLoading(true);
    try {
      const oneMapRoutes = await fetchOneMapTransitRoutes({
        origin: resolvedFrom,
        destination: resolvedTo,
        departureTime: departure,
        token: credentials.oneMapToken,
      });
      if (oneMapRoutes.length) {
        const ordered = sortRoutes(oneMapRoutes, preference, liveState.data);
        setRoutes(ordered);
        setSelectedId(ordered[0].id);
        setMessage(`Using ${ordered.length} multimodal route${ordered.length === 1 ? '' : 's'} returned by OneMap. Walking and bus legs are shown exactly when returned; LTA live data is applied separately when reachable.`);
      } else {
        setMessage('OneMap returned no public-transport itinerary for that departure time. PulseRoute is showing its local MRT-only network fallback.');
      }
    } catch (routeError) {
      const reason = routeError?.code === 'expired_token'
        ? 'Your OneMap token has expired.'
        : routeError?.code === 'invalid_token'
          ? 'OneMap rejected the access token.'
          : 'OneMap routing could not be reached directly from this browser.';
      setMessage(`${reason} PulseRoute has safely fallen back to its local MRT network model.`);
    } finally {
      setLoading(false);
    }
  };

  const startRoute = route => {
    const journey = { ...route, targetDeparture: departure, startedAt: new Date().toISOString() };
    setActiveJourney(journey);
    navigate('journey');
  };

  return (
    <main className="page-shell">
      <PageHeading
        eyebrow="Multimodal commuter companion"
        title="Plan a resilient journey"
        copy={`Choose from ${MRT_STATIONS.length} operational MRT stations. OneMap provides multimodal public-transport itineraries with bus and walking legs when available; PulseRoute's local MRT network remains the offline fallback.`}
      />
      <section className="planner-layout">
        <div className="planner-main">
          <section className="trip-builder card-surface">
            <div className="trip-inputs">
              <StationAutocomplete label="From" value={from} onChange={setFrom} />
              <button type="button" className="swap-button" onClick={() => { setFrom(to); setTo(from); }} title="Swap origin and destination"><ArrowDownUp size={19} /></button>
              <StationAutocomplete label="To" value={to} onChange={setTo} />
              <label className="time-control"><Clock3 size={18} /><span><small>Depart at</small><input type="time" value={departure} onChange={event => setDeparture(event.target.value)} /></span></label>
            </div>
            <div className="planner-actions">
              <div className="preference-tabs">{PREFS.map(([id, label]) => <button key={id} type="button" className={preference === id ? 'active' : ''} onClick={() => setPreference(id)}>{label}</button>)}</div>
              <button type="button" className="primary-button" onClick={getRoutes} disabled={loading}>{loading ? <><RefreshCw className="spin" size={16} /> Finding routes</> : <>Get Routes <ArrowRight size={17} /></>}</button>
            </div>
            {error && <div className="inline-message error"><AlertTriangle size={16} />{error}</div>}
            {message && <div className="inline-message info"><Info size={16} />{message}</div>}
            <div className="demand-spread-note"><Users />PulseRoute recommends alternatives designed to spread demand across viable routes. In Balanced mode, near-equivalent options can be diversified per browser session; this is a hackathon prototype, not a claim of whole-network optimisation.</div>
          </section>

          <div className="results-heading"><div><span>{orderedRoutes.length} route{orderedRoutes.length === 1 ? '' : 's'}</span><h2>Best options for this journey</h2></div><small>{liveState.data ? `LTA live · refreshed ${fmtFetchedAt(liveState.data.fetchedAt)}` : 'Live LTA data unavailable'}</small></div>
          <div className="route-list">
            {orderedRoutes.map((route, index) => (
              <RouteCard
                key={route.id}
                route={route}
                recommended={index === 0}
                selected={route.id === selected?.id}
                onSelect={() => setSelectedId(route.id)}
                onStart={() => startRoute(route)}
                liveData={liveState.data}
              />
            ))}
          </div>
          <RouteDiagram route={selected} credentials={credentials} />
        </div>
        <aside className="planner-side">
          <section className="side-info-card"><div className="card-icon"><Zap /></div><h3>What PulseRoute adds</h3><p>OneMap supplies multimodal public-transport itineraries when reachable. LTA DataMall can add train disruption, station crowding and bus arrival signals. PulseRoute scores the available options by time, walking, transfers, disruption exposure, crowding and your selected preference instead of blindly choosing the same fastest route for everyone.</p></section>
          <ExternalDataNotice credentials={credentials} navigate={navigate} compact />
          <section className="side-info-card"><div className="card-icon"><TrainFront /></div><h3>Fallback coverage</h3><p>If OneMap is unavailable, the fallback router covers currently operational MRT stations on NSL, EWL/Changi branch, NEL, CCL including CCL6, DTL and TEL through Bayshore.</p><small>The fallback is MRT-only; it does not invent bus routes or walking geometry.</small></section>
        </aside>
      </section>
    </main>
  );
}

function LivePage({ liveState, refreshLive, credentials, navigate }) {
  const alerts = disruptedAlerts(liveState.data);
  const crowd = crowdRows(liveState.data);
  const crowdOrder = { High: 0, Moderate: 1, Low: 2, Unavailable: 3 };
  const rankedCrowd = [...crowd].sort((a, b) => (crowdOrder[a.level] ?? 4) - (crowdOrder[b.level] ?? 4));

  return (
    <main className="page-shell">
      <PageHeading
        eyebrow="Network intelligence"
        title="Live Updates"
        copy="PulseRoute attempts direct browser requests to the official LTA DataMall Train Service Alerts and Station Crowd Density APIs using the Account Key saved for this browser session."
        action={<button type="button" className="secondary-button" onClick={refreshLive} disabled={liveState.loading || !hasLtaKey(credentials)}><RefreshCw className={liveState.loading ? 'spin' : ''} size={16} /> Refresh</button>}
      />
      {!liveState.data ? (
        <section className="empty-live card-surface">
          <CloudOff />
          <h2>LTA live data is unavailable</h2>
          <p>{liveState.error || 'Add an LTA DataMall Account Key in Settings, then test the connection.'}</p>
          {liveState.reason === 'cors_or_network' && <div className="cors-warning"><AlertTriangle size={17} />Direct DataMall access is blocked in this browser or network. PulseRoute is continuing with local/demo data; no backend proxy has been introduced.</div>}
          <button type="button" className="secondary-button" onClick={() => navigate('settings')}><SettingsIcon size={16} /> Open Settings</button>
        </section>
      ) : (
        <>
          <div className="live-meta"><span className="live-dot" />LTA DataMall — Live <b>Updated {fmtFetchedAt(liveState.data.fetchedAt)}</b></div>
          <section className={`network-health ${alerts.length ? 'danger' : 'good'}`}>
            {alerts.length ? <AlertTriangle /> : <CheckCircle2 />}
            <div><span>{alerts.length ? 'Active train disruption' : 'Network status'}</span><h2>{alerts.length ? `${alerts.length} major service alert${alerts.length === 1 ? '' : 's'}` : 'No major train disruption reported'}</h2><p>{alerts.length ? 'PulseRoute checks active journeys against the affected line and stations.' : 'The current Train Service Alerts response does not report a major disruption.'}</p></div>
          </section>
          <div className="live-grid">
            <section className="card-surface live-card">
              <div className="section-title"><div><span>Train Service Alerts</span><h2>Service status</h2></div><span className="source-badge lta">LTA DataMall — Live</span></div>
              {alerts.length ? <div className="alert-list">{alerts.map((alert, index) => <div className="alert-row" key={`${alert.Line}-${index}`}><span className="line-pill" style={{ background: lineColor(alert.Line) }}>{alert.Line || 'LTA'}</span><div><b>{normaliseLine(alert.Line) || 'Train'} disruption</b><p>{alertMessage(alert)}</p>{alert.Stations && <small>Affected stations: {alert.Stations}</small>}</div></div>)}</div> : <div className="healthy-message"><CheckCircle2 /> No disrupted train service in the current LTA response.</div>}
            </section>
            <section className="card-surface live-card">
              <div className="section-title"><div><span>Station Crowd Density Real Time</span><h2>Busiest readings</h2></div><span className="source-badge lta">LTA DataMall — Live</span></div>
              {rankedCrowd.length ? <div className="crowd-table">{rankedCrowd.slice(0, 18).map((row, index) => <div key={`${row.sourceLine}-${row.code}-${index}`}><span className={`crowd-dot ${row.level.toLowerCase()}`} /><b>{row.station}</b><small>{row.code} · {row.line}</small><span className={`crowd-level ${row.level.toLowerCase()}`}>{row.level}</span></div>)}</div> : <div className="healthy-message"><Info /> No crowd-density rows were returned by LTA for this refresh.</div>}
            </section>
          </div>
        </>
      )}
    </main>
  );
}

function journeyTransfer(route) {
  const legs = route?.legs || route?.segments || [];
  const transitLegs = legs.filter(leg => leg.mode !== 'WALK');
  if (transitLegs.length < 2) return null;
  const firstTransit = transitLegs[0];
  const firstTransitIndex = legs.indexOf(firstTransit);
  const minutes = Math.max(1, Math.round(legs.slice(0, firstTransitIndex + 1).reduce((sum, leg) => sum + Number(leg.durationMinutes || 0), 0)));
  return {
    station: firstTransit.to || firstTransit.stations?.at(-1),
    fromLine: firstTransit.service ? `Bus ${firstTransit.service}` : firstTransit.line,
    toLine: transitLegs[1].service ? `Bus ${transitLegs[1].service}` : transitLegs[1].line,
    minutes,
  };
}

function JourneyPage({ activeJourney, setActiveJourney, liveState, demoCondition, setDemoCondition, navigate, credentials }) {
  const [dismissedKey, setDismissedKey] = useState('');
  const [recommendation, setRecommendation] = useState(null);
  const [rerouteLoading, setRerouteLoading] = useState(false);
  const liveAlert = activeJourney ? disruptedAlerts(liveState.data).find(alert => alertAffectsRoute(alert, activeJourney)) : null;
  const liveCrowd = activeJourney ? crowdForRoute(liveState.data, activeJourney) : { label: 'Unknown', source: 'Live LTA data unavailable' };

  const condition = useMemo(() => {
    if (!activeJourney) return null;
    if (demoCondition?.type && demoCondition.type !== 'normal') return demoCondition;
    if (liveAlert) return { type: 'disruption', live: true, id: `lta-${liveAlert.Line}-${liveAlert.Stations || ''}-${alertMessage(liveAlert)}`, line: normaliseLine(liveAlert.Line), text: alertMessage(liveAlert) };
    if (liveState.data && liveCrowd.label === 'High') return { type: 'crowding', live: true, id: `crowd-${activeJourney.lines?.[0]}-high`, line: activeJourney.lines?.[0], text: 'LTA DataMall reports High station crowd density on your current journey.' };
    return null;
  }, [activeJourney, demoCondition, liveAlert, liveState.data, liveCrowd.label]);

  const conditionKey = condition?.id || '';
  const firstLeg = currentLeg(activeJourney);
  const transfer = journeyTransfer(activeJourney);

  useEffect(() => {
    let cancelled = false;
    if (!activeJourney || !condition) {
      setRecommendation(null);
      setRerouteLoading(false);
      return () => { cancelled = true; };
    }

    const affectedLine = normaliseLine(condition.line || activeJourney.lines?.[0]);
    const departure = activeJourney.targetDeparture || singaporeClock(0);
    const local = buildReroute(activeJourney.origin, activeJourney.destination, affectedLine, departure, condition.type);
    const usableLocal = local && routeSignature(local) !== routeSignature(activeJourney) ? local : null;
    const simulationRelief = !condition.live ? buildSimulationReliefRoute(activeJourney, affectedLine, departure) : null;
    setRecommendation(simulationRelief || usableLocal);

    if (!hasOneMapToken(credentials)) return () => { cancelled = true; };
    setRerouteLoading(true);
    fetchOneMapTransitRoutes({
      origin: activeJourney.origin,
      destination: activeJourney.destination,
      departureTime: departure,
      token: credentials.oneMapToken,
    }).then(routes => {
      if (cancelled || !routes.length) return;
      const preferred = chooseRerouteAlternative(routes, activeJourney, {
        affectedLine,
        conditionType: condition.type,
        liveData: liveState.data,
      });
      if (preferred) setRecommendation(preferred);
    }).catch(() => {
      // Local/simulation rerouting remains available. API errors stay separate from simulated data.
    }).finally(() => { if (!cancelled) setRerouteLoading(false); });

    return () => { cancelled = true; };
  }, [activeJourney, conditionKey, credentials.oneMapToken, liveState.data]);

  if (!activeJourney) {
    return (
      <main className="page-shell">
        <PageHeading eyebrow="Journey monitor" title="My Journey" copy="Start a route from Plan a Trip and PulseRoute will monitor it here." />
        <section className="empty-journey card-surface"><Navigation /><h2>No active journey</h2><p>Choose a route first. Once started, this page follows the journey during both normal service and disruptions.</p><button type="button" className="primary-button" onClick={() => navigate('plan')}>Plan a trip <ArrowRight size={17} /></button></section>
      </main>
    );
  }

  const actionable = condition && conditionKey !== dismissedKey;
  const oldCrowd = condition?.type === 'crowding' ? 'High' : liveCrowd.label;
  const recommendationCrowd = recommendation ? crowdForRoute(liveState.data, recommendation) : { label: 'Unknown' };
  const newCrowd = recommendationCrowd.label !== 'Unknown' ? recommendationCrowd.label : recommendation?.crowdLabel || (condition?.type === 'crowding' ? 'Lower expected' : 'Unknown');
  const extraMinutes = recommendation ? recommendation.durationMinutes - activeJourney.durationMinutes : 0;
  const currentConfidence = condition ? Math.max(58, activeJourney.confidence - (condition.type === 'disruption' ? 24 : 12)) : activeJourney.confidence;
  const newConfidence = recommendation?.confidence || currentConfidence;

  const switchRoute = () => {
    if (!recommendation) return;
    setActiveJourney({
      ...recommendation,
      targetDeparture: activeJourney.targetDeparture,
      startedAt: activeJourney.startedAt || new Date().toISOString(),
    });
    if (!condition?.live) setDemoCondition({ type: 'normal', id: `normal-${Date.now()}` });
    setDismissedKey('');
  };

  const loadMultimodalDemo = () => {
    const departure = singaporeClock(0);
    const route = planMrtRoutes('Bugis', 'Paya Lebar', { departureTime: departure })[0];
    if (route) setActiveJourney({ ...route, targetDeparture: departure, startedAt: new Date().toISOString() });
    setDemoCondition({ type: 'normal', id: `normal-${Date.now()}` });
    setDismissedKey('');
  };

  const firstLegFrom = firstLeg?.from || firstLeg?.stations?.[0] || activeJourney.origin;
  const firstLegTo = firstLeg?.to || firstLeg?.stations?.at(-1) || activeJourney.destination;
  const firstLegName = firstLeg?.mode === 'BUS' ? `Bus ${firstLeg.service || ''}`.trim() : firstLeg?.mode === 'WALK' ? 'Walk' : firstLeg?.label || firstLeg?.line || 'MRT journey';

  return (
    <main className="page-shell">
      <PageHeading
        eyebrow="Journey monitor"
        title="My Journey"
        copy="PulseRoute monitors the route you chose, then compares meaningfully different rail, bus and walking alternatives when conditions change."
        action={<button type="button" className="secondary-button" onClick={() => setActiveJourney(null)}><X size={16} /> End journey</button>}
      />
      <section className={`journey-status ${condition ? 'changed' : 'on-track'}`}>
        {condition ? <AlertTriangle /> : <CheckCircle2 />}
        <div><span>{condition ? 'Conditions changed' : 'Journey on track'}</span><h2>{activeJourney.origin} → {activeJourney.destination}</h2><p>{condition ? condition.text : liveState.data ? 'No LTA major disruption is currently affecting this journey.' : 'No simulated disruption is active. Live LTA data is currently unavailable.'}</p></div>
        <SourceBadge route={activeJourney} />
      </section>

      <section className="journey-metrics card-surface">
        <div><span>Current leg</span><b>{firstLegName}</b><small>{firstLegFrom} → {firstLegTo}</small></div>
        <div><span>Next transfer</span><b>{transfer ? transfer.station : 'No transfer'}</b><small>{transfer ? `${transfer.fromLine} → ${transfer.toLine} in about ${transfer.minutes} min` : 'Stay with the current itinerary'}</small></div>
        <div><span>ETA</span><b>{activeJourney.arrival || `${activeJourney.durationMinutes} min`}</b><small>{activeJourney.durationMinutes} min journey</small></div>
        <div><span>Arrival confidence</span><b>{currentConfidence}%</b><small>{activeJourney.confidenceSource || (condition ? 'recalculated after change' : 'PulseRoute estimate')}</small></div>
        <div><span>Crowding</span><b>{condition?.type === 'crowding' ? 'High' : liveCrowd.label}</b><small>{condition?.type === 'crowding' ? 'Simulation' : liveCrowd.source}</small></div>
      </section>

      <section className="upcoming-card card-surface"><Navigation /><div><span>Up next</span><h3>{transfer ? `Transfer at ${transfer.station} in about ${transfer.minutes} min` : `${firstLeg?.mode === 'WALK' ? 'Walk towards' : 'Continue towards'} ${firstLegTo}`}</h3><p>{transfer ? `Change from ${transfer.fromLine} to ${transfer.toLine}. PulseRoute will keep checking conditions before the interchange.` : 'PulseRoute will keep checking the current itinerary as conditions change.'}</p></div></section>

      {actionable && (
        <section className="reroute-panel">
          <div className="reroute-heading"><div><span><Sparkles size={14} /> Proactive recommendation</span><h2>{recommendation ? 'A meaningfully different route is available' : 'PulseRoute is checking alternatives'}</h2><p>{condition.type === 'disruption' ? `Your current journey is exposed to a ${condition.live ? 'live LTA' : 'simulated'} service disruption.` : `Crowding increased on ${condition.line || 'your current corridor'}, so PulseRoute checked alternatives that can spread demand.`}</p></div>{rerouteLoading && <RefreshCw className="spin" />}</div>
          {recommendation && <>
            <div className="reroute-route"><span className="route-change-label">Recommended alternative</span><h3>{recommendation.shortTitle}</h3><p>{recommendation.detail}</p><SourceBadge route={recommendation} />{recommendation.rerouteReason && <div className="reroute-reason"><Info />{recommendation.rerouteReason}</div>}</div>
            <div className="tradeoff-grid walking-tradeoff">
              <div><span>New ETA</span><b>{recommendation.arrival || `${recommendation.durationMinutes} min`}</b></div>
              <div><span>Travel-time change</span><b className={extraMinutes <= 0 ? 'positive' : ''}>{extraMinutes > 0 ? `+${extraMinutes}` : extraMinutes} min</b></div>
              <div><span>Walking</span><b>{activeJourney.walkingMinutes || 0} → {recommendation.walkingMinutes || 0} min</b></div>
              <div><span>Crowding</span><b>{oldCrowd} → {newCrowd}</b></div>
              <div><span>On-time probability</span><b>{currentConfidence}% → {newConfidence}%</b></div>
            </div>
            {recommendation.simulationNote && <div className="simulation-note">{recommendation.simulationNote}</div>}
            <div className="reroute-actions"><button type="button" className="primary-button" onClick={switchRoute}>Switch route <ArrowRight size={17} /></button><button type="button" className="secondary-button" onClick={() => setDismissedKey(conditionKey)}>Keep current route</button></div>
          </>}
        </section>
      )}

      {condition && !actionable && <div className="kept-route"><Info />You chose to keep the current route. PulseRoute is still monitoring it and will surface a new recommendation if conditions change again.</div>}
      <RouteDiagram route={activeJourney} credentials={credentials} />

      <section className="demo-controls card-surface">
        <div><span>Hackathon demo controls</span><h2>Normal journey → condition change → proactive multimodal reroute</h2><p>Simulation stays explicitly separate from OneMap and LTA live data. For the strongest guaranteed offline demo, load Bugis → Paya Lebar, then simulate an EWL disruption to reveal the clearly labelled Bus 7 + walking relief scenario.</p></div>
        <div className="demo-buttons">
          <button type="button" onClick={loadMultimodalDemo}><BusFront /> Load multimodal demo</button>
          <button type="button" onClick={() => { setDemoCondition({ type: 'normal', id: `normal-${Date.now()}` }); setDismissedKey(''); }}><CheckCircle2 /> Restore normal</button>
          <button type="button" onClick={() => { setDemoCondition({ type: 'crowding', line: activeJourney.lines?.[0], text: `Crowding on ${activeJourney.lines?.[0] || 'your current line'} has increased sharply.`, id: `crowd-${Date.now()}` }); setDismissedKey(''); }}><Users /> Simulate crowding</button>
          <button type="button" className="danger" onClick={() => { setDemoCondition({ type: 'disruption', line: activeJourney.lines?.[0], text: `A simulated disruption has started on ${activeJourney.lines?.[0] || 'your current line'}.`, id: `disruption-${Date.now()}` }); setDismissedKey(''); }}><AlertTriangle /> Simulate disruption</button>
        </div>
      </section>
    </main>
  );
}

function CredentialStatus({ status }) {
  const label = {
    not_configured: 'Not configured',
    connected: 'Connected',
    invalid_token: 'Invalid token',
    expired_token: 'Expired token',
    invalid_key: 'Invalid key',
    connection_failed: 'Connection failed',
  }[status.code] || 'Not configured';
  return <div className={`credential-status ${status.code}`}><span /> <b>{label}</b>{status.detail && <small>{status.detail}</small>}</div>;
}

function SettingsPage({ credentials, setCredentials, refreshLive }) {
  const [draftOneMap, setDraftOneMap] = useState(credentials.oneMapToken);
  const [draftLta, setDraftLta] = useState(credentials.ltaDataMallKey);
  const [showOneMap, setShowOneMap] = useState(false);
  const [showLta, setShowLta] = useState(false);
  const [oneMapStatus, setOneMapStatus] = useState({ code: 'not_configured', detail: credentials.oneMapToken ? 'Saved for this browser session; test to verify.' : '' });
  const [ltaStatus, setLtaStatus] = useState({ code: 'not_configured', detail: credentials.ltaDataMallKey ? 'Saved for this browser session; test to verify.' : '' });
  const [testing, setTesting] = useState('');

  useEffect(() => {
    setDraftOneMap(credentials.oneMapToken);
    setDraftLta(credentials.ltaDataMallKey);
  }, [credentials]);

  const persist = next => {
    const saved = saveApiKeys(next);
    setCredentials(saved);
    return saved;
  };

  const saveOneMap = () => {
    const next = persist({ ...credentials, oneMapToken: draftOneMap });
    setDraftOneMap(next.oneMapToken);
    setOneMapStatus({ code: 'not_configured', detail: next.oneMapToken ? 'Saved for this browser session; test to verify.' : '' });
  };

  const saveLta = () => {
    const next = persist({ ...credentials, ltaDataMallKey: draftLta });
    setDraftLta(next.ltaDataMallKey);
    setLtaStatus({ code: 'not_configured', detail: next.ltaDataMallKey ? 'Saved for this browser session; test to verify.' : '' });
  };

  const testOneMap = async () => {
    setTesting('onemap');
    try {
      await testOneMapToken(draftOneMap);
      const expiry = oneMapTokenExpiry(draftOneMap);
      setOneMapStatus({ code: 'connected', detail: expiry ? `Token works. Expires ${fmtExpiry(expiry)}.` : 'Authenticated OneMap Search request succeeded.' });
    } catch (error) {
      const code = error instanceof OneMapRequestError ? error.code : 'connection_failed';
      setOneMapStatus({ code: ['expired_token', 'invalid_token'].includes(code) ? code : 'connection_failed', detail: error?.message || 'OneMap connection test failed.' });
    } finally {
      setTesting('');
    }
  };

  const testLta = async () => {
    setTesting('lta');
    try {
      await testLtaDataMallKey(draftLta);
      setLtaStatus({ code: 'connected', detail: 'Authenticated Train Service Alerts request succeeded. The same Account Key is used opportunistically for Bus Arrival v3 on bus legs.' });
    } catch (error) {
      const code = error instanceof DataMallRequestError ? error.code : 'connection_failed';
      setLtaStatus({ code: code === 'invalid_key' ? 'invalid_key' : 'connection_failed', detail: error?.message || 'LTA DataMall connection test failed.' });
    } finally {
      setTesting('');
    }
  };

  const clearOneMap = () => {
    setDraftOneMap('');
    persist({ ...credentials, oneMapToken: '' });
    setOneMapStatus({ code: 'not_configured', detail: '' });
  };

  const clearLta = () => {
    setDraftLta('');
    persist({ ...credentials, ltaDataMallKey: '' });
    setLtaStatus({ code: 'not_configured', detail: '' });
  };

  const clearAll = () => {
    const empty = clearApiKeys();
    setCredentials(empty);
    setDraftOneMap('');
    setDraftLta('');
    setOneMapStatus({ code: 'not_configured', detail: '' });
    setLtaStatus({ code: 'not_configured', detail: '' });
  };

  const expiry = oneMapTokenExpiry(draftOneMap);
  const expiryWarning = draftOneMap && isOneMapTokenExpired(draftOneMap);

  return (
    <main className="page-shell settings-page">
      <PageHeading eyebrow="Browser session configuration" title="Settings" copy="Enter optional government API credentials for this browser session. PulseRoute never requires credentials to run: its local MRT network model remains available at all times." />

      <div className="security-banner"><ShieldCheck /><div><b>Frontend-only hackathon architecture</b><p>Credentials are stored only in <code>sessionStorage</code> and are sent directly from your browser to the selected API. They are visible to this browser/application and are not production secrets. PulseRoute does not log them, put them in URLs, or commit them to Git.</p></div></div>

      <section className="settings-grid">
        <article className="credential-card card-surface">
          <div className="credential-heading"><div className="credential-icon"><MapPin /></div><div><span>SLA</span><h2>OneMap</h2><p>Used for authenticated OneMap Search and, when direct routing succeeds, multimodal public-transport itineraries with rail, bus and walking legs.</p></div></div>
          <label className="credential-field">
            <span>OneMap Access Token</span>
            <div><input type={showOneMap ? 'text' : 'password'} value={draftOneMap} onChange={event => { setDraftOneMap(event.target.value); setOneMapStatus({ code: 'not_configured', detail: 'Changed but not tested.' }); }} placeholder="Paste OneMap access token" autoComplete="off" /><button type="button" onClick={() => setShowOneMap(value => !value)} aria-label={showOneMap ? 'Hide OneMap token' : 'Show OneMap token'}>{showOneMap ? <EyeOff /> : <Eye />}</button></div>
          </label>
          {expiry && <div className={`token-expiry ${expiryWarning ? 'expired' : ''}`}><Clock3 />JWT expiry: {fmtExpiry(expiry)}{expiryWarning ? ' — expired' : ''}</div>}
          <CredentialStatus status={oneMapStatus} />
          <div className="credential-actions"><button type="button" className="primary-button" onClick={saveOneMap}>Save</button><button type="button" className="secondary-button" onClick={testOneMap} disabled={testing === 'onemap' || !draftOneMap.trim()}>{testing === 'onemap' ? <><RefreshCw className="spin" /> Testing</> : 'Test Connection'}</button><button type="button" className="secondary-button danger-outline" onClick={clearOneMap}>Clear</button></div>
          <p className="credential-note">OneMap access tokens expire periodically. Generate a new token from your OneMap account when required.</p>
        </article>

        <article className="credential-card card-surface">
          <div className="credential-heading"><div className="credential-icon"><Database /></div><div><span>LTA</span><h2>DataMall</h2><p>Used for Train Service Alerts, Station Crowd Density Real Time and optional Bus Arrival v3 data when the browser can reach DataMall directly.</p></div></div>
          <label className="credential-field">
            <span>LTA DataMall Account Key</span>
            <div><input type={showLta ? 'text' : 'password'} value={draftLta} onChange={event => { setDraftLta(event.target.value); setLtaStatus({ code: 'not_configured', detail: 'Changed but not tested.' }); }} placeholder="Paste DataMall Account Key" autoComplete="off" /><button type="button" onClick={() => setShowLta(value => !value)} aria-label={showLta ? 'Hide DataMall key' : 'Show DataMall key'}>{showLta ? <EyeOff /> : <Eye />}</button></div>
          </label>
          <CredentialStatus status={ltaStatus} />
          <div className="credential-actions"><button type="button" className="primary-button" onClick={saveLta}>Save</button><button type="button" className="secondary-button" onClick={testLta} disabled={testing === 'lta' || !draftLta.trim()}>{testing === 'lta' ? <><RefreshCw className="spin" /> Testing</> : 'Test Connection'}</button><button type="button" className="secondary-button danger-outline" onClick={clearLta}>Clear</button></div>
          <p className="credential-note">If the browser blocks DataMall cross-origin requests, Test Connection will report a connection failure and PulseRoute will keep using local/demo data. No proxy or backend is silently introduced.</p>
        </article>
      </section>

      <section className="settings-footer card-surface">
        <div><Trash2 /><div><h3>Clear all credentials</h3><p>Remove both credentials from this browser tab/session immediately.</p></div></div>
        <button type="button" className="secondary-button danger-outline" onClick={clearAll}>Clear all credentials</button>
      </section>

      <section className="settings-help card-surface">
        <div><Info /><div><h3>Connection behaviour</h3><p><b>OneMap unavailable:</b> route planning falls back to the PulseRoute MRT network model. <b>LTA unavailable:</b> Live Updates clearly shows that live data is unavailable and bus arrivals are omitted. <b>Neither configured:</b> route planning and the My Journey simulation remain fully demoable.</p></div></div>
        <button type="button" className="secondary-button" onClick={refreshLive} disabled={!hasLtaKey(credentials)}>Refresh LTA data</button>
      </section>
    </main>
  );
}

function AboutPage({ liveState, credentials, navigate }) {
  return (
    <main className="page-shell">
      <PageHeading eyebrow="Nebula X Hackathon 2026" title="Why PulseRoute exists" copy="A disruption-aware multimodal commuter companion: plan once, monitor continuously, then switch to a viable rail, bus or walking alternative when conditions change." />
      <section className="about-hero card-surface"><div><span className="eyebrow">Core idea</span><h2>From fastest-route thinking to resilient alternatives.</h2><p>PulseRoute uses OneMap multimodal itineraries when available and overlays reachable LTA disruption/crowding signals. Its Balanced prototype can diversify among near-equivalent options so every commuter is not automatically sent to the same fastest path. This is a demand-spreading prototype, not a claim of full Singapore network optimisation.</p></div><div className="architecture"><span>OneMap<br/><small>Rail + bus + walking itineraries</small></span><b>+</b><span>LTA DataMall<br/><small>Rail conditions + optional bus arrivals</small></span><b>→</b><span className="pulse-box">PulseRoute<br/><small>Scoring + journey monitor + rerouting</small></span></div></section>
      <div className="about-grid">
        <section className="card-surface"><div className="card-icon"><RouteIcon /></div><h3>Multimodal alternatives</h3><p>OneMap routes are kept as ordered legs, including WALK, BUS and SUBWAY when returned. The local fallback remains deliberately MRT-only rather than inventing bus or walking data.</p></section>
        <section className="card-surface"><div className="card-icon"><Activity /></div><h3>Live transport signals</h3><p>LTA DataMall Train Service Alerts and Station Crowd Density are requested directly from the browser. Bus Arrival v3 is also requested for bus legs with a real bus-stop code. Browser CORS/network restrictions are surfaced rather than hidden.</p></section>
        <section className="card-surface"><div className="card-icon"><Navigation /></div><h3>Proactive My Journey</h3><p>When a live or simulated condition changes, PulseRoute favours meaningfully different options: avoid the affected rail line first, then prefer usable bus/walk diversity, lower crowding and reasonable time/walking trade-offs.</p></section>
      </div>
      <section className="data-transparency card-surface"><div className="section-title"><div><span>Data transparency</span><h2>What is real and what is modelled?</h2></div><Database /></div><div className="transparency-grid"><div><b>OneMap</b><p>Cards labelled “OneMap” came from a successful direct OneMap public-transport response. Bus and walking legs are only shown when present in that response.</p></div><div><b>LTA DataMall — Live</b><p>Only shown after a successful authenticated DataMall request, including live bus arrival/occupancy where available.</p></div><div><b>PulseRoute network model / Simulation</b><p>The MRT-only local fallback and hackathon demo routes are clearly labelled. Simulated durations are never presented as official live data.</p></div></div></section>
      <section className="future-stations card-surface"><div className="section-title"><div><span>Network accuracy</span><h2>Not treated as operational yet</h2></div><Info /></div><p>PulseRoute does not route through a future station merely because it appears on a future-system map. These are kept separate until an opening is confirmed:</p><div>{UPCOMING_STATIONS.map(station => <span key={station.code}><b>{station.code}</b> {station.name}<small>{station.note}</small></span>)}</div></section>
      <ExternalDataNotice credentials={credentials} navigate={navigate} />
      {!liveState.data && liveState.error && <div className="inline-message info"><Info />LTA status: {liveState.error}</div>}
    </main>
  );
}

function loadJourney() {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem('pulseroute-active-journey') || 'null');
    if (saved?.origin && saved?.destination && (saved?.legs?.length || saved?.segments?.length)) return saved;
  } catch {
    // Use the built-in demonstration journey below.
  }
  const departure = singaporeClock(10);
  const sample = planMrtRoutes('Tampines', 'Buona Vista', { departureTime: departure })[0];
  return sample ? { ...sample, targetDeparture: departure, startedAt: new Date().toISOString() } : null;
}

function App() {
  const hashPage = window.location.hash.replace('#', '');
  const [page, setPage] = useState(NAV.some(([id]) => id === hashPage) ? hashPage : 'plan');
  const [activeJourney, setActiveJourney] = useState(loadJourney);
  const [demoCondition, setDemoCondition] = useState({ type: 'normal', id: 'initial-normal' });
  const [credentials, setCredentials] = useState(loadApiKeys);
  const [liveState, setLiveState] = useState({ data: null, error: '', reason: '', loading: false });

  const navigate = useCallback(id => {
    setPage(id);
    if (window.location.hash !== `#${id}`) window.location.hash = id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const refreshLive = useCallback(async () => {
    if (!hasLtaKey(credentials)) {
      setLiveState({ data: null, error: 'LTA DataMall Account Key is not configured. Add it in Settings to attempt live transport data.', reason: 'not_configured', loading: false });
      return;
    }

    setLiveState(state => ({ ...state, loading: true }));
    try {
      const data = await fetchLiveRail(credentials.ltaDataMallKey);
      setLiveState({ data, error: '', reason: '', loading: false });
    } catch (error) {
      const reason = error instanceof DataMallRequestError ? error.code : 'connection_failed';
      setLiveState({ data: null, error: error?.message || 'LTA DataMall could not be reached directly from this browser.', reason, loading: false });
    }
  }, [credentials.ltaDataMallKey]);

  useEffect(() => {
    const onHash = () => {
      const next = window.location.hash.replace('#', '');
      if (NAV.some(([id]) => id === next)) setPage(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    refreshLive();
    const timer = window.setInterval(refreshLive, 60_000);
    return () => window.clearInterval(timer);
  }, [refreshLive]);

  useEffect(() => {
    if (activeJourney) window.sessionStorage.setItem('pulseroute-active-journey', JSON.stringify(activeJourney));
    else window.sessionStorage.removeItem('pulseroute-active-journey');
  }, [activeJourney]);

  return (
    <div className="app-root">
      <TopBar page={page} navigate={navigate} liveState={liveState} />
      {page === 'plan' && <PlanPage liveState={liveState} activeJourney={activeJourney} setActiveJourney={setActiveJourney} navigate={navigate} credentials={credentials} />}
      {page === 'live' && <LivePage liveState={liveState} refreshLive={refreshLive} credentials={credentials} navigate={navigate} />}
      {page === 'journey' && <JourneyPage activeJourney={activeJourney} setActiveJourney={setActiveJourney} liveState={liveState} demoCondition={demoCondition} setDemoCondition={setDemoCondition} navigate={navigate} credentials={credentials} />}
      {page === 'about' && <AboutPage liveState={liveState} credentials={credentials} navigate={navigate} />}
      {page === 'settings' && <SettingsPage credentials={credentials} setCredentials={setCredentials} refreshLive={refreshLive} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
