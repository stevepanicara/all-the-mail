import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Mail, RefreshCw, Users, Search, Plus, LogOut, X,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Forward, Reply, Archive, Trash2, CheckSquare, MinusSquare,
  Paperclip, Download, ArrowLeft, FileText, Calendar, Star, Clock,
  Share2, MoreHorizontal, LayoutGrid, ExternalLink, MapPin, Sun, Moon, MessagesSquare,
  Send, MailOpen, BellOff,
} from 'lucide-react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import 'react-quill/dist/quill.snow.css';

import { API_BASE, DENSITY_HEIGHTS, FILE_TYPES } from './utils/constants';
import {
  getAccountGradient, buildEmailSrcDoc, stripName, ensurePrefix,
  getEmailOnly, splitList, uniqLower, migrateLayoutStorage,
  sanitizeDocHtml, formatRelativeEdit, getShortLabel,
  getDocEditUrl, getDocIcon, getDocEditorLabel, getRelativeTime, formatTime,
} from './utils/helpers';

import Sidebar from './components/common/Sidebar';
import ComposeModal from './components/common/ComposeModal';
import EventEditModal from './components/common/EventEditModal';
import ErrorBoundary from './components/common/ErrorBoundary';
import Avatar from './components/Avatar';

import './design-system.css';

// ==================== MAIN COMPONENT ====================

