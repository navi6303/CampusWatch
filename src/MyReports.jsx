import React,{useEffect,useState} from 'react';
import {supabase,check} from './store';

export function MyReports({reporterId,reports}) {
  const [items,setItems]=useState(null),[error,setError]=useState('');
  useEffect(()=>{
    if(!supabase) return;
    let alive=true,running=false;
    async function load() {
      if(running)return;running=true;
      try {
        const result=[];
        for(let start=0;;start+=200) {
          const page=check(await supabase.rpc('campus_my_reports').order('created_at',{ascending:false}).order('id').range(start,start+199));
          result.push(...page);if(page.length<200)break;
        }
        if(alive){setItems(result);setError('');}
      } catch {if(alive){setItems(null);setError('Your reports could not be loaded. Check your connection and the student history migration.');}}
      finally {running=false;}
    }
    load();const timer=setInterval(load,15000);
    return ()=>{alive=false;clearInterval(timer);};
  },[reporterId]);
  const list=supabase?items:reports.filter(r=>r.reporter_id===reporterId).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
  return <section className="panel own-reports"><h1>My reports</h1><p>Your submissions and their current review status, including closed complaints.</p>
    {error?<p role="alert">{error}</p>:!list?<p role="status">Loading reports…</p>:!list.length?<p>You have no submitted reports.</p>:
    list.map(r=><article key={r.id} className="entry"><h3>{r.category}</h3><p>{r.description}</p>
      <span className="tag">{r.status}</span> · {r.verification} · {r.department}<p><small>{new Date(r.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</small></p></article>)}
  </section>;
}
