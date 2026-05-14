// server.js - NO dotenv required, hardcoded config for cPanel
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const app = express();

// ===== DATABASE CONFIG (Hardcoded for cPanel) =====
const mysql = require('mysql2/promise');
const db = mysql.createPool({
  host: '127.0.0.1',        // FORCE IPv4 - this is the key fix!
  user: 'yxmvmjxp_ardthon',
  password: 'YOUR_CPANEL_MYSQL_PASSWORD_HERE',  // CHANGE THIS!
  database: 'yxmvmjxp_ardthonsolutions',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// Test DB connection
db.getConnection()
  .then(conn => {
    console.log('MySQL Connected Successfully');
    conn.release();
  })
  .catch(err => {
    console.error('MySQL Connection Error:', err.message);
    console.log('Server will run WITHOUT database');
  });

// ===== APP CONFIG =====
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'ardthon_secure_session_key_2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 86400000, httpOnly: true }
}));
app.use(flash());

// Make db available
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
  res.locals.appName = 'Ardthon Solutions';
  res.locals.year = new Date().getFullYear();
  next();
});

// ===== HELPER: Safe DB query =====
async function safeQuery(query, params = []) {
  try {
    const [result] = await db.query(query, params);
    return result;
  } catch(err) {
    console.error('Query error:', err.message);
    return [];
  }
}

// ===== ROUTES =====

// Homepage
app.get('/', async (req, res) => {
  let featuredProducts = [];
  let latestProjects = [];
  let latestBlogs = [];

  featuredProducts = await safeQuery('SELECT * FROM products WHERE featured = 1 LIMIT 8');
  latestProjects = await safeQuery('SELECT * FROM projects WHERE isPublished = 1 ORDER BY createdAt DESC LIMIT 3');
  latestBlogs = await safeQuery("SELECT * FROM blogs WHERE status = 'published' ORDER BY createdAt DESC LIMIT 3");

  featuredProducts.forEach(p => {
    try { p.images = JSON.parse(p.images || '[]'); } catch(e) { p.images = []; }
  });
  latestProjects.forEach(p => {
    try { p.images = JSON.parse(p.images || '[]'); } catch(e) { p.images = []; }
  });

  res.render('index', {
    title: 'Ardthon Solutions - Connect With Ease',
    featuredProducts,
    latestProjects,
    latestBlogs
  });
});

// About
app.get('/about', (req, res) => {
  res.render('about', { title: 'About Us - Ardthon Solutions' });
});

// Contact
app.get('/contact', (req, res) => {
  res.render('contact', { title: 'Contact Us - Ardthon Solutions' });
});

// Discord
app.get('/discord', (req, res) => {
  res.render('discord', { title: 'Join Discord - Ardthon Solutions' });
});

// Auth pages
app.get('/auth/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'Login - Ardthon Solutions' });
});

app.get('/auth/register', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/register', { title: 'Register - Ardthon Solutions' });
});

// Login POST
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const bcrypt = require('bcryptjs');
    
    const users = await safeQuery('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/auth/login');
    }
    
    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/auth/login');
    }
    
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.fullName
    };
    
    req.flash('success_msg', 'Welcome back!');
    res.redirect('/dashboard');
  } catch(err) {
    console.error('Login error:', err);
    req.flash('error_msg', 'Login failed');
    res.redirect('/auth/login');
  }
});

// Register POST
app.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password, password2, fullName } = req.body;
    const bcrypt = require('bcryptjs');
    
    if (password !== password2) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect('/auth/register');
    }
    
    const existing = await safeQuery('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
    
    if (existing.length > 0) {
      req.flash('error_msg', 'Email or username already registered');
      return res.redirect('/auth/register');
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await db.query(
      "INSERT INTO users (username, email, password, fullName, role) VALUES (?, ?, ?, ?, 'customer')",
      [username, email, hashedPassword, fullName || '']
    );
    
    req.flash('success_msg', 'Registration successful! Please login.');
    res.redirect('/auth/login');
  } catch(err) {
    console.error('Register error:', err);
    req.flash('error_msg', 'Registration failed');
    res.redirect('/auth/register');
  }
});

// Logout
app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Dashboard
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  res.render('dashboard', {
    title: 'Dashboard - Ardthon Solutions',
    orders: [],
    userData: req.session.user
  });
});

// Products
app.get('/products', async (req, res) => {
  const products = await safeQuery('SELECT * FROM products ORDER BY createdAt DESC');
  const categories = await safeQuery('SELECT DISTINCT category FROM products');
  
  products.forEach(p => {
    try { p.images = JSON.parse(p.images || '[]'); } catch(e) { p.images = []; }
  });

  res.render('products', {
    title: 'Products - Ardthon Solutions',
    products,
    categories: categories.map(c => c.category),
    currentCategory: req.query.category || '',
    searchQuery: req.query.search || ''
  });
});

