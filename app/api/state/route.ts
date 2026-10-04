import type { NextRequest } from 'next/server';
import { appSnapshot } from '@/lib/server/snapshot';
import { currentHousehold } from '@/lib/server/session';
import { handleError, json } from '@/lib/server/http';

export async function GET(req: NextRequest) {
  try {
    const hh = await currentHousehold();
    if (!hh) return json({ ok: false, error: 'no_household' }, 401);
    const snap = await appSnapshot(hh, { origin: process.env.APP_URL?.replace(/\/$/, '') || req.nextUrl.origin });
    if (!snap) return json({ ok: false, error: 'no_household' }, 401);
    return json({ ok: true, ...snap });
  } catch (e) {
    return handleError(e);
  }
}
