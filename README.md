# PulseRoute

PulseRoute is a Nebula X Hackathon 2026 prototype for disruption-aware, multimodal Singapore public-transport journeys. The existing React/Vite interface, route scoring, My Journey monitor, simulations and local MRT fallback are served by a small Node/Express backend.

## Architecture

**Browser → Cloud Run → OneMap + LTA + Gemini + Community**

Cloud Run serves `dist/` and the same-origin `/api/*` endpoints. Only the backend contacts providers. Its attached `pulseroute-runner` service account reads these five values from Google Secret Manager:

- `ONEMAP_ACCESS_TOKEN`
- `LTA_ACCOUNT_KEY`
- `GEMINI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Values are never build arguments, browser configuration, response headers, or frontend environment variables. They are fetched at runtime with Application Default Credentials and cached in server memory for five minutes. New secret versions are picked up after that cache expires. Provider errors are replaced with safe messages; response data is redacted against loaded secret values. Request bodies, credential values and upstream errors are not logged.

Settings is a **Cloud Integrations** dashboard with one **Check integrations** button. The backend makes real requests and returns **Connected**, **Unavailable**, **Misconfigured**, or **Rate limited**. Merely having a secret does not count as connected. Checks are cached for 60 seconds and concurrent checks share one request. OneMap checks public-transport routing; LTA checks alerts and active crowd quota backoff; Gemini performs a minimal inference; Community reads the `crowd_reports` table. Community's read check does not insert a synthetic report or guarantee that a missing INSERT policy will succeed.

## Local development

Use Node.js 22.9+ and the Google Cloud CLI. All integration values remain in Secret Manager, including during local development.

1. Sign in and select the intended project:

   ```powershell
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   gcloud auth application-default login
   ```

2. Grant your development identity access to the five secrets, or use an identity that already has access. Do not download a service-account key file.
3. Optionally copy `.env.example` to `.env.local` and set **only** the project ID and local port. `.env.local` is ignored by Git and excluded from cloud/container builds. Do not put integration values or `VITE_*` credentials there.
4. Run:

   ```powershell
   npm install
   npm run dev
   ```

Open `http://localhost:5173`. Express hosts the API and Vite development middleware on one origin; there is no provider proxy in Vite configuration. Without Cloud authentication, local MRT routing, typed planning and simulations still work; external integrations report their actual unavailable/misconfigured state.

Production preview:

```powershell
npm run build
npm run preview
```

Open `http://localhost:8080` unless `PORT` is configured.

## Google Cloud deployment

Current deployment: **https://pulseroute-320189741042.asia-southeast1.run.app** in project `qwiklabs-gcp-01-5ca1d6f699f2`.

OneMap, LTA DataMall and Gemini were verified with live requests. Both Supabase secret resources exist but have no versions because a Supabase project has not been set up yet; Community Crowd correctly shows **Misconfigured** and uses the local reporting fallback. To enable shared reporting later, run `supabase/crowd_reports.sql` in your Supabase project and populate the two corresponding secrets.

First verify the selected project and active account:

```powershell
gcloud config get-value project
gcloud auth list
gcloud projects describe YOUR_PROJECT_ID
```

If no project is selected, select the intended project before creating resources. The deployment uses a public Cloud Run service named `pulseroute` in **asia-southeast1**, with **1 CPU, 512Mi RAM, min 0, max 2** instances.

```powershell
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com --project=YOUR_PROJECT_ID
gcloud iam service-accounts create pulseroute-runner --display-name="PulseRoute Cloud Run" --project=YOUR_PROJECT_ID
```

Create each of the five named secrets with `gcloud secrets create SECRET_NAME --replication-policy=automatic --project=YOUR_PROJECT_ID`. Grant the runtime account access **on each secret**, rather than project-wide:

```powershell
gcloud secrets add-iam-policy-binding SECRET_NAME --member="serviceAccount:pulseroute-runner@YOUR_PROJECT_ID.iam.gserviceaccount.com" --role=roles/secretmanager.secretAccessor --project=YOUR_PROJECT_ID
```

Enter values using the masked interactive helper in your own terminal:

```powershell
npm run cloud:secrets -- -Project YOUR_PROJECT_ID
```

The helper passes values to `gcloud secrets versions add --data-file=-` through stdin. Values never appear in command arguments, files or Git. It requires permission to add versions. Re-run it to rotate values, including expired OneMap tokens.

For Community Crowd, run `supabase/crowd_reports.sql` once in the Supabase SQL Editor. Store the project's HTTPS `*.supabase.co` URL and publishable key in the corresponding secrets. The backend uses the publishable key and preserves RLS; it rejects secret/service-role keys.

Deploy the production multi-stage Dockerfile using Cloud Build:

