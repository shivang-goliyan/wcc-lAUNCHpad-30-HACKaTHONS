// Second safety layer (docs/DECISIONS.md D20): a typed classifier (TypeSafe Jev) reads
// what she said and returns probabilities. This file only turns those numbers into a
// decision, so the rule is plain code and tested; the network call lives in lib/server/jev.ts.

export type DangerKind = 'self_harm' | 'fall_or_injury' | 'medical_emergency';
export type Probabilities = Partial<Record<DangerKind | 'none', number>>;

/** open a help case at or above this much probability on any danger category */
export const DANGER_MIN = 0.7;

export const DANGER_CRITERIA: Record<DangerKind | 'none', string> = {
  self_harm: 'She says she wants to die, does not want to live, or wants to hurt or kill herself, directly or indirectly, in English, Hindi or Hinglish.',
  fall_or_injury: "She says SHE has fallen, is hurt or injured, or cannot get up right now (e.g. 'gir gayi hoon', 'मैं गिर गई').",
  medical_emergency:
    "She reports a serious symptom happening to her now: chest pain or pressure (e.g. 'seene mein dard', 'सीने में दर्द'), cannot breathe ('saans nahi aa rahi'), fainting, sudden weakness on one side, heavy bleeding.",
  none: 'Anything else: ordinary chat, objects falling (medicine, glasses), memories or past events, sleep, mild everyday aches, or things about other people.',
};

/** Which help case to open, if any. Danger is the total probability outside "none". */
export function dangerDecision(p: Probabilities): { open: boolean; kind: DangerKind | null; danger: number; helpKind: 'distress' | 'explicit_help' | null } {
  const kinds: DangerKind[] = ['self_harm', 'fall_or_injury', 'medical_emergency'];
  const danger = kinds.reduce((s, k) => s + (p[k] ?? 0), 0);
  const kind = kinds.reduce<DangerKind | null>((best, k) => ((p[k] ?? 0) > (best ? (p[best] ?? 0) : 0) ? k : best), null);
  if (danger < DANGER_MIN || !kind) return { open: false, kind: null, danger, helpKind: null };
  return { open: true, kind, danger, helpKind: kind === 'self_harm' ? 'distress' : 'explicit_help' };
}
