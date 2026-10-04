// Every final user transcript passes through this deterministic check (docs/TRD.md §11).
import { z } from 'zod';
import { runCommand } from '@/lib/db/repo';
import { crisisMatch } from '@/lib/verify/crisis';
import { currentHousehold } from '@/lib/server/session';
import { handleError, json } from '@/lib/server/http';

const Body = z.object({ text: z.string().max(2000) });

export async function POST(req: Request) {
  try {
    const hh = await currentHousehold();
    if (!hh) return json({ ok: false, error: 'no_household' }, 401);
    const { text } = Body.parse(await req.json());
    const hit = crisisMatch(text);
    if (!hit) return json({ ok: true, matched: null });
    const r = await runCommand(hh, { type: 'help.open', kind: 'distress', quote: text, source: 'voice' });
    return json({ ok: true, matched: hit, reply: r.reply });
  } catch (e) {
    return handleError(e);
  }
}
