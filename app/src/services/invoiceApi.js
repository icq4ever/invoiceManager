// Invoice operations shared by the REST API (routes/api.js) and the MCP server (routes/mcp.js).
// Each function validates its input and throws ApiError on failure.
const { getDatabase } = require('../config/database');
const { t } = require('../middleware/i18n');
const { generateInvoiceNumber, prepareItems, computeTotals, insertItems, linkDefaultBankAccounts } = require('./invoice');

const CURRENCIES = ['KRW', 'USD', 'EUR', 'JPY', 'GBP', 'CNY'];
const STATUSES = ['draft', 'confirmed', 'discarded'];
const INVOICE_FIELDS = ['invoice_number', 'company_id', 'client_id', 'client', 'project_name', 'issue_date', 'validity_period', 'currency', 'tax_rate', 'notes', 'items'];
const CLIENT_FIELDS = ['name', 'business_number', 'contact_person', 'phone', 'email', 'address'];
// amount / detail_mode are read-only (computed) but accepted so GET output can be sent back as-is
const ITEM_FIELDS = ['title', 'details', 'quantity', 'unit_price', 'sub_items', 'amount', 'detail_mode'];
const SUB_ITEM_FIELDS = ['title', 'description', 'quantity', 'unit_price', 'amount'];

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';

// ---------- Serializers ----------

function serializeInvoice(db, id) {
  const invoice = db.prepare(`
    SELECT i.*, c.name as client_name, co.name as company_name
    FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    LEFT JOIN companies co ON i.company_id = co.id
    WHERE i.id = ?
  `).get(id);
  if (!invoice) return null;

  let notes;
  try {
    notes = JSON.parse(invoice.notes || '[]');
  } catch (e) {
    notes = invoice.notes ? [invoice.notes] : [];
  }

  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC').all(id);
  const subStmt = db.prepare('SELECT * FROM invoice_item_details WHERE item_id = ? ORDER BY sort_order ASC');

  return {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    status: invoice.status,
    company: invoice.company_id ? { id: invoice.company_id, name: invoice.company_name } : null,
    client: invoice.client_id ? { id: invoice.client_id, name: invoice.client_name } : null,
    project_name: invoice.project_name,
    issue_date: invoice.issue_date,
    validity_period: invoice.validity_period,
    currency: invoice.currency,
    tax_rate: invoice.tax_rate,
    subtotal: invoice.subtotal,
    tax_amount: invoice.tax_amount,
    total_amount: invoice.total_amount,
    notes,
    items: items.map(item => {
      const out = {
        title: item.title,
        detail_mode: item.detail_mode,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount
      };
      if (item.detail_mode === 'itemized') {
        out.sub_items = subStmt.all(item.id).map(sub => ({
          title: sub.title,
          description: sub.description,
          quantity: sub.quantity,
          unit_price: sub.unit_price,
          amount: sub.amount
        }));
      } else {
        out.details = item.details;
      }
      return out;
    }),
    web_path: `/invoices/${invoice.id}`,
    ...(process.env.PUBLIC_URL ? { web_url: `${process.env.PUBLIC_URL.replace(/\/$/, '')}/invoices/${invoice.id}` } : {}),
    created_at: invoice.created_at,
    updated_at: invoice.updated_at
  };
}

// ---------- Validation ----------

function validateItems(items, errors) {
  if (!Array.isArray(items) || items.length === 0) {
    errors.push('items must be a non-empty array');
    return;
  }
  items.forEach((item, i) => {
    const p = `items[${i}]`;
    if (!item || typeof item !== 'object') {
      errors.push(`${p} must be an object`);
      return;
    }
    const unknownItem = Object.keys(item).filter(k => !ITEM_FIELDS.includes(k));
    if (unknownItem.length) errors.push(`${p}: unknown field(s) ${unknownItem.join(', ')}`);
    if (!isNonEmptyString(item.title)) errors.push(`${p}.title is required`);
    if (item.details !== undefined && typeof item.details !== 'string') errors.push(`${p}.details must be a string`);
    if (item.quantity !== undefined && !isNumber(item.quantity)) errors.push(`${p}.quantity must be a number`);
    if (item.unit_price !== undefined && !isNumber(item.unit_price)) errors.push(`${p}.unit_price must be a number`);

    if (item.sub_items !== undefined) {
      if (!Array.isArray(item.sub_items) || item.sub_items.length === 0) {
        errors.push(`${p}.sub_items must be a non-empty array when given`);
        return;
      }
      if (item.details !== undefined) {
        errors.push(`${p}: details cannot be combined with sub_items (put text in sub_items[].description)`);
      }
      item.sub_items.forEach((sub, j) => {
        const sp = `${p}.sub_items[${j}]`;
        if (!sub || typeof sub !== 'object') {
          errors.push(`${sp} must be an object`);
          return;
        }
        const unknownSub = Object.keys(sub).filter(k => !SUB_ITEM_FIELDS.includes(k));
        if (unknownSub.length) errors.push(`${sp}: unknown field(s) ${unknownSub.join(', ')}`);
        if (!isNonEmptyString(sub.title) && !isNonEmptyString(sub.description)) errors.push(`${sp} needs title or description`);
        if (sub.quantity !== undefined && !isNumber(sub.quantity)) errors.push(`${sp}.quantity must be a number`);
        if (sub.unit_price !== undefined && !isNumber(sub.unit_price)) errors.push(`${sp}.unit_price must be a number`);
      });
    } else if (item.unit_price === undefined) {
      errors.push(`${p}.unit_price is required (or provide sub_items)`);
    }
  });
}

