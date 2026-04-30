// Shared response handler for the backend's typed error contracts.
// Pair to backend/lib/gmailErrors.js. Three failure modes get distinct
// CustomEvents the App.js listeners surface as UI:
//
//   401 token_revoked           → atm-account-reconnect-required
//                                 (passive toast: "<email> needs to be
//                                 re-connected")
//   403 scope_upgrade_required  → atm-scope-upgrade-required
//                                 (modal: "Connect Gmail/Drive/Calendar")
//
// Returns true if the error was handled (caller should bail out of its
// own success path) and false if the response was OK or the error was
// unrecognized (caller should fall through to its own error handling).
//
// Usage:
//   const r = await fetch(...);
//   if (await maybeHandleApiError(r, account)) return [];
//   if (!r.ok) { /* caller's own error handling */ }
//   const d = await r.json();

export async function maybeHandleApiError(response, account) {
  if (response.ok) return false;
  if (response.status !== 401 && response.status !== 403) return false;

  let body;
  try { body = await response.clone().json(); } catch { return false; }
  if (!body) return false;

  if (body.error === 'token_revoked') {
    window.dispatchEvent(new CustomEvent('atm-account-reconnect-required', {
      detail: {
        accountId: body.accountId || account?.id,
        accountEmail: account?.gmail_email,
      },
    }));
    return true;
  }

  if (body.error === 'scope_upgrade_required' && body.group) {
    window.dispatchEvent(new CustomEvent('atm-scope-upgrade-required', {
      detail: {
        accountId: body.accountId || account?.id,
        group: body.group,
        accountEmail: account?.gmail_email,
      },
    }));
    return true;
  }

  return false;
}
