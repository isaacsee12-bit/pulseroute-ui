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
  Compass,
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

const routes = [
  {
    id: 'bus33',
    title: 'Bus 33 → Downtown Line',
    detail: 'Tampines Int → Bus 33 to Tampines West Stn → DTL to Buona Vista',
    arrival: '9:42 AM',
    chance: 82,
    crowd: 'Less crowded',
    type: 'bus',
    featured: true,
  },
  {
    id: 'bus168',
    title: 'Bus 168 → Circle Line',
    detail: 'Tampines → Bus 168 → CE → Buona Vista',
    arrival: '9:45 AM',
    chance: 76,
    crowd: 'Good availability',
    type: 'bus',
  },
  {
    id: 'bedok',
    title: 'Walk to Bedok → Downtown Line',
    detail: 'Walk 8 min → Bedok → DTL to Buona Vista',
    arrival: '9:46 AM',
    chance: 74,
    crowd: 'Moderate',
    type: 'walk',
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
  const ModeIcon = route.type === 'walk' ? MapPin : Bus;
  if (route.featured) {
    return (
      <button onClick={onSelect} className={`featured-route ${active ? 'selected' : ''}`}>
        <div className="route-ribbon"><Sparkles size={17} /> Recommended for you</div>
        <div className="crowd-chip"><Users size={16} /> Less crowded</div>
        <div className="featured-main">
          <div className="mode-flow"><div className="mode-square"><Bus /></div><ArrowRight /><div className="mode-square"><TrainFront /></div></div>
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

function RouteMap({ activeRoute }) {
  const routeLabel = activeRoute === 'bus168' ? 'Bus 168' : activeRoute === 'bedok' ? 'DTL via Bedok' : 'Bus 33';
  return (
    <section className="map-card">
      <div className="map-title-row">
        <h3>Route map</h3>
        <div className="legend-inline"><span><i className="line normal" />Normal service</span><span><i className="line disrupted" />Disrupted section</span><span><i className="line route" />Your recommended route</span></div>
      </div>
      <div className="map-canvas">
        <svg viewBox="0 0 900 220" role="img" aria-label="Stylised Singapore transit route map">
          <defs>
            <linearGradient id="water" x1="0" x2="1"><stop offset="0%" stopColor="#eef8ff"/><stop offset="100%" stopColor="#dcefff"/></linearGradient>
          </defs>
          <rect width="900" height="220" rx="18" fill="url(#water)"/>
          <g opacity=".5" stroke="#c8deea" strokeWidth="2" fill="none">
            <path d="M0 70 C130 20 220 130 360 70 S590 10 900 90"/>
            <path d="M0 150 C130 80 300 190 450 125 S710 80 900 160"/>
            <path d="M170 0 C220 70 240 110 280 220"/>
            <path d="M650 0 C620 85 630 130 590 220"/>
          </g>
          <path d="M20 45 C120 90 180 48 270 112 C350 166 410 151 490 108 C580 61 670 49 880 86" fill="none" stroke="#39b67b" strokeWidth="4" opacity=".85"/>
          <path d="M95 72 C145 88 185 106 240 128 C285 146 305 151 344 152" fill="none" stroke="#ff3147" strokeWidth="7" strokeDasharray="12 9"/>
          <path d="M350 153 C435 130 470 127 525 148 C585 170 635 118 695 113 C765 107 815 68 855 54" fill="none" stroke="#0875f5" strokeWidth="7" strokeLinecap="round"/>
          <g fontFamily="Inter, Arial" fontSize="14" fontWeight="700" fill="#0d1f55">
            <circle cx="95" cy="72" r="6" fill="#fff" stroke="#ff3147" strokeWidth="4"/><text x="105" y="62">Jurong East</text>
            <circle cx="350" cy="153" r="7" fill="#fff" stroke="#18336e" strokeWidth="3"/><text x="360" y="171">Buona Vista</text>
            <circle cx="435" cy="130" r="6" fill="#fff" stroke="#18336e" strokeWidth="3"/><text x="445" y="122">Commonwealth</text>
            <circle cx="522" cy="148" r="6" fill="#fff" stroke="#18336e" strokeWidth="3"/><text x="530" y="169">Queenstown</text>
            <circle cx="695" cy="113" r="6" fill="#fff" stroke="#18336e" strokeWidth="3"/><text x="706" y="103">Bedok</text>
            <circle cx="855" cy="54" r="7" fill="#fff" stroke="#18336e" strokeWidth="3"/><text x="866" y="48">Tampines</text>
          </g>
          <g transform="translate(174,74)"><rect width="180" height="48" rx="10" fill="#fff5f5" stroke="#ffc9cf"/><AlertTriangle x="13" y="12" width="22" color="#ff2741"/><text x="45" y="20" fontSize="13" fontWeight="800" fill="#a21422">No service</text><text x="45" y="37" fontSize="12" fill="#b7434f">Jurong East – Buona Vista</text></g>
          <g transform="translate(608,80)"><rect width="75" height="30" rx="7" fill="#0875f5"/><text x="14" y="20" fontSize="13" fontWeight="800" fill="white">{routeLabel}</text></g>
        </svg>
        <div className="zoom-control"><button>+</button><button>−</button></div>
        <button className="map-legend"><Compass size={16} /> Show legend <ChevronDown size={14} /></button>
      </div>
    </section>
  );
}

function NetworkSidebar() {
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
        {['Bus 33', 'Bus 168', 'DTL via Bedok'].map((name, index) => (
          <div className="alt-row" key={name}>
            <span className="rank">{index + 1}</span>
            {index < 2 ? <Bus /> : <TrainFront />}
            <strong>{name}</strong>
            <span className={`availability ${index === 2 ? 'moderate' : ''}`}>{index === 2 ? 'Moderate' : 'Good availability'}</span>
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
          <RouteMap activeRoute={active?.id} />
        </section>
        <NetworkSidebar />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);