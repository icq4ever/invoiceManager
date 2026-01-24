const express = require('express');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const { getDatabase } = require('../config/database');

const router = express.Router();

// Apply auth to all routes
router.use(requireAuth);

// Helper: Get formatted date for filenames
function getDateString() {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Helper: Perform WAL checkpoint with retry
async function checkpointDatabase(retries = 3) {
  const db = getDatabase();
  for (let i = 0; i < retries; i++) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
      console.log('Database checkpoint completed');
      return true;
    } catch (err) {
      console.error(`Checkpoint attempt ${i + 1} failed:`, err);
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// Download database only
router.get('/download/database', async (req, res) => {
  try {
    console.log(`[Backup] Database backup requested by ${req.session.user.username}`);

    // Checkpoint database
    await checkpointDatabase();

    // Database path
    const dbPath = path.resolve(__dirname, '../../data/invoice.db');

    if (!fs.existsSync(dbPath)) {
      console.error('[Backup] Database file not found');
      return res.status(500).json({ error: req.t('backup.error_failed') });
    }

    // Send file
    const filename = `invoice-backup-${getDateString()}.db`;
    res.download(dbPath, filename, (err) => {
      if (err) {
        console.error('[Backup] Database download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: req.t('backup.error_failed') });
        }
      } else {
        console.log(`[Backup] Database backup completed: ${filename}`);
      }
    });

  } catch (err) {
    console.error('[Backup] Database backup error:', err);
    if (err.message.includes('database is locked')) {
      return res.status(503).json({ error: req.t('backup.error_locked') });
    }
    res.status(500).json({ error: req.t('backup.error_failed') });
  }
});

// Download uploads only
router.get('/download/uploads', (req, res) => {
  try {
    console.log(`[Backup] Uploads backup requested by ${req.session.user.username}`);

    const uploadsDir = path.resolve(__dirname, '../../uploads');
    const filename = `invoice-uploads-${getDateString()}.zip`;

    // Check if uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      console.warn('[Backup] Uploads directory does not exist, creating empty backup');
    }

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    archive.on('error', (err) => {
      console.error('[Backup] Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: req.t('backup.error_failed') });
      }
    });

    archive.on('end', () => {
      console.log(`[Backup] Uploads backup completed: ${filename} (${archive.pointer()} bytes)`);
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe archive to response
    archive.pipe(res);

    // Add uploads directory to archive
    if (fs.existsSync(uploadsDir)) {
      archive.directory(uploadsDir, 'uploads');
    }

    // Finalize archive
    archive.finalize();

  } catch (err) {
    console.error('[Backup] Uploads backup error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: req.t('backup.error_failed') });
    }
  }
});

// Download full backup (database + uploads)
router.get('/download/full', async (req, res) => {
  try {
    console.log(`[Backup] Full backup requested by ${req.session.user.username}`);

    // Checkpoint database
    await checkpointDatabase();

    const dbPath = path.resolve(__dirname, '../../data/invoice.db');
    const uploadsDir = path.resolve(__dirname, '../../uploads');
    const filename = `invoice-full-backup-${getDateString()}.zip`;

    if (!fs.existsSync(dbPath)) {
      console.error('[Backup] Database file not found');
      return res.status(500).json({ error: req.t('backup.error_failed') });
    }

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    archive.on('error', (err) => {
      console.error('[Backup] Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: req.t('backup.error_failed') });
      }
    });

    archive.on('end', () => {
      console.log(`[Backup] Full backup completed: ${filename} (${archive.pointer()} bytes)`);
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe archive to response
    archive.pipe(res);

    // Add database file
    archive.file(dbPath, { name: 'invoice.db' });

    // Add uploads directory
    if (fs.existsSync(uploadsDir)) {
      archive.directory(uploadsDir, 'uploads');
    }

    // Finalize archive
    archive.finalize();

  } catch (err) {
    console.error('[Backup] Full backup error:', err);
    if (err.message.includes('database is locked')) {
      return res.status(503).json({ error: req.t('backup.error_locked') });
    }
    if (!res.headersSent) {
      res.status(500).json({ error: req.t('backup.error_failed') });
    }
  }
});

module.exports = router;
