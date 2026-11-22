"""Extract a campus walking graph from the same OpenStreetMap XML as prepare.py."""
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET

from shapely.geometry import LineString, shape
from shapely.prepared import prep

data = Path(__file__).resolve().parents[1] / "public/data"
boundary = prep(shape(json.loads((data / "campus.geojson").read_text())["features"][0]["geometry"]))
root = ET.parse(sys.argv[1]).getroot()
nodes = {node.attrib["id"]: node for node in root.findall("node")}
coords = {key: (float(n.attrib["lon"]), float(n.attrib["lat"])) for key, n in nodes.items()}
allowed = {"footway", "pedestrian", "steps", "path", "living_street", "service", "residential",
           "unclassified", "tertiary", "secondary", "primary", "primary_link", "track", "cycleway"}
dedicated = {"footway", "pedestrian", "steps"}
restricted = {"no", "private", "customers", "residents", "permit", "military", "delivery",
              "destination", "agricultural", "forestry", "use_sidepath"}
blocking = {"wall", "fence", "hedge", "block", "turnstile", "stile", "chain"}


def tags(element):
    return {entry.attrib["k"]: entry.attrib["v"] for entry in element.findall("tag")}


def open_to_feet(t):
    return t.get("foot", t.get("access")) not in restricted


def crossing(t):
    if t.get("crossing") in {"no", "informal"}:
        return None if t["crossing"] == "no" else "Unmarked"
    if t.get("highway") != "crossing" and "crossing" not in t and "crossing:markings" not in t:
        return None
    if t.get("crossing") == "traffic_signals" or t.get("crossing:signals") == "yes":
        return "Signal-controlled"
    if t.get("crossing") == "marked" or t.get("crossing:markings") in {"yes", "zebra", "lines"}:
        return "Marked"
    return "Unmarked" if t.get("crossing") == "unmarked" else "Control unknown"


node_tags = {key: tags(node) for key, node in nodes.items()}
graph_nodes = {}
edges = []
neighbors = defaultdict(set)


def add_segment(a, b, edge, direction):
    if coords[a] == coords[b] or not boundary.covers(LineString([coords[a], coords[b]])):
        return
    for key in (a, b):
        graph_nodes.setdefault(key, [coords[key][1], coords[key][0], crossing(node_tags.get(key, {}))])
        stop = node_tags.get(key, {})
        if not open_to_feet(stop) or stop.get("barrier") in blocking and stop.get("foot") not in {"yes", "designated", "permissive"}:
            return
    edges.append(dict(edge, a=a, b=b, direction=direction))
    neighbors[a].add(b)
    neighbors[b].add(a)


for way in root.findall("way"):
    t = tags(way)
    kind = t.get("highway")
    if (kind not in allowed or not open_to_feet(t) or t.get("indoor") == "yes"
            or t.get("access:conditional") or t.get("foot:conditional")
            or kind == "cycleway" and t.get("foot") not in {"yes", "permissive", "designated"}):
        continue
    refs = [n.attrib["ref"] for n in way.findall("nd")]
    way_id = way.attrib["id"]
    side = [t.get(key) for key in ("sidewalk", "sidewalk:both", "sidewalk:left", "sidewalk:right")]
    path = "Dedicated" if kind in dedicated or t.get("foot") == "designated" and kind == "path" else (
        "Mapped sidewalk" if any(v in {"yes", "left", "right", "both"} for v in side) else
        "Shared path" if kind in {"path", "track", "living_street", "cycleway"} else
        "No sidewalk tagged" if "no" in side or "none" in side else "Sidewalk unknown")
    lighting = "Mapped lit" if t.get("lit") in {"yes", "automatic"} else "Mapped unlit" if t.get("lit") == "no" else "Unknown"
    direction = -1 if t.get("oneway:foot") == "-1" else 1 if t.get("oneway:foot") in {"yes", "1", "true"} else 0
    edge = dict(way=way_id, name=t.get("name:en") or t.get("name"), highway=kind,
                footpath=path, lighting=lighting, surface=t.get("surface"), service=t.get("service"),
                data_source="OpenStreetMap", source_url=f"https://www.openstreetmap.org/way/{way_id}")
    # A crossing way without a tagged crossing node gets a midpoint event, without adding a road junction.
    midpoint_index = len(refs) // 2 - 1
    crossing_way = t.get("footway") == "crossing" and t.get("crossing") != "no"
    for i, (a, b) in enumerate(zip(refs, refs[1:])):
        if crossing_way and not any(crossing(node_tags[r]) for r in refs) and i == midpoint_index:
            mid = f"crossing-{way_id}"
            coords[mid] = tuple((x+y)/2 for x, y in zip(coords[a], coords[b]))
            node_tags[mid] = {**t, "highway": "crossing"}
            add_segment(a, mid, edge, direction)
            add_segment(mid, b, edge, direction)
        else:
            add_segment(a, b, edge, direction)

# A branched road junction is a possible crossing exposure, not a mapped crossing.
road_neighbors = defaultdict(set)
for edge in edges:
    if edge["highway"] in {"footway", "pedestrian", "path", "steps", "cycleway", "track"} or edge["service"] in {"driveway", "parking_aisle", "emergency_access"}:
        continue
    a, b = edge["a"], edge["b"]
    road_neighbors[a].add(b)
    road_neighbors[b].add(a)
graph_nodes = {key: graph_nodes[key] for key in neighbors}
for key, node in graph_nodes.items():
    if node[2] is None and len(road_neighbors[key]) >= 3:
        node[2] = "Possible road junction"
components = {}
sizes = Counter()
for start in graph_nodes:
    if start in components:
        continue
    component = len(sizes)
    stack = [start]
    components[start] = component
    while stack:
        current = stack.pop()
        sizes[component] += 1
        for nxt in neighbors[current]:
            if nxt not in components:
                components[nxt] = component
                stack.append(nxt)
for key, n in graph_nodes.items():
    n.append(components[key])

assert edges and len(graph_nodes) > 100
assert all(e["a"] in graph_nodes and e["b"] in graph_nodes for e in edges)
assert all(a < 20 and b > 70 for a, b, *_ in graph_nodes.values())
source = "https://api.openstreetmap.org/api/0.6/map?bbox=72.901,19.121,72.922,19.146"
network = dict(data_source="OpenStreetMap", source_url=source, nodes=graph_nodes, edges=edges)
(data / "walking-network.json").write_text(json.dumps(network, separators=(",", ":")))
geometry = [dict(type="Feature", properties={**e, "component": components[e["a"]]},
                 geometry=dict(type="LineString", coordinates=[coords[e["a"]], coords[e["b"]]])) for e in edges]
(data / "walking-network.geojson").write_text(json.dumps(dict(type="FeatureCollection", features=geometry), separators=(",", ":")))
print(f"{len(graph_nodes)} nodes, {len(edges)} segments, {len(sizes)} components; largest {sizes.most_common(5)}")
print("Footpath:", Counter(e["footpath"] for e in edges), "| Lighting:", Counter(e["lighting"] for e in edges))
print("Crossing indicators:", Counter(n[2] for n in graph_nodes.values() if n[2]))

