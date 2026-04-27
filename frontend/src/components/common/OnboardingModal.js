import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import * as analytics from '../../utils/analytics';

// Forced onboarding sequence for users on their first login. Three steps:
//   1. Connect second account
//   2. Payoff moment (live preview, frosted glass)
//   3. "You're set up" → enter the app
//
// Visibility is decided in App.js: the modal mounts only when the user is
// authed, has ≥1 connected account, and no atm_onboarding_completed flag
// in localStorage. Once mounted, the modal cannot be dismissed by Escape
// or overlay click — only by completing all three steps OR clicking the
// step-1 escape link "I only have one Google account →".
//
// State persistence:
//   atm_onboarding_step       — '1' | '2' | '3' — survives the full-page
//                                redirect when the user clicks "Connect
//                                another account" (legacy redirect flow).
//                                When PR #14's popup OAuth lands, this
//                                still works as a no-op fallback.
//   atm_onboarding_started_at — ISO timestamp set when modal first opens;
//                                used to compute time_to_complete_seconds
//                                for the onboarding_completed event.
//   atm_onboarding_completed  — 'true' (full completion) | 'abandoned'
//                                (escape link clicked at step 1). Either
//                                value blocks re-show.
//
// The persistence design means even if the user reloads mid-onboarding,
// they re-enter at the same step. We don't want a half-onboarded user
// to lose progress and have to redo it.

const STEP_KEY = 'atm_onboarding_step';
const STARTED_KEY = 'atm_onboarding_started_at';
const DONE_KEY = 'atm_onboarding_completed';

// Auto-advance from step 2 to step 3 after this many ms — gives the user
// time to look at the live preview without making them click. The
// reduced-motion check below disables this in favor of a click-required
// "Continue →" button.
const STEP_2_AUTO_ADVANCE_MS = 3000;

function getReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const OnboardingModal = ({
  connectedAccounts,
  handleAddAccount,
  onComplete, // called when modal closes — App.js uses this to bump activeView
}) => {
  // Restore step from localStorage on first mount (handles full-page
  // redirect during step 1 → 2 transition). Default to '1'.
  const [step, setStep] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const persisted = localStorage.getItem(STEP_KEY);
    return persisted ? Number(persisted) : 1;
  });
  const [reducedMotion] = useState(getReducedMotion);

  // Started-at timestamp — set on first mount if not already persisted
  // (this is the case where the user just logged in for the first time).
  // Used at completion time to compute time_to_complete_seconds.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(STARTED_KEY)) {
      localStorage.setItem(STARTED_KEY, new Date().toISOString());
    }
  }, []);

  // Persist step changes so a reload preserves position.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STEP_KEY, String(step));
  }, [step]);

  // Step 1 → Step 2 transition: when accounts go from 1 to 2+ AND we're
  // currently in step 1, advance. Handles both the popup-OAuth case
  // (modal stays mounted, count flips) and the redirect case (modal
  // remounts in step 1 with persisted step, sees length ≥ 2, advances).
  useEffect(() => {
    if (step === 1 && connectedAccounts.length >= 2) {
      setStep(2);
    }
  }, [step, connectedAccounts.length]);

  // Step 2 auto-advance. Skipped under prefers-reduced-motion; user must
  // click Continue instead.
  useEffect(() => {
    if (step !== 2 || reducedMotion) return;
    const t = setTimeout(() => setStep(3), STEP_2_AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [step, reducedMotion]);

  // Block Escape (forced modal). Capture-phase so we beat any other
  // listeners that might respond to Escape.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const closeOnboarding = useCallback((doneState) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DONE_KEY, doneState);
      localStorage.removeItem(STEP_KEY);
      // Keep STARTED_KEY around — useful for cohort analysis if we ever
      // want to bucket users by their onboarding date.
    }
    if (onComplete) onComplete(doneState);
  }, [onComplete]);

  const handleAbandon = useCallback(() => {
    analytics.event('onboarding_abandoned', { abandoned_at_step: step });
    closeOnboarding('abandoned');
  }, [step, closeOnboarding]);

  const handleConnectAnother = useCallback(() => {
    // Persist step explicitly so the post-redirect remount restores to 1.
    // (handleAddAccount may navigate the page away.)
    localStorage.setItem(STEP_KEY, '1');
    handleAddAccount();
  }, [handleAddAccount]);

  const handleFinish = useCallback(() => {
    const startedAt = localStorage.getItem(STARTED_KEY);
    const seconds = startedAt
      ? Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000))
      : null;
    analytics.event('onboarding_completed', {
      accounts_connected: connectedAccounts.length,
      time_to_complete_seconds: seconds,
    });
    closeOnboarding('true');
  }, [connectedAccounts.length, closeOnboarding]);

  // Render — overlay click is a no-op (forced modal). z-index sits above
  // all other modal layers via the --z-top token (9999).
  const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 'var(--z-top, 9999)',
    background: 'rgba(10, 10, 10, 0.72)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px',
  };
  const cardStyle = {
    background: 'var(--bg-0, #fff)', color: 'var(--text-0, #0a0a0a)',
    borderRadius: 'var(--r-md, 12px)', maxWidth: '480px', width: '100%',
    padding: '32px 28px 24px', boxShadow: '0 24px 64px rgba(0,0,0,.32)',
    border: '1px solid var(--line-0, #e5e5e5)',
    fontFamily: 'inherit',
  };
  const headlineStyle = { fontSize: '22px', fontWeight: 600, margin: '0 0 12px', letterSpacing: '-0.01em' };
  const bodyStyle = { fontSize: '14px', lineHeight: 1.55, color: 'var(--text-1, #333)', margin: '0 0 20px' };
  const primaryBtn = {
    background: 'var(--signal, #FF3A1D)', color: '#fff', border: 'none',
    padding: '10px 18px', borderRadius: 'var(--r-xs, 6px)',
    fontSize: '14px', fontWeight: 500, cursor: 'pointer',
    fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
  };
  const escapeLink = {
    display: 'block', marginTop: '20px', fontSize: '12px',
    color: 'var(--text-3, #999)', textAlign: 'center',
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: 'inherit',
  };

  let content;
  if (step === 1) {
    content = (
      <>
        <h2 style={headlineStyle}>Add your second Google account</h2>
        <p style={bodyStyle}>
          All The Mail shows every account in one inbox. You need at least
          two connected to see the magic.
        </p>
        <button style={primaryBtn} onClick={handleConnectAnother}>
          Connect another account <ArrowRight size={14} strokeWidth={2} />
        </button>
        <button style={escapeLink} onClick={handleAbandon}>
          I only have one Google account →
        </button>
      </>
    );
  } else if (step === 2) {
    // Live preview: render the actual email list behind a frosted overlay.
    // We don't have direct access to the email-list component from here —
    // the design intent is "show what they unlocked." For now, a styled
    // placeholder list with sample rows that mirror the real shell. When
    // we wire it to real data we just swap the inner content; the frosted
    // overlay layer stays the same.
    content = (
      <>
        <div style={{
          position: 'relative', height: 180, marginBottom: 20,
          borderRadius: 'var(--r-sm, 8px)', overflow: 'hidden',
          border: '1px solid var(--line-0, #e5e5e5)',
          background: 'var(--bg-1, #f5f5f0)',
        }}>
          <div style={{ padding: '14px 16px' }}>
            {[
              { from: 'Notion', subj: 'Your weekly digest', acct: 'a' },
              { from: 'Stripe', subj: '[Action required] Tax form', acct: 'b' },
              { from: 'GitHub', subj: 'New PR review request', acct: 'a' },
              { from: 'Calendly', subj: 'Meeting confirmed for Friday', acct: 'b' },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'flex', gap: 8, padding: '8px 0',
                borderBottom: i < 3 ? '1px solid var(--line-0, #e5e5e5)' : 'none',
                fontSize: 12,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', marginTop: 6,
                  background: row.acct === 'a' ? 'var(--signal, #FF3A1D)' : 'var(--cobalt, #1B2BFF)',
                  flexShrink: 0,
                }} />
                <span style={{ fontWeight: 500, minWidth: 80 }}>{row.from}</span>
                <span style={{ color: 'var(--text-2, #555)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.subj}
                </span>
              </div>
            ))}
          </div>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(255,255,255,.0) 0%, rgba(255,255,255,.4) 100%)',
            backdropFilter: 'blur(2px)',
            pointerEvents: 'none',
          }} />
        </div>
        <h2 style={headlineStyle}>There it is.</h2>
        <p style={bodyStyle}>
          Emails from both accounts, one inbox. Search, compose, and read —
          without switching tabs.
        </p>
        {reducedMotion && (
          <button style={primaryBtn} onClick={() => setStep(3)}>
            Continue <ArrowRight size={14} strokeWidth={2} />
          </button>
        )}
      </>
    );
  } else {
    content = (
      <>
        <h2 style={headlineStyle}>You're set up.</h2>
        <p style={bodyStyle}>
          This is Everything view — mail, docs, and calendar from all your
          accounts at once.
        </p>
        <button style={primaryBtn} onClick={handleFinish}>
          Open All The Mail <ArrowRight size={14} strokeWidth={2} />
        </button>
      </>
    );
  }

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div style={cardStyle}>
        {content}
      </div>
    </div>
  );
};

export default OnboardingModal;
