import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { EngineReject } from '../engine/types';

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export function handleError(e: unknown) {
  if (e instanceof ZodError) return json({ ok: false, error: 'invalid_input', issues: e.issues.slice(0, 5) }, 400);
  if (e instanceof EngineReject) return json({ ok: false, error: e.code, message: e.message, sayHint: e.sayHint }, 409);
  console.error(e);
  return json({ ok: false, error: 'server_error' }, 500);
}
