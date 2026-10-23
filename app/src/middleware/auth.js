const crypto = require('crypto');

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function requireAuthApi(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Constant-time comparison against API_KEY env
function isValidApiKey(token) {
  const apiKey = process.env.API_KEY;
  if (!apiKey || !token) return false;
  const a = crypto.createHash('sha256').update(token).digest();
  const b = crypto.createHash('sha256').update(apiKey).digest();
  return crypto.timingSafeEqual(a, b);
}

function getBearerToken(req) {
  const header = req.get('Authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

// Bearer token auth for the external JSON API (API_KEY env). API is disabled when unset.
function requireApiKey(req, res, next) {
  if (!process.env.API_KEY) {
    return res.status(503).json({ error: 'API is disabled. Set API_KEY in .env to enable it.' });
  }
  if (!isValidApiKey(getBearerToken(req))) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  next();
}

module.exports = { requireAuth, requireAuthApi, requireApiKey, isValidApiKey, getBearerToken };
