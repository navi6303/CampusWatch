"""Build campus layers and reproducible demo data from an OSM XML map extract."""
import csv
import json
import random
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from xml.etree import ElementTree

import geopandas as gpd
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import polygonize, unary_union

out = Path(__file__).resolve().parents[1] / "public" / "data"
root = ElementTree.parse(sys.argv[1]).getroot()
nodes = {n.get("id"): (float(n.get("lon")), float(n.get("lat"))) for n in root.findall("node")}
ways = {w.get("id"): w for w in root.findall("way")}
relation = next(r for r in root.findall("relation") if r.get("id") == "8546708")

def coordinates(way):
    return [nodes[n.get("ref")] for n in way.findall("nd")]

boundary = unary_union(list(polygonize([
    LineString(coordinates(ways[m.get("ref")]))
    for m in relation.findall("member") if m.get("role") == "outer"
])))
assert boundary.is_valid and boundary.area > 0

def tags(element):
    return {t.get("k"): t.get("v") for t in element.findall("tag")}

def record(kind, geometry, element):
    properties = tags(element)
    return dict(layer=kind, name=properties.get("name:en") or properties.get("name") or kind,
                data_source="OpenStreetMap", source_url=f"https://www.openstreetmap.org/{element.tag}/{element.get('id')}",
                geometry=geometry)

layers = [record("Campus boundary", boundary, relation)]
for way in ways.values():
    t = tags(way)
    coords = coordinates(way)
    if len(coords) < 2:
        continue
    if "highway" in t:
        kind = "Walking paths" if t["highway"] in ("footway", "path", "pedestrian", "steps") else "Roads"
        shape = LineString(coords).intersection(boundary)
    elif len(coords) >= 4 and coords[0] == coords[-1] and ("building" in t or t.get("natural") == "water"):
        name = t.get("name", "").lower()
        kind = "Water" if t.get("natural") == "water" else "Hostels" if "hostel" in name or t.get("building") == "dormitory" else "Buildings"
        shape = Polygon(coords).buffer(0)
        if kind != "Water" and not boundary.covers(shape.representative_point()):
            continue
        if kind == "Water" and not boundary.buffer(.003).intersects(shape):
            continue
    else:
        continue
    if not shape.is_empty and shape.geom_type in ("Polygon", "MultiPolygon", "LineString", "MultiLineString"):
        layers.append(record(kind, shape, way))
for node in root.findall("node"):
    t = tags(node)
    shape = Point(nodes[node.get("id")])
    if boundary.buffer(.00015).covers(shape) and (t.get("barrier") == "gate" or t.get("amenity") in ("library", "clinic", "hospital", "canteen", "restaurant", "bank", "post_office")):
        layers.append(record("Gates" if t.get("barrier") == "gate" else "Facilities", shape, node))
gpd.GeoDataFrame(layers, crs="EPSG:4326").to_file(out / "campus.geojson", driver="GeoJSON")
print(Counter(row["layer"] for row in layers))

rng = random.Random(8546708)
categories = ["Leopard sighting", "Snake or other wildlife", "Road accident", "Broken streetlight",
              "Damaged pedestrian pathway", "Waterlogging", "Fallen tree", "Pedestrian crossing hazard"]
departments = ["Security / Wildlife", "Security / Wildlife", "Security / Medical Centre",
               "Electrical / Maintenance", "Estate / Maintenance", "Civil / Estate",
               "Estate / Maintenance", "Campus Security"]
walks = [r["geometry"] for r in layers if r["layer"] == "Walking paths" and r["geometry"].length]
roads = [r["geometry"] for r in layers if r["layer"] == "Roads" and r["geometry"].length]

def sample(category):
    pool = roads if category == 2 else walks
    return rng.choice(pool).interpolate(rng.random(), normalized=True)

now = datetime(2026, 11, 21, 8, tzinfo=timezone.utc)
cluster = sample(4)
rows = []
counts = [14, 16, 40, 35, 35, 18, 12, 30]
for c, count in enumerate(counts):
    for index in range(count):
        grouped = c == 4 and index < 4
        point = cluster if grouped else sample(c)
        assert boundary.buffer(1e-10).covers(point)
        number = len(rows) + 1
        submission_time=(now-timedelta(hours=index if grouped else rng.randint(1, 1500))).isoformat()
        rows.append(dict(id=f"demo-{number}", reporter_id=f"demo-user-{(number-1)%50+1}",
                         category=categories[c], lat=point.y, lng=point.x,
                         occurred_at=submission_time, created_at=submission_time,
                         severity=rng.choice(["Low", "Moderate", "High"]),
                         description=f"Simulated demonstration report {number} · {categories[c]}.",
                         verification=rng.choice(["Reported", "Reported", "Verified", "Rejected"]) if not grouped else "Reported",
                         status=rng.choice(["Submitted", "Pending", "Under review", "Forwarded", "Resolved", "Rejected"]) if not grouped else "Submitted",
                         department=departments[c], group_id="demo-group-1" if grouped else "",
                         data_source="Synthetic", source_url=None))
(out / "incidents.json").write_text(json.dumps(rows, indent=2))
with (out / "incidents.csv").open("w", newline="") as file:
    writer = csv.DictWriter(file, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
points = [dict(row, geometry=Point(row["lng"], row["lat"])) for row in rows]
gpd.GeoDataFrame(points, crs="EPSG:4326").to_file(out / "incidents.geojson", driver="GeoJSON")
print(f"{len(rows)} simulated reports, {len({r['reporter_id'] for r in rows})} demo identities")

def csv_file(name, records):
    with (out / name).open("w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows(records)

streetlights = []
for number in range(1, 101):
    point = rng.choice(roads).interpolate(rng.uniform(.05,.95), normalized=True)
    assert boundary.buffer(1e-10).covers(point)
    streetlights.append(dict(id=f"demo-light-{number}", lng=point.x, lat=point.y,
                             status=rng.choice(["Operational","Operational","Needs inspection"]),
                             data_source="Synthetic", source_url=None))
csv_file("streetlights.csv", streetlights)
gpd.GeoDataFrame([dict(row, geometry=Point(row["lng"],row["lat"])) for row in streetlights],
                 crs="EPSG:4326").to_file(out / "streetlights.geojson", driver="GeoJSON")
csv_file("demo-users.csv", [dict(id=f"demo-user-{n}", data_source="Synthetic", source_url=None)
                           for n in range(1,51)])
csv_file("complaints.csv", [{field: row[field] for field in
                            ["id","category","status","department","group_id","data_source","source_url"]}
                           for row in rows if not row["category"] in ("Leopard sighting","Snake or other wildlife")][:150])

print("After preparing the walking graph and lake zones, run gis/review_demo.py --apply and gis/validate.py before publishing demo data.")
