import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import supabase from '../lib/supabase.js';
import { oauth2Client, newOAuth2Client, ALL_SCOPES, encryptToken } from '../lib/google.js';
import { JWT_SECRET, authenticateToken } from '../middleware/auth.js';
import { issueOAuthState, consumeOAuthState, revokeJti, newJti } from '../lib/security.js';
import { safeLogError } from '../lib/log.js';

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
    // P1.9 — fresh OAuth client per callback. The exported singleton is
    // mutated by setCredentials, which under concurrent callbacks can leak
    // user A's tokens into user B's userinfo.get() call.
    const callbackClient = newOAuth2Client();
    const { tokens } = await callbackClient.getToken(code);
    callbackClient.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: callbackClient });
    const { data: userInfo } = await oauth2.userinfo.get();

    // P0.2: state token is single-use, random 32-byte, server-issued, 10-min TTL.
    // For an "add account" flow, the payload contains { userId, purpose:'link' }.
    // For a fresh login, state may be absent or be a login-purpose token (not required).
    // popup=true means the frontend opened a popup window — we should respond
    // with a self-closing HTML page that pings the opener instead of redirecting.
    let linkToUserId = null;
    let isPopup = false;
    if (state) {
      const payload = consumeOAuthState(state);
      if (payload && payload.purpose === 'link' && payload.userId) {
        linkToUserId = payload.userId;
        isPopup = !!payload.popup;
      } else if (payload === null) {
        console.warn('[AUTH] OAuth state token invalid or expired — treating as fresh login');
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
        // P0.1 — DO NOT rebind google_id by email match.
        // Previously: if a user row existed with this email but a different
        // google_id, we updated google_id to the newly-authenticating Google
        // account. That allowed account takeover by anyone able to register a
        // Google account with a victim's email (Workspace alias, deleted-and-
        // recreated account, etc.). Now: any email collision with a different
        // google_id is treated as a hard failure; the legit owner can re-link
        // through a (future) admin-supervised recovery flow.
        const { data: userByEmail, error: emailErr } = await supabase
          .from('users')
          .select('id, google_id, email')
          .eq('email', userInfo.email)
          .single();

        if (emailErr && emailErr.code !== 'PGRST116') {
          console.error('[AUTH] Error finding user by email:', emailErr);
        }

        if (userByEmail && userByEmail.google_id && userByEmail.google_id !== userInfo.id) {
          console.warn('[AUTH] Email-collision login blocked', {
            existingUserId: userByEmail.id,
            attemptedGoogleId: userInfo.id,
          });
          return res.redirect(`${FRONTEND_URL}?auth=error&reason=email_in_use`);
        }

        if (userByEmail && !userByEmail.google_id) {
          // Pre-provisioned row with no google_id yet — safe to bind on first login.
          userId = userByEmail.id;
          const { error: updateErr } = await supabase
            .from('users')
            .update({
              google_id: userInfo.id,
              name: userInfo.name,
              picture: userInfo.picture,
              last_login: new Date().toISOString(),
            })
            .eq('id', userId)
            .is('google_id', null); // belt-and-suspenders against TOCTOU
          if (updateErr) console.error('[AUTH] Error binding pre-provisioned user:', updateErr);
        } else {
          const { data: newUser, error } = await supabase
            .from('users')
            .insert({
              google_id: userInfo.id,
              email: userInfo.email,
              name: userInfo.name,
              picture: userInfo.picture,
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
        picture: userInfo.picture || null,
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
          granted_scopes: grantedServices,
          picture: userInfo.picture || null
        })
        .eq('id', existingAccount.id);
      if (updateErr) {
        console.error('[AUTH] Error updating gmail_account:', updateErr);
        throw updateErr;
      }
    }

    // P1.5 — every JWT carries a unique jti so we can surgically revoke a
    // session on logout (or future "kill session" admin action) without
    // forcing a global secret rotation. Algorithm pinned at HS256 in middleware.
    const jti = newJti();
    const jwtToken = jwt.sign({ userId, jti }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });

    const isProduction = process.env.FRONTEND_URL?.includes('allthemail.io');
    res.cookie('auth_token', jwtToken, {
      httpOnly: true,
      secure: true,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
      domain: isProduction ? '.allthemail.io' : undefined,
    });

    // Popup link flow: render a tiny HTML page that pings the opener and
    // closes itself. The opener page (App.js) listens for the message and
    // refreshes the account list. This avoids the full-page redirect dance
    // that makes "Add account" feel slow (≥1s of blank navigation).
    if (isPopup) {
      const frontendOrigin = (() => {
        try { return new URL(FRONTEND_URL).origin; } catch { return FRONTEND_URL; }
      })();
      // Override the API-default helmet CSP for this one response. The default
      // `default-src 'none'` blocks our inline script; we need to allow inline
      // for the self-closing popup. Tightened to script-src 'unsafe-inline'
      // only (no external sources, no eval).
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      // We tightly target the message at our frontend origin so a hostile
      // opener can't intercept. window.close() is silent if the popup was
      // navigated cross-site, so we also fall back to a plain "you can close
      // this window" message.
      return res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Account linked</title><style>body{font:14px/1.5 -apple-system,sans-serif;color:#0a0a0a;background:#fafaf7;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.box{text-align:center}.box h1{font-size:18px;margin:0 0 6px}.box p{margin:0;color:#555}</style></head><body><div class="box"><h1>Account linked</h1><p>You can close this window.</p></div><script>(function(){try{if(window.opener){window.opener.postMessage({type:'atm-account-linked'}, ${JSON.stringify(frontendOrigin)});}}catch(e){}try{window.close();}catch(e){}})();</script></body></html>`);
    }
    res.redirect(`${FRONTEND_URL}/app?auth=success`);
  } catch (error) {
    safeLogError('[AUTH] callback', error);
    res.redirect(`${FRONTEND_URL}?auth=error`);
  }
});

router.post('/logout', (req, res) => {
  // Revoke this session's jti so a stolen-but-still-unexpired cookie copy
  // cannot be replayed. Read the cookie defensively — clearing it also
  // requires us to know it.
  const token = req.cookies?.auth_token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      if (decoded.jti) {
        revokeJti(decoded.jti, decoded.exp ? decoded.exp * 1000 : undefined);
      }
    } catch (_) { /* expired/invalid: nothing to revoke */ }
  }
  const isProduction = process.env.FRONTEND_URL?.includes('allthemail.io');
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: true,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    domain: isProduction ? '.allthemail.io' : undefined,
  });
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
