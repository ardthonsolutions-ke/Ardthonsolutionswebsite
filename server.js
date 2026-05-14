const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const app = express();

// ===== MySQL DATABASE =====
const mysql = require('mysql2/promise');
const db = mysql.createPool({
  host: '127.0.0.1',
  user: 'yxmvmjxp_ardthonuser',
  password: 'Ardthonuser254',
  database: 'yxmvmjxp_ardthonsolutions',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

db.getConnection()
  .then(conn => { console.log('MySQL Connected'); conn.release(); })
  .catch(err => console.error('MySQL Error:', err.message));

// ===== APP CONFIG =====
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'ardthon_session_secret_2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 86400000, httpOnly: true }
}));
app.use(flash());

// Make db available to routes
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Global variables
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success_msg = req.flash('success_msg') || [];
  res.locals.error_msg = req.flash('error_msg') || [];
  res.locals.cartCount = req.session.cart ? req.session.cart.length : 0;
  res.locals.currentUrl = req.originalUrl;
  res.locals.year = new Date().getFullYear();
  next();
});

// ===== LOAD ROUTES =====
app.use('/auth', require('./routes/auth'));
app.use('/products', require('./routes/products'));
app.use('/projects', require('./routes/projects'));
app.use('/blog', require('./routes/blog'));
app.use('/orders', require('./routes/orders'));
app.use('/upload', require('./routes/upload'));
app.use('/cuepay', require('./routes/cuepay'));
app.use('/', require('./routes/pages'));

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('ERROR:', err.message);
  res.status(500).render('error', { title: 'Error', message: 'Server Error', error: {} });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});