import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {contains,groups,urgent,publicDemo} from '../src/domain.js';

const get = file => JSON.parse(readFileSync(new URL('../public/data/'+file,import.meta.url)));
const boundary = get('campus.geojson').features[0].geometry;
const incidents = get('incidents.json');
const cluster = incidents.filter(r=>r.group_id);

test('demo reports have valid geometry, provenance and quantities',()=>{
  assert.equal(incidents.length,200);
  assert.equal(new Set(incidents.map(r=>r.reporter_id)).size,50);
  assert.equal(incidents.filter(r=>r.category==='Road accident').length,40);
  assert(incidents.every(r=>contains(boundary,r)&&r.data_source==='Synthetic'));
  assert(!contains(boundary,{lat:0,lng:0}));
});
test('groups distinct nearby reports in the same time window and source',()=>{
  assert.equal(groups(cluster)[0].count,4);
  assert.equal(groups(cluster.map(r=>({...r,reporter_id:'same'}))).length,0);
  assert.equal(groups(cluster.map((r,i)=>({...r,occurred_at:new Date(i*73*3600000).toISOString()}))).length,0);
  assert.equal(groups(cluster.map((r,i)=>({...r,lat:r.lat+i*.01}))).length,0);
  assert.equal(groups(cluster.map((r,i)=>({...r,data_source:i%2?'Synthetic':'Student_Report'}))).length,0);
  assert.equal(groups(cluster.map((r,i)=>({...r,verification:i%2?'Rejected':'Reported'}))).length,0);
});
test('urgent reports are prioritized independently of groups',()=>{
  assert(urgent({severity:'Critical'}));
  assert(urgent({severity:'Low',category:'Leopard sighting',occurred_at:new Date().toISOString()}));
  assert(!urgent({severity:'Low',category:'Leopard sighting',occurred_at:'2020-01-01'}));
});
test('public demo masks wildlife locations and reporter identities',()=>{
  const report=incidents.find(r=>r.category==='Leopard sighting');
  const visible=publicDemo(report);
  assert(visible.approximate);
  assert.notEqual(visible.lat,report.lat);
  assert(!('reporter_id' in visible));
});
test('closed complaints are excluded and public wildlife detail omits private attachments and free text',()=>{
  assert.equal(groups(cluster.map(r=>({...r,status:'Rejected'}))).length,0);
  const source=incidents.find(r=>r.category==='Leopard sighting');
  const record=publicDemo({...source,photo_path:'private',description:'Exact location in a private note',history:['internal']});
  assert(!('photo_path' in record));assert(!('history' in record));assert.equal(record.description,null);
});
test('every supported category has a distinct SVG symbol, and public wildlife markers use fixed area anchors',async()=>{
  const {categories,wildlifeSymbolPosition}=await import('../src/domain.js');
  const {iconSvg}=await import('../src/report-icons.js');
  assert(!categories.includes('Other'));
  assert.equal(new Set(categories.map(iconSvg)).size,categories.length);
  const first=publicDemo(incidents.find(r=>r.category==='Leopard sighting'));
  const second=publicDemo({...first,lat:0,lng:0,description:'private coordinates'});
  assert.equal(first.lat,null);assert.equal(first.lng,null);
  assert.deepEqual(wildlifeSymbolPosition(first),wildlifeSymbolPosition(second));
  assert.equal(second.description,null);
  const live=publicDemo({...second,data_source:'Student_Report'});
  assert(!live.areaLabel.includes('Lake-side'));
});
