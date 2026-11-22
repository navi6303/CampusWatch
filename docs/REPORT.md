# IITB CampusWatch implementation report

## Architecture

React and Vite provide the interface. Leaflet displays OpenStreetMap tiles and bundled GeoJSON. Recharts draws administrative summaries. Python, GeoPandas and Shapely prepare the campus layers and walking graph. The connected application uses Supabase Auth, PostgreSQL and private Storage. PostgreSQL’s native polygon operator validates locations, so the schema needs no PostGIS extension.

| Area | Implementation |
| --- | --- |
| Campus map | Campus outline, buildings, hostels, roads, paths, gates, facilities and water. Layer toggles, local place search, zoom and reset. |
| Report intake | Map point or browser GPS, IST timestamp, category, severity, text and optional image. Boundary validation in the form and database. |
| Wildlife | Dated historical source cards, a generalized campus-area overlay and restricted exact live coordinates. |
| Monitoring | Incident markers, category, date, severity and verification filters, severity-weighted heatmap and statistics. |
| Repeat detection | Same category, 60 m of the anchor report and within 72 hours. At least three distinct reporter IDs. Rejected and resolved records are excluded. Groups remain review candidates. |
| Complaints | Provisional default routing, individual or grouped forwarding, verification, status and per-report history. Forwarding updates the internal queue. |
| Priority | Critical reports and wildlife observations that occurred within one hour of submission enter priority review immediately. Administrators see new entries on refresh or the 15-second polling interval. |
| Alerts | Active and expired announcements. Administrators explicitly attest to verified content before publishing in connected mode. |
| Pedestrian view | Mapped walking paths, unresolved hazard markers and repeat candidate zones in the demo or administrator view. Safe Walking Routes is the main view and compares shortest, lower-modeled-exposure and alternative paths. It includes walking instructions and optional browser GPS. See [Routing methodology](ROUTING.md). |

## Geographic sources and limits

The campus extent comes from [OpenStreetMap relation 8546708](https://www.openstreetmap.org/relation/8546708). Features were downloaded on 21 November 2026 via the [OpenStreetMap Map API](https://api.openstreetmap.org/api/0.6/map?bbox=72.901,19.121,72.922,19.146). Individual records link to the corresponding OSM element. OpenStreetMap data is attributed to its contributors under [ODbL](https://www.openstreetmap.org/copyright). The campus outline is the contributor-mapped boundary. Coverage, feature names and path access can change.

| OSM layer | Features |
| --- | ---: |
| Campus boundary | 1 |
| Buildings | 299 |
| Hostels | 38 |
| Roads | 144 |
| Walking paths | 89 |
| Gates | 20 |
| Facilities | 20 |
| Water | 3 |

The [IIT Bombay contact and campus map page](https://iitb.ac.in/contact-us) and [InstiMap](https://insti.app/map) are reference maps. No independent vector geometry from those maps was added. Roads and paths were clipped to the OSM campus polygon. Water includes nearby features present as polygons in the downloaded area. Unnamed buildings are retained as geometry.

To regenerate the GIS data, download the OSM XML extract using the source URL above, then install `gis/requirements.txt` in a virtual environment and run `python gis/prepare.py campus.osm`. The Overpass query in `gis/campus.overpassql` provides an alternative extraction workflow. Compare source counts after regeneration, since OSM changes. If the boundary changes, regenerate and review the SQL polygon inserts with `python gis/boundary_sql.py`. Use a new migration for an existing database.

## Wildlife provenance

The historical records are published reports or audit observations. An article's date refers to publication. They carry no event coordinates and do not become active alerts.

- Press Trust of India/NDTV, 22 November 2022. A forest team investigated a call about an alleged leopard sighting. [Source](https://www.ndtv.com/mumbai-news/leopard-spotted-inside-iit-bomaby-campus-forest-officials-on-alert-3543965)
- Hindustan Times, 23 April 2020. IIT Bombay’s director described two sighting reports and said forest officials had been notified. [Source](https://www.hindustantimes.com/mumbai-news/iit-b-witnesses-two-sightings-of-leopards-in-24-hours/story-eclaMomRfZ3H0ZyUNrGG1N.html)
- Bombay Natural History Society annual report, 2024–25. Campus fieldwork recorded animal signs indicative of occasional leopard visits. [Source](https://test.bnhs.org/public/pdf_documents/ANNUAL-REPORT-2024-2025-G.pdf)

## Simulation

The 200 reports include 30 wildlife, 40 road accidents, 100 infrastructure complaints and 30 general or other incidents. IDs cycle through 50 synthetic identities. A seeded generator samples real mapped road and pathway geometry within the campus. A four-reporter footpath cluster makes the repeat workflow reproducible. The extra CSVs contain 150 example complaint records and 100 simulated streetlight inventory records. Streetlights are supplied as a GIS exercise dataset.

Synthetic records are labelled in the application and files. They do not represent actual sightings, hazards, infrastructure or incident statistics. The asset photos used during browser testing are test inputs. Connected student reports are identified as `Student_Report`; administrator announcements use `CampusWatch_Admin`.

## Verification of the earlier release

The items below describe the archived baseline. The [resumed implementation and test report](FINAL-AUDIT.md) records the current changes, tests and open verification items.

- `npm test` checks report geometry, counts, provenance, threshold boundaries, reporter deduplication, priority and public redaction.
- The Supabase migration was executed against local PostgreSQL (PGlite) with Supabase Auth and Storage interfaces stubbed. Checks covered assignable roles, report insertion, out-of-campus rejection, history updates, public wildlife redaction and photo-policy boundaries. Managed auth, real bucket uploads, signed URLs and provider-specific authorization require testing against an approved hosted project.
- Chromium browser checks passed for OSM tile and vector rendering, layer toggles, campus search, category and date filters, heatmap, pedestrian mode, GPS location, report submission with a photo, reload persistence, wildlife redaction, charts, grouped forwarding, status changes and history, photo preview, simulated alert publishing, and a 390 px mobile viewport. The browser test used the workspace’s network proxy for OSM tiles. Screenshots show the local demo with simulated records.
- Vercel deployment and public hosting require approval.
