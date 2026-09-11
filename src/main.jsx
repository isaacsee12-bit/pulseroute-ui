import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle, ArrowRight, BarChart3, BusFront, CalendarDays, ChevronDown,
  Clock3, MapPin, PersonStanding, RefreshCcw, ShieldCheck, TrainFront,
  Users, Walking, Accessibility, Megaphone, Target, Layers3, Plus, Minus,
  Settings, Activity, Route
} from 'lucide-react';
import './styles.css';

const routeCards = [
  {
    icon: <TrainFront size={20} />,
    title: 'Downtown Line (via Expo)',
    badge: 'Faster', badgeTone: 'blue',
    line: 'Tampines → Expo → DTL to Buona Vista',
    arrival: '9:34 AM', chance: '68%',
    note: 'Fastest option, but expected to be more crowded.'
  },
  {
    icon: <BusFront size={20} />,
    title: 'Bus 168 → Circle Line',
    badge: 'Less crowded', badgeTone: 'green',
    line: 'Tampines → Bus 168 → CC to Buona Vista',
    arrival: '9:45 AM', chance: '76%',
    note: 'Slightly longer, but more comfortable with lower crowding.'
  },
  {
    icon: <Walking size={20} />,
    title: 'Walk to Bedok + Downtown Line',
    badge: 'Good exercise', badgeTone: 'purple',
    line: 'Walk 8 min → Bedok → DTL to Buona Vista',
    arrival: '9:46 AM', chance: '74%',
    note: 'Avoids affected area. 8 minutes of walking required.'
  }
];

const stationRows = [
  ['Tampines','92%','Very high','red'], ['Expo','88%','Very high','red'],
  ['Buona Vista','85%','Very high','red'], ['Bedok','72%','High','orange'],
  ['Stevens','68%','High','orange']
];

function Logo() {
  return <div className="brand"><div className="brand-icon"><TrainFront size={21}/></div><div><b>PulseRoute</b><span>Smarter journeys. A more resilient city.</span></div></div>
}

function Field({label, value, icon}) {
  return <div className="field"><div className="field-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong></div><button className="clear">×</button></div>
}

function Chip({label, value, icon}) {
  return <button className="chip"><span className="chip-label">{label}</span>{icon}<b>{value}</b><ChevronDown size={15}/></button>
}

function RouteCard({data}) {
  return <div className="route-card">
    <div className="route-card-title"><span className="route-mini-icon">{data.icon}</span><b>{data.title}</b><span className={`tag ${data.badgeTone}`}>{data.badge}</span></div>
    <p>{data.line}</p>
    <div className="route-card-stats"><div><span>Arrival</span><strong>{data.arrival}</strong></div><div><ShieldCheck size={16}/><span><b>{data.chance} chance</b><small>of arriving before 9:50 AM</small></span></div><ArrowRight size={18}/></div>
    <small className="note">{data.note}</small>
  </div>
}

function Donut() {
  return <div className="allocation-wrap">
    <div className="donut"><div className="donut-center"><strong>12,480</strong><span>Affected<br/>passengers</span></div></div>
    <div className="legend-list">
      <div><i className="dot blue"></i><span>Downtown Line</span><b>35%</b></div>
      <div><i className="dot teal"></i><span>Bus services</span><b>25%</b></div>
      <div><i className="dot purple"></i><span>Walk to adjacent station</span><b>20%</b></div>
      <div><i className="dot orange"></i><span>Delay departure</span><b>20%</b></div>
    </div>
  </div>
}

function CapacityCard() {
  return <section className="card capacity-card">
    <div className="card-head"><div><AlertTriangle size={18} className="danger"/><b>Stations approaching capacity</b></div><button>View all</button></div>
    <div className="station-list">
      {stationRows.map(([name,pct,label,tone]) => <div className="station-row" key={name}>
        <span className={`status-dot ${tone}`}></span><b>{name}</b><strong className={tone}>{pct}</strong><span className={`pill ${tone}`}>{label}</span>
      </div>)}
    </div>
  </section>
}

function AcceptCard() {
  const rows = [
    ['Downtown Line',78,'blue'], ['Bus services',67,'teal'], ['Walk to adjacent station',62,'purple'], ['Delay departure',71,'orange']
  ];
  return <section className="card accept-card">
    <div className="card-head"><div><BarChart3 size={18}/><b>Acceptance rate by recommendation</b></div></div>
    <div className="accept-list">{rows.map(([name,pct,tone]) => <div className="accept-row" key={name}><span>{name}</span><div className="progress"><i className={tone} style={{width:`${pct}%`}}></i></div><b>{pct}%</b></div>)}</div>
  </section>
}

