import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { requireCsrfHeader } from './middleware/csrf.js';
import { authenticateToken } from './middleware/auth.js';
import { requireActiveAccess } from './middleware/plan.js';

// Route modules
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import emailRoutes from './routes/emails.js';
import docsRoutes from './routes/docs.js';
import calendarRoutes from './routes/calendar.js';
import billingRoutes from './routes/billing.js';
import snoozedRoutes from './routes/snoozed.js';
import scheduledSendsRoutes from './routes/scheduled-sends.js';

const app = express();

// Trust proxy headers from Render/Cloudflare for accurate client IPs
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
const ALLOWED_ORIGINS = [
  FRONTEND_URL,
  'https://allthemail.io',
  'https://www.allthemail.io',
  'http://localhost:3001',
  'http://localhost:3000',
].filter(Boolean);
if (process.env.VERCEL_URL) ALLOWED_ORIGINS.push(`https://${process.env.VERCEL_URL}`);

// Security headers
app.use(helmet({
  // P2 — minimal CSP for API responses. This is a JSON API so script-src
  // 'none' is safe; frame-ancestors 'none' blocks the API being iframed
  // (defense-in-depth). Frontend ships its own richer CSP via vercel.json.
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      'default-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'none'"],
      'form-action': ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // needed for Google OAuth redirects
}));

// CORS — exact-host check, not endsWith(). evilallthemail.io must NOT match.
const VERCEL_TEAM_SUFFIX = process.env.VERCEL_TEAM_SUFFIX || ''; // e.g. "-rangerandfox.vercel.app"
function isAllowedOrigin(origin) {
  if (!origin) return true; // same-origin / curl / native
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  let host;
  try { host = new URL(origin).hostname; } catch { return false; }
  if (host === 'allthemail.io' || host.endsWith('.allthemail.io')) return true;
  if (VERCEL_TEAM_SUFFIX && host.endsWith(VERCEL_TEAM_SUFFIX)) return true;
  return false;
}
app.use(cors({
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
  credentials: true,
}));

// Stripe webhook must be registered before express.json() for raw body access
app.post('/billing/webhook', express.raw({ type: 'application/json' }), billingRoutes.handleWebhook);

// Body parsing — P2 — explicit 1 MB cap on JSON bodies. The send path
// with attachments uses multer (separately capped) so this limit only
// affects JSON (draft saves, metadata updates, billing calls). Compose
// bodies that embed base64 inline images are capped client-side at 5 MB
// but server-side we reject >1 MB here to avoid RAM bloat on Render Starter.
app.use(express.json({ limit: '1mb' }));
// Compress responses — email HTML bodies can be 50–200 KB uncompressed
app.use(compression());
app.use(cookieParser());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 600, // 600 requests per minute per IP (accounts for multi-account burst on load)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 auth attempts per 15 minutes
  message: { error: 'Too many login attempts, please try again later' },
});

// Note: send-rate limiter lives inside routes/emails.js (P1.2) — the previous
// app.use('/emails/*/send', ...) here was a no-op because Express's app.use
// path matching does not glob-expand '*' the way route definitions do.

app.use(apiLimiter);
app.use('/auth', authLimiter);

// P1.6 — CSRF defense. Must run after cookieParser + body parsing but
// before route handlers. Exempts safe methods, Stripe webhook, OAuth
// callbacks. Frontend wrapper sends X-Requested-By: allthemail on every
// state-changing call.
app.use(requireCsrfHeader);

// Mount routes.
//
// Auth + billing are NOT gated — billing/status and billing/checkout must be
// reachable by users without an active subscription so they can subscribe.
// Auth is the entry point for everyone. Everything else (feature routes)
// runs through requireActiveAccess: only admins, Pro subscribers, and users
// in trial/grace can hit them. Unsubscribed users get a structured 403 that
// the frontend converts into a hard-lockout paywall.
//
// authenticateToken is mounted here at the route group level so it runs
// before requireActiveAccess (which needs req.userId). The per-handler
// authenticateToken inside each route file is now redundant but harmless.
app.use('/auth', authRoutes);
app.use('/billing', billingRoutes);
app.use('/accounts', authenticateToken, requireActiveAccess, accountRoutes);
app.use('/emails', authenticateToken, requireActiveAccess, emailRoutes);
app.use('/docs', authenticateToken, requireActiveAccess, docsRoutes);
app.use('/cals', authenticateToken, requireActiveAccess, calendarRoutes);
app.use('/snoozed', authenticateToken, requireActiveAccess, snoozedRoutes);
app.use('/scheduled-sends', authenticateToken, requireActiveAccess, scheduledSendsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server only when run directly (not when imported for testing)
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend running on port ${PORT}`);
  });
}

export default app;
