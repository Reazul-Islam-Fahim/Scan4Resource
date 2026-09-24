# scan4reuse

A React (Vite) web app for finding reusable building materials. Open the camera on a site, and the app
detects and counts what it sees, builds a **Reuse Report** (with CO₂ and resale estimates, exportable as a
PDF), and shows the materials in a sample **Reuse Marketplace** that can be filtered by price and Swiss canton.

## Run it

```bash
npm install
npm run dev
```

With no backend configured (`VITE_API_URL` empty) or with `VITE_USE_MOCK=true`, the app runs in **demo mode**:
the camera is real, detections are simulated, and saved scans stay in the browser. Copy `.env.example` to
`.env.local` to use your backend.

Browsers only allow camera access on HTTPS (or `localhost`). To test on a phone while developing, run
`npm run dev:phone` and open the HTTPS address it prints. Deployed to Vercel, HTTPS is automatic.

## The flow

`Home → Camera → Detected items → Reuse Report → Marketplace` (and a Map of material sources)

| Screen | Route | What it does |
| --- | --- | --- |
| Home | `#/` | Start scanning. Tabs: Home, Scans, Reports, Profile |
| Camera | `#/scan` | **Photo**: the shutter analyses one picture. **Video**: the shutter starts and stops live scanning. The gallery button analyses a picture from the device, the flip button switches cameras. **Finish** (top right, with the running count) works at any time, even with zero detections. |
| Detected items | `#/items` | One row per label with its count. Tap a row to correct quantity, material, condition (doors: width and height) or remove an item. **Generate Reuse Report** saves the scan and continues. With nothing detected, sample items are shown, marked as sample data. |
| Reuse Report | `#/report` | Potential for reuse, items detected, CO₂ savings and resale value (both estimates), and the material list with values. The share icon exports the report as a PDF (phone share sheet where supported, otherwise a download). **Find buyers / next steps** opens the marketplace. |
| Reuse Marketplace | `#/market` | Search, category chips, 2-column cards with a heart (kept in the browser). The sliders button opens the filters: a **price range** and the **26 Swiss cantons**. Scanned materials come first. |
| Material sources | `#/map` | A map of Switzerland with clustered sources (tap a cluster to zoom in), a details card, type chips, search, a canton filter and a list view. |
| Scans | `#/scans` | Saved scans. **Open report** reloads one into the report; a scan can be deleted. |

Reports and Profile are placeholders in this version. A scan in progress survives an accidental reload.

### Sample data

If a scan detects nothing, the detected-items page, the report, the PDF and the marketplace show sample data
(the six materials of the design) and say so on screen and in the PDF ("SAMPLE DATA"). Sample data is never
saved.

### Estimates

Resale values, CO₂ savings and marketplace prices come from illustrative per-material factors in
`src/lib/materials.js`. They are placeholders, not valuations. Marketplace distances are measured from Zürich.

## Photos

Materials without a camera photo (sample data, sample listings) use flat illustrations. To use real photos,
put JPEGs in `public/samples/` named after the category: `bricks`, `concrete`, `wood`, `windows`, `doors`,
`tiles`, `stone`, `steel` (for example `public/samples/bricks.jpg`), and `hero.jpg` for the home screen. They are
picked up automatically. Real scans always show the camera crop.

## Backend contract

Field names may also be camelCase; they are normalised in `src/lib/api.js`, the only file to change if your API
differs.

### `POST /detect`

Called about every 600 ms in Video mode, and once per picture in Photo mode or from the gallery. `multipart/form-data`
with `frame` (JPEG, at most 640 px wide), `scan_id`, `frame_index`.

```json
{
  "objects": [
    {
      "id": "brick-2",
      "label": "bricks",
      "box": { "x": 0.31, "y": 0.12, "w": 0.34, "h": 0.5 },
      "quantity": 40,
      "unit": "pc",
      "material": "clay",
      "confidence": 0.88
    }
  ],
  "doors": [
    { "id": "door-3", "box": { "x": 0.1, "y": 0.1, "w": 0.3, "h": 0.7 },
      "width_cm": 91.2, "height_cm": 203.8, "material": "wood", "confidence": 0.93 }
  ]
}
```

