# PulseRoute

PulseRoute is a Nebula X Hackathon 2026 prototype for disruption-aware, multimodal Singapore public-transport decision support. Its core idea is that a disruption tool should not automatically push every commuter onto the same nominally fastest alternative. PulseRoute compares viable rail, bus and walking itineraries, explains the trade-off, and can diversify near-equivalent recommendations in **Balanced** mode.

PulseRoute does **not** claim to optimise the whole Singapore transport network. The hackathon prototype demonstrates how commuter-level recommendations can be designed to spread demand across viable alternatives while remaining transparent about data sources and fallbacks.

## Architecture

PulseRoute is a React + Vite application with no cloud backend requirement.

There is:

- no Vercel requirement;
- no serverless `/api` layer;
- no environment-variable setup;
- no Google Maps API dependency;
- a **local Vite development/preview proxy** for LTA DataMall, because DataMall's browser CORS policy blocks the direct frontend request.

Optional credentials are entered through **Settings** and stored in browser `sessionStorage` for the current session only.

The data/routing stack is:

1. **SLA OneMap** — authenticated Search and public-transport routing. Successful itineraries can contain ordered `WALK`, `BUS` and `SUBWAY` legs.
2. **LTA DataMall** — Train Service Alerts, Station Crowd Density Real Time, and optional Bus Arrival v3, forwarded through the local Vite proxy so browser CORS does not block the hackathon demo.
3. **PulseRoute network model** — the always-available, MRT-only local routing fallback.
4. **Gemini Voice Planning** — optional audio intent extraction for origin/destination entry; PulseRoute still validates and routes locally/through OneMap.
5. **Community Crowd** — optional shared traffic-light crowd reports using Supabase Data REST with Row Level Security.
6. **Simulation** — clearly labelled hackathon scenarios used only to demonstrate proactive rerouting when external APIs are unavailable.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

Production check:

```bash
npm run build
```

No Vercel CLI, `.env.local`, cloud function, worker, or hosted backend is required. For live LTA data, run the app with Vite (`npm run dev` or `npm run preview`) so the local DataMall proxy is available.

## Gemini voice trip planning

The **Plan a Trip** screen includes a **Plan with voice** control. PulseRoute records a short microphone request (maximum 10 seconds), forwards the audio through the local Vite proxy to Gemini, and asks only for a structured trip intent:

```json
{
  "transcript": "Bring me from Buona Vista to Serangoon",
  "origin": "Buona Vista",
  "destination": "Serangoon"
}
```

The implementation uses `gemini-3.5-flash-lite`, which supports audio input and structured text output. Gemini does **not** calculate the route. PulseRoute validates the returned station names against its own operational MRT dataset, fills the existing origin/destination fields, and then runs the normal PulseRoute route planner.

Setup:

1. Open **Settings → Gemini Voice Planning**.
2. Paste a Google AI Studio Gemini API key.
3. Click **Save**, then **Test Connection**.
4. Return to **Plan a Trip** and click **Plan with voice**.
5. Allow microphone access and say a request such as: “Bring me from Buona Vista to Serangoon.”
6. Click **Stop & plan**, or wait for the 10-second auto-stop.

The Gemini key is stored only in browser `sessionStorage`; it is not hard-coded or committed to this repository. The browser sends the request to the same-origin `/gemini-proxy` path, and Vite forwards it to the fixed Google Gemini API host.

## Configure optional official data

1. Open **Settings**.
2. Paste a **OneMap Access Token**.
3. Click **Save**, then **Test Connection**.
4. Paste your **LTA DataMall Account Key**.
5. Click **Save**, then **Test Connection**.
6. Return to **Plan a Trip**.

A connection is only shown as connected after a real authenticated request succeeds.

### OneMap

Official resources:

- Register: https://www.onemap.gov.sg/apidocs/register
- Authentication/token documentation: https://www.onemap.gov.sg/apidocs/authentication
- Search: https://www.onemap.gov.sg/apidocs/search
- Official workshop/resources: https://www.onemap.gov.sg/apidocs/docs/workshopmay2025

Generate the temporary `access_token` outside PulseRoute using your registered OneMap account. Paste **only the access token** into Settings; never paste your OneMap password into PulseRoute.

Current OneMap authentication documentation says tokens are valid for **3 days**. PulseRoute reads a JWT expiry locally where available, but **Test Connection** still performs a real authenticated Search request before reporting success.

### OneMap multimodal routing

PulseRoute resolves the selected MRT stations using OneMap Search, then calls OneMap's public-transport routing endpoint:

```text
https://www.onemap.gov.sg/api/public/routingsvc/route
```

The implementation follows the current official OneMap workshop pattern for public transport (`routeType=pt`, departure `date`/`time`, `mode=TRANSIT`, walking limit and multiple itineraries). The official workshop response demonstrates ordered public-transport legs and fields including itinerary duration, walking time/distance, transfers, fare, leg mode, route names, stop codes, intermediate stops and leg duration.

