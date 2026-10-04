// Tool bridge for the realtime voice agent: browser receives a function call → POSTs here.
import { z } from 'zod';
import { executeTool } from '@/lib/agents/tools';
import { currentHousehold } from '@/lib/server/session';
import { handleError, json } from '@/lib/server/http';

const Body = z.object({ args: z.unknown(), lastUserTranscript: z.string().max(2000).nullable().optional(), turnId: z.string().optional() });

export async function POST(req: Request, ctx: RouteContext<'/api/tools/[name]'>) {
  try {
    const hh = await currentHousehold();
    if (!hh) return json({ ok: false, error: 'no_household' }, 401);
    const { name } = await ctx.params;
    const b = Body.parse(await req.json());
    let args = b.args;
    if (typeof args === 'string') args = args ? JSON.parse(args) : {};
    const reply = await executeTool(hh, name, args, { source: 'voice', lastUserTranscript: b.lastUserTranscript ?? null });
    return json(reply);
  } catch (e) {
    return handleError(e);
  }
}