function CongestionCard() {
  const data = [
    ['Tampines',92,58], ['Expo',88,52], ['Buona Vista',85,48], ['Commonwealth',70,42], ['Queenstown',62,38]
  ];
  return <section className="card congestion-card">
    <div className="card-head"><div><Activity size={18}/><b>Estimated congestion (affected stations)</b></div></div>
    <div className="chart-legend"><span><i className="dot grey"></i>Before recommendations</span><span><i className="dot teal"></i>After recommendations</span></div>
    <div className="bar-chart">
      <div className="axis"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
      <div className="grid-lines"><i></i><i></i><i></i><i></i></div>
      <div className="bars-area">{data.map(([name,before,after]) => <div className="bar-group" key={name}><div className="bars"><div className="bar before" style={{height:`${before}%`}}><span>{before}%</span></div><div className="bar after" style={{height:`${after}%`}}><span>{after}%</span></div></div><small>{name}</small></div>)}</div>
    </div>
  </section>
}

function PromoteCard() {
  const items = [['Bus 33','High spare capacity'],['Bus 168','Underutilized'],['Walk to Bedok','Low crowding'],['Delay departure (10–15 min)','Services stabilizing']];
  return <section className="card promote-card"><div className="card-head"><div><Megaphone size={18}/><b>Alternatives to promote</b></div></div>
    <div className="promote-list">{items.map(([name,desc],i)=><div className="promote-row" key={name}><span className="rank">{i+1}</span><div><b>{name}</b><small>{desc}</small></div><span className="promote-pill">Promote</span></div>)}</div>
  </section>
}

function RouteMap() {
  return <section className="route-map card">
    <div className="map-head"><b>Route map</b><div className="map-legend"><span><i className="line green"></i>Normal service</span><span><i className="line red dashed"></i>Disrupted section</span><span><i className="line blue"></i>Your recommended route</span><span><i className="line teal dashed"></i>Alternative route</span></div></div>
    <div className="map-canvas">
      <svg viewBox="0 0 1000 245" preserveAspectRatio="none" aria-label="Transit route map">
        <defs><pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M42 0H0V42" fill="none" stroke="#d9e5ec" strokeWidth="1"/></pattern></defs>
        <rect width="1000" height="245" fill="#f4faf9"/>
        <rect width="1000" height="245" fill="url(#grid)" opacity=".85"/>
        <path d="M0,190 C180,135 290,205 400,145 C520,82 650,95 1000,55 L1000,245 L0,245 Z" fill="#d8eff9" opacity=".85"/>
        <path d="M20 212 C120 180 180 115 310 135 C410 152 470 210 590 175 C710 140 760 64 970 33" fill="none" stroke="#19a974" strokeWidth="6"/>
        <path d="M30 94 C190 96 250 188 410 170" fill="none" stroke="#f04f4f" strokeWidth="5" strokeDasharray="10 8"/>
        <path d="M405 171 C515 180 550 212 650 164 C760 110 820 88 970 55" fill="none" stroke="#1d73e8" strokeWidth="7"/>
        <path d="M625 178 C685 130 730 98 802 110 C855 120 905 83 980 72" fill="none" stroke="#08a998" strokeWidth="4" strokeDasharray="8 7"/>
        {[[120,93],[313,148],[410,170],[610,180],[770,121],[875,86],[970,55]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="7" fill="#fff" stroke="#102448" strokeWidth="3"/>)}
        <circle cx="210" cy="130" r="9" fill="#ef4444"/><path d="M206 136 L214 124" stroke="#fff" strokeWidth="2"/>
        <text x="90" y="75" className="svg-label">Jurong East</text>
        <text x="328" y="175" className="svg-label">Buona Vista</text>
        <text x="483" y="146" className="svg-label">Commonwealth</text>
        <text x="592" y="215" className="svg-label">Queenstown</text>
        <text x="815" y="142" className="svg-label">Bedok</text>
        <text x="923" y="39" className="svg-label">Tampines</text>
        <rect x="638" y="132" rx="8" ry="8" width="74" height="30" fill="#1670ec"/><text x="653" y="152" className="svg-white">Bus 33</text>
        <rect x="188" y="86" rx="10" ry="10" width="185" height="52" fill="#fff0f1" stroke="#f5c6cb"/><text x="222" y="108" className="svg-alert">No service</text><text x="222" y="126" className="svg-sub">Jurong East – Buona Vista</text>
      </svg>
      <div className="map-controls"><button><Plus size={16}/></button><button><Minus size={16}/></button><button><Settings size={16}/></button></div>
      <button className="map-options"><Layers3 size={16}/> Show all options <ChevronDown size={15}/></button>
    </div>
  </section>
}

