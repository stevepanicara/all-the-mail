import React from 'react';
import { X, Paperclip } from 'lucide-react';
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
}) => {
  if (!composeOpen) return null;

  return (
    <div className="modal-overlay" onMouseDown={closeCompose}>
      <div className="modal" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ fontSize: '16px', fontWeight: 600 }}>
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
          {composeError && <div className="modal-error">{composeError}</div>}
          <div className="modal-hint">If send fails, you may need to reconnect the account with updated permissions.</div>
        </div>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={closeCompose} disabled={composeSending}>Cancel</button>
          <button className="btn btn-primary" onClick={sendCompose} disabled={composeSending} style={{ fontSize: '13px', padding: '10px 20px' }}>
            {composeSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComposeModal;
