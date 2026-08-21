# EveSite 2D – Field Excavation Map

Browser prototype for offline jobsite navigation during excavation work. Crews can view color-coded plan layers, see a simulated GPS position on the plan, measure distance to blueprint objects in feet, use field calculators, and take foreman notes — with clear warnings that survey verification is required.

## Quick start

```bash
npm install
npm run dev
```

Open the local dev URL in your browser.

## Physical iPhone acceptance on the local network

The current app is a browser app, not an offline-installable PWA: it has no web
app manifest or service worker. The supported first-phone route is Safari over a
trusted local Wi-Fi network. The PM2 configuration exposes Vite only through the
Mac's network interfaces; it does not create a public deployment or tunnel.

```bash
pm2 startOrReload ecosystem.config.cjs --only evesite-joint-review
ipconfig getifaddr en0
```

On an iPhone connected to the same trusted Wi-Fi, open
`http://<the-Mac-IP>:4175` in Safari. Open **Menu**, open the project selector,
and choose the published package. Wait for **Immutable package · offline** before
testing layers or enabling Airplane Mode.

**Airplane Mode limitation:** the selected semantic package is cached in Safari
and remains usable in the already-open tab after the network is removed. Do not
close or reload the tab during this acceptance. A home-screen shortcut is
optional convenience only; without HTTPS plus a service worker it is not a
reliable cold-start offline install. Reopening the app while offline is not yet a
supported acceptance criterion.

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

## Model Studio publication contract

The field map accepts immutable semantic publication envelopes shaped as follows:

```json
{
  "publication_schema": "excavation-field-map.semantic-publication/v1",
  "package_id": "the-same-value-as-manifest.id",
  "package_version": "producer-assigned-immutable-version",
  "content_sha256": "sha256-of-the-exact-UTF-8-manifest_json-string",
  "created_at": "2026-08-21T12:00:00.000Z",
  "manifest_json": "{\"schema_version\":\"excavation-field-map.jobsite-package/v0.1.0\",...}"
}
```

The receiver verifies the checksum and then runs the existing semantic, geometry,
provenance, grading datum, cut/fill, and drainage gates. The tuple
`package_id + package_version` is immutable: byte-identical retries are idempotent,
while changed content must use a new version. Accepted packages are cached as one
atomic browser record and appear in the phone project's **Layers & Tools** menu.

For local Model Studio development, publish without copying between browser windows:

```bash
npm run publish:local -- /absolute/path/to/semantic-publication.json
```

This writes an ignored development inbox at
`public/semantic-publications.local.json`; the app validates and caches it when the
page loads or regains focus. The exact production seam is the
`semantic_package_publications` table in `supabase-schema.sql`. Deploy that schema,
authenticate the publisher as an existing manager, supply its target
`field_project_id`, and set `VITE_SEMANTIC_PUBLICATIONS_ENABLED=true`. The browser
uses only the publishable/anon key; never put a service-role key in the app. Remote
sync stays explicitly disabled until that schema and authentication are provisioned.

## Roadmap (deferred)

- Real `navigator.geolocation` and offline GPS tracking
- Plan calibration with control points (affine transform)
- IndexedDB / service workers for larger offline packages
- Firebase offline persistence and cloud sync for notes
- Capacitor mobile app with downloadable jobsite packages
- Upload and convert pipeline for construction plan sheets

## Tech stack

React 18, Vite, TypeScript, lucide-react icons.
