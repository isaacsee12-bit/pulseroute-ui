import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Gauge,
  Info,
  Layers3,
  MapPin,
  Menu,
  Navigation,
  RefreshCw,
  Route,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrainFront,
  TrendingDown,
  Users,
} from 'lucide-react';
import './styles.css';
import InteractiveTransitMap from './InteractiveTransitMap.jsx';
import {
  ABOUT_PILLARS,
  CROWDING,
  DEMO_STATIONS,
  INCIDENT,
  LINE_STATUS,
  OPERATOR_ALTERNATIVES,
  ROUTE_OPTIONS,
} from './data/demoData.js';
import { allocateDemand, rankRoutes } from './lib/pulseEngine.js';

const TABS = [
  ['plan', 'Plan a Trip'],
  ['live', 'Live Updates'],
  ['operators', 'For Operators'],
  ['about', 'About'],
];

const PREFS = [
  ['balanced', 'Balanced'],
  ['fastest', 'Fastest'],
  ['quiet', 'Less crowded'],
  ['simple', 'Fewer transfers'],
  ['accessible', 'Accessible'],
];

function getInitialTab() {
  const hash = window.location.hash.replace('#', '');
  return TABS.some(([id]) => id === hash) ? hash : 'plan';
}

function Brand({ onClick }) {
  return (
    <button className="brand" type="button" onClick={onClick} aria-label="Go to Plan a Trip">
      <span className="brand-mark"><TrainFront size={22} strokeWidth={2.8} /></span>
      <span className="brand-copy">
        <span className="brand-name">PulseRoute</span>
        <span className="brand-tag">Smarter journeys. A more resilient city.</span>
      </span>
    </button>
  );
}

