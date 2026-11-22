export const defaultAgeDays=30;
export function validAgeDays(days) {
  return Number.isInteger(days) && days >= 1 && days <= 365;
}

export function archiveReasons(report,days=defaultAgeDays,now=Date.now()) {
  const reasons=[];
  if(report.status==='Resolved') reasons.push('Resolved');
  if(report.status==='Rejected'||report.verification==='Rejected') reasons.push('Rejected');
  const created=Date.parse(report.created_at);
  if(!Number.isFinite(created)) reasons.push('Creation time unknown');
  else if(created>now) reasons.push('Future creation time');
  else if(now-created>days*86400000) reasons.push('Older than '+days+' days');
  return reasons;
}

// Return the next instant a row enters the window or moves to history.
// A submission exactly on the age cutoff is still active.
export function nextVisibilityChange(rows,days,now) {
  let due=Infinity;
  for(const row of rows) {
    const created=Date.parse(row.created_at);
    const expires=created+days*86400000+1;
    if(created>now) due=Math.min(due,created);
    else if(expires>now) due=Math.min(due,expires);
  }
  return due;
}
