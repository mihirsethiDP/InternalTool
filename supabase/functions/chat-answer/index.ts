// =============================================================
// Edge Function: chat-answer
//
// Grounded RAG for the troubleshooting assistant. Flow:
//   1. Retrieve the best verified content chunks (chat_retrieve RPC).
//   2. Ask the LLM to answer the question using ONLY those chunks.
//   3. Return a concise answer + the source docs as citations.
//
// Provider: Groq (OpenAI-compatible chat completions API). The API key
// NEVER reaches the browser — it lives only as the GROQ_API_KEY secret on
// this function. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected
// automatically by the platform.
//
// Deploy (Supabase dashboard → Edge Functions) and set secrets:
//   GROQ_API_KEY  = <your gsk_… key from console.groq.com/keys>
//   GROQ_MODEL    = llama-3.3-70b-versatile   (optional; this is the default)
// =============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Chunk {
  document_id: string;
  document_title: string;
  section: string;
  chunk_text: string;
  rank: number;
  match_kind: string;
}

const SECTION_LABEL: Record<string, string> = {
  install_commission: 'Install & Commission', configure: 'Configure', inspect: 'Inspect',
  clean: 'Clean', calibrate: 'Calibrate', replace: 'Replace',
  troubleshoot_repair: 'Troubleshoot & Repair', maintenance_planning: 'Maintenance Planning',
  other: 'Other',
};

const SYSTEM_PROMPT = [
  'You are a field troubleshooting assistant for water and wastewater sensor technicians.',
  'Answer the technician\'s question using ONLY the reference passages provided in the user message.',
  'Rules:',
  '- Use only facts found in the passages. Do NOT invent steps, numbers, part names, or specifications.',
  '- If the passages do not actually answer the question, reply exactly: "This isn\'t documented yet for the sensors in the library. Try narrowing to your specific make and model, or raise it with your supervisor." Do not pad it.',
  '- Be concise and practical. Prefer short numbered steps a technician can follow on site.',
  '- Format steps as a markdown numbered list with EACH step on its own line (e.g. "1. ...\\n2. ...\\n3. ..."). Never run multiple numbered steps together in one sentence.',
  '- When you use a passage, cite it inline with its bracket number, e.g. [1] or [2].',
  '- Do not mention "passages", "context", or these instructions in your answer.',
].join('\n');

