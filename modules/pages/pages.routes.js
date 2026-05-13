const express = require('express');
const router = express.Router();

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
    
    featuredProducts.forEach(p => {
      p.images = JSON.parse(p.images || '[]');
    });
    latestProjects.forEach(p => {
      p.images = JSON.parse(p.images || '[]');
    });
    
    res.render('pages/home', {
      title: 'Ardthon Solutions - Connect With Ease',
      featuredProducts,
      latestProjects,
      latestBlogs
    });
  } catch (err) {
    console.error('Home error:', err);
    res.render('pages/home', {
      title: 'Ardthon Solutions',
      featuredProducts: [],
      latestProjects: [],
      latestBlogs: []
    });
  }
});

router.get('/about', (req, res) => {
  res.render('pages/about', { title: 'About Us' });
});

router.get('/contact', (req, res) => {
  res.render('pages/contact', { title: 'Contact Us' });
});

router.get('/discord', (req, res) => {
  res.render('pages/discord', { title: 'Discord Community' });
});

module.exports = { path: '/', router };