import { NextResponse, type NextRequest } from 'next/server';
import { createHousehold } from '@/lib/db/repo';
import { setHouseholdCookie } from '@/lib/server/session';
import type { ClinicScenario } from '@/lib/engine/types';

const SCENARIOS: ClinicScenario[] = ['cooperative', 'busy_then_cooperative', 'evening_only', 'asks_for_extra_info', 'no_slots', 'voicemail'];

/**
 * /try                     → fresh sandbox household (simulated clinic, no real calls)
 * /try?clinic=evening_only → sandbox with a different simulated clinic behaviour
 * /try?video=1&key=ADMIN   → "video" household: real Twilio calls to the allow-listed team phones
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const sc = q.get('clinic') as ClinicScenario | null;
  const start = /^([01]\d|2[0-3]):[0-5]\d$/.test(q.get('start') ?? '') ? q.get('start')! : '08:55';
  const video = q.get('video') === '1' && !!process.env.ADMIN_PASSWORD && q.get('key') === process.env.ADMIN_PASSWORD;
  const id = await createHousehold(
    video
      ? {
          kind: 'video',
          phoneCallsEnabled: true,
          startAt: start,
          phones: { clinic: process.env.VIDEO_CLINIC_PHONE || null, arjun: process.env.VIDEO_ARJUN_PHONE || null, recipient: process.env.VIDEO_MEERA_PHONE || null },
        }
      : { scenario: sc && SCENARIOS.includes(sc) ? sc : 'cooperative', startAt: start },
  );
  await setHouseholdCookie(id);
  const next = q.get('next') === '/console' ? '/console' : '/app';
  // behind Caddy req.url is the container's own address (localhost:3000), so go via the public URL
  return NextResponse.redirect(new URL(next, process.env.APP_URL || req.url), 303);
}
