import { createHmac, timingSafeEqual } from 'node:crypto';
import twilio from 'twilio';

/** a per-call key in our own webhook URLs, for accounts that sign in with an API key (no Auth Token to check signatures with) */
export function callKey(callId: string) {
  return createHmac('sha256', process.env.CALL_WEBHOOK_SECRET || '').update(callId).digest('base64url').slice(0, 24);
}

function keyOk(callId: string, k: string | null) {
  if (!process.env.CALL_WEBHOOK_SECRET || !callId || !k) return false;
  const a = Buffer.from(callKey(callId));
  const b = Buffer.from(k);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Parses a Twilio webhook: valid if X-Twilio-Signature checks out against APP_URL, or the URL carries this call's key. */
export async function readTwilio(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => (params[k] = String(v)));
  const u = new URL(req.url);
  const publicUrl = `${(process.env.APP_URL ?? '').replace(/\/$/, '')}${u.pathname}${u.search}`;
  const sig = req.headers.get('x-twilio-signature') ?? '';
  const token = process.env.TWILIO_AUTH_TOKEN ?? '';
  const callId = u.searchParams.get('callId') ?? '';
  const valid = (!!token && twilio.validateRequest(token, sig, publicUrl, params)) || keyOk(callId, u.searchParams.get('k'));
  return { params, valid, callId };
}

export const twimlResponse = (xml: string) => new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
