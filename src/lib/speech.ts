import { supabase } from './supabase';

// Push-to-talk voice input.
//
// The browser's SpeechRecognition ends the moment it hears silence, so a
// breath or a mid-sentence pause truncated the message, and its accuracy on
// Indian-accented English was poor (both reported from the field). Here the
// USER decides when the recording ends: we capture with MediaRecorder and send
// the whole clip to Whisper, which is far stronger on accents and on Hinglish
// code-switching, and never cuts anyone off mid-thought.
//
// SpeechRecognition remains as a fallback for browsers without mic capture.

export const recordingSupported =
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== 'undefined';

// Longest single utterance we'll capture. Generous — the point is not to rush
// anyone — but bounded so a forgotten open mic can't upload forever.
export const MAX_RECORDING_MS = 60_000;

function pickMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const c of candidates) {
    try { if (MediaRecorder.isTypeSupported(c)) return c; } catch { /* older browsers throw */ }
  }
  return '';
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  // Chunked so a long clip can't blow the argument limit of String.fromCharCode.
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  return btoa(bin);
}

export interface Recorder {
  /** Finish, transcribe, and release the mic. Returns '' if nothing usable. */
  stop: () => Promise<string>;
  /** Abandon the recording and release the mic — no transcription. */
  cancel: () => void;
}

/**
 * Begin recording. Resolves once the mic is live (so the UI only shows
 * "listening" when it truly is). Throws if permission is denied.
 */
export async function startRecording(lang: string): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  rec.start();

  const release = () => { for (const t of stream.getTracks()) t.stop(); };
  const hardStop = setTimeout(() => { try { if (rec.state === 'recording') rec.stop(); } catch { /* already stopped */ } }, MAX_RECORDING_MS);

  const finished = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: mime || 'audio/webm' }));
  });

  return {
    async stop() {
      clearTimeout(hardStop);
      try { if (rec.state === 'recording') rec.stop(); } catch { /* already stopped */ }
      const blob = await finished;
      release();
      // Sub-second blobs are almost always a mis-tap, not speech.
      if (blob.size < 1200) return '';
      try {
        const { data, error } = await supabase.functions.invoke('chat-answer', {
          body: { mode: 'transcribe', audio: await blobToBase64(blob), mime: blob.type, lang },
        });
        if (error || !data || (data as any).error) {
          console.warn('transcription failed', error ?? (data as any)?.error);
          return '';
        }
        return String((data as any).text ?? '').trim();
      } catch (e) {
        console.warn('transcription threw', e);
        return '';
      }
    },
    cancel() {
      clearTimeout(hardStop);
      try { if (rec.state === 'recording') rec.stop(); } catch { /* already stopped */ }
      release();
    },
  };
}