- Both lists are optional and are merged. Entries in `doors` need no `label` (they are labelled `doors`), so a
  backend that only detects doors keeps working unchanged.
- `label` is matched to `bricks`, `concrete_beams`, `wooden_beams`, `window_frames`, `doors`, `floor_tiles` or
  `stone_slabs` (singular forms and spaces are accepted). Any other label is kept and shown as it is.
- `id` must stay the same for the same physical item across frames, so tracking happens on the backend. The app keeps
  one entry per `id` and the reading with the highest confidence, unless the person corrected it by hand.
- `quantity` defaults to 1. `unit` is `pc` or `m2` (floor tiles and stone slabs are areas).
- `box` is normalised to the frame (0 to 1), origin top left. `width_cm` / `height_cm` are only used for doors.

### `POST /scans`

Called when the report is generated. JSON body:

```json
{
  "id": "uuid",
  "site": "Scan 20 Sep 2026, 10:04",
  "started_at": "2026-09-20T10:02:11.000Z",
  "finished_at": "2026-09-20T10:14:40.000Z",
  "objects": [
    { "id": "brick-2", "label": "bricks", "quantity": 40, "unit": "pc", "width_cm": null, "height_cm": null,
      "material": "clay", "condition": "good", "confidence": 0.88, "image": "data:image/jpeg;base64,..." }
  ],
  "doors": [ { "id": "door-3", "label": "doors", "width_cm": 91.2, "height_cm": 203.8, "material": "wood" } ]
}
```

`objects` holds every item; `doors` repeats the doors in the older shape so an existing backend keeps storing them.
`condition` is `good`, `fair`, `poor` or `null`. Saving the same `id` again replaces the earlier save.

### `GET /scans` and `DELETE /scans/{id}`

`GET` returns saved scans, newest first, as an array or `{ "scans": [...] }`, each in the shape above plus
`created_at`. `DELETE` returns `204`, or `404` if the scan does not exist. Errors of the form `{ "detail": "..." }`
are shown to the person. The backend must allow CORS from your Vercel domain.

## Deploy to Vercel

1. Push this folder to a Git repository and import it in Vercel. The Vite preset is detected automatically.
2. Add the environment variable `VITE_API_URL` (your backend's base URL, no trailing slash).
3. Deploy. Variables prefixed `VITE_` are baked in at build time, so redeploy after changing them.

The app uses hash routes (`#/report`), so no rewrite rules are needed.

## Where things are

| Path | What it does |
| --- | --- |
| `src/App.jsx` | Session state, save, and the routes |
| `src/components/Scanner.jsx` | Camera: Photo/Video, shutter, gallery, flip, Finish |
| `src/components/DetectedItems.jsx`, `ItemSheet.jsx` | Label-and-count list and the editor for one label |
| `src/components/Report.jsx` | Reuse Report and PDF export button |
| `src/components/Market.jsx`, `market/` | Marketplace, cards, filter sheet |
| `src/components/MapScreen.jsx` | Map of material sources |
| `src/components/Scans.jsx` | Saved scans |
| `src/hooks/useScanLoop.js` | Frame capture and detection requests |
| `src/lib/materials.js` | Material catalog: names, units, prices and CO₂ factors (estimates) |
| `src/lib/items.js` | Grouping items by label; report totals; sample report |
| `src/lib/market.js`, `sites.js`, `swiss.js` | Sample listings and sources, cantons and cities, filters |
| `src/lib/pdf.js` | The PDF (`jspdf`, loaded only on export) |
| `src/lib/swissMap.js` | Generated map paths (swisstopo, via the `swiss-maps` package) |
| `src/lib/api.js`, `mock.js`, `session.js` | Network calls, demo mode, merging detections |
