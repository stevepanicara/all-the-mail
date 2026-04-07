import { useState, useEffect, useCallback } from 'react';
import './landing.css';

const API_BASE =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000';

const FAQ_ITEMS = [
  {
    q: 'Do you store my emails?',
    a: 'No. Emails are fetched in real time from Google. We never store email content on our servers.',
  },
  {
    q: 'What permissions do you request?',
    a: 'Only what\u2019s needed to read, send, and organize your Gmail\u2014read, send, modify labels, and basic profile info. Nothing more.',
  },
  {
    q: 'Can I disconnect an account?',
    a: 'Yes\u2014disconnect anytime from your settings. Your OAuth tokens are deleted immediately.',
  },
  {
    q: 'Is it secure?',
    a: 'We use Google OAuth and encrypt all tokens at rest. We never see or store your Google password.',
  },
  {
    q: 'How many accounts can I connect?',
    a: 'Pro supports unlimited connected Gmail accounts.',
  },
];

// Realistic in-product preview — built from the actual app's design tokens
function AppPreview() {
  const senderColors = ['#1A73E8','#D93025','#188038','#E37400','#A142F4','#1E8E3E','#F29900','#8430CE'];
  const c = (i) => senderColors[i % senderColors.length];

  const mailItems = [
    { initial: 'S', from: 'Sarah Chen', subject: 'Q1 roadmap finalized', time: '2m', unread: true, acct: 0 },
    { initial: 'D', from: 'Delta Airlines', subject: 'Your flight confirmation', time: '18m', unread: false, acct: 1 },
    { initial: 'A', from: 'Alex Rivera', subject: 'Invoice approved', time: '1h', unread: true, acct: 2 },
    { initial: 'G', from: 'GitHub', subject: 'PR #142 merged', time: '2h', unread: false, acct: 0 },
    { initial: 'N', from: 'Notion', subject: 'Workspace digest', time: '5h', unread: false, acct: 1 },
  ];

  const docItems = [
    { name: 'Q1 Roadmap', edited: '2h ago', acct: 0 },
    { name: 'Brand Guidelines.pdf', edited: 'Yesterday', acct: 2 },
    { name: 'Invoice Template', edited: '3d ago', acct: 1 },
  ];

  const calItems = [
    { time: '10:00', title: 'Standup', acct: 0 },
    { time: '14:00', title: 'Client review', acct: 2 },
    { time: '16:30', title: 'Design crit', acct: 0 },
  ];

  return (
    <div className="app-preview">
      <div className="app-preview-chrome">
        <div className="app-preview-traffic">
          <span /><span /><span />
        </div>
        <div className="app-preview-rail">
          <div className="app-preview-pill app-preview-pill-active">All</div>
          <div className="app-preview-pill"><span className="app-preview-dot" style={{background:'linear-gradient(135deg,#6C4CFF,#FF4C8B)'}} />Work</div>
          <div className="app-preview-pill"><span className="app-preview-dot" style={{background:'linear-gradient(135deg,#00E5FF,#00FF94)'}} />Personal</div>
          <div className="app-preview-pill"><span className="app-preview-dot" style={{background:'linear-gradient(135deg,#FFD84D,#FF8C2B)'}} />Studio</div>
        </div>
      </div>
      <div className="app-preview-body">
        {/* Mail column */}
        <div className="app-preview-col">
          <div className="app-preview-col-header">
            <span>Mail</span>
            <span className="app-preview-col-chip">All</span>
          </div>
          <div className="app-preview-col-body">
            {mailItems.map((m, i) => (
              <div key={i} className={`app-preview-row${m.unread ? ' unread' : ''}`}>
                <span className="app-preview-avatar" style={{background: c(i)}}>{m.initial}</span>
                <div className="app-preview-row-content">
                  <div className="app-preview-row-line1">
                    <span className="app-preview-sender">{m.from}</span>
                    <span className="app-preview-time">{m.time}</span>
                  </div>
                  <div className="app-preview-subject">{m.subject}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Docs column */}
        <div className="app-preview-col">
          <div className="app-preview-col-header">
            <span>Docs</span>
            <span className="app-preview-col-chip">Recent</span>
          </div>
          <div className="app-preview-col-body">
            {docItems.map((d, i) => (
              <div key={i} className="app-preview-row">
                <span className="app-preview-doc-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </span>
                <div className="app-preview-row-content">
                  <div className="app-preview-doc-name">{d.name}</div>
                  <div className="app-preview-doc-meta">{d.edited}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Cals column */}
        <div className="app-preview-col">
          <div className="app-preview-col-header">
            <span>Cals</span>
            <span className="app-preview-col-chip">Today</span>
          </div>
          <div className="app-preview-col-body">
            {calItems.map((e, i) => (
              <div key={i} className="app-preview-row">
                <span className="app-preview-cal-marker" />
                <div className="app-preview-row-content">
                  <div className="app-preview-row-line1">
                    <span className="app-preview-cal-time">{e.time}</span>
                  </div>
                  <div className="app-preview-cal-title">{e.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Landing() {
  const [authError, setAuthError] = useState(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'error') {
      setAuthError('Login failed. Please try again.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSignIn = useCallback(() => {
    setIsSigningIn(true);
    window.location.href = `${API_BASE}/auth/google`;
  }, []);

  const toggleFaq = useCallback((index) => {
    setOpenFaq((prev) => (prev === index ? null : index));
  }, []);

  const scrollTo = useCallback((id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="l">
      {/* -------- NAV -------- */}
      <header className="l-nav">
        <div className="l-nav-inner">
          <span className="l-nav-wordmark">ALL THE MAIL</span>
          <nav className="l-nav-links">
            <button className="l-nav-link" onClick={() => scrollTo('pricing')} type="button">
              Pricing
            </button>
            <button className="l-nav-link" onClick={() => scrollTo('howitworks')} type="button">
              How it works
            </button>
            <button className="l-nav-link l-nav-signin" onClick={handleSignIn} type="button">
              Sign in
            </button>
          </nav>
        </div>
      </header>

      <main>
        {/* -------- HERO (Gradient over black + cinematic render) -------- */}
        <section className="l-hero">
          <div className="l-hero-inner">
            <div className="l-hero-grid">
              <div className="l-hero-copy">
                <div className="l-hero-eyebrow"><span className="l-hero-eyebrow-bar" />A NEW EMAIL TOOL</div>
                <h1 className="l-h1">
                  Email. <span className="l-h1-accent">Unified.</span>
                </h1>
                <p className="l-sub">
                  Run every Gmail account from one deliberate interface.
                </p>

                {authError && (
                  <div className="l-error" role="alert">{authError}</div>
                )}

                <button
                  className="l-cta"
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  type="button"
                >
                  {isSigningIn ? 'Signing in\u2026' : 'Sign in with Google'}
                </button>

                <p className="l-trust">
                  Encrypted tokens &bull; No passwords stored &bull; Disconnect anytime
                </p>
              </div>

              {/* App preview — built mockup matching the actual product */}
              <div className="l-hero-render-col">
                <AppPreview />
              </div>
            </div>
          </div>
        </section>

        {/* -------- FEATURE STRIP -------- */}
        <section className="l-statement">
          <div className="l-statement-inner">
            <div className="l-features">
              <div className="l-feature">
                <span className="l-feature-label">Gmail</span>
                <span className="l-feature-desc">Read, send, archive across every account</span>
              </div>
              <div className="l-feature">
                <span className="l-feature-label">Drive</span>
                <span className="l-feature-desc">All your docs, sheets, and slides in one list</span>
              </div>
              <div className="l-feature">
                <span className="l-feature-label">Calendar</span>
                <span className="l-feature-desc">Every schedule, unified by account</span>
              </div>
            </div>
          </div>
        </section>


        {/* -------- HOW IT WORKS (Three product mockups) -------- */}
        <section className="l-section" id="howitworks">
          <div className="l-container">
            <h2 className="l-section-title">HOW IT WORKS</h2>
            <div className="l-howitworks">
              {/* Mockup 1 — Unified inbox */}
              <figure className="hiw-card">
                <div className="hiw-mock">
                  <div className="hiw-mock-header">
                    <span>Inbox</span>
                    <span className="hiw-mock-chip">All accounts</span>
                  </div>
                  <div className="hiw-mock-body">
                    {[
                      { i: 'S', name: 'Sarah Chen', subj: 'Q1 roadmap finalized', src: 'Work', g: 'linear-gradient(135deg,#6C4CFF,#FF4C8B)', color: '#1A73E8', unread: true },
                      { i: 'D', name: 'Delta Airlines', subj: 'Flight confirmation', src: 'Personal', g: 'linear-gradient(135deg,#00E5FF,#00FF94)', color: '#D93025', unread: false },
                      { i: 'A', name: 'Alex Rivera', subj: 'Invoice approved', src: 'Studio', g: 'linear-gradient(135deg,#FFD84D,#FF8C2B)', color: '#188038', unread: true },
                      { i: 'G', name: 'GitHub', subj: 'PR #142 merged', src: 'Work', g: 'linear-gradient(135deg,#6C4CFF,#FF4C8B)', color: '#A142F4', unread: false },
                    ].map((m, i) => (
                      <div key={i} className={`hiw-row${m.unread ? ' unread' : ''}`}>
                        <span className="hiw-avatar" style={{ background: m.color }}>{m.i}</span>
                        <div className="hiw-row-content">
                          <div className="hiw-row-line1">
                            <span className="hiw-sender">{m.name}</span>
                            <span className="hiw-source-chip">
                              <span className="hiw-source-dot" style={{ background: m.g }} />
                              {m.src}
                            </span>
                          </div>
                          <div className="hiw-subject">{m.subj}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <figcaption className="hiw-caption">One inbox, every account.</figcaption>
              </figure>

              {/* Mockup 2 — Source chip close-up */}
              <figure className="hiw-card">
                <div className="hiw-mock hiw-mock--zoom">
                  <div className="hiw-zoom-stage">
                    <div className="hiw-zoom-row">
                      <span className="hiw-avatar hiw-avatar--lg" style={{ background: '#1A73E8' }}>S</span>
                      <div className="hiw-row-content">
                        <div className="hiw-zoom-name">Sarah Chen</div>
                        <div className="hiw-zoom-subject">Q1 roadmap finalized</div>
                      </div>
                    </div>
                    <div className="hiw-zoom-chip-wrap">
                      <span className="hiw-source-chip hiw-source-chip--lg">
                        <span className="hiw-source-dot hiw-source-dot--lg" style={{ background: 'linear-gradient(135deg,#6C4CFF,#FF4C8B)' }} />
                        Work
                      </span>
                      <svg className="hiw-callout-line" width="100" height="40" viewBox="0 0 100 40" fill="none">
                        <path d="M2 38 L40 38 L60 8 L98 8" stroke="rgba(139,124,255,0.6)" strokeWidth="1" strokeDasharray="2 3" />
                      </svg>
                      <span className="hiw-callout-label">gradient identity</span>
                    </div>
                  </div>
                </div>
                <figcaption className="hiw-caption">See where it came from.</figcaption>
              </figure>

              {/* Mockup 3 — Cross-account search */}
              <figure className="hiw-card">
                <div className="hiw-mock">
                  <div className="hiw-search-bar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <span className="hiw-search-text">invoice<span className="hiw-search-caret" /></span>
                    <span className="hiw-search-scope">all accounts</span>
                  </div>
                  <div className="hiw-mock-body">
                    {[
                      { i: 'A', name: 'Alex Rivera', subj: 'Invoice #2041 approved', src: 'Studio', g: 'linear-gradient(135deg,#FFD84D,#FF8C2B)', color: '#188038' },
                      { i: 'B', name: 'Billing@Stripe', subj: 'Your invoice is ready', src: 'Personal', g: 'linear-gradient(135deg,#00E5FF,#00FF94)', color: '#1A73E8' },
                      { i: 'M', name: 'Maria Lopez', subj: 'Re: invoice question', src: 'Work', g: 'linear-gradient(135deg,#6C4CFF,#FF4C8B)', color: '#D93025' },
                      { i: 'F', name: 'Freshbooks', subj: 'Invoice draft saved', src: 'Studio', g: 'linear-gradient(135deg,#FFD84D,#FF8C2B)', color: '#A142F4' },
                    ].map((m, i) => (
                      <div key={i} className="hiw-row">
                        <span className="hiw-avatar" style={{ background: m.color }}>{m.i}</span>
                        <div className="hiw-row-content">
                          <div className="hiw-row-line1">
                            <span className="hiw-sender">{m.name}</span>
                            <span className="hiw-source-chip">
                              <span className="hiw-source-dot" style={{ background: m.g }} />
                              {m.src}
                            </span>
                          </div>
                          <div className="hiw-subject">
                            {m.subj.split(/(invoice)/i).map((part, idx) =>
                              part.toLowerCase() === 'invoice'
                                ? <mark key={idx} className="hiw-mark">{part}</mark>
                                : <span key={idx}>{part}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <figcaption className="hiw-caption">Search across everything.</figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* -------- COMPARISON TABLE -------- */}
        <section className="l-section" id="compare">
          <div className="l-container">
            <h2 className="l-section-title">HOW WE COMPARE</h2>
            <div className="l-compare-spec">CHECKED &#9656; SPECS</div>
            <div className="l-compare-wrap">
              <table className="l-compare-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Gmail</th>
                    <th>Shift <span className="compare-price">($8/mo)</span></th>
                    <th>Superhuman <span className="compare-price">($30/mo)</span></th>
                    <th className="compare-highlight">All The Mail <span className="compare-price">($9/mo)</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Multi-account unified inbox</td>
                    <td><span className="compare-dash">&ndash;</span></td>
                    <td><span className="compare-dash">&ndash;</span></td>
                    <td><span className="compare-dash">&ndash;</span></td>
                    <td><span className="compare-check">&#10003;</span></td>
                  </tr>
                  <tr>
                    <td>Google Drive integration</td>
                    <td><span className="compare-dash">&ndash;</span></td>
                    <td><span className="compare-dash">&ndash;</span></td>
                    <td><span className="compare-dash">&ndash;</span></td>
                    <td><span className="compare-check">&#10003;</span></td>
                  </tr>
                  <tr>
                    <td>Google Calendar integration</td>
                    <td><span className="compare-dash">&ndash;</span></td>
                    <td><span className="compare-dash">&ndash;</span></td>
                    <td><span className="compare-dash">&ndash;</span></td>
                    <td><span className="compare-check">&#10003;</span></td>
                  </tr>
                  <tr>
                    <td>Source identification</td>
                    <td><span className="compare-dash">&ndash;</span></td>
                    <td><span className="compare-dash">&ndash;</span></td>
                    <td><span className="compare-dash">&ndash;</span></td>
                    <td><span className="compare-check">&#10003;</span></td>
                  </tr>
                  <tr>
                    <td>Conversation threading</td>
                    <td><span className="compare-check">&#10003;</span></td>
                    <td><span className="compare-dash">&ndash;</span></td>
                    <td><span className="compare-check">&#10003;</span></td>
                    <td><span className="compare-check">&#10003;</span></td>
                  </tr>
                  <tr>
                    <td>AI-powered features</td>
                    <td><span className="compare-dash">&ndash;</span></td>
                    <td><span className="compare-dash">&ndash;</span></td>
                    <td><span className="compare-check">&#10003;</span></td>
                    <td><span className="compare-check">&#10003;</span></td>
                  </tr>
                  <tr>
                    <td>Dark + Light mode</td>
                    <td><span className="compare-dash">&ndash;</span></td>
                    <td><span className="compare-dash">&ndash;</span></td>
                    <td><span className="compare-check">&#10003;</span></td>
                    <td><span className="compare-check">&#10003;</span></td>
                  </tr>
                  <tr>
                    <td>Price</td>
                    <td>Free</td>
                    <td>$99/yr</td>
                    <td>$30/mo</td>
                    <td className="compare-highlight-cell">$9/mo</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* -------- PRICING (Clinical) -------- */}
        <section className="l-section" id="pricing">
          <div className="l-container">
            <div className="l-pricing">
              <div className="pricing-card pricing-card--free">
                <span className="pricing-label pricing-label--free">FREE</span>
                <div className="pricing-price">
                  <span className="pricing-amount">$0</span>
                  <span className="pricing-period">forever</span>
                </div>
                <p className="pricing-cancel">No credit card required.</p>
                <ul className="pricing-list">
                  <li>1 connected account</li>
                  <li>Unified mail view</li>
                  <li>Secure OAuth + encrypted tokens</li>
                </ul>
                <button
                  className="l-cta l-cta--secondary"
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  type="button"
                >
                  {isSigningIn ? 'Signing in\u2026' : 'Get started'}
                </button>
              </div>
              <div className="pricing-card">
                <span className="pricing-label">PRO</span>
                <div className="pricing-price">
                  <span className="pricing-amount">$9</span>
                  <span className="pricing-period">/ month</span>
                </div>
                <p className="pricing-cancel">Cancel anytime.</p>
                <ul className="pricing-list">
                  <li>Unlimited accounts</li>
                  <li>Mail + Drive + Calendar unified</li>
                  <li>Conversation view + AI search</li>
                  <li>Secure OAuth + encrypted tokens</li>
                </ul>
                <button
                  className="l-cta"
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  type="button"
                >
                  {isSigningIn ? 'Signing in\u2026' : 'Sign in with Google'}
                </button>
                <p className="pricing-note">Start free, upgrade anytime.</p>
              </div>
            </div>
          </div>
        </section>

        {/* -------- FAQ -------- */}
        <section className="l-section" id="faq">
          <div className="l-container">
            <h2 className="l-section-title">FAQ</h2>
            <div className="l-faq">
              {FAQ_ITEMS.map((item, i) => (
                <div className="faq-item" key={i}>
                  <button
                    className={`faq-trigger${openFaq === i ? ' faq-open' : ''}`}
                    onClick={() => toggleFaq(i)}
                    aria-expanded={openFaq === i}
                    type="button"
                  >
                    <span>{item.q}</span>
                    <svg
                      className="faq-chevron"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  <div className="faq-body" role="region" hidden={openFaq !== i}>
                    <p>{item.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* -------- FOOTER -------- */}
      <footer className="l-footer">
        <div className="l-container">
          <div className="l-footer-mark">
            <span className="l-footer-wordmark">ALL THE MAIL</span>
            <span className="l-footer-tag">For people who run everything through Google.</span>
          </div>
          <div className="l-footer-inner">
            <p>&copy; 2026 ALL THE MAIL</p>
            <div className="l-footer-links">
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
