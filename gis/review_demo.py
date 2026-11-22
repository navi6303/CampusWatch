"""Validate, or explicitly correct, the bundled synthetic incident exports using local GIS layers."""
import argparse
import csv
import json
import math
from collections import Counter
from pathlib import Path
from osgeo import ogr, osr

DATA=Path(__file__).resolve().parents[1]/'public/data'
WILDLIFE={'Leopard sighting','Snake or other wildlife'}
CROSSING='Pedestrian crossing hazard'
LEGACY={'Other','General safety issue'}
PATH={'Damaged pedestrian pathway','Waterlogging','Fallen tree'}
SUPPORTED=WILDLIFE|PATH|{CROSSING,'Broken streetlight','Road accident'}

def load(name):
    return json.loads((DATA/name).read_text())

def xy(lng,lat):
    g=ogr.Geometry(ogr.wkbPoint)
    g.AddPoint_2D(lng,lat)
    return g

def crs(code):
    s=osr.SpatialReference()
    s.ImportFromEPSG(code)
    s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return s

class StudyArea:
    def __init__(self):
        self.forward=osr.CoordinateTransformation(crs(4326),crs(32643))
        self.back=osr.CoordinateTransformation(crs(32643),crs(4326))
        layers={}
        for f in load('campus.geojson')['features']:
            shape=self.project(f)
            layers.setdefault(f['properties']['layer'],[]).append(shape)
        self.boundary=layers['Campus boundary'][0]
        self.blocked=layers['Buildings']+layers['Hostels']+layers['Water']
        zone=next(f for f in load('lakeside-zones.geojson')['features'] if f['properties']['width']==150)
        self.habitat=self.project(zone)
        self.lines={'road':layers['Roads'],'path':layers['Walking paths']}
        self.pools={'crossing':[],'wildlife':[],'road':[],'path':[]}
        nodes=load('walking-network.json')['nodes']
        for lat,lng,crossing,_ in nodes.values():
            if crossing:
                p=self.point(lng,lat)
                if self.on_land(p): self.pools['crossing'].append(p)
        for kind,lines in self.lines.items():
            for geom in lines:
                parts=[geom] if geom.GetGeometryName()=='LINESTRING' else list(geom)
                for part in parts:
                    # Reproducible, spaced candidate sites on actual line geometry.
                    count=max(1,math.ceil(part.Length()/18))
                    for i in range(count):
                        p=part.Value((i+.5)*part.Length()/count)
                        if self.on_land(p):
                            self.pools[kind].append(p)
        # Terrestrial habitat candidates span the band independently of the sparse footpath layer.
        west,east,south,north=self.habitat.GetEnvelope()
        for x in range(math.ceil(west),math.ceil(east),24):
            for y in range(math.ceil(south),math.ceil(north),24):
                candidate=xy(x,y)
                if self.habitat.Contains(candidate) and self.on_land(candidate) and self.road_clearance(candidate)>=8:
                    self.pools['wildlife'].append(candidate)
        assert all(self.pools.values())

    def project(self,f):
        g=ogr.CreateGeometryFromJson(json.dumps(f['geometry']))
        g.Transform(self.forward)
        return g

    def point(self,lng,lat):
        p=xy(lng,lat)
        p.Transform(self.forward)
        return p

    def on_land(self,p):
        return self.boundary.Distance(p)<.02 and not any(g.Contains(p) for g in self.blocked)

    def road_clearance(self,p):
        return min(g.Distance(p) for g in self.lines['road'])

    def valid(self,category,p):
        if not self.on_land(p): return False
        if category in WILDLIFE: return self.habitat.Intersects(p) and self.road_clearance(p)>=8
        if category==CROSSING: return min(c.Distance(p) for c in self.pools['crossing'])<=8
        if category=='Broken streetlight': lines=self.lines['road']+self.lines['path']
        else: lines=self.lines['road' if category=='Road accident' else 'path']
        return min(g.Distance(p) for g in lines)<=2

    def replacement(self,category,p,used):
        kind='wildlife' if category in WILDLIFE else 'crossing' if category==CROSSING else 'road' if category in {'Road accident','Broken streetlight'} else 'path'
        candidates=sorted(self.pools[kind],key=p.Distance)
        selected=next(c for c in candidates if (kind,c.GetX(),c.GetY()) not in used)
        used.add((kind,selected.GetX(),selected.GetY()))
        x=selected.Clone()
        x.Transform(self.back)
        return x.GetX(),x.GetY()

def write_csv(name,rows):
    with (DATA/name).open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

def review(apply=False):
    rows=load('incidents.json')
    assert len(rows)==len({r['id'] for r in rows})
    study=StudyArea()
    before={r['id']:dict(r) for r in rows}
    used=set()
    counts=Counter()
    for r in rows:
        assert r['data_source']=='Synthetic', 'This tool only edits the packaged exercise.'
        old=r['category']
        category=CROSSING if old in LEGACY else old
        assert category in SUPPORTED
        p=study.point(r['lng'],r['lat'])
        counts['outside_boundary']+=study.boundary.Distance(p)>.02
        if old!=category:
            counts['legacy_category']+=1
            r.update(category=category,description='Synthetic exercise: pedestrian crossing conflict reported near a mapped road junction.',department='Campus Security')
        if not study.valid(category,p):
            counts['misplaced']+=1
            counts['misplaced '+category]+=1
            r['lng'],r['lat']=study.replacement(category,p,used)
        assert study.valid(category,study.point(r['lng'],r['lat'])),r['id']
        if not r.get('created_at'):
            # The historical simulation had one timestamp. Model submission at event time.
            counts['missing_created_at']+=1
            r['created_at']=r['occurred_at']
        if old!=category or r['lat']!=before[r['id']]['lat'] or r['lng']!=before[r['id']]['lng']:
            counts['unique_category_or_position_corrections']+=1
    changed={r['id']:r for r in rows if r!=before[r['id']]}
    counts.update(total=len(rows),changed=len(changed))
    if apply and changed:
        (DATA/'incidents.json').write_text(json.dumps(rows,indent=2))
        write_csv('incidents.csv',rows)
        fc=load('incidents.geojson')
        assert {f['properties']['id'] for f in fc['features']}==set(before)
        for f in fc['features']:
            r=changed.get(f['properties']['id'])
            if r:
                f['properties'].update(r)
                f['geometry']['coordinates']=[r['lng'],r['lat']]
        (DATA/'incidents.geojson').write_text(json.dumps(fc,ensure_ascii=False,separators=(',',':')))
        with (DATA/'complaints.csv').open(newline='') as f: complaints=list(csv.DictReader(f))
        for c in complaints:
            if c['id'] in changed:
                r=changed[c['id']]
                for key in c: c[key]=r[key]
        write_csv('complaints.csv',complaints)
    return counts

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    print(json.dumps(review(args.apply),indent=2,sort_keys=True))
