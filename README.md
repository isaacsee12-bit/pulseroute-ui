# PulseRoute

PulseRoute is a Nebula X Hackathon 2026 prototype for disruption-aware public-transport decision support. It plans journeys across Singapore's operational MRT network, monitors the route a commuter actually starts, and can proactively recommend a different route when a disruption or crowding change makes switching worthwhile.

## What works

- **All operational MRT stations** on NSL, EWL including the Changi branch, NEL including Punggol Coast, CCL including CCL6, DTL including Hume, and TEL through Bayshore.
- **Type-ahead station search** by station name or code, with typo-tolerant fuzzy matching.
- **Any MRT origin/destination pair**, with up to three rail alternatives from PulseRoute's local graph.
- **Google Maps Routes API integration** for scheduled public-transport itineraries, alternatives, buses/walking legs and timetable-aware ETAs when configured.
- **LTA DataMall integration** for Train Service Alerts and Station Crowd Density Real Time when configured.
- **Live Updates** page backed by LTA rather than fake live data.
- **My Journey** page for normal-operation monitoring and proactive rerouting when conditions change.
- **Hackathon demo controls** for normal journey → simulated crowding/disruption → proactive reroute, clearly labelled as simulation.
- **Offline-safe fallback**: all-station MRT routing still works if Google or LTA APIs are unavailable.

## Data architecture

### Google Maps Routes API

`api/transit-route.js` calls Google's current Routes API `computeRoutes` endpoint with `travelMode: TRANSIT`, arrival time and alternative-route support. The API key stays server-side.

Required environment variable:

```text
GOOGLE_MAPS_API_KEY=...
```

Create a Google Maps Platform project, enable **Routes API**, attach billing as required by Google Maps Platform, create an API key, and restrict that key to the Routes API and your server/deployment where possible.

### LTA DataMall

`api/live-rail.js` calls the official LTA DataMall endpoints for:

- `TrainServiceAlerts`
- `PCDRealTime` for NSL, EWL/CGL, NEL, CCL/CEL, DTL and TEL

Required environment variable:

```text
LTA_DATAMALL_KEY=...
```

Register/request API access from **LTA DataMall** to receive an Account Key. The browser never receives the key. Live rail responses are cached server-side for 60 seconds so the UI can poll safely without hammering DataMall.

PulseRoute deliberately uses the official LTA source instead of scraping MyTransport.SG or third-party sites such as CheckLah. MyTransport.SG surfaces LTA information; DataMall is the supported API source for programmatic access.

## Network accuracy

The built-in MRT topology is intended to represent stations confirmed operational as of **15 September 2026**. It includes:

- Punggol Coast (NE18), opened 10 Dec 2024
- Hume (DT4), opened 28 Feb 2025
- CCL6: Keppel (CC30), Cantonment (CC31), Prince Edward Road (CC32), with Marina Bay CC33 and Bayfront CC34, opened 12 Jul 2026

Stations that LTA still describes as future/not-yet-open are kept out of operational routing, including Xilin, Bedok South, Sungei Bedok, Mount Pleasant, Marina South, Founders' Memorial and Bukit Brown. This prevents the fallback router from inventing journeys through unopened stations.

## Routing behaviour

1. The local MRT graph can route between any two indexed operational MRT stations immediately.
2. If Google Routes is configured, PulseRoute requests timetable-aware transit alternatives and replaces the fallback options when Google returns usable routes.
3. If LTA DataMall is configured, service alerts and crowd-density readings are applied to the selected/active journey.
4. My Journey polls LTA every minute. A major alert affecting the current line/stations, or a high-crowding condition, can trigger a proactive reroute recommendation.
5. The commuter sees the trade-off before switching: ETA, extra travel time, crowding and arrival confidence.

The local graph uses approximate inter-station/transfer durations and exists as a resilient fallback. It is **not** presented as a live timetable. Exact transit timing comes from Google when that connector is configured.

## Run locally — UI/fallback routing only

```bash
npm install
npm run dev
```

Plain Vite serves the frontend but does not execute the `/api` serverless functions. All-station MRT routing and the hackathon simulation still work.

## Run locally — real Google + LTA connectors

The `/api` folder is designed for Vercel serverless functions. One straightforward setup is:

```bash
npm install
npx vercel
npx vercel env add GOOGLE_MAPS_API_KEY
npx vercel env add LTA_DATAMALL_KEY
npx vercel env pull .env.local
npx vercel dev
```

Alternatively, add the same two environment variables in the Vercel project settings and use the deployed site.

Never commit real keys. `.env*` files are ignored except for the safe `.env.example` template.

## Hackathon demo walkthrough

1. **Plan a Trip** — type any MRT station name/code, even with a small spelling error, choose an arrival time and get routes.
2. Start a route.
3. **My Journey** — show the green **Journey on track** state, current leg, next transfer, ETA, confidence and crowding.
4. Click **Simulate crowding** or **Simulate disruption**.
5. PulseRoute changes into a proactive recommendation state and shows a new route plus the trade-off.
6. Choose **Switch route** or **Keep current route**.
7. **Live Updates** — when the LTA key is configured, show the actual DataMall service-alert and crowd-density response.
8. **About** — explain the data architecture, fallback behaviour and what is live versus simulated.

## Production build

```bash
npm run build
npm run preview
```

## Tech stack

- React 18
- Vite 5
- Lucide React
- Google Maps Routes API (optional live connector)
- LTA DataMall (optional live connector)
- Vercel serverless functions for secret-safe API proxying

## Repository hygiene

`node_modules`, build output, Vite cache and local environment files are intentionally ignored through `.gitignore` and should not be committed.
