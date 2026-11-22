export const categories = ['Leopard sighting','Snake or other wildlife','Road accident','Broken streetlight','Damaged pedestrian pathway','Waterlogging','Fallen tree','Pedestrian crossing hazard'];
export const severities = ['Low', 'Moderate', 'High', 'Critical'];
export const statuses = ['Submitted','Pending','Under review','Forwarded','Resolved','Rejected'];
export const verification = ['Reported','Verified','Rejected'];
export const routing = ['Security / Wildlife','Security / Wildlife','Security / Medical Centre','Electrical / Maintenance','Estate / Maintenance','Civil / Estate','Estate / Maintenance','Campus Security'];
export const departments = [...new Set(routing)];
export const wildlife = category => categories.indexOf(category) >= 0 && categories.indexOf(category) < 2;
export const hazard = category => ['Road accident','Broken streetlight','Damaged pedestrian pathway','Waterlogging','Fallen tree','Pedestrian crossing hazard'].includes(category);
export function urgent(report) {
  if (report.priority_review !== undefined) return report.priority_review;
  const elapsed = (report.created_at ? Date.parse(report.created_at) : Date.now()) - Date.parse(report.occurred_at);
  return report.severity === 'Critical' || wildlife(report.category) && elapsed >= 0 && elapsed <= 3600000;
}

export function distance(a, b) {
  const radians = Math.PI / 180;
  const lat = (b.lat - a.lat) * radians;
  const lng = (b.lng - a.lng) * radians;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(lng / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function groups(reports) {
  const available = reports.filter(r => r.reporter_id && r.verification !== 'Rejected' && !['Rejected','Resolved'].includes(r.status))
    .sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at));
  const used = new Set();
  const result = [];
  for (const anchor of available) {
    if (used.has(anchor.id)) continue;
    const nearby = available.filter(r => !used.has(r.id) && r.category === anchor.category &&
      r.data_source === anchor.data_source && Date.parse(r.occurred_at) >= Date.parse(anchor.occurred_at) &&
      Date.parse(r.occurred_at) - Date.parse(anchor.occurred_at) <= 72 * 3600000 && distance(anchor, r) <= 60);
    const count = new Set(nearby.map(r => r.reporter_id)).size;
    if (count >= 3) {
      nearby.forEach(r => used.add(r.id));
      result.push({id:anchor.id, category:anchor.category, count, reports:nearby, center:anchor});
    }
  }
  return result;
}

export function contains(geometry, {lat, lng}) {
  function ringPosition(ring) {
    let result = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x, y] = ring[i], [previousX, previousY] = ring[j];
      const dx = previousX-x, dy = previousY-y, length = Math.hypot(dx,dy);
      if (length && Math.abs((lng-x)*dy-(lat-y)*dx)/length < 1e-10 &&
          lng >= Math.min(x,previousX)-1e-10 && lng <= Math.max(x,previousX)+1e-10 &&
          lat >= Math.min(y,previousY)-1e-10 && lat <= Math.max(y,previousY)+1e-10) return 'boundary';
      if ((y > lat) !== (previousY > lat) && lng < (previousX-x)*(lat-y)/(previousY-y)+x) result = !result;
    }
    return result ? 'inside' : 'outside';
  }
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  return polygons.some(([outer, ...holes]) => ringPosition(outer) !== 'outside' && holes.every(r => ringPosition(r) !== 'inside'));
}

export function generalizeWildlife(report) {
  const shoreline=report.data_source==='Synthetic' && /^demo-\d+$/.test(report.id);
  const {reporter_id,photo_path,history,...visible}=report;
  return {...visible,description:null,lat:null,lng:null,approximate:true,
    areaLabel:shoreline?'Lake-side study area · approximate':'IIT Bombay campus · approximate'};
}

export function wildlifeSymbolPosition(report) {
  // Fixed cartographic anchors for area summaries, independent of any actual sighting.
  const lake=report.areaLabel?.startsWith('Lake-side');
  if(report.category==='Leopard sighting') return lake?[19.133,72.910]:[19.1315,72.9138];
  return lake?[19.132,72.912]:[19.1326,72.9147];
}

export function publicDemo(report) {
  if(wildlife(report.category)) return generalizeWildlife(report);
  const {reporter_id,photo_path,history,...safe}=report;
  return safe;
}
