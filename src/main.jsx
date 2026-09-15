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
  Info,
  MapPin,
  Menu,
  Navigation,
  RefreshCw,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  Sparkles,
  TrainFront,
  Users,
  X,
  Zap,
} from 'lucide-react';
import './app-v2.css';
import { LINE_META, MRT_STATIONS, STATION_BY_CODE, UPCOMING_STATIONS, searchStations } from './data/mrtNetwork.js';
import { buildReroute, currentLeg, planMrtRoutes } from './lib/mrtRouter.js';
import { fetchGoogleTransitRoutes, singaporeArrivalIso } from './lib/googleTransit.js';
import { alertAffectsRoute, crowdForRoute, crowdRows, disruptedAlerts, fetchLiveRail } from './lib/liveRail.js';

const NAV = [
  ['plan', 'Plan a Trip'],
  ['live', 'Live Updates'],
  ['journey', 'My Journey'],
  ['about', 'About'],
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

function defaultArrivalTime() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Singapore',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(Date.now() + 75 * 60 * 1000));
}

function fmtFetchedAt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore', hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(date);
}

function alertMessage(alert) {
  if (!alert) return '';
  return alert.Message || alert.message || `${alert.Line || 'Train'} service disruption${alert.Stations ? ` affecting ${alert.Stations}` : ''}.`;
}

