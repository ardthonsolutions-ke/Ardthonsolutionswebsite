require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const app = express();

// Database connection
const mysql = require('mysql2/promise');
const db = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'yxmvmjxp_ardthonuser',
  password: process.env.DB_PASSWORD || 'Ardthonuser254',
  database: process.env.DB_NAME || 'yxmvmjxp_ardthonsolutions',
  port: parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// Test DB
db.getConnection()
  .then(conn => { console.log('MySQL Connected'); conn.release(); })
  .catch(err => console.error('MySQL Error:', err.message));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 86400000, httpOnly: true }
}));
app.use(flash());

// Database middleware
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

// ============================================
// ROUTES
// ============================================

// Homepage
app.get('/', async (req, res) => {
  try {
    let featuredProducts = [];
    let latestProjects = [];
    let latestBlogs = [];

    try {
      const [products] = await db.query('SELECT * FROM products WHERE featured = 1 LIMIT 8');
      featuredProducts = products.map(p => ({
        ...p,
        images: JSON.parse(p.images || '[]'),
        specifications: JSON.parse(p.specifications || '[]')
      }));
    } catch(e) { console.error('Products query error:', e.message); }

    try {
      const [projects] = await db.query('SELECT * FROM projects WHERE isPublished = 1 ORDER BY createdAt DESC LIMIT 3');
      latestProjects = projects.map(p => ({
        ...p,
        images: JSON.parse(p.images || '[]'),
        technologies: JSON.parse(p.technologies || '[]'),
        features: JSON.parse(p.features || '[]')
      }));
    } catch(e) { console.error('Projects query error:', e.message); }

    try {
      const [blogs] = await db.query("SELECT * FROM blogs WHERE status = 'published' ORDER BY createdAt DESC LIMIT 3");
      latestBlogs = blogs;
    } catch(e) { console.error('Blogs query error:', e.message); }

    res.render('index', {
      title: 'Ardthon Solutions - Connect With Ease',
      featuredProducts,
      latestProjects,
      latestBlogs
    });
  } catch(err) {
    console.error('Home error:', err.message);
    res.render('index', {
      title: 'Ardthon Solutions',
      featuredProducts: [],
      latestProjects: [],
      latestBlogs: []
    });
  }
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
  res.render('discord', { title: 'Join Our Discord - Ardthon Solutions' });
});

// Products
app.get('/products', async (req, res) => {
  try {
    const [products] = await db.query('SELECT * FROM products ORDER BY createdAt DESC');
    const [cats] = await db.query('SELECT DISTINCT category FROM products');
    
    const formattedProducts = products.map(p => ({
      ...p,
      images: JSON.parse(p.images || '[]'),
      specifications: JSON.parse(p.specifications || '[]')
    }));

    res.render('products', {
      title: 'Products - Ardthon Solutions',
      products: formattedProducts,
      categories: cats.map(c => c.category),
      currentCategory: req.query.category || '',
      searchQuery: req.query.search || ''
    });
  } catch(err) {
    console.error('Products error:', err.message);
    res.render('products', {
      title: 'Products',
      products: [],
      categories: [],
      currentCategory: '',
      searchQuery: ''
    });
  }
});

// Product Detail
app.get('/products/:slug', async (req, res) => {
  try {
    const [products] = await db.query('SELECT * FROM products WHERE slug = ?', [req.params.slug]);
    
    if (products.length === 0) {
      req.flash('error_msg', 'Product not found');
      return res.redirect('/products');
    }

    const product = {
      ...products[0],
      images: JSON.parse(products[0].images || '[]'),
      specifications: JSON.parse(products[0].specifications || '[]')
    };

    const [related] = await db.query(
      'SELECT * FROM products WHERE category = ? AND id != ? LIMIT 4',
      [product.category, product.id]
    );

    res.render('product-detail', {
      title: `${product.name} - Ardthon Solutions`,
      product,
      relatedProducts: related.map(p => ({
        ...p,
        images: JSON.parse(p.images || '[]')
      }))
    });
  } catch(err) {
    console.error('Product detail error:', err.message);
    res.redirect('/products');
  }
});

// Projects
app.get('/projects', async (req, res) => {
  try {
    const [projects] = await db.query('SELECT * FROM projects WHERE isPublished = 1 ORDER BY createdAt DESC');
    const [fields] = await db.query('SELECT DISTINCT field FROM projects WHERE isPublished = 1');

    const formattedProjects = projects.map(p => ({
      ...p,
      images: JSON.parse(p.images || '[]'),
      technologies: JSON.parse(p.technologies || '[]'),
      features: JSON.parse(p.features || '[]')
    }));

    res.render('projects', {
      title: 'Projects - Ardthon Solutions',
      projects: formattedProjects,
      fields: fields.map(f => f.field),
      currentField: req.query.field || ''
    });
  } catch(err) {
    console.error('Projects error:', err.message);
    res.render('projects', {
      title: 'Projects',
      projects: [],
      fields: [],
      currentField: ''
    });
  }
});

// Project Detail
app.get('/projects/:slug', async (req, res) => {
  try {
    const [projects] = await db.query(
      'SELECT * FROM projects WHERE slug = ? AND isPublished = 1',
      [req.params.slug]
    );

    if (projects.length === 0) {
      req.flash('error_msg', 'Project not found');
      return res.redirect('/projects');
    }

    const project = {
      ...projects[0],
      images: JSON.parse(projects[0].images || '[]'),
      technologies: JSON.parse(projects[0].technologies || '[]'),
      features: JSON.parse(projects[0].features || '[]')
    };

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
    console.error('Project detail error:', err.message);
    res.redirect('/projects');
  }
});

