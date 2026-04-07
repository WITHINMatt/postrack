// Load raw .env for local dev (Netlify CLI encodes/mangles API keys)
const _envVars = {};
try {
  // Try Node.js fs
  const fs = await import('node:fs');
  const path = await import('node:path');
  const url = await import('node:url');
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const envContent = fs.readFileSync(path.resolve(__dirname, '../../.env'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) _envVars[m[1].trim()] = m[2].trim();
  }
} catch {
  try {
    // Try Deno fs
    const envContent = Deno.readTextFileSync(new URL('../../.env', import.meta.url));
    for (const line of envContent.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) _envVars[m[1].trim()] = m[2].trim();
    }
  } catch {
    // In production, env vars are set via Netlify dashboard
  }
}

const SYSTEM_PROMPT = `You are a post-production schedule planning assistant for video/advertising projects.

Given a user's project description, generate a JSON schedule.

## Output Format
Return ONLY valid JSON (no markdown fences, no explanation) with this exact shape:

{
  "projectName": "string",
  "kickoff": "YYYY-MM-DD",
  "delivery": "YYYY-MM-DD or empty string if no hard deadline",
  "bizDays": true,
  "deliverables": { "ctv": number, "social": number, "cutdown": number },
  "teamSize": number (1-10),
  "splitStreams": boolean,
  "finishing": { "color": boolean, "mix": boolean, "resizes": boolean },
  "resizeFormats": number (0-4),
  "selectedFormats": ["9:16","4:5","1:1","16:9"],
  "phases": [array of phase objects]
}

## Phase Object Shape
Each phase:
- "name": string
- "manualDuration": number (duration in business days)
- "manualStartOffset": number (offset in business days from kickoff)
- "enabled": true
- "type": "internal" | "client" | "milestone"

## Phase Types
- "internal": editorial work, revisions, QC, finishing
- "client": client reviews/approvals
- "milestone": delivery moments

## Standard Post-Production Workflow
1. Brief / Asset Handoff (1d, internal)
2. Editorial phases — CTV/Hero, Social, Cutdowns
3. Review cycles — Internal Review -> Client Review (R1) -> Revisions (R1) -> Internal Review (R2) -> Client Review (R2) -> Revisions (R2)
4. Finishing — Color Grade (2d), Audio Mix (2d), Resizes (varies)
5. Final QC (1d, internal)
6. Delivery / Handoff (1d, milestone)

## Duration Guidelines (IMPORTANT: use diminishing returns, not linear scaling)
Editorial durations scale with diminishing returns — more deliverables means less time per unit because workflows get batched, templates are reused, and editors get into a rhythm.

**CTV/Broadcast editorial:**
- 1 spot = 3-5 days
- 2-3 spots = 5-8 days total (not 6-15)
- 4+ spots = 8-12 days total

**Social cuts editorial:**
- 1-3 cuts = 1.5 days each
- 4-10 cuts = ~1 day each (4-10 days total)
- 11-20 cuts = about 8-14 days total
- 20+ cuts = about 12-18 days total (heavy batching)

**Cutdowns:**
- 1-3 = 1 day each
- 4-10 = about 3-6 days total
- 10+ = about 5-8 days total

**Divide editorial days by number of editors assigned to that stream** (minimum 1 day).

**Client review rounds:** 1-2 days each
**Revision rounds:** R1 = 2-3 days, R2 = 1-2 days
**Internal review before every client review:** 1-2 days

## Team Size Recommendations
Recommend an appropriate team size based on the workload:
- Small projects (1-3 total deliverables): 1 editor
- Medium projects (4-10 deliverables): 2 editors
- Large projects (10-20 deliverables): 2-3 editors
- Very large projects (20+ deliverables): 3-4 editors
If the user specifies a team size, use that. Otherwise recommend based on the above.
If teamSize >= 2 and both CTV and Social exist, set splitStreams: true.

## Parallel Streams (splitStreams)
When both CTV and Social exist and teamSize >= 2, set splitStreams: true.
Give each stream its own review cycle with prefixed names:
- "CTV \u2014 Internal Review", "CTV \u2014 Client Review (R1)", "CTV \u2014 Revisions (R1)", etc.
- "Social \u2014 Internal Review", "Social \u2014 Client Review (R1)", etc.
Both editorial phases start at the same offset. The longer stream determines when shared phases (finishing, QC, delivery) begin.

## manualStartOffset Rules
- Brief starts at 0
- Editorial starts at 1 (or after Brief duration)
- Each phase offset = previous phase offset + previous phase duration
- For parallel streams, both editorial phases share the same start offset
- After parallel streams converge, continue from whichever stream ends later

## Key Rules
- Always include Brief/Asset Handoff at start and Delivery/Handoff at end
- Set kickoff to today if not specified
- Return ONLY the JSON object, nothing else

## CRITICAL: Dates are hard limits
- The FIRST phase (Brief) MUST start at offset 0 (the kickoff date)
- The LAST phase (Delivery/Handoff) MUST END on the delivery date — count the business days between kickoff and delivery and make sure the last phase's offset + duration equals that count exactly
- Work BACKWARDS from the delivery date: calculate available business days, then fit all phases within that window
- Compress review cycles, editorial durations, and finishing as needed to fit — every phase minimum 1 day
- If there are more phases than available days, overlap non-dependent work (e.g. color grade and audio mix can run simultaneously at the same offset)
- NEVER generate a schedule that extends past the delivery date`;

