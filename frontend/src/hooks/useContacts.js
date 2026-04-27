import { useEffect, useState, useMemo } from 'react';
import { API_BASE } from '../utils/constants';

// Aggregate contacts across all connected accounts. Hits the per-account
// /emails/:accountId/contacts endpoint (server-side cached 30 min) and
// merges results — when the same email shows up in multiple accounts'
// sent folders, frequencies are summed.
//
// The merged list is keyed off connectedAccounts.length, so adding an
// account triggers a refetch. The endpoint itself is cached on the
// backend so repeat calls are cheap.

export function useContacts(connectedAccounts) {
  const [byAccount, setByAccount] = useState({}); // accountId → contacts[]
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!connectedAccounts || connectedAccounts.length === 0) return;
    let cancelled = false;
    setIsLoading(true);

    Promise.all(
      connectedAccounts.map(a =>
        fetch(`${API_BASE}/emails/${a.id}/contacts`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : { contacts: [] })
          .then(d => [a.id, d.contacts || []])
          .catch(() => [a.id, []])
      )
    ).then(pairs => {
      if (cancelled) return;
      const map = {};
      for (const [aid, list] of pairs) map[aid] = list;
      setByAccount(map);
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [connectedAccounts]);

  // Merge contacts across accounts, summing counts per email. Returns
  // the deduped, frequency-sorted list a recipient autocomplete consumes.
  const merged = useMemo(() => {
    const tally = new Map();
    for (const list of Object.values(byAccount)) {
      for (const c of list) {
        if (!c?.email) continue;
        const existing = tally.get(c.email);
        if (existing) {
          existing.count += c.count || 1;
          if (c.name && c.name.length > (existing.name || '').length) existing.name = c.name;
        } else {
          tally.set(c.email, { email: c.email, name: c.name || '', count: c.count || 1 });
        }
      }
    }
    return [...tally.values()].sort((a, b) => b.count - a.count);
  }, [byAccount]);

  return { contacts: merged, isLoading };
}
