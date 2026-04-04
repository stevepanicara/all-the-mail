import { Router } from 'express';
import crypto from 'crypto';
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
  const { code, state } = req.query;
  if (!code) {
    return res.redirect(`${FRONTEND_URL}?auth=error`);
  }

  try {

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);


    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // If state contains a signed userId, this is an "add account" flow — verify signature
    let linkToUserId = null;
    if (state && state.includes('.')) {
      const hmac = crypto.createHmac('sha256', JWT_SECRET);
      hmac.update(state.split('.')[0]);
      const expected = hmac.digest('hex').slice(0, 16);
      if (state.split('.')[1] === expected) {
        linkToUserId = state.split('.')[0];
      } else {
        console.warn('[AUTH] Invalid state signature — ignoring link request');
      }
    }

    let userId;

    if (linkToUserId) {
      // Adding account to existing user — verify the user exists
      const { data: linkUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', linkToUserId)
        .single();

      if (linkUser) {
        userId = linkUser.id;
      }
    }

    if (!userId) {
      // Normal login flow — find or create user
      const { data: existingUser, error: findErr } = await supabase
        .from('users')
        .select('*')
        .eq('google_id', userInfo.id)
        .single();

      if (findErr && findErr.code !== 'PGRST116') {
        console.error('[AUTH] Error finding user by google_id:', findErr);
      }

      if (existingUser) {
        userId = existingUser.id;
        const { error: updateErr } = await supabase
          .from('users')
          .update({
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            last_login: new Date().toISOString()
          })
          .eq('id', userId);
        if (updateErr) console.error('[AUTH] Error updating user:', updateErr);
      } else {
        const { data: userByEmail, error: emailErr } = await supabase
          .from('users')
          .select('*')
          .eq('email', userInfo.email)
          .single();

        if (emailErr && emailErr.code !== 'PGRST116') {
          console.error('[AUTH] Error finding user by email:', emailErr);
      }

      if (userByEmail) {
        userId = userByEmail.id;
        const { error: updateErr } = await supabase
          .from('users')
          .update({
            google_id: userInfo.id,
            name: userInfo.name,
            picture: userInfo.picture,
            last_login: new Date().toISOString()
          })
          .eq('id', userId);
        if (updateErr) console.error('[AUTH] Error updating user:', updateErr);
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

        if (error) {
          console.error('[AUTH] Error creating user:', error);
          throw error;
        }
        userId = newUser.id;
      }
      }
    }

    // Determine which services the user granted
    const grantedScopes = tokens.scope ? tokens.scope.split(' ') : [];
    const grantedServices = [];
    if (grantedScopes.some(s => s.includes('gmail'))) grantedServices.push('mail');
    if (grantedScopes.some(s => s.includes('drive'))) grantedServices.push('docs');
    if (grantedScopes.some(s => s.includes('calendar'))) grantedServices.push('cals');

    const { data: existingAccount, error: accFindErr } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('gmail_email', userInfo.email)
      .single();

    if (accFindErr && accFindErr.code !== 'PGRST116') {
      console.error('[AUTH] Error finding gmail_account:', accFindErr);
    }

    if (!existingAccount) {
      const { error: insertErr } = await supabase.from('gmail_accounts').insert({
        user_id: userId,
        gmail_email: userInfo.email,
        account_name: userInfo.name || userInfo.email,
        encrypted_tokens: encryptToken(tokens),
        granted_scopes: grantedServices
      });
      if (insertErr) {
        console.error('[AUTH] Error inserting gmail_account:', insertErr);
        throw insertErr;
      }
    } else {
      const { error: updateErr } = await supabase
        .from('gmail_accounts')
        .update({
          encrypted_tokens: encryptToken(tokens),
          granted_scopes: grantedServices
        })
        .eq('id', existingAccount.id);
      if (updateErr) {
        console.error('[AUTH] Error updating gmail_account:', updateErr);
        throw updateErr;
      }
    }

    const jwtToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('auth_token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.redirect(`${FRONTEND_URL}/app?auth=success`);
  } catch (error) {
    console.error('[AUTH] Auth error:', error.message || 'Unknown error');
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
