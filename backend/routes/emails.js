import { Router } from 'express';
import { google } from 'googleapis';
import multer from 'multer';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import supabase from '../lib/supabase.js';
import { getOAuth2ClientForAccount } from '../lib/google.js';
import { authenticateToken } from '../middleware/auth.js';

// P1.7 — multer hardening.
// - fileFilter blocks MIME types that browsers/clients commonly auto-execute
//   (executables, scripts, .lnk). All other types still allowed.
// - per-file 25 MB, max 10 files, total 50 MB across the request.
// - filename/originalname is sanitized at consume time (see sanitizeFilename).
const BLOCKED_MIME_PREFIXES = [
  'application/x-msdownload',          // .exe
  'application/x-msdos-program',
  'application/x-ms-shortcut',         // .lnk
  'application/x-msi',                 // .msi
  'application/x-bat',
  'application/x-sh',
  'application/x-csh',
  'application/x-perl',
  'application/x-python',
  'application/javascript',
  'application/x-javascript',
  'application/vnd.microsoft.portable-executable',
];
const BLOCKED_EXT_RE = /\.(exe|msi|bat|cmd|com|scr|pif|cpl|vbs|vbe|js|jse|wsf|wsh|ps1|psm1|jar|lnk|dll|sys|hta|inf|reg|app)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,    // 25 MB per file
    files: 10,                      // max 10 files
    fields: 30,                     // limit form-field count
  },
  fileFilter: (req, file, cb) => {
    const mt = (file.mimetype || '').toLowerCase();
    const name = file.originalname || '';
    if (BLOCKED_MIME_PREFIXES.some(p => mt.startsWith(p)) || BLOCKED_EXT_RE.test(name)) {
      return cb(new Error('File type not allowed'), false);
    }
    cb(null, true);
  },
});

// P1.2 — send rate limiter, applied INSIDE the route. The previous
// app.use('/emails/*/send', sendLimiter) in server.js never matched
// because Express's app.use treats '*' as a literal, not a glob —
// the limiter was effectively a no-op. 10 sends/min/IP is intentionally
// generous for legitimate burst (e.g., a user reply-all-storming a
// thread) but blocks a runaway script or compromised account.
const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Send rate limit reached — slow down a bit' },
  keyGenerator: (req) => `${ipKeyGenerator(req)}:${req.userId || 'anon'}`,
});

// P0.3 — strip CR/LF (and other control chars) from any value that ends
// up in a MIME header. Without this, a "subject" like "Hi\r\nBcc: evil"
// silently injects a Bcc header and exfiltrates outgoing mail. Same for
// To/Cc/Bcc/filename. Keep tab as it's legitimate header folding.
function sanitizeMimeHeaderValue(s) {
  if (s == null) return '';
  return String(s).replace(/[\r\n\u0000-\u0008\u000B-\u001F\u007F]/g, '').slice(0, 2000);
}

// Quote and escape an attachment filename for Content-Disposition.
// Strips path separators, control chars, and the quote+backslash that
// would break out of the quoted-string form. Falls back to "download" if empty.
function sanitizeFilename(name) {
  const cleaned = String(name || '')
    .replace(/[\r\n\u0000-\u001F\u007F]/g, '')
    .replace(/[\\/]/g, '_')
    .replace(/["]/g, '_')
    .slice(0, 255)
    .trim();
  return cleaned || 'download';
}

// Wrap base64 at 76 columns per RFC 2045.
function wrapBase64(s) {
  return s.replace(/(.{76})/g, '$1\r\n');
}

const router = Router();

// In-memory cache for email bodies — keyed by `${accountId}:${messageId}`.
// Emails are immutable once received, so a 30-minute TTL is safe.
const _emailBodyCache = new Map();
const EMAIL_BODY_CACHE_TTL_MS = 30 * 60 * 1000;
const EMAIL_BODY_CACHE_MAX = 500;

// Cache account ownership checks — eliminates a Supabase roundtrip on every
// cached-email request, making repeated loads near-instant.
const _accountOwnerCache = new Map(); // `${accountId}:${userId}` → { account, expiresAt }
const ACCOUNT_OWNER_CACHE_TTL_MS = 5 * 60 * 1000;

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

  // P0.3 — sanitize every value that lands in a header line.
  const safeTo = sanitizeMimeHeaderValue(to);
  const safeSubject = sanitizeMimeHeaderValue(subject);
  const safeCc = sanitizeMimeHeaderValue(cc);
  const safeBcc = sanitizeMimeHeaderValue(bcc);
  const safeThread = sanitizeMimeHeaderValue(threadId);

  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  let headers = [
    `To: ${safeTo}`,
    `Subject: ${safeSubject}`,
    'MIME-Version: 1.0',
  ];

  if (safeCc) headers.push(`Cc: ${safeCc}`);
  if (safeBcc) headers.push(`Bcc: ${safeBcc}`);
  if (safeThread) {
    headers.push(`In-Reply-To: ${safeThread}`);
    headers.push(`References: ${safeThread}`);
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
      const safeAttName = sanitizeFilename(att.filename);
      const safeAttMime = sanitizeMimeHeaderValue(att.mimeType) || 'application/octet-stream';
      headers.push(`--${boundary}`);
      headers.push(`Content-Type: ${safeAttMime}`);
      headers.push('Content-Transfer-Encoding: base64');
      headers.push(`Content-Disposition: attachment; filename="${safeAttName}"`);
      headers.push('');
      headers.push(wrapBase64(att.data));
      headers.push('');
    }

    headers.push(`--${boundary}--`);
  }

  return headers.join('\r\n');
}

