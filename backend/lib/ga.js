// GA4 Measurement Protocol sender. Used by the Stripe webhook handler to
// fire trial_converted server-side, since the conversion event arrives
// after the user has left the browser session.
//
// The trick is client_id stitching: the React app captures the GA cookie
// _ga at checkout time and stores it in Stripe Subscription metadata. The
// webhook reads it back and uses it as MP's client_id, so the server-side
// event ties to the same GA session the client was tracking. Without
// stitching, the event would be attributed to a fresh anonymous user and
// the conversion funnel would split across two sessions.
//
// Env vars (set on Render):
//   GA_MEASUREMENT_ID — same id as the client. e.g. G-ABCDEFGHIJ
//   GA_MP_API_SECRET  — created in GA4 admin → Data Streams → Web →
//                       Measurement Protocol API secrets. NEVER expose
//                       this to the client; it grants write access.

import { safeLogError } from './log.js';

const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID;
const GA_MP_API_SECRET = process.env.GA_MP_API_SECRET;
const ENABLED = !!GA_MEASUREMENT_ID && !!GA_MP_API_SECRET && process.env.NODE_ENV === 'production';

// Fire-and-forget MP send. Returns a promise but call sites don't need
// to await — webhook handlers should not block on analytics.
//
//   await sendMpEvent({ clientId: '1234.567', name: 'trial_converted',
//                       params: { plan: 'monthly', value: 15 } });
//
// Safe to call when disabled (dev, missing env) — no-ops silently.
// Safe to call without clientId — generates a synthetic anonymous one,
// at the cost of breaking session stitching for that event.
export async function sendMpEvent({ clientId, name, params = {} }) {
  if (!ENABLED) return;

  const cid = clientId || `server.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(GA_MEASUREMENT_ID)}&api_secret=${encodeURIComponent(GA_MP_API_SECRET)}`;
  const body = {
    client_id: cid,
    events: [{ name, params }],
  };

  try {
    // Node 20+ has global fetch. 5s timeout via AbortController so a slow
    // GA endpoint never blocks the webhook response.
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    // GA returns 204 on success, regardless of whether the event was
    // actually accepted by the data pipeline. There's a debug endpoint
    // (mp/collect → debug/mp/collect) but we don't ship that to prod.
    if (!r.ok) {
      safeLogError('ga mp non-2xx', new Error(`status ${r.status}`), { name });
    }
  } catch (err) {
    safeLogError('ga mp send', err, { name });
  }
}
