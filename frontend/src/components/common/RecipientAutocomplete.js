import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';

// Autocomplete input for compose To/Cc/Bcc fields. Behaves like a normal
// text input but pops a suggestion dropdown filtered by what the user is
// typing (matched against name + email, case-insensitive). Keyboard nav:
// ArrowDown/Up cycles, Enter accepts, Escape closes, Tab accepts and
// advances to the next field.
//
// The value is the same comma-separated string the existing inputs used,
// so swapping in this component is drop-in: same value/onChange contract.
//
// Filtering anchors on the LAST token in the input — typing "alice@x,
// bo" matches contacts starting with "bo," not contacts that contain
// "alice." Accepting a suggestion replaces just the active token,
// preserving the prior comma-separated entries.

function lastToken(value) {
  const trimmed = String(value || '');
  const lastComma = trimmed.lastIndexOf(',');
  return lastComma === -1 ? trimmed : trimmed.slice(lastComma + 1);
}

function replaceLastToken(value, replacement) {
  const trimmed = String(value || '');
  const lastComma = trimmed.lastIndexOf(',');
  const prefix = lastComma === -1 ? '' : trimmed.slice(0, lastComma + 1);
  // Add a trailing ", " after accepting so the user can keep typing the
  // next recipient without having to type the separator themselves.
  return `${prefix}${prefix ? ' ' : ''}${replacement}, `;
}

const MAX_SUGGESTIONS = 8;

const RecipientAutocomplete = ({
  value,
  onChange,
  contacts,
  placeholder,
  className,
  onBlur,
  inputRef: externalInputRef,
}) => {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const internalInputRef = useRef(null);
  const inputRef = externalInputRef || internalInputRef;
  const containerRef = useRef(null);

  const queryRaw = lastToken(value);
  const query = queryRaw.trim().toLowerCase();

  const suggestions = useMemo(() => {
    if (!contacts || contacts.length === 0) return [];
    if (!query) {
      // Empty query (e.g., user just focused) — show top-frequency contacts
      return contacts.slice(0, MAX_SUGGESTIONS);
    }
    const matches = [];
    for (const c of contacts) {
      const inEmail = c.email.toLowerCase().includes(query);
      const inName = (c.name || '').toLowerCase().includes(query);
      if (inEmail || inName) matches.push(c);
      if (matches.length >= MAX_SUGGESTIONS) break;
    }
    return matches;
  }, [contacts, query]);

  // Reset highlight when suggestions change so we don't point at a
  // missing index after filtering.
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Click-outside close
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const acceptSuggestion = useCallback((c) => {
    const formatted = c.name ? `"${c.name}" <${c.email}>` : c.email;
    const newValue = replaceLastToken(value, formatted);
    onChange(newValue);
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [value, onChange, inputRef]);

  const onKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      acceptSuggestion(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1 }}>
      <input
        ref={inputRef}
        className={className}
        value={value || ''}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 2,
            background: 'var(--bg-0)',
            border: '1px solid var(--line-0)',
            borderRadius: 'var(--r-xs, 6px)',
            boxShadow: '0 8px 24px rgba(0,0,0,.16)',
            maxHeight: 280,
            overflowY: 'auto',
            zIndex: 'var(--z-dropdown, 100)',
          }}
        >
          {suggestions.map((c, i) => (
            <div
              key={c.email}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={(e) => { e.preventDefault(); acceptSuggestion(c); }}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                padding: '6px 10px',
                cursor: 'pointer',
                background: i === activeIdx ? 'var(--bg-1, #f5f5f0)' : 'transparent',
                fontSize: 13,
                lineHeight: 1.35,
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--line-0)' : 'none',
              }}
            >
              {c.name ? (
                <>
                  <span style={{ color: 'var(--text-0)' }}>{c.name}</span>
                  <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>&lt;{c.email}&gt;</span>
                </>
              ) : (
                <span style={{ color: 'var(--text-0)' }}>{c.email}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecipientAutocomplete;
