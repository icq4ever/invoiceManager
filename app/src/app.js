const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const { initDatabase } = require('./config/database');
const { i18nMiddleware } = require('./middleware/i18n');

// Routes
const authRoutes = require('./routes/auth');
const backupRoutes = require('./routes/backup');
const companyRoutes = require('./routes/companies');
const clientRoutes = require('./routes/clients');
const templateRoutes = require('./routes/templates');
const invoiceRoutes = require('./routes/invoices');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initDatabase();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Layout configuration
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('layout extractScripts', false);

// i18n middleware
app.use(i18nMiddleware);

// Make user and theme available in all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.theme = req.cookies?.theme || 'light';
  next();
});

// Routes
app.use('/', authRoutes);
app.use('/backup', backupRoutes);
app.use('/companies', companyRoutes);
app.use('/clients', clientRoutes);
app.use('/templates', templateRoutes);
app.use('/invoices', invoiceRoutes);

// Dashboard
app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  const db = require('./config/database').getDatabase();

  const stats = {
    invoices: db.prepare('SELECT COUNT(*) as count FROM invoices').get().count,
    companies: db.prepare('SELECT COUNT(*) as count FROM companies').get().count,
    clients: db.prepare('SELECT COUNT(*) as count FROM clients').get().count,
    recentInvoices: db.prepare(`
      SELECT i.*, c.name as client_name, co.name as company_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN companies co ON i.company_id = co.id
      ORDER BY i.created_at DESC
      LIMIT 5
    `).all()
  };

  res.render('dashboard', { stats });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { message: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found' });
});

app.listen(PORT, () => {
  console.log(`Invoice Manager running on port ${PORT}`);
});
