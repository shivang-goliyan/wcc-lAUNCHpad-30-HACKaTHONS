import { describe, expect, it } from 'vitest';
import { DANGER_MIN, dangerDecision } from './danger';

describe('danger decision', () => {
  it('opens help on a clear crisis', () => {
    expect(dangerDecision({ self_harm: 0.99, none: 0.01 })).toMatchObject({ open: true, kind: 'self_harm', helpKind: 'distress' });
  });

  it('maps falls and emergencies to explicit help', () => {
    expect(dangerDecision({ fall_or_injury: 0.97, none: 0.03 }).helpKind).toBe('explicit_help');
    expect(dangerDecision({ medical_emergency: 1 }).helpKind).toBe('explicit_help');
  });

  it('adds up danger spread over kinds', () => {
    // neither alone clears the bar, together they do
    const d = dangerDecision({ fall_or_injury: 0.4, medical_emergency: 0.35, none: 0.25 });
    expect(d.open).toBe(true);
    expect(d.kind).toBe('fall_or_injury');
  });

  it('stays quiet below the bar', () => {
    expect(dangerDecision({ none: 0.99, self_harm: 0.01 }).open).toBe(false);
    expect(dangerDecision({ none: 1 - DANGER_MIN + 0.05, medical_emergency: DANGER_MIN - 0.05 }).open).toBe(false);
    expect(dangerDecision({}).open).toBe(false);
  });
});
