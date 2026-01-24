const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const { getDatabase } = require('../config/database');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/companies');
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// Apply auth to all routes
router.use(requireAuth);

// List companies
router.get('/', (req, res) => {
  const db = getDatabase();
  const companies = db.prepare('SELECT * FROM companies ORDER BY is_default DESC, name ASC').all();
  res.render('companies/list', { companies });
});

// New company form
router.get('/new', (req, res) => {
  res.render('companies/form', { company: null, error: null });
});

// Create company
router.post('/', upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'stamp', maxCount: 1 }
]), (req, res) => {
  const db = getDatabase();
  const { name, business_number, representative, address, phone, email, bank_info, invoice_prefix, is_default } = req.body;

  const logoPath = req.files?.logo?.[0] ? '/uploads/companies/' + req.files.logo[0].filename : null;
  const stampPath = req.files?.stamp?.[0] ? '/uploads/companies/' + req.files.stamp[0].filename : null;

  try {
    // If this is set as default, clear other defaults
    if (is_default) {
      db.prepare('UPDATE companies SET is_default = 0').run();
    }

    db.prepare(`
      INSERT INTO companies (name, business_number, representative, address, phone, email, bank_info, logo_path, stamp_path, invoice_prefix, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, business_number, representative, address, phone, email, bank_info, logoPath, stampPath, invoice_prefix || 'INV', is_default ? 1 : 0);

    res.redirect('/companies');
  } catch (err) {
    console.error('Error creating company:', err);
    res.render('companies/form', { company: req.body, error: 'Failed to create company' });
  }
});

// Edit company form
router.get('/:id/edit', (req, res) => {
  const db = getDatabase();
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);

  if (!company) {
    return res.redirect('/companies');
  }

  res.render('companies/form', { company, error: null });
});

// Update company
router.post('/:id', upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'stamp', maxCount: 1 }
]), (req, res) => {
  const db = getDatabase();
  const { name, business_number, representative, address, phone, email, bank_info, invoice_prefix, is_default } = req.body;
  const companyId = req.params.id;

  const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
  if (!existing) {
    return res.redirect('/companies');
  }

  let logoPath = existing.logo_path;
  let stampPath = existing.stamp_path;

  if (req.files?.logo?.[0]) {
    logoPath = '/uploads/companies/' + req.files.logo[0].filename;
  }
  if (req.files?.stamp?.[0]) {
    stampPath = '/uploads/companies/' + req.files.stamp[0].filename;
  }

  try {
    // If this is set as default, clear other defaults
    if (is_default) {
      db.prepare('UPDATE companies SET is_default = 0').run();
    }

    db.prepare(`
      UPDATE companies
      SET name = ?, business_number = ?, representative = ?, address = ?, phone = ?, email = ?, bank_info = ?, logo_path = ?, stamp_path = ?, invoice_prefix = ?, is_default = ?
      WHERE id = ?
    `).run(name, business_number, representative, address, phone, email, bank_info, logoPath, stampPath, invoice_prefix || 'INV', is_default ? 1 : 0, companyId);

    res.redirect('/companies');
  } catch (err) {
    console.error('Error updating company:', err);
    res.render('companies/form', { company: { ...req.body, id: companyId }, error: 'Failed to update company' });
  }
});

// Delete company
router.post('/:id/delete', (req, res) => {
  const db = getDatabase();

  try {
    db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
    res.redirect('/companies');
  } catch (err) {
    console.error('Error deleting company:', err);
    res.redirect('/companies');
  }
});

// Set as default
router.post('/:id/set-default', (req, res) => {
  const db = getDatabase();

  try {
    db.prepare('UPDATE companies SET is_default = 0').run();
    db.prepare('UPDATE companies SET is_default = 1 WHERE id = ?').run(req.params.id);
    res.redirect('/companies');
  } catch (err) {
    console.error('Error setting default company:', err);
    res.redirect('/companies');
  }
});

module.exports = router;
