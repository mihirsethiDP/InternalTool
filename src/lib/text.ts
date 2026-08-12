// Strip characters Postgres and JSON can't carry.
//
// PDF extraction emits NUL for some embedded fonts. A Postgres text/jsonb
// column cannot store it, so the submission insert failed in the field with
// "unsupported Unicode escape sequence" (hit on a UPC MAG-110 manual).
// Unpaired surrogates break JSON encoding the same way. Everything removed
// here is extraction noise — never real document content.
//
// Written as code-point arithmetic rather than a regex on purpose: escape
// sequences for control characters are easy to mangle in source, and this is
// the guard that keeps one bad byte from breaking every upload.
export function sanitizeText(t: string): string {
  let out = '';
  // for..of iterates CODE POINTS, so a valid surrogate pair arrives as one
  // code point above 0xFFFF and survives; only unpaired halves fall in the
  // 0xD800-0xDFFF range below and get dropped.
  for (const ch of (t ?? '')) {
    const c = ch.codePointAt(0) as number;
    if (c === 0) continue;                                      // NUL: Postgres cannot store it
    if (c < 0x20 && c !== 9 && c !== 10 && c !== 13) continue;  // C0 (tab/LF/CR kept)
    if (c >= 0x7f && c <= 0x9f) continue;                       // DEL + C1
    if (c >= 0xd800 && c <= 0xdfff) continue;                   // unpaired surrogate
    out += ch;
  }
  return out;
}
