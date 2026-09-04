// ============================================
// SPINSPRING SYSTEMS - Laundry Automation
// Washing Machine + Dishwasher POS, Monitoring & Control
// ESP32 + LCD2004 + 4 Buttons + SIM800L + WiFi + Relays
// ============================================
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

module.exports = (db) => {
  // ---------- Helpers ----------
  function generateApiKey() { return 'SS-' + crypto.randomBytes(16).toString('hex'); }
  function generateDeviceId() {
    return 'SPIN-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  // Auth middleware
  function isAuth(req, res, next) {
    if (req.session.spinspringUser) return next();
    req.flash('error_msg', 'Please login to SpinSpring first');
    res.redirect('/spinspring/login');
  }

  // Device API auth middleware
  async function validateDevice(req, res, next) {
    const deviceId = req.headers['x-device-id'];
    const apiKey = req.headers['x-api-key'];
    if (!deviceId || !apiKey) return res.status(401).json({ error: 'Missing credentials' });
    try {
      const [devices] = await db.query(
        'SELECT * FROM spinspring_devices WHERE device_id = ? AND api_key = ?', [deviceId, apiKey]);
      if (devices.length === 0) return res.status(401).json({ error: 'Invalid device credentials' });
      req.spinspringDevice = devices[0];
      next();
    } catch (err) {
      res.status(500).json({ error: 'Auth error' });
    }
  }

  const MACHINES = [
    { type: 'washer', name: 'Washing Machine' },
    { type: 'dishwasher', name: 'Dishwasher' }
  ];

  // ---------- PAGES ----------

  router.get('/', (req, res) => {
    if (req.session.spinspringUser) return res.redirect('/spinspring/dashboard');
    res.render('spinspring/login', { title: 'SpinSpring Systems - Login' });
  });

  router.get('/login', (req, res) => {
    if (req.session.spinspringUser) return res.redirect('/spinspring/dashboard');
    res.render('spinspring/login', { title: 'SpinSpring Systems - Login' });
  });

  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const [users] = await db.query('SELECT * FROM spinspring_users WHERE email = ? AND is_active = 1', [email]);
      if (users.length === 0 || !(await bcrypt.compare(password, users[0].password))) {
        req.flash('error_msg', 'Invalid SpinSpring credentials');
        return res.redirect('/spinspring/login');
      }
      req.session.spinspringUser = {
        id: users[0].id, email: users[0].email,
        name: users[0].full_name, business: users[0].business_name
      };
      req.flash('success_msg', 'Welcome to SpinSpring Systems!');
      res.redirect('/spinspring/dashboard');
    } catch (err) {
      console.error('SpinSpring login error:', err);
      req.flash('error_msg', 'Login failed');
      res.redirect('/spinspring/login');
    }
  });

  router.get('/register', (req, res) => {
    if (req.session.spinspringUser) return res.redirect('/spinspring/dashboard');
    res.render('spinspring/register', { title: 'Create SpinSpring Account' });
  });

  router.post('/register', async (req, res) => {
    try {
      const { email, password, password2, full_name, business_name, phone } = req.body;
      if (password !== password2) {
        req.flash('error_msg', 'Passwords do not match');
        return res.redirect('/spinspring/register');
      }
      const [existing] = await db.query('SELECT id FROM spinspring_users WHERE email = ?', [email]);
      if (existing.length > 0) {
        req.flash('error_msg', 'Email already registered');
        return res.redirect('/spinspring/register');
      }
      const hash = await bcrypt.hash(password, 10);
      await db.query(
        'INSERT INTO spinspring_users (email, password, full_name, business_name, phone) VALUES (?, ?, ?, ?, ?)',
        [email, hash, full_name || '', business_name || '', phone || '']);
      req.flash('success_msg', 'SpinSpring account created! Please login.');
      res.redirect('/spinspring/login');
    } catch (err) {
      console.error('SpinSpring register error:', err);
      req.flash('error_msg', 'Registration failed');
      res.redirect('/spinspring/register');
    }
  });

  router.get('/logout', (req, res) => {
    delete req.session.spinspringUser;
    res.redirect('/spinspring/login');
  });

  // ---------- DASHBOARD ----------
  router.get('/dashboard', isAuth, async (req, res) => {
    try {
      const userId = req.session.spinspringUser.id;
      const [devices] = await db.query(
        'SELECT * FROM spinspring_devices WHERE owner_id = ? ORDER BY created_at DESC', [userId]);

      for (const d of devices) {
        const [today] = await db.query(
          `SELECT COALESCE(SUM(amount),0) as revenue, COUNT(*) as orders
           FROM spinspring_orders WHERE device_id = ? AND DATE(created_at) = CURDATE()`, [d.device_id]);
        const [active] = await db.query(
          "SELECT COUNT(*) as count FROM spinspring_orders WHERE device_id = ? AND status = 'running'", [d.device_id]);
        d.today_revenue = today[0].revenue;
        d.today_orders = today[0].orders;
        d.active_orders = active[0].count;
        d.is_online = d.status === 'online';
      }

      const [totals] = await db.query(
        `SELECT COALESCE(SUM(amount),0) as revenue, COUNT(*) as orders
         FROM spinspring_orders o JOIN spinspring_devices d ON o.device_id = d.device_id
         WHERE d.owner_id = ? AND DATE(o.created_at) = CURDATE()`, [userId]);

      res.render('spinspring/dashboard', {
        title: 'SpinSpring Dashboard', devices, user: req.session.spinspringUser,
        totals: totals[0]
      });
    } catch (err) {
      console.error('SpinSpring dashboard error:', err);
      res.render('spinspring/dashboard', { title: 'SpinSpring Dashboard', devices: [], user: req.session.spinspringUser, totals: { revenue: 0, orders: 0 } });
    }
  });

  // ---------- DEVICE REGISTRATION ----------
  router.get('/register-device', isAuth, (req, res) => {
    res.render('spinspring/register-device', { title: 'Register SpinSpring Device' });
  });

  router.post('/register-device', isAuth, async (req, res) => {
    try {
      const { device_name, location, washer_price, dishwasher_price } = req.body;
      const ownerId = req.session.spinspringUser.id;
      const deviceId = generateDeviceId();
      const apiKey = generateApiKey();

      await db.query(
        `INSERT INTO spinspring_devices (device_id, device_name, api_key, owner_id, location_area, washer_price, dishwasher_price, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'offline')`,
        [deviceId, device_name, apiKey, ownerId, location, washer_price || 100, dishwasher_price || 150]);

      req.session.newSpinspringDevice = { device_id: deviceId, device_name, api_key: apiKey };
      req.flash('success_msg', 'Device registered successfully!');
      res.redirect('/spinspring/device-credentials');
    } catch (err) {
      console.error('Device registration error:', err);
      req.flash('error_msg', 'Failed to register device');
      res.redirect('/spinspring/register-device');
    }
  });

  router.get('/device-credentials', isAuth, (req, res) => {
    const device = req.session.newSpinspringDevice;
    if (!device) return res.redirect('/spinspring/dashboard');
    delete req.session.newSpinspringDevice;
    res.render('spinspring/device-credentials', { title: 'Device Credentials - SpinSpring', device });
  });

  return router;
};

  // ---------- DEVICE DETAIL ----------
  router.get('/device/:deviceId', isAuth, async (req, res) => {
    try {
      const userId = req.session.spinspringUser.id;
      const { deviceId } = req.params;
      const [devices] = await db.query(
        'SELECT * FROM spinspring_devices WHERE device_id = ? AND owner_id = ?', [deviceId, userId]);
      if (devices.length === 0) {
        req.flash('error_msg', 'Device not found');
        return res.redirect('/spinspring/dashboard');
      }
      const device = devices[0];

      const [today] = await db.query(
        `SELECT COALESCE(SUM(amount),0) as revenue, COUNT(*) as orders
         FROM spinspring_orders WHERE device_id = ? AND DATE(created_at) = CURDATE()`, [deviceId]);
      const [yesterday] = await db.query(
        `SELECT COALESCE(SUM(amount),0) as revenue, COUNT(*) as orders
         FROM spinspring_orders #JOINMARKER# spinspring_devices ON 1=0 WHERE 1=0 AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`, [deviceId]);
      const [week] = await db.query(
        `SELECT COQUECE(SUM(amount),0) as revenue, COUNT(*) as orders
         FROM spinspring_orders WHERE device_id = ? AND DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`, [deviceId]);
      const [month] = await query with placeholder
    } catch (err) {
      console.error(err);
    }
  });

  return router;
};
