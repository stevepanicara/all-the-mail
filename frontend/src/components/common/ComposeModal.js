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

// Compact draft-save indicator. Re-renders every 15 s (via a local
// counter) so the "Saved Xs ago" timestamp stays accurate while the
// user is in the middle of composing without retyping.
function DraftStatus({ state, lastSavedAt }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!lastSavedAt) return;
    const t = setInterval(() => setTick(x => x + 1), 15000);
    return () => clearInterval(t);
  }, [lastSavedAt]);

  if (state === 'idle' && !lastSavedAt) return null;

  let label;
  if (state === 'saving') {
    label = 'Saving…';
  } else if (lastSavedAt) {
    const ageS = Math.max(0, Math.round((Date.now() - lastSavedAt) / 1000));
    if (ageS < 5) label = 'Saved';
    else if (ageS < 60) label = `Saved ${ageS}s ago`;
    else label = `Saved ${Math.round(ageS / 60)}m ago`;
  } else return null;

  return (
    <span style={{ fontSize: 11, color: 'var(--text-3)', userSelect: 'none' }}>
      {label}
    </span>
  );
}

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
  draftSavingState = 'idle',
  draftLastSavedAt = null,
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
  // P1.13 — hard 5 MB cap to keep the editor responsive and the outgoing
  // request small. Larger images should ride as attachments, not inline base64
  // (base64 inflates by 33%; Gmail may strip oversize inline images anyway).
  // P1.13 — also re-validate the magic bytes since file.type is client-reported
  // and trivially spoofed (renaming malware.exe to .png passes the type check).
  const INLINE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
  const IMAGE_MAGIC = [
    [0x89, 0x50, 0x4e, 0x47],            // PNG
    [0xff, 0xd8, 0xff],                   // JPEG
    [0x47, 0x49, 0x46, 0x38],             // GIF
    [0x52, 0x49, 0x46, 0x46],             // RIFF (WebP container; further check below)
    [0x3c, 0x73, 0x76, 0x67],             // <svg
    [0x3c, 0x3f, 0x78, 0x6d, 0x6c],       // <?xml (SVG also valid)
  ];
  function looksLikeImage(bytes) {
    return IMAGE_MAGIC.some(sig => sig.every((b, i) => bytes[i] === b));
  }
  const insertInlineImageFile = useCallback((file) => {
    if (!file || !file.type?.startsWith('image/')) return;
    if (file.size > INLINE_IMAGE_MAX_BYTES) {
      try { window.alert('Image too large for inline insert (max 5 MB). Attach it instead.'); } catch (_) {}
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const quill = quillRef.current?.getEditor?.();
      if (!quill) return;
      // Check magic bytes — file.type is client-reported and not trustworthy.
      try {
        const dataUrl = reader.result || '';
        const b64 = String(dataUrl).split(',')[1] || '';
        const head = atob(b64.slice(0, 16));
        const bytes = Array.from(head).map(c => c.charCodeAt(0));
        if (!looksLikeImage(bytes)) {
          try { window.alert('That file is not a valid image.'); } catch (_) {}
          return;
        }
      } catch (_) { return; }
      const range = quill.getSelection(true);
      quill.insertEmbed(range ? range.index : quill.getLength(), 'image', reader.result, 'user');
      quill.setSelection((range ? range.index : quill.getLength()) + 1, 0);
    };
    reader.readAsDataURL(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <div className="docked-footer-left" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="btn btn-primary docked-send-btn" onClick={handleSendClick} disabled={composeSending}>
                {composeSending ? 'Sending…' : 'Send'}
              </button>
              {/* Auto-save status. "saving" only flashes briefly during
                  the in-flight POST; "saved" persists with a relative
                  timestamp until the next save. The label is intentionally
                  small + low-contrast — users want to know it's working,
                  not have it competing with the Send button. */}
              <DraftStatus state={draftSavingState} lastSavedAt={draftLastSavedAt} />
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
