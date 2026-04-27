-- Migration 005: Stripe customer mapping + complete subscriptions table
--
-- Why this migration exists
--   1. The `subscriptions` table never had a real CREATE TABLE migration
--      checked into the repo. Production has been running without it (every
--      webhook write to `subscriptions` was a silent no-op against a missing
--      table). This migration ships the canonical schema with the right
--      constraints baked in.
--
--   2. Adds the user → stripe_customer_id mapping with DB-level uniqueness
--      on both sides, so a regressed app layer can't create duplicates.
--
--   3. Adds two columns the new billing.js needs: cancel_at_period_end (so
--      the UI can render "Active until {date}") and stripe_item_id (so
--      plan-change calls can use stripe.subscriptions.update without a
--      round-trip to fetch the item id).
--
-- Apply via Supabase SQL editor. Idempotent — safe to run multiple times.

-- ---------------------------------------------------------------
-- subscriptions
-- One row per user. user_id PRIMARY KEY enforces "at most one
-- subscription record per user" at the DB level — the strongest
-- defense against the duplicate-subscription bug class.
-- stripe_subscription_id UNIQUE is needed because the webhook
-- handler upserts on it (subscription.updated/.deleted/.created).
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id                UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT        UNIQUE,
  stripe_item_id         TEXT,
  plan                   TEXT        NOT NULL DEFAULT 'free',
  status                 TEXT        NOT NULL DEFAULT 'none',
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN     NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- For users who pre-date this migration, ensure the columns exist on the
-- live table even if a partial schema was created out-of-band in the past.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS stripe_item_id TEXT;

-- Auto-update updated_at on row mutation. Reuses the function defined in
-- the original schema if it's already there; create it if not.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Index on stripe_customer_id for the webhook handler's customer-id lookups
-- (e.g. when subscription.metadata.user_id is missing and we resolve via
-- the customer mapping fallback). NOT unique here — a customer can in
-- principle have multiple subscriptions, even if our app only allows one.
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer
  ON subscriptions (stripe_customer_id);

-- Defense-in-depth — backend uses service role key (bypasses RLS) but
-- enabling RLS prevents accidental anon-key reads.
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------
-- stripe_customers
-- Canonical user ↔ stripe_customer_id mapping. Both sides UNIQUE so the
-- DB rejects any attempt to create two customers for the same user OR
-- two users for the same customer.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stripe_customers (
  user_id            UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT        NOT NULL UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_stripe_customers_updated_at ON stripe_customers;
CREATE TRIGGER update_stripe_customers_updated_at
  BEFORE UPDATE ON stripe_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