```powershell
gcloud run deploy pulseroute --source=. --project=YOUR_PROJECT_ID --region=asia-southeast1 --service-account=pulseroute-runner@YOUR_PROJECT_ID.iam.gserviceaccount.com --set-env-vars=GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID --cpu=1 --memory=512Mi --min-instances=0 --max-instances=2 --concurrency=20 --timeout=60 --allow-unauthenticated --quiet
gcloud run services describe pulseroute --project=YOUR_PROJECT_ID --region=asia-southeast1 --format="value(status.url)"
```

The deployer needs Cloud Run deployment, build submission and service-account act-as permissions. The Cloud Build identity may need `roles/run.builder` for source deployment; grant it to the actual build identity reported by your project, not the runtime account. The runtime account only needs the five secret-level accessor grants. Source deployment creates/uses the regional `cloud-run-source-deploy` Artifact Registry repository. Cloud Run supplies HTTPS and its `PORT` automatically.

## Preserved features

### OneMap multimodal routing

OneMap Search resolves MRT stations; public-transport routing returns ordered walking, bus and rail legs, durations, transfers, distances, fares and stop codes where available. No bus services or geometry are invented. Failed/empty OneMap routing keeps the MRT-only local network fallback. OneMap tokens expire and must be rotated in Secret Manager.

### LTA live data and quotas

- Train Service Alerts refresh every **60 seconds**.
- Eight `PCDRealTime` line requests refresh every **five minutes**, **sequentially**, with a small gap.
- Quota failures stop the remaining line calls and back off **10, 20, then 30 minutes**.
- Successful crowd snapshots are merged with prior readings; partial failures never clear older successful lines.
- Manual refresh respects the crowd cadence/backoff. The UI distinguishes rate limiting from empty readings.
- The server also coalesces/caches alert and bus-arrival requests, queues crowd calls across browsers, and enforces crowd backoff. These server caches are **per instance**; with max 2 instances, they are not a globally shared quota coordinator. They reset on instance replacement. Each open browser retains its last successful crowd snapshot.
- Bus Arrival v3 remains available on eligible bus legs, with `SEA` / `SDA` / `LSD` occupancy and `Arr` / minutes displays.

### Gemini voice planning

**Plan with voice** records up to ten seconds. Audio is sent to `/api/gemini/voice`; the backend supplies the fixed prompt, operational station list, output schema and `gemini-3.5-flash-lite` model. Gemini extracts transcript, origin and destination; it does not calculate routes. Station names are validated before normal trip planning. Typed planning works during Gemini outages. The public backend bounds audio size and applies aggregate per-instance request limits.

### Community crowd feedback

Green (empty), yellow (slightly crowded), and red (very crowded) reports are stored through the backend in Supabase. Server-side validation sets station names, crowd values, timestamps and five-minute report buckets; the existing SQL grants only SELECT/INSERT with RLS. An anonymous client identifier supports one report per station/line/bucket, not authenticated anti-fraud protection.

Reports decay over 30 minutes. At least three recent unique-client reports are required to materially influence route scoring; eight or more means high confidence. During a shared-service outage, local reports remain explicitly labelled **Community demo — this browser**.

### Route preferences and My Journey

Balanced, Fastest, Less crowded, Fewer transfers and Less walking remain unchanged. Balanced distributes near-equivalent options using a stable session bucket. Disruptions penalise affected lines; rerouting prefers viable, meaningfully different rail/bus/walking alternatives with clear trade-offs.

For the offline demo, open **My Journey → Load multimodal demo → Simulate disruption**. Bugis → Paya Lebar reveals the labelled **Walk → Bus 7 → Walk** relief scenario. Simulation times are illustrative, and actual OneMap alternatives take precedence when available. Future stations remain separate from the operational network.

## Verification

```powershell
npm install
npm run test:smoke
npm run test:server
npm run build
npm run test:ui
npm run audit:secrets
```

Smoke tests cover local fallback, multimodal legs, preferences, crowd sequential requests/backoff, community aggregation, simulations and rerouting. Backend tests cover API boundaries, real-probe status classification, credential injection/redaction, community validation and shared crowd quota behavior.

After deployment, verify `/api/health`, Settings' integration checks, a OneMap trip, Live Updates, voice planning, a community report, and the My Journey simulation. Microphone permission requires HTTPS (or localhost). A successful build or liveness response alone does not prove provider connectivity.

Set `TEST_BASE_URL` to the deployed HTTPS origin and run `npm run test:deployed` for live provider/browser checks. On Windows this includes an in-memory synthesized audio request for City Hall → Orchard. `npm run test:ui` uses mocked provider responses for deterministic UI regression checks and requires `npx playwright install chromium` first.

`npm run audit:secrets -- --cloud` additionally compares actual Secret Manager values against the worktree, build and all reachable Git blobs without printing values. Set `GOOGLE_CLOUD_PROJECT` and, if needed, `GCLOUD_PATH`. For this deployment use `--without-community` until the two Supabase values exist. With `TEST_BASE_URL` set, the audit also downloads and checks the deployed frontend.
