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
      return res.status(402).json({
        error: 'plan_limit',
        message: 'Free plan supports 1 connected account. Upgrade to Pro for unlimited accounts.',
      });
    }
    next();
  } catch (err) {
    console.error('enforceAccountLimit error:', err?.message || err);
    res.status(500).json({ error: 'plan check failed' });
  }
}