// Simple in-memory rate limiting
const rateMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 10 * 60 * 1000; // 10 minutes

function checkRate(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    rateMap.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

const ALLOWED_ORIGINS = [
  'https://postrack.netlify.app',
  'http://localhost:8888',
  'http://localhost:5174',
];

const MAX_PROMPT_LENGTH = 2000;

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

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('client-ip') || 'unknown';
  if (!checkRate(ip)) {
    return Response.json({ error: 'Rate limit exceeded. Try again in a few minutes.' }, { status: 429, headers: corsHeaders(origin) });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400, headers: corsHeaders(origin) });
  }

  const { passphrase, prompt } = body;

  // Validate passphrase — fail closed (required even if env var is missing)
  const expected = _envVars.TEAM_PASSPHRASE || process.env.TEAM_PASSPHRASE;
  if (!expected || !passphrase || passphrase !== expected) {
    return Response.json({ error: 'Invalid team passphrase' }, { status: 403, headers: corsHeaders(origin) });
  }

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return Response.json({ error: 'Prompt is required' }, { status: 400, headers: corsHeaders(origin) });
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return Response.json({ error: `Prompt too long (max ${MAX_PROMPT_LENGTH} characters)` }, { status: 400, headers: corsHeaders(origin) });
  }

  // Prefer raw .env value (Netlify CLI mangles keys), fall back to process.env for production
  const apiKey = _envVars.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-key-here') {
    return Response.json({ error: 'Service not configured' }, { status: 500, headers: corsHeaders(origin) });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const sanitizedPrompt = prompt.trim().substring(0, MAX_PROMPT_LENGTH);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: `Today's date is ${today}.\n\n[Project description below — generate a schedule based on this info]\n${sanitizedPrompt}` },
        ],
      }),
    });

    if (!response.ok) {
      return Response.json({ error: 'AI service temporarily unavailable' }, { status: 502, headers: corsHeaders(origin) });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text;

    if (!text) {
      return Response.json({ error: 'Empty response from AI' }, { status: 502, headers: corsHeaders(origin) });
    }

    // Parse and validate the JSON
    let schedule;
    try {
      schedule = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        schedule = JSON.parse(match[0]);
      } else {
        return Response.json({ error: 'AI returned an invalid response. Try again.' }, { status: 502, headers: corsHeaders(origin) });
      }
    }

    // Validate required fields
    if (!schedule.phases || !Array.isArray(schedule.phases) || schedule.phases.length === 0) {
      return Response.json({ error: 'AI response missing schedule phases' }, { status: 502, headers: corsHeaders(origin) });
    }

    // Sanitize response — only pass through expected fields
    const clean = {
      projectName: String(schedule.projectName || 'Untitled Project').substring(0, 200),
      kickoff: String(schedule.kickoff || '').substring(0, 10),
      delivery: String(schedule.delivery || '').substring(0, 10),
      bizDays: !!schedule.bizDays,
      deliverables: {
        ctv: Math.max(0, Math.min(99, parseInt(schedule.deliverables?.ctv) || 0)),
        social: Math.max(0, Math.min(99, parseInt(schedule.deliverables?.social) || 0)),
        cutdown: Math.max(0, Math.min(99, parseInt(schedule.deliverables?.cutdown) || 0)),
      },
      teamSize: Math.max(1, Math.min(10, parseInt(schedule.teamSize) || 1)),
      splitStreams: !!schedule.splitStreams,
      finishing: {
        color: !!schedule.finishing?.color,
        mix: !!schedule.finishing?.mix,
        resizes: !!schedule.finishing?.resizes,
      },
      resizeFormats: Math.max(0, Math.min(4, parseInt(schedule.resizeFormats) || 0)),
      selectedFormats: (schedule.selectedFormats || []).filter(f => ['9:16', '4:5', '1:1', '16:9'].includes(f)),
      phases: schedule.phases.slice(0, 50).map(p => ({
        name: String(p.name || 'Phase').substring(0, 100),
        manualDuration: Math.max(1, Math.min(99, parseInt(p.manualDuration) || 1)),
        manualStartOffset: Math.max(0, Math.min(999, parseInt(p.manualStartOffset) || 0)),
        enabled: p.enabled !== false,
        type: ['internal', 'client', 'milestone'].includes(p.type) ? p.type : 'internal',
      })),
    };

    return Response.json({ schedule: clean }, { status: 200, headers: corsHeaders(origin) });

  } catch {
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500, headers: corsHeaders(origin) });
  }
};
