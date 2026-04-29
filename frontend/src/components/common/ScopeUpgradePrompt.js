import React from 'react';
import { X } from 'lucide-react';

// P1.12 — incremental OAuth scope prompt.
//
// Mounted by App.js when the user wants to use a feature group (mail/docs/cals)
// for an account that hasn't granted the corresponding Gmail/Drive/Calendar
// scopes yet. Clicking the CTA navigates the browser to the backend
// /accounts/upgrade-scopes/:group endpoint, which redirects to Google's
// consent screen. After the round-trip, the user lands back at this same
// page with ?upgraded=<group> in the URL — App.js detects it, re-fetches
// /accounts, and the prompt unmounts because the scope is now in
// account.granted_scopes.
//
// IMPORTANT: this is NOT an XHR. The href is a full browser navigation
// because OAuth requires a top-level navigation to Google's consent
// screen. Don't try to fetch() this endpoint.

const COPY = {
  mail: {
    title: 'Connect Gmail',
    body: 'All The Mail needs permission to read and send mail from this account. We never store mail content — we read it from Google live.',
    cta: 'Continue with Google',
  },
  docs: {
    title: 'Connect Google Drive',
    body: "We'll show your Drive attachments inline so you can preview without leaving the app. Read-only — we never modify your Drive.",
    cta: 'Continue with Google',
  },
  cals: {
    title: 'Connect Google Calendar',
    body: 'See and reply to event invites alongside your inbox. Scoped to events only — we never touch calendar settings or sharing.',
    cta: 'Continue with Google',
  },
};

const API_BASE =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000';

export default function ScopeUpgradePrompt({ group, accountId, accountEmail, onDismiss }) {
  const copy = COPY[group];
  if (!copy || !accountId) return null;

  const handleConnect = () => {
    const redirectAfter = encodeURIComponent(window.location.href);
    window.location.href =
      `${API_BASE}/accounts/upgrade-scopes/${encodeURIComponent(group)}` +
      `?account=${encodeURIComponent(accountId)}` +
      `&redirect=${redirectAfter}`;
  };

  return (
    <div className="modal-overlay" onClick={onDismiss}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '460px' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scope-upgrade-title"
      >
        <div className="modal-header">
          <span id="scope-upgrade-title" className="modal-header-title">{copy.title}</span>
          <button
            type="button"
            className="modal-close"
            onClick={onDismiss}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="modal-body" style={{ padding: '20px' }}>
          {accountEmail && (
            <div style={{ font: '500 11px/1 var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: '12px' }}>
              For {accountEmail}
            </div>
          )}
          <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: '14px', lineHeight: 1.55 }}>
            {copy.body}
          </p>
        </div>
        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 20px', borderTop: '1px solid var(--ink-5)' }}>
          <button type="button" className="btn-ghost" onClick={onDismiss}>
            Not now
          </button>
          <button type="button" className="btn btn-primary primary-button" onClick={handleConnect}>
            {copy.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
