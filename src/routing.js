import {contains,distance, hazard, wildlife} from './domain.js';
import {routingWeights as defaults} from './routing-config.js';

const day = 86400000;
const point = ([lat,lng,crossing,component]) => ({lat,lng,crossing,component});
const coordinate = ({lat,lng}) => [lat,lng];
const accident = r => r.category === 'Road accident';
const eligible = r => r.verification !== 'Rejected' && r.status !== 'Rejected';
const open = r => eligible(r) && r.status !== 'Resolved';
const recent = (r, now, days) => {
  const age = now - Date.parse(r.occurred_at);
  return age >= 0 && age <= days * day;
};

export function interpolate(a,b,fraction) {
  return {lat:a.lat+(b.lat-a.lat)*fraction,lng:a.lng+(b.lng-a.lng)*fraction};
}

export function project(p,a,b) {
  const scale = Math.cos(p.lat*Math.PI/180);
  const x = (b.lng-a.lng)*scale, y = b.lat-a.lat;
  const denominator = x*x+y*y;
  const fraction = denominator ? Math.max(0,Math.min(1,((p.lng-a.lng)*scale*x+(p.lat-a.lat)*y)/denominator)) : 0;
  const location = interpolate(a,b,fraction);
  return {fraction,location,gap:distance(p,location)};
}

export function snap(network, position, weights=defaults) {
  if(position.nodeId!=null) {
    const id=String(position.nodeId);
    const index=network.edges.findIndex(e=>e.a===id||e.b===id);
    if(index<0) return null;
    const location=point(network.nodes[id]);
    return {index,location,component:location.component,gap:distance(position,location),fraction:network.edges[index].a===id?0:1};
  }
  let nearest;
  network.edges.forEach((edge,index)=>{
    const a=point(network.nodes[edge.a]), b=point(network.nodes[edge.b]);
    const candidate=project(position,a,b);
    if (!nearest || candidate.gap<nearest.gap) nearest={...candidate,index,component:a.component};
  });
  return nearest?.gap<=weights.maxSnapMeters ? nearest : null;
}

export function routeEvidence(reports, now=Date.now()) {
  // An administrative map can hold exact wildlife locations. Routing always uses campus-wide wildlife evidence.
  reports = [...new Map(reports.map(r=>[r.id,r])).values()];
  const general = reports.filter(r => r.verification !== 'Rejected' && r.status !== 'Rejected' && !wildlife(r.category) &&
    !r.approximate && Number.isFinite(r.lat) && Number.isFinite(r.lng));
  return {
    hazards:general.filter(r=>open(r) && (hazard(r.category) || r.category==='General safety issue' || r.severity==='Critical') &&
      recent(r,now,accident(r)?7:30)),
    accidents:general.filter(r=>accident(r) && recent(r,now,90)),
    wildlife:reports.filter(r=>open(r) && wildlife(r.category) && recent(r,now,1))
      .map(({id,category,verification,data_source,severity})=>({id,category,verification,data_source,severity}))
  };
}

function evidenceFor(a,b,r,weights) {
  const nearby=(rows,radius)=>rows.filter(item=>project(item,a,b).gap<=radius);
  const hazards=nearby(r.hazards,weights.hazardRadius);
  const accidents=nearby(r.accidents,weights.accidentRadius);
  return {hazards,accidents,hotspot:accidents.length>=weights.minimumAccidents};
}

function segmentCost(edge,length,evidence,wildlifeCount,night,w) {
  const hazardRisk=evidence.hazards.reduce((sum,r)=>sum+(w.hazard[r.severity]||0)*(r.verification==='Verified'?1:w.reportedFactor),0);
  const light=edge.lighting==='Mapped lit'?0:night?(edge.lighting==='Mapped unlit'?w.lighting.nightUnlit:w.lighting.nightUnknown):edge.lighting==='Unknown'?w.lighting.dayUnknown:0;
  const footpath=w.footpath[edge.footpath] + (['gravel','ground','dirt','sand','mud','unpaved'].includes(edge.surface)?w.roughSurface:0);
  return length*(w.distance+footpath+light+Math.min(1.8,hazardRisk)+
    (evidence.hotspot?w.accidentHotspot:0)+(wildlifeCount?w.wildlifeZone:0));
}

