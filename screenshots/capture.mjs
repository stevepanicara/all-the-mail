import { chromium } from '@playwright/test';

const FRONTEND = 'http://localhost:3001';
const BACKEND = 'http://localhost:3002';
const DIR = '/Users/stephenpanicara/Downloads/all-the-mail-main/screenshots';

async function mockAuth(page) {
  await page.route('**/auth/me', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ user: { id: 'test-user-1', email: 'test@example.com', name: 'Test User' } }),
  }));
  await page.route('**/accounts', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          accounts: [
            { id: 'acc-1', gmail_email: 'work@gmail.com', account_name: 'Work Account', granted_scopes: ['mail', 'docs', 'cals'], created_at: new Date().toISOString() },
            { id: 'acc-2', gmail_email: 'personal@gmail.com', account_name: 'Personal', granted_scopes: ['mail'], created_at: new Date().toISOString() },
          ],
        }),
      });
    }
    return route.continue();
  });
  await page.route('**/emails/acc-*', route => {
    const url = route.request().url();
    if (url.includes('/thread')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages: [] }) });
    if (route.request().method() === 'GET' && !url.includes('/send')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          emails: [
            { id: 'e1', threadId: 't1', from: 'Alice Smith <alice@test.com>', subject: 'Project Update - Q2 Planning', snippet: 'Here is the latest update on our project timeline...', date: new Date().toISOString(), isRead: false },
            { id: 'e2', threadId: 't2', from: 'Bob Jones <bob@test.com>', subject: 'Meeting Tomorrow at 10am', snippet: 'Hi team, lets sync up tomorrow morning...', date: new Date(Date.now() - 3600000).toISOString(), isRead: true },
            { id: 'e3', threadId: 't3', from: 'Carol Lee <carol@test.com>', subject: 'Invoice #1234 - March', snippet: 'Please find the attached invoice for March...', date: new Date(Date.now() - 7200000).toISOString(), isRead: true },
            { id: 'e4', threadId: 't4', from: 'Dave Wilson <dave@test.com>', subject: 'New Feature Request', snippet: 'I have a suggestion for the dashboard...', date: new Date(Date.now() - 10800000).toISOString(), isRead: false },
            { id: 'e5', threadId: 't5', from: 'Eve Martin <eve@test.com>', subject: 'Weekly Report', snippet: 'Attached is this weeks progress report...', date: new Date(Date.now() - 14400000).toISOString(), isRead: true },
          ],
        }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
  await page.route('**/docs/acc-*', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      docs: [
        { id: 'd1', title: 'Q1 Planning Doc', owner: 'Test User', lastEdited: new Date().toISOString(), date: new Date().toISOString(), shared: false, starred: false, mimeType: 'application/vnd.google-apps.document', webViewLink: 'https://docs.google.com/document/d/1/edit' },
        { id: 'd2', title: 'Budget Spreadsheet', owner: 'Bob Jones', lastEdited: new Date(Date.now() - 86400000).toISOString(), date: new Date(Date.now() - 86400000).toISOString(), shared: true, starred: true, mimeType: 'application/vnd.google-apps.spreadsheet', webViewLink: 'https://docs.google.com/spreadsheets/d/2/edit' },
        { id: 'd3', title: 'Product Roadmap Slides', owner: 'Carol Lee', lastEdited: new Date(Date.now() - 172800000).toISOString(), date: new Date(Date.now() - 172800000).toISOString(), shared: true, starred: false, mimeType: 'application/vnd.google-apps.presentation', webViewLink: 'https://docs.google.com/presentation/d/3/edit' },
      ],
    }),
  }));
  await page.route('**/cals/acc-*/events', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      events: [
        { id: 'ev1', title: 'Team Standup', time: '10:00 AM', endTime: '10:30 AM', day: 'Today', meta: 'Zoom', urgent: true, attendees: [], status: 'confirmed', organizer: 'Test User', startISO: new Date().toISOString(), endISO: new Date(Date.now() + 1800000).toISOString() },
        { id: 'ev2', title: 'Lunch Break', time: '12:00 PM', endTime: '1:00 PM', day: 'Today', meta: '', urgent: false, attendees: [], status: 'confirmed', organizer: 'Test User', startISO: new Date().toISOString(), endISO: new Date(Date.now() + 3600000).toISOString() },
        { id: 'ev3', title: 'Product Review', time: '2:00 PM', endTime: '3:00 PM', day: 'Today', meta: 'Conference Room B', urgent: false, attendees: ['alice@test.com'], status: 'confirmed', organizer: 'Alice Smith', startISO: new Date().toISOString(), endISO: new Date(Date.now() + 7200000).toISOString() },
      ],
    }),
  }));
  await page.route('**/billing/status', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ plan: 'free', status: 'none', currentPeriodEnd: null }),
  }));
  await page.route('**/cals/acc-*/calendars', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ calendars: [{ id: 'primary', summary: 'Primary', primary: true, backgroundColor: '#4285f4' }] }),
  }));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // 1. Landing page
  console.log('Capturing landing page...');
  const landing = await context.newPage();
  await landing.goto(FRONTEND, { waitUntil: 'networkidle', timeout: 30000 });
  await landing.waitForTimeout(1000);
  await landing.screenshot({ path: `${DIR}/01-landing.png`, fullPage: false });
  await landing.close();

  // 2. Authenticated app - Everything view
  console.log('Capturing Everything view...');
  const app = await context.newPage();
  await mockAuth(app);
  await app.goto(`${FRONTEND}/app`, { waitUntil: 'networkidle', timeout: 30000 });
  await app.waitForTimeout(2000);
  await app.screenshot({ path: `${DIR}/02-everything.png`, fullPage: false });

  // 3. Mail view
  console.log('Capturing Mail view...');
  const mailTab = app.locator('.module-tab', { hasText: 'Mail' });
  await mailTab.click();
  await app.waitForTimeout(1500);
  await app.screenshot({ path: `${DIR}/03-mail.png`, fullPage: false });

  // 4. Compose modal
  console.log('Capturing Compose modal...');
  const composeBtn = app.locator('text=New message').first();
  await composeBtn.click();
  await app.waitForTimeout(1000);
  await app.screenshot({ path: `${DIR}/04-compose.png`, fullPage: false });
  // Close modal
  await app.keyboard.press('Escape');
  await app.waitForTimeout(500);
  // If overlay still there, click outside or force-remove it
  const overlay = app.locator('.modal-overlay');
  if (await overlay.isVisible().catch(() => false)) {
    await app.evaluate(() => {
      document.querySelectorAll('.modal-overlay, .compose-modal, [class*="compose-overlay"]').forEach(el => el.remove());
    });
    await app.waitForTimeout(500);
  }

  // 5. Docs view
  console.log('Capturing Docs view...');
  const docsTab = app.locator('.module-tab', { hasText: 'Docs' });
  await docsTab.click();
  await app.waitForTimeout(1500);
  await app.screenshot({ path: `${DIR}/05-docs.png`, fullPage: false });

  // 6. Cals view
  console.log('Capturing Calendar view...');
  const calsTab = app.locator('.module-tab', { hasText: 'Cals' });
  await calsTab.click();
  await app.waitForTimeout(1500);
  await app.screenshot({ path: `${DIR}/06-calendar.png`, fullPage: false });

  // 7. Mobile view
  console.log('Capturing Mobile view...');
  await app.setViewportSize({ width: 375, height: 812 });
  await app.locator('.module-tab', { hasText: 'Mail' }).click();
  await app.waitForTimeout(1500);
  await app.screenshot({ path: `${DIR}/07-mobile.png`, fullPage: false });

  // 8. Privacy page
  console.log('Capturing Privacy page...');
  const privacy = await context.newPage();
  await privacy.goto(`${FRONTEND}/privacy`, { waitUntil: 'networkidle', timeout: 30000 });
  await privacy.waitForTimeout(1000);
  await privacy.screenshot({ path: `${DIR}/08-privacy.png`, fullPage: false });
  await privacy.close();

  await browser.close();
  console.log('All screenshots captured!');
})();