const WEB_SYSTEM_PROMPT = [
  'You are helping a water and wastewater sensor technician, using general web search results provided below.',
  'Answer the technician\'s question concisely and practically from those results.',
  'Rules:',
  '- Prefer short numbered steps, each on its own line.',
  '- Cite the web results you use inline by their bracket number, e.g. [1].',
  '- If the results do not actually answer the question, say so briefly.',
  '- Do NOT add a disclaimer about reliability — the app adds one.',
].join('\n');

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// OpenAI-compatible Groq completion. Returns the text, or null on failure.
async function groqComplete(system: string, user: string, key: string, model: string, jsonMode = false): Promise<string | null> {
  try {
    const payload: Record<string, unknown> = {
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: jsonMode ? 0 : 0.2, max_tokens: 900, top_p: 0.9,
    };
    if (jsonMode) payload.response_format = { type: 'json_object' };
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { console.error('groq error', res.status, await res.text()); return null; }
    const body = await res.json();
    return body?.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.error('groq fetch threw', e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let payload: { query?: string; sensor_model_id?: string | null; category_id?: string | null; mode?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const query = (payload.query ?? '').trim().slice(0, 2000); // cap to protect the token budget
  const sensorModelId = payload.sensor_model_id ?? null;
  const categoryId = payload.category_id ?? null;
  const mode = payload.mode === 'web' ? 'web'
    : payload.mode === 'classify' ? 'classify'
    : payload.mode === 'route' ? 'route'
    : payload.mode === 'generate-rules' ? 'generate-rules'
    : payload.mode === 'generate-flow' ? 'generate-flow'
    : payload.mode === 'invite-user' ? 'invite-user'
    : 'docs';

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
  const MODEL = Deno.env.get('GROQ_MODEL') ?? 'llama-3.3-70b-versatile';

  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'server not configured (supabase env)' }, 500);
  if (!GROQ_API_KEY) return json({ error: 'server not configured (GROQ_API_KEY missing)' }, 500);

  // ---------- CLASSIFY MODE: which catalog sensor does this document describe? ----------
  // Used at upload/review to catch a doc filed under the wrong sensor/category.
  if (mode === 'classify') {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const text = ((payload as any).text ?? '').toString().slice(0, 6000).trim();
    const title = ((payload as any).title ?? '').toString().slice(0, 300).trim();
    if (!text && !title) return json({ error: 'no text to classify' }, 400);

    const { data: models, error: mErr } = await supabase
      .from('sensor_models')
      .select('id, model_no, name, sensor_makes(name), sensor_categories(id, name)')
      .eq('is_general', false)
      .limit(300);
    if (mErr) { console.error('classify catalog error', mErr); return json({ error: 'catalog lookup failed' }, 500); }

    const list = (models ?? []).map((m: any, i: number) => {
      const mk = Array.isArray(m.sensor_makes) ? m.sensor_makes[0] : m.sensor_makes;
      const cat = Array.isArray(m.sensor_categories) ? m.sensor_categories[0] : m.sensor_categories;
      return {
        idx: i + 1,
        id: m.id,
        label: `${mk?.name ?? ''} ${m.model_no || m.name || ''}`.trim(),
        category: cat?.name ?? '',
        category_id: cat?.id ?? null,
      };
    });
    if (list.length === 0) return json({ suggestion: null, confidence: 0, reason: 'empty catalog' });

    const catalogStr = list.map((x) => `${x.idx}. ${x.label} — category: ${x.category}`).join('\n');
    const sys = 'You classify a sensor maintenance/troubleshooting/datasheet document to the single catalog sensor it describes. Choose ONLY from the numbered catalog. If none is a clear match, choose 0. Respond with strict JSON only.';
    const user = [
      `Catalog (numbered):\n${catalogStr}`,
      '',
      `Document title: ${title || '(none)'}`,
      `Document excerpt:\n${text || '(none)'}`,
      '',
      'Return strict JSON: {"index": <catalog number that best matches the document, or 0 if none is a good match>, "confidence": <number 0 to 1>, "reason": "<one short sentence on the deciding evidence>"}',
    ].join('\n');

    const raw = await groqComplete(sys, user, GROQ_API_KEY, MODEL, true);
    let parsed: any = {};
    try { parsed = JSON.parse(raw ?? '{}'); } catch { parsed = {}; }
    const idx = Number(parsed.index) || 0;
    const chosen = list.find((x) => x.idx === idx) ?? null;
    return json({
      suggestion: chosen ? { model_id: chosen.id, model_label: chosen.label, category_id: chosen.category_id, category_label: chosen.category } : null,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      reason: String(parsed.reason ?? '').slice(0, 300),
    });
  }

  // ---------- GENERATE-RULES MODE: propose routing rules from a sensor's procedures ----------
  // AI drafts problem→procedure rules for the router layer; stored as 'proposed'
  // for an admin to approve. No query needed.
  if (mode === 'generate-rules') {
    if (!sensorModelId) return json({ error: 'sensor_model_id required' }, 400);
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // This mode WRITES (deletes + inserts proposed rules) via the service role,
    // which bypasses RLS — so enforce admin here, since verify_jwt only proves
    // authentication, not role.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: who } = await supabase.auth.getUser(token);
    if (!who?.user) return json({ error: 'unauthorized' }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', who.user.id).maybeSingle();
    if ((prof as any)?.role !== 'admin') return json({ error: 'admin only' }, 403);

    const { data: cdoc, error: cErr } = await supabase
      .from('consolidated_docs')
      .select('content_markdown, sensor_models(model_no, name, sensor_makes(name), sensor_categories(name))')
      .eq('sensor_model_id', sensorModelId)
      .maybeSingle();
    if (cErr) { console.error('generate-rules doc lookup error', cErr); return json({ error: 'lookup failed' }, 500); }
    const md = (cdoc as any)?.content_markdown ?? '';
    const KEYS = Object.keys(SECTION_LABEL);
    const present = KEYS.filter((k) => new RegExp(`^##\\s+${k}\\b`, 'im').test(md));
    if (present.length === 0) return json({ rules: [], note: 'no procedures documented yet' });

    const sm = (cdoc as any)?.sensor_models;
    const smObj = Array.isArray(sm) ? sm[0] : sm;
    const mk = smObj ? (Array.isArray(smObj.sensor_makes) ? smObj.sensor_makes[0] : smObj.sensor_makes) : null;
    const label = `${mk?.name ?? ''} ${smObj?.model_no || smObj?.name || ''}`.trim() || 'this sensor';

    const sys = 'You build troubleshooting ROUTING RULES for a water/wastewater sensor. Given the sensor\'s documented procedure sections, list common problem statements a technician might report, each mapped to the section(s) that resolve it. Respond with strict JSON only.';
    const user = [
      `Sensor: ${label}`,
      `Allowed section keys (use only these): ${present.join(', ')}`,
      '',
      `Procedures (markdown):\n${md.slice(0, 6000)}`,
      '',
      'Return strict JSON: {"rules":[{"problem":"<short symptom as a technician would phrase it>","aliases":["<alternate phrasing>"],"sections":["<section key from the allowed list>"],"clarifying_question":"<a question to disambiguate, or empty string>"}]}. Provide 5 to 10 rules. Every section must be from the allowed keys.',
    ].join('\n');

    const raw = await groqComplete(sys, user, GROQ_API_KEY, MODEL, true);
    let parsed: any = {};
    try { parsed = JSON.parse(raw ?? '{}'); } catch { parsed = {}; }
    let rules = (Array.isArray(parsed.rules) ? parsed.rules : []).map((r: any) => ({
      problem: String(r.problem ?? '').slice(0, 200).trim(),
      aliases: Array.isArray(r.aliases) ? r.aliases.map((a: any) => String(a).slice(0, 200).trim()).filter(Boolean).slice(0, 5) : [],
      sections: Array.isArray(r.sections) ? r.sections.filter((s: any) => present.includes(s)) : [],
      clarifying_question: String(r.clarifying_question ?? '').slice(0, 300).trim() || null,
    })).filter((r: any) => r.problem && r.sections.length > 0).slice(0, 12);

    // Insert the fresh batch FIRST, then delete the older proposals — so a
    // failed insert never leaves the sensor with no proposals (avoids data loss).
    if (rules.length === 0) return json({ rules: [], note: 'no rules generated' });
    const stamp = new Date().toISOString();
    const { error: insErr } = await supabase.from('routing_rules').insert(rules.map((r: any) => ({
      sensor_model_id: sensorModelId, problem: r.problem, aliases: r.aliases,
      sections: r.sections, clarifying_question: r.clarifying_question, status: 'proposed', source: 'ai', created_at: stamp,
    })));
    if (insErr) { console.error('generate-rules insert error', insErr); return json({ error: 'could not save rules' }, 502); }
    // Remove the PREVIOUS proposals (created before this batch's timestamp).
    await supabase.from('routing_rules').delete()
      .eq('sensor_model_id', sensorModelId).eq('status', 'proposed').lt('created_at', stamp);
    const { data: fresh } = await supabase
      .from('routing_rules').select('*')
      .eq('sensor_model_id', sensorModelId).eq('status', 'proposed').order('created_at');
    return json({ rules: fresh ?? [] });
  }

  // ---------- GENERATE-FLOW MODE: draft diagnostic decision trees from a doc ----------
  // AI drafts symptom→checks→fix decision trees (with escalation exits) from an
  // APPROVED consolidated document. Saved as 'draft' for an admin to review and
  // approve; only approved flows ever reach the assistant.
  if (mode === 'generate-flow') {
    const docId = ((payload as any).consolidated_doc_id ?? '').toString();
    if (!docId) return json({ error: 'consolidated_doc_id required' }, 400);
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Writes drafts via the service role (bypasses RLS) — enforce admin here.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: who } = await supabase.auth.getUser(token);
    if (!who?.user) return json({ error: 'unauthorized' }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', who.user.id).maybeSingle();
    if ((prof as any)?.role !== 'admin') return json({ error: 'admin only' }, 403);

    const { data: cdoc, error: cErr } = await supabase
      .from('consolidated_docs')
      .select('id, content_markdown, sensor_model_id, sensor_models(model_no, name, is_general, category_id, sensor_makes(name), sensor_categories(id, name))')
      .eq('id', docId)
      .maybeSingle();
    if (cErr || !cdoc) { console.error('generate-flow doc lookup error', cErr); return json({ error: 'doc not found' }, 404); }
    const md = ((cdoc as any).content_markdown ?? '').trim();
    if (md.length < 200) return json({ flows: [], note: 'not enough documented content to build flows' });

    const sm = (cdoc as any).sensor_models;
    const smObj = Array.isArray(sm) ? sm[0] : sm;
    const cat = smObj ? (Array.isArray(smObj.sensor_categories) ? smObj.sensor_categories[0] : smObj.sensor_categories) : null;
    if (!cat?.id) return json({ error: 'doc has no sensor category' }, 400);
    const mk = smObj ? (Array.isArray(smObj.sensor_makes) ? smObj.sensor_makes[0] : smObj.sensor_makes) : null;
    const isGeneral = Boolean(smObj?.is_general);
    const label = isGeneral
      ? `${cat.name} sensors (category-level)`
      : `${mk?.name ?? ''} ${smObj?.model_no || smObj?.name || ''}`.trim() || 'this sensor';

    // The generator may only reference escalation skills that exist in the directory.
    const { data: skills } = await supabase
      .from('escalation_contacts').select('skill_key, label').eq('active', true).order('sort_order');
    const skillList = (skills ?? []) as { skill_key: string; label: string }[];
    const skillKeys = skillList.map((s) => s.skill_key);
    const skillStr = skillList.map((s) => `${s.skill_key} (${s.label})`).join(', ') || 'vendor_support (Sensor vendor support)';

    const sys = [
      'You design DIAGNOSTIC DECISION TREES for water/wastewater sensor technicians, strictly from the provided documentation.',
      'Rules:',
      '- Base every check and action ONLY on the documentation. Do NOT invent steps, values, part names, or wiring details.',
      '- Technicians may be low-literacy: one short instruction per node, simple words, no jargon beyond what the doc uses.',
      '- When the documentation does not cover a branch, end it with an "escalate" node instead of guessing.',
      '- Every question node needs 2+ options. Every path must end in a "resolve" or "escalate" node.',
      '- The assistant ALREADY establishes which sensor the user has before a flow starts. NEVER ask whether the sensor is a particular model ("Is it a VizSens pH?").',
      '- If the documentation covers multiple VARIANTS and their steps genuinely differ, use ONE question node listing the variants as options ("Which type is it?" with one option per variant) — never a chain of yes/no identity questions. If the steps are the same for all variants, do not mention variants at all.',
      '- Questions should be about the SYMPTOM or the result of a check ("Is the display blank?", "Did the reading stabilise?"), not about what equipment the user owns.',
      'Respond with strict JSON only.',
    ].join('\n');
    const user = [
      `Sensor: ${label}`,
      `Allowed escalation skill keys (use ONLY these): ${skillStr}`,
      '',
      `Documentation (markdown):\n${md.slice(0, 9000)}`,
      '',
      'Return strict JSON:',
      '{"flows":[{"title":"<symptom as the technician would say it>",',
      ' "trigger_symptoms":["<3 to 6 alternate phrasings, including vague ones like \'not working\' variants>"],',
      ' "definition":{"start":"<node id>","nodes":[',
      '   {"id":"n1","kind":"question","text":"...","options":[{"label":"Yes","next":"n2"},{"label":"No","next":"n3"}]},',
      '   {"id":"n2","kind":"action","text":"<one concrete step>","source_section":"<section key the step came from>","next":"n4"},',
      '   {"id":"n4","kind":"resolve","text":"<what should now be true>"},',
      '   {"id":"n5","kind":"escalate","skill":"<allowed skill key>","text":"<why this needs them>"}]}}]}',
      'Create 1 to 3 flows for the MOST COMMON problems the documentation actually covers. 5-14 nodes per flow.',
    ].join('\n');

    const raw = await groqComplete(sys, user, GROQ_API_KEY, MODEL, true);
    let parsed: any = {};
    try { parsed = JSON.parse(raw ?? '{}'); } catch { parsed = {}; }

    // Server-side validation mirror: never store a definition the runner can't walk.
    function validateDef(def: any): boolean {
      if (!def || !Array.isArray(def.nodes) || def.nodes.length === 0 || def.nodes.length > 24) return false;
      const ids = new Set<string>();
      for (const n of def.nodes) { if (!n?.id || ids.has(n.id)) return false; ids.add(n.id); }
      if (!def.start || !ids.has(def.start)) return false;
      for (const n of def.nodes) {
        if (!String(n.text ?? '').trim()) return false;
        if (n.kind === 'question') {
          if (!Array.isArray(n.options) || n.options.length < 2) return false;
          for (const o of n.options) if (!o?.label || !ids.has(o.next)) return false;
        } else if (n.kind === 'action') {
          if (!n.next || !ids.has(n.next)) return false;
          if (n.fail_next && !ids.has(n.fail_next)) return false;
        } else if (n.kind === 'escalate') {
          if (!n.skill || !skillKeys.includes(n.skill)) return false;
        } else if (n.kind !== 'resolve') return false;
      }
      return true;
    }

    const flows = (Array.isArray(parsed.flows) ? parsed.flows : [])
      .map((f: any) => ({
        title: String(f.title ?? '').slice(0, 200).trim(),
        trigger_symptoms: Array.isArray(f.trigger_symptoms)
          ? f.trigger_symptoms.map((s: any) => String(s).slice(0, 160).trim()).filter(Boolean).slice(0, 8)
          : [],
        definition: f.definition,
      }))
      .filter((f: any) => f.title && validateDef(f.definition))
      .slice(0, 3);
    if (flows.length === 0) return json({ flows: [], note: 'no valid flows generated' });

    // Insert the fresh drafts FIRST, then delete older drafts from the same
    // source doc — a failed insert never wipes existing drafts.
    const stamp = new Date().toISOString();
    const { error: insErr } = await supabase.from('diagnostic_flows').insert(flows.map((f: any) => ({
      sensor_category_id: cat.id,
      sensor_model_id: isGeneral ? null : (cdoc as any).sensor_model_id,
      title: f.title,
      trigger_symptoms: f.trigger_symptoms,
      definition: f.definition,
      status: 'draft',
      source_doc_id: docId,
      created_by: who.user.id,
      created_at: stamp,
    })));
    if (insErr) { console.error('generate-flow insert error', insErr); return json({ error: 'could not save flows' }, 502); }
    await supabase.from('diagnostic_flows').delete()
      .eq('source_doc_id', docId).eq('status', 'draft').lt('created_at', stamp);
    const { data: fresh } = await supabase
      .from('diagnostic_flows').select('*')
      .eq('source_doc_id', docId).eq('status', 'draft').order('created_at');
    return json({ flows: fresh ?? [] });
  }

  // ---------- INVITE-USER MODE: admin invites a teammate by email ----------
  // Sends Supabase's invite email (the link lands on the app, where the
  // RecoveryGate has the invitee set a password) and pre-creates the profile
  // with the chosen role. Service-role write → admin enforced here.
  if (mode === 'invite-user') {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: who } = await supabase.auth.getUser(token);
    if (!who?.user) return json({ error: 'unauthorized' }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', who.user.id).maybeSingle();
    if ((prof as any)?.role !== 'admin') return json({ error: 'admin only' }, 403);

    const email = ((payload as any).email ?? '').toString().trim().toLowerCase();
    const role = ['viewer', 'uploader', 'admin'].includes((payload as any).role) ? (payload as any).role : 'viewer';
    const fullName = ((payload as any).full_name ?? '').toString().slice(0, 120).trim() || null;
    if (!/^[^@\s]+@digitalpaani\.com$/.test(email)) return json({ error: 'use a @digitalpaani.com email' }, 400);

    const redirectTo = 'https://mihirsethidp.github.io/InternalTool/';
    const { data: invited, error: invErr } = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (invErr) {
      // Most common: the user already exists.
      const msg = /already/i.test(invErr.message) ? 'That email already has an account.' : invErr.message;
      return json({ error: msg }, 400);
    }
    const uid = invited?.user?.id;
    if (uid) {
      await supabase.from('profiles').upsert({ id: uid, email, role, full_name: fullName });
    }
    return json({ ok: true, email, role });
  }

  if (!query) return json({ error: 'empty query' }, 400);

  // ---------- ROUTE MODE: infer the sensor TYPE (category) from the symptom ----------
  // Powers the elicitation layer: rank which sensor categories the user's
  // free-text problem likely belongs to, so the chatbot can lead with the right
  // type instead of demanding a make/model.
  if (mode === 'route') {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    // Only categories that actually have documented models are useful targets.
    const { data: models, error: rErr } = await supabase
      .from('sensor_models')
      .select('sensor_categories(id, name)')
      .eq('is_general', false)
      .limit(2000);
    if (rErr) { console.error('route catalog error', rErr); return json({ error: 'catalog lookup failed' }, 500); }
    const catMap = new Map<string, string>();
    for (const m of (models ?? []) as any[]) {
      const cat = Array.isArray(m.sensor_categories) ? m.sensor_categories[0] : m.sensor_categories;
      if (cat?.id) catMap.set(cat.id, cat.name);
    }
    const cats = [...catMap.entries()].map(([id, name], i) => ({ idx: i + 1, id, name }));
    if (cats.length === 0) return json({ categories: [], top: null });

    // The user may be vague, non-technical, or misspell things ("presure senser
    // not workng") — the model normalizes that AND extracts intent + any
    // make/model actually mentioned, so the client can scope without re-asking.
    const sys = [
      'You interpret a water/wastewater technician\'s free-text message. The writer may be non-technical, vague, use Hinglish, or misspell words — interpret charitably.',
      'Map it to the most likely sensor TYPE (choosing only from the numbered list), classify the INTENT, and extract any sensor make/model the message itself mentions.',
      'Respond with strict JSON only.',
    ].join('\n');
    const user = [
      `Sensor types (numbered):\n${cats.map((c) => `${c.idx}. ${c.name}`).join('\n')}`,
      '',
      `Technician's message: ${query}`,
      '',
      'Return strict JSON: {"ranking": [<type numbers, most likely first, up to 4>], "confidence": <0 to 1 that the top type is correct>,',
      ' "intent": "<troubleshoot | howto | info | other>",',
      ' "vague": <true if the message gives NO concrete symptom, parameter, or model — just "broken/not working"-style complaints — so the assistant should ask what the sensor is doing>,',
      ' "normalized": "<the message restated as one clear English problem statement>",',
      ' "make": "<manufacturer name if the message mentions one, else empty string>",',
      ' "model": "<model number/name if the message mentions one, else empty string>"}',
    ].join('\n');
    const raw = await groqComplete(sys, user, GROQ_API_KEY, MODEL, true);
    let parsed: any = {};
    try { parsed = JSON.parse(raw ?? '{}'); } catch { parsed = {}; }
    const ranking: number[] = Array.isArray(parsed.ranking) ? parsed.ranking : [];
    const ordered = ranking.map((n) => cats.find((c) => c.idx === Number(n))).filter(Boolean) as { id: string; name: string }[];
    // Append any categories the model didn't rank, so the full set is still offered.
    for (const c of cats) if (!ordered.find((o) => o.id === c.id)) ordered.push({ id: c.id, name: c.name });
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    const VALID_INTENTS = ['troubleshoot', 'howto', 'info', 'other'];
    return json({
      categories: ordered.map((c) => ({ id: c.id, name: c.name })),
      top: ordered[0] ? { id: ordered[0].id, name: ordered[0].name, confidence } : null,
      intent: VALID_INTENTS.includes(parsed.intent) ? parsed.intent : 'other',
      vague: parsed.vague === true,
      normalized: String(parsed.normalized ?? '').slice(0, 300) || null,
      slots: {
        make: String(parsed.make ?? '').slice(0, 80) || null,
        model: String(parsed.model ?? '').slice(0, 80) || null,
      },
    });
  }

  // ---------- WEB MODE: search the web (Tavily) → synthesize with Groq ----------
  // Used as an explicit fallback when the verified docs don't answer the
  // question. The result is clearly labelled as unverified web content client-side.
  if (mode === 'web') {
    const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY');
    if (!TAVILY_API_KEY) return json({ error: 'server not configured (TAVILY_API_KEY missing)' }, 500);

    let results: { title: string; url: string; content: string }[] = [];
    try {
      const tRes = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query: `${query} water wastewater sensor troubleshooting`,
          search_depth: 'basic',
          max_results: 5,
          include_answer: false,
        }),
      });
      if (!tRes.ok) {
        console.error('tavily error', tRes.status, await tRes.text());
        return json({ error: 'web search failed', status: tRes.status }, 502);
      }
      const tBody = await tRes.json();
      results = (tBody.results ?? []).map((r: any) => ({ title: r.title, url: r.url, content: r.content ?? '' }));
    } catch (e) {
      console.error('tavily fetch threw', e);
      return json({ error: 'web search failed' }, 502);
    }

    const sources = results.map((r) => ({ title: (r.title ?? '').trim() || r.url, url: r.url }));
    if (results.length === 0) return json({ answer: null, source: 'web', sources: [] });

    const webContext = results.map((r, i) => `[${i + 1}] ${r.title} (${r.url})\n${r.content}`).join('\n\n');
    const webUser = ['Web results:', webContext, '', `Technician's question: ${query}`, '', 'Answer:'].join('\n');
    const webAnswer = await groqComplete(WEB_SYSTEM_PROMPT, webUser, GROQ_API_KEY, MODEL);
    return json({ answer: webAnswer?.trim() || null, source: 'web', sources });
  }

  // ---------- 1. Retrieve verified content ----------
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await supabase.rpc('chat_retrieve', {
    q: query,
    p_sensor_model_id: sensorModelId,
    p_category_id: categoryId,
    p_limit: 8,
  });

  if (error) {
    console.error('chat_retrieve error', error);
    return json({ error: 'retrieval failed' }, 500);
  }

  const chunks = (data ?? []) as Chunk[];

  if (chunks.length === 0) {
    // Nothing in the library — let the client show its "not documented" fallback.
    return json({ answer: null, grounded: false, citations: [] });
  }

  // Group chunks into passages by (document, section) so the bracket numbers in
  // the prompt line up exactly 1:1 with the citations the client renders.
  interface Passage { document_id: string; document_title: string; section: string; text: string }
  const passages: Passage[] = [];
  const byKey = new Map<string, Passage>();
  for (const c of chunks) {
    const key = `${c.document_id}|${c.section}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.text += '\n' + c.chunk_text.trim();
    } else {
      const p: Passage = {
        document_id: c.document_id,
        document_title: c.document_title.trim(),
        section: c.section,
        text: c.chunk_text.trim(),
      };
      byKey.set(key, p);
      passages.push(p);
    }
  }

  const citations = passages.map((p) => ({
    document_id: p.document_id,
    document_title: p.document_title,
    section: p.section,
  }));

  // ---------- 2. Build the grounded prompt ----------
  const context = passages
    .map((p, i) => {
      const label = SECTION_LABEL[p.section] ?? p.section;
      return `[${i + 1}] Source: ${p.document_title} — ${label}\n${p.text}`;
    })
    .join('\n\n');

  const userPrompt = [
    'Reference passages:',
    context,
    '',
    `Technician's question: ${query}`,
    '',
    'Answer:',
  ].join('\n');

  // ---------- 3. Call Groq (OpenAI-compatible) ----------
  let answer: string | null = null;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 900,
        top_p: 0.9,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error('groq error', res.status, detail);
      return json({ error: 'model call failed', status: res.status }, 502);
    }
    const body = await res.json();
    answer = body?.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.error('groq fetch threw', e);
    return json({ error: 'model call failed' }, 502);
  }

  if (!answer || !answer.trim()) {
    return json({ answer: null, grounded: false, citations });
  }

  return json({ answer: answer.trim(), grounded: true, citations });
});
