var express = require('express');
var path = require('path');
var app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ===== ALL ROUTES =====

// Home
app.get('/', function(req, res) {
  res.render('index', { title: 'Ardthon Solutions' });
});

// Products
app.get('/products', function(req, res) {
  res.render('products', { title: 'Products', products: [], categories: [] });
});

// Projects
app.get('/projects', function(req, res) {
  res.render('projects', { title: 'Projects', projects: [], fields: [] });
});

// Blog
app.get('/blog', function(req, res) {
  res.render('blog', { title: 'Blog', blogs: [] });
});

// About
app.get('/about', function(req, res) {
  res.render('about', { title: 'About Us' });
});

// Contact
app.get('/contact', function(req, res) {
  res.render('contact', { title: 'Contact Us' });
});

// Discord
app.get('/discord', function(req, res) {
  res.render('discord', { title: 'Discord' });
});

// Login
app.get('/auth/login', function(req, res) {
  res.render('auth/login', { title: 'Login' });
});

// Register
app.get('/auth/register', function(req, res) {
  res.render('auth/register', { title: 'Register' });
});

// Dashboard
app.get('/dashboard', function(req, res) {
  res.render('dashboard', { title: 'Dashboard', orders: [], userData: {} });
});

// Cart
app.get('/orders/cart', function(req, res) {
  res.render('cart', { title: 'Cart', cart: [], total: 0 });
});

// CuePay
app.get('/cuepay/login', function(req, res) {
  res.render('cuepay/login', { title: 'CuePay Login' });
});

app.get('/cuepay/dashboard', function(req, res) {
  res.render('cuepay/dashboard', { title: 'CuePay Dashboard', devices: [], user: { name: 'User' } });
});

app.get('/cuepay/register-device', function(req, res) {
  res.render('cuepay/register-device', { title: 'Register Device' });
});

// Test
app.get('/test', function(req, res) {
  res.send('<h1>Test Works!</h1><a href="/">Home</a>');
});

// 404
app.use(function(req, res) {
  res.status(404).send('<h1>404 - Page Not Found</h1><a href="/">Go Home</a>');
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', function() {
  console.log('Server running on port ' + PORT);
});