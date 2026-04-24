import DOMPurify from 'dompurify';
import { FileText, Table2, Presentation } from 'lucide-react';
import { GRADIENT_PRESETS, FILE_TYPES } from './constants';

// Force every <a> in untrusted HTML to be safe to click:
// - rel="noopener noreferrer nofollow" prevents reverse-tabnabbing + referrer leak
// - target="_blank" so a click never replaces the app frame
// - Strip dangerous CSS values from style="" attributes (position:fixed, url(), expression, etc.)
//   Style is allowed for layout (Gmail HTML uses it heavily) but never for active loading.
const DANGEROUS_CSS_RE = /(url\s*\(|expression\s*\(|behavior\s*:|@import|position\s*:\s*fixed|position\s*:\s*absolute)/i;

let _hooksRegistered = false;
function ensureDOMPurifyHooks() {
  if (_hooksRegistered) return;
  _hooksRegistered = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      node.setAttribute('rel', 'noopener noreferrer nofollow');
      node.setAttribute('target', '_blank');
    }
    if (node.hasAttribute && node.hasAttribute('style')) {
      const v = node.getAttribute('style') || '';
      if (DANGEROUS_CSS_RE.test(v)) {
        const cleaned = v
          .replace(/url\s*\([^)]*\)/gi, '')
          .replace(/expression\s*\([^)]*\)/gi, '')
          .replace(/behavior\s*:[^;]+;?/gi, '')
          .replace(/@import[^;]+;?/gi, '')
          .replace(/position\s*:\s*(fixed|absolute)\s*;?/gi, '');
        if (cleaned.trim()) node.setAttribute('style', cleaned);
        else node.removeAttribute('style');
      }
    }
  });
}

// Gmail-style deterministic avatar color from sender name
const AVATAR_COLORS = [
  '#1A73E8', '#D93025', '#188038', '#E37400',
  '#A142F4', '#E8453C', '#1E8E3E', '#F29900',
  '#8430CE', '#C5221F', '#0D652D', '#EA8600',
  '#6200EA', '#B31412', '#137333', '#F9AB00',
];

export function getSenderColor(name) {
  let hash = 0;
  const str = (name || '?').toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getSenderInitial(name) {
  const clean = (name || '?').replace(/<[^>]*>/g, '').trim();
  return (clean[0] || '?').toUpperCase();
}

// Domains that are personal email providers — don't try to load a logo
const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'aol.com',
  'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'proton.me',
  'zoho.com', 'mail.com', 'gmx.com', 'gmx.net', 'fastmail.com',
  'tutanota.com', 'hey.com', 'pm.me', 'yandex.com', 'yandex.ru',
]);

// Failed domain cache — avoid retrying domains with no logo
const _failedLogoDomains = new Set();

export function getSenderLogoUrl(fromHeader) {
  const email = getEmailOnly(fromHeader || '').toLowerCase();
  const domain = email.split('@')[1];
  if (!domain || PERSONAL_DOMAINS.has(domain) || _failedLogoDomains.has(domain)) return null;
  return `https://logo.clearbit.com/${domain}`;
}

export function markLogoFailed(fromHeader) {
  const email = getEmailOnly(fromHeader || '').toLowerCase();
  const domain = email.split('@')[1];
  if (domain) _failedLogoDomains.add(domain);
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.substring(0, 2), 16), g: parseInt(h.substring(2, 4), 16), b: parseInt(h.substring(4, 6), 16) };
}

export function getAccountGradient(accountIndex) {
  const preset = GRADIENT_PRESETS[accountIndex % GRADIENT_PRESETS.length];
  const rgb0 = hexToRgb(preset.g0);
  const rgb1 = hexToRgb(preset.g1);
  const mid = { r: Math.round((rgb0.r + rgb1.r) / 2), g: Math.round((rgb0.g + rgb1.g) / 2), b: Math.round((rgb0.b + rgb1.b) / 2) };
  return {
    ...preset, rgb0, rgb1, mid,
    gradient: `linear-gradient(90deg, ${preset.g0}, ${preset.g1})`,
    midRgba: (a) => `rgba(${mid.r}, ${mid.g}, ${mid.b}, ${a})`,
    g0Rgba: (a) => `rgba(${rgb0.r}, ${rgb0.g}, ${rgb0.b}, ${a})`,
    g1Rgba: (a) => `rgba(${rgb1.r}, ${rgb1.g}, ${rgb1.b}, ${a})`,
  };
}

export function buildEmailSrcDoc(rawHtml) {
  ensureDOMPurifyHooks();
  const html = rawHtml || '<div style="padding:16px;color:#111;">(empty)</div>';
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['div','span','p','br','hr','h1','h2','h3','h4','h5','h6',
      'a','img','table','thead','tbody','tr','td','th','caption','colgroup','col',
      'ul','ol','li','strong','b','em','i','u','s','strike','del',
      'blockquote','pre','code','sup','sub','small','center',
      'font','section','article','header','footer'],
    ALLOWED_ATTR: ['href','src','alt','title','width','height','style',
      'class','id','colspan','rowspan','align','valign','border',
      'cellpadding','cellspacing','bgcolor','color','size','face',
      'target','rel'],
    ALLOW_DATA_ATTR: false,
  });
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>html,body{margin:0;padding:24px;background:#F5F7FA;color:#111;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;font-size:14px;line-height:1.5}img{max-width:100%;height:auto}table{max-width:100%!important}a{color:#0b57d0}body{overflow:hidden}</style></head><body>${clean}</body></html>`;
}

