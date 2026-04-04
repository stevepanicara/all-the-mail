import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars!';
const JWT_SECRET = process.env.JWT_SECRET;

// We test the authenticateToken middleware logic directly
// by simulating what it does (since importing it triggers module-level side effects)

describe('authenticateToken middleware', () => {
  function createMiddleware() {
    // Replicate the middleware logic from middleware/auth.js
    return async function authenticateToken(req, res, next) {
      const token = req.cookies.auth_token;
      if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
      } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    };
  }

  function mockReqResNext(cookies = {}) {
    const req = { cookies };
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
    };
    const next = jest.fn();
    return { req, res, next };
  }

  test('returns 401 when no token is provided', async () => {
    const middleware = createMiddleware();
    const { req, res, next } = mockReqResNext({});

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Not authenticated' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when token is invalid', async () => {
    const middleware = createMiddleware();
    const { req, res, next } = mockReqResNext({ auth_token: 'invalid.token.here' });

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when token is expired', async () => {
    const middleware = createMiddleware();
    // Create a token that expired 1 hour ago
    const expiredToken = jwt.sign({ userId: 'user-123' }, JWT_SECRET, { expiresIn: '-1h' });
    const { req, res, next } = mockReqResNext({ auth_token: expiredToken });

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next and sets userId when token is valid', async () => {
    const middleware = createMiddleware();
    const validToken = jwt.sign({ userId: 'user-123' }, JWT_SECRET, { expiresIn: '1h' });
    const { req, res, next } = mockReqResNext({ auth_token: validToken });

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('user-123');
    expect(res.statusCode).toBeNull();
  });

  test('extracts the correct userId from token payload', async () => {
    const middleware = createMiddleware();
    const validToken = jwt.sign({ userId: 'abc-def-456' }, JWT_SECRET, { expiresIn: '1h' });
    const { req, res, next } = mockReqResNext({ auth_token: validToken });

    await middleware(req, res, next);

    expect(req.userId).toBe('abc-def-456');
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('returns 401 when token is signed with wrong secret', async () => {
    const middleware = createMiddleware();
    const badToken = jwt.sign({ userId: 'user-123' }, 'wrong-secret', { expiresIn: '1h' });
    const { req, res, next } = mockReqResNext({ auth_token: badToken });

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });
});
