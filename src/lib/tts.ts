// Voice replies via the device's built-in speech synthesis.
//
// Field operators asked for the bot to SPEAK its answers (often in Hindi,
// often with gloves on / phone at arm's length). speechSynthesis is free,
// works offline once voices are installed, and Chrome-on-Android ships an
// hi-IN voice on virtually every device. If field feedback says the voice
// quality isn't enough, this module is the single place to swap in a cloud
// TTS API later — the callers won't change.

// Same i18n-code → BCP-47 map the voice INPUT uses, so Dr. Paani listens and
// speaks in the same language.
const LANG_MAP: Record<string, string> = {
  en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', mr: 'mr-IN',
  te: 'te-IN', ta: 'ta-IN', gu: 'gu-IN', kn: 'kn-IN',
};

export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

// Markdown and UI punctuation read terribly aloud — strip to plain sentences.
export function speakableText(md: string): string {
  return (md ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_#>`~]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\|/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang.startsWith(lang.split('-')[0])) ??
    null
  );
}

export function speak(text: string, i18nLang: string, onDone?: () => void): boolean {
  if (!ttsSupported) return false;
  const plain = speakableText(text);
  if (!plain) return false;
  const lang = LANG_MAP[i18nLang] || 'en-IN';
  window.speechSynthesis.cancel(); // one voice at a time
  const u = new SpeechSynthesisUtterance(plain);
  u.lang = lang;
  const v = pickVoice(lang);
  if (v) u.voice = v;
  u.rate = 0.95; // slightly slower — instructions, not conversation
  u.onend = () => onDone?.();
  u.onerror = () => onDone?.();
  window.speechSynthesis.speak(u);
  return true;
}

export function stopSpeaking() {
  if (ttsSupported) window.speechSynthesis.cancel();
}
