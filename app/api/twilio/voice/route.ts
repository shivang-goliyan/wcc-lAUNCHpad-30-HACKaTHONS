import { twilioVoice } from '@/lib/calls/runtime';
import { readTwilio, twimlResponse } from '@/lib/server/twilioRequest';

export async function POST(req: Request) {
  const { params, valid, callId } = await readTwilio(req);
  if (!valid) return new Response('invalid signature', { status: 403 });
  return twimlResponse(await twilioVoice(callId, params.AnsweredBy ?? null));
}
