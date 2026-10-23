const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getDatabase } = require('../config/database');
const { generateInvoiceNumber, prepareItems, computeTotals, insertItems, linkDefaultBankAccounts } = require('../services/invoice');

const router = express.Router();

// Apply auth to all routes
router.use(requireAuth);

// Convert parallel form field arrays into raw item objects for prepareItems()
function parseFormItems(body) {
  const { item_titles, item_details, item_quantities, item_unit_prices, item_detail_modes } = body;
  if (!item_titles) return [];

  const toArray = (v) => Array.isArray(v) ? v : [v];
  const titles = toArray(item_titles);
  const details = toArray(item_details);
  const quantities = toArray(item_quantities);
  const unitPrices = toArray(item_unit_prices);
  const detailModes = toArray(item_detail_modes);

  return titles.map((title, i) => {
    const mode = detailModes[i] || 'text';
    const item = { title, details: details[i], quantity: quantities[i], unit_price: unitPrices[i], detail_mode: mode };

    if (mode === 'itemized') {
      // Sub-items are posted as sub_*_<item index>
      const subTitles = toArray(body[`sub_titles_${i}`] || []);
      const subDescriptions = toArray(body[`sub_descriptions_${i}`] || []);
      const subQuantities = toArray(body[`sub_quantities_${i}`] || []);
      const subPrices = toArray(body[`sub_prices_${i}`] || []);

      item.sub_items = subDescriptions.map((description, j) => ({
        title: subTitles[j],
        description,
        quantity: subQuantities[j],
        unit_price: subPrices[j]
      }));
    }

    return item;
  });
}

// List invoices with hybrid search (client-side for small data, server-side for large)
router.get('/', (req, res) => {
  const db = getDatabase();
  const searchQuery = req.query.q || '';
  const page = parseInt(req.query.page) || 1;
  const perPage = 50;
  const clientSideThreshold = 100; // Use client-side filtering under this count

  // Get total count
  const totalCount = db.prepare('SELECT COUNT(*) as total FROM invoices').get().total;
  const useClientSide = totalCount <= clientSideThreshold && !searchQuery;

  let invoices, totalPages;

  if (useClientSide) {
    // Small dataset: load all for instant client-side filtering
    invoices = db.prepare(`
      SELECT i.*, c.name as client_name, co.name as company_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN companies co ON i.company_id = co.id
      ORDER BY i.created_at DESC
    `).all();
    totalPages = 1;
  } else {
    // Large dataset: server-side filtering with pagination
    let whereClause = '';
    let params = [];

    if (searchQuery) {
      whereClause = 'WHERE i.project_name LIKE ? OR c.name LIKE ?';
      params = [`%${searchQuery}%`, `%${searchQuery}%`];
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      ${whereClause}
    `;
    const filteredCount = db.prepare(countQuery).get(...params).total;
    totalPages = Math.ceil(filteredCount / perPage);

    invoices = db.prepare(`
      SELECT i.*, c.name as client_name, co.name as company_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN companies co ON i.company_id = co.id
      ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, perPage, (page - 1) * perPage);
  }

  res.render('invoices/list', {
    invoices,
    searchQuery,
    currentPage: page,
    totalPages,
    useClientSide
  });
});

// New invoice form
router.get('/new', (req, res) => {
  const db = getDatabase();
  const companies = db.prepare('SELECT * FROM companies ORDER BY is_default DESC, name ASC').all();
  const clients = db.prepare('SELECT * FROM clients ORDER BY name ASC').all();
  const templates = db.prepare('SELECT * FROM note_templates ORDER BY sort_order ASC').all();
  const defaultTemplates = templates.filter(t => t.is_default);

  // Get default company
  const defaultCompany = companies.find(c => c.is_default) || companies[0];
  const defaultCompanyId = defaultCompany ? defaultCompany.id : null;

  const invoice = {
    invoice_number: generateInvoiceNumber(db, defaultCompanyId),
    company_id: defaultCompanyId,
    issue_date: new Date().toISOString().split('T')[0],
    validity_period: res.locals.t('invoice.validity_default'),
    tax_rate: 10,
    notes: JSON.stringify(defaultTemplates.map(t => t.content))
  };

  res.render('invoices/form', {
    invoice,
    items: [],
    companies,
    clients,
    templates,
    error: null,
    layout: false
  });
});

