# PulseRoute

PulseRoute is a Nebula X Hackathon 2026 prototype for disruption-aware Singapore public-transport decision support. It keeps a complete local MRT routing graph available at all times, and can augment the experience with government data sources when they are reachable directly from the browser.

## Architecture

PulseRoute is intentionally a **frontend-only React + Vite application**.

There is:

- no Vercel requirement;
- no serverless `/api` layer;
- no backend;
- no environment-variable setup;
- no Google Maps API dependency.

Optional credentials are entered through the in-app **Settings** page and stored in browser `sessionStorage` for the current session only.

The routing/data stack is:

1. **SLA OneMap** — authenticated Search and supported public-transport routing, when direct browser requests succeed.
2. **LTA DataMall** — Train Service Alerts and Station Crowd Density Real Time, when direct browser requests are permitted.
3. **PulseRoute network model** — the always-available local MRT graph and hackathon-safe fallback.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally:

```text
http://localhost:5173
```

Production build:

```bash
npm run build
```

No Vercel CLI, `.env.local`, cloud function, worker, or backend is required.

## Configure optional official data

After starting PulseRoute:

1. Open **Settings**.
2. Paste a **OneMap Access Token** into the OneMap field.
3. Click **Save**, then **Test Connection**.
4. Paste your **LTA DataMall Account Key** into the LTA field.
5. Click **Save**, then **Test Connection**.
6. Return to **Plan a Trip**.

A connection is only labelled **Connected** after a real authenticated API request succeeds. Merely entering text does not mark a service connected.

### OneMap

Official links:

- Register for OneMap API access: https://www.onemap.gov.sg/apidocs/register
- Official authentication/token documentation: https://www.onemap.gov.sg/apidocs/authentication
- Token endpoint documented by OneMap: https://www.onemap.gov.sg/api/auth/post/getToken
- Search documentation: https://www.onemap.gov.sg/apidocs/search
- Routing documentation: https://www.onemap.gov.sg/apidocs/routing

OneMap authentication uses a registered email/password to generate a temporary `access_token`. **Do that outside PulseRoute. Do not enter your OneMap account password into PulseRoute.** Copy only the returned access token into Settings.

OneMap documents tokens as valid for **3 days** and returning an expiry timestamp. Current OneMap tokens are JWTs; PulseRoute can read the JWT expiry locally for a warning, but a token is considered connected only after a real authenticated OneMap Search request succeeds.

The OneMap Search request uses the official `Authorization` header. The access token is never placed in a URL.

### OneMap public-transport routing

PulseRoute resolves the selected MRT stations with OneMap Search, then attempts OneMap's public-transport routing service at:

```text
https://www.onemap.gov.sg/api/public/routingsvc/route
```

For public transport the current routing interface uses a **departure date/time**. The current documentation does not expose an "arrive by" parameter, so PulseRoute deliberately uses **Depart at** rather than fabricating arrival-time routing.

When OneMap returns itineraries, route cards are labelled **OneMap** and PulseRoute parses only fields that are present in the returned itinerary, such as duration, route legs/modes, transfers, walking duration, times and geometry where supplied.

If OneMap is unavailable, rejects the token, returns no public-transport itinerary, or cannot be reached directly by the browser, PulseRoute immediately keeps/uses the **PulseRoute network model** route instead.

### LTA DataMall

Official links:

- DataMall home: https://datamall.lta.gov.sg/content/datamall/en.html
- Request an Account Key: https://datamall.lta.gov.sg/content/datamall/en/request-for-api.html
- Current API User Guide: https://datamall.lta.gov.sg/content/dam/datamall/datasets/LTA_DataMall_API_User_Guide.pdf

Paste the issued **Account Key** into Settings. PulseRoute sends it only in the documented `AccountKey` request header.

PulseRoute currently attempts these official DataMall APIs directly from the browser:

- `https://datamall2.mytransport.sg/ltaodataservice/TrainServiceAlerts`
- `https://datamall2.mytransport.sg/ltaodataservice/PCDRealTime?TrainLine=<line>`

The current LTA guide documents Train Service Alerts as ad-hoc service-unavailability information and Station Crowd Density Real Time as 10-minute MRT/LRT crowdedness readings.

### Important browser/CORS limitation

LTA's current DataMall guide documents HTTPS GET requests with an `AccountKey` header, illustrated through Postman. It does **not** document browser CORS support. A frontend-only browser may therefore block the direct cross-origin request before JavaScript can read the response.

PulseRoute does not hide this limitation and does not silently add a proxy. If the browser blocks the call, Settings/Live Updates shows a connection failure such as:

> Direct DataMall access is blocked in this browser or network. PulseRoute is using its local/demo data.

The rest of the product continues to work.

OneMap's current Search documentation includes JavaScript `fetch` examples using the `Authorization` header, so its browser integration is attempted directly. Actual success still depends on the current OneMap service/browser policy and a valid user token; PulseRoute falls back safely if the request fails.

## Credential handling

This frontend-only setup is intentionally suitable for a hackathon/demo, **not for production secret storage**.

PulseRoute:

- stores OneMap and LTA credentials only in `sessionStorage`;
- masks credential fields by default;
- provides show/hide controls;
- never writes credentials to `localStorage`;
- never places credentials in URLs;
- never logs credentials to the console;
- never hard-codes or commits credentials;
- provides per-service Clear buttons and **Clear all credentials**.

Because this is a browser application, credentials entered in Settings are visible to the browser/application itself. They should not be treated as server-side secrets.

## Data-source labels

PulseRoute makes the source visible in the interface:

| Label | Meaning |
| --- | --- |
| **OneMap** | Route came from a successful OneMap routing response. |
| **LTA DataMall — Live** | Data came from a successful direct DataMall request during this session. |
| **PulseRoute network model** | Route came from the local MRT graph. |
| **Simulation** | Hackathon-only simulated crowding/disruption condition. |

The interface never labels local fallback or simulated data as live government data.

## My Journey demo

The intended hackathon walkthrough is:

1. Plan and start a journey.
2. Open **My Journey** and show the normal **Journey on track** state.
3. Show current leg, next transfer, ETA, arrival confidence and crowding.
4. Trigger **Simulate crowding** or **Simulate disruption**.
5. PulseRoute explains what changed and offers a proactive reroute.
6. Compare new ETA, extra travel time, crowding and estimated on-time probability.
7. Choose **Switch route** or **Keep current route**.
8. Restore normal conditions and repeat as needed.

The simulation controls are explicitly labelled simulation. Reachable LTA DataMall changes feed into the same journey-monitor logic automatically.

## Local MRT fallback

The built-in graph covers operational stations represented in `src/data/mrtNetwork.js` across NSL, EWL/Changi branch, NEL, CCL including CCL6, DTL and the operational TEL section represented by the project. Future/unopened stations are kept separate from operational routing.

Autocomplete accepts station names and station codes and uses typo-tolerant matching.

## Build verification

The repository includes a GitHub Actions workflow that runs:

```bash
npm ci
npm run build
```

You can perform the same production check locally with `npm run build`.
