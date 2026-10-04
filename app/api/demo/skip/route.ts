import { runCommand } from '@/lib/db/repo';
import { currentHousehold } from '@/lib/server/session';
import { handleError, json } from '@/lib/server/http';

export async function POST() {
  try {
    const hh = await currentHousehold();
    if (!hh) return json({ ok: false, error: 'no_household' }, 401);
    const r = await runCommand(hh, null, { clockJumpTo: 'next' });
    return json({ ok: true, now: r.now });
  } catch (e) {
    return handleError(e);
  }
}
