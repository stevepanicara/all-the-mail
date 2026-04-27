import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';

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
  contentSecurityPolicy: false, // CSP handled by frontend
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

// Body parsing
app.use(express.json());
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

const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 10 sends per minute
  message: { error: 'Send rate limit reached' },
});

app.use(apiLimiter);
app.use('/auth', authLimiter);
app.use('/emails/*/send', sendLimiter);

// Mount routes
app.use('/auth', authRoutes);
app.use('/accounts', accountRoutes);
app.use('/emails', emailRoutes);
app.use('/docs', docsRoutes);
app.use('/cals', calendarRoutes);
app.use('/billing', billingRoutes);
app.use('/snoozed', snoozedRoutes);
app.use('/scheduled-sends', scheduledSendsRoutes);

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
