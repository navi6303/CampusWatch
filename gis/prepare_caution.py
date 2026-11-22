"""Generate shoreline study bands from OSM relation 8546709 using GDAL 3 and UTM 43N."""
import json
import sys
from pathlib import Path
from xml.etree import ElementTree as ET
from osgeo import ogr, osr

data = Path(__file__).resolve().parents[1] / "public/data"
osm = ET.parse(sys.argv[1]).getroot()
relation = osm.find("relation[@id='8546709']")
nodes = {n.get("id"): (float(n.get("lon")), float(n.get("lat"))) for n in osm.findall("node")}
ring = []
for member in relation.findall("member"):
    assert member.get("role") == "outer"
    way = osm.find("way[@id='%s']" % member.get("ref"))
    refs = [nd.get("ref") for nd in way.findall("nd")]
    if ring and ring[-1] != refs[0]:
        refs.reverse()
    assert not ring or ring[-1] == refs[0]
    ring.extend(refs[1:] if ring else refs)
assert ring[0] == ring[-1]
def crs(code):
    ref = osr.SpatialReference()
    ref.ImportFromEPSG(code)
    ref.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return ref

forward = osr.CoordinateTransformation(crs(4326),crs(32643))
back = osr.CoordinateTransformation(crs(32643),crs(4326))
def metric(geo):
    g = ogr.CreateGeometryFromJson(json.dumps(geo))
    g.Transform(forward)
    return g

lake = metric(dict(type="Polygon", coordinates=[[nodes[r] for r in ring]]))
boundary = metric(json.loads((data/"campus.geojson").read_text())["features"][0]["geometry"])
network = json.loads((data/"walking-network.geojson").read_text())
lines = [metric(f["geometry"]) for f in network["features"]]
features = []
for width in (75,150,250):
    band = boundary.Intersection(lake.Buffer(width)).Difference(lake)
    assert band.IsValid() and band.GetArea() > 0
    intervals = {}
    for feature, line in zip(network["features"], lines):
        if not line.Intersects(band):
            continue
        part = line.Intersection(band)
        chunks = [part] if part.GetGeometryName() == "LINESTRING" else [part.GetGeometryRef(i) for i in range(part.GetGeometryCount())]
        a, b = line.GetPoint_2D(0), line.GetPoint_2D(1)
        dx, dy = b[0]-a[0], b[1]-a[1]
        def fraction(p):
            return max(0, min(1, ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)))
        ranges = [sorted((fraction(c.GetPoint_2D(0)), fraction(c.GetPoint_2D(c.GetPointCount()-1)))) for c in chunks if c.GetGeometryName()=="LINESTRING"]
        if ranges:
            edge = feature["properties"]
            intervals["/".join(edge[k] for k in ("way","a","b"))] = ranges
    band.Transform(back)
    features.append(dict(type="Feature",geometry=json.loads(band.ExportToJson()),
        properties=dict(width=width,intervals=intervals,name="Wildlife Caution Zone – Lake-side Area",data_source="Project_Assumption",
                        source_url="https://www.openstreetmap.org/relation/8546709",
                        boundary_url="https://www.openstreetmap.org/relation/8546708")))
(data/"lakeside-zones.geojson").write_text(json.dumps(dict(type="FeatureCollection",features=features),separators=(",",":")))
print("Campus-clipped bands prepared", [f["properties"]["width"] for f in features])
