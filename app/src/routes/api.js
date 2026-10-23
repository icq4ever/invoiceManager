// External JSON API (v1) for programmatic/AI access. Spec: docs/api.md
const express = require('express');
const { requireApiKey } = require('../middleware/auth');
const api = require('../services/invoiceApi');

const router = express.Router();

router.use(requireApiKey);

// Wrap handlers so thrown ApiErrors become JSON responses
const handle = (fn, status = 200) => (req, res) => {
  try {
    res.status(status).json(fn(req));
  } catch (err) {
    if (err instanceof api.ApiError) {
      return res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
    }
    console.error('API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reference data
router.get('/companies', handle(() => api.listCompanies()));
router.get('/clients', handle(req => api.searchClients(req.query.q)));
router.post('/clients', handle(req => api.createClient(req.body), 201));
router.get('/note-templates', handle(() => api.listNoteTemplates()));

// Invoices
router.get('/invoices', handle(req => api.listInvoices({ query: req.query.q, ...req.query })));
router.get('/invoices/:id', handle(req => api.getInvoice(req.params.id)));
router.post('/invoices', handle(req => api.createInvoice(req.body), 201));
router.patch('/invoices/:id', handle(req => api.updateInvoice(req.params.id, req.body)));
router.post('/invoices/:id/status', handle(req => api.setInvoiceStatus(req.params.id, req.body && req.body.status)));

router.use((req, res) => {
  res.status(404).json({ error: `No such endpoint: ${req.method} ${req.originalUrl}` });
});

module.exports = router;
