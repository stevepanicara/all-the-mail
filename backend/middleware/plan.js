// Plan-tier enforcement.
//
// Reads the user's subscription state and decides whether a feature is
// allowed. Cached short-term to avoid hitting Supabase on every request.
//
// Admin bypass: any email matching ADMIN_EMAILS env var is treated as Pro
// active indefinitely, regardless of subscription state. This exists so we
// (the operator) can keep using the app while testing a paywall that would
// otherwise lock us out, and to provide unlimited access to specific users
// without going through Stripe. The list is comma-separated — set on Render
// like ADMIN_EMAILS=steve@rangerandfox.tv,other@example.com

import supabase from '../lib/supabase.js';

const PLAN_CACHE_TTL_MS = 60 * 1000;
const _planCache = new Map(); // userId -> { plan, status, expiresAt }

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
);

function isAdminEmail(email) {
  if (!email) return false;
  return ADMIN_EMAILS.has(String(email).trim().toLowerCase());
}

export function invalidatePlanCache(userId) {
  _planCache.delete(userId);
}

// Used by /billing/status and the access-gating middleware. Returns the
// effective plan + status for a user. Admin emails are short-circuited to
// {plan:'pro', status:'active'} unconditionally.
export async function getPlan(userId) {
  if (!userId) return { plan: 'free', status: 'none' };
  const cached = _planCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached;

  // Admin bypass — read user email and short-circuit if it's on the list.
  // Cached the same way so we don't hit Supabase on every gated route.
  let plan = 'free';
  let status = 'none';
  let isAdmin = false;
  try {
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();
    if (user?.email && isAdminEmail(user.email)) {
      isAdmin = true;
      plan = 'pro';
      status = 'active';
    }
  } catch (_) { /* fall through */ }

  if (!isAdmin) {
    try {
      const { data } = await supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', userId)
        .single();
      if (data) {
        plan = data.plan || 'free';
        status = data.status || 'none';
      }
    } catch (_) { /* missing row is fine; default to free */ }
  }

  const entry = { plan, status, isAdmin, expiresAt: Date.now() + PLAN_CACHE_TTL_MS };
  _planCache.set(userId, entry);
  return entry;
}

export function isProActive({ plan, status, isAdmin }) {
  if (isAdmin) return true;
  return plan === 'pro' && (status === 'active' || status === 'trialing' || status === 'past_due');
}

// Express middleware — gate any feature route on the user having access
// (admin / Pro / trialing / past_due grace). Returns a structured 403 the
// frontend can branch on:
//
//   { error: 'access_required', state: 'no_subscription' | 'expired',
//     trialAvailable: <bool> }
//
// state semantics:
//   no_subscription — user has never started a trial; signup CTA shows
//                     "Start 7-day free trial".
//   expired         — user had a subscription that's now canceled or
//                     unpaid past the grace window; CTA shows
//                     "Subscribe to continue".
//
// The grace handling for Stripe-managed trials is built-in: past_due is
// treated as active by isProActive, so users get Stripe's natural dunning
// window (≈3 retries / ~3 weeks) before the subscription transitions to
// canceled. That replaces the app-side "24-48h grace" we'd have needed
// for an app-side trial.
export async function requireActiveAccess(req, res, next) {
  try {
    const tier = await getPlan(req.userId);
    if (isProActive(tier)) return next();

    // Decide which CTA to surface. If user has never had a trial, they're
    // eligible for the 7-day trial. Otherwise (canceled, never converted)
    // they need to subscribe directly.
    let trialAvailable = false;
    try {
      const { data: u } = await supabase
        .from('users')
        .select('trial_consumed')
        .eq('id', req.userId)
        .single();
      trialAvailable = !u?.trial_consumed;
    } catch { /* default false */ }

    return res.status(403).json({
      error: 'access_required',
      state: trialAvailable ? 'no_subscription' : 'expired',
      trialAvailable,
    });
  } catch (err) {
    console.error('requireActiveAccess error:', err?.message || err);
    res.status(500).json({ error: 'access_check_failed' });
  }
}

// Same logic but for top-level browser navigations (e.g. /accounts/connect
// initiates a Google OAuth redirect, so it can't return JSON cleanly).
// Redirects to /app with a flag the SPA reads.
export async function requireActiveAccessOrRedirect(req, res, next) {
  try {
    const tier = await getPlan(req.userId);
    if (isProActive(tier)) return next();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    return res.redirect(`${frontendUrl}/app?upgrade=required`);
  } catch (err) {
    console.error('requireActiveAccessOrRedirect error:', err?.message || err);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/app?error=access_check_failed`);
  }
}
