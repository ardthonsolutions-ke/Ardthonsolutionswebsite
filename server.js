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


// CuePay Dashboard (requires auth) - FIXED
app.get('/cuepay/dashboard', isCuePayAuth, async (req, res) => {
  try {
    const userId = req.session.cuepayUser.id;
    
    // ONLY get devices belonging to THIS user
    const [devices] = await db.query(
      'SELECT * FROM cuepay_devices WHERE owner_id = ? ORDER BY created_at DESC',
      [userId]
    );
    
    // Calculate battery percentage and time ago for each device
    devices.forEach(device => {
      device.battery_percent = device.battery_voltage ? 
        Math.round(((device.battery_voltage - 10.5) / (12.6 - 10.5)) * 100) : 0;
      device.battery_percent = Math.max(0, Math.min(100, device.battery_percent));
      device.is_online = device.status === 'online';
    });
    
    res.render('cuepay/dashboard', {
      title: 'CuePay Dashboard - Ardthon Solutions',
      devices,
      user: req.session.cuepayUser
    });
  } catch(err) {
    console.error('CuePay dashboard error:', err);
    res.render('cuepay/dashboard', {
      title: 'CuePay Dashboard',
      devices: [],
      user: req.session.cuepayUser
    });
  }
});

app.get('/cuepay/register-device', (req, res) => {
  res.render('cuepay/register-device', { title: 'Register CuePay Device' });
});

// ============================================
// CUEPAY COMPLETE SYSTEM
// ============================================

const crypto = require('crypto');

// Generate unique API key
function generateApiKey() {
  return 'CP-' + crypto.randomBytes(16).toString('hex');
}

// CuePay middleware
function isCuePayAuth(req, res, next) {
  if (req.session.cuepayUser) return next();
  req.flash('error_msg', 'Please login to CuePay first');
  res.redirect('/cuepay/login');
}

// CuePay device API auth middleware
async function validateDeviceApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const deviceId = req.headers['x-device-id'];
  
  if (!apiKey || !deviceId) {
    return res.status(401).json({ error: 'Missing credentials. Send x-api-key and x-device-id headers' });
  }
  
  try {
    const [devices] = await db.query(
      'SELECT * FROM cuepay_devices WHERE device_id = ? AND api_key = ?',
      [deviceId, apiKey]
    );
    
    if (devices.length === 0) {
      return res.status(401).json({ error: 'Invalid device credentials' });
    }
    
    req.cuepayDevice = devices[0];
    next();
  } catch(err) {
    res.status(500).json({ error: 'Authentication error' });
  }
}

// ===== CUEPAY WEB PAGES =====

// CuePay main landing page
app.get('/cuepay', (req, res) => {
  res.render('cuepay/login', { title: 'CuePay - Pool Automation System' });
});

// CuePay Login page
app.get('/cuepay/login', (req, res) => {
  if (req.session.cuepayUser) return res.redirect('/cuepay/dashboard');
  res.render('cuepay/login', { title: 'CuePay Login - Ardthon Solutions' });
});

// CuePay Login handler
app.post('/cuepay/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const bcrypt = require('bcryptjs');
    
    const [users] = await db.query('SELECT * FROM cuepay_users WHERE email = ? AND is_active = 1', [email]);
    
    if (users.length === 0) {
      req.flash('error_msg', 'Invalid CuePay credentials');
      return res.redirect('/cuepay/login');
    }
    
    const user = users[0];
    const match = await bcrypt.compare(password, user.password);
    
    if (!match) {
      req.flash('error_msg', 'Invalid CuePay credentials');
      return res.redirect('/cuepay/login');
    }
    
    req.session.cuepayUser = {
      id: user.id,
      email: user.email,
      name: user.full_name,
      business: user.business_name
    };
    
    req.flash('success_msg', 'Welcome to CuePay!');
    res.redirect('/cuepay/dashboard');
  } catch(err) {
    console.error('CuePay login error:', err);
    req.flash('error_msg', 'Login failed');
    res.redirect('/cuepay/login');
  }
});

// CuePay Register page
app.get('/cuepay/register', (req, res) => {
  if (req.session.cuepayUser) return res.redirect('/cuepay/dashboard');
  res.render('cuepay/register', { title: 'Create CuePay Account' });
});

