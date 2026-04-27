// CSRF defense for cookie-authenticated state-changing routes.
//
// Problem: cookie has SameSite=None in production (required because the
// frontend on allthemail.io and the API on api.allthemail.io are different
// registrable domains). That means any third-party site can fire credentialed
// requests at the API. CORS blocks the *response* from being read but the
// state change has already happened server-side.
//
// Defense: require a custom request header that no <form>/<img>/<a> tag can
// set. Browsers preflight any custom header on a cross-origin request, and
// the preflight is governed by CORS — which we've now tightened (P0.6).
// A simple-form-POST CSRF attack therefore cannot include this header.
//
// Header name: X-Requested-By: allthemail. Frontend fetch wrapper sets it on
// every call; legitimate same-origin XHR is unaffected.

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Routes that legitimately receive cross-origin POSTs without our custom header:
//  - Stripe webhook (signed via Stripe-Signature, separate trust path)
//  - OAuth callbacks (Google redirects the browser, no XHR)
const EXEMPT_PATHS = [
  '/billing/webhook',
  '/auth/google/callback',
];

export function requireCsrfHeader(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (EXEMPT_PATHS.some(p => req.path === p || req.path.startsWith(p + '/'))) return next();
  const header = req.get('X-Requested-By');
  if (header === 'allthemail') return next();
  return res.status(403).json({ error: 'CSRF check failed (missing X-Requested-By header)' });
}
