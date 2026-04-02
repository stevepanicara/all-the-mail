import { useState, useEffect, useCallback } from 'react';
import './landing.css';

const API_BASE =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000';

const PRINCIPLES = [
  {
    num: '01',
    title: 'Everything View',
    body: 'All inboxes. One scroll.',
  },
  {
    num: '02',
    title: 'Source Clarity',
    body: 'Account identity at a glance.',
  },
  {
    num: '03',
    title: 'Secure by Design',
    body: 'OAuth + encrypted tokens.',
  },
];

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

// Mock row gradient data for the landing page demo
const MOCK_ACCOUNTS = [
  { name: 'Work', g0: '#6C4CFF', g1: '#FF4C8B' },
  { name: 'Personal', g0: '#00E5FF', g1: '#00FF94' },
  { name: 'Freelance', g0: '#FFD84D', g1: '#FF8C2B' },
];

function getMockMid(acc) {
  const h = (hex) => parseInt(hex.replace('#', ''), 16);
  const r0 = (h(acc.g0) >> 16) & 0xff, g0 = (h(acc.g0) >> 8) & 0xff, b0 = h(acc.g0) & 0xff;
  const r1 = (h(acc.g1) >> 16) & 0xff, g1 = (h(acc.g1) >> 8) & 0xff, b1 = h(acc.g1) & 0xff;
  return { r: (r0+r1)>>1, g: (g0+g1)>>1, b: (b0+b1)>>1 };
}

function MockChip({ account }) {
  const mid = getMockMid(account);
  return (
    <span
      className="mock-chip"
      style={{
        border: `1px solid rgba(${mid.r},${mid.g},${mid.b},0.45)`,
        background: `rgba(${mid.r},${mid.g},${mid.b},0.10)`,
      }}
    >
      <span className="mock-chip-dot" style={{ background: `linear-gradient(90deg, ${account.g0}, ${account.g1})` }} />
      {account.name}
    </span>
  );
}

function MockRow({ account, sender, subject, time, unread }) {
  return (
    <div className={`mock-row ${unread ? 'mock-row-unread' : ''}`}>
      {unread && (
        <span style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
          borderRadius: '0 1px 1px 0',
          background: `linear-gradient(180deg, ${account.g0}, ${account.g1})`,
        }} />
      )}
      <MockChip account={account} />
      <span className="mock-sender">{sender}</span>
      <span className="mock-subj">{subject}</span>
      <span className="mock-time">{time}</span>
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
            <button className="l-nav-link" onClick={() => scrollTo('principles')} type="button">
              Security
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

              {/* Render column — shows hero render if available, falls back to mock */}
              <div className="l-hero-render-col">
                <div className="l-render-wrap">
                  <img
                    src="/landing/Homepage_Image.png"
                    alt="All The Mail unified inbox interface"
                    width="800"
                    height="520"
                    loading="eager"
                  />
                </div>
                {/* Fallback mock (hidden, kept for future use) */}
                <div className="l-hero-mock-col" style={{ display: 'none', paddingTop: 0 }}>
                  <div className="l-mock" role="img" aria-label="Unified inbox view showing multiple Gmail accounts">
                    <div className="mock-toolbar">
                      <div className="mock-dots">
                        <span /><span /><span />
                      </div>
                      <span className="mock-title">ALL THE MAIL</span>
                    </div>
                    <MockRow account={MOCK_ACCOUNTS[0]} sender="Sarah Chen" subject="Q1 roadmap finalized" time="2m" unread />
                    <MockRow account={MOCK_ACCOUNTS[1]} sender="Delta Airlines" subject="Your flight confirmation" time="18m" />
                    <MockRow account={MOCK_ACCOUNTS[2]} sender="Alex Rivera" subject="Invoice approved — payment sent" time="1h" unread />
                    <MockRow account={MOCK_ACCOUNTS[0]} sender="GitHub" subject="[all-the-mail] PR #142 merged" time="2h" />
                    <MockRow account={MOCK_ACCOUNTS[1]} sender="Spotify" subject="Your 2026 listening report" time="5h" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* -------- STATEMENT BLOCK -------- */}
        <section className="l-statement">
          <div className="l-statement-inner">
            <p className="l-statement-text">
              EVERY ACCOUNT.<br />ONE SYSTEM.
            </p>
          </div>
        </section>

        {/* -------- PRODUCT FOCUS (Gallery) -------- */}
        <section className="l-gallery">
          <div className="l-gallery-inner">
            <div className="l-mock l-mock-lg" role="img" aria-label="Unified inbox view showing multiple Gmail accounts">
              <div className="mock-toolbar">
                <div className="mock-dots">
                  <span /><span /><span />
                </div>
                <span className="mock-title">ALL THE MAIL</span>
              </div>
              <MockRow account={MOCK_ACCOUNTS[0]} sender="Sarah Chen" subject="Q1 roadmap finalized" time="2m" unread />
              <MockRow account={MOCK_ACCOUNTS[1]} sender="Delta Airlines" subject="Your flight confirmation — SEA to JFK" time="18m" />
              <MockRow account={MOCK_ACCOUNTS[2]} sender="Alex Rivera" subject="Invoice approved — payment sent" time="1h" unread />
              <MockRow account={MOCK_ACCOUNTS[0]} sender="GitHub" subject="[all-the-mail] PR #142 merged" time="2h" />
              <MockRow account={MOCK_ACCOUNTS[1]} sender="Spotify" subject="Your 2026 listening report is here" time="5h" />
              <MockRow account={MOCK_ACCOUNTS[2]} sender="Notion" subject="Weekly workspace digest" time="8h" />
            </div>
            <span className="l-gallery-label">EVERYTHING VIEW</span>
          </div>
        </section>

        {/* -------- PRINCIPLES (Editorial) -------- */}
        <section className="l-section" id="principles">
          <div className="l-container">
            <div className="l-principles">
              {PRINCIPLES.map((p) => (
                <div className="principle" key={p.num}>
                  <span className="principle-num">{p.num}</span>
                  <div className="principle-text">
                    <h3 className="principle-title">{p.title}</h3>
                    <p className="principle-body">{p.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* -------- PRICING (Clinical) -------- */}
        <section className="l-section" id="pricing">
          <div className="l-container">
            <div className="l-pricing">
              <div className="pricing-card">
                <span className="pricing-label">PRO</span>
                <div className="pricing-price">
                  <span className="pricing-amount">$7</span>
                  <span className="pricing-period">/ month</span>
                </div>
                <p className="pricing-cancel">Cancel anytime.</p>
                <ul className="pricing-list">
                  <li>Unlimited accounts</li>
                  <li>Unified inbox + cross-account search</li>
                  <li>Account tags + quick filters</li>
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
        <div className="l-container l-footer-inner">
          <p>&copy; 2026 ALL THE MAIL</p>
          <div className="l-footer-links">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
