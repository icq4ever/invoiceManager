const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

// Home redirect
router.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

// Login page
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('login', { error: null, layout: false });
});

// Login handler
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!adminUsername || !adminPasswordHash) {
    return res.render('login', {
      error: 'Server configuration error. Please check .env file.',
      layout: false
    });
  }

  if (username !== adminUsername) {
    return res.render('login', { error: 'Invalid username or password', layout: false });
  }

  try {
    const isValid = await bcrypt.compare(password, adminPasswordHash);

    if (!isValid) {
      return res.render('login', { error: 'Invalid username or password', layout: false });
    }

    req.session.user = { username };
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.render('login', { error: 'Authentication error', layout: false });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/login');
  });
});

module.exports = router;
