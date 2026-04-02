export const API_BASE = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_URL || 'http://localhost:3000';

export const GRADIENT_PRESETS = [
  { key: 'purple-red',    g0: '#6C4CFF', g1: '#FF4C8B' },
  { key: 'cyan-green',    g0: '#00E5FF', g1: '#00FF94' },
  { key: 'yellow-orange', g0: '#FFD84D', g1: '#FF8C2B' },
  { key: 'orange-red',    g0: '#FF8C42', g1: '#FF3B3B' },
  { key: 'violet-cyan',   g0: '#7A5CFF', g1: '#4DE6FF' },
  { key: 'pink-orange',   g0: '#FF4FB6', g1: '#FFB24D' },
  { key: 'green-yellow',  g0: '#00FF94', g1: '#FFD84D' },
  { key: 'blue-purple',   g0: '#3B82F6', g1: '#A855F7' },
];

export const DENSITY_HEIGHTS = { default: 56, comfortable: 64, compact: 46 };

export const FILE_TYPES = {
  'application/vnd.google-apps.document': { label: 'Google Doc', editor: 'document', editorLabel: 'Google Docs' },
  'application/vnd.google-apps.spreadsheet': { label: 'Google Sheet', editor: 'spreadsheets', editorLabel: 'Google Sheets' },
  'application/vnd.google-apps.presentation': { label: 'Google Slide', editor: 'presentation', editorLabel: 'Google Slides' },
  'application/vnd.google-apps.form': { label: 'Google Form', editor: 'forms', editorLabel: 'Google Forms' },
  'application/pdf': { label: 'PDF', editor: null, editorLabel: null },
};
