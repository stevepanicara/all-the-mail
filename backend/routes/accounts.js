import { Router } from 'express';
import { google } from 'googleapis';
import supabase from '../lib/supabase.js';
import { oauth2Client, ALL_SCOPES, getOAuth2ClientForAccount } from '../lib/google.js';
import { authenticateToken } from '../middleware/auth.js';
import { issueOAuthState } from '../lib/security.js';
import { enforceAccountLimit } from '../middleware/plan.js';

const router = Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data: accounts, error } = await supabase
      .from('gmail_accounts')
      .select('id, gmail_email, account_name, picture, created_at, granted_scopes')
      .eq('user_id', req.userId);

    if (error) throw error;
    res.json({ accounts });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: 'Failed to get accounts' });
  }
});

router.get('/connect', authenticateToken, enforceAccountLimit, (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ALL_SCOPES,
    prompt: 'consent',
    include_granted_scopes: true,
    state: issueOAuthState({ purpose: 'link', userId: req.userId })
  });
  res.redirect(authUrl);
});

router.delete('/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('id')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const { count } = await supabase
      .from('gmail_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.userId);

    if (count <= 1) {
      return res.status(400).json({ error: 'Cannot remove your only account' });
    }

    const { error } = await supabase
      .from('gmail_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', req.userId);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Failed to remove account' });
  }
});

// Get labels for an account
router.get('/:accountId/labels', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('id')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();

    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    const { data } = await gmail.users.labels.list({ userId: 'me' });
    res.json({ labels: data.labels || [] });
  } catch (err) {
    console.error('Get labels error:', err);
    res.status(500).json({ error: 'Failed to get labels' });
  }
});

// Cache the per-account signature for 24h. Signatures change rarely
// (when a user edits their Gmail signature settings) and refetching
// users.settings.sendAs.list on every compose-open is wasteful.
const _signatureCache = new Map(); // accountId → { signature, expiresAt }
const SIGNATURE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Returns the user's Gmail signature for this account, as HTML. Reads
// users.settings.sendAs.list and picks the entry matching the account's
// own email (the "primary" sendAs is the same email as the connected
// account; aliases would have different emails). If signature is empty
// or unset, returns ''.
//
// gmail.readonly does NOT cover gmail.settings.basic, so this requires
// the account to have granted the broader gmail.modify or
// gmail.settings.basic scope. If the API returns 403 we treat it as
// "no signature available" rather than crashing.
router.get('/:accountId/signature', async (req, res) => {
  try {
    const { accountId } = req.params;

    const cached = _signatureCache.get(accountId);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({ signature: cached.signature });
    }

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('id, gmail_email')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    let signature = '';
    try {
      const { data } = await gmail.users.settings.sendAs.list({ userId: 'me' });
      const sendAsList = data?.sendAs || [];
      // Prefer the entry matching this account's email; fall back to the
      // first isPrimary entry; fall back to the first entry overall.
      const matchByEmail = sendAsList.find(s => s.sendAsEmail?.toLowerCase() === account.gmail_email?.toLowerCase());
      const primary = sendAsList.find(s => s.isPrimary);
      const chosen = matchByEmail || primary || sendAsList[0];
      signature = chosen?.signature || '';
    } catch (err) {
      // 403 = scope not granted (older grants didn't include settings.basic).
      // Other errors = log + treat as empty signature so the compose flow
      // continues to work.
      if (err?.response?.status !== 403 && err?.code !== 403) {
        console.warn('[signature] sendAs.list failed:', err?.message || err);
      }
      signature = '';
    }

    _signatureCache.set(accountId, { signature, expiresAt: Date.now() + SIGNATURE_CACHE_TTL_MS });
    res.json({ signature });
  } catch (err) {
    console.error('Get signature error:', err);
    res.status(500).json({ error: 'Failed to load signature' });
  }
});

export default router;
