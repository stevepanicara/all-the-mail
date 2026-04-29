import { useState, useEffect, useCallback } from 'react';
import './landing.css';

const API_BASE =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000';

const HERO_WORDS = ['MAIL', 'DOCS', 'CALS', 'EVERYTHING'];
const FOOT_WORDS = ['EVERYTHING', 'MAIL', 'DOCS', 'CALS'];

function Landing() {
  const [authError, setAuthError] = useState(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [wordIdx, setWordIdx] = useState(3); // start on "EVERYTHING"

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'error') {
      setAuthError('Login failed. Retry.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Corner morph cycles every 1.8s with a 120ms cross-fade
  useEffect(() => {
    const id = setInterval(() => {
      setWordIdx((i) => (i + 1) % HERO_WORDS.length);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const handleSignIn = useCallback(() => {
    setIsSigningIn(true);
    window.location.href = `${API_BASE}/auth/google`;
  }, []);

  const currentHeroWord = HERO_WORDS[wordIdx];
  const currentFootWord = FOOT_WORDS[wordIdx];

  return (
    <div className="atm-l" data-theme="light">
      {/* ============================== NAV ============================== */}
      <header className="atm-nav">
        <div className="atm-nav-wm">ALL THE MAIL</div>
        <nav className="atm-nav-links">
          <a href="#how">How it works</a>
          <a href="#sources">Sources</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="atm-nav-right">
          <span className="atm-nav-status">Pre-launch &middot; Waitlist open</span>
          <button type="button" className="atm-nav-cta" onClick={handleSignIn} disabled={isSigningIn} aria-busy={isSigningIn}>
            {isSigningIn ? 'Signing in\u2026' : 'Sign in'}
          </button>
        </div>
      </header>

      <section className="atm-hero">
        <div className="atm-h1 atm-wrap">
          <div className="atm-h1-tag">
            <span className="atm-h1-bar" />
            <span>ALL THE MAIL &middot; R1 &middot; EVERYTHING INBOX</span>
          </div>
          <h1 className="atm-h1-title">
            ALL THE<br />
            <span key={currentHeroWord} className="atm-morph">{currentHeroWord}</span>
          </h1>
          {authError && <div className="atm-l-error" role="alert">{authError}</div>}
          <div className="atm-cta-row">
            <button type="button" className="atm-btn-primary" onClick={handleSignIn} disabled={isSigningIn} aria-busy={isSigningIn}>
              {isSigningIn ? 'Signing in\u2026' : 'Add your first account'}
            </button>
            <button type="button" className="atm-btn-secondary" onClick={handleSignIn} disabled={isSigningIn} aria-busy={isSigningIn}>
              Sign in with Google
            </button>
            <span className="atm-h1-trust">
              Encrypted tokens &middot; No passwords stored &middot; Disconnect anytime
            </span>
          </div>
          <div className="atm-sr-status" role="status" aria-live="polite">
            {isSigningIn ? 'Redirecting to Google sign-in.' : ''}
          </div>
          <div className="atm-h1-meta">
            <div className="atm-h1-cell">
              <div className="atm-h1-k">The brief</div>
              <div className="atm-h1-v">Every Google account. Mail, docs, and cals. One window. One inbox. Zero tab-switching.</div>
            </div>
            <div className="atm-h1-cell">
              <div className="atm-h1-k">Built for</div>
              <div className="atm-h1-v">People with five Google accounts. Work, personal, side-project, nonprofit, old job.</div>
            </div>
            <div className="atm-h1-cell">
              <div className="atm-h1-k">Price</div>
              <div className="atm-h1-v">$15 / month. Unlimited accounts. 14-day free trial.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ MARQUEE ============================ */}
      <div className="atm-marquee" aria-hidden="true">
        <div className="atm-marquee-track">
          <span>ALL THE MAIL</span>
          <span>ALL THE DOCS</span>
          <span>ALL THE CALS</span>
          <span>ALL THE EVERYTHING</span>
          <span>ALL THE MAIL</span>
          <span>ALL THE DOCS</span>
          <span>ALL THE CALS</span>
          <span>ALL THE EVERYTHING</span>
        </div>
      </div>

      {/* ========================== FEATURE RAIL ========================== */}
      <section className="atm-rail">
        <div className="atm-wrap">
          <div className="atm-rail-title">The feed, sorted by meaning</div>
          <div className="atm-rail-grid">
            <div className="atm-rail-item">
              <div className="atm-rail-k">01 &middot; MAIL</div>
              <div className="atm-rail-v">Every inbox</div>
              <div className="atm-rail-d">Read, send, archive across every account. A source chip tells you which one. No mystery senders.</div>
              <ul className="atm-rail-list">
                <li>Unified thread view</li>
                <li>Send-as any account</li>
                <li>Cross-account search</li>
              </ul>
            </div>
            <div className="atm-rail-item">
              <div className="atm-rail-k">02 &middot; DOCS</div>
              <div className="atm-rail-v">Every doc</div>
              <div className="atm-rail-d">Drive, Sheets, Slides from all accounts in one list. Open in Google in one click. Edit where you always did.</div>
              <ul className="atm-rail-list">
                <li>Five Drives, one list</li>
                <li>Filter by kind or owner</li>
                <li>Recent-across-accounts</li>
              </ul>
            </div>
            <div className="atm-rail-item">
              <div className="atm-rail-k">03 &middot; CALS</div>
              <div className="atm-rail-v">Every calendar</div>
              <div className="atm-rail-d">A single agenda colored by account. See the double-book before you book it. Respond from the right identity.</div>
              <ul className="atm-rail-list">
                <li>Unified day view</li>
                <li>Per-account colors</li>
                <li>RSVP-as any account</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ========================== HOW IT WORKS ========================== */}
      <section className="atm-how" id="how">
        <div className="atm-wrap">
          <div className="atm-how-head">
            <div>
              <div className="atm-how-sup">How it works &middot; Three steps &middot; Ninety seconds</div>
              <h2 className="atm-how-h">Connect. Unify. Work.</h2>
            </div>
            <p className="atm-how-p">No plug-ins. No forwarding. No copy-paste. OAuth in, all five identities intact.</p>
          </div>
          <div className="atm-steps">
            <div className="atm-step">
              <div className="atm-step-n">01 &middot; CONNECT</div>
              <h3 className="atm-step-h">Sign in with Google.</h3>
              <p className="atm-step-p">OAuth each account. Tokens stay encrypted on your device. Passwords never touch our servers.</p>
              <div className="atm-step-vis atm-step-vis-1">
                <div className="atm-step-chips">
                  <div className="atm-step-chip"><span className="atm-step-chip-dot" style={{background:'var(--acct-work)'}} />studio</div>
                  <div className="atm-step-chip"><span className="atm-step-chip-dot" style={{background:'var(--acct-personal)'}} />personal</div>
                  <div className="atm-step-chip"><span className="atm-step-chip-dot" style={{background:'var(--acct-side)'}} />side</div>
                  <div className="atm-step-chip"><span className="atm-step-chip-dot" style={{background:'var(--acct-nonprof)'}} />nonprofit</div>
                  <div className="atm-step-chip"><span className="atm-step-chip-dot" style={{background:'var(--acct-old)'}} />legacy</div>
                </div>
              </div>
            </div>
            <div className="atm-step">
              <div className="atm-step-n">02 &middot; UNIFY</div>
              <h3 className="atm-step-h">One window opens.</h3>
              <p className="atm-step-p">Every account streams into a single feed. Every item carries its source. Nothing gets merged that shouldn't.</p>
              <div className="atm-step-vis atm-step-vis-2">
                5 in. <span className="atm-step-red">1 out.</span>
              </div>
            </div>
            <div className="atm-step">
              <div className="atm-step-n">03 &middot; WORK</div>
              <h3 className="atm-step-h">Send. Book. Ship.</h3>
              <p className="atm-step-p">Reply from the right identity. Attach from any Drive. Drop events on the unified calendar.</p>
              <div className="atm-step-vis atm-step-vis-3">
                <div><b>874</b>MAIL</div>
                <div><b>312</b>DOCS</div>
                <div><b>98</b>CALS</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================= SOURCE CHIP SHOWCASE ======================= */}
      <section className="atm-chips-section" id="sources">
        <div className="atm-wrap">
          <div className="atm-chips-head">
            <div>
              <div className="atm-chips-sup">The source chip &middot; Every item, every time</div>
              <h2 className="atm-chips-h">Know which <span style={{color:'var(--primary)'}}>you</span> it came from.</h2>
            </div>
            <p className="atm-chips-p">The chip is the rule. Every message, every doc, every event carries its account. No guessing. No reply-from-wrong-email.</p>
          </div>
          <div className="atm-chips-grid">
            <div className="atm-chips-col">
              <h4 className="atm-chips-ch">Accounts &middot; 5</h4>
              <div className="atm-chips-cluster">
                <span className="atm-source-chip atm-work"><span className="atm-source-dot" style={{background:'var(--acct-work)'}} />studio</span>
                <span className="atm-source-chip atm-personal"><span className="atm-source-dot" style={{background:'var(--acct-personal)'}} />personal</span>
                <span className="atm-source-chip atm-side"><span className="atm-source-dot" style={{background:'var(--acct-side)'}} />side-project</span>
                <span className="atm-source-chip atm-np"><span className="atm-source-dot" style={{background:'var(--acct-nonprof)'}} />nonprofit</span>
                <span className="atm-source-chip atm-legacy"><span className="atm-source-dot" style={{background:'var(--acct-old)'}} />legacy</span>
              </div>
              <h4 className="atm-chips-ch">Kinds &middot; 3</h4>
              <div className="atm-chips-cluster">
                <span className="atm-source-chip"><span className="atm-source-dot" style={{background:'var(--acct-work)'}} />MAIL</span>
                <span className="atm-source-chip"><span className="atm-source-dot" style={{background:'var(--acct-personal)'}} />DOC</span>
                <span className="atm-source-chip"><span className="atm-source-dot" style={{background:'var(--acct-side)'}} />CAL</span>
              </div>
            </div>
            <div className="atm-chips-col">
              <h4 className="atm-chips-ch">In the feed</h4>
              <div className="atm-sample-rows">
                <div className="atm-sample-row">
                  <span className="atm-source-chip atm-work"><span className="atm-source-dot" style={{background:'var(--acct-work)'}} />studio</span>
                  <div className="atm-sample-msg">Nora Park <em>&middot; Q2 brand system &middot; sign-off</em></div>
                  <span className="atm-sample-t">09:42</span>
                </div>
                <div className="atm-sample-row">
                  <span className="atm-source-chip atm-personal"><span className="atm-source-dot" style={{background:'var(--acct-personal)'}} />personal</span>
                  <div className="atm-sample-msg">Linnea <em>&middot; lease paperwork</em></div>
                  <span className="atm-sample-t">Yday</span>
                </div>
                <div className="atm-sample-row">
                  <span className="atm-source-chip atm-side"><span className="atm-source-dot" style={{background:'var(--acct-side)'}} />side</span>
                  <div className="atm-sample-msg">Investor intro <em>&middot; 11:00 AM &middot; 30 min</em></div>
                  <span className="atm-sample-t">11:00</span>
                </div>
                <div className="atm-sample-row">
                  <span className="atm-source-chip atm-np"><span className="atm-source-dot" style={{background:'var(--acct-nonprof)'}} />nonprofit</span>
                  <div className="atm-sample-msg">Board draft v3 <em>&middot; 14 comments</em></div>
                  <span className="atm-sample-t">Yday</span>
                </div>
                <div className="atm-sample-row">
                  <span className="atm-source-chip atm-legacy"><span className="atm-source-dot" style={{background:'var(--acct-old)'}} />legacy</span>
                  <div className="atm-sample-msg">All-hands <em>&middot; 10:00 AM &middot; 60 min</em></div>
                  <span className="atm-sample-t">Tmrw</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================= PRICING ============================= */}
      <section className="atm-pricing" id="pricing">
        <div className="atm-wrap">
          <div className="atm-pricing-head">
            <div>
              <div className="atm-pricing-sup">Pricing &middot; One plan</div>
              <h2 className="atm-pricing-h">Fifteen dollars.</h2>
            </div>
            <p className="atm-pricing-p">Every account. One window. 14-day free trial, then $15 a month.</p>
          </div>
          <div className="atm-prices atm-prices-single">
            <div className="atm-price atm-price-ft">
              <div className="atm-price-label"><span>All The Mail</span></div>
              <div className="atm-price-amount"><sup>$</sup>15</div>
              <div className="atm-price-period">/ month</div>
              <ul className="atm-price-list">
                <li>Unlimited Google accounts</li>
                <li>Mail &middot; Docs &middot; Cals unified</li>
                <li>Cross-account search</li>
                <li>Source chips everywhere</li>
                <li>Send-as / RSVP-as</li>
                <li>Priority sync</li>
              </ul>
              <button type="button" onClick={handleSignIn} disabled={isSigningIn} aria-busy={isSigningIn}>Start 14-day free trial</button>
              <div className="atm-price-fine">Card required. Cancel anytime before the trial ends.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================= FOOTER ============================= */}
      <footer className="atm-foot">
        <div className="atm-wrap">
          <div className="atm-foot-mega">
            ALL THE<br />
            <span key={currentFootWord} className="atm-foot-m">{currentFootWord}</span>
          </div>

          <div className="atm-foot-grid">
            <div className="atm-foot-col">
              <h5>Product</h5>
              <a href="#sources">Source chips</a>
              <a href="#how">How it works</a>
              <a href="#pricing">Pricing</a>
              <span className="atm-foot-soon">Changelog &middot; Soon</span>
            </div>
            <div className="atm-foot-col">
              <h5>Company</h5>
              <span className="atm-foot-soon">Brief &middot; Soon</span>
              <span className="atm-foot-soon">Security &middot; Soon</span>
              <span className="atm-foot-soon">Status &middot; Soon</span>
            </div>
            <div className="atm-foot-col">
              <h5>Stay in the loop</h5>
              <span className="atm-foot-soon">Waitlist &middot; Soon</span>
              <span className="atm-foot-soon">X / Twitter &middot; Soon</span>
              <span className="atm-foot-soon">Github &middot; Soon</span>
              <span className="atm-foot-soon">Contact &middot; Soon</span>
            </div>
          </div>

          <div className="atm-foot-row">
            <span>&copy; 2026 ALL THE MAIL &middot; Pre-launch &middot; R1</span>
            <div className="atm-foot-links">
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
              <span className="atm-foot-soon">Security &middot; Soon</span>
              <span className="atm-foot-soon">DPA &middot; Soon</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
