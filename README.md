# IITB CampusWatch

IIT Bombay campus mapping, incident reporting and complaint review for an academic GIS project.

## Run the demo

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the local URL printed by Vite. **Campus map** opens first. Open **Safe Walking Routes** to choose a start and a destination by search or map selection. Use **Add intermediate stop** for each place to visit in order. You can also enter “Node” followed by a mapped OSM node ID. Select an entry under **Route legs** to inspect that leg or choose **Show whole route** for the full walk. Choose **Find walking routes**, compare the results, then start navigation. **Edit stops and settings** reopens the planner. For a repeatable classroom walkthrough, see [Routing methodology](docs/ROUTING.md). No account or key is required. Reports, photos, complaint edits and simulated announcements persist in the current browser. Use **Report incident** to submit, **My reports** to review your browser’s submissions and **Administration** to manage complaints and alerts. Choose a report location within the green campus boundary or use GPS. On the campus map, **All data** combines markers with the heatmap. Select a numbered cluster to zoom in, or choose a report at a shared point. Open a marker for details. Uploaded photographs are available in the permitted administrator view.

```sh
npm test
npm run build
```

The active map uses the report submission time. The default window is 30 days. An administrator can set 1–365 days under **Administration → Active report window**. **Complaint queue → History** shows separate reasons for resolved, rejected and aged-out reports. The map legend identifies the eight incident categories. Public wildlife symbols represent areas and are excluded from the density heatmap. The demo report dates are fixed to the November 2026 exercise. The date filter uses India Standard Time. Photos are deliberately limited to 1 MB in the demo because browser storage is limited. Use `http://127.0.0.1:5173/?basemap=offline` on the default development port for the entirely local map. OpenStreetMap basemap tiles require a connection. The bundled campus vectors continue rendering if tiles are unavailable.

## Connect an authorized Supabase project

1. With authorization, use a dedicated Supabase project. Apply `supabase/migrations/202611210001_campuswatch.sql` once via the SQL editor or an approved Supabase migration workflow. It creates the public incident database, roles and policies, a history trigger and a private photo bucket. Apply the subsequent `202611210002_caution_zone.sql` migration to enable shared study-band updates. Then apply `202611210003_active_reports.sql` for creation times on the protected public feed, the shared age setting and the pedestrian crossing category. Also apply `202611210004_student_history.sql` to enable the owner-scoped report history. On an existing deployment, apply only outstanding migrations in numeric order.
2. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the project API settings. Use only the publishable key. Restart Vite.
3. Configure Supabase Auth to return enrolled users to the application origin. The connected app consumes an existing Supabase session. Supply account access through your campus authentication flow or an authorized Supabase email link returning to the app. The public campus map opens immediately.
4. Enroll the intended administrator. Get their user UUID from **Authentication → Users**. In an authorized administrative SQL session run the following, substituting the actual UUID.

   ```sql
   insert into private.campus_admins(user_id)
   values ('ACTUAL-ADMIN-USER-UUID'::uuid);
   ```

5. Verify with two separate signed-in accounts and a signed-out browser. Submit a report with a photo as a student, confirm that another student cannot read it while pending, then verify it as the admin. The public map receives verified reports without descriptions or reporter IDs. Wildlife is generalized to the campus and the public timestamp is rounded to the day. Confirm that only the authorized admin can view full wildlife records and evidence, update complaints and publish announcements.

Demo data is excluded from the connected report list. Live accounts and photos are managed by Supabase. All department assignments are provisional internal queues. The priority flag appears in the administrative queue and the signed-in dashboard refreshes every 15 seconds. Emergency calls and dispatch use IIT Bombay’s established channels.

## Routing, GPS and assessment

Routes follow the OSM walking graph. For a disconnected destination, the planner stops at the nearest point on the walking network reachable from the start. It marks the requested destination separately and reports the straight-line gap. Confirm remaining access on site. Shortest and lowest modeled risk use the same reachable endpoints. The default 150 m lake-side study band can be changed to 75 m or 250 m in Administration. The band is a project assumption about a campus area. Exact wildlife records remain restricted. Simulated reports require opting in when comparing routes.

Location is requested by a button. Use HTTPS on a phone or localhost on the same device, allow the site to access location in browser settings, and enable the device’s location service. A plain HTTP server accessed over a LAN IP can prevent GPS. Poor or missing fixes leave map selection and manual instructions available. An on-campus phone test is still needed.

Run `npm test` for routing and domain regressions. With GDAL’s Python bindings installed, `python gis/validate.py` audits the bundled GIS and tabular exports without modifying them. During local development, `/test/device-fixture.html` provides a 390 px frame and controlled test inputs for the GPS states. The fixture is excluded from the production build. Open `/?basemap=offline` to use bundled vectors without requesting online tiles. For this release, see [the implementation and test report](docs/RELEASE.md). The [earlier recovery report](docs/FINAL-AUDIT.md) records the interrupted project and its original tests.

## Deployment

Use the extracted `iitb-campuswatch` folder as the Vercel Root Directory. Choose **Vite**, **Node.js 24.x**, **npm ci**, **npm run build**, and output directory **dist**. These install and build commands were verified locally on Node 24 with the committed lockfile. The existing `vercel.json` routes map, planner and management URLs to the app entry point. For a local production preview, run `npm run build` followed by `npm exec -- vite preview --host 127.0.0.1` and open `/` on the URL printed by Vite. After approval, import the project into Vercel, use `npm run build`, set the project’s publishable Supabase environment variables for connected use, and add the approved Vercel origin to Supabase Auth. The project does not require a Vercel backend.

## Files

- `src/` React interface, Leaflet rendering, reporting, rules and storage integration.
- `public/data/` QGIS-compatible GeoJSON, CSVs and wildlife sources.
- `gis/` GeoPandas preparation, Overpass query and SQL geometry regeneration.
- `supabase/migrations/` Hosted schema, access controls and complaint audit history.
- `test/` Node regression tests for spatial validation, grouping and redaction.
- `docs/REPORT.md` Architecture, source and testing notes.
- `docs/ROUTING.md` Walking graph preparation, cost formula, navigation behavior and limitations.
- `docs/screenshots/` Browser screenshots of the application.


## Verification

The production build is included in `dist/`. To serve it with only Python installed, run `python -m http.server 8000 --directory dist` from the project folder and start at `http://localhost:8000/?basemap=offline`. For direct URL refreshes such as `/admin`, use the Vite development or preview server, or configure the host for single-page navigation.

Run `npm test` for the graph and application regressions. Run `python gis/validate.py` with GDAL bindings for the spatial checks. After building, `python test/acceptance.py` runs the isolated browser suite where Playwright and Chromium are already available. On an approved local Supabase instance, the SQL role regression in `test/roles.sql` uses existing test account IDs and rolls its changes back.
