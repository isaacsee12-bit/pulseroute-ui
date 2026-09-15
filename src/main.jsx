import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CloudOff,
  Database,
  Eye,
  EyeOff,
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
  fetchLiveRail,
  testLtaDataMallKey,
} from './lib/liveRail.js';
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
  const crowdPenalty = route => {
    const label = crowdForRoute(liveData, route).label;
    return label === 'High' ? 14 : label === 'Moderate' ? 6 : 0;
  };
  return [...routes].sort((a, b) => {
    const metric = route => {
      if (preference === 'simple') return route.durationMinutes + route.transfers * 13;
      if (preference === 'accessible') return route.durationMinutes + (route.walkingMinutes || 0) * 2.3 + route.transfers * 4;
      if (preference === 'quiet') return route.durationMinutes + crowdPenalty(route) + route.transfers * 4;
      if (preference === 'fastest') return route.durationMinutes;
      return route.durationMinutes + route.transfers * 5 + crowdPenalty(route) * 0.45 + (route.walkingMinutes || 0) * 0.5;
    };
    return metric(a) - metric(b);
  });
}

function routeSignature(route) {
  return `${route?.lines?.join('|') || ''}:${route?.stationSequence?.join('>') || route?.detail || ''}`;
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
  const isOneMap = route?.sourceKind === 'onemap' || route?.oneMapRoute;
  return <span className={`source-badge ${isOneMap ? 'onemap' : 'model'}`}>{isOneMap ? 'OneMap' : 'PulseRoute network model'}</span>;
}

function RouteCard({ route, selected, recommended, onSelect, onStart, liveData }) {
  const crowd = crowdForRoute(liveData, route);
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
      <div className="route-metrics-v2">
        <span><Clock3 /><b>{route.durationMinutes} min</b><small>{route.arrival ? `Arrive ${route.arrival}` : 'Estimated duration'}</small></span>
        <span><ShieldCheck /><b>{route.confidence}%</b><small>{route.confidenceSource || 'arrival confidence'}</small></span>
        <span><Users /><b>{crowd.label}</b><small>{crowd.source}</small></span>
        <span><RouteIcon /><b>{route.transfers}</b><small>{route.transfers === 1 ? 'transfer' : 'transfers'}</small></span>
      </div>
      {selected && <button type="button" className="primary-button start-button" onClick={onStart}>Start this route <ArrowRight size={17} /></button>}
    </article>
  );
}

