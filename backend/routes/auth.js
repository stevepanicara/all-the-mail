import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import supabase from '../lib/supabase.js';
import { oauth2Client, ALL_SCOPES, encryptToken } from '../lib/google.js';
import { JWT_SECRET, authenticateToken } from '../middleware/auth.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

const router = Router();

router.get('/google', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ALL_SCOPES,
    prompt: 'consent',
    include_granted_scopes: true
  });
  res.redirect(authUrl);
});

router.get('/google/callback', async (req, res) => {
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
      const { data: userByEmail } = await supabase
        .from('users')
        .select('*')
        .eq('email', userInfo.email)
        .single();

      if (userByEmail) {
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

router.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

router.get('/me', authenticateToken, async (req, res) => {
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

export default router;
