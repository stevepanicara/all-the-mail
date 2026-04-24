import { google } from 'googleapis';
import crypto from 'crypto';
import supabase from './supabase.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

const SERVICE_SCOPES = {
  mail: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
  ],
  docs: [
    'https://www.googleapis.com/auth/drive.readonly',
  ],
  cals: [
    // P2 — narrowed from 'calendar' (full r/w on all calendars incl. ACL
    // and calendar settings) to 'calendar.events' (CRUD on events only).
    // Fewer blast-radius on token theft; easier Google CASA review.
    'https://www.googleapis.com/auth/calendar.events',
  ],
  profile: [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
};

const ALL_SCOPES = Object.values(SERVICE_SCOPES).flat();

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

// P2 — fail closed in production. A missing ENCRYPTION_KEY in prod means
// OAuth tokens are stored as plain base64 (reversible with zero effort)
// which is functionally plaintext. Refuse to boot rather than silently
// accept the downgrade. In dev we keep the base64 fallback + warning so
// local loops don't require key setup.
if (!ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
  console.error('FATAL: ENCRYPTION_KEY is required in production');
  process.exit(1);
}

function encryptToken(token) {
  if (!ENCRYPTION_KEY) {
    // Dev-only fallback (prod is gated by the check above).
    console.warn('[SECURITY] No ENCRYPTION_KEY set — tokens stored as base64 only');
    return Buffer.from(JSON.stringify(token)).toString('base64');
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(JSON.stringify(token), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return iv.toString('hex') + ':' + authTag + ':' + encrypted;
}

function decryptToken(encrypted) {
  if (!ENCRYPTION_KEY || !encrypted.includes(':')) {
    // Legacy base64 fallback
    return JSON.parse(Buffer.from(encrypted, 'base64').toString());
  }
  const [ivHex, authTagHex, encryptedData] = encrypted.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

// In-memory OAuth2 client cache — eliminates a Supabase roundtrip on every request.
// TTL: 50 min (tokens expire at 60 min; refresh extends automatically via the 'tokens' event).
const _clientCache = new Map(); // accountId → { client, expiresAt }
const CLIENT_CACHE_TTL_MS = 50 * 60 * 1000;

function invalidateClientCache(accountId) {
  _clientCache.delete(accountId);
}

async function getOAuth2ClientForAccount(accountId) {
  const cached = _clientCache.get(accountId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.client;
  }

  const { data: account, error } = await supabase
    .from('gmail_accounts')
    .select('*')
    .eq('id', accountId)
    .single();

  if (error || !account) throw new Error('Account not found');

  const tokens = decryptToken(account.encrypted_tokens);
  const client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
  client.setCredentials(tokens);

  client.on('tokens', async (newTokens) => {
    if (newTokens.refresh_token) {
      tokens.refresh_token = newTokens.refresh_token;
    }
    tokens.access_token = newTokens.access_token;
    tokens.expiry_date = newTokens.expiry_date;
    // Extend cache TTL on refresh
    _clientCache.set(accountId, { client, expiresAt: Date.now() + CLIENT_CACHE_TTL_MS });
    await supabase
      .from('gmail_accounts')
      .update({ encrypted_tokens: encryptToken(tokens) })
      .eq('id', accountId);
  });

  _clientCache.set(accountId, { client, expiresAt: Date.now() + CLIENT_CACHE_TTL_MS });
  return client;
}

export {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  SERVICE_SCOPES,
  ALL_SCOPES,
  oauth2Client,
  encryptToken,
  decryptToken,
  getOAuth2ClientForAccount,
  invalidateClientCache,
};
