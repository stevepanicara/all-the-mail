-- Migration 005: Stripe customer mapping + subscription field upgrades
--
-- Why this migration exists
--   Before this, every successful checkout created a brand-new Stripe Customer
--   object (we passed customer_email instead of customer:). That meant a user
--   who refunded and re-subscribed, or who hit the checkout endpoint twice,
--   would end up with multiple Customer records under the same email — broken
--   reporting, refund nightmares, support time sink.
--
--   This migration adds the canonical user → stripe_customer_id mapping with
--   DB-level uniqueness on both sides, so even if app logic regresses, the DB
--   refuses to create a duplicate.

CREATE TABLE IF NOT EXISTS stripe_customers (
  user_id            UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT        NOT NULL UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Used by getOrCreateCustomer to look up by email when reconciling orphans
-- (case where the DB row was lost/migrated but the Stripe customer still
-- exists). Indexed via the FK + email-side query lives in the users table.

-- Track Stripe's cancel_at_period_end on the subscription row so the UI can
-- accurately render "Active until {date}" during the grace window. Stripe's
-- customer.subscription.updated webhook delivers this field; we mirror it.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

-- Track the Stripe SubscriptionItem id so plan-change calls can use
-- stripe.subscriptions.update with `items: [{ id: <item_id>, price: ... }]`.
-- Without this, plan changes have to round-trip Stripe to fetch the item id
-- on every change. Cheap to store, expensive to leave out.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS stripe_item_id TEXT;
