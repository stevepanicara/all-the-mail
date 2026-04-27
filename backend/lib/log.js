// Safe logging helper. Upstream errors (Supabase, Google API, Stripe)
// often carry rich `config`, `request`, `response`, or `toJSON` payloads
// that Node's default console.error will serialize — leaking query
// parameters, request bodies, and occasionally token snippets into
// Render's retained log stream.
//
// Usage: safeLogError('GET /emails/:accountId', err, { accountId: req.params.accountId })
// The only thing that reaches the log is a fixed shape:
//   { ts, label, message, code, status, context? }

export function safeLogError(label, err, context) {
  const picked = {
    ts: new Date().toISOString(),
    label,
    message: err?.message || String(err || ''),
    code: err?.code || err?.errors?.[0]?.reason || null,
    status: err?.status || err?.response?.status || null,
  };
  if (context && typeof context === 'object') {
    picked.context = {};
    for (const [k, v] of Object.entries(context)) {
      // Allow primitives only; skip objects/arrays so callers can't
      // accidentally funnel req/res/body into the log.
      if (v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        picked.context[k] = v;
      }
    }
  }
  // Single-line JSON is easy to search in Render. console.error marks it
  // as stderr so it shows up with log level in the Render UI.
  console.error(JSON.stringify(picked));
}
