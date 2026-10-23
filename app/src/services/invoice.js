// Shared invoice logic used by both the web form routes and the JSON API

// Generate invoice number based on company prefix
function generateInvoiceNumber(db, companyId) {
  const year = new Date().getFullYear();

  // Get company prefix
  let invoicePrefix = 'INV';
  if (companyId) {
    const company = db.prepare('SELECT invoice_prefix FROM companies WHERE id = ?').get(companyId);
    if (company && company.invoice_prefix) {
      invoicePrefix = company.invoice_prefix;
    }
  }

  const prefix = `${invoicePrefix}-${year}-`;

  const lastInvoice = db.prepare(`
    SELECT invoice_number FROM invoices
    WHERE invoice_number LIKE ?
    ORDER BY invoice_number DESC
    LIMIT 1
  `).get(prefix + '%');

  let nextNum = 1;
  if (lastInvoice) {
    const lastNum = parseInt(lastInvoice.invoice_number.split('-').pop());
    nextNum = lastNum + 1;
  }

  return prefix + String(nextNum).padStart(4, '0');
}

// Normalize raw items and compute amounts.
// Input item: { title, details, quantity, unit_price, detail_mode?, sub_items?: [{ title, description, quantity, unit_price }] }
// detail_mode defaults to 'itemized' when sub_items are given, otherwise 'text'.
function prepareItems(rawItems) {
  let subtotal = 0;
  const items = [];

  rawItems.forEach((raw) => {
    if (!raw || !raw.title) return;

    const rawSubs = Array.isArray(raw.sub_items) ? raw.sub_items : [];
    const mode = raw.detail_mode || (rawSubs.length > 0 ? 'itemized' : 'text');
    let amount = 0;
    const subItems = [];

    if (mode === 'itemized') {
      rawSubs.forEach((sub) => {
        if (!sub || !(sub.description || sub.title)) return;
        const subQty = parseFloat(sub.quantity) || 1;
        const subPrice = parseFloat(sub.unit_price) || 0;
        const subAmount = subQty * subPrice;
        amount += subAmount;
        subItems.push({
          title: sub.title || '',
          description: sub.description || '',
          quantity: subQty,
          unit_price: subPrice,
          amount: subAmount,
          sort_order: subItems.length
        });
      });
    } else {
      amount = (parseFloat(raw.quantity) || 1) * (parseFloat(raw.unit_price) || 0);
    }

    subtotal += amount;

    items.push({
      title: raw.title,
      details: mode === 'text' ? (raw.details || '') : '',
      quantity: mode === 'text' ? (parseFloat(raw.quantity) || 1) : 1,
      unit_price: mode === 'text' ? (parseFloat(raw.unit_price) || 0) : amount,
      amount,
      sort_order: items.length,
      detail_mode: mode,
      subItems
    });
  });

  return { items, subtotal };
}

function computeTotals(subtotal, taxRate) {
  const parsedTaxRate = parseFloat(taxRate);
  const taxAmount = subtotal * (isNaN(parsedTaxRate) ? 10 : parsedTaxRate) / 100;
  return { taxAmount, totalAmount: subtotal + taxAmount };
}

// Insert prepared items (from prepareItems) for an invoice
function insertItems(db, invoiceId, items) {
  const insertItem = db.prepare(`
    INSERT INTO invoice_items (invoice_id, title, details, quantity, unit_price, amount, sort_order, detail_mode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSubItem = db.prepare(`
    INSERT INTO invoice_item_details (item_id, title, description, quantity, unit_price, amount, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of items) {
    const itemResult = insertItem.run(invoiceId, item.title, item.details, item.quantity, item.unit_price, item.amount, item.sort_order, item.detail_mode);

    if (item.detail_mode === 'itemized' && item.subItems.length > 0) {
      const itemId = itemResult.lastInsertRowid;
      for (const sub of item.subItems) {
        insertSubItem.run(itemId, sub.title || '', sub.description, sub.quantity, sub.unit_price, sub.amount, sub.sort_order);
      }
    }
  }
}

// Auto-select all enabled bank accounts for the company
function linkDefaultBankAccounts(db, invoiceId, companyId) {
  if (!companyId) return;
  const enabledBanks = db.prepare('SELECT id FROM bank_accounts WHERE company_id = ? AND is_enabled = 1').all(companyId);
  const insertBankLink = db.prepare('INSERT OR IGNORE INTO invoice_bank_accounts (invoice_id, bank_account_id) VALUES (?, ?)');
  for (const ba of enabledBanks) {
    insertBankLink.run(invoiceId, ba.id);
  }
}

module.exports = { generateInvoiceNumber, prepareItems, computeTotals, insertItems, linkDefaultBankAccounts };
