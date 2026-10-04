import { createHash } from 'node:crypto';
import { sql } from '../db/client';

export const LIMITS = {
  maxSessionSec: Number(process.env.VOICE_MAX_SESSION_SEC ?? 300),
  perIpPerHour: Number(process.env.VOICE_SESSIONS_PER_IP_PER_HOUR ?? 6),
  dailyMinutes: Number(process.env.VOICE_DAILY_MINUTES_CAP ?? 600),
};

export function ipHash(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
  return createHash('sha256').update(ip + (process.env.COOKIE_SECRET ?? '')).digest('hex').slice(0, 24);
}

/** Returns null if allowed, else a reason. Conservative: assumes every open session runs to the cap. */
export async function voiceAllowed(ip: string) {
  if (process.env.KILL_SWITCH_VOICE === 'true') return 'voice_disabled';
  const [{ n }] = await sql()<{ n: number }[]>`SELECT count(*)::int n FROM voice_sessions WHERE ip_hash = ${ip} AND started_at > now() - interval '1 hour'`;
  if (n >= LIMITS.perIpPerHour) return 'rate_limited';
  const [{ secs }] = await sql()<{ secs: number }[]>`SELECT COALESCE(sum(COALESCE(seconds, ${LIMITS.maxSessionSec})), 0)::int secs FROM voice_sessions WHERE started_at > now() - interval '24 hours'`;
  if (secs / 60 >= LIMITS.dailyMinutes) return 'daily_cap';
  return null;
}
