import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars!';
const JWT_SECRET = process.env.JWT_SECRET;

// Set required env vars before any module imports
// Deliberately NOT setting STRIPE_SECRET_KEY so stripe is null
process.env.SUPABASE_URL = 'https://fake.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fakekey';
process.env.GOOGLE_CLIENT_ID = 'fake-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'fake-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/google/callback';

// Supabase mock — we need finer control for billing tests
const mockSingle = jest.fn(() => Promise.resolve({ data: null, error: null }));
const mockEq2 = jest.fn(() => ({ single: mockSingle }));
const mockEq = jest.fn(() => ({ eq: mockEq2, single: mockSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq, single: mockSingle }));
const mockFrom = jest.fn(() => ({
  select: mockSelect,
  insert: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: null, error: null })) })) })),
  update: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ data: null, error: null })) })),
  delete: jest.fn(() => ({ eq: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ data: null, error: null })) })) })),
  upsert: jest.fn(() => Promise.resolve({ data: null, error: null })),
}));

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
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

// Mock stripe — return null (Stripe not configured)
jest.unstable_mockModule('stripe', () => ({
  default: jest.fn(() => null),
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../server.js');

// Helper: create a valid auth cookie
function makeAuthCookie() {
  const token = jwt.sign({ userId: 'test-user-123' }, JWT_SECRET, { expiresIn: '1h' });
  return `auth_token=${token}`;
}

describe('Billing routes', () => {
  beforeEach(() => {
    mockSingle.mockReset();
    mockEq.mockReset();
    mockEq2.mockReset();
    mockSelect.mockReset();
    mockFrom.mockReset();

    // Re-wire the chain for each test
    mockSingle.mockImplementation(() => Promise.resolve({ data: null, error: null }));
    mockEq2.mockImplementation(() => ({ single: mockSingle }));
    mockEq.mockImplementation(() => ({ eq: mockEq2, single: mockSingle }));
    mockSelect.mockImplementation(() => ({ eq: mockEq, single: mockSingle }));
    mockFrom.mockImplementation(() => ({
      select: mockSelect,
      insert: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: null, error: null })) })) })),
      update: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ data: null, error: null })) })),
      delete: jest.fn(() => ({ eq: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ data: null, error: null })) })) })),
      upsert: jest.fn(() => Promise.resolve({ data: null, error: null })),
    }));
  });

  test('GET /billing/status returns free plan when no subscription exists', async () => {
    // mockSingle returns { data: null } meaning no subscription found
    // The billing route catches the error and returns free plan
    const res = await request(app)
      .get('/billing/status')
      .set('Cookie', makeAuthCookie());

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('plan');
    expect(res.body.plan).toBe('free');
    expect(res.body.status).toBe('none');
    expect(res.body.currentPeriodEnd).toBeNull();
  });

  test('POST /billing/checkout returns 501 when Stripe is not configured', async () => {
    const res = await request(app)
      .post('/billing/checkout')
      .set('Cookie', makeAuthCookie());

    expect(res.status).toBe(501);
    expect(res.body).toEqual({ error: 'Stripe not configured' });
  });

  test('POST /billing/portal returns 501 when Stripe is not configured', async () => {
    const res = await request(app)
      .post('/billing/portal')
      .set('Cookie', makeAuthCookie());

    expect(res.status).toBe(501);
    expect(res.body).toEqual({ error: 'Stripe not configured' });
  });

  test('POST /billing/webhook returns 501 when Stripe is not configured', async () => {
    const res = await request(app)
      .post('/billing/webhook')
      .set('Content-Type', 'application/json')
      .send('{}');

    expect(res.status).toBe(501);
    expect(res.body).toEqual({ error: 'Stripe not configured' });
  });
});
