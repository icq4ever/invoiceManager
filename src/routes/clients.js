const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getDatabase } = require('../config/database');

const router = express.Router();

// Apply auth to all routes
router.use(requireAuth);

// List clients
router.get('/', (req, res) => {
  const db = getDatabase();
  const clients = db.prepare('SELECT * FROM clients ORDER BY name ASC').all();
  res.render('clients/list', { clients });
});

// New client form
router.get('/new', (req, res) => {
  res.render('clients/form', { client: null, error: null });
});

// Create client
router.post('/', (req, res) => {
  const db = getDatabase();
  const { name, business_number, contact_person, phone, email, address } = req.body;

  try {
    db.prepare(`
      INSERT INTO clients (name, business_number, contact_person, phone, email, address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, business_number, contact_person, phone, email, address);

    res.redirect('/clients');
  } catch (err) {
    console.error('Error creating client:', err);
    res.render('clients/form', { client: req.body, error: 'Failed to create client' });
  }
});

// Edit client form
router.get('/:id/edit', (req, res) => {
  const db = getDatabase();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);

  if (!client) {
    return res.redirect('/clients');
  }

  res.render('clients/form', { client, error: null });
});

// Update client
router.post('/:id', (req, res) => {
  const db = getDatabase();
  const { name, business_number, contact_person, phone, email, address } = req.body;
  const clientId = req.params.id;

  try {
    db.prepare(`
      UPDATE clients
      SET name = ?, business_number = ?, contact_person = ?, phone = ?, email = ?, address = ?
      WHERE id = ?
    `).run(name, business_number, contact_person, phone, email, address, clientId);

    res.redirect('/clients');
  } catch (err) {
    console.error('Error updating client:', err);
    res.render('clients/form', { client: { ...req.body, id: clientId }, error: 'Failed to update client' });
  }
});

// Delete client
router.post('/:id/delete', (req, res) => {
  const db = getDatabase();

  try {
    db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
    res.redirect('/clients');
  } catch (err) {
    console.error('Error deleting client:', err);
    res.redirect('/clients');
  }
});

// API: Get client by ID (for AJAX)
router.get('/api/:id', (req, res) => {
  const db = getDatabase();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);

  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }

  res.json(client);
});

module.exports = router;
