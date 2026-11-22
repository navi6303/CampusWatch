# IITB CampusWatch recovery and test report

21 November 2026. The classroom application runs locally with the included data. Connected-service and field checks are listed separately below.

## Recovered checkpoint

The original routing archive and its uploaded copy had the same SHA-256 digest, `2bf195630393002f6a093bce8ca93f51f53028444e0ae690cb21c307ef9de993`. Every archived file matched the original extracted routing project. The older base archive is a separate, earlier deliverable.

The interrupted working copy differed from that routing project in exactly four source/data files. Its two new files were `gis/prepare_caution.py` and `public/data/lakeside-zones.geojson`. Its edited files were `src/routing.js` and `src/routing-config.js`. They contained shoreline interval penalties, report-ID deduplication, ordered-leg assembly and leg-aware progress. The planner still called the two-point entry point. Its map, tests, documents and production output were the earlier versions. There is no commit log in the recovered project folder that establishes the precise order of the interrupted process. The recovery used these file contents as the checkpoint.

The nine pre-existing tests passed before any project edits. Both earlier ZIPs were retained. The release archive packages the updated working copy, lockfile, GIS exports, SQL migrations, production build, tests, screenshots and setup guide.

## Changes and verification

| Feature | Before | After | Test result |
|---|---|---|---|
| Route selection | Two endpoints in the UI | Search or pick ordered intermediate stops, remove stops, compare routes, edit settings | Browser completed Lecture Hall Complex 3 → Central Library → Hostel 7. Unit checks also covered a four-stop return trip. |
| Network and costs | Two-point coverage, partial multi-leg implementation | Scoring and geometry follow every ordered leg. The comparison includes distance, time, score and approach offsets | Tests check directed access, disconnected or identical approaches, segment continuity, additive costs, and minimum-cost choices on a known network. |
| Lake-side caution | Generated geometry unused by the UI | Mapped band, distance within it, caution notice and admin width selector | Route crossed 90 m in the default 150 m band. Tests verified partial segments in both directions and a route switch when a bypass was available. A local admin change to 250 m persisted. |
| GPS and navigation | Coarse error reporting, two-point progress | Explicit start/retry, accuracy circle, manual fallback, per-leg progress and rerouting with outstanding waypoints | Controlled browser inputs exercised denied, unavailable, timeout, poor accuracy, usable position, deviation, recalculation, waypoint arrival and watch cleanup. Hardware GPS was not accessed. |
| Map interaction | Marker click opened the drawer, with heat and markers mutually exclusive | Anchored report card, protected photo preview, full details, and a combined marker/heatmap view | Opened a verified synthetic report with its private image as demo administrator. Checked public view omitted the image. Reopened the saved complaint and inspected its history. |
| Map rendering | Detailed campus layers at all zoom levels and incident markers drawn individually | Canvas vectors, fewer base layers at low zoom, grouped reports, high-zoom coincident-record chooser and separate GPS overlay | Campus rendered with OSM tiles. Zoom-level grouping and map controls were exercised. No device-wide frame-rate or bandwidth benchmark was performed. |
| Mobile | Compact icon controls and an extended two-point form | Labeled bottom navigation, collapsible planner, touch controls and a map-sized popup | At 390 px viewport width, the inner page measured 375 px with the scrollbar, with no horizontal overflow. The resized card measured 312 px inside a 351 px map. |
| Data and provenance | Basic incident and graph checks | Read-only validation across JSON, GeoJSON and CSV; simulations opt in separately for route scoring | Passed spatial, attribute, unique-ID, reference and source checks for the bundled snapshot. No source geometry or incident seed records required regeneration. |
| Complaints, wildlife and alerts | Existing review queue and announcement workflow | Rejected complaints excluded from candidate groups and open counts. Protected demo wildlife free text, history and attachments omitted from public records | Local demo report with image saved, status and verification edited, history recovered, four-reporter group forwarded, simulated announcement displayed. Wildlife history and caution layer opened. |
| Presentation and load | Original green theme, charts in initial bundle | Specified dark, blue and coral palette, motion preferences, local font fallbacks, charts loaded on demand | Desktop and mobile screenshots captured. Berthold and Recoletta font files were absent. The browser can use local faces and otherwise uses Arial or Georgia. |
| Connected deployment | Baseline Supabase schema and private photo bucket, Vercel config | Additional migration for a constrained shared route-setting row with administrator update policy | SQL and client paths reviewed locally. The new migration, hosted authentication, Storage, RLS and Vercel publication require authorized integration testing. |

## Measured route

The desktop example used daytime settings, the 150 m lake-side band, and both simulation inputs switched off. Timing assumes 74 metres per minute. Times and scores describe the model. They do not establish actual walking conditions.

| Route via Central Library | Network distance | Estimated walk | Model score / 100 | In study band |
|---|---:|---:|---:|---:|
| Lowest modeled risk | 1.27 km | 18 min | 53.0 | 90 m |
| Shortest | 1.26 km | 17 min | 51.0 | 90 m |
| Alternative | 1.26 km | 18 min | 52.9 | 90 m |

The start, library and destination approaches were 22 m, 32 m and 42 m from their selected points. The route excludes those off-network distances. Mapped footpath or sidewalk coverage was 83% on the lowest-cost walk and 76% on the shortest. Both routes used four possible crossing junctions. The network retains eight distinct weakly connected components because the source geometry does not establish links between them.

## Repeatable checks

- `npm test` passed 14 of 14 routing, data and privacy tests.
- `python gis/validate.py` passed using the system Python with GDAL. It checked 614 campus features, 808 walking segments, three lake-side bands, 200 simulated incidents, 150 complaint rows, 100 simulated streetlights and 50 demo identities. It compared CSV/GeoJSON records and incident timestamps, and checked mapped pathway or road placement.
- `npm run build` produced the production files in `dist/`. Vite still warns about the main minified JavaScript chunk exceeding 500 kB. The chart bundle is loaded only when needed.
- The browser checks ran in Chromium. The GPS fixture in `test/device-fixture.html` runs only on the local development server. Its frame blocks hardware geolocation and supplies explicit test events. The synthetic test photo and notice used an isolated demo session.

## Screenshots

- [Three-stop route comparison](screenshots/10-multistop-comparison.jpg)
- [Mobile navigation with a controlled GPS input](screenshots/11-mobile-navigation-fixture.jpg)
- [Administrator incident popup with a simulated attachment](screenshots/12-incident-popup.jpg)

Screenshots numbered 01 through 09 document the earlier release.

## Outstanding checks

An authorized Supabase test project is needed to exercise real email sign-in, a private upload and signed image URL, student versus administrator database access, and the new shared zone setting. Public deployment requires approval. An on-campus walk on physical Android and iOS devices is needed to assess real GPS accuracy, permission prompts and drift. The test snapshot contains no wildlife probabilities, surveyed accessibility or measured lighting condition. GIS file interchange was checked on the bundled exports. Independent QGIS desktop inspection and fresh OSM acquisition were outside this recovery run.
