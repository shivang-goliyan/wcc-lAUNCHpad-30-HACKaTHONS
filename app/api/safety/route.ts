// Every final user transcript passes through two checks that don't depend on the chat model
// (docs/TRD.md §11, DECISIONS D20): the deterministic phrase net, then — only if that finds
// nothing — the Jev crisis classifier, which catches paraphrases and skips false alarms.
import { z } from 'zod';
import { runCommand } from '@/lib/db/repo';
import { crisisMatch } from '@/lib/verify/crisis';
import { dangerDecision } from '@/lib/verify/danger';
import { dangerProbabilities } from '@/lib/server/jev';
import { currentHousehold } from '@/lib/server/session';
import { handleError, json } from '@/lib/server/http';

const Body = z.object({ text: z.string().max(2000) });

export async function POST(req: Request) {
  try {
    const hh = await currentHousehold();
    if (!hh) return json({ ok: false, error: 'no_household' }, 401);
    const { text } = Body.parse(await req.json());

    const hit = crisisMatch(text);
    if (hit) {
      const r = await runCommand(hh, { type: 'help.open', kind: 'distress', quote: text, source: 'voice' });
      return json({ ok: true, matched: hit, by: 'phrase_net', reply: r.reply });
    }

    const jev = await dangerProbabilities(text);
    if (!jev) return json({ ok: true, matched: null });
    const d = dangerDecision(jev.probs);
    if (!d.open || !d.helpKind) return json({ ok: true, matched: null, danger: d.danger });
    const r = await runCommand(hh, { type: 'help.open', kind: d.helpKind, quote: text, source: 'voice' });
    return json({ ok: true, matched: d.kind, by: 'classifier', danger: d.danger, ms: jev.ms, reply: r.reply });
  } catch (e) {
    return handleError(e);
  }
}
