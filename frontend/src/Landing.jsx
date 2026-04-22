import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [hero, setHero] = useState('billboard');
  const [wordIdx, setWordIdx] = useState(3); // start on "EVERYTHING"

  const heroMorphRef = useRef(null);
  const footMorphRef = useRef(null);

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
          <a href="#faq">FAQ</a>
        </nav>
        <div className="atm-nav-right">
          <span className="atm-nav-status">Pre-launch &middot; Waitlist open</span>
          <button type="button" className="atm-nav-cta" onClick={handleSignIn} disabled={isSigningIn}>
            {isSigningIn ? 'Signing in\u2026' : 'Sign in'}
          </button>
        </div>
      </header>

      {/* ========================== HERO SWITCHER ========================== */}
      <div className="atm-hero-switcher" role="tablist" aria-label="Hero variation">
        {['billboard', 'plate', 'poster'].map((key, i) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={hero === key}
            className={`atm-hs-btn${hero === key ? ' on' : ''}`}
            onClick={() => setHero(key)}
          >
            {String(i + 1).padStart(2, '0')} &middot; {key[0].toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      <section className="atm-hero">
        {/* ---------------- v1 · BILLBOARD ---------------- */}
        {hero === 'billboard' && (
          <div className="atm-h1 atm-wrap">
            <div className="atm-h1-tag">
              <span className="atm-h1-bar" />
              <span>ALL THE MAIL &middot; R1 &middot; EVERYTHING INBOX</span>
            </div>
            <h1 className="atm-h1-title">
              ALL THE<br />
              <span key={currentHeroWord} ref={heroMorphRef} className="atm-morph">{currentHeroWord}</span>
            </h1>
            {authError && <div className="atm-l-error" role="alert">{authError}</div>}
            <div className="atm-cta-row">
              <button type="button" className="atm-btn-primary" onClick={handleSignIn} disabled={isSigningIn}>
                {isSigningIn ? 'Signing in\u2026' : 'Add your first account'}
              </button>
              <button type="button" className="atm-btn-secondary" onClick={handleSignIn} disabled={isSigningIn}>
                Sign in with Google
              </button>
              <span className="atm-h1-trust">
                Encrypted tokens &middot; No passwords stored &middot; Disconnect anytime
              </span>
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
                <div className="atm-h1-v">$7 / month. Unlimited accounts. 14-day trial, no card.</div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- v2 · PLATE ---------------- */}
        {hero === 'plate' && (
          <div className="atm-h2 atm-wrap">
            <div className="atm-h2-grid">
              <div className="atm-h2-left">
                <h1 className="atm-h2-title">
                  ALL THE <span key={currentHeroWord} className="atm-morph">{currentHeroWord}</span>
                </h1>
                <p className="atm-h2-sub">The everything inbox. Every Google account in one window.</p>
                {authError && <div className="atm-l-error" role="alert">{authError}</div>}
                <div className="atm-cta-row atm-h2-ctas">
                  <button type="button" className="atm-btn-primary" onClick={handleSignIn} disabled={isSigningIn}>
                    {isSigningIn ? 'Signing in\u2026' : 'Add your first account'}
                  </button>
                  <span className="atm-h1-trust">
                    Encrypted tokens &middot; No passwords stored &middot; Disconnect anytime
                  </span>
                </div>
              </div>
              <div className="atm-h2-right">
                <div className="atm-plate">
                  <div className="atm-mock">
                    <div className="atm-mock-side">
                      <div className="atm-mock-wm">ALL THE MAIL</div>
                      <div className="atm-mock-tab on"><span>Everything</span><span className="atm-mock-n">1,284</span></div>
                      <div className="atm-mock-tab"><span>Mail</span><span className="atm-mock-n">874</span></div>
                      <div className="atm-mock-tab"><span>Docs</span><span className="atm-mock-n">312</span></div>
                      <div className="atm-mock-tab"><span>Cals</span><span className="atm-mock-n">98</span></div>
                      <div className="atm-mock-section">Accounts &middot; 5</div>
                      <div className="atm-mock-acct"><span className="atm-mock-dot" style={{background:'#FF3A1D'}} />jesse@studio.co</div>
                      <div className="atm-mock-acct"><span className="atm-mock-dot" style={{background:'#1B2BFF'}} />jesse@gmail.com</div>
                      <div className="atm-mock-acct"><span className="atm-mock-dot" style={{background:'#CCFF00'}} />j@sideproject.dev</div>
                      <div className="atm-mock-acct"><span className="atm-mock-dot" style={{background:'#FFE500'}} />jesse@the-np.org</div>
                      <div className="atm-mock-acct"><span className="atm-mock-dot" style={{background:'#0A0A0A'}} />jesse@oldjob.net</div>
                    </div>
                    <div className="atm-mock-main">
                      <div className="atm-mock-toolbar">
                        <div className="atm-mock-tabs">
                          <div className="atm-mock-ttab on">Everything</div>
                          <div className="atm-mock-ttab">Mail</div>
                          <div className="atm-mock-ttab">Docs</div>
                          <div className="atm-mock-ttab">Cals</div>
                        </div>
                        <div className="atm-mock-search">⌘K &middot; Search all accounts</div>
                      </div>
                      {[
                        { star:true,  c:'#FF3A1D', ck:'studio',    who:'Nora Park',        k:'MAIL', subj:'Re: Q2 brand system. Sign-off needed by Friday', t:'09:42' },
                        { star:true,  c:'#CCFF00', ck:'side',      who:'Calendar',         k:'CAL',  subj:'Today · Investor intro · 11:00 AM · 30 min',      t:'11:00' },
                        { star:false, c:'#1B2BFF', ck:'personal',  who:'Linnea',           k:'MAIL', subj:'the lease paperwork. i signed mine, yours is next', t:'Yday' },
                        { star:false, c:'#FFE500', ck:'nonprofit', who:'Board draft v3',   k:'DOC',  subj:'shared by marcus · edited 2h ago · 14 comments',   t:'Yday' },
                        { star:false, c:'#FF3A1D', ck:'studio',    who:'Stripe',           k:'MAIL', subj:'Payout. $4,280.00 sent to your bank',              t:'Yday' },
                        { star:false, c:'#0A0A0A', ck:'legacy',    who:'Calendar',         k:'CAL',  subj:'Tomorrow · All-hands · 10:00 AM · 60 min',         t:'Tmrw' },
                        { star:false, c:'#1B2BFF', ck:'personal',  who:'Flight receipts',  k:'DOC',  subj:'sheet · 42 rows · last edit by you',               t:'Mon' },
                      ].map((r, i) => (
                        <div key={i} className={`atm-mock-row${r.star ? ' unread' : ''}`}>
                          <div className="atm-mock-star" />
                          <div className="atm-mock-chip"><span className="atm-mock-dot" style={{background:r.c}} />{r.ck}</div>
                          <div>
                            <div className="atm-mock-sender">{r.who} <span className="atm-mock-kind">{r.k}</span></div>
                            <div className="atm-mock-subj">{r.subj}</div>
                          </div>
                          <div className="atm-mock-time">{r.t}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- v3 · POSTER ---------------- */}
        {hero === 'poster' && (
          <div className="atm-h3 atm-wrap">
            <div className="atm-h3-poster">
              <div className="atm-h3-corner">
                R1 / 2026<br />
                PRE-LAUNCH EDITION<br />
                NO. <b style={{color:'var(--ink-1)'}}>0001</b>
              </div>
              <h1 className="atm-h3-lockup">
                ALL THE<br />
                <span key={currentHeroWord} className="atm-h3-red atm-morph">{currentHeroWord}</span>
              </h1>
              <div className="atm-h3-meta">
                <div className="atm-h3-cell">One window<br /><b>Every account</b></div>
                <div className="atm-h3-cell">Mail &middot; Docs &middot; Cals<br /><b>Unified feed</b></div>
                <div className="atm-h3-cell">$7 / month<br /><b>Unlimited accounts</b></div>
                <div className="atm-h3-cell">14-day trial<br /><b>No card required</b></div>
              </div>
              {authError && <div className="atm-l-error atm-h3-error" role="alert">{authError}</div>}
              <div className="atm-h3-ctarow">
                <button type="button" className="atm-btn-primary" onClick={handleSignIn} disabled={isSigningIn}>
                  {isSigningIn ? 'Signing in\u2026' : 'Claim your handle'}
                </button>
                <button type="button" className="atm-btn-secondary" onClick={handleSignIn} disabled={isSigningIn}>
                  Sign in with Google
                </button>
              </div>
              <div className="atm-h3-stamp">One window.<br />Fewer tabs.<br />Zero apology.</div>
            </div>
          </div>
        )}
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
                  <div className="atm-step-chip"><span className="atm-step-chip-dot" style={{background:'#FF3A1D'}} />studio</div>
                  <div className="atm-step-chip"><span className="atm-step-chip-dot" style={{background:'#1B2BFF'}} />personal</div>
                  <div className="atm-step-chip"><span className="atm-step-chip-dot" style={{background:'#CCFF00'}} />side</div>
                  <div className="atm-step-chip"><span className="atm-step-chip-dot" style={{background:'#FFE500'}} />nonprofit</div>
                  <div className="atm-step-chip"><span className="atm-step-chip-dot" style={{background:'#0A0A0A'}} />legacy</div>
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
                <span className="atm-source-chip atm-work"><span className="atm-source-dot" style={{background:'#FF3A1D'}} />studio</span>
                <span className="atm-source-chip atm-personal"><span className="atm-source-dot" style={{background:'#1B2BFF'}} />personal</span>
                <span className="atm-source-chip atm-side"><span className="atm-source-dot" style={{background:'#CCFF00'}} />side-project</span>
                <span className="atm-source-chip atm-np"><span className="atm-source-dot" style={{background:'#FFE500'}} />nonprofit</span>
                <span className="atm-source-chip atm-legacy"><span className="atm-source-dot" style={{background:'#0A0A0A'}} />legacy</span>
              </div>
              <h4 className="atm-chips-ch">Kinds &middot; 3</h4>
              <div className="atm-chips-cluster">
                <span className="atm-source-chip"><span className="atm-source-dot" style={{background:'#FF3A1D'}} />MAIL</span>
                <span className="atm-source-chip"><span className="atm-source-dot" style={{background:'#1B2BFF'}} />DOC</span>
                <span className="atm-source-chip"><span className="atm-source-dot" style={{background:'#CCFF00'}} />CAL</span>
              </div>
            </div>
            <div className="atm-chips-col">
              <h4 className="atm-chips-ch">In the feed</h4>
              <div className="atm-sample-rows">
                <div className="atm-sample-row">
                  <span className="atm-source-chip atm-work"><span className="atm-source-dot" style={{background:'#FF3A1D'}} />studio</span>
                  <div className="atm-sample-msg">Nora Park <em>&middot; Q2 brand system &middot; sign-off</em></div>
                  <span className="atm-sample-t">09:42</span>
                </div>
                <div className="atm-sample-row">
                  <span className="atm-source-chip atm-personal"><span className="atm-source-dot" style={{background:'#1B2BFF'}} />personal</span>
                  <div className="atm-sample-msg">Linnea <em>&middot; lease paperwork</em></div>
                  <span className="atm-sample-t">Yday</span>
                </div>
                <div className="atm-sample-row">
                  <span className="atm-source-chip atm-side"><span className="atm-source-dot" style={{background:'#CCFF00'}} />side</span>
                  <div className="atm-sample-msg">Investor intro <em>&middot; 11:00 AM &middot; 30 min</em></div>
                  <span className="atm-sample-t">11:00</span>
                </div>
                <div className="atm-sample-row">
                  <span className="atm-source-chip atm-np"><span className="atm-source-dot" style={{background:'#FFE500'}} />nonprofit</span>
                  <div className="atm-sample-msg">Board draft v3 <em>&middot; 14 comments</em></div>
                  <span className="atm-sample-t">Yday</span>
                </div>
                <div className="atm-sample-row">
                  <span className="atm-source-chip atm-legacy"><span className="atm-source-dot" style={{background:'#0A0A0A'}} />legacy</span>
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
              <div className="atm-pricing-sup">Pricing &middot; Pre-launch &middot; R1</div>
              <h2 className="atm-pricing-h">Seven dollars.</h2>
            </div>
            <p className="atm-pricing-p">Every account. One window. Less than a sandwich.</p>
          </div>
          <div className="atm-prices">
            <div className="atm-price">
              <div className="atm-price-label"><span>Free</span></div>
              <div className="atm-price-amount"><sup>$</sup>0</div>
              <div className="atm-price-period">Forever</div>
              <ul className="atm-price-list">
                <li>1 connected account</li>
                <li>Unified mail view</li>
                <li>Encrypted OAuth</li>
                <li>Mobile web</li>
              </ul>
              <button type="button" onClick={handleSignIn} disabled={isSigningIn}>Get started</button>
            </div>
            <div className="atm-price atm-price-ft">
              <div className="atm-price-label"><span>Pro</span><span className="atm-price-tag">R1 launch</span></div>
              <div className="atm-price-amount"><sup>$</sup>7</div>
              <div className="atm-price-period">/ month</div>
              <ul className="atm-price-list">
                <li>Unlimited accounts</li>
                <li>Mail &middot; Docs &middot; Cals unified</li>
                <li>Cross-account search</li>
                <li>Source chips everywhere</li>
                <li>Send-as / RSVP-as</li>
                <li>Priority sync</li>
              </ul>
              <button type="button" onClick={handleSignIn} disabled={isSigningIn}>Start 14-day trial</button>
            </div>
            <div className="atm-price">
              <div className="atm-price-label"><span>Team</span></div>
              <div className="atm-price-amount"><sup>$</sup>12</div>
              <div className="atm-price-period">/ user / month</div>
              <ul className="atm-price-list">
                <li>Everything in Pro</li>
                <li>SAML SSO</li>
                <li>Centralized billing</li>
                <li>Admin console</li>
                <li>Priority support</li>
              </ul>
              <button type="button" onClick={handleSignIn} disabled={isSigningIn}>Contact sales</button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================= FOOTER ============================= */}
      <footer className="atm-foot">
        <div className="atm-wrap">
          <div className="atm-foot-mega">
            ALL THE<br />
            <span key={currentFootWord} ref={footMorphRef} className="atm-foot-m">{currentFootWord}</span>
          </div>

          <div className="atm-foot-grid">
            <div className="atm-foot-col">
              <h5>Product</h5>
              <a href="#">Mail</a>
              <a href="#">Docs</a>
              <a href="#">Cals</a>
              <a href="#sources">Source chips</a>
              <a href="#">Changelog</a>
            </div>
            <div className="atm-foot-col">
              <h5>Company</h5>
              <a href="#">Brief</a>
              <a href="#pricing">Pricing</a>
              <a href="#">Security</a>
              <a href="#">Status</a>
            </div>
            <div className="atm-foot-col">
              <h5>Stay in the loop</h5>
              <a href="#">Waitlist</a>
              <a href="#">X / Twitter</a>
              <a href="#">Github</a>
              <a href="#">Contact</a>
            </div>
          </div>

          <div className="atm-foot-row">
            <span>&copy; 2026 ALL THE MAIL &middot; Pre-launch &middot; R1</span>
            <div className="atm-foot-links">
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
              <a href="#">Security</a>
              <a href="#">DPA</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
