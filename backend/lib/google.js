import { google } from 'googleapis';
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

function encryptToken(token) {
  return Buffer.from(JSON.stringify(token)).toString('base64');
}

function decryptToken(encrypted) {
  return JSON.parse(Buffer.from(encrypted, 'base64').toString());
}

async function getOAuth2ClientForAccount(accountId) {
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

    await supabase
      .from('gmail_accounts')
      .update({ encrypted_tokens: encryptToken(tokens) })
      .eq('id', accountId);
  });

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
};
