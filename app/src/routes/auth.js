const express = require('express');
const bcrypt = require('bcrypt');
const { getDatabase } = require('../config/database');
const router = express.Router();

function getAdmin() {
  const db = getDatabase();
  return db.prepare('SELECT username, password_hash FROM admin_settings WHERE id = 1').get();
}

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

  const admin = getAdmin();
  res.render('login', { error: null, setup: !admin, layout: false });
});

// Login handler
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const admin = getAdmin();

  if (!admin) {
    return res.render('login', {
      error: null,
      setup: true,
      layout: false
    });
  }

  if (username !== admin.username) {
    return res.render('login', { error: 'Invalid username or password', setup: false, layout: false });
  }

  try {
    const isValid = await bcrypt.compare(password, admin.password_hash);

    if (!isValid) {
      return res.render('login', { error: 'Invalid username or password', setup: false, layout: false });
    }

    req.session.user = { username };
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.render('login', { error: 'Authentication error', setup: false, layout: false });
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
