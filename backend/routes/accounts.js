import { Router } from 'express';
import { google } from 'googleapis';
import supabase from '../lib/supabase.js';
import { oauth2Client, ALL_SCOPES, getOAuth2ClientForAccount } from '../lib/google.js';
import { authenticateToken } from '../middleware/auth.js';
import { issueOAuthState } from '../lib/security.js';

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

router.get('/connect', authenticateToken, (req, res) => {
  // popup=1 lets the frontend open a small window for OAuth instead of
  // navigating away from the app. The flag rides along in the state token
  // so the OAuth callback (which runs on Google's redirect, not under our
  // direct control) knows whether to render a popup-close HTML response
  // or do the legacy full-page redirect to /app.
  //
  // Note: enforceAccountLimit was removed in PR #13 (no more Free tier).
  // Access is now gated at the server.js route group via requireActiveAccess.
  const isPopup = req.query.popup === '1';
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ALL_SCOPES,
    prompt: 'consent',
    include_granted_scopes: true,
    state: issueOAuthState({ purpose: 'link', userId: req.userId, popup: isPopup }),
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

export default router;
