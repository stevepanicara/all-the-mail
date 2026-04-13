import { Router } from 'express';
import supabase from '../lib/supabase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

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
  const { payload, sendAt } = req.body || {};
  if (!payload || !sendAt) {
    return res.status(400).json({ error: 'payload and sendAt are required' });
  }

  try {
    const { data, error } = await supabase
      .from('scheduled_sends')
      .insert({ user_id: req.userId, payload, send_at: sendAt, status: 'pending' })
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
