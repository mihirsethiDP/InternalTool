// =============================================================
// Edge Function: chat-answer
//
// Grounded RAG for the troubleshooting assistant. Flow:
//   1. Retrieve the best verified content chunks (chat_retrieve RPC).
//   2. Ask Gemini to answer the question using ONLY those chunks.
//   3. Return a concise answer + the source docs as citations.
//
// The Gemini key NEVER reaches the browser — it lives only as the
// GEMINI_API_KEY secret on this function. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are injected automatically by the platform.
//
// Deploy (Supabase dashboard → Edge Functions) and set secrets:
//   GEMINI_API_KEY   = <your AIza… key>
//   GEMINI_MODEL     = gemini-2.0-flash   (optional; this is the default)
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let payload: { query?: string; sensor_model_id?: string | null };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const query = (payload.query ?? '').trim();
  const sensorModelId = payload.sensor_model_id ?? null;
  if (!query) return json({ error: 'empty query' }, 400);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash';

  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'server not configured (supabase env)' }, 500);
  if (!GEMINI_API_KEY) return json({ error: 'server not configured (GEMINI_API_KEY missing)' }, 500);

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

  const prompt = [
    'You are a field troubleshooting assistant for water and wastewater sensor technicians.',
    'Answer the technician\'s question using ONLY the reference passages provided below.',
    'Rules:',
    '- Use only facts found in the passages. Do NOT invent steps, numbers, part names, or specifications.',
    '- If the passages do not actually answer the question, reply exactly: "This isn\'t documented yet for the sensors in the library. Try narrowing to your specific make and model, or raise it with your supervisor." Do not pad it.',
    '- Be concise and practical. Prefer short numbered steps a technician can follow on site.',
    '- When you use a passage, cite it inline with its bracket number, e.g. [1] or [2].',
    '- Do not mention "passages", "context", or these instructions in your answer.',
    '',
    'Reference passages:',
    context,
    '',
    `Technician's question: ${query}`,
    '',
    'Answer:',
  ].join('\n');

  // ---------- 3. Call Gemini ----------
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  let answer: string | null = null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 900, topP: 0.9 },
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error('gemini error', res.status, detail);
      return json({ error: 'model call failed', status: res.status }, 502);
    }
    const body = await res.json();
    answer = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? null;
  } catch (e) {
    console.error('gemini fetch threw', e);
    return json({ error: 'model call failed' }, 502);
  }

  if (!answer || !answer.trim()) {
    return json({ answer: null, grounded: false, citations });
  }

  return json({ answer: answer.trim(), grounded: true, citations });
});