function RouteDiagram({ route }) {
  if (!route?.segments?.length) return null;
  return (
    <section className="route-diagram card-surface">
      <div className="section-title"><div><span>Route detail</span><h2>{route.origin} → {route.destination}</h2></div><SourceBadge route={route} /></div>
      <div className="route-segments">
        {route.segments.map((segment, index) => (
          <div className="route-segment" key={`${segment.line}-${index}`}>
            <div className="segment-line">
              <span style={{ background: lineColor(segment.line) }}>{segment.label || segment.line}</span>
              <b>{LINE_META[normaliseLine(segment.line)]?.name || (segment.mode === 'BUS' ? 'Bus service' : segment.line)}</b>
              {segment.headsign && <small>towards {segment.headsign}</small>}
            </div>
            <div className="station-strip">
              {segment.stations.map((station, stationIndex) => (
                <React.Fragment key={`${station}-${stationIndex}`}>
                  {stationIndex > 0 && <span className="station-connector" style={{ background: lineColor(segment.line) }} />}
                  <span className="station-node"><i style={{ borderColor: lineColor(segment.line) }} /><b>{station}</b></span>
                </React.Fragment>
              ))}
              {segment.stopCount > 1 && <span className="intermediate-count">{segment.stopCount} stops</span>}
            </div>
          </div>
        ))}
      </div>
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
        <p>PulseRoute always works with its local MRT network model. Add a OneMap Access Token for OneMap routing and an LTA DataMall Account Key for live rail alerts/crowding.</p>
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
      setMessage('Using the PulseRoute network model. Add a OneMap Access Token in Settings to try official OneMap public-transport routing.');
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
        setMessage(`Using ${ordered.length} route${ordered.length === 1 ? '' : 's'} returned by OneMap. LTA live disruption/crowding data is applied separately when available.`);
      } else {
        setMessage('OneMap returned no public-transport itinerary for that departure time. PulseRoute is showing its local MRT network fallback.');
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
        eyebrow="Commuter companion"
        title="Plan any MRT journey"
        copy={`Search across ${MRT_STATIONS.length} operational Singapore MRT stations. OneMap is used when a valid token and direct browser access are available; PulseRoute's complete MRT graph remains the fallback.`}
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
          <RouteDiagram route={selected} />
        </div>
        <aside className="planner-side">
          <section className="side-info-card"><div className="card-icon"><Zap /></div><h3>What PulseRoute adds</h3><p>OneMap can provide an official public-transport itinerary. LTA DataMall can provide train service alerts and station crowd-density signals. PulseRoute combines whatever official data is reachable with its own always-available MRT network model and journey monitor.</p></section>
          <ExternalDataNotice credentials={credentials} navigate={navigate} compact />
          <section className="side-info-card"><div className="card-icon"><TrainFront /></div><h3>Network coverage</h3><p>The fallback router covers currently operational MRT stations on NSL, EWL/Changi branch, NEL, CCL including CCL6, DTL and TEL through Bayshore.</p><small>Future stations are not routed until an opening is confirmed.</small></section>
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
  if (!route?.segments || route.segments.length < 2) return null;
  const first = route.segments[0];
  const station = first.stations[first.stations.length - 1];
  const minutes = first.durationSeconds
    ? Math.max(3, Math.round(first.durationSeconds / 60))
    : first.stopCount
      ? Math.max(3, Math.round(first.stopCount * 2.1))
      : Math.max(3, Math.round((first.stations.length - 1) * 2.35));
  return { station, fromLine: first.line, toLine: route.segments[1].line, minutes };
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
    setRecommendation(usableLocal);

    if (!hasOneMapToken(credentials)) return () => { cancelled = true; };
    setRerouteLoading(true);
    fetchOneMapTransitRoutes({
      origin: activeJourney.origin,
      destination: activeJourney.destination,
      departureTime: departure,
      token: credentials.oneMapToken,
    }).then(routes => {
      if (cancelled || !routes.length) return;
      const different = routes.filter(route => routeSignature(route) !== routeSignature(activeJourney));
      const preferred = condition.type === 'disruption'
        ? different.find(route => !route.lines?.includes(affectedLine)) || different[0]
        : different[0];
      if (preferred) setRecommendation(preferred);
    }).catch(() => {
      // The local reroute remains visible. Credential/API errors are surfaced in Settings/Plan a Trip.
    }).finally(() => { if (!cancelled) setRerouteLoading(false); });

    return () => { cancelled = true; };
  }, [activeJourney, conditionKey, credentials.oneMapToken]);

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
  const newCrowd = recommendation ? crowdForRoute(liveState.data, recommendation).label : 'Unknown';
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

  return (
    <main className="page-shell">
      <PageHeading
        eyebrow="Journey monitor"
        title="My Journey"
        copy="PulseRoute continuously compares your chosen journey with reachable LTA network conditions and can recommend a better route when conditions change."
        action={<button type="button" className="secondary-button" onClick={() => setActiveJourney(null)}><X size={16} /> End journey</button>}
      />
      <section className={`journey-status ${condition ? 'changed' : 'on-track'}`}>
        {condition ? <AlertTriangle /> : <CheckCircle2 />}
        <div><span>{condition ? 'Conditions changed' : 'Journey on track'}</span><h2>{activeJourney.origin} → {activeJourney.destination}</h2><p>{condition ? condition.text : liveState.data ? 'No LTA major disruption is currently affecting this journey.' : 'No simulated disruption is active. Live LTA data is currently unavailable.'}</p></div>
        <SourceBadge route={activeJourney} />
      </section>

      <section className="journey-metrics card-surface">
        <div><span>Current leg</span><b>{firstLeg ? `${firstLeg.label || firstLeg.line}` : 'MRT journey'}</b><small>{firstLeg ? `${firstLeg.stations[0]} → ${firstLeg.stations[firstLeg.stations.length - 1]}` : activeJourney.detail}</small></div>
        <div><span>Next transfer</span><b>{transfer ? transfer.station : 'No transfer'}</b><small>{transfer ? `${transfer.fromLine} → ${transfer.toLine} in about ${transfer.minutes} min` : 'Stay on the current service'}</small></div>
        <div><span>ETA</span><b>{activeJourney.arrival || `${activeJourney.durationMinutes} min`}</b><small>{activeJourney.durationMinutes} min journey</small></div>
        <div><span>Arrival confidence</span><b>{currentConfidence}%</b><small>{activeJourney.confidenceSource || (condition ? 'recalculated after change' : 'PulseRoute estimate')}</small></div>
        <div><span>Crowding</span><b>{condition?.type === 'crowding' ? 'High' : liveCrowd.label}</b><small>{condition?.type === 'crowding' ? 'Simulation' : liveCrowd.source}</small></div>
      </section>

      <section className="upcoming-card card-surface"><Navigation /><div><span>Up next</span><h3>{transfer ? `Transfer at ${transfer.station} in about ${transfer.minutes} min` : `Continue on ${firstLeg?.label || firstLeg?.line || 'your current service'}`}</h3><p>{transfer ? `Change from ${transfer.fromLine} to ${transfer.toLine}. PulseRoute will keep checking conditions before the interchange.` : `Stay on board towards ${activeJourney.destination}.`}</p></div></section>

      {actionable && (
        <section className="reroute-panel">
          <div className="reroute-heading"><div><span><Sparkles size={14} /> Proactive recommendation</span><h2>{recommendation ? 'A better route is available' : 'PulseRoute is checking alternatives'}</h2><p>{condition.type === 'disruption' ? `Your current journey is exposed to a ${condition.live ? 'live LTA' : 'simulated'} service disruption.` : `Crowding increased on ${condition.line || 'your current corridor'}, so PulseRoute checked alternatives.`}</p></div>{rerouteLoading && <RefreshCw className="spin" />}</div>
          {recommendation && <>
            <div className="reroute-route"><span className="route-change-label">Recommended</span><h3>{recommendation.shortTitle}</h3><p>{recommendation.detail}</p><SourceBadge route={recommendation} /></div>
            <div className="tradeoff-grid">
              <div><span>New ETA</span><b>{recommendation.arrival || `${recommendation.durationMinutes} min`}</b></div>
              <div><span>Travel-time change</span><b className={extraMinutes <= 0 ? 'positive' : ''}>{extraMinutes > 0 ? `+${extraMinutes}` : extraMinutes} min</b></div>
              <div><span>Crowding</span><b>{oldCrowd} → {newCrowd === 'Unknown' ? (condition.type === 'crowding' ? 'Lower expected' : 'Unknown') : newCrowd}</b></div>
              <div><span>On-time probability</span><b>{currentConfidence}% → {newConfidence}%</b></div>
            </div>
            <div className="reroute-actions"><button type="button" className="primary-button" onClick={switchRoute}>Switch route <ArrowRight size={17} /></button><button type="button" className="secondary-button" onClick={() => setDismissedKey(conditionKey)}>Keep current route</button></div>
          </>}
        </section>
      )}

      {condition && !actionable && <div className="kept-route"><Info />You chose to keep the current route. PulseRoute is still monitoring it and will surface a new recommendation if conditions change again.</div>}
      <RouteDiagram route={activeJourney} />

      <section className="demo-controls card-surface">
        <div><span>Hackathon demo controls</span><h2>Normal journey → condition change → proactive reroute</h2><p>These controls are simulation only and never masquerade as OneMap or LTA data. A reachable live DataMall change triggers the same recommendation logic automatically.</p></div>
        <div className="demo-buttons">
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
      setOneMapStatus({
        code: ['expired_token', 'invalid_token'].includes(code) ? code : 'connection_failed',
        detail: error?.message || 'OneMap connection test failed.',
      });
    } finally {
      setTesting('');
    }
  };

  const testLta = async () => {
    setTesting('lta');
    try {
      await testLtaDataMallKey(draftLta);
      setLtaStatus({ code: 'connected', detail: 'Authenticated Train Service Alerts request succeeded.' });
    } catch (error) {
      const code = error instanceof DataMallRequestError ? error.code : 'connection_failed';
      setLtaStatus({
        code: code === 'invalid_key' ? 'invalid_key' : 'connection_failed',
        detail: error?.message || 'LTA DataMall connection test failed.',
      });
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
          <div className="credential-heading"><div className="credential-icon"><MapPin /></div><div><span>SLA</span><h2>OneMap</h2><p>Used for authenticated OneMap Search and, when direct routing succeeds, OneMap public-transport itineraries.</p></div></div>
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
          <div className="credential-heading"><div className="credential-icon"><Database /></div><div><span>LTA</span><h2>DataMall</h2><p>Used for Train Service Alerts and Station Crowd Density Real Time when the browser is allowed to reach DataMall directly.</p></div></div>
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
        <div><Info /><div><h3>Connection behaviour</h3><p><b>OneMap unavailable:</b> route planning falls back to the PulseRoute network model. <b>LTA unavailable:</b> Live Updates clearly shows that live rail data is unavailable. <b>Neither configured:</b> route planning and the My Journey simulation remain fully demoable.</p></div></div>
        <button type="button" className="secondary-button" onClick={refreshLive} disabled={!hasLtaKey(credentials)}>Refresh LTA data</button>
      </section>
    </main>
  );
}

