const Database = require('better-sqlite3');
const path = require('path');

const SCHEMA_VERSION = '1.3.1';

let db = null;

// Final schema. Each table is [column, definition] pairs plus table constraints.
// New databases get these tables as-is; older databases (e.g. restored backups) get
// any missing columns added, so column definitions added later must stay ALTER-compatible
// (nullable or with a constant DEFAULT).
const TABLES = {
  schema_version: {
    columns: [
      ['id', 'INTEGER PRIMARY KEY AUTOINCREMENT'],
      ['version', 'TEXT NOT NULL'],
      ['applied_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP'],
      ['description', 'TEXT']
    ]
  },
  companies: {
    columns: [
      ['id', 'INTEGER PRIMARY KEY AUTOINCREMENT'],
      ['name', 'TEXT NOT NULL'],
      ['business_number', 'TEXT'],
      ['representative', 'TEXT'],
      ['address', 'TEXT'],
      ['phone', 'TEXT'],
      ['email', 'TEXT'],
      ['logo_path', 'TEXT'],
      ['stamp_path', 'TEXT'],
      ['invoice_prefix', "TEXT DEFAULT 'INV'"],
      ['is_default', 'INTEGER DEFAULT 0'],
      ['created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP'],
      ['name_en', 'TEXT'],
      ['representative_en', 'TEXT'],
      ['address_en', 'TEXT'],
      ['phone_en', 'TEXT'],
      ['email_en', 'TEXT'],
      ['website', 'TEXT'],
      ['fax', 'TEXT'],
      ['smtp_host', 'TEXT'],
      ['smtp_port', 'INTEGER DEFAULT 587'],
      ['smtp_secure', 'INTEGER DEFAULT 0'],
      ['smtp_user', 'TEXT'],
      ['smtp_pass', 'TEXT'],
      ['smtp_from_name', 'TEXT'],
      ['smtp_from_email', 'TEXT']
    ]
  },
  clients: {
    columns: [
      ['id', 'INTEGER PRIMARY KEY AUTOINCREMENT'],
      ['name', 'TEXT NOT NULL'],
      ['business_number', 'TEXT'],
      ['contact_person', 'TEXT'],
      ['phone', 'TEXT'],
      ['email', 'TEXT'],
      ['address', 'TEXT'],
      ['created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP'],
      ['business_registration_path', 'TEXT']
    ]
  },
  invoices: {
    columns: [
      ['id', 'INTEGER PRIMARY KEY AUTOINCREMENT'],
      ['invoice_number', 'TEXT UNIQUE NOT NULL'],
      ['company_id', 'INTEGER'],
      ['client_id', 'INTEGER'],
      ['project_name', 'TEXT'],
      ['issue_date', 'DATE'],
      ['validity_period', "TEXT DEFAULT '견적일로부터 1개월'"],
      ['subtotal', 'REAL DEFAULT 0'],
      ['tax_rate', 'REAL DEFAULT 10'],
      ['tax_amount', 'REAL DEFAULT 0'],
      ['total_amount', 'REAL DEFAULT 0'],
      ['notes', 'TEXT'],
      ['status', "TEXT DEFAULT 'draft'"],
      ['created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP'],
      ['updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP'],
      ['currency', "TEXT DEFAULT 'KRW'"],
      // Per-invoice display options
      ['show_stamp', 'INTEGER DEFAULT 1'],
      ['show_website', 'INTEGER DEFAULT 1'],
      ['show_fax', 'INTEGER DEFAULT 1'],
      ['show_bank_info', 'INTEGER DEFAULT 1'],
      ['column_widths', 'TEXT'],
      ['show_logo_watermark', 'INTEGER DEFAULT 0'],
      ['show_logo', 'INTEGER DEFAULT 1'],
      ['show_swift', 'INTEGER DEFAULT 0'],
      ['show_paypal', 'INTEGER DEFAULT 0'],
      ['show_account_holder', 'INTEGER DEFAULT 1'],
      ['show_branch', 'INTEGER DEFAULT 0'],
      ['show_tax_id', 'INTEGER DEFAULT 1'],
      ['show_client_address', 'INTEGER DEFAULT 0']
    ],
    constraints: [
      'FOREIGN KEY (company_id) REFERENCES companies(id)',
      'FOREIGN KEY (client_id) REFERENCES clients(id)'
    ]
  },
  invoice_items: {
    columns: [
      ['id', 'INTEGER PRIMARY KEY AUTOINCREMENT'],
      ['invoice_id', 'INTEGER NOT NULL'],
      ['title', 'TEXT NOT NULL'],
      ['details', 'TEXT'],
      ['quantity', 'REAL DEFAULT 1'],
      ['unit_price', 'REAL DEFAULT 0'],
      ['amount', 'REAL DEFAULT 0'],
      ['sort_order', 'INTEGER DEFAULT 0'],
      // 'text' = simple text details, 'itemized' = sub-items with prices (invoice_item_details)
      ['detail_mode', "TEXT DEFAULT 'text'"]
    ],
    constraints: ['FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE']
  },
  invoice_item_details: {
    columns: [
      ['id', 'INTEGER PRIMARY KEY AUTOINCREMENT'],
      ['item_id', 'INTEGER NOT NULL'],
      ['description', 'TEXT NOT NULL'],
      ['quantity', 'REAL DEFAULT 1'],
      ['unit_price', 'REAL DEFAULT 0'],
      ['amount', 'REAL DEFAULT 0'],
      ['sort_order', 'INTEGER DEFAULT 0'],
      ['title', 'TEXT']
    ],
    constraints: ['FOREIGN KEY (item_id) REFERENCES invoice_items(id) ON DELETE CASCADE']
  },
  note_templates: {
    columns: [
      ['id', 'INTEGER PRIMARY KEY AUTOINCREMENT'],
      ['title', 'TEXT NOT NULL'],
      ['content', 'TEXT NOT NULL'],
      ['is_default', 'INTEGER DEFAULT 0'],
      ['sort_order', 'INTEGER DEFAULT 0'],
      ['created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP']
    ]
  },
  email_templates: {
    columns: [
      ['id', 'INTEGER PRIMARY KEY AUTOINCREMENT'],
      ['company_id', 'INTEGER'],
      ['name', 'TEXT NOT NULL'],
      ['subject', 'TEXT NOT NULL'],
      ['body', 'TEXT NOT NULL'],
      ['is_default', 'INTEGER DEFAULT 0'],
      ['created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP']
    ],
    constraints: ['FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE']
  },
  email_log: {
    columns: [
      ['id', 'INTEGER PRIMARY KEY AUTOINCREMENT'],
      ['invoice_id', 'INTEGER'],
      ['recipient_email', 'TEXT NOT NULL'],
      ['from_email', 'TEXT'],
      ['from_name', 'TEXT'],
      ['subject', 'TEXT'],
      ['status', "TEXT DEFAULT 'sent'"],
      ['error_message', 'TEXT'],
      ['sent_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP']
    ],
    constraints: ['FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL']
  },
  // Admin credentials (stored in DB, not env)
  admin_settings: {
    columns: [
      ['id', 'INTEGER PRIMARY KEY CHECK (id = 1)'],
      ['username', 'TEXT NOT NULL'],
      ['password_hash', 'TEXT NOT NULL'],
      ['updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP']
    ]
  },
  bank_accounts: {
    columns: [
      ['id', 'INTEGER PRIMARY KEY AUTOINCREMENT'],
      ['company_id', 'INTEGER NOT NULL'],
      ['bank_name', 'TEXT NOT NULL'],
      ['bank_name_en', 'TEXT'],
      ['account_number', 'TEXT NOT NULL'],
      ['branch_en', 'TEXT'],
      ['swift_code', 'TEXT'],
      ['is_enabled', 'INTEGER DEFAULT 1'],
      ['sort_order', 'INTEGER DEFAULT 0'],
      ['created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP'],
      ['paypal_account', 'TEXT'],
      ['account_holder', 'TEXT'],
      ['account_holder_en', 'TEXT'],
      ['iban_code', 'TEXT'],
      ['bank_code', 'TEXT'],
      ['swift_bank_branch', 'TEXT'],
      ['swift_bank_address', 'TEXT'],
      ['swift_account_name', 'TEXT']
    ],
    constraints: ['FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE']
  },
  invoice_bank_accounts: {
    columns: [
      ['id', 'INTEGER PRIMARY KEY AUTOINCREMENT'],
      ['invoice_id', 'INTEGER NOT NULL'],
      ['bank_account_id', 'INTEGER NOT NULL']
    ],
    constraints: [
      'FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE',
      'FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE',
      'UNIQUE(invoice_id, bank_account_id)'
    ]
  }
};

