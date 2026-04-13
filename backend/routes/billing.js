import { Router } from 'express';
import Stripe from 'stripe';
import supabase from '../lib/supabase.js';
import { authenticateToken } from '../middleware/auth.js';

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

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        if (userId) {
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
        await supabase.from('subscriptions')
          .update({
            status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
          })
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
    console.error('Stripe webhook handler error:', err);
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

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${FRONTEND_URL}/app?billing=success`,
      cancel_url: `${FRONTEND_URL}/app?billing=canceled`,
      customer_email: user?.email,
      metadata: { user_id: req.userId }
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
