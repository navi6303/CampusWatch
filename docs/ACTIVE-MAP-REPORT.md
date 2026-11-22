# IITB CampusWatch implementation and test report

The starting working copy matched every file in the preceding release. All 14 existing tests passed before editing. This update retains the walking graph, campus boundary, shoreline geometry, historical public observations and all 200 synthetic incident IDs. The earlier recovery findings remain in `docs/FINAL-AUDIT.md`.

## Changes and checks

| Area | Implemented | Observed result |
| --- | --- | --- |
| Walking routes | Try the selected walking path first. If unreachable, choose the closest point on a segment reachable from the start under pedestrian direction rules. Both shortest and lowest modeled risk end at that point. Map the requested stop separately and report the unverified gap. | From Lecture Hall Complex 3, the shortest mapped walk to the approach was 1,177 m for both Hostel 9 A and Hostel 6 B. Their remaining straight-line gaps were 75 m and 160 m. No connector was drawn across either gap. A connected walk via Central Library to Hostel 7 retained both legs and displayed a 90 m caution-zone crossing. |
| Active reports | Use submission time with an inclusive cutoff, default 30 days, configurable from 1 to 365. Exclude resolved and rejected records. Show every applicable reason separately in administrator History. Apply the window to incident markers, heat inputs, counts, recent reports and routing evidence. | In the November 21 demo, 41 reports were active at 30 days and 14 at seven days. Reload preserved the seven-day setting. Resolving a report in an isolated session changed 41 to 40, removed the report from recent results and retained it in History. |
| Wildlife | Keep a public area marker for eligible leopard reports even though their precise locations are withheld. Summarize protected records outside the heatmap. Separate report visibility from the lake-side caution overlay. Warn on crossing or passing within 25 m of the selected zone. | The 30-day demo showed four of 14 leopard reports. The area marker opened a selector for all four. Hiding the wildlife layer removed its markers and counts. The wildlife-only layer supplied zero density points. Road-accident filtering restored the density layer. |
| Symbols and popups | Eight category SVGs and a caution-zone symbol share the legend. Popups show category, event and submission times, status, severity, source and available description. Protected wildlife uses an area description. The source and verification fields are separate. | Browser checks covered a road accident and a protected wildlife collection, switching records, matching icons and legend, heatmap mode and mobile controls. Simulated records carried the Synthetic / Demo Data label. |
| Background updates | Schedule map age changes for the next creation or expiry boundary. Preserve unchanged report data on a connected-feed poll. | The phone popup and selected report stayed open during the background-update check. A regression test checks the precise cutoff, including the first millisecond after expiry. |

The lake-side band is a project caution area. Its warning conveys neither a current sighting nor a verified level of animal activity.

## Synthetic data audit

| Measure | Count |
| --- | ---: |
| Original synthetic incident records checked and retained | 200 |
| Original coordinates outside the campus boundary | 0 |
| Records needing a more plausible category-specific position | 67 |
| Records repositioned | 67 |
| Reclassified within those 67 | 30 |
| Records missing a creation time in the original exercise | 200 |
| Records still failing the bundled spatial rules after correction | 0 |

The 67 positions comprised 14 leopard sightings, 16 other wildlife reports, 30 pedestrian crossing hazards, three streetlight complaints, three damaged-path reports and one fallen tree. The 30 crossing exercises replaced 10 “Other” and 20 “General safety issue” synthetic records. All 40 accident records passed the road check. The historical simulation supplied a single timestamp per incident. Each of the 200 demo records now models submission at its existing event time. No real submission time was inferred.

Validation checked buildings, water, roads, footpaths, mapped or inferred junctions and the campus-clipped lake-side band in projected metres. It reconciled the incident JSON, CSV and GeoJSON and 150 complaint rows. Additional checks covered 100 simulated streetlights, 50 demo identities, 614 campus features, 808 walking segments and three shoreline bands. No record remains flagged for manual correction under these rules. Physical accessibility, habitat suitability, actual lamps and marked crossings require field evidence for operational use.

## Verification and remaining work

- All 21 Node regression tests passed. The read-only GIS validator and Vite production build passed. The build retains a bundle-size warning.
- Interactive Chromium checks used the built application and local map vectors at a 1,348 px desktop width and a 390 px phone viewport. They covered connected and disconnected routing, navigation start/end, source labels, the report form, alerts, wildlife history and administrator retention settings. The protected wildlife popup is pictured in `docs/screenshots/14-leopard-area-mobile.jpg`.
- The optional `test/acceptance.py` runner requires an existing Playwright and Chromium installation. This environment blocked its separate Chromium launch. Browser checks above used the available interactive Chromium session.
- The new migration is included for an authorized Supabase environment. Hosted access policies, connected-feed polling, and cross-account behavior need a staging test. Physical-phone GPS, on-site access beyond mapped endpoints and wildlife conditions remain unverified. No new dependencies were installed or services deployed.

## Files changed relative to the starting release

| Area | Files |
| --- | --- |
| Routing | `src/routing.js`, `src/Routes.jsx` |
| Map and report presentation | `src/Map.jsx`, `src/incident-popup.js`, `src/report-icons.js`, `src/style.css` |
| Active records, categories and storage | `src/main.jsx`, `src/domain.js`, `src/visibility.js`, `src/store.js`, `src/AdminCharts.jsx` |
| Database | `supabase/migrations/202611210003_active_reports.sql` |
| GIS and synthetic exports | `gis/prepare.py`, `gis/review_demo.py`, `gis/validate.py`, `public/data/incidents.json`, `public/data/incidents.csv`, `public/data/incidents.geojson`, `public/data/complaints.csv` |
| Tests | `test/routing.test.js`, `test/domain.test.js`, `test/visibility.test.js`, `test/acceptance.py`, `test/device-fixture.html` |
| Documentation and build | `README.md`, `docs/ROUTING.md`, this report, the two screenshots listed above, and regenerated production assets and matching changed data in `dist/` |
