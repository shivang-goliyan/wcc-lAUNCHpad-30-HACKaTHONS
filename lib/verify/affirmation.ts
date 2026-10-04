// Deterministic consent check: a consequential action is confirmed only if the
// user's *own* latest words are affirmative (the model's claim is never enough).
// Note: "na" is deliberately not a negation — "kar do na" means "please do it".

const NEGATIVE = [
  'nahi', 'nahin', 'nai', 'nhi', 'mat', 'no', 'nope', "don't", 'dont', 'do not', 'not now', 'cancel', 'ruko', 'ruk jao', 'abhi nahi', 'baad mein', 'later', 'stop', 'wait',
  'नहीं', 'नही', 'मत', 'रुको', 'रुकिए', 'बाद में', 'अभी नहीं', 'कैंसल',
];

const POSITIVE = [
  'haan', 'han', 'haa', 'ha', 'haanji', 'haan ji', 'ji haan', 'ji', 'jee', 'yes', 'yeah', 'yep', 'yup', 'ok', 'okay', 'theek hai', 'thik hai', 'theek', 'thik',
  'kar do', 'kardo', 'kar dijiye', 'kijiye', 'karo', 'confirm', 'confirmed', 'sure', 'bilkul', 'zaroor', 'jaroor', 'go ahead', 'please do', 'do it', 'chalega', 'sahi hai',
  'हाँ', 'हां', 'हा', 'जी', 'जी हाँ', 'ठीक है', 'ठीक', 'कर दो', 'कर दीजिए', 'कीजिए', 'बिल्कुल', 'ज़रूर', 'जरूर', 'चलेगा', 'सही है', 'कन्फर्म',
];

function normalise(text: string) {
  return ` ${text
    .toLowerCase()
    .replace(/[।॥.,!?;:"“”'‘’()\-–—…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

function hits(norm: string, words: string[]) {
  return words.filter((w) => norm.includes(` ${w} `));
}

export type AffirmationResult = { ok: boolean; matched: string[]; reason: string };

export function checkAffirmation(text: string | null | undefined): AffirmationResult {
  if (!text || !text.trim()) return { ok: false, matched: [], reason: 'no_transcript' };
  const norm = normalise(text);
  const neg = hits(norm, NEGATIVE);
  if (neg.length) return { ok: false, matched: neg, reason: 'negation' };
  const pos = hits(norm, POSITIVE);
  if (!pos.length) return { ok: false, matched: [], reason: 'not_affirmative' };
  return { ok: true, matched: pos, reason: 'affirmative' };
}
