import { z } from 'zod';
import { runCommand } from '@/lib/db/repo';
import { verifyContactToken } from '@/lib/server/session';
import { handleError, json } from '@/lib/server/http';

const Body = z.object({ caseId: z.string(), action: z.enum(['accept', 'decline', 'spoke', 'still_needs_help']), note: z.string().max(300).nullable().optional() });

export async function POST(req: Request, ctx: RouteContext<'/api/care/[token]/action'>) {
  try {
    const { token } = await ctx.params;
    const t = await verifyContactToken(token);
    if (!t) return json({ ok: false, error: 'invalid_or_expired_link' }, 401);
    const b = Body.parse(await req.json());
    const r = await runCommand(t.hh, { type: 'case.contactAction', caseId: b.caseId, contactId: t.contactId, action: b.action, note: b.note ?? null, source: 'link' });
    return json({ ok: !r.rejected, reply: r.reply, rejected: r.rejected });
  } catch (e) {
    return handleError(e);
  }
}
