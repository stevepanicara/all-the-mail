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

// Express middleware: enforce account-count limit for free users. Use on
// routes that ADD a connected Google account.
//
// /accounts/connect is a top-level browser navigation (not a fetch), so
// returning a JSON body just dumps "{error:plan_limit,...}" to the page.
// Instead, redirect back to the frontend with an upgrade-required flag
// so the SPA can show a styled modal.
export async function enforceAccountLimit(req, res, next) {
  try {
    const tier = await getPlan(req.userId);
    if (isProActive(tier)) return next();

    const { count, error } = await supabase
      .from('gmail_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.userId);
    if (error) throw error;
    if ((count || 0) >= 1) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      return res.redirect(`${frontendUrl}/app?upgrade=required`);
    }
    next();
  } catch (err) {
    console.error('enforceAccountLimit error:', err?.message || err);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/app?error=plan_check_failed`);
  }
}
