// Persistence for the engine: one transaction per command, household row locked FOR UPDATE.
import { randomBytes } from 'node:crypto';
import { decide, nextWakeAt, tick, type Command } from '../engine/engine';
import { EngineReject, type EngineEvent, type Effect, type HouseholdState, type ToolReply } from '../engine/types';
import { demoOffsetFor, seedHousehold, type SeedOptions } from '../seed';
import type { ClinicScenario } from '../engine/types';
import type { TransactionSql } from 'postgres';
import { ensureSchema, sql } from './client';

export type HouseholdRow = {
  id: string;
  kind: 'sandbox' | 'video';
  state: HouseholdState;
  version: number;
  clock_offset_ms: string | number;
  next_wake_at: Date | null;
};

export const virtualNow = (offset: number | string, real = Date.now()) => real + Number(offset);

export async function createHousehold(opts: { kind?: 'sandbox' | 'video'; scenario?: ClinicScenario; startAt?: string; phoneCallsEnabled?: boolean; phones?: SeedOptions['phones'] } = {}) {
  await ensureSchema();
  const id = `hh_${randomBytes(9).toString('base64url')}`;
  const real = Date.now();
  const offset = demoOffsetFor(real, opts.startAt ?? '08:55');
  const now = real + offset;
  const state = seedHousehold({ now, scenario: opts.scenario, phoneCallsEnabled: opts.phoneCallsEnabled, phones: opts.phones });
  const first = tick(state, now);
  const wake = nextWakeAt(first.state, now);
  const kind = opts.kind ?? 'sandbox';
  const db = sql();
  await db.begin(async (tx) => {
    await tx`INSERT INTO households (id, kind, state, clock_offset_ms, next_wake_at, expires_at)
      VALUES (${id}, ${kind}, ${tx.json(first.state as never)}, ${offset}, ${wake ? new Date(wake - offset) : null},
              ${kind === 'sandbox' ? new Date(real + 48 * 3600_000) : null})`;
    await insertEvents(tx, id, [
      { at: now, category: 'state', actor: 'system', action: 'household_created', recordType: 'household', recordId: id, summary: `Demo household created for Meera Sharma (${kind}). Demo clock starts at ${opts.startAt ?? '08:55'} IST.` },
      ...first.events,
    ]);
  });
  return id;
}

type Tx = TransactionSql<Record<string, never>>;

async function insertEvents(tx: Tx, hh: string, events: EngineEvent[]) {
  for (const e of events) {
    await tx`INSERT INTO events (household_id, at_virtual, category, actor, action, record_type, record_id, summary, detail)
      VALUES (${hh}, ${new Date(e.at)}, ${e.category}, ${e.actor}, ${e.action}, ${e.recordType}, ${e.recordId}, ${e.summary}, ${e.detail ? tx.json(e.detail as never) : null})`;
  }
}

async function insertEffects(tx: Tx, hh: string, effects: Effect[]) {
  for (const f of effects) {
    await tx`INSERT INTO outbox (household_id, key, kind, payload) VALUES (${hh}, ${f.key}, ${f.kind}, ${tx.json(f.payload as never)})
      ON CONFLICT (key) DO NOTHING`;
  }
}

export type RunResult = { state: HouseholdState; reply: ToolReply | null; now: number; offset: number; rejected?: { code: string; message: string } };

/**
 * Runs tick (always) and an optional command atomically for one household.
 * `clockJumpTo`: virtual time to jump to before ticking (demo skip).
 */
export async function runCommand(hh: string, cmd: Command | null, opts: { clockJumpTo?: number | 'next' } = {}): Promise<RunResult> {
  await ensureSchema();
  const db = sql();
  let out!: RunResult;
  await db.begin(async (tx) => {
    const rows = await tx<HouseholdRow[]>`SELECT id, kind, state, version, clock_offset_ms, next_wake_at FROM households WHERE id = ${hh} FOR UPDATE`;
    if (!rows.length) throw new EngineReject('no_household', 'Unknown household');
    const row = rows[0];
    let offset = Number(row.clock_offset_ms);
    let now = virtualNow(offset);
    const events: EngineEvent[] = [];
    const effects: Effect[] = [];
    let state = row.state;

    if (opts.clockJumpTo !== undefined) {
      const target = opts.clockJumpTo === 'next' ? nextWakeAt(state, now) : opts.clockJumpTo;
      if (target && target > now) {
        events.push({ at: now, category: 'state', actor: 'system', action: 'demo_clock_skip', recordType: 'clock', recordId: null, summary: `⏩ Demo clock skipped ahead ${Math.round((target - now) / 60000)} min (labelled demo time)` });
        offset += target - now;
        now = target;
      }
    }

    const t = tick(state, now);
    state = t.state;
    events.push(...t.events);
    effects.push(...t.effects);
    let reply: ToolReply | null = null;
    let rejected: RunResult['rejected'];
    if (cmd) {
      try {
        const r = decide(state, cmd, now);
        state = r.state;
        events.push(...r.events);
        effects.push(...r.effects);
        reply = r.reply;
      } catch (e) {
        if (!(e instanceof EngineReject)) throw e;
        rejected = { code: e.code, message: e.message };
        reply = { ok: false, status: e.code, sayHint: e.sayHint ?? e.message };
        events.push({ at: now, category: 'state', actor: 'engine', action: 'command_rejected', recordType: 'command', recordId: null, summary: `Rejected “${cmd.type}”: ${e.message}`, detail: { code: e.code } });
      }
    }
    const wake = nextWakeAt(state, now);
    await tx`UPDATE households SET state = ${tx.json(state as never)}, version = version + 1, clock_offset_ms = ${offset},
      next_wake_at = ${wake ? new Date(wake - offset) : null}, updated_at = now() WHERE id = ${hh}`;
    await insertEvents(tx, hh, events);
    await insertEffects(tx, hh, effects);
    out = { state, reply, now, offset, rejected };
  });
  return out;
}

export async function loadHousehold(hh: string) {
  await ensureSchema();
  const rows = await sql()<HouseholdRow[]>`SELECT id, kind, state, version, clock_offset_ms, next_wake_at FROM households WHERE id = ${hh}`;
  return rows[0] ?? null;
}

export async function recentEvents(hh: string, limit = 80) {
  return sql()`SELECT id, at_virtual, at_real, category, actor, action, record_type, record_id, summary, detail FROM events
    WHERE household_id = ${hh} ORDER BY id DESC LIMIT ${limit}`;
}

export async function recentCalls(hh: string, limit = 6) {
  return sql()`SELECT id, purpose, adapter, related_id, state, transcript, extracted, extractor, disclosure, started_at, ended_at, created_at, brief->>'scenario' AS scenario
    FROM call_sessions WHERE household_id = ${hh} ORDER BY created_at DESC LIMIT ${limit}`;
}

export async function dueHouseholds(limit = 50) {
  await ensureSchema();
  const rows = await sql()<{ id: string }[]>`SELECT id FROM households WHERE next_wake_at IS NOT NULL AND next_wake_at <= now()
    AND (expires_at IS NULL OR expires_at > now()) ORDER BY next_wake_at LIMIT ${limit}`;
  return rows.map((r) => r.id);
}
