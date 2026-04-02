import { Router } from 'express';
import { google } from 'googleapis';
import multer from 'multer';
import supabase from '../lib/supabase.js';
import { getOAuth2ClientForAccount } from '../lib/google.js';
import { authenticateToken } from '../middleware/auth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

const router = Router();

function getCategoryLabel(category) {
  const map = {
    primary: 'CATEGORY_PERSONAL',
    social: 'CATEGORY_SOCIAL',
    promotions: 'CATEGORY_PROMOTIONS',
    sent: 'SENT',
    drafts: 'DRAFT',
    trash: 'TRASH'
  };
  return map[category] || 'CATEGORY_PERSONAL';
}

function parseEmailBody(payload) {
  let htmlBody = '';
  let textBody = '';

  function extractParts(part) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      htmlBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
    } else if (part.mimeType === 'text/plain' && part.body?.data) {
      textBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
    }
    if (part.parts) {
      part.parts.forEach(extractParts);
    }
  }

  extractParts(payload);
  return htmlBody || textBody.replace(/\n/g, '<br>') || '(no content)';
}

function extractAttachmentMetadata(payload) {
  const attachments = [];

  function traverse(part) {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType,
        attachmentId: part.body.attachmentId,
        size: part.body.size || 0
      });
    }
    if (part.parts) {
      part.parts.forEach(traverse);
    }
  }

  traverse(payload);
  return attachments;
}

function buildMimeEmail(to, subject, htmlBody, options = {}) {
  const { cc, bcc, threadId, attachments = [] } = options;

  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  let headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
  ];

  if (cc) headers.push(`Cc: ${cc}`);
  if (bcc) headers.push(`Bcc: ${bcc}`);
  if (threadId) {
    headers.push(`In-Reply-To: ${threadId}`);
    headers.push(`References: ${threadId}`);
  }

  const styledHtmlBody = `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            font-size: 14px;
            line-height: 1.4;
            color: #000000;
            margin: 0;
            padding: 0;
          }
          p {
            margin: 0 0 8px 0;
          }
          p:last-child {
            margin-bottom: 0;
          }
          a {
            color: #1a73e8;
          }
        </style>
      </head>
      <body>${htmlBody}</body>
    </html>
  `;

  if (attachments.length === 0) {
    headers.push('Content-Type: text/html; charset=UTF-8');
    headers.push('');
    headers.push(styledHtmlBody);
  } else {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    headers.push('');

    headers.push(`--${boundary}`);
    headers.push('Content-Type: text/html; charset=UTF-8');
    headers.push('');
    headers.push(styledHtmlBody);
    headers.push('');

    for (const att of attachments) {
      headers.push(`--${boundary}`);
      headers.push(`Content-Type: ${att.mimeType}`);
      headers.push('Content-Transfer-Encoding: base64');
      headers.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      headers.push('');
      headers.push(att.data);
      headers.push('');
    }

    headers.push(`--${boundary}--`);
  }

  return headers.join('\r\n');
}

async function verifyAccountOwnership(accountId, userId) {
  const { data: account } = await supabase
    .from('gmail_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single();
  return account;
}

// List emails
router.get('/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const category = req.query.category || 'primary';
    const maxResults = parseInt(req.query.maxResults) || 50;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    const categoryLabel = getCategoryLabel(category);

    let labelIds;
    if (category === 'sent' || category === 'drafts' || category === 'trash') {
      labelIds = [categoryLabel];
    } else if (category === 'primary') {
      labelIds = ['INBOX'];
    } else {
      labelIds = ['INBOX', categoryLabel];
    }

    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      labelIds: labelIds
    });

    const messages = response.data.messages || [];
    const emails = await Promise.all(
      messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date']
        });

        const headers = detail.data.payload.headers;
        const from = headers.find(h => h.name === 'From')?.value || '';
        const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        return {
          id: msg.id,
          threadId: msg.threadId,
          from,
          subject,
          snippet: detail.data.snippet,
          date: date ? new Date(date).toISOString() : new Date().toISOString(),
          isRead: !detail.data.labelIds?.includes('UNREAD')
        };
      })
    );

    res.json({ emails });
  } catch (error) {
    console.error('Get emails error:', error);
    res.status(500).json({ error: 'Failed to get emails' });
  }
});

// Get email detail
router.get('/:accountId/:messageId', authenticateToken, async (req, res) => {
  try {
    const { accountId, messageId } = req.params;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    const headers = message.data.payload.headers;
    const body = parseEmailBody(message.data.payload);
    const attachments = extractAttachmentMetadata(message.data.payload);

    res.json({
      body,
      headers: {
        from: headers.find(h => h.name === 'From')?.value,
        to: headers.find(h => h.name === 'To')?.value,
        cc: headers.find(h => h.name === 'Cc')?.value,
        date: headers.find(h => h.name === 'Date')?.value,
        subject: headers.find(h => h.name === 'Subject')?.value,
        replyTo: headers.find(h => h.name === 'Reply-To')?.value
      },
      attachments
    });
  } catch (error) {
    console.error('Get email detail error:', error);
    res.status(500).json({ error: 'Failed to get email details' });
  }
});

