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
  troubleshooting: 'Troubleshooting', cleaning: 'Cleaning', calibration: 'Calibration',
  verification: 'Verification & Validation', inspection: 'Inspection',
  electrical: 'Electrical & Signal Checks', configuration: 'Configuration',
  consumable: 'Consumable Replacement', component: 'Component Replacement',
  preventive: 'Preventive Maintenance', corrective: 'Corrective Maintenance',
  data_quality: 'Data Quality Management', install_improve: 'Installation Improvement',
  software: 'Software & Firmware', other: 'Other',
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

  let payload: { query?: string; sensor_model_id?: string | null; mode?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const query = (payload.query ?? '').trim();
  const sensorModelId = payload.sensor_model_id ?? null;
  const mode = payload.mode === 'web' ? 'web' : payload.mode === 'classify' ? 'classify' : 'docs';

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

    const { data: models } = await supabase
      .from('sensor_models')
      .select('id, model_no, name, sensor_makes(name), sensor_categories(id, name)')
      .eq('is_general', false)
      .limit(300);

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

  if (!query) return json({ error: 'empty query' }, 400);

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
