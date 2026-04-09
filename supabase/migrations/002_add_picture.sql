-- Migration 002: Add picture URL to gmail_accounts
-- Stores the Google profile picture URL for each connected account

ALTER TABLE gmail_accounts
  ADD COLUMN IF NOT EXISTS picture TEXT;

-- Also ensure the users table has picture (it may already exist)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS picture TEXT;
