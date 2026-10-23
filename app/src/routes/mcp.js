// Remote MCP server (Streamable HTTP, stateless) so web chat AIs like claude.ai can write invoices.
// Auth: "Authorization: Bearer <API_KEY>" header, or the key as a path segment (/mcp/<API_KEY>)
// for clients that cannot send custom headers.
const express = require('express');
const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { isValidApiKey, getBearerToken } = require('../middleware/auth');
const api = require('../services/invoiceApi');
const { version } = require('../../package.json');

const router = express.Router();

const INSTRUCTIONS = `Invoice Manager: create and manage Korean-style quotations (견적서).

Workflow for writing a new invoice:
1. Usually skip list_companies: the default company is used when company_id is omitted.
2. Call search_clients with the client's name. If it exists use client_id; otherwise pass client: { name, ... } to create_invoice and it is created automatically.
3. Call create_invoice. Amounts, subtotal, tax and total are computed by the server; never send them.
4. Show the user a summary (items, total_amount) and the web_url (or web_path) so they can review and export the PDF in the web UI.

Rules:
- New invoices are always "draft". Only call set_invoice_status with "confirmed" when the user explicitly asks.
- There is no delete; use set_invoice_status "discarded" instead.
- update_invoice with items replaces ALL items. To change one item, get_invoice first, edit the list, and send the full list.
- Default currency is KRW with 10% VAT (tax_rate). Use tax_rate 0 when the user says VAT is excluded or not applicable.
- Write item titles and details in the user's language unless asked otherwise.`;

const subItemSchema = z.object({
  title: z.string().optional().describe('Sub-item name (title or description required)'),
  description: z.string().optional().describe('Sub-item description'),
  quantity: z.number().optional().describe('Default 1'),
  unit_price: z.number().optional().describe('Default 0')
});

const itemSchema = z.object({
  title: z.string().describe('Item name'),
  details: z.string().optional().describe('Simple form only: description text, newlines allowed'),
  quantity: z.number().optional().describe('Simple form only. Default 1'),
  unit_price: z.number().optional().describe('Simple form only: required unless sub_items is given'),
  sub_items: z.array(subItemSchema).optional().describe('Itemized form: item amount = sum of sub-items. Do not combine with details')
}).describe('Line item. Either simple (details + quantity + unit_price) or itemized (sub_items)');

const clientSchema = z.object({
  name: z.string().describe('Exact name; reused if a client with this name exists, otherwise created'),
  business_number: z.string().optional(),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional()
});

const invoiceFields = {
  project_name: z.string().describe('Project name / invoice title'),
  items: z.array(itemSchema).describe('Line items (at least one)'),
  company_id: z.number().int().optional().describe('Issuing company. Omit to use the default company'),
  client_id: z.number().int().nullable().optional().describe('Existing client ID (from search_clients). Do not combine with client'),
  client: clientSchema.optional().describe('Client to find by exact name or create. Do not combine with client_id'),
  issue_date: z.string().optional().describe('YYYY-MM-DD. Default today'),
  validity_period: z.string().optional().describe('Default "견적일로부터 1개월"'),
  currency: z.enum(api.CURRENCIES).optional().describe('Default KRW'),
  tax_rate: z.number().optional().describe('VAT percent. Default 10; 0 for no VAT'),
  notes: z.array(z.string()).optional().describe('Note texts. Omit for default note templates, [] for none'),
  invoice_number: z.string().optional().describe('Omit to auto-generate')
};

// Run an api.* call and wrap its result (or ApiError) as an MCP tool result
function run(fn) {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(fn(), null, 2) }] };
  } catch (err) {
    if (err instanceof api.ApiError) {
      const text = JSON.stringify({ error: err.message, ...(err.details ? { details: err.details } : {}) }, null, 2);
      return { content: [{ type: 'text', text }], isError: true };
    }
    console.error('MCP tool error:', err);
    return { content: [{ type: 'text', text: 'Internal server error' }], isError: true };
  }
}

