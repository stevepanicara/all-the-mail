'use client';

import { useEffect } from 'react';

// Per-page tag for Clarity session filtering. Drop into any route to
// label its sessions with `page_type`, e.g.:
//
//   <ClarityPageType type="homepage" />
//   <ClarityPageType type="pricing" />
//   <ClarityPageType type="blog" />
//
// The tag persists for the duration of the recorded session, so users
// who navigate from homepage → pricing → checkout get tagged with each
// page_type they passed through and you can filter recordings by any.
//
// Safe to render before Clarity has loaded — the inline init snippet
// in <Clarity> sets up window.clarity as a queue function before the
// remote script arrives, so calls before load are buffered.

declare global {
  interface Window {
    clarity?: (action: string, key: string, value: string) => void;
  }
}

export function ClarityPageType({ type }: { type: string }) {
  useEffect(() => {
    try {
      // window.clarity is set up by the queue shim in <Clarity>. If
      // Clarity is disabled (dev, missing env), the function won't
      // exist — no-op gracefully.
      if (typeof window !== 'undefined' && typeof window.clarity === 'function') {
        window.clarity('set', 'page_type', type);
      }
    } catch {
      // Calling clarity before the script has finished loading is
      // safe (queue) but defensive: if anything throws, swallow it.
    }
  }, [type]);

  return null;
}