// Blog
app.get('/blog', async (req, res) => {
  try {
    const [blogs] = await db.query(
      "SELECT b.*, u.username FROM blogs b LEFT JOIN users u ON b.authorId = u.id WHERE b.status = 'published' ORDER BY b.createdAt DESC"
    );

    res.render('blog', {
      title: 'Blog - Ardthon Solutions',
      blogs: blogs.map(b => ({ ...b, tags: JSON.parse(b.tags || '[]') }))
    });
  } catch(err) {
    console.error('Blog error:', err.message);
    res.render('blog', { title: 'Blog', blogs: [] });
  }
});

// Blog Detail
app.get('/blog/:slug', async (req, res) => {
  try {
    const [blogs] = await db.query(
      "SELECT b.*, u.username FROM blogs b LEFT JOIN users u ON b.authorId = u.id WHERE b.slug = ? AND b.status = 'published'",
      [req.params.slug]
    );

    if (blogs.length === 0) {
      req.flash('error_msg', 'Blog post not found');
      return res.redirect('/blog');
    }

    await db.query('UPDATE blogs SET views = views + 1 WHERE id = ?', [blogs[0].id]);

    res.render('blog-detail', {
      title: `${blogs[0].title} - Ardthon Solutions`,
      blog: { ...blogs[0], tags: JSON.parse(blogs[0].tags || '[]') }
    });
  } catch(err) {
    console.error('Blog detail error:', err.message);
    res.redirect('/blog');
  }
});

// Auth - Login
app.get('/auth/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'Login - Ardthon Solutions' });
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const bcrypt = require('bcryptjs');
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/auth/login');
    }

    const match = await bcrypt.compare(password, users[0].password);
    if (!match) {
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/auth/login');
    }

    req.session.user = {
      id: users[0].id,
      username: users[0].username,
      email: users[0].email,
      role: users[0].role,
      fullName: users[0].fullName
    };

    req.flash('success_msg', 'Welcome back!');
    res.redirect('/dashboard');
  } catch(err) {
    console.error('Login error:', err.message);
    req.flash('error_msg', 'Login failed');
    res.redirect('/auth/login');
  }
});

// Auth - Register
app.get('/auth/register', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/register', { title: 'Create Account - Ardthon Solutions' });
});

app.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password, password2, fullName } = req.body;
    const bcrypt = require('bcryptjs');

    if (password !== password2) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect('/auth/register');
    }

    const [existing] = await db.query('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
    if (existing.length > 0) {
      req.flash('error_msg', 'Email or username already exists');
      return res.redirect('/auth/register');
    }

    const hash = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (username, email, password, fullName, role) VALUES (?, ?, ?, ?, 'customer')",
      [username, email, hash, fullName || '']
    );

    req.flash('success_msg', 'Registration successful! Please login.');
    res.redirect('/auth/login');
  } catch(err) {
    console.error('Register error:', err.message);
    req.flash('error_msg', 'Registration failed');
    res.redirect('/auth/register');
  }
});

// Logout
app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Dashboard
app.get('/dashboard', async (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');

  try {
    const [orders] = await db.query(
      'SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC LIMIT 10',
      [req.session.user.id]
    );

    const [cuepayDevices] = await db.query(
      'SELECT * FROM cuepay_devices WHERE owner_id = ?',
      [req.session.user.id]
    );

    res.render('dashboard', {
      title: 'Dashboard - Ardthon Solutions',
      orders,
      cuepayDevices,
      userData: req.session.user
    });
  } catch(err) {
    res.render('dashboard', {
      title: 'Dashboard',
      orders: [],
      cuepayDevices: [],
      userData: req.session.user
    });
  }
});

// Cart
app.get('/orders/cart', (req, res) => {
  const cart = req.session.cart || [];
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  res.render('cart', { title: 'Shopping Cart - Ardthon Solutions', cart, total });
});

// Add to Cart
app.post('/products/add-to-cart/:id', async (req, res) => {
  try {
    const [products] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (products.length === 0) return res.status(404).json({ error: 'Not found' });

    const product = products[0];
    if (!req.session.cart) req.session.cart = [];

    const existing = req.session.cart.find(item => item.product == req.params.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      req.session.cart.push({
        product: product.id,
        name: product.name,
        price: product.price,
        image: JSON.parse(product.images || '[]')[0]?.url || '/images/placeholder.jpg',
        quantity: 1
      });
    }

    res.json({ success: true, cartCount: req.session.cart.length });
  } catch(err) {
    res.status(500).json({ error: 'Error adding to cart' });
  }
});

// Checkout
app.get('/orders/checkout', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  const cart = req.session.cart || [];
  if (cart.length === 0) return res.redirect('/products');
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  res.render('checkout', { title: 'Checkout - Ardthon Solutions', cart, total });
});

// CuePay Routes
app.get('/cuepay/login', (req, res) => {
  res.render('cuepay/login', { title: 'CuePay Login - Ardthon Solutions' });
});

app.get('/cuepay/dashboard', async (req, res) => {
  try {
    const [devices] = await db.query('SELECT * FROM cuepay_devices ORDER BY created_at DESC');
    res.render('cuepay/dashboard', {
      title: 'CuePay Dashboard',
      devices,
      user: req.session.cuepayUser || { name: 'Guest' }
    });
  } catch(err) {
    res.render('cuepay/dashboard', {
      title: 'CuePay Dashboard',
      devices: [],
      user: { name: 'Guest' }
    });
  }
});

app.get('/cuepay/register-device', (req, res) => {
  res.render('cuepay/register-device', { title: 'Register CuePay Device' });
});

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).render('error', { title: 'Server Error', message: 'Something went wrong', error: {} });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});