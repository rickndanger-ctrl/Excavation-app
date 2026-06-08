# EveSite 2D – Field Excavation Map

Browser prototype for offline jobsite navigation during excavation work. Crews can view color-coded plan layers, see a simulated GPS position on the plan, measure distance to blueprint objects in feet, use field calculators, and take foreman notes — with clear warnings that survey verification is required.

## Quick start

```bash
npm install
npm run dev
```

Open the local dev URL in your browser.

## Prototype features

- **Offline Mode Ready** — badge activates after downloading the sample jobsite package to `localStorage`
- **Download Jobsite Plans** — caches the Bridge Water Pipe sample package locally
- **My Location on Plan** — simulated blue arrow marker; re-centers the map view
- **GPS Accuracy Warning** — persistent banner and field tip about verifying with control points
- **Plan Calibration** — placeholder UI ("Coming in a future version")
- **Distance to Selected Object** — live feet measurement with dashed line on the plan (default: 36 ft to MH-02)

Additional tools in this prototype:

- Layer toggles (Water, Sewer, Storm, Curb/Sidewalk, Manholes, Building Pad/Road)
- Rock calculator (cubic yards from length × width × depth)
- Foreman notes (saved to `localStorage`)

## Roadmap (deferred)

- Real `navigator.geolocation` and offline GPS tracking
- Plan calibration with control points (affine transform)
- IndexedDB / service workers for larger offline packages
- Firebase offline persistence and cloud sync for notes
- Capacitor mobile app with downloadable jobsite packages
- Upload and convert pipeline for construction plan sheets

## Tech stack

React 18, Vite, TypeScript, lucide-react icons.
