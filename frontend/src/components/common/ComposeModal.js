import React, { useState } from 'react';
import { X, Paperclip, Clock } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const ComposeModal = ({
  composeOpen, composeMode, composeSending, composeError,
  composeFromAccountId, setComposeFromAccountId,
  composeTo, setComposeTo,
  composeCc, setComposeCc,
  composeBcc, setComposeBcc,
  composeSubject, setComposeSubject,
  composeBody, setComposeBody,
  composeShowCcBcc, setComposeShowCcBcc,
  composeAttachments, handleFileSelect, removeAttachment,
  connectedAccounts,
  closeCompose, sendCompose,
  scheduleSend,
  saveDraft,
  includeSignature, setIncludeSignature,
}) => {
  const [sendLaterOpen, setSendLaterOpen] = useState(false);
  const [confirmingEmptySubject, setConfirmingEmptySubject] = useState(false);

  if (!composeOpen) return null;

  const handleSendClick = () => {
    if (!composeSubject.trim()) {
      setConfirmingEmptySubject(true);
      return;
    }
    sendCompose();
  };

  return (
    <div className="modal-overlay" onMouseDown={closeCompose}>
      <div className="modal" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            {composeMode === 'compose' ? 'New message' : composeMode === 'reply' ? 'Reply' : composeMode === 'replyAll' ? 'Reply all' : 'Forward'}
          </div>
          <button className="btn-ghost btn-icon" onClick={closeCompose} title="Close"><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="field-row">
            <label>From</label>
            <select value={composeFromAccountId} onChange={e => setComposeFromAccountId(e.target.value)}>
              {connectedAccounts.map(a => <option key={a.id} value={a.id}>{a.account_name} — {a.gmail_email}</option>)}
            </select>
          </div>
          <div className="field-row">
            <label>To</label>
            <input value={composeTo} onChange={e => setComposeTo(e.target.value)} placeholder="recipient@example.com" />
          </div>
          <div className="field-row-inline">
            <button className="btn-ghost" onClick={() => setComposeShowCcBcc(!composeShowCcBcc)} style={{ fontSize: '12px', padding: '5px 10px' }}>
              {composeShowCcBcc ? 'Hide Cc/Bcc' : 'Show Cc/Bcc'}
            </button>
          </div>
          {composeShowCcBcc && (
            <>
              <div className="field-row"><label>Cc</label><input value={composeCc} onChange={e => setComposeCc(e.target.value)} placeholder="cc@example.com" /></div>
              <div className="field-row"><label>Bcc</label><input value={composeBcc} onChange={e => setComposeBcc(e.target.value)} placeholder="bcc@example.com" /></div>
            </>
          )}
          <div className="field-row">
            <label>Subject</label>
            <input value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Subject" />
          </div>
          <div className="field-row">
            <label>Message</label>
            <ReactQuill theme="snow" value={composeBody} onChange={setComposeBody} placeholder="Write your message..."
              modules={{ toolbar: [['bold','italic','underline','strike'],['link'],[{'list':'ordered'},{'list':'bullet'}],['clean']] }}
              style={{ height: '200px', marginBottom: '60px' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
            <div />
            <div>
              <input type="file" multiple onChange={handleFileSelect} style={{ display: 'none' }} id="file-input" />
              <button type="button" className="btn-ghost" onClick={() => document.getElementById('file-input').click()} style={{ width: '100%', justifyContent: 'center' }}>
                <Paperclip size={14} /> Add attachments
              </button>
              {composeAttachments.length > 0 && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {composeAttachments.map((file, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Paperclip size={13} /><span style={{ fontSize: '13px' }}>{file.name}</span>
                        <span style={{ fontSize: '11px', opacity: 0.5 }}>({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button type="button" className="btn-ghost btn-icon" onClick={() => removeAttachment(idx)} title="Remove"><X size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {composeError && (
            <div className="compose-error-actionable">
              <div className="compose-error-message">
                <span className="compose-error-icon">⚠</span>
                <span>{composeError}</span>
              </div>
              <div className="compose-error-actions">
                <button className="btn-ghost" onClick={sendCompose}>Retry</button>
                <button className="btn-ghost" onClick={() => { if (saveDraft) { saveDraft(); } else { /* TODO: wire saveDraft */ } }}>Save as draft</button>
              </div>
            </div>
          )}
          {confirmingEmptySubject && (
            <div className="compose-warning">
              <span>Send without a subject?</span>
              <div className="compose-warning-actions">
                <button className="btn-ghost" onClick={() => setConfirmingEmptySubject(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => { setConfirmingEmptySubject(false); sendCompose(); }}>Send anyway</button>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
            <div className="modal-hint" style={{ margin: 0 }}>If send fails, you may need to reconnect the account with updated permissions.</div>
            {setIncludeSignature && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-3)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                <input type="checkbox" checked={includeSignature} onChange={e => setIncludeSignature(e.target.checked)}
                  style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
                Sent via All The Mail
              </label>
            )}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={closeCompose} disabled={composeSending}>Cancel</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <button className="btn-ghost" onClick={() => setSendLaterOpen(o => !o)} disabled={composeSending}>
                <Clock size={14} /> Send Later
              </button>
              {sendLaterOpen && (
                <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '4px', background: 'var(--bg-1)', border: '1px solid var(--line-0)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 100, padding: '12px', minWidth: '220px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '8px' }}>Schedule send</div>
                  <input type="datetime-local"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', background: 'var(--bg-0)', color: 'var(--text-0)', border: '1px solid var(--line-0)', borderRadius: '6px', outline: 'none' }}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={e => {
                      if (e.target.value && scheduleSend) {
                        scheduleSend(new Date(e.target.value));
                        setSendLaterOpen(false);
                      }
                    }}
                  />
                </div>
              )}
            </div>
            <button className="btn btn-primary" onClick={handleSendClick} disabled={composeSending}>
              {composeSending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComposeModal;
