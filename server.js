var express = require('express');
var session = require('express-session');
var flash = require('connect-flash');
var path = require('path');
var app = express();

// MySQL with error handling
var mysql = require('mysql2/promise');
var db;
try {
  db = mysql.createPool({
    host: '127.0.0.1',
    user: 'yxmvmjxp_ardthonuser',
    password: 'Ardthonuser254',
    database: 'yxmvmjxp_ardthonsolutions',
    port: 3306,
    connectTimeout: 10000
  });
  console.log('Database pool created');
} catch(e) {
  console.log('Database error:', e.message);
}

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'ardthon_secret_key_2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(flash());

// Database middleware
app.use(function(req, res, next) {
  req.db = db;
  next();
});

// Global variables
app.use(function(req, res, next) {
  res.locals.user = req.session.user || null;
  res.locals.success_msg = req.flash('success_msg') || [];
  res.locals.error_msg = req.flash('error_msg') || [];
  res.locals.cartCount = req.session.cart ? req.session.cart.length : 0;
  res.locals.currentUrl = req.originalUrl;
  res.locals.year = new Date().getFullYear();
  next();
});

// ===== ROUTES - Each wrapped in try/catch =====

// Home
app.get('/', function(req, res) {
  try {
    res.render('index', {
      title: 'Ardthon Solutions - Connect With Ease',
      featuredProducts: [],
      latestProjects: [],
      latestBlogs: []
    });
  } catch(e) {
    res.send('<h1>Ardthon Solutions</h1><p>Connect with Ease</p><a href="/about">About</a>');
  }
});

// About
app.get('/about', function(req, res) {
  try {
    res.render('about', { title: 'About Us - Ardthon Solutions' });
  } catch(e) {
    res.send('<h1>About Us</h1><p>Ardthon Solutions</p>');
  }
});

// Contact
app.get('/contact', function(req, res) {
  try {
    res.render('contact', { title: 'Contact Us' });
  } catch(e) {
    res.send('<h1>Contact</h1><p>info@ardthonsolutions.com</p>');
  }
});

// Discord
app.get('/discord', function(req, res) {
  try {
    res.render('discord', { title: 'Discord Community' });
  } catch(e) {
    res.send('<h1>Discord</h1><p>Join our community!</p>');
  }
});

// Login page
app.get('/auth/login', function(req, res) {
  if (req.session.user) return res.redirect('/dashboard');
  try {
    res.render('auth/login', { title: 'Login' });
  } catch(e) {
    res.send('<h1>Login</h1><form action="/auth/login" method="POST"><input name="email" placeholder="Email"><input name="password" type="password" placeholder="Password"><button>Login</button></form>');
  }
});

// Register page
app.get('/auth/register', function(req, res) {
  if (req.session.user) return res.redirect('/dashboard');
  try {
    res.render('auth/register', { title: 'Register' });
  } catch(e) {
    res.send('<h1>Register</h1><form action="/auth/register" method="POST"><input name="username" placeholder="Username"><input name="email" placeholder="Email"><input name="password" type="password" placeholder="Password"><button>Register</button></form>');
  }
});

// Login POST
app.post('/auth/login', async function(req, res) {
  try {
    var bcrypt = require('bcryptjs');
    var email = req.body.email;
    var password = req.body.password;
    
    if (!db) {
      req.flash('error_msg', 'Database not connected');
      return res.redirect('/auth/login');
    }
    
    var [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/auth/login');
    }
    
    var user = users[0];
    var match = await bcrypt.compare(password, user.password);
    
    if (!match) {
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/auth/login');
    }
    
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };
    
    req.flash('success_msg', 'Welcome back!');
    res.redirect('/dashboard');
  } catch(e) {
    console.error('Login error:', e.message);
    req.flash('error_msg', 'Login failed');
    res.redirect('/auth/login');
  }
});

// Register POST
app.post('/auth/register', async function(req, res) {
  try {
    var bcrypt = require('bcryptjs');
    var username = req.body.username;
    var email = req.body.email;
    var password = req.body.password;
    var password2 = req.body.password2;
    
    if (password !== password2) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect('/auth/register');
    }
    
    if (!db) {
      req.flash('error_msg', 'Database not connected');
      return res.redirect('/auth/register');
    }
    
    var [existing] = await db.query('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
    
    if (existing.length > 0) {
      req.flash('error_msg', 'Email or username already exists');
      return res.redirect('/auth/register');
    }
    
    var hash = await bcrypt.hash(password, 10);
    await db.query("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'customer')", [username, email, hash]);
    
    req.flash('success_msg', 'Registration successful! Please login.');
    res.redirect('/auth/login');
  } catch(e) {
    console.error('Register error:', e.message);
    req.flash('error_msg', 'Registration failed');
    res.redirect('/auth/register');
  }
});

