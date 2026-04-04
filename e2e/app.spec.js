import { test, expect } from '@playwright/test';

// ==================== MOCK HELPERS ====================

async function mockAuthenticatedUser(page) {
  // Mock auth - return authenticated user
  await page.route('**/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ user: { id: 'test-user-1', email: 'test@example.com', name: 'Test User' } }),
  }));

  // Mock accounts
  await page.route('**/accounts', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
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

  // Mock emails
  await page.route('**/emails/acc-*', route => {
    const url = route.request().url();
    if (url.includes('/thread')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages: [] }) });
    }
    if (route.request().method() === 'GET' && !url.includes('/send')) {
      const parsedUrl = new URL(url);
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
      // Email detail: /emails/acc-1/email-id
      if (pathParts.length >= 3 && pathParts[0] === 'emails' && pathParts[1].startsWith('acc-') && !pathParts[2].startsWith('?')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            body: '<p>Test email body content</p>',
            headers: { from: 'sender@test.com', to: 'me@test.com', subject: 'Test Subject', date: new Date().toISOString() },
            attachments: [],
          }),
        });
      }
      // Email list
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          emails: [
            { id: 'email-1', threadId: 'thread-1', from: 'Alice Smith <alice@test.com>', subject: 'Project Update', snippet: 'Here is the latest update...', date: new Date().toISOString(), isRead: false },
            { id: 'email-2', threadId: 'thread-2', from: 'Bob Jones <bob@test.com>', subject: 'Meeting Tomorrow', snippet: 'Lets meet at 10am...', date: new Date(Date.now() - 3600000).toISOString(), isRead: true },
            { id: 'email-3', threadId: 'thread-3', from: 'Carol Lee <carol@test.com>', subject: 'Invoice #1234', snippet: 'Please find attached...', date: new Date(Date.now() - 7200000).toISOString(), isRead: true },
          ],
        }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });

  // Mock docs
  await page.route('**/docs/acc-*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      docs: [
        { id: 'doc-1', title: 'Q1 Planning Doc', owner: 'Test User', lastEdited: new Date().toISOString(), date: new Date().toISOString(), shared: false, starred: false, mimeType: 'application/vnd.google-apps.document', webViewLink: 'https://docs.google.com/document/d/1/edit' },
        { id: 'doc-2', title: 'Budget Spreadsheet', owner: 'Bob Jones', lastEdited: new Date(Date.now() - 86400000).toISOString(), date: new Date(Date.now() - 86400000).toISOString(), shared: true, starred: true, mimeType: 'application/vnd.google-apps.spreadsheet', webViewLink: 'https://docs.google.com/spreadsheets/d/2/edit' },
      ],
    }),
  }));

  // Mock calendar events
  await page.route('**/cals/acc-*/events', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      events: [
        { id: 'evt-1', title: 'Team Standup', time: '10:00 AM', endTime: '10:30 AM', day: 'Today', meta: 'Zoom', urgent: true, attendees: [], status: 'confirmed', organizer: 'Test User', startISO: new Date().toISOString(), endISO: new Date(Date.now() + 1800000).toISOString() },
        { id: 'evt-2', title: 'Lunch Break', time: '12:00 PM', endTime: '1:00 PM', day: 'Today', meta: '', urgent: false, attendees: [], status: 'confirmed', organizer: 'Test User', startISO: new Date().toISOString(), endISO: new Date(Date.now() + 3600000).toISOString() },
      ],
    }),
  }));

  // Mock billing
  await page.route('**/billing/status', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ plan: 'free', status: 'none', currentPeriodEnd: null }),
  }));

  // Mock calendars list
  await page.route('**/cals/acc-*/calendars', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ calendars: [{ id: 'primary', summary: 'Primary', primary: true, backgroundColor: '#4285f4' }] }),
  }));
}

async function mockUnauthenticated(page) {
  await page.route('**/accounts', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) });
    }
    return route.continue();
  });
  await page.route('**/auth/me', route => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Unauthorized' }),
  }));
}

