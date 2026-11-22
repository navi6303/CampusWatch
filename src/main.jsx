import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
const AdminCharts=React.lazy(()=>import('./AdminCharts'));
import Routes from './Routes';
import {iconSvg} from './report-icons';
import {archiveReasons,defaultAgeDays,nextVisibilityChange,validAgeDays} from './visibility';
import {useLocation} from './location';
import CampusMap,{colors,defaultLayers} from './Map';
import {categories,severities,statuses,verification,routing,departments,wildlife,urgent,groups,contains,publicDemo} from './domain';
import {supabase,check,fetchState,readLocal,saveLocal,submitReport,photoURL,displayReports} from './store';
import {MyReports} from './MyReports';
import {paths,pageAt,permitted,validSession,localReporterId} from './access';
import './style.css';

const nav = [['Routes','route','Safe Walking Routes'],['Map','map','Campus map'],['Report','plus','Report incident'],['Wildlife','paw','Wildlife'],['Alerts','bell','Safety alerts'],['Mine','grid','My reports'],['Admin','grid','Administration']];
const iconPaths = {route:'M5 7a2 2 0 1 0 0 .1M19 17a2 2 0 1 0 0 .1M5 9v5a3 3 0 0 0 3 3h9m-4-4 4 4-4 4',map:'M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3zm0 0V3m6 18V6',plus:'M12 5v14M5 12h14',paw:'M9 7a2 2 0 1 0 0 .1M15 7a2 2 0 1 0 0 .1M5 12a2 2 0 1 0 0 .1M19 12a2 2 0 1 0 0 .1M8 19c-3-3 1-7 4-7s7 4 4 7c-2 2-3 0-4 0s-2 2-4 0z',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0',grid:'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',shield:'M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z M9 12l2 2 4-4',search:'m21 21-5-5m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',pin:'M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0zm-5 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0z',layers:'m12 3 9 5-9 5-9-5zm9 9-9 5-9-5m18 4-9 5-9-5',arrow:'M5 12h14m-6-6 6 6-6 6',alert:'M12 9v4m0 4h.01M3 19h18L12 3z'};
function Icon({name,size=18}) {return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={iconPaths[name]}/></svg>;}
const date = value => new Date(value).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'});
const activeAlert = alert => !alert.expires_at || Date.parse(alert.expires_at) > Date.now();
const localDate = (value=new Date()) => new Date(value.getTime()+330*60000).toISOString().slice(0,16);
const source = r => r.data_source === 'Synthetic' ? 'Simulated' : r.data_source === 'Student_Report' ? 'Student report' : r.data_source?.replaceAll('_',' ');
const select = (label, values, props) => <label>{label}<select aria-label={label} {...props}>{values.map(v => <option key={v} value={v}>{v}</option>)}</select></label>;

function App() {
  const [page,setPage] = useState(()=>pageAt(location.pathname));
  const [data,setData] = useState(null);
  const [session,setSession] = useState(null);
  const [authReady,setAuthReady]=useState(!supabase);
  const [menu,setMenu]=useState(false);
  const [desktopCompact,setDesktopCompact]=useState(false);
  const [cachedState,setState] = useState({reports:[],alerts:[],admin:false});
  const state=supabase && cachedState.viewer!==(validSession(session)?session.user.id:null) ? {reports:[],alerts:[],admin:false} : cachedState;

  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [selected,setSelected] = useState(null);

  const [demoChanges,setDemoChanges] = useState(() => readLocal('changes',{}));
  const signed=validSession(session);
  const admin = supabase ? signed && state.admin : page === 'Admin';
  const role = !supabase ? 'local' : admin ? 'admin' : signed ? 'student' : 'guest';
  const reporterId = supabase ? session?.user.id : localReporterId;
  const checking=!authReady||!!(supabase&&signed&&cachedState.viewer!==session.user.id&&!error);
  const requireAdmin=()=>{if(!admin || (supabase && !validSession(session))) throw new Error('Administrator access required.');};
  useEffect(()=>{
    const back=()=>{setPage(pageAt(location.pathname));setMenu(false);setSelected(null);setError('');setNotice('');};
    window.addEventListener('popstate',back);return ()=>window.removeEventListener('popstate',back);
  },[]);
  useEffect(()=>{
    if(!session) return;
    const expire=()=>{
      if(validSession(session))return;
      setSession(null);setSelected(null);setNotice('Your campus session has expired.');
    };
    const timer=setTimeout(expire,Math.max(0,session.expires_at*1000-Date.now()+5));
    window.addEventListener('focus',expire);
    return ()=>{clearTimeout(timer);window.removeEventListener('focus',expire);};
  },[session]);
  useEffect(()=>{setSelected(null);},[admin,session?.user.id]);
  const [demoWidth,setDemoWidth]=useState(()=>readLocal('zoneWidth',150));
  const [clock,setClock]=useState(Date.now);
  const [demoAge,setDemoAge]=useState(()=>readLocal('reportAgeDays',defaultAgeDays));
  const configured=supabase?state.reportAgeDays:demoAge;
  const ageDays=validAgeDays(configured)?configured:defaultAgeDays;
  async function changeAge(next) {
    requireAdmin();
    if(!validAgeDays(next)) throw new Error('Enter a whole number from 1 to 365 days.');
    if(supabase) {
      check(await supabase.from('campus_route_settings').update({report_age_days:next}).eq('id',1).select('id').single());
      await refresh();
    } else {saveLocal('reportAgeDays',next);setDemoAge(next);}
    setClock(Date.now());setNotice('Active report window updated.');
  }
  const width=supabase ? state.zoneWidth??150 : demoWidth;
  const zone=data?.zones.features.find(f=>f.properties.width===width);
  async function changeZone(next) {
    requireAdmin();
    if(supabase) {
      check(await supabase.from('campus_route_settings').update({lakeside_width:next}).eq('id',1).select().single());
      await refresh();
    } else {saveLocal('zoneWidth',next);setDemoWidth(next);}
    setNotice('Lake-side study band updated.');
  }

  useEffect(() => {
    Promise.all(['campus.geojson','incidents.json','wildlife.json','lakeside-zones.geojson'].map(async file => {
      const response = await fetch('/data/'+file);
      if (!response.ok) throw new Error('Campus data could not be loaded.');
      return response.json();
    })).then(([campus,demo,history,zones])=>setData({campus,demo,history,zones})).catch(e=>setError(e.message));
    if (!supabase) return;
    const {data:{subscription}} = supabase.auth.onAuthStateChange((event,newSession)=>{
      setSession(validSession(newSession)?newSession:null);setAuthReady(true);
      if(event==='SIGNED_OUT'){setSelected(null);setState({reports:[],alerts:[],admin:false});}
    });
    return () => subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setState({reports:readLocal('reports',[]),alerts:readLocal('alerts',[]),admin:false});
      return;
    }
    setState(await fetchState(session));
  }, [session]);
  useEffect(() => {
    let current = true;
    if (!supabase) {refresh(); return;}
    setState({reports:[],alerts:[],admin:false});
    setSelected(null);
    let loading = false;
    async function load() {
      if (loading) return;
      loading = true;
      try {
        const next = await fetchState(session);
        if (current) setState(previous=>{
          // Keep open map popups when a polling response contains identical reports.
          if(previous.viewer===next.viewer && previous.admin===next.admin &&
              JSON.stringify(previous.reports)===JSON.stringify(next.reports)) {
            return {...next,reports:previous.reports};
          }
          return next;
        });
      } catch (e) {
        if (current) {setState({reports:[],alerts:[],admin:false});setError(e.message||'Could not verify the current account.');}
      } finally {
        loading = false;
      }
    }
    load();
    const timer = setInterval(load, 15000);
    return () => {current=false;clearInterval(timer);};
  }, [session,refresh]);

  const rows = useMemo(() => supabase ? state.reports : [...state.reports,...(data?.demo || []).map(r=>({...r,...demoChanges[r.id]}))], [data,state.reports,demoChanges]);
  useEffect(()=>{
    const due=nextVisibilityChange(rows,ageDays,clock);
    if (!Number.isFinite(due)) return;
    const tick=()=>{if(Date.now()>=due) setClock(Date.now());};
    const timer=setTimeout(()=>setClock(Date.now()),Math.min(2147483647,Math.max(0,due-Date.now())));
    window.addEventListener('focus',tick);
    return ()=>{clearTimeout(timer);window.removeEventListener('focus',tick);};
  },[rows,ageDays,clock]);
  const activeRows=useMemo(()=>rows.filter(r=>!archiveReasons(r,ageDays,clock).length),[rows,ageDays,clock]);
  const publicRows=useMemo(()=>supabase?displayReports(activeRows,admin):admin?activeRows:activeRows.map(publicDemo),[activeRows,admin]);
  const activeGroups=useMemo(()=>groups(activeRows),[activeRows]);
  const navigate=name=>{
    if(location.pathname!==paths[name]) history.pushState(null,'',paths[name]+(new URLSearchParams(location.search).get('basemap')==='offline'?'?basemap=offline':''));
    setPage(name);setMenu(false);setSelected(null);setNotice('');setError('');
  };
  const title = nav.find(([name]) => name === page)?.[2] ?? 'Page unavailable';
  const publicNav=nav.filter(([name])=>name==='Report'||permitted(name,role));
  async function act(callback) {
    setError('');setNotice('');
    try {await callback();return true;}
    catch (e) {setError(e.message || 'The action could not be completed.');return false;}
  }
  async function update(report, patch) {
    requireAdmin();
    if (supabase) check(await supabase.from('incidents').update(patch).eq('id',report.id).select('id').single());
    else {
      const entry = {changed_at:new Date().toISOString(),verification:patch.verification ?? report.verification,status:patch.status ?? report.status,department:patch.department ?? report.department};
      const next = {...patch,history:[...(report.history||[]),entry]};
      if (report.id.startsWith('demo-')) {
        const changes = {...demoChanges,[report.id]:{...demoChanges[report.id],...next}};
        saveLocal('changes',changes);setDemoChanges(changes);
      } else saveLocal('reports',readLocal('reports',[]).map(r=>r.id===report.id?{...r,...next}:r));
    }
  }
  async function publish(alert) {
    requireAdmin();
    if (supabase) check(await supabase.from('safety_alerts').insert(alert));
    else saveLocal('alerts',[{...alert,id:crypto.randomUUID(),created_at:new Date().toISOString(),data_source:'Synthetic'},...readLocal('alerts',[])]);
    await refresh();
    setNotice(supabase ? 'Announcement saved.' : 'Simulated announcement saved.');
  }

  const protectedPage = ['Report', 'Mine', 'Admin'].includes(page);
  return <div className={"shell"+(menu?" menu-open":"")+(desktopCompact?" compact-nav":"")}>
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon"><Icon name="shield" size={24}/></span><div><strong>CampusWatch</strong><small>IIT BOMBAY</small></div></div>
      <nav id="campus-nav" aria-label="Main navigation">{publicNav.map(([name,icon,label])=><button key={name} data-short={name} aria-label={label} aria-current={page===name?'page':undefined} className={page===name?'nav-active':''} onClick={()=>navigate(name)}><Icon name={icon}/><span>{label}</span></button>)}</nav>
      <button className="sidebar-collapse" aria-expanded={!desktopCompact} onClick={()=>setDesktopCompact(!desktopCompact)}>{desktopCompact?'Expand menu':'Collapse menu'}</button>
      {supabase && <div className="sidebar-end"><span className="status-dot"/><span>Connected workspace</span></div>}
    </aside>
    <main>
      <header className="top"><button className="secondary mobile-menu" aria-controls="campus-nav" aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu?'Close menu':'Menu'}</button>
        <span className="breadcrumb">IIT Bombay / {title}</span></header>
      <div className="content" key={page}>
        {supabase&&state.legacyFeed&&<p className="message warning">The connected project needs the active-reports migration to provide creation times. Reports without a creation time are held in administrator history.</p>}
        {error && <p className="message error" role="alert">{error}</p>}
        {notice && <p className="message success" role="status">{notice}</p>}
        {!data || (protectedPage && checking) ? <p className="loading-state" role="status">{!data ? 'Loading campus data…' : 'Checking campus access…'}</p> :
        !permitted(page,role) ? <section className="panel"><h1>Access restricted</h1>
          <p>{page === 'Admin' ? 'This area requires an authorized campus administrator session.' : 'This area requires an active campus account session.'}</p>
          <button className="secondary" onClick={()=>navigate('Map')}>Campus map</button>
        </section> : <>
          {page==='Missing'&&<section className="panel"><h1>Page unavailable</h1><button onClick={()=>navigate('Routes')}>Open walking routes</button></section>}
          {page==='Mine'&&<MyReports key={reporterId} reporterId={reporterId} reports={rows}/>}
          {page==='Routes' && <Routes canViewPhotos={admin} zone={zone} campus={data.campus} reports={publicRows} alerts={state.alerts} onAlerts={()=>navigate('Alerts')} onSelect={setSelected}/>}
          {page==='Map' && <MapPage repeated={activeGroups} {...{data,zone,publicRows,ageDays,admin,setSelected}} onReport={()=>navigate('Report')} onAlerts={()=>navigate('Alerts')} alerts={state.alerts}/>}
          {page==='Report' && <ReportPage data={data} onSave={(report,photo)=>act(async()=>{
            await submitReport(report,photo,session);
            setNotice(urgent(report) ? 'Report saved and flagged for priority review. Contact Campus Security directly for an active incident.' : 'Report submitted for review.');
            try {await refresh();} catch {setError('Report saved. The latest dashboard could not be loaded.');}
          })}/>}
          {page==='Wildlife' && <><Heading title="Wildlife monitoring" text="Campus-wide reports and documented wildlife observations."/>
            <div className="message warning"><Icon name="alert"/> Public wildlife reports use a campus-wide area. If wildlife is nearby, contact Campus Security directly and follow its instructions.</div>
            <section className="panel wildlife-zone"><h2>{zone?.properties.name}</h2><p>The {width} m project study band follows the mapped Powai Lake shoreline inside campus. It describes a planning assumption. Current wildlife activity requires separate verification.</p><CampusMap campus={data.campus} zone={zone}/></section>
            <div className="two"><section className="panel"><h2>Historical observations</h2>{data.history.map(r=><article className="entry" key={r.id}><span className="tag">{r.date} · {source(r)}</span><h3>{r.title}</h3><p>{r.description}</p><a href={r.source_url} target="_blank" rel="noreferrer">Read source ↗</a></article>)}</section>
            <section className="panel"><h2>Sighting reports</h2>{publicRows.filter(r=>wildlife(r.category)).slice(0,40).map(r=><button className="report-row" key={r.id} onClick={()=>setSelected(r)}><span>{r.category}<small>{date(r.occurred_at)} · {source(r)}</small></span><span className="tag">{r.verification}</span></button>)}{!publicRows.some(r=>wildlife(r.category)) && <p>No public sighting reports.</p>}</section></div></>}
          {page==='Alerts' && <><Heading title="Safety alerts" text="Current notices, archived announcements and campus safety information."/><div className="message warning"><Icon name="alert"/> For an active emergency, use IIT Bombay’s emergency contacts. <a href="https://www.iitb.ac.in/contact-us" target="_blank" rel="noreferrer">IIT Bombay contacts ↗</a></div>
            <div className="two">{[true,false].map(active=><section className="panel" key={String(active)}><h2>{active?'Active announcements':'Announcement archive'}</h2>{state.alerts.filter(a=>activeAlert(a)===active).map(a=><article className="entry" key={a.id}><span className="tag">{source(a)}</span><h3>{a.title}</h3><p>{a.body}</p><small>{date(a.created_at)}</small></article>)}{!state.alerts.some(a=>activeAlert(a)===active)&&<p>No announcements in this section.</p>}</section>)}</div>
            <section className="panel safety"><h2>Wildlife safety</h2><p>Give wildlife space, keep others from approaching, and contact Campus Security for instructions. Use the report form after reaching a place where you can submit safely.</p><a href="https://www.iitb.ac.in/contact-us" target="_blank" rel="noreferrer">IIT Bombay contact directory ↗</a></section></>}
          {page==='Admin' && <><Heading title="Administration" text="Review incident reports, route complaints and manage announcements."/>
            <section className="panel zone-setting"><label>Lake-side study band <select aria-label="Lake-side study band" value={width} disabled={supabase&&!state.zoneWritable} onChange={e=>act(()=>changeZone(Number(e.target.value)))}>{[75,150,250].map(w=><option key={w} value={w}>{w} m</option>)}</select></label><p>Changes the campus planning overlay and route weighting.{supabase&&!state.zoneWritable?' Apply the route settings migration to enable updates.':''}</p></section><form className="panel age-setting" onSubmit={e=>{e.preventDefault();const next=Number(new FormData(e.currentTarget).get('days'));act(()=>changeAge(next));}}><label>Active report window (days) <input key={ageDays} name="days" type="number" disabled={supabase&&!validAgeDays(state.reportAgeDays)} required min="1" max="365" step="1" defaultValue={ageDays}/></label> <button className="secondary" disabled={supabase&&!validAgeDays(state.reportAgeDays)}>Save report window</button><p>Age is measured from submission time. Changing this setting preserves report history.{supabase&&!validAgeDays(state.reportAgeDays)?' Apply the active-reports migration to enable updates.':''}</p></form><Admin ageDays={ageDays} clock={clock} rows={rows} repeated={activeGroups} setSelected={setSelected} onPublish={alert=>act(()=>publish(alert))} /></>}
        </>}
      </div>
    </main>
    {selected && <Details key={selected.id} report={selected} admin={admin} actionError={error} close={()=>setSelected(null)} onUpdate={patch=>act(async()=>{
      await update(selected,patch);await refresh();setSelected(null);setNotice('Complaint updated.');
    })} onGroupUpdate={group=>act(async()=>{
      requireAdmin();
      if (supabase) check(await supabase.from('incidents').update({department:group.department,status:'Forwarded'}).in('id',group.ids).select('id'));
      else for (const id of group.ids) {
        const target=rows.find(r=>r.id===id);
        if (target.id.startsWith('demo-')) {
          const changes=readLocal('changes',{});
          const entry={department:group.department,status:'Forwarded',verification:target.verification,changed_at:new Date().toISOString()};
          changes[id]={...changes[id],department:entry.department,status:entry.status,history:[...(target.history||[]),entry]};
          saveLocal('changes',changes);
        } else await update(target,{department:group.department,status:'Forwarded'});
      }
      if (!supabase) setDemoChanges(readLocal('changes',{}));
      await refresh();setSelected(null);setNotice('Related complaints forwarded to the selected queue.');
    })}/>}
  </div>;
}

