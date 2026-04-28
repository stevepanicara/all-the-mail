-- Migration 006: trial_consumed flag on users
--
-- Tracks whether a user has ever started a 14-day trial. Stripe enforces the
-- trial period itself (subscription_data.trial_period_days), but the trial
-- count enforcement lives here so the same user can't open a checkout, abandon
-- it, and open another to get unlimited trial periods.
--
-- We mark trial_consumed=true at session-creation time, not at completion.
-- That closes the abandon-and-retry loophole.
--
-- Existing users (none at the time of this migration) would default to false,
-- making them eligible for one trial. New signups go through the same path:
-- first checkout grants trial, subsequent checkouts are full-price.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trial_consumed BOOLEAN NOT NULL DEFAULT false;
