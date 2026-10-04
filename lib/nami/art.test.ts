import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NAMI_ART, NAMI_CLIPS, clipRoute, namiSrc } from './art';
import { POSE_NAMES, type PoseName } from './poses';

const file = (src: string) => path.join(__dirname, '..', '..', 'public', src.split('?')[0]);

function partsOf(pose: PoseName) {
  const a = NAMI_ART[pose];
  if (a.alias) return [];
  const parts: (string | undefined)[] = [undefined];
  if (a.blink) parts.push('blink');
  if (a.wave) parts.push('wave');
  for (const m of a.mouths ?? []) parts.push(`mouth-${m}`);
  return parts;
}

describe('nami art', () => {
  it('every pose has art', () => {
    expect(Object.keys(NAMI_ART).sort()).toEqual([...POSE_NAMES].sort());
  });

  it('every referenced file exists', () => {
    const missing = POSE_NAMES.flatMap((p) => partsOf(p).map((part) => namiSrc(p, part))).filter((s) => !existsSync(file(s)));
    expect(missing).toEqual([]);
  });

  it('every clip sheet exists', () => {
    const missing = Object.values(NAMI_CLIPS).map((c) => c.src).filter((s) => !existsSync(file(s)));
    expect(missing).toEqual([]);
  });

  it('routes through the shortest chain', () => {
    const keys = ['idle~greeting', 'idle~calling', 'idle~stand', 'stand~walk', 'walk@loop'];
    const all = () => true;
    expect(clipRoute('idle', 'greeting', all, keys)).toEqual([{ key: 'idle~greeting', reverse: false }]);
    expect(clipRoute('greeting', 'idle', all, keys)).toEqual([{ key: 'idle~greeting', reverse: true }]);
    expect(clipRoute('greeting', 'calling', all, keys).map((s) => s.key)).toEqual(['idle~greeting', 'idle~calling']);
    // sitting to walking goes through standing
    expect(clipRoute('idle', 'walk', all, keys).map((s) => s.key)).toEqual(['idle~stand', 'stand~walk']);
    expect(clipRoute('walk', 'idle', all, keys)).toEqual([
      { key: 'stand~walk', reverse: true },
      { key: 'idle~stand', reverse: true },
    ]);
    expect(clipRoute('idle', 'idle', all, keys)).toEqual([]);
  });

  it('skips clips that are not loaded', () => {
    expect(clipRoute('idle', 'greeting', () => false, ['idle~greeting'])).toEqual([]);
    expect(clipRoute('idle', 'walk', (k) => k !== 'stand~walk', ['idle~stand', 'stand~walk'])).toEqual([]);
  });

  it('every clip has its reversed copy', () => {
    for (const [k, c] of Object.entries(NAMI_CLIPS)) if (k.includes('~')) expect(c.rev && existsSync(file(c.rev))).toBeTruthy();
  });

  it('silent and base mouths are real', () => {
    for (const p of POSE_NAMES) {
      const a = NAMI_ART[p];
      if (a.silent) expect(a.mouths).toContain(a.silent);
    }
  });
});
