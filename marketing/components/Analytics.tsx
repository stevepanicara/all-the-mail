import Script from 'next/script';

// GA4 + GTM scripts, both optional and env-gated. Loaded with
// `afterInteractive` strategy so they don't compete with the page's
// critical render path (Next ships them right before </body> equivalent).
//
// gtag() calls fired BEFORE this script loads are not lost — the inline
// snippet pushes onto window.dataLayer, which gtag.js drains on init.
// That means downstream pages can call gtag('event', ...) without race
// conditions, even on first paint.
//
// Render the component once, in the root layout, inside the <body> of the
// document. Outside of layout it would re-mount on every route change.

export function Analytics() {
  const ga = process.env.GA_MEASUREMENT_ID;
  const gtm = process.env.GTM_ID;
  const isProd = process.env.NODE_ENV === 'production';

  // Don't ship analytics in dev — keeps localhost out of GA reports.
  if (!isProd) return null;

  return (
    <>
      {ga ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${ga}', { send_page_view: true });
              `,
            }}
          />
        </>
      ) : null}

      {gtm ? (
        <Script
          id="gtm-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start': new Date().getTime(), event:'gtm.js'});
              var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
              j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${gtm}');
            `,
          }}
        />
      ) : null}
    </>
  );
}