function TopBar({ activeTab, onNavigate, profile, setProfile }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="topbar">
      <Brand onClick={() => onNavigate('plan')} />
      <nav className={menuOpen ? 'nav-links open' : 'nav-links'} aria-label="Primary navigation">
        {TABS.map(([id, label]) => (
          <button
            type="button"
            className={activeTab === id ? 'nav-link active' : 'nav-link'}
            key={id}
            onClick={() => { onNavigate(id); setMenuOpen(false); }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="top-actions">
        <span className="demo-feed"><span className="live-dot" />Demo network feed</span>
        <span className="location-indicator"><MapPin size={15} />Singapore</span>
        <div className="profile-wrap">
          <button type="button" className="profile-button" onClick={() => setProfileOpen(value => !value)} aria-expanded={profileOpen}>
            <span className="avatar">JD</span><ChevronDown size={16} />
          </button>
          {profileOpen && (
            <div className="profile-popover">
              <strong>Journey preferences</strong>
              <label><input type="checkbox" checked={profile.avoidCrowds} onChange={event => setProfile({ ...profile, avoidCrowds: event.target.checked })} /> Prefer less crowded routes</label>
              <label><input type="checkbox" checked={profile.stepFree} onChange={event => setProfile({ ...profile, stepFree: event.target.checked })} /> Prefer step-free transfers</label>
              <label className="walk-setting">Maximum walking <select value={profile.maxWalking} onChange={event => setProfile({ ...profile, maxWalking: Number(event.target.value) })}><option value={5}>5 min</option><option value={10}>10 min</option><option value={15}>15 min</option></select></label>
            </div>
          )}
        </div>
        <button type="button" className="menu-button" onClick={() => setMenuOpen(value => !value)} aria-label="Open navigation"><Menu size={21} /></button>
      </div>
    </header>
  );
}

function PageHeading({ eyebrow, title, copy, actions }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

function SelectField({ label, value, onChange }) {
  return (
    <label className="control-field">
      <MapPin size={19} />
      <span><small>{label}</small><select value={value} onChange={event => onChange(event.target.value)}>{DEMO_STATIONS.map(station => <option key={station}>{station}</option>)}</select></span>
    </label>
  );
}

function RouteCard({ route, recommended, selected, onSelect, onStart }) {
  return (
    <article className={`route-card ${recommended ? 'recommended' : ''} ${selected ? 'selected' : ''}`}>
      <button className="route-card-select" type="button" onClick={onSelect} aria-label={`Select ${route.shortTitle}`}>
        <div className="route-card-top">
          <div className="route-icons"><span><TrainFront /></span><ArrowRight size={16} /><span><TrainFront /></span></div>
          <div className="route-card-copy">
            <div className="route-card-labels">
              {recommended && <span className="recommendation-pill"><Sparkles size={13} />Recommended</span>}
              <span className={`crowd-pill ${route.crowdLabel === 'Busier' ? 'busy' : ''}`}>{route.crowdLabel}</span>
            </div>
            <h3>{route.shortTitle}</h3>
            <p>{route.detail}</p>
          </div>
          <ChevronRight size={20} />
        </div>
        <div className="route-stats">
          <span><Clock3 /> <b>{route.baseMinutes} min</b><small>ETA {route.arrival}</small></span>
          <span><ShieldCheck /> <b>{route.confidence}% confidence</b><small>arrival reliability</small></span>
          <span><Gauge /> <b>{route.score}/100 fit</b><small>{route.reasons.join(' · ') || 'balanced option'}</small></span>
        </div>
      </button>
      {selected && <button className="start-route" type="button" onClick={onStart}>{recommended ? 'Start this route' : 'Start selected route'} <ArrowRight size={17} /></button>}
    </article>
  );
}

function JourneyActive({ route, onEnd }) {
  return (
    <div className="journey-active">
      <div className="journey-active-icon"><Navigation /></div>
      <div><span>Journey started</span><strong>{route.shortTitle}</strong><small>PulseRoute will keep this recommendation under review as network conditions change.</small></div>
      <button type="button" onClick={onEnd}>End journey</button>
    </div>
  );
}

function NetworkContext({ ranked }) {
  return (
    <aside className="context-column">
      <section className="context-card">
        <div className="card-heading"><AlertTriangle className="danger" /><div><h3>Active disruption</h3><p>{INCIDENT.segment}</p></div></div>
        <div className="incident-summary"><strong>{INCIDENT.title}</strong><span>{INCIDENT.severity}</span><p>{INCIDENT.description}</p></div>
      </section>
      <section className="context-card">
        <div className="card-heading"><Activity /><div><h3>Network conditions</h3><p>Relevant to this journey</p></div></div>
        <div className="status-list">
          {LINE_STATUS.slice(0, 3).map(line => <div key={line.code}><span className={`status-dot ${line.severity}`} /><b>{line.code}</b><span>{line.status}</span></div>)}
        </div>
      </section>
      <section className="context-card why-card">
        <div className="card-heading"><Sparkles /><div><h3>Why this route?</h3><p>Network-aware reasoning</p></div></div>
        <p><b>{ranked[0].shortTitle}</b> scores highest because it {ranked[0].reasons.join(' and ')} while preserving spare capacity for other displaced passengers.</p>
        <div className="why-metrics"><span><b>{Math.round(ranked[0].crowdHeadroom * 100)}%</b> spare capacity</span><span><b>{Math.round(ranked[0].reliability * 100)}%</b> route reliability</span></div>
      </section>
    </aside>
  );
}

function PlanPage({ profile }) {
  const [from, setFrom] = useState('Tampines');
  const [to, setTo] = useState('Buona Vista');
  const [arrival, setArrival] = useState('09:50');
  const [preference, setPreference] = useState('balanced');
  const [submittedPreference, setSubmittedPreference] = useState('balanced');
  const [selectedRouteId, setSelectedRouteId] = useState('bus33');
  const [journeyRouteId, setJourneyRouteId] = useState(null);
  const [validation, setValidation] = useState('');

  const ranked = useMemo(() => rankRoutes(ROUTE_OPTIONS, submittedPreference, profile), [submittedPreference, profile]);
  const selectedRoute = ranked.find(route => route.id === selectedRouteId) || ranked[0];
  const journeyRoute = ranked.find(route => route.id === journeyRouteId);

  useEffect(() => {
    if (!ranked.some(route => route.id === selectedRouteId)) setSelectedRouteId(ranked[0].id);
  }, [ranked, selectedRouteId]);

  const getRoutes = () => {
    if (from === to) {
      setValidation('Origin and destination must be different.');
      return;
    }
    if (from !== 'Tampines' || to !== 'Buona Vista') {
      setValidation('The calibrated hackathon demo currently supports Tampines → Buona Vista. Select that pair to run the route model.');
      return;
    }
    setValidation('');
    setSubmittedPreference(preference);
    setSelectedRouteId(rankRoutes(ROUTE_OPTIONS, preference, profile)[0].id);
    setJourneyRouteId(null);
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
    setValidation('');
  };

  return (
    <main className="page-shell">
      <PageHeading eyebrow="Commuter companion" title="Plan your journey" copy="Get disruption-aware recommendations that consider both your needs and the network's remaining capacity." />
      <section className="planner-grid">
        <div className="planner-main">
          <div className="trip-builder card-surface">
            <div className="trip-row">
              <SelectField label="From" value={from} onChange={setFrom} />
              <button className="swap-button" type="button" onClick={swap} title="Swap origin and destination"><ArrowDownUp size={19} /></button>
              <SelectField label="To" value={to} onChange={setTo} />
              <label className="control-field time-field"><Clock3 size={19} /><span><small>Arrive by</small><input type="time" value={arrival} onChange={event => setArrival(event.target.value)} /></span><CalendarDays size={16} /></label>
            </div>
            <div className="preference-row">
              <div><SlidersHorizontal size={17} /><span>Journey preference</span></div>
              <div className="preference-tabs">{PREFS.map(([id, label]) => <button type="button" key={id} className={preference === id ? 'active' : ''} onClick={() => setPreference(id)}>{label}</button>)}</div>
              <button className="primary-button" type="button" onClick={getRoutes}>Get Routes <ArrowRight size={17} /></button>
            </div>
            {validation && <div className="validation-message"><AlertTriangle size={16} />{validation}</div>}
            <p className="demo-corridor-note"><Info size={14} /> Demo corridor: route alternatives are modelled for Tampines → Buona Vista; station controls demonstrate the intended planner interaction.</p>
          </div>

          <div className="disruption-banner"><AlertTriangle /><div><strong>{INCIDENT.title}<span>{INCIDENT.severity}</span></strong><p>{INCIDENT.description}</p></div><small>Started {INCIDENT.startedAt}</small></div>

          {journeyRoute && <JourneyActive route={journeyRoute} onEnd={() => setJourneyRouteId(null)} />}

          <div className="results-heading"><div><span className="eyebrow">PulseRoute recommendation</span><h2>{ranked.length} viable alternatives</h2></div><span className="model-note"><ShieldCheck size={14} /> Demo scoring model</span></div>
          <div className="routes-stack">
            {ranked.map((route, index) => (
              <RouteCard key={route.id} route={route} recommended={index === 0} selected={selectedRoute.id === route.id} onSelect={() => setSelectedRouteId(route.id)} onStart={() => { setSelectedRouteId(route.id); setJourneyRouteId(route.id); }} />
            ))}
          </div>
          <InteractiveTransitMap activeRoute={selectedRoute.id} />
        </div>
        <NetworkContext ranked={ranked} />
      </section>
    </main>
  );
}

function LivePage() {
  const [tick, setTick] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(new Date());
  const refresh = () => { setTick(value => value + 1); setUpdatedAt(new Date()); };

  return (
    <main className="page-shell">
      <PageHeading
        eyebrow="Demo network feed"
        title="Live Updates"
        copy="One place for disruption status, line conditions and crowding signals that could affect your next decision."
        actions={<button type="button" className="secondary-button" onClick={refresh}><RefreshCw size={16} className={tick % 2 ? 'spin-once' : ''} />Refresh feed</button>}
      />
      <div className="feed-meta"><span className="live-dot" />Snapshot refreshed {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · simulated data for hackathon demonstration</div>

      <section className="live-hero">
        <div className="live-hero-icon"><AlertTriangle /></div>
        <div><span className="eyebrow danger-text">Major disruption</span><h2>{INCIDENT.title}</h2><p>{INCIDENT.description}</p><div className="incident-tags"><span>{INCIDENT.segment}</span><span>Started {INCIDENT.startedAt}</span><span>{INCIDENT.recovery}</span></div></div>
        <div className="affected-number"><strong>{INCIDENT.affectedJourneys.toLocaleString()}</strong><span>estimated affected journeys</span></div>
      </section>

      <section className="dashboard-section">
        <div className="section-title"><div><h2>Rail network status</h2><p>Prioritised by current commuter impact</p></div></div>
        <div className="line-status-grid">{LINE_STATUS.map(line => <article key={line.code} className="line-status-card"><div className="line-status-code">{line.code}</div><div><h3>{line.name}</h3><span className={`service-badge ${line.severity}`}>{line.status}</span><p>{line.detail}</p></div></article>)}</div>
      </section>

      <section className="two-column-section">
        <div className="card-surface roomy">
          <div className="section-title compact"><div><h2>Stations under pressure</h2><p>Indicative crowding from the demo scenario</p></div></div>
          <div className="crowd-list">{CROWDING.map((item, index) => { const level = Math.min(96, item.level + ((tick + index) % 3) * 2); return <div key={item.station} className="crowd-row"><div><b>{item.station}</b><small>{item.note}</small></div><div className="crowd-meter"><span style={{ width: `${level}%` }} /></div><strong>{level}%</strong></div>; })}</div>
        </div>
        <div className="card-surface roomy decision-card">
          <div className="section-title compact"><div><h2>What commuters should do</h2><p>Decision support, not just an alert</p></div></div>
          <div className="action-list">
            <div><span>1</span><p><b>Avoid the disrupted EWL section</b><small>Use DTL/CCL alternatives where suitable.</small></p></div>
            <div><span>2</span><p><b>Check crowd-aware alternatives</b><small>PulseRoute spreads demand rather than pushing everyone to one route.</small></p></div>
            <div><span>3</span><p><b>Delay departure when flexible</b><small>Off-peak shifting protects capacity for time-sensitive trips.</small></p></div>
          </div>
        </div>
      </section>
    </main>
  );
}

function UtilBar({ value, label }) {
  const percent = Math.round(value * 100);
  return <div className="util-wrap"><div className={`util-track ${percent > 100 ? 'over' : ''}`}><span style={{ width: `${Math.min(100, percent)}%` }} /></div><b>{label ?? `${percent}%`}</b></div>;
}

function OperatorsPage() {
  const [demand, setDemand] = useState(4800);
  const [strength, setStrength] = useState(85);
  const [runStrength, setRunStrength] = useState(85);
  const [runDemand, setRunDemand] = useState(4800);
  const simulation = useMemo(() => allocateDemand(OPERATOR_ALTERNATIVES, runDemand, runStrength), [runDemand, runStrength]);

  return (
    <main className="page-shell operator-page">
      <PageHeading eyebrow="Operations console" title="Network balancing" copy="Model how demand could redistribute across alternatives, then tune intervention strength before communicating recommendations." />

      <section className="operator-controls card-surface">
        <div className="scenario-control"><small>Incident scenario</small><strong>{INCIDENT.title}</strong><span>{INCIDENT.segment}</span></div>
        <label><span>Displaced passengers / 15 min <b>{demand.toLocaleString()}</b></span><input type="range" min="2000" max="8000" step="200" value={demand} onChange={event => setDemand(Number(event.target.value))} /></label>
        <label><span>Recommendation strength <b>{strength}%</b></span><input type="range" min="0" max="100" step="5" value={strength} onChange={event => setStrength(Number(event.target.value))} /></label>
        <button className="primary-button" type="button" onClick={() => { setRunDemand(demand); setRunStrength(strength); }}>Run balancing simulation <Activity size={17} /></button>
      </section>

      <section className="kpi-grid">
        <article><span><Users />Demand modelled</span><strong>{simulation.displacedDemand.toLocaleString()}</strong><small>passengers / 15 min</small></article>
        <article><span><TrendingDown />Excess load avoided</span><strong>{simulation.avoided.toLocaleString()}</strong><small>passengers above nominal capacity</small></article>
        <article><span><Check />Expected acceptance</span><strong>{simulation.acceptanceRate}%</strong><small>with current intervention strength</small></article>
        <article><span><AlertTriangle />Residual overload</span><strong>{simulation.afterOverload.toLocaleString()}</strong><small>after balancing</small></article>
      </section>

      <section className="before-after card-surface roomy">
        <div className="section-title"><div><h2>Before vs after PulseRoute</h2><p>Projected alternative-route utilisation under the same displaced demand.</p></div><span className="model-note"><CircleHelp size={14} />Simulation, not live LTA operations data</span></div>
        <div className="comparison-grid">
          <div><h3>Without balancing</h3><p className="comparison-copy">Most commuters independently converge on the most obvious alternative.</p>{simulation.baselineResults.map(item => <div className="capacity-row" key={item.id}><span>{item.label}</span><UtilBar value={item.utilisation} /></div>)}</div>
          <div><h3>With PulseRoute</h3><p className="comparison-copy">Recommendations account for available headroom and spread demand.</p>{simulation.results.map(item => <div className="capacity-row" key={item.id}><span>{item.label}</span><UtilBar value={item.utilisation} /></div>)}</div>
        </div>
      </section>

      <section className="allocation-section card-surface roomy">
        <div className="section-title"><div><h2>Recommended demand allocation</h2><p>Allocation generated from current spare capacity and the selected intervention strength.</p></div></div>
        <div className="allocation-table">
          <div className="allocation-head"><span>Alternative</span><span>Allocation</span><span>Passengers</span><span>Projected load</span></div>
          {simulation.results.map(item => <div className="allocation-row" key={item.id}><span><Route size={16} />{item.label}</span><b>{Math.round(item.share * 100)}%</b><span>{item.allocated.toLocaleString()}</span><span className={item.overloaded ? 'danger-text' : 'good-text'}>{Math.round(item.utilisation * 100)}%</span></div>)}
        </div>
      </section>
    </main>
  );
}

function AboutPage() {
  return (
    <main className="page-shell about-page">
      <PageHeading eyebrow="Nebula X Hackathon 2026" title="Why PulseRoute exists" copy="A smart travel companion for disruption periods, designed around both individual commuter needs and whole-network resilience." />

      <section className="about-hero card-surface roomy">
        <div><span className="eyebrow">The problem</span><h2>Fastest-route thinking can create the next bottleneck.</h2><p>During a rail disruption, thousands of commuters may receive similar alternatives. If every journey planner independently optimises each person for the same shortest path, the recommended corridor can itself become overloaded.</p></div>
        <div className="about-hero-visual"><div><Users /><strong>12,480</strong><span>affected journeys</span></div><ArrowRight /><div><Layers3 /><strong>5</strong><span>viable responses</span></div><ArrowRight /><div><Gauge /><strong>1</strong><span>balanced network</span></div></div>
      </section>

      <section className="dashboard-section">
        <div className="section-title"><div><h2>How PulseRoute responds</h2><p>Three layers turn disruption data into coordinated decisions.</p></div></div>
        <div className="pillar-grid">{ABOUT_PILLARS.map((pillar, index) => <article key={pillar.title}><span>0{index + 1}</span><h3>{pillar.title}</h3><p>{pillar.copy}</p></article>)}</div>
      </section>

      <section className="architecture card-surface roomy">
        <div className="section-title"><div><h2>Prototype architecture</h2><p>Designed so the demo data layer can later be replaced by authoritative transport feeds.</p></div></div>
        <div className="architecture-flow">
          <div><span>Inputs</span><b>Service alerts</b><b>Crowding estimates</b><b>Capacity headroom</b><b>Commuter preferences</b></div>
          <ArrowRight />
          <div className="engine-node"><span>Decision engine</span><b>Route scoring</b><b>Demand allocation</b><b>Constraint checks</b></div>
          <ArrowRight />
          <div><span>Outputs</span><b>Personalised route</b><b>Live updates</b><b>Operator simulation</b><b>Impact metrics</b></div>
        </div>
      </section>

      <section className="two-column-section">
        <div className="card-surface roomy">
          <div className="section-title compact"><div><h2>What is real in this prototype</h2><p>Implemented functionality</p></div></div>
          <ul className="check-list"><li>Preference-aware route scoring</li><li>Capacity-aware demand allocation</li><li>Interactive route selection and map</li><li>Functional operator simulation controls</li><li>Responsive commuter and operator views</li></ul>
        </div>
        <div className="card-surface roomy">
          <div className="section-title compact"><div><h2>Current limitations</h2><p>Explicitly disclosed for the hackathon demo</p></div></div>
          <ul className="limit-list"><li>Network and crowding values are simulated demo data.</li><li>The journey planner models the Tampines → Buona Vista disruption corridor.</li><li>No production integration with LTA/rail operator control systems is claimed.</li><li>Capacity values are illustrative and require calibration against operational data.</li></ul>
        </div>
      </section>

      <section className="impact-banner"><div><span className="eyebrow">North star</span><h2>Help each commuter make a better decision without making the network worse for everyone else.</h2></div><BarChart3 /></section>
    </main>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [profile, setProfile] = useState({ avoidCrowds: true, stepFree: false, maxWalking: 10 });

  const navigate = tab => {
    setActiveTab(tab);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${tab}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onHash = () => setActiveTab(getInitialTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="app-shell">
      <TopBar activeTab={activeTab} onNavigate={navigate} profile={profile} setProfile={setProfile} />
      {activeTab === 'plan' && <PlanPage profile={profile} />}
      {activeTab === 'live' && <LivePage />}
      {activeTab === 'operators' && <OperatorsPage />}
      {activeTab === 'about' && <AboutPage />}
      <footer className="footer"><span>PulseRoute · Nebula X Hackathon 2026 prototype</span><span>Demo data clearly labelled · Built for disruption-aware decision support</span></footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
