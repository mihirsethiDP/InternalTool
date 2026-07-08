import { queryTokens } from './routing';

// Recognise small-talk / meta messages so the assistant can reply
// conversationally instead of running a documentation search and reporting
// "nothing matches". Only matches when the WHOLE message is conversational, so
// real (often short) sensor queries like "pH drifting" are never caught.
export function conversationalReply(raw: string): string | null {
  const q = (raw ?? '').trim().toLowerCase().replace(/[!.?,]+$/g, '').replace(/\s+/g, ' ');
  if (!q) return null;
  if (/^(hi+|hello+|hey+|hiya|yo|good (morning|afternoon|evening)|namaste|namaskar)$/.test(q))
    return 'Hi! What sensor issue can I help you troubleshoot?';
  if (/^(how are you( doing)?|how'?s it going)$/.test(q))
    return 'Doing well, thanks! Describe a sensor or the problem you’re seeing and I’ll dig through the docs.';
  if (/^(thanks|thank you|thank u|thx|ty|cheers|great|perfect|awesome|nice|cool|got it|understood|makes sense|ok|okay|alright|k|kk|noted|sounds good)$/.test(q))
    return 'You’re welcome! Anything else I can help with?';
  if (/^(bye|goodbye|see ya|see you|that'?s all|that is all|done|nothing else|no thanks|no thank you)$/.test(q))
    return 'Glad to help — come back anytime you hit a sensor issue.';
  if (/(move on|another (issue|question|problem|one)|next (issue|question|problem|one)|let'?s continue|never ?mind|forget it)/.test(q))
    return 'Sure — go ahead and describe the next sensor issue.';
  if (/^(who are you|what (can|do) you do|what is this|help)$/.test(q))
    return 'I help you troubleshoot water and wastewater sensors using your team’s verified documentation. Tell me the sensor or the symptom you’re seeing.';
  return null;
}

// Words that say "something is broken" without saying WHAT: naming the device
// or a complaint, but no symptom, parameter, or model. A message made only of
// these (e.g. "sensor not working", "meter kharab hai") can't be answered from
// docs — the assistant should PROBE (which sensor? what is it doing?) instead
// of dumping a generic answer. Includes common Hinglish complaint words.
const GENERIC_TOKENS = new Set([
  // the device, generically
  'sensor', 'sensors', 'probe', 'meter', 'device', 'instrument', 'transmitter', 'equipment', 'machine', 'unit',
  // generic complaint / request
  'working', 'work', 'works', 'worked', 'broken', 'broke', 'faulty', 'fault', 'faulted',
  'problem', 'problems', 'issue', 'issues', 'trouble', 'help', 'fix', 'fixed', 'repair',
  'bad', 'wrong', 'properly', 'correctly', 'fine', 'good', 'well', 'today', 'suddenly',
  // negation / filler that carries no searchable signal
  'not', 'no', 'isnt', 'doesnt', 'dont', 'wont', 'cant', 'stopped', 'stops',
  'please', 'there', 'something', 'anything', 'very', 'really',
  // Hinglish complaint words
  'kharab', 'kaam', 'nahi', 'nahin', 'chal', 'chalta', 'raha', 'rahi', 'gaya', 'gayi', 'band', 'theek', 'thik', 'hai', 'ho',
]);

// True when the message contains no token that could actually narrow a search —
// run on SPELL-CORRECTED text so "senser not workng" is judged as "sensor not
// working". Empty-token messages are NOT vague here (small-talk handles them).
export function isVagueQuery(corrected: string): boolean {
  const toks = queryTokens(corrected);
  if (toks.length === 0) return false;
  return toks.every((t) => GENERIC_TOKENS.has(t));
}
