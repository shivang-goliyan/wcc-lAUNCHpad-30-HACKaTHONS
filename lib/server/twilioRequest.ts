import twilio from 'twilio';

/** Parses a Twilio webhook and verifies X-Twilio-Signature against APP_URL. */
export async function readTwilio(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => (params[k] = String(v)));
  const u = new URL(req.url);
  const publicUrl = `${(process.env.APP_URL ?? '').replace(/\/$/, '')}${u.pathname}${u.search}`;
  const sig = req.headers.get('x-twilio-signature') ?? '';
  const token = process.env.TWILIO_AUTH_TOKEN ?? '';
  const valid = !!token && twilio.validateRequest(token, sig, publicUrl, params);
  return { params, valid, callId: u.searchParams.get('callId') ?? '' };
}

export const twimlResponse = (xml: string) => new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
