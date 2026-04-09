import React, { useState, useRef, useCallback } from 'react';
import { X, Minus, Maximize2, Paperclip, ChevronDown } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

/**
 * Docked compose panel — Phase 7.
 * Renders as a floating panel docked bottom-right (not a modal overlay).
 * States: 'full' | 'minimized'
 */
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
  const [panelState, setPanelState] = useState('full'); // 'full' | 'minimized'
  const [sendLaterOpen, setSendLaterOpen] = useState(false);
  const [confirmingEmptySubject, setConfirmingEmptySubject] = useState(false);
  const [toError, setToError] = useState(false);
  const fileInputRef = useRef(null);

  const validateTo = useCallback((val) => {
    const addresses = (val || '').split(',').map(s => s.trim()).filter(Boolean);
    if (addresses.length === 0) { setToError(false); return; }
    setToError(addresses.some(a => !a.includes('@') || a.endsWith('@')));
  }, []);

  if (!composeOpen) return null;

  const handleSendClick = () => {
    if (!composeSubject.trim()) {
      setConfirmingEmptySubject(true);
      return;
    }
    sendCompose();
  };

  const title = composeMode === 'compose' ? 'New Message'
    : composeMode === 'reply' ? 'Reply'
    : composeMode === 'replyAll' ? 'Reply All'
    : 'Forward';

  const isMinimized = panelState === 'minimized';

  return (
    <div className="docked-compose" data-state={panelState}>
      {/* Header — always visible */}
      <div className="docked-compose-header" onClick={() => isMinimized && setPanelState('full')}>
        <span className="docked-compose-title">{title}</span>
        <div className="docked-compose-controls" onClick={e => e.stopPropagation()}>
          <button
            className="docked-compose-ctrl"
            title={isMinimized ? 'Expand' : 'Minimize'}
            onClick={() => setPanelState(isMinimized ? 'full' : 'minimized')}
          >
            {isMinimized ? <Maximize2 size={13} strokeWidth={1.5} /> : <Minus size={13} strokeWidth={1.5} />}
          </button>
          <button className="docked-compose-ctrl" title="Close" onClick={closeCompose}>
            <X size={13} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Body — hidden when minimized */}
      {!isMinimized && (
        <div className="docked-compose-body">
          {/* From selector */}
          <div className="docked-field-row">
            <select
              className="docked-from-select"
              value={composeFromAccountId}
              onChange={e => setComposeFromAccountId(e.target.value)}
            >
              {connectedAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.account_name || a.gmail_email} &lt;{a.gmail_email}&gt;</option>
              ))}
            </select>
          </div>

          {/* To */}
          <div className="docked-field-row">
            <span className="docked-field-label">To</span>
            <div style={{ flex: 1 }}>
              <input
                className="docked-field-input"
                value={composeTo}
                onChange={e => { setComposeTo(e.target.value); if (toError) validateTo(e.target.value); }}
                onBlur={() => validateTo(composeTo)}
                placeholder="Recipients"
              />
              {toError && <span style={{ color: 'var(--danger)', fontSize: '11px' }}>Check email addresses</span>}
            </div>
            {!composeShowCcBcc && (
              <button className="docked-cc-toggle" onClick={() => setComposeShowCcBcc(true)}>Cc Bcc</button>
            )}
          </div>

          {/* Cc / Bcc */}
          {composeShowCcBcc && (
            <>
              <div className="docked-field-row">
                <span className="docked-field-label">Cc</span>
                <input className="docked-field-input" value={composeCc} onChange={e => setComposeCc(e.target.value)} placeholder="Cc" />
              </div>
              <div className="docked-field-row">
                <span className="docked-field-label">Bcc</span>
                <input className="docked-field-input" value={composeBcc} onChange={e => setComposeBcc(e.target.value)} placeholder="Bcc" />
              </div>
            </>
          )}

          {/* Subject */}
          <div className="docked-field-row">
            <input
              className="docked-field-input docked-subject-input"
              value={composeSubject}
              onChange={e => setComposeSubject(e.target.value)}
              placeholder="Subject"
            />
          </div>

          {/* Body */}
          <div className="docked-compose-editor">
            <ReactQuill
              theme="snow"
              value={composeBody}
              onChange={setComposeBody}
              placeholder="Write your message…"
              modules={{ toolbar: [['bold','italic','underline'],['link'],[{'list':'bullet'}],['clean']] }}
            />
          </div>

          {/* Attachments */}
          {composeAttachments.length > 0 && (
            <div className="docked-attachments">
              {composeAttachments.map((file, idx) => (
                <div key={idx} className="docked-attachment-chip">
                  <Paperclip size={11} strokeWidth={1.5} />
                  <span>{file.name}</span>
                  <button onClick={() => removeAttachment(idx)}><X size={11} /></button>
                </div>
              ))}
            </div>
          )}

          {/* Errors / warnings */}
          {composeError && (
            <div className="docked-error">
              <span>⚠ {composeError}</span>
              <button className="btn-ghost" style={{ fontSize: 11 }} onClick={sendCompose}>Retry</button>
            </div>
          )}
          {confirmingEmptySubject && (
            <div className="docked-error">
              <span>Send without subject?</span>
              <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setConfirmingEmptySubject(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ fontSize: 11 }} onClick={() => { setConfirmingEmptySubject(false); sendCompose(); }}>Send</button>
            </div>
          )}

          {/* Footer toolbar */}
          <div className="docked-compose-footer">
            <div className="docked-footer-left">
              <button className="btn btn-primary docked-send-btn" onClick={handleSendClick} disabled={composeSending}>
                {composeSending ? 'Sending…' : 'Send'}
              </button>
              <button className="docked-send-later" onClick={() => setSendLaterOpen(o => !o)} disabled={composeSending} title="Schedule send">
                <ChevronDown size={13} strokeWidth={1.5} />
              </button>
              {sendLaterOpen && (
                <div className="docked-send-later-popup">
                  <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6 }}>Schedule send</div>
                  <input type="datetime-local"
                    style={{ width: '100%', padding: '6px 8px', fontSize: 12, background: 'var(--bg-0)', color: 'var(--text-0)', border: '1px solid var(--line-0)', borderRadius: 6 }}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={e => { if (e.target.value && scheduleSend) { scheduleSend(new Date(e.target.value)); setSendLaterOpen(false); } }}
                  />
                </div>
              )}
            </div>
            <div className="docked-footer-right">
              <input type="file" multiple onChange={handleFileSelect} ref={fileInputRef} style={{ display: 'none' }} />
              <button className="docked-toolbar-btn" onClick={() => fileInputRef.current?.click()} title="Attach files">
                <Paperclip size={15} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComposeModal;
