import jwt from 'jsonwebtoken';
import { isJtiRevoked } from '../lib/security.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

async function authenticateToken(req, res, next) {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Pin algorithm to block alg-confusion / alg=none forgery.
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.jti && isJtiRevoked(decoded.jti)) {
      return res.status(401).json({ error: 'Session revoked' });
    }
    req.userId = decoded.userId;
    req.jti = decoded.jti || null;
    req.tokenExp = decoded.exp || null;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export { JWT_SECRET, authenticateToken };
