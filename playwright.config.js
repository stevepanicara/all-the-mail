import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: [
    {
      command: 'cd backend && SUPABASE_URL=https://fake.supabase.co SUPABASE_SERVICE_ROLE_KEY=fakekey node server.js',
      port: 3000,
      timeout: 15000,
      reuseExistingServer: true,
    },
    {
      command: 'cd frontend && BROWSER=none PORT=3001 npm start',
      port: 3001,
      timeout: 30000,
      reuseExistingServer: true,
    },
  ],
});
