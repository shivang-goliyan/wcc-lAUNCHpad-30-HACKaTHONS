import { NextResponse, type NextRequest } from 'next/server';
import { createHousehold } from '@/lib/db/repo';
import { setHouseholdCookie } from '@/lib/server/session';
import type { ClinicScenario } from '@/lib/engine/types';

const SCENARIOS: ClinicScenario[] = ['cooperative', 'busy_then_cooperative', 'evening_only', 'asks_for_extra_info', 'no_slots', 'voicemail'];

export async function GET(req: NextRequest) {
  const sc = req.nextUrl.searchParams.get('clinic') as ClinicScenario | null;
  const id = await createHousehold({ scenario: sc && SCENARIOS.includes(sc) ? sc : 'cooperative' });
  await setHouseholdCookie(id);
  return NextResponse.redirect(new URL('/app', req.url), 303);
}
