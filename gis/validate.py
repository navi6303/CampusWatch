"""Audit the bundled exports read-only. Requires Python with GDAL/OGR."""
import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from osgeo import ogr
from review_demo import review

root = Path(__file__).resolve().parents[1] / 'public/data'
def load(name):
    return json.loads((root / name).read_text())
def csv_rows(name):
    with (root / name).open(newline='') as stream:
        return list(csv.DictReader(stream))
def geom(feature):
    return ogr.CreateGeometryFromJson(json.dumps(feature['geometry']))
def ids(rows):
    assert len({r['id'] for r in rows}) == len(rows)
    return {r['id']: r for r in rows}

features = load('campus.geojson')['features']
campus = geom(next(f for f in features if f['properties']['layer']=='Campus boundary'))
layers = {}
for f in features:
    p = f['properties']
    assert p['data_source']=='OpenStreetMap' and p['source_url'].startswith('https://www.openstreetmap.org/')
    shape = geom(f)
    assert not shape.IsEmpty() and shape.IsValid(), p['source_url']
    layers.setdefault(p['layer'], []).append(shape)

users = ids(csv_rows('demo-users.csv'))
assert len(users)==50 and all(u['data_source']=='Synthetic' for u in users.values())
rows = ids(load('incidents.json'))
cats = ['Leopard sighting','Snake or other wildlife','Road accident','Broken streetlight','Damaged pedestrian pathway','Waterlogging','Fallen tree','Pedestrian crossing hazard']
depts = ['Security / Wildlife','Security / Wildlife','Security / Medical Centre','Electrical / Maintenance','Estate / Maintenance','Civil / Estate','Estate / Maintenance','Campus Security']
def mapped(point, layer):
    assert campus.Distance(point)<1e-9
    assert min(line.Distance(point) for line in layers[layer]) < 1e-8
def check_export(name, records):
    exported = load(name)['features']
    assert len(exported)==len(records)
    assert len({f['properties']['id'] for f in exported})==len(records)
    for f in exported:
        p=f['properties']
        r=records[p['id']]
        assert all(str(p.get(k) or '')==str(v or '') or k in ('lat','lng') for k,v in r.items())
        lng,lat=f['geometry']['coordinates']
        assert abs(lng-float(r['lng']))<1e-10 and abs(lat-float(r['lat']))<1e-10
        assert campus.Distance(geom(f))<1e-8
        if name.startswith('streetlights'): mapped(geom(f),'Roads')
for r in rows.values():
    assert r['data_source']=='Synthetic' and r['reporter_id'] in users and r['category'] in cats
    assert r['department']==depts[cats.index(r['category'])]
    assert r['severity'] in ['Low','Moderate','High','Critical'] and r['verification'] in ['Reported','Verified','Rejected']
    assert r['status'] in ['Submitted','Pending','Under review','Forwarded','Resolved','Rejected']
    event=datetime.fromisoformat(r['occurred_at'])
    assert event<=datetime.fromisoformat(r['created_at'])
    assert event.tzinfo and event<=datetime(2026,11,21,8,tzinfo=timezone.utc)
tabular=ids(csv_rows('incidents.csv'))
assert tabular.keys()==rows.keys()
assert all(str(v or '')==tabular[k][field] for k,r in rows.items() for field,v in r.items())
check_export('incidents.geojson',rows)
lights=ids(csv_rows('streetlights.csv'))
assert len(lights)==100 and all(r['data_source']=='Synthetic' and r['status'] in ['Operational','Needs inspection'] for r in lights.values())
check_export('streetlights.geojson',lights)
complaints=ids(csv_rows('complaints.csv'))
assert len(complaints)==150 and all(all(str(rows[k][field] or '')==v for field,v in c.items()) for k,c in complaints.items())
roads=load('walking-network.json')
edges={(e['way'],e['a'],e['b']):e for e in roads['edges']}
assert len(edges)==len(roads['edges'])
segments=load('walking-network.geojson')['features']
assert len(segments)==len(edges)
for f in segments:
    p=f['properties']
    assert (p['way'],p['a'],p['b']) in edges
    assert geom(f).Difference(campus.Buffer(1e-9)).IsEmpty()
    for coord, node in zip(f['geometry']['coordinates'],(p['a'],p['b']),strict=True):
        assert max(abs(x-y) for x,y in zip(coord,roads['nodes'][node][:2][::-1]))<1e-9
zones=load('lakeside-zones.geojson')['features']
assert [z['properties']['width'] for z in zones]==[75,150,250]
previous=None
for z in zones:
    band=geom(z)
    assert band.IsValid() and band.Difference(campus.Buffer(1e-8)).IsEmpty()
    if previous: assert previous.Difference(band.Buffer(1e-8)).IsEmpty()
    previous=band
    assert z['properties']['data_source']=='Project_Assumption'
    for k,ranges in z['properties']['intervals'].items():
        assert tuple(k.split('/')) in edges and all(0<=lo<=hi<=1 for lo,hi in ranges)
for record in load('wildlife.json'):
    assert record['source_url'].startswith('https://') and record['data_source'] in ['Public_Report','Public_News']
    assert not {'lat','lng'}.intersection(record)
audit=review()
assert audit['changed']==0, audit
print(f'{len(features)} campus features, {len(edges)} walking segments, {len(zones)} shoreline bands.')
print(f'{len(rows)} incidents, {len(complaints)} complaints, {len(users)} demo identities, {len(lights)} streetlights. Cross-format and spatial checks passed.')