// Product detail
app.get('/products/:slug', async (req, res) => {
  const products = await safeQuery('SELECT * FROM products WHERE slug = ?', [req.params.slug]);
  
  if (products.length === 0) {
    req.flash('error_msg', 'Product not found');
    return res.redirect('/products');
  }
  
  const product = products[0];
  try { product.images = JSON.parse(product.images || '[]'); } catch(e) { product.images = []; }
  try { product.specifications = JSON.parse(product.specifications || '[]'); } catch(e) { product.specifications = []; }
  
  res.render('product-detail', {
    title: product.name + ' - Ardthon Solutions',
    product,
    relatedProducts: []
  });
});

// Projects
app.get('/projects', async (req, res) => {
  const projects = await safeQuery('SELECT * FROM projects WHERE isPublished = 1 ORDER BY createdAt DESC');
  const fields = await safeQuery('SELECT DISTINCT field FROM projects WHERE isPublished = 1');
  
  projects.forEach(p => {
    try { p.images = JSON.parse(p.images || '[]'); } catch(e) { p.images = []; }
    try { p.technologies = JSON.parse(p.technologies || '[]'); } catch(e) { p.technologies = []; }
  });

  res.render('projects', {
    title: 'Projects - Ardthon Solutions',
    projects,
    fields: fields.map(f => f.field),
    currentField: req.query.field || ''
  });
});

// Project detail
app.get('/projects/:slug', async (req, res) => {
  const projects = await safeQuery(
    'SELECT * FROM projects WHERE slug = ? AND isPublished = 1',
    [req.params.slug]
  );
  
  if (projects.length === 0) {
    req.flash('error_msg', 'Project not found');
    return res.redirect('/projects');
  }
  
  const project = projects[0];
  try { project.images = JSON.parse(project.images || '[]'); } catch(e) { project.images = []; }
  try { project.technologies = JSON.parse(project.technologies || '[]'); } catch(e) { project.technologies = []; }
  try { project.features = JSON.parse(project.features || '[]'); } catch(e) { project.features = []; }
  
  if (project.slug === 'cuepay-pool-automation') {
    return res.render('projects-cuepay', {
      title: 'CuePay - Pool Automation',
      project
    });
  }
  
  res.render('project-detail', {
    title: project.title + ' - Ardthon Solutions',
    project
  });
});

// Blog
app.get('/blog', async (req, res) => {
  const blogs = await safeQuery(
    "SELECT b.*, u.username FROM blogs b LEFT JOIN users u ON b.authorId = u.id WHERE b.status = 'published' ORDER BY b.createdAt DESC"
  );
  res.render('blog', { title: 'Blog - Ardthon Solutions', blogs });
});

// Blog detail
app.get('/blog/:slug', async (req, res) => {
  const blogs = await safeQuery(
    "SELECT b.*, u.username FROM blogs b LEFT JOIN users u ON b.authorId = u.id WHERE b.slug = ? AND b.status = 'published'",
    [req.params.slug]
  );
  
  if (blogs.length === 0) {
    req.flash('error_msg', 'Blog post not found');
    return res.redirect('/blog');
  }
  
  await db.query('UPDATE blogs SET views = views + 1 WHERE id = ?', [blogs[0].id]);
  
  res.render('blog-detail', {
    title: blogs[0].title + ' - Ardthon Solutions',
    blog: blogs[0]
  });
});

// Cart
app.get('/orders/cart', (req, res) => {
  const cart = req.session.cart || [];
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  res.render('cart', { title: 'Cart - Ardthon Solutions', cart, total });
});

// Add to cart
app.post('/products/add-to-cart/:id', async (req, res) => {
  const products = await safeQuery('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (products.length === 0) return res.status(404).json({ error: 'Not found' });
  
  const product = products[0];
  try { product.images = JSON.parse(product.images || '[]'); } catch(e) { product.images = []; }
  
  if (!req.session.cart) req.session.cart = [];
  
  const existing = req.session.cart.find(item => item.product == req.params.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    req.session.cart.push({
      product: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0]?.url || '/images/placeholder.jpg',
      quantity: 1
    });
  }
  
  res.json({ success: true, cartCount: req.session.cart.length });
});

// CuePay pages
app.get('/cuepay/login', (req, res) => {
  res.render('cuepay/login', { title: 'CuePay Login' });
});

app.get('/cuepay/dashboard', (req, res) => {
  res.render('cuepay/dashboard', {
    title: 'CuePay Dashboard',
    devices: [],
    user: { name: 'User' }
  });
});

app.get('/cuepay/register-device', (req, res) => {
  res.render('cuepay/register-device', { title: 'Register Device' });
});

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('ERROR:', err.message);
  res.status(500).render('error', {
    title: 'Error',
    message: 'Something went wrong',
    error: {}
  });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log('Ardthon Solutions Server Running');
  console.log('Port: ' + PORT);
  console.log('URL: http://localhost:' + PORT);
  console.log('========================================');
});