// Create invoice
router.post('/', (req, res) => {
  const db = getDatabase();
  const {
    invoice_number, company_id, client_id, project_name,
    issue_date, validity_period, tax_rate, notes, currency
  } = req.body;

  try {
    const { items, subtotal } = prepareItems(parseFormItems(req.body));
    const { taxAmount, totalAmount } = computeTotals(subtotal, tax_rate);

    // Insert invoice
    const result = db.prepare(`
      INSERT INTO invoices (invoice_number, company_id, client_id, project_name, issue_date, validity_period, subtotal, tax_rate, tax_amount, total_amount, notes, status, currency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `).run(invoice_number, company_id || null, client_id || null, project_name, issue_date, validity_period, subtotal, tax_rate, taxAmount, totalAmount, notes, currency || 'KRW');

    const invoiceId = result.lastInsertRowid;

    // Insert items
    insertItems(db, invoiceId, items);

    // Auto-select all enabled bank accounts for the company
    linkDefaultBankAccounts(db, invoiceId, company_id);

    res.redirect(`/invoices/${invoiceId}`);
  } catch (err) {
    console.error('Error creating invoice:', err);
    const companies = db.prepare('SELECT * FROM companies ORDER BY is_default DESC, name ASC').all();
    const clients = db.prepare('SELECT * FROM clients ORDER BY name ASC').all();
    const templates = db.prepare('SELECT * FROM note_templates ORDER BY sort_order ASC').all();

    res.render('invoices/form', {
      invoice: req.body,
      items: [],
      companies,
      clients,
      templates,
      error: 'Failed to create invoice',
      layout: false
    });
  }
});

// View invoice
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const invoice = db.prepare(`
    SELECT i.*, c.name as client_name, c.business_number as client_business_number, c.address as client_address,
           c.email as client_email, c.phone as client_phone,
           co.id as company_id_ref, co.name as company_name, co.business_number as company_business_number, co.representative,
           co.address as company_address, co.phone as company_phone, co.email as company_email,
           co.bank_info as company_bank_info, co.website as company_website, co.fax as company_fax,
           co.logo_path, co.stamp_path,
           co.name_en as company_name_en, co.representative_en, co.address_en as company_address_en,
           co.phone_en as company_phone_en, co.email_en as company_email_en, co.bank_info_en as company_bank_info_en,
           co.smtp_host, co.smtp_from_email, co.smtp_from_name, co.smtp_user
    FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    LEFT JOIN companies co ON i.company_id = co.id
    WHERE i.id = ?
  `).get(req.params.id);

  if (!invoice) {
    return res.redirect('/invoices');
  }

  // Fallback to Korean if English not available
  if (!invoice.company_name_en) invoice.company_name_en = invoice.company_name;
  if (!invoice.representative_en) invoice.representative_en = invoice.representative;
  if (!invoice.company_address_en) invoice.company_address_en = invoice.company_address;
  if (!invoice.company_phone_en) invoice.company_phone_en = invoice.company_phone;
  if (!invoice.company_email_en) invoice.company_email_en = invoice.company_email;
  if (!invoice.company_bank_info_en) invoice.company_bank_info_en = invoice.company_bank_info;

  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC').all(req.params.id);

  // Load sub-items for itemized items
  for (const item of items) {
    if (item.detail_mode === 'itemized') {
      item.subItems = db.prepare('SELECT * FROM invoice_item_details WHERE item_id = ? ORDER BY sort_order ASC').all(item.id);
    } else {
      item.subItems = [];
    }
  }

  // Get bank accounts for this invoice
  const selectedBankAccounts = db.prepare(`
    SELECT ba.* FROM bank_accounts ba
    JOIN invoice_bank_accounts iba ON iba.bank_account_id = ba.id
    WHERE iba.invoice_id = ? AND ba.is_enabled = 1
    ORDER BY ba.sort_order ASC
  `).all(req.params.id);

  const allBankAccounts = invoice.company_id
    ? db.prepare('SELECT * FROM bank_accounts WHERE company_id = ? AND is_enabled = 1 ORDER BY sort_order ASC').all(invoice.company_id)
    : [];

  const selectedBankIds = selectedBankAccounts.map(ba => ba.id);

  // Get email templates and log for this company
  const emailTemplates = invoice.company_id
    ? db.prepare('SELECT * FROM email_templates WHERE company_id = ? ORDER BY is_default DESC, name ASC').all(invoice.company_id)
    : [];
  const emailLog = db.prepare('SELECT * FROM email_log WHERE invoice_id = ? ORDER BY sent_at DESC LIMIT 10').all(req.params.id);
  const hasSmtp = !!(invoice.smtp_host && invoice.smtp_user);

  res.render('invoices/view', { invoice, items, emailTemplates, emailLog, hasSmtp, selectedBankAccounts, allBankAccounts, selectedBankIds, layout: false });
});

