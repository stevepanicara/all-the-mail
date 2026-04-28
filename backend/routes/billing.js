import { Router } from 'express';
import Stripe from 'stripe';
import supabase from '../lib/supabase.js';
import { authenticateToken } from '../middleware/auth.js';
import { safeLogError } from '../lib/log.js';
import { invalidatePlanCache } from '../middleware/plan.js';
import { sendMpEvent } from '../lib/ga.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
// Tiered pricing — set these in your env
const STRIPE_PRICE_ID_PRO_MONTHLY = process.env.STRIPE_PRICE_ID_PRO_MONTHLY;
const STRIPE_PRICE_ID_PRO_ANNUAL  = process.env.STRIPE_PRICE_ID_PRO_ANNUAL;
// Legacy $9/mo price — kept for grandfathering existing subscribers
const STRIPE_LEGACY_PRICE_ID = process.env.STRIPE_LEGACY_PRICE_ID;
// Fallback: old single-price env var still works if the new ones aren't set
const STRIPE_PRICE_ID_PRO = process.env.STRIPE_PRICE_ID_PRO;

// Pin Stripe SDK config — apiVersion locks the response payload shape so a
// Stripe upgrade doesn't silently break the webhook handler. Retries cover
// transient network blips. 10s timeout prevents hanging the request thread.
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
  maxNetworkRetries: 2,
  timeout: 10_000,
}) : null;

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Defensive accessor — Stripe moved current_period_end onto items.data[0]
// in newer API versions. Fall back through known shapes; return null if
// neither is present so we don't throw on a benign field-shape change.
function periodEndIso(subscription) {
  const ts = subscription?.current_period_end
    ?? subscription?.items?.data?.[0]?.current_period_end
    ?? null;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

// Look up or create the Stripe Customer for a user. The cardinal invariant:
// one user ↔ one Stripe customer, period.
//
// Three fallbacks, in order:
//   1. Our DB mapping (fast path — typical case after first checkout)
//   2. Stripe.customers.list({ email }) (recovers orphans after a DB loss
//      or when migrating from a system that already created Stripe customers)
//   3. Create new — with idempotencyKey as a third safety net so even a
//      parallel-request race only ever produces one customer
//
// Always sets metadata.user_id on creation. That metadata is the lifeline
// for reconciling Stripe-originated events back to the right user, and for
// the daily reconciliation job.
async function getOrCreateCustomer(userId) {
  if (!stripe) throw new Error('Stripe not configured');

  // 1. DB
  const { data: mapped } = await supabase
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (mapped?.stripe_customer_id) return mapped.stripe_customer_id;

  // Pull email for the lookup + creation paths
  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();
  if (!user?.email) throw new Error(`User ${userId} has no email`);

  // 2. Stripe — search for an orphan customer by email
  try {
    const matches = await stripe.customers.list({ email: user.email, limit: 2 });
    if (matches.data.length === 1) {
      const cid = matches.data[0].id;
      // Patch metadata so future reconciliation works
      if (!matches.data[0].metadata?.user_id) {
        try {
          await stripe.customers.update(cid, { metadata: { user_id: userId } });
        } catch { /* non-fatal */ }
      }
      await supabase
        .from('stripe_customers')
        .upsert({ user_id: userId, stripe_customer_id: cid }, { onConflict: 'user_id' });
      return cid;
    }
    if (matches.data.length > 1) {
      // Already duplicated — log and pick the oldest one. Operator should
      // clean up via the Stripe Dashboard.
      safeLogError('stripe duplicate customers detected', new Error('multiple matches'), {
        userId, email: user.email, customerIds: matches.data.map(c => c.id),
      });
      const sorted = matches.data.slice().sort((a, b) => a.created - b.created);
      const cid = sorted[0].id;
      await supabase
        .from('stripe_customers')
        .upsert({ user_id: userId, stripe_customer_id: cid }, { onConflict: 'user_id' });
      return cid;
    }
  } catch (err) {
    safeLogError('stripe customers.list', err, { userId });
    // fall through to create — better to create a (possibly duplicate) customer
    // than to fail checkout entirely on a Stripe outage
  }

  // 3. Create — idempotency key prevents duplicates under race
  const created = await stripe.customers.create(
    { email: user.email, metadata: { user_id: userId } },
    { idempotencyKey: `customer-create-${userId}` },
  );
  await supabase
    .from('stripe_customers')
    .upsert({ user_id: userId, stripe_customer_id: created.id }, { onConflict: 'user_id' });
  return created.id;
}

// True if user has a subscription that should block a new Checkout. Includes
// `incomplete` because Stripe creates that state during 3DS flows — letting
// a user start a second checkout while one is mid-3DS would still produce
// duplicate charges if they both succeed.
async function hasBlockingSubscription(userId) {
  const { data } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing', 'past_due', 'incomplete'])
    .maybeSingle();
  return !!data;
}

// Centralized writer for subscription rows. Always upsert keyed on the Stripe
// subscription id — handles out-of-order webhook delivery (subscription.updated
// arriving before checkout.session.completed and similar). Status is the only
// guaranteed field; everything else is best-effort.
async function upsertSubscription({ userId, customerId, subscriptionId, status, plan, periodEnd, cancelAtPeriodEnd, itemId }) {
  const row = {
    stripe_subscription_id: subscriptionId,
    status,
  };
  if (userId) row.user_id = userId;
  if (customerId) row.stripe_customer_id = customerId;
  if (plan !== undefined) row.plan = plan;
  if (periodEnd) row.current_period_end = periodEnd;
  if (cancelAtPeriodEnd !== undefined) row.cancel_at_period_end = !!cancelAtPeriodEnd;
  if (itemId) row.stripe_item_id = itemId;

  const { error } = await supabase
    .from('subscriptions')
    .upsert(row, { onConflict: 'stripe_subscription_id' });
  if (error) throw error;
}

// Resolve userId from a Stripe customer id by looking through our mapping
// table first (canonical), then falling back to the customer.metadata that
// we set on create. Returns null if neither resolves.
async function resolveUserIdFromCustomer(customerId) {
  if (!customerId) return null;
  const { data } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (data?.user_id) return data.user_id;
  // Fallback: ask Stripe for the customer's metadata
  if (stripe) {
    try {
      const c = await stripe.customers.retrieve(customerId);
      const metaUserId = !c.deleted ? c?.metadata?.user_id : null;
      if (metaUserId) {
        // Backfill our mapping
        await supabase
          .from('stripe_customers')
          .upsert({ user_id: metaUserId, stripe_customer_id: customerId }, { onConflict: 'user_id' });
        return metaUserId;
      }
    } catch (err) {
      safeLogError('stripe customers.retrieve', err, { customerId });
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

// Order: verify signature → check dedupe → run side effects → record event.
//
// Why "record event LAST" instead of FIRST:
//   The original handler inserted the dedupe row up front (transactionally
//   "claiming" the event) and then ran side effects in a separate try block.
//   Without a transaction across both writes, a crash between them left the
//   event recorded as "processed" while the side effect never ran — Stripe's
//   retry would then dedupe and skip, silently losing the event.
//
//   By recording last, we get at-least-once delivery: a crash after side
//   effects but before the dedupe write means Stripe replays, the side
//   effect re-runs, and because all our handlers are idempotent (upsert
//   keyed on stripe_subscription_id), the replay is a no-op. Safer.
router.handleWebhook = async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(501).json({ error: 'Stripe not configured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    safeLogError('stripe webhook signature verification', err);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  // Dedupe: have we processed this event before?
  try {
    const { data: prior } = await supabase
      .from('stripe_events')
      .select('event_id')
      .eq('event_id', event.id)
      .maybeSingle();
    if (prior) return res.json({ received: true, deduped: true });
  } catch (err) {
    // If the table is missing (migration not applied), log and continue —
    // a brand-new deploy shouldn't have its webhook completely break.
    if (err?.code === 'PGRST205' || /relation .* does not exist/i.test(err?.message || '')) {
      console.warn('[BILLING] stripe_events table missing — skipping idempotency check');
    } else {
      safeLogError('stripe_events dedupe lookup', err, { eventId: event.id });
    }
  }

  // Side effects — wrapped so we can record the event AFTER they succeed.
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        if (!userId) {
          safeLogError('checkout.session.completed missing user_id metadata', new Error('no metadata.user_id'), {
            sessionId: session.id, customerId: session.customer,
          });
          break;
        }

        // Belt-and-suspenders: confirm this userId exists and the customer
        // email Stripe reported matches our stored email.
        const { data: u } = await supabase
          .from('users')
          .select('id, email')
          .eq('id', userId)
          .single();
        if (!u) {
          safeLogError('checkout.session.completed for unknown user', new Error('unknown user_id'), { userId });
          break;
        }
        if (session.customer_email && u.email && session.customer_email.toLowerCase() !== u.email.toLowerCase()) {
          safeLogError('checkout.session.completed email mismatch', new Error('email mismatch'), {
            userId, sessionEmail: session.customer_email,
          });
          break;
        }

        // Backfill the customer mapping in case this user was created via
        // a code path that didn't use getOrCreateCustomer.
        if (session.customer) {
          await supabase
            .from('stripe_customers')
            .upsert({ user_id: userId, stripe_customer_id: session.customer }, { onConflict: 'user_id' });
        }

        // Pull subscription details so we can capture stripe_item_id +
        // current_period_end directly. checkout.session.completed itself
        // doesn't include the subscription object.
        let sub = null;
        if (session.subscription) {
          try { sub = await stripe.subscriptions.retrieve(session.subscription); } catch { /* fall through */ }
        }
        await upsertSubscription({
          userId,
          customerId: session.customer,
          subscriptionId: session.subscription,
          status: sub?.status || 'active',
          plan: 'pro',
          periodEnd: sub ? periodEndIso(sub) : null,
          cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
          itemId: sub?.items?.data?.[0]?.id || null,
        });
        invalidatePlanCache(userId);

        // GA4: trial_converted — server-side via Measurement Protocol.
        // Stitched to the same GA session via the ga_client_id we stashed
        // in metadata at checkout time. Plan/value derived from the
        // Subscription (interval saved in metadata.plan_interval). Fire-
        // and-forget; the webhook response should not block on analytics.
        const gaCid = session.metadata?.ga_client_id || sub?.metadata?.ga_client_id || null;
        const planInterval = session.metadata?.plan_interval || sub?.metadata?.plan_interval || 'monthly';
        const value = planInterval === 'annual' ? 144 : 15;
        sendMpEvent({
          clientId: gaCid,
          name: 'trial_converted',
          params: { plan: planInterval, value, currency: 'USD' },
        }).catch(() => {});
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id || await resolveUserIdFromCustomer(sub.customer);
        if (!userId) {
          safeLogError('subscription event without resolvable user', new Error('no user_id'), {
            subscriptionId: sub.id, customerId: sub.customer, eventType: event.type,
          });
          break;
        }
        await upsertSubscription({
          userId,
          customerId: sub.customer,
          subscriptionId: sub.id,
          status: sub.status,
          plan: sub.status === 'canceled' ? 'free' : 'pro',
          periodEnd: periodEndIso(sub),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          itemId: sub.items?.data?.[0]?.id || null,
        });
        invalidatePlanCache(userId);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id || await resolveUserIdFromCustomer(sub.customer);
        await upsertSubscription({
          userId,
          customerId: sub.customer,
          subscriptionId: sub.id,
          status: 'canceled',
          plan: 'free',
          periodEnd: periodEndIso(sub),
          cancelAtPeriodEnd: false,
        });
        if (userId) invalidatePlanCache(userId);
        break;
      }

      case 'invoice.payment_failed': {
        // Invoice carries the subscription id — flip status to past_due so
        // the UI can prompt the user to update their card. Access remains
        // (isProActive treats past_due as active) so we get a grace window.
        const inv = event.data.object;
        const subscriptionId = inv.subscription;
        if (subscriptionId) {
          const { data: existing } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', subscriptionId)
            .maybeSingle();
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due' })
            .eq('stripe_subscription_id', subscriptionId);
          if (existing?.user_id) invalidatePlanCache(existing.user_id);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        // Renewal — extend current_period_end. Best-effort; the canonical
        // update typically also arrives via subscription.updated.
        const inv = event.data.object;
        const subscriptionId = inv.subscription;
        if (subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const userId = sub.metadata?.user_id || await resolveUserIdFromCustomer(sub.customer);
            await upsertSubscription({
              userId,
              customerId: sub.customer,
              subscriptionId: sub.id,
              status: sub.status,
              plan: sub.status === 'canceled' ? 'free' : 'pro',
              periodEnd: periodEndIso(sub),
              cancelAtPeriodEnd: sub.cancel_at_period_end,
              itemId: sub.items?.data?.[0]?.id || null,
            });
            if (userId) invalidatePlanCache(userId);
          } catch (err) {
            safeLogError('invoice.payment_succeeded retrieve', err, { subscriptionId });
          }
        }
        break;
      }

      // All other event types: ack and record (so retries don't pile up),
      // but do not act.
      default:
        break;
    }
  } catch (err) {
    safeLogError('stripe webhook handler', err, { eventType: event?.type, eventId: event?.id });
    // Do NOT record the event — let Stripe retry. The side effect failed.
    return res.status(500).json({ error: 'Webhook handler failed' });
  }

  // Side effects succeeded. Record the event so future deliveries dedupe.
  try {
    await supabase.from('stripe_events').insert({ event_id: event.id, type: event.type });
  } catch (err) {
    // Non-fatal: a 23505 here means a parallel delivery already recorded it.
    if (err?.code !== '23505') {
      safeLogError('stripe_events insert post-handler', err, { eventId: event.id });
    }
  }

  res.json({ received: true });
};

// ---------------------------------------------------------------------------
// User-facing routes
// ---------------------------------------------------------------------------

router.get('/status', authenticateToken, async (req, res) => {
  try {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status, current_period_end, cancel_at_period_end')
      .eq('user_id', req.userId)
      .maybeSingle();

    res.json({
      plan: sub?.plan || 'free',
      status: sub?.status || 'none',
      currentPeriodEnd: sub?.current_period_end || null,
      cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
    });
  } catch (err) {
    safeLogError('billing status', err, { userId: req.userId });
    res.json({ plan: 'free', status: 'none', currentPeriodEnd: null, cancelAtPeriodEnd: false });
  }
});

// Allowlist of attribution metadata keys we accept from the client. Anything
// else gets dropped — prevents a malicious user from stuffing arbitrary
// metadata onto their own Stripe subscription. Stripe enforces 50 keys × 40
// chars × 500 chars per value; ours are well within those limits.
const ATTRIBUTION_KEYS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'referrer', 'landing_path', 'first_seen_at',
];
function sanitizeAttribution(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const k of ATTRIBUTION_KEYS) {
    if (raw[k] != null) {
      const s = String(raw[k]).slice(0, 500);
      if (s) out[k] = s;
    }
  }
  return out;
}

