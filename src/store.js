import {validSession,localReporterId} from './access';
import {createClient} from '@supabase/supabase-js';
import {wildlife,generalizeWildlife} from './domain';

const {VITE_SUPABASE_URL:url,VITE_SUPABASE_PUBLISHABLE_KEY:key} = import.meta.env;
if (Boolean(url) !== Boolean(key)) throw new Error('Set both Supabase environment variables.');
export const supabase = url && key ? createClient(url,key) : null;
export const readLocal = (key, fallback) => JSON.parse(localStorage.getItem('campuswatch:'+key) || JSON.stringify(fallback));
export function saveLocal(key, value) { localStorage.setItem('campuswatch:'+key,JSON.stringify(value)); }
export function check({data,error}) { if (error) throw error; return data; }

export async function fetchState(session) {
  const admin = session ? check(await supabase.rpc('is_campus_admin')) : false;
  const reports = [];
  let legacyFeed=false;
  for (let start = 0; ; start += 500) {
    const query = admin ? supabase.from('incidents').select('*').order('occurred_at',{ascending:false}).order('id') :
      supabase.rpc(legacyFeed?'campus_public_incidents':'campus_public_incidents_v2').order('occurred_at',{ascending:false}).order('id');
    const result=await query.range(start,start+499);
    if(!admin&&!legacyFeed&&start===0&&['PGRST202','42883'].includes(result.error?.code)) {
      legacyFeed=true;start-=500;continue;
    }
    const page=check(result);
    reports.push(...page);
    if (page.length < 500) break;
  }
  const alerts = check(await supabase.from('safety_alerts').select('*').order('created_at',{ascending:false}));
  const settings=await supabase.from('campus_route_settings').select('*').eq('id',1).single();
  if (settings.error && !['PGRST205','42P01'].includes(settings.error.code)) throw settings.error;
  return {admin,reports,alerts,legacyFeed,reportAgeDays:settings.data?.report_age_days,viewer:session?.user.id??null,zoneWidth:settings.data?.lakeside_width??150,zoneWritable:!settings.error};
}

export async function submitReport(report, photo, session) {
  if (!supabase) {
    const record = {...report,created_at:new Date().toISOString(),reporter_id:localReporterId,data_source:'Synthetic',photo_path:photo ? await photoData(photo) : null};
    saveLocal('reports',[record,...readLocal('reports',[])]);
    return;
  }
  if (!validSession(session)) throw new Error('An active campus account session is required to submit a report.');
  const {data_source, verification, status, department, ...input} = report;
  let photo_path = null;
  if (photo) {
    photo_path = session.user.id+'/'+report.id;
    check(await supabase.storage.from('incident-photos').upload(photo_path,photo,{contentType:photo.type}));
  }
  try {
    check(await supabase.from('incidents').insert({...input,photo_path}));
  } catch (error) {
    if (photo_path) await supabase.storage.from('incident-photos').remove([photo_path]);
    throw error;
  }
}

function photoData(file) {
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function photoURL(report) {
  if (!report.photo_path) return null;
  if (!supabase) return report.photo_path;
  return check(await supabase.storage.from('incident-photos').createSignedUrl(report.photo_path,60)).signedUrl;
}

export function displayReports(rows, admin) {
  return rows.map(r => !admin && wildlife(r.category) ? generalizeWildlife(r) : r);
}