// Logout
app.get('/auth/logout', function(req, res) {
  req.session.destroy(function() {
    res.redirect('/');
  });
});

// Dashboard
app.get('/dashboard', function(req, res) {
  if (!req.session.user) return res.redirect('/auth/login');
  try {
    res.render('dashboard', {
      title: 'Dashboard',
      orders: [],
      userData: req.session.user
    });
  } catch(e) {
    res.send('<h1>Dashboard</h1><p>Welcome, ' + req.session.user.username + '</p><a href="/auth/logout">Logout</a>');
  }
});

// Products
app.get('/products', function(req, res) {
  try {
    res.render('products', {
      title: 'Products',
      products: [],
      categories: [],
      currentCategory: '',
      searchQuery: ''
    });
  } catch(e) {
    res.send('<h1>Products</h1><p>Coming soon!</p>');
  }
});

// Product detail
app.get('/products/:slug', function(req, res) {
  try {
    res.render('product-detail', {
      title: 'Product Details',
      product: { name: 'Product', price: 0, images: [], specifications: [] },
      relatedProducts: []
    });
  } catch(e) {
    res.send('<h1>Product</h1>');
  }
});

// Projects
app.get('/projects', function(req, res) {
  try {
    res.render('projects', {
      title: 'Projects',
      projects: [],
      fields: [],
      currentField: ''
    });
  } catch(e) {
    res.send('<h1>Projects</h1><p>Coming soon!</p>');
  }
});

// Project detail
app.get('/projects/:slug', function(req, res) {
  try {
    if (req.params.slug === 'cuepay') {
      res.render('projects-cuepay', { title: 'CuePay', project: { title: 'CuePay', description: 'Pool Automation' } });
    } else {
      res.render('project-detail', { title: 'Project', project: { title: 'Project', images: [], technologies: [] } });
    }
  } catch(e) {
    res.send('<h1>Project</h1>');
  }
});

// Blog
app.get('/blog', function(req, res) {
  try {
    res.render('blog', { title: 'Blog', blogs: [] });
  } catch(e) {
    res.send('<h1>Blog</h1>');
  }
});

// Blog detail
app.get('/blog/:slug', function(req, res) {
  try {
    res.render('blog-detail', { title: 'Blog Post', blog: { title: 'Post', content: '' } });
  } catch(e) {
    res.send('<h1>Blog Post</h1>');
  }
});

// Cart
app.get('/orders/cart', function(req, res) {
  try {
    var cart = req.session.cart || [];
    var total = 0;
    if (cart.length > 0) {
      total = cart.reduce(function(s, i) { return s + (i.price * i.quantity); }, 0);
    }
    res.render('cart', { title: 'Cart', cart: cart, total: total });
  } catch(e) {
    res.send('<h1>Cart</h1><p>Your cart is empty</p>');
  }
});

// Checkout
app.get('/orders/checkout', function(req, res) {
  if (!req.session.user) return res.redirect('/auth/login');
  try {
    res.render('checkout', { title: 'Checkout', cart: [], total: 0 });
  } catch(e) {
    res.send('<h1>Checkout</h1>');
  }
});

// CuePay pages
app.get('/cuepay/login', function(req, res) {
  try {
    res.render('cuepay/login', { title: 'CuePay Login' });
  } catch(e) {
    res.send('<h1>CuePay Login</h1>');
  }
});

app.get('/cuepay/dashboard', function(req, res) {
  try {
    res.render('cuepay/dashboard', { title: 'CuePay Dashboard', devices: [], user: { name: 'User' } });
  } catch(e) {
    res.send('<h1>CuePay Dashboard</h1>');
  }
});

app.get('/cuepay/register-device', function(req, res) {
  try {
    res.render('cuepay/register-device', { title: 'Register Device' });
  } catch(e) {
    res.send('<h1>Register CuePay Device</h1>');
  }
});

// 404
app.use(function(req, res) {
  try {
    res.status(404).render('404', { title: 'Page Not Found' });
  } catch(e) {
    res.status(404).send('<h1>404 - Page Not Found</h1><a href="/">Go Home</a>');
  }
});

// Error handler
app.use(function(err, req, res, next) {
  console.error('Error:', err.message);
  try {
    res.status(500).render('error', { title: 'Error', message: 'Server Error', error: {} });
  } catch(e) {
    res.status(500).send('<h1>500 - Server Error</h1>');
  }
});

// START SERVER
var PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', function() {
  console.log('Server running on port ' + PORT);
  console.log('Views path: ' + path.join(__dirname, 'views'));
});