function App() {
  return <div className="page-shell">
    <div className="browser-bar"><span></span><span></span><span></span></div>
    <header className="topbar">
      <Logo/>
      <nav><a className="active">Plan a Trip</a><a>Live Updates</a><a>For Operators</a><a>About</a></nav>
      <div className="top-actions"><span className="live"><i></i>Live data</span><span className="location"><MapPin size={15}/>Singapore<ChevronDown size={14}/></span><div className="avatar">JD</div><ChevronDown size={14}/></div>
    </header>
    <main className="dashboard">
      <div className="left-col">
        <div className="section-title"><div><h1>Plan your journey</h1><p>Intelligent route recommendations during disruptions.</p></div><span>Different routes for a stronger, more balanced commute.</span></div>
        <div className="planner card">
          <Field label="From" value="Tampines" icon={<MapPin size={18}/>}/>
          <button className="swap"><RefreshCcw size={18}/></button>
          <Field label="To" value="Buona Vista" icon={<MapPin size={18}/>}/>
          <div className="field time-field"><Clock3 size={18}/><div><span>Arrive by</span><strong>9:50 AM</strong></div><CalendarDays size={18}/></div>
          <button className="primary">Get Routes <ArrowRight size={18}/></button>
        </div>
        <div className="filter-row"><Chip label="Urgency" value="Normal" icon={<PersonStanding size={16}/>}/><Chip label="Walking tolerance" value="Up to 10 min" icon={<Walking size={16}/>}/><Chip label="Accessibility needs" value="None" icon={<Accessibility size={16}/>}/></div>
        <div className="alert-banner"><AlertTriangle size={22}/><div><div className="alert-title"><b>East-West Line disruption</b><span>Major delay</span></div><p>No train service between Jurong East and Buona Vista due to a track fault. Expect longer journey times. Our system is distributing commuters across alternative routes to reduce crowding.</p></div><small>Updated 8:15 AM</small><ChevronDown size={17}/></div>
        <div className="recommend card"><div className="recommend-top"><span className="rec-label">✦ Recommended for you</span><span className="tag green"><Users size={14}/>Less crowded</span></div>
          <div className="recommend-body"><div className="mode-icons"><span><BusFront size={24}/></span><ArrowRight size={24}/><span><TrainFront size={24}/></span></div><div className="recommend-info"><h2>Bus 33 → Downtown Line</h2><p>From Tampines Int → Bus 33 to Tampines West Stn → DTL to Buona Vista</p></div><ArrowRight size={22}/></div>
          <div className="recommend-stats"><div><Clock3 size={20}/><span>Arrival<strong>9:42 AM</strong></span></div><div><ShieldCheck size={22}/><span><strong>82% chance</strong><small>of arriving before 9:50 AM</small></span></div><div className="rec-explanation">8 minutes slower than the nominal fastest route, but substantially less congested.</div></div>
        </div>
        <div className="route-grid">{routeCards.map((x,i)=><RouteCard key={i} data={x}/>)}</div>
        <RouteMap/>
      </div>
      <aside className="right-col">
        <div className="intel-head"><div className="intel-icon"><BarChart3 size={23}/></div><div><h2>Network Intelligence</h2><p>Real-time insights for a more balanced and resilient network.</p></div><span className="live-pill">● Live</span><div className="updated"><b>8:15 AM</b><small>Last updated</small></div></div>
        <div className="top-metrics">
          <section className="card allocation-card"><div className="card-head"><div><Route size={18}/><b>Passenger allocation across alternatives</b></div></div><Donut/></section>
          <section className="card movement-card"><div className="card-head"><div><Users size={18}/><b>Expected passenger movements</b></div></div><div className="metric-main"><Users size={30}/><div><strong>12,480</strong><span>Affected passengers</span></div></div><div className="metric-up">↑ <b>+28%</b><span>vs. typical Tuesday</span></div></section>
        </div>
        <div className="mid-grid"><CapacityCard/><AcceptCard/></div>
        <div className="lower-grid"><CongestionCard/><PromoteCard/></div>
        <div className="impact"><Target size={29}/><div><b>System impact</b><p>Our intelligent distribution reduces peak crowding by an estimated 37% across the network, improving the experience for everyone.</p></div><div className="city"><div className="skyline">▥ ▤ ▦</div><b>People move cities.<br/>We keep them moving.</b></div></div>
      </aside>
    </main>
  </div>
}

createRoot(document.getElementById('root')).render(<App/>);
