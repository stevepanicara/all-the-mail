import express from 'express';
import { google } from 'googleapis';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import Stripe from 'stripe';

const app = express();

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// Environment
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

// Google OAuth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Stripe
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_PRICE_ID_PRO = process.env.STRIPE_PRICE_ID_PRO;
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

// Stripe webhook must be registered before express.json() for raw body access
app.post('/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(501).json({ error: 'Stripe not configured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        if (userId) {
          await supabase.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            plan: 'pro',
            status: 'active'
          }, { onConflict: 'user_id' });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await supabase.from('subscriptions')
          .update({
            status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
          })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await supabase.from('subscriptions')
          .update({ plan: 'free', status: 'canceled' })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

app.use(express.json());
app.use(cookieParser());

// OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// Scopes — organized by service
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

// ==================== MIDDLEWARE ====================

async function authenticateToken(req, res, next) {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ==================== HELPER FUNCTIONS ====================

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

  // Wrap HTML body with normalized CSS for proper line spacing
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
    
    // HTML body part
    headers.push(`--${boundary}`);
    headers.push('Content-Type: text/html; charset=UTF-8');
    headers.push('');
    headers.push(styledHtmlBody);
    headers.push('');
    
    // Attachment parts
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

// ==================== AUTH ROUTES ====================

app.get('/auth/google', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ALL_SCOPES,
    prompt: 'consent',
    include_granted_scopes: true
  });
  res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.redirect(`${FRONTEND_URL}?auth=error`);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // First check if user exists by google_id
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('google_id', userInfo.id)
      .single();

    let userId;
    if (existingUser) {
      // User exists with google_id - update their info
      userId = existingUser.id;
      await supabase
        .from('users')
        .update({
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture
        })
        .eq('id', userId);
    } else {
      // Check if user exists by email (legacy user without google_id)
      const { data: userByEmail } = await supabase
        .from('users')
        .select('*')
        .eq('email', userInfo.email)
        .single();

      if (userByEmail) {
        // User exists but no google_id - update it
        userId = userByEmail.id;
        await supabase
          .from('users')
          .update({
            google_id: userInfo.id,
            name: userInfo.name,
            picture: userInfo.picture
          })
          .eq('id', userId);
      } else {
        // Create new user
        const { data: newUser, error } = await supabase
          .from('users')
          .insert({
            google_id: userInfo.id,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture
          })
          .select()
          .single();

        if (error) throw error;
        userId = newUser.id;
      }
    }

    // Determine which services the user granted
    const grantedScopes = tokens.scope ? tokens.scope.split(' ') : [];
    const grantedServices = [];
    if (grantedScopes.some(s => s.includes('gmail'))) grantedServices.push('mail');
    if (grantedScopes.some(s => s.includes('drive'))) grantedServices.push('docs');
    if (grantedScopes.some(s => s.includes('calendar'))) grantedServices.push('cals');

    const { data: existingAccount } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('gmail_email', userInfo.email)
      .single();

    if (!existingAccount) {
      await supabase.from('gmail_accounts').insert({
        user_id: userId,
        gmail_email: userInfo.email,
        account_name: userInfo.name || userInfo.email,
        encrypted_tokens: encryptToken(tokens),
        granted_scopes: grantedServices
      });
    } else {
      await supabase
        .from('gmail_accounts')
        .update({
          encrypted_tokens: encryptToken(tokens),
          granted_scopes: grantedServices
        })
        .eq('id', existingAccount.id);
    }

    const jwtToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });

    res.cookie('auth_token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.redirect(`${FRONTEND_URL}/app?auth=success`);
  } catch (error) {
    console.error('Auth error:', error);
    res.redirect(`${FRONTEND_URL}?auth=error`);
  }
});

app.post('/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

app.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', req.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Get user profile error:', err);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// ==================== ACCOUNT ROUTES ====================

app.get('/accounts', authenticateToken, async (req, res) => {
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

app.get('/accounts/connect', authenticateToken, (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ALL_SCOPES,
    prompt: 'consent',
    include_granted_scopes: true,
    state: req.userId
  });
  res.redirect(authUrl);
});