// Edit invoice form
router.get('/:id/edit', (req, res) => {
  const db = getDatabase();
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);

  if (!invoice) {
    return res.redirect('/invoices');
  }

  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC').all(req.params.id);

  // Load sub-items for itemized items
  for (const item of items) {
    if (item.detail_mode === 'itemized') {
      item.subItems = db.prepare('SELECT * FROM invoice_item_details WHERE item_id = ? ORDER BY sort_order ASC').all(item.id);
    } else {
      item.subItems = [];
    }
  }

  const companies = db.prepare('SELECT * FROM companies ORDER BY is_default DESC, name ASC').all();
  const clients = db.prepare('SELECT * FROM clients ORDER BY name ASC').all();
  const templates = db.prepare('SELECT * FROM note_templates ORDER BY sort_order ASC').all();

  res.render('invoices/form', {
    invoice,
    items,
    companies,
    clients,
    templates,
    error: null,
    layout: false
  });
});

// Update invoice
router.post('/:id', (req, res) => {
  const db = getDatabase();
  const invoiceId = req.params.id;
  const {
    invoice_number, company_id, client_id, project_name,
    issue_date, validity_period, tax_rate, notes, currency
  } = req.body;

  try {
    const { items, subtotal } = prepareItems(parseFormItems(req.body));
    const { taxAmount, totalAmount } = computeTotals(subtotal, tax_rate);

    // Update invoice
    db.prepare(`
      UPDATE invoices
      SET invoice_number = ?, company_id = ?, client_id = ?, project_name = ?,
          issue_date = ?, validity_period = ?, subtotal = ?, tax_rate = ?,
          tax_amount = ?, total_amount = ?, notes = ?, currency = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(invoice_number, company_id || null, client_id || null, project_name,
           issue_date, validity_period, subtotal, tax_rate, taxAmount, totalAmount, notes, currency || 'KRW', invoiceId);

    // Delete old items (cascade deletes sub-items)
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId);

    insertItems(db, invoiceId, items);

    res.redirect(`/invoices/${invoiceId}`);
  } catch (err) {
    console.error('Error updating invoice:', err);
    res.redirect(`/invoices/${invoiceId}/edit`);
  }
});

// Delete invoice
router.post('/:id/delete', (req, res) => {
  const db = getDatabase();

  try {
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(req.params.id);
    db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
    res.redirect('/invoices');
  } catch (err) {
    console.error('Error deleting invoice:', err);
    res.redirect('/invoices');
  }
});

// Set invoice status directly
router.post('/:id/set-status', (req, res) => {
  const db = getDatabase();
  const { status } = req.body;
  const validStatuses = ['draft', 'confirmed', 'discarded'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const invoice = db.prepare('SELECT id FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(status, req.params.id);

    res.json({ success: true, status: status });
  } catch (err) {
    console.error('Error setting invoice status:', err);
    res.status(500).json({ error: 'Failed to set status' });
  }
});

// Save display options
router.post('/:id/display-options', (req, res) => {
  const db = getDatabase();
  const { show_logo, show_stamp, show_tax_id, show_website, show_fax, show_bank_info, show_logo_watermark, show_swift, show_paypal, show_account_holder, show_branch, show_client_address, column_widths, selected_bank_accounts } = req.body;

  try {
    const invoice = db.prepare('SELECT id FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    db.prepare(`
      UPDATE invoices
      SET show_logo = ?, show_stamp = ?, show_tax_id = ?, show_website = ?, show_fax = ?, show_bank_info = ?, show_logo_watermark = ?,
          show_swift = ?, show_paypal = ?, show_account_holder = ?, show_branch = ?, show_client_address = ?, column_widths = ?
      WHERE id = ?
    `).run(
      show_logo !== false ? 1 : 0,
      show_stamp ? 1 : 0,
      show_tax_id !== false ? 1 : 0,
      show_website ? 1 : 0,
      show_fax ? 1 : 0,
      show_bank_info ? 1 : 0,
      show_logo_watermark ? 1 : 0,
      show_swift ? 1 : 0,
      show_paypal ? 1 : 0,
      show_account_holder !== false ? 1 : 0,
      show_branch ? 1 : 0,
      show_client_address ? 1 : 0,
      column_widths ? JSON.stringify(column_widths) : null,
      req.params.id
    );

    // Update selected bank accounts
    if (selected_bank_accounts !== undefined) {
      db.prepare('DELETE FROM invoice_bank_accounts WHERE invoice_id = ?').run(req.params.id);
      const bankIds = Array.isArray(selected_bank_accounts) ? selected_bank_accounts : (selected_bank_accounts ? [selected_bank_accounts] : []);
      const insertBankLink = db.prepare('INSERT OR IGNORE INTO invoice_bank_accounts (invoice_id, bank_account_id) VALUES (?, ?)');
      for (const bankId of bankIds) {
        insertBankLink.run(req.params.id, parseInt(bankId));
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving display options:', err);
    res.status(500).json({ error: 'Failed to save display options' });
  }
});

// Duplicate invoice
router.post('/:id/duplicate', (req, res) => {
  const db = getDatabase();

  try {
    const original = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!original) {
      return res.redirect('/invoices');
    }

    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC').all(req.params.id);

    const newInvoiceNumber = generateInvoiceNumber(db, original.company_id);

    const result = db.prepare(`
      INSERT INTO invoices (invoice_number, company_id, client_id, project_name, issue_date, validity_period, subtotal, tax_rate, tax_amount, total_amount, notes, status, currency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `).run(newInvoiceNumber, original.company_id, original.client_id, original.project_name,
           new Date().toISOString().split('T')[0], original.validity_period,
           original.subtotal, original.tax_rate, original.tax_amount, original.total_amount, original.notes, original.currency || 'KRW');

    const newInvoiceId = result.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO invoice_items (invoice_id, title, details, quantity, unit_price, amount, sort_order, detail_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertSubItem = db.prepare(`
      INSERT INTO invoice_item_details (item_id, title, description, quantity, unit_price, amount, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      const itemResult = insertItem.run(newInvoiceId, item.title, item.details, item.quantity, item.unit_price, item.amount, item.sort_order, item.detail_mode || 'text');

      // Copy sub-items if itemized mode
      if (item.detail_mode === 'itemized') {
        const newItemId = itemResult.lastInsertRowid;
        const subItems = db.prepare('SELECT * FROM invoice_item_details WHERE item_id = ? ORDER BY sort_order ASC').all(item.id);
        for (const sub of subItems) {
          insertSubItem.run(newItemId, sub.title || '', sub.description, sub.quantity, sub.unit_price, sub.amount, sub.sort_order);
        }
      }
    }

    // Copy bank account selections
    const bankLinks = db.prepare('SELECT * FROM invoice_bank_accounts WHERE invoice_id = ?').all(req.params.id);
    const insertBankLink = db.prepare('INSERT OR IGNORE INTO invoice_bank_accounts (invoice_id, bank_account_id) VALUES (?, ?)');
    for (const link of bankLinks) {
      insertBankLink.run(newInvoiceId, link.bank_account_id);
    }

    res.redirect(`/invoices/${newInvoiceId}/edit`);
  } catch (err) {
    console.error('Error duplicating invoice:', err);
    res.redirect('/invoices');
  }
});

module.exports = router;
