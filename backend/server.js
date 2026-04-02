import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

// Route modules
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import emailRoutes from './routes/emails.js';
import docsRoutes from './routes/docs.js';
import calendarRoutes from './routes/calendar.js';
import billingRoutes from './routes/billing.js';

const app = express();

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

// CORS
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

// Stripe webhook must be registered before express.json() for raw body access
app.post('/billing/webhook', express.raw({ type: 'application/json' }), billingRoutes.handleWebhook);

// Body parsing
app.use(express.json());
app.use(cookieParser());

// Mount routes
app.use('/auth', authRoutes);
app.use('/accounts', accountRoutes);
app.use('/emails', emailRoutes);
app.use('/docs', docsRoutes);
app.use('/cals', calendarRoutes);
app.use('/billing', billingRoutes);

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