const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_invoices_project_name ON invoices(project_name)',
  'CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name)',
  'CREATE INDEX IF NOT EXISTS idx_bank_accounts_company ON bank_accounts(company_id)',
  'CREATE INDEX IF NOT EXISTS idx_invoice_bank_accounts_invoice ON invoice_bank_accounts(invoice_id)'
];

// Columns no longer used by the app (v1.3.1). Dropped from existing databases.
const DEPRECATED_COLUMNS = {
  companies: ['bank_info', 'bank_info_en'], // replaced by bank_accounts
  invoices: ['pdf_path'],
  bank_accounts: ['branch', 'bank_address', 'bank_address_en', 'show_swift', 'show_paypal'] // show_* moved to invoices
};

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

// Reopen the database (e.g. after a restore) and bring its schema up to date
function reinitDatabase() {
  closeDatabase();
  initDatabase();
  return getDatabase();
}

function getSchemaVersion(db) {
  try {
    const result = db.prepare('SELECT version FROM schema_version ORDER BY id DESC LIMIT 1').get();
    return result ? result.version : null;
  } catch (e) {
    return null;
  }
}

function setSchemaVersion(db, version, description) {
  db.prepare(`
    INSERT INTO schema_version (version, description)
    VALUES (?, ?)
  `).run(version, description);
  console.log(`Schema updated to version ${version}: ${description}`);
}

function getColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
}

// Create missing tables and add missing columns
function ensureTables(db) {
  for (const [table, { columns, constraints = [] }] of Object.entries(TABLES)) {
    const defs = [...columns.map(([name, def]) => `${name} ${def}`), ...constraints];
    db.exec(`CREATE TABLE IF NOT EXISTS ${table} (\n  ${defs.join(',\n  ')}\n)`);

    const existing = getColumns(db, table);
    for (const [name, def] of columns) {
      if (!existing.includes(name)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);
      }
    }
  }
}

// Copy legacy companies.bank_info into bank_accounts (databases from before bank_accounts existed)
function migrateLegacyBankInfo(db) {
  if (!getColumns(db, 'companies').includes('bank_info')) return;
  if (db.prepare('SELECT COUNT(*) as count FROM bank_accounts').get().count > 0) return;

  const companiesWithBank = db.prepare("SELECT id, bank_info, bank_info_en FROM companies WHERE bank_info IS NOT NULL AND bank_info != ''").all();
  if (companiesWithBank.length === 0) return;

  const insertBank = db.prepare(`
    INSERT INTO bank_accounts (company_id, bank_name, bank_name_en, account_number, sort_order)
    VALUES (?, ?, ?, '', 0)
  `);
  const insertInvoiceBank = db.prepare(`
    INSERT OR IGNORE INTO invoice_bank_accounts (invoice_id, bank_account_id)
    VALUES (?, ?)
  `);
  for (const co of companiesWithBank) {
    const bankId = insertBank.run(co.id, co.bank_info, co.bank_info_en || null).lastInsertRowid;
    // Link existing invoices that show bank info to this migrated bank account
    const invoices = db.prepare('SELECT id FROM invoices WHERE company_id = ? AND show_bank_info = 1').all(co.id);
    for (const inv of invoices) {
      insertInvoiceBank.run(inv.id, bankId);
    }
  }
  console.log(`Migrated ${companiesWithBank.length} legacy bank_info records to bank_accounts table`);
}

function findDeprecatedColumns(db) {
  const found = [];
  for (const [table, columns] of Object.entries(DEPRECATED_COLUMNS)) {
    const existing = getColumns(db, table);
    for (const column of columns) {
      if (existing.includes(column)) found.push([table, column]);
    }
  }
  return found;
}

// Snapshot the database file before a destructive migration
function backupBeforeMigration(db) {
  if (db.memory) return null;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const backupPath = `${db.name}.before-${SCHEMA_VERSION}-${stamp}.bak`;
  db.prepare('VACUUM INTO ?').run(backupPath);
  return backupPath;
}

function seedNoteTemplates(db) {
  const templateCount = db.prepare('SELECT COUNT(*) as count FROM note_templates').get().count;
  if (templateCount > 0) return;

  const insertTemplate = db.prepare(`
    INSERT INTO note_templates (title, content, is_default, sort_order)
    VALUES (?, ?, ?, ?)
  `);
  insertTemplate.run('일반과세사업자 안내', '본 업체는 일반과세사업자로, 견적금액은 공급가액에 세액이 포함되어 있습니다.', 1, 1);
  insertTemplate.run('유지보수 협의', '유지보수, 정기 점검 등의 계약은 필요시 추후에 협의할 수 있습니다.', 0, 2);
  insertTemplate.run('비용 조정 안내', '최종 비용은 실제 작업 난이도에 따라 조정될 수 있습니다.', 0, 3);
}

function initDatabase() {
  const db = getDatabase();
  const currentVersion = getSchemaVersion(db);

  // Back up first if this run will drop columns (VACUUM INTO cannot run inside a transaction)
  const hasTables = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name = 'companies'").get().count > 0;
  if (hasTables && findDeprecatedColumns(db).length > 0) {
    const backupPath = backupBeforeMigration(db);
    if (backupPath) console.log(`Database backed up to ${backupPath}`);
  }

  db.transaction(() => {
    ensureTables(db);
    migrateLegacyBankInfo(db);

    for (const [table, column] of findDeprecatedColumns(db)) {
      db.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`);
      console.log(`Dropped unused column ${table}.${column}`);
    }

    seedNoteTemplates(db);
    for (const sql of INDEXES) db.exec(sql);

    if (currentVersion !== SCHEMA_VERSION) {
      const description = currentVersion
        ? `Upgraded from ${currentVersion}`
        : 'Initial schema';
      setSchemaVersion(db, SCHEMA_VERSION, description);
    }
  })();

  console.log(`Database initialized successfully (schema v${SCHEMA_VERSION})`);
}

module.exports = { getDatabase, initDatabase, closeDatabase, reinitDatabase, getSchemaVersion, SCHEMA_VERSION };
