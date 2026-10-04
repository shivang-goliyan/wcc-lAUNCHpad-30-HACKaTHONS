import { sql } from '@/lib/db/client';
import { currentHousehold } from '@/lib/server/session';
import { handleError, json } from '@/lib/server/http';

export async function GET(_: Request, ctx: RouteContext<'/api/calls/[id]'>) {
  try {
    const hh = await currentHousehold();
    if (!hh) return json({ ok: false, error: 'no_household' }, 401);
    const { id } = await ctx.params;
    const rows = await sql()`SELECT id, purpose, adapter, state, transcript, extracted, extractor, disclosure, started_at, ended_at FROM call_sessions WHERE id = ${id} AND household_id = ${hh}`;
    if (!rows.length) return json({ ok: false, error: 'not_found' }, 404);
    return json({ ok: true, call: rows[0] });
  } catch (e) {
    return handleError(e);
  }
}
