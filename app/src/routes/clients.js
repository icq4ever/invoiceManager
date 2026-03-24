const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const { getDatabase } = require('../config/database');

const router = express.Router();

// Configure multer for business registration uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/clients');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const allowedMimes = /image\/(jpeg|jpg|png|gif|webp)|application\/pdf/;
    const mimetype = allowedMimes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image or PDF files are allowed'));
  }
});

// Apply auth to all routes
router.use(requireAuth);

// List clients with hybrid search and pagination
router.get('/', (req, res) => {
  const db = getDatabase();
  const searchQuery = req.query.q || '';
  const page = parseInt(req.query.page) || 1;
  const perPage = 50;
  const clientSideThreshold = 100;

  const totalCount = db.prepare('SELECT COUNT(*) as total FROM clients').get().total;
  const useClientSide = totalCount <= clientSideThreshold && !searchQuery;

  let clients, totalPages;

  if (useClientSide) {
    clients = db.prepare('SELECT * FROM clients ORDER BY name ASC').all();
    totalPages = 1;
  } else {
    let whereClause = '';
    let params = [];

    if (searchQuery) {
      whereClause = 'WHERE name LIKE ? OR contact_person LIKE ?';
      params = [`%${searchQuery}%`, `%${searchQuery}%`];
    }

    const filteredCount = db.prepare(`SELECT COUNT(*) as total FROM clients ${whereClause}`).get(...params).total;
    totalPages = Math.ceil(filteredCount / perPage);

    clients = db.prepare(`SELECT * FROM clients ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`).all(...params, perPage, (page - 1) * perPage);
  }

  res.render('clients/list', { clients, searchQuery, useClientSide, currentPage: page, totalPages });
});

// New client form
router.get('/new', (req, res) => {
  res.render('clients/form', { client: null, error: null });
});

// Client detail view
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);

  if (!client) {
    return res.redirect('/clients');
  }

  res.render('clients/detail', { client });
});

// Create client
router.post('/', upload.single('business_registration'), (req, res) => {
  const db = getDatabase();
  const { name, business_number, contact_person, phone, email, address } = req.body;
  const bizRegPath = req.file ? '/uploads/clients/' + req.file.filename : null;

  try {
    db.prepare(`
      INSERT INTO clients (name, business_number, contact_person, phone, email, address, business_registration_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, business_number, contact_person, phone, email, address, bizRegPath);

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
router.post('/:id', upload.single('business_registration'), (req, res) => {
  const db = getDatabase();
  const { name, business_number, contact_person, phone, email, address, remove_business_registration } = req.body;
  const clientId = req.params.id;

  try {
    const existing = db.prepare('SELECT business_registration_path FROM clients WHERE id = ?').get(clientId);
    let bizRegPath = existing?.business_registration_path || null;

    if (remove_business_registration) {
      bizRegPath = null;
    } else if (req.file) {
      bizRegPath = '/uploads/clients/' + req.file.filename;
    }

    db.prepare(`
      UPDATE clients
      SET name = ?, business_number = ?, contact_person = ?, phone = ?, email = ?, address = ?, business_registration_path = ?
      WHERE id = ?
    `).run(name, business_number, contact_person, phone, email, address, bizRegPath, clientId);

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
