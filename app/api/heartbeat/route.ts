import { z } from 'zod';
import { runCommand } from '@/lib/db/repo';
import { currentHousehold } from '@/lib/server/session';
import { handleError, json } from '@/lib/server/http';

const Body = z.object({ visibility: z.enum(['visible', 'hidden']) });

export async function POST(req: Request) {
  try {
    const hh = await currentHousehold();
    if (!hh) return json({ ok: false, error: 'no_household' }, 401);
    const { visibility } = Body.parse(await req.json());
    await runCommand(hh, { type: 'device.heartbeat', visibility });
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
