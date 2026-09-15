# PulseRoute

PulseRoute is a Nebula X Hackathon 2026 prototype for disruption-aware, multimodal Singapore public-transport decision support. Its core idea is that a disruption tool should not automatically push every commuter onto the same nominally fastest alternative. PulseRoute compares viable rail, bus and walking itineraries, explains the trade-off, and can diversify near-equivalent recommendations in **Balanced** mode.

PulseRoute does **not** claim to optimise the whole Singapore transport network. The hackathon prototype demonstrates how commuter-level recommendations can be designed to spread demand across viable alternatives while remaining transparent about data sources and fallbacks.

## Architecture

PulseRoute is a **frontend-only React + Vite application**.

There is:

- no Vercel requirement;
- no serverless `/api` layer;
- no backend;
- no environment-variable setup;
- no Google Maps API dependency.

Optional credentials are entered through **Settings** and stored in browser `sessionStorage` for the current session only.

The data/routing stack is:

1. **SLA OneMap** — authenticated Search and public-transport routing. Successful itineraries can contain ordered `WALK`, `BUS` and `SUBWAY` legs.
2. **LTA DataMall** — Train Service Alerts, Station Crowd Density Real Time, and optional Bus Arrival v3 for bus legs when direct browser access succeeds.
3. **PulseRoute network model** — the always-available, MRT-only local routing fallback.
4. **Simulation** — clearly labelled hackathon scenarios used only to demonstrate proactive rerouting when external APIs are unavailable.

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

No Vercel CLI, `.env.local`, cloud function, worker, or backend is required.

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

### Browser/CORS limitation

DataMall's current official guide documents HTTPS GET requests with an `AccountKey` header and illustrates them through Postman. It does **not** document browser CORS support. A frontend-only browser may therefore reject the cross-origin preflight.

PulseRoute does not hide this and does not add a proxy. If direct DataMall access is blocked:

- Live Updates reports the connection failure;
- LTA crowd/disruption data is omitted;
- Bus Arrival/occupancy is omitted;
- OneMap/local routing and the hackathon simulation keep working.

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
npm run build
```

The app must remain fully usable with neither credential configured.
