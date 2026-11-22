// Fixed 24-unit symbols, shared by Leaflet and the category legend.
const shapes={
  'Leopard sighting':'<path d="M3 13c-2-1-2-5 0-6M3 13l2-3 8-1 2-3 2 1 2-1 1 3 2 1-1 3-3 1-1 4h-2l.2-4-6 .5-2 4H5l1-5-3 .5Z"/><g fill="currentColor" stroke="none"><circle cx="8" cy="11.8" r=".9"/><circle cx="11" cy="11.2" r=".85"/><circle cx="14" cy="11.8" r=".8"/><circle cx="18.4" cy="9.5" r=".8"/></g>',
  'Snake or other wildlife':'<path d="M3 18c3 3 11 3 12 0 2-4-11 0-10-5 1-4 12 1 13-3l-1-2"/><path d="m15 6 2-2 4 1 1 3-3 2-4-2Z"/><circle cx="19.5" cy="6.5" r=".65" fill="currentColor"/>',
  'Road accident':'<path d="m4 12 2-5h8l2 5M3 12h14v6H3zM5 18v2m10-2v2M5.5 15h1.5m6 0h1.5M18 5l1-3m1.5 6L23 7m-3 4 2 1"/>',
  'Broken streetlight':'<path d="M5 21h9m-5 0V8a5 5 0 0 1 10 0M16 8h6l-1.3 3h-3.4ZM19 14v3m-4-4-2 2m9-2 1 2"/>',
  'Damaged pedestrian pathway':'<path d="m3 21 6-18m12 18L15 3M6 13h4m5 0h3M8 7h8m-5 4 2 3-3 2 2 3"/>',
  'Waterlogging':'<path d="M12 2s-4 5-4 8a4 4 0 0 0 8 0c0-3-4-8-4-8ZM2 17q2-2 5 0t5 0 5 0 5 0M2 21q2-2 5 0t5 0 5 0 5 0"/>',
  'Fallen tree':'<path d="m3 20 12-9m-7 5-1-4m5 1 5 2M11 8l5-4-1 3 5-1-2 3 4 1-6 4-5-6ZM2 20l2 2"/>',
  'Pedestrian crossing hazard':'<circle cx="13" cy="4" r="2"/><path d="m9 10 3-3 3 4 4 1m-7-4-1 6 4 5m-4-5-4 5M2 21h3m3 0h3m3 0h3m3 0h2"/>',
  'Wildlife caution zone':'<path d="M12 2 1.5 21h21L12 2Z"/><path d="M9 16c0-1.6 1.8-3.5 3-3.5s3 1.9 3 3.5c-1.5 1-2-.3-3-.3s-1.5 1.3-3 .3Z" fill="currentColor"/><path d="M9 11.8v.3m3-2.3v.3m3 1.7v.3"/>'
};
const legacy='<path d="m12 2 10 18H2zM12 8v5m0 3v.5"/>';
export function iconSvg(category){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(Object.hasOwn(shapes,category)?shapes[category]:legacy)+'</svg>';
}
