import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateRoutes,calculateJourney,routeEvidence} from '../src/routing.js';
import {distance} from '../src/domain.js';

const data=name=>JSON.parse(readFileSync(new URL('../public/data/'+name,import.meta.url)));
const graph=data('walking-network.json');
const boundary=data('campus.geojson').features[0].geometry;
const options={boundary};
const evidence=routeEvidence([]);
const node=id=>({nodeId:id,lat:graph.nodes[id][0],lng:graph.nodes[id][1],name:'Node '+id});

test('actual routing and graph connectivity cover every mapped node within its component',()=>{
  const neighbors=new Map(Object.keys(graph.nodes).map(id=>[id,[]]));
  const ids=new Set();
  for(const e of graph.edges){
    assert(neighbors.has(e.a)&&neighbors.has(e.b)&&e.a!==e.b);
    const key=[e.way,e.a,e.b].join('/');
    assert(!ids.has(key));ids.add(key);
    assert([-1,0,1].includes(e.direction));
    if(e.direction>=0) neighbors.get(e.a).push(e.b);
    if(e.direction<=0) neighbors.get(e.b).push(e.a);
  }
  let tested=0;
  for(const component of new Set(Object.values(graph.nodes).map(n=>n[3]))){
    const members=Object.keys(graph.nodes).filter(id=>graph.nodes[id][3]===component);
    const seen=new Set([members[0]]), queue=[members[0]];
    for(let i=0;i<queue.length;i++) for(const next of neighbors.get(queue[i])) if(!seen.has(next)){seen.add(next);queue.push(next);}
    assert.deepEqual(seen,new Set(members));
    for(const id of members){
      assert(graph.nodes[id].slice(0,2).every(Number.isFinite));
      assert(neighbors.get(id).length);
      const origin=members[id===members[0]?1:0];
      const route=calculateRoutes(graph,node(origin),node(id),evidence,options);
      assert.equal(route.end.fallback,false,id);
      for(const path of route.routes.slice(0,2)){
        assert.deepEqual(path.line.at(-1),[node(id).lat,node(id).lng]);
        assert(path.total>0);
      }
      tested++;
    }
  }
  assert.equal(tested,Object.keys(graph.nodes).length);
});

test('preserves ordered geometry and totals for four legs across campus, including a disconnected stop',()=>{
  const ids=Object.keys(graph.nodes).filter(id=>graph.nodes[id][3]===0);
  const outside=Object.keys(graph.nodes).find(id=>graph.nodes[id][3]===4);
  const north=ids.reduce((a,b)=>node(a).lat>node(b).lat?a:b);
  const stops=[node(ids[0]),node(north),node(outside),node(ids[250]),node(ids[100])];
  for(const path of calculateJourney(graph,stops,evidence,options).routes){
    assert.equal(path.segments.length,4);
    assert(path.segments[1].approach.fallback);
    const assembled=[path.line[0]];
    let length=0;
    path.segments.forEach((s,i)=>{
      assert.equal(s.from,stops[i].name);assert.equal(s.to,stops[i+1].name);
      assert.deepEqual(s.line[0],assembled.at(-1));
      assembled.push(...s.line.slice(1));length+=s.total;
      assert(distance(s.approach.location,{lat:s.line.at(-1)[0],lng:s.line.at(-1)[1]})<.02);
    });
    assert.deepEqual(assembled,path.line);assert(Math.abs(length-path.total)<1e-6);
  }
});

test('a network destination on the campus perimeter is reached by its node identity',()=>{
  const rings=boundary.type==='MultiPolygon'?boundary.coordinates.flat():boundary.coordinates;
  const main=Object.keys(graph.nodes).filter(id=>graph.nodes[id][3]===0);
  let nearest=null,minimum=Infinity;
  for(const id of main)for(const ring of rings)for(const [lng,lat] of ring){
    const gap=distance(node(id),{lat,lng});
    if(gap<minimum){minimum=gap;nearest=id;}
  }
  assert(minimum<15,'Expected a mapped node near the campus perimeter');
  const walk=calculateJourney(graph,[node(main.find(id=>id!==nearest)),node(nearest)],evidence,options);
  assert(!walk.end.fallback);
  for(const route of walk.routes)assert.deepEqual(route.line.at(-1),graph.nodes[nearest].slice(0,2));
});

test('a repeated intermediate stop keeps its marker and zero-distance leg without aborting later legs',()=>{
  const ids=Object.keys(graph.nodes).filter(id=>graph.nodes[id][3]===0);
  const result=calculateJourney(graph,[node(ids[0]),node(ids[150]),node(ids[150]),node(ids[200])],evidence,options);
  for(const route of result.routes){
    const [first,repeat,last]=route.segments;
    assert.equal(repeat.total,0);assert.equal(repeat.line.length,1);
    assert.deepEqual(first.line.at(-1),repeat.line[0]);assert.deepEqual(last.line[0],repeat.line[0]);
    assert(last.total>0);assert.equal(route.ends[0],route.ends[1]);
  }
});
