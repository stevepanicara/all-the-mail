// Account identity colors — brand-locked palette.
// Five slots cycled deterministically by account index or id hash.

export const ACCT_PALETTE = [
  { key: 'red',     bg: '#FF3A1D', ink: '#FFFFFF', wash: 'rgba(255,58,29,0.10)', inkLabel: '#FF3A1D' },
  { key: 'cobalt',  bg: '#1B2BFF', ink: '#FFFFFF', wash: 'rgba(27,43,255,0.10)', inkLabel: '#1B2BFF' },
  { key: 'acid',    bg: '#CCFF00', ink: '#0A0A0A', wash: 'rgba(204,255,0,0.30)', inkLabel: '#0A0A0A' },
  { key: 'voltage', bg: '#FFE500', ink: '#0A0A0A', wash: 'rgba(255,229,0,0.35)', inkLabel: '#8A7500' },
  { key: 'ink',     bg: '#0A0A0A', ink: '#FAFAF7', wash: 'rgba(10,10,10,0.08)', inkLabel: '#0A0A0A' },
];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// Resolve account color by account index among connectedAccounts,
// falling back to id/email hash if no index provided.
export function getAccountColor(accountOrId, accounts = []) {
  if (!accountOrId) return ACCT_PALETTE[0];
  const id = typeof accountOrId === 'string' ? accountOrId : (accountOrId.id || accountOrId.email || '');
  if (!id) return ACCT_PALETTE[0];

  if (accounts.length) {
    const idx = accounts.findIndex(a => a.id === id || a.email === id);
    if (idx >= 0) return ACCT_PALETTE[idx % ACCT_PALETTE.length];
  }
  return ACCT_PALETTE[hashStr(String(id)) % ACCT_PALETTE.length];
}

export function getAccountColorByIndex(index = 0) {
  return ACCT_PALETTE[((index % ACCT_PALETTE.length) + ACCT_PALETTE.length) % ACCT_PALETTE.length];
}
