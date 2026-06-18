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
