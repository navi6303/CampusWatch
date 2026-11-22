import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {contains,distance} from '../src/domain.js';
import {calculateRoutes,interpolate,progress,routeEvidence} from '../src/routing.js';

const data = file => JSON.parse(readFileSync(new URL('../public/data/'+file,import.meta.url)));
const network=data('walking-network.json');
const campus=data('campus.geojson').features[0].geometry;
const library={lat:19.13406985,lng:72.91510755};
const lectureHall={lat:19.1308018,lng:72.9174967};
const scenarioTime=Date.parse('2026-11-21T12:00:00Z');
const evidence=routeEvidence(data('incidents.json'),scenarioTime);

test('real campus network links stay in campus and have known endpoints and provenance',()=>{
  for(const edge of network.edges) {
    assert.equal(edge.data_source,'OpenStreetMap');
    assert(edge.source_url.includes(edge.way));
    assert.equal(network.nodes[edge.a][3],network.nodes[edge.b][3]);
    for(const id of [edge.a,edge.b]) {
      const [lat,lng]=network.nodes[id];
      assert(contains(campus,{lat,lng}));
    }
  }

});

test('a real campus pair has distinct shortest, safer-by-model and alternative routes',()=>{
  const {routes,same}=calculateRoutes(network,lectureHall,library,evidence,{night:true});
  assert.equal(routes.length,3);
  assert.equal(same,false);
  const [safe,short,alternative]=routes;
  assert(safe.total>short.total);
  assert(safe.cost<short.cost);
  assert(Number(safe.score)>Number(short.score));
  assert.notDeepEqual(alternative.line,safe.line);
  assert.notDeepEqual(alternative.line,short.line);
  for(const route of routes) {
    assert(route.steps[0].text.startsWith('Head'));
    assert.equal(route.steps.at(-1).offset,route.total);
    assert(route.links.every(edge=>edge.safety>=0 && network.edges[edge.index]));
  }
});

test('routing snaps within segments, respects foot direction, and handles bad or disconnected points',()=>{
  const nodes={a:[19.13,72.915,null,0],b:[19.131,72.915,null,0],c:[19.13,72.919,null,1],d:[19.131,72.919,null,1]};
  const edge={a:'a',b:'b',direction:1,footpath:'Dedicated',lighting:'Mapped lit'};
  const graph={nodes,edges:[edge,{...edge,a:'c',b:'d'}]};
  const start={lat:19.1302,lng:72.915}, end={lat:19.1308,lng:72.915};
  const route=calculateRoutes(graph,start,end,evidence).routes[0];
  assert(Math.abs(route.total-distance(start,end))<.1);
  const stationary=calculateRoutes(graph,end,start,evidence);
  assert.equal(stationary.routes[0].total,0);assert.equal(stationary.routes[0].score,null);
  assert(stationary.end.fallback && stationary.end.gap>60);
  const isolated=calculateRoutes(graph,start,{lat:19.1308,lng:72.919},evidence);
  assert(isolated.end.fallback && isolated.end.gap>300);
  assert(isolated.routes.every(r=>r.links.every(l=>l.index===0)));
  assert.throws(()=>calculateRoutes(graph,start,{lat:0,lng:0},evidence),/outside/);
});

test('verified hazard and nighttime inputs raise model costs, with uncertainty kept in the data',()=>{
  const route=calculateRoutes(network,lectureHall,library,{hazards:[],accidents:[],wildlife:[]}).routes[1];
  const midpoint=interpolate(route.points[0],route.points[1],.5);
  const item={...midpoint,id:'one',category:'Waterlogging',severity:'Critical',verification:'Verified',occurred_at:new Date(scenarioTime-60000).toISOString()};
  const withHazard=routeEvidence([item],scenarioTime);
  assert(calculateRoutes(network,lectureHall,library,withHazard).routes[1].cost>route.cost);
  const unverified=routeEvidence([{...item,verification:'Reported'}],scenarioTime);
  assert(calculateRoutes(network,lectureHall,library,unverified).routes[1].cost<calculateRoutes(network,lectureHall,library,withHazard).routes[1].cost);
  assert(calculateRoutes(network,lectureHall,library,{hazards:[],accidents:[],wildlife:[]},{night:true}).routes[1].cost>route.cost);
  const classified=routeEvidence([{...item,category:'Leopard sighting'}, {...item,id:'rejected',verification:'Rejected'}],scenarioTime);
  assert.equal(classified.hazards.length,0);
  assert.equal(classified.wildlife.length,1);
  assert(!('lat' in classified.wildlife[0]));
});

