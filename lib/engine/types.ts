// Pure domain types for the Raynet workflow engine.
// All times are epoch milliseconds in *virtual* time (see lib/clock.ts).

export type Lang = 'hi' | 'en' | 'auto';
export type InputSource = 'voice' | 'button' | 'keyboard' | 'switch' | 'phone' | 'link' | 'text';

export type Recipient = {
  displayName: string; // "Meera Sharma"
  firstName: string; // "Meera"
  lastName: string; // "Sharma"
  addressAs: string; // "Meera ji"
  city: string;
  language: Lang;
  timezone: string; // IANA
  quietStart: string; // "21:30"
  quietEnd: string; // "07:00"
  plannedAbsenceUntil: number | null;
  phone: string | null;
  prefs: { textScale: number; reducedMotion: boolean; captions: boolean };
};

export type Permission = 'checkins' | 'help' | 'appointments' | 'reminders' | 'memories';

export type Contact = {
  id: string;
  name: string;
  relation: string;
  priority: number; // 1 primary, 2 backup
  phone: string | null;
  email: string | null;
  permissions: Record<Permission, boolean>;
  participationConfirmed: boolean;
};

export type ConsentPurpose =
  | 'automated_contact_calls'
  | 'clinic_calls'
  | 'appointment_booking'
  | 'share_reminders'
  | 'share_appointments'
  | 'share_checkins'
  | 'memory_retention';

export type Consent = { purpose: ConsentPurpose; grantedAt: number; revokedAt: number | null };

export type SimSlot = { id: string; start: number; durationMin: number; status: 'free' | 'held' | 'booked'; bookedFor?: string };

export type ClinicScenario = 'cooperative' | 'busy_then_cooperative' | 'evening_only' | 'asks_for_extra_info' | 'no_slots' | 'voicemail';

export type Clinic = {
  id: string;
  name: string;
  nameHi: string;
  doctor: string;
  phone: string | null;
  mode: 'sim' | 'phone';
  approved: boolean;
  permittedDisclosure: Array<'first_name' | 'last_initial' | 'reason'>;
  simCalendar: SimSlot[];
  simScenario: ClinicScenario;
};

export type ReminderKind = 'medication' | 'water' | 'walk' | 'appointment';

export type ReminderSchedule = {
  id: string;
  kind: ReminderKind;
  label: string;
  labelHi: string;
  instructions: string; // as checked by a human; Nami never changes it
  times: string[]; // daily "HH:MM" in recipient tz
  onceAt: number[]; // one-off due times (appointment reminders)
  active: boolean;
  appointmentId: string | null;
};

export type ReminderOutcome =
  | 'taken_reported'
  | 'not_taken_reported'
  | 'help_requested'
  | 'unacknowledged'
  | 'delivery_uncertain'
  | 'done_reported';

export type Occurrence = {
  id: string;
  scheduleId: string;
  dueAt: number;
  notifyAt: number;
  state: 'scheduled' | 'awaiting_response' | 'resolved';
  outcome: ReminderOutcome | null;
  outcomeAt: number | null;
  outcomeSource: InputSource | null;
  outcomeQuote: string | null;
  snoozes: number;
  delivery: { attemptedAt: number | null; pageVisible: boolean | null; deviceLastSeen: number | null };
};

export type CheckinPolicy = {
  times: string[];
  responseWindowMin: number;
  pageRetries: number;
  retryWindowMin: number;
  phoneFallback: boolean;
  deadlineMin: number; // from due time
  contactAckTimeoutMin: number;
  reminderWindowMin: number;
};

export type CaseState =
  | 'awaiting_response'
  | 'retrying_page'
  | 'phone_fallback'
  | 'escalating'
  | 'owner_accepted'
  | 'resolved_user_responded'
  | 'resolved_human_reported'
  | 'cancelled_mistake'
  | 'unresolved';

export const TERMINAL_CASE_STATES: CaseState[] = [
  'resolved_user_responded',
  'resolved_human_reported',
  'cancelled_mistake',
];
// Note: 'unresolved' is deliberately NOT terminal — a late acceptance is still useful.

export type Case = {
  id: string;
  type: 'checkin' | 'help';
  state: CaseState;
  openedAt: number;
  dueAt: number;
  deadlineAt: number;
  timerAt: number | null; // next time-based transition
  pageRetriesUsed: number;
  contactOrder: string[]; // contact ids in escalation order
  step: number; // index into contactOrder of the contact currently being tried (-1 = none yet)
  ownerContactId: string | null;
  evidence: CaseEvidence | null;
  resolution: { by: string; note: string | null; at: number } | null;
  mistakeUntil: number | null;
  openedBy: InputSource | 'schedule';
  openingQuote: string | null;
};

export type CaseEvidence = {
  checkinDueAt: number;
  pageLastSeenAt: number | null;
  pageVisible: boolean | null;
  lastExplicitResponseAt: number | null;
  quietHours: boolean;
  plannedAbsence: boolean;
  promptsShown: number;
  phoneFallback: 'not_configured' | 'no_answer' | 'voicemail' | 'failed' | 'busy' | 'pending' | null;
};

export type AttemptOutcome =
  | 'accepted'
  | 'declined'
  | 'no_answer'
  | 'voicemail'
  | 'busy'
  | 'failed'
  | 'timeout'
  | 'not_configured'
  | 'responded'
  | 'cancelled'
  | 'superseded';