// CuePay Register handler
app.post('/cuepay/register', async (req, res) => {
  try {
    const { email, password, password2, full_name, business_name, phone } = req.body;
    const bcrypt = require('bcryptjs');
    
    if (password !== password2) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect('/cuepay/register');
    }
    
    if (password.length < 6) {
      req.flash('error_msg', 'Password must be at least 6 characters');
      return res.redirect('/cuepay/register');
    }
    
    const [existing] = await db.query('SELECT id FROM cuepay_users WHERE email = ?', [email]);
    if (existing.length > 0) {
      req.flash('error_msg', 'Email already registered');
      return res.redirect('/cuepay/register');
    }
    
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO cuepay_users (email, password, full_name, business_name, phone) VALUES (?, ?, ?, ?, ?)',
      [email, hash, full_name || '', business_name || '', phone || '']
    );
    
    req.flash('success_msg', 'CuePay account created! Please login.');
    res.redirect('/cuepay/login');
  } catch(err) {
    console.error('CuePay register error:', err);
    req.flash('error_msg', 'Registration failed');
    res.redirect('/cuepay/register');
  }
});

// CuePay Logout
app.get('/cuepay/logout', (req, res) => {
  delete req.session.cuepayUser;
  res.redirect('/cuepay/login');
});

// CuePay Dashboard (requires auth)
app.get('/cuepay/dashboard', isCuePayAuth, async (req, res) => {
  try {
    const userId = req.session.cuepayUser.id;
    
    const [devices] = await db.query(
      'SELECT * FROM cuepay_devices WHERE owner_id = ? ORDER BY created_at DESC',
      [userId]
    );
    
    // Calculate battery percentage and time ago for each device
    devices.forEach(device => {
      device.battery_percent = device.battery_voltage ? 
        Math.round(((device.battery_voltage - 10.5) / (12.6 - 10.5)) * 100) : 0;
      device.battery_percent = Math.max(0, Math.min(100, device.battery_percent));
      device.is_online = device.status === 'online';
    });
    
    res.render('cuepay/dashboard', {
      title: 'CuePay Dashboard - Ardthon Solutions',
      devices,
      user: req.session.cuepayUser
    });
  } catch(err) {
    console.error('CuePay dashboard error:', err);
    res.render('cuepay/dashboard', {
      title: 'CuePay Dashboard',
      devices: [],
      user: req.session.cuepayUser
    });
  }
});

// Register new device page
app.get('/cuepay/register-device', isCuePayAuth, (req, res) => {
  res.render('cuepay/register-device', { title: 'Register New CuePay Device' });
});

// Register new device handler
app.post('/cuepay/register-device', isCuePayAuth, async (req, res) => {
  try {
    const { device_name, location, game_price } = req.body;
    const ownerId = req.session.cuepayUser.id;
    
    // Generate unique device ID and API key
    const deviceId = 'CUEPAY-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const apiKey = generateApiKey();
    
    await db.query(
      `INSERT INTO cuepay_devices (device_id, device_name, api_key, owner_id, location_area, game_price, status)
       VALUES (?, ?, ?, ?, ?, ?, 'offline')`,
      [deviceId, device_name, apiKey, ownerId, location, game_price || 10]
    );
    
    // Store credentials in session to show once
    req.session.newDevice = {
      device_id: deviceId,
      device_name: device_name,
      api_key: apiKey
    };
    
    req.flash('success_msg', 'Device registered successfully!');
    res.redirect('/cuepay/device-credentials');
  } catch(err) {
    console.error('Device registration error:', err);
    req.flash('error_msg', 'Failed to register device');
    res.redirect('/cuepay/register-device');
  }
});

// Device credentials page (shown once after registration)
app.get('/cuepay/device-credentials', isCuePayAuth, (req, res) => {
  const device = req.session.newDevice;
  if (!device) return res.redirect('/cuepay/dashboard');
  
  // Clear from session after showing
  delete req.session.newDevice;
  
  res.render('cuepay/device-credentials', {
    title: 'Device Credentials - CuePay',
    device
  });
});

// Device detail page - FIXED
app.get('/cuepay/device/:deviceId', isCuePayAuth, async (req, res) => {
  try {
    const userId = req.session.cuepayUser.id;
    const { deviceId } = req.params;
    
    // ONLY get device if it belongs to THIS user
    const [devices] = await db.query(
      'SELECT * FROM cuepay_devices WHERE device_id = ? AND owner_id = ?',
      [deviceId, userId]
    );
    
    if (devices.length === 0) {
      req.flash('error_msg', 'Device not found or access denied');
      return res.redirect('/cuepay/dashboard');
    }
    
    const device = devices[0];
    device.battery_percent = device.battery_voltage ? 
      Math.round(((device.battery_voltage - 10.5) / (12.6 - 10.5)) * 100) : 0;
    device.battery_percent = Math.max(0, Math.min(100, device.battery_percent));
    
    // Get recent payments
    const [payments] = await db.query(
      'SELECT * FROM cuepay_payments WHERE device_id = ? ORDER BY payment_time DESC LIMIT 50',
      [deviceId]
    );
    
    // Get pending commands
    const [commands] = await db.query(
      "SELECT * FROM cuepay_commands WHERE device_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 10",
      [deviceId]
    );
    
    res.render('cuepay/device-detail', {
      title: `${device.device_name} - CuePay`,
      device,
      payments,
      commands
    });
  } catch(err) {
    console.error('Device detail error:', err);
    res.redirect('/cuepay/dashboard');
  }
});

