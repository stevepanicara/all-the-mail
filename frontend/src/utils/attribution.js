// Reads the first-touch attribution cookie that the marketing site set
// when the user landed on allthemail.io. Cookie is scoped to .allthemail.io
// in prod so it rides along the cross-subdomain hop into app.allthemail.io
// and through the OAuth round-trip.
//
// Returns the parsed object or null. Never throws — a missing/corrupt
// cookie just means we have no attribution data for this conversion.
//
// Shape:
//   { utm_source, utm_medium, utm_campaign, utm_term, utm_content,
//     referrer, landing_path, first_seen_at }

const COOKIE_NAME = 'atm_attribution';

export function readAttribution() {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(/(?:^|; )atm_attribution=([^;]+)/);
    if (!match) return null;
    const parsed = JSON.parse(decodeURIComponent(match[1]));
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

// Defensive serializer — stringify to safe JSON for sending in a fetch body.
// Keeps the call site clean: handleUpgrade just spreads { attribution }.
export function attributionPayload() {
  const data = readAttribution();
  return data ? { attribution: data } : {};
}

export { COOKIE_NAME };
