import { jest } from '@jest/globals';

// Set required env vars before any module imports
process.env.SUPABASE_URL = 'https://fake.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fakekey';
process.env.GOOGLE_CLIENT_ID = 'fake-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'fake-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/google/callback';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars!';

// Mock @supabase/supabase-js before anything imports it
jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          })),
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      upsert: jest.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  })),
}));

// Mock googleapis
jest.unstable_mockModule('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest.fn(() => 'https://accounts.google.com/o/oauth2/v2/auth?fake=true'),
        getToken: jest.fn(() => Promise.resolve({ tokens: {} })),
        setCredentials: jest.fn(),
        on: jest.fn(),
      })),
    },
    oauth2: jest.fn(() => ({
      userinfo: { get: jest.fn(() => Promise.resolve({ data: {} })) },
    })),
    gmail: jest.fn(() => ({})),
    drive: jest.fn(() => ({})),
    calendar: jest.fn(() => ({})),
  },
}));

// Mock stripe
jest.unstable_mockModule('stripe', () => ({
  default: jest.fn(() => null),
}));

// Now import supertest and the app
const { default: request } = await import('supertest');
const { default: app } = await import('../server.js');

describe('Health endpoint', () => {
  test('GET /health returns 200 with { status: "ok" }', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('Auth routes', () => {
  test('GET /auth/me returns 401 without auth cookie', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /auth/logout clears auth_token cookie and returns success', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    // Check that set-cookie header clears the auth_token
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const authCookie = Array.isArray(cookies)
      ? cookies.find(c => c.includes('auth_token'))
      : cookies;
    expect(authCookie).toBeDefined();
    // A cleared cookie typically has an expiry in the past or empty value
    expect(authCookie).toMatch(/auth_token/);
  });

  test('GET /auth/google redirects to Google OAuth', async () => {
    const res = await request(app).get('/auth/google');
    // Should redirect (302)
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/accounts\.google\.com|fake=true/);
  });
});

describe('Protected routes return 401 without auth', () => {
  test('GET /accounts returns 401 without auth cookie', async () => {
    const res = await request(app).get('/accounts');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('GET /emails/some-account-id returns 401 without auth cookie', async () => {
    const res = await request(app).get('/emails/some-account-id');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('GET /docs/some-account-id returns 401 without auth cookie', async () => {
    const res = await request(app).get('/docs/some-account-id');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('GET /cals/some-account-id/events returns 401 without auth cookie', async () => {
    const res = await request(app).get('/cals/some-account-id/events');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('GET /billing/status returns 401 without auth cookie', async () => {
    const res = await request(app).get('/billing/status');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /billing/checkout returns 401 without auth cookie', async () => {
    const res = await request(app).post('/billing/checkout');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /billing/portal returns 401 without auth cookie', async () => {
    const res = await request(app).post('/billing/portal');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('DELETE /accounts/some-id returns 401 without auth cookie', async () => {
    const res = await request(app).delete('/accounts/some-id');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('GET /emails/some-id/msg-id returns 401 without auth cookie', async () => {
    const res = await request(app).get('/emails/some-id/msg-id');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /emails/some-id/send returns 401 without auth cookie', async () => {
    const res = await request(app).post('/emails/some-id/send');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /emails/some-id/msg-id/archive returns 401 without auth cookie', async () => {
    const res = await request(app).post('/emails/some-id/msg-id/archive');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /emails/some-id/msg-id/trash returns 401 without auth cookie', async () => {
    const res = await request(app).post('/emails/some-id/msg-id/trash');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('GET /cals/some-id/calendars returns 401 without auth cookie', async () => {
    const res = await request(app).get('/cals/some-id/calendars');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('PATCH /cals/some-id/events/evt-id returns 401 without auth cookie', async () => {
    const res = await request(app).patch('/cals/some-id/events/evt-id');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('GET /docs/some-id/file-id returns 401 without auth cookie', async () => {
    const res = await request(app).get('/docs/some-id/file-id');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('GET /docs/some-id/file-id/preview returns 401 without auth cookie', async () => {
    const res = await request(app).get('/docs/some-id/file-id/preview');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});

describe('Non-existent routes', () => {
  test('GET /nonexistent returns 404', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
  });
});