function Heading({title,text,children}) {
  return <div className="heading"><div><h1>{title}</h1><p>{text}</p></div>{children}</div>;
}

function MapPage({data,zone,publicRows,ageDays,repeated,admin,setSelected,onReport,onAlerts,alerts}) {
  const [layers,setLayers] = useState(defaultLayers);
  const [showZone,setShowZone]=useState(true);
  const [wildlifeVisible,setWildlifeVisible]=useState(true);
  const [mode,setMode] = useState('Markers');
  const [category,setCategory] = useState('All categories');
  const [severity,setSeverity] = useState('All severities');
  const [verified,setVerified] = useState('All statuses');
  const [from,setFrom] = useState('');
  const [to,setTo] = useState('');
  const [query,setQuery] = useState('');
  const [focus,setFocus] = useState(null);
  const [searchOpen,setSearchOpen] = useState(false);
  const filtered = useMemo(()=>publicRows.filter(r=>(wildlifeVisible||!wildlife(r.category))&&(category==='All categories'||r.category===category) &&
    (severity==='All severities'||r.severity===severity) && (verified==='All statuses'||r.verification===verified) &&
    (!from||Date.parse(r.occurred_at) >= Date.parse(from+'T00:00:00+05:30')) && (!to||Date.parse(r.occurred_at)<Date.parse(to+'T00:00:00+05:30')+86400000)),[publicRows,category,severity,verified,from,to,wildlifeVisible]);
  const filteredGroups = useMemo(()=>{
    const ids=new Set(filtered.map(r=>r.id));
    return repeated.filter(g=>g.reports.some(r=>ids.has(r.id)) && (admin || g.center.data_source==='Synthetic' && !wildlife(g.category)));
  },[repeated,filtered,admin]);
  const recent = [...filtered].sort((a,b)=>Date.parse(b.occurred_at)-Date.parse(a.occurred_at)).slice(0,4);
  const matches = query.trim() ? data.campus.features.filter(f=>!defaultLayers.includes(f.properties.name)&&f.properties.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0,8) : [];
  const active = alerts.filter(activeAlert);
  return <>
    <Heading title="Campus safety map" text={'Open reports created within the last '+ageDays+' days. Resolved, rejected and older records are available in administration.'}><button className="primary" onClick={onReport}><Icon name="plus"/> Report incident</button></Heading>
    <div className="overview">
      <Stat label="Visible reports" value={filtered.length} icon="pin"/>
      <Stat label="High or critical" value={filtered.filter(r=>['High','Critical'].includes(r.severity)).length} icon="alert"/>
      <Stat label="Wildlife reports" value={filtered.filter(r=>wildlife(r.category)).length} icon="paw"/>
      <Stat label="Active announcements" value={active.length} icon="bell" onClick={onAlerts}/>
    </div>
    {!!active.length && <button className="message warning alert-link" onClick={onAlerts}><Icon name="bell"/> {active[0].title} <span className="tag">{source(active[0])}</span></button>}
    <div className="map-layout">
      <section className="map-card">
        <div className="map-toolbar"><div className="segments">{['Markers','Heatmap','All data','Pedestrian hazards'].map(item=><button aria-pressed={mode===item} className={mode===item?'chosen':''} key={item} onClick={()=>setMode(item)}>{item}</button>)}</div><div className="search">
          <Icon name="search"/><input aria-label="Search campus" placeholder="Search campus" value={query} onFocus={()=>setSearchOpen(true)} onChange={e=>{setQuery(e.target.value);setSearchOpen(true);}} onKeyDown={e=>{if(e.key==='Escape')setSearchOpen(false);if(e.key==='Enter'&&matches[0]){setFocus(matches[0]);setSearchOpen(false);}}}/>
          {query && searchOpen && <div className="search-results">{matches.length ? matches.map(f=><button key={f.properties.source_url} onClick={()=>{setFocus(f);setQuery(f.properties.name);setSearchOpen(false);}}>{f.properties.name}</button>) : <p>No matching places</p>}</div>}
        </div></div>
        <CampusMap zone={showZone?zone:null} canViewPhotos={admin} campus={data.campus} visible={layers} reports={filtered} mode={mode} focus={focus} onSelect={setSelected} clusters={filteredGroups}/>
        <details className="marker-legend" open><summary>Map legend</summary><div>{[...categories,'Wildlife caution zone'].map(c=><span key={c}><i dangerouslySetInnerHTML={{__html:iconSvg(c)}}/>{c}</span>)}</div><p>Coral marks high or critical severity. A dashed ring indicates a reported incident. Wildlife area symbols group protected records outside the density heatmap.</p></details>
        <div className="map-bottom"><button onClick={()=>{setQuery('');setSearchOpen(false);setFocus({...data.campus.features.find(f=>f.properties.layer==='Campus boundary')});}}>Reset view</button></div>
      </section>
      <aside className="controls">
        <section className="panel"><h2><Icon name="layers"/> Map layers</h2><label className="toggle">Wildlife reports<input type="checkbox" checked={wildlifeVisible} onChange={e=>setWildlifeVisible(e.target.checked)}/></label><label className="toggle"><span><i className="dot amber"/>Lake-side caution zone</span><input type="checkbox" checked={showZone} onChange={e=>setShowZone(e.target.checked)}/></label>{defaultLayers.map(k=><label className="toggle" key={k}><span><i className="dot" style={{background:colors[k]}}/>{k}</span><input type="checkbox" checked={layers.includes(k)} onChange={e=>setLayers(e.target.checked?[...layers,k]:layers.filter(x=>x!==k))}/></label>)}</section>
        <section className="panel filters"><h2>Incident filters</h2>
          {select('Category',['All categories',...categories],{value:category,onChange:e=>setCategory(e.target.value)})}
          {select('Severity',['All severities',...severities],{value:severity,onChange:e=>setSeverity(e.target.value)})}
          {select('Verification',['All statuses',...verification],{value:verified,onChange:e=>setVerified(e.target.value)})}
          <div className="dates"><label>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
          <button className="text-button" onClick={()=>{setCategory('All categories');setSeverity('All severities');setVerified('All statuses');setFrom('');setTo('');}}>Reset filters</button>
        </section>
      </aside>
    </div>
    {mode==='Pedestrian hazards' && <p className="message warning">The map shows reported hazards and repeated complaint areas. Walking paths have no safety rating.</p>}
    <section className="panel recent"><h2>Recent reports</h2>{recent.map(r=><button key={r.id} className="report-row" onClick={()=>setSelected(r)}><span>{r.category}<small>{date(r.occurred_at)} · {source(r)}</small></span><span className="tag">{r.verification}</span></button>)}{!recent.length&&<p>No reports match these filters.</p>}</section>
  </>;
}

