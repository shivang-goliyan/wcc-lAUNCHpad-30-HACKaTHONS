// The two crisis checks that don't depend on the chat model (TRD §11, D20), for any final
// transcript: the deterministic phrase net, then the Jev classifier if the net finds nothing.
import { runCommand } from '@/lib/db/repo';
import { crisisMatch } from '@/lib/verify/crisis';
import { dangerDecision } from '@/lib/verify/danger';
import { dangerProbabilities } from '@/lib/server/jev';

export async function checkSafety(hh: string, text: string) {
  const hit = crisisMatch(text);
  if (hit) {
    const r = await runCommand(hh, { type: 'help.open', kind: 'distress', quote: text, source: 'voice' });
    return { ok: true, matched: hit as string | null, by: 'phrase_net', reply: r.reply };
  }
  const jev = await dangerProbabilities(text);
  if (!jev) return { ok: true, matched: null };
  const d = dangerDecision(jev.probs);
  if (!d.open || !d.helpKind) return { ok: true, matched: null, danger: d.danger };
  const r = await runCommand(hh, { type: 'help.open', kind: d.helpKind, quote: text, source: 'voice' });
  return { ok: true, matched: d.kind as string | null, by: 'classifier', danger: d.danger, ms: jev.ms, reply: r.reply };
}
