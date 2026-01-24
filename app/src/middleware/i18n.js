const fs = require('fs');
const path = require('path');

const locales = {};
const supportedLanguages = ['ko', 'en'];
const defaultLanguage = 'ko';

// Load all locale files
supportedLanguages.forEach(lang => {
  const filePath = path.join(__dirname, '../locales', `${lang}.json`);
  if (fs.existsSync(filePath)) {
    locales[lang] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
});

// Get nested value from object
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Translation function
function t(lang, key, params = {}) {
  const translation = getNestedValue(locales[lang], key) || getNestedValue(locales[defaultLanguage], key) || key;

  // Replace parameters
  return translation.replace(/\{\{(\w+)\}\}/g, (_, param) => params[param] || '');
}

// Middleware
function i18nMiddleware(req, res, next) {
  // Get language from cookie, query, or default
  let lang = req.query.lang || req.cookies?.lang || defaultLanguage;

  if (!supportedLanguages.includes(lang)) {
    lang = defaultLanguage;
  }

  // Set language cookie if changed via query
  if (req.query.lang && supportedLanguages.includes(req.query.lang)) {
    res.cookie('lang', req.query.lang, { maxAge: 365 * 24 * 60 * 60 * 1000 }); // 1 year
  }

  // Make translation function available in views
  res.locals.lang = lang;
  res.locals.supportedLanguages = supportedLanguages;
  res.locals.t = (key, params) => t(lang, key, params);
  res.locals.__ = res.locals.t; // Alias

  next();
}

module.exports = { i18nMiddleware, t, supportedLanguages, defaultLanguage };
