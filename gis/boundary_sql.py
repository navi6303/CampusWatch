"""Print PostgreSQL campus polygons from the prepared campus GeoJSON."""
import json
from pathlib import Path

campus = Path(__file__).resolve().parents[1] / "public/data/campus.geojson"
boundary = json.loads(campus.read_text())["features"][0]["geometry"]
parts = boundary["coordinates"] if boundary["type"] == "MultiPolygon" else [boundary["coordinates"]]
assert all(len(part) == 1 for part in parts), "Handle inner rings before generating SQL."
for polygon in parts:
    ring = ",".join(f"({lng},{lat})" for lng, lat in polygon[0][:-1])
    print(f"insert into private.campus_bounds (shape) values ('({ring})'::polygon);")