export function stripName(s = '') { return (s || '').replace(/<.*?>/g, '').trim(); }
export function ensurePrefix(subject = '', prefix = 'Re:') {
  const s = (subject || '').trim();
  if (/^\s*(re|fw|fwd)\s*:/i.test(s)) return s;
  return `${prefix} ${s || '(no subject)'}`.trim();
}
export function getEmailOnly(addr = '') { const m = String(addr||'').match(/<([^>]+)>/); return (m?m[1]:addr).trim(); }
export function splitList(list = '') { return String(list||'').split(',').map(x=>x.trim()).filter(Boolean); }
export function uniqLower(list = []) {
  const seen = new Set(), out = [];
  for (const x of list) { const e = getEmailOnly(x).toLowerCase(); if (!e||seen.has(e)) continue; seen.add(e); out.push(x); }
  return out;
}

export function migrateLayoutStorage() {
  const old = localStorage.getItem('atm_layout');
  if (old) { const m = { split:'vertical','no-split':'none' }; const v = m[old]||'none'; localStorage.setItem('atm_split_mode',v); localStorage.removeItem('atm_layout'); return v; }
  return null;
}

export function sanitizeDocHtml(html) {
  ensureDOMPurifyHooks();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'hr', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'u', 'a', 'span', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'blockquote', 'pre', 'code', 'sup', 'sub', 'div'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'style', 'class', 'colspan', 'rowspan'],
    ALLOW_DATA_ATTR: false,
  });
}

export function formatRelativeEdit(isoDate) {
  if (!isoDate) return '';
  const now = new Date(), d = new Date(isoDate), ms = now - d;
  const mins = Math.floor(ms / 60000), hrs = Math.floor(ms / 3600000), days = Math.floor(ms / 86400000);
  if (mins < 1) return 'Edited just now';
  if (mins < 60) return `Edited ${mins}m ago`;
  if (hrs < 24) return `Edited ${hrs}h ago`;
  if (days === 1) return 'Edited yesterday';
  if (days < 7) return `Edited ${days}d ago`;
  return `Edited ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export function getShortLabel(account, allAccounts = []) {
  const name = account.account_name || '';
  const email = account.gmail_email || '';

  // If multiple accounts share the same name, use email prefix instead
  if (name && allAccounts.length > 1) {
    const sameName = allAccounts.filter(a => (a.account_name || '') === name);
    if (sameName.length > 1) {
      const prefix = email.split('@')[0];
      return prefix.length > 14 ? prefix.slice(0, 13) + '\u2026' : prefix;
    }
  }

  if (name) {
    const first = name.split(/\s+/)[0];
    return first.length > 14 ? first.slice(0, 13) + '\u2026' : first;
  }
  const prefix = email.split('@')[0];
  return prefix.length > 14 ? prefix.slice(0, 13) + '\u2026' : prefix;
}

export function getDocEditUrl(doc) {
  if (doc.webViewLink) return doc.webViewLink;
  const ft = FILE_TYPES[doc.mimeType];
  if (ft?.editor) return `https://docs.google.com/${ft.editor}/d/${doc.id}/edit`;
  return null;
}

export function getDocIcon(mimeType) {
  const iconMap = {
    'application/vnd.google-apps.document': FileText,
    'application/vnd.google-apps.spreadsheet': Table2,
    'application/vnd.google-apps.presentation': Presentation,
    'application/vnd.google-apps.form': FileText,
    'application/pdf': FileText,
  };
  return iconMap[mimeType] || FileText;
}

export function getDocEditorLabel(mimeType) {
  return FILE_TYPES[mimeType]?.editorLabel || 'Google Docs';
}

export function getRelativeTime(date) {
  const now=new Date(), d=new Date(date), ms=now-d, mins=Math.floor(ms/60000), hrs=Math.floor(ms/3600000);
  if(mins<1) return 'Just now'; if(mins<60) return `${mins}m ago`; if(hrs<24) return `${hrs}h ago`;
  return d.toLocaleDateString(undefined,{month:'short',day:'numeric'});
}

export function formatTime(date) {
  const now=new Date(), d=new Date(date);
  if(d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&d.getDate()===now.getDate()) return d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  const diff=Math.floor((now-d)/86400000);
  if(diff<7) return d.toLocaleDateString(undefined,{weekday:'short'});
  if(d.getFullYear()===now.getFullYear()) return d.toLocaleDateString(undefined,{month:'short',day:'numeric'});
  return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
}
