// Household session cookie (sandbox isolation) and scoped caregiver tokens.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

const COOKIE = 'nami_hh';
const secret = () => process.env.COOKIE_SECRET || 'dev-cookie-secret-change-me';
const sign = (v: string) => createHmac('sha256', secret()).update(v).digest('base64url');

export function sealHousehold(id: string) {
  return `${id}.${sign(id)}`;
}

export function unsealHousehold(v: string | undefined | null) {
  if (!v) return null;
  const i = v.lastIndexOf('.');
  if (i < 0) return null;
  const id = v.slice(0, i);
  const a = Buffer.from(sign(id));
  const b = Buffer.from(v.slice(i + 1));
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

export async function currentHousehold() {
  const jar = await cookies();
  return unsealHousehold(jar.get(COOKIE)?.value);
}

export async function setHouseholdCookie(id: string) {
  const jar = await cookies();
  jar.set(COOKIE, sealHousehold(id), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 48 * 3600 });
}

const tokenKey = () => new TextEncoder().encode(process.env.CONTACT_TOKEN_SECRET || 'dev-contact-secret-change-me');

/** Caregiver link token: scoped to one household + one contact, expires in 48 h. */
export async function contactToken(hh: string, contactId: string) {
  return new SignJWT({ hh, c: contactId }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('48h').sign(tokenKey());
}

export async function verifyContactToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, tokenKey());
    if (typeof payload.hh !== 'string' || typeof payload.c !== 'string') return null;
    return { hh: payload.hh, contactId: payload.c };
  } catch {
    return null;
  }
}
