const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const app = express();

// MySQL Connection
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

// Test DB
db.getConnection()
  .then(conn => { console.log('MySQL Connected Successfully'); conn.release(); })
  .catch(err => console.error('MySQL Error:', err.message));

// App Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'ardthon_secret_session_2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 86400000 }
}));
app.use(flash());

app.use((req, res, next) => {
  req.db = db;
  res.locals.user = req.session.user || null;
  res.locals.success_msg = req.flash('success_msg') || [];
  res.locals.error_msg = req.flash('error_msg') || [];
  res.locals.cartCount = req.session.cart ? req.session.cart.length : 0;
  res.locals.currentUrl = req.originalUrl;
  res.locals.year = new Date().getFullYear();
  next();
});

// Safe query helper
async function query(sql, params = []) {
  try { const [r] = await db.query(sql, params); return r; }
  catch(e) { console.error('Query error:', e.message); return []; }
}

// ===== ROUTES =====

// Home
app.get('/', async (req, res) => {
  const featuredProducts = await query('SELECT * FROM products WHERE featured = 1 LIMIT 8');
  const latestProjects = await query('SELECT * FROM projects WHERE isPublished = 1 ORDER BY createdAt DESC LIMIT 3');
  const latestBlogs = await query("SELECT * FROM blogs WHERE status = 'published' ORDER BY createdAt DESC LIMIT 3");
  
  featuredProducts.forEach(p => { try { p.images = JSON.parse(p.images || '[]'); } catch(e) { p.images = []; } });
  latestProjects.forEach(p => { try { p.images = JSON.parse(p.images || '[]'); } catch(e) { p.images = []; } });
  
  res.render('index', { title: 'Ardthon Solutions - Connect With Ease', featuredProducts, latestProjects, latestBlogs });
});

// About
app.get('/about', (req, res) => res.render('about', { title: 'About Us' }));
app.get('/contact', (req, res) => res.render('contact', { title: 'Contact Us' }));
app.get('/discord', (req, res) => res.render('discord', { title: 'Discord' }));

// Auth pages
app.get('/auth/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'Login' });
});

app.get('/auth/register', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/register', { title: 'Register' });
});

// Login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const bcrypt = require('bcryptjs');
  const users = await query('SELECT * FROM users WHERE email = ?', [email]);
  
  if (users.length === 0) {
    req.flash('error_msg', 'Invalid credentials');
    return res.redirect('/auth/login');
  }
  
  const match = await bcrypt.compare(password, users[0].password);
  if (!match) {
    req.flash('error_msg', 'Invalid credentials');
    return res.redirect('/auth/login');
  }
  
  req.session.user = { id: users[0].id, username: users[0].username, email: users[0].email, role: users[0].role };
  res.redirect('/dashboard');
});

// Register
app.post('/auth/register', async (req, res) => {
  const { username, email, password, password2, fullName } = req.body;
  const bcrypt = require('bcryptjs');
  
  if (password !== password2) {
    req.flash('error_msg', 'Passwords do not match');
    return res.redirect('/auth/register');
  }
  
  const existing = await query('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
  if (existing.length > 0) {
    req.flash('error_msg', 'Email or username already exists');
    return res.redirect('/auth/register');
  }
  
  const hash = await bcrypt.hash(password, 10);
  await db.query("INSERT INTO users (username, email, password, fullName, role) VALUES (?, ?, ?, ?, 'customer')", [username, email, hash, fullName || '']);
  
  req.flash('success_msg', 'Registered! Please login.');
  res.redirect('/auth/login');
});

// Logout
app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Dashboard
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  res.render('dashboard', { title: 'Dashboard', orders: [], userData: req.session.user });
});

// Products
app.get('/products', async (req, res) => {
  const products = await query('SELECT * FROM products ORDER BY createdAt DESC');
  const cats = await query('SELECT DISTINCT category FROM products');
  products.forEach(p => { try { p.images = JSON.parse(p.images || '[]'); } catch(e) { p.images = []; } });
  res.render('products', { title: 'Products', products, categories: cats.map(c => c.category), currentCategory: '', searchQuery: '' });
});

app.get('/products/:slug', async (req, res) => {
  const products = await query('SELECT * FROM products WHERE slug = ?', [req.params.slug]);
  if (products.length === 0) { req.flash('error_msg', 'Not found'); return res.redirect('/products'); }
  const p = products[0];
  try { p.images = JSON.parse(p.images || '[]'); } catch(e) { p.images = []; }
  try { p.specifications = JSON.parse(p.specifications || '[]'); } catch(e) { p.specifications = []; }
  res.render('product-detail', { title: p.name, product: p, relatedProducts: [] });
});

// Projects
app.get('/projects', async (req, res) => {
  const projects = await query('SELECT * FROM projects WHERE isPublished = 1 ORDER BY createdAt DESC');
  const fields = await query('SELECT DISTINCT field FROM projects WHERE isPublished = 1');
  projects.forEach(p => { try { p.images = JSON.parse(p.images || '[]'); } catch(e) { p.images = []; } });
  res.render('projects', { title: 'Projects', projects, fields: fields.map(f => f.field), currentField: '' });
});

app.get('/projects/:slug', async (req, res) => {
  const projects = await query('SELECT * FROM projects WHERE slug = ? AND isPublished = 1', [req.params.slug]);
  if (projects.length === 0) { req.flash('error_msg', 'Not found'); return res.redirect('/projects'); }
  const p = projects[0];
  try { p.images = JSON.parse(p.images || '[]'); } catch(e) { p.images = []; }
  try { p.technologies = JSON.parse(p.technologies || '[]'); } catch(e) { p.technologies = []; }
  
  if (p.slug === 'cuepay-pool-automation') {
    return res.render('projects-cuepay', { title: 'CuePay - Pool Automation', project: p });
  }
  res.render('project-detail', { title: p.title, project: p });
});

// Blog
app.get('/blog', async (req, res) => {
  const blogs = await query("SELECT b.*, u.username FROM blogs b LEFT JOIN users u ON b.authorId = u.id WHERE b.status = 'published' ORDER BY b.createdAt DESC");
  res.render('blog', { title: 'Blog', blogs });
});

app.get('/blog/:slug', async (req, res) => {
  const blogs = await query("SELECT b.*, u.username FROM blogs b LEFT JOIN users u ON b.authorId = u.id WHERE b.slug = ? AND b.status = 'published'", [req.params.slug]);
  if (blogs.length === 0) { req.flash('error_msg', 'Not found'); return res.redirect('/blog'); }
  await db.query('UPDATE blogs SET views = views + 1 WHERE id = ?', [blogs[0].id]);
  res.render('blog-detail', { title: blogs[0].title, blog: blogs[0] });
});

// Cart
app.get('/orders/cart', (req, res) => {
  const cart = req.session.cart || [];
  const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
  res.render('cart', { title: 'Cart', cart, total });
});

// CuePay pages
app.get('/cuepay/login', (req, res) => res.render('cuepay/login', { title: 'CuePay Login' }));
app.get('/cuepay/dashboard', (req, res) => res.render('cuepay/dashboard', { title: 'CuePay Dashboard', devices: [], user: { name: 'User' } }));
app.get('/cuepay/register-device', (req, res) => res.render('cuepay/register-device', { title: 'Register Device' }));

// 404
app.use((req, res) => res.status(404).render('404', { title: 'Page Not Found' }));

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));