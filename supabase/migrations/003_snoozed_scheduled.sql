-- Migration 003: snoozed emails + scheduled sends
-- Run in Supabase SQL editor

-- ---------------------------------------------------------------
-- snoozed_emails
-- Normalized: one row per snoozed message. Unique on the triple
-- (user_id, account_id, message_id) so re-snoozing a message is
-- an upsert, not a duplicate row.
-- ---------------------------------------------------------------
CREATE TABLE snoozed_emails (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id    UUID        NOT NULL REFERENCES gmail_accounts(id) ON DELETE CASCADE,
  message_id    TEXT        NOT NULL,
  snooze_until  TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT snoozed_emails_unique UNIQUE (user_id, account_id, message_id)
);

-- "Give me all active snoozes for user X"
CREATE INDEX idx_snoozed_emails_user_active
  ON snoozed_emails (user_id, snooze_until);

-- "Delete all rows past their snooze time" (background cleanup if added later)
CREATE INDEX idx_snoozed_emails_expiry
  ON snoozed_emails (snooze_until);

-- ---------------------------------------------------------------
-- scheduled_sends
-- JSONB payload stores the full compose object (matches localStorage
-- shape exactly). send_at and status are promoted to native columns
-- so we can index and query without parsing JSON.
--
-- status flow: pending → sending (optimistic lock, prevents double-
-- send across tabs) → sent | failed | cancelled
-- ---------------------------------------------------------------
CREATE TABLE scheduled_sends (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload     JSONB       NOT NULL,
  send_at     TIMESTAMPTZ NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Primary query: "pending sends due for user X"
-- Partial index only covers the common case
CREATE INDEX idx_scheduled_sends_due
  ON scheduled_sends (user_id, send_at)
  WHERE status = 'pending';

-- ---------------------------------------------------------------
-- RLS: backend always uses service role key (bypasses RLS).
-- Enable anyway for defense-in-depth.
-- ---------------------------------------------------------------
ALTER TABLE snoozed_emails  ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_sends ENABLE ROW LEVEL SECURITY;
