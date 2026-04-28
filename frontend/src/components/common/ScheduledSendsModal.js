import React, { useState, useEffect } from 'react';
import { X, Clock, Trash2 } from 'lucide-react';
import { API_BASE } from '../../utils/constants';
import { stripName } from '../../utils/helpers';

// Modal listing all pending scheduled sends. Each row shows recipient,
// subject, scheduled time, owning account, and a Cancel action that
// deletes both the local entry and the Supabase row (if any).
//
// Reads scheduledSends from props (App.js owns it). Cancel calls back
// into App.js's removal callback so the list re-renders without us
// needing to duplicate state here.

function formatRel(scheduledFor) {
  if (!scheduledFor) return '';
  const t = new Date(scheduledFor).getTime();
  const now = Date.now();
  const diffMin = Math.round((t - now) / 60000);
  if (diffMin < 1) return 'in <1m';
  if (diffMin < 60) return `in ${diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `in ${diffHr}h`;
  const diffD = Math.round(diffHr / 24);
  return `in ${diffD}d`;
}

function formatAbs(scheduledFor) {
  if (!scheduledFor) return '';
  return new Date(scheduledFor).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

const ScheduledSendsModal = ({ open, onClose, scheduledSends, connectedAccounts, onCancelSend }) => {
  // Tick every 30s so the relative-time labels stay current.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setTick(x => x + 1), 30000);
    return () => clearInterval(t);
  }, [open]);

  if (!open) return null;

  const pending = (scheduledSends || []).filter(s => !s.status || s.status === 'pending');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', width: '100%' }}>
        <div className="modal-header">
          <span className="modal-header-title">Scheduled emails</span>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ padding: '16px 0', maxHeight: '60vh', overflowY: 'auto' }}>
          {pending.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
              <Clock size={32} strokeWidth={1.5} style={{ margin: '0 auto 12px', opacity: 0.4, display: 'block' }} />
              <div style={{ fontSize: 13 }}>No emails scheduled</div>
            </div>
          ) : (
            pending.map((s) => {
              const account = connectedAccounts.find(a => a.id === s.accountId);
              const accountLabel = account?.account_name || account?.gmail_email || s.accountId;
              return (
                <div key={s.id || `${s.accountId}-${s.scheduledFor}`} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 24px',
                  borderBottom: '1px solid var(--line-0)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                        {s.subject || '(no subject)'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 2 }}>
                      To: {stripName(s.to || '') || '(no recipient)'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      <Clock size={10} strokeWidth={1.5} style={{ verticalAlign: '-1px', marginRight: 3 }} />
                      {formatRel(s.scheduledFor)} · {formatAbs(s.scheduledFor)} · {accountLabel}
                    </div>
                  </div>
                  <button
                    className="btn-ghost danger"
                    onClick={() => onCancelSend(s)}
                    title="Cancel scheduled send"
                    style={{ padding: '4px 8px', fontSize: 11, flexShrink: 0 }}
                  >
                    <Trash2 size={11} strokeWidth={1.5} /> Cancel
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduledSendsModal;