test('progress measures distance remaining and detects meaningful deviation',()=>{
  const route=calculateRoutes(network,lectureHall,library,evidence).routes[0];
  const start=progress(route,{...route.points[0],accuracy:10});
  const end=progress(route,{...route.points.at(-1),accuracy:10});
  assert.equal(start.offRoute,false);
  assert(start.remaining>0);
  assert.equal(end.remaining,0);
  assert.equal(end.arrived,true);
  assert(progress(route,{lat:19.126,lng:72.915,accuracy:10}).offRoute);
});

test('journeys preserve ordered stops, cost, and progress on returning legs',async()=>{
  const {calculateJourney}=await import('../src/routing.js');
  const stops=[lectureHall,library,lectureHall,library];
  const result=calculateJourney(network,stops,evidence,{night:true});
  for(const route of result.routes) {
    assert.equal(route.ends.length,3);
    assert.equal(route.points.length,route.links.length+1);
    for(const [i,legEnd] of route.ends.entries()) {
      assert(i===0 || legEnd>route.ends[i-1]);
      const stop=route.steps.find(s=>s.leg===i&&s.offset===legEnd);
      assert(distance(stop.location,stops[i+1])<85);
    }
    assert(route.links.every((l,i)=>distance(l.finish,route.points[i+1])<.001));
    assert(progress(route,route.points.at(-1),2).arrived);
    assert(!progress(route,route.points.at(-1),0).arrived);
  }
  const individual=stops.slice(1).map((p,i)=>calculateRoutes(network,stops[i],p,evidence,{night:true}));
  for(let i=0;i<2;i++) {
    assert(Math.abs(result.routes[i].cost-individual.reduce((n,leg)=>n+leg.routes[i].cost,0))<1e-7);
    assert(Math.abs(result.routes[i].total-individual.reduce((n,leg)=>n+leg.routes[i].total,0))<1e-7);
  }
  assert.throws(()=>calculateJourney(network,[lectureHall,library,{lat:0,lng:0}],evidence),/Leg 2/);
  assert.throws(()=>calculateJourney(network,[library],evidence),/every stop/);
});

test('shoreline exposure is clipped on partial edges in either direction',()=>{
  const zone=data('lakeside-zones.geojson').features.find(f=>f.properties.width===150);
  const [key,ranges]=Object.entries(zone.properties.intervals).find(([,ranges])=>ranges.some(([a,b])=>b-a>.2&&b-a<.98));
  const edge=network.edges.find(e=>[e.way,e.a,e.b].join('/')===key);
  const local={edges:[{...edge,direction:0}],nodes:{[edge.a]:network.nodes[edge.a],[edge.b]:network.nodes[edge.b]}};
  const pos=id=>({lat:local.nodes[id][0],lng:local.nodes[id][1]});
  const a=pos(edge.a),b=pos(edge.b), expected=ranges.reduce((n,[l,r])=>n+r-l,0)*distance(a,b);
  for(const [from,to] of [[a,b],[b,a]]) {
    const bare=calculateRoutes(local,from,to,evidence).routes[1];
    const weighted=calculateRoutes(local,from,to,{...evidence,zone}).routes[1];
    assert(Math.abs(weighted.lakeMeters-expected)<.01);
    assert(Math.abs(weighted.cost-bare.cost-.8*expected)<.01);
  }
  const [l,r]=ranges[0];
  const mid=interpolate(a,b,(l+r)/2), inside=interpolate(a,b,r);
  if(distance(mid,inside)>2) {
    const weighted=calculateRoutes(local,mid,inside,{...evidence,zone}).routes[1];
    assert(Math.abs(weighted.lakeMeters-weighted.total)<.01);
  }
});

