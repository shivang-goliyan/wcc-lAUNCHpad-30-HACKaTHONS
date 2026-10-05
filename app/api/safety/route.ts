// Every final user transcript passes through two checks that don't depend on the chat model
// (docs/TRD.md §11, DECISIONS D20): the deterministic phrase net, then — only if that finds
// nothing — the Jev crisis classifier, which catches paraphrases and skips false alarms.
import { z } from 'zod';
import { checkSafety } from '@/lib/server/safetyCheck';
import { currentHousehold } from '@/lib/server/session';
import { handleError, json } from '@/lib/server/http';

const Body = z.object({ text: z.string().max(2000) });

export async function POST(req: Request) {
  try {
    const hh = await currentHousehold();
    if (!hh) return json({ ok: false, error: 'no_household' }, 401);
    const { text } = Body.parse(await req.json());
    return json(await checkSafety(hh, text));
  } catch (e) {
    return handleError(e);
  }
}
