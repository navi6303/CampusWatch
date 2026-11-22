import {photoURL} from './store';
export const markerColor=r=>['High','Critical'].includes(r.severity)?'#FC734D':'#0297DE';
export function reportSource(report) {
  if(report.data_source==='Synthetic') return 'Synthetic / Demo Data';
  if(report.data_source==='Student_Report') return 'User-submitted report';
  return (report.data_source||'Unspecified').replaceAll('_',' ');
}

export function incidentPopup(report,allowPhoto,onSelect) {
  const root=document.createElement('article');
  root.className='incident-popup';
  function line(tag,value) {
    const el=document.createElement(tag);
    el.textContent=value;root.append(el);return el;
  }
  if(report.title && report.title!==report.category) line('small',report.category);
  line('h3',report.title||report.category);
  line('p',report.description||(report.approximate?'Wildlife report for this general area. The symbol marks an area summary. Exact details are restricted.':'The public record does not include a description.'));
  if(allowPhoto && report.photo_path) {
    const container=line('div','Loading attached photo…');
    container.className='popup-photo';
    photoURL(report).then(url=>{
      const img=document.createElement('img');
      img.alt='Attached incident photograph';
      img.onerror=()=>{container.textContent='Photo unavailable.';};
      img.src=url;container.replaceChildren(img);
    }).catch(()=>{container.textContent='Photo unavailable.';});
  }
  const fields=document.createElement('dl');
  const metadata={
    Location:report.approximate?report.areaLabel:('IIT Bombay · '+report.lat.toFixed(5)+', '+report.lng.toFixed(5)),
    Time:new Date(report.occurred_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})+' IST',
    Submitted:report.created_at?new Date(report.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})+' IST':null,
    Severity:report.severity,Verification:report.verification,Source:reportSource(report),
    Complaint:report.status
  };
  for(const [key,value] of Object.entries(metadata)) {
    if(!value) continue;
    const dt=document.createElement('dt'),dd=document.createElement('dd');
    dt.textContent=key;dd.textContent=value;fields.append(dt,dd);
  }
  root.append(fields);
  const button=line('button','Full incident details');
  button.className='popup-action';button.onclick=()=>onSelect?.(report);
  return root;
}

export function reportCollection(rows,allowPhoto,onSelect) {
  const sorted=[...rows].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
  const box=document.createElement('section');
  const control=document.createElement('label');
  control.textContent=sorted.length+' reports · choose a record';
  const select=document.createElement('select');
  select.setAttribute('aria-label','Choose a report');
  sorted.forEach((r,i)=>select.add(new Option(r.category+' · '+new Date(r.created_at).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'})+' · '+r.status,String(i))));
  control.append(select);
  const detail=document.createElement('div');
  const show=()=>detail.replaceChildren(incidentPopup(sorted[Number(select.value)],allowPhoto,onSelect));
  select.onchange=show;show();box.append(control,detail);return box;
}
