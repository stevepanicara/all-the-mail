# All The Mail — Product brief

## What it is

One window for every Google account. Mail, Docs, and Calendars from up to N
connected Google identities, unified into a single inbox-shaped feed where
every item carries a colored "source chip" naming the account it belongs to.
Reply-as, send-as, and RSVP-as the right identity without leaving the app.

## Register

**brand**. The marketing surface and the React landing are the same surface
now (`allthemail.io` apex serves the React app). Design IS the product
expression. The app shell behind the auth gate inherits the same brand
language but trades cinematic hero typography for editorial/utility
hierarchy — same paper/ink/red palette, same fonts, smaller scale.

## Users

People who run their lives across multiple Google accounts and have never
had a tool that respected the separation. Founders with a work + side-
project + nonprofit + personal + legacy-job stack. Studio operators with a
client account per project. Designers, lawyers, consultants, agency
owners. The shared trait: they've already accepted the cost of switching
between five Gmail tabs every day, and they don't believe a unified
inbox can exist without losing the per-identity context.

## Brand voice

- **Editorial, not SaaS.** No "Elevate your workflow." No "Seamlessly
  integrate." Three-syllable verb headlines: "Connect. Unify. Work." /
  "Send. Book. Ship."
- **Periods over em dashes.** No em dashes anywhere in marketing or UI
  copy. Periods, commas, middots (·) for visual cadence.
- **Concrete nouns.** "Five inboxes. One window." not "All your
  communication channels in one place."
- **Anti-AI.** No "leverage", "next-gen", "best-in-class", "supercharge",
  "unleash". No filler.
- **Confidence through restraint.** The brand is self-aware that it's
  doing one thing well, not pretending to be a platform.

## Anti-references

We are explicitly NOT trying to look like:
- Superhuman (too premium, too much keyboard-shortcut LARP)
- Gmail/Google Workspace (too institutional)
- Linear (too Vercel-default)
- Notion (too soft)
- Hey (too opinionated about how email should work)

We ARE drawing posture from:
- Nike / Supreme / Patagonia hero typography (huge, condensed, confident)
- Hard-edged editorial print (Helvetica Bold tradition; The Wire magazine)
- Lo-fi technical print: blueprint annotation, ICE shipping labels

## Strategic principles

- **Single tier, single price, simple message.** $15/month, 14-day free
  trial, card upfront. No Free plan, no Team plan, no enterprise tier.
  When a competitor adds tiers we do not.
- **One Google sign-in per user, additional accounts linked via incremental
  OAuth.** Sign-up is non-sensitive (profile + email only) so we don't
  trip Google's unverified-app warning at first contact. Mail/Docs/Cals
  scopes are requested per-feature when the user activates them.
- **No mail content stored on our servers.** Tokens encrypted at rest,
  bodies served live from Gmail with short-lived caches in IDB on the
  client and 30-min in-memory on the backend.
- **Source-chip everywhere.** Every item — inbox row, doc list entry,
  calendar event, compose recipient — carries a colored chip naming the
  account. The chip is the rule, not a feature.
