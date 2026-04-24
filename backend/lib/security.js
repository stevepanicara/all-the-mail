// In-process security helpers — OAuth state issuance/verification + JWT
// jti revocation set. Single-instance Render today; migrate to Supabase or
// Redis when we scale beyond one process.

import crypto from 'crypto';

// ---- OAuth state ----------------------------------------------------------
// Random 32-byte tokens with payload + expiry. One-time use.

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const _stateStore = new Map(); // token -> { payload, expiresAt }

function _sweepStates(now = Date.now()) {
  for (const [k, v] of _stateStore) if (v.expiresAt <= now) _stateStore.delete(k);
}

export function issueOAuthState(payload = {}) {
  _sweepStates();
  const token = crypto.randomBytes(32).toString('base64url');
  _stateStore.set(token, { payload, expiresAt: Date.now() + STATE_TTL_MS });
  return token;
}

// Returns the payload on success, null on failure (expired / unknown / replayed).
// Single-use: a successful verify removes the entry.
export function consumeOAuthState(token) {
  if (!token || typeof token !== 'string') return null;
  _sweepStates();
  const entry = _stateStore.get(token);
  if (!entry) return null;
  _stateStore.delete(token);
  return entry.payload;
}

// ---- JWT jti revocation ---------------------------------------------------
// Tracks revoked token IDs until their original expiry passes. Replaces a
// blanket "force everyone to re-login" with surgical kill of a specific session.

const _revokedJti = new Map(); // jti -> expiresAt

function _sweepJti(now = Date.now()) {
  for (const [k, v] of _revokedJti) if (v <= now) _revokedJti.delete(k);
}

export function revokeJti(jti, expiresAt) {
  if (!jti) return;
  _sweepJti();
  _revokedJti.set(jti, expiresAt || Date.now() + 24 * 60 * 60 * 1000);
}

export function isJtiRevoked(jti) {
  if (!jti) return false;
  _sweepJti();
  return _revokedJti.has(jti);
}

export function newJti() {
  return crypto.randomBytes(16).toString('hex');
}
