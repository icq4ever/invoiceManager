const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getDatabase } = require('../config/database');
const emailService = require('../services/email');

const router = express.Router();

router.use(requireAuth);

// Send invoice email
router.post('/send/:invoiceId', async (req, res) => {
  const { recipientEmail, fromEmail, fromName, subject, body } = req.body;
  const invoiceId = req.params.invoiceId;

  if (!recipientEmail || !subject || !body) {
    return res.status(400).json({ error: 'Recipient email, subject, and body are required' });
  }

  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    await emailService.sendInvoiceEmail({
      invoiceId,
      recipientEmail,
      fromEmail,
      fromName,
      subject,
      body,
      baseUrl
    });

    res.json({ success: true, message: 'Email sent successfully' });
  } catch (err) {
    console.error('Error sending email:', err);

    // Log failed attempt
    const db = getDatabase();
    db.prepare(`
      INSERT INTO email_log (invoice_id, recipient_email, from_email, from_name, subject, status, error_message)
      VALUES (?, ?, ?, ?, ?, 'failed', ?)
    `).run(invoiceId, recipientEmail, fromEmail || '', fromName || '', subject, err.message);

    res.status(500).json({ error: err.message || 'Failed to send email' });
  }
});

// Test SMTP connection for a company
router.post('/test-smtp/:companyId', async (req, res) => {
  try {
    const smtpSettings = emailService.getSmtpSettings(req.params.companyId);
    if (!smtpSettings) {
      return res.status(404).json({ error: 'Company not found' });
    }
    await emailService.testSmtpConnection(smtpSettings);
    res.json({ success: true, message: 'SMTP connection successful' });
  } catch (err) {
    console.error('SMTP test failed:', err);
    res.status(500).json({ error: err.message || 'SMTP connection failed' });
  }
});

// Get email templates for a company
router.get('/templates/:companyId', (req, res) => {
  const templates = emailService.getEmailTemplates(req.params.companyId);
  res.json(templates);
});

// Create email template
router.post('/templates', (req, res) => {
  const db = getDatabase();
  const { company_id, name, subject, body, is_default } = req.body;

  if (!company_id || !name || !subject || !body) {
    return res.status(400).json({ error: 'Company, name, subject, and body are required' });
  }

  try {
    if (is_default) {
      db.prepare('UPDATE email_templates SET is_default = 0 WHERE company_id = ?').run(company_id);
    }

    const result = db.prepare(`
      INSERT INTO email_templates (company_id, name, subject, body, is_default)
      VALUES (?, ?, ?, ?, ?)
    `).run(company_id, name, subject, body, is_default ? 1 : 0);

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Error creating email template:', err);
    res.status(500).json({ error: 'Failed to create email template' });
  }
});

// Update email template
router.post('/templates/:id', (req, res) => {
  const db = getDatabase();
  const { company_id, name, subject, body, is_default } = req.body;
  const templateId = req.params.id;

  try {
    if (is_default) {
      db.prepare('UPDATE email_templates SET is_default = 0 WHERE company_id = ?').run(company_id);
    }

    db.prepare(`
      UPDATE email_templates SET name = ?, subject = ?, body = ?, is_default = ?
      WHERE id = ?
    `).run(name, subject, body, is_default ? 1 : 0, templateId);

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating email template:', err);
    res.status(500).json({ error: 'Failed to update email template' });
  }
});

// Delete email template
router.post('/templates/:id/delete', (req, res) => {
  const db = getDatabase();
  try {
    db.prepare('DELETE FROM email_templates WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting email template:', err);
    res.status(500).json({ error: 'Failed to delete email template' });
  }
});

// Get email log for an invoice
router.get('/log/:invoiceId', (req, res) => {
  const log = emailService.getEmailLog(req.params.invoiceId);
  res.json(log);
});

// Email templates management page
router.get('/templates/manage/:companyId', (req, res) => {
  const db = getDatabase();
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.companyId);
  if (!company) {
    return res.redirect('/companies');
  }
  const templates = emailService.getEmailTemplates(req.params.companyId);
  res.render('email/templates', { company, templates });
});

// Email template form page
router.get('/templates/manage/:companyId/new', (req, res) => {
  const db = getDatabase();
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.companyId);
  if (!company) {
    return res.redirect('/companies');
  }
  res.render('email/template-form', { company, template: null, error: null });
});

// Email template edit page
router.get('/templates/manage/:companyId/:templateId/edit', (req, res) => {
  const db = getDatabase();
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.companyId);
  const template = db.prepare('SELECT * FROM email_templates WHERE id = ? AND company_id = ?').get(req.params.templateId, req.params.companyId);
  if (!company || !template) {
    return res.redirect('/companies');
  }
  res.render('email/template-form', { company, template, error: null });
});

// Save email template from form (create)
router.post('/templates/manage/:companyId', (req, res) => {
  const db = getDatabase();
  const companyId = req.params.companyId;
  const { name, subject, body, is_default } = req.body;

  try {
    if (is_default) {
      db.prepare('UPDATE email_templates SET is_default = 0 WHERE company_id = ?').run(companyId);
    }
    db.prepare(`
      INSERT INTO email_templates (company_id, name, subject, body, is_default)
      VALUES (?, ?, ?, ?, ?)
    `).run(companyId, name, subject, body, is_default ? 1 : 0);

    res.redirect(`/email/templates/manage/${companyId}`);
  } catch (err) {
    console.error('Error creating email template:', err);
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
    res.render('email/template-form', { company, template: req.body, error: 'Failed to create template' });
  }
});

// Save email template from form (update)
router.post('/templates/manage/:companyId/:templateId', (req, res) => {
  const db = getDatabase();
  const companyId = req.params.companyId;
  const templateId = req.params.templateId;
  const { name, subject, body, is_default } = req.body;

  try {
    if (is_default) {
      db.prepare('UPDATE email_templates SET is_default = 0 WHERE company_id = ?').run(companyId);
    }
    db.prepare(`
      UPDATE email_templates SET name = ?, subject = ?, body = ?, is_default = ?
      WHERE id = ? AND company_id = ?
    `).run(name, subject, body, is_default ? 1 : 0, templateId, companyId);

    res.redirect(`/email/templates/manage/${companyId}`);
  } catch (err) {
    console.error('Error updating email template:', err);
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
    res.render('email/template-form', { company, template: { ...req.body, id: templateId }, error: 'Failed to update template' });
  }
});

// Delete email template from form
router.post('/templates/manage/:companyId/:templateId/delete', (req, res) => {
  const db = getDatabase();
  try {
    db.prepare('DELETE FROM email_templates WHERE id = ? AND company_id = ?').run(req.params.templateId, req.params.companyId);
  } catch (err) {
    console.error('Error deleting email template:', err);
  }
  res.redirect(`/email/templates/manage/${req.params.companyId}`);
});

module.exports = router;