function graphFor(network,start,end,evidence,night,w) {
  const junctions = new Map(Object.entries(network.nodes).map(([id,n])=>[id,point(n)]));
  const adjacency = new Map([...junctions.keys()].map(key=>[key,[]]));
  const splits = new Map();
  function endpoint(snap,id) {
    const {a,b} = network.edges[snap.index];
    if (snap.fraction<1e-6) return a;
    if (snap.fraction>1-1e-6) return b;
    const entries=splits.get(snap.index)||[];
    const same=entries.find(e=>Math.abs(e.fraction-snap.fraction)<1e-6);
    if (same) return same.id;
    entries.push({id,fraction:snap.fraction});
    splits.set(snap.index,entries);
    junctions.set(id,snap.location);
    adjacency.set(id,[]);
    return id;
  }
  const from=endpoint(start,'start'), to=endpoint(end,'end');
  network.edges.forEach((edge,index)=>{
    const ids=[edge.a,...(splits.get(index)||[]).sort((a,b)=>a.fraction-b.fraction).map(x=>x.id),edge.b];
    for (let i=1;i<ids.length;i++) {
      const a=ids[i-1], b=ids[i], p=junctions.get(a), q=junctions.get(b);
      const length=distance(p,q), local=evidenceFor(p,q,evidence,w);
      let lakeMeters=0;
      const ranges=evidence.zone?.properties.intervals[[edge.way,edge.a,edge.b].join('/')];
      if(ranges) {
        const start=junctions.get(edge.a), end=junctions.get(edge.b);
        const lo=project(p,start,end).fraction, hi=project(q,start,end).fraction;
        const covered=ranges.reduce((sum,[left,right])=>sum+Math.max(0,Math.min(hi,right)-Math.max(lo,left)),0);
        lakeMeters=hi>lo ? length*covered/(hi-lo) : 0;
      }
      const base=lakeMeters*(w.lakeside??0)+segmentCost(edge,length,local,evidence.wildlife.length,night,w);
      const link={edge,index,length,local,base,lakeMeters};
      const add=(from,to,finish)=>adjacency.get(from).push({...link,from,to,finish,safety:base+(w.crossing[finish.crossing]||0)});
      if (edge.direction>=0) add(a,b,q);
      if (edge.direction<=0) add(b,a,p);
    }
  });
  return {junctions,adjacency,from,to};
}

class Queue {
  values=[];
  push(item) {
    const a=this.values;
    let i=a.push(item)-1;
    while(i>0) {
      const parent=(i-1)>>1;
      if (a[parent][0]<=item[0]) break;
      a[i]=a[parent];
      i=parent;
    }
    a[i]=item;
  }
  pop() {
    const a=this.values, root=a[0], last=a.pop();
    if (!a.length) return root;
    let i=0, child=1;
    while(child<a.length) {
      if(child+1<a.length && a[child+1][0]<a[child][0]) child++;
      if(last[0]<=a[child][0]) break;
      a[i]=a[child];
      i=child;
      child=i*2+1;
    }
    a[i]=last;
    return root;
  }
}

function dijkstra({from,to,adjacency},weight,blocked) {
  const queue=new Queue(), best=new Map([[from,0]]), previous=new Map();
  queue.push([0,from]);
  while(queue.values.length) {
    const [cost,id]=queue.pop();
    if(cost!==best.get(id)) continue;
    if(id===to) {
      const result=[];
      let cursor=to;
      while(cursor!==from) {
        const link=previous.get(cursor);
        result.push(link);
        cursor=link.from;
      }
      return result.reverse();
    }
    for(const link of adjacency.get(id)) {
      if(link.index===blocked) continue;
      const total=cost+link[weight];
      if(total >= (best.get(link.to)??Infinity)) continue;
      best.set(link.to,total);
      previous.set(link.to,link);
      queue.push([total,link.to]);
    }
  }
  return null;
}

function bearing(a,b) {
  const radians=Math.PI/180;
  return Math.atan2((b.lng-a.lng)*Math.cos((a.lat+b.lat)/2*radians),b.lat-a.lat)/radians;
}

