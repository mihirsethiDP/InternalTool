import { supabase } from './supabase';

// Look at a freshly-picked document and suggest how to file it: which activity
// types it covers (a manual usually covers several) and which catalogued
// sensor it belongs to. Everything is a SUGGESTION — the upload form
// pre-fills from it and the uploader can override every field.
// Best-effort: returns nulls on any failure so upload never depends on AI.

export interface DetectedSection { key: string; confidence: number }
export interface DetectedModel { id: string; make_id: string | null; label: string; confidence: number }

export interface UploadAnalysis {
  sections: DetectedSection[]; // most prominent first
  model: DetectedModel | null;
}

export async function analyzeUpload(text: string, title: string): Promise<UploadAnalysis | null> {
  const t = (text ?? '').trim();
  if (t.length < 100) return null;
  try {
    const { data, error } = await supabase.functions.invoke('chat-answer', {
      body: { mode: 'analyze-upload', text: t.slice(0, 12000), title: (title ?? '').trim() },
    });
    if (error || !data || (data as any).error) return null;
    const d = data as any;
    return {
      sections: Array.isArray(d.sections) ? d.sections : [],
      model: d.model ?? null,
    };
  } catch {
    return null;
  }
}

// Confident enough to auto-select the field (below this we only hint).
export const AUTOFILL_CONFIDENCE = 0.6;
