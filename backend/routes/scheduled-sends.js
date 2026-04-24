import { Router } from 'express';
import supabase from '../lib/supabase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// P1.10 — bounds and per-user cap on pending scheduled sends.
const MAX_PENDING_PER_USER = 200;
const MIN_LEAD_MS = 60 * 1000;             // sendAt must be >= now + 60s
const MAX_LEAD_MS = 60 * 24 * 60 * 60 * 1000; // sendAt must be <= now + 60 days

// Strip CR/LF and clamp length on values that ride into MIME headers downstream.
function safeHeader(s) {
  return String(s ?? '').replace(/[\r\n\u0000-\u0008\u000B-\u001F\u007F]/g, '').slice(0, 2000);
}

function validateScheduledSend(body) {
  if (!body || typeof body !== 'object') return 'body required';
  const { payload, sendAt } = body;
  if (!payload || typeof payload !== 'object') return 'payload required';
  if (typeof sendAt !== 'string') return 'sendAt must be ISO string';

  const t = Date.parse(sendAt);
  if (Number.isNaN(t)) return 'sendAt must be a valid ISO date';
  const now = Date.now();
  if (t < now + MIN_LEAD_MS) return 'sendAt must be at least 60 seconds in the future';
  if (t > now + MAX_LEAD_MS) return 'sendAt cannot be more than 60 days out';

  // Required + length-capped string fields.
  if (typeof payload.to !== 'string' || !payload.to.trim()) return 'payload.to required';
  if (typeof payload.accountId !== 'string' || !payload.accountId) return 'payload.accountId required';

  // Reject control chars in any header-bound field. Sanitize and clamp inline.
  const cleaned = {
    accountId: String(payload.accountId).slice(0, 64),
    to:        safeHeader(payload.to),
    cc:        payload.cc ? safeHeader(payload.cc) : '',
    bcc:       payload.bcc ? safeHeader(payload.bcc) : '',
    subject:   safeHeader(payload.subject || ''),
    body:      typeof payload.body === 'string' ? payload.body.slice(0, 1024 * 1024) : '', // 1MB body cap
    threadId:  payload.threadId ? safeHeader(payload.threadId) : null,
  };
  return { ok: true, payload: cleaned, sendAtIso: new Date(t).toISOString() };
}

// GET /scheduled-sends?status=pending
// Returns all scheduled sends for the current user filtered by status.
// The payload JSONB is spread into the response object so the client
// gets a flat shape matching the existing localStorage format.
router.get('/', authenticateToken, async (req, res) => {
  const status = req.query.status || 'pending';
  try {
    const { data, error } = await supabase
      .from('scheduled_sends')
      .select('id, payload, send_at, status')
      .eq('user_id', req.userId)
      .eq('status', status)
      .order('send_at', { ascending: true });

    if (error) throw error;

    res.json({
      sends: data.map(r => ({
        id: r.id,
        ...r.payload,
        scheduledFor: r.send_at,
        status: r.status,
      })),
    });
  } catch (err) {
    console.error('GET /scheduled-sends error:', err);
    res.status(500).json({ error: 'Failed to fetch scheduled sends' });
  }
});

// POST /scheduled-sends
// Creates a new pending scheduled send. Returns the DB-assigned id
// so the client can tag the local entry for the CAS lock on execution.
router.post('/', authenticateToken, async (req, res) => {
  const v = validateScheduledSend(req.body);
  if (!v.ok) return res.status(400).json({ error: v });

  try {
    // P1.10 — verify the requested account belongs to this user before
    // queueing a send. Otherwise a user could schedule sends "from" any
    // account id they discover.
    const { data: acct } = await supabase
      .from('gmail_accounts')
      .select('id')
      .eq('id', v.payload.accountId)
      .eq('user_id', req.userId)
      .single();
    if (!acct) return res.status(404).json({ error: 'account_not_found' });

    // Cap pending count per user.
    const { count } = await supabase
      .from('scheduled_sends')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.userId)
      .eq('status', 'pending');
    if ((count || 0) >= MAX_PENDING_PER_USER) {
      return res.status(429).json({ error: 'pending_cap', message: `You have ${count} pending scheduled sends — maximum is ${MAX_PENDING_PER_USER}.` });
    }

    const { data, error } = await supabase
      .from('scheduled_sends')
      .insert({ user_id: req.userId, payload: v.payload, send_at: v.sendAtIso, status: 'pending' })
      .select('id')
      .single();

    if (error) throw error;
    res.json({ id: data.id });
  } catch (err) {
    console.error('POST /scheduled-sends error:', err);
    res.status(500).json({ error: 'Failed to create scheduled send' });
  }
});

// PATCH /scheduled-sends/:id
// Updates the status of a scheduled send.
//
// The pending → sending transition is a CAS (compare-and-swap):
// the UPDATE only succeeds if status is currently 'pending'. This
// prevents two browser tabs from both executing the same scheduled
// send. If the row was already claimed (status !== 'pending'), the
// query matches zero rows and we return 409 — the caller should skip.
//
// All other transitions (sending → sent, sending → failed, etc.)
// are unconditional updates scoped to user_id for safety.
router.patch('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status is required' });

  try {
    let query = supabase
      .from('scheduled_sends')
      .update({ status })
      .eq('id', id)
      .eq('user_id', req.userId)
      .select('id');

    // CAS: only claim if still pending
    if (status === 'sending') {
      query = supabase
        .from('scheduled_sends')
        .update({ status: 'sending' })
        .eq('id', id)
        .eq('user_id', req.userId)
        .eq('status', 'pending')
        .select('id');
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) {
      // Zero rows matched — already claimed by another tab or not found
      return res.status(409).json({ error: 'Send already claimed or not found' });
    }

    res.json({ updated: true, id: data[0].id });
  } catch (err) {
    console.error('PATCH /scheduled-sends error:', err);
    res.status(500).json({ error: 'Failed to update scheduled send' });
  }
});

export default router;
