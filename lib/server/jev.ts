// TypeSafe Jev as a crisis classifier. Returns null when it isn't configured, is slow
// or fails: the deterministic phrase net never depends on it.
import { DANGER_CRITERIA, type Probabilities } from '@/lib/verify/danger';

const URL = 'https://api.typesafe.ai/v1/systemone';

export async function dangerProbabilities(text: string, timeoutMs = 2500): Promise<{ probs: Probabilities; ms: number } | null> {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key || process.env.KILL_SWITCH_JEV === 'true') return null;
  const t = Date.now();
  try {
    const r = await fetch(URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.JEV_MODEL || 'jev-latest',
        state: { meera_said: text },
        questions: {
          kind: {
            type: 'choice',
            instructions: 'What is Meera ji (an older woman living alone) telling her companion about herself, right now? Choose the single best fit.',
            criteria: DANGER_CRITERIA,
          },
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as { answers?: { kind?: { probabilities?: Probabilities } } };
    const probs = d.answers?.kind?.probabilities;
    return probs ? { probs, ms: Date.now() - t } : null;
  } catch {
    return null;
  }
}
