-- Nami Care schema. Household care state is a single JSONB document locked per command
-- (SELECT ... FOR UPDATE) so every engine transition is serialised; events, outbox and
-- calls are append-heavy side tables. Idempotent: safe to run on every boot.

CREATE TABLE IF NOT EXISTS households (
  id              text PRIMARY KEY,
  kind            text NOT NULL DEFAULT 'sandbox',          -- sandbox | video
  state           jsonb NOT NULL,
  version         integer NOT NULL DEFAULT 0,
  clock_offset_ms bigint NOT NULL DEFAULT 0,
  next_wake_at    timestamptz,                               -- REAL time of next engine wake-up
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS households_next_wake ON households (next_wake_at);

CREATE TABLE IF NOT EXISTS events (
  id           bigserial PRIMARY KEY,
  household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  at_virtual   timestamptz NOT NULL,
  at_real      timestamptz NOT NULL DEFAULT now(),
  category     text NOT NULL,
  actor        text NOT NULL,
  action       text NOT NULL,
  record_type  text NOT NULL,
  record_id    text,
  summary      text NOT NULL,
  detail       jsonb
);
CREATE INDEX IF NOT EXISTS events_hh ON events (household_id, id DESC);

CREATE TABLE IF NOT EXISTS outbox (
  id              bigserial PRIMARY KEY,
  household_id    text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  key             text NOT NULL UNIQUE,                      -- idempotency key
  kind            text NOT NULL,
  payload         jsonb NOT NULL,
  state           text NOT NULL DEFAULT 'pending',           -- pending | in_flight | done | failed | cancelled
  attempts        integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outbox_due ON outbox (state, next_attempt_at);

CREATE TABLE IF NOT EXISTS call_sessions (
  id               text PRIMARY KEY,                         -- engine callId
  household_id     text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  purpose          text NOT NULL,
  adapter          text NOT NULL,                            -- sim | twilio
  related_id       text,
  to_number        text,
  state            text NOT NULL DEFAULT 'queued',           -- queued | ringing | in_progress | completed | no_answer | busy | voicemail | failed | cancelled
  provider_call_id text UNIQUE,
  brief            jsonb NOT NULL,
  transcript       jsonb NOT NULL DEFAULT '[]'::jsonb,       -- [{speaker, text, t}]
  extracted        jsonb,
  extractor        text,                                     -- llm | scripted
  disclosure       jsonb,
  result_sent      boolean NOT NULL DEFAULT false,
  started_at       timestamptz,
  ended_at         timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS calls_hh ON call_sessions (household_id, created_at DESC);

CREATE TABLE IF NOT EXISTS voice_sessions (
  id           text PRIMARY KEY,
  household_id text,
  ip_hash      text NOT NULL,
  provider     text NOT NULL,
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  seconds      integer
);
CREATE INDEX IF NOT EXISTS voice_ip ON voice_sessions (ip_hash, started_at DESC);