function Stat({label,value,icon,onClick}) {
  const Tag = onClick?'button':'div';
  return <Tag className="stat" onClick={onClick}><div><small>{label}</small><strong>{value}</strong></div><span><Icon name={icon}/></span></Tag>;
}

function ReportPage({data,onSave}) {
  const [point,setPoint] = useState(null);
  const [locationError,setLocationError] = useState('');
  const [submitting,setSubmitting] = useState(false);
  const checkPoint = useCallback(p=>{
    const boundary = data.campus.features.find(f=>f.properties.layer==='Campus boundary');
    if (!contains(boundary.geometry,p)) {setLocationError('Choose a point inside the campus boundary.');return;}
    setLocationError('');setPoint({lat:p.lat,lng:p.lng});
  },[data.campus]);
  const locator=useLocation();
  return <><Heading title="Report an incident" text="Choose a location on the campus map and describe what happened."/>
    <div className="message warning"><Icon name="alert"/> For an active emergency, contact Campus Security directly. The form flags urgent reports for administrative review.</div>
    <form className="two report-form" onSubmit={async e=>{
      e.preventDefault();
      const form = e.currentTarget, fields = new FormData(form);
      if (!point) {setLocationError('Choose a location before submitting.');return;}
      const photo = fields.get('photo');
      const limit = supabase ? 5*1024**2 : 1024**2;
      if (photo.size && (!['image/jpeg','image/png','image/webp'].includes(photo.type)||photo.size>limit)) {setLocationError('Choose a JPG, PNG or WebP within the displayed limit.');return;}
      const occurred_at = new Date(fields.get('time')+'+05:30');
      if (occurred_at.getTime()>Date.now()) {setLocationError('Choose a date and time in the past.');return;}
      const description=fields.get('description').trim();
      if (!description) {setLocationError('Enter a description before submitting.');return;}
      const category=fields.get('category');
      setLocationError('');setSubmitting(true);
      try {
        const saved = await onSave({id:crypto.randomUUID(),...point,category,occurred_at:occurred_at.toISOString(),description,severity:fields.get('severity'),verification:'Reported',status:'Submitted',department:routing[categories.indexOf(category)],data_source:'Synthetic'},photo.size?photo:null);
        if (saved) {form.reset();setPoint(null);}
      } finally {setSubmitting(false);}
    }}>
      <section className="panel fields"><h2>Incident details</h2>
        {select('Category',categories,{name:'category'})}{select('Severity',severities,{name:'severity',defaultValue:'Moderate'})}
        <label>Date and time (IST)<input type="datetime-local" name="time" defaultValue={localDate()} max={localDate()} required/></label>
        <label>Description<textarea name="description" rows="4" maxLength="1500" required placeholder="Describe what happened"/></label>
        <label>Photo · optional ({supabase?'5 MB':'1 MB'} max)<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"/></label>
        {locationError&&<p role="alert" className="error-text">{locationError}</p>}
        <button className="primary" disabled={submitting}>{submitting?'Submitting…':'Submit report'}</button>
      </section>
      <section className="panel location"><h2>Location</h2><CampusMap campus={data.campus} onPick={checkPoint} point={point}/>
        <div className="location-actions"><span>{point?`${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`:'Select a point on the map'}</span>
        <button type="button" className="secondary" disabled={locator.busy} onClick={()=>locator.request(false,p=>p.accuracy>60?setLocationError('GPS accuracy is too low. Select a map point.'):checkPoint(p))}>{locator.busy?'Locating…':'Use GPS'}</button>{locator.message&&<span role="status">{locator.message}</span>}</div>
      </section>
    </form></>;
}