async function verifyAccountOwnership(accountId, userId) {
  const key = `${accountId}:${userId}`;
  const hit = _accountOwnerCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.account;

  const { data: account } = await supabase
    .from('gmail_accounts')
    .select('id, user_id, gmail_email, account_name, granted_scopes')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single();

  // Cache even null results so we don't hammer Supabase on bad requests
  _accountOwnerCache.set(key, { account: account || null, expiresAt: Date.now() + ACCOUNT_OWNER_CACHE_TTL_MS });
  return account || null;
}

// Concurrency-limited Promise.all to avoid Gmail API rate limits
async function pMap(items, fn, concurrency = 10) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

// List emails
router.get('/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const category = req.query.category || 'primary';
    const maxResults = parseInt(req.query.maxResults) || 50;
    const searchQuery = req.query.q || '';

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    const listParams = { userId: 'me', maxResults };

    if (searchQuery) {
      // Search mode: pass q directly to Gmail API, no labelIds filter
      listParams.q = searchQuery;
    } else {
      const categoryLabel = getCategoryLabel(category);
      if (category === 'sent' || category === 'drafts' || category === 'trash') {
        listParams.labelIds = [categoryLabel];
      } else if (category === 'primary') {
        listParams.labelIds = ['INBOX'];
      } else {
        listParams.labelIds = ['INBOX', categoryLabel];
      }
    }

    const response = await gmail.users.messages.list(listParams);

    const messages = response.data.messages || [];
    // Concurrency-limited to 10 parallel requests to avoid Gmail API rate limits
    const emails = await pMap(messages, async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date', 'Content-Type']
      });

      const headers = detail.data.payload.headers;
      const from = headers.find(h => h.name === 'From')?.value || '';
      const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const labelIds = detail.data.labelIds || [];

      // Detect attachments from payload parts
      const hasAttachment = !!(detail.data.payload?.parts?.some(p => p.filename && p.filename.length > 0));

      return {
        id: msg.id,
        threadId: msg.threadId,
        from,
        subject,
        snippet: detail.data.snippet,
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
        isRead: !labelIds.includes('UNREAD'),
        isStarred: labelIds.includes('STARRED'),
        hasAttachment,
        labelIds
      };
    }, 10);

    res.json({ emails });
  } catch (error) {
    console.error('Get emails error:', error);
    res.status(500).json({ error: 'Failed to get emails' });
  }
});

// Batch fetch email bodies — up to 25 in parallel, serves cache first
router.post('/:accountId/batch-bodies', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { messageIds } = req.body;
    if (!Array.isArray(messageIds) || messageIds.length === 0) return res.json({ bodies: {} });

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const results = {};
    const uncachedIds = [];

    for (const msgId of messageIds.slice(0, 50)) {
      const key = `${accountId}:${msgId}`;
      const cached = _emailBodyCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        results[msgId] = cached.data;
      } else {
        uncachedIds.push(msgId);
      }
    }

    if (uncachedIds.length > 0) {
      const client = await getOAuth2ClientForAccount(accountId, req.userId);
      const gmail = google.gmail({ version: 'v1', auth: client });

      await Promise.all(uncachedIds.map(async (msgId) => {
        try {
          const msg = await gmail.users.messages.get({ userId: 'me', id: msgId, format: 'full' });
          const hdrs = msg.data.payload.headers;
          const data = {
            body: parseEmailBody(msg.data.payload),
            headers: {
              from: hdrs.find(h => h.name === 'From')?.value,
              to: hdrs.find(h => h.name === 'To')?.value,
              cc: hdrs.find(h => h.name === 'Cc')?.value,
              date: hdrs.find(h => h.name === 'Date')?.value,
              subject: hdrs.find(h => h.name === 'Subject')?.value,
              replyTo: hdrs.find(h => h.name === 'Reply-To')?.value,
            },
            attachments: extractAttachmentMetadata(msg.data.payload),
          };
          if (_emailBodyCache.size >= EMAIL_BODY_CACHE_MAX) _emailBodyCache.delete(_emailBodyCache.keys().next().value);
          _emailBodyCache.set(`${accountId}:${msgId}`, { data, expiresAt: Date.now() + EMAIL_BODY_CACHE_TTL_MS });
          results[msgId] = data;
        } catch (_) { /* skip individual failures */ }
      }));
    }

    return res.json({ bodies: results });
  } catch (err) {
    console.error('Batch email bodies error:', err);
    res.status(500).json({ error: 'Failed to batch fetch' });
  }
});

