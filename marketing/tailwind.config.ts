import type { Config } from 'tailwindcss';

// Brand v2 tokens, mirrored from /frontend/src/brand.css so the marketing
// site shares the same look-and-feel without us having to import the CRA
// stylesheet. Keep this file in sync if brand tokens evolve.
const config: Config = {
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx}',
    './content/**/*.{md,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: '#FAFAF7',
        ink: '#0A0A0A',
        signal: '#FF3A1D',
        acid: '#CCFF00',
        voltage: '#FFE500',
        cobalt: '#1B2BFF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        condensed: ['"Agency FB"', '"Barlow Condensed"', 'sans-serif'],
      },
      maxWidth: {
        prose: '68ch',
      },
    },
  },
  plugins: [],
};

export default config;