test('duplicate reports count once and restricted wildlife evidence has no point geometry',()=>{
  const duplicate={...lectureHall,id:'same',category:'Road accident',verification:'Verified',severity:'High',status:'Submitted',occurred_at:new Date(scenarioTime).toISOString()};
  const e=routeEvidence([duplicate,duplicate,{...duplicate,id:'two',category:'Leopard sighting'}],scenarioTime);
  assert.equal(e.accidents.length,1); assert.equal(e.hazards.length,1);
  assert.equal(e.wildlife.length,1); assert(!('lat' in e.wildlife[0]));
});

test('a shoreline penalty changes the modeled choice without changing shortest distance',async()=>{
  const {calculateJourney}=await import('../src/routing.js');
  const nodes={a:[19.13,72.915,null,0],b:[19.13,72.916,null,0],c:[19.1303,72.9155,null,0]};
  const edge=(a,b)=>({way:a+b,a,b,direction:0,footpath:'Dedicated',lighting:'Mapped lit',highway:'footway'});
  const graph={nodes,edges:[edge('a','b'),edge('a','c'),edge('c','b')]};
  const stops=[{lat:nodes.a[0],lng:nodes.a[1]},{lat:nodes.b[0],lng:nodes.b[1]}];
  const evidence={hazards:[],accidents:[],wildlife:[]};
  const original=calculateJourney(graph,stops,evidence);
  const [safe,short]=calculateJourney(graph,stops,{...evidence,zone:{properties:{intervals:{'ab/a/b':[[0,1]]}}}}).routes;
  assert(original.same);
  assert.deepEqual(short.line,original.routes[1].line);
  assert.deepEqual(safe.links.map(l=>l.edge.way),['ac','cb']);
  assert(safe.cost<short.cost && safe.total>short.total);
  assert.equal(safe.lakeMeters,0);
  assert(Math.abs(short.lakeMeters-short.total)<.01);
});

test('fallback legs reuse the reachable approach and never bridge off-network gaps',async()=>{
  const {calculateJourney}=await import('../src/routing.js');
  const nodes={a:[19.13,72.915,null,0],b:[19.135,72.915,null,0],c:[19.132,72.916,null,1],d:[19.134,72.916,null,1]};
  const edge=(a,b)=>({a,b,way:a+b,direction:0,footpath:'Dedicated',lighting:'Mapped lit',highway:'footway'});
  const graph={nodes,edges:[edge('a','b'),edge('c','d')]};
  const stops=[{lat:19.13,lng:72.915},{lat:19.132,lng:72.916},{lat:19.134,lng:72.918}];
  const result=calculateJourney(graph,stops,evidence);
  assert(result.approaches.every(a=>a.fallback && a.gap>85));
  for(const r of result.routes) {
    assert(r.line.every(([,lng])=>lng===72.915));
    assert(Math.abs(r.total-distance(stops[0],result.end.location))<.01);
    assert.deepEqual(r.line.at(-1),[result.end.location.lat,result.end.location.lng]);
  }
});

test('real campus buildings use the closest reachable network endpoint when necessary',()=>{
  for(const [name,lat,lng,expected] of [['Central Library',library.lat,library.lng,false],['Hostel 6 B',19.13591705,72.90697555,true],['Hostel 9 A',19.13565655,72.908043,true]]) {
    const result=calculateRoutes(network,lectureHall,{lat,lng},evidence,{boundary:campus});
    assert.equal(result.end.fallback,expected,name);
    if(expected) {
      assert(result.end.gap>50);
      assert(result.routes.every(r=>r.points.at(-1).lng===result.end.location.lng));
      assert(result.routes.every(r=>r.links.every(l=>network.nodes[l.edge.a][3]===result.start.component)));
    }
  }
});
test('near-zone warning distinguishes an adjacent route from a distant or intersecting route',async()=>{
  const {nearCautionZone}=await import('../src/routing.js');
  const geometry={type:'Polygon',coordinates:[[[72.91,19.13],[72.911,19.13],[72.911,19.131],[72.91,19.131],[72.91,19.13]]]};
  const points=[{lat:19.1299,lng:72.9102},{lat:19.1299,lng:72.9108}];
  assert(nearCautionZone({points,lakeMeters:0},{geometry}));
  assert(!nearCautionZone({points:points.map(p=>({...p,lat:19.129})),lakeMeters:0},{geometry}));
  assert(!nearCautionZone({points,lakeMeters:10},{geometry}));
});
