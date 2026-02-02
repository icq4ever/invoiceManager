const Database = require('better-sqlite3');
const path = require('path');

let db = null;

function getDatabase() {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/invoice.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

function reinitDatabase() {
  closeDatabase();
  return getDatabase();
}

function initDatabase() {
  const db = getDatabase();

  // Companies table
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      business_number TEXT,
      representative TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      bank_info TEXT,
      logo_path TEXT,
      stamp_path TEXT,
      invoice_prefix TEXT DEFAULT 'INV',
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add invoice_prefix column if not exists (migration)
  try {
    db.exec(`ALTER TABLE companies ADD COLUMN invoice_prefix TEXT DEFAULT 'INV'`);
  } catch (e) {
    // Column already exists
  }

  // Add multilingual company info columns (migration)
  try {
    db.exec(`ALTER TABLE companies ADD COLUMN name_en TEXT`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE companies ADD COLUMN representative_en TEXT`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE companies ADD COLUMN address_en TEXT`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE companies ADD COLUMN phone_en TEXT`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE companies ADD COLUMN email_en TEXT`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE companies ADD COLUMN bank_info_en TEXT`);
  } catch (e) {
    // Column already exists
  }

  // Clients table
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      business_number TEXT,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Invoices table
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      company_id INTEGER,
      client_id INTEGER,
      project_name TEXT,
      issue_date DATE,
      validity_period TEXT DEFAULT '견적일로부터 1개월',
      subtotal REAL DEFAULT 0,
      tax_rate REAL DEFAULT 10,
      tax_amount REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'draft',
      pdf_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )
  `);

  // Add currency column if not exists (migration)
  try {
    db.exec(`ALTER TABLE invoices ADD COLUMN currency TEXT DEFAULT 'KRW'`);
  } catch (e) {
    // Column already exists
  }

  // Invoice items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      details TEXT,
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    )
  `);

  // Add detail_mode column if not exists (migration)
  // 'text' = Option A (simple text details)
  // 'itemized' = Option B (itemized sub-details with prices)
  try {
    db.exec(`ALTER TABLE invoice_items ADD COLUMN detail_mode TEXT DEFAULT 'text'`);
  } catch (e) {
    // Column already exists
  }

  // Invoice item details table (for itemized mode)
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_item_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (item_id) REFERENCES invoice_items(id) ON DELETE CASCADE
    )
  `);

  // Add title column to invoice_item_details if not exists (migration)
  try {
    db.exec(`ALTER TABLE invoice_item_details ADD COLUMN title TEXT`);
  } catch (e) {
    // Column already exists
  }

  // Note templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS note_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default note templates if empty
  const templateCount = db.prepare('SELECT COUNT(*) as count FROM note_templates').get().count;
  if (templateCount === 0) {
    const insertTemplate = db.prepare(`
      INSERT INTO note_templates (title, content, is_default, sort_order)
      VALUES (?, ?, ?, ?)
    `);

    insertTemplate.run('일반과세사업자 안내', '본 업체는 일반과세사업자로, 견적금액은 공급가액에 세액이 포함되어 있습니다.', 1, 1);
    insertTemplate.run('유지보수 협의', '유지보수, 정기 점검 등의 계약은 필요시 추후에 협의할 수 있습니다.', 0, 2);
    insertTemplate.run('비용 조정 안내', '최종 비용은 실제 작업 난이도에 따라 조정될 수 있습니다.', 0, 3);
  }

  console.log('Database initialized successfully');
}

module.exports = { getDatabase, initDatabase, closeDatabase, reinitDatabase };
