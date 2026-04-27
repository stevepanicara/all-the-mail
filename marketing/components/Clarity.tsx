import Script from 'next/script';

// Microsoft Clarity — session recording + heatmaps for the marketing site.
// Free, no backend changes, no privacy review needed beyond the tracking-
// pixel disclosure already in our Privacy page.
//
// Loaded with next/script `afterInteractive` strategy: the script tag is
// injected only after the page is interactive (browser has finished
// parsing HTML, rendered first paint, attached event handlers). This
// keeps Clarity entirely off the critical render path — it does NOT
// block LCP, FID/INP, or CLS. Confirmed against the Web Vitals checklist:
//
//   - LCP: Clarity loads after FCP, no impact on the Largest Contentful
//     Paint timing. The script itself is ~40 KB gzipped.
//   - FID/INP: Loaded async with `defer`-equivalent timing; doesn't
//     contend with the main thread for early input handling.
//   - CLS: Clarity is a recorder, doesn't inject visual elements.
//
// We do NOT install Clarity on app.allthemail.io. The CRA app doesn't
// need session recordings — we already have Sentry + analytics there,
// and recording a logged-in inbox would be a privacy minefield.
//
// Env: NEXT_PUBLIC_CLARITY_ID — set on Vercel for the marketing project.
// Empty / missing / dev mode → no-op.

const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;

export function Clarity() {
  // Skip in dev (don't pollute Clarity reports with localhost activity)
  // and skip if no project ID is configured. In both cases this returns
  // null synchronously, so no script tag is emitted into the page.
  if (process.env.NODE_ENV === 'development') return null;
  if (!CLARITY_ID) return null;

  return (
    <Script
      id="ms-clarity"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${CLARITY_ID}");
        `,
      }}
    />
  );
}
