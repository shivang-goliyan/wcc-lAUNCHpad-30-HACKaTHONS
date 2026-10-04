// Lets judges pick how the simulated clinic behaves (cooperative, evening only, voicemail...).
import { z } from 'zod';
import { sql } from '@/lib/db/client';
import { loadHousehold } from '@/lib/db/repo';
import { buildSimCalendar } from '@/lib/seed';
import { virtualNow } from '@/lib/db/repo';
import { currentHousehold } from '@/lib/server/session';
import { handleError, json } from '@/lib/server/http';

const Body = z.object({ scenario: z.enum(['cooperative', 'busy_then_cooperative', 'evening_only', 'asks_for_extra_info', 'no_slots', 'voicemail']) });

export async function POST(req: Request) {
  try {
    const hh = await currentHousehold();
    if (!hh) return json({ ok: false, error: 'no_household' }, 401);
    const { scenario } = Body.parse(await req.json());
    await sql().begin(async (tx) => {
      const [row] = await tx`SELECT state, clock_offset_ms FROM households WHERE id = ${hh} FOR UPDATE`;
      const state = row.state;
      const clinic = state.clinics[0];
      clinic.simScenario = scenario;
      clinic.simCalendar = buildSimCalendar(virtualNow(row.clock_offset_ms), scenario);
      await tx`UPDATE households SET state = ${tx.json(state)}, version = version + 1 WHERE id = ${hh}`;
      await tx`INSERT INTO events (household_id, at_virtual, category, actor, action, record_type, summary)
        VALUES (${hh}, ${new Date(virtualNow(row.clock_offset_ms))}, 'state', 'system', 'demo_scenario', 'clinic', ${`Simulated clinic behaviour set to “${scenario}” (demo control)`})`;
    });
    void loadHousehold;
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
