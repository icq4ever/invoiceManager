const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getDatabase } = require('../config/database');

const router = express.Router();

// Apply auth to all routes
router.use(requireAuth);

// List templates
router.get('/', (req, res) => {
  const db = getDatabase();
  const templates = db.prepare('SELECT * FROM note_templates ORDER BY sort_order ASC').all();
  res.render('templates/list', { templates });
});

// New template form
router.get('/new', (req, res) => {
  res.render('templates/form', { template: null, error: null });
});

// Create template
router.post('/', (req, res) => {
  const db = getDatabase();
  const { title, content, is_default, sort_order } = req.body;

  try {
    db.prepare(`
      INSERT INTO note_templates (title, content, is_default, sort_order)
      VALUES (?, ?, ?, ?)
    `).run(title, content, is_default ? 1 : 0, sort_order || 0);

    res.redirect('/templates');
  } catch (err) {
    console.error('Error creating template:', err);
    res.render('templates/form', { template: req.body, error: 'Failed to create template' });
  }
});

// Edit template form
router.get('/:id/edit', (req, res) => {
  const db = getDatabase();
  const template = db.prepare('SELECT * FROM note_templates WHERE id = ?').get(req.params.id);

  if (!template) {
    return res.redirect('/templates');
  }

  res.render('templates/form', { template, error: null });
});

// Update template
router.post('/:id', (req, res) => {
  const db = getDatabase();
  const { title, content, is_default, sort_order } = req.body;
  const templateId = req.params.id;

  try {
    db.prepare(`
      UPDATE note_templates
      SET title = ?, content = ?, is_default = ?, sort_order = ?
      WHERE id = ?
    `).run(title, content, is_default ? 1 : 0, sort_order || 0, templateId);

    res.redirect('/templates');
  } catch (err) {
    console.error('Error updating template:', err);
    res.render('templates/form', { template: { ...req.body, id: templateId }, error: 'Failed to update template' });
  }
});

// Delete template
router.post('/:id/delete', (req, res) => {
  const db = getDatabase();

  try {
    db.prepare('DELETE FROM note_templates WHERE id = ?').run(req.params.id);
    res.redirect('/templates');
  } catch (err) {
    console.error('Error deleting template:', err);
    res.redirect('/templates');
  }
});

// API: Get all templates (for AJAX)
router.get('/api/list', (req, res) => {
  const db = getDatabase();
  const templates = db.prepare('SELECT * FROM note_templates ORDER BY sort_order ASC').all();
  res.json(templates);
});

module.exports = router;
