import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import L from 'leaflet';
import CampusMap from './Map';
import {contains,distance} from './domain';
import {calculateJourney,nearCautionZone,progress,project,recommendation,routeEvidence} from './routing';
import {useLocation} from './location';
import {routingWeights} from './routing-config';

const empty = [];
const meters = value => value<1000 ? Math.round(value)+' m' : (value/1000).toFixed(2)+' km';
const badge = r => (r.data_source==='Synthetic'?'Simulated · ':'')+r.verification;
const time = value => new Date(value).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'numeric',minute:'2-digit'});


function Places({label,places,value,onChoose,onPick,picking}) {
  const [query,setQuery] = useState('');
  const [open,setOpen] = useState(false);
  const matches=places.filter(p=>p.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0,7);
  const choose=entry=>{onChoose(entry);setQuery('');setOpen(false);};
  return <div className="place-field">
    <label>{label}<input aria-label={label} value={open?query:(value?.name||'')} placeholder="Search campus locations"
      onFocus={()=>{setQuery('');setOpen(true);}} onBlur={e=>{if(!e.currentTarget.parentElement.parentElement.contains(e.relatedTarget))setOpen(false);}}
      onChange={e=>{setQuery(e.target.value);setOpen(true);}} onKeyDown={e=>{
        if(e.key==='Escape')setOpen(false);
        if(e.key==='Enter'&&matches[0]){e.preventDefault();choose(matches[0]);}
      }}/></label>
    {open&&<div className="place-results">{matches.length?matches.map(p=><button key={p.id} onClick={()=>choose(p)}>{p.name}<small>{p.kind}</small></button>):<p>No matching campus places.</p>}</div>}
    <button type="button" className={picking?'primary':'secondary'} onClick={()=>{setOpen(false);onPick();}} aria-pressed={picking}>Pick {label.toLowerCase()} on map</button>
  </div>;
}

function RouteCard({route,selected,onSelect}) {
  if(!route.total) return <p>{route.title} · 0 m on the mapped network. No walk to score.</p>;
  const inferred=route.crossings.filter(c=>c.kind==='Possible road junction').length;
  return <button type="button" className={'route-card '+route.id+(selected?' active':'')} aria-pressed={selected} onClick={onSelect}>
    <span className="route-name">{route.title}<strong aria-label={'Safety score '+route.score.toFixed(1)+' out of 100'}>{route.score.toFixed(1)}<small>/100</small></strong></span>
    <span>{meters(route.total)} · {route.minutes} min</span>
    <span>{route.crossings.length-inferred} mapped crossings · {inferred} possible junctions</span>
    <span>{route.hazards.length} hazard {route.hazards.length===1?'report':'reports'}{route.hazards.some(r=>r.data_source==='Synthetic')?' (includes simulated)':''} · {route.footpath}% mapped footpath or sidewalk</span>
    <span>{meters(route.lakeMeters)} in lake-side caution zone</span>
    <span>{route.mappedLit}% mapped lit · {100-route.lightKnown}% lighting unknown{route.usesStairs?' · Includes stairs':''}</span>
  </button>;
}

