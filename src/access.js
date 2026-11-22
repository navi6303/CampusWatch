export const paths = {
  Map: '/map', Routes: '/routes', Wildlife: '/wildlife', Alerts: '/alerts',
  Report: '/report', Mine: '/my-reports', Admin: '/admin',
};

export function pageAt(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return 'Map';
  return Object.keys(paths).find(key => paths[key] === path) || 'Missing';
}

export function permitted(page, role) {
  if (role === 'local') return true;
  if (page === 'Admin') return role === 'admin';
  if (page === 'Mine' || page === 'Report') return role === 'student' || role === 'admin';
  return true;
}

export function validSession(session, now = Date.now()) {
  return !!session?.user?.id && Number.isFinite(session.expires_at) && session.expires_at * 1000 > now;
}

// Existing browser-local submissions use this owner ID.
export const localReporterId = 'local-demo-user';
