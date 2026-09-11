import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowRight,
  Bus,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  MapPin,
  Menu,
  Navigation,
  ShieldCheck,
  Sparkles,
  TrainFront,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import './styles.css';
import './polish.css';
import InteractiveTransitMap from './InteractiveTransitMap.jsx';

const routes = [
  {
    id: 'bus33',
    title: 'Downtown Line → Circle Line',
    detail: 'Tampines (DT32) → MacPherson (DT26/CC10) → Buona Vista (CC22)',
    arrival: '9:42 AM',
    chance: 82,
    crowd: 'Less crowded',
    type: 'rail',
    featured: true,
  },
  {
    id: 'bus168',
    title: 'East-West Line → Circle Line',
    detail: 'Tampines (EW2) → Paya Lebar (EW8/CC9) → Buona Vista (CC22)',
    arrival: '9:45 AM',
    chance: 76,
    crowd: 'Good availability',
    type: 'rail',
  },
  {
    id: 'bedok',
    title: 'DTL via Botanic Gardens → CCL',
    detail: 'Tampines (DT32) → Botanic Gardens (DT9/CC19) → Buona Vista (CC22)',
    arrival: '9:46 AM',
    chance: 74,
    crowd: 'Moderate',
    type: 'rail',
  },
];

const pressure = [
  ['Tampines', 'High', 'Higher than usual crowding'],
  ['Expo', 'High', 'Higher than usual crowding'],
  ['Buona Vista', 'Moderate', 'Some crowding expected'],
];

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark"><TrainFront size={22} strokeWidth={2.8} /></div>
      <div>
        <div className="brand-name">PulseRoute</div>
        <div className="brand-tag">Smarter journeys. A more resilient city.</div>
      </div>
    </div>
  );
}

function TopBar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="topbar">
      <Brand />
      <nav className={open ? 'nav-links open' : 'nav-links'}>
        {['Plan a Trip', 'Live Updates', 'For Operators', 'About'].map((item, i) => (
          <button className={i === 0 ? 'nav-link active' : 'nav-link'} key={item}>{item}</button>
        ))}
      </nav>
      <div className="top-actions">
        <div className="live"><span className="live-dot" />Live data</div>
        <div className="location"><MapPin size={16} />Singapore<ChevronDown size={15} /></div>
        <div className="avatar">JD</div>
        <button className="icon-button desktop-only"><ChevronDown size={18} /></button>
        <button className="icon-button menu-button" onClick={() => setOpen(v => !v)}><Menu size={21} /></button>
      </div>
    </header>
  );
}

function TripField({ label, value, onClear, icon = MapPin }) {
  const Icon = icon;
  return (
    <div className="trip-field">
      <Icon size={21} className="field-icon" />
      <div className="field-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      {onClear && <button className="clear-button" onClick={onClear}><X size={18} /></button>}
    </div>
  );
}

function RouteCard({ route, active, onSelect }) {
  const ModeIcon = route.type === 'bus' ? Bus : TrainFront;
  if (route.featured) {
    return (
      <button onClick={onSelect} className={`featured-route ${active ? 'selected' : ''}`}>
        <div className="route-ribbon"><Sparkles size={17} /> Recommended for you</div>
        <div className="crowd-chip"><Users size={16} /> Less crowded</div>
        <div className="featured-main">
          <div className="mode-flow"><div className="mode-square"><TrainFront /></div><ArrowRight /><div className="mode-square"><TrainFront /></div></div>
          <div className="route-copy">
            <h3>{route.title}</h3>
            <p>{route.detail}</p>
          </div>
          <ChevronRight className="route-chevron" />
        </div>
        <div className="route-metrics">
          <div className="metric"><Clock3 /><div><span>Estimated arrival</span><strong>{route.arrival}</strong></div></div>
          <div className="metric"><ShieldCheck className="green-icon" /><div><strong>{route.chance}% chance</strong><span>of arriving before 9:50 AM</span></div></div>
          <div className="metric"><Users className="blue-icon" /><div><strong>Less crowded</strong><span>8 minutes slower than the nominal fastest route.</span></div></div>
        </div>
      </button>
    );
  }
  return (
    <button onClick={onSelect} className={`compact-route ${active ? 'selected' : ''}`}>
      <div className="compact-top">
        <div className="mode-flow small"><div className="mode-square"><ModeIcon /></div><ArrowRight /><div className="mode-square secondary"><TrainFront /></div></div>
        <div className="route-copy compact-copy"><h4>{route.title}</h4><p>{route.detail}</p></div>
        <ChevronRight />
      </div>
      <div className="compact-metrics">
        <div><Clock3 /><span>Arrival <strong>{route.arrival}</strong></span></div>
        <div><ShieldCheck className="green-icon" /><span><strong>{route.chance}% chance</strong><small>of arriving before 9:50 AM</small></span></div>
      </div>
    </button>
  );
}

