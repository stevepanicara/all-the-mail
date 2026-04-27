// GA4 + measurement-protocol bridge for the React app.
//
// Why a queue: the gtag.js script loads with strategy="afterInteractive"
// equivalent (script tag with async). Any gtag() call before the script
// finishes loading just pushes onto window.dataLayer. When gtag.js loads,
// it drains the queue and forwards the events. So events fired during
// early app boot — the kind we care about for trial_started — are never
// lost as long as the shim is set up before any gtag() call.
//
// Env: REACT_APP_GA_MEASUREMENT_ID — set on Vercel for the CRA project.
// In dev (no env var, or NODE_ENV=development) this module no-ops.

const GA_ID = process.env.REACT_APP_GA_MEASUREMENT_ID || '';
const ENABLED = !!GA_ID && process.env.NODE_ENV === 'production';

let _scriptLoaded = false;

function setupShim() {
  if (typeof window === 'undefined') return;
  // Always create the dataLayer shim, even if disabled, so call sites
  // don't have to feature-detect — they just call event() unconditionally
  // and we silently drop in dev.
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag(...args) { window.dataLayer.push(args); };
  }
}

function loadScript() {
  if (!ENABLED || _scriptLoaded || typeof document === 'undefined') return;
  _scriptLoaded = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { send_page_view: true });
}

// Initialize on module load — runs once on first import. Safe to do
// multiple times because of the _scriptLoaded guard.
setupShim();
loadScript();

// Fire a custom GA4 event. Safe to call before gtag.js loads — it'll
// queue. Safe to call when GA is disabled — it no-ops.
export function event(name, params = {}) {
  if (typeof window === 'undefined' || !window.gtag) return;
  if (!ENABLED) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[analytics dev]', name, params);
    }
    return;
  }
  try { window.gtag('event', name, params); } catch (_) { /* ignore */ }
}

// Read the GA client id from the _ga cookie. Format: GA1.1.<cid>.<ts>
// We want the <cid>.<ts> portion for Measurement Protocol stitching.
// Returns null if cookie absent (GA blocked, or before gtag.js loaded).
export function readGaClientId() {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|; )_ga=([^;]+)/);
  if (!m) return null;
  // Cookie value: e.g. "GA1.1.1234567890.1719700000"
  // GA4 client_id is the last two dot-separated parts joined by a dot.
  const parts = decodeURIComponent(m[1]).split('.');
  if (parts.length < 4) return null;
  return `${parts[2]}.${parts[3]}`;
}
