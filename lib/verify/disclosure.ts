// Deterministic data-minimisation check over what OUR agent said on a call.

export type DisclosureViolation = { kind: string; match: string };

const PATTERNS: Array<[string, RegExp]> = [
  ['phone_number', /(?:\+?\d[\d\s-]{8,}\d)/g],
  ['aadhaar_like', /\b\d{4}\s?\d{4}\s?\d{4}\b/g],
  ['date_of_birth', /\b\d{1,2}[/.-]\d{1,2}[/.-](?:19|20)?\d{2}\b/g],
  ['email', /[\w.+-]+@[\w-]+\.[\w.]+/g],
  ['address', /\b(?:house|flat|plot)\s*(?:no\.?|number)\s*\d+/gi],
];

export function checkDisclosure(agentTurns: string[], opts: { forbiddenWords?: string[] } = {}): DisclosureViolation[] {
  const out: DisclosureViolation[] = [];
  for (const turn of agentTurns) {
    for (const [kind, re] of PATTERNS) {
      for (const m of turn.matchAll(re)) out.push({ kind, match: m[0] });
    }
    for (const w of opts.forbiddenWords ?? []) {
      if (w && turn.toLowerCase().includes(w.toLowerCase())) out.push({ kind: 'forbidden_detail', match: w });
    }
  }
  return out;
}