// ==================== TESTS ====================

test.describe('Landing Page', () => {
  test('loads and shows hero text', async ({ page }) => {
    await page.goto('/');
    // Landing page shows "Email." and "Unified." in the hero
    await expect(page.locator('text=Email.')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Unified.')).toBeVisible();
  });

  test('shows sign in button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Sign in with Google').first()).toBeVisible({ timeout: 15000 });
  });

  test('sign in button navigates to Google OAuth', async ({ page }) => {
    // Intercept the backend OAuth redirect so we never actually leave to Google
    let oauthRequestUrl = null;
    await page.route('**/auth/google', route => {
      oauthRequestUrl = route.request().url();
      // Fulfill with a simple response instead of following the redirect to Google
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>OAuth redirect intercepted</body></html>' });
    });

    await page.goto('/');
    const signInBtn = page.locator('text=Sign in with Google').first();
    await signInBtn.waitFor({ timeout: 15000 });
    await signInBtn.click();

    // Wait for the navigation to complete
    await page.waitForTimeout(2000);

    // Either we intercepted the route, or the page navigated to a URL containing auth/google
    const currentUrl = page.url();
    expect(oauthRequestUrl || currentUrl).toContain('/auth/google');
  });
});

test.describe('App Shell (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page);
  });

  test('renders module tabs', async ({ page }) => {
    await page.goto('/app');
    await expect(page.locator('.module-tab', { hasText: 'Everything' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.module-tab', { hasText: 'Mail' })).toBeVisible();
    await expect(page.locator('.module-tab', { hasText: 'Docs' })).toBeVisible();
    await expect(page.locator('.module-tab', { hasText: 'Cals' })).toBeVisible();
  });

  test('shows account pills including All', async ({ page }) => {
    await page.goto('/app');
    await expect(page.locator('.account-pill', { hasText: 'All' })).toBeVisible({ timeout: 15000 });
    // Should have at least the "All" pill plus two account pills
    const pills = page.locator('.account-pill');
    await expect(pills).toHaveCount(4, { timeout: 10000 }); // All + 2 accounts + add button
  });

  test('switches between module tabs', async ({ page }) => {
    await page.goto('/app');
    await expect(page.locator('.module-tab', { hasText: 'Everything' })).toBeVisible({ timeout: 15000 });

    // Click Mail tab
    await page.locator('.module-tab', { hasText: 'Mail' }).click();
    // Mail module should show the sidebar with categories
    await expect(page.locator('.module-tab.active', { hasText: 'Mail' })).toBeVisible();

    // Click Docs tab
    await page.locator('.module-tab', { hasText: 'Docs' }).click();
    await expect(page.locator('.module-tab.active', { hasText: 'Docs' })).toBeVisible();

    // Click Cals tab
    await page.locator('.module-tab', { hasText: 'Cals' }).click();
    await expect(page.locator('.module-tab.active', { hasText: 'Cals' })).toBeVisible();

    // Click Everything tab
    await page.locator('.module-tab', { hasText: 'Everything' }).click();
    await expect(page.locator('.module-tab.active', { hasText: 'Everything' })).toBeVisible();
  });
});

test.describe('Mail Module', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page);
  });

  test('renders email list with subjects', async ({ page }) => {
    await page.goto('/app');
    await expect(page.locator('.module-tab', { hasText: 'Mail' })).toBeVisible({ timeout: 15000 });
    await page.locator('.module-tab', { hasText: 'Mail' }).click();

    // Email subjects should appear
    await expect(page.locator('text=Project Update').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Meeting Tomorrow').first()).toBeVisible();
    await expect(page.locator('text=Invoice #1234').first()).toBeVisible();
  });

  test('compose button opens modal', async ({ page }) => {
    await page.goto('/app');
    await expect(page.locator('.module-tab', { hasText: 'Mail' })).toBeVisible({ timeout: 15000 });
    await page.locator('.module-tab', { hasText: 'Mail' }).click();

    // Click "New message" button in sidebar
    const composeBtn = page.locator('text=New message').first();
    await composeBtn.waitFor({ timeout: 10000 });
    await composeBtn.click();

    // Compose modal should open with expected fields
    await expect(page.locator('.compose-modal, [class*="compose"]').first()).toBeVisible({ timeout: 5000 });
    // Should show "New message" title in the modal header
    await expect(page.locator('text=New message').first()).toBeVisible();
  });
});

