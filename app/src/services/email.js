const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { getDatabase } = require('../config/database');

// Font paths
const FONT_REGULAR = path.join(__dirname, '../fonts/Pretendard-Regular.otf');
const FONT_BOLD = path.join(__dirname, '../fonts/Pretendard-Bold.otf');

/**
 * Get SMTP settings for a company
 */
function getSmtpSettings(companyId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from_name, smtp_from_email, email, name
    FROM companies WHERE id = ?
  `).get(companyId);
}

/**
 * Create a nodemailer transporter from company SMTP settings
 */
function createTransporter(smtpSettings) {
  if (!smtpSettings || !smtpSettings.smtp_host || !smtpSettings.smtp_user) {
    throw new Error('SMTP settings not configured for this company');
  }

  return nodemailer.createTransport({
    host: smtpSettings.smtp_host,
    port: smtpSettings.smtp_port || 587,
    secure: smtpSettings.smtp_secure === 1,
    auth: {
      user: smtpSettings.smtp_user,
      pass: smtpSettings.smtp_pass
    }
  });
}

/**
 * Extract domain from email address
 */
function getDomain(email) {
  if (!email || !email.includes('@')) return null;
  return email.split('@')[1].toLowerCase();
}

/**
 * Validate that override email is on the same domain as the configured SMTP email
 */
function validateFromEmail(overrideEmail, smtpSettings) {
  const configuredEmail = smtpSettings.smtp_from_email || smtpSettings.smtp_user || smtpSettings.email;
  if (!configuredEmail) return false;

  const configuredDomain = getDomain(configuredEmail);
  const overrideDomain = getDomain(overrideEmail);

  if (!configuredDomain || !overrideDomain) return false;
  return configuredDomain === overrideDomain;
}

/**
 * Get default from email for a company
 */
function getDefaultFrom(smtpSettings) {
  return smtpSettings.smtp_from_email || smtpSettings.smtp_user || smtpSettings.email;
}

/**
 * Get default from name for a company
 */
function getDefaultFromName(smtpSettings) {
  return smtpSettings.smtp_from_name || smtpSettings.name;
}

/**
 * Format currency amount
 */
function formatAmount(amount, currency) {
  const symbols = { KRW: '₩', USD: '$', EUR: '€', JPY: '¥', GBP: '£', CNY: '¥' };
  const sym = symbols[currency] || '₩';
  if (currency === 'KRW' || currency === 'JPY') {
    return sym + new Intl.NumberFormat('ko-KR').format(Math.round(amount));
  }
  return sym + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

/**
 * Generate PDF from invoice using PDFKit (no chromium dependency)
 * @param {number} invoiceId
 * @param {string} lang - 'ko' or 'en'
 */
async function generateInvoicePdf(invoiceId, lang = 'ko') {
  const db = getDatabase();

  // Get full invoice data
  const invoice = db.prepare(`
    SELECT i.*, c.name as client_name, c.business_number as client_business_number, c.address as client_address,
           co.name as company_name, co.business_number as company_business_number, co.representative,
           co.address as company_address, co.phone as company_phone, co.email as company_email,
           co.bank_info as company_bank_info, co.website as company_website, co.fax as company_fax,
           co.logo_path, co.stamp_path,
           co.name_en as company_name_en, co.representative_en, co.address_en as company_address_en,
           co.phone_en as company_phone_en, co.email_en as company_email_en, co.bank_info_en as company_bank_info_en
    FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    LEFT JOIN companies co ON i.company_id = co.id
    WHERE i.id = ?
  `).get(invoiceId);

  if (!invoice) throw new Error('Invoice not found');

  // Get selected bank accounts for this invoice
  const selectedBankAccounts = db.prepare(`
    SELECT ba.* FROM bank_accounts ba
    JOIN invoice_bank_accounts iba ON iba.bank_account_id = ba.id
    WHERE iba.invoice_id = ? AND ba.is_enabled = 1
    ORDER BY ba.sort_order ASC
  `).all(invoiceId);

  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC').all(invoiceId);
  for (const item of items) {
    if (item.detail_mode === 'itemized') {
      item.subItems = db.prepare('SELECT * FROM invoice_item_details WHERE item_id = ? ORDER BY sort_order ASC').all(item.id);
    } else {
      item.subItems = [];
    }
  }

  const currency = invoice.currency || 'KRW';
  const isEn = lang === 'en';

  // Bilingual labels
  const L = isEn ? {
    title: 'Invoice',
    recipient: 'To',
    date: 'Date',
    validity: 'Validity',
    supplier: 'From',
    companyName: 'Company',
    representative: 'Rep',
    stampMark: '(sign)',
    businessNumber: 'Tax ID',
    address: 'Address',
    phone: 'Phone',
    website: 'Website',
    email: 'Email',
    fax: 'Fax',
    bankInfo: 'Bank Info',
    totalAmount: 'Total (incl. Tax)',
    itemTitle: 'Item',
    itemDetails: 'Details',
    quantity: 'Qty',
    unitPrice: 'Unit Price',
    supplyAmount: 'Amount (excl. Tax)',
    subtotal: 'Subtotal',
    tax: 'Tax',
    total: 'Total',
    notes: 'Notes'
  } : {
    title: '견적서',
    recipient: '수신',
    date: '견적일',
    validity: '유효기간',
    supplier: '공급자',
    companyName: '회사명',
    representative: '대표자',
    stampMark: '(인)',
    businessNumber: '사업자번호',
    address: '주소',
    phone: '전화',
    website: '웹사이트',
    email: '이메일',
    fax: '팩스',
    bankInfo: '계좌정보',
    totalAmount: '견적금액 (공급가액 + 세액)',
    itemTitle: '항목명',
    itemDetails: '세부 내역',
    quantity: '수량',
    unitPrice: '단가',
    supplyAmount: '공급가액 (부가세 제외)',
    subtotal: '소계 (공급가)',
    tax: '부가세',
    total: '합계 (총액)',
    notes: '기타'
  };

  // Helper: pick bilingual field (EN fallback to KO)
  const biName = isEn ? (invoice.company_name_en || invoice.company_name) : invoice.company_name;
  const biRep = isEn ? (invoice.representative_en || invoice.representative) : invoice.representative;
  const biAddr = isEn ? (invoice.company_address_en || invoice.company_address) : invoice.company_address;
  const biPhone = isEn ? (invoice.company_phone_en || invoice.company_phone) : invoice.company_phone;
  const biEmail = isEn ? (invoice.company_email_en || invoice.company_email) : invoice.company_email;
  const biBankInfo = isEn ? (invoice.company_bank_info_en || invoice.company_bank_info) : invoice.company_bank_info;

  // Create PDF
  const doc = new PDFDocument({ size: 'A4', margin: 30 });
  const chunks = [];

  doc.on('data', chunk => chunks.push(chunk));

  // Register fonts
  if (fs.existsSync(FONT_REGULAR)) {
    doc.registerFont('Pretendard', FONT_REGULAR);
    doc.registerFont('Pretendard-Bold', FONT_BOLD);
  }

  const fontRegular = fs.existsSync(FONT_REGULAR) ? 'Pretendard' : 'Helvetica';
  const fontBold = fs.existsSync(FONT_BOLD) ? 'Pretendard-Bold' : 'Helvetica-Bold';

  const pageWidth = doc.page.width - 60; // 30px margin each side
  const leftMargin = 30;
  let y = 30;

  // --- HEADER ---
  doc.font(fontBold).fontSize(18).text(L.title, leftMargin, y);

  // Logo (if exists)
  if (invoice.logo_path) {
    const logoFile = path.join(__dirname, '../../uploads', invoice.logo_path.replace('/uploads/', ''));
    if (fs.existsSync(logoFile)) {
      if (invoice.show_logo !== 0) {
        try {
          doc.image(logoFile, leftMargin + pageWidth - 100, y, { height: 25, fit: [100, 25], align: 'right' });
        } catch (e) { /* skip if image fails */ }
      }

      // Logo watermark (semi-transparent background)
      if (invoice.show_logo_watermark === 1) {
        try {
          doc.save();
          doc.opacity(0.06);
          const centerX = doc.page.width / 2 - 150;
          const centerY = doc.page.height / 2 - 150;
          doc.image(logoFile, centerX, centerY, { fit: [300, 300], align: 'center', valign: 'center' });
          doc.restore();
        } catch (e) { /* skip if watermark fails */ }
      }
    }
  }

  y += 35;

  // --- PROJECT & CLIENT INFO (left) ---
  const leftColWidth = pageWidth * 0.5;
  const rightColWidth = pageWidth * 0.45;
  const rightColX = leftMargin + pageWidth - rightColWidth;

  const startY = y;

  // Project name
  if (invoice.project_name) {
    doc.font(fontRegular).fontSize(14);
    const projText = (invoice.project_name || '').replace(/\\n/g, '\n');
    doc.text(projText, leftMargin, y, { width: leftColWidth });
    y = doc.y + 8;
  }

  // Client info table
  const infoRows = [
    [L.recipient, invoice.client_name || '-'],
    [L.date, invoice.issue_date || '-'],
    [L.validity, invoice.validity_period || '-']
  ];

  doc.fontSize(8);
  for (const [label, value] of infoRows) {
    doc.strokeColor('#d1d5db').lineWidth(0.5)
      .moveTo(leftMargin, y).lineTo(leftMargin + leftColWidth - 20, y).stroke();
    doc.font(fontBold).fillColor('#6b7280').text(label, leftMargin + 2, y + 2, { width: 60 });
    doc.font(fontRegular).fillColor('#000000').text(value, leftMargin + 65, y + 2, { width: leftColWidth - 85 });
    y += 15;
  }
  doc.strokeColor('#d1d5db').lineWidth(0.5)
    .moveTo(leftMargin, y).lineTo(leftMargin + leftColWidth - 20, y).stroke();

  // --- SUPPLIER INFO (right) ---
  let ry = startY;
  doc.font(fontBold).fontSize(9).fillColor('#6b7280').text(L.supplier, rightColX, ry);
  ry += 14;

  // Stamp image
  if (invoice.stamp_path && invoice.show_stamp !== 0) {
    const stampFile = path.join(__dirname, '../../uploads', invoice.stamp_path.replace('/uploads/', ''));
    if (fs.existsSync(stampFile)) {
      try {
        doc.image(stampFile, rightColX + rightColWidth - 55, ry - 5, { height: 40, fit: [55, 40] });
      } catch (e) { /* skip */ }
    }
  }

  const supplierRows = [
    [L.companyName, biName || '-', L.representative, (biRep || '-') + ' ' + L.stampMark],
    [L.businessNumber, invoice.company_business_number || '-'],
    [L.address, (biAddr || '-').replace(/\\n/g, '\n')],
    [L.phone, biPhone || '-'],
  ];
  if (invoice.show_website !== 0 && invoice.company_website) {
    supplierRows.push([L.website, invoice.company_website]);
  }
  supplierRows.push([L.email, biEmail || '-']);
  if (invoice.show_fax !== 0 && invoice.company_fax) {
    supplierRows.push([L.fax, invoice.company_fax]);
  }
  if (invoice.show_bank_info !== 0 && selectedBankAccounts.length > 0) {
    for (let i = 0; i < selectedBankAccounts.length; i++) {
      const ba = selectedBankAccounts[i];
      const bankName = isEn ? (ba.bank_name_en || ba.bank_name) : ba.bank_name;
      const branchText = ba.branch ? (isEn ? (ba.branch_en || ba.branch) : ba.branch) : '';
      let bankText = `${bankName} ${ba.account_number}`;
      if (branchText) bankText += ` (${branchText})`;
      if (ba.show_swift && ba.swift_code) bankText += `\nSWIFT: ${ba.swift_code}`;
      supplierRows.push([i === 0 ? L.bankInfo : '', bankText]);
    }
  } else if (invoice.show_bank_info !== 0 && (biBankInfo || invoice.company_bank_info)) {
    // Fallback to legacy free-text bank info
    supplierRows.push([L.bankInfo, biBankInfo || invoice.company_bank_info]);
  }

  doc.fontSize(7);
  for (const row of supplierRows) {
    doc.strokeColor('#d1d5db').lineWidth(0.5)
      .moveTo(rightColX, ry).lineTo(rightColX + rightColWidth, ry).stroke();

    doc.font(fontBold).fillColor('#6b7280').text(row[0], rightColX + 2, ry + 2, { width: 45 });
    if (row.length === 4) {
      // Two-column row (name + representative)
      doc.font(fontRegular).fillColor('#000000').text(row[1], rightColX + 50, ry + 2, { width: rightColWidth * 0.35 });
      doc.font(fontBold).fillColor('#6b7280').text(row[2], rightColX + rightColWidth * 0.55, ry + 2, { width: 30 });
      doc.font(fontRegular).fillColor('#000000').text(row[3], rightColX + rightColWidth * 0.55 + 32, ry + 2, { width: rightColWidth * 0.35 });
    } else {
      doc.font(fontRegular).fillColor('#000000').text(row[1], rightColX + 50, ry + 2, { width: rightColWidth - 55 });
    }
    ry = Math.max(ry + 13, doc.y + 2);
  }
  doc.strokeColor('#d1d5db').lineWidth(0.5)
    .moveTo(rightColX, ry).lineTo(rightColX + rightColWidth, ry).stroke();

  // Move y past both columns
  y = Math.max(y, ry) + 20;

  // --- TOTAL AMOUNT ---
  doc.font(fontBold).fontSize(12).fillColor('#000000').text(L.totalAmount, leftMargin, y);
  doc.font(fontBold).fontSize(14).fillColor('#2563eb').text(formatAmount(invoice.total_amount, currency), leftMargin, y, {
    width: pageWidth, align: 'right'
  });
  y += 22;

  // --- ITEMS TABLE ---
  const colWidths = [pageWidth * 0.12, pageWidth * 0.40, pageWidth * 0.08, pageWidth * 0.16, pageWidth * 0.24];
  const colX = [leftMargin];
  for (let i = 1; i < colWidths.length; i++) {
    colX.push(colX[i - 1] + colWidths[i - 1]);
  }

  // Table header
  doc.strokeColor('#1f2937').lineWidth(1.5)
    .moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).stroke();
  y += 3;

  const headers = [L.itemTitle, L.itemDetails, L.quantity, L.unitPrice, L.supplyAmount];
  const headerAligns = ['left', 'left', 'center', 'right', 'right'];
  doc.font(fontBold).fontSize(7).fillColor('#000000');
  for (let i = 0; i < headers.length; i++) {
    const opts = { width: colWidths[i] - 4, align: headerAligns[i] };
    doc.text(headers[i], colX[i] + 2, y, opts);
  }
  y += 12;
  doc.strokeColor('#1f2937').lineWidth(0.5)
    .moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).stroke();
  y += 3;

  // Table rows
  doc.fontSize(7);
  for (const item of items) {
    if (item.detail_mode === 'itemized' && item.subItems && item.subItems.length > 0) {
      // Itemized mode
      const titleY = y;
      for (let si = 0; si < item.subItems.length; si++) {
        const sub = item.subItems[si];
        const isLast = si === item.subItems.length - 1;

        if (si === 0) {
          doc.font(fontBold).fillColor('#000000').text(item.title, colX[0] + 2, y, { width: colWidths[0] - 4 });
        }

        let detailText = sub.description || '';
        if (sub.title) detailText = sub.title + ' : ' + detailText;
        doc.font(fontRegular).fillColor('#4b5563').text(detailText, colX[1] + 2, y, { width: colWidths[1] - 4 });
        doc.text(String(sub.quantity), colX[2] + 2, y, { width: colWidths[2] - 4, align: 'center' });
        doc.text(formatAmount(sub.unit_price, currency), colX[3] + 2, y, { width: colWidths[3] - 4, align: 'right' });
        if (si === 0) {
          doc.font(fontBold).fillColor('#000000').text(formatAmount(item.amount, currency), colX[4] + 2, y, { width: colWidths[4] - 4, align: 'right' });
        }

        y = Math.max(y + 11, doc.y + 2);

        const lineColor = isLast ? '#1f2937' : '#d1d5db';
        doc.strokeColor(lineColor).lineWidth(isLast ? 0.5 : 0.3)
          .moveTo(colX[1], y).lineTo(leftMargin + pageWidth, y).stroke();
        if (isLast) {
          doc.moveTo(leftMargin, y).lineTo(colX[1], y).stroke();
        }
        y += 3;

        // Page break check
        if (y > doc.page.height - 100) {
          doc.addPage();
          y = 30;
        }
      }
    } else {
      // Text mode
      doc.font(fontBold).fillColor('#000000').text(item.title, colX[0] + 2, y, { width: colWidths[0] - 4 });
      doc.font(fontRegular).fillColor('#4b5563').text((item.details || '').replace(/\\n/g, '\n'), colX[1] + 2, y, { width: colWidths[1] - 4 });
      doc.fillColor('#000000').text(String(item.quantity), colX[2] + 2, y, { width: colWidths[2] - 4, align: 'center' });
      doc.text(formatAmount(item.unit_price, currency), colX[3] + 2, y, { width: colWidths[3] - 4, align: 'right' });
      doc.text(formatAmount(item.amount, currency), colX[4] + 2, y, { width: colWidths[4] - 4, align: 'right' });

      y = Math.max(y + 11, doc.y + 2);
      doc.strokeColor('#1f2937').lineWidth(0.5)
        .moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).stroke();
      y += 3;
    }

    // Page break check
    if (y > doc.page.height - 100) {
      doc.addPage();
      y = 30;
    }
  }

  y += 5;

  // --- SUMMARY ---
  const summaryX = leftMargin + pageWidth * 0.55;
  const summaryW = pageWidth * 0.45;

  doc.strokeColor('#d1d5db').lineWidth(0.5)
    .moveTo(summaryX, y).lineTo(summaryX + summaryW, y).stroke();
  y += 3;
  doc.font(fontBold).fontSize(8).fillColor('#6b7280').text(L.subtotal, summaryX + 2, y, { width: summaryW * 0.5 });
  doc.font(fontBold).fillColor('#000000').text(formatAmount(invoice.subtotal, currency), summaryX + summaryW * 0.5, y, { width: summaryW * 0.5 - 2, align: 'right' });
  y += 13;

  doc.strokeColor('#d1d5db').lineWidth(0.5)
    .moveTo(summaryX, y).lineTo(summaryX + summaryW, y).stroke();
  y += 3;
  doc.font(fontBold).fillColor('#6b7280').text(`${L.tax} (${invoice.tax_rate}%)`, summaryX + 2, y, { width: summaryW * 0.5 });
  doc.font(fontBold).fillColor('#000000').text(formatAmount(invoice.tax_amount, currency), summaryX + summaryW * 0.5, y, { width: summaryW * 0.5 - 2, align: 'right' });
  y += 13;

  doc.strokeColor('#1f2937').lineWidth(1.5)
    .moveTo(summaryX, y).lineTo(summaryX + summaryW, y).stroke();
  y += 3;
  doc.font(fontBold).fontSize(9).fillColor('#000000').text(L.total, summaryX + 2, y, { width: summaryW * 0.5 });
  doc.text(formatAmount(invoice.total_amount, currency), summaryX + summaryW * 0.5, y, { width: summaryW * 0.5 - 2, align: 'right' });
  y += 20;

  // --- NOTES ---
  let notes = [];
  try {
    notes = JSON.parse(invoice.notes || '[]');
  } catch (e) {
    notes = invoice.notes ? [invoice.notes] : [];
  }

  if (notes.length > 0) {
    // Check if we need a new page for notes
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 30;
    }

    doc.strokeColor('#d1d5db').lineWidth(0.5)
      .moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).stroke();
    y += 5;

    doc.font(fontBold).fontSize(8).fillColor('#000000').text(L.notes, leftMargin, y);
    y += 12;

    doc.font(fontRegular).fontSize(6.5).fillColor('#6b7280');
    notes.forEach((note, i) => {
      const noteText = `${i + 1}. ${(note || '').replace(/\\n/g, '\n')}`;
      doc.text(noteText, leftMargin + 2, y, { width: pageWidth - 4 });
      y = doc.y + 3;
    });
  }

  // Finalize
  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

/**
 * Replace template variables in subject/body
 */
function renderTemplate(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
}

/**
 * Send invoice email with PDF attachment
 */
async function sendInvoiceEmail({ invoiceId, recipientEmail, fromEmail, fromName, subject, body, lang = 'ko' }) {
  const db = getDatabase();

  // Get invoice with company info
  const invoice = db.prepare(`
    SELECT i.*, c.name as client_name, c.email as client_email,
           co.id as comp_id, co.name as company_name
    FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    LEFT JOIN companies co ON i.company_id = co.id
    WHERE i.id = ?
  `).get(invoiceId);

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const smtpSettings = getSmtpSettings(invoice.comp_id);
  if (!smtpSettings) {
    throw new Error('Company not found');
  }

  const transporter = createTransporter(smtpSettings);

  // Determine from address
  const defaultFrom = getDefaultFrom(smtpSettings);
  let actualFromEmail = defaultFrom;
  let actualFromName = getDefaultFromName(smtpSettings);

  if (fromEmail && fromEmail !== defaultFrom) {
    if (validateFromEmail(fromEmail, smtpSettings)) {
      actualFromEmail = fromEmail;
    } else {
      throw new Error(`Override email must be on the same domain as ${getDomain(defaultFrom)}`);
    }
  }

  if (fromName) {
    actualFromName = fromName;
  }

  // Generate PDF using PDFKit (no chromium dependency)
  const pdfBuffer = await generateInvoicePdf(invoiceId, lang);

  // Build filename
  const pdfFilename = `${invoice.invoice_number || 'invoice'}.pdf`;

  // Send email
  const mailOptions = {
    from: `"${actualFromName}" <${actualFromEmail}>`,
    to: recipientEmail,
    subject: subject,
    html: body,
    attachments: [
      {
        filename: pdfFilename,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  };

  const info = await transporter.sendMail(mailOptions);

  // Log the email
  db.prepare(`
    INSERT INTO email_log (invoice_id, recipient_email, from_email, from_name, subject, status)
    VALUES (?, ?, ?, ?, ?, 'sent')
  `).run(invoiceId, recipientEmail, actualFromEmail, actualFromName, subject);

  return info;
}

/**
 * Test SMTP connection (from raw settings, not saved)
 */
async function testSmtpConnection(smtpSettings) {
  const transporter = createTransporter(smtpSettings);
  await transporter.verify();
  return true;
}

/**
 * Get email templates for a company
 */
function getEmailTemplates(companyId) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM email_templates WHERE company_id = ? ORDER BY is_default DESC, name ASC').all(companyId);
}

/**
 * Get default email template for a company, or fallback
 */
function getDefaultEmailTemplate(companyId) {
  const db = getDatabase();
  let template = db.prepare('SELECT * FROM email_templates WHERE company_id = ? AND is_default = 1 LIMIT 1').get(companyId);
  if (!template) {
    template = db.prepare('SELECT * FROM email_templates WHERE company_id = ? LIMIT 1').get(companyId);
  }
  return template;
}

/**
 * Get email sending history for an invoice
 */
function getEmailLog(invoiceId) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM email_log WHERE invoice_id = ? ORDER BY sent_at DESC').all(invoiceId);
}

module.exports = {
  getSmtpSettings,
  createTransporter,
  validateFromEmail,
  getDefaultFrom,
  getDefaultFromName,
  getDomain,
  generateInvoicePdf,
  renderTemplate,
  sendInvoiceEmail,
  testSmtpConnection,
  getEmailTemplates,
  getDefaultEmailTemplate,
  getEmailLog
};
