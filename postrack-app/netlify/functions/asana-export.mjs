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

export const config = { maxDuration: 60 };

const ALLOWED_ORIGINS = [
  'https://postrack.netlify.app',
  'http://localhost:8888',
  'http://localhost:5174',
];

const rateMap = new Map();
function checkRate(ip, limit = 5, windowMs = 60000) {
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

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders(origin) });
  }

  // Rate limit
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('client-ip') || 'unknown';
  if (!checkRate(ip)) {
    return Response.json({ error: 'Rate limit exceeded' }, { status: 429, headers: corsHeaders(origin) });
  }

  let body;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400, headers: corsHeaders(origin) });
  }

  // Auth — require team passphrase
  const expected = _envVars.TEAM_PASSPHRASE || process.env.TEAM_PASSPHRASE;
  if (!expected || !body.passphrase || body.passphrase !== expected) {
    return Response.json({ error: 'Unauthorized' }, { status: 403, headers: corsHeaders(origin) });
  }

  const { projectGid, sectionName, phases } = body;

  if (!projectGid || !sectionName || !phases || !Array.isArray(phases) || phases.length === 0) {
    return Response.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders(origin) });
  }
  if (phases.length > 50) {
    return Response.json({ error: 'Too many phases (max 50)' }, { status: 400, headers: corsHeaders(origin) });
  }
  // Validate projectGid is numeric
  if (!/^\d+$/.test(projectGid)) {
    return Response.json({ error: 'Invalid project ID' }, { status: 400, headers: corsHeaders(origin) });
  }

  const token = _envVars.ASANA_PAT || process.env.ASANA_PAT;
  if (!token) {
    return Response.json({ error: 'Asana not configured' }, { status: 500, headers: corsHeaders(origin) });
  }

  const api = async (path, method, data) => {
    const opts = { method, headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } };
    if (data) opts.body = JSON.stringify({ data });
    const res = await fetch('https://app.asana.com/api/1.0' + path, opts);
    const json = await res.json().catch(() => null);
    return { ok: res.ok, data: json?.data, errors: json?.errors };
  };

  try {
    // Create section
    const sec = await api('/projects/' + projectGid + '/sections', 'POST', {
      name: String(sectionName).substring(0, 200),
    });
    if (!sec.ok) return Response.json({ error: 'Failed to create section' }, { status: 502, headers: corsHeaders(origin) });
    const sectionGid = sec.data.gid;

    // Create tasks
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    let created = 0;
    const errors = [];

    for (const phase of phases) {
      const payload = {
        name: String(phase.name || 'Task').substring(0, 200).replace(/\u2014/g, '-'),
        projects: [projectGid],
        notes: 'Type: ' + (phase.type || 'internal') + '\nDuration: ' + (phase.duration || 1) + ' days',
      };

      if (phase.startDate && dateRe.test(phase.startDate)) payload.start_on = phase.startDate;
      if (phase.endDate && dateRe.test(phase.endDate)) payload.due_on = phase.endDate;
      if (payload.start_on && payload.due_on && payload.due_on < payload.start_on) {
        payload.due_on = payload.start_on;
      }

      const task = await api('/tasks', 'POST', payload);
      if (task.ok && task.data?.gid) {
        await api('/sections/' + sectionGid + '/addTask', 'POST', { task: task.data.gid });
        created++;
      } else {
        errors.push({ name: phase.name, msg: 'Failed to create task' });
      }
    }

    return Response.json({
      success: true,
      tasksCreated: created,
      totalPhases: phases.length,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: 200, headers: corsHeaders(origin) });

  } catch {
    return Response.json({ error: 'Failed to export to Asana' }, { status: 500, headers: corsHeaders(origin) });
  }
};