test.describe('Docs Module', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page);
  });

  test('renders doc titles', async ({ page }) => {
    await page.goto('/app');
    await expect(page.locator('.module-tab', { hasText: 'Docs' })).toBeVisible({ timeout: 15000 });
    await page.locator('.module-tab', { hasText: 'Docs' }).click();

    await expect(page.locator('text=Q1 Planning Doc').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Budget Spreadsheet').first()).toBeVisible();
  });
});

test.describe('Calendar Module', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page);
  });

  test('renders event titles', async ({ page }) => {
    await page.goto('/app');
    await expect(page.locator('.module-tab', { hasText: 'Cals' })).toBeVisible({ timeout: 15000 });
    await page.locator('.module-tab', { hasText: 'Cals' }).click();

    await expect(page.locator('text=Team Standup').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Lunch Break').first()).toBeVisible();
  });
});

test.describe('Account Switching', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page);
  });

  test('clicking account pill updates active state', async ({ page }) => {
    await page.goto('/app');
    // Wait for account pills to render
    await expect(page.locator('.account-pill', { hasText: 'All' })).toBeVisible({ timeout: 15000 });

    // "All" pill should be active by default
    await expect(page.locator('.account-pill.active', { hasText: 'All' })).toBeVisible();

    // Click the first account pill (Work Account)
    const accountPills = page.locator('.account-pill').filter({ hasNot: page.locator('text=All') }).filter({ hasNot: page.locator('[title="Add account"]') });
    const firstAccountPill = accountPills.first();
    await firstAccountPill.click();

    // "All" pill should no longer be active
    await expect(page.locator('.account-pill.active', { hasText: 'All' })).not.toBeVisible({ timeout: 5000 });
    // The clicked pill should be active
    await expect(firstAccountPill).toHaveClass(/active/);
  });
});

test.describe('Unauthenticated App', () => {
  test('shows login screen when not authenticated', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/app');

    // Should show the sign-in view with "Everything. Unified." and sign in button
    await expect(page.locator('text=Sign in with Google')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Responsive Layouts', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page);
  });

  test('mobile layout (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app');
    // App should still render module tabs
    await expect(page.locator('.module-tab', { hasText: 'Mail' })).toBeVisible({ timeout: 15000 });
  });

  test('desktop layout (1440px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await expect(page.locator('.module-tab', { hasText: 'Everything' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.module-tab', { hasText: 'Mail' })).toBeVisible();
    await expect(page.locator('.module-tab', { hasText: 'Docs' })).toBeVisible();
    await expect(page.locator('.module-tab', { hasText: 'Cals' })).toBeVisible();
  });
});

test.describe('Static Pages', () => {
  test('privacy page loads', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible({ timeout: 15000 });
  });

  test('terms page loads', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Console Errors', () => {
  test('no console errors on authenticated app page', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore known benign errors (favicon, HMR websocket, React dev warnings, duplicate keys)
        if (
          text.includes('favicon') ||
          text.includes('WebSocket') ||
          text.includes('DevTools') ||
          text.includes('404') ||
          text.startsWith('Warning:') ||
          text.includes('the same key')
        ) return;
        consoleErrors.push(text);
      }
    });

    await mockAuthenticatedUser(page);
    await page.goto('/app');
    await expect(page.locator('.module-tab', { hasText: 'Everything' })).toBeVisible({ timeout: 15000 });

    // Give the page a moment to settle
    await page.waitForTimeout(2000);

    expect(consoleErrors).toEqual([]);
  });
});