PulseRoute only displays fields that actually exist in the returned response. It does not invent bus services, stop codes, times, distances or geometry.

When OneMap succeeds, route cards and route detail can show:

- total journey duration;
- walking time and OneMap walking distance;
- transfer count;
- bus service numbers;
- MRT line names/codes;
- ordered walking, bus and train legs;
- leg duration/distance where returned;
- headsign/stop count where returned;
- departure/arrival information where returned.

If OneMap is unavailable, rejects the token, returns no itinerary, or cannot be reached by the browser, PulseRoute immediately keeps the **MRT-only local network model** route.

## Recommendation scoring

The five commuter preferences remain:

- **Balanced** — combines travel time, transfers, walking, live crowding and disruption exposure. Near-equivalent viable routes can be distributed by a stable browser-session bucket so the prototype does not automatically send every session to the exact same route.
- **Fastest** — prioritises travel time most strongly.
- **Less crowded** — strongly penalises High/Moderate LTA crowd readings when available.
- **Fewer transfers** — strongly penalises transfers.
- **Less walking** — strongly penalises walking minutes.

A route exposed to an active disruption receives a large penalty. Recommendation explanations are deterministic and generated from the route/LTA inputs; PulseRoute does not use an LLM for this.

## My Journey disruption rerouting

When My Journey sees a simulated or reachable live condition change, it looks for a route that is meaningfully different from the active journey.

For disruptions it prioritises:

1. avoiding the affected MRT line;
2. meaningfully different transport modes;
3. bus alternatives returned by OneMap;
4. reasonable walking connections;
5. lower crowding when available;
6. reasonable time/transfer/walking trade-offs.

If OneMap cannot supply an alternative, the local MRT reroute remains available. A dedicated **Simulation** scenario is also available for the hackathon demo and never masquerades as OneMap/LTA data.

### Guaranteed offline multimodal demo

In **My Journey**, choose **Load multimodal demo**, then **Simulate disruption**.

The demonstration journey is **Bugis → Paya Lebar** on the EWL. The simulated relief option is:

```text
Walk → Bus 7 → Walk
```

The demo uses the real Bus 7 corridor and real bus-stop codes `01112` (Opp Bugis Stn Exit C) and `82011` (Aft Paya Lebar Quarter), but the walking and travel durations are intentionally illustrative and the route is prominently labelled **Simulation**.

If a valid OneMap token is available and OneMap returns a suitable real multimodal alternative, that real OneMap alternative takes precedence.

## LTA DataMall

Official resources:

- DataMall: https://datamall.lta.gov.sg/content/datamall/en.html
- Request API access: https://datamall.lta.gov.sg/content/datamall/en/request-for-api.html
- Current API User Guide: https://datamall.lta.gov.sg/content/dam/datamall/datasets/LTA_DataMall_API_User_Guide.pdf

PulseRoute sends the configured Account Key in the documented `AccountKey` HTTP request header.

It currently attempts:

- `TrainServiceAlerts`
- `PCDRealTime?TrainLine=<line>`
- `v3/BusArrival?BusStopCode=<code>&ServiceNo=<service>` for eligible bus legs

The current DataMall v6.9 guide (3 Aug 2026) documents Bus Arrival v3 at:

```text
https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival
```

Bus Arrival occupancy codes are displayed using the official meanings:

- `SEA` → **Seats available**
- `SDA` → **Standing available**
- `LSD` → **Limited standing**

Next-bus time is rounded down to whole minutes; under one minute is displayed as **Arr**, matching LTA's frontend guidance.

### Local Vite proxy for browser CORS

A direct browser request to DataMall can be blocked by CORS because the request uses the custom `AccountKey` header. The Account Key itself can still be valid, as verified from PowerShell/Postman.

PulseRoute now solves this **locally** through Vite:

```text
Browser (localhost:5173)
        ↓ same-origin /lta-proxy
Vite local proxy
        ↓ server-side HTTPS
LTA DataMall
```

The browser still reads the Account Key from PulseRoute Settings/sessionStorage. It sends that key only to the same-origin local Vite proxy, which forwards it to the fixed DataMall host.

This means:

- `npm run dev` → live DataMall requests can work without browser CORS;
- `npm run preview` → the same local proxy is configured;
- `npm run build` → still produces a normal static Vite build;
- opening/deploying only the static files **without a compatible proxy** cannot provide DataMall live data.

No LTA key is hard-coded, committed, or placed in an environment variable.

## Community crowd feedback

PulseRoute now supports commuter-submitted MRT crowd feedback using traffic-light levels:

- 🟢 **Green — Empty**
- 🟡 **Yellow — Slightly crowded**
- 🔴 **Red — Very crowded**

Reports are time-sensitive. The browser weights reports most strongly in the first 5 minutes, then progressively down-weights them, and ignores them after 30 minutes. Only the latest recent report from each anonymous browser identifier counts for a station/line aggregate.

