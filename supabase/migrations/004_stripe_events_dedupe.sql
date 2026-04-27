-- Migration 004: Stripe webhook idempotency table
-- Records every processed Stripe event id to dedupe retries and at-least-once
-- delivery duplicates. The PRIMARY KEY on event_id makes a duplicate INSERT
-- fail with 23505, which the webhook handler treats as "already processed".

CREATE TABLE IF NOT EXISTS stripe_events (
  event_id    TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cleanup helper: prune events older than 90 days. Run via pg_cron weekly
-- (or trigger manually) — Stripe doesn't replay older than ~30 days, so
-- 90 is a safe retention window with margin.
-- Example: DELETE FROM stripe_events WHERE received_at < now() - interval '90 days';
