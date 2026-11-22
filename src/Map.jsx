import React,{useEffect, useRef} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import {iconSvg} from './report-icons';
import {incidentPopup,reportCollection,markerColor} from './incident-popup';
import {hazard,wildlifeSymbolPosition} from './domain';

export const colors = {'Campus boundary':'#1b755e', Buildings:'#78968b', Hostels:'#6656ac', Roads:'#8b9184', 'Walking paths':'#197957', Gates:'#283e55', Facilities:'#345a9a', Water:'#73aebc'};
export const defaultLayers = ['Campus boundary','Buildings','Hostels','Roads','Walking paths','Gates','Facilities','Water'];
// Leaflet 1.9 can redraw synchronously on zoom while a frame is pending.
// Cancel that frame before the base implementation clears its request handle.
const CampusCanvas=L.Canvas.extend({
  _redraw() {
    L.Util.cancelAnimFrame(this._redrawRequest);
    if (this._map && this._ctx) L.Canvas.prototype._redraw.call(this);
  }
});
const empty=[];
const rank = ['Water','Campus boundary','Buildings','Hostels','Roads','Walking paths','Facilities','Gates'];
const label = ({name, source_url}) => {
  const box = document.createElement('div');
  const link = document.createElement('a');
  link.textContent = name;
  link.href = source_url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  box.append(link);
  return box;
};

