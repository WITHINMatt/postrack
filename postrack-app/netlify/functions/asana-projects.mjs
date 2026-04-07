// Load .env for local dev
const _envVars = {};
try {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const url = await import('node:url');
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const envContent = fs.readFileSync(path.resolve(__dirname, '../../.env'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) _envVars[m[1].trim()] = m[2].trim();
  }
} catch {}

const ALLOWED_ORIGINS = [
  'https://postrack.netlify.app',
  'http://localhost:8888',
  'http://localhost:5174',
];

const rateMap = new Map();
function checkRate(ip, limit = 30, windowMs = 60000) {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now - entry.start > windowMs) { rateMap.set(ip, { start: now, count: 1 }); return true; }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'Content-Type' };
}

export default async (req) => {
  const origin = req.headers.get('origin') || '';

  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders(origin) });
  }

  // Rate limit
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('client-ip') || 'unknown';
  if (!checkRate(ip)) {
    return Response.json({ error: 'Rate limit exceeded' }, { status: 429, headers: corsHeaders(origin) });
  }

  // Auth — require team passphrase via query param
  const reqUrl = new URL(req.url);
  const pass = reqUrl.searchParams.get('pass') || '';
  const expected = _envVars.TEAM_PASSPHRASE || process.env.TEAM_PASSPHRASE;
  if (!expected || pass !== expected) {
    return Response.json({ error: 'Unauthorized' }, { status: 403, headers: corsHeaders(origin) });
  }

  const token = _envVars.ASANA_PAT || process.env.ASANA_PAT;
  if (!token) {
    return Response.json({ error: 'Asana not configured' }, { status: 500, headers: corsHeaders(origin) });
  }

  const query = reqUrl.searchParams.get('q') || '';

  try {
    const headers = { 'Authorization': 'Bearer ' + token };
    const wsRes = await fetch('https://app.asana.com/api/1.0/workspaces?limit=100', { headers });
    if (!wsRes.ok) return Response.json({ error: 'Failed to fetch workspaces' }, { status: 502, headers: corsHeaders(origin) });
    const wsData = await wsRes.json();

    const allProjects = [];
    for (const ws of wsData.data) {
      const apiUrl = query.length >= 1
        ? 'https://app.asana.com/api/1.0/workspaces/' + ws.gid + '/typeahead?resource_type=project&query=' + encodeURIComponent(query) + '&count=50&opt_fields=name'
        : 'https://app.asana.com/api/1.0/workspaces/' + ws.gid + '/projects?limit=100&archived=false&opt_fields=name';
      const res = await fetch(apiUrl, { headers });
      if (res.ok) {
        const data = await res.json();
        for (const p of data.data) allProjects.push({ gid: p.gid, name: p.name, workspace: ws.name });
      }
    }

    return Response.json({ projects: allProjects }, { status: 200, headers: corsHeaders(origin) });
  } catch {
    return Response.json({ error: 'Failed to fetch projects' }, { status: 500, headers: corsHeaders(origin) });
  }
};
