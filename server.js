require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const app = express();

// Catch ALL uncaught errors
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  // Don't crash the server
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
  // Don't crash the server
});

// Database connection with error handling
const mysql = require('mysql2/promise');
let db;

try {
  db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'yxmvmjxp_ardthon',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'yxmvmjxp_ardthonsolutions',
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000,
    charset: 'utf8mb4'
  });
  
  console.log('Database pool created');
} catch(err) {
  console.error('Database pool error:', err);
}

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files - with proper MIME types
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'ardthon_fallback_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 86400000,
    httpOnly: true,
    secure: false // Set to false since cPanel proxy is HTTP internally
  }
}));

app.use(flash());

// Make db available to all routes
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

// ============ ROUTES WITH TRY-CATCH ============

// Homepage
app.get('/', async (req, res, next) => {
  try {
    let featuredProducts = [];
    let latestProjects = [];
    let latestBlogs = [];
    
    if (db) {
      try {
        const [products] = await db.query('SELECT * FROM products WHERE featured = 1 LIMIT 8');
        featuredProducts = products || [];
      } catch(e) { console.error('Products query error:', e.message); }
      
      try {
        const [projects] = await db.query('SELECT * FROM projects WHERE isPublished = 1 ORDER BY createdAt DESC LIMIT 3');
        latestProjects = projects || [];
      } catch(e) { console.error('Projects query error:', e.message); }
      
      try {
        const [blogs] = await db.query("SELECT * FROM blogs WHERE status = 'published' ORDER BY createdAt DESC LIMIT 3");
        latestBlogs = blogs || [];
      } catch(e) { console.error('Blogs query error:', e.message); }
    }
    
    // Parse JSON fields safely
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
  } catch(err) {
    console.error('Homepage error:', err);
    res.render('index', {
      title: 'Ardthon Solutions',
      featuredProducts: [],
      latestProjects: [],
      latestBlogs: []
    });
  }
});

// Static pages (NO database needed)
app.get('/about', (req, res) => {
  res.render('about', { title: 'About Us - Ardthon Solutions' });
});

app.get('/contact', (req, res) => {
  res.render('contact', { title: 'Contact Us - Ardthon Solutions' });
});

app.get('/discord', (req, res) => {
  res.render('discord', { title: 'Join Discord - Ardthon Solutions' });
});

// Auth routes - with error handling
app.get('/auth/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'Login - Ardthon Solutions' });
});

app.get('/auth/register', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/register', { title: 'Register - Ardthon Solutions' });
});

// Products page
app.get('/products', async (req, res) => {
  try {
    let products = [];
    let categories = [];
    
    if (db) {
      try {
        const [prodResult] = await db.query('SELECT * FROM products ORDER BY createdAt DESC');
        products = prodResult || [];
      } catch(e) { console.error('Products error:', e.message); }
      
      try {
        const [catResult] = await db.query('SELECT DISTINCT category FROM products');
        categories = (catResult || []).map(c => c.category);
      } catch(e) { console.error('Categories error:', e.message); }
    }
    
    products.forEach(p => {
      try { p.images = JSON.parse(p.images || '[]'); } catch(e) { p.images = []; }
    });
    
    res.render('products', {
      title: 'Products - Ardthon Solutions',
      products,
      categories,
      currentCategory: req.query.category || '',
      searchQuery: req.query.search || ''
    });
  } catch(err) {
    console.error('Products page error:', err);
    res.render('products', {
      title: 'Products',
      products: [],
      categories: [],
      currentCategory: '',
      searchQuery: ''
    });
  }
});

// Single product
app.get('/products/:slug', async (req, res) => {
  try {
    if (!db) {
      req.flash('error_msg', 'Database not available');
      return res.redirect('/products');
    }
    
    const [products] = await db.query('SELECT * FROM products WHERE slug = ?', [req.params.slug]);
    
    if (!products || products.length === 0) {
      req.flash('error_msg', 'Product not found');
      return res.redirect('/products');
    }
    
    const product = products[0];
    try { product.images = JSON.parse(product.images || '[]'); } catch(e) { product.images = []; }
    try { product.specifications = JSON.parse(product.specifications || '[]'); } catch(e) { product.specifications = []; }
    
    res.render('product-detail', {
      title: `${product.name} - Ardthon Solutions`,
      product,
      relatedProducts: []
    });
  } catch(err) {
    console.error('Product detail error:', err);
    res.redirect('/products');
  }
});