function Admin({rows,ageDays,clock,repeated,setSelected,onPublish}) {
  const [search,setSearch] = useState('');
  const [page,setPage] = useState(0);
  const [queueView,setQueueView]=useState('Active');
  const [attested,setAttested] = useState(false);
  const [publishing,setPublishing] = useState(false);
  const priority = r => urgent(r) && r.verification!=='Rejected' && !['Resolved','Rejected'].includes(r.status);
  const ordered=[...rows].sort((a,b)=>Number(priority(b))-Number(priority(a))||Date.parse(b.occurred_at)-Date.parse(a.occurred_at));
  const queue = ordered.filter(r=>(queueView==='History')===Boolean(archiveReasons(r,ageDays,clock).length)).filter(r=>[r.category,r.severity,r.status,r.verification,r.department].join(' ').toLowerCase().includes(search.toLowerCase()));
  return <>
    <div className="overview"><Stat label="Total reports" icon="pin" value={rows.length}/><Stat label="Active complaints" icon="alert" value={rows.filter(r=>!archiveReasons(r,ageDays,clock).length).length}/><Stat label="Resolved" icon="shield" value={rows.filter(r=>r.status==='Resolved').length}/><Stat label="Verified wildlife" icon="paw" value={rows.filter(r=>wildlife(r.category)&&r.verification==='Verified').length}/></div>
    <React.Suspense fallback={<p role="status">Loading charts…</p>}><AdminCharts rows={rows}/></React.Suspense>
    <div className="two safety"><section className="panel"><h2>Repeated reports and hotspots</h2><p>60 m · 72 hours · at least three distinct reporters. Review required.</p>
      {repeated.map(g=><button className="report-row" key={g.id} onClick={()=>setSelected({id:g.id,group:g})}><span>{g.category}<small>{g.count} distinct reporters · {source(g.center)}</small></span><span className="tag">Review group</span></button>)}
      {!repeated.length&&<p>No groups meet the threshold.</p>}</section>
    <form className="panel fields" onSubmit={async e=>{
      e.preventDefault();const form=e.currentTarget,f=new FormData(form);
      if (!attested) return;
      const title=f.get('title').trim(),body=f.get('body').trim();
      if (!title||!body) return;
      setPublishing(true);
      try {if (await onPublish({title,body,expires_at:f.get('expires')?new Date(f.get('expires')+'+05:30').toISOString():null})) {form.reset();setAttested(false);}}
      finally {setPublishing(false);}
    }}><h2>Publish announcement</h2><label>Title<input name="title" maxLength="120" required/></label><label>Message<textarea name="body" rows="3" maxLength="2000" required/></label><label>Expires (IST), optional<input name="expires" type="datetime-local" min={localDate()}/></label>
      <label className="inline"><input type="checkbox" checked={attested} onChange={e=>setAttested(e.target.checked)}/>{supabase?'I have verified the content and am authorized to publish it.':'I am publishing a simulated announcement.'}</label>
      <button className="primary" disabled={!attested||publishing}>{supabase?'Publish announcement':'Publish simulated announcement'}</button></form></div>
    <section className="panel recent"><h2>Complaint queue</h2><div className="segments">{['Active','History'].map(v=><button key={v} className={v===queueView?'chosen':''} aria-pressed={v===queueView} onClick={()=>{setPage(0);setQueueView(v);}}>{v}</button>)}</div><input aria-label="Search complaint queue" placeholder="Search category, status or team" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/>
      {queue.slice(page*12,page*12+12).map(r=><button className="report-row" key={r.id} onClick={()=>setSelected(r)}><span>{r.category}<small>{date(r.occurred_at)} · {r.department} · {source(r)}{queueView==='History'?' · '+archiveReasons(r,ageDays,clock).join(' · '):''}</small></span><span className={priority(r)?'tag emergency':'tag'}>{priority(r)?'Priority review':r.status}</span></button>)}
      <div className="pagination"><button className="secondary" disabled={!page} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page+1} of {Math.max(1,Math.ceil(queue.length/12))}</span><button className="secondary" disabled={(page+1)*12>=queue.length} onClick={()=>setPage(p=>p+1)}>Next</button></div>
    </section></>;
}

