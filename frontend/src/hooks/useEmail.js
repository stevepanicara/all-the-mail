import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { API_BASE } from '../utils/constants';
import { stripName } from '../utils/helpers';

export function useEmail({
  connectedAccounts,
  activeView,
  activeCategory,
  searchQuery,
  conversationView,
  sendDelaySeconds,
  setSuccessToast,
  setError,
  setIsAuthed,
  handleLogout,
  splitMode,
  setFullPageReaderOpen,
  setShowMetadata,
  setReaderCompact,
}) {
  const [emails, setEmails] = useState({});
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [selectedThread, setSelectedThread] = useState(null);
  const [, setSelectedThreadActiveMessageId] = useState(null);

  const [emailBodies, setEmailBodies] = useState({});
  const [emailHeaders, setEmailHeaders] = useState({});
  const emailBodiesRef = useRef({});
  const emailHeadersRef = useRef({});

  const [emailAttachments, setEmailAttachments] = useState({});
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [isLoadingBody, setIsLoadingBody] = useState(false);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [emailLoadError, setEmailLoadError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [batchWorking, setBatchWorking] = useState(false);
  const [starredOverrides, setStarredOverrides] = useState({});
  const [snoozedEmails, setSnoozedEmails] = useState(() => JSON.parse(localStorage.getItem('atm_snoozed') || '{}'));
  const [snoozeDropdownEmailId, setSnoozeDropdownEmailId] = useState(null);
  const [collapsedMsgIds, setCollapsedMsgIds] = useState(new Set());
  const [threadExpanded, setThreadExpanded] = useState(false);
  const [expandedBodies, setExpandedBodies] = useState({});

  // Keep refs in sync
  useEffect(() => { emailBodiesRef.current = emailBodies; }, [emailBodies]);
  useEffect(() => { emailHeadersRef.current = emailHeaders; }, [emailHeaders]);

  // Persist snoozed emails to localStorage (write-through cache for offline support)
  useEffect(() => { localStorage.setItem('atm_snoozed', JSON.stringify(snoozedEmails)); }, [snoozedEmails]);

  // Check snoozed emails every 60 seconds; delete expired entries from Supabase
  useEffect(() => {
    const checkSnoozed = () => {
      const now = Date.now();
      setSnoozedEmails(prev => {
        const updated = { ...prev };
        let changed = false;
        for (const key of Object.keys(updated)) {
          if (new Date(updated[key].until).getTime() <= now) {
            // Fire-and-forget cleanup in Supabase
            const { accountId, emailId } = updated[key];
            if (accountId && emailId) {
              fetch(`${API_BASE}/snoozed/${accountId}/${emailId}`, {
                method: 'DELETE', credentials: 'include',
              }).catch(() => {});
            }
            delete updated[key];
            changed = true;
          }
        }
        return changed ? updated : prev;
      });
    };
    checkSnoozed();
    const interval = setInterval(checkSnoozed, 60000);
    return () => clearInterval(interval);
  }, []);

  // syncSnoozed: called once on boot from App.js after accounts load.
  // Fetches Supabase state, merges with localStorage (Supabase wins on conflict),
  // and backfills any localStorage-only entries up to Supabase.
  // Fails silently — localStorage continues to work if the request fails.
  const syncSnoozed = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/snoozed`, { credentials: 'include' });
      if (!r.ok) return;
      const { snoozes } = await r.json();

      const localMap = JSON.parse(localStorage.getItem('atm_snoozed') || '{}');
      const dbKeys = new Set(snoozes.map(s => `${s.accountId}_${s.messageId}`));

      // Backfill: local entries not in Supabase (fire-and-forget)
      Object.entries(localMap).forEach(([key, val]) => {
        if (!dbKeys.has(key)) {
          fetch(`${API_BASE}/snoozed`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId: val.accountId, messageId: val.emailId, snoozeUntil: val.until }),
          }).catch(() => {});
        }
      });

      // Merge: Supabase wins on conflict
      const merged = { ...localMap };
      snoozes.forEach(s => {
        merged[`${s.accountId}_${s.messageId}`] = {
          emailId: s.messageId,
          accountId: s.accountId,
          until: s.snoozeUntil,
        };
      });

      setSnoozedEmails(merged);
    } catch (err) {
      console.error('syncSnoozed error:', err);
    }
  }, []);

  const loadEmailsForAccount = useCallback(async (accountId, category = null) => {
    const cats = category ? [category] : ['primary', 'social', 'promotions', 'sent', 'drafts', 'trash'];
    setIsLoadingEmails(true);
    for (const cat of cats) {
      try {
        const r = await fetch(`${API_BASE}/emails/${accountId}?category=${cat}&maxResults=50`, { credentials: 'include' });
        if (r.ok) {
          setIsAuthed(true);
          const d = await r.json();
          setEmails(p => ({ ...p, [accountId]: { ...(p[accountId] || {}), [cat]: d.emails || [] } }));
          setEmailLoadError(null);
        } else if (r.status === 401) {
          setIsAuthed(false);
          setEmails({});
          setSelectedEmail(null);
          setSelectedThread(null);
          setSelectedThreadActiveMessageId(null);
          setEmailBodies({});
          setEmailHeaders({});
          setEditMode(false);
          setSelectedIds(new Set());
          return;
        } else {
          setEmailLoadError({ accountId, category: cat });
        }
      } catch (err) {
        console.error('Error loading emails:', err);
        setEmailLoadError({ accountId, category: cat });
      }
    }
    setIsLoadingEmails(false);
  }, [setIsAuthed]);

  const loadEmailDetails = useCallback(async (email) => {
    if (!email?.id) return;
    const eid = email.id;
    if (emailBodiesRef.current[eid] && emailHeadersRef.current[eid]) return;
    setIsLoadingBody(true);
    try {
      const aid = email.accountId || connectedAccounts[0]?.id;
      if (!aid) return;
      const r = await fetch(`${API_BASE}/emails/${aid}/${eid}`, { credentials: 'include' });
      if (r.ok) {
        setIsAuthed(true);
        const d = await r.json();
        setEmailBodies(p => { const u = { ...p, [eid]: d.body }; const k = Object.keys(u); if (k.length > 100) k.slice(0, k.length - 100).forEach(x => delete u[x]); return u; });
        if (d.headers) setEmailHeaders(p => { const u = { ...p, [eid]: d.headers }; const k = Object.keys(u); if (k.length > 100) k.slice(0, k.length - 100).forEach(x => delete u[x]); return u; });
        if (d.attachments) setEmailAttachments(p => { const u = { ...p, [eid]: d.attachments }; const k = Object.keys(u); if (k.length > 100) k.slice(0, k.length - 100).forEach(x => delete u[x]); return u; });
        if (!email.isRead) {
          setEmails(p => { const n = { ...p }; Object.keys(n).forEach(ai => { Object.keys(n[ai]).forEach(c => { if (n[ai][c]) n[ai][c] = n[ai][c].map(e => e.id === eid ? { ...e, isRead: true } : e); }); }); return n; });
          fetch(`${API_BASE}/emails/${aid}/${eid}/read`, { method: 'POST', credentials: 'include' }).catch(() => {});
        }
      } else if (r.status === 401) {
        setIsAuthed(false);
        setEmails({});
        setSelectedEmail(null);
        setSelectedThread(null);
        setSelectedThreadActiveMessageId(null);
        setEmailBodies({});
        setEmailHeaders({});
        setEditMode(false);
        setSelectedIds(new Set());
        return;
      }
    } catch (err) { console.error('Error loading email body:', err); }
    finally { setIsLoadingBody(false); }
  }, [connectedAccounts, setIsAuthed]);

  const downloadAttachment = useCallback(async (accountId, messageId, attachmentId, filename, mimeType) => {
    try {
      const r = await fetch(`${API_BASE}/emails/${accountId}/${messageId}/attachments/${attachmentId}?filename=${encodeURIComponent(filename)}&mimeType=${encodeURIComponent(mimeType)}`, { credentials: 'include' });
      if (r.ok) {
        const b = await r.blob();
        const u = window.URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = u; a.download = filename;
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(u); document.body.removeChild(a);
      } else {
        setError('Failed to download attachment');
      }
    } catch (err) { console.error('Download error:', err); setError('Failed to download attachment'); }
  }, [setError]);

  const loadThread = useCallback(async (email) => {
    if (!email?.threadId || !email?.accountId) { setSelectedThread(null); setSelectedThreadActiveMessageId(null); return; }
    setIsLoadingThread(true);
    setCollapsedMsgIds(new Set());
    setThreadExpanded(false);
    try {
      const r = await fetch(`${API_BASE}/emails/${email.accountId}/${email.threadId}/thread`, { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        const msgs = d.messages || [];
        setSelectedThread({ threadId: email.threadId, messages: msgs });
        if (msgs.length > 1) {
          const last = msgs[msgs.length - 1];
          setSelectedThreadActiveMessageId(last.id);
          const obj = { id: last.id, threadId: last.threadId, subject: last.subject || email.subject, from: last.from || email.from, date: last.date || email.date, snippet: last.snippet || '', accountId: email.accountId, accountName: email.accountName, source: email.source };
          setSelectedEmail(obj);
          loadEmailDetails(obj);
        } else {
          setSelectedThreadActiveMessageId(email.id);
        }
      } else if (r.status === 401) {
        handleLogout();
      } else {
        setSelectedThread(null);
        setSelectedThreadActiveMessageId(null);
      }
    } catch (err) { console.error('Thread error:', err); setSelectedThread(null); setSelectedThreadActiveMessageId(null); }
    finally { setIsLoadingThread(false); }
  }, [handleLogout, loadEmailDetails]);

  const getCurrentEmails = useCallback(() => {
    let list;
    if (activeView === 'everything') {
      const all = [];
      connectedAccounts.forEach(a => { const ae = emails[a.id]?.[activeCategory] || []; all.push(...ae.map(e => ({ ...e, accountId: a.id }))); });
      list = all.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else {
      list = emails[activeView]?.[activeCategory] || [];
    }

    if (!conversationView) return list;

    const threadMap = new Map();
    for (const email of list) {
      const tid = email.threadId || email.id;
      if (!threadMap.has(tid)) {
        threadMap.set(tid, { emails: [], newest: email });
      }
      const entry = threadMap.get(tid);
      entry.emails.push(email);
      if (new Date(email.date) > new Date(entry.newest.date)) {
        entry.newest = email;
      }
    }

    const grouped = [];
    for (const [, entry] of threadMap) {
      const { newest, emails: threadEmails } = entry;
      const participants = [...new Set(threadEmails.map(e => stripName(e.from || '')))];
      const hasUnread = threadEmails.some(e => !e.isRead);
      grouped.push({
        ...newest,
        threadCount: threadEmails.length,
        threadParticipants: participants,
        threadMessageIds: threadEmails.map(e => e.id),
        isRead: !hasUnread,
      });
    }

    return grouped.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [activeView, activeCategory, connectedAccounts, emails, conversationView]);

  const filteredEmails = useMemo(() => {
    const isSnoozed = e => snoozedEmails[`${e.accountId || ''}_${e.id}`];
    if (!searchQuery) {
      return getCurrentEmails().filter(e => !isSnoozed(e));
    }
    const q = searchQuery.toLowerCase();
    const matchFn = e => (e.subject || '').toLowerCase().includes(q) || (e.from || '').toLowerCase().includes(q) || (e.snippet || '').toLowerCase().includes(q);
    const all = [];
    connectedAccounts.forEach(a => {
      Object.values(emails[a.id] || {}).forEach(catEmails => {
        (catEmails || []).forEach(e => {
          if (matchFn(e)) all.push({ ...e, accountId: a.id });
        });
      });
    });
    const seen = new Set();
    return all.filter(e => { if (seen.has(e.id) || isSnoozed(e)) return false; seen.add(e.id); return true; })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [getCurrentEmails, searchQuery, snoozedEmails, connectedAccounts, emails]);

  const allEmails = useMemo(() => {
    const all = [];
    connectedAccounts.forEach(a => {
      const ae = emails[a.id]?.primary || [];
      all.push(...ae.map(e => ({ ...e, accountId: a.id })));
    });
    return all.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [connectedAccounts, emails]);

  const categoryCounts = useMemo(() => {
    const c = { primary: 0, social: 0, promotions: 0, sent: 0, drafts: 0, trash: 0 };
    connectedAccounts.forEach(a => { const ac = emails[a.id] || {}; c.primary += ac.primary?.length || 0; c.social += ac.social?.length || 0; c.promotions += ac.promotions?.length || 0; c.sent += ac.sent?.length || 0; c.drafts += ac.drafts?.length || 0; c.trash += ac.trash?.length || 0; });
    return c;
  }, [emails, connectedAccounts]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const toggleSelectId = useCallback((id) => { setSelectedIds(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }, []);
  const selectAllVisible = useCallback(() => { setSelectedIds(() => new Set(filteredEmails.map(e => e.id))); }, [filteredEmails]);

  const groupSelectedByAccount = useCallback(() => {
    const m = new Map();
    for (const e of filteredEmails) {
      if (!selectedIds.has(e.id)) continue;
      const a = e.accountId; if (!a) continue;
      if (!m.has(a)) m.set(a, []);
      m.get(a).push(e.id);
    }
    return m;
  }, [filteredEmails, selectedIds]);

  const removeEmailIds = useCallback((aid, ids) => {
    setEmails(p => { const c = { ...p }; const cats = c[aid] || {}; const u = {}; for (const k of Object.keys(cats)) { u[k] = (cats[k] || []).filter(e => !ids.includes(e.id)); } c[aid] = u; return c; });
  }, []);

  const trashEmail = useCallback((email) => {
    if (!email?.id || !email?.accountId) return;
    const snapshot = { ...emails };
    removeEmailIds(email.accountId, [email.id]);
    if (selectedEmail?.id === email.id) {
      setSelectedEmail(null); setSelectedThread(null); setSelectedThreadActiveMessageId(null);
      if (setShowMetadata) setShowMetadata(false);
      if (setFullPageReaderOpen) setFullPageReaderOpen(false);
    }
    const executeFn = async () => {
      try {
        const r = await fetch(`${API_BASE}/emails/${email.accountId}/${email.id}/trash`, { method: 'POST', credentials: 'include' });
        if (!r.ok) { setEmails(snapshot); setError('Failed to delete'); }
      } catch (err) { setEmails(snapshot); setError('Failed to delete'); }
    };
    const undoFn = () => { setEmails(snapshot); setSuccessToast(null); };
    setSuccessToast({ message: 'Email deleted', undoFn, executeFn });
  }, [selectedEmail, removeEmailIds, emails, setError, setSuccessToast, setShowMetadata, setFullPageReaderOpen]);

  const archiveEmail = useCallback((email) => {
    if (!email?.id || !email?.accountId) return;
    const snapshot = { ...emails };
    removeEmailIds(email.accountId, [email.id]);
    if (selectedEmail?.id === email.id) {
      setSelectedEmail(null); setSelectedThread(null); setSelectedThreadActiveMessageId(null);
      if (setShowMetadata) setShowMetadata(false);
      if (setFullPageReaderOpen) setFullPageReaderOpen(false);
    }
    const executeFn = async () => {
      try {
        const r = await fetch(`${API_BASE}/emails/${email.accountId}/${email.id}/archive`, { method: 'POST', credentials: 'include' });
        if (!r.ok) { setEmails(snapshot); setError('Failed to archive'); }
      } catch (err) { setEmails(snapshot); setError('Failed to archive'); }
    };
    const undoFn = () => { setEmails(snapshot); setSuccessToast(null); };
    setSuccessToast({ message: 'Email archived', undoFn, executeFn });
  }, [selectedEmail, removeEmailIds, emails, setError, setSuccessToast, setShowMetadata, setFullPageReaderOpen]);

  const starEmail = useCallback(async (email) => {
    if (!email?.id || !email?.accountId) return;
    const key = email.id;
    const currentlyStarred = starredOverrides[key] !== undefined ? starredOverrides[key] : email.isStarred;
    const newStarred = !currentlyStarred;
    setStarredOverrides(prev => ({ ...prev, [key]: newStarred }));
    try {
      await fetch(`${API_BASE}/emails/${email.accountId}/${email.id}/star`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: newStarred }),
      });
    } catch (err) {
      setStarredOverrides(prev => ({ ...prev, [key]: currentlyStarred }));
    }
  }, [starredOverrides]);

  const searchAllAccounts = useCallback(async (q) => {
    if (!q.trim() || connectedAccounts.length === 0) return;
    setIsLoadingEmails(true);
    try {
      const results = await Promise.all(
        connectedAccounts.map(async (a) => {
          try {
            const r = await fetch(`${API_BASE}/emails/${a.id}?q=${encodeURIComponent(q)}&maxResults=25`, { credentials: 'include' });
            if (!r.ok) return [];
            const d = await r.json();
            return (d.emails || []).map(e => ({ ...e, accountId: a.id }));
          } catch { return []; }
        })
      );
      const all = results.flat().sort((a, b) => new Date(b.date) - new Date(a.date));
      const seen = new Set();
      const deduped = all.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });
      setEmails(prev => {
        const n = { ...prev };
        connectedAccounts.forEach(a => {
          n[a.id] = { ...(n[a.id] || {}), _search: deduped.filter(e => e.accountId === a.id) };
        });
        return n;
      });
    } catch (err) { console.error('Search error:', err); }
    finally { setIsLoadingEmails(false); }
  }, [connectedAccounts]);

  const batchAction = useCallback((action) => {
    if (selectedIds.size === 0) return;
    const snapshot = { ...emails };
    const byAccount = groupSelectedByAccount();
    const affectedIds = new Set(selectedIds);
    byAccount.forEach((ids, aid) => removeEmailIds(aid, ids));
    if (selectedEmail && affectedIds.has(selectedEmail.id)) {
      setSelectedEmail(null); setSelectedThread(null); setSelectedThreadActiveMessageId(null);
      if (setShowMetadata) setShowMetadata(false);
      if (setFullPageReaderOpen) setFullPageReaderOpen(false);
    }
    clearSelection(); setEditMode(false);
    const label = action === 'archive' ? `Archived ${affectedIds.size} message${affectedIds.size !== 1 ? 's' : ''}` : `Deleted ${affectedIds.size} message${affectedIds.size !== 1 ? 's' : ''}`;
    const executeFn = async () => {
      setBatchWorking(true);
      try {
        for (const [aid, ids] of byAccount.entries()) {
          const r = await fetch(`${API_BASE}/emails/${aid}/batch`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, emailIds: ids }) });
          if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d?.error || `Batch ${action} failed`); }
        }
      } catch (err) { setEmails(snapshot); setError(String(err?.message || err)); }
      finally { setBatchWorking(false); }
    };
    const undoFn = () => { setEmails(snapshot); setSuccessToast(null); };
    setSuccessToast({ message: label, undoFn, executeFn });
  }, [selectedIds, emails, groupSelectedByAccount, removeEmailIds, selectedEmail, clearSelection, setError, setSuccessToast, setShowMetadata, setFullPageReaderOpen]);

  const snoozeEmail = useCallback((email, until) => {
    if (!email?.id) return;
    const key = `${email.accountId || ''}_${email.id}`;
    setSnoozedEmails(prev => ({ ...prev, [key]: { emailId: email.id, accountId: email.accountId, until: until.toISOString() } }));
    setSnoozeDropdownEmailId(null);
    setSuccessToast({ message: `Snoozed until ${new Date(until).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}` });
    if (selectedEmail?.id === email.id) {
      setSelectedEmail(null); setSelectedThread(null); setSelectedThreadActiveMessageId(null);
      if (setShowMetadata) setShowMetadata(false);
      if (setFullPageReaderOpen) setFullPageReaderOpen(false);
    }
    // Persist to Supabase (fire-and-forget; localStorage is already updated above)
    fetch(`${API_BASE}/snoozed`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: email.accountId, messageId: email.id, snoozeUntil: until.toISOString() }),
    }).catch(() => {});
  }, [selectedEmail, setSuccessToast, setShowMetadata, setFullPageReaderOpen]);

  const getSnoozeOptions = useCallback(() => {
    const now = new Date();
    const laterToday = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const tomorrowMorning = new Date(now);
    tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
    tomorrowMorning.setHours(8, 0, 0, 0);
    const nextMonday = new Date(now);
    nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
    nextMonday.setHours(8, 0, 0, 0);
    return [
      { label: 'Later today', time: laterToday },
      { label: 'Tomorrow morning', time: tomorrowMorning },
      { label: 'Next week', time: nextMonday },
    ];
  }, []);

  const navigatePrev = useCallback(() => {
    if (!selectedEmail) return;
    const i = filteredEmails.findIndex(e => e.id === selectedEmail.id);
    if (i > 0) {
      const p = filteredEmails[i - 1];
      setSelectedEmail(p);
      if (setShowMetadata) setShowMetadata(false);
      loadEmailDetails(p); loadThread(p);
      filteredEmails.slice(Math.max(0, i - 5), i - 1).forEach((e, j) => setTimeout(() => loadEmailDetails(e), (j + 1) * 100));
    }
  }, [selectedEmail, filteredEmails, loadEmailDetails, loadThread, setShowMetadata]);

  const navigateNext = useCallback(() => {
    if (!selectedEmail) return;
    const i = filteredEmails.findIndex(e => e.id === selectedEmail.id);
    if (i < filteredEmails.length - 1) {
      const n = filteredEmails[i + 1];
      setSelectedEmail(n);
      if (setShowMetadata) setShowMetadata(false);
      loadEmailDetails(n); loadThread(n);
      filteredEmails.slice(i + 2, i + 6).forEach((e, j) => setTimeout(() => loadEmailDetails(e), (j + 1) * 100));
    }
  }, [selectedEmail, filteredEmails, loadEmailDetails, loadThread, setShowMetadata]);

  const onSelectEmail = useCallback((email) => {
    setSelectedEmail(email);
    if (setShowMetadata) setShowMetadata(false);
    if (setReaderCompact) setReaderCompact(false);
    loadEmailDetails(email); loadThread(email); setSelectedThreadActiveMessageId(email.id);
    if (splitMode === 'none' && setFullPageReaderOpen) setFullPageReaderOpen(true);
    const idx = filteredEmails.findIndex(e => e.id === email.id);
    if (idx >= 0) filteredEmails.slice(idx + 1, idx + 11).forEach((e, i) => setTimeout(() => loadEmailDetails(e), (i + 1) * 80));
  }, [loadEmailDetails, loadThread, splitMode, filteredEmails, setShowMetadata, setReaderCompact, setFullPageReaderOpen]);

  // Batch-prefetch visible inbox
  useEffect(() => {
    if (filteredEmails.length === 0) return;
    const byAccount = {};
    filteredEmails.slice(0, 50).forEach(email => {
      if (emailBodiesRef.current[email.id] && emailHeadersRef.current[email.id]) return;
      const aid = email.accountId; if (!aid) return;
      if (!byAccount[aid]) byAccount[aid] = [];
      byAccount[aid].push(email.id);
    });
    if (Object.keys(byAccount).length === 0) return;
    const timer = setTimeout(() => {
      Object.entries(byAccount).forEach(([accountId, ids]) => {
        const chunks = [];
        for (let i = 0; i < ids.length; i += 25) chunks.push(ids.slice(i, i + 25));
        chunks.forEach(chunk => fetch(`${API_BASE}/emails/${accountId}/batch-bodies`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageIds: chunk }),
        })
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (!d?.bodies) return;
            const bodyMap = {}, headerMap = {}, attachMap = {};
            Object.entries(d.bodies).forEach(([id, data]) => {
              bodyMap[id] = data.body;
              headerMap[id] = data.headers;
              attachMap[id] = data.attachments || [];
            });
            setEmailBodies(p => ({ ...p, ...bodyMap }));
            setEmailHeaders(p => ({ ...p, ...headerMap }));
            setEmailAttachments(p => ({ ...p, ...attachMap }));
          })
          .catch(() => {}));
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [filteredEmails]);

  return {
    emails, selectedEmail, setSelectedEmail, selectedThread,
    emailBodies, emailHeaders, emailAttachments,
    isLoadingEmails, isLoadingBody, isLoadingThread,
    emailLoadError, editMode, setEditMode,
    selectedIds, batchWorking, starredOverrides,
    snoozedEmails, snoozeDropdownEmailId, setSnoozeDropdownEmailId,
    collapsedMsgIds, setCollapsedMsgIds, threadExpanded, setThreadExpanded, expandedBodies, setExpandedBodies,
    filteredEmails, allEmails, categoryCounts,
    loadEmailsForAccount, loadEmailDetails, downloadAttachment, loadThread,
    getCurrentEmails, trashEmail, archiveEmail, starEmail,
    searchAllAccounts, batchAction,
    clearSelection, toggleSelectId, selectAllVisible,
    snoozeEmail, getSnoozeOptions, syncSnoozed,
    navigatePrev, navigateNext, onSelectEmail,
    setEmails, setEmailBodies, setEmailHeaders, setEmailAttachments,
  };
}
