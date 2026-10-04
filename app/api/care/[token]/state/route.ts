import { careSnapshot } from '@/lib/server/snapshot';
import { verifyContactToken } from '@/lib/server/session';
import { handleError, json } from '@/lib/server/http';

export async function GET(_: Request, ctx: RouteContext<'/api/care/[token]/state'>) {
  try {
    const { token } = await ctx.params;
    const t = await verifyContactToken(token);
    if (!t) return json({ ok: false, error: 'invalid_or_expired_link' }, 401);
    const snap = await careSnapshot(t.hh, t.contactId);
    if (!snap) return json({ ok: false, error: 'not_found' }, 404);
    return json({ ok: true, ...snap });
  } catch (e) {
    return handleError(e);
  }
}
