import DOMPurify from 'dompurify';
import { FileText, Table2, Presentation } from 'lucide-react';
import { GRADIENT_PRESETS, FILE_TYPES } from './constants';

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
  const html = rawHtml || '<div style="padding:16px;color:#111;">(empty)</div>';
  const stripped = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '').replace(/<link[\s\S]*?>/gi, '').replace(/<meta[\s\S]*?>/gi, '').replace(/<base[\s\S]*?>/gi, '');
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>html,body{margin:0;padding:24px;background:#F5F7FA;color:#111;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;font-size:14px;line-height:1.5}img{max-width:100%;height:auto}table{max-width:100%!important}a{color:#0b57d0}body{overflow:hidden}</style></head><body>${stripped}<script>document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a'):null;if(a&&a.href){e.preventDefault();window.open(a.href,'_blank','noopener,noreferrer')}});</script></body></html>`;
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

export function getShortLabel(account) {
  const name = account.account_name || '';
  if (name) {
    const first = name.split(/\s+/)[0];
    return first.length > 14 ? first.slice(0, 13) + '\u2026' : first;
  }
  const prefix = (account.gmail_email || '').split('@')[0];
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
