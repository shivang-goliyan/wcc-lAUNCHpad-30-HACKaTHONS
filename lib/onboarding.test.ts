import { describe, expect, it } from 'vitest';
import { OnboardProfile, applyProfile } from './onboarding';
import { seedHousehold } from './seed';

const now = Date.UTC(2026, 9, 5, 3, 30);

const profile = (over: Partial<OnboardProfile> = {}): OnboardProfile => ({
  setupBy: 'child',
  parent: { firstName: 'Kamla', lastName: 'Verma', addressAs: 'Ma', city: 'Lucknow', language: 'hi' },
  checkinTime: '09:00',
  medicines: [
    { label: 'Thyroid tablet', time: '07:30' },
    { label: 'BP tablet', time: '21:00' },
  ],
  water: true,
  walk: false,
  contacts: [
    { name: 'Rohit', relation: 'son', phone: '+91 98765 43210' },
    { name: 'Sunita', relation: 'neighbour', phone: '' },
  ],
  clinic: { name: 'Sharma Clinic', doctor: 'Dr. Sharma' },
  consent: { source: 'button' },
  ...over,
});

describe('applyProfile', () => {
  const base = seedHousehold({ now });

  it('maps the parent details', () => {
    const r = applyProfile(base, profile()).recipient;
    expect(r).toMatchObject({ firstName: 'Kamla', lastName: 'Verma', displayName: 'Kamla Verma', addressAs: 'Ma', city: 'Lucknow', language: 'hi' });
    expect(r.timezone).toBe(base.recipient.timezone);
  });

  it('uses first name alone', () => {
    const p = profile();
    const r = applyProfile(base, { ...p, parent: { ...p.parent, lastName: '' } }).recipient;
    expect(r.displayName).toBe('Kamla');
  });

  it('turns medicines into schedules', () => {
    const s = applyProfile(base, profile()).schedules;
    const meds = s.filter((x) => x.kind === 'medication');
    expect(meds.map((m) => m.id)).toEqual(['sch_med_1', 'sch_med_2']);
    expect(meds[0]).toMatchObject({ label: 'Thyroid tablet', times: ['07:30'], active: true });
    expect(meds[1].times).toEqual(['21:00']);
  });

  it('honours water and walk', () => {
    const on = applyProfile(base, profile({ water: true, walk: true })).schedules.map((s) => s.id);
    expect(on).toContain('sch_water');
    expect(on).toContain('sch_walk');
    const off = applyProfile(base, profile({ water: false, walk: false, medicines: [] })).schedules;
    expect(off).toEqual([]);
  });

  it('orders contacts without phones', () => {
    const c = applyProfile(base, profile()).contacts;
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ id: 'c_1', name: 'Rohit', relation: 'son', priority: 1, phone: null });
    expect(c[1]).toMatchObject({ id: 'c_2', name: 'Sunita', priority: 2, phone: null });
  });

  it('renames the first clinic', () => {
    const cl = applyProfile(base, profile()).clinics;
    expect(cl[0]).toMatchObject({ name: 'Sharma Clinic', doctor: 'Dr. Sharma', mode: 'sim' });
    const noDoc = applyProfile(base, profile({ clinic: { name: 'City Clinic', doctor: '' } })).clinics[0];
    expect(noDoc.doctor).toBe('City Clinic');
  });

  it('sets the check-in time', () => {
    expect(applyProfile(base, profile({ checkinTime: '08:00' })).policy.times).toEqual(['08:00']);
  });

  it('drops the demo memories', () => {
    const s = applyProfile(base, profile());
    expect(s.memories).toEqual([]);
    expect(s.memoryPrompts).toEqual([]);
  });

  it('leaves the input alone', () => {
    applyProfile(base, profile());
    expect(base.recipient.firstName).toBe('Meera');
  });
});

describe('OnboardProfile', () => {
  it('accepts a full profile', () => {
    expect(OnboardProfile.safeParse(profile()).success).toBe(true);
  });

  it('rejects a bad time', () => {
    expect(OnboardProfile.safeParse(profile({ checkinTime: '25:00' })).success).toBe(false);
    expect(OnboardProfile.safeParse(profile({ medicines: [{ label: 'x', time: '9am' }] })).success).toBe(false);
  });

  it('needs at least one contact', () => {
    expect(OnboardProfile.safeParse(profile({ contacts: [] })).success).toBe(false);
  });
});
