import { Router } from 'express';
import Stripe from 'stripe';
import supabase from '../lib/supabase.js';
import { authenticateToken } from '../middleware/auth.js';
import { safeLogError } from '../lib/log.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
// New tiered pricing — set these in your env
const STRIPE_PRICE_ID_PRO_MONTHLY = process.env.STRIPE_PRICE_ID_PRO_MONTHLY;
const STRIPE_PRICE_ID_PRO_ANNUAL  = process.env.STRIPE_PRICE_ID_PRO_ANNUAL;
// Legacy $9/mo price — kept for grandfathering existing subscribers
const STRIPE_LEGACY_PRICE_ID = process.env.STRIPE_LEGACY_PRICE_ID;
// Fallback: old single-price env var still works if the new ones aren't set
const STRIPE_PRICE_ID_PRO = process.env.STRIPE_PRICE_ID_PRO;
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const router = Router();

// Defensive accessor — Stripe moved current_period_end onto items.data[0]
// in newer API versions. Fall back through known shapes; return null if
// neither is present so we don't throw on a benign field-shape change.
function periodEndIso(subscription) {
  const ts = subscription?.current_period_end
    ?? subscription?.items?.data?.[0]?.current_period_end
    ?? null;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

// Stripe webhook — must use express.raw() body, registered separately in server.js
router.handleWebhook = async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(501).json({ error: 'Stripe not configured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  // P1.4 — idempotency. Stripe retries on any non-2xx. Without dedupe a
  // duplicate delivery double-applies. We record event.id and return 200
  // if we've seen it before.
  try {
    const { error: dedupeErr } = await supabase
      .from('stripe_events')
      .insert({ event_id: event.id, type: event.type });
    if (dedupeErr) {
      // 23505 = unique violation on event_id PK → duplicate delivery; ack and skip.
      if (dedupeErr.code === '23505') {
        return res.json({ received: true, deduped: true });
      }
      // If the table is missing (migration not applied), log and continue
      // so a brand-new deploy doesn't break the webhook entirely.
      if (dedupeErr.code === 'PGRST205' || /relation .* does not exist/i.test(dedupeErr.message || '')) {
        console.warn('[BILLING] stripe_events table missing — skipping idempotency check');
      } else {
        console.error('[BILLING] dedupe insert failed:', dedupeErr);
      }
    }
  } catch (err) {
    console.error('[BILLING] dedupe error:', err);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        if (userId) {
          // P1.5-style sanity: verify the metadata user_id matches a real user
          // and that the customer_email Stripe sends is consistent with our
          // stored email. Belt-and-suspenders against metadata tampering or
          // a future code path that sets metadata.user_id from non-auth source.
          const { data: u } = await supabase
            .from('users')
            .select('id, email')
            .eq('id', userId)
            .single();
          if (!u) {
            console.warn('[BILLING] checkout.session.completed for unknown user_id:', userId);
            break;
          }
          if (session.customer_email && u.email && session.customer_email.toLowerCase() !== u.email.toLowerCase()) {
            console.warn('[BILLING] customer_email mismatch — refusing upsert', {
              userId, sessionEmail: session.customer_email, userEmail: u.email,
            });
            break;
          }
          await supabase.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            plan: 'pro',
            status: 'active'
          }, { onConflict: 'user_id' });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const periodEnd = periodEndIso(subscription);
        const update = { status: subscription.status };
        if (periodEnd) update.current_period_end = periodEnd;
        await supabase.from('subscriptions')
          .update(update)
          .eq('stripe_subscription_id', subscription.id);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await supabase.from('subscriptions')
          .update({ plan: 'free', status: 'canceled' })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }
    }
    res.json({ received: true });
  } catch (err) {
    safeLogError('stripe webhook handler', err, { eventType: event?.type, eventId: event?.id });
    res.status(500).json({ error: 'Webhook handler failed' });
  }
};

// Get billing status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status, current_period_end')
      .eq('user_id', req.userId)
      .single();

    res.json({ plan: sub?.plan || 'free', status: sub?.status || 'none', currentPeriodEnd: sub?.current_period_end || null });
  } catch (err) {
    console.error('Get billing status error:', err);
    res.json({ plan: 'free', status: 'none', currentPeriodEnd: null });
  }
});

// Create checkout session
router.post('/checkout', authenticateToken, async (req, res) => {
  // Resolve price ID: prefer new tiered prices, fall back to legacy env var
  const { interval = 'monthly' } = req.body || {};
  const priceId = interval === 'annual'
    ? (STRIPE_PRICE_ID_PRO_ANNUAL || STRIPE_PRICE_ID_PRO)
    : (STRIPE_PRICE_ID_PRO_MONTHLY || STRIPE_PRICE_ID_PRO);

  if (!stripe || !priceId) {
    return res.status(501).json({ error: 'Stripe not configured' });
  }

  try {
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', req.userId)
      .single();

    // Omit payment_method_types so Stripe uses every method enabled in the
    // dashboard for this account — `card` includes Apple Pay and Google Pay
    // automatically when the browser supports it, plus Link if enabled.
    // Toggle other methods (Cash App Pay, Klarna, etc.) from the Stripe
    // dashboard → Settings → Payment methods. Apple Pay domain verification
    // is automatic for Stripe-hosted Checkout.
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${FRONTEND_URL}/app?billing=success`,
      cancel_url: `${FRONTEND_URL}/app?billing=canceled`,
      customer_email: user?.email,
      metadata: { user_id: req.userId },
      // Surface the payment-method wallet UI as the primary flow so
      // Apple Pay / Google Pay appear in-prominence instead of behind
      // a collapsed "more options" row.
      payment_method_collection: 'always',
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Create checkout session error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Create portal session
router.post('/portal', authenticateToken, async (req, res) => {
  if (!stripe) {
    return res.status(501).json({ error: 'Stripe not configured' });
  }

  try {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', req.userId)
      .single();

    if (!sub?.stripe_customer_id) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${FRONTEND_URL}/app`
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Create portal session error:', err);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

export default router;