// Send command to device - FIXED
app.post('/cuepay/device/:deviceId/command', isCuePayAuth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { command_type, command_value } = req.body;
    const userId = req.session.cuepayUser.id;
    
    // Verify device belongs to THIS user
    const [devices] = await db.query(
      'SELECT id FROM cuepay_devices WHERE device_id = ? AND owner_id = ?',
      [deviceId, userId]
    );
    
    if (devices.length === 0) {
      req.flash('error_msg', 'Device not found or access denied');
      return res.redirect('/cuepay/dashboard');
    }
    
    // Insert command
    await db.query(
      "INSERT INTO cuepay_commands (device_id, command_type, command_value, status) VALUES (?, ?, ?, 'pending')",
      [deviceId, command_type, command_value]
    );
    
    // If command is change_price, update the device price immediately
    if (command_type === 'change_price') {
      await db.query(
        'UPDATE cuepay_devices SET game_price = ? WHERE device_id = ? AND owner_id = ?',
        [parseFloat(command_value), deviceId, userId]
      );
    }
    
    req.flash('success_msg', `Command sent! Device will update on next sync.`);
    res.redirect(`/cuepay/device/${deviceId}`);
  } catch(err) {
    console.error('Command error:', err);
    req.flash('error_msg', 'Failed to send command');
    res.redirect(`/cuepay/device/${req.params.deviceId}`);
  }
});

// ===== CUEPAY API ENDPOINTS (For ESP32 devices) =====