function validateInvoiceBody(db, body, { partial }) {
  const errors = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Request body must be a JSON object');
  }

  const unknown = Object.keys(body).filter(k => !INVOICE_FIELDS.includes(k));
  if (unknown.length) errors.push(`Unknown field(s): ${unknown.join(', ')}. Allowed: ${INVOICE_FIELDS.join(', ')}`);

  if (!partial && !isNonEmptyString(body.project_name)) errors.push('project_name is required');
  if (partial && body.project_name !== undefined && !isNonEmptyString(body.project_name)) errors.push('project_name must be a non-empty string');

  if (body.invoice_number !== undefined && !isNonEmptyString(body.invoice_number)) errors.push('invoice_number must be a non-empty string');

  if (body.company_id !== undefined) {
    if (!Number.isInteger(body.company_id)) errors.push('company_id must be an integer');
    else if (!db.prepare('SELECT id FROM companies WHERE id = ?').get(body.company_id)) errors.push(`company_id ${body.company_id} not found (see list_companies / GET /api/v1/companies)`);
  }

  if (body.client_id !== undefined && body.client !== undefined) {
    errors.push('Provide either client_id or client, not both');
  } else if (body.client_id !== undefined && body.client_id !== null) {
    if (!Number.isInteger(body.client_id)) errors.push('client_id must be an integer or null');
    else if (!db.prepare('SELECT id FROM clients WHERE id = ?').get(body.client_id)) errors.push(`client_id ${body.client_id} not found (see search_clients / GET /api/v1/clients)`);
  } else if (body.client !== undefined) {
    if (!body.client || typeof body.client !== 'object' || !isNonEmptyString(body.client.name)) errors.push('client.name is required when client is given');
  }

  if (body.issue_date !== undefined && !(typeof body.issue_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.issue_date))) {
    errors.push('issue_date must be YYYY-MM-DD');
  }
  if (body.validity_period !== undefined && typeof body.validity_period !== 'string') errors.push('validity_period must be a string');
  if (body.currency !== undefined && !CURRENCIES.includes(body.currency)) errors.push(`currency must be one of ${CURRENCIES.join(', ')}`);
  if (body.tax_rate !== undefined && !(isNumber(body.tax_rate) && body.tax_rate >= 0)) errors.push('tax_rate must be a number >= 0');
  if (body.notes !== undefined && !(Array.isArray(body.notes) && body.notes.every(n => typeof n === 'string'))) {
    errors.push('notes must be an array of strings');
  }

  if (!partial || body.items !== undefined) validateItems(body.items, errors);

  if (errors.length) throw new ApiError(400, 'Validation failed', errors);
}

// Drop read-only fields; detail_mode is inferred from sub_items
function toRawItems(items) {
  return items.map(item => item.sub_items
    ? { title: item.title, sub_items: item.sub_items.map(({ title, description, quantity, unit_price }) => ({ title, description, quantity, unit_price })) }
    : { title: item.title, details: item.details, quantity: item.quantity, unit_price: item.unit_price });
}

