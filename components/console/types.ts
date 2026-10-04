import type { AppSnapshot } from '@/lib/server/snapshot';

// `events` and `calls` come straight from SQL rows (untyped in AppSnapshot); these mirror lib/db/schema.sql.
export type ConsoleEvent = {
  id: string | number;
  at_virtual: string;
  at_real: string;
  category: 'agent' | 'state' | 'external' | 'human';
  actor: string;
  action: string;
  record_type: string;
  record_id: string | null;
  summary: string;
  detail: Record<string, unknown> | null;
};

export type Turn = { speaker: 'nami' | 'clinic' | 'contact' | 'recipient' | 'system'; text: string; t: number };

export type ConsoleCall = {
  id: string;
  purpose: 'clinic_availability' | 'clinic_confirm' | 'contact_alert' | 'recipient_checkin' | 'family_request' | string;
  adapter: 'sim' | 'twilio' | string;
  related_id: string | null;
  state: string;
  transcript: Turn[];
  extracted: Record<string, unknown> | null;
  extractor: string | null;
  disclosure: Array<{ kind: string; match: string }> | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  scenario: string | null;
};

export type ConsoleState = Omit<AppSnapshot, 'events' | 'calls'> & { ok: true; events: ConsoleEvent[]; calls: ConsoleCall[] };
export type ConsoleContact = ConsoleState['contacts'][number];
export type ConsoleAppointment = ConsoleState['appointments'][number];