// Device sync endpoint - Called by ESP32
app.post('/cuepay/api/sync', validateDeviceApiKey, async (req, res) => {
  try {
    const device = req.cuepayDevice;
    const data = req.body;
    
    // Update device live data
    await db.query(
      `UPDATE cuepay_devices SET 
        status = 'online',
        battery_voltage = ?,
        gsm_connected = ?,
        games_available = ?,
        total_revenue = ?,
        today_revenue = ?,
        today_games = ?,
        last_sync = NOW()
       WHERE device_id = ?`,
      [
        data.battery_voltage || 0,
        data.gsm_connected ? 1 : 0,
        data.games_available || 0,
        data.total_revenue || 0,
        data.today_revenue || 0,
        data.today_games || 0,
        device.device_id
      ]
    );
    
    // Save payments
    if (data.recent_payments && Array.isArray(data.recent_payments)) {
      for (const payment of data.recent_payments) {
        if (payment.transaction_id) {
          await db.query(
            `INSERT IGNORE INTO cuepay_payments (device_id, transaction_id, amount, customer_number, games_earned)
             VALUES (?, ?, ?, ?, ?)`,
            [device.device_id, payment.transaction_id, payment.amount, payment.customer, payment.games]
          );
        }
      }
    }
    
    // Get pending commands
    const [commands] = await db.query(
      "SELECT * FROM cuepay_commands WHERE device_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 5",
      [device.device_id]
    );
    
    // Mark commands as sent
    if (commands.length > 0) {
      const commandIds = commands.map(c => c.id);
      await db.query(
        "UPDATE cuepay_commands SET status = 'sent' WHERE id IN (?)",
        [commandIds]
      );
    }
    
    // Get current device settings
    const [currentDevice] = await db.query(
      'SELECT game_price FROM cuepay_devices WHERE device_id = ?',
      [device.device_id]
    );
    
    res.json({
      status: 'success',
      message: 'Sync complete',
      timestamp: new Date().toISOString(),
      commands: commands.map(c => ({
        type: c.command_type,
        value: c.command_value
      })),
      current_price: currentDevice[0]?.game_price || 10
    });
  } catch(err) {
    console.error('CuePay sync error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Get device status (for device to check if it should be online)
app.get('/cuepay/api/device-status', validateDeviceApiKey, async (req, res) => {
  const [commands] = await db.query(
    "SELECT * FROM cuepay_commands WHERE device_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 5",
    [req.cuepayDevice.device_id]
  );
  
  const [device] = await db.query(
    'SELECT game_price FROM cuepay_devices WHERE device_id = ?',
    [req.cuepayDevice.device_id]
  );
  
  res.json({
    status: 'ok',
    game_price: device[0]?.game_price || 10,
    pending_commands: commands
  });
});

// ============================================
// CUEPAY ANALYTICS & ENHANCED DASHBOARD
// ============================================

// Helper: Get device stats for date range
async function getDeviceStats(deviceId, startDate, endDate) {
  const [stats] = await db.query(
    `SELECT 
      COUNT(*) as total_payments,
      COALESCE(SUM(games_earned), 0) as total_games,
      COALESCE(SUM(amount), 0) as total_revenue,
      COALESCE(AVG(amount), 0) as avg_payment,
      COUNT(DISTINCT customer_number) as unique_customers,
      MIN(payment_time) as first_payment,
      MAX(payment_time) as last_payment
     FROM cuepay_payments 
     WHERE device_id = ? AND payment_time >= ? AND payment_time <= ?`,
    [deviceId, startDate, endDate]
  );
  return stats[0];
}

// Helper: Get peak hour
async function getPeakHour(deviceId, date) {
  const [hours] = await db.query(
    `SELECT HOUR(payment_time) as hour, COUNT(*) as count, SUM(amount) as revenue
     FROM cuepay_payments 
     WHERE device_id = ? AND DATE(payment_time) = ?
     GROUP BY HOUR(payment_time)
     ORDER BY count DESC LIMIT 1`,
    [deviceId, date]
  );
  return hours[0] || null;
}

// Enhanced CuePay Dashboard with Analytics
app.get('/cuepay/dashboard', isCuePayAuth, async (req, res) => {
  try {
    const userId = req.session.cuepayUser.id;
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const [devices] = await db.query(
      'SELECT * FROM cuepay_devices WHERE owner_id = ? ORDER BY created_at DESC',
      [userId]
    );

    // Enrich each device with stats
    for (let device of devices) {
      device.battery_percent = device.battery_voltage ? 
        Math.round(((device.battery_voltage - 10.5) / (12.6 - 10.5)) * 100) : 0;
      device.battery_percent = Math.max(0, Math.min(100, device.battery_percent));
      device.is_online = device.status === 'online';

      // Today stats
      const todayStats = await getDeviceStats(device.device_id, today + ' 00:00:00', today + ' 23:59:59');
      device.today_games = todayStats.total_games;
      device.today_revenue = todayStats.total_revenue;
      device.today_payments = todayStats.total_payments;
      device.today_customers = todayStats.unique_customers;

      // Week stats
      const weekStats = await getDeviceStats(device.device_id, weekAgo + ' 00:00:00', today + ' 23:59:59');
      device.week_games = weekStats.total_games;
      device.week_revenue = weekStats.total_revenue;
      device.week_avg_payment = weekStats.avg_payment;

      // Month stats
      const monthStats = await getDeviceStats(device.device_id, monthAgo + ' 00:00:00', today + ' 23:59:59');
      device.month_games = monthStats.total_games;
      device.month_revenue = monthStats.total_revenue;

      // Peak hour today
      const peak = await getPeakHour(device.device_id, today);
      device.peak_hour = peak ? peak.hour : null;
      device.peak_hour_count = peak ? peak.count : 0;

      // Daily breakdown for chart (last 7 days)
      const [dailyBreakdown] = await db.query(
        `SELECT DATE(payment_time) as date, 
                SUM(amount) as revenue, 
                SUM(games_earned) as games,
                COUNT(*) as payments
         FROM cuepay_payments 
         WHERE device_id = ? AND payment_time >= ?
         GROUP BY DATE(payment_time)
         ORDER BY date DESC LIMIT 7`,
        [device.device_id, weekAgo + ' 00:00:00']
      );
      device.daily_breakdown = dailyBreakdown.reverse();

      // Last 10 payments
      const [recentPayments] = await db.query(
        'SELECT * FROM cuepay_payments WHERE device_id = ? ORDER BY payment_time DESC LIMIT 10',
        [device.device_id]
      );
      device.recent_payments = recentPayments;
    }

    res.render('cuepay/dashboard', {
      title: 'CuePay Dashboard - Ardthon Solutions',
      devices,
      user: req.session.cuepayUser
    });
  } catch(err) {
    console.error('Dashboard error:', err);
    res.render('cuepay/dashboard', {
      title: 'CuePay Dashboard',
      devices: [],
      user: req.session.cuepayUser
    });
  }
});

// Device Detail with Full Analytics
app.get('/cuepay/device/:deviceId', isCuePayAuth, async (req, res) => {
  try {
    const userId = req.session.cuepayUser.id;
    const { deviceId } = req.params;
    const { period } = req.query; // day, week, month

    const [devices] = await db.query(
      'SELECT * FROM cuepay_devices WHERE device_id = ? AND owner_id = ?',
      [deviceId, userId]
    );

    if (devices.length === 0) {
      req.flash('error_msg', 'Device not found');
      return res.redirect('/cuepay/dashboard');
    }

    const device = devices[0];
    device.battery_percent = device.battery_voltage ? 
      Math.round(((device.battery_voltage - 10.5) / (12.6 - 10.5)) * 100) : 0;

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthStart = new Date().toISOString().split('T')[0].substring(0, 7) + '-01';

    // Today stats
    const todayStats = await getDeviceStats(deviceId, today + ' 00:00:00', today + ' 23:59:59');

    // Week stats
    const weekStats = await getDeviceStats(deviceId, weekAgo + ' 00:00:00', today + ' 23:59:59');

    // Month stats
    const monthStats = await getDeviceStats(deviceId, monthStart + ' 00:00:00', today + ' 23:59:59');

    // Hourly breakdown for today
    const [hourlyBreakdown] = await db.query(
      `SELECT HOUR(payment_time) as hour, 
              SUM(amount) as revenue, 
              SUM(games_earned) as games,
              COUNT(*) as payments,
              COUNT(DISTINCT customer_number) as customers
       FROM cuepay_payments 
       WHERE device_id = ? AND DATE(payment_time) = ?
       GROUP BY HOUR(payment_time)
       ORDER BY hour`,
      [deviceId, today]
    );

    // Daily breakdown for last 30 days
    const [dailyBreakdown] = await db.query(
      `SELECT DATE(payment_time) as date,
              SUM(amount) as revenue,
              SUM(games_earned) as games,
              COUNT(*) as payments,
              COUNT(DISTINCT customer_number) as customers
       FROM cuepay_payments 
       WHERE device_id = ? AND payment_time >= ?
       GROUP BY DATE(payment_time)
       ORDER BY date DESC`,
      [deviceId, new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0] + ' 00:00:00']
    );

    // Weekly summary
    const [weeklySummary] = await db.query(
      `SELECT YEARWEEK(payment_time, 1) as yw,
              MIN(DATE(payment_time)) as week_start,
              MAX(DATE(payment_time)) as week_end,
              SUM(amount) as revenue,
              SUM(games_earned) as games,
              COUNT(*) as payments
       FROM cuepay_payments 
       WHERE device_id = ? AND payment_time >= ?
       GROUP BY YEARWEEK(payment_time, 1)
       ORDER BY yw DESC LIMIT 12`,
      [deviceId, new Date(Date.now() - 84 * 86400000).toISOString().split('T')[0] + ' 00:00:00']
    );

    // Top customers
    const [topCustomers] = await db.query(
      `SELECT customer_number,
              COUNT(*) as visits,
              SUM(amount) as total_spent,
              SUM(games_earned) as total_games,
              MAX(payment_time) as last_visit
       FROM cuepay_payments 
       WHERE device_id = ? AND customer_number != 'Unknown'
       GROUP BY customer_number
       ORDER BY total_spent DESC LIMIT 10`,
      [deviceId]
    );

    // Recent payments
    const [payments] = await db.query(
      'SELECT * FROM cuepay_payments WHERE device_id = ? ORDER BY payment_time DESC LIMIT 50',
      [deviceId]
    );

    // Pending commands
    const [commands] = await db.query(
      "SELECT * FROM cuepay_commands WHERE device_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 10",
      [deviceId]
    );

    res.render('cuepay/device-detail', {
      title: `${device.device_name} - CuePay Analytics`,
      device,
      todayStats,
      weekStats,
      monthStats,
      hourlyBreakdown,
      dailyBreakdown,
      weeklySummary,
      topCustomers,
      payments,
      commands,
      selectedPeriod: period || 'today'
    });
  } catch(err) {
    console.error('Device detail error:', err);
    res.redirect('/cuepay/dashboard');
  }
});

// API: Get device analytics JSON
app.get('/cuepay/api/analytics/:deviceId', isCuePayAuth, async (req, res) => {
  try {
    const userId = req.session.cuepayUser.id;
    const { deviceId } = req.params;

    // Verify ownership
    const [devices] = await db.query(
      'SELECT id FROM cuepay_devices WHERE device_id = ? AND owner_id = ?',
      [deviceId, userId]
    );
    if (devices.length === 0) return res.status(403).json({ error: 'Access denied' });

    const today = new Date().toISOString().split('T')[0];

    // Hourly breakdown
    const [hourly] = await db.query(
      `SELECT HOUR(payment_time) as hour, SUM(amount) as revenue, SUM(games_earned) as games, COUNT(*) as payments
       FROM cuepay_payments WHERE device_id = ? AND DATE(payment_time) = ?
       GROUP BY HOUR(payment_time) ORDER BY hour`,
      [deviceId, today]
    );

    // Daily breakdown (7 days)
    const [daily] = await db.query(
      `SELECT DATE(payment_time) as date, SUM(amount) as revenue, SUM(games_earned) as games
       FROM cuepay_payments WHERE device_id = ? AND payment_time >= ?
       GROUP BY DATE(payment_time) ORDER BY date DESC LIMIT 7`,
      [deviceId, new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0] + ' 00:00:00']
    );

    res.json({ hourly: hourly.reverse(), daily: daily.reverse() });
  } catch(err) {
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// ============================================
// CUE PAY COMPLETE ANALYTICS & MANAGEMENT
// ============================================

// Helper: Calculate customer retention
async function getCustomerRetention(deviceId, days) {
  const [result] = await db.query(
    `SELECT 
      COUNT(DISTINCT customer_number) as total_customers,
      COUNT(DISTINCT CASE WHEN visits >= 2 THEN customer_number END) as returning_customers,
      COUNT(DISTINCT CASE WHEN visits = 1 THEN customer_number END) as new_customers
     FROM (
       SELECT customer_number, COUNT(*) as visits
       FROM cuepay_payments 
       WHERE device_id = ? AND payment_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND customer_number != 'Unknown'
       GROUP BY customer_number
     ) t`,
    [deviceId, days]
  );
  return result[0];
}

// ===== FINANCIAL REPORTS =====

// Daily Summary Report
app.get('/cuepay/reports/daily', isCuePayAuth, async (req, res) => {
  try {
    const userId = req.session.cuepayUser.id;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const [devices] = await db.query(
      'SELECT device_id, device_name FROM cuepay_devices WHERE owner_id = ?',
      [userId]
    );

    const reports = [];
    for (const device of devices) {
      const [stats] = await db.query(
        `SELECT 
          COUNT(*) as payments,
          SUM(amount) as revenue,
          SUM(games_earned) as games,
          COUNT(DISTINCT customer_number) as customers,
          AVG(amount) as avg_payment,
          MIN(payment_time) as first_game,
          MAX(payment_time) as last_game
         FROM cuepay_payments 
         WHERE device_id = ? AND DATE(payment_time) = ?`,
        [device.device_id, date]
      );

      const [hourly] = await db.query(
        `SELECT HOUR(payment_time) as hour, SUM(amount) as revenue, COUNT(*) as payments
         FROM cuepay_payments WHERE device_id = ? AND DATE(payment_time) = ?
         GROUP BY HOUR(payment_time) ORDER BY hour`,
        [device.device_id, date]
      );

      reports.push({
        ...device,
        stats: stats[0],
        hourly_breakdown: hourly
      });
    }

    // Check goals
    const [goals] = await db.query(
      'SELECT * FROM cuepay_goals WHERE owner_id = ? AND is_active = 1 AND start_date <= ? AND (end_date >= ? OR end_date IS NULL)',
      [userId, date, date]
    );

    res.render('cuepay/reports/daily', {
      title: 'Daily Report - CuePay',
      reports,
      goals,
      selectedDate: date,
      user: req.session.cuepayUser
    });
  } catch(err) {
    console.error('Daily report error:', err);
    res.redirect('/cuepay/dashboard');
  }
});

// Weekly Report
app.get('/cuepay/reports/weekly', isCuePayAuth, async (req, res) => {
  try {
    const userId = req.session.cuepayUser.id;
    const [devices] = await db.query('SELECT device_id, device_name FROM cuepay_devices WHERE owner_id = ?', [userId]);

    const reports = [];
    for (const device of devices) {
      const [dailyStats] = await db.query(
        `SELECT DATE(payment_time) as date,
                DAYNAME(payment_time) as day_name,
                SUM(amount) as revenue,
                SUM(games_earned) as games,
                COUNT(*) as payments,
                COUNT(DISTINCT customer_number) as customers
         FROM cuepay_payments 
         WHERE device_id = ? AND payment_time >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
         GROUP BY DATE(payment_time)
         ORDER BY date DESC`,
        [device.device_id]
      );

      const [weekTotal] = await db.query(
        `SELECT SUM(amount) as total_revenue, SUM(games_earned) as total_games, COUNT(*) as total_payments
         FROM cuepay_payments WHERE device_id = ? AND payment_time >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
        [device.device_id]
      );

      reports.push({ ...device, daily: dailyStats, total: weekTotal[0] });
    }

    res.render('cuepay/reports/weekly', {
      title: 'Weekly Report - CuePay',
      reports,
      user: req.session.cuepayUser
    });
  } catch(err) {
    res.redirect('/cuepay/dashboard');
  }
});

// Monthly Report
app.get('/cuepay/reports/monthly', isCuePayAuth, async (req, res) => {
  try {
    const userId = req.session.cuepayUser.id;
    const month = req.query.month || new Date().toISOString().substring(0, 7);

    const [devices] = await db.query('SELECT device_id, device_name FROM cuepay_devices WHERE owner_id = ?', [userId]);

    const reports = [];
    for (const device of devices) {
      const [weeklyStats] = await db.query(
        `SELECT WEEK(payment_time, 1) as week_num,
                MIN(DATE(payment_time)) as week_start,
                SUM(amount) as revenue,
                SUM(games_earned) as games,
                COUNT(*) as payments
         FROM cuepay_payments 
         WHERE device_id = ? AND DATE_FORMAT(payment_time, '%Y-%m') = ?
         GROUP BY WEEK(payment_time, 1)
         ORDER BY week_num`,
        [device.device_id, month]
      );

      const [monthTotal] = await db.query(
        `SELECT SUM(amount) as total_revenue, SUM(games_earned) as total_games, 
                COUNT(*) as total_payments, COUNT(DISTINCT customer_number) as total_customers,
                AVG(amount) as avg_payment
         FROM cuepay_payments WHERE device_id = ? AND DATE_FORMAT(payment_time, '%Y-%m') = ?`,
        [device.device_id, month]
      );

      // Previous month for growth comparison
      const prevMonth = month.substring(5) === '01' ? 
        (parseInt(month.substring(0,4)) - 1) + '-12' : 
        month.substring(0,5) + String(parseInt(month.substring(5)) - 1).padStart(2, '0');

      const [prevTotal] = await db.query(
        `SELECT SUM(amount) as prev_revenue FROM cuepay_payments 
         WHERE device_id = ? AND DATE_FORMAT(payment_time, '%Y-%m') = ?`,
        [device.device_id, prevMonth]
      );

      const growth = prevTotal[0].prev_revenue > 0 ? 
        ((monthTotal[0].total_revenue - prevTotal[0].prev_revenue) / prevTotal[0].prev_revenue * 100) : 0;

      reports.push({ ...device, weekly: weeklyStats, total: monthTotal[0], growth: growth.toFixed(1) });
    }

    res.render('cuepay/reports/monthly', {
      title: 'Monthly Report - CuePay',
      reports,
      selectedMonth: month,
      user: req.session.cuepayUser
    });
  } catch(err) {
    res.redirect('/cuepay/dashboard');
  }
});

// Export CSV
app.get('/cuepay/export/csv/:deviceId', isCuePayAuth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const [payments] = await db.query(
      'SELECT transaction_id, amount, customer_number, games_earned, payment_time FROM cuepay_payments WHERE device_id = ? ORDER BY payment_time DESC LIMIT 1000',
      [deviceId]
    );

    let csv = 'Transaction ID,Amount,Customer,Games,Date Time\n';
    payments.forEach(p => {
      csv += `${p.transaction_id},${p.amount},${p.customer_number},${p.games_earned},${p.payment_time}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=cuepay_${deviceId}_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch(err) {
    res.redirect('/cuepay/dashboard');
  }
});

// ===== CUSTOMER ANALYTICS =====

// Top Customers
app.get('/cuepay/customers/:deviceId', isCuePayAuth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const [topCustomers] = await db.query(
      `SELECT customer_number,
              COUNT(*) as visits,
              SUM(amount) as total_spent,
              SUM(games_earned) as total_games,
              AVG(amount) as avg_spend,
              MAX(payment_time) as last_visit,
              MIN(payment_time) as first_visit
       FROM cuepay_payments 
       WHERE device_id = ? AND customer_number != 'Unknown'
       GROUP BY customer_number
       ORDER BY total_spent DESC LIMIT 20`,
      [deviceId]
    );

    const retention = await getCustomerRetention(deviceId, 30);

    res.render('cuepay/customers', {
      title: 'Customer Analytics - CuePay',
      topCustomers,
      retention,
      deviceId,
      user: req.session.cuepayUser
    });
  } catch(err) {
    res.redirect('/cuepay/dashboard');
  }
});

// ===== TABLE PERFORMANCE =====

// Table Comparison
app.get('/cuepay/compare', isCuePayAuth, async (req, res) => {
  try {
    const userId = req.session.cuepayUser.id;
    const period = req.query.period || '7';

    const [devices] = await db.query(
      `SELECT d.*, 
        (SELECT SUM(amount) FROM cuepay_payments WHERE device_id = d.device_id AND payment_time >= DATE_SUB(NOW(), INTERVAL ? DAY)) as period_revenue,
        (SELECT SUM(games_earned) FROM cuepay_payments WHERE device_id = d.device_id AND payment_time >= DATE_SUB(NOW(), INTERVAL ? DAY)) as period_games,
        (SELECT COUNT(*) FROM cuepay_payments WHERE device_id = d.device_id AND payment_time >= DATE_SUB(NOW(), INTERVAL ? DAY)) as period_payments
       FROM cuepay_devices d WHERE d.owner_id = ?
       ORDER BY period_revenue DESC`,
      [parseInt(period), parseInt(period), userId]
    );

    res.render('cuepay/compare', {
      title: 'Table Comparison - CuePay',
      devices,
      selectedPeriod: period,
      user: req.session.cuepayUser
    });
  } catch(err) {
    res.redirect('/cuepay/dashboard');
  }
});

// ===== GOALS MANAGEMENT =====

// Set Goal
app.post('/cuepay/goals', isCuePayAuth, async (req, res) => {
  try {
    const { device_id, goal_type, target_revenue, target_games, start_date } = req.body;
    await db.query(
      'INSERT INTO cuepay_goals (owner_id, device_id, goal_type, target_revenue, target_games, start_date) VALUES (?, ?, ?, ?, ?, ?)',
      [req.session.cuepayUser.id, device_id || null, goal_type, target_revenue, target_games || null, start_date]
    );
    req.flash('success_msg', 'Goal set successfully!');
    res.redirect('/cuepay/dashboard');
  } catch(err) {
    req.flash('error_msg', 'Failed to set goal');
    res.redirect('/cuepay/dashboard');
  }
});

// ===== STAFF MANAGEMENT =====

// Staff List
app.get('/cuepay/staff', isCuePayAuth, async (req, res) => {
  try {
    const [staff] = await db.query('SELECT * FROM cuepay_staff WHERE owner_id = ? ORDER BY full_name', [req.session.cuepayUser.id]);
    res.render('cuepay/staff', { title: 'Staff Management - CuePay', staff, user: req.session.cuepayUser });
  } catch(err) {
    res.redirect('/cuepay/dashboard');
  }
});

// Add Staff
app.post('/cuepay/staff', isCuePayAuth, async (req, res) => {
  try {
    const { full_name, email, phone, pin_code, role, commission_percent } = req.body;
    await db.query(
      'INSERT INTO cuepay_staff (owner_id, full_name, email, phone, pin_code, role, commission_percent) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.session.cuepayUser.id, full_name, email, phone, pin_code, role, commission_percent || 0]
    );
    req.flash('success_msg', 'Staff added!');
    res.redirect('/cuepay/staff');
  } catch(err) {
    req.flash('error_msg', 'Failed to add staff');
    res.redirect('/cuepay/staff');
  }
});

// ===== ALERTS =====

// Alert Settings
app.get('/cuepay/alerts', isCuePayAuth, async (req, res) => {
  try {
    const [alerts] = await db.query('SELECT * FROM cuepay_alerts WHERE owner_id = ?', [req.session.cuepayUser.id]);
    const [history] = await db.query(
      'SELECT * FROM cuepay_alert_history WHERE owner_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.session.cuepayUser.id]
    );
    res.render('cuepay/alerts', { title: 'Alert Settings - CuePay', alerts, history, user: req.session.cuepayUser });
  } catch(err) {
    res.redirect('/cuepay/dashboard');
  }
});

// Toggle Alert
app.post('/cuepay/alerts/toggle/:id', isCuePayAuth, async (req, res) => {
  await db.query('UPDATE cuepay_alerts SET is_enabled = NOT is_enabled WHERE id = ? AND owner_id = ?', [req.params.id, req.session.cuepayUser.id]);
  res.redirect('/cuepay/alerts');
});

// ===== MAINTENANCE LOG =====

app.get('/cuepay/maintenance/:deviceId', isCuePayAuth, async (req, res) => {
  try {
    const [logs] = await db.query('SELECT * FROM cuepay_maintenance WHERE device_id = ? ORDER BY created_at DESC', [req.params.deviceId]);
    res.render('cuepay/maintenance', { title: 'Maintenance Log - CuePay', logs, deviceId: req.params.deviceId, user: req.session.cuepayUser });
  } catch(err) {
    res.redirect('/cuepay/dashboard');
  }
});

app.post('/cuepay/maintenance/:deviceId', isCuePayAuth, async (req, res) => {
  try {
    const { maintenance_type, description, performed_by, cost, next_due_date } = req.body;
    await db.query(
      'INSERT INTO cuepay_maintenance (device_id, maintenance_type, description, performed_by, cost, next_due_date) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.deviceId, maintenance_type, description, performed_by, cost, next_due_date || null]
    );
    req.flash('success_msg', 'Maintenance logged!');
    res.redirect(`/cuepay/maintenance/${req.params.deviceId}`);
  } catch(err) {
    res.redirect('/cuepay/dashboard');
  }
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