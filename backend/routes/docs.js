import { Router } from 'express';
import { google } from 'googleapis';
import supabase from '../lib/supabase.js';
import { getOAuth2ClientForAccount } from '../lib/google.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

async function verifyAccountOwnership(accountId, userId) {
  const { data: account } = await supabase
    .from('gmail_accounts')
    .select('id, user_id, gmail_email, account_name, granted_scopes')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single();
  return account;
}

// List docs
router.get('/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { filter } = req.query;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    if (!account.granted_scopes?.includes('docs')) {
      return res.status(403).json({ error: 'missing_scope', message: 'This account has not granted Drive access', service: 'docs' });
    }

    const client = await getOAuth2ClientForAccount(accountId);
    const drive = google.drive({ version: 'v3', auth: client });

    let q = "mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.presentation'";
    if (filter === 'shared') q = `sharedWithMe=true and (${q})`;
    else if (filter === 'starred') q = `starred=true and (${q})`;
    else if (filter === 'trash') q = `trashed=true and (${q})`;
    else q = `trashed=false and (${q})`;

    const response = await drive.files.list({
      q,
      fields: 'files(id, name, mimeType, modifiedTime, owners, shared, starred, webViewLink, iconLink)',
      orderBy: 'modifiedTime desc',
      pageSize: 50
    });

    const files = response.data.files || [];
    const docs = files.map(f => ({
      id: f.id,
      title: f.name,
      owner: f.owners?.[0]?.displayName || 'Unknown',
      lastEdited: f.modifiedTime,
      date: f.modifiedTime,
      shared: !!f.shared,
      starred: !!f.starred,
      webViewLink: f.webViewLink,
      mimeType: f.mimeType,
      iconLink: f.iconLink
    }));

    res.json({ docs });
  } catch (error) {
    console.error('Get docs error:', error?.message || error);
    if (error?.code === 403 || error?.response?.status === 403 || error?.errors?.[0]?.reason === 'insufficientPermissions') {
      return res.status(403).json({ error: 'missing_scope', message: 'Drive permissions not granted. Please reconnect this account.', service: 'docs' });
    }
    if (error?.code === 401 || error?.response?.status === 401) {
      return res.status(401).json({ error: 'invalid_token', message: 'Token expired or revoked. Please reconnect this account.' });
    }
    res.status(500).json({ error: 'Failed to get documents' });
  }
});

// Get doc detail
router.get('/:accountId/:fileId', authenticateToken, async (req, res) => {
  try {
    const { accountId, fileId } = req.params;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    if (!account.granted_scopes?.includes('docs')) {
      return res.status(403).json({ error: 'missing_scope', message: 'This account has not granted Drive access', service: 'docs' });
    }

    const client = await getOAuth2ClientForAccount(accountId);
    const drive = google.drive({ version: 'v3', auth: client });

    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, modifiedTime, owners, shared, starred, description, webViewLink, iconLink'
    });

    const f = response.data;
    res.json({
      doc: {
        id: f.id,
        title: f.name,
        owner: f.owners?.[0]?.displayName || 'Unknown',
        lastEdited: f.modifiedTime,
        description: f.description || '',
        webViewLink: f.webViewLink,
        mimeType: f.mimeType,
        iconLink: f.iconLink
      }
    });
  } catch (error) {
    console.error('Get doc detail error:', error?.message || error);
    if (error?.code === 403 || error?.response?.status === 403 || error?.errors?.[0]?.reason === 'insufficientPermissions') {
      return res.status(403).json({ error: 'missing_scope', message: 'Drive permissions not granted. Please reconnect this account.', service: 'docs' });
    }
    if (error?.code === 401 || error?.response?.status === 401) {
      return res.status(401).json({ error: 'invalid_token', message: 'Token expired or revoked. Please reconnect this account.' });
    }
    res.status(500).json({ error: 'Failed to get document details' });
  }
});

// Doc preview
router.get('/:accountId/:fileId/preview', authenticateToken, async (req, res) => {
  try {
    const { accountId, fileId } = req.params;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    if (!account.granted_scopes?.includes('docs')) {
      return res.status(403).json({ error: 'missing_scope', service: 'docs' });
    }

    const client = await getOAuth2ClientForAccount(accountId);
    const drive = google.drive({ version: 'v3', auth: client });

    const { data: file } = await drive.files.get({
      fileId,
      fields: 'mimeType,name,thumbnailLink',
    });

    const mimeType = file.mimeType;

    if (mimeType === 'application/vnd.google-apps.document') {
      const { data: html } = await drive.files.export({ fileId, mimeType: 'text/html' });
      return res.json({ type: 'html', content: html, name: file.name });
    }

    if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      const { data: html } = await drive.files.export({ fileId, mimeType: 'text/html' });
      return res.json({ type: 'html', content: html, name: file.name });
    }

    if (mimeType === 'application/vnd.google-apps.presentation') {
      if (file.thumbnailLink) {
        return res.json({ type: 'thumbnail', url: file.thumbnailLink, name: file.name });
      }
    }

    if (file.thumbnailLink) {
      return res.json({ type: 'thumbnail', url: file.thumbnailLink, name: file.name });
    }

    return res.json({ type: 'none', name: file.name });
  } catch (err) {
    console.error('Doc preview error:', err?.message || err);
    if (err?.code === 403 || err?.response?.status === 403) {
      return res.status(403).json({ error: 'missing_scope', service: 'docs' });
    }
    if (err?.code === 401 || err?.response?.status === 401) {
      return res.status(401).json({ error: 'invalid_token' });
    }
    res.status(500).json({ error: 'Preview failed' });
  }
});

export default router;
