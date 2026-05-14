const express = require('express');
const router = express.Router();

// Homepage
router.get('/', async (req, res) => {
  try {
    const [featuredProducts] = await req.db.query(
      'SELECT * FROM products WHERE featured = 1 LIMIT 8'
    );
    const [latestProjects] = await req.db.query(
      'SELECT * FROM projects WHERE isPublished = 1 ORDER BY createdAt DESC LIMIT 3'
    );
    const [latestBlogs] = await req.db.query(
      "SELECT * FROM blogs WHERE status = 'published' ORDER BY createdAt DESC LIMIT 3"
    );

    // Parse JSON fields
    featuredProducts.forEach(p => {
      try { p.images = JSON.parse(p.images || '[]'); } catch(e) { p.images = []; }
      try { p.specifications = JSON.parse(p.specifications || '[]'); } catch(e) { p.specifications = []; }
    });
    latestProjects.forEach(p => {
      try { p.images = JSON.parse(p.images || '[]'); } catch(e) { p.images = []; }
      try { p.technologies = JSON.parse(p.technologies || '[]'); } catch(e) { p.technologies = []; }
    });
    latestBlogs.forEach(b => {
      try { b.tags = JSON.parse(b.tags || '[]'); } catch(e) { b.tags = []; }
    });

    res.render('index', {
      title: 'Ardthon Solutions - Connect With Ease',
      featuredProducts,
      latestProjects,
      latestBlogs
    });
  } catch (err) {
    console.error('Home error:', err);
    res.render('index', {
      title: 'Ardthon Solutions',
      featuredProducts: [],
      latestProjects: [],
      latestBlogs: []
    });
  }
});

// About
router.get('/about', (req, res) => {
  res.render('about', { title: 'About Us - Ardthon Solutions' });
});

// Contact
router.get('/contact', (req, res) => {
  res.render('contact', { title: 'Contact Us - Ardthon Solutions' });
});

// Discord
router.get('/discord', (req, res) => {
  res.render('discord', { title: 'Join Our Discord - Ardthon Solutions' });
});

// Dashboard
router.get('/dashboard', async (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  try {
    const [orders] = await req.db.query(
      'SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC LIMIT 10',
      [req.session.user.id]
    );
    res.render('dashboard', {
      title: 'Dashboard - Ardthon Solutions',
      orders,
      userData: req.session.user
    });
  } catch (err) {
    res.render('dashboard', {
      title: 'Dashboard',
      orders: [],
      userData: req.session.user
    });
  }
});

module.exports = router;