For route scoring, one or two reports are shown as useful context but are treated as **limited reports**. At least three recent unique-browser reports are required before community crowding can materially affect PulseRoute route scoring. Eight or more recent reports are labelled high confidence.

### Shared feedback with Supabase

The app remains frontend-only. Shared crowd reports use Supabase's browser-accessible Data REST API; no PulseRoute backend or serverless function is required.

1. Create a Supabase project: https://supabase.com/dashboard
2. Open the project's SQL Editor.
3. Run the bundled `supabase/crowd_reports.sql`.
4. In the Supabase project **Connect** dialog, copy the **Project URL** and **Publishable Key**.
5. In PulseRoute, open **Settings → Shared Crowd Feedback**.
6. Paste the Project URL and Publishable Key.
7. Click **Save**, then **Test Connection**.

Current Supabase guidance recommends a **publishable key** for browser applications. Legacy `anon` keys are also accepted by PulseRoute. **Never enter a Supabase secret key or legacy service_role key**; PulseRoute rejects those obvious key types in the browser.

The SQL schema enables Row Level Security and grants the public client only `SELECT` and `INSERT` access to `crowd_reports`. It also enforces one report per anonymous client tag / station / line / five-minute bucket. This is appropriate hackathon-grade abuse resistance, not production anti-fraud.

### Local demo fallback

If Supabase is not configured or unreachable, crowd feedback still works on the current browser using local storage and is clearly labelled:

**Community demo — this browser**

Those local-only reports are not shared with other devices.

### How community reports affect recommendations

Community crowd data stays separate from official LTA DataMall data in the UI.

- **LTA DataMall — Live** means an official LTA reading successfully returned through the local Vite proxy.
- **Community** means recent commuter reports stored in the configured shared crowd service.
- **Community demo — this browser** means local-only fallback reports.

When enough community reports exist, PulseRoute blends them with available LTA station crowd readings. If LTA crowd data is unavailable, sufficiently supported community reports can still influence **Balanced** and **Less crowded** route scoring. A route card shows the community colour, report count and confidence so the commuter can see why the recommendation changed.

## LTA crowd-density refresh strategy

PulseRoute deliberately treats Train Service Alerts and Station Crowd Density differently to avoid unnecessary DataMall quota pressure:

- **Train Service Alerts:** refreshed every 60 seconds.
- **Whole-network PCDRealTime crowd density:** refreshed approximately every 5 minutes.
- The eight MRT line requests are sent **sequentially**, with a small gap between requests instead of a single parallel burst.
- If DataMall reports a quota/rate-limit violation, PulseRoute stops the remaining crowd calls immediately and backs off for **10 minutes**, then **20 minutes**, then up to **30 minutes** for repeated quota failures.
- Successful crowd rows are kept as the last known snapshot. A partial or rate-limited refresh updates only the lines that succeeded instead of clearing the panel.
- The Live Updates page distinguishes **“temporarily rate-limited”** from **“LTA returned no crowd-density rows.”**

Manual Live Updates refreshes still refresh Train Service Alerts, but they respect the crowd-density cadence/backoff window rather than forcing another PCDRealTime burst.

## Data-source labels

| Label | Meaning |
| --- | --- |
| **OneMap** | Successful OneMap public-transport itinerary. |
| **LTA DataMall — Live** | Successful authenticated DataMall response in the current browser session. |
| **PulseRoute network model** | Local MRT-only routing fallback. |
| **Simulation** | Explicit hackathon simulation; never presented as official data. |

## Credential handling

This frontend-only setup is for a hackathon/demo, not production secret storage. PulseRoute:

- uses `sessionStorage` only;
- masks credential fields by default;
- never places credentials in URLs;
- never logs credentials;
- never hard-codes or commits credentials;
- provides individual Clear controls and **Clear all credentials**.

## Suggested judge walkthrough

1. In **Plan a Trip**, show a OneMap result with bus/walking legs if your token is working.
2. Point out duration, walking time/distance, transfers, crowding and the deterministic recommendation explanation.
3. Change **Balanced → Fastest → Less crowded → Fewer transfers → Less walking** and show why ordering changes.
4. Start a route and open **My Journey**.
5. Show the normal **Journey on track** state.
6. Use **Load multimodal demo** for Bugis → Paya Lebar.
7. Press **Simulate disruption**.
8. Show the **Simulation** Bus 7 + walking relief option, the extra-time/walking/crowding trade-off, and why it avoids the EWL.
9. If DataMall direct browser access works, point out the separate **LTA DataMall — Live** next-bus/occupancy badge.
10. Press **Switch route**, then explain that real OneMap alternatives take precedence whenever available.

## Build verification

The repository's GitHub Actions workflow runs:

```bash
npm install
npm run test:smoke
npm run build
```

The app must remain fully usable with neither credential configured.