export type Attempt = {
  id: string;
  caseId: string;
  contactId: string | null; // null = the recipient herself
  channels: Array<'page' | 'phone' | 'link'>;
  state: 'active' | 'closed';
  outcome: AttemptOutcome | null;
  callId: string | null;
  startedAt: number;
  timeoutAt: number | null;
  closedAt: number | null;
  quote: string | null;
};

export type TimeWindow = 'morning' | 'afternoon' | 'evening' | 'any';

export type AppointmentState =
  | 'draft'
  | 'finding_availability'
  | 'awaiting_user_approval'
  | 'pending_clinic_confirmation'
  | 'confirmed'
  | 'failed_needs_help'
  | 'cancelled';

export type SlotOffer = { startAt: number; dateIso: string; time24h: string; weekdaySpoken: string | null; quote: string; slotId?: string };

export type VerificationCheck = { check: string; pass: boolean; detail: string };

export type Appointment = {
  id: string;
  clinicId: string;
  state: AppointmentState;
  requestKey: string;
  constraints: { dateFrom: string; dateTo: string; window: TimeWindow; reason: 'follow_up' | 'new_concern' | 'test_results' | 'other'; note: string | null };
  disclosure: string[];
  createdAt: number;
  callIds: string[];
  availabilityAttempts: number;
  offeredSlot: SlotOffer | null;
  alternatives: SlotOffer[];
  verification: VerificationCheck[];
  approvedAt: number | null;
  approvalEvidence: { source: InputSource; quote: string | null } | null;
  confirmedAt: number | null;
  confirmationEvidence: { quote: string; callId: string; instructions: string | null } | null;
  failureReason: string | null;
};

export type PendingKind = 'permit_clinic_call' | 'approve_slot' | 'call_family' | 'not_taken_contact_helper' | 'send_memory';

export type PendingAction = {
  id: string;
  kind: PendingKind;
  relatedId: string | null;
  payload: Record<string, unknown>;
  state: 'open' | 'confirmed' | 'declined' | 'expired';
  createdAt: number;
  expiresAt: number;
  readback: string;
  readbackHi: string;
};

export type Memory = { id: string; kind: 'preference' | 'story'; text: string; sourceQuote: string; consentedAt: number; deletedAt: number | null };

export type FamilyRequest = { id: string; contactId: string; reason: string; message: string | null; createdAt: number; state: 'sent' | 'seen' | 'done'; callId: string | null };

export type MemoryPrompt = {
  id: string;
  fromContactId: string;
  photoPath: string;
  caption: string;
  createdAt: number;
  state: 'new' | 'story_drafted' | 'sent' | 'kept_private';
  storyText: string | null;
  storyQuote: string | null;
  sentAt: number | null;
};

export type ContactNotice = { id: string; contactId: string; at: number; text: string; caseId: string | null };

export type DeviceStatus = { lastSeenAt: number | null; visibility: 'visible' | 'hidden' | null; lastExplicitResponseAt: number | null };

export type HouseholdState = {
  schemaVersion: 1;
  /** Household id — makes call ids globally unique (outbox keys and call_sessions ids are global). */
  hid?: string;
  seq: number;
  createdAt: number;
  phoneCallsEnabled: boolean;
  recipient: Recipient;
  contacts: Contact[];
  consents: Consent[];
  clinics: Clinic[];
  schedules: ReminderSchedule[];
  occurrences: Occurrence[];
  policy: CheckinPolicy;
  checkinsCreated: string[]; // keys "YYYY-MM-DD HH:MM" already handled
  cases: Case[];
  attempts: Attempt[];
  appointments: Appointment[];
  pending: PendingAction[];
  memories: Memory[];
  familyRequests: FamilyRequest[];
  memoryPrompts: MemoryPrompt[];
  notices: ContactNotice[];
  device: DeviceStatus;
  ui: { quietUntil: number | null };
  handledCallResults: string[]; // `${callId}:${status}` idempotency
};

// ---- Effects (written to the outbox in the same transaction) ----

export type CallPurpose = 'clinic_availability' | 'clinic_confirm' | 'contact_alert' | 'recipient_checkin' | 'family_request';

export type StartCallEffect = {
  kind: 'start_call';
  key: string; // idempotency key
  payload: {
    callId: string;
    purpose: CallPurpose;
    relatedId: string;
    adapter: 'sim' | 'twilio';
    to: string | null; // E.164 for twilio
    clinicId?: string;
    contactId?: string;
    lang: 'hi' | 'en';
    brief: Record<string, unknown>;
  };
};
export type CancelCallEffect = { kind: 'cancel_call'; key: string; payload: { callId: string } };
export type Effect = StartCallEffect | CancelCallEffect;

export type EventCategory = 'agent' | 'state' | 'external' | 'human';
export type EngineEvent = {
  at: number;
  category: EventCategory;
  actor: string; // 'engine' | 'user' | 'contact:<id>' | 'caller' | 'verifier' | 'clinic' | 'system'
  action: string;
  recordType: string;
  recordId: string | null;
  summary: string;
  detail?: Record<string, unknown>;
};

export type ToolReply = { ok: boolean; status: string; sayHint: string; data?: Record<string, unknown> };

export type EngineResult = { state: HouseholdState; effects: Effect[]; events: EngineEvent[]; reply: ToolReply | null };

export class EngineReject extends Error {
  constructor(public code: string, message: string, public sayHint?: string) {
    super(message);
  }
}