export default function Routes({campus,zone,canViewPhotos,reports,alerts,onAlerts,onSelect}) {
  const [network,setNetwork]=useState(null);
  const [loadError,setLoadError]=useState('');
  const [error,setError]=useState('');
  const locator=useLocation();
  const gps=locator.fix;
  const [leg,setLeg]=useState(0);
  const [inspectLeg,setInspectLeg]=useState(null);
  const [detailsOpen,setDetailsOpen]=useState(true);
  const [stops,setStops]=useState([]);
  const [focus,setFocus]=useState(null);
  const lastFix=useRef(null);
  const [start,setStart]=useState(null);
  const [end,setEnd]=useState(null);
  const [picking,setPicking]=useState('start');
  const [night,setNight]=useState(false);
  const [simulation,setSimulation]=useState(false);
  const [plan,setPlan]=useState(null);
  const [editing,setEditing]=useState(true);
  const [selected,setSelected]=useState('safest');
  const [navigation,setNavigation]=useState(false);
  const [step,setStep]=useState(0);
  const [now,setNow]=useState(Date.now);

  useEffect(()=>{
    let active=true;
    fetch('/data/walking-network.json').then(r=>{if(!r.ok)throw new Error();return r.json();})
      .then(n=>{if(active)setNetwork(n);}).catch(()=>{if(active)setLoadError('The campus walking network could not be loaded.');});
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{
    const timer=setInterval(()=>setNow(Date.now()),10000);
    return ()=>clearInterval(timer);
  },[]);
  const boundary=useMemo(()=>campus.features.find(f=>f.properties.layer==='Campus boundary').geometry,[campus]);
  const namedPlaces=useMemo(()=>campus.features.filter(f=>['Hostels','Buildings','Facilities','Gates'].includes(f.properties.layer)&&
    f.properties.name!==f.properties.layer).map(f=>{
      const layer=L.geoJSON(f);
      const center=layer.getBounds().getCenter();
      return {...center,name:f.properties.name,kind:f.properties.layer,id:f.properties.source_url};
    }).sort((a,b)=>a.name.localeCompare(b.name,'en',{numeric:true})),[campus]);
  const places=useMemo(()=>[...namedPlaces,...Object.entries(network?.nodes||{}).map(([id,[lat,lng]])=>({
    name:'Node '+id,id:'node-'+id,nodeId:id,lat,lng,kind:'Walking network node'
  }))],[namedPlaces,network]);
  const evidence=useMemo(()=>routeEvidence(reports.filter(r=>simulation||r.data_source!=='Synthetic'),now),[reports,now,simulation]);
  const current=plan?.routes.find(r=>r.id===selected);
  const nearZone=useMemo(()=>nearCautionZone(current,zone),[current,zone]);
  const evidenceKey=zone?.properties.width+'|'+evidence.hazards.concat(evidence.accidents,evidence.wildlife)
    .map(r=>[r.id,r.verification,r.severity,r.lat,r.lng]).sort().join('|');
  const livePlan=useMemo(()=>{
    if(!current) return empty;
    return evidence.hazards.filter(r=>current.links.some((_,i)=>project(r,current.points[i],current.points[i+1]).gap<=routingWeights.hazardRadius));
  },[current,evidenceKey,reports]);
  const activeAlerts=alerts.filter(a=>!a.expires_at||Date.parse(a.expires_at)>now);
  const hasSimulation=reports.some(r=>r.data_source==='Synthetic');
  const gpsProgress=current&&navigation&&locator.tracking&&gps&&gps.accuracy<=60&&now-gps.timestamp<45000?progress(current,gps,leg):null;
  useEffect(()=>{
    if(!gpsProgress||lastFix.current===gps||gpsProgress.offRoute) return;
    lastFix.current=gps;
    if(leg<current.ends.length-1 && current.ends[leg]-gpsProgress.offset<15 && gpsProgress.gap<15) setLeg(leg+1);
  },[gps,gpsProgress,current,leg]);
  const stepRemaining=current ? Math.max(0,current.total-current.steps[step]?.offset) : 0;
  const remaining=gpsProgress&&!gpsProgress.offRoute?gpsProgress.remaining:stepRemaining;
  const next=gpsProgress&&!gpsProgress.offRoute?gpsProgress.next.text:current?.steps[step]?.text;
  const arrival=now+remaining/routingWeights.walkingMetersPerMinute*60000;
  const highlightedReports=navigation&&gps?evidence.hazards.filter(r=>distance(r,gps)<=120):livePlan;

  const overlay=useMemo(()=>({routes:plan?.same?plan.routes.filter(r=>r.id!==(selected==='shortest'?'safest':'shortest')):plan?.routes||empty,
    selected,inspectLeg,start:plan?.start.location||start,end:plan?.end.location||end,approaches:plan?.approaches,via:plan?.via||stops,routeHazards:livePlan}),[plan,selected,inspectLeg,start,end,stops,livePlan]);

  const clearNavigation=()=>{setNavigation(false);locator.stop();setLeg(0);setStep(0);};
  const choose=useCallback((which,p)=>{
    if(!contains(boundary,p)) {setError('Choose an approach inside the IIT Bombay campus boundary.');return;}
    if(which==='start') setStart(p);
    else if(which==='end') setEnd(p);
    else setStops(previous=>previous.map((item,i)=>i===which?p:item));
    const nextEmpty=stops.findIndex((stop,i)=>!stop&&i!==which);
    setPicking(nextEmpty>=0?nextEmpty:which!=='end'&&!end?'end':null);
    setPlan(null);
    setError('');
  },[boundary,stops,end]);
  const onPick=useCallback(p=>{
    if (picking!==null && !navigation) choose(picking,{lat:p.lat,lng:p.lng,name:'Map point · '+p.lat.toFixed(5)+', '+p.lng.toFixed(5)});
  },[picking,navigation,choose]);

  function useGps() {
    locator.request(false,p=>{
      setFocus([p.lat,p.lng]);
      if(p.accuracy>60){setError('The GPS fix is too coarse for route selection. Pick your start on the map.');return;}
      choose('start',{...p,name:'Current GPS location'});
    });
  }

  function planRoute(from=start,remainingStops=stops) {
    if(!network||!from||!end) return false;
    try {
      const result=calculateJourney(network,[from,...remainingStops,end],{...evidence,zone},{night,boundary});
      setInspectLeg(null);setDetailsOpen(true);setPlan({...result,evidenceKey});setEditing(false);setSelected('safest');setStep(0);setLeg(0);lastFix.current=gps;setError('');setPicking(null);
      return true;
    } catch(e) {setError(e.message);return false;}
  }

  function recalculateFromGps() {
    if(!gpsProgress||!contains(boundary,gps)) {setError('Rerouting requires an accurate, recent GPS fix inside campus.');return;}
    const remainingStops=stops.slice(leg);
    if(planRoute(gps,remainingStops)) {setStart({...gps,name:'Current GPS location'});setStops(remainingStops);}
  }
  function removeStop(index) {
    setStops(previous=>previous.filter((_,i)=>i!==index));setPicking(null);setPlan(null);
  }

  return <>
    <div className="heading"><div><h1>Safe Walking Routes</h1><p>Compare walking routes across IIT Bombay using mapped paths and available safety reports.</p></div></div>
    {(error||loadError)&&<p className="message error" role="alert">{error||loadError}</p>}
    {locator.message&&<p className="message warning" role="status">{locator.message}</p>}
    {!!activeAlerts.length&&<button className="message warning alert-link" onClick={onAlerts}><strong>Safety alerts</strong> {activeAlerts[0].title}{activeAlerts[0].data_source==='Synthetic'?' · Simulated':''}{activeAlerts.length>1?' · '+activeAlerts.length+' active':''}</button>}
    <div className="routing-layout">
      <section className="map-card routing-map">
        <div className="map-toolbar"><strong>{navigation?'Navigation map':picking==='start'?'Select your starting point':picking==='end'?'Select your destination':typeof picking==='number'?'Select stop '+(picking+1):'Campus walking network'}</strong></div>
        <CampusMap campus={campus} zone={zone} canViewPhotos={canViewPhotos} onSelect={onSelect} focus={focus} onPick={picking===null?undefined:onPick} routeOverlay={overlay} gps={gps}/>
        <div className="map-bottom routing-legend">
          <span><i className="dot" style={{background:'#0079b6'}}/> Lowest modeled risk</span>
          <span><i className="dot" style={{background:'#24418c'}}/> Shortest</span>
          <span><i className="dot" style={{background:'#8059a1'}}/> Alternative</span>
          <span><i className="legend-hazard" aria-hidden="true">!</i> Hazard report</span>
          <span><i className="legend-hotspot"/> Accident report cluster</span>
          <span><i className="dot amber"/> Lake-side caution area</span>
          <span><i className="legend-crossing" aria-hidden="true">×</i> Possible or mapped crossing</span>
        </div>
      </section>
      <aside className="route-sidebar">
        {!navigation&&(!plan||editing)&&<section className="panel route-setup"><h2>Plan your walk</h2>
          <Places label="Starting location" places={places} value={start} onChoose={p=>choose('start',p)} onPick={()=>setPicking('start')} picking={picking==='start'}/>
          {stops.map((value,i)=><div className="waypoint" key={i}><Places label={'Stop '+(i+1)} places={places} value={value} onChoose={p=>choose(i,p)} onPick={()=>setPicking(i)} picking={picking===i}/><button className="text-button" onClick={()=>removeStop(i)}>Remove stop {i+1}</button></div>)}
          <button className="secondary" onClick={()=>{setStops([...stops,null]);setPicking(stops.length);setPlan(null);}}>Add intermediate stop</button>
          <Places label="Destination" places={places} value={end} onChoose={p=>choose('end',p)} onPick={()=>setPicking('end')} picking={picking==='end'}/>
          <button className="secondary" onClick={useGps} disabled={locator.busy}>{locator.busy?'Locating…':gps?'Locate again':'Use GPS for start'}</button>
          <label className="route-check"><input type="checkbox" checked={night} onChange={e=>{setNight(e.target.checked);setPlan(null);}}/> Weight lighting for nighttime</label>
          {hasSimulation&&<label className="route-check"><input type="checkbox" checked={simulation} onChange={e=>{setSimulation(e.target.checked);setPlan(null);}}/> Include simulated safety reports</label>}
          <button className="primary" disabled={!network||!start||!end||stops.some(p=>!p)} onClick={()=>planRoute()}>Find walking routes</button>
        </section>}
        {current&&(!navigation?<section className="panel route-results"><h2>Route comparison</h2>
          <p className="itinerary">{[start,...stops,end].map(p=>p?.name||'GPS location').join(' → ')}</p>
          {!editing&&<button className="text-button" onClick={()=>setEditing(true)}>Edit stops and settings</button>}
          <p>{plan.via.length?'Multi-stop walk · '+plan.via.length+(plan.via.length===1?' intermediate stop':' intermediate stops'):'Direct walk · one destination'}</p>
          <button className="secondary" aria-expanded={detailsOpen} onClick={()=>setDetailsOpen(!detailsOpen)}>{detailsOpen?'Collapse route details':'Expand route details'}</button>
          <p className="journey-total">{meters(current.total)} total · {current.minutes} min · {current.segments.length} mapped {current.segments.length===1?'leg':'legs'}</p>
          {detailsOpen&&<div className="leg-panel"><h3>Route legs</h3><ol>{current.segments.map(s=><li key={s.index}><button aria-pressed={inspectLeg===s.index} onClick={()=>setInspectLeg(inspectLeg===s.index?null:s.index)}>
            <strong>Leg {s.index+1} · {s.from} → {s.to}</strong><small>{meters(s.total)} on mapped paths{s.approach.fallback?' · Nearest reachable approach':''}</small></button></li>)}</ol>
            {inspectLeg!==null&&<button className="text-button" onClick={()=>setInspectLeg(null)}>Show whole route</button>}</div>}
          {detailsOpen&&<p>{recommendation(plan.routes[0],plan.routes[1],plan.same)}</p>}
          {simulation&&<span className="tag demo">SIMULATED REPORTS INCLUDED</span>}
          <button className="primary" disabled={!current.total} onClick={()=>{setInspectLeg(null);setNavigation(true);setNow(Date.now());setStep(0);}}>Start Navigation</button>
          {detailsOpen&&plan.routes.map(r=><RouteCard key={r.id} route={r} selected={selected===r.id} onSelect={()=>setSelected(r.id)}/>)}
          {plan.routes.length<3&&<p>No sufficiently distinct alternative was found on the mapped network.</p>}
          <p>Distance and time cover mapped paths. Start offset {meters(plan.start.gap)}.</p>
          {evidenceKey!==plan.evidenceKey&&<button className="secondary" onClick={()=>planRoute()}>Refresh route with current reports</button>}
        </section>:<section className="panel route-results" aria-label="Walking navigation">
          <h2>{current.title} · Navigation</h2>
          <p>{meters(current.total)} total · {current.minutes} min estimated</p>
          <div className="navigation-summary">
            <strong>{meters(remaining)} remaining · ETA {time(arrival)} IST</strong>
            <span>{gpsProgress?.arrived?'Arrived at the mapped approach':next}</span>
            <small>{gpsProgress&&!gpsProgress.offRoute?'GPS estimate':'Estimate based on the selected instruction'}</small>
          </div>
          {current.ends.length>1&&<p>Leg {leg+1} of {current.ends.length}</p>}
          {locator.tracking&&gps&&!gpsProgress&&gps.accuracy<=60&&<p role="status">Waiting for a fresh GPS fix.</p>}
          {gps&&gps.accuracy>60&&<p className="message warning">GPS accuracy is too low to estimate route progress.</p>}
          {gpsProgress?.offRoute&&<div className="message warning">You are about {meters(gpsProgress.gap)} off the route.
            <button className="secondary" onClick={recalculateFromGps}>Recalculate from GPS</button></div>}
          {evidenceKey!==plan.evidenceKey&&<div className="message warning">Safety data or zone settings changed.{gpsProgress&&!gpsProgress.offRoute?<button className="secondary" onClick={recalculateFromGps}>Recalculate with current reports</button>:<span>Use GPS or end navigation to recalculate.</span>}</div>}
          <button className="secondary" disabled={locator.busy} onClick={()=>{let first=true;locator.request(true,p=>{if(first){setFocus([p.lat,p.lng]);first=false;}});}}>{locator.busy?'Locating…':locator.tracking?'Locate again':'Enable live GPS'}</button>
          {locator.tracking&&<button className="text-button" onClick={locator.stop}>Stop GPS</button>}
          <progress aria-label="Journey progress" max={current.total} value={current.total-remaining}/>
          <details open><summary>Walking instructions</summary><ol className="route-steps">{current.steps.map((item,i)=><li key={i} className={(!gpsProgress?step===i:gpsProgress.next===item)?'current-step':''}><button onClick={()=>{setStep(i);if(!locator.tracking)setLeg(item.leg??0);}}>{item.text}<small>{meters(item.offset)} from start</small></button></li>)}</ol></details>
          <button className="secondary" onClick={clearNavigation}>End Navigation</button>
        </section>)}
      </aside>
    </div>
    {plan&&plan.approaches.some(a=>a.gap>2||a.fallback)&&<section className="panel approach-summary"><h2>Final approaches</h2>{plan.approaches.map((a,i)=>(a.gap>2||a.fallback)&&<p key={i}><strong>{i===plan.approaches.length-1?'Destination':'Stop '+(i+1)} · {[...stops,end][i]?.name}</strong><br/>{a.fallback?'Leg '+(i+1)+'. '+a.reason+' The route ends at the nearest reachable path.':'The mapped walk ends at the nearest path approach.'} The selected point is {meters(a.gap)} away in a straight line. Check the remaining access on site. No walking connection has been established for this gap.</p>)}</section>}
    <div className="two safety">
      <section className="panel"><h2>{navigation&&gps?'Nearby hazards':'Hazards on the selected route'}</h2>
        {nearZone&&<p className="message warning">This route comes within 25 m of the lake-side wildlife caution zone. The boundary is a planning assumption and indicates no current sighting.</p>}
        {current?.lakeMeters>0&&<p className="message warning">This route crosses {meters(current.lakeMeters)} of the lake-side wildlife caution zone. This is an approximate planning area and indicates no current sighting.</p>}
        {!highlightedReports.length&&<p>{current?'No eligible reports matched the displayed area. Coverage is incomplete.':'Choose a route to see nearby reports.'}</p>}
        {highlightedReports.map(r=><button className="report-row" key={r.id} onClick={()=>onSelect(r)}><span>{r.category}<small>{badge(r)}</small></span><span className={['High','Critical'].includes(r.severity)?'tag emergency':'tag'}>{r.severity}</span></button>)}
        {!!evidence.wildlife.length&&<p className="message warning">Campus-wide wildlife report area. {evidence.wildlife.length} recent {evidence.wildlife.length===1?'report':'reports'} ({evidence.wildlife.filter(r=>r.verification==='Verified').length} verified{evidence.wildlife.some(r=>r.data_source==='Synthetic')?', includes simulated reports':''}). Exact locations are restricted.</p>}
      </section>
      <section className="panel"><h2>What the score covers</h2><p>Scores compare modeled exposure for these routes. Current streetlight condition is unavailable. Lighting comes from OSM tags. Possible crossings are inferred from the mapped network.</p>
        <p>A high score does not establish that a route is safe. Follow campus restrictions and posted guidance.</p>
        {navigation&&<p>Navigation estimates progress from browser GPS. Indoor or inaccurate fixes may require manual directions. GPS is used in this page and isn’t saved.</p>}
      </section>
    </div>
  </>;
}
