import type { ConsoleCall, ConsoleContact, ConsoleEvent } from './types';

const TZ = 'Asia/Kolkata';
const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });

/** Virtual (demo) time, rendered in IST as HH:MM. */
export function istTime(v: string | number | null | undefined) {
  if (v == null) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : hhmm.format(d);
}

export type NodeId = 'meera' | 'nami' | 'engine' | 'caller' | 'clinic' | 'extractor' | 'verifier' | 'family' | 'caregiver';
export type NodeKind = 'llm' | 'code' | 'human' | 'external';

export const NODE_KIND: Record<NodeId, NodeKind> = {
  meera: 'human',
  nami: 'llm',
  engine: 'code',
  caller: 'llm',
  clinic: 'external',
  extractor: 'llm',
  verifier: 'code',
  family: 'llm',
  caregiver: 'human',
};

/** Which graph nodes an audit event touches (spec: actor → node; contact_alerted → Family alert). */
export function nodesForEvent(e: Pick<ConsoleEvent, 'actor' | 'action'>): NodeId[] {
  const a = e.actor;
  if (e.action === 'contact_alerted' || e.action === 'family_request_sent' || e.action === 'helper_notified') return ['engine', 'family', 'caregiver'];
  if (e.action.startsWith('contact_call_')) return ['family', 'caregiver', 'engine'];
  if (a === 'caller') return ['engine', 'caller', 'clinic'];
  if (a === 'verifier') return ['extractor', 'verifier', 'engine'];
  if (a === 'extractor') return ['extractor'];
  if (a === 'clinic') return ['caller', 'clinic'];
  if (a === 'nami') return ['meera', 'nami', 'engine'];
  if (a === 'user' || a === 'human') return ['meera'];
  if (a.startsWith('contact:')) return ['caregiver', 'engine'];
  if (a === 'engine' || a === 'system') return ['engine'];
  return [];
}

export function nodesForCall(c: Pick<ConsoleCall, 'purpose'>): NodeId[] {
  if (c.purpose.startsWith('clinic')) return ['caller', 'clinic'];
  if (c.purpose === 'contact_alert' || c.purpose === 'family_request') return ['family', 'caregiver'];
  if (c.purpose === 'recipient_checkin') return ['engine', 'meera'];
  return [];
}

export const LIVE_CALL_STATES = ['queued', 'ringing', 'in_progress'];

export type ActorView = { label: string; kind: NodeKind | 'system' };

export function actorView(actor: string, contacts: ConsoleContact[], recipientFirst: string): ActorView {
  if (actor.startsWith('contact:')) {
    const c = contacts.find((x) => x.id === actor.slice(8));
    return { label: c ? `${c.name} (caregiver)` : 'Caregiver', kind: 'human' };
  }
  switch (actor) {
    case 'engine':
      return { label: 'Workflow engine', kind: 'code' };
    case 'verifier':
      return { label: 'Verifier', kind: 'code' };
    case 'caller':
      return { label: 'Caller agent', kind: 'llm' };
    case 'extractor':
      return { label: 'Extractor', kind: 'llm' };
    case 'nami':
      return { label: 'Nami (voice agent)', kind: 'llm' };
    case 'clinic':
      return { label: 'Clinic', kind: 'external' };
    case 'user':
    case 'human':
      return { label: recipientFirst, kind: 'human' };
    case 'system':
      return { label: 'System', kind: 'system' };
    default:
      return { label: actor, kind: 'system' };
  }
}

export const KIND_CHIP: Record<ActorView['kind'], string> = {
  llm: 'bg-sea-200/70 text-teal-700 ring-sea-500/40',
  code: 'bg-teal-900 text-ivory-50 ring-teal-900',
  human: 'bg-[#f3e6dc] text-cocoa-500 ring-cocoa-300/60',
  external: 'bg-ivory-100 text-ink-600 ring-line',
  system: 'bg-ink-600/8 text-ink-600 ring-ink-600/15',
};

export function humanize(code: string) {
  const s = code.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
