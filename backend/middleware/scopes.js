// P1.12 — backend route gating for incremental OAuth scopes.
//
// Frontend already filters Mail/Docs/Cals modules on
// account.granted_scopes?.includes(group), so users in the normal flow
// don't trigger 403s here. This middleware is belt-and-suspenders for:
//   - clients that bypass the frontend filter (curl, future mobile, bugs)
//   - ephemeral state drift after a scope upgrade lands but before the
//     frontend re-fetches /accounts
//   - new accounts created via Variant B sign-in (granted_scopes: [])
//
// Contract on failure:
//   403 { error: 'scope_upgrade_required', group, accountId }
//
// The frontend (App.js) already exposes a global event listener
// 'atm-scope-upgrade-required' that surfaces ScopeUpgradePrompt when
// dispatched. A future PR can wire fetch-site response handling to
// detect this 403 shape and dispatch the event automatically.

import { accountHasGroup } from '../lib/google.js';

export function requireAccountScope(group) {
  if (!['mail', 'docs', 'cals'].includes(group)) {
    throw new Error(`Unknown scope group: ${group}`);
  }
  return async (req, res, next) => {
    const accountId = req.params.accountId;
    if (!accountId) {
      // Route doesn't operate on a specific account (e.g. a future
      // /emails/search-all that fans out across the user's accounts).
      // Such routes should filter accounts internally on granted_scopes;
      // we intentionally don't 403 here because there's no single account
      // to point the upgrade prompt at.
      return next();
    }
    try {
      const ok = await accountHasGroup(accountId, req.userId, group);
      if (!ok) {
        return res.status(403).json({
          error: 'scope_upgrade_required',
          group,
          accountId,
        });
      }
      next();
    } catch (err) {
      console.error(`[requireAccountScope:${group}] check failed:`, err);
      next(err);
    }
  };
}
