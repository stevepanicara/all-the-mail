import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Minus, Maximize2, Paperclip, Clock, Image as ImageIcon } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// Match bare URLs in body. Matches http(s)://..., www...., and common TLDs.
// P2 — /u flag + \p{C} (control/format) exclusion. Without them, Unicode
// bidi marks like U+200F (RTL mark) or zero-width chars could hide inside
// the matched URL, letting a typed string "https://good.com<U+200F>.evil.com"
// be auto-linked to evil.com while visually reading as good.com.
const URL_REGEX = /((?:https?:\/\/|www\.)[^\s<>"'\p{C}]+[^\s<>"'\p{C}.,;:!?()])/giu;

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
  const imageInputRef = useRef(null);
  const quillRef = useRef(null);
  const lastAutoLinkAtRef = useRef(0);

  // Insert a local image inline as a base64 data URL at the current cursor position.
  const insertInlineImageFile = useCallback((file) => {
    if (!file || !file.type?.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const quill = quillRef.current?.getEditor?.();
      if (!quill) return;
      const range = quill.getSelection(true);
      quill.insertEmbed(range ? range.index : quill.getLength(), 'image', reader.result, 'user');
      quill.setSelection((range ? range.index : quill.getLength()) + 1, 0);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleImageButtonClick = useCallback(() => { imageInputRef.current?.click(); }, []);
  const handleImageFileChosen = useCallback((e) => {
    const f = e.target.files?.[0];
    if (f) insertInlineImageFile(f);
    e.target.value = '';
  }, [insertInlineImageFile]);

  // Quill image toolbar handler — open our file picker so images embed inline.
  useEffect(() => {
    const quill = quillRef.current?.getEditor?.();
    if (!quill) return;
    const toolbar = quill.getModule('toolbar');
    if (toolbar && typeof toolbar.addHandler === 'function') {
      toolbar.addHandler('image', handleImageButtonClick);
    }
  }, [handleImageButtonClick]);

  // Auto-linkify bare URLs as the user types. Runs shortly after each change,
  // debounced so we don't thrash on every keystroke. Skips ranges already linked.
  const handleEditorChange = useCallback((value, delta, source, editor) => {
    setComposeBody(value);
    if (source !== 'user') return;
    const now = Date.now();
    if (now - lastAutoLinkAtRef.current < 150) return;
    lastAutoLinkAtRef.current = now;
    try {
      const quill = quillRef.current?.getEditor?.();
      if (!quill) return;
      const text = quill.getText();
      const matches = [...text.matchAll(URL_REGEX)];
      if (!matches.length) return;
      const currentSelection = quill.getSelection();
      matches.forEach(m => {
        const start = m.index;
        const len = m[0].length;
        const href = m[0].startsWith('http') ? m[0] : `https://${m[0]}`;
        const existing = quill.getFormat(start, len);
        if (existing.link === href) return;
        quill.formatText(start, len, 'link', href, 'silent');
      });
      if (currentSelection) quill.setSelection(currentSelection.index, currentSelection.length, 'silent');
    } catch (_) {}
  }, [setComposeBody]);

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
              ref={quillRef}
              theme="snow"
              value={composeBody}
              onChange={handleEditorChange}
              placeholder="Write your message…"
              formats={[
                'header',
                'bold', 'italic', 'underline', 'strike',
                'color', 'background',
                'blockquote', 'code-block',
                'list', 'bullet', 'indent',
                'align',
                'link', 'image',
              ]}
              modules={{
                toolbar: [
                  [{ header: [1, 2, 3, false] }],
                  ['bold', 'italic', 'underline', 'strike'],
                  [{ color: [] }, { background: [] }],
                  [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
                  [{ align: [] }],
                  ['blockquote', 'code-block'],
                  ['link', 'image'],
                  ['clean'],
                ],
                clipboard: { matchVisual: false },
              }}
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
            </div>
            <div className="docked-footer-right">
              <input type="file" multiple onChange={handleFileSelect} ref={fileInputRef} style={{ display: 'none' }} />
              <input type="file" accept="image/*" onChange={handleImageFileChosen} ref={imageInputRef} style={{ display: 'none' }} />
              <button
                className="docked-toolbar-btn"
                onClick={handleImageButtonClick}
                title="Insert image inline"
                aria-label="Insert image inline"
                type="button"
              >
                <ImageIcon size={15} strokeWidth={1.5} />
              </button>
              <button
                className="docked-toolbar-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Attach files"
                aria-label="Attach files"
                type="button"
              >
                <Paperclip size={15} strokeWidth={1.5} />
              </button>
              <div className="docked-schedule-wrap">
                <button
                  className="docked-toolbar-btn docked-schedule-btn"
                  onClick={() => setSendLaterOpen(o => !o)}
                  disabled={composeSending}
                  title="Schedule send"
                  aria-label="Schedule send"
                  aria-expanded={sendLaterOpen}
                  type="button"
                >
                  <Clock size={15} strokeWidth={1.5} />
                </button>
                {sendLaterOpen && (
                  <div className="docked-send-later-popup">
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6 }}>Schedule send</div>
                    <input type="datetime-local"
                      style={{ width: '100%', padding: '6px 8px', fontSize: 'var(--text-xs)', background: 'var(--bg-0)', color: 'var(--text-0)', border: '1px solid var(--line-0)', borderRadius: 'var(--r-xs)' }}
                      min={new Date().toISOString().slice(0, 16)}
                      onChange={e => { if (e.target.value && scheduleSend) { scheduleSend(new Date(e.target.value)); setSendLaterOpen(false); } }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComposeModal;
