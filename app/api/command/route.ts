// Commands from on-screen controls (buttons, keyboard, switch). Same engine path as voice.
import { z } from 'zod';
import { runCommand } from '@/lib/db/repo';
import { currentHousehold } from '@/lib/server/session';
import { handleError, json } from '@/lib/server/http';

const src = z.enum(['button', 'keyboard', 'switch']);
const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Cmd = z.discriminatedUnion('type', [
  z.object({ type: z.literal('reminder.respond'), occurrenceId: z.string().nullable().optional(), response: z.enum(['taken', 'not_taken', 'snooze', 'help', 'done']), snoozeMinutes: z.number().int().min(10).max(120).optional(), source: src }),
  z.object({ type: z.literal('checkin.respond'), source: src }),
  z.object({ type: z.literal('help.open'), kind: z.literal('explicit_help'), source: src }),
  z.object({ type: z.literal('help.mistake'), caseId: z.string(), source: src }),
  z.object({ type: z.literal('pending.confirm'), pendingId: z.string(), source: src }),
  z.object({ type: z.literal('pending.decline'), pendingId: z.string(), source: src }),
  z.object({ type: z.literal('appointment.propose'), clinicId: z.string(), dateFrom: iso, dateTo: iso, window: z.enum(['morning', 'afternoon', 'evening', 'any']), reason: z.enum(['follow_up', 'new_concern', 'test_results', 'other']) }),
  z.object({ type: z.literal('family.propose'), contact: z.enum(['primary', 'backup']), reason: z.string().max(80), message: z.string().max(200).nullable().optional() }),
  z.object({ type: z.literal('memory.delete'), memoryId: z.string() }),
  z.object({ type: z.literal('ui.quiet'), minutes: z.number().int().min(5).max(240) }),
]);

export async function POST(req: Request) {
  try {
    const hh = await currentHousehold();
    if (!hh) return json({ ok: false, error: 'no_household' }, 401);
    const c = Cmd.parse(await req.json());
    const cmd =
      c.type === 'pending.confirm'
        ? { type: 'pending.confirm' as const, pendingId: c.pendingId, confirmation: { source: c.source } }
        : c.type === 'help.open'
          ? { ...c, quote: null }
          : c;
    const r = await runCommand(hh, cmd);
    return json({ ok: !r.rejected, reply: r.reply, rejected: r.rejected });
  } catch (e) {
    return handleError(e);
  }
}