function AboutPage({ liveState, credentials, navigate }) {
  return (
    <main className="page-shell">
      <PageHeading eyebrow="Nebula X Hackathon 2026" title="Why PulseRoute exists" copy="A disruption-aware commuter companion that does more than calculate a route once: it monitors the journey, explains changing conditions and recommends a better path when network conditions change." />
      <section className="about-hero card-surface"><div><span className="eyebrow">Core idea</span><h2>From static journey planning to continuous decision support.</h2><p>PulseRoute combines supported OneMap route information with LTA rail disruption/crowd signals when those services are reachable from the browser. The local MRT network model keeps the experience working even when external APIs are unavailable.</p></div><div className="architecture"><span>OneMap<br/><small>Search + supported public-transport routing</small></span><b>+</b><span>LTA DataMall<br/><small>Service alerts + crowd density</small></span><b>→</b><span className="pulse-box">PulseRoute<br/><small>Journey monitor + proactive rerouting</small></span></div></section>
      <div className="about-grid">
        <section className="card-surface"><div className="card-icon"><Search /></div><h3>All-station journey planning</h3><p>{MRT_STATIONS.length} operational MRT stations are indexed locally for fast autocomplete and typo-tolerant search. OneMap is attempted when configured; otherwise the complete MRT topology keeps routing functional.</p></section>
        <section className="card-surface"><div className="card-icon"><Activity /></div><h3>Live rail intelligence</h3><p>LTA DataMall Train Service Alerts and Station Crowd Density Real Time are requested directly from the browser. If browser CORS/network policy blocks DataMall, PulseRoute says so instead of pretending the feed is live.</p></section>
        <section className="card-surface"><div className="card-icon"><Navigation /></div><h3>My Journey</h3><p>The chosen route becomes an active monitored journey. Normal service shows the current leg, transfer, ETA and confidence; a disruption or crowding change can open a reroute recommendation with an explicit trade-off.</p></section>
      </div>
      <section className="data-transparency card-surface"><div className="section-title"><div><span>Data transparency</span><h2>What is real and what is modelled?</h2></div><Database /></div><div className="transparency-grid"><div><b>OneMap</b><p>Cards labelled “OneMap” came from a successful direct OneMap routing response.</p></div><div><b>LTA DataMall — Live</b><p>Only shown after a successful direct authenticated DataMall request. Otherwise the app says live LTA data is unavailable.</p></div><div><b>PulseRoute network model / Simulation</b><p>The local MRT fallback and My Journey demo controls are clearly labelled and never presented as official live data.</p></div></div></section>
      <section className="future-stations card-surface"><div className="section-title"><div><span>Network accuracy</span><h2>Not treated as operational yet</h2></div><Info /></div><p>PulseRoute does not route through a future station merely because it appears on a future-system map. These are kept separate until an opening is confirmed:</p><div>{UPCOMING_STATIONS.map(station => <span key={station.code}><b>{station.code}</b> {station.name}<small>{station.note}</small></span>)}</div></section>
      <ExternalDataNotice credentials={credentials} navigate={navigate} />
      {!liveState.data && liveState.error && <div className="inline-message info"><Info />LTA status: {liveState.error}</div>}
    </main>
  );
}

function loadJourney() {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem('pulseroute-active-journey') || 'null');
    if (saved?.origin && saved?.destination && saved?.segments?.length) return saved;
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
      setLiveState({ data: null, error: 'LTA DataMall Account Key is not configured. Add it in Settings to attempt live rail data.', reason: 'not_configured', loading: false });
      return;
    }

    setLiveState(state => ({ ...state, loading: true }));
    try {
      const data = await fetchLiveRail(credentials.ltaDataMallKey);
      setLiveState({ data, error: '', reason: '', loading: false });
    } catch (error) {
      const reason = error instanceof DataMallRequestError ? error.code : 'connection_failed';
      setLiveState({
        data: null,
        error: error?.message || 'LTA DataMall could not be reached directly from this browser.',
        reason,
        loading: false,
      });
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
