# All The Mail — Design system

Mirrors and documents the canonical tokens in
`frontend/src/brand.css`. Read brand.css for the literal source of truth;
read this file for the rationale.

## Palette

Paper / ink / signature red. High contrast, hard edges, no AI gradients.

- `--paper #FAFAF7` — off-white tinted warm. Never `#fff`.
- `--ink-1 #0A0A0A` — off-black. Never `#000`.
- `--primary #FF3A1D` — signature red. The only saturated color in the
  base palette. Used for CTAs, hover states, source chips for the
  primary "studio" account, and the morphing word in the hero.
- `--primary-deep #C5270F` — pressed/active state of primary.
- `--primary-wash rgba(255,58,29,0.10)` — chip backgrounds, hover washes.

Account identity tokens — five tokens for five distinct connected
Google accounts. Used in source chips throughout the app.

| Token | Color | Account archetype |
|---|---|---|
| `--acct-work` | `#FF3A1D` | studio / primary |
| `--acct-personal` | `#1B2BFF` | personal / cobalt |
| `--acct-side` | `#CCFF00` | side-project / acid |
| `--acct-nonprof` | `#FFE500` | nonprofit / voltage |
| `--acct-old` | `#0A0A0A` | legacy / old job |

**Color strategy: Restrained.** Tinted neutrals + one saturated accent
(`--primary`). Account-identity colors are used sparingly — only as 6px
dots or 10% chip backgrounds, never as large surfaces. The hero, CTAs,
and feature rails are paper/ink with red accents.

## Typography

- **Display:** Space Grotesk (paid stand-in for Monument Grotesk Pro).
  Used for the hero word, section headlines, the price number.
  `font-weight: 700`, `letter-spacing: -0.045em` at large sizes.
- **UI / body:** Geist (paid stand-in for NN Grotesk). Geist replaces
  Inter (banned — too AI-default) and reads as more editorial.
- **Mono:** JetBrains Mono. Used for labels, tags, kbd hints, the
  "01 · MAIL" feature-rail markers, and any number that should feel
  tabular.
- **Anti-italic.** brand.css forces `font-style: normal` on display
  classes and most UI elements. Italic is reserved for email body
  content (`.atm-no-italic` opt-out).
- **Type-scale ratios: 1.25 minimum** between steps. Hero uses
  `clamp(72px, 13.2vw, 210px)` so it scales fluidly from phone to
  billboard.

## Layout

- **Editorial print posture.** Sections share borders with neighbors
  rather than sitting in cards. Cards are reserved for elevation
  (modals, popovers); regular content uses border-stitched grids.
- **Asymmetric headers.** `display: flex; justify-content: space-between;
  align-items: flex-end` for section heads — title and supporting copy
  flank each other at the baseline.
- **Spacing on an 8pt grid:** `--sp-1` through `--sp-10`.
- **Section padding `96px 0`** for major surfaces. Wider gaps than typical
  SaaS to give the typography room to breathe.

## Shape

- **Hard edges.** `border-radius: 0` on structural containers (modals,
  cards, tiles, popovers, slide-overs, inputs). brand.css enforces this
  at the cascade level so any imported component library defaults to
  square. Chips are the exception — they use `--r-pill: 999px`.
- **Printed shadows.** Buttons and modals use offset shadows
  (`4px 4px 0 var(--ink-1)`) instead of soft Gaussian blurs. Reads as
  silkscreen / ICE label / risograph.

## Motion

- **One easing curve everywhere:** `cubic-bezier(0.2, 0, 0, 1)` —
  exposed as `--ease`. No bounce, no elastic.
- **Three durations:**
  - `--t-instant 80ms` — color/background swaps
  - `--t-quick 160ms` — most hover/active transitions
  - `--t-deliberate 420ms` — section reveals
- **`transform` and `opacity` only.** Never animate `width`, `height`,
  `top`, `left`. Hardware-acceleration discipline.
- **Hero word morph** cycles every 1.8s with a 120ms cross-fade — the
  one continuous animation in the brand.

## Theme

**Light-only.** brand.css used to define a `[data-theme="dark"]` block
but we removed it because we never shipped a toggle. Re-introduce
deliberately if/when we commit to a dark canvas — the brand is
intentionally light-mode-first per the editorial print posture.

## Components — reference

- `.atm-btn--primary` — signature red, 4px printed shadow, 2px translate
  on hover, 0px shadow on active (the press feels physical)
- `.atm-btn--ghost` — transparent w/ ink border, inverts on hover
- `.atm-source-chip` — pill-shaped, 6px colored dot + monospace label,
  10% account-color background tint
- `.atm-prices-single` — one tier, centered, 460px max width

## What's banned

Per the impeccable + taste-skill audit:

- **Inter** as a UI font (replaced with Geist)
- **Pure black** `#000` and **pure white** `#fff` (use `--ink-1`,
  `--paper`, or `--paper-pure` if absolutely needed for an iframe)
- **Lila / violet AI accents** — `--accent` is signature red, not the
  legacy `#8b7cff` that used to live in design-system.css
- **Side-stripe borders** — full borders, full backgrounds, or nothing
- **Gradient text** — solid colors, hierarchy via weight + size
- **Glassmorphism as default** — backdrop-blur is reserved for
  intentional moments
- **Hero metric template** — big-number + tiny-label SaaS cliché
- **Identical 3-card grids** — use border-stitched newspaper layouts
- **Em dashes** in copy — periods, commas, middots only
- **Bounce / elastic easing** — exponential ease-out only

## Future work (deferred design debt)

- **Replace lucide-react with @phosphor-icons/react** across the 15
  app components that import lucide today. The taste-skill standardizes
  on Phosphor or Radix; lucide is a quality library but mixing two
  icon systems is an inconsistency tell. ~150 import-rename diffs.
- **Decide on a real font license.** Geist is the production stand-in
  for NN Grotesk; Space Grotesk is the stand-in for Monument Grotesk
  Pro. If/when we license the paid families, the swap is two `@import`
  lines + adding the font files.
- **Token-share between marketing and app.** Currently moot since the
  marketing site has been deleted and apex serves the React app
  directly. Re-introduce only if we add a separate marketing surface.
