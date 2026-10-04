import { twilioStatus } from '@/lib/calls/runtime';
import { readTwilio } from '@/lib/server/twilioRequest';

export async function POST(req: Request) {
  const { params, valid, callId } = await readTwilio(req);
  if (!valid) return new Response('invalid signature', { status: 403 });
  await twilioStatus(callId, params.CallStatus ?? '', params.AnsweredBy ?? null);
  return new Response(null, { status: 204 });
}