export default function CampusMap({campus, visible=defaultLayers, reports=empty, mode='Markers', onPick, point, focus, onSelect, clusters=empty,routeOverlay,gps,zone,canViewPhotos=false}) {
  const host = useRef(null), map = useRef(null), vectors = useRef(null), incidents = useRef(null), routing = useRef(null);
  const [popupSize,setPopupSize]=React.useState({width:290,height:290});
  const [zoom,setZoom]=React.useState(16);
  const routeRenderer=useRef(null), routeBounds=useRef(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    const instance = L.map(host.current, {zoomControl:false,renderer:new CampusCanvas(),preferCanvas:true,zoomAnimation:!window.matchMedia('(prefers-reduced-motion: reduce)').matches,fadeAnimation:false,scrollWheelZoom:true}).setView([19.132,72.914], 16);
    map.current = instance;
    routeRenderer.current=L.svg({padding:.35});
    instance.on('zoomend',()=>setZoom(instance.getZoom()));
    L.control.zoom({position:'bottomright'}).addTo(instance);
    if(new URLSearchParams(window.location.search).get('basemap')==='offline') {
      instance.setMinZoom(12);instance.setMaxZoom(19);
      instance.attributionControl.addAttribution('Campus vectors © OpenStreetMap contributors');
    } else L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:19,updateWhenIdle:true,updateWhenZooming:false,keepBuffer:2, attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
    }).addTo(instance);
    vectors.current = L.layerGroup().addTo(instance);
    incidents.current = L.layerGroup().addTo(instance);
    routing.current = L.layerGroup().addTo(instance);
    instance.on('click', event => pick.current?.(event.latlng));
    const observer = new ResizeObserver(() => {
      instance.invalidateSize({animate:false,pan:false});
      if(routeBounds.current) instance.fitBounds(routeBounds.current,{padding:[38,38],maxZoom:18,animate:false});
      const width=Math.min(315,Math.max(150,host.current.clientWidth-78));
      const height=Math.max(150,Math.min(400,host.current.clientHeight-100));
      setPopupSize(old=>old.width===width&&old.height===height?old:{width,height});
    });
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      // Detach paths first. Their removal schedules a final canvas draw, which the
      // renderer cancels when it is subsequently removed by Leaflet.
      instance.eachLayer(layer=>{if(!(layer instanceof L.Renderer)) instance.removeLayer(layer);});
      instance.remove();
    };
  }, []);

  useEffect(() => {
    if (!campus) return;
    const boundary = campus.features.find(f => f.properties.layer === 'Campus boundary');
    map.current.fitBounds(L.geoJSON(boundary).getBounds(), {padding:[22,22], maxZoom:17,animate:false});
  }, [campus]);

  useEffect(() => {
    vectors.current.clearLayers();
    if (!campus) return;
    if(zone) L.geoJSON({type:'Feature',geometry:zone.geometry,properties:{}},{interactive:false,style:{color:'#a45725',weight:2,dashArray:'6 4',fillColor:'#f5a66f',fillOpacity:.28}}).addTo(vectors.current);
    for (const kind of rank) {
      if (!visible.includes(kind) || zoom<16 && ['Facilities','Gates','Buildings'].includes(kind)) continue;
      L.geoJSON(campus.features.filter(f => f.properties.layer === kind), {
        style: {color:colors[kind], weight:kind === 'Campus boundary' ? 2.3 : kind === 'Walking paths' ? 2 : 1.2,
          opacity:.85, fillOpacity:kind === 'Campus boundary' ? .06 : .24,
          dashArray:kind === 'Walking paths' ? '4 4' : undefined},
        pointToLayer: (f, p) => L.circleMarker(p, {radius:4,color:'#fff',weight:1,fillColor:colors[kind],fillOpacity:1}),
        onEachFeature:(f, layer) => { if (!pick.current) layer.bindPopup(label(f.properties)); }
      }).addTo(vectors.current);
    }
  }, [campus, visible, !!onPick, zoom<16, zone]);

  useEffect(() => {
    const overlay = incidents.current.clearLayers();
    if (point) L.circleMarker(point, {radius:9,color:'#fff',fillColor:'#12654c',fillOpacity:1}).addTo(overlay);
    if (mode === 'Heatmap'||mode === 'All data') {
      const heat = reports.filter(r => !r.approximate && r.verification !== 'Rejected')
        .map(r => [r.lat, r.lng, r.severity === 'High' || r.severity === 'Critical' ? .9 : .45]);
      if (heat.length) L.heatLayer(heat,{radius:27,blur:20,maxZoom:17,gradient:{.2:'#56c5aa',.5:'#e1bb4a',.8:'#f37e39',1:'#b83246'}}).addTo(overlay);
    }
    {
      const approximate = reports.filter(r => r.approximate);
      const eligible=mode==='Heatmap'?[]:reports.filter(r=>!r.approximate && (mode!=='Pedestrian hazards'||hazard(r.category)));
      const cells=new Map();
      for(const r of eligible) {
        const pixel=map.current.project([r.lat,r.lng],zoom);
        const key=zoom<17?Math.floor(pixel.x/34)+','+Math.floor(pixel.y/34):r.lat+','+r.lng;
        if(!cells.has(key)) cells.set(key,[]);
        cells.get(key).push(r);
      }
      if(mode!=='Pedestrian hazards') for(const r of approximate) {
        const key='area:'+r.category+':'+r.areaLabel;
        if(!cells.has(key)) cells.set(key,[]);
        cells.get(key).push(r);
      }
      for(const rows of cells.values()) {
        const r=rows[0];
        const grouped=rows.length>1;
        const pos=r.approximate?wildlifeSymbolPosition(r):grouped?[rows.reduce((n,r)=>n+r.lat,0)/rows.length,rows.reduce((n,r)=>n+r.lng,0)/rows.length]:[r.lat,r.lng];
        const icon=document.createElement('span');
        const oneCategory=rows.every(row=>row.category===r.category);
        icon.className=oneCategory?'report-symbol '+(rows.every(row=>row.verification==='Verified')?'verified':'reported'):'report-count';
        icon.style.backgroundColor=oneCategory?markerColor(r):'#02070A';
        if(oneCategory) icon.innerHTML=iconSvg(r.category);
        if(grouped) {
          const count=document.createElement(oneCategory?'b':'span');
          count.textContent=String(rows.length);icon.append(count);
        }
        const name=(oneCategory?r.category+' · ':'')+(grouped?rows.length+' reports':r.verification)+(r.approximate?' · area summary':'');
        const marker=L.marker(pos,{title:name,alt:name,autoPanOnFocus:false,icon:L.divIcon({className:'report-pin',html:icon,iconSize:[28,28],iconAnchor:[14,14]})}).addTo(overlay);
        marker.getElement()?.setAttribute('aria-label',name);
        const config={maxWidth:popupSize.width,maxHeight:popupSize.height,autoPanPadding:[16,18]};
        if(!grouped) marker.bindPopup(()=>incidentPopup(r,canViewPhotos,onSelect),config);
        else if(zoom<17&&!r.approximate) marker.on('click',()=>map.current.setView(pos,Math.min(zoom+2,19)));
        else marker.bindPopup(()=>reportCollection(rows,canViewPhotos,onSelect),config);
      }
      if (mode === 'Pedestrian hazards') clusters.filter(g => hazard(g.category)).forEach(g =>
        L.circle(g.center,{radius:60,color:'#c54841',dashArray:'6 4',fillOpacity:.12}).bindTooltip(g.count+' independent reports · needs review').addTo(overlay));
    }
  }, [reports, mode, point, onSelect, clusters, campus, zoom, canViewPhotos, popupSize]);

  useEffect(() => {
    if (!focus) return;
    map.current.closePopup();
    if (Array.isArray(focus)) map.current.setView(focus,17,{animate:false});
    else if (focus.properties.layer === 'Campus boundary') map.current.fitBounds(L.geoJSON(focus).getBounds(),{padding:[22,22],maxZoom:17,animate:false});
    else {
      const layer = L.geoJSON(focus);
      map.current.fitBounds(layer.getBounds(),{maxZoom:18,padding:[35,35],animate:false});
      L.popup().setLatLng(layer.getBounds().getCenter()).setContent(label(focus.properties)).openOn(map.current);
    }
  }, [focus]);

  useEffect(() => {
    const layer = routing.current.clearLayers();
    if (!routeOverlay) return;
    const {routes,selected,start,end,via,routeHazards} = routeOverlay;
    const colors = {safest:'#0079b6', shortest:'#24418c', alternative:'#8059a1'};
    const under = routes.filter(r=>r.id!==selected);
    const chosen = routes.find(r=>r.id===selected);
    for (const route of under) {
      if(route.line.length>1) L.polyline(route.line,{color:colors[route.id],weight:4,opacity:.6,
        dashArray:route.id==='shortest'?'8 5':undefined,interactive:false}).addTo(layer);
    }
    if (chosen) {
      if(chosen.line.length>1) L.polyline(chosen.line,{color:'#fff',weight:9,opacity:.9,interactive:false}).addTo(layer);
      for(const segment of chosen.segments) {
        if(segment.line.length<2) continue;
        const focused=routeOverlay.inspectLeg===segment.index;
        const path=L.polyline(segment.line,{renderer:routeRenderer.current,noClip:true,smoothFactor:0,
          color:colors[chosen.id],weight:focused?8:6,opacity:routeOverlay.inspectLeg==null||focused?1:.42,
          className:'walking-leg',interactive:false}).addTo(layer).getElement();
        path.setAttribute('aria-label','Leg '+(segment.index+1)+' · '+segment.from+' → '+segment.to);
        path.setAttribute('role','img');
        path.setAttribute('pathLength','1');
      }
      let cumulative=0, nextArrow=45;
      chosen.links.forEach((link,index)=>{
        const a=chosen.points[index], b=chosen.points[index+1];
        while(cumulative+link.length>=nextArrow) {
          const fraction=(nextArrow-cumulative)/link.length;
          const lat=a.lat+(b.lat-a.lat)*fraction, lng=a.lng+(b.lng-a.lng)*fraction;
          const angle=Math.atan2(-(b.lat-a.lat),(b.lng-a.lng)*Math.cos(lat*Math.PI/180))*180/Math.PI;
          L.marker([lat,lng],{interactive:false,icon:L.divIcon({className:'route-arrow',iconSize:[16,16],iconAnchor:[8,8],
            html:'<span style="transform:rotate('+angle+'deg);color:'+colors[chosen.id]+'">➤</span>'})}).addTo(layer);
          nextArrow+=90;
        }
        cumulative+=link.length;
      });
      chosen.crossings.forEach(c=>marker(c,'×','#9b6212',c.kind));
      chosen.hotspots.forEach(h=>L.circleMarker(h,{radius:6,color:'#b34b32',weight:2,fillOpacity:.22,bubblingMouseEvents:false})
        .bindTooltip((h.simulated?'Simulated ': '')+'accident report cluster · '+h.count+' records').addTo(layer));
      routeHazards.forEach(h=>marker(h,iconSvg(h.category),markerColor(h),h.category).bindPopup(()=>incidentPopup(h,canViewPhotos,onSelect)));
    }
    function marker(position,text,color,title) {
      return L.marker(position,{title:title,alt:title,keyboard:true,bubblingMouseEvents:false,icon:L.divIcon({className:'route-pin',iconSize:[22,22],iconAnchor:[11,11],
        html:'<span style="background:'+color+'">'+text+'</span>'})}).bindTooltip(title).addTo(layer);
    }
    const placed=new Map();
    function stopMarker(p,text,color,title) {
      const key=[p.lat.toFixed(6),p.lng.toFixed(6)].join('/');
      const count=placed.get(key)||0;
      placed.set(key,count+1);
      const pin=marker(p,text,color,title);
      pin.setZIndexOffset(800+count);
      const element=pin.getElement();
      element.setAttribute('aria-label',title);
      element.classList.add('journey-stop');
      if(count) element.firstChild.style.translate=(count%2?1:-1)*Math.ceil(count/2)*23+'px 0';
    }
    if (start) stopMarker(start,'A','#183c37','Start');
    via?.forEach((p,i)=>{if(p) stopMarker(p,String(i+1),'#384d62','Stop '+(i+1));});
    if (end) stopMarker(end,'B','#1f4e86','Destination approach');
    routeOverlay.approaches?.forEach((a,i)=>{
      if(a.gap>2) L.circleMarker(a.requested,{radius:6,color:'#02070A',weight:2,fillColor:'#FC734D',fillOpacity:1})
        .bindTooltip('Requested '+(i===routeOverlay.approaches.length-1?'destination':'stop '+(i+1))+' · '+Math.round(a.gap)+' m from approach').addTo(layer);
    });
  }, [routeOverlay,canViewPhotos,onSelect]);

  useEffect(()=>{
    if(!gps) return;
    const layer=L.layerGroup().addTo(map.current);
    L.circle(gps,{radius:gps.accuracy,color:'#2462c6',weight:1,fillOpacity:.1,interactive:false}).addTo(layer);
    L.circleMarker(gps,{renderer:routeRenderer.current,className:'gps-position',radius:7,color:'white',weight:2,fillColor:'#2462c6',fillOpacity:1})
      .bindTooltip('Latest GPS fix · ±'+Math.round(gps.accuracy)+' m').addTo(layer);
    return ()=>layer.remove();
  },[gps]);

  const routeLine = routeOverlay?.routes.find(r=>r.id===routeOverlay.selected)?.line;
  const approaches=routeOverlay?.approaches;
  const inspected=routeOverlay?.routes.find(r=>r.id===routeOverlay.selected)?.segments[routeOverlay?.inspectLeg];
  useEffect(() => {
    routeBounds.current=routeLine?L.latLngBounds(inspected?[...inspected.line,inspected.approach.requested]:[...routeLine,...(approaches||[]).map(a=>a.requested)]):null;
    if(routeBounds.current) map.current.fitBounds(routeBounds.current,{padding:[38,38],maxZoom:18,animate:false});
  }, [routeLine,approaches,inspected]);

  return <div className="map" ref={host} aria-label="Interactive IIT Bombay campus map"/>;
}