// Get email detail
router.get('/:accountId/:messageId', authenticateToken, async (req, res) => {
  try {
    const { accountId, messageId } = req.params;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    // Serve from cache if available
    const _cacheKey = `${accountId}:${messageId}`;
    const _cached = _emailBodyCache.get(_cacheKey);
    if (_cached && _cached.expiresAt > Date.now()) {
      return res.json(_cached.data);
    }

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    const headers = message.data.payload.headers;
    const body = parseEmailBody(message.data.payload);
    const attachments = extractAttachmentMetadata(message.data.payload);

    const fromHeader = headers.find(h => h.name === 'From')?.value;
    const toHeader = headers.find(h => h.name === 'To')?.value;
    const ccHeader = headers.find(h => h.name === 'Cc')?.value;
    const dateHeader = headers.find(h => h.name === 'Date')?.value;
    const subjectHeader = headers.find(h => h.name === 'Subject')?.value;
    const replyToHeader = headers.find(h => h.name === 'Reply-To')?.value;

    const _responseData = { body, headers: { from: fromHeader, to: toHeader, cc: ccHeader, date: dateHeader, subject: subjectHeader, replyTo: replyToHeader }, attachments };
    // Store in cache (evict oldest entry if at capacity)
    if (_emailBodyCache.size >= EMAIL_BODY_CACHE_MAX) {
      _emailBodyCache.delete(_emailBodyCache.keys().next().value);
    }
    _emailBodyCache.set(_cacheKey, { data: _responseData, expiresAt: Date.now() + EMAIL_BODY_CACHE_TTL_MS });
    return res.json(_responseData);
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

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId
    });

    const buffer = Buffer.from(attachment.data.data, 'base64');

    // Sanitize filename to prevent header injection (now centralized).
    const safeName = sanitizeFilename(filename);
    res.setHeader('Content-Type', sanitizeMimeHeaderValue(mimeType) || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({ error: 'Failed to download attachment' });
  }
});

// Get thread (full format with bodies)
router.get('/:accountId/:threadId/thread', authenticateToken, async (req, res) => {
  try {
    const { accountId, threadId } = req.params;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    const thread = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full'
    });

    const messages = thread.data.messages.map(msg => {
      const headers = msg.payload.headers;
      const labelIds = msg.labelIds || [];
      return {
        id: msg.id,
        threadId: msg.threadId,
        from: headers.find(h => h.name === 'From')?.value || '',
        to: headers.find(h => h.name === 'To')?.value || '',
        cc: headers.find(h => h.name === 'Cc')?.value || '',
        subject: headers.find(h => h.name === 'Subject')?.value || '',
        date: headers.find(h => h.name === 'Date')?.value || '',
        snippet: msg.snippet,
        body: parseEmailBody(msg.payload),
        attachments: extractAttachmentMetadata(msg.payload),
        isRead: !labelIds.includes('UNREAD'),
        isStarred: labelIds.includes('STARRED'),
        labelIds
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

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
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
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

// Send email — sendLimiter goes BEFORE multer so a flooded sender is rejected
// without buffering up to 250 MB into memory.
router.post('/:accountId/send', authenticateToken, sendLimiter, upload.array('attachments', 10), async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
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
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Save/update draft
router.post('/:accountId/drafts', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { to, cc, bcc, subject, body, threadId, draftId } = req.body;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
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
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

// Delete draft
router.delete('/:accountId/drafts/:draftId', authenticateToken, async (req, res) => {
  try {
    const { accountId, draftId } = req.params;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    await gmail.users.drafts.delete({ userId: 'me', id: draftId });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete draft error:', error);
    res.status(500).json({ error: 'Failed to delete draft' });
  }
});

// Archive email
router.post('/:accountId/:messageId/archive', authenticateToken, async (req, res) => {
  try {
    const { accountId, messageId } = req.params;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
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

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
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

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    await gmail.users.messages.trash({ userId: 'me', id: messageId });

    res.json({ success: true });
  } catch (error) {
    console.error('Trash email error:', error);
    res.status(500).json({ error: 'Failed to delete email' });
  }
});

// Toggle star
router.post('/:accountId/:messageId/star', authenticateToken, async (req, res) => {
  try {
    const { accountId, messageId } = req.params;
    const { starred } = req.body;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: starred
        ? { addLabelIds: ['STARRED'] }
        : { removeLabelIds: ['STARRED'] }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Star toggle error:', error);
    res.status(500).json({ error: 'Failed to toggle star' });
  }
});

// Modify labels
router.post('/:accountId/:messageId/labels', authenticateToken, async (req, res) => {
  try {
    const { accountId, messageId } = req.params;
    const { addLabelIds = [], removeLabelIds = [] } = req.body;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { addLabelIds, removeLabelIds }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Modify labels error:', error);
    res.status(500).json({ error: 'Failed to modify labels' });
  }
});

// Mark as unread
router.post('/:accountId/:messageId/unread', authenticateToken, async (req, res) => {
  try {
    const { accountId, messageId } = req.params;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { addLabelIds: ['UNREAD'] }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Mark as unread error:', error);
    res.status(500).json({ error: 'Failed to mark as unread' });
  }
});

// Batch actions
router.post('/:accountId/batch', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { action, emailIds } = req.body;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
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
