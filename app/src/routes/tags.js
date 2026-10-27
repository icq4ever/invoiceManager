const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getDatabase } = require('../config/database');

const router = express.Router();

// Palette keys; the matching classes live in views/invoices/list.ejs
const TAG_COLORS = ['gray', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink'];

// Apply auth to all routes
router.use(requireAuth);

function parseTag(body) {
  const name = (body.name || '').trim().slice(0, 30);
  const color = TAG_COLORS.includes(body.color) ? body.color : 'gray';
  return { name, color };
}

// Create tag
router.post('/', (req, res) => {
  const db = getDatabase();
  const { name, color } = parseTag(req.body);
  if (!name) return res.status(400).json({ error: res.locals.t('tag.error_name_required') });

  try {
    const sortOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM tags').get().next;
    const result = db.prepare('INSERT INTO tags (name, color, sort_order) VALUES (?, ?, ?)').run(name, color, sortOrder);
    res.json({ success: true, tag: { id: result.lastInsertRowid, name, color } });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(400).json({ error: res.locals.t('tag.error_duplicate') });
    console.error('Error creating tag:', err);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// Update tag
router.post('/:id', (req, res) => {
  const db = getDatabase();
  const { name, color } = parseTag(req.body);
  if (!name) return res.status(400).json({ error: res.locals.t('tag.error_name_required') });

  try {
    const result = db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?').run(name, color, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Tag not found' });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(400).json({ error: res.locals.t('tag.error_duplicate') });
    console.error('Error updating tag:', err);
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

// Delete tag (invoices keep everything else)
router.post('/:id/delete', (req, res) => {
  const db = getDatabase();

  try {
    db.transaction(() => {
      db.prepare('DELETE FROM invoice_tags WHERE tag_id = ?').run(req.params.id);
      db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
    })();
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting tag:', err);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

module.exports = router;