router.post('/checkout', authenticateToken, async (req, res) => {
  const { interval = 'monthly', attribution: rawAttribution, ga_client_id: rawGaCid } = req.body || {};
  // GA4 client_id format: <random>.<timestamp>, both numeric. Defensively
  // sanitize so a malicious client can't stuff anything else into the
  // metadata field. Reject if it doesn't fit the shape.
  const gaClientId = typeof rawGaCid === 'string' && /^\d+\.\d+$/.test(rawGaCid) ? rawGaCid : null;
  const priceId = interval === 'annual'
    ? (STRIPE_PRICE_ID_PRO_ANNUAL || STRIPE_PRICE_ID_PRO)
    : (STRIPE_PRICE_ID_PRO_MONTHLY || STRIPE_PRICE_ID_PRO);

  if (!stripe || !priceId) {
    return res.status(501).json({ error: 'Stripe not configured' });
  }

  try {
    // Layer-3 guard: refuse if the user already has an active subscription.
    // The Customer Portal handles plan changes; checkout is for new subs only.
    if (await hasBlockingSubscription(req.userId)) {
      return res.status(409).json({
        error: 'already_subscribed',
        message: 'You already have an active subscription. Manage it from the customer portal.',
      });
    }

    // Trial eligibility — one trial per user, ever. We track this on the
    // user record. The first time someone hits checkout we mark
    // trial_consumed=true. Future checkout calls for the same user skip
    // trial_period_days entirely (full immediate charge).
    const { data: userRow } = await supabase
      .from('users')
      .select('trial_consumed, email')
      .eq('id', req.userId)
      .single();
    const trialEligible = !userRow?.trial_consumed;

    const customerId = await getOrCreateCustomer(req.userId);

    // Marketing attribution — first-touch UTMs/referrer captured by the
    // marketing site cookie and forwarded by the React app. Sanitized
    // through an allowlist so the client can't stuff arbitrary metadata.
    // Attached to BOTH the Session and the Subscription: Session so the
    // checkout.session.completed handler sees it; Subscription so it's
    // visible in the Stripe Dashboard for the entire lifecycle (and
    // searchable via metadata['utm_source']:'google' etc.).
    //
    // ga_client_id is also stored so the trial_converted MP event we fire
    // server-side from the webhook can stitch to the same GA session.
    const attribution = sanitizeAttribution(rawAttribution);
    const metaCommon = { user_id: req.userId, ...attribution };
    if (gaClientId) {
      metaCommon.ga_client_id = gaClientId;
      metaCommon.plan_interval = interval;
    }

    // Build subscription_data: metadata propagates to the Subscription
    // object so customer.subscription.* webhooks carry attribution +
    // user_id. When the user is trial-eligible, layer the 14-day trial
    // and the cancel-on-missing-PM end_behavior on top.
    const subscriptionData = { metadata: metaCommon };
    if (trialEligible) {
      subscriptionData.trial_period_days = 14;
      // If the trial ends without a successful charge (card declined,
      // removed PM), Stripe should cancel the subscription rather than
      // send the user to past_due forever. Keeps the lockout clean.
      subscriptionData.trial_settings = {
        end_behavior: { missing_payment_method: 'cancel' },
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${FRONTEND_URL}/app?billing=success`,
      cancel_url: `${FRONTEND_URL}/app?billing=canceled`,
      customer: customerId,
      // Both metadata locations:
      //   session.metadata is read by checkout.session.completed
      //   subscription_data.metadata propagates to the Subscription so
      //   subsequent customer.subscription.* events carry user_id too.
      metadata: { ...metaCommon, trial_eligible: String(trialEligible) },
      subscription_data: subscriptionData,
      // DO NOT set payment_method_types — when omitted on a subscription-
      // mode Checkout Session, Stripe surfaces every method enabled in the
      // dashboard (card, Apple Pay, Google Pay, Link, etc.). Hard-coding
      // payment_method_types: ['card'] silently disables wallets and Link.
      // automatic_payment_methods is for PaymentIntents only — it is not a
      // valid CheckoutSession parameter.
      payment_method_collection: 'always',
    });

    // Mark trial as consumed at session creation, not at completion. If we
    // waited for completion, a user could open a checkout, abandon it, and
    // open another — getting unlimited trial periods. Marking on session
    // creation closes that loop.
    if (trialEligible) {
      await supabase
        .from('users')
        .update({ trial_consumed: true })
        .eq('id', req.userId);
    }

    res.json({ url: session.url });
  } catch (err) {
    safeLogError('create checkout session', err, { userId: req.userId });
    if (err?.message === 'already_subscribed') {
      return res.status(409).json({ error: 'already_subscribed' });
    }
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

router.post('/portal', authenticateToken, async (req, res) => {
  if (!stripe) return res.status(501).json({ error: 'Stripe not configured' });

  try {
    // Look up customer mapping first (preferred), fall back to subscriptions
    // for users who pre-date the stripe_customers table.
    let customerId = null;
    const { data: mapped } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', req.userId)
      .maybeSingle();
    customerId = mapped?.stripe_customer_id || null;

    if (!customerId) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', req.userId)
        .maybeSingle();
      customerId = sub?.stripe_customer_id || null;
    }

    if (!customerId) {
      return res.status(400).json({ error: 'No Stripe customer found for this account' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${FRONTEND_URL}/app`,
    });

    res.json({ url: session.url });
  } catch (err) {
    safeLogError('create portal session', err, { userId: req.userId });
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

export default router;