const AllTheMail = () => {
  const [isAuthed, setIsAuthed] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [introActive, setIntroActive] = useState(true);
  const [appReady, setAppReady] = useState(false);
  const [gateVisible, setGateVisible] = useState(true);
  const gateTimerRef = React.useRef(null);
  const GATE_WORDS = ['MAIL', 'DOCS', 'CALS'];
  const [gateWordIdx, setGateWordIdx] = useState(0);
  const [cascadeKey, setCascadeKey] = useState(0);
  const [theme, setTheme] = useState(() => localStorage.getItem('atm-theme') || 'dark');

  const [activeModule, setActiveModule] = useState('everything');

  // Docs state
  const [docsCategory, setDocsCategory] = useState('recent');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docsSearchQuery, setDocsSearchQuery] = useState('');
  const [docsSortBy, setDocsSortBy] = useState('lastEdited');
  const [docsSortDir, setDocsSortDir] = useState('desc');

  // Cals state
  const [calsViewMode, setCalsViewMode] = useState(() => localStorage.getItem('atm_calview') || 'week');
  const [calDate, setCalDate] = useState(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventEditOpen, setEventEditOpen] = useState(false);
  const [eventEditFields, setEventEditFields] = useState({});
  const [eventEditSaving, setEventEditSaving] = useState(false);
  const [eventEditError, setEventEditError] = useState(null);

  // Slide-over preview state
  const [slideOverEmail, setSlideOverEmail] = useState(null);
  const [slideOverDoc, setSlideOverDoc] = useState(null);
  const [slideOverIndex, setSlideOverIndex] = useState(null);
  const [docPreview, setDocPreview] = useState(null);
  const [docPreviewLoading, setDocPreviewLoading] = useState(false);

  // Everything column filters
  const [evMailFilter, setEvMailFilter] = useState('all');
  const [evDocsFilter, setEvDocsFilter] = useState('recent');
  const [evCalsFilter, setEvCalsFilter] = useState('upcoming');
  const [evMobileTab, setEvMobileTab] = useState('all');
  const swipeRef = useRef({ startX: 0, startY: 0, currentX: 0, emailId: null });
  // Refs that always hold the latest cached bodies/headers — avoids stale closures
  const emailBodiesRef = useRef({});
  const emailHeadersRef = useRef({});

  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [activeView, setActiveView] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const acct = p.get('acct');
    return acct && acct !== 'all' ? acct : 'everything';
  });
  const [activeCategory, setActiveCategory] = useState('primary');

  const [emails, setEmails] = useState({});
  const [docs, setDocs] = useState({});
  const [events, setEvents] = useState({});
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [selectedThread, setSelectedThread] = useState(null);
  const [, setSelectedThreadActiveMessageId] = useState(null);

  const [emailBodies, setEmailBodies] = useState({});
  const [emailHeaders, setEmailHeaders] = useState({});
  // Keep refs in sync so callbacks always see the latest cached values
  useEffect(() => { emailBodiesRef.current = emailBodies; }, [emailBodies]);
  useEffect(() => { emailHeadersRef.current = emailHeaders; }, [emailHeaders]);
  const [emailAttachments, setEmailAttachments] = useState({});

  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [isLoadingBody, setIsLoadingBody] = useState(false);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [docsErrors, setDocsErrors] = useState({});
  const [eventsErrors, setEventsErrors] = useState({});
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showMetadata, setShowMetadata] = useState(false);
  const [readerCompact, setReaderCompact] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [batchWorking, setBatchWorking] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState('compose');
  const [composeOriginalEmail, setComposeOriginalEmail] = useState(null);
  const [composeShowCcBcc, setComposeShowCcBcc] = useState(false);
  const [composeFromAccountId, setComposeFromAccountId] = useState('');
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [composeError, setComposeError] = useState(null);
  const [composeAttachments, setComposeAttachments] = useState([]);
  const [composeDraftId, setComposeDraftId] = useState(null);
  const [includeAtmSignature, setIncludeAtmSignature] = useState(() => localStorage.getItem('atm_signature') !== 'false');

  // Snooze state
  const [snoozedEmails, setSnoozedEmails] = useState(() => JSON.parse(localStorage.getItem('atm_snoozed') || '{}'));
  const [snoozeDropdownEmailId, setSnoozeDropdownEmailId] = useState(null);

  // Scheduled sends state
  const [scheduledSends, setScheduledSends] = useState(() => JSON.parse(localStorage.getItem('atm_scheduled_sends') || '[]'));

  // Send delay (unsend) state
  const [sendDelaySeconds, setSendDelaySeconds] = useState(() => parseInt(localStorage.getItem('atm_send_delay') || '5', 10));
  const [pendingSend, setPendingSend] = useState(null); // { secondsLeft, previewSubject, interval }

  // Saved searches state
  const [savedSearches, setSavedSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('atm_saved_searches') || '[]'); }
    catch { return []; }
  });

  const [error, setError] = useState(null);
  const [successToast, setSuccessToast] = useState(null); // { message, undoFn? }
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('atm_onboarded'));
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isCheckingMail, setIsCheckingMail] = useState(false);

  // Hover state for email rows (Phase 2)
  const [hoveredEmailId, setHoveredEmailId] = useState(null);

  // Starred optimistic updates (Phase 2)
  const [starredOverrides, setStarredOverrides] = useState({});

  // Active mail category tab (Phase 4) — maps to 'primary','promotions','social','updates'
  const [activeMailTab, setActiveMailTab] = useState(() => localStorage.getItem('atm_mail_tab') || 'primary');

  // Thread collapsing state (Phase 5): set of collapsed message IDs
  const [collapsedMsgIds, setCollapsedMsgIds] = useState(new Set());
  const [threadExpanded, setThreadExpanded] = useState(false);

  // Search operators dropdown (Phase 6)
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);

  // Two-key shortcut sequence state (Phase 3)
  const lastKeyRef = useRef(null);
  const lastKeyTimerRef = useRef(null);

  // Per-message expanded body state (Phase 5)
  const [expandedBodies, setExpandedBodies] = useState({});

  const [splitMode, setSplitMode] = useState(() => {
    const m = migrateLayoutStorage(); if (m) return m;
    return localStorage.getItem('atm_split_mode') || 'none';
  });
  const [densityMode, setDensityMode] = useState(() => localStorage.getItem('atm_density') || 'default');
  const [conversationView, setConversationView] = useState(() => localStorage.getItem('atm_conversation') !== 'false');
  const [fullPageReaderOpen, setFullPageReaderOpen] = useState(false);
  const [listWidth, setListWidth] = useState(600);

  const listContainerRef = useRef(null);
  const searchInputRef = useRef(null);
  const draftSaveTimeoutRef = useRef(null);
  const saveDraftRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const cascadeTimestampRef = useRef(Date.now());
  const hasAnimatedRef = useRef(false);
  const readerScrollRef = useRef(null);
  const railScrollRef = useRef(null);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [fadeRight, setFadeRight] = useState(false);
  const iframeRef = useRef(null);
  const iframeResizeCleanupRef = useRef(null);

  const [userProfile, setUserProfile] = useState(null);
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
  const [removingAccountId, setRemovingAccountId] = useState(null);
  const [emailLoadError, setEmailLoadError] = useState(null);
  const [billingPlan, setBillingPlan] = useState('free');
  const [billingLoading, setBillingLoading] = useState(false);
  const avatarDropdownRef = useRef(null);
  const avatarButtonRef = useRef(null);

  const rowHeight = DENSITY_HEIGHTS[densityMode] || 56;

  // ==================== EFFECTS ====================

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('auth')==='error'||window.location.pathname==='/auth/error') { setAuthError('Authentication failed. Please try again.'); window.history.replaceState({},document.title,window.location.pathname); }
    if (p.get('connect')==='error') { setAuthError('Account connection failed. Please try again.'); window.history.replaceState({},document.title,window.location.pathname); }
  }, []);

  useEffect(() => { const t = setTimeout(()=>setIntroActive(false),900); return ()=>clearTimeout(t); }, []);
  useEffect(() => { localStorage.setItem('atm_split_mode',splitMode); }, [splitMode]);
  useEffect(() => { localStorage.setItem('atm_density',densityMode); }, [densityMode]);
  useEffect(() => { localStorage.setItem('atm_conversation', conversationView); }, [conversationView]);
  useEffect(() => { localStorage.setItem('atm_calview', calsViewMode); }, [calsViewMode]);
  useEffect(() => { localStorage.setItem('atm_signature', includeAtmSignature); }, [includeAtmSignature]);
  useEffect(() => { localStorage.setItem('atm_send_delay', String(sendDelaySeconds)); }, [sendDelaySeconds]);
  useEffect(() => { localStorage.setItem('atm_saved_searches', JSON.stringify(savedSearches)); }, [savedSearches]);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('atm-theme', theme); }, [theme]);
  const toggleTheme = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), []);

  const undoTimerRef = useRef(null);
  useEffect(() => {
    if (!successToast) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const delay = successToast.undoFn ? 5000 : 3000;
    undoTimerRef.current = setTimeout(() => {
      // If there's a pending action, execute it now
      if (successToast.executeFn) successToast.executeFn();
      setSuccessToast(null);
    }, delay);
    return () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); };
  }, [successToast]);

  useEffect(() => {
    const url = new URL(window.location);
    url.searchParams.set('acct', activeView === 'everything' ? 'all' : activeView);
    window.history.replaceState({}, '', url);
  }, [activeView]);

  useEffect(() => {
    if (connectedAccounts.length > 0 && activeView !== 'everything') {
      if (!connectedAccounts.some(a => a.id === activeView)) setActiveView('everything');
    }
  }, [connectedAccounts, activeView]);

  // Gate fade-out: once data is ready, animate out then unmount
  useEffect(() => {
    if (appReady && gateVisible) {
      gateTimerRef.current = setTimeout(() => setGateVisible(false), 480);
    }
    return () => { if (gateTimerRef.current) clearTimeout(gateTimerRef.current); };
  }, [appReady, gateVisible]);

  // Gate word cycling: MAIL → DOCS → CALS → MAIL → … while loading
  useEffect(() => {
    if (!gateVisible || appReady) return;
    const id = setInterval(() => setGateWordIdx(i => (i + 1) % GATE_WORDS.length), 1400);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateVisible, appReady]); // GATE_WORDS.length is stable (constant array)

  useEffect(() => {
    const el = listContainerRef.current; if (!el) return;
    const obs = new ResizeObserver(e => { for (const en of e) setListWidth(en.contentRect.width); });
    obs.observe(el); return () => obs.disconnect();
  }, []);

  useEffect(() => {
    return () => { if (iframeResizeCleanupRef.current) iframeResizeCleanupRef.current(); };
  }, []);

  useEffect(() => {
    if (!avatarDropdownOpen) return;
    const handler = (e) => {
      if (avatarDropdownRef.current && !avatarDropdownRef.current.contains(e.target) &&
          avatarButtonRef.current && !avatarButtonRef.current.contains(e.target)) {
        setAvatarDropdownOpen(false);
        setRemovingAccountId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [avatarDropdownOpen]);

  useEffect(() => {
    if (!avatarDropdownOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') { setAvatarDropdownOpen(false); setRemovingAccountId(null); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [avatarDropdownOpen]);

  // Close snooze dropdown on outside click or Escape
  useEffect(() => {
    if (!snoozeDropdownEmailId) return;
    const handler = () => setSnoozeDropdownEmailId(null);
    const keyHandler = (e) => { if (e.key === 'Escape') setSnoozeDropdownEmailId(null); };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    document.addEventListener('keydown', keyHandler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', keyHandler); };
  }, [snoozeDropdownEmailId]);

  const handleReaderScroll = useCallback((e) => {
    setReaderCompact(e.target.scrollTop > 60);
  }, []);

  const toggleDocsSort = useCallback((field) => {
    if (docsSortBy === field) setDocsSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setDocsSortBy(field); setDocsSortDir('desc'); }
  }, [docsSortBy]);

  const cycleDensity = useCallback(() => {
    setDensityMode(p => p==='default'?'comfortable':p==='comfortable'?'compact':'default');
  }, []);

  const updateRailFades = useCallback(() => {
    const el = railScrollRef.current;
    if (!el) return;
    setFadeLeft(el.scrollLeft > 4);
    setFadeRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateRailFades();
    const el = railScrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => updateRailFades());
    obs.observe(el);
    return () => obs.disconnect();
  }, [connectedAccounts, updateRailFades]);

  // ==================== AUTH & DATA ====================

  const handleLogout = useCallback(async () => {
    try { await fetch(`${API_BASE}/auth/logout`,{method:'POST',credentials:'include'}); } catch(e){}
    setIsAuthed(false); setConnectedAccounts([]); setEmails({}); setDocs({}); setEvents({}); setSelectedEmail(null);
    setSelectedThread(null); setSelectedThreadActiveMessageId(null); setEmailBodies({}); setEmailHeaders({});
    setEditMode(false); setSelectedIds(new Set()); setAvatarDropdownOpen(false); setUserProfile(null); setBillingPlan('free');
  }, []);

  const loadUserProfile = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
      if (r.ok) { const d = await r.json(); setUserProfile(d.user); }
    } catch (e) { console.error('Failed to load user profile:', e); }
  }, []);

  const loadBillingStatus = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/billing/status`, { credentials: 'include' });
      if (r.ok) { const d = await r.json(); setBillingPlan(d.plan || 'free'); }
    } catch (e) { console.error('Failed to load billing status:', e); }
  }, []);

  const handleRemoveAccount = useCallback(async (accountId) => {
    if (removingAccountId !== accountId) { setRemovingAccountId(accountId); return; }
    try {
      const r = await fetch(`${API_BASE}/accounts/${accountId}`, { method: 'DELETE', credentials: 'include' });
      if (r.ok) {
        const updated = connectedAccounts.filter(a => a.id !== accountId);
        setConnectedAccounts(updated);
        if (activeView === accountId) setActiveView('everything');
        setRemovingAccountId(null);
      } else {
        const d = await r.json();
        setError(d.error || 'Failed to remove account');
        setRemovingAccountId(null);
      }
    } catch (e) { console.error('Remove account error:', e); setError('Failed to remove account'); setRemovingAccountId(null); }
  }, [removingAccountId, connectedAccounts, activeView]);

  const handleUpgrade = useCallback(async (interval = 'monthly') => {
    setBillingLoading(true);
    try {
      const r = await fetch(`${API_BASE}/billing/checkout`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interval }) });
      if (r.ok) { const d = await r.json(); if (d.url) window.location.href = d.url; }
      else { const d = await r.json(); setError(d.error || 'Failed to start checkout'); }
    } catch (e) { console.error('Checkout error:', e); setError('Failed to start checkout'); }
    finally { setBillingLoading(false); }
  }, []);

  const handleManageBilling = useCallback(async () => {
    setBillingLoading(true);
    try {
      const r = await fetch(`${API_BASE}/billing/portal`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
      if (r.ok) { const d = await r.json(); if (d.url) window.location.href = d.url; }
      else { const d = await r.json(); setError(d.error || 'Failed to open billing portal'); }
    } catch (e) { console.error('Portal error:', e); setError('Failed to open billing portal'); }
    finally { setBillingLoading(false); }
  }, []);

  const getCurrentEmails = useCallback(() => {
    let list;
    if (activeView==='everything') {
      const all=[]; connectedAccounts.forEach(a => { const ae=emails[a.id]?.[activeCategory]||[]; all.push(...ae.map(e=>({...e,accountId:a.id}))); });
      list = all.sort((a,b)=>new Date(b.date)-new Date(a.date));
    } else {
      list = emails[activeView]?.[activeCategory]||[];
    }

    if (!conversationView) return list;

    // Group by threadId — keep the newest message per thread, add threadCount
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

    return grouped.sort((a,b) => new Date(b.date) - new Date(a.date));
  }, [activeView, activeCategory, connectedAccounts, emails, conversationView]);

  const allEmails = useMemo(() => {
    const all = [];
    connectedAccounts.forEach(a => {
      const ae = emails[a.id]?.primary || [];
      all.push(...ae.map(e => ({ ...e, accountId: a.id })));
    });
    return all.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [connectedAccounts, emails]);

  const evFilteredEmails = useMemo(() => {
    let pool = allEmails;
    if (activeView !== 'everything') pool = pool.filter(e => e.accountId === activeView);
    if (evMailFilter === 'unread') return pool.filter(e => !e.isRead);
    return pool;
  }, [allEmails, evMailFilter, activeView]);

  const allDocs = useMemo(() => {
    const all = [];
    connectedAccounts.forEach(a => {
      const ad = docs[a.id] || [];
      all.push(...ad.map(d => ({ ...d, accountId: a.id })));
    });
    return all.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [connectedAccounts, docs]);

  const allEvents = useMemo(() => {
    const all = [];
    connectedAccounts.forEach(a => {
      const ae = events[a.id] || [];
      all.push(...ae.map(e => ({ ...e, accountId: a.id })));
    });
    return all.sort((a, b) => new Date(a.startISO || 0) - new Date(b.startISO || 0));
  }, [connectedAccounts, events]);

  const filteredAllEvents = useMemo(() => {
    if (activeView === 'everything') return allEvents;
    return allEvents.filter(e => e.accountId === activeView);
  }, [allEvents, activeView]);

  // Generate day columns for calendar grid views
  const calGridDays = useMemo(() => {
    const today = new Date();
    const anchor = new Date(calDate);
    let startDate, numDays;

    if (calsViewMode === 'day') {
      startDate = new Date(anchor); startDate.setHours(0, 0, 0, 0);
      numDays = 1;
    } else if (calsViewMode === '4day') {
      startDate = new Date(anchor); startDate.setHours(0, 0, 0, 0);
      numDays = 4;
    } else if (calsViewMode === 'week') {
      const dow = anchor.getDay();
      startDate = new Date(anchor);
      startDate.setDate(anchor.getDate() - ((dow + 6) % 7));
      startDate.setHours(0, 0, 0, 0);
      numDays = 7;
    } else {
      // month/year/schedule use list, not grid
      const dow = anchor.getDay();
      startDate = new Date(anchor);
      startDate.setDate(anchor.getDate() - ((dow + 6) % 7));
      startDate.setHours(0, 0, 0, 0);
      numDays = 7;
    }

    const days = [];
    for (let i = 0; i < numDays; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      const dayEvents = filteredAllEvents.filter(ev => {
        const evDate = new Date(ev.startISO || 0);
        return evDate >= d && evDate <= dayEnd;
      });

      days.push({
        date: d,
        label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
        shortLabel: d.toLocaleDateString(undefined, { weekday: 'short' }),
        dayNum: d.getDate(),
        isToday: d.toDateString() === today.toDateString(),
        events: dayEvents,
      });
    }
    return days;
  }, [filteredAllEvents, calDate, calsViewMode]);

  // Generate month grid for month view (6 weeks)
  const calMonthDays = useMemo(() => {
    const today = new Date();
    const anchor = new Date(calDate);
    const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const startDow = firstOfMonth.getDay();
    const startDate = new Date(firstOfMonth);
    startDate.setDate(1 - ((startDow + 6) % 7));
    startDate.setHours(0, 0, 0, 0);

    const weeks = [];
    for (let w = 0; w < 6; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + w * 7 + d);
        const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
        const dayEvents = filteredAllEvents.filter(ev => {
          const evDate = new Date(ev.startISO || 0);
          return evDate >= date && evDate <= dayEnd;
        });
        week.push({
          date,
          dayNum: date.getDate(),
          isToday: date.toDateString() === today.toDateString(),
          isCurrentMonth: date.getMonth() === anchor.getMonth(),
          events: dayEvents,
        });
      }
      weeks.push(week);
    }
    return weeks;
  }, [filteredAllEvents, calDate]);

  // Calendar navigation
  const calNavigate = useCallback((dir) => {
    setCalDate(prev => {
      const d = new Date(prev);
      if (calsViewMode === 'day') d.setDate(d.getDate() + dir);
      else if (calsViewMode === '4day') d.setDate(d.getDate() + dir * 4);
      else if (calsViewMode === 'week') d.setDate(d.getDate() + dir * 7);
      else if (calsViewMode === 'month') d.setMonth(d.getMonth() + dir);
      else if (calsViewMode === 'year') d.setFullYear(d.getFullYear() + dir);
      else d.setDate(d.getDate() + dir * 7);
      return d;
    });
  }, [calsViewMode]);

  const calTitle = useMemo(() => {
    const d = new Date(calDate);
    if (calsViewMode === 'day') return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (calsViewMode === 'month' || calsViewMode === 'year') return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    // week, 4day, schedule
    const end = new Date(d);
    end.setDate(d.getDate() + (calsViewMode === '4day' ? 3 : 6));
    if (d.getMonth() === end.getMonth()) return `${d.toLocaleDateString(undefined, { month: 'long' })} ${d.getDate()} – ${end.getDate()}, ${d.getFullYear()}`;
    return `${d.toLocaleDateString(undefined, { month: 'short' })} ${d.getDate()} – ${end.toLocaleDateString(undefined, { month: 'short' })} ${end.getDate()}, ${d.getFullYear()}`;
  }, [calDate, calsViewMode]);

  const filteredDocs = useMemo(() => {
    let pool = allDocs;
    if (activeView !== 'everything') pool = pool.filter(d => d.accountId === activeView);
    if (docsCategory === 'shared') pool = pool.filter(d => d.shared);
    else if (docsCategory === 'starred') pool = pool.filter(d => d.starred);
    else if (docsCategory === 'trash') pool = [];

    // Search filter
    if (docsSearchQuery.trim()) {
      const q = docsSearchQuery.toLowerCase();
      pool = pool.filter(d =>
        (d.title || '').toLowerCase().includes(q) ||
        (d.owner || '').toLowerCase().includes(q) ||
        (d.mimeType || '').toLowerCase().includes(q)
      );
    }

    // Sort
    pool = [...pool].sort((a, b) => {
      let cmp = 0;
      if (docsSortBy === 'name') cmp = (a.title || '').localeCompare(b.title || '');
      else if (docsSortBy === 'type') cmp = (a.mimeType || '').localeCompare(b.mimeType || '');
      else if (docsSortBy === 'lastEdited') cmp = new Date(b.lastEdited || 0) - new Date(a.lastEdited || 0);
      else cmp = new Date(b.date || 0) - new Date(a.date || 0);
      return docsSortDir === 'asc' ? -cmp : cmp;
    });

    return pool;
  }, [docsCategory, allDocs, activeView, docsSearchQuery, docsSortBy, docsSortDir]);

  const evFilteredDocs = useMemo(() => {
    let pool = allDocs;
    if (activeView !== 'everything') pool = pool.filter(d => d.accountId === activeView);
    if (evDocsFilter === 'shared') return pool.filter(d => d.shared);
    return pool;
  }, [evDocsFilter, allDocs, activeView]);

  const evFilteredEvents = useMemo(() => {
    let pool = allEvents;
    if (activeView !== 'everything') pool = pool.filter(e => e.accountId === activeView);
    if (evCalsFilter === 'week') return pool;
    return pool.filter(e => e.day === 'Today' || e.day === 'Tomorrow');
  }, [evCalsFilter, allEvents, activeView]);

  const mobileUnifiedFeed = useMemo(() => {
    const items = [];
    evFilteredEmails.slice(0, 50).forEach(e => items.push({ type: 'email', data: e, time: new Date(e.date).getTime() }));
    evFilteredDocs.slice(0, 30).forEach(d => items.push({ type: 'doc', data: d, time: new Date(d.lastEdited || d.date).getTime() }));
    filteredAllEvents.slice(0, 30).forEach(ev => items.push({ type: 'event', data: ev, time: new Date(ev.startISO || 0).getTime() }));
    return items.sort((a, b) => b.time - a.time);
  }, [evFilteredEmails, evFilteredDocs, filteredAllEvents]);

  const hasDocsError = Object.values(docsErrors).some(Boolean);
  const hasEventsError = Object.values(eventsErrors).some(Boolean);
  const anyHasDocs = connectedAccounts.some(a => a.granted_scopes?.includes('docs'));
  const anyHasCals = connectedAccounts.some(a => a.granted_scopes?.includes('cals'));

  const categoryCounts = useMemo(() => {
    const c={primary:0,social:0,promotions:0,sent:0,drafts:0,trash:0};
    connectedAccounts.forEach(a=>{const ac=emails[a.id]||{};c.primary+=ac.primary?.length||0;c.social+=ac.social?.length||0;c.promotions+=ac.promotions?.length||0;c.sent+=ac.sent?.length||0;c.drafts+=ac.drafts?.length||0;c.trash+=ac.trash?.length||0;});
    return c;
  }, [emails, connectedAccounts]);

  const loadEmailsForAccount = useCallback(async (accountId, category=null) => {
    const cats = category ? [category] : ['primary','social','promotions','sent','drafts','trash'];
    setIsLoadingEmails(true);
    for (const cat of cats) {
      try {
        const r = await fetch(`${API_BASE}/emails/${accountId}?category=${cat}&maxResults=50`,{credentials:'include'});
        if (r.ok) {
          setIsAuthed(true);
          const d = await r.json();
          setEmails(p=>({...p,[accountId]:{...(p[accountId]||{}),[cat]:d.emails||[]}}));
          setLastSyncTime(new Date());
          setEmailLoadError(null);
        } else if (r.status===401) {
          setIsAuthed(false); setConnectedAccounts([]); setEmails({}); setSelectedEmail(null);
          setSelectedThread(null); setSelectedThreadActiveMessageId(null); setEmailBodies({}); setEmailHeaders({});
          setEditMode(false); setSelectedIds(new Set()); return;
        } else {
          setEmailLoadError({ accountId, category: cat });
        }
      } catch(err) { console.error('Error loading emails:', err); setEmailLoadError({ accountId, category: cat }); }
    }
    setIsLoadingEmails(false);
  }, []);

  const loadDocsForAccount = useCallback(async (accountId, filter = null) => {
    try {
      const qs = filter ? `?filter=${filter}` : '';
      const r = await fetch(`${API_BASE}/docs/${accountId}${qs}`, { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        setDocs(p => ({ ...p, [accountId]: d.docs || [] }));
        setDocsErrors(p => ({ ...p, [accountId]: null }));
      } else if (r.status === 403 || r.status === 401) {
        const body = await r.json().catch(() => ({}));
        const errType = body.error === 'invalid_token' ? 'token' : 'scope';
        setDocsErrors(p => ({ ...p, [accountId]: errType }));
      } else { console.error('Docs load failed:', r.status); }
    } catch (err) { console.error('Error loading docs:', err); setDocsErrors(p => ({ ...p, [accountId]: 'network' })); }
  }, []);

  const loadEventsForAccount = useCallback(async (accountId, range = null) => {
    try {
      const qs = range ? `?range=${range}` : '';
      const r = await fetch(`${API_BASE}/cals/${accountId}/events${qs}`, { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        setEvents(p => ({ ...p, [accountId]: d.events || [] }));
        setEventsErrors(p => ({ ...p, [accountId]: null }));
      } else if (r.status === 403 || r.status === 401) {
        const body = await r.json().catch(() => ({}));
        const errType = body.error === 'invalid_token' ? 'token' : 'scope';
        setEventsErrors(p => ({ ...p, [accountId]: errType }));
      } else { console.error('Events load failed:', r.status); }
    } catch (err) { console.error('Error loading events:', err); setEventsErrors(p => ({ ...p, [accountId]: 'network' })); }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/accounts`,{credentials:'include'});
      if (r.ok) {
        setIsAuthed(true); const d=await r.json(); const accs=d.accounts||[];
        setConnectedAccounts(accs);
        if (!hasAnimatedRef.current) {
          setCascadeKey(k => k + 1);
          cascadeTimestampRef.current = Date.now();
          hasAnimatedRef.current = true;
        }
        setIsLoadingDocs(true); setIsLoadingEvents(true);
        setDocsErrors({}); setEventsErrors({});
        const docsAccs = accs.filter(a => a.granted_scopes?.includes('docs'));
        const calsAccs = accs.filter(a => a.granted_scopes?.includes('cals'));
        const docPromises = docsAccs.map(a => loadDocsForAccount(a.id));
        const eventPromises = calsAccs.map(a => loadEventsForAccount(a.id));
        const emailPromises = accs.map(a => loadEmailsForAccount(a.id));
        Promise.all(docPromises).then(() => setIsLoadingDocs(false));
        Promise.all(eventPromises).then(() => setIsLoadingEvents(false));
        if (docsAccs.length === 0) setIsLoadingDocs(false);
        if (calsAccs.length === 0) setIsLoadingEvents(false);
        // Reveal the UI once the first email batch lands (or immediately if no accounts)
        Promise.all(accs.length > 0 ? emailPromises : []).then(() => setAppReady(true)).catch(() => setAppReady(true));
        loadUserProfile();
        loadBillingStatus();
      } else if (r.status===401) {
        setIsAuthed(false); setConnectedAccounts([]); setEmails({}); setDocs({}); setEvents({}); setSelectedEmail(null);
        setSelectedThread(null); setSelectedThreadActiveMessageId(null); setEmailBodies({}); setEmailHeaders({});
        setEditMode(false); setSelectedIds(new Set());
      } else { setConnectedAccounts([]); }
    } catch(err) { console.error('Error loading accounts:', err); setError('Failed to load accounts'); }
  }, [loadEmailsForAccount, loadDocsForAccount, loadEventsForAccount, loadUserProfile, loadBillingStatus]);

  const refreshEmails = useCallback(async () => {
    if (!isAuthed||connectedAccounts.length===0) return;
    setIsCheckingMail(true);
    try {
      if (activeView==='everything') { for (const a of connectedAccounts) await loadEmailsForAccount(a.id,activeCategory); }
      else { const aa=connectedAccounts.find(a=>a.id===activeView); if(aa) await loadEmailsForAccount(aa.id,activeCategory); }
    } catch(err) { console.error('Error refreshing:', err); }
    finally { setIsCheckingMail(false); }
  }, [isAuthed, connectedAccounts, activeView, activeCategory, loadEmailsForAccount]);

  useEffect(() => {
    if (!isAuthed||connectedAccounts.length===0) return;
    refreshEmails();
    pollingIntervalRef.current = setInterval(()=>refreshEmails(), 30000);
    const h=()=>{ if(document.hidden){if(pollingIntervalRef.current){clearInterval(pollingIntervalRef.current);pollingIntervalRef.current=null;}}else{if(!pollingIntervalRef.current){refreshEmails();pollingIntervalRef.current=setInterval(()=>refreshEmails(),30000);}} };
    document.addEventListener('visibilitychange',h);
    return ()=>{if(pollingIntervalRef.current)clearInterval(pollingIntervalRef.current);document.removeEventListener('visibilitychange',h);};
  }, [isAuthed, connectedAccounts.length, refreshEmails]);

  const loadEmailDetails = useCallback(async (email) => {
    if(!email?.id) return; const eid=email.id;
    if(emailBodiesRef.current[eid]&&emailHeadersRef.current[eid]) return;
    setIsLoadingBody(true);
    try {
      const aid=email.accountId||connectedAccounts[0]?.id; if(!aid) return;
      const r=await fetch(`${API_BASE}/emails/${aid}/${eid}`,{credentials:'include'});
      if(r.ok){
        setIsAuthed(true); const d=await r.json();
        setEmailBodies(p=>{const u={...p,[eid]:d.body};const k=Object.keys(u);if(k.length>100)k.slice(0,k.length-100).forEach(x=>delete u[x]);return u;});
        if(d.headers) setEmailHeaders(p=>{const u={...p,[eid]:d.headers};const k=Object.keys(u);if(k.length>100)k.slice(0,k.length-100).forEach(x=>delete u[x]);return u;});
        if(d.attachments) setEmailAttachments(p=>{const u={...p,[eid]:d.attachments};const k=Object.keys(u);if(k.length>100)k.slice(0,k.length-100).forEach(x=>delete u[x]);return u;});
        if(!email.isRead){
          setEmails(p=>{const n={...p};Object.keys(n).forEach(ai=>{Object.keys(n[ai]).forEach(c=>{if(n[ai][c])n[ai][c]=n[ai][c].map(e=>e.id===eid?{...e,isRead:true}:e);});});return n;});
          fetch(`${API_BASE}/emails/${aid}/${eid}/read`,{method:'POST',credentials:'include'}).catch(()=>{});
        }
      } else if(r.status===401){setIsAuthed(false);setConnectedAccounts([]);setEmails({});setSelectedEmail(null);setSelectedThread(null);setSelectedThreadActiveMessageId(null);setEmailBodies({});setEmailHeaders({});setEditMode(false);setSelectedIds(new Set());return;}
    } catch(err){console.error('Error loading email body:',err);}
    finally{setIsLoadingBody(false);}
  }, [connectedAccounts]);

  const downloadAttachment = useCallback(async (accountId, messageId, attachmentId, filename, mimeType) => {
    try {
      const r=await fetch(`${API_BASE}/emails/${accountId}/${messageId}/attachments/${attachmentId}?filename=${encodeURIComponent(filename)}&mimeType=${encodeURIComponent(mimeType)}`,{credentials:'include'});
      if(r.ok){const b=await r.blob();const u=window.URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();window.URL.revokeObjectURL(u);document.body.removeChild(a);}
      else setError('Failed to download attachment');
    } catch(err){console.error('Download error:',err);setError('Failed to download attachment');}
  }, []);

  const handleFileSelect = useCallback((e)=>{setComposeAttachments(p=>[...p,...Array.from(e.target.files||[])]);}, []);
  const removeAttachment = useCallback((i)=>{setComposeAttachments(p=>p.filter((_,j)=>j!==i));}, []);

  const loadThread = useCallback(async (email) => {
    if(!email?.threadId||!email?.accountId){setSelectedThread(null);setSelectedThreadActiveMessageId(null);return;}
    setIsLoadingThread(true);
    setCollapsedMsgIds(new Set()); // Reset collapse state for new thread
    setThreadExpanded(false);
    try {
      const r=await fetch(`${API_BASE}/emails/${email.accountId}/${email.threadId}/thread`,{credentials:'include'});
      if(r.ok){
        const d=await r.json(); const msgs=d.messages||[];
        setSelectedThread({threadId:email.threadId,messages:msgs});
        if(msgs.length>1){const last=msgs[msgs.length-1];setSelectedThreadActiveMessageId(last.id);const obj={id:last.id,threadId:last.threadId,subject:last.subject||email.subject,from:last.from||email.from,date:last.date||email.date,snippet:last.snippet||'',accountId:email.accountId,accountName:email.accountName,source:email.source};setSelectedEmail(obj);loadEmailDetails(obj);}
        else setSelectedThreadActiveMessageId(email.id);
      } else if(r.status===401) handleLogout();
      else{setSelectedThread(null);setSelectedThreadActiveMessageId(null);}
    } catch(err){console.error('Thread error:',err);setSelectedThread(null);setSelectedThreadActiveMessageId(null);}
    finally{setIsLoadingThread(false);}
  }, [handleLogout, loadEmailDetails]);

  useEffect(()=>{loadAccounts();}, [loadAccounts]);

  const handleGoogleLogin = useCallback(()=>{window.location.href=`${API_BASE}/auth/google`;}, []);
  const handleAddAccount = useCallback(()=>{window.location.href=`${API_BASE}/accounts/connect`;}, []);

  const openEventEdit = useCallback((ev) => {
    setEventEditFields({
      summary: ev.title || '',
      description: ev.description || '',
      location: ev.meta || '',
      date: ev.startISO ? ev.startISO.split('T')[0] : '',
      startTime: ev.startISO && ev.startISO.includes('T') ? ev.startISO.split('T')[1]?.substring(0, 5) : '',
      endTime: ev.endISO && ev.endISO.includes('T') ? ev.endISO.split('T')[1]?.substring(0, 5) : '',
    });
    setEventEditError(null);
    setEventEditSaving(false);
    setEventEditOpen(true);
  }, []);

  const closeEventEdit = useCallback(() => {
    setEventEditOpen(false);
    setEventEditError(null);
  }, []);

  const saveEventEdit = useCallback(async () => {
    if (!selectedEvent?.accountId || !selectedEvent?.id) return;
    setEventEditSaving(true);
    setEventEditError(null);

    const buildDatetime = (date, time) => {
      if (!date || !time) return undefined;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return { dateTime: `${date}T${time}:00`, timeZone: tz };
    };

    const patch = {};
    if (eventEditFields.summary !== undefined) patch.summary = eventEditFields.summary;
    if (eventEditFields.description !== undefined) patch.description = eventEditFields.description;
    if (eventEditFields.location !== undefined) patch.location = eventEditFields.location;
    const startDT = buildDatetime(eventEditFields.date, eventEditFields.startTime);
    const endDT = buildDatetime(eventEditFields.date, eventEditFields.endTime);
    if (startDT) patch.start = startDT;
    if (endDT) patch.end = endDT;

    const isNew = selectedEvent.id === 'new';

    if (!isNew) {
      const prevEvents = { ...events };
      setEvents(prev => {
        const accountEvents = prev[selectedEvent.accountId] || [];
        return { ...prev, [selectedEvent.accountId]: accountEvents.map(e => e.id === selectedEvent.id ? { ...e, title: eventEditFields.summary || e.title, meta: eventEditFields.location || e.meta } : e) };
      });
      setSelectedEvent(prev => prev ? { ...prev, title: eventEditFields.summary || prev.title, meta: eventEditFields.location || prev.meta } : prev);

      try {
        if (selectedEvent.calendarId) patch.calendarId = selectedEvent.calendarId;
        const r = await fetch(`${API_BASE}/cals/${selectedEvent.accountId}/events/${selectedEvent.id}`, {
          method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
        });
        if (!r.ok) { const body = await r.json().catch(() => ({})); throw new Error(body.message || body.error || 'Update failed'); }
        setEventEditOpen(false);
        loadEventsForAccount(selectedEvent.accountId);
      } catch (err) {
        setEvents(prevEvents);
        setEventEditError(err.message || 'Failed to save changes');
      } finally { setEventEditSaving(false); }
    } else {
      try {
        const r = await fetch(`${API_BASE}/cals/${selectedEvent.accountId}/events`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
        });
        if (!r.ok) { const body = await r.json().catch(() => ({})); throw new Error(body.message || body.error || 'Create failed'); }
        setEventEditOpen(false);
        setSelectedEvent(null);
        loadEventsForAccount(selectedEvent.accountId);
      } catch (err) {
        setEventEditError(err.message || 'Failed to create event');
      } finally { setEventEditSaving(false); }
    }
  }, [selectedEvent, eventEditFields, events, loadEventsForAccount]);

  const loadDocPreview = useCallback(async (doc, opts = {}) => {
    if (!doc?.id || !doc?.accountId) return;
    const silent = opts.silent === true;
    if (!silent) { setDocPreviewLoading(true); setDocPreview(null); }
    try {
      const r = await fetch(`${API_BASE}/docs/${doc.accountId}/${doc.id}/preview`, { credentials: 'include' });
      if (!silent) {
        if (r.ok) { setDocPreview(await r.json()); } else { setDocPreview({ type: 'none' }); }
      }
    } catch { if (!silent) setDocPreview({ type: 'none' }); }
    finally { if (!silent) setDocPreviewLoading(false); }
  }, []);

  const openSlideOverEmail = useCallback((email, index) => {
    setSlideOverDoc(null); setDocPreview(null); setSlideOverEmail(email);
    setSlideOverIndex(typeof index === 'number' ? index : null);
    document.body.style.overflow = 'hidden'; loadEmailDetails(email);
  }, [loadEmailDetails]);

  const openSlideOverDoc = useCallback((doc, index) => {
    setSlideOverEmail(null); setSlideOverDoc(doc);
    setSlideOverIndex(typeof index === 'number' ? index : null);
    document.body.style.overflow = 'hidden'; loadDocPreview(doc);
  }, [loadDocPreview]);

  const closeSlideOver = useCallback(() => {
    setSlideOverEmail(null); setSlideOverDoc(null); setSlideOverIndex(null); setDocPreview(null);
    document.body.style.overflow = '';
  }, []);

  useEffect(() => {
    if (!slideOverEmail && !slideOverDoc) return;
    const items = slideOverEmail ? evFilteredEmails.slice(0, 50) : evFilteredDocs;
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.key === 'Escape') { closeSlideOver(); return; }
      if (slideOverIndex === null || !items.length) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(slideOverIndex + 1, items.length - 1);
        if (next !== slideOverIndex) {
          setSlideOverIndex(next);
          if (slideOverEmail) { setSlideOverEmail(items[next]); loadEmailDetails(items[next]); }
          else { setSlideOverDoc(items[next]); loadDocPreview(items[next]); }
        }
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(slideOverIndex - 1, 0);
        if (prev !== slideOverIndex) {
          setSlideOverIndex(prev);
          if (slideOverEmail) { setSlideOverEmail(items[prev]); loadEmailDetails(items[prev]); }
          else { setSlideOverDoc(items[prev]); loadDocPreview(items[prev]); }
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [slideOverEmail, slideOverDoc, slideOverIndex, evFilteredEmails, evFilteredDocs, closeSlideOver, loadEmailDetails, loadDocPreview]);

  const filteredEmails = useMemo(() => {
    const isSnoozed = e => snoozedEmails[`${e.accountId || ''}_${e.id}`];
    if (!searchQuery) {
      return getCurrentEmails().filter(e => !isSnoozed(e));
    }
    // Cross-account search: when query is active, search ALL accounts and ALL categories
    const q = searchQuery.toLowerCase();
    const matchFn = e => (e.subject||'').toLowerCase().includes(q)||(e.from||'').toLowerCase().includes(q)||(e.snippet||'').toLowerCase().includes(q);
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

  useEffect(() => {
    if(!composeOpen) return;
    if(draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
    draftSaveTimeoutRef.current=setTimeout(()=>{if(saveDraftRef.current)saveDraftRef.current();},3000);
    return ()=>{if(draftSaveTimeoutRef.current)clearTimeout(draftSaveTimeoutRef.current);};
  }, [composeOpen, composeTo, composeCc, composeBcc, composeSubject, composeBody]);

  // ==================== ACTIONS ====================

  const clearSelection = useCallback(()=>setSelectedIds(new Set()), []);

  const switchAccount = useCallback((viewId) => {
    setActiveView(viewId);
    setSelectedEmail(null); setSelectedThread(null); setSelectedThreadActiveMessageId(null);
    setEditMode(false); clearSelection(); setFullPageReaderOpen(false);
  }, [clearSelection]);

  const navigatePrev = useCallback(() => {
    if(!selectedEmail) return; const i=filteredEmails.findIndex(e=>e.id===selectedEmail.id);
    if(i>0){const p=filteredEmails[i-1];setSelectedEmail(p);setShowMetadata(false);loadEmailDetails(p);loadThread(p);
    filteredEmails.slice(Math.max(0,i-5),i-1).forEach((e,j)=>setTimeout(()=>loadEmailDetails(e),(j+1)*100));}
  }, [selectedEmail, filteredEmails, loadEmailDetails, loadThread]);

  const navigateNext = useCallback(() => {
    if(!selectedEmail) return; const i=filteredEmails.findIndex(e=>e.id===selectedEmail.id);
    if(i<filteredEmails.length-1){const n=filteredEmails[i+1];setSelectedEmail(n);setShowMetadata(false);loadEmailDetails(n);loadThread(n);
    filteredEmails.slice(i+2,i+6).forEach((e,j)=>setTimeout(()=>loadEmailDetails(e),(j+1)*100));}
  }, [selectedEmail, filteredEmails, loadEmailDetails, loadThread]);

  // Ref holder for callbacks that are defined later in the component
  // (avoids temporal dead zone issues in the keyboard handler useEffect)
  const shortcutsRef = useRef({});

  useEffect(() => {
    const onKey = (e) => {
      // Cmd+K / Ctrl+K — open command palette (works from anywhere, including inputs)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen(p => !p);
        setPaletteQuery('');
        setPaletteIndex(0);
        return;
      }
      // j/k navigation — Gmail style
      if (!composeOpen && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        const inInput = tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.getAttribute?.('contenteditable') === 'true';
        if (!inInput && activeModule === 'mail') {
          if (e.key === 'j') {
            e.preventDefault();
            const idx = selectedEmail ? filteredEmails.findIndex(x => x.id === selectedEmail.id) : -1;
            const ni = Math.min(idx + 1, filteredEmails.length - 1);
            if (ni >= 0 && filteredEmails[ni]) { const ne = filteredEmails[ni]; setSelectedEmail(ne); loadEmailDetails(ne); loadThread(ne); }
            return;
          }
          if (e.key === 'k') {
            e.preventDefault();
            const idx = selectedEmail ? filteredEmails.findIndex(x => x.id === selectedEmail.id) : filteredEmails.length;
            const ni = Math.max(idx - 1, 0);
            if (filteredEmails[ni]) { const ne = filteredEmails[ni]; setSelectedEmail(ne); loadEmailDetails(ne); loadThread(ne); }
            return;
          }
          if (e.key === 'u' && selectedEmail) { e.preventDefault(); setSelectedEmail(null); setFullPageReaderOpen(false); return; }
          if (e.key === 'x' && selectedEmail) { e.preventDefault(); toggleSelectId(selectedEmail.id); return; }
          if (e.key === 's' && selectedEmail) { e.preventDefault(); starEmail(selectedEmail); return; }
          if (e.key === 'a' && selectedEmail) { e.preventDefault(); shortcutsRef.current.openCompose?.('replyAll', selectedEmail); return; }
          if (e.key === 'f' && selectedEmail) { e.preventDefault(); shortcutsRef.current.openCompose?.('forward', selectedEmail); return; }
          // Two-key sequences: g+i, g+s, g+d, g+t
          if (e.key === 'g') {
            lastKeyRef.current = 'g';
            if (lastKeyTimerRef.current) clearTimeout(lastKeyTimerRef.current);
            lastKeyTimerRef.current = setTimeout(() => { lastKeyRef.current = null; }, 500);
            return;
          }
          if (lastKeyRef.current === 'g') {
            lastKeyRef.current = null;
            if (lastKeyTimerRef.current) clearTimeout(lastKeyTimerRef.current);
            if (e.key === 'i') { e.preventDefault(); setActiveCategory('primary'); setActiveMailTab('primary'); return; }
            if (e.key === 's') { e.preventDefault(); setActiveCategory('primary'); setActiveMailTab('primary'); return; }
            if (e.key === 'd') { e.preventDefault(); setActiveCategory('drafts'); return; }
            if (e.key === 't') { e.preventDefault(); setActiveCategory('sent'); return; }
          }
        }
      }
      if(composeOpen) return;
      const tag=(document.activeElement?.tagName||'').toLowerCase();
      if(tag==='input'||tag==='textarea'||tag==='select'||document.activeElement?.getAttribute?.('contenteditable')==='true') return;
      // Cmd+A / Ctrl+A — select all visible emails when in mail view
      if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A') && activeModule === 'mail') {
        const sa = shortcutsRef.current.selectAllVisible;
        if (sa) {
          e.preventDefault();
          setEditMode(true);
          sa();
          return;
        }
      }
      if(e.key==='Escape'&&shortcutsOpen){e.preventDefault();setShortcutsOpen(false);return;}
      if(e.key==='Escape'&&splitMode==='none'&&fullPageReaderOpen){e.preventDefault();setFullPageReaderOpen(false);return;}
      if(e.key==='Enter'&&splitMode==='none'&&selectedEmail&&!fullPageReaderOpen){e.preventDefault();setFullPageReaderOpen(true);return;}
      if(e.metaKey||e.ctrlKey||e.altKey) return;
      if(e.key==='?'){e.preventDefault();setShortcutsOpen(true);return;}
      const readerOpen = selectedEmail && (splitMode!=='none' || fullPageReaderOpen);
      if(readerOpen){
        if(e.key==='ArrowLeft'){e.preventDefault();navigatePrev();return;}
        if(e.key==='ArrowRight'){e.preventDefault();navigateNext();return;}
        if(e.key==='ArrowUp'||e.key==='ArrowDown'){
          e.preventDefault();
          const el=readerScrollRef.current; if(!el) return;
          el.scrollBy({top:e.key==='ArrowDown'?120:-120,behavior:'smooth'});
          return;
        }
      } else {
        if(!selectedEmail) return;
        if(e.key==='ArrowDown'||e.key==='ArrowUp'){
          e.preventDefault();
          const idx=filteredEmails.findIndex(x=>x.id===selectedEmail.id); if(idx<0) return;
          const ni=e.key==='ArrowDown'?idx+1:idx-1; if(ni<0||ni>=filteredEmails.length) return;
          const ne=filteredEmails[ni]; setSelectedEmail(ne); setShowMetadata(false); loadEmailDetails(ne); loadThread(ne);
          requestAnimationFrame(()=>{const row=document.querySelector(`.email-item:nth-child(${ni+1})`);if(row)row.scrollIntoView({behavior:'smooth',block:'nearest'});});
        }
      }
      const s = shortcutsRef.current;
      if (e.key === 'e' && selectedEmail && s.archiveEmail) { e.preventDefault(); s.archiveEmail(selectedEmail); }
      if (e.key === '#' && selectedEmail && s.trashEmail) { e.preventDefault(); s.trashEmail(selectedEmail); }
      if (e.key === 'r' && selectedEmail && s.openCompose) { e.preventDefault(); s.openCompose('reply', selectedEmail); }
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && s.openCompose) { e.preventDefault(); s.openCompose('compose'); }
      if (e.key === '/' && !e.metaKey) { e.preventDefault(); searchInputRef.current?.focus(); }
    };
    window.addEventListener('keydown',onKey); return ()=>window.removeEventListener('keydown',onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmail, filteredEmails, loadEmailDetails, loadThread, composeOpen, splitMode, fullPageReaderOpen, navigatePrev, navigateNext, activeModule, shortcutsOpen]); // starEmail/toggleSelectId accessed via ref

  const goBackToList = useCallback(()=>{setSelectedEmail(null);setSelectedThread(null);setSelectedThreadActiveMessageId(null);setFullPageReaderOpen(false);setReaderCompact(false);}, []);

  const toggleSelectId = useCallback((id)=>{setSelectedIds(p=>{const n=new Set(p);if(n.has(id))n.delete(id);else n.add(id);return n;});}, []);
  const selectAllVisible = useCallback(()=>{setSelectedIds(()=>new Set(filteredEmails.map(e=>e.id)));}, [filteredEmails]);
  const selectedCount = selectedIds.size;

  const groupSelectedByAccount = useCallback(()=>{
    const m=new Map();for(const e of filteredEmails){if(!selectedIds.has(e.id)) continue;const a=e.accountId;if(!a) continue;if(!m.has(a))m.set(a,[]);m.get(a).push(e.id);}return m;
  }, [filteredEmails, selectedIds]);

  const removeEmailIds = useCallback((aid,ids)=>{
    setEmails(p=>{const c={...p};const cats=c[aid]||{};const u={};for(const k of Object.keys(cats)){u[k]=(cats[k]||[]).filter(e=>!ids.includes(e.id));}c[aid]=u;return c;});
  }, []);

  const trashEmail = useCallback((email) => {
    if(!email?.id||!email?.accountId) return;
    // Optimistically remove from UI
    const snapshot = { ...emails };
    removeEmailIds(email.accountId,[email.id]);
    if(selectedEmail?.id===email.id){setSelectedEmail(null);setSelectedThread(null);setSelectedThreadActiveMessageId(null);setShowMetadata(false);setFullPageReaderOpen(false);}
    const executeFn = async () => {
      try{const r=await fetch(`${API_BASE}/emails/${email.accountId}/${email.id}/trash`,{method:'POST',credentials:'include'});
      if(!r.ok){setEmails(snapshot);setError('Failed to delete');}}
      catch(err){setEmails(snapshot);setError('Failed to delete');}
    };
    const undoFn = () => { setEmails(snapshot); setSuccessToast(null); };
    setSuccessToast({ message: 'Email deleted', undoFn, executeFn });
  }, [selectedEmail, removeEmailIds, emails]);

  const archiveEmail = useCallback((email) => {
    if(!email?.id||!email?.accountId) return;
    const snapshot = { ...emails };
    removeEmailIds(email.accountId,[email.id]);
    if(selectedEmail?.id===email.id){setSelectedEmail(null);setSelectedThread(null);setSelectedThreadActiveMessageId(null);setShowMetadata(false);setFullPageReaderOpen(false);}
    const executeFn = async () => {
      try{const r=await fetch(`${API_BASE}/emails/${email.accountId}/${email.id}/archive`,{method:'POST',credentials:'include'});
      if(!r.ok){setEmails(snapshot);setError('Failed to archive');}}
      catch(err){setEmails(snapshot);setError('Failed to archive');}
    };
    const undoFn = () => { setEmails(snapshot); setSuccessToast(null); };
    setSuccessToast({ message: 'Email archived', undoFn, executeFn });
  }, [selectedEmail, removeEmailIds, emails]);

  // Toggle star on email — optimistic update + API call
  const starEmail = useCallback(async (email) => {
    if (!email?.id || !email?.accountId) return;
    const key = email.id;
    const currentlyStarred = starredOverrides[key] !== undefined ? starredOverrides[key] : email.isStarred;
    const newStarred = !currentlyStarred;

    // Optimistic update
    setStarredOverrides(prev => ({ ...prev, [key]: newStarred }));

    try {
      await fetch(`${API_BASE}/emails/${email.accountId}/${email.id}/star`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: newStarred }),
      });
    } catch (err) {
      // Revert on failure
      setStarredOverrides(prev => ({ ...prev, [key]: currentlyStarred }));
    }
  }, [starredOverrides]);

  // Cross-account API search (Phase 6)
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
      // Store results in a special 'search' category for all accounts
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
      setShowMetadata(false); setFullPageReaderOpen(false);
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
  }, [selectedIds, emails, groupSelectedByAccount, removeEmailIds, selectedEmail, clearSelection]);

  const openCompose = useCallback(async (mode, email=null) => {
    setComposeError(null);setComposeMode(mode);setComposeOriginalEmail(email);setComposeShowCcBcc(false);
    const defaultFrom=mode==='compose'?(activeView!=='everything'?activeView:connectedAccounts[0]?.id||''):(email?.accountId||connectedAccounts[0]?.id||'');
    setComposeFromAccountId(defaultFrom);
    let to='',cc='',bcc='',subject='',body='';
    if(mode!=='compose'&&email){
      await loadEmailDetails(email); const h=emailHeaders[email.id]||{};
      const oFrom=h.replyTo||h.from||email.from||'',oTo=h.to||'',oCc=h.cc||'',oSubj=h.subject||email.subject||'';
      if(mode==='reply'){to=getEmailOnly(oFrom);subject=ensurePrefix(oSubj,'Re:');body=`\n\n--- Original message ---\n${stripName(oFrom)}\n${email.snippet||''}\n`;}
      if(mode==='replyAll'){const me=(connectedAccounts.find(a=>a.id===defaultFrom)?.gmail_email||'').toLowerCase();const tl=uniqLower(splitList(getEmailOnly(oFrom)));const cl=uniqLower([...splitList(oTo),...splitList(oCc)]);const tf=tl.filter(x=>getEmailOnly(x).toLowerCase()!==me);const cf=cl.filter(x=>getEmailOnly(x).toLowerCase()!==me);to=(tf[0]||getEmailOnly(oFrom)).trim();cc=uniqLower([...tf.slice(1),...cf]).join(', ');subject=ensurePrefix(oSubj,'Re:');body=`\n\n--- Original message ---\n${stripName(oFrom)}\n${email.snippet||''}\n`;}
      if(mode==='forward'){subject=ensurePrefix(oSubj,'Fwd:');body=`\n\n--- Forwarded message ---\nFrom: ${stripName(h.from||email.from||'')}\nDate: ${h.date||new Date(email.date).toLocaleString()}\nSubject: ${h.subject||email.subject||''}\nTo: ${h.to||''}\n${h.cc?`Cc: ${h.cc}\n`:''}\n${email.snippet||''}\n`;}
    }
    setComposeTo(to);setComposeCc(cc);setComposeBcc(bcc);setComposeSubject(subject);setComposeBody(body);setComposeOpen(true);
  }, [activeView, connectedAccounts, emailHeaders, loadEmailDetails]);

  const saveDraft = useCallback(async () => {
    const fid=composeFromAccountId; if(!fid) return;
    if(!composeTo.trim()&&!composeSubject.trim()&&!composeBody.trim()) return;
    try{const r=await fetch(`${API_BASE}/emails/${fid}/drafts`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:composeTo.trim(),cc:composeCc.trim(),bcc:composeBcc.trim(),subject:composeSubject.trim(),body:composeBody,threadId:composeOriginalEmail?.threadId||null,draftId:composeDraftId||null})});if(r.ok){const d=await r.json();if(d.draftId&&d.draftId!==composeDraftId)setComposeDraftId(d.draftId);}}
    catch(err){console.error('Draft save error:',err);}
  }, [composeFromAccountId,composeTo,composeCc,composeBcc,composeSubject,composeBody,composeOriginalEmail,composeDraftId]);

  useEffect(()=>{saveDraftRef.current=saveDraft;}, [saveDraft]);

  // Sync the keyboard shortcut callbacks ref now that they're defined
  useEffect(() => {
    shortcutsRef.current = { archiveEmail, trashEmail, openCompose, selectAllVisible };
  }, [archiveEmail, trashEmail, openCompose, selectAllVisible]);

  // Batch-prefetch the visible inbox — one HTTP request warms up to 50 emails in parallel.
  // Fires 100ms after the list settles so it doesn't race the initial render.
  useEffect(() => {
    if (filteredEmails.length === 0) return;

    // Group uncached emails by account
    const byAccount = {};
    filteredEmails.slice(0, 50).forEach(email => {
      if (emailBodiesRef.current[email.id] && emailHeadersRef.current[email.id]) return;
      const aid = email.accountId;
      if (!aid) return;
      if (!byAccount[aid]) byAccount[aid] = [];
      byAccount[aid].push(email.id);
    });

    if (Object.keys(byAccount).length === 0) return;

    const timer = setTimeout(() => {
      Object.entries(byAccount).forEach(([accountId, ids]) => {
        // Send in chunks of 25 (backend limit) if more than 25 per account
        const chunks = [];
        for (let i = 0; i < ids.length; i += 25) chunks.push(ids.slice(i, i + 25));
        chunks.forEach(chunk => fetch(`${API_BASE}/emails/${accountId}/batch-bodies`, {
          method: 'POST',
          credentials: 'include',
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

  // Persist snoozed emails to localStorage
  useEffect(() => { localStorage.setItem('atm_snoozed', JSON.stringify(snoozedEmails)); }, [snoozedEmails]);

  // Check snoozed emails every 60 seconds — un-snooze when time is up
  useEffect(() => {
    const checkSnoozed = () => {
      const now = Date.now();
      setSnoozedEmails(prev => {
        const updated = { ...prev };
        let changed = false;
        for (const key of Object.keys(updated)) {
          if (new Date(updated[key].until).getTime() <= now) {
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

  const snoozeEmail = useCallback((email, until) => {
    if (!email?.id) return;
    const key = `${email.accountId || ''}_${email.id}`;
    setSnoozedEmails(prev => ({ ...prev, [key]: { emailId: email.id, accountId: email.accountId, until: until.toISOString() } }));
    setSnoozeDropdownEmailId(null);
    setSuccessToast({ message: `Snoozed until ${new Date(until).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}` });
    // Clear selected email if it was snoozed
    if (selectedEmail?.id === email.id) {
      setSelectedEmail(null); setSelectedThread(null); setSelectedThreadActiveMessageId(null);
      setShowMetadata(false); setFullPageReaderOpen(false);
    }
  }, [selectedEmail]);

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

  // Persist scheduled sends to localStorage
  useEffect(() => { localStorage.setItem('atm_scheduled_sends', JSON.stringify(scheduledSends)); }, [scheduledSends]);

  // Persist active mail tab
  useEffect(() => { localStorage.setItem('atm_mail_tab', activeMailTab); }, [activeMailTab]);

  // Check scheduled sends every 30 seconds — send when time is up
  useEffect(() => {
    const checkScheduled = async () => {
      const now = Date.now();
      const due = scheduledSends.filter(s => new Date(s.scheduledFor).getTime() <= now);
      if (due.length === 0) return;
      for (const item of due) {
        try {
          await fetch(`${API_BASE}/emails/${item.accountId}/send`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'compose', to: item.to, cc: item.cc || '', bcc: item.bcc || '', subject: item.subject, body: item.body, includeSignature: true }),
          });
        } catch (err) { console.error('Scheduled send failed:', err); }
      }
      setScheduledSends(prev => prev.filter(s => new Date(s.scheduledFor).getTime() > now));
    };
    checkScheduled();
    const interval = setInterval(checkScheduled, 30000);
    return () => clearInterval(interval);
  }, [scheduledSends]);

  const scheduleSend = useCallback((scheduledFor) => {
    const fid = composeFromAccountId;
    if (!fid) { setComposeError('Select a sending account'); return; }
    if (!composeTo.trim()) { setComposeError('Recipient is required'); return; }
    setScheduledSends(prev => [...prev, {
      to: composeTo.trim(), cc: composeCc.trim(), bcc: composeBcc.trim(),
      subject: composeSubject.trim(), body: composeBody,
      accountId: fid, scheduledFor: scheduledFor.toISOString(),
    }]);
    setComposeOpen(false); setComposeOriginalEmail(null); setComposeAttachments([]); setComposeDraftId(null);
  }, [composeFromAccountId, composeTo, composeCc, composeBcc, composeSubject, composeBody]);


  const closeCompose = useCallback(async ()=>{
    if(composeSending) return; await saveDraft(); setComposeOpen(false);setComposeError(null);setComposeOriginalEmail(null);setComposeAttachments([]);setComposeDraftId(null);
    if(composeFromAccountId) await loadEmailsForAccount(composeFromAccountId,'drafts');
  }, [composeSending, saveDraft, composeFromAccountId, loadEmailsForAccount]);

  const sendCompose = useCallback(async () => {
    setComposeError(null);
    const fid=composeFromAccountId; if(!fid){setComposeError('Select a sending account');return;} if(!composeTo.trim()){setComposeError('Recipient is required');return;}
    setComposeSending(true);
    const sigLine = includeAtmSignature ? '<br><div style="margin-top:16px;padding-top:12px;border-top:1px solid #eee;font-size:12px;color:#999;">Sent via <a href="https://allthemail.io" style="color:#8b7cff;text-decoration:none;">All The Mail</a></div>' : '';
    const bodyWithSig = composeBody + sigLine;
    try{
      let r;
      if(composeAttachments.length>0){const fd=new FormData();fd.append('to',composeTo.trim());fd.append('subject',composeSubject.trim());fd.append('body',bodyWithSig);if(composeCc.trim())fd.append('cc',composeCc.trim());if(composeBcc.trim())fd.append('bcc',composeBcc.trim());if(composeOriginalEmail?.threadId)fd.append('threadId',composeOriginalEmail.threadId);if(composeDraftId)fd.append('draftId',composeDraftId);composeAttachments.forEach(f=>fd.append('attachments',f));r=await fetch(`${API_BASE}/emails/${fid}/send`,{method:'POST',credentials:'include',body:fd});}
      else{r=await fetch(`${API_BASE}/emails/${fid}/send`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:composeMode,to:composeTo.trim(),cc:composeCc.trim(),bcc:composeBcc.trim(),subject:composeSubject.trim(),body:bodyWithSig,originalEmailId:composeOriginalEmail?.id||null,threadId:composeOriginalEmail?.threadId||null,draftId:composeDraftId||null,includeSignature:true})});}
      if(r.ok){await loadEmailsForAccount(fid,activeCategory);await loadEmailsForAccount(fid,'drafts');if(activeView==='everything')connectedAccounts.forEach(a=>{if(a.id!==fid)loadEmailsForAccount(a.id,activeCategory);});setComposeOpen(false);setComposeOriginalEmail(null);setComposeAttachments([]);setComposeDraftId(null);setSuccessToast({ message: 'Message sent' });}
      else{const d=await r.json().catch(()=>({}));setComposeError(d?.error||'Send failed. If permissions changed, reconnect the account.');}
    } catch(err){setComposeError(String(err?.message||err));} finally{setComposeSending(false);}
  }, [composeFromAccountId,composeMode,composeTo,composeCc,composeBcc,composeSubject,composeBody,composeOriginalEmail,composeAttachments,composeDraftId,loadEmailsForAccount,activeCategory,activeView,connectedAccounts,includeAtmSignature]);

  const sendComposeWithDelay = useCallback(() => {
    if (sendDelaySeconds === 0) {
      sendCompose();
      return;
    }
    const previewSubject = composeSubject.trim() || '(no subject)';
    setComposeOpen(false);
    let secondsLeft = sendDelaySeconds;
    const interval = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearInterval(interval);
        setPendingSend(null);
        sendCompose();
      } else {
        setPendingSend(prev => prev ? { ...prev, secondsLeft } : { secondsLeft, previewSubject, interval });
      }
    }, 1000);
    setPendingSend({ secondsLeft, previewSubject, interval });
  }, [sendDelaySeconds, sendCompose, composeSubject]);

  const cancelPendingSend = useCallback(() => {
    if (pendingSend?.interval) clearInterval(pendingSend.interval);
    setPendingSend(null);
    setComposeOpen(true);
  }, [pendingSend]);

  const onSelectEmail = useCallback((email) => {
    setSelectedEmail(email);setShowMetadata(false);setReaderCompact(false);loadEmailDetails(email);loadThread(email);setSelectedThreadActiveMessageId(email.id);
    if(splitMode==='none') setFullPageReaderOpen(true);
    // Prefetch the next 10 emails so sequential reading never hits a cold load
    const idx = filteredEmails.findIndex(e => e.id === email.id);
    if (idx >= 0) filteredEmails.slice(idx + 1, idx + 11).forEach((e, i) => setTimeout(() => loadEmailDetails(e), (i + 1) * 80));
  }, [loadEmailDetails, loadThread, splitMode, filteredEmails]);

  const useStackedRows = listWidth < 520;

  // ==================== SPLIT ICONS ====================
  const SplitNoneIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>);
  const SplitVerticalIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="8" height="18" rx="1"/><rect x="13" y="3" width="8" height="18" rx="1"/></svg>);
  const SplitHorizontalIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="8" rx="1"/><rect x="3" y="13" width="18" height="8" rx="1"/></svg>);

  // ==================== RENDER: GMAIL READER ====================
  const renderReader = (email, opts = {}) => {
    if (!email) return (
      <div className="empty-state">
        <div style={{ textAlign: 'center' }}>
          <Mail size={72} style={{ display: 'block', margin: '0 auto 16px', opacity: 0.04 }} />
          <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>Select a message</div>
          <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Use arrow keys to navigate</div>
        </div>
      </div>
    );

    const emailIdx = filteredEmails.findIndex(e => e.id === email.id);
    const emailCount = filteredEmails.length;
    const isFullPage = opts.fullPage;

    return (
      <div className="reader-root" key={email.id} onScroll={handleReaderScroll} ref={readerScrollRef}>
        <div className="reader-toolbar">
          <div className="reader-toolbar-left">
            {isFullPage && (<button className="reader-toolbar-btn" onClick={goBackToList} title="Back to inbox" aria-label="Back to inbox"><ArrowLeft size={16} strokeWidth={1.5} /></button>)}
            <button className="reader-toolbar-btn" onClick={() => archiveEmail(email)} title="Archive" aria-label="Archive email"><Archive size={16} strokeWidth={1.5} /></button>
            <button className="reader-toolbar-btn danger" onClick={() => trashEmail(email)} title="Delete" aria-label="Delete email"><Trash2 size={16} strokeWidth={1.5} /></button>
            <div style={{ position: 'relative' }}>
              <button className="reader-toolbar-btn" onClick={() => setSnoozeDropdownEmailId(prev => prev === email.id ? null : email.id)} title="Snooze" aria-label="Snooze email" aria-expanded={snoozeDropdownEmailId === email.id} aria-haspopup="true"><Clock size={16} strokeWidth={1.5} /></button>
              {snoozeDropdownEmailId === email.id && (
                <div onMouseDown={e => e.stopPropagation()} className="dropdown-menu" role="menu">
                  {getSnoozeOptions().map(opt => (
                    <button key={opt.label} className="dropdown-item" role="menuitem" onClick={() => snoozeEmail(email, opt.time)}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="reader-toolbar-btn" title="More actions" aria-label="More actions" aria-haspopup="true"><MoreHorizontal size={16} strokeWidth={1.5} /></button>
          </div>
          <div className="reader-toolbar-right">
            <button className="reader-toolbar-btn" onClick={navigatePrev} disabled={emailIdx <= 0} title="Previous email" aria-label="Previous email"><ChevronLeft size={16} strokeWidth={1.5} /></button>
            <span className="reader-toolbar-count" aria-live="polite" aria-atomic="true">{emailIdx >= 0 ? emailIdx + 1 : '–'} of {emailCount}</span>
            <button className="reader-toolbar-btn" onClick={navigateNext} disabled={emailIdx >= emailCount - 1} title="Next email" aria-label="Next email"><ChevronRight size={16} strokeWidth={1.5} /></button>
          </div>
        </div>
        <div className={`reader-content${readerCompact ? ' reader--compact' : ''}`}>
          <h1 className="reader-subject">{email.subject || '(no subject)'}</h1>
          <div className="reader-meta">
            <Avatar email={getEmailOnly(email.from || '')} name={stripName(email.from || '')} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '4px' }}>
                <span className="reader-sender">{stripName(email.from || '')}</span>
                <span className="reader-sender-email">{getEmailOnly(email.from || '')}</span>
              </div>
              {showMetadata && (
                <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.6 }}>
                  <div>From: {emailHeaders[email.id]?.from || email.from}</div>
                  <div>To: {emailHeaders[email.id]?.to || '(loading...)'}</div>
                  {emailHeaders[email.id]?.cc && <div>Cc: {emailHeaders[email.id]?.cc}</div>}
                  <div>Date: {emailHeaders[email.id]?.date || new Date(email.date).toLocaleString()}</div>
                </div>
              )}
            </div>
            <span className="reader-date">{new Date(email.date).toLocaleString()}</span>
            <button onClick={() => setShowMetadata(!showMetadata)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: '4px', display: 'flex', alignItems: 'center', flexShrink: 0 }} title={showMetadata ? 'Hide details' : 'Show details'}>
              {showMetadata ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
          <div className="reader-actions-row">
            <button className="reader-action-icon" onClick={() => openCompose('reply', email)} title="Reply" aria-label="Reply"><Reply size={16} strokeWidth={1.5} /></button>
            <button className="reader-action-icon" onClick={() => openCompose('replyAll', email)} title="Reply all" aria-label="Reply all"><Users size={16} strokeWidth={1.5} /></button>
            <button className="reader-action-icon" onClick={() => openCompose('forward', email)} title="Forward" aria-label="Forward"><Forward size={16} strokeWidth={1.5} /></button>
          </div>
          {/* Phase 8: Label chips */}
          {email.labelIds && email.labelIds.filter(l => !['INBOX','UNREAD','IMPORTANT'].includes(l)).length > 0 && (
            <div className="label-chips">
              {email.labelIds
                .filter(l => !['INBOX','UNREAD','IMPORTANT'].includes(l))
                .map(labelId => {
                  const isSystem = ['STARRED','SENT','DRAFT','TRASH','CATEGORY_PERSONAL','CATEGORY_PROMOTIONS','CATEGORY_SOCIAL','CATEGORY_UPDATES','CATEGORY_FORUMS'].includes(labelId);
                  const labelName = labelId.startsWith('CATEGORY_') ? labelId.replace('CATEGORY_', '').toLowerCase()
                    : labelId.charAt(0) + labelId.slice(1).toLowerCase();
                  return (
                    <span key={labelId} className={`label-chip${isSystem ? ' label-chip-system' : ''}`}>
                      {labelName}
                      {!isSystem && (
                        <button className="label-chip-remove" title="Remove label" onClick={async () => {
                          if (!email.accountId) return;
                          await fetch(`${API_BASE}/emails/${email.accountId}/${email.id}/labels`, {
                            method: 'POST', credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ removeLabelIds: [labelId] }),
                          });
                          setEmails(prev => {
                            const n = { ...prev };
                            Object.keys(n).forEach(ai => {
                              Object.keys(n[ai] || {}).forEach(c => {
                                if (n[ai][c]) n[ai][c] = n[ai][c].map(e2 =>
                                  e2.id === email.id ? { ...e2, labelIds: (e2.labelIds || []).filter(l => l !== labelId) } : e2
                                );
                              });
                            });
                            return n;
                          });
                        }}>
                          <X size={10} />
                        </button>
                      )}
                    </span>
                  );
                })}
            </div>
          )}
          {/* Phase 5: Thread collapsing */}
          {email.threadId && selectedThread?.messages?.length > 1 && !isLoadingThread && (() => {
            const msgs = selectedThread.messages;
            const newestMsg = msgs[msgs.length - 1];

            // Initialize: newest expanded, rest collapsed (unless user toggled)
            const isCollapsed = (m) => {
              if (threadExpanded) return false;
              if (collapsedMsgIds.has(m.id)) return true;
              // By default: only newest is expanded, all others collapsed
              if (!collapsedMsgIds.has('__initialized__')) return m.id !== newestMsg.id;
              return false;
            };

            const toggleMsg = (m) => {
              setCollapsedMsgIds(prev => {
                const next = new Set(prev);
                next.add('__initialized__');
                if (next.has(m.id)) next.delete(m.id); else next.add(m.id);
                return next;
              });
            };

            const hiddenMidCount = msgs.length > 4 ? msgs.length - 3 : 0;
            const showHiddenMid = threadExpanded || collapsedMsgIds.has('__showmid__');

            return (
              <div style={{ marginBottom: 16 }}>
                <div className="thread-controls">
                  <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>
                    Conversation · {msgs.length} messages
                  </span>
                  <button className="thread-control-btn" onClick={() => {
                    setThreadExpanded(false);
                    setCollapsedMsgIds(new Set());
                  }}>Collapse all</button>
                  <button className="thread-control-btn" onClick={() => {
                    setThreadExpanded(true);
                    setCollapsedMsgIds(new Set(['__initialized__']));
                  }}>Expand all</button>
                </div>

                {msgs.map((m, mi) => {
                  const collapsed = isCollapsed(m);
                  const isNewest = m.id === newestMsg.id;

                  // Hidden middle messages
                  if (!showHiddenMid && hiddenMidCount > 0 && mi > 0 && mi < msgs.length - 2 && mi <= msgs.length - 3) {
                    if (mi === 1) {
                      return (
                        <button key="hidden-mid" className="thread-collapsed-group"
                          onClick={() => setCollapsedMsgIds(prev => { const n = new Set(prev); n.add('__showmid__'); return n; })}>
                          <ChevronDown size={14} strokeWidth={1.5} style={{ opacity: 0.5 }} />
                          {hiddenMidCount} older messages
                        </button>
                      );
                    }
                    if (mi > 1 && mi < msgs.length - 2) return null;
                  }

                  if (collapsed) {
                    return (
                      <div key={m.id} className="thread-message-collapsed" onClick={() => toggleMsg(m)}>
                        <Avatar email={getEmailOnly(m.from || '')} name={stripName(m.from || '')} size={24} />
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)', flexShrink: 0, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stripName(m.from || '')}</span>
                        <span className="thread-message-collapsed-snippet">{m.snippet || ''}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-3)', flexShrink: 0 }}>{formatTime(m.date || '')}</span>
                      </div>
                    );
                  }

                  // Expanded message
                  const msgBody = isNewest ? emailBodies[email.id] : emailBodies[m.id];
                  const msgHeaders = isNewest ? emailHeaders[email.id] : emailHeaders[m.id];
                  const expandedBody = !!expandedBodies[m.id];

                  return (
                    <div key={m.id} style={{ border: '1px solid var(--line-0)', borderRadius: 'var(--r-sm)', marginBottom: 8, overflow: 'hidden' }}>
                      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', background: 'var(--bg-2)' }}
                        onClick={() => !isNewest && toggleMsg(m)}>
                        <Avatar email={getEmailOnly(m.from || '')} name={stripName(m.from || '')} size={32} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-0)' }}>{stripName(m.from || '')}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{getEmailOnly(m.from || '')}</span>
                          </div>
                          {msgHeaders?.to && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 2 }}>To: {msgHeaders.to}</div>}
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-3)', flexShrink: 0 }}>{formatTime(m.date || email.date)}</span>
                        {isNewest && (
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <button className="reader-action-icon" onClick={e => { e.stopPropagation(); openCompose('reply', email); }} title="Reply"><Reply size={14} strokeWidth={1.5} /></button>
                            <button className="reader-action-icon" onClick={e => { e.stopPropagation(); openCompose('forward', email); }} title="Forward"><Forward size={14} strokeWidth={1.5} /></button>
                          </div>
                        )}
                      </div>
                      <div style={{ background: 'var(--email-bg)' }}>
                        {!msgBody ? (
                          <div style={{ padding: '16px', fontSize: '13px', color: 'var(--text-3)' }}>
                            {m.snippet || 'Loading...'}
                          </div>
                        ) : (
                          <>
                            <iframe
                              title={`Thread message ${m.id}`}
                              srcDoc={buildEmailSrcDoc(msgBody)}
                              sandbox="allow-same-origin allow-popups"
                              scrolling="no"
                              style={{ width: '100%', border: 'none', display: 'block', background: 'var(--email-bg)' }}
                              onLoad={e => {
                                const iframe = e.target;
                                if (!iframe?.contentDocument?.body) return;
                                const resize = () => { try { const h = iframe.contentDocument.body.scrollHeight; if (h > 0) iframe.style.height = (expandedBody ? h : Math.min(h, 360)) + 'px'; } catch(_) {} };
                                resize(); setTimeout(resize, 200); setTimeout(resize, 800);
                              }}
                            />
                            {!expandedBody && msgBody.length > 2000 && (
                              <button className="expand-message-btn" onClick={() => setExpandedBodies(prev => ({ ...prev, [m.id]: true }))}>View entire message</button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div className="email-body-wrapper">
            {isLoadingBody ? (
              <div style={{ padding: '32px', background: 'var(--email-bg)' }}>
                {email.snippet
                  ? <p style={{ color: 'rgba(0,0,0,0.45)', fontSize: '0.875rem', lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>{email.snippet}</p>
                  : <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(0,0,0,0.35)', fontSize: '0.9375rem' }}>Loading…</div>
                }
              </div>
            ) : (
              <iframe title="Email content" ref={iframeRef}
                sandbox="allow-same-origin allow-popups"
                srcDoc={buildEmailSrcDoc(emailBodies[email.id] || '<div style="padding:16px;">(no content)</div>')}
                scrolling="no"
                onLoad={() => {
                  if (iframeResizeCleanupRef.current) iframeResizeCleanupRef.current();
                  const iframe = iframeRef.current;
                  if (!iframe?.contentDocument?.body) return;
                  const resize = () => { try { const h = iframe.contentDocument.body.scrollHeight; if (h > 0) iframe.style.height = h + 'px'; } catch(e) {} };
                  resize();
                  const timers = [100, 500, 1000, 2000].map(ms => setTimeout(resize, ms));
                  const imgs = [];
                  try { Array.from(iframe.contentDocument.images || []).forEach(img => { if (!img.complete) { img.addEventListener('load', resize); imgs.push(img); } }); } catch(e) {}
                  let ro; try { ro = new ResizeObserver(resize); ro.observe(iframe.contentDocument.body); } catch(e) {}
                  iframeResizeCleanupRef.current = () => { timers.forEach(clearTimeout); imgs.forEach(i => { try { i.removeEventListener('load', resize); } catch(e) {} }); if (ro) ro.disconnect(); };
                }}
                style={{ width: '100%', border: '0', display: 'block', background: 'var(--email-bg)', borderRadius: '8px', overflow: 'hidden' }} />
            )}
          </div>
          {emailAttachments[email.id]?.length > 0 && (
            <div className="attachment-section">
              <div className="attachment-header">
                <Paperclip size={13} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                {emailAttachments[email.id].length} attachment{emailAttachments[email.id].length !== 1 ? 's' : ''}
              </div>
              <div className="attachment-list">
                {emailAttachments[email.id].map((att, idx) => (
                  <button key={idx} className="btn-ghost" onClick={() => downloadAttachment(email.accountId, email.id, att.attachmentId, att.filename, att.mimeType)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Paperclip size={14} /><span style={{ fontSize: '13px' }}>{att.filename}</span>
                      <span style={{ fontSize: '11px', opacity: 0.5 }}>({(att.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <Download size={14} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ==================== RENDER: EMAIL LIST ====================
  const renderEmailList = () => (
    <div className={`email-list${activeView === 'everything' ? ' messageListSurface' : ''}`} ref={listContainerRef}>
      {activeView === 'everything' && (
        <div style={{ borderBottom: '1px solid var(--line-0)', background: 'transparent' }}>
          <div className="ev-header">
            <div className="ev-dots"><span /><span /><span /></div>
            <span className="ev-title">{activeView === 'everything' ? 'All inboxes' : (connectedAccounts.find(a => a.id === activeView)?.account_name || connectedAccounts.find(a => a.id === activeView)?.gmail_email || 'Inbox')}</span>
            <span className="ev-wordmark">All the mail</span>
          </div>
        </div>
      )}
      <div style={{ borderBottom: '1px solid var(--line)' }}>
        {/* Search bar (Phase 6) */}
        <div style={{ padding: '10px 16px 6px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="search-pill" style={{ flex: 1, minWidth: 0, position: 'relative' }}>
              <Search size={14} />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setShowSearchSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 150)}
                onKeyDown={e => { if (e.key === 'Enter' && searchQuery.trim()) { searchAllAccounts(searchQuery); setShowSearchSuggestions(false); } if (e.key === 'Escape') { setSearchQuery(''); searchInputRef.current?.blur(); } }}
                placeholder="Search mail…"
              />
              {searchQuery && <button style={{ background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center' }} onClick={() => setSearchQuery('')}><X size={13} /></button>}
            </div>
            {searchQuery.trim() && !savedSearches.includes(searchQuery.trim()) && (
              <button className="btn-ghost" onClick={() => setSavedSearches(prev => [searchQuery.trim(), ...prev].slice(0, 10))} style={{ padding: '4px 10px', fontSize: 11 }} title="Save search">Save</button>
            )}
          </div>
          {/* Search operator suggestions */}
          {showSearchSuggestions && !searchQuery && (
            <div className="search-suggestions">
              {['from:', 'to:', 'subject:', 'has:attachment', 'is:unread', 'is:starred', 'before:', 'after:', 'label:', 'in:inbox'].map(op => (
                <button key={op} className="search-suggestion-item" onMouseDown={() => { setSearchQuery(op); searchInputRef.current?.focus(); }}>
                  <Search size={11} strokeWidth={1.5} style={{ opacity: 0.5 }} />{op}
                </button>
              ))}
            </div>
          )}
        </div>
        {savedSearches.length > 0 && !searchQuery && (
          <div className="saved-searches">
            <div className="saved-searches-label">Saved</div>
            <div className="saved-searches-list">
              {savedSearches.map(q => (
                <div key={q} className="saved-search-chip">
                  <button onClick={() => setSearchQuery(q)} className="saved-search-chip-btn"><Search size={11} strokeWidth={1.5} /> {q}</button>
                  <button onClick={() => setSavedSearches(prev => prev.filter(s => s !== q))} className="saved-search-chip-x" title="Remove"><X size={11} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Batch action bar */}
        {selectedCount > 0 && (
          <div style={{ padding: '4px 16px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => { if (selectedCount === filteredEmails.length) clearSelection(); else selectAllVisible(); }} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-2)' }}>
              {selectedCount === filteredEmails.length ? <CheckSquare size={15} /> : <MinusSquare size={15} />}
            </button>
            <span style={{ fontSize: '11px', color: 'var(--text-3)', flex: 1 }}>{selectedCount} selected</span>
            <button className="btn-ghost" disabled={batchWorking} onClick={() => batchAction('archive')} style={{ padding: '4px 10px', fontSize: 11 }}><Archive size={12} /> Archive</button>
            <button className="btn-ghost danger" disabled={batchWorking} onClick={() => batchAction('trash')} style={{ padding: '4px 10px', fontSize: 11 }}><Trash2 size={12} /> Delete</button>
          </div>
        )}

        {/* Category tabs (Phase 4) */}
        {['primary','social','promotions','updates'].includes(activeCategory) || activeCategory === 'primary' ? (
          <div className="mail-category-tabs">
            {[
              { key: 'primary', label: 'Primary' },
              { key: 'promotions', label: 'Promotions' },
              { key: 'social', label: 'Social' },
              { key: 'updates', label: 'Updates' },
            ].map(tab => {
              const unreadCount = (() => {
                if (activeView === 'everything') {
                  return connectedAccounts.reduce((sum, a) => {
                    const catEmails = emails[a.id]?.[tab.key] || [];
                    return sum + catEmails.filter(e => !e.isRead).length;
                  }, 0);
                }
                return (emails[activeView]?.[tab.key] || []).filter(e => !e.isRead).length;
              })();
              return (
                <button
                  key={tab.key}
                  className={`mail-cat-tab${activeMailTab === tab.key ? ' active' : ''}`}
                  onClick={() => { setActiveMailTab(tab.key); setActiveCategory(tab.key); }}
                >
                  {tab.label}
                  {unreadCount > 0 && <span className="mail-cat-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '4px 16px 2px', fontSize: '12px', color: 'var(--text-2)', fontWeight: 500 }}>
            {activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)}
          </div>
        )}
      </div>
      {isLoadingEmails && filteredEmails.length === 0 ? (
        Array.from({ length: 8 }).map((_, i) => (
          <div className="skeleton-row" key={`sk-${i}`} style={{ minHeight: rowHeight }}>
            <div className="skeleton-block" style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0 }} />
            <div className="skeleton-block" style={{ width: 10, height: 10, borderRadius: 999, flexShrink: 0 }} />
            <div className="skeleton-block" style={{ width: 130 }} />
            <div className="skeleton-block" style={{ flex: 1 }} />
            <div className="skeleton-block" style={{ width: 48 }} />
          </div>
        ))
      ) : filteredEmails.length === 0 ? (
        emailLoadError && (activeView === 'everything' || emailLoadError.accountId === activeView) && (activeCategory ? emailLoadError.category === activeCategory : true) ? (
          <div className="empty-state load-error" style={{ padding: '64px 24px', textAlign: 'center' }}>
            <div className="empty-state-icon" style={{ fontSize: 28, opacity: 0.6, color: 'var(--danger)' }}>⚠</div>
            <div className="empty-state-title">Couldn't load messages</div>
            <div className="empty-state-subtitle" style={{ marginBottom: 16 }}>Check your connection and try again</div>
            <button className="btn-ghost" onClick={() => { setEmailLoadError(null); if (activeView === 'everything') connectedAccounts.forEach(a => loadEmailsForAccount(a.id, activeCategory)); else loadEmailsForAccount(activeView, activeCategory); }}>Retry</button>
          </div>
        ) : (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <Mail size={32} style={{ margin: '0 auto 12px', opacity: 0.05, display: 'block' }} />
            <div style={{ color: 'var(--text-2)', fontSize: '13px' }}>{searchQuery ? 'No messages match your search' : `No messages in ${activeCategory}`}</div>
          </div>
        )
      ) : (
        filteredEmails.map((email, idx) => {
          const isActive = selectedEmail?.id === email.id;
          const isSelected = selectedIds.has(email.id);
          const accountId = email.accountId || email.source?.account_id;
          const accountIndex = connectedAccounts.findIndex(a => a.id === accountId);
          const grad = accountIndex !== -1 ? getAccountGradient(accountIndex) : null;
          const isCascading = (Date.now() - cascadeTimestampRef.current) < 1200;
          const cc = isCascading && idx <= 23 ? ' row--intro' : '';
          const cs = isCascading && idx <= 23 ? { '--d': `${Math.min(idx, 23) * 36}ms` } : {};

          const senderLabel = conversationView && email.threadCount > 1 && email.threadParticipants?.length > 1
            ? email.threadParticipants.slice(0, 3).map(p => p.split(' ')[0]).join(', ') + (email.threadParticipants.length > 3 ? ` +${email.threadParticipants.length - 3}` : '')
            : stripName(email.from || '');
          const threadBadge = conversationView && email.threadCount > 1;

          const isHovered = hoveredEmailId === email.id;
          const emailStarred = starredOverrides[email.id] !== undefined ? starredOverrides[email.id] : email.isStarred;
          const acct = connectedAccounts[accountIndex];

          return (
            <div key={`${email.accountId||'a'}:${email.id}:${cascadeKey}`} className={`email-item${isActive ? ' active' : ''}${cc}`}
              onMouseEnter={() => { setHoveredEmailId(email.id); loadEmailDetails(email); loadThread(email); }}
              onMouseLeave={() => setHoveredEmailId(null)}
              onClick={() => { if (editMode) { toggleSelectId(email.id); return; } onSelectEmail(email); }}
              onTouchStart={(e) => { const t = e.touches[0]; swipeRef.current = { startX: t.clientX, startY: t.clientY, currentX: t.clientX, emailId: email.id }; e.currentTarget.dataset.swipe = ''; }}
              onTouchMove={(e) => { if (swipeRef.current.emailId === email.id) { swipeRef.current.currentX = e.touches[0].clientX; const d = e.touches[0].clientX - swipeRef.current.startX; if (d < -15) e.currentTarget.dataset.swipe = 'left'; else if (d > 15) e.currentTarget.dataset.swipe = 'right'; else e.currentTarget.dataset.swipe = ''; } }}
              onTouchEnd={(e) => {
                if (swipeRef.current.emailId !== email.id) return;
                e.currentTarget.dataset.swipe = '';
                const delta = swipeRef.current.currentX - swipeRef.current.startX;
                swipeRef.current = { startX: 0, startY: 0, currentX: 0, emailId: null };
                if (delta < -100) { try { navigator.vibrate?.(10); } catch (_) {} archiveEmail(email); }
                else if (delta > 100) { try { navigator.vibrate?.(10); } catch (_) {} trashEmail(email); }
              }}
              style={{ position: 'relative', padding: '0 12px 0 8px', minHeight: `${rowHeight}px`, ...cs }}>
              {!email.isRead && grad && <span className="unread-marker" style={{ background: grad.gradient }} />}
              {useStackedRows ? (
                <div className="email-row-stacked">
                  <Avatar email={getEmailOnly(email.from || '')} name={stripName(email.from || '')} src={acct?.picture} size={24} />
                  <div className="email-row-stacked-content">
                    <span className="row-sender" style={{ fontWeight: 500, color: !email.isRead ? 'var(--text-0)' : 'var(--text-1)' }}>
                      {senderLabel}
                      {threadBadge && <span className={`thread-count-badge${!email.isRead ? ' thread-count-badge-unread' : ''}`}>{email.threadCount}</span>}
                    </span>
                    <span className="row-subject" style={{ fontWeight: !email.isRead ? 500 : 400, color: !email.isRead ? 'var(--text-0)' : 'var(--text-2)' }}>{email.subject || '(no subject)'}</span>
                  </div>
                  <span className="row-time">{formatTime(email.date)}</span>
                </div>
              ) : (
                <div className="email-row-grid">
                  {/* Checkbox */}
                  <button className={`email-checkbox ${isSelected ? 'checked' : ''}`} onClick={e => { e.stopPropagation(); toggleSelectId(email.id); }} title={isSelected ? 'Deselect' : 'Select'}>
                    <span className="checkbox-box" />
                  </button>
                  {/* Star */}
                  <button className={`row-star-btn${emailStarred ? ' starred' : ''}`}
                    onClick={e => { e.stopPropagation(); starEmail(email); }}
                    title={emailStarred ? 'Unstar' : 'Star'}>
                    <Star size={14} strokeWidth={1.5} fill={emailStarred ? 'currentColor' : 'none'} />
                  </button>
                  {/* Avatar */}
                  <div className="sender-avatar-wrap">
                    <Avatar email={getEmailOnly(email.from || '')} name={stripName(email.from || '')} size={32}
                      ring={grad && activeView === 'everything' ? grad.g0 : undefined} />
                  </div>
                  {/* Sender + source chip */}
                  <div className="row-sender-group">
                    {activeView === 'everything' && grad && acct && (
                      <span className="row-source-chip" style={{ background: grad.midRgba(0.15), color: grad.g0 }} title={acct.gmail_email}>
                        {(acct.account_name || acct.gmail_email || '').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="row-sender" style={{ fontWeight: !email.isRead ? 600 : 400, color: !email.isRead ? 'var(--text-0)' : 'var(--text-1)' }}>
                      {senderLabel}
                      {threadBadge && <span className={`thread-count-badge${!email.isRead ? ' thread-count-badge-unread' : ''}`}>{email.threadCount}</span>}
                    </span>
                  </div>
                  {/* Subject + snippet */}
                  <span className="row-subject">
                    <span className="row-subject-title" style={{ fontWeight: !email.isRead ? 500 : 400, color: !email.isRead ? 'var(--text-0)' : 'var(--text-2)' }}>{email.subject || '(no subject)'}</span>
                    {email.snippet && <span className="row-subject-preview">{' \u2014 '}{email.snippet}</span>}
                  </span>
                  {/* Icons: attachment */}
                  <div className="row-icons">
                    {email.hasAttachment && <Paperclip size={12} strokeWidth={1.5} style={{ color: 'var(--text-3)', flexShrink: 0 }} />}
                  </div>
                  {/* Time / hover actions */}
                  {isHovered ? (
                    <div className="row-hover-actions" onClick={e => e.stopPropagation()}>
                      <button className="row-action-btn" onClick={() => archiveEmail(email)} title="Archive"><Archive size={14} strokeWidth={1.5} /></button>
                      <button className="row-action-btn danger" onClick={() => trashEmail(email)} title="Delete"><Trash2 size={14} strokeWidth={1.5} /></button>
                      <button className="row-action-btn" onClick={async () => {
                        await fetch(`${API_BASE}/emails/${email.accountId}/${email.id}/read`, { method: 'POST', credentials: 'include' });
                        setEmails(p => { const n={...p}; Object.keys(n).forEach(ai => { Object.keys(n[ai]).forEach(c => { if(n[ai][c]) n[ai][c]=n[ai][c].map(e2=>e2.id===email.id?{...e2,isRead:true}:e2); }); }); return n; });
                      }} title="Mark read"><MailOpen size={14} strokeWidth={1.5} /></button>
                      <button className="row-action-btn" onClick={e2 => { e2.stopPropagation(); setSnoozeDropdownEmailId(prev => prev === email.id ? null : email.id); }} title="Snooze"><BellOff size={14} strokeWidth={1.5} /></button>
                    </div>
                  ) : (
                    <span className="row-time" style={{ color: !email.isRead ? 'var(--text-0)' : 'var(--text-3)', fontWeight: !email.isRead ? 500 : 400 }}>{formatTime(email.date)}</span>
                  )}
                </div>
              )}
              {/* Snooze dropdown */}
              {snoozeDropdownEmailId === email.id && (
                <div className="dropdown-menu" style={{ right: 8, top: '100%' }} onMouseDown={e => e.stopPropagation()}>
                  {getSnoozeOptions().map(opt => (
                    <button key={opt.label} className="dropdown-item" onClick={() => snoozeEmail(email, opt.time)}>{opt.label}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  // ==================== RENDER: EVERYTHING DASHBOARD ====================
  const renderEverything = () => (
    <div className="ev-everything-wrap" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="ev-mobile-tabs">
        <button className={`ev-filter-btn${evMobileTab === 'all' ? ' active' : ''}`} onClick={() => setEvMobileTab('all')}>All</button>
        <button className={`ev-filter-btn${evMobileTab==='mail'?' active':''}`} onClick={()=>setEvMobileTab('mail')}>Mail</button>
        <button className={`ev-filter-btn${evMobileTab==='docs'?' active':''}`} onClick={()=>setEvMobileTab('docs')}>Docs</button>
        <button className={`ev-filter-btn${evMobileTab==='cals'?' active':''}`} onClick={()=>setEvMobileTab('cals')}>Cals</button>
      </div>
    <PanelGroup orientation="horizontal" id="atm-everything-layout" className={`ev-desktop-only${evMobileTab === 'all' ? ' ev-hide-on-mobile' : ''}`}>
      <Panel defaultSize="40%" minSize="30%" id="ev-mail">
        <div className={`ev-column${evMobileTab === 'mail' ? ' ev-mobile-active' : ''}`}>
          <div className="ev-col-header">
            <span className="ev-col-title">Mail</span>
            <div className="ev-col-filters">
              <button className={`ev-filter-btn${evMailFilter==='all'?' active':''}`} onClick={()=>setEvMailFilter('all')}>All</button>
              <button className={`ev-filter-btn${evMailFilter==='unread'?' active':''}`} onClick={()=>setEvMailFilter('unread')}>Unread</button>
            </div>
          </div>
          <div className="ev-col-body">
            {evFilteredEmails.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}><Mail size={28} style={{ margin: '0 auto 10px', opacity: 0.05, display: 'block' }} /><div style={{ color: 'var(--text-2)', fontSize: '13px' }}>No messages</div></div>
            ) : (
              evFilteredEmails.slice(0, 50).map((email, idx) => {
                const accountIndex = connectedAccounts.findIndex(a => a.id === email.accountId);
                const grad = accountIndex !== -1 ? getAccountGradient(accountIndex) : null;
                const isCascading = (Date.now() - cascadeTimestampRef.current) < 1200;
                const cc = isCascading && idx <= 23 ? ' row--intro' : '';
                const cs = isCascading && idx <= 23 ? { '--d': `${Math.min(idx, 23) * 36}ms` } : {};
                return (
                  <div key={`ev-${email.id}:${cascadeKey}`} className={`email-item${cc}`} onClick={() => openSlideOverEmail(email, idx)}
                    style={{ position: 'relative', padding: '0 16px', minHeight: '48px', ...cs }}>
                    {!email.isRead && grad && <span className="unread-marker" style={{ background: grad.gradient }} />}
                    <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 72px', gap: '0 10px', alignItems: 'center', width: '100%', minWidth: 0 }}>
                      <div className="row-icon-slot" style={{ width: 24 }}>{grad && <span className="account-dot" style={{ background: grad.gradient, width: 8, height: 8 }} />}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline', minWidth: 0 }}>
                          <span className="row-sender" style={{ fontWeight: !email.isRead ? 500 : 400, color: !email.isRead ? 'var(--text-0)' : 'var(--text-1)', flexShrink: 0, maxWidth: '140px' }}>{stripName(email.from || '')}</span>
                          <span className="row-subject" style={{ fontWeight: !email.isRead ? 500 : 400, color: !email.isRead ? 'var(--text-0)' : 'var(--text-2)' }}>{email.subject || '(no subject)'}</span>
                        </div>
                      </div>
                      <span className="row-time">{formatTime(email.date)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Panel>
      <PanelResizeHandle className="ev-column-divider ev-column-divider--mail-docs" />
      <Panel defaultSize="30%" minSize="22%" id="ev-docs">
        <div className={`ev-column${evMobileTab === 'docs' ? ' ev-mobile-active' : ''}`}>
          <div className="ev-col-header">
            <span className="ev-col-title">Docs</span>
            <div className="ev-col-filters">
              <button className={`ev-filter-btn${evDocsFilter==='recent'?' active':''}`} onClick={()=>setEvDocsFilter('recent')}>Recent</button>
              <button className={`ev-filter-btn${evDocsFilter==='shared'?' active':''}`} onClick={()=>setEvDocsFilter('shared')}>Shared</button>
            </div>
          </div>
          <div className="ev-col-body">
            {isLoadingDocs && evFilteredDocs.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (<div className="skeleton-row" key={`edsk-${i}`} style={{ minHeight: 48, padding: '12px 16px' }}><div className="skeleton-block" style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0 }} /><div className="skeleton-block" style={{ flex: 1 }} /></div>))
            ) : (!anyHasDocs || hasDocsError) && evFilteredDocs.length === 0 ? (
              <div className="connect-cta-compact">
                <FileText size={24} strokeWidth={1.5} style={{ color: 'var(--text-3)' }} />
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)' }}>{anyHasDocs ? 'Drive permissions need updating' : 'Connect Google Drive'}</div>
                {anyHasDocs && <div style={{ fontSize: '11px', color: 'var(--text-3)', maxWidth: 200, textAlign: 'center' }}>Re-grant Drive access to restore your documents</div>}
                <button className="btn-ghost" onClick={handleAddAccount} style={{ fontSize: '11px', padding: '4px 10px' }}><Plus size={12} strokeWidth={1.5} /> {anyHasDocs ? 'Re-authorize' : 'Connect'}</button>
              </div>
            ) : evFilteredDocs.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}><FileText size={28} style={{ margin: '0 auto 10px', opacity: 0.05, display: 'block' }} /><div style={{ color: 'var(--text-2)', fontSize: '13px' }}>No documents</div></div>
            ) : evFilteredDocs.map((doc, idx) => {
              const isCascading = (Date.now() - cascadeTimestampRef.current) < 1200;
              const cc = isCascading && idx <= 23 ? ' row--intro' : '';
              const cs = isCascading && idx <= 23 ? { '--d': `${Math.min(idx + 8, 23) * 36}ms` } : {};
              const EvDocIcon = getDocIcon(doc.mimeType);
              return (
                <div key={doc.id} className={`email-item${cc}`} onMouseEnter={() => loadDocPreview(doc, { silent: true })} onClick={() => openSlideOverDoc(doc, idx)} style={{ padding: '10px 16px', minHeight: '48px', cursor: 'pointer', ...cs }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: '0 10px', alignItems: 'center' }}>
                    <div className="row-icon-slot" style={{ width: 24 }}><EvDocIcon size={14} strokeWidth={1.5} style={{ color: 'var(--text-2)' }} /></div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '1px' }}>{doc.owner} · {formatRelativeEdit(doc.lastEdited)}</div>
                    </div>
                    <span className="row-time">{new Date(doc.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>
      <PanelResizeHandle className="ev-column-divider ev-column-divider--docs-cals" />
      <Panel defaultSize="30%" minSize="22%" id="ev-cals">
        <div className={`ev-column${evMobileTab === 'cals' ? ' ev-mobile-active' : ''}`}>
          <div className="ev-col-header">
            <span className="ev-col-title">Cals</span>
            <div className="ev-col-filters">
              <button className={`ev-filter-btn${evCalsFilter==='upcoming'?' active':''}`} onClick={()=>setEvCalsFilter('upcoming')}>Upcoming</button>
              <button className={`ev-filter-btn${evCalsFilter==='week'?' active':''}`} onClick={()=>setEvCalsFilter('week')}>Week</button>
            </div>
          </div>
          <div className="ev-col-body">
            {(() => {
              const grouped = {};
              evFilteredEvents.forEach(ev => { if (!grouped[ev.day]) grouped[ev.day] = []; grouped[ev.day].push(ev); });
              if (isLoadingEvents && evFilteredEvents.length === 0) return Array.from({ length: 4 }).map((_, i) => (<div className="skeleton-row" key={`ecsk-${i}`} style={{ minHeight: 48, padding: '12px 16px' }}><div className="skeleton-block" style={{ width: 3, height: 28, borderRadius: 2, flexShrink: 0 }} /><div className="skeleton-block" style={{ width: 40 }} /><div className="skeleton-block" style={{ flex: 1 }} /></div>));
              if ((!anyHasCals || hasEventsError) && evFilteredEvents.length === 0) return (
                <div className="connect-cta-compact">
                  <Calendar size={24} strokeWidth={1.5} style={{ color: 'var(--text-3)' }} />
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)' }}>{anyHasCals ? 'Calendar permissions need updating' : 'Connect Google Calendar'}</div>
                  {anyHasCals && <div style={{ fontSize: '11px', color: 'var(--text-3)', maxWidth: 200, textAlign: 'center' }}>Re-grant Calendar access to restore your events</div>}
                  <button className="btn-ghost" onClick={handleAddAccount} style={{ fontSize: '11px', padding: '4px 10px' }}><Plus size={12} strokeWidth={1.5} /> {anyHasCals ? 'Re-authorize' : 'Connect'}</button>
                </div>
              );
              return evFilteredEvents.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}><Calendar size={28} style={{ margin: '0 auto 10px', opacity: 0.05, display: 'block' }} /><div style={{ color: 'var(--text-2)', fontSize: '13px' }}>No events</div></div>
              ) : Object.entries(grouped).map(([day, dayEvents]) => (
                <div key={day}>
                  <div className="cal-day-header">{day}</div>
                  {dayEvents.map((ev, idx) => {
                    const isCascading = (Date.now() - cascadeTimestampRef.current) < 1200;
                    const globalIdx = idx + 16;
                    const cc = isCascading && globalIdx <= 23 ? ' row--intro' : '';
                    const cs = isCascading && globalIdx <= 23 ? { '--d': `${Math.min(globalIdx, 23) * 36}ms` } : {};
                    return (
                      <div key={ev.id} className={`cal-event${cc}`} onClick={() => { setSelectedEvent(ev); openEventEdit(ev); }} style={cs}>
                        <div className="cal-event-marker" style={ev.calendarColor ? { background: ev.calendarColor } : ev.urgent ? { background: 'var(--warm-0)' } : undefined} />
                        <div className="cal-event-time">{ev.time}</div>
                        <div style={{ flex: 1, minWidth: 0 }}><div className="cal-event-title">{ev.title}</div><div className="cal-event-meta">{ev.meta}</div></div>
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        </div>
      </Panel>
    </PanelGroup>
    <div className={`ev-mobile-unified-wrap${evMobileTab === 'all' ? ' active' : ''}`}>
      <div className="ev-col-header">
        <span className="ev-col-title">Everything</span>
      </div>
      <div className="ev-col-body">
        {mobileUnifiedFeed.map((item, i) => {
          if (item.type === 'email') {
            const email = item.data;
            const accountIndex = connectedAccounts.findIndex(a => a.id === email.accountId);
            const grad = accountIndex !== -1 ? getAccountGradient(accountIndex) : null;
            return (
              <div key={`em-${email.id}-${i}`} className="ev-feed-item ev-feed-email" onClick={() => openSlideOverEmail(email)}>
                <div className="ev-feed-icon"><Mail size={14} strokeWidth={1.5} /></div>
                <div className="ev-feed-content">
                  <div className="ev-feed-line1">
                    <span className="ev-feed-title">{stripName(email.from || '')}</span>
                    {grad && <span className="ev-feed-source-dot" style={{ background: grad.gradient }} />}
                  </div>
                  <div className="ev-feed-line2">{email.subject || '(no subject)'}</div>
                </div>
                <span className="ev-feed-time">{formatTime(email.date)}</span>
              </div>
            );
          }
          if (item.type === 'doc') {
            const doc = item.data;
            return (
              <div key={`dc-${doc.id}-${i}`} className="ev-feed-item ev-feed-doc" onClick={() => openSlideOverDoc(doc)}>
                <div className="ev-feed-icon"><FileText size={14} strokeWidth={1.5} /></div>
                <div className="ev-feed-content">
                  <div className="ev-feed-line1">
                    <span className="ev-feed-title">{doc.title}</span>
                  </div>
                  <div className="ev-feed-line2">{doc.owner} · {formatRelativeEdit(doc.lastEdited)}</div>
                </div>
                <span className="ev-feed-time">{new Date(doc.date || doc.lastEdited).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              </div>
            );
          }
          const ev = item.data;
          return (
            <div key={`cv-${ev.id}-${i}`} className="ev-feed-item ev-feed-event" onClick={() => { setSelectedEvent(ev); openEventEdit(ev); }}>
              <div className="ev-feed-icon"><Calendar size={14} strokeWidth={1.5} /></div>
              <div className="ev-feed-content">
                <div className="ev-feed-line1">
                  <span className="ev-feed-title">{ev.title}</span>
                </div>
                <div className="ev-feed-line2">{ev.day} · {ev.time}{ev.meta ? ` · ${ev.meta}` : ''}</div>
              </div>
            </div>
          );
        })}
        {mobileUnifiedFeed.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-title">Nothing to show</div>
            <div className="empty-state-subtitle">Connect an account to see your activity</div>
          </div>
        )}
      </div>
    </div>
    </div>
  );

  // ==================== RENDER: DOCS MODULE ====================
  const renderDocsModule = () => (
    <>
      <Panel defaultSize="15%" minSize="12%" maxSize="22%" id="sidebar-docs">
        <div className="sidebar" style={{ width: '100%' }}>
          <div style={{ padding: '16px 16px 16px' }}><div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)' }}>All the docs</div></div>
          <div style={{ padding: '0 0 24px' }}>
            {[{key:'recent',label:'Recent',icon:Clock},{key:'shared',label:'Shared with me',icon:Share2},{key:'starred',label:'Starred',icon:Star},{key:'trash',label:'Trash',icon:Trash2}].map(({key,label,icon:Icon}) => (
              <button key={key} onClick={()=>{setDocsCategory(key);setSelectedDoc(null);}}
                className={`category-btn${docsCategory===key?' active':''}`}
                style={{ width:'100%',padding:'9px 20px',textAlign:'left',display:'flex',alignItems:'center',gap:'8px',background:'transparent',border:'none',cursor:'pointer',color:docsCategory===key?'var(--text-0)':'var(--text-2)',position:'relative',fontSize:'13px',fontWeight:docsCategory===key?500:400,fontFamily:'inherit' }}>
                <Icon size={14} strokeWidth={1.5} /><span className="category-label">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </Panel>
      <PanelResizeHandle className="panel-resize-handle" />
      <Panel defaultSize="40%" minSize="28%" id="docs-list">
        <div style={{ height: '100%', overflow: 'auto', background: 'var(--surface-list)' }}>
          <div style={{ borderBottom: '1px solid var(--line-0)', padding: '12px 20px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)' }}>{docsCategory.charAt(0).toUpperCase() + docsCategory.slice(1)}</span>
            <div style={{ marginTop: '8px' }}>
              <div className="search-pill"><Search size={14} /><input value={docsSearchQuery} onChange={e => setDocsSearchQuery(e.target.value)} placeholder="Search documents..." /></div>
            </div>
          </div>
          <div className="doc-row" style={{ minHeight: '34px', cursor: 'default', borderBottom: '1px solid var(--line-0)' }}>
            <div />
            <div style={{ fontSize: '11px', color: docsSortBy === 'name' ? 'var(--text-1)' : 'var(--text-3)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleDocsSort('name')}>Title {docsSortBy === 'name' ? (docsSortDir === 'asc' ? '\u2191' : '\u2193') : ''}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>Owner</div>
            <div style={{ fontSize: '11px', color: docsSortBy === 'lastEdited' ? 'var(--text-1)' : 'var(--text-3)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleDocsSort('lastEdited')}>Last edited {docsSortBy === 'lastEdited' ? (docsSortDir === 'asc' ? '\u2191' : '\u2193') : ''}</div>
            <div style={{ fontSize: '11px', color: docsSortBy === 'date' ? 'var(--text-1)' : 'var(--text-3)', fontWeight: 500, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleDocsSort('date')}>Date {docsSortBy === 'date' ? (docsSortDir === 'asc' ? '\u2191' : '\u2193') : ''}</div>
          </div>
          {isLoadingDocs && filteredDocs.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (<div className="skeleton-row" key={`dsk-${i}`} style={{ minHeight: 48 }}><div className="skeleton-block" style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0 }} /><div className="skeleton-block" style={{ flex: 1 }} /><div className="skeleton-block" style={{ width: 80 }} /><div className="skeleton-block" style={{ width: 64 }} /></div>))
          ) : (!anyHasDocs || hasDocsError) && filteredDocs.length === 0 ? (
            <div className="connect-cta">
              <FileText size={32} strokeWidth={1.5} style={{ color: 'var(--text-3)', marginBottom: 12 }} />
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>{anyHasDocs ? 'Drive permissions need updating' : 'Connect Google Drive'}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: 16, maxWidth: 260 }}>{anyHasDocs ? 'Re-grant Drive access to restore your documents. You\'ll be asked to approve permissions again.' : 'Grant Drive permissions to see your documents here'}</div>
              <button className="btn-ghost" onClick={handleAddAccount} style={{ fontSize: '12px' }}><Plus size={14} strokeWidth={1.5} /> {anyHasDocs ? 'Re-authorize Drive' : 'Connect account'}</button>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}><FileText size={28} style={{ margin: '0 auto 10px', opacity: 0.05, display: 'block' }} /><div style={{ color: 'var(--text-2)', fontSize: '13px' }}>No documents in {docsCategory}</div></div>
          ) : filteredDocs.map(doc => {
            const DocIcon = getDocIcon(doc.mimeType);
            return (
              <div key={doc.id} className={`doc-row${selectedDoc?.id===doc.id?' active':''}`} onClick={()=>setSelectedDoc(doc)}>
                <div className="row-icon-slot"><DocIcon size={14} strokeWidth={1.5} style={{ color: 'var(--text-2)' }} /></div>
                <div className="doc-col-title">{doc.title}</div>
                <div className="doc-col-owner">{doc.owner}</div>
                <div className="doc-col-edited">{formatRelativeEdit(doc.lastEdited)}</div>
                <div className="doc-col-date">{new Date(doc.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
              </div>
            );
          })}
        </div>
      </Panel>
      <PanelResizeHandle className="panel-resize-handle" />
      <Panel minSize="26%" id="docs-detail">
        <div style={{ height: '100%', background: 'var(--surface-detail)', overflow: 'auto' }}>
          {selectedDoc ? (() => {
            const DetailIcon = getDocIcon(selectedDoc.mimeType);
            const editUrl = getDocEditUrl(selectedDoc);
            const editorLabel = getDocEditorLabel(selectedDoc.mimeType);
            const fileType = FILE_TYPES[selectedDoc.mimeType];
            return (
              <div className="email-detail-content">
                <div style={{ padding: '24px 32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: 'var(--r-sm)', background: 'rgba(139, 124, 255, 0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><DetailIcon size={18} strokeWidth={1.5} style={{ color: 'var(--accent)' }} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}><h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-0)', margin: 0 }}>{selectedDoc.title}</h1></div>
                  </div>
                  <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', fontSize: '12px', color: 'var(--text-2)' }}>
                    <span>Owner: <span style={{ color: 'var(--text-1)' }}>{selectedDoc.owner}</span></span>
                    <span>{formatRelativeEdit(selectedDoc.lastEdited)}</span>
                    <span>{new Date(selectedDoc.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div style={{ height: '1px', background: 'var(--line-0)', marginBottom: '24px' }} />
                  {editUrl && (<button className="btn-ghost btn-edit-doc" onClick={() => window.open(editUrl, '_blank', 'noopener,noreferrer')} style={{ marginBottom: '20px', fontSize: '13px', gap: '6px' }}><ExternalLink size={14} strokeWidth={1.5} /> Edit in {editorLabel}</button>)}
                  <div style={{ background: 'var(--bg-3)', borderRadius: '8px', padding: '20px', border: '1px solid var(--line-0)', minHeight: '200px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Type</span><span style={{ color: 'var(--text-1)' }}>{fileType?.label || 'Document'}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Shared</span><span style={{ color: 'var(--text-1)' }}>{selectedDoc.shared ? 'Yes' : 'No'}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Starred</span><span style={{ color: 'var(--text-1)' }}>{selectedDoc.starred ? 'Yes' : 'No'}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="empty-state"><div style={{ textAlign: 'center' }}><FileText size={72} style={{ display: 'block', margin: '0 auto 16px', opacity: 0.04 }} /><div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>Select a document</div><div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Choose a doc from the list to preview</div></div></div>
          )}
        </div>
      </Panel>
    </>
  );

  // ==================== RENDER: CALS MODULE ====================
  const renderCalsModule = () => {
    const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6am–11pm
    const grouped = {};
    filteredAllEvents.forEach(ev => { if (!grouped[ev.day]) grouped[ev.day] = []; grouped[ev.day].push(ev); });

    const renderEventChip = (ev) => (
      <div key={ev.id} className={`gcal-chip${selectedEvent?.id === ev.id ? ' active' : ''}`}
        style={{ borderLeftColor: ev.calendarColor || 'var(--accent)', background: ev.calendarColor ? `${ev.calendarColor}18` : 'rgba(139, 124, 255, 0.08)' }}
        onClick={() => setSelectedEvent(prev => prev?.id === ev.id ? null : ev)}>
        <span className="gcal-chip-time">{ev.time !== 'All day' ? ev.time : ''}</span>
        <span className="gcal-chip-title">{ev.title}</span>
      </div>
    );

    const renderDayGrid = (days) => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinutes = now.getMinutes();
      return (
      <div className="gcal-grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        {/* Header row */}
        <div className="gcal-corner" />
        {days.map(day => (
          <div key={day.label} className={`gcal-col-header${day.isToday ? ' gcal-today' : ''}`}>
            <span className="gcal-col-weekday">{day.shortLabel}</span>
            <span className={`gcal-col-daynum${day.isToday ? ' gcal-today-num' : ''}`}>{day.dayNum}</span>
          </div>
        ))}
        {/* All-day row */}
        <div className="gcal-time-label gcal-allday-label">all-day</div>
        {days.map(day => (
          <div key={`ad-${day.label}`} className="gcal-allday-cell">
            {day.events.filter(ev => ev.time === 'All day').map(renderEventChip)}
          </div>
        ))}
        {/* Time grid */}
        {HOURS.map(h => (
          <React.Fragment key={h}>
            <div className="gcal-time-label">{h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}</div>
            {days.map(day => {
              const hourEvents = day.events.filter(ev => {
                if (ev.time === 'All day') return false;
                const evDate = new Date(ev.startISO || 0);
                return evDate.getHours() === h;
              });
              return (
                <div key={`${h}-${day.label}`} className="gcal-cell">
                  {hourEvents.map(renderEventChip)}
                  {h === currentHour && day.isToday && (
                    <div className="gcal-now-line" style={{ top: `${(currentMinutes / 60) * 48}px` }} />
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      );
    };

    const isGridView = calsViewMode === 'day' || calsViewMode === 'week' || calsViewMode === '4day';

    return (
      <div className="gcal-root">
        {/* Toolbar */}
        <div className="gcal-toolbar">
          <div className="gcal-toolbar-left">
            <button className="btn-ghost gcal-toolbar-btn" onClick={() => {
              const calsAccount = connectedAccounts.find(a => a.granted_scopes?.includes('cals'));
              if (!calsAccount) return;
              const now = new Date();
              const oneHourLater = new Date(now.getTime() + 3600000);
              setSelectedEvent({ id: 'new', accountId: calsAccount.id, title: '', description: '', meta: '', startISO: now.toISOString(), endISO: oneHourLater.toISOString() });
              openEventEdit({ id: 'new', accountId: calsAccount.id, title: '', description: '', meta: '', startISO: now.toISOString(), endISO: oneHourLater.toISOString() });
            }}><Plus size={14} strokeWidth={1.5} /> New event</button>
            <div className="gcal-nav-group">
              <button className="btn-ghost gcal-toolbar-today" onClick={() => setCalDate(new Date())}>Today</button>
              <button className="gcal-nav-btn" onClick={() => calNavigate(-1)}><ChevronLeft size={16} strokeWidth={1.5} /></button>
              <button className="gcal-nav-btn" onClick={() => calNavigate(1)}><ChevronRight size={16} strokeWidth={1.5} /></button>
            </div>
            <span className="gcal-title">{calTitle}</span>
          </div>
          <div className="gcal-toolbar-right">
            {['day', 'week', 'month', 'year', 'schedule', '4day'].map(v => (
              <button key={v} className={`ev-filter-btn${calsViewMode === v ? ' active' : ''}`} onClick={() => setCalsViewMode(v)}>
                {v === '4day' ? '4 days' : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar body */}
        <div className="gcal-body">
          {(!anyHasCals || hasEventsError) && filteredAllEvents.length === 0 ? (
            <div className="connect-cta">
              <Calendar size={32} strokeWidth={1.5} className="connect-cta-icon" />
              <div className="connect-cta-title">{anyHasCals ? 'Calendar permissions need updating' : 'Connect Google Calendar'}</div>
              <div className="connect-cta-subtitle">{anyHasCals ? 'Re-grant Calendar access to restore your events.' : 'Grant Calendar permissions to see your events here'}</div>
              <button className="btn-ghost connect-cta-btn" onClick={handleAddAccount}><Plus size={14} strokeWidth={1.5} /> {anyHasCals ? 'Re-authorize Calendar' : 'Connect account'}</button>
            </div>
          ) : isGridView ? (
            renderDayGrid(calGridDays)
          ) : calsViewMode === 'month' ? (
            <div className="gcal-month">
              <div className="gcal-month-header">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                  <div key={d} className="gcal-month-weekday">{d}</div>
                ))}
              </div>
              {calMonthDays.map((week, wi) => (
                <div key={wi} className="gcal-month-row">
                  {week.map((day, di) => (
                    <div key={di} className={`gcal-month-cell${day.isToday ? ' gcal-today' : ''}${!day.isCurrentMonth ? ' gcal-muted' : ''}`}
                      onClick={() => { setCalDate(day.date); setCalsViewMode('day'); }}>
                      <span className={`gcal-month-daynum${day.isToday ? ' gcal-today-num' : ''}`}>{day.dayNum}</span>
                      {day.events.slice(0, 3).map(renderEventChip)}
                      {day.events.length > 3 && <div className="gcal-more">+{day.events.length - 3} more</div>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : calsViewMode === 'year' ? (
            <div className="gcal-year">
              {Array.from({ length: 12 }, (_, mi) => {
                const monthDate = new Date(calDate.getFullYear(), mi, 1);
                const monthName = monthDate.toLocaleDateString(undefined, { month: 'long' });
                const monthEvents = filteredAllEvents.filter(ev => {
                  const d = new Date(ev.startISO || 0);
                  return d.getFullYear() === calDate.getFullYear() && d.getMonth() === mi;
                });
                return (
                  <div key={mi} className="gcal-year-month" onClick={() => { setCalDate(monthDate); setCalsViewMode('month'); }}>
                    <div className="gcal-year-month-name">{monthName}</div>
                    <div className="gcal-year-month-count">{monthEvents.length > 0 ? `${monthEvents.length} event${monthEvents.length !== 1 ? 's' : ''}` : ''}</div>
                  </div>
                );
              })}
            </div>
          ) : /* schedule */ (
            <div className="gcal-schedule-scroll">
              {isLoadingEvents && filteredAllEvents.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (<div className="skeleton-row" key={`esk-${i}`} style={{ minHeight: 48 }}><div className="skeleton-block" style={{ width: 3, height: 36, borderRadius: 2, flexShrink: 0 }} /><div className="skeleton-block" style={{ width: 48 }} /><div className="skeleton-block" style={{ flex: 1 }} /></div>))
              ) : Object.keys(grouped).length === 0 ? (
                <div className="gcal-schedule-empty"><Calendar size={28} className="gcal-schedule-empty-icon" /><div className="gcal-schedule-empty-text">No events</div></div>
              ) : Object.entries(grouped).map(([day, dayEvents]) => (
                <div key={day}>
                  <div className="cal-day-header">{day}</div>
                  {dayEvents.map(ev => (
                    <div key={ev.id} className={`cal-event${selectedEvent?.id === ev.id ? ' active' : ''}`} onClick={() => setSelectedEvent(ev)}>
                      <div className="cal-event-marker" style={ev.calendarColor ? { background: ev.calendarColor } : ev.urgent ? { background: 'var(--warm-0)' } : undefined} />
                      <div className="cal-event-time">{ev.time}</div>
                      <div className="cal-event-content">
                        <div className="cal-event-title">{ev.title}</div>
                        <div className="cal-event-meta">{ev.calendarName && ev.calendarName !== 'primary' ? `${ev.calendarName}${ev.meta ? ' · ' : ''}` : ''}{ev.meta}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Event detail slide-out */}
        {selectedEvent && (
          <div className="gcal-detail">
            <button className="slide-over-close" onClick={() => setSelectedEvent(null)}><X size={16} strokeWidth={1.5} /></button>
            <div className="gcal-detail-body">
              <div className="gcal-detail-header">
                <div className="gcal-detail-marker" style={selectedEvent.calendarColor ? { background: selectedEvent.calendarColor } : selectedEvent.urgent ? { background: 'var(--warm-0)' } : undefined} />
                <h2 className="gcal-detail-title">{selectedEvent.title}</h2>
              </div>
              <div className="gcal-detail-time">
                <div className="gcal-detail-time-row">
                  <Clock size={13} strokeWidth={1.5} className="gcal-detail-time-icon" />
                  {selectedEvent.day} · {selectedEvent.time}{selectedEvent.endTime ? ` – ${selectedEvent.endTime}` : ''}
                </div>
                {selectedEvent.meta && (
                  <div className="gcal-detail-time-row">
                    <MapPin size={13} strokeWidth={1.5} className="gcal-detail-time-icon" />
                    {selectedEvent.meta}
                  </div>
                )}
              </div>
              <div className="gcal-detail-actions">
                <button className="btn-ghost-sm" onClick={() => openEventEdit(selectedEvent)}>Edit</button>
                {selectedEvent.htmlLink && <button className="btn-ghost-sm" onClick={() => window.open(selectedEvent.htmlLink, '_blank', 'noopener,noreferrer')}><ExternalLink size={13} strokeWidth={1.5} /> Google</button>}
              </div>
              {selectedEvent.attendees?.length > 0 && (
                <div className="gcal-detail-attendees">
                  <div className="gcal-detail-attendees-label">Attendees</div>
                  {selectedEvent.attendees.map((a, i) => (
                    <div key={i} className="gcal-detail-attendee-row">
                      <span className="gcal-detail-attendee-name">{a.name || a.email}</span>
                      <span className="gcal-detail-attendee-status">{a.status === 'accepted' ? 'Yes' : a.status === 'declined' ? 'No' : a.status === 'tentative' ? 'Maybe' : '?'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==================== RENDER: MAIL PANELS ====================
  const renderMailModule = () => {
    if (splitMode === 'none') return (
      <>
        <Panel defaultSize="15%" minSize="12%" maxSize="22%" id="sidebar-none">
          <Sidebar sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed} activeCategory={activeCategory} setActiveCategory={setActiveCategory} categoryCounts={categoryCounts} openCompose={openCompose} clearSelection={clearSelection} setSelectedEmail={setSelectedEmail} setSelectedThread={setSelectedThread} setSelectedThreadActiveMessageId={setSelectedThreadActiveMessageId} setEditMode={setEditMode} setFullPageReaderOpen={setFullPageReaderOpen} />
        </Panel>
        <PanelResizeHandle className="panel-resize-handle" />
        <Panel minSize="30%" id="main-none">{fullPageReaderOpen && selectedEmail ? renderReader(selectedEmail, { fullPage: true }) : renderEmailList()}</Panel>
      </>
    );
    if (splitMode === 'vertical') return (
      <>
        <Panel defaultSize="15%" minSize="12%" maxSize="22%" id="sidebar-vert">
          <Sidebar sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed} activeCategory={activeCategory} setActiveCategory={setActiveCategory} categoryCounts={categoryCounts} openCompose={openCompose} clearSelection={clearSelection} setSelectedEmail={setSelectedEmail} setSelectedThread={setSelectedThread} setSelectedThreadActiveMessageId={setSelectedThreadActiveMessageId} setEditMode={setEditMode} setFullPageReaderOpen={setFullPageReaderOpen} />
        </Panel>
        <PanelResizeHandle className="panel-resize-handle" />
        <Panel defaultSize="32%" minSize="22%" id="list-vert">{renderEmailList()}</Panel>
        <PanelResizeHandle className="panel-resize-handle" />
        <Panel minSize="26%" id="reader-vert">{renderReader(selectedEmail)}</Panel>
      </>
    );
    if (splitMode === 'horizontal') return (
      <>
        <Panel defaultSize="15%" minSize="12%" maxSize="22%" id="sidebar-horiz">
          <Sidebar sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed} activeCategory={activeCategory} setActiveCategory={setActiveCategory} categoryCounts={categoryCounts} openCompose={openCompose} clearSelection={clearSelection} setSelectedEmail={setSelectedEmail} setSelectedThread={setSelectedThread} setSelectedThreadActiveMessageId={setSelectedThreadActiveMessageId} setEditMode={setEditMode} setFullPageReaderOpen={setFullPageReaderOpen} />
        </Panel>
        <PanelResizeHandle className="panel-resize-handle" />
        <Panel minSize="40%" id="content-horiz">
          <PanelGroup orientation="vertical" id="atm-horizontal-inner">
            <Panel defaultSize="45%" minSize="25%" id="list-horiz">{renderEmailList()}</Panel>
            <PanelResizeHandle className="panel-resize-handle-vertical" />
            <Panel minSize="25%" id="reader-horiz">{renderReader(selectedEmail)}</Panel>
          </PanelGroup>
        </Panel>
      </>
    );
    return null;
  };

  // ==================== MAIN RENDER ====================

  if (isAuthed === null) return (
    <div className="app-gate">
      <div className="app-gate-wordmark">
        <span className="wordmark-static">ALL THE</span>
        <span className="wordmark-module" key={GATE_WORDS[gateWordIdx]}>{GATE_WORDS[gateWordIdx]}</span>
      </div>
      <div className="app-loading-bar" />
    </div>
  );

  if (isAuthed === false) return (
    <div className={`app-container login-screen${introActive ? ' intro' : ''}`}>
      <button className="toolbar-btn login-theme-toggle theme-toggle-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
        <span className={`theme-icon${theme === 'dark' ? ' theme-icon-active' : ''}`}><Sun size={16} strokeWidth={1.5} /></span>
        <span className={`theme-icon${theme === 'light' ? ' theme-icon-active' : ''}`}><Moon size={16} strokeWidth={1.5} /></span>
      </button>
      <div className="login-card">
        {authError && <div className="login-error">{authError}</div>}
        <div style={{ fontSize: 'clamp(36px,5vw,52px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 0.95, marginBottom: '24px' }}>
          Email.<br /><span style={{ color: 'var(--accent)' }}>Unified.</span>
        </div>
        <div className="login-heading">Mail, docs, and calendars from one deliberate interface.</div>
        <div className="login-subheading">Encrypted tokens. No passwords stored. Disconnect anytime.</div>
        <button className="btn btn-primary" onClick={handleGoogleLogin} style={{ width: '100%' }}>
          <Mail size={18} /> Sign in with Google
        </button>
        <div className="login-subheading" style={{ marginTop: '16px', marginBottom: 0 }}>You will be asked to grant Gmail, Drive, and Calendar permissions</div>
      </div>
    </div>
  );

  return (
    <div className={`app-container${introActive ? ' intro' : ''}`}>
      {/* Top bar */}
      <header className="top-bar" onDoubleClick={() => {
        const target = document.querySelector('.email-list, .ev-col-body, .gcal-body, .ev-mobile-unified-wrap.active');
        if (target) target.scrollTo({ top: 0, behavior: 'smooth' });
      }}>
        <div className="top-bar-wordmark" aria-live="polite" aria-atomic="true">
          <span className="wordmark-static">ALL THE</span><span className="wordmark-module" key={activeModule}>{{ everything: 'EVERYTHING', mail: 'MAIL', docs: 'DOCS', cals: 'CALS' }[activeModule]}</span>
        </div>
        <nav className="module-tabs" role="navigation" aria-label="Main navigation">
          <button className={`module-tab${activeModule==='everything'?' active':''}`} onClick={()=>setActiveModule('everything')} aria-current={activeModule==='everything' ? 'page' : undefined} aria-label="Everything"><LayoutGrid size={15} strokeWidth={1.5} /></button>
          <button className={`module-tab${activeModule==='mail'?' active':''}`} onClick={()=>setActiveModule('mail')} aria-current={activeModule==='mail' ? 'page' : undefined} aria-label="Mail"><Mail size={15} strokeWidth={1.5} /></button>
          <button className={`module-tab${activeModule==='docs'?' active':''}`} onClick={()=>setActiveModule('docs')} aria-current={activeModule==='docs' ? 'page' : undefined} aria-label="Docs"><FileText size={15} strokeWidth={1.5} /></button>
          <button className={`module-tab${activeModule==='cals'?' active':''}`} onClick={()=>setActiveModule('cals')} aria-current={activeModule==='cals' ? 'page' : undefined} aria-label="Calendar"><Calendar size={15} strokeWidth={1.5} /></button>
        </nav>
        <div className="module-divider" />
        <div className={`account-rail${fadeLeft ? ' fade-left' : ''}${fadeRight ? ' fade-right' : ''}`}>
          <div className="account-rail-scroll" ref={railScrollRef} onScroll={updateRailFades}>
            <button className={`account-pill${activeView === 'everything' ? ' active' : ''}`} onClick={() => switchAccount('everything')}>
              <Users size={14} strokeWidth={1.5} style={{ opacity: 0.7 }} /><span className="account-pill-label">All</span>
            </button>
            {connectedAccounts.map((a, i) => {
              const g = getAccountGradient(i);
              return (
                <button key={a.id} className={`account-pill${activeView === a.id ? ' active' : ''}`} onClick={() => switchAccount(a.id)} title={a.gmail_email}>
                  <Avatar src={a.picture} email={a.gmail_email} name={a.account_name} size={22} ring={activeView === a.id ? g.g0 : undefined} />
                  <span className="account-pill-label">{getShortLabel(a, connectedAccounts)}</span>
                </button>
              );
            })}
            <button className="account-pill add-pill" onClick={handleAddAccount} title="Add account"><Plus size={13} strokeWidth={1.5} /><span className="add-pill-label">Add</span></button>
          </div>
        </div>
        <div className="top-bar-controls">
          {scheduledSends.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginRight: '8px', padding: '3px 10px', background: 'var(--bg-1)', border: '1px solid var(--line-0)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
              <Send size={12} strokeWidth={1.5} />
              {scheduledSends.length} scheduled
            </div>
          )}
          {activeModule === 'mail' && lastSyncTime && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '6px' }}>
              <span className="sync-dot" /><span style={{ fontSize: '11px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{getRelativeTime(lastSyncTime)}</span>
            </div>
          )}
          {activeModule === 'mail' && (
            <>
              <button className="toolbar-btn" onClick={() => { if (activeView === 'everything') connectedAccounts.forEach(a => loadEmailsForAccount(a.id, activeCategory)); else loadEmailsForAccount(activeView, activeCategory); refreshEmails(); }} title="Refresh" aria-label="Refresh email">
                <RefreshCw size={15} strokeWidth={1.5} className={(isLoadingEmails || isCheckingMail) ? 'animate-spin' : ''} />
              </button>
              <div className="module-divider" />
              <button className={`toolbar-btn${splitMode==='none'?' toolbar-active':''}`} onClick={()=>{setSplitMode('none');setFullPageReaderOpen(false);}} title="No split" aria-label="No split" aria-pressed={splitMode==='none'}><SplitNoneIcon /></button>
              <button className={`toolbar-btn${splitMode==='vertical'?' toolbar-active':''}`} onClick={()=>{setSplitMode('vertical');setFullPageReaderOpen(false);}} title="Vertical split" aria-label="Vertical split" aria-pressed={splitMode==='vertical'}><SplitVerticalIcon /></button>
              <button className={`toolbar-btn${splitMode==='horizontal'?' toolbar-active':''}`} onClick={()=>{setSplitMode('horizontal');setFullPageReaderOpen(false);}} title="Horizontal split" aria-label="Horizontal split" aria-pressed={splitMode==='horizontal'}><SplitHorizontalIcon /></button>
              <div className="module-divider" />
              <button className="toolbar-btn" onClick={cycleDensity} title={`Density: ${densityMode}`} aria-label={`Email density: ${densityMode}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
              </button>
              <div className="module-divider" />
              <button className={`toolbar-btn${conversationView?' toolbar-active':''}`} onClick={()=>setConversationView(v=>!v)} title={conversationView ? 'Conversation view on' : 'Conversation view off'} aria-label={conversationView ? 'Conversation view on' : 'Conversation view off'} aria-pressed={conversationView}>
                <MessagesSquare size={15} strokeWidth={1.5} />
              </button>
            </>
          )}
          <button className="toolbar-btn theme-toggle-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} style={{ marginLeft: '4px' }}>
            <span className={`theme-icon${theme === 'dark' ? ' theme-icon-active' : ''}`} aria-hidden="true"><Sun size={15} strokeWidth={1.5} /></span>
            <span className={`theme-icon${theme === 'light' ? ' theme-icon-active' : ''}`} aria-hidden="true"><Moon size={15} strokeWidth={1.5} /></span>
          </button>
          <div style={{ position: 'relative', marginLeft: '4px' }}>
            <button ref={avatarButtonRef} className="avatar-btn" onClick={() => { setAvatarDropdownOpen(o => !o); setRemovingAccountId(null); }} title="Account menu" aria-label="Account menu" aria-expanded={avatarDropdownOpen} aria-haspopup="true">
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: connectedAccounts.length > 0 ? getAccountGradient(0).gradient : 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                {(userProfile?.name || userProfile?.email || '?')[0].toUpperCase()}
              </div>
            </button>
            {avatarDropdownOpen && (
              <div className="avatar-dropdown" ref={avatarDropdownRef}>
                <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: connectedAccounts.length > 0 ? getAccountGradient(0).gradient : 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                    {(userProfile?.name || userProfile?.email || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userProfile?.name || 'User'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userProfile?.email || ''}</div>
                  </div>
                </div>
                <div className="avatar-dropdown-divider" />
                <div style={{ padding: '8px 0' }}>
                  <div style={{ padding: '4px 16px 8px', fontSize: '11px', fontWeight: 500, color: 'var(--text-3)' }}>Connected accounts</div>
                  {connectedAccounts.map((a, idx) => {
                    const grad = getAccountGradient(idx);
                    return (
                      <div key={a.id} className="avatar-dropdown-account-row">
                        <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: grad.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                          {(a.account_name || a.gmail_email || '?')[0].toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.account_name || a.gmail_email}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.gmail_email}</div>
                        </div>
                        {connectedAccounts.length > 1 && (
                          <button onClick={() => handleRemoveAccount(a.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0, fontSize: '11px', fontWeight: 500, padding: '4px 8px', borderRadius: 'var(--r-xs)', color: removingAccountId === a.id ? 'var(--danger)' : 'var(--text-3)', transition: 'color var(--t-micro) var(--ease)' }}>
                            {removingAccountId === a.id ? 'Confirm?' : 'Remove'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <button className="avatar-dropdown-add-btn" onClick={() => { setAvatarDropdownOpen(false); handleAddAccount(); }}><Plus size={14} strokeWidth={1.5} /> Add account</button>
                </div>
                <div className="avatar-dropdown-divider" />
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-1)' }}>Plan</span>
                    <span className={`plan-badge ${billingPlan}`}>{billingPlan === 'pro' ? 'Pro' : 'Free'}</span>
                  </div>
                  {billingPlan === 'pro' ? (
                    <button onClick={handleManageBilling} disabled={billingLoading} style={{ background: 'transparent', border: '1px solid var(--line-0)', borderRadius: 'var(--r-xs)', color: 'var(--text-1)', fontSize: '12px', fontWeight: 500, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Manage</button>
                  ) : (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleUpgrade('monthly')} disabled={billingLoading} style={{ background: 'var(--bg-2)', border: '1px solid var(--line-0)', borderRadius: 'var(--r-xs)', color: 'var(--text-1)', fontSize: '11px', fontWeight: 500, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>$15/mo</button>
                      <button onClick={() => handleUpgrade('annual')} disabled={billingLoading} style={{ background: 'var(--accent)', border: 'none', borderRadius: 'var(--r-xs)', color: '#fff', fontSize: '11px', fontWeight: 500, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>$144/yr</button>
                    </div>
                  )}
                </div>
                <div className="avatar-dropdown-divider" />
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-3)', marginBottom: 6 }}>Undo send</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0, 5, 10, 30].map(s => (
                      <button key={s} onClick={() => setSendDelaySeconds(s)}
                        className={`ev-filter-btn${sendDelaySeconds === s ? ' active' : ''}`}
                        style={{ padding: '4px 10px', fontSize: 11 }}>
                        {s === 0 ? 'Off' : `${s}s`}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="avatar-dropdown-divider" />
                <button className="avatar-dropdown-signout" onClick={() => { setAvatarDropdownOpen(false); handleLogout(); }}><LogOut size={14} strokeWidth={1.5} /> Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="main-content" role="main">
        <ErrorBoundary>
          {activeModule === 'everything' && renderEverything()}
          {activeModule === 'cals' && renderCalsModule()}
          {activeModule !== 'everything' && activeModule !== 'cals' && (
            <PanelGroup orientation="horizontal" id={`atm-${activeModule}-${activeModule==='mail'?splitMode:'default'}-layout`}>
              {activeModule === 'mail' && renderMailModule()}
              {activeModule === 'docs' && renderDocsModule()}
            </PanelGroup>
          )}
        </ErrorBoundary>
      </main>

      {/* Compose modal */}
      <ComposeModal
        composeOpen={composeOpen} composeMode={composeMode} composeSending={composeSending} composeError={composeError}
        composeFromAccountId={composeFromAccountId} setComposeFromAccountId={setComposeFromAccountId}
        composeTo={composeTo} setComposeTo={setComposeTo}
        composeCc={composeCc} setComposeCc={setComposeCc}
        composeBcc={composeBcc} setComposeBcc={setComposeBcc}
        composeSubject={composeSubject} setComposeSubject={setComposeSubject}
        composeBody={composeBody} setComposeBody={setComposeBody}
        composeShowCcBcc={composeShowCcBcc} setComposeShowCcBcc={setComposeShowCcBcc}
        composeAttachments={composeAttachments} handleFileSelect={handleFileSelect} removeAttachment={removeAttachment}
        connectedAccounts={connectedAccounts}
        closeCompose={closeCompose} sendCompose={sendComposeWithDelay}
        scheduleSend={scheduleSend}
        saveDraft={saveDraft}
        includeSignature={includeAtmSignature} setIncludeSignature={setIncludeAtmSignature}
      />

      {/* Slide-over preview panel */}
      {(slideOverEmail || slideOverDoc) && (
        <div className="slide-over-backdrop" onClick={closeSlideOver}>
          <div className="slide-over-panel" onClick={e => e.stopPropagation()}>
            {slideOverIndex !== null && (<span className="slide-over-position">{slideOverIndex + 1} / {slideOverEmail ? evFilteredEmails.slice(0, 50).length : evFilteredDocs.length}</span>)}
            <button className="slide-over-close" onClick={closeSlideOver} title="Close"><X size={16} strokeWidth={1.5} /></button>
            {slideOverEmail && (() => {
              const eid = slideOverEmail.id;
              const body = emailBodies[eid];
              const headers = emailHeaders[eid];
              const accountIndex = connectedAccounts.findIndex(a => a.id === slideOverEmail.accountId);
              const grad = accountIndex !== -1 ? getAccountGradient(accountIndex) : null;
              const accountName = connectedAccounts[accountIndex]?.account_name || connectedAccounts[accountIndex]?.gmail_email || '';
              return (
                <div style={{ padding: '32px 32px 24px' }}>
                  {grad && (<div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '16px', padding: '3px 10px 3px 6px', borderRadius: 'var(--r-pill)', background: grad.midRgba(0.08), fontSize: '11px', fontWeight: 500, color: 'var(--text-1)' }}><span className="account-dot" style={{ background: grad.gradient, width: 8, height: 8 }} />{accountName}</div>)}
                  <h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-0)', margin: '0 0 16px', lineHeight: 1.3 }}>{slideOverEmail.subject || '(no subject)'}</h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <div className="reader-avatar">{stripName(headers?.from || slideOverEmail.from || '').charAt(0).toUpperCase()}</div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-0)' }}>{stripName(headers?.from || slideOverEmail.from || '')}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{headers?.to ? `To: ${stripName(headers.to)}` : ''} · {formatTime(slideOverEmail.date)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', margin: '16px 0' }}>
                    <button className="btn-ghost" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => { closeSlideOver(); setActiveModule('mail'); setActiveView('everything'); onSelectEmail(slideOverEmail); }}><ArrowLeft size={14} strokeWidth={1.5} /> Open full view</button>
                    <button className="btn-ghost" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => { closeSlideOver(); openCompose('reply', slideOverEmail); }}><Reply size={14} strokeWidth={1.5} /> Reply</button>
                    <button className="btn-ghost" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={async () => {
                      const aid = slideOverEmail.accountId || connectedAccounts[0]?.id; if (!aid) return;
                      try { await fetch(`${API_BASE}/emails/${aid}/${slideOverEmail.id}/archive`, { method: 'POST', credentials: 'include' }); setEmails(p => { const n = { ...p }; Object.keys(n).forEach(ai => { Object.keys(n[ai]).forEach(c => { if (n[ai][c]) n[ai][c] = n[ai][c].filter(e => e.id !== slideOverEmail.id); }); }); return n; }); closeSlideOver(); } catch (err) { setError('Failed to archive'); }
                    }}><Archive size={14} strokeWidth={1.5} /> Archive</button>
                  </div>
                  <div style={{ height: '1px', background: 'var(--line-0)', marginBottom: '20px' }} />
                  {!body ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px 0' }}>
                      {Array.from({ length: 4 }).map((_, i) => (<div key={i} className="skeleton-block" style={{ height: i === 0 ? 16 : 12, width: i === 3 ? '60%' : '100%' }} />))}
                    </div>
                  ) : (
                    <div className="email-body-wrapper" style={{ borderRadius: '8px', overflow: 'hidden' }}>
                      <iframe title="Email preview" srcDoc={buildEmailSrcDoc(body)}
                        scrolling="no"
                        sandbox="allow-same-origin allow-popups"
                        style={{ width: '100%', border: 'none', display: 'block', background: 'var(--email-bg)', minHeight: '120px' }}
                        onLoad={e => {
                          const iframe = e.target;
                          if (!iframe?.contentDocument?.body) return;
                          const resize = () => { try { const h = iframe.contentDocument.body.scrollHeight; if (h > 0) iframe.style.height = h + 'px'; } catch(_) {} };
                          resize();
                          [100, 400, 1000, 2000].forEach(ms => setTimeout(resize, ms));
                          try { Array.from(iframe.contentDocument.images || []).forEach(img => { if (!img.complete) img.addEventListener('load', resize); }); } catch(_) {}
                          try { const ro = new ResizeObserver(resize); ro.observe(iframe.contentDocument.body); } catch(_) {}
                        }} />
                    </div>
                  )}
                </div>
              );
            })()}
            {slideOverDoc && (() => {
              const DocPreviewIcon = getDocIcon(slideOverDoc.mimeType);
              const editUrl = getDocEditUrl(slideOverDoc);
              const editorLabel = getDocEditorLabel(slideOverDoc.mimeType);
              const fileType = FILE_TYPES[slideOverDoc.mimeType];
              const accountIndex = connectedAccounts.findIndex(a => a.id === slideOverDoc.accountId);
              const grad = accountIndex !== -1 ? getAccountGradient(accountIndex) : null;
              const accountName = connectedAccounts[accountIndex]?.account_name || connectedAccounts[accountIndex]?.gmail_email || '';
              return (
                <div style={{ padding: '32px 32px 24px' }}>
                  {grad && (<div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '16px', padding: '3px 10px 3px 6px', borderRadius: 'var(--r-pill)', background: grad.midRgba(0.08), fontSize: '11px', fontWeight: 500, color: 'var(--text-1)' }}><span className="account-dot" style={{ background: grad.gradient, width: 8, height: 8 }} />{accountName}</div>)}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: 'var(--r-sm)', background: 'rgba(139, 124, 255, 0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><DocPreviewIcon size={22} strokeWidth={1.5} style={{ color: 'var(--accent)' }} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-0)', margin: 0, lineHeight: 1.3 }}>{slideOverDoc.title}</h1>
                      <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '4px' }}>{fileType?.label || 'Document'}</div>
                    </div>
                  </div>
                  {editUrl && (<button className="btn-ghost btn-edit-doc" onClick={() => window.open(editUrl, '_blank', 'noopener,noreferrer')} style={{ marginBottom: '24px', fontSize: '13px', gap: '6px' }}><ExternalLink size={14} strokeWidth={1.5} /> Edit in {editorLabel}</button>)}
                  {docPreviewLoading && (<div className="doc-preview-skeleton">{Array.from({ length: 5 }).map((_, i) => (<div key={i} className="skeleton-block" style={{ height: i === 0 ? 16 : 12, width: i === 4 ? '60%' : '100%' }} />))}</div>)}
                  {!docPreviewLoading && docPreview?.type === 'embed' && (
                    <div className="doc-preview-embed">
                      <iframe
                        src={docPreview.embedUrl}
                        title={docPreview.name || 'Document preview'}
                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                        loading="lazy"
                      />
                    </div>
                  )}
                  {!docPreviewLoading && docPreview?.type === 'html' && (<div className="doc-preview-content" dangerouslySetInnerHTML={{ __html: sanitizeDocHtml(docPreview.content) }} />)}
                  {!docPreviewLoading && docPreview?.type === 'thumbnail' && (<div className="doc-preview-content"><img src={docPreview.url} alt={docPreview.name || slideOverDoc.title} style={{ maxWidth: '100%', borderRadius: '6px' }} /></div>)}
                  {!docPreviewLoading && docPreview?.type === 'none' && (<p style={{ color: 'var(--text-3)', fontSize: '13px', margin: '0 0 20px' }}>Preview not available for this file type</p>)}
                  <div style={{ height: '1px', background: 'var(--line-0)', margin: '24px 0' }} />
                  <div style={{ background: 'var(--bg-3)', borderRadius: '8px', padding: '20px', border: '1px solid var(--line-0)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Owner</span><span style={{ color: 'var(--text-1)' }}>{slideOverDoc.owner}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Last edited</span><span style={{ color: 'var(--text-1)' }}>{formatRelativeEdit(slideOverDoc.lastEdited)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Modified</span><span style={{ color: 'var(--text-1)' }}>{new Date(slideOverDoc.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Shared</span><span style={{ color: 'var(--text-1)' }}>{slideOverDoc.shared ? 'Yes' : 'No'}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Starred</span><span style={{ color: 'var(--text-1)' }}>{slideOverDoc.starred ? 'Yes' : 'No'}</span></div>
                    </div>
                  </div>
                </div>
              );
            })()}
            {slideOverIndex !== null && (() => {
              const items = slideOverEmail ? evFilteredEmails.slice(0, 50) : evFilteredDocs;
              return (<div className="slide-over-nav-hints">{slideOverIndex > 0 && <span>← Previous</span>}<span style={{ flex: 1 }} />{slideOverIndex < items.length - 1 && <span>Next →</span>}</div>);
            })()}
          </div>
        </div>
      )}

      {/* Event edit modal */}
      <EventEditModal
        eventEditOpen={eventEditOpen} selectedEvent={selectedEvent}
        eventEditFields={eventEditFields} setEventEditFields={setEventEditFields}
        eventEditSaving={eventEditSaving} eventEditError={eventEditError}
        closeEventEdit={closeEventEdit} saveEventEdit={saveEventEdit}
      />

      {error && (
        <div className="toast"><span>{error}</span><button onClick={() => setError(null)} className="toast-x" title="Dismiss"><X size={14} /></button></div>
      )}
      {pendingSend && (
        <div className="toast-pending">
          <div className="toast-pending-content">
            <div className="toast-pending-spinner" />
            <span>Sending in <strong>{pendingSend.secondsLeft}s</strong> · {pendingSend.previewSubject}</span>
          </div>
          <button onClick={cancelPendingSend} className="toast-undo">Undo</button>
        </div>
      )}
      {successToast && (
        <div className="toast-success">
          <span>{successToast.message || successToast}</span>
          {successToast.undoFn && (
            <button onClick={() => { successToast.undoFn(); if(undoTimerRef.current) clearTimeout(undoTimerRef.current); }} className="toast-undo">Undo</button>
          )}
          <button onClick={() => { if(successToast.executeFn) successToast.executeFn(); setSuccessToast(null); if(undoTimerRef.current) clearTimeout(undoTimerRef.current); }} className="toast-x" title="Dismiss"><X size={14} /></button>
        </div>
      )}

      {/* Onboarding */}
      {showOnboarding && isAuthed && connectedAccounts.length > 0 && (
        <div className="onboarding-overlay">
          <div className="onboarding-card">
            {onboardingStep === 0 && (<>
              <LayoutGrid size={40} strokeWidth={1.5} className="onboarding-icon" />
              <h2 className="onboarding-title">Welcome to All The Mail</h2>
              <p className="onboarding-body">Your accounts are connected. The Everything View shows mail, docs, and calendar from all accounts in one place — with color-coded source chips so you always know which account each item belongs to.</p>
            </>)}
            {onboardingStep === 1 && (<>
              <Users size={40} strokeWidth={1.5} className="onboarding-icon" />
              <h2 className="onboarding-title">Add more accounts</h2>
              <p className="onboarding-body">Click the + button in the account rail to connect additional Gmail accounts. Each gets its own color gradient for instant recognition across all views.</p>
            </>)}
            {onboardingStep === 2 && (<>
              <Mail size={40} strokeWidth={1.5} className="onboarding-icon" />
              <h2 className="onboarding-title">You're all set</h2>
              <p className="onboarding-body">Use keyboard shortcuts for speed: <strong>e</strong> archive, <strong>r</strong> reply, <strong>c</strong> compose, <strong>/</strong> search. Switch between Mail, Docs, and Cals in the top bar.</p>
            </>)}
            <div className="onboarding-steps">
              {[0,1,2].map(i => <span key={i} className={`onboarding-dot${onboardingStep === i ? ' active' : ''}`} />)}
            </div>
            {onboardingStep < 2 ? (
              <button className="btn btn-primary" onClick={() => setOnboardingStep(s => s + 1)} style={{ width: '100%' }}>Next</button>
            ) : (
              <button className="btn btn-primary" onClick={() => { setShowOnboarding(false); localStorage.setItem('atm_onboarded', 'true'); }} style={{ width: '100%' }}>Get started</button>
            )}
            <button className="btn-ghost" onClick={() => { setShowOnboarding(false); localStorage.setItem('atm_onboarded', 'true'); }} style={{ width: '100%', marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>Skip</button>
          </div>
        </div>
      )}

      {/* Command Palette (Cmd+K) */}
      {paletteOpen && (() => {
        const allCommands = [
          { id: 'compose', label: 'Compose new message', hint: 'C', action: () => openCompose('compose') },
          { id: 'search', label: 'Search emails', hint: '/', action: () => { setTimeout(() => searchInputRef.current?.focus(), 0); } },
          { id: 'goto-everything', label: 'Go to Everything View', action: () => setActiveModule('everything') },
          { id: 'goto-mail', label: 'Go to Mail', action: () => setActiveModule('mail') },
          { id: 'goto-docs', label: 'Go to Docs', action: () => setActiveModule('docs') },
          { id: 'goto-cals', label: 'Go to Calendar', action: () => setActiveModule('cals') },
          { id: 'toggle-theme', label: 'Toggle theme', action: () => toggleTheme() },
          { id: 'toggle-conversation', label: 'Toggle conversation view', action: () => setConversationView(v => !v) },
          { id: 'add-account', label: 'Add account', action: () => handleAddAccount() },
          ...(selectedEmail ? [
            { id: 'archive', label: 'Archive selected email', hint: 'E', action: () => archiveEmail(selectedEmail) },
            { id: 'delete', label: 'Delete selected email', hint: '#', action: () => trashEmail(selectedEmail) },
            { id: 'reply', label: 'Reply to selected email', hint: 'R', action: () => openCompose('reply', selectedEmail) },
          ] : []),
          { id: 'shortcuts', label: 'Show keyboard shortcuts', hint: '?', action: () => setShortcutsOpen(true) },
        ];
        const q = paletteQuery.trim().toLowerCase();
        const filtered = q ? allCommands.filter(c => c.label.toLowerCase().includes(q)) : allCommands;
        const safeIndex = filtered.length === 0 ? 0 : Math.min(paletteIndex, filtered.length - 1);
        const closePalette = () => { setPaletteOpen(false); setPaletteQuery(''); setPaletteIndex(0); };
        const runCommand = (cmd) => {
          closePalette();
          if (cmd && cmd.action) cmd.action();
        };
        const onPaletteKey = (e) => {
          if (e.key === 'Escape') { e.preventDefault(); closePalette(); return; }
          if (e.key === 'ArrowDown') { e.preventDefault(); setPaletteIndex(i => Math.min(i + 1, filtered.length - 1)); return; }
          if (e.key === 'ArrowUp') { e.preventDefault(); setPaletteIndex(i => Math.max(i - 1, 0)); return; }
          if (e.key === 'Enter') { e.preventDefault(); runCommand(filtered[safeIndex]); return; }
        };
        return (
          <div className="command-palette-overlay" onClick={closePalette}>
            <div className="command-palette" onClick={e => e.stopPropagation()}>
              <input
                autoFocus
                className="command-palette-input"
                placeholder="Type a command…"
                value={paletteQuery}
                onChange={e => { setPaletteQuery(e.target.value); setPaletteIndex(0); }}
                onKeyDown={onPaletteKey}
              />
              <div className="command-palette-list">
                {filtered.length === 0 ? (
                  <div className="command-palette-empty">
                    <div className="command-palette-empty-title">No commands match "{paletteQuery}"</div>
                    <div className="command-palette-empty-hint">Press <kbd>?</kbd> to see all keyboard shortcuts</div>
                  </div>
                ) : filtered.map((cmd, idx) => (
                  <div
                    key={cmd.id}
                    className={`command-palette-item${idx === safeIndex ? ' active' : ''}`}
                    onMouseEnter={() => setPaletteIndex(idx)}
                    onClick={() => runCommand(cmd)}
                  >
                    <span>{cmd.label}</span>
                    {cmd.hint && <span className="command-palette-item-hint">{cmd.hint}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Keyboard shortcuts cheatsheet */}
      {shortcutsOpen && (
        <div className="modal-overlay" onClick={() => setShortcutsOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <span className="modal-header-title">Keyboard shortcuts</span>
              <button className="btn-icon" onClick={() => setShortcutsOpen(false)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
              {[
                { group: 'Navigation', items: [
                  { key: 'j', desc: 'Next message' },
                  { key: 'k', desc: 'Previous message' },
                  { key: 'Enter', desc: 'Open selected message' },
                  { key: 'u', desc: 'Back to inbox' },
                  { key: '↑ ↓', desc: 'Scroll / navigate list' },
                ]},
                { group: 'Actions', items: [
                  { key: 'e', desc: 'Archive' },
                  { key: '#', desc: 'Delete' },
                  { key: 's', desc: 'Toggle star' },
                  { key: 'x', desc: 'Select message' },
                  { key: '!', desc: 'Report spam' },
                ]},
                { group: 'Compose', items: [
                  { key: 'c', desc: 'Compose new' },
                  { key: 'r', desc: 'Reply' },
                  { key: 'a', desc: 'Reply all' },
                  { key: 'f', desc: 'Forward' },
                  { key: '/', desc: 'Focus search' },
                ]},
                { group: 'Jump to', items: [
                  { key: 'gi', desc: 'Go to inbox' },
                  { key: 'gd', desc: 'Go to drafts' },
                  { key: 'gt', desc: 'Go to sent' },
                  { key: '⌘K', desc: 'Command palette' },
                  { key: '?', desc: 'Show shortcuts' },
                ]},
              ].map(section => (
                <div key={section.group} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{section.group}</div>
                  {section.items.map(s => (
                    <div key={s.key} className="shortcut-row">
                      <span className="shortcut-desc">{s.desc}</span>
                      <kbd className="shortcut-key">{s.key}</kbd>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading gate — covers the app until first data batch is ready */}
      {gateVisible && (
        <div className={`app-gate${appReady ? ' app-gate--out' : ''}`} aria-hidden="true">
          <div className="app-gate-wordmark">
            <span className="wordmark-static">ALL THE</span>
            <span className="wordmark-module" key={GATE_WORDS[gateWordIdx]}>{GATE_WORDS[gateWordIdx]}</span>
          </div>
          <div className="app-loading-bar" />
        </div>
      )}
    </div>
  );
};

export default AllTheMail;
