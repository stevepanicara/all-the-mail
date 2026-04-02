import { Router } from 'express';
import supabase from '../lib/supabase.js';
import { oauth2Client, ALL_SCOPES } from '../lib/google.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data: accounts, error } = await supabase
      .from('gmail_accounts')
      .select('id, gmail_email, account_name, created_at, granted_scopes')
      .eq('user_id', req.userId);

    if (error) throw error;
    res.json({ accounts });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: 'Failed to get accounts' });
  }
});

router.get('/connect', authenticateToken, (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ALL_SCOPES,
    prompt: 'consent',
    include_granted_scopes: true,
    state: req.userId
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

export default router;
