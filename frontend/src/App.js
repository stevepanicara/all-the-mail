import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Mail, RefreshCw, Users, Search, Plus, LogOut, X,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Forward, Reply, Archive, Trash2, CheckSquare, Square, MinusSquare,
  Paperclip, Download, ArrowLeft, FileText, Calendar, Star, Clock,
  Share2, MoreHorizontal, LayoutGrid, ExternalLink, MapPin,
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

import './design-system.css';

// ==================== MAIN COMPONENT ====================

const AllTheMail = () => {
  const [isAuthed, setIsAuthed] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [introActive, setIntroActive] = useState(true);
  const [cascadeKey, setCascadeKey] = useState(0);

  const [activeModule, setActiveModule] = useState('everything');

  // Docs state
  const [docsCategory, setDocsCategory] = useState('recent');
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Cals state
  const [calsCategory, setCalsCategory] = useState('upcoming');
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
  const [selectedThreadActiveMessageId, setSelectedThreadActiveMessageId] = useState(null);

  const [emailBodies, setEmailBodies] = useState({});
  const [emailHeaders, setEmailHeaders] = useState({});
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

  const [error, setError] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isCheckingMail, setIsCheckingMail] = useState(false);

  const [splitMode, setSplitMode] = useState(() => {
    const m = migrateLayoutStorage(); if (m) return m;
    return localStorage.getItem('atm_split_mode') || 'none';
  });
  const [densityMode, setDensityMode] = useState(() => localStorage.getItem('atm_density') || 'default');
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

  const handleReaderScroll = useCallback((e) => {
    setReaderCompact(e.target.scrollTop > 60);
  }, []);

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

  const handleUpgrade = useCallback(async () => {
    setBillingLoading(true);
    try {
      const r = await fetch(`${API_BASE}/billing/checkout`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
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
    if (activeView==='everything') {
      const all=[]; connectedAccounts.forEach(a => { const ae=emails[a.id]?.[activeCategory]||[]; all.push(...ae.map(e=>({...e,accountId:a.id}))); });
      return all.sort((a,b)=>new Date(b.date)-new Date(a.date));
    }
    return emails[activeView]?.[activeCategory]||[];
  }, [activeView, activeCategory, connectedAccounts, emails]);

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

  const filteredDocs = useMemo(() => {
    let pool = allDocs;
    if (activeView !== 'everything') pool = pool.filter(d => d.accountId === activeView);
    if (docsCategory === 'shared') return pool.filter(d => d.shared);
    if (docsCategory === 'starred') return pool.filter(d => d.starred);
    if (docsCategory === 'trash') return [];
    return pool;
  }, [docsCategory, allDocs, activeView]);

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
        } else if (r.status===401) {
          setIsAuthed(false); setConnectedAccounts([]); setEmails({}); setSelectedEmail(null);
          setSelectedThread(null); setSelectedThreadActiveMessageId(null); setEmailBodies({}); setEmailHeaders({});
          setEditMode(false); setSelectedIds(new Set()); return;
        }
      } catch(err) { console.error('Error loading emails:', err); }
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
        accs.forEach(a => { loadEmailsForAccount(a.id); });
        Promise.all(docPromises).then(() => setIsLoadingDocs(false));
        Promise.all(eventPromises).then(() => setIsLoadingEvents(false));
        if (docsAccs.length === 0) setIsLoadingDocs(false);
        if (calsAccs.length === 0) setIsLoadingEvents(false);
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
    if(emailBodies[eid]&&emailHeaders[eid]) return;
    setIsLoadingBody(true);
    try {
      const aid=email.accountId||connectedAccounts[0]?.id; if(!aid) return;
      const r=await fetch(`${API_BASE}/emails/${aid}/${eid}`,{credentials:'include'});
      if(r.ok){
        setIsAuthed(true); const d=await r.json();
        setEmailBodies(p=>({...p,[eid]:d.body}));
        if(d.headers) setEmailHeaders(p=>({...p,[eid]:d.headers}));
        if(d.attachments) setEmailAttachments(p=>({...p,[eid]:d.attachments}));
        if(!email.isRead){
          setEmails(p=>{const n={...p};Object.keys(n).forEach(ai=>{Object.keys(n[ai]).forEach(c=>{if(n[ai][c])n[ai][c]=n[ai][c].map(e=>e.id===eid?{...e,isRead:true}:e);});});return n;});
          fetch(`${API_BASE}/emails/${aid}/${eid}/read`,{method:'POST',credentials:'include'}).catch(()=>{});
        }
      } else if(r.status===401){setIsAuthed(false);setConnectedAccounts([]);setEmails({});setSelectedEmail(null);setSelectedThread(null);setSelectedThreadActiveMessageId(null);setEmailBodies({});setEmailHeaders({});setEditMode(false);setSelectedIds(new Set());return;}
    } catch(err){console.error('Error loading email body:',err);}
    finally{setIsLoadingBody(false);}
  }, [emailBodies, emailHeaders, connectedAccounts]);

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
  }, [selectedEvent, eventEditFields, events, loadEventsForAccount]);

  const loadDocPreview = useCallback(async (doc) => {
    if (!doc?.id || !doc?.accountId) return;
    setDocPreviewLoading(true);
    setDocPreview(null);
    try {
      const r = await fetch(`${API_BASE}/docs/${doc.accountId}/${doc.id}/preview`, { credentials: 'include' });
      if (r.ok) { setDocPreview(await r.json()); } else { setDocPreview({ type: 'none' }); }
    } catch { setDocPreview({ type: 'none' }); }
    finally { setDocPreviewLoading(false); }
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
    const list=getCurrentEmails(); if(!searchQuery) return list;
    const q=searchQuery.toLowerCase();
    return list.filter(e=>(e.subject||'').toLowerCase().includes(q)||(e.from||'').toLowerCase().includes(q)||(e.snippet||'').toLowerCase().includes(q));
  }, [getCurrentEmails, searchQuery]);

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
    if(i>0){const p=filteredEmails[i-1];setSelectedEmail(p);setShowMetadata(false);loadEmailDetails(p);loadThread(p);}
  }, [selectedEmail, filteredEmails, loadEmailDetails, loadThread]);

  const navigateNext = useCallback(() => {
    if(!selectedEmail) return; const i=filteredEmails.findIndex(e=>e.id===selectedEmail.id);
    if(i<filteredEmails.length-1){const n=filteredEmails[i+1];setSelectedEmail(n);setShowMetadata(false);loadEmailDetails(n);loadThread(n);}
  }, [selectedEmail, filteredEmails, loadEmailDetails, loadThread]);

  useEffect(() => {
    const onKey = (e) => {
      if(composeOpen) return;
      const tag=(document.activeElement?.tagName||'').toLowerCase();
      if(tag==='input'||tag==='textarea'||tag==='select'||document.activeElement?.getAttribute?.('contenteditable')==='true') return;
      if(e.key==='Escape'&&splitMode==='none'&&fullPageReaderOpen){e.preventDefault();setFullPageReaderOpen(false);return;}
      if(e.key==='Enter'&&splitMode==='none'&&selectedEmail&&!fullPageReaderOpen){e.preventDefault();setFullPageReaderOpen(true);return;}
      if(e.metaKey||e.ctrlKey||e.altKey) return;
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
    };
    window.addEventListener('keydown',onKey); return ()=>window.removeEventListener('keydown',onKey);
  }, [selectedEmail, filteredEmails, loadEmailDetails, loadThread, composeOpen, splitMode, fullPageReaderOpen, navigatePrev, navigateNext]);

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

  const trashEmail = useCallback(async (email) => {
    if(!email?.id||!email?.accountId) return;
    try{const r=await fetch(`${API_BASE}/emails/${email.accountId}/${email.id}/trash`,{method:'POST',credentials:'include'});
    if(r.ok){removeEmailIds(email.accountId,[email.id]);if(selectedEmail?.id===email.id){setSelectedEmail(null);setSelectedThread(null);setSelectedThreadActiveMessageId(null);setShowMetadata(false);setFullPageReaderOpen(false);}}
    else{const d=await r.json().catch(()=>({}));setError(d?.error||'Failed to delete message');}}
    catch(err){setError(String(err?.message||err));}
  }, [selectedEmail, removeEmailIds]);

  const archiveEmail = useCallback(async (email) => {
    if(!email?.id||!email?.accountId) return;
    try{const r=await fetch(`${API_BASE}/emails/${email.accountId}/${email.id}/archive`,{method:'POST',credentials:'include'});
    if(r.ok){removeEmailIds(email.accountId,[email.id]);if(selectedEmail?.id===email.id){setSelectedEmail(null);setSelectedThread(null);setSelectedThreadActiveMessageId(null);setShowMetadata(false);setFullPageReaderOpen(false);}}
    else{const d=await r.json().catch(()=>({}));setError(d?.error||'Failed to archive message');}}
    catch(err){setError(String(err?.message||err));}
  }, [selectedEmail, removeEmailIds]);

  const batchAction = useCallback(async (action) => {
    if(selectedIds.size===0) return; setBatchWorking(true); setError(null);
    try{const by=groupSelectedByAccount();for(const[aid,ids]of by.entries()){const r=await fetch(`${API_BASE}/emails/${aid}/batch`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,emailIds:ids})});if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d?.error||`Batch ${action} failed`);}removeEmailIds(aid,ids);if(selectedEmail&&ids.includes(selectedEmail.id)){setSelectedEmail(null);setSelectedThread(null);setSelectedThreadActiveMessageId(null);setShowMetadata(false);setFullPageReaderOpen(false);}}clearSelection();setEditMode(false);}
    catch(err){setError(String(err?.message||err));}finally{setBatchWorking(false);}
  }, [selectedIds, groupSelectedByAccount, removeEmailIds, selectedEmail, clearSelection]);

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

  const closeCompose = useCallback(async ()=>{
    if(composeSending) return; await saveDraft(); setComposeOpen(false);setComposeError(null);setComposeOriginalEmail(null);setComposeAttachments([]);setComposeDraftId(null);
    if(composeFromAccountId) await loadEmailsForAccount(composeFromAccountId,'drafts');
  }, [composeSending, saveDraft, composeFromAccountId, loadEmailsForAccount]);

  const sendCompose = useCallback(async () => {
    setComposeError(null);
    const fid=composeFromAccountId; if(!fid){setComposeError('Select a sending account');return;} if(!composeTo.trim()){setComposeError('Recipient is required');return;}
    setComposeSending(true);
    try{
      let r;
      if(composeAttachments.length>0){const fd=new FormData();fd.append('to',composeTo.trim());fd.append('subject',composeSubject.trim());fd.append('body',composeBody);if(composeCc.trim())fd.append('cc',composeCc.trim());if(composeBcc.trim())fd.append('bcc',composeBcc.trim());if(composeOriginalEmail?.threadId)fd.append('threadId',composeOriginalEmail.threadId);if(composeDraftId)fd.append('draftId',composeDraftId);composeAttachments.forEach(f=>fd.append('attachments',f));r=await fetch(`${API_BASE}/emails/${fid}/send`,{method:'POST',credentials:'include',body:fd});}
      else{r=await fetch(`${API_BASE}/emails/${fid}/send`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:composeMode,to:composeTo.trim(),cc:composeCc.trim(),bcc:composeBcc.trim(),subject:composeSubject.trim(),body:composeBody,originalEmailId:composeOriginalEmail?.id||null,threadId:composeOriginalEmail?.threadId||null,draftId:composeDraftId||null,includeSignature:true})});}
      if(r.ok){await loadEmailsForAccount(fid,activeCategory);await loadEmailsForAccount(fid,'drafts');if(activeView==='everything')connectedAccounts.forEach(a=>{if(a.id!==fid)loadEmailsForAccount(a.id,activeCategory);});setComposeOpen(false);setComposeOriginalEmail(null);setComposeAttachments([]);setComposeDraftId(null);}
      else{const d=await r.json().catch(()=>({}));setComposeError(d?.error||'Send failed. If permissions changed, reconnect the account.');}
    } catch(err){setComposeError(String(err?.message||err));} finally{setComposeSending(false);}
  }, [composeFromAccountId,composeMode,composeTo,composeCc,composeBcc,composeSubject,composeBody,composeOriginalEmail,composeAttachments,composeDraftId,loadEmailsForAccount,activeCategory,activeView,connectedAccounts]);

  const onSelectEmail = useCallback((email) => {
    setSelectedEmail(email);setShowMetadata(false);setReaderCompact(false);loadEmailDetails(email);loadThread(email);setSelectedThreadActiveMessageId(email.id);
    if(splitMode==='none') setFullPageReaderOpen(true);
  }, [loadEmailDetails, loadThread, splitMode]);

  const onSelectThreadMessage = useCallback((msg) => {
    if(!selectedEmail?.accountId) return;
    const obj={id:msg.id,threadId:msg.threadId,subject:msg.subject||selectedEmail.subject,from:msg.from||selectedEmail.from,date:msg.date||selectedEmail.date,snippet:msg.snippet||'',accountId:selectedEmail.accountId,accountName:selectedEmail.accountName,source:selectedEmail.source};
    setSelectedThreadActiveMessageId(msg.id);setSelectedEmail(obj);setShowMetadata(false);loadEmailDetails(obj);
  }, [selectedEmail, loadEmailDetails]);

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
            {isFullPage && (<button className="reader-toolbar-btn" onClick={goBackToList} title="Back to inbox"><ArrowLeft size={16} strokeWidth={1.5} /></button>)}
            <button className="reader-toolbar-btn" onClick={() => archiveEmail(email)} title="Archive"><Archive size={16} strokeWidth={1.5} /></button>
            <button className="reader-toolbar-btn danger" onClick={() => trashEmail(email)} title="Delete"><Trash2 size={16} strokeWidth={1.5} /></button>
            <button className="reader-toolbar-btn" title="More"><MoreHorizontal size={16} strokeWidth={1.5} /></button>
          </div>
          <div className="reader-toolbar-right">
            <button className="reader-toolbar-btn" onClick={navigatePrev} disabled={emailIdx <= 0} title="Previous"><ChevronLeft size={16} strokeWidth={1.5} /></button>
            <span className="reader-toolbar-count">{emailIdx >= 0 ? emailIdx + 1 : '–'} of {emailCount}</span>
            <button className="reader-toolbar-btn" onClick={navigateNext} disabled={emailIdx >= emailCount - 1} title="Next"><ChevronRight size={16} strokeWidth={1.5} /></button>
          </div>
        </div>
        <div className={`reader-content${readerCompact ? ' reader--compact' : ''}`}>
          <h1 className="reader-subject">{email.subject || '(no subject)'}</h1>
          <div className="reader-meta">
            <div className="reader-avatar">{stripName(email.from || '').charAt(0).toUpperCase()}</div>
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
            <button className="reader-action-icon" onClick={() => openCompose('reply', email)} title="Reply"><Reply size={16} strokeWidth={1.5} /></button>
            <button className="reader-action-icon" onClick={() => openCompose('replyAll', email)} title="Reply all"><Users size={16} strokeWidth={1.5} /></button>
            <button className="reader-action-icon" onClick={() => openCompose('forward', email)} title="Forward"><Forward size={16} strokeWidth={1.5} /></button>
          </div>
          {email.threadId && selectedThread?.messages?.length > 1 && (
            <div style={{ border: '1px solid var(--line)', background: 'var(--bg-1)', padding: 12, marginBottom: 24, borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: 10, fontWeight: 500 }}>Conversation ({selectedThread.messages.length})</div>
              {isLoadingThread ? (<div style={{ fontSize: '12px', color: 'var(--text-2)' }}>Loading thread...</div>) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {selectedThread.messages.map(m => {
                    const active = selectedThreadActiveMessageId === m.id;
                    return (
                      <button key={m.id} onClick={() => onSelectThreadMessage(m)}
                        style={{ textAlign: 'left', padding: '8px 12px', border: 'none', borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent', background: active ? 'rgba(255,255,255,0.03)' : 'transparent', cursor: 'pointer', borderRadius: 0, color: 'inherit', fontFamily: 'inherit', width: '100%', transition: 'background 150ms ease' }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: 2 }}>{stripName(m.from || '')}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>{m.snippet || ''}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="email-body-wrapper">
            {isLoadingBody ? (
              <div style={{ padding: '48px', textAlign: 'center', background: '#fff', color: '#666' }}>Loading message...</div>
            ) : (
              <iframe title="Email content" ref={iframeRef}
                sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
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
                style={{ width: '100%', border: '0', display: 'block', background: '#F5F7FA', borderRadius: '8px', overflow: 'hidden' }} />
            )}
          </div>
          {emailAttachments[email.id]?.length > 0 && (
            <div style={{ marginTop: '24px', padding: '14px', border: '1px solid var(--line)', background: 'var(--bg-1)', borderRadius: '8px' }}>
              <div style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--text-2)' }}>
                <Paperclip size={13} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                {emailAttachments[email.id].length} attachment{emailAttachments[email.id].length !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
        {activeView !== 'everything' && (
          <div style={{ padding: '14px 20px 8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)' }}>{activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)}</div>
            {(() => {
              const idx = connectedAccounts.findIndex(a => a.id === activeView);
              if (idx === -1) return null;
              const g = getAccountGradient(idx);
              return (<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: '11px', color: 'var(--text-3)' }}><span className="account-dot" style={{ background: g.gradient, width: 6, height: 6 }} /><span>{connectedAccounts[idx].account_name || connectedAccounts[idx].gmail_email}</span></div>);
            })()}
          </div>
        )}
        <div style={{ padding: activeView === 'everything' ? '12px 20px 8px' : '0 20px 8px' }}>
          <div className="search-pill"><Search size={14} /><input ref={searchInputRef} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search messages..." /></div>
        </div>
        <div style={{ padding: '4px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => { if (selectedCount === filteredEmails.length && filteredEmails.length > 0) clearSelection(); else selectAllVisible(); }}
              disabled={filteredEmails.length === 0} title={selectedCount === filteredEmails.length ? "Deselect all" : "Select all"}
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: filteredEmails.length === 0 ? 'default' : 'pointer', opacity: filteredEmails.length === 0 ? 0.2 : 0.4, display: 'flex', alignItems: 'center', color: 'var(--text-2)' }}>
              {selectedCount > 0 && selectedCount === filteredEmails.length ? <CheckSquare size={15} /> : selectedCount > 0 ? <MinusSquare size={15} /> : <Square size={15} />}
            </button>
            {selectedCount > 0 && <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{selectedCount} selected</span>}
          </div>
          {selectedCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="btn-ghost" disabled={batchWorking} onClick={() => batchAction('archive')} title="Archive selected" style={{ padding: '4px 10px', fontSize: 11 }}><Archive size={13} /> Archive</button>
              <button className="btn-ghost danger" disabled={batchWorking} onClick={() => batchAction('trash')} title="Delete selected" style={{ padding: '4px 10px', fontSize: 11 }}><Trash2 size={13} /> Delete</button>
            </div>
          )}
        </div>
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
        <div style={{ padding: '64px 24px', textAlign: 'center' }}>
          <Mail size={32} style={{ margin: '0 auto 12px', opacity: 0.05, display: 'block' }} />
          <div style={{ color: 'var(--text-2)', fontSize: '13px' }}>{searchQuery ? 'No messages match your search' : `No messages in ${activeCategory}`}</div>
        </div>
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

          return (
            <div key={`${email.accountId||'a'}:${email.id}:${cascadeKey}`} className={`email-item${isActive ? ' active' : ''}${cc}`}
              onClick={() => { if (editMode) { toggleSelectId(email.id); return; } onSelectEmail(email); }}
              style={{ position: 'relative', padding: '0 16px', minHeight: `${rowHeight}px`, ...cs }}>
              {!email.isRead && grad && <span className="unread-marker" style={{ background: grad.gradient }} />}
              {useStackedRows ? (
                <div className="email-row-stacked">
                  <div className="row-icon-slot">{grad && <span className="account-dot" style={{ background: grad.gradient }} title={connectedAccounts[accountIndex]?.account_name || ''} />}</div>
                  <div className="email-row-stacked-content">
                    <span className="row-sender" style={{ fontWeight: 500, color: !email.isRead ? 'var(--text-0)' : 'var(--text-1)' }}>{stripName(email.from || '')}</span>
                    <span className="row-subject" style={{ fontWeight: !email.isRead ? 500 : 400, color: !email.isRead ? 'var(--text-0)' : 'var(--text-2)' }}>{email.subject || '(no subject)'}</span>
                  </div>
                  <span className="row-time">{formatTime(email.date)}</span>
                </div>
              ) : (
                <div className="email-row-grid">
                  <button className={`email-checkbox ${isSelected ? 'checked' : ''}`} onClick={e => { e.stopPropagation(); toggleSelectId(email.id); }} title={isSelected ? 'Deselect' : 'Select'}>
                    {isSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                  </button>
                  <div className="row-icon-slot">{grad && <span className="account-dot" style={{ background: grad.gradient }} title={connectedAccounts[accountIndex]?.account_name || ''} />}</div>
                  <span className="row-sender" style={{ fontWeight: 500, color: !email.isRead ? 'var(--text-0)' : 'var(--text-1)' }}>{stripName(email.from || '')}</span>
                  <span className="row-subject">
                    <span className="row-subject-title" style={{ fontWeight: !email.isRead ? 500 : 400, color: !email.isRead ? 'var(--text-0)' : 'var(--text-2)' }}>{email.subject || '(no subject)'}</span>
                    {email.snippet && <span className="row-subject-preview">{' \u2014 '}{email.snippet}</span>}
                  </span>
                  <span className="row-time">{formatTime(email.date)}</span>
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
    <PanelGroup orientation="horizontal" id="atm-everything-layout">
      <Panel defaultSize="40%" minSize="30%" id="ev-mail">
        <div className="ev-column">
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
      <PanelResizeHandle className="panel-resize-handle" />
      <Panel defaultSize="30%" minSize="22%" id="ev-docs">
        <div className="ev-column">
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
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)' }}>{anyHasDocs ? 'Reconnect Google Drive' : 'Connect Google Drive'}</div>
                <button className="btn-ghost" onClick={handleAddAccount} style={{ fontSize: '11px', padding: '4px 10px' }}><Plus size={12} strokeWidth={1.5} /> {anyHasDocs ? 'Reconnect' : 'Connect'}</button>
              </div>
            ) : evFilteredDocs.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}><FileText size={28} style={{ margin: '0 auto 10px', opacity: 0.05, display: 'block' }} /><div style={{ color: 'var(--text-2)', fontSize: '13px' }}>No documents</div></div>
            ) : evFilteredDocs.map((doc, idx) => {
              const isCascading = (Date.now() - cascadeTimestampRef.current) < 1200;
              const cc = isCascading && idx <= 23 ? ' row--intro' : '';
              const cs = isCascading && idx <= 23 ? { '--d': `${Math.min(idx + 8, 23) * 36}ms` } : {};
              const EvDocIcon = getDocIcon(doc.mimeType);
              return (
                <div key={doc.id} className={`email-item${cc}`} onClick={() => openSlideOverDoc(doc, idx)} style={{ padding: '10px 16px', minHeight: '48px', cursor: 'pointer', ...cs }}>
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
      <PanelResizeHandle className="panel-resize-handle" />
      <Panel defaultSize="30%" minSize="22%" id="ev-cals">
        <div className="ev-column">
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
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)' }}>{anyHasCals ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}</div>
                  <button className="btn-ghost" onClick={handleAddAccount} style={{ fontSize: '11px', padding: '4px 10px' }}><Plus size={12} strokeWidth={1.5} /> {anyHasCals ? 'Reconnect' : 'Connect'}</button>
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
          <div style={{ borderBottom: '1px solid var(--line-0)', padding: '12px 20px' }}><span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)' }}>{docsCategory.charAt(0).toUpperCase() + docsCategory.slice(1)}</span></div>
          <div className="doc-row" style={{ minHeight: '34px', cursor: 'default', borderBottom: '1px solid var(--line-0)' }}>
            <div /><div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>Title</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>Owner</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>Last edited</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500, textAlign: 'right' }}>Date</div>
          </div>
          {isLoadingDocs && filteredDocs.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (<div className="skeleton-row" key={`dsk-${i}`} style={{ minHeight: 48 }}><div className="skeleton-block" style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0 }} /><div className="skeleton-block" style={{ flex: 1 }} /><div className="skeleton-block" style={{ width: 80 }} /><div className="skeleton-block" style={{ width: 64 }} /></div>))
          ) : (!anyHasDocs || hasDocsError) && filteredDocs.length === 0 ? (
            <div className="connect-cta">
              <FileText size={32} strokeWidth={1.5} style={{ color: 'var(--text-3)', marginBottom: 12 }} />
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>{anyHasDocs ? 'Reconnect Google Drive' : 'Connect Google Drive'}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: 16, maxWidth: 260 }}>{anyHasDocs ? 'Drive permissions were revoked. Reconnect to see your documents.' : 'Grant Drive permissions to see your documents here'}</div>
              <button className="btn-ghost" onClick={handleAddAccount} style={{ fontSize: '12px' }}><Plus size={14} strokeWidth={1.5} /> {anyHasDocs ? 'Reconnect' : 'Connect account'}</button>
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
    const grouped = {};
    filteredAllEvents.forEach(ev => { if (!grouped[ev.day]) grouped[ev.day] = []; grouped[ev.day].push(ev); });
    return (
      <>
        <Panel defaultSize="15%" minSize="12%" maxSize="22%" id="sidebar-cals">
          <div className="sidebar" style={{ width: '100%' }}>
            <div style={{ padding: '16px 16px 16px' }}><div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)' }}>All the cals</div></div>
            <div style={{ padding: '0 0 24px' }}>
              {[{key:'upcoming',label:'Upcoming',icon:Clock},{key:'today',label:'Today',icon:Calendar},{key:'this-week',label:'This week',icon:Calendar},{key:'month',label:'Month',icon:LayoutGrid}].map(({key,label,icon:Icon}) => (
                <button key={key} onClick={()=>{setCalsCategory(key);setSelectedEvent(null);}}
                  className={`category-btn${calsCategory===key?' active':''}`}
                  style={{ width:'100%',padding:'9px 20px',textAlign:'left',display:'flex',alignItems:'center',gap:'8px',background:'transparent',border:'none',cursor:'pointer',color:calsCategory===key?'var(--text-0)':'var(--text-2)',position:'relative',fontSize:'13px',fontWeight:calsCategory===key?500:400,fontFamily:'inherit' }}>
                  <Icon size={14} strokeWidth={1.5} /><span className="category-label">{label}</span>
                </button>
              ))}
            </div>
            <div style={{ padding: '0 16px 24px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: 500, marginBottom: '8px' }}>Accounts</div>
              {connectedAccounts.map((a, i) => {
                const g = getAccountGradient(i);
                return (<div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px', fontSize: '12px', color: 'var(--text-2)' }}><span className="account-dot" style={{ background: g.gradient, width: 8, height: 8 }} />{a.account_name}</div>);
              })}
            </div>
          </div>
        </Panel>
        <PanelResizeHandle className="panel-resize-handle" />
        <Panel defaultSize="40%" minSize="28%" id="cals-list">
          <div style={{ height: '100%', overflow: 'auto', background: 'var(--surface-list)' }}>
            <div style={{ borderBottom: '1px solid var(--line-0)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)' }}>{calsCategory === 'this-week' ? 'This week' : calsCategory.charAt(0).toUpperCase() + calsCategory.slice(1)}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Agenda view</span>
            </div>
            {isLoadingEvents && filteredAllEvents.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (<div className="skeleton-row" key={`esk-${i}`} style={{ minHeight: 48 }}><div className="skeleton-block" style={{ width: 3, height: 36, borderRadius: 2, flexShrink: 0 }} /><div className="skeleton-block" style={{ width: 48 }} /><div className="skeleton-block" style={{ flex: 1 }} /></div>))
            ) : (!anyHasCals || hasEventsError) && Object.keys(grouped).length === 0 ? (
              <div className="connect-cta">
                <Calendar size={32} strokeWidth={1.5} style={{ color: 'var(--text-3)', marginBottom: 12 }} />
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>{anyHasCals ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: 16, maxWidth: 260 }}>{anyHasCals ? 'Calendar permissions were revoked. Reconnect to see your events.' : 'Grant Calendar permissions to see your events here'}</div>
                <button className="btn-ghost" onClick={handleAddAccount} style={{ fontSize: '12px' }}><Plus size={14} strokeWidth={1.5} /> {anyHasCals ? 'Reconnect' : 'Connect account'}</button>
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}><Calendar size={28} style={{ margin: '0 auto 10px', opacity: 0.05, display: 'block' }} /><div style={{ color: 'var(--text-2)', fontSize: '13px' }}>No events</div></div>
            ) : Object.entries(grouped).map(([day, dayEvents]) => (
              <div key={day}>
                <div className="cal-day-header">{day}</div>
                {dayEvents.map(ev => (
                  <div key={ev.id} className={`cal-event${selectedEvent?.id === ev.id ? ' active' : ''}`} onClick={() => setSelectedEvent(ev)}>
                    <div className="cal-event-marker" style={ev.calendarColor ? { background: ev.calendarColor } : ev.urgent ? { background: 'var(--warm-0)' } : undefined} />
                    <div className="cal-event-time">{ev.time}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="cal-event-title">{ev.title}</div>
                      <div className="cal-event-meta">{ev.calendarName && ev.calendarName !== 'primary' ? `${ev.calendarName}${ev.meta ? ' · ' : ''}` : ''}{ev.meta}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Panel>
        <PanelResizeHandle className="panel-resize-handle" />
        <Panel minSize="26%" id="cals-detail">
          <div style={{ height: '100%', background: 'var(--surface-detail)', overflow: 'auto' }}>
            {selectedEvent ? (
              <div className="email-detail-content">
                <div style={{ padding: '24px 32px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ width: '4px', height: '36px', borderRadius: '2px', background: selectedEvent.urgent ? 'var(--warm-0)' : 'var(--accent)', flexShrink: 0, marginTop: '4px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-0)', margin: '0 0 4px' }}>{selectedEvent.title}</h1>
                      {selectedEvent.urgent && (<span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 500, color: 'var(--warm-0)', background: 'rgba(255, 140, 66, 0.10)', padding: '2px 8px', borderRadius: 'var(--r-xs)' }}>Priority</span>)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Clock size={14} strokeWidth={1.5} style={{ color: 'var(--text-2)', flexShrink: 0 }} /><span style={{ fontSize: '13px', color: 'var(--text-1)' }}>{selectedEvent.day} at {selectedEvent.time}{selectedEvent.endTime ? ` – ${selectedEvent.endTime}` : ''}</span></div>
                    {selectedEvent.meta && (<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><MapPin size={14} strokeWidth={1.5} style={{ color: 'var(--text-2)', flexShrink: 0 }} /><span style={{ fontSize: '13px', color: 'var(--text-1)' }}>{selectedEvent.meta}</span></div>)}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                    <button className="btn-ghost btn-edit-doc" onClick={() => openEventEdit(selectedEvent)} style={{ fontSize: '13px', gap: '6px' }}><FileText size={14} strokeWidth={1.5} /> Edit event</button>
                    {selectedEvent.htmlLink && (<button className="btn-ghost btn-edit-doc" onClick={() => window.open(selectedEvent.htmlLink, '_blank', 'noopener,noreferrer')} style={{ fontSize: '13px', gap: '6px' }}><ExternalLink size={14} strokeWidth={1.5} /> Open in Google Calendar</button>)}
                  </div>
                  <div style={{ height: '1px', background: 'var(--line-0)', marginBottom: '24px' }} />
                  <div style={{ background: 'var(--bg-3)', borderRadius: '8px', padding: '20px', border: '1px solid var(--line-0)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '12px' }}>Details</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Status</span><span style={{ color: 'var(--text-1)' }}>{selectedEvent.status === 'confirmed' ? 'Confirmed' : selectedEvent.status || 'Confirmed'}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Organizer</span><span style={{ color: 'var(--text-1)' }}>{selectedEvent.organizer || 'You'}</span></div>
                      {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ color: 'var(--text-2)', marginBottom: '6px' }}>Attendees</div>
                          {selectedEvent.attendees.map((a, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                              <span style={{ color: 'var(--text-1)' }}>{a.name || a.email}</span>
                              <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>{a.status === 'accepted' ? 'Accepted' : a.status === 'declined' ? 'Declined' : a.status === 'tentative' ? 'Maybe' : 'Pending'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state"><div style={{ textAlign: 'center' }}><Calendar size={72} style={{ display: 'block', margin: '0 auto 16px', opacity: 0.04 }} /><div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>Select an event</div><div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Choose an event to view details</div></div></div>
            )}
          </div>
        </Panel>
      </>
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
    <div className={`app-container${introActive ? ' intro' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-2)', fontSize: '13px' }}>Loading...</div>
    </div>
  );

  if (isAuthed === false) return (
    <div className={`app-container${introActive ? ' intro' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: '420px', padding: '48px' }}>
        {authError && <div style={{ background: 'rgba(255,59,59,0.12)', border: '1px solid rgba(255,59,59,0.22)', color: 'white', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px' }}>{authError}</div>}
        <div style={{ fontSize: 'clamp(36px,5vw,52px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 0.95, marginBottom: '24px' }}>
          Everything.<br /><span style={{ color: 'var(--accent)' }}>Unified.</span>
        </div>
        <div style={{ fontSize: '15px', fontWeight: 400, color: 'var(--text-1)', marginBottom: '8px' }}>Mail, docs, and calendars from one deliberate interface.</div>
        <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '32px' }}>Encrypted tokens. No passwords stored. Disconnect anytime.</div>
        <button className="btn btn-primary" onClick={handleGoogleLogin} style={{ width: '100%', fontSize: '14px', padding: '14px', borderRadius: '10px', fontWeight: 600 }}>
          <Mail size={18} /> Sign in with Google
        </button>
        <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '16px' }}>You will be asked to grant Gmail, Drive, and Calendar permissions</div>
      </div>
    </div>
  );

  return (
    <div className={`app-container${introActive ? ' intro' : ''}`}>
      {/* Top bar */}
      <div className="top-bar">
        <img src="/logo-horizontal.svg" alt="All the mail" className="top-bar-logo" />
        <div className="module-tabs">
          <button className={`module-tab${activeModule==='everything'?' active':''}`} onClick={()=>setActiveModule('everything')}><LayoutGrid size={15} strokeWidth={1.5} /> Everything</button>
          <button className={`module-tab${activeModule==='mail'?' active':''}`} onClick={()=>setActiveModule('mail')}><Mail size={15} strokeWidth={1.5} /> Mail</button>
          <button className={`module-tab${activeModule==='docs'?' active':''}`} onClick={()=>setActiveModule('docs')}><FileText size={15} strokeWidth={1.5} /> Docs</button>
          <button className={`module-tab${activeModule==='cals'?' active':''}`} onClick={()=>setActiveModule('cals')}><Calendar size={15} strokeWidth={1.5} /> Cals</button>
        </div>
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
                  <span className="account-pill-avatar" style={{ background: g.gradient }}>{(a.account_name || a.gmail_email || '?').charAt(0).toUpperCase()}</span>
                  <span className="account-pill-label">{getShortLabel(a)}</span>
                </button>
              );
            })}
            <button className="account-pill add-pill" onClick={handleAddAccount} title="Add account"><Plus size={14} strokeWidth={1.5} /></button>
          </div>
        </div>
        <div className="top-bar-controls">
          {activeModule === 'mail' && lastSyncTime && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '6px' }}>
              <span className="sync-dot" /><span style={{ fontSize: '11px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{getRelativeTime(lastSyncTime)}</span>
            </div>
          )}
          {activeModule === 'mail' && (
            <>
              <button className="toolbar-btn" onClick={() => { if (activeView === 'everything') connectedAccounts.forEach(a => loadEmailsForAccount(a.id, activeCategory)); else loadEmailsForAccount(activeView, activeCategory); refreshEmails(); }} title="Refresh">
                <RefreshCw size={15} strokeWidth={1.5} className={(isLoadingEmails || isCheckingMail) ? 'animate-spin' : ''} />
              </button>
              <div className="module-divider" />
              <button className={`toolbar-btn${splitMode==='none'?' toolbar-active':''}`} onClick={()=>{setSplitMode('none');setFullPageReaderOpen(false);}} title="No split"><SplitNoneIcon /></button>
              <button className={`toolbar-btn${splitMode==='vertical'?' toolbar-active':''}`} onClick={()=>{setSplitMode('vertical');setFullPageReaderOpen(false);}} title="Vertical split"><SplitVerticalIcon /></button>
              <button className={`toolbar-btn${splitMode==='horizontal'?' toolbar-active':''}`} onClick={()=>{setSplitMode('horizontal');setFullPageReaderOpen(false);}} title="Horizontal split"><SplitHorizontalIcon /></button>
              <div className="module-divider" />
              <button className="toolbar-btn" onClick={cycleDensity} title={`Density: ${densityMode}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
              </button>
            </>
          )}
          <div style={{ position: 'relative', marginLeft: '4px' }}>
            <button ref={avatarButtonRef} className="avatar-btn" onClick={() => { setAvatarDropdownOpen(o => !o); setRemovingAccountId(null); }} title="Account menu">
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
                    <button onClick={handleUpgrade} disabled={billingLoading} style={{ background: 'var(--accent)', border: 'none', borderRadius: 'var(--r-xs)', color: '#fff', fontSize: '12px', fontWeight: 500, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Upgrade</button>
                  )}
                </div>
                <div className="avatar-dropdown-divider" />
                <button className="avatar-dropdown-signout" onClick={() => { setAvatarDropdownOpen(false); handleLogout(); }}><LogOut size={14} strokeWidth={1.5} /> Sign out</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="main-content">
        {activeModule === 'everything' && renderEverything()}
        {activeModule !== 'everything' && (
          <PanelGroup orientation="horizontal" id={`atm-${activeModule}-${activeModule==='mail'?splitMode:'default'}-layout`}>
            {activeModule === 'mail' && renderMailModule()}
            {activeModule === 'docs' && renderDocsModule()}
            {activeModule === 'cals' && renderCalsModule()}
          </PanelGroup>
        )}
      </div>

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
        closeCompose={closeCompose} sendCompose={sendCompose}
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
                      <iframe title="Email preview" srcDoc={buildEmailSrcDoc(body)} style={{ width: '100%', border: 'none', minHeight: '300px', background: '#F5F7FA' }} sandbox="allow-same-origin allow-popups"
                        onLoad={e => { try { const h = e.target.contentDocument?.body?.scrollHeight; if (h) e.target.style.height = h + 'px'; } catch {} }} />
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
    </div>
  );
};

export default AllTheMail;