function Details({report,admin,actionError,close,onUpdate,onGroupUpdate}) {
  const [photo,setPhoto] = useState(null);
  const [photoError,setPhotoError] = useState('');
  const [history,setHistory] = useState(report.history||[]);
  const [saving,setSaving] = useState(false);
  useEffect(()=>{
    if (!admin || !supabase || report.group) return;
    let current=true;
    supabase.from('complaint_history').select('*').eq('incident_id',report.id).order('changed_at',{ascending:false}).then(result=>{
      if (current && !result.error) setHistory(result.data);
      if (current && result.error) setPhotoError('Complaint history could not be loaded.');
    });
    return ()=>{current=false;};
  },[report,admin]);
  useEffect(()=>{const listener=e=>{if(e.key==='Escape')close();};window.addEventListener('keydown',listener);return ()=>window.removeEventListener('keydown',listener);},[close]);

  return <div className="scrim" onClick={e=>{if(e.target===e.currentTarget) close();}}><section className="drawer" role="dialog" aria-modal="true" aria-label="Incident details"><button className="close secondary" onClick={close} autoFocus aria-label="Close details">×</button>
    {actionError&&<p className="message error" role="alert">{actionError}</p>}
    {report.group ? <><span className="tag">Possible repeated incident</span><h2>{report.group.category}</h2><p>{report.group.count} independent reporters. Verification remains individual.</p>
      {report.group.reports.map(r=><article className="entry" key={r.id}>{r.description||r.category}<small>{date(r.occurred_at)} · {r.verification}</small></article>)}
      <form className="fields" onSubmit={async e=>{
        e.preventDefault();const f=new FormData(e.currentTarget);setSaving(true);
        try {await onGroupUpdate({department:f.get('department'),ids:report.group.reports.map(r=>r.id)});} finally {setSaving(false);}
      }}>{select('Department · provisional',departments,{name:'department',defaultValue:report.group.center.department})}<button className="primary" disabled={saving}>Forward group</button></form></> :
    <><span className="tag">{source(report)} · {report.verification}</span><h2>{report.category}</h2>
    <p>{date(report.occurred_at)} · {report.severity}</p>{urgent(report)&&<p className="message warning">Priority review</p>}
    <p>{report.description||(report.approximate?'Campus-wide wildlife report.':'Report details restricted.')}</p>
    <p><strong>Location</strong><br/>{report.approximate?report.areaLabel:`${Number(report.lat).toFixed(5)}, ${Number(report.lng).toFixed(5)}`}</p>
    <p><strong>Complaint</strong><br/>{report.status} · {report.department}</p>
    {admin&&<><form className="fields" onSubmit={async e=>{
      e.preventDefault(); const f=new FormData(e.currentTarget);setSaving(true);
      try {await onUpdate(Object.fromEntries(f));} finally {setSaving(false);}
    }}>{select('Verification',verification,{name:'verification',defaultValue:report.verification})}{select('Status',statuses,{name:'status',defaultValue:report.status})}{select('Department · provisional',departments,{name:'department',defaultValue:report.department})}
      <button className="primary" disabled={saving}>Save changes</button></form>
      {report.photo_path&&<button className="secondary safety" onClick={()=>photoURL(report).then(setPhoto).catch(e=>setPhotoError(e.message))}>View private photo</button>}
      {photo&&<img className="evidence-photo" src={photo} alt="Incident evidence"/>}
      {photoError&&<p role="alert">{photoError}</p>}
      <h3>Complaint history</h3>{history.length?history.map((h,i)=><p key={i}>{date(h.changed_at)} · {h.status} · {h.verification} · {h.department}</p>):<p>No administrative changes recorded.</p>}
    </>}</>}
  </section></div>;
}

createRoot(document.getElementById('root')).render(<App/>);