function NetworkSidebar() {
  const alternatives = [
    ['DTL → CCL', 'Good availability'],
    ['EWL → CCL', 'Good availability'],
    ['DTL via Botanic Gardens', 'Moderate'],
  ];

  return (
    <aside className="network-panel">
      <div className="network-heading">
        <div className="network-icon"><TrendingUp /></div>
        <div><h2>Network Context</h2><p>Key information from real-time data to help you plan better.</p></div>
      </div>

      <section className="side-card passenger-card">
        <h3><Users /> Affected passengers</h3>
        <div className="impact-row">
          <div className="impact-main"><div className="impact-icon"><Users /></div><div><strong>12,480</strong><span>Estimated affected journeys</span></div></div>
          <div className="impact-delta"><TrendingUp /><strong>+28%</strong><span>vs. typical Tuesday</span></div>
        </div>
        <div className="impact-summary">
          <div><TrainFront /><span><strong>4 stations affected</strong><small>Along the East-West Line</small></span></div>
          <div><Navigation /><span><strong>3 alternative routes</strong><small>available</small></span></div>
        </div>
      </section>

      <section className="side-card pressure-card">
        <h3><TrainFront /> Stations under pressure</h3>
        <p className="subtle">Based on real-time crowding data</p>
        <div className="pressure-list">
          {pressure.map(([station, level, note]) => (
            <div className="pressure-row" key={station}>
              <span className={`status-dot ${level === 'Moderate' ? 'moderate' : ''}`} />
              <strong>{station}</strong>
              <span className={`pressure-pill ${level === 'Moderate' ? 'moderate' : ''}`}>{level}</span>
              <small>{note}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="side-card alternatives-card">
        <h3><Navigation /> Best alternatives right now</h3>
        <p className="subtle">Based on current network conditions</p>
        {alternatives.map(([name, availability], index) => (
          <div className="alt-row" key={name}>
            <span className="rank">{index + 1}</span>
            <TrainFront />
            <strong>{name}</strong>
            <span className={`availability ${availability === 'Moderate' ? 'moderate' : ''}`}>{availability}</span>
            <ChevronRight />
          </div>
        ))}
      </section>

      <section className="city-banner">
        <div><strong>People move cities.<br/>We keep them moving.</strong><span>PulseRoute</span></div>
        <svg viewBox="0 0 260 70" aria-hidden="true"><path d="M5 60h250M25 60V45h15v15M46 60V35h20v25M76 60V42h14v18M98 60V20h18v40M120 60V29h22v31M150 60V12h30v48M184 60V34h18v26M210 60V26h24v34" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="240" cy="40" r="20" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M240 20v40M220 40h40M226 26l28 28M254 26l-28 28" stroke="currentColor" strokeWidth="1.5"/></svg>
      </section>
    </aside>
  );
}

function App() {
  const [from, setFrom] = useState('Tampines');
  const [to, setTo] = useState('Buona Vista');
  const [arrival, setArrival] = useState('9:50 AM');
  const [activeRoute, setActiveRoute] = useState('bus33');
  const active = useMemo(() => routes.find(r => r.id === activeRoute), [activeRoute]);

  const swap = () => {
    setFrom(to || 'Buona Vista');
    setTo(from || 'Tampines');
  };

  return (
    <div className="app-shell">
      <TopBar />
      <main className="dashboard-grid">
        <section className="journey-panel">
          <div className="section-heading"><h1>Plan your journey</h1><p>Get intelligent route recommendations during disruptions.</p></div>
          <div className="trip-controls">
            <TripField label="From" value={from || 'Choose origin'} onClear={() => setFrom('')} />
            <button className="swap-button" onClick={swap} title="Swap origin and destination"><ArrowDownUp size={21} /></button>
            <TripField label="To" value={to || 'Choose destination'} onClear={() => setTo('')} />
            <button className="trip-field arrival-field" onClick={() => setArrival(arrival === '9:50 AM' ? '10:00 AM' : '9:50 AM')}>
              <Clock3 size={21} className="field-icon"/><div className="field-copy"><span>Arrive by</span><strong>{arrival}</strong></div><CalendarDays size={18}/>
            </button>
            <button className="get-routes" onClick={() => setActiveRoute('bus33')}>Get Routes <ArrowRight size={20} /></button>
          </div>

          <div className="disruption-banner"><AlertTriangle /><div><strong>East-West Line disruption <span>Major delay</span></strong><p>No train service between Jurong East and Buona Vista due to a track fault. Expect longer journey times.</p></div><small>Updated 8:15 AM</small></div>

          <RouteCard route={routes[0]} active={activeRoute === routes[0].id} onSelect={() => setActiveRoute(routes[0].id)} />
          <div className="compact-grid">
            {routes.slice(1).map(route => <RouteCard key={route.id} route={route} active={activeRoute === route.id} onSelect={() => setActiveRoute(route.id)} />)}
          </div>
          <InteractiveTransitMap activeRoute={active?.id} />
        </section>
        <NetworkSidebar />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);