// Download attachment
router.get('/:accountId/:messageId/attachments/:attachmentId', authenticateToken, async (req, res) => {
  try {
    const { accountId, messageId, attachmentId } = req.params;
    const { filename, mimeType } = req.query;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId
    });

    const buffer = Buffer.from(attachment.data.data, 'base64');

    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({ error: 'Failed to download attachment' });
  }
});

// Get thread
router.get('/:accountId/:threadId/thread', authenticateToken, async (req, res) => {
  try {
    const { accountId, threadId } = req.params;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    const thread = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date']
    });

    const messages = thread.data.messages.map(msg => {
      const headers = msg.payload.headers;
      return {
        id: msg.id,
        threadId: msg.threadId,
        from: headers.find(h => h.name === 'From')?.value || '',
        subject: headers.find(h => h.name === 'Subject')?.value || '',
        date: headers.find(h => h.name === 'Date')?.value || '',
        snippet: msg.snippet
      };
    });

    res.json({ messages });
  } catch (error) {
    console.error('Get thread error:', error);
    res.status(500).json({ error: 'Failed to get thread' });
  }
});

// Save draft (legacy endpoint)
router.post('/:accountId/draft', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    let { to, cc, bcc, subject, body, draftId } = req.body;

    const raw = buildMimeEmail(to || '', subject || '', body || '', { cc, bcc });
    const encodedMessage = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    let result;
    if (draftId) {
      result = await gmail.users.drafts.update({
        userId: 'me',
        id: draftId,
        requestBody: { message: { raw: encodedMessage } }
      });
    } else {
      result = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: { message: { raw: encodedMessage } }
      });
    }

    res.json({ success: true, draftId: result.data.id });
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ error: error.message || 'Failed to save draft' });
  }
});

// Send email
router.post('/:accountId/send', authenticateToken, upload.array('attachments', 10), async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    let { to, cc, bcc, subject, body, threadId, draftId } = req.body;

    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        attachments.push({
          filename: file.originalname,
          mimeType: file.mimetype,
          data: file.buffer.toString('base64')
        });
      }
    }

    const raw = buildMimeEmail(to, subject, body, { cc, bcc, threadId, attachments });
    const encodedMessage = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const sendParams = {
      userId: 'me',
      requestBody: { raw: encodedMessage }
    };

    if (threadId) {
      sendParams.requestBody.threadId = threadId;
    }

    await gmail.users.messages.send(sendParams);

    if (draftId) {
      try {
        await gmail.users.drafts.delete({ userId: 'me', id: draftId });
      } catch (err) {
        console.error('Failed to delete draft after send:', err);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ error: error.message || 'Failed to send email' });
  }
});

// Save/update draft
router.post('/:accountId/drafts', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { to, cc, bcc, subject, body, threadId, draftId } = req.body;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    const raw = buildMimeEmail(to, subject, body, { cc, bcc, threadId });
    const encodedMessage = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    let result;
    if (draftId) {
      result = await gmail.users.drafts.update({
        userId: 'me',
        id: draftId,
        requestBody: { message: { raw: encodedMessage } }
      });
    } else {
      result = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: encodedMessage,
            threadId: threadId || undefined
          }
        }
      });
    }

    res.json({ success: true, draftId: result.data.id });
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ error: error.message || 'Failed to save draft' });
  }
});

// Delete draft
router.delete('/:accountId/drafts/:draftId', authenticateToken, async (req, res) => {
  try {
    const { accountId, draftId } = req.params;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    await gmail.users.drafts.delete({ userId: 'me', id: draftId });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete draft error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete draft' });
  }
});

// Archive email
router.post('/:accountId/:messageId/archive', authenticateToken, async (req, res) => {
  try {
    const { accountId, messageId } = req.params;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: ['INBOX'] }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Archive email error:', error);
    res.status(500).json({ error: 'Failed to archive email' });
  }
});

// Mark as read
router.post('/:accountId/:messageId/read', authenticateToken, async (req, res) => {
  try {
    const { accountId, messageId } = req.params;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: ['UNREAD'] }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Trash email
router.post('/:accountId/:messageId/trash', authenticateToken, async (req, res) => {
  try {
    const { accountId, messageId } = req.params;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    await gmail.users.messages.trash({ userId: 'me', id: messageId });

    res.json({ success: true });
  } catch (error) {
    console.error('Trash email error:', error);
    res.status(500).json({ error: 'Failed to delete email' });
  }
});

// Batch actions
router.post('/:accountId/batch', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { action, emailIds } = req.body;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    if (action === 'archive') {
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: emailIds,
          removeLabelIds: ['INBOX']
        }
      });
    } else if (action === 'trash') {
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: emailIds,
          addLabelIds: ['TRASH'],
          removeLabelIds: ['INBOX']
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Batch action error:', error);
    res.status(500).json({ error: 'Failed to perform batch action' });
  }
});

export default router;
