// P1.3 — plan tier enforcement.
//
// Reads the user's subscription tier and decides whether a feature is
// allowed. Cached short-term to avoid hitting Supabase on every request.
//
// The differentiator the public pricing page promises is "Pro = unlimited
// connected accounts; Free = 1". That's the gate we enforce today. Other
// features (scheduled-sends, snoozed, calendar edit) stay open to all
// authenticated users to avoid surprising existing pre-paywall users.

import supabase from '../lib/supabase.js';

const PLAN_CACHE_TTL_MS = 60 * 1000;
const _planCache = new Map(); // userId -> { plan, status, expiresAt }

export function invalidatePlanCache(userId) {
  _planCache.delete(userId);
}

export async function getPlan(userId) {
  if (!userId) return { plan: 'free', status: 'none' };
  const cached = _planCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached;

  let plan = 'free', status = 'none';
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

  const entry = { plan, status, expiresAt: Date.now() + PLAN_CACHE_TTL_MS };
  _planCache.set(userId, entry);
  return entry;
}

export function isProActive({ plan, status }) {
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