// Projects page
app.get('/projects', async (req, res) => {
  try {
    let projects = [];
    let fields = [];
    
    if (db) {
      try {
        const [projResult] = await db.query('SELECT * FROM projects WHERE isPublished = 1 ORDER BY createdAt DESC');
        projects = projResult || [];
      } catch(e) { console.error('Projects error:', e.message); }
      
      try {
        const [fieldResult] = await db.query('SELECT DISTINCT field FROM projects WHERE isPublished = 1');
        fields = (fieldResult || []).map(f => f.field);
      } catch(e) { console.error('Fields error:', e.message); }
    }
    
    projects.forEach(p => {
      try { p.images = JSON.parse(p.images || '[]'); } catch(e) { p.images = []; }
    });
    
    res.render('projects', {
      title: 'Projects - Ardthon Solutions',
      projects,
      fields,
      currentField: req.query.field || ''
    });
  } catch(err) {
    console.error('Projects page error:', err);
    res.render('projects', { title: 'Projects', projects: [], fields: [], currentField: '' });
  }
});

// Single project
app.get('/projects/:slug', async (req, res) => {
  try {
    if (!db) {
      req.flash('error_msg', 'Database not available');
      return res.redirect('/projects');
    }
    
    const [projects] = await db.query(
      'SELECT * FROM projects WHERE slug = ? AND isPublished = 1',
      [req.params.slug]
    );
    
    if (!projects || projects.length === 0) {
      req.flash('error_msg', 'Project not found');
      return res.redirect('/projects');
    }
    
    const project = projects[0];
    try { project.images = JSON.parse(project.images || '[]'); } catch(e) { project.images = []; }
    try { project.technologies = JSON.parse(project.technologies || '[]'); } catch(e) { project.technologies = []; }
    
    // If CuePay project
    if (project.slug === 'cuepay-pool-automation') {
      return res.render('projects-cuepay', {
        title: 'CuePay - Pool Automation - Ardthon Solutions',
        project
      });
    }
    
    res.render('project-detail', {
      title: `${project.title} - Ardthon Solutions`,
      project
    });
  } catch(err) {
    console.error('Project detail error:', err);
    res.redirect('/projects');
  }
});

// Blog page
app.get('/blog', async (req, res) => {
  try {
    let blogs = [];
    if (db) {
      try {
        const [blogResult] = await db.query(
          "SELECT b.*, u.username FROM blogs b LEFT JOIN users u ON b.authorId = u.id WHERE b.status = 'published' ORDER BY b.createdAt DESC"
        );
        blogs = blogResult || [];
      } catch(e) { console.error('Blog error:', e.message); }
    }
    
    res.render('blog', { title: 'Blog - Ardthon Solutions', blogs });
  } catch(err) {
    console.error('Blog page error:', err);
    res.render('blog', { title: 'Blog', blogs: [] });
  }
});

// Dashboard (must work even without DB)
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  res.render('dashboard', {
    title: 'Dashboard - Ardthon Solutions',
    orders: [],
    userData: req.session.user
  });
});

// Cart
app.get('/orders/cart', (req, res) => {
  const cart = req.session.cart || [];
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  res.render('cart', { title: 'Cart - Ardthon Solutions', cart, total });
});

// Login handler
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!db) {
      req.flash('error_msg', 'System temporarily unavailable');
      return res.redirect('/auth/login');
    }
    
    const bcrypt = require('bcryptjs');
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!users || users.length === 0) {
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
      role: user.role
    };
    
    res.redirect('/dashboard');
  } catch(err) {
    console.error('Login error:', err);
    req.flash('error_msg', 'Login failed. Please try again.');
    res.redirect('/auth/login');
  }
});

// Logout
app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('FINAL ERROR HANDLER:', err.message);
  res.status(500).send('<h1>500 - Server Error</h1><p>Please try again later.</p><a href="/">Go Home</a>');
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Test: http://localhost:${PORT}/`);
});

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
});