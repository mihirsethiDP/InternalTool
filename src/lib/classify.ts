import { supabase } from './supabase';

// AI classification of a document against the sensor catalog — used at upload
// and review to catch a doc filed under the wrong sensor/category. Calls the
// chat-answer Edge Function in `classify` mode (Groq). Best-effort: returns
// null on any failure (the feature is advisory, never blocking on its own).
export interface DocClassification {
  model_id: string;
  model_label: string;
  category_id: string | null;
  category_label: string | null;
  confidence: number; // 0..1
  reason: string;
}

export async function classifyDoc(text: string, title: string): Promise<DocClassification | null> {
  const t = (text ?? '').trim();
  const ttl = (title ?? '').trim();
  if (!t && !ttl) return null;
  try {
    const { data, error } = await supabase.functions.invoke('chat-answer', {
      body: { mode: 'classify', text: t.slice(0, 6000), title: ttl },
    });
    if (error || !data || (data as any).error || !(data as any).suggestion) return null;
    const d = data as any;
    return {
      model_id: d.suggestion.model_id,
      model_label: (d.suggestion.model_label ?? '').trim(),
      category_id: d.suggestion.category_id ?? null,
      category_label: d.suggestion.category_label ?? null,
      confidence: typeof d.confidence === 'number' ? d.confidence : 0,
      reason: d.reason ?? '',
    };
  } catch {
    return null;
  }
}

// A confident, conflicting suggestion is worth surfacing as a mismatch.
export const MISMATCH_CONFIDENCE = 0.5;
