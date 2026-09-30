// What KIND of help the message asks for — before any matching runs.
//
// Two requests the troubleshooting pipeline used to get wrong:
//  - "share camera connection procedure" was pushed into a diagnostic flow
//    ("Camera setup / pairing fails"). Engineers on site often just want the
//    steps; the guided walk-through stays one tap away.
//  - "give me EZVIZ contact details" was answered from the manual ("visit
//    support.ezviz.com") while the directory had the number on file.

// ---- Procedure requests ----
// A procedure verb plus a request framing; a fault word vetoes it, so
// "how to fix camera not connecting" is still a fault.
const PROC_VERB = /\b(connect(ion|ing)?|install(ation|ing)?|commission(ing)?|configur(e|ation|ing)|set ?up|setting up|wir(e|ing)|calibrat(e|ion|ing)|clean(ing)?|replac(e|ement|ing)|mount(ing)?|pair(ing)?|program(ming)?|reset(ting)?|start ?up|shut ?down|servic(e|ing)|maintenance|zero(ing)?|span)\b/i;
const PROC_FRAME = /\b(how (do|to|can|should|does|would) (i|we|one|you)?|how to|steps?|procedure|process|method|instructions?|guide|manual|sop|checklist|share|send|give me|tell me|show me|explain|what is the (procedure|process|way|method)|kaise (kare|karte|karu|karun|hoga|hota)|kaise|तरीका|कैसे)\b/i;
const FAULT = /\b(not|no|isn'?t|doesn'?t|won'?t|can'?t|cannot|fail(s|ed|ing)?|error|alarm|fault|problem|issue|wrong|lost|drop|stuck|dead|blank|offline|nahi|nahin|kharab|band|trip|fix)\b/i;

export function isProcedureRequest(text: string): boolean {
  const q = (text ?? '').trim();
  if (!q || !PROC_VERB.test(q) || !PROC_FRAME.test(q)) return false;
  return !FAULT.test(q);
}

// ---- Contact requests ----
const CONTACT = /\b(contact (details?|number|info|no|person|numbers)|support (number|contact|details?|email|desk|team|line|helpline|centre|center|care|phone)|customer (care|support|service)|helpline|toll.?free|help ?desk|service (centre|center|number)|phone number|mobile number|whatsapp number|email (id|address)|escalat(e|ion)( contact| details?| directory| matrix)?|(vendor|oem|manufacturer|supplier) (support|contact|number|helpline|care)|(who|whom) (do|should|can|to) (i|we)? ?(call|contact|reach|inform|ask)|(who|whom) (to|should) (be )?(call|contact)ed|kisko (call|contact|bulau|bulaye|bataye)|kise (call|contact)|kis(se|ko) baat|(give|share|send|tell|show) (me )?(the |their |its )?(contact|number|support|email|helpline)|contact (of|for)|number (of|for) (the )?(vendor|oem|support|company|manufacturer)|किससे (बात|संपर्क)|संपर्क|हेल्पलाइन)\b/i;

export function isContactRequest(text: string): boolean {
  return CONTACT.test((text ?? '').trim());
}

// Which directory role the message names, if any. Null = offer every role
// that has a contact on file.
export function contactSkillHint(text: string): string | null {
  const q = (text ?? '').toLowerCase();
  if (/(digital ?paani|dp support|support desk|dp team|paani team|our (support|team))/.test(q)) return 'dp_support';
  if (/(electrical|electrician|bijli)/.test(q)) return 'electrical_engineer';
  if (/\b(plc|automation|scada)\b/.test(q)) return 'plc_technician';
  if (/(instrument|calibration (person|engineer|tech))/.test(q)) return 'instrumentation_technician';
  if (/(vendor|oem|manufacturer|supplier|company|customer care|brand)/.test(q)) return 'vendor_support';
  return null;
}
