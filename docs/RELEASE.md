# IITB CampusWatch implementation and test report

## Changes in this release

Opening the application now shows the existing **Campus safety map**. **Safe Walking Routes** opens the existing planner at `/routes`. The student and administrator login pages, logout controls, global DEMO indicator and animated backgrounds were removed. Report popups still identify synthetic records as **Synthetic / Demo Data**.

In the local workspace, **Report incident**, **My reports** and **Administration** are accessible from the navigation. Local submissions retain their existing owner ID and storage keys. Local administration manages only this browser’s records. On a connected installation, an existing authorized Supabase session is required for reporting and personal history. Administration also requires the database-assigned administrator role. A connected deployment must supply an authorized session from outside the removed login screens.

## Changed files

| Area | Files |
| --- | --- |
| Application | Updated `src/main.jsx`, `src/access.js`, `src/store.js` and `src/style.css`. Moved the existing personal report history from the removed `src/Account.jsx` into `src/MyReports.jsx`. |
| Removed background code | Deleted `src/GradientSurface.jsx`, `src/ShaderScene.jsx`, `src/gradient.css` and the three associated screenshots under `docs/screenshots/cw-shader-*.jpg`. |
| Dependencies and hosting | Updated `package.json`, `package-lock.json` and `vercel.json`. Removed `@shadergradient/react`, `@react-three/fiber` and `three`. The lockfile contains 15 fewer package entries, with identical versions for every retained entry. |
| Tests | Updated `test/access.test.js`, `test/browser-review.html`, `test/frame.html` and `test/device-fixture.html` for direct entry. |
| Documentation and build | Updated `README.md` and `docs/RELEASE.md`. Rebuilt `dist/index.html` and the JavaScript and CSS assets in `dist/assets/`. |

## Verification

| Check | Result |
| --- | --- |
| Landing page | Opened the production build at the root with bundled campus vectors. The campus map, report markers, layers, filters and legend rendered. The global DEMO badge and account controls were absent. Unit tests confirmed that both former login URLs are retired. |
| Map and routes | Both shortest and lower modeled risk routes passed across five viewport sizes. The checks verified joined leg geometry, ordered stop markers and the nearest-path fallback. Moving from portrait to landscape kept both endpoints visible. |
| Reporting and management | Submitted a broken-streetlight complaint with a simulated GPS fix, found it in My reports, verified and resolved it in Administration, and saw Resolved after reopening personal history. Published a local simulated announcement and found it in Safety alerts. |
| Report sources and layers | Opened a protected leopard marker with its source label, switched to the streetlight heatmap, and checked wildlife history, category filtering and alerts. |
| Dependencies, imports and build | A clean offline install from the lockfile, all 27 Node tests, the dependency-tree check and the Vite production build passed. The clean build reproduced the shipped files byte for byte on Node 24.22.3. The main JavaScript bundle still triggers Vite’s size warning. |
| Console | The acceptance suite recorded zero application console errors, uncaught exceptions or unhandled promise rejections. The browser logged one message from its own extension on the separate landing-page check. |
| Data integrity | All 12 files under `public/data/`, their 12 distribution copies, and all four database migrations matched the previous release byte for byte. The read-only GIS validator passed for 614 campus features, 808 walking segments, three shoreline bands, 200 incidents, 150 complaints, 50 synthetic identities and 100 streetlights. |

The local role tests covered guest, student, administrator and expired sessions. Live Supabase, deployment to Vercel and physical-device GPS were outside this local verification. The map tests used bundled vectors, and reporting tests used isolated browser storage.

## Routing cases

Each itinerary starts at Lecture Hall Complex 3. Distances and times shown are for the lower modeled risk option. Every case also exercised shortest routing.

| Browser viewport | Destination and intermediate stops | Result |
| --- | --- | --- |
| 360 × 800 | Central Library, direct | 1 leg, 565 m, 8 min |
| 390 × 844 | Central Library → Hostel 9 A → Hostel 7 | 3 legs, 1.79 km, 25 min. Individual legs were 565 m, 857 m and 371 m. The shortest option showed 1.78 km and 24 min. |
| 430 × 932 | Hostel 9 A, direct selection | 1 leg, 1.25 km, 17 min. The route stopped on the reachable path, with a 75 m gap to the requested point. |
| 768 × 1024 | Central Library → Hostel 6 B → Lecture Hall Complex 3 → Hostel 7 | 4 legs, 3.77 km, 51 min |
| 1280 × 900 | Central Library → Hostel 9 A → Hostel 7 | 3 legs, 1.79 km, 25 min |
| 390 × 844 rotated to 844 × 390 | Central Library, direct | Map resized and both endpoints remained visible. |

## Run locally

After extracting the project, run the following commands from its parent directory.

```sh
cd iitb-campuswatch
npm ci
npm run dev -- --host 127.0.0.1
```

Open the URL printed by Vite. Append `?basemap=offline` to use the included campus vectors without online tiles. From the project directory, run the checks with the commands below.

```sh
npm test
npm run build
python gis/validate.py
python test/acceptance.py
```

The GIS validator requires Python GDAL bindings. The browser runner requires Playwright and Chromium. The same production browser fixture can also run interactively against the built application. The included `dist/` is ready to serve.
