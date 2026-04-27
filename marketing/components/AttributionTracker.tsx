'use client';

import { useEffect } from 'react';

// First-touch attribution. Captures UTM params, referrer, and landing path
// on first visit and persists them in a 30-day cookie scoped to the apex
// domain (.allthemail.io) so they survive the cross-subdomain hop into the
// React app and the OAuth round-trip through Google.
//
// First-touch (not last-touch): if the cookie already exists and is fresh,
// don't overwrite it. A user who clicks a Google ad, bookmarks the site,
// returns organically a week later, and converts — the conversion belongs
// to the original ad, not to "direct."
//
// Cookie shape (URL-encoded JSON):
//   { utm_source, utm_medium, utm_campaign, utm_term, utm_content,
//     referrer, landing_path, first_seen_at }
//
// Read by:
//   - frontend/src/utils/attribution.js (CRA app, when launching checkout)
//   - any marketing page that wants to surface attribution-aware copy
//
// Render this component once, in app/layout.tsx, so it fires on every page
// load. It's a no-op after the cookie is set (most page loads after the
// first one).

const COOKIE_NAME = 'atm_attribution';
const TTL_DAYS = 30;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]+)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, days: number) {
  const exp = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  // In production we use the apex .allthemail.io so the cookie is shared
  // across allthemail.io, app.allthemail.io, and api.allthemail.io. In dev
  // (localhost) we omit the domain so the browser scopes it host-only.
  const isProdHost = typeof window !== 'undefined' && /allthemail\.io$/i.test(window.location.hostname);
  const domainAttr = isProdHost ? '; domain=.allthemail.io' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax${domainAttr}`;
}

export function AttributionTracker() {
  useEffect(() => {
    try {
      // Don't overwrite an existing cookie — first-touch wins.
      if (readCookie(COOKIE_NAME)) return;

      const params = new URLSearchParams(window.location.search);
      const captured: Record<string, string> = {};
      let hasUtm = false;
      for (const key of UTM_KEYS) {
        const v = params.get(key);
        if (v) { captured[key] = v.slice(0, 500); hasUtm = true; }
      }

      // Referrer + landing path are useful even when no UTMs are present.
      // Direct (no referrer, no UTMs) still gets a cookie so we can
      // distinguish "direct visit then converted" from "no data at all."
      const referrer = (document.referrer || '').slice(0, 500);
      const landingPath = (window.location.pathname + window.location.search).slice(0, 500);
      const firstSeenAt = new Date().toISOString();

      // If there's literally nothing to record (no UTMs, no referrer, came
      // straight to homepage), skip — don't bloat with empty cookies.
      if (!hasUtm && !referrer) return;

      const payload = { ...captured, referrer, landing_path: landingPath, first_seen_at: firstSeenAt };
      writeCookie(COOKIE_NAME, JSON.stringify(payload), TTL_DAYS);
    } catch {
      // Cookie disabled, document.cookie throws — silently ignore.
    }
  }, []);

  return null;
}