function resolveStationInput(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const exact = MRT_STATIONS.find(station => station.name.toLowerCase() === text.toLowerCase() || station.codes.some(code => code.toLowerCase() === text.toLowerCase()));
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
        <span className={`data-pill ${connected ? 'connected' : 'offline'}`}><span />{connected ? 'LTA live' : 'Live feed setup needed'}</span>
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
  return <span className={`source-badge ${route.googleRoute ? 'google' : 'model'}`}>{route.googleRoute ? 'Google transit' : 'MRT network model'}</span>;
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
        <span><ShieldCheck /><b>{route.confidence}%</b><small>arrival confidence</small></span>
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
            <div className="segment-line"><span style={{ background: lineColor(segment.line) }}>{segment.label || segment.line}</span><b>{LINE_META[normaliseLine(segment.line)]?.name || segment.line}</b>{segment.headsign && <small>towards {segment.headsign}</small>}</div>
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

function LiveSetupNotice({ compact = false }) {
  return (
    <div className={`setup-notice ${compact ? 'compact' : ''}`}>
      <Database size={19} />
      <div><b>Connect the official live feeds</b><p>Add server-side <code>LTA_DATAMALL_KEY</code> for LTA rail alerts/crowding and <code>GOOGLE_MAPS_API_KEY</code> for Google transit schedules and alternatives. Keys are never exposed to the browser.</p></div>
    </div>
  );
}

function PlanPage({ liveState, activeJourney, setActiveJourney, navigate }) {
  const [from, setFrom] = useState(activeJourney?.origin || 'Tampines');
  const [to, setTo] = useState(activeJourney?.destination || 'Buona Vista');
  const [arrival, setArrival] = useState(activeJourney?.targetArrival || defaultArrivalTime());
  const [preference, setPreference] = useState('balanced');
  const [routes, setRoutes] = useState(() => planMrtRoutes('Tampines', 'Buona Vista', { arrivalTime: defaultArrivalTime() }));
  const [selectedId, setSelectedId] = useState(routes[0]?.id || '');
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
    const offline = sortRoutes(planMrtRoutes(resolvedFrom, resolvedTo, { arrivalTime: arrival }), preference, liveState.data);
    if (!offline.length) {
      setError('No MRT route could be found between those stations.');
      return;
    }
    setRoutes(offline);
    setSelectedId(offline[0].id);
    setLoading(true);

    try {
      const google = await fetchGoogleTransitRoutes({ origin: resolvedFrom, destination: resolvedTo, arrivalIso: singaporeArrivalIso(arrival), preference });
      if (google.length) {
        const ordered = sortRoutes(google, preference, liveState.data);
        setRoutes(ordered);
        setSelectedId(ordered[0].id);
        setMessage('Using Google Maps transit schedules and alternatives. LTA crowd/disruption data is applied separately when connected.');
      } else {
        setMessage('Google returned no transit alternative for that time, so PulseRoute is showing its complete MRT network fallback.');
      }
    } catch (routeError) {
      setMessage(routeError.configurationRequired
        ? 'Showing routes from PulseRoute’s complete MRT network graph. Add GOOGLE_MAPS_API_KEY to enable scheduled Google transit routes, buses, walking legs and exact transit ETAs.'
        : 'Live Google routing could not be reached, so PulseRoute has safely fallen back to the MRT network graph.');
    } finally {
      setLoading(false);
    }
  };

  const startRoute = route => {
    const journey = { ...route, targetArrival: arrival, startedAt: new Date().toISOString() };
    setActiveJourney(journey);
    navigate('journey');
  };

  return (
    <main className="page-shell">
      <PageHeading eyebrow="Commuter companion" title="Plan any MRT journey" copy={`Search across ${MRT_STATIONS.length} operational Singapore MRT stations. PulseRoute uses live Google transit routing when configured and a complete MRT graph as its safe fallback.`} />
      <section className="planner-layout">
        <div className="planner-main">
          <section className="trip-builder card-surface">
            <div className="trip-inputs">
              <StationAutocomplete label="From" value={from} onChange={setFrom} />
              <button type="button" className="swap-button" onClick={() => { setFrom(to); setTo(from); }} title="Swap origin and destination"><ArrowDownUp size={19} /></button>
              <StationAutocomplete label="To" value={to} onChange={setTo} />
              <label className="time-control"><Clock3 size={18} /><span><small>Arrive by</small><input type="time" value={arrival} onChange={event => setArrival(event.target.value)} /></span></label>
            </div>
            <div className="planner-actions">
              <div className="preference-tabs">{PREFS.map(([id, label]) => <button key={id} type="button" className={preference === id ? 'active' : ''} onClick={() => setPreference(id)}>{label}</button>)}</div>
              <button type="button" className="primary-button" onClick={getRoutes} disabled={loading}>{loading ? <><RefreshCw className="spin" size={16} /> Finding routes</> : <>Get Routes <ArrowRight size={17} /></>}</button>
            </div>
            {error && <div className="inline-message error"><AlertTriangle size={16} />{error}</div>}
            {message && <div className="inline-message info"><Info size={16} />{message}</div>}
          </section>

          <div className="results-heading"><div><span>{orderedRoutes.length} route{orderedRoutes.length === 1 ? '' : 's'}</span><h2>Best options for this journey</h2></div><small>{liveState.data ? `LTA refreshed ${fmtFetchedAt(liveState.data.fetchedAt)}` : 'Live LTA feed not connected'}</small></div>
          <div className="route-list">
            {orderedRoutes.map((route, index) => <RouteCard key={route.id} route={route} recommended={index === 0} selected={route.id === selected?.id} onSelect={() => setSelectedId(route.id)} onStart={() => startRoute(route)} liveData={liveState.data} />)}
          </div>
          <RouteDiagram route={selected} />
        </div>
        <aside className="planner-side">
          <section className="side-info-card"><div className="card-icon"><Zap /></div><h3>What PulseRoute adds</h3><p>Google can supply scheduled transit alternatives. LTA DataMall supplies authoritative train disruption and station crowd-density signals. PulseRoute combines those signals to monitor the route you actually chose and proactively reroute when conditions worsen.</p></section>
          {!liveState.data && <LiveSetupNotice compact />}
          <section className="side-info-card"><div className="card-icon"><TrainFront /></div><h3>Network coverage</h3><p>The fallback router covers all currently operational MRT stations on NSL, EWL/Changi branch, NEL, CCL including CCL6, DTL and TEL through Bayshore.</p><small>Future stations are not routed until an opening is confirmed.</small></section>
        </aside>
      </section>
    </main>
  );
}

