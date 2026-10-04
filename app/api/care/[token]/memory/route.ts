// Caregiver shares a photo + note for Memory Corner. Stored on the VM volume with an unguessable name.
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runCommand } from '@/lib/db/repo';
import { verifyContactToken } from '@/lib/server/session';
import { handleError, json } from '@/lib/server/http';

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const uploadDir = () => process.env.UPLOAD_DIR || path.join(process.cwd(), 'data/uploads');

export async function POST(req: Request, ctx: RouteContext<'/api/care/[token]/memory'>) {
  try {
    const { token } = await ctx.params;
    const t = await verifyContactToken(token);
    if (!t) return json({ ok: false, error: 'invalid_or_expired_link' }, 401);
    const form = await req.formData();
    const file = form.get('photo');
    const caption = String(form.get('caption') ?? '').trim().slice(0, 140);
    if (!(file instanceof File) || !TYPES[file.type]) return json({ ok: false, error: 'photo_required (jpeg/png/webp)' }, 400);
    if (file.size > 5 * 1024 * 1024) return json({ ok: false, error: 'photo_too_large (max 5 MB)' }, 400);
    if (!caption) return json({ ok: false, error: 'caption_required' }, 400);
    const name = `${randomBytes(16).toString('hex')}.${TYPES[file.type]}`;
    await mkdir(uploadDir(), { recursive: true });
    await writeFile(path.join(uploadDir(), name), Buffer.from(await file.arrayBuffer()));
    const r = await runCommand(t.hh, { type: 'memory.prompt.add', contactId: t.contactId, photoPath: `/api/uploads/${name}`, caption });
    return json({ ok: !r.rejected, rejected: r.rejected });
  } catch (e) {
    return handleError(e);
  }
}
