import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './brand.css';
import './index.css';
import App from './App';
import Landing from './Landing';
import Privacy from './Privacy';
import Terms from './Terms';

// P1.6 — CSRF defense. Inject X-Requested-By: allthemail on every credentialed
// non-safe fetch to the API origin. The backend rejects state-changing
// requests that lack this header. A cross-site <form>/<img>/<a>/etc. cannot
// set custom request headers, and a same-site fetch from a third-party page
// would trigger a CORS preflight which our tightened allowlist now rejects.
//
// Trial-gating bridge: when the backend returns 403 { error:'access_required' }
// from any endpoint, dispatch a custom event so App.js can pop the blocking
// onboarding paywall regardless of which network call surfaced the gate.
const _origFetch = window.fetch.bind(window);
const _SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
window.fetch = async function patchedFetch(input, init = {}) {
  const method = (init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
  const credentials = init.credentials || (typeof input !== 'string' && input.credentials);
  if (!_SAFE_METHODS.has(method) && credentials === 'include') {
    const headers = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {});
    if (!headers.has('X-Requested-By')) headers.set('X-Requested-By', 'allthemail');
    init = { ...init, headers };
  }
  const response = await _origFetch(input, init);
  if (response.status === 403) {
    try {
      const peek = await response.clone().json();
      if (peek?.error === 'access_required') {
        window.dispatchEvent(new CustomEvent('atm-access-required', { detail: peek }));
      }
    } catch { /* response wasn't JSON; ignore */ }
  }
  return response;
};

// Suppress benign ResizeObserver loop errors from react-resizable-panels
const ro = window.addEventListener;
window.addEventListener = function(type, listener, options) {
  if (type === 'error') {
    const wrapped = function(event) {
      if (event.message?.includes?.('ResizeObserver loop')) {
        event.stopImmediatePropagation();
        return;
      }
      return listener.call(this, event);
    };
    return ro.call(this, type, wrapped, options);
  }
  return ro.call(this, type, listener, options);
};

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<App />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
