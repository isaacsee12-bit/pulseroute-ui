# PulseRoute

PulseRoute is a Nebula X Hackathon 2026 prototype for disruption-aware public-transport decision support. It is designed around a simple idea: during a major disruption, a journey planner should not optimise every commuter independently and send everyone to the same "fastest" alternative. It should also consider network capacity and spread demand across viable options.

## What the prototype demonstrates

- **Commuter journey planning** with preference-aware route scoring.
- **Live Updates** that turn disruption information into concrete commuter actions.
- **Operator balancing simulation** showing before/after network utilisation.
- **Capacity-aware allocation** across rail alternatives, buses and delayed departure.
- **Interactive route map** with selected-route emphasis and disruption context.
- **Transparent demo assumptions** so simulated data is not presented as a live production feed.

## Demo scenario

The prototype models an East-West Line disruption between **Jurong East and Buona Vista**, with the main commuter demonstration corridor running from **Tampines to Buona Vista**.

Candidate alternatives include:

1. Downtown Line → Circle Line via MacPherson.
2. East-West Line → Circle Line via Paya Lebar.
3. Downtown Line → Circle Line via Botanic Gardens.

The recommendation engine scores each option using journey time, reliability, crowding headroom, transfers, walking, accessibility and user preferences.

The operator simulator then allocates displaced demand according to spare capacity and a configurable recommendation-strength parameter, allowing judges to compare the uncoordinated baseline against a PulseRoute-balanced scenario.

## Important data note

This is a hackathon prototype. Network status, passenger counts, crowding and capacity values shown inside the application are **simulated demo data** unless otherwise stated. The architecture is intentionally separated so authoritative transport feeds could replace the demo data layer later.

## Tech stack

- React 18
- Vite 5
- Lucide React
- Pure client-side scoring and balancing logic for the prototype

## Run locally

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal (normally `http://localhost:5173`).

## Production build

```bash
npm run build
npm run preview
```

## Demo walkthrough

1. Open **Plan a Trip** and change the journey preference.
2. Click **Get Routes** and compare the ranked alternatives.
3. Start the recommended route and inspect its focused route map.
4. Open **Live Updates** to view the active disruption and crowding signals.
5. Open **For Operators**, change displaced demand or intervention strength, then run the balancing simulation.
6. Compare **Without balancing** against **With PulseRoute**.
7. Open **About** for the problem framing, architecture, implemented functionality and limitations.

## Repository hygiene

`node_modules`, build output and local environment files are intentionally ignored through `.gitignore` and should not be committed.
