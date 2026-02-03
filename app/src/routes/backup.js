const express = require('express');
const archiver = require('archiver');
const extractZip = require('extract-zip');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const { getDatabase, closeDatabase, reinitDatabase } = require('../config/database');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.resolve(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    cb(null, `restore-${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.db' || ext === '.zip') {
      cb(null, true);
    } else {
      cb(new Error('Only .db and .zip files are allowed'));
    }
  }
});

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

// Helper: Clean temp directory
function cleanTemp(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('[Restore] Failed to clean temp file:', err);
  }
}

// Helper: Remove directory recursively
function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

// Restore database from uploaded .db file
router.post('/restore/database', upload.single('backup'), async (req, res) => {
  const tempFile = req.file?.path;
  const t = req.t || ((key) => key);

  try {
    console.log(`[Restore] Database restore requested by ${req.session.user.username}`);

    if (!req.file) {
      return res.status(400).json({ success: false, error: t('restore.error_no_file') });
    }

    if (!req.file.originalname.endsWith('.db')) {
      cleanTemp(tempFile);
      return res.status(400).json({ success: false, error: t('restore.error_invalid_db') });
    }

    const dbPath = path.resolve(__dirname, '../../data/invoice.db');
    const backupPath = dbPath + '.backup-' + Date.now();

    // Close current database connection
    closeDatabase();

    // Backup current database
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath);
    }

    // Remove WAL and SHM files
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    // Copy uploaded database
    fs.copyFileSync(tempFile, dbPath);

    // Reinitialize database connection
    reinitDatabase();

    // Clean up
    cleanTemp(tempFile);

    // Remove old backup after successful restore (keep for safety)
    // fs.unlinkSync(backupPath);

    console.log('[Restore] Database restore completed successfully');
    res.json({ success: true, message: t('restore.success_database') });

  } catch (err) {
    console.error('[Restore] Database restore error:', err);
    cleanTemp(tempFile);

    // Try to reinitialize database connection
    try {
      reinitDatabase();
    } catch (e) {
      console.error('[Restore] Failed to reinitialize database:', e);
    }

    res.status(500).json({ success: false, error: t('restore.error_failed') });
  }
});

// Helper: Copy directory contents recursively
function copyDirContents(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;

  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyDirContents(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Helper: Clear directory contents (but keep the directory)
function clearDirContents(dirPath) {
  if (!fs.existsSync(dirPath)) return;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }
  }
}

// Restore uploads from uploaded .zip file
router.post('/restore/uploads', upload.single('backup'), async (req, res) => {
  const tempFile = req.file?.path;
  const t = req.t || ((key) => key);

  try {
    console.log(`[Restore] Uploads restore requested by ${req.session.user.username}`);

    if (!req.file) {
      return res.status(400).json({ success: false, error: t('restore.error_no_file') });
    }

    if (!req.file.originalname.endsWith('.zip')) {
      cleanTemp(tempFile);
      return res.status(400).json({ success: false, error: t('restore.error_invalid_zip') });
    }

    const uploadsDir = path.resolve(__dirname, '../../uploads');
    const tempExtract = path.resolve(__dirname, '../../temp/extract-' + Date.now());

    // Extract ZIP to temp directory
    await extractZip(tempFile, { dir: tempExtract });

    // Check if uploads folder exists in extracted content
    let sourceDir = tempExtract;
    if (fs.existsSync(path.join(tempExtract, 'uploads'))) {
      sourceDir = path.join(tempExtract, 'uploads');
    }

    // Clear current uploads directory contents (Docker volume safe)
    clearDirContents(uploadsDir);

    // Copy extracted uploads to target
    fs.mkdirSync(uploadsDir, { recursive: true });
    copyDirContents(sourceDir, uploadsDir);

    // Clean up temp files
    cleanTemp(tempFile);
    removeDir(tempExtract);

    console.log('[Restore] Uploads restore completed successfully');
    res.json({ success: true, message: t('restore.success_uploads') });

  } catch (err) {
    console.error('[Restore] Uploads restore error:', err);
    cleanTemp(tempFile);
    res.status(500).json({ success: false, error: t('restore.error_failed') });
  }
});

// Restore full backup from uploaded .zip file
router.post('/restore/full', upload.single('backup'), async (req, res) => {
  const tempFile = req.file?.path;
  const t = req.t || ((key) => key);

  try {
    console.log(`[Restore] Full restore requested by ${req.session.user.username}`);

    if (!req.file) {
      return res.status(400).json({ success: false, error: t('restore.error_no_file') });
    }

    if (!req.file.originalname.endsWith('.zip')) {
      cleanTemp(tempFile);
      return res.status(400).json({ success: false, error: t('restore.error_invalid_zip') });
    }

    const dbPath = path.resolve(__dirname, '../../data/invoice.db');
    const uploadsDir = path.resolve(__dirname, '../../uploads');
    const tempExtract = path.resolve(__dirname, '../../temp/extract-' + Date.now());

    // Extract ZIP to temp directory
    await extractZip(tempFile, { dir: tempExtract });

    // Check for database file
    const extractedDbPath = path.join(tempExtract, 'invoice.db');
    if (!fs.existsSync(extractedDbPath)) {
      cleanTemp(tempFile);
      removeDir(tempExtract);
      return res.status(400).json({ success: false, error: t('restore.error_invalid_full') });
    }

    // Close current database connection
    closeDatabase();

    // Backup current database
    const dbBackupPath = dbPath + '.backup-' + Date.now();
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, dbBackupPath);
    }

    // Remove WAL and SHM files
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    // Copy database
    fs.copyFileSync(extractedDbPath, dbPath);

    // Reinitialize database connection
    reinitDatabase();

    // Handle uploads if present
    const extractedUploadsDir = path.join(tempExtract, 'uploads');
    if (fs.existsSync(extractedUploadsDir)) {
      // Clear current uploads directory contents (Docker volume safe)
      clearDirContents(uploadsDir);

      // Copy extracted uploads
      fs.mkdirSync(uploadsDir, { recursive: true });
      copyDirContents(extractedUploadsDir, uploadsDir);
    }

    // Clean up temp files
    cleanTemp(tempFile);
    removeDir(tempExtract);

    console.log('[Restore] Full restore completed successfully');
    res.json({ success: true, message: t('restore.success_full') });

  } catch (err) {
    console.error('[Restore] Full restore error:', err);
    cleanTemp(tempFile);

    // Try to reinitialize database connection
    try {
      reinitDatabase();
    } catch (e) {
      console.error('[Restore] Failed to reinitialize database:', e);
    }

    res.status(500).json({ success: false, error: t('restore.error_failed') });
  }
});

// Reset all data (delete everything)
router.post('/reset', async (req, res) => {
  const t = req.t || ((key) => key);

  try {
    console.log(`[Reset] Data reset requested by ${req.session.user.username}`);

    const db = getDatabase();

    // Delete all data in correct order (respecting foreign keys)
    db.prepare('DELETE FROM invoice_item_details').run();
    db.prepare('DELETE FROM invoice_items').run();
    db.prepare('DELETE FROM invoices').run();
    db.prepare('DELETE FROM clients').run();
    db.prepare('DELETE FROM companies').run();

    // Reset autoincrement counters
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('companies', 'clients', 'invoices', 'invoice_items', 'invoice_item_details')").run();

    console.log('[Reset] All data deleted successfully');
    res.json({ success: true, message: t('reset.success') });

  } catch (err) {
    console.error('[Reset] Data reset error:', err);
    res.status(500).json({ success: false, error: t('reset.error_failed') });
  }
});

module.exports = router;