// Drop undefined keys so partial updates only touch the fields that were given
const defined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

function buildServer() {
  const server = new McpServer({ name: 'invoice-manager', version }, { instructions: INSTRUCTIONS });
  const readOnly = { readOnlyHint: true, openWorldHint: false };
  const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

  server.registerTool('list_companies', {
    title: 'List issuing companies',
    description: 'List the companies that issue invoices, with their bank accounts. is_default marks the default company.',
    annotations: readOnly
  }, () => run(() => api.listCompanies()));

  server.registerTool('search_clients', {
    title: 'Search clients',
    description: 'Search clients (customers) by partial name or contact person. Omit query to list all.',
    inputSchema: { query: z.string().optional().describe('Partial client name or contact person') },
    annotations: readOnly
  }, ({ query }) => run(() => api.searchClients(query)));

  server.registerTool('create_client', {
    title: 'Create client',
    description: 'Create a client. Fails if a client with the same name exists. Usually unnecessary: create_invoice can create the client via its client field.',
    inputSchema: clientSchema.shape,
    annotations: write
  }, (args) => run(() => api.createClient(defined(args))));

  server.registerTool('list_note_templates', {
    title: 'List note templates',
    description: 'List reusable note texts. Pass their content strings in create_invoice notes. is_default templates are included automatically when notes is omitted.',
    annotations: readOnly
  }, () => run(() => api.listNoteTemplates()));

  server.registerTool('list_invoices', {
    title: 'List invoices',
    description: 'List invoices, newest first. Filter by partial project name / client name / invoice number, and by status.',
    inputSchema: {
      query: z.string().optional(),
      status: z.enum(api.STATUSES).optional(),
      limit: z.number().int().optional().describe('Default 20, max 100'),
      offset: z.number().int().optional()
    },
    annotations: readOnly
  }, (args) => run(() => api.listInvoices(args)));

  server.registerTool('get_invoice', {
    title: 'Get invoice',
    description: 'Get an invoice with all items, sub-items, notes and totals.',
    inputSchema: { id: z.number().int().describe('Invoice ID') },
    annotations: readOnly
  }, ({ id }) => run(() => api.getInvoice(id)));

  server.registerTool('create_invoice', {
    title: 'Create invoice',
    description: 'Create a draft invoice (견적서). Totals are computed by the server. Returns the full invoice including web_url/web_path.',
    inputSchema: invoiceFields,
    annotations: write
  }, (args) => run(() => api.createInvoice(defined(args))));

  server.registerTool('update_invoice', {
    title: 'Update invoice',
    description: 'Update an invoice. Only given fields change. items, if given, replaces ALL items. Totals are recomputed.',
    inputSchema: {
      id: z.number().int().describe('Invoice ID'),
      ...Object.fromEntries(Object.entries(invoiceFields).map(([k, v]) => [k, v.optional()]))
    },
    annotations: { ...write, idempotentHint: true }
  }, ({ id, ...fields }) => run(() => api.updateInvoice(id, defined(fields))));

  server.registerTool('set_invoice_status', {
    title: 'Set invoice status',
    description: 'Set status: draft, confirmed, or discarded. Only confirm when the user explicitly asks.',
    inputSchema: { id: z.number().int(), status: z.enum(api.STATUSES) },
    annotations: { ...write, idempotentHint: true }
  }, ({ id, status }) => run(() => api.setInvoiceStatus(id, status)));

  return server;
}

function requireMcpKey(req, res, next) {
  if (!process.env.API_KEY) {
    return res.status(503).json({ error: 'MCP is disabled. Set API_KEY in .env to enable it.' });
  }
  if (!isValidApiKey(getBearerToken(req) || req.params.key)) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  next();
}

router.post(['/', '/:key'], requireMcpKey, async (req, res) => {
  // Stateless: a fresh server + transport per request
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('MCP request error:', err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  }
});

// Stateless server: no SSE stream or session to delete
router.all(['/', '/:key'], (req, res) => {
  res.status(405).set('Allow', 'POST').json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null });
});

module.exports = router;
