// Shared error mapper for Gmail/Drive/Calendar API failures. Replaces
// the generic catch-all 500s that used to leak from every route with a
// typed error contract the frontend can act on.
//
// Three failure modes get distinct codes; everything else falls through
// to 500 (callers add their own catch-all message).
//
//   401 token_revoked         — invalid_grant from OAuth refresh, or
//                               "Token has been expired or revoked"
//                               from the Google API. The user revoked
//                               our app from myaccount.google.com / a
//                               password reset invalidated tokens /
//                               account suspended. Only recovery is a
//                               re-link; frontend toasts "needs to be
//                               re-connected."
//   403 scope_upgrade_required — granted_scopes column claims we have
//                               the scope, but the actual token Google
//                               has on file is missing it. Frontend
//                               surfaces ScopeUpgradePrompt.
//   429 rate_limited           — Google rate limit. Pass through so
//                               the client can back off.
//
// Usage:
//   try { ... }
//   catch (err) {
//     const mapped = mapGoogleError(err, { accountId, group: 'mail' });
//     if (mapped) return res.status(mapped.status).json(mapped.body);
//     // Else fall through to your own 500 with a route-specific message
//     return res.status(500).json({ error: 'Failed to load X' });
//   }

export function mapGoogleError(err, { accountId, group }) {
  const status = err?.code || err?.response?.status || err?.status || 0;
  const oauthError = err?.response?.data?.error || '';
  const message = String(err?.message || '');

  // Token-revoked / refresh failed.
  if (
    oauthError === 'invalid_grant' ||
    /invalid_grant|token has been expired or revoked|invalid_token|invalid_rapt/i.test(message)
  ) {
    return {
      status: 401,
      body: {
        error: 'token_revoked',
        accountId,
        message: 'This account needs to be re-connected.',
      },
    };
  }

  // Insufficient scope. Google's 403 messages we've actually seen on
  // the wire: "Request had insufficient authentication scopes",
  // "Insufficient Permission", "User has not granted...".
  if (status === 403 && /insufficient|scope|granted/i.test(message)) {
    return {
      status: 403,
      body: {
        error: 'scope_upgrade_required',
        group: group || 'mail',
        accountId,
      },
    };
  }

  // Rate limiting.
  if (status === 429) {
    return {
      status: 429,
      body: { error: 'rate_limited' },
    };
  }

  // Account row missing or ownership mismatch — getOAuth2ClientForAccount
  // throws Error('Account not found') in that case. Surface as 404 so
  // the frontend can prune the dead account from its list.
  if (message === 'Account not found') {
    return {
      status: 404,
      body: { error: 'account_not_found', accountId },
    };
  }

  // Unmapped — caller falls through to its own 500.
  return null;
}