app.delete('/accounts/:accountId', authenticateToken, async (req, res) => {
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

// ==================== EMAIL ROUTES ====================

app.get('/emails/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const category = req.query.category || 'primary';
    const maxResults = parseInt(req.query.maxResults) || 50;

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const client = await getOAuth2ClientForAccount(accountId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    const categoryLabel = getCategoryLabel(category);
    
    // Determine which labels to use
    let labelIds;
    if (category === 'sent' || category === 'drafts' || category === 'trash') {
      // Sent, Drafts, and Trash use their own labels only
      labelIds = [categoryLabel];
    } else if (category === 'primary') {
      // Primary should show ALL inbox emails (without category filtering)
      // This matches Gmail's behavior
      labelIds = ['INBOX'];
    } else {
      // Social and Promotions use INBOX + their specific category
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

app.get('/emails/:accountId/:messageId', authenticateToken, async (req, res) => {
  try {
    const { accountId, messageId } = req.params;

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

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

app.get('/emails/:accountId/:messageId/attachments/:attachmentId', authenticateToken, async (req, res) => {
  try {
    const { accountId, messageId, attachmentId } = req.params;
    const { filename, mimeType } = req.query;

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

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

app.get('/emails/:accountId/:threadId/thread', authenticateToken, async (req, res) => {
  try {
    const { accountId, threadId } = req.params;

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

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

app.post('/emails/:accountId/draft', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const client = await getOAuth2ClientForAccount(accountId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    let { to, cc, bcc, subject, body, draftId } = req.body;

    // Build the email message
    const raw = buildMimeEmail(to || '', subject || '', body || '', { cc, bcc });
    const encodedMessage = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    let result;
    if (draftId) {
      // Update existing draft
      result = await gmail.users.drafts.update({
        userId: 'me',
        id: draftId,
        requestBody: {
          message: { raw: encodedMessage }
        }
      });
    } else {
      // Create new draft
      result = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: { raw: encodedMessage }
        }
      });
    }

    res.json({ success: true, draftId: result.data.id });
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ error: error.message || 'Failed to save draft' });
  }
});

app.post('/emails/:accountId/send', authenticateToken, upload.array('attachments', 10), async (req, res) => {
  try {
    const { accountId } = req.params;

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const client = await getOAuth2ClientForAccount(accountId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    let { to, cc, bcc, subject, body, threadId, draftId } = req.body;

    // Process file attachments if present
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

    // Delete draft if one was being edited
    if (draftId) {
      try {
        await gmail.users.drafts.delete({
          userId: 'me',
          id: draftId
        });
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

app.post('/emails/:accountId/drafts', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { to, cc, bcc, subject, body, threadId, draftId } = req.body;

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const client = await getOAuth2ClientForAccount(accountId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    const raw = buildMimeEmail(to, subject, body, { cc, bcc, threadId });
    const encodedMessage = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    let result;
    if (draftId) {
      // Update existing draft
      result = await gmail.users.drafts.update({
        userId: 'me',
        id: draftId,
        requestBody: {
          message: { raw: encodedMessage }
        }
      });
    } else {
      // Create new draft
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

app.delete('/emails/:accountId/drafts/:draftId', authenticateToken, async (req, res) => {
  try {
    const { accountId, draftId } = req.params;

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const client = await getOAuth2ClientForAccount(accountId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    await gmail.users.drafts.delete({
      userId: 'me',
      id: draftId
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete draft error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete draft' });
  }
});

app.post('/emails/:accountId/:messageId/archive', authenticateToken, async (req, res) => {
  try {
    const { accountId, messageId } = req.params;

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const client = await getOAuth2ClientForAccount(accountId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['INBOX']
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Archive email error:', error);
    res.status(500).json({ error: 'Failed to archive email' });
  }
});

app.post('/emails/:accountId/:messageId/read', authenticateToken, async (req, res) => {
  try {
    const { accountId, messageId } = req.params;

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const client = await getOAuth2ClientForAccount(accountId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD']
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

app.post('/emails/:accountId/:messageId/trash', authenticateToken, async (req, res) => {
  try {
    const { accountId, messageId } = req.params;

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const client = await getOAuth2ClientForAccount(accountId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    await gmail.users.messages.trash({
      userId: 'me',
      id: messageId
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Trash email error:', error);
    res.status(500).json({ error: 'Failed to delete email' });
  }
});

app.post('/emails/:accountId/batch', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { action, emailIds } = req.body;

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

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
      // Move to trash instead of permanent delete
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

// ==================== DOCS (GOOGLE DRIVE) ROUTES ====================

app.get('/docs/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { filter } = req.query;

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

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

app.get('/docs/:accountId/:fileId', authenticateToken, async (req, res) => {
  try {
    const { accountId, fileId } = req.params;

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

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

// ==================== DOC PREVIEW ROUTE ====================

app.get('/docs/:accountId/:fileId/preview', authenticateToken, async (req, res) => {
  try {
    const { accountId, fileId } = req.params;

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

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

    // Google Docs → export as HTML
    if (mimeType === 'application/vnd.google-apps.document') {
      const { data: html } = await drive.files.export({
        fileId,
        mimeType: 'text/html',
      });
      return res.json({ type: 'html', content: html, name: file.name });
    }

    // Google Sheets → export as HTML (basic table view)
    if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      const { data: html } = await drive.files.export({
        fileId,
        mimeType: 'text/html',
      });
      return res.json({ type: 'html', content: html, name: file.name });
    }

    // Google Slides → thumbnail
    if (mimeType === 'application/vnd.google-apps.presentation') {
      if (file.thumbnailLink) {
        return res.json({ type: 'thumbnail', url: file.thumbnailLink, name: file.name });
      }
    }

    // Fallback: thumbnail if available
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

// ==================== CALS (GOOGLE CALENDAR) ROUTES ====================

app.get('/cals/:accountId/events', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { range } = req.query;

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!account.granted_scopes?.includes('cals')) {
      return res.status(403).json({ error: 'missing_scope', message: 'This account has not granted Calendar access', service: 'cals' });
    }

    const client = await getOAuth2ClientForAccount(accountId);
    const calendar = google.calendar({ version: 'v3', auth: client });

    const now = new Date();
    let timeMax = new Date(now);
    if (range === 'today') {
      timeMax.setHours(23, 59, 59, 999);
    } else if (range === 'week') {
      timeMax.setDate(timeMax.getDate() + 7);
    } else {
      // Default: 30 days
      timeMax.setDate(timeMax.getDate() + 30);
    }

    // Fetch all calendars, then events from each in parallel
    const calListResponse = await calendar.calendarList.list();
    const calendars = (calListResponse.data.items || []).filter(c => !c.deleted);

    const allEventArrays = await Promise.all(
      calendars.map(async (cal) => {
        try {
          const resp = await calendar.events.list({
            calendarId: cal.id,
            timeMin: now.toISOString(),
            timeMax: timeMax.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 100,
          });
          return (resp.data.items || []).map(ev => ({
            ...ev,
            _calendarId: cal.id,
            _calendarName: cal.summary,
            _calendarColor: cal.backgroundColor || null,
          }));
        } catch (err) {
          console.warn(`Failed to fetch events from calendar "${cal.summary}":`, err.message);
          return [];
        }
      })
    );

    const items = allEventArrays
      .flat()
      .sort((a, b) => {
        const aT = a.start?.dateTime || a.start?.date || '';
        const bT = b.start?.dateTime || b.start?.date || '';
        return aT.localeCompare(bT);
      });

    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const events = items.map(ev => {
      const start = ev.start?.dateTime || ev.start?.date;
      const end = ev.end?.dateTime || ev.end?.date;
      const startDate = new Date(start);

      // Determine day label
      const today = new Date(); today.setHours(0,0,0,0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const eventDay = new Date(startDate); eventDay.setHours(0,0,0,0);
      let day;
      if (eventDay.getTime() === today.getTime()) day = 'Today';
      else if (eventDay.getTime() === tomorrow.getTime()) day = 'Tomorrow';
      else day = startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

      // Format time
      const time = ev.start?.dateTime
        ? startDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
        : 'All day';

      const endTime = ev.end?.dateTime
        ? new Date(end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
        : null;

      return {
        id: ev.id,
        calendarId: ev._calendarId,
        calendarName: ev._calendarName,
        calendarColor: ev._calendarColor,
        title: ev.summary || '(No title)',
        time,
        endTime,
        day,
        meta: ev.location || ev.hangoutLink || '',
        urgent: ev.start?.dateTime ? startDate <= twoHoursFromNow && startDate >= now : false,
        attendees: (ev.attendees || []).map(a => ({ email: a.email, name: a.displayName, status: a.responseStatus })),
        status: ev.status,
        organizer: ev.organizer?.displayName || ev.organizer?.email || '',
        htmlLink: ev.htmlLink,
        description: ev.description || '',
        startISO: start,
        endISO: end
      };
    });

    res.json({ events });
  } catch (error) {
    console.error('Get calendar events error:', error?.message || error);
    if (error?.code === 403 || error?.response?.status === 403 || error?.errors?.[0]?.reason === 'insufficientPermissions') {
      return res.status(403).json({ error: 'missing_scope', message: 'Calendar permissions not granted. Please reconnect this account.', service: 'cals' });
    }
    if (error?.code === 401 || error?.response?.status === 401) {
      return res.status(401).json({ error: 'invalid_token', message: 'Token expired or revoked. Please reconnect this account.' });
    }
    res.status(500).json({ error: 'Failed to get calendar events' });
  }
});

app.patch('/cals/:accountId/events/:eventId', authenticateToken, async (req, res) => {
  try {
    const { accountId, eventId } = req.params;

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!account.granted_scopes?.includes('cals')) {
      return res.status(403).json({ error: 'missing_scope', message: 'This account has not granted Calendar access', service: 'cals' });
    }

    const ALLOWED_FIELDS = ['summary', 'description', 'location', 'start', 'end'];
    const sanitizedBody = {};
    for (const key of ALLOWED_FIELDS) {
      if (req.body[key] !== undefined) {
        sanitizedBody[key] = req.body[key];
      }
    }

    const patchCalendarId = req.body.calendarId || 'primary';

    const client = await getOAuth2ClientForAccount(accountId);
    const calendar = google.calendar({ version: 'v3', auth: client });

    const response = await calendar.events.patch({
      calendarId: patchCalendarId,
      eventId,
      requestBody: sanitizedBody,
    });

    const ev = response.data;
    const start = ev.start?.dateTime || ev.start?.date;
    const end = ev.end?.dateTime || ev.end?.date;

    res.json({
      event: {
        id: ev.id,
        title: ev.summary || '(No title)',
        description: ev.description || '',
        location: ev.location || '',
        startISO: start,
        endISO: end,
        status: ev.status,
        htmlLink: ev.htmlLink,
      }
    });
  } catch (error) {
    console.error('Patch calendar event error:', error?.message || error);
    if (error?.code === 403 || error?.response?.status === 403) {
      return res.status(403).json({ error: 'missing_scope', message: 'Calendar permissions not granted. Please reconnect this account.', service: 'cals' });
    }
    if (error?.code === 401 || error?.response?.status === 401) {
      return res.status(401).json({ error: 'invalid_token', message: 'Token expired or revoked. Please reconnect this account.' });
    }
    res.status(500).json({ error: 'Failed to update event' });
  }
});

app.get('/cals/:accountId/calendars', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;

    const { data: account } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!account.granted_scopes?.includes('cals')) {
      return res.status(403).json({ error: 'missing_scope', message: 'This account has not granted Calendar access', service: 'cals' });
    }

    const client = await getOAuth2ClientForAccount(accountId);
    const calendar = google.calendar({ version: 'v3', auth: client });

    const response = await calendar.calendarList.list();
    const calendars = (response.data.items || []).map(c => ({
      id: c.id,
      summary: c.summary,
      primary: !!c.primary,
      backgroundColor: c.backgroundColor
    }));

    res.json({ calendars });
  } catch (error) {
    console.error('Get calendars error:', error?.message || error);
    if (error?.code === 403 || error?.response?.status === 403 || error?.errors?.[0]?.reason === 'insufficientPermissions') {
      return res.status(403).json({ error: 'missing_scope', message: 'Calendar permissions not granted. Please reconnect this account.', service: 'cals' });
    }
    if (error?.code === 401 || error?.response?.status === 401) {
      return res.status(401).json({ error: 'invalid_token', message: 'Token expired or revoked. Please reconnect this account.' });
    }
    res.status(500).json({ error: 'Failed to get calendars' });
  }
});

// ==================== BILLING ROUTES ====================

app.get('/billing/status', authenticateToken, async (req, res) => {
  try {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status, current_period_end')
      .eq('user_id', req.userId)
      .single();

    res.json({ plan: sub?.plan || 'free', status: sub?.status || 'none', currentPeriodEnd: sub?.current_period_end || null });
  } catch (err) {
    console.error('Get billing status error:', err);
    res.json({ plan: 'free', status: 'none', currentPeriodEnd: null });
  }
});

app.post('/billing/checkout', authenticateToken, async (req, res) => {
  if (!stripe || !STRIPE_PRICE_ID_PRO) {
    return res.status(501).json({ error: 'Stripe not configured' });
  }

  try {
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', req.userId)
      .single();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: STRIPE_PRICE_ID_PRO, quantity: 1 }],
      success_url: `${FRONTEND_URL}/app?billing=success`,
      cancel_url: `${FRONTEND_URL}/app?billing=canceled`,
      customer_email: user?.email,
      metadata: { user_id: req.userId }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Create checkout session error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

app.post('/billing/portal', authenticateToken, async (req, res) => {
  if (!stripe) {
    return res.status(501).json({ error: 'Stripe not configured' });
  }

  try {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', req.userId)
      .single();

    if (!sub?.stripe_customer_id) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${FRONTEND_URL}/app`
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Create portal session error:', err);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// ==================== HEALTH CHECK ====================

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ==================== START SERVER ====================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running on port ${PORT}`);
});