function stepsFor(links,points) {
  const steps=[];
  let offset=0;
  const roadLabel=edge=>edge.name||(edge.highway==='steps'?'the stairs':edge.footpath==='Dedicated'?'the pedestrian path':'the mapped walkway');
  links.forEach((link,i)=>{
    const course = bearing(points[i],points[i+1]);
    const before = i ? bearing(points[i-1],points[i]) : course;
    const angle = (course-before+540)%360-180;
    const road=roadLabel(link.edge);
    const roadChanged=i>0 && road!==roadLabel(links[i-1].edge);
    const turn=Math.abs(angle)>=36;
    if(i===0 || roadChanged || turn) {
      const head=['north','northeast','east','southeast','south','southwest','west','northwest'][Math.round((course+360)%360/45)%8];
      const text=i===0?`Head ${head} along ${road}`:turn?`Turn ${angle>0?'right':'left'} onto ${road}`:`Continue along ${road}`;
      steps.push({text,offset,location:points[i]});
    }
    offset+=link.length;
  });
  steps.push({text:'Arrive at the mapped destination approach',offset,location:points.at(-1)});
  return steps;
}

function describe(links,graph,w) {
  const points=[graph.junctions.get(graph.from),...links.map(link=>link.finish)];
  const total=links.reduce((sum,l)=>sum+l.length,0);
  const cost=links.reduce((sum,l)=>sum+l.safety,0);
  const percent=predicate=>Math.round(100*links.reduce((sum,l)=>sum+(predicate(l.edge)?l.length:0),0)/(total||1));
  const crossings=links.filter(l=>l.finish.crossing).map(l=>({...l.finish,kind:l.finish.crossing}));
  const hazards=[...new Map(links.flatMap(l=>l.local.hazards).map(h=>[h.id,h])).values()];
  const hotspots=links.map((l,i)=>l.local.hotspot?{...interpolate(points[i],points[i+1],.5),count:l.local.accidents.length,
    simulated:l.local.accidents.some(r=>r.data_source==='Synthetic')}:null).filter(Boolean);
  return {links,points,line:points.map(coordinate),total,cost,score:total?100/(1+cost/w.scoreScale):null,
    lakeMeters:links.reduce((sum,l)=>sum+l.lakeMeters,0),
    hotspotMeters:links.reduce((sum,l)=>sum+(l.local.hotspot?l.length:0),0),
    minutes:Math.ceil(total/w.walkingMetersPerMinute),crossings,hazards,hotspots,
    footpath:percent(e=>['Dedicated','Mapped sidewalk'].includes(e.footpath)),
    mappedLit:percent(e=>e.lighting==='Mapped lit'),lightKnown:percent(e=>e.lighting!=='Unknown'),
    steps:stepsFor(links,points),usesStairs:links.some(l=>l.edge.highway==='steps')};
}

const signature = links => links.map(l=>l.from+'>'+l.to).join('|');

function alternative(graph,baseline,shortest,weights) {
  const known=new Set([signature(baseline.links),signature(shortest.links)]);
  const indices=[...new Set(baseline.links.map(l=>l.index))];
  const stride=Math.max(1,Math.floor(indices.length/20));
  const used=new Set(indices);
  let winner;
  for(let i=0;i<indices.length;i+=stride) {
    const candidate=dijkstra(graph,'safety',indices[i]);
    if(!candidate || known.has(signature(candidate))) continue;
    const result=describe(candidate,graph,weights);
    const overlap=candidate.reduce((sum,l)=>sum+(used.has(l.index)?l.length:0),0)/Math.min(baseline.total,result.total);
    if(result.total>shortest.total*weights.alternativeDetour || overlap>=weights.alternativeOverlap) continue;
    if(!winner || result.cost<winner.cost) winner=result;
  }
  return winner;
}

// Search only the directed segments accessible from the exact snapped start.
function reachableApproach(graph,network,requested,start) {
  let closest={...start,gap:distance(start.location,requested)};
  const queue=[graph.from], visited=new Set(queue);
  for(let i=0;i<queue.length;i++) {
    const from=queue[i], origin=graph.junctions.get(from);
    for(const link of graph.adjacency.get(from)) {
      const projected=project(requested,origin,link.finish);
      if(projected.gap<closest.gap) {
        const {a,b}=link.edge;
        const fraction=project(projected.location,point(network.nodes[a]),point(network.nodes[b])).fraction;
        closest={...projected,index:link.index,fraction,component:start.component};
      }
      if(!visited.has(link.to)){visited.add(link.to);queue.push(link.to);}
    }
  }
  return closest;
}

