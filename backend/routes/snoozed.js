import { Router } from 'express';
import supabase from '../lib/supabase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// GET /snoozed
// Returns all active (not yet expired) snoozes for the current user.
// Expired rows are filtered server-side so clients don't need to re-check.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('snoozed_emails')
      .select('id, account_id, message_id, snooze_until')
      .eq('user_id', req.userId)
      .gt('snooze_until', new Date().toISOString())
      .order('snooze_until', { ascending: true });

    if (error) throw error;

    res.json({
      snoozes: data.map(r => ({
        id: r.id,
        accountId: r.account_id,
        messageId: r.message_id,
        snoozeUntil: r.snooze_until,
      })),
    });
  } catch (err) {
    console.error('GET /snoozed error:', err);
    res.status(500).json({ error: 'Failed to fetch snoozes' });
  }
});

// P1.11 — bounds + ownership.
const MAX_SNOOZE_PER_USER = 1000;
const MAX_FUTURE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

// POST /snoozed
// Upsert a snooze. If the same message was already snoozed, update
// snooze_until (re-snoozing is an update, not a conflict error).
router.post('/', authenticateToken, async (req, res) => {
  const { accountId, messageId, snoozeUntil } = req.body || {};
  if (!accountId || !messageId || !snoozeUntil) {
    return res.status(400).json({ error: 'accountId, messageId, and snoozeUntil are required' });
  }
  if (typeof accountId !== 'string' || typeof messageId !== 'string' || typeof snoozeUntil !== 'string') {
    return res.status(400).json({ error: 'invalid types' });
  }
  if (accountId.length > 64 || messageId.length > 128) {
    return res.status(400).json({ error: 'id too long' });
  }
  const t = Date.parse(snoozeUntil);
  if (Number.isNaN(t)) return res.status(400).json({ error: 'snoozeUntil must be ISO date' });
  const now = Date.now();
  if (t < now) return res.status(400).json({ error: 'snoozeUntil must be in the future' });
  if (t > now + MAX_FUTURE_MS) return res.status(400).json({ error: 'snoozeUntil cannot exceed 1 year' });

  try {
    // Ownership check on the account before any insert. Without this a user
    // could spam foreign account_ids and bloat their own quota with rows
    // they can't see (since GET filters by user_id).
    const { data: acct } = await supabase
      .from('gmail_accounts')
      .select('id')
      .eq('id', accountId)
      .eq('user_id', req.userId)
      .single();
    if (!acct) return res.status(404).json({ error: 'account_not_found' });

    // Cap rows per user.
    const { count } = await supabase
      .from('snoozed_emails')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.userId);
    if ((count || 0) >= MAX_SNOOZE_PER_USER) {
      return res.status(429).json({ error: 'snooze_cap', message: `Maximum ${MAX_SNOOZE_PER_USER} snoozed messages.` });
    }

    const { data, error } = await supabase
      .from('snoozed_emails')
      .upsert(
        { user_id: req.userId, account_id: accountId, message_id: messageId, snooze_until: new Date(t).toISOString() },
        { onConflict: 'user_id,account_id,message_id' }
      )
      .select('id')
      .single();

    if (error) throw error;
    res.json({ id: data.id });
  } catch (err) {
    console.error('POST /snoozed error:', err);
    res.status(500).json({ error: 'Failed to save snooze' });
  }
});

// DELETE /snoozed/:accountId/:messageId
// Called when a snooze expires on the client (60s check) or is manually
// cancelled. Failure is non-blocking — the row will just stay in the DB
// past its snooze_until date and be filtered out by the GET query.
router.delete('/:accountId/:messageId', authenticateToken, async (req, res) => {
  const { accountId, messageId } = req.params;
  try {
    const { error } = await supabase
      .from('snoozed_emails')
      .delete()
      .eq('user_id', req.userId)
      .eq('account_id', accountId)
      .eq('message_id', messageId);

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /snoozed error:', err);
    res.status(500).json({ error: 'Failed to delete snooze' });
  }
});

export default router;
