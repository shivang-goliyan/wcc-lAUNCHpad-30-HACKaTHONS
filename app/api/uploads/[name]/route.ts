import { readFile } from 'node:fs/promises';
import path from 'node:path';

const MIME: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const dir = () => process.env.UPLOAD_DIR || path.join(process.cwd(), 'data/uploads');

export async function GET(_: Request, ctx: RouteContext<'/api/uploads/[name]'>) {
  const { name } = await ctx.params;
  const m = /^([a-f0-9]{32})\.(jpg|png|webp)$/.exec(name);
  if (!m) return new Response('not found', { status: 404 });
  try {
    const buf = await readFile(path.join(dir(), name));
    return new Response(new Uint8Array(buf), { headers: { 'Content-Type': MIME[m[2]], 'Cache-Control': 'private, max-age=86400' } });
  } catch {
    return new Response('not found', { status: 404 });
  }
}
