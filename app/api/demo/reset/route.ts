import { createHousehold } from '@/lib/db/repo';
import { setHouseholdCookie } from '@/lib/server/session';
import { handleError, json } from '@/lib/server/http';

export async function POST() {
  try {
    const id = await createHousehold({});
    await setHouseholdCookie(id);
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
