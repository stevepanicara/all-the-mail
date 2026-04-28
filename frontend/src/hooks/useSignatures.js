import { useEffect, useState } from 'react';
import { API_BASE } from '../utils/constants';

// Per-account Gmail signature cache. Fetches each account's signature
// once on mount (the backend caches 24h, so subsequent boots hit the
// server cache and return immediately). Returns a map keyed by accountId.
//
// Signature value is the raw HTML Gmail returned for that user's primary
// sendAs entry — exactly what their Gmail "Settings → General → Signature"
// shows. Empty string when no signature is configured or the API was
// unavailable (older accounts lack the gmail.settings.basic scope).

export function useSignatures(connectedAccounts) {
  const [byAccount, setByAccount] = useState({}); // accountId → signature html

  useEffect(() => {
    if (!connectedAccounts || connectedAccounts.length === 0) return;
    let cancelled = false;

    Promise.all(
      connectedAccounts.map(a =>
        fetch(`${API_BASE}/accounts/${a.id}/signature`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : { signature: '' })
          .then(d => [a.id, d.signature || ''])
          .catch(() => [a.id, ''])
      )
    ).then(pairs => {
      if (cancelled) return;
      const map = {};
      for (const [aid, sig] of pairs) map[aid] = sig;
      setByAccount(map);
    });

    return () => { cancelled = true; };
  }, [connectedAccounts]);

  return byAccount;
}
