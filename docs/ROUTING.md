# Safe Walking Routes

## Try the academic demo

Start at Lecture Hall Complex 3, add Central Library and Hostel 9 A as intermediate stops and end at Hostel 7. Compare the two primary routes, inspect leg 2, then restore the whole walk. The lower modeled risk example covers 1.79 km in 25 minutes with the default shoreline band and simulated reports off. Its second leg ends at a reachable approach 75 m from Hostel 9 A. Start navigation to see the instructions for each leg.

## Network and sources

- Source geometry is the same [OpenStreetMap API extract](https://api.openstreetmap.org/api/0.6/map?bbox=72.901,19.121,72.922,19.146) and [mapped campus boundary](https://www.openstreetmap.org/relation/8546708) used by CampusWatch. Individual graph edges have an OSM source URL. [IIT Bombay’s maps](https://iitb.ac.in/contact-us) provide a reference for campus names. See [the implementation report](REPORT.md) for acquisition and attribution.
- Edges are pairs of consecutive distinct OSM highway nodes. Graph connections use shared node IDs, preserving topology without making links at geometric intersections or merging nearby paths. A segment must be fully covered by the campus boundary. Routes honor mapped `oneway:foot` and exclude explicit foot prohibitions, restricted access, indoor ways and conditional way access. An explicit pedestrian access tag takes precedence over a general access tag. Campus access can change in practice.
- The snapshot contains 747 nodes, 808 segments and eight weakly connected components. The largest contains 729 nodes. The planner first tests the two selected approaches. If the destination cannot be reached, it traverses the directed network from the start and compares projections onto the reachable segments to find the nearest legal approach. Network edges can be opened in QGIS via `public/data/walking-network.geojson`.
- The start and the initial destination approach use an 85 m snap radius. A valid on-campus destination outside that radius can still use the reachable-path fallback. Distance and time cover only the network route. The map draws the route from the snapped points and the comparison shows the start offset and each remaining approach gap over two metres. Building searches use the center of each mapped feature as the search point. An offset can include buildings or other barriers and is not a suggested off-network path. Stairs are flagged in comparisons.
- The extract contains no mapped crossings inside the routable campus graph. OSM crossing tags are used where present in future extracts. The map distinguishes actual OSM crossing tags from 117 possible crossing junctions inferred from branched road links, excluding driveways, parking aisles and emergency-access ways in that inference. Possible junctions are inferred from the road topology and may lack a marked crossing. Counts can miss crossings and may include junctions where a particular walker would stay on one side.
- Only 17 of the 808 segments carry a mapped lighting value, all tagged lit. There is no current campus-wide survey of streetlight availability or condition in this build. OSM sidewalk tags and dedicated pathways provide footpath evidence. Unknown and explicitly absent sidewalks carry different penalties. The existing synthetic streetlight inventory is available for GIS exercises and is excluded from the route score.
- Route inputs use visible reports from CampusWatch. In Supabase mode, the existing access policies control visibility and the client refreshes every 15 seconds. Latest eligible unverified reports are marked reported and discounted. Visible unresolved infrastructure hazards remain eligible for 30 days and accident hazards for seven days. Accident clustering uses a maximum 90-day event lookback within the active submission window. A segment near three or more non-rejected accident report records within a 65 m buffer is marked a potential hotspot. Report records may refer to the same underlying incident and do not establish accident frequency. Wildlife within the past 24 hours is represented by a campus-wide warning and a common exposure coefficient. Exact wildlife locations are discarded before routing. Active announcements are shown independently because they have no machine-readable geometry.
- The November 2026 demo uses labelled synthetic campus reports and does not represent actual IIT Bombay incidents. The report toggle excludes them from the assessment. No supported data are silently substituted with measured-looking values.

## Scoring

The shortest route minimizes network metres using Dijkstra. The recommended route uses the same graph and minimizes this non-negative cost for each edge. Edit defaults in `src/routing-config.js`.

```text
edge cost = edge metres × (
  0.30 distance baseline
  + footpath penalty + rough surface penalty
  + lighting penalty
  + min(1.8, nearby open hazard severity sum)
  + 0.55 when the edge meets the accident report cluster threshold
  + 0.30 when there is a current campus-wide wildlife report
) + crossing penalty at the arriving node + 0.80 × metres inside the selected shore band
```

| Factor | Defaults |
| --- | --- |
| Footpath availability | Dedicated 0, mapped sidewalk 0.08, shared path 0.24, sidewalk unknown 0.46, explicitly no sidewalk 0.69 |
| Surface | 0.15 for mapped rough or unpaved surfaces |
| Lighting | Mapped lit 0. Unknown 0.05 during the day and 0.32 at night. Mapped unlit 0 during the day and 0.76 at night. |
| Crossings | Signal-controlled 10, marked 17, unmarked 36, control unknown 30, inferred junction 22 equivalent cost units |
| Reported hazards | Search within 30 m. Low 0.14, Moderate 0.28, High 0.55, Critical 1.20. Multiply by 0.55 for unverified reports. |
| Accident report clusters | 0.55 for edges within 65 m of at least three visible accident report records in 90 days |
| Lake-side study band | 0.80 per metre intersecting the selected campus-clipped band, including partial snapped segments. |
| Wildlife | 0.30 campus-wide while an eligible recent report is visible |

The comparison score is `100 / (1 + route total cost / 850)`. It ranks exposure plus distance under these settings. It is neither a calibrated probability nor a safety certification. Scores depend on trip length, map coverage, uncertainty, and the selected evidence scenario. Use them to compare the displayed routes between the same endpoints. The directions assume 74 metres per minute. The time estimate covers the mapped walk at that pace.

An alternative is sought by blocking sampled edges of the lowest-cost route and rerunning Dijkstra. The lowest-cost distinct candidate is shown if its distance is at most 1.65 times the shortest path and it shares less than 92% of the shorter candidate/recommendation length. This bounded search can miss alternatives. If both objectives choose identical geometry the UI shows both results with a shared-route explanation.

## Ordered stops and shoreline geometry

The planner solves each successive pair with the same graph, direction constraints and evidence, then concatenates the traversed segments. Additive cost, distance and crossing penalties include each traversal. Each intermediate stop uses the same fallback as the destination. The next leg starts at the preceding approach. Consecutive stops at the same approach remain in the itinerary as a zero-distance leg. Invalid starts and off-campus points give a leg-specific error. No off-network connection is drawn. The optional third journey combines candidate legs subject to a 1.65 detour limit and less than 92% shared edge length against either primary route. This bounded search does not enumerate every possible itinerary.

The generator uses the Powai Lake outer ring (OSM relation 8546709) and campus boundary (8546708), transforms both to UTM zone 43N, clips 75 m, 150 m and 250 m lake buffers to campus, and removes lake water. Per-edge intervals record the fraction of each walking segment inside the chosen band. Routes intersecting the band show the traversed metres. Routes passing within 25 m of its boundary show a proximity notice. Width is a planning assumption. There is no live animal position, calibrated wildlife probability or observed risk radius in this dataset.

To reproduce the bands, pass a complete OSM XML extract containing the lake relation, its outer member ways and their nodes to `python gis/prepare_caution.py lake.osm` with GDAL Python bindings. The campus bounding-box download alone may omit parts of the lake. The generated bands and intervals are bundled.

## Navigation and verification

Navigation shows a selected route, directional arrows, instructions, distance remaining, estimated arrival, and route hazards and alerts. Manual navigation uses the selected instruction as an approximate position. When enabled, browser GPS updates the location and projects it onto the route. The current leg is tracked separately even when the itinerary returns along a previous leg. The next waypoint advances near its snapped approach (within 15 m of progress and lateral offset). Fixes worse than 60 m or older than 45 seconds are excluded from progress. Recalculation preserves the remaining stops in order. Deviation requires an offset exceeding the larger of 30 m and reported GPS accuracy plus 10 m. Rerouting requires an in-campus fix and is offered as a button. Navigation positions are held in page memory only, and the GPS watch stops on ending navigation or leaving the page. GPS needs a secure origin or localhost. Turn instructions are generated from mapped geometry and can be imprecise at complex junctions.

Run `npm test` and `npm run build`. The regression suite covers real graph endpoint validity, topology and access behaviors, distinct routes, risk factors, and GPS progress calculations. Chromium checks covered place search, manual map selection, results, route lines and arrows, manual directions, browser geolocation permission and simulated fixes, deviation, recalculation, mobile width, and existing CampusWatch workflows. The navigation screenshot uses a browser test location. On-campus field testing and hosted Supabase/Vercel verification are pending.

The checked-in dataset is ready to use. For a deliberate regeneration with the required GIS tools already available, run the following in a separate working copy with both OSM extracts:

```sh
python gis/prepare.py campus.osm
python gis/prepare_routing.py campus.osm
python gis/prepare_caution.py lake.osm
python gis/review_demo.py --apply
python gis/validate.py
```
