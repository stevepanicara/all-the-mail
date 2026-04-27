import { Router } from 'express';
import { google } from 'googleapis';
import supabase from '../lib/supabase.js';
import { getOAuth2ClientForAccount } from '../lib/google.js';
import { authenticateToken } from '../middleware/auth.js';
import { safeLogError } from '../lib/log.js';

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

// P0.4 — calendarId allowlist per (account, user). The patch / insert routes
// previously took req.body.calendarId verbatim and passed it to
// calendar.events.patch/insert. Combined with a known eventId, this let a
// user act on calendars outside the app's intent (shared work calendars,
// other people's calendars they have ACL on, etc.) — Google enforces
// account-level ACLs, but the *app* never restricted scope. Now: only
// 'primary' or an entry from this account's calendarList.list() is allowed.
const _calendarListCache = new Map(); // `${accountId}:${userId}` → { ids: Set, expiresAt }
const CALENDAR_LIST_TTL_MS = 5 * 60 * 1000;

async function resolveCalendarId(accountId, userId, requested, googleClient) {
  if (!requested || requested === 'primary') return 'primary';
  const cacheKey = `${accountId}:${userId}`;
  let entry = _calendarListCache.get(cacheKey);
  if (!entry || entry.expiresAt < Date.now()) {
    const calendar = google.calendar({ version: 'v3', auth: googleClient });
    const resp = await calendar.calendarList.list();
    const ids = new Set((resp.data.items || []).map(c => c.id));
    ids.add('primary');
    entry = { ids, expiresAt: Date.now() + CALENDAR_LIST_TTL_MS };
    _calendarListCache.set(cacheKey, entry);
  }
  if (!entry.ids.has(requested)) {
    const e = new Error('calendar_not_allowed');
    e.statusCode = 403;
    throw e;
  }
  return requested;
}

// Get calendar events
router.get('/:accountId/events', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { range } = req.query;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    if (!account.granted_scopes?.includes('cals')) {
      return res.status(403).json({ error: 'missing_scope', message: 'This account has not granted Calendar access', service: 'cals' });
    }

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
    const calendar = google.calendar({ version: 'v3', auth: client });

    const now = new Date();
    let timeMin = req.query.timeMin ? new Date(req.query.timeMin) : new Date(now);
    let timeMax = new Date(timeMin);
    if (range === 'today') {
      timeMax.setHours(23, 59, 59, 999);
    } else if (range === 'week') {
      timeMax.setDate(timeMax.getDate() + 7);
    } else if (range === '4day') {
      timeMax.setDate(timeMax.getDate() + 4);
    } else if (range === 'month') {
      timeMax.setMonth(timeMax.getMonth() + 1);
    } else if (range === 'year') {
      timeMax.setFullYear(timeMax.getFullYear() + 1);
    } else {
      timeMax.setDate(timeMax.getDate() + 30);
    }

    const calListResponse = await calendar.calendarList.list();
    const calendars = (calListResponse.data.items || []).filter(c => !c.deleted);

    const allEventArrays = await Promise.all(
      calendars.map(async (cal) => {
        try {
          const resp = await calendar.events.list({
            calendarId: cal.id,
            timeMin: timeMin.toISOString(),
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
          // P3 — log calendar id (identifier), not summary (user-facing name,
          // may be PII: "Chemotherapy", "AA meetings", "Legal — divorce").
          safeLogError('cals events fetch one', err, { calendarId: cal.id });
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

      const today = new Date(); today.setHours(0,0,0,0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const eventDay = new Date(startDate); eventDay.setHours(0,0,0,0);
      let day;
      if (eventDay.getTime() === today.getTime()) day = 'Today';
      else if (eventDay.getTime() === tomorrow.getTime()) day = 'Tomorrow';
      else day = startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

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

// Patch event
router.patch('/:accountId/events/:eventId', authenticateToken, async (req, res) => {
  try {
    const { accountId, eventId } = req.params;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

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

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
    const calendar = google.calendar({ version: 'v3', auth: client });
    const patchCalendarId = await resolveCalendarId(accountId, req.userId, req.body.calendarId, client);

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
    if (error?.message === 'calendar_not_allowed') {
      return res.status(403).json({ error: 'calendar_not_allowed', message: 'That calendar is not on your allowed list for this account.' });
    }
    if (error?.code === 403 || error?.response?.status === 403) {
      return res.status(403).json({ error: 'missing_scope', message: 'Calendar permissions not granted. Please reconnect this account.', service: 'cals' });
    }
    if (error?.code === 401 || error?.response?.status === 401) {
      return res.status(401).json({ error: 'invalid_token', message: 'Token expired or revoked. Please reconnect this account.' });
    }
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Create event
router.post('/:accountId/events', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    if (!account.granted_scopes?.includes('cals')) {
      return res.status(403).json({ error: 'missing_scope', message: 'This account has not granted Calendar access', service: 'cals' });
    }

    const ALLOWED_FIELDS = ['summary', 'description', 'location', 'start', 'end'];
    const eventBody = {};
    for (const key of ALLOWED_FIELDS) {
      if (req.body[key] !== undefined) {
        eventBody[key] = req.body[key];
      }
    }

    if (!eventBody.summary) {
      return res.status(400).json({ error: 'Event title is required' });
    }

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
    const calendar = google.calendar({ version: 'v3', auth: client });
    const calendarId = await resolveCalendarId(accountId, req.userId, req.body.calendarId, client);

    const response = await calendar.events.insert({
      calendarId,
      requestBody: eventBody,
    });

    const ev = response.data;
    const start = ev.start?.dateTime || ev.start?.date;
    const end = ev.end?.dateTime || ev.end?.date;

    res.status(201).json({
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
    console.error('Create calendar event error:', error?.message || error);
    if (error?.message === 'calendar_not_allowed') {
      return res.status(403).json({ error: 'calendar_not_allowed', message: 'That calendar is not on your allowed list for this account.' });
    }
    if (error?.code === 403 || error?.response?.status === 403) {
      return res.status(403).json({ error: 'missing_scope', message: 'Calendar permissions not granted. Please reconnect this account.', service: 'cals' });
    }
    if (error?.code === 401 || error?.response?.status === 401) {
      return res.status(401).json({ error: 'invalid_token', message: 'Token expired or revoked. Please reconnect this account.' });
    }
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// List calendars
router.get('/:accountId/calendars', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await verifyAccountOwnership(accountId, req.userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    if (!account.granted_scopes?.includes('cals')) {
      return res.status(403).json({ error: 'missing_scope', message: 'This account has not granted Calendar access', service: 'cals' });
    }

    const client = await getOAuth2ClientForAccount(accountId, req.userId);
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

export default router;
