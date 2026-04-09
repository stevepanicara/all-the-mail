export const API_BASE = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_URL || 'http://localhost:3000';

export const GRADIENT_PRESETS = [
  { key: 'violet-rose',   g0: '#7C6BF0', g1: '#E05A9A' },
  { key: 'amber-red',     g0: '#F59E0B', g1: '#EF4444' },
  { key: 'yellow-orange', g0: '#FFD84D', g1: '#FF8C2B' },
  { key: 'orange-red',    g0: '#FF8C42', g1: '#FF3B3B' },
  { key: 'rose-amber',    g0: '#FB7185', g1: '#FBBF24' },
  { key: 'sage-teal',     g0: '#6EE7B7', g1: '#0D9488' },
  { key: 'slate-indigo',  g0: '#94A3B8', g1: '#6366F1' },
  { key: 'terracotta',    g0: '#C2614F', g1: '#E8956D' },
];

export const DENSITY_HEIGHTS = { default: 56, comfortable: 64, compact: 46 };

export const FILE_TYPES = {
  'application/vnd.google-apps.document': { label: 'Google Doc', editor: 'document', editorLabel: 'Google Docs' },
  'application/vnd.google-apps.spreadsheet': { label: 'Google Sheet', editor: 'spreadsheets', editorLabel: 'Google Sheets' },
  'application/vnd.google-apps.presentation': { label: 'Google Slide', editor: 'presentation', editorLabel: 'Google Slides' },
  'application/vnd.google-apps.form': { label: 'Google Form', editor: 'forms', editorLabel: 'Google Forms' },
  'application/pdf': { label: 'PDF', editor: null, editorLabel: null },
};