function LivePage({ liveState, refreshLive }) {
  const alerts = disruptedAlerts(liveState.data);
  const crowd = crowdRows(liveState.data);
  const rankedCrowd = [...crowd].sort((a, b) => ({ High: 0, Moderate: 1, Low: 2, Unavailable: 3 }[a.level] - ({ High: 0, Moderate: 1, Low: 2, Unavailable: 3 }[b.level]));

  return (
    <main className="page-shell">
      <PageHeading eyebrow="Network intelligence" title="Live Updates" copy="Official LTA train service alerts and station crowd density, refreshed through PulseRoute’s server-side DataMall connector." action={<button type="button" className="secondary-button" onClick={refreshLive} disabled={liveState.loading}><RefreshCw className={liveState.loading ? 'spin' : ''} size={16} /> Refresh</button>} />
      {!liveState.data ? (
        <section className="empty-live card-surface"><CloudOff /><h2>Live LTA feed is not connected yet</h2><p>{liveState.error || 'Configure LTA_DATAMALL_KEY on the server to activate this page.'}</p><LiveSetupNotice /></section>
      ) : (
        <>
          <div className="live-meta"><span className="live-dot" />Connected to LTA DataMall <b>Updated {fmtFetchedAt(liveState.data.fetchedAt)}</b></div>
          <section className={`network-health ${alerts.length ? 'danger' : 'good'}`}>
            {alerts.length ? <AlertTriangle /> : <CheckCircle2 />}
            <div><span>{alerts.length ? 'Active train disruption' : 'Network status'}</span><h2>{alerts.length ? `${alerts.length} major service alert${alerts.length === 1 ? '' : 's'}` : 'No major train disruption reported'}</h2><p>{alerts.length ? 'PulseRoute will check active journeys against every affected line and station.' : 'LTA Train Service Alerts currently reports normal/minor service status.'}</p></div>
          </section>
          <div className="live-grid">
            <section className="card-surface live-card"><div className="section-title"><div><span>Train service alerts</span><h2>Service status</h2></div><ShieldCheck /></div>{alerts.length ? <div className="alert-list">{alerts.map((alert, index) => <div className="alert-row" key={`${alert.Line}-${index}`}><span className="line-pill" style={{ background: lineColor(alert.Line) }}>{alert.Line}</span><div><b>{normaliseLine(alert.Line)} disruption</b><p>{alertMessage(alert)}</p>{alert.Stations && <small>Affected stations: {alert.Stations}</small>}</div></div>)}</div> : <div className="healthy-message"><CheckCircle2 /> No disrupted train service in the current LTA response.</div>}</section>
            <section className="card-surface live-card"><div className="section-title"><div><span>Station Crowd Density</span><h2>Busiest readings</h2></div><Users /></div>{rankedCrowd.length ? <div className="crowd-table">{rankedCrowd.slice(0, 18).map((row, index) => <div key={`${row.sourceLine}-${row.code}-${index}`}><span className={`crowd-dot ${row.level.toLowerCase()}`} /><b>{row.station}</b><small>{row.code} · {row.line}</small><span className={`crowd-level ${row.level.toLowerCase()}`}>{row.level}</span></div>)}</div> : <div className="healthy-message"><Info /> No crowd-density rows were returned by LTA for this refresh.</div>}</section>
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
  const minutes = first.stopCount ? Math.max(3, Math.round(first.stopCount * 2.1)) : Math.max(3, Math.round((first.stations.length - 1) * 2.35));
  return { station, fromLine: first.line, toLine: route.segments[1].line, minutes };
}

function JourneyPage({ activeJourney, setActiveJourney, liveState, demoCondition, setDemoCondition, navigate }) {
  const [dismissedKey, setDismissedKey] = useState('');
  const [recommendation, setRecommendation] = useState(null);
  const [rerouteLoading, setRerouteLoading] = useState(false);
  const liveAlert = activeJourney ? disruptedAlerts(liveState.data).find(alert => alertAffectsRoute(alert, activeJourney)) : null;
  const liveCrowd = activeJourney ? crowdForRoute(liveState.data, activeJourney) : { label: 'Unknown', source: 'Unavailable' };

  const condition = useMemo(() => {
    if (!activeJourney) return null;
    if (demoCondition?.type && demoCondition.type !== 'normal') return demoCondition;
    if (liveAlert) return { type: 'disruption', live: true, id: `lta-${liveAlert.Line}-${liveAlert.Stations || ''}-${alertMessage(liveAlert)}`, line: normaliseLine(liveAlert.Line), text: alertMessage(liveAlert) };
    if (liveState.data && liveCrowd.label === 'High') return { type: 'crowding', live: true, id: `crowd-${activeJourney.lines?.[0]}-${liveState.data.fetchedAt}`, line: activeJourney.lines?.[0], text: 'LTA station crowd density has risen to High on your current journey.' };
    return null;
  }, [activeJourney, demoCondition, liveAlert, liveState.data, liveCrowd.label]);

  const conditionKey = condition?.id || '';
  const firstLeg = currentLeg(activeJourney);
  const transfer = journeyTransfer(activeJourney);

  useEffect(() => {
    let cancelled = false;
    if (!activeJourney || !condition) {
      setRecommendation(null);
      return () => { cancelled = true; };
    }

    const affectedLine = normaliseLine(condition.line || activeJourney.lines?.[0]);
    const offline = buildReroute(activeJourney.origin, activeJourney.destination, affectedLine, activeJourney.targetArrival || defaultArrivalTime(), condition.type);
    const usableOffline = offline && routeSignature(offline) !== routeSignature(activeJourney) ? offline : null;
    setRecommendation(usableOffline);
    setRerouteLoading(true);

    fetchGoogleTransitRoutes({
      origin: activeJourney.origin,
      destination: activeJourney.destination,
      arrivalIso: singaporeArrivalIso(activeJourney.targetArrival || defaultArrivalTime()),
      preference: condition.type === 'crowding' ? 'quiet' : 'balanced',
    }).then(routes => {
      if (cancelled || !routes.length) return;
      const different = routes.filter(route => routeSignature(route) !== routeSignature(activeJourney));
      const preferred = condition.type === 'disruption'
        ? different.find(route => !route.lines?.includes(affectedLine))
        : different[0];
      if (preferred) setRecommendation(preferred);
    }).catch(() => {}).finally(() => { if (!cancelled) setRerouteLoading(false); });

    return () => { cancelled = true; };
  }, [activeJourney, conditionKey]);

  if (!activeJourney) {
    return <main className="page-shell"><PageHeading eyebrow="Journey monitor" title="My Journey" copy="Start a route from Plan a Trip and PulseRoute will monitor it here." /><section className="empty-journey card-surface"><Navigation /><h2>No active journey</h2><p>Choose a route first. Once started, this page follows the journey during both normal service and disruptions.</p><button type="button" className="primary-button" onClick={() => navigate('plan')}>Plan a trip <ArrowRight size={17} /></button></section></main>;
  }

  const actionable = condition && conditionKey !== dismissedKey;
  const oldCrowd = condition?.type === 'crowding' ? 'High' : liveCrowd.label;
  const newCrowd = recommendation ? crowdForRoute(liveState.data, recommendation).label : 'Unknown';
  const extraMinutes = recommendation ? recommendation.durationMinutes - activeJourney.durationMinutes : 0;
  const currentConfidence = condition ? Math.max(58, activeJourney.confidence - (condition.type === 'disruption' ? 24 : 12)) : activeJourney.confidence;
  const newConfidence = recommendation?.confidence || currentConfidence;

  const switchRoute = () => {
    if (!recommendation) return;
    setActiveJourney({ ...recommendation, targetArrival: activeJourney.targetArrival, startedAt: activeJourney.startedAt || new Date().toISOString() });
    if (!condition?.live) setDemoCondition({ type: 'normal', id: `normal-${Date.now()}` });
    setDismissedKey('');
  };

  return (
    <main className="page-shell">
      <PageHeading eyebrow="Journey monitor" title="My Journey" copy="PulseRoute continuously compares your chosen journey with LTA network conditions and can recommend a better route when the trade-off is worthwhile." />
      <section className={`journey-status ${condition ? 'changed' : 'on-track'}`}>
        {condition ? <AlertTriangle /> : <CheckCircle2 />}
        <div><span>{condition ? 'Conditions changed' : 'Journey on track'}</span><h2>{activeJourney.origin} → {activeJourney.destination}</h2><p>{condition ? condition.text : liveState.data ? 'No LTA major disruption is currently affecting this journey.' : 'No simulated disruption is active. Connect LTA DataMall for automatic live disruption monitoring.'}</p></div>
        <SourceBadge route={activeJourney} />
      </section>

      <section className="journey-metrics card-surface">
        <div><span>Current leg</span><b>{firstLeg ? `${firstLeg.label || firstLeg.line}` : 'MRT journey'}</b><small>{firstLeg ? `${firstLeg.stations[0]} → ${firstLeg.stations[firstLeg.stations.length - 1]}` : activeJourney.detail}</small></div>
        <div><span>Next transfer</span><b>{transfer ? transfer.station : 'No transfer'}</b><small>{transfer ? `${transfer.fromLine} → ${transfer.toLine} in about ${transfer.minutes} min` : 'Stay on the current service'}</small></div>
        <div><span>ETA</span><b>{activeJourney.arrival || `${activeJourney.durationMinutes} min`}</b><small>{activeJourney.durationMinutes} min journey</small></div>
        <div><span>Arrival confidence</span><b>{currentConfidence}%</b><small>{condition ? 'recalculated after change' : 'journey currently stable'}</small></div>
        <div><span>Crowding</span><b>{condition?.type === 'crowding' ? 'High' : liveCrowd.label}</b><small>{condition?.type === 'crowding' ? 'simulated increase' : liveCrowd.source}</small></div>
      </section>

      <section className="upcoming-card card-surface"><Navigation /><div><span>Up next</span><h3>{transfer ? `Transfer at ${transfer.station} in about ${transfer.minutes} min` : `Continue on ${firstLeg?.label || firstLeg?.line || 'your current service'}`}</h3><p>{transfer ? `Change from ${transfer.fromLine} to ${transfer.toLine}. PulseRoute will keep checking conditions before the interchange.` : `Stay on board towards ${activeJourney.destination}.`}</p></div></section>

      {actionable && (
        <section className="reroute-panel">
          <div className="reroute-heading"><div><span><Sparkles size={14} /> Proactive recommendation</span><h2>{recommendation ? 'A better route is available' : 'PulseRoute is checking alternatives'}</h2><p>{condition.type === 'disruption' ? `Your current journey is exposed to a ${condition.live ? 'live LTA' : 'simulated'} service disruption.` : `Crowding increased on ${condition.line || 'your current corridor'}, so PulseRoute checked alternatives with more headroom.`}</p></div>{rerouteLoading && <RefreshCw className="spin" />}</div>
          {recommendation && <>
            <div className="reroute-route"><span className="route-change-label">Recommended</span><h3>{recommendation.shortTitle}</h3><p>{recommendation.detail}</p></div>
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
        <div><span>Hackathon demo controls</span><h2>Normal journey → condition change → proactive reroute</h2><p>These controls are explicitly simulated and never masquerade as LTA data. Live DataMall changes trigger the same recommendation logic automatically.</p></div>
        <div className="demo-buttons"><button type="button" onClick={() => { setDemoCondition({ type: 'normal', id: `normal-${Date.now()}` }); setDismissedKey(''); }}><CheckCircle2 /> Restore normal</button><button type="button" onClick={() => { setDemoCondition({ type: 'crowding', line: activeJourney.lines?.[0], text: `Crowding on ${activeJourney.lines?.[0] || 'your current line'} has increased sharply.`, id: `crowd-${Date.now()}` }); setDismissedKey(''); }}><Users /> Simulate crowding</button><button type="button" className="danger" onClick={() => { setDemoCondition({ type: 'disruption', line: activeJourney.lines?.[0], text: `A simulated disruption has started on ${activeJourney.lines?.[0] || 'your current line'}.`, id: `disruption-${Date.now()}` }); setDismissedKey(''); }}><AlertTriangle /> Simulate disruption</button></div>
      </section>
    </main>
  );
}

function AboutPage({ liveState }) {
  return (
    <main className="page-shell">
      <PageHeading eyebrow="Nebula X Hackathon 2026" title="Why PulseRoute exists" copy="A disruption-aware commuter companion that does more than calculate a route once: it monitors the journey, explains changing conditions and recommends a better path when network conditions change." />
      <section className="about-hero card-surface"><div><span className="eyebrow">Core idea</span><h2>From static journey planning to continuous decision support.</h2><p>PulseRoute combines route alternatives with authoritative rail disruption and crowd-density signals. The commuter gets one clear next action; the underlying system can use network conditions rather than blindly sending every affected passenger to the same fallback.</p></div><div className="architecture"><span>Google Routes API<br/><small>Transit schedules + alternatives</small></span><b>+</b><span>LTA DataMall<br/><small>Service alerts + crowd density</small></span><b>→</b><span className="pulse-box">PulseRoute<br/><small>Journey monitor + proactive rerouting</small></span></div></section>
      <div className="about-grid">
        <section className="card-surface"><div className="card-icon"><Search /></div><h3>All-station journey planning</h3><p>{MRT_STATIONS.length} currently operational MRT stations are indexed locally for fast autocomplete and typo-tolerant search. When Google is configured, PulseRoute uses its transit schedules and alternatives; otherwise the complete MRT topology keeps routing functional.</p></section>
        <section className="card-surface"><div className="card-icon"><Activity /></div><h3>Live rail intelligence</h3><p>LTA DataMall Train Service Alerts identify major disruptions while Station Crowd Density Real Time provides station crowd levels. PulseRoute refreshes the live connector every minute and applies those signals to active journeys.</p></section>
        <section className="card-surface"><div className="card-icon"><Navigation /></div><h3>My Journey</h3><p>The chosen route becomes an active monitored journey. Normal service shows the current leg, transfer, ETA and confidence; a disruption or crowding change can automatically open a reroute recommendation with an explicit trade-off.</p></section>
      </div>
      <section className="data-transparency card-surface"><div className="section-title"><div><span>Data transparency</span><h2>What is live and what is modelled?</h2></div><Database /></div><div className="transparency-grid"><div><b>Live when keys are configured</b><p>Google Maps Routes API transit itineraries, LTA Train Service Alerts and LTA Station Crowd Density Real Time.</p></div><div><b>Always available</b><p>PulseRoute’s local MRT topology, station autocomplete and all-station rail routing fallback.</p></div><div><b>Hackathon simulation only</b><p>The My Journey “Simulate crowding” and “Simulate disruption” buttons, clearly labelled as demo controls.</p></div></div></section>
      <section className="future-stations card-surface"><div className="section-title"><div><span>Network accuracy</span><h2>Not treated as operational yet</h2></div><Info /></div><p>PulseRoute does not route through a future station merely because it appears on a future-system map. These are kept separate until an opening is confirmed:</p><div>{UPCOMING_STATIONS.map(station => <span key={station.code}><b>{station.code}</b> {station.name}<small>{station.note}</small></span>)}</div></section>
      {!liveState.data && <LiveSetupNotice />}
    </main>
  );
}

function loadJourney() {
  try {
    const saved = JSON.parse(localStorage.getItem('pulseroute-active-journey') || 'null');
    if (saved?.origin && saved?.destination && saved?.segments?.length) return saved;
  } catch {}
  const arrival = defaultArrivalTime();
  const sample = planMrtRoutes('Tampines', 'Buona Vista', { arrivalTime: arrival })[0];
  return sample ? { ...sample, targetArrival: arrival, startedAt: new Date().toISOString() } : null;
}

function App() {
  const hashPage = window.location.hash.replace('#', '');
  const [page, setPage] = useState(NAV.some(([id]) => id === hashPage) ? hashPage : 'plan');
  const [activeJourney, setActiveJourney] = useState(loadJourney);
  const [demoCondition, setDemoCondition] = useState({ type: 'normal', id: 'initial-normal' });
  const [liveState, setLiveState] = useState({ data: null, error: '', loading: false });

  const navigate = useCallback(id => {
    setPage(id);
    if (window.location.hash !== `#${id}`) window.location.hash = id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const refreshLive = useCallback(async () => {
    setLiveState(state => ({ ...state, loading: true }));
    try {
      const data = await fetchLiveRail();
      setLiveState({ data, error: '', loading: false });
    } catch (error) {
      const explanation = error.configurationRequired
        ? 'LTA_DATAMALL_KEY has not been configured on the server yet.'
        : error.status === 404 ? 'The live API proxy is not available under plain Vite dev. Use a Vercel deployment or `npx vercel dev` for serverless API routes.'
        : error.message;
      setLiveState(state => ({ data: state.data, error: explanation, loading: false }));
    }
  }, []);

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
    if (activeJourney) localStorage.setItem('pulseroute-active-journey', JSON.stringify(activeJourney));
    else localStorage.removeItem('pulseroute-active-journey');
  }, [activeJourney]);

  return (
    <div className="app-root">
      <TopBar page={page} navigate={navigate} liveState={liveState} />
      {page === 'plan' && <PlanPage liveState={liveState} activeJourney={activeJourney} setActiveJourney={setActiveJourney} navigate={navigate} />}
      {page === 'live' && <LivePage liveState={liveState} refreshLive={refreshLive} />}
      {page === 'journey' && <JourneyPage activeJourney={activeJourney} setActiveJourney={setActiveJourney} liveState={liveState} demoCondition={demoCondition} setDemoCondition={setDemoCondition} navigate={navigate} />}
      {page === 'about' && <AboutPage liveState={liveState} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