// Find client by exact name, or create it. Returns { id, created }.
function resolveClient(db, client) {
  const existing = db.prepare('SELECT id FROM clients WHERE name = ?').get(client.name.trim());
  if (existing) return { id: existing.id, created: false };

  const result = db.prepare(`
    INSERT INTO clients (name, business_number, contact_person, phone, email, address)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(client.name.trim(), client.business_number || null, client.contact_person || null,
         client.phone || null, client.email || null, client.address || null);
  return { id: result.lastInsertRowid, created: true };
}

function assertInvoiceNumberFree(db, invoiceNumber, exceptId) {
  const dup = db.prepare('SELECT id FROM invoices WHERE invoice_number = ? AND id != ?').get(invoiceNumber, exceptId || 0);
  if (dup) throw new ApiError(409, `invoice_number ${invoiceNumber} already exists (invoice id ${dup.id})`);
}

// ---------- Operations ----------

function listCompanies() {
  const db = getDatabase();
  const companies = db.prepare(`
    SELECT id, name, name_en, business_number, representative, invoice_prefix, is_default
    FROM companies ORDER BY is_default DESC, name ASC
  `).all();
  const banks = db.prepare(`
    SELECT id, bank_name, account_number, account_holder, is_enabled
    FROM bank_accounts WHERE company_id = ? ORDER BY sort_order ASC
  `);
  return {
    companies: companies.map(c => ({
      ...c,
      is_default: !!c.is_default,
      bank_accounts: banks.all(c.id).map(b => ({ ...b, is_enabled: !!b.is_enabled }))
    }))
  };
}

function searchClients(query) {
  const db = getDatabase();
  const q = (query || '').trim();
  const columns = ['id', ...CLIENT_FIELDS].join(', ');
  const clients = q
    ? db.prepare(`SELECT ${columns} FROM clients WHERE name LIKE ? OR contact_person LIKE ? ORDER BY name ASC`).all(`%${q}%`, `%${q}%`)
    : db.prepare(`SELECT ${columns} FROM clients ORDER BY name ASC`).all();
  return { clients };
}

function createClient(body) {
  const db = getDatabase();
  body = body || {};
  const errors = [];
  const unknown = Object.keys(body).filter(k => !CLIENT_FIELDS.includes(k));
  if (unknown.length) errors.push(`Unknown field(s): ${unknown.join(', ')}. Allowed: ${CLIENT_FIELDS.join(', ')}`);
  if (!isNonEmptyString(body.name)) errors.push('name is required');
  if (errors.length) throw new ApiError(400, 'Validation failed', errors);

  const existing = db.prepare('SELECT id FROM clients WHERE name = ?').get(body.name.trim());
  if (existing) throw new ApiError(409, `Client "${body.name.trim()}" already exists (id ${existing.id})`);

  const { id } = resolveClient(db, body);
  return db.prepare(`SELECT ${['id', ...CLIENT_FIELDS].join(', ')} FROM clients WHERE id = ?`).get(id);
}

function listNoteTemplates() {
  const db = getDatabase();
  const templates = db.prepare('SELECT id, title, content, is_default FROM note_templates ORDER BY sort_order ASC').all();
  return { note_templates: templates.map(tpl => ({ ...tpl, is_default: !!tpl.is_default })) };
}

function listInvoices({ query, status, limit, offset } = {}) {
  const db = getDatabase();
  const q = (query || '').trim();
  limit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  offset = Math.max(parseInt(offset) || 0, 0);

  if (status && !STATUSES.includes(status)) throw new ApiError(400, `status must be one of ${STATUSES.join(', ')}`);

  const where = [];
  const params = [];
  if (q) {
    where.push('(i.project_name LIKE ? OR c.name LIKE ? OR i.invoice_number LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (status) {
    where.push('i.status = ?');
    params.push(status);
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`
    SELECT COUNT(*) as total FROM invoices i LEFT JOIN clients c ON i.client_id = c.id ${whereClause}
  `).get(...params).total;

  const invoices = db.prepare(`
    SELECT i.id, i.invoice_number, i.status, i.project_name, i.issue_date, i.currency, i.total_amount,
           c.name as client_name, co.name as company_name
    FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    LEFT JOIN companies co ON i.company_id = co.id
    ${whereClause}
    ORDER BY i.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return { total, limit, offset, invoices };
}

function getInvoice(id) {
  const invoice = serializeInvoice(getDatabase(), id);
  if (!invoice) throw new ApiError(404, 'Invoice not found');
  return invoice;
}

function createInvoice(body) {
  const db = getDatabase();
  validateInvoiceBody(db, body, { partial: false });

  let clientCreated = false;

  const invoiceId = db.transaction(() => {
    let companyId = body.company_id;
    if (companyId === undefined) {
      const def = db.prepare('SELECT id FROM companies ORDER BY is_default DESC, id ASC LIMIT 1').get();
      companyId = def ? def.id : null;
    }

    let clientId = body.client_id ?? null;
    if (body.client) {
      const resolved = resolveClient(db, body.client);
      clientId = resolved.id;
      clientCreated = resolved.created;
    }

    const invoiceNumber = body.invoice_number || generateInvoiceNumber(db, companyId);
    assertInvoiceNumberFree(db, invoiceNumber);

    // Default notes = default note templates (same as the web form)
    const notes = body.notes !== undefined
      ? body.notes
      : db.prepare('SELECT content FROM note_templates WHERE is_default = 1 ORDER BY sort_order ASC').all().map(n => n.content);

    const taxRate = body.tax_rate ?? 10;
    const { items, subtotal } = prepareItems(toRawItems(body.items));
    const { taxAmount, totalAmount } = computeTotals(subtotal, taxRate);

    const result = db.prepare(`
      INSERT INTO invoices (invoice_number, company_id, client_id, project_name, issue_date, validity_period, subtotal, tax_rate, tax_amount, total_amount, notes, status, currency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `).run(
      invoiceNumber, companyId, clientId, body.project_name.trim(),
      body.issue_date || new Date().toISOString().split('T')[0],
      body.validity_period ?? t('ko', 'invoice.validity_default'),
      subtotal, taxRate, taxAmount, totalAmount, JSON.stringify(notes), body.currency || 'KRW'
    );

    const id = result.lastInsertRowid;
    insertItems(db, id, items);
    linkDefaultBankAccounts(db, id, companyId);
    return id;
  })();

  return { ...serializeInvoice(db, invoiceId), client_created: clientCreated };
}

function updateInvoice(id, body) {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  if (!existing) throw new ApiError(404, 'Invoice not found');

  validateInvoiceBody(db, body, { partial: true });

  let clientCreated = false;

  db.transaction(() => {
    const next = { ...existing };

    if (body.invoice_number !== undefined) {
      assertInvoiceNumberFree(db, body.invoice_number, existing.id);
      next.invoice_number = body.invoice_number;
    }
    if (body.company_id !== undefined) next.company_id = body.company_id;
    if (body.client_id !== undefined) next.client_id = body.client_id;
    if (body.client) {
      const resolved = resolveClient(db, body.client);
      next.client_id = resolved.id;
      clientCreated = resolved.created;
    }
    if (body.project_name !== undefined) next.project_name = body.project_name.trim();
    if (body.issue_date !== undefined) next.issue_date = body.issue_date;
    if (body.validity_period !== undefined) next.validity_period = body.validity_period;
    if (body.currency !== undefined) next.currency = body.currency;
    if (body.tax_rate !== undefined) next.tax_rate = body.tax_rate;
    if (body.notes !== undefined) next.notes = JSON.stringify(body.notes);

    if (body.items !== undefined) {
      const { items, subtotal } = prepareItems(toRawItems(body.items));
      next.subtotal = subtotal;
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(existing.id);
      insertItems(db, existing.id, items);
    }

    const { taxAmount, totalAmount } = computeTotals(next.subtotal, next.tax_rate);

    db.prepare(`
      UPDATE invoices
      SET invoice_number = ?, company_id = ?, client_id = ?, project_name = ?,
          issue_date = ?, validity_period = ?, subtotal = ?, tax_rate = ?,
          tax_amount = ?, total_amount = ?, notes = ?, currency = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(next.invoice_number, next.company_id, next.client_id, next.project_name,
           next.issue_date, next.validity_period, next.subtotal, next.tax_rate,
           taxAmount, totalAmount, next.notes, next.currency, existing.id);

    // Company changed: bank accounts belong to the company, so reset to the new company's defaults
    if (body.company_id !== undefined && body.company_id !== existing.company_id) {
      db.prepare('DELETE FROM invoice_bank_accounts WHERE invoice_id = ?').run(existing.id);
      linkDefaultBankAccounts(db, existing.id, next.company_id);
    }
  })();

  return { ...serializeInvoice(db, existing.id), client_created: clientCreated };
}

function setInvoiceStatus(id, status) {
  const db = getDatabase();
  if (!STATUSES.includes(status)) throw new ApiError(400, `status must be one of ${STATUSES.join(', ')}`);

  const result = db.prepare('UPDATE invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
  if (result.changes === 0) throw new ApiError(404, 'Invoice not found');

  return serializeInvoice(db, id);
}

module.exports = {
  ApiError, CURRENCIES, STATUSES,
  listCompanies, searchClients, createClient, listNoteTemplates,
  listInvoices, getInvoice, createInvoice, updateInvoice, setInvoiceStatus
};