export function calculateRoutes(network,origin,destination,evidence,{night=false,weights=defaults,boundary,startApproach}={}) {
  if(boundary && (!contains(boundary,origin)||!contains(boundary,destination))) throw new Error('Choose points inside the campus boundary.');
  const start=startApproach || snap(network,origin,weights);
  if(!start) throw new Error('Choose a start within '+weights.maxSnapMeters+' m of a mapped walking segment.');
  let end=snap(network,destination,weights);
  let graph=graphFor(network,start,end||start,evidence,night,weights);
  let shortLinks=end&&end.component===start.component?dijkstra(graph,'length'):null;
  const fallback=!shortLinks;
  const reason=!end?'No mapped path within '+weights.maxSnapMeters+' m of this stop.':
    end.component!==start.component?'The selected approach belongs to a separate walking network.':
    'The mapped pedestrian directions do not allow this connection.';
  if(fallback) {
    end=reachableApproach(graph,network,destination,start);
    if(!boundary && end.gap>1500) throw new Error('The selected destination is outside the study network.');
    graph=graphFor(network,start,end,evidence,night,weights);
    shortLinks=dijkstra(graph,'length');
  }
  end={...end,requested:{lat:destination.lat,lng:destination.lng},fallback,reason:fallback?reason:null};
  if(!shortLinks) throw new Error('No mapped walking connection could be established.');
  const safeLinks=dijkstra(graph,'safety');
  const shortest=describe(shortLinks,graph,weights), safest=describe(safeLinks,graph,weights);
  const alternate=alternative(graph,safest,shortest,weights);
  return {start,end,same:signature(shortLinks)===signature(safeLinks),
    routes:[{...safest,id:'safest',title:'Safest available'},{...shortest,id:'shortest',title:'Shortest walking'},...(alternate?[{...alternate,id:'alternative',title:'Alternative'}]:[])]};
}

export function calculateJourney(network,stops,evidence,options={}) {
  const weights=options.weights||defaults;
  if (stops.length < 2 || stops.some(p=>!Number.isFinite(p?.lat)||!Number.isFinite(p?.lng))) throw new Error('Choose a location for every stop.');
  const legs=[];
  for(let i=1;i<stops.length;i++) {
    try {
      legs.push(calculateRoutes(network,stops[i-1],stops[i],evidence,{...options,startApproach:legs.at(-1)?.end}));
    } catch(error) {throw new Error('Leg '+i+' ('+(stops[i-1].name||'map point')+' → '+(stops[i].name||'map point')+'): '+error.message);}
  }
  function combine(parts,id,title) {
    const links=parts.flatMap(p=>p.links);
    const first=parts[0];
    const graph={junctions:new Map([['origin',first.points[0]]]),from:'origin'};
    const route=describe(links,graph,weights);
    let offset=0;
    const ends=[];
    const segments=[];
    const instructions=[];
    parts.forEach((part,i)=>{
      const last=i===parts.length-1;
      if(i && distance(parts[i-1].points.at(-1),part.points[0])>.02) throw new Error('Leg '+(i+1)+' does not begin at the preceding approach.');
      segments.push({index:i,from:stops[i].name||'Map point',to:stops[i+1].name||'Map point',
        line:part.line,total:part.total,approach:legs[i].end});
      for(const instruction of part.steps.slice(0,-1)) instructions.push({...instruction,offset:offset+instruction.offset,leg:i});
      offset+=part.total;
      ends.push(offset);
      instructions.push({text:last?'Arrive at the mapped destination approach':'Reach approach for stop '+(i+1)+' · '+(stops[i+1].name||'Map point'),location:part.points.at(-1),offset,leg:i});
    });
    return {...route,steps:instructions,ends,segments,id,title};
  }
  const safe=legs.map(l=>l.routes[0]), short=legs.map(l=>l.routes[1]);
  const safest=combine(safe,'safest','Lowest modeled risk'), shortest=combine(short,'shortest','Shortest walking');
  const key=r=>r.links.map(l=>l.index+':'+l.from+'>'+l.to).join('|');
  const distinct=new Set([key(safest),key(shortest)]);
  function overlap(a,b) {
    const metres=new Map();
    for(const link of a.links) metres.set(link.index,(metres.get(link.index)||0)+link.length);
    let shared=0;
    for(const link of b.links) {
      const available=metres.get(link.index)||0;
      const common=Math.min(available,link.length);
      shared+=common;metres.set(link.index,available-common);
    }
    return shared/Math.min(a.total,b.total);
  }
  let alternative=null;
  for(const [i,leg] of legs.entries()) for(const variant of leg.routes.slice(1)) {
    const parts=[...safe]; parts[i]=variant;
    const candidate=combine(parts,'alternative','Alternative');
    if(!distinct.has(key(candidate)) && candidate.total<=shortest.total*weights.alternativeDetour &&
        overlap(candidate,safest)<weights.alternativeOverlap && overlap(candidate,shortest)<weights.alternativeOverlap &&
        (!alternative||candidate.cost<alternative.cost)) alternative=candidate;
  }
  return {start:legs[0].start,end:legs.at(-1).end,via:legs.slice(0,-1).map(l=>l.end.location),approaches:legs.map(l=>l.end),viaOffsets:legs.slice(0,-1).map(l=>l.end.gap),
    same:distinct.size===1,routes:[safest,shortest,...(alternative?[alternative]:[])]};
}

