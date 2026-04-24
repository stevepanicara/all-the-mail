# Apple Pay domain verification

This folder serves one file: `apple-developer-merchantid-domain-association`.

## When this file matters

**Stripe-hosted Checkout (our current flow — `checkout.stripe.com/...`):**
Apple Pay works automatically once enabled in the Stripe dashboard. The
verification file here is **not required** for Checkout-hosted billing.

**Future: Stripe Elements / Payment Request button embedded directly on
allthemail.io:** if we ever put a "Pay with Apple Pay" button on our
own domain (marketing landing page, in-app upsell, etc.), Apple requires
that `https://allthemail.io/.well-known/apple-developer-merchantid-domain-association`
serve the exact string Stripe gives us.

## To complete verification when we need it

1. Stripe Dashboard → **Settings** → **Payment methods** → **Apple Pay**
2. Click **"Add new domain"**, enter `allthemail.io`
3. Download the verification file Stripe provides
4. Replace the body of `apple-developer-merchantid-domain-association`
   with the exact bytes from that download (no trailing newline added)
5. Deploy (Vercel serves files from `public/.well-known/` automatically)
6. Back in the Stripe dashboard, click **Verify**

## Serving notes

- Vercel serves `/.well-known/*` without any extra config — `vercel.json`
  already has a headers rule that applies to `/(.*)` so security headers
  cover this path too.
- The file must be served as `text/plain` or `application/octet-stream`;
  Vercel will auto-detect based on content.
- Do **not** rename the file — Apple Pay verification requires the exact
  filename `apple-developer-merchantid-domain-association` (no extension).
