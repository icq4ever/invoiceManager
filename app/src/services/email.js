const nodemailer = require('nodemailer');
const path = require('path');
const ejs = require('ejs');
const fs = require('fs');
const { getDatabase } = require('../config/database');

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
 * Generate PDF from invoice using Puppeteer
 */
async function generateInvoicePdf(invoiceId, baseUrl) {
  let browser = null;
  try {
    const puppeteer = require('puppeteer');

    // Try to find chromium
    const chromiumPaths = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable'
    ].filter(Boolean);

    // Also check common playwright paths
    const homeDir = process.env.HOME || '/root';
    const glob = require('path');
    try {
      const playwrightDir = path.join(homeDir, '.cache', 'ms-playwright');
      if (fs.existsSync(playwrightDir)) {
        const dirs = fs.readdirSync(playwrightDir).filter(d => d.startsWith('chromium'));
        for (const dir of dirs) {
          const chromePath = path.join(playwrightDir, dir, 'chrome-linux', 'chrome');
          if (fs.existsSync(chromePath)) {
            chromiumPaths.push(chromePath);
          }
        }
      }
    } catch (e) { /* ignore */ }

    let executablePath = null;
    for (const p of chromiumPaths) {
      if (p && fs.existsSync(p)) {
        executablePath = p;
        break;
      }
    }

    const launchOptions = {
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    };
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // Navigate to the invoice view page
    const url = `${baseUrl}/invoices/${invoiceId}`;
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Hide non-print elements
    await page.evaluate(() => {
      document.querySelectorAll('.no-print').forEach(el => el.style.display = 'none');
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '5mm', right: '5mm', bottom: '5mm', left: '5mm' },
      printBackground: true
    });

    return pdfBuffer;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
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
async function sendInvoiceEmail({ invoiceId, recipientEmail, fromEmail, fromName, subject, body, baseUrl }) {
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

  // Generate PDF
  const pdfBuffer = await generateInvoicePdf(invoiceId, baseUrl);

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
 * Test SMTP connection
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