export function progress(route,position,leg=0) {
  let offset=0, nearest=null;
  route.links.forEach((link,i)=>{
    const begin=leg>0?route.ends?.[leg-1]||0:0;
    const end=route.ends?.[leg]??Infinity;
    if (offset+link.length<=begin+.001 || offset>=end-.001) {offset+=link.length;return;}
    const p=project(position,route.points[i],route.points[i+1]);
    if(!nearest || p.gap<nearest.gap) nearest={gap:p.gap,offset:offset+p.fraction*link.length};
    offset+=link.length;
  });
  const legSteps=route.ends ? route.steps.filter(s=>s.leg===leg) : route.steps;
  if(!nearest) {
    const endpoint=legSteps.at(-1);
    nearest={gap:distance(position,endpoint.location),offset:endpoint.offset};
  }
  const remaining=Math.max(0,route.total-nearest.offset);
  const next=legSteps.find(step=>step.offset>nearest.offset+8)||legSteps.at(-1);
  return {...nearest,remaining,next,arrived:remaining<18 && nearest.gap<18 && (!route.ends||leg===route.ends.length-1),
    offRoute:nearest.gap>Math.max(30,(position.accuracy||0)+10)};
}

export function recommendation(safe,short,same) {
  if(!safe.total) return 'The selected stops share a mapped approach. There is no distance to walk on the network.';
  if(same) return 'The shortest route also has the lowest modeled walking cost for these settings.';
  const reasons=[];
  if(safe.lakeMeters+5<short.lakeMeters) reasons.push('less distance inside the lake-side caution zone');
  if(safe.footpath>short.footpath) reasons.push('more mapped footpaths or sidewalks');
  if(safe.crossings.length<short.crossings.length) reasons.push('fewer mapped or possible crossings');
  if(safe.mappedLit>short.mappedLit) reasons.push('more distance tagged as lit');
  if(safe.hazards.length<short.hazards.length) reasons.push('fewer nearby hazard reports');
  if(safe.hotspotMeters<short.hotspotMeters) reasons.push('less overlap with accident report clusters');
  return reasons.length ? 'The model favors this route for '+reasons.join(', ')+'.' :
    'The route has a lower combined cost after weighting exposure by segment length, footpaths, lighting, crossings and reports.';
}

// For a non-crossing pair of short segments the minimum is at an endpoint of one segment.
export function nearCautionZone(route,feature,limit=25) {
  if(!route||route.lakeMeters>0||!feature) return false;
  const geometry=feature.geometry;
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  const latitudePad=limit/110000;
  const longitudePad=latitudePad/Math.cos(route.points[0].lat*Math.PI/180);
  for(let i=1;i<route.points.length;i++) {
    const a=route.points[i-1],b=route.points[i];
    const south=Math.min(a.lat,b.lat)-latitudePad,north=Math.max(a.lat,b.lat)+latitudePad;
    const west=Math.min(a.lng,b.lng)-longitudePad,east=Math.max(a.lng,b.lng)+longitudePad;
    for(const rings of polygons) for(const ring of rings) for(let j=1;j<ring.length;j++) {
      const [x,y]=ring[j-1],[u,v]=ring[j];
      if(Math.max(x,u)<west||Math.min(x,u)>east||Math.max(y,v)<south||Math.min(y,v)>north) continue;
      const c={lat:y,lng:x},d={lat:v,lng:u};
      if(Math.min(project(a,c,d).gap,project(b,c,d).gap,project(c,a,b).gap,project(d,a,b).gap)<=limit) return true;
    }
  }
  return false;
}
