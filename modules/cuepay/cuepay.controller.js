const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class CuePayController {
  // ========== USER FACING PAGES ==========
  
  // CuePay login page
  static loginPage(req, res) {
    res.render('cuepay/login', {
      title: 'CuePay Login - Ardthon Solutions'
    });
  }

  // CuePay login handler
  static async login(req, res) {
    try {
      const { email, password } = req.body;
      
      const [users] = await req.db.query(
        'SELECT * FROM cuepay_users WHERE email = ?',
        [email]
      );
      
      if (users.length === 0) {
        req.flash('error_msg', 'Invalid CuePay credentials');
        return res.redirect('/cuepay/login');
      }
      
      const user = users[0];
      const isMatch = await bcrypt.compare(password, user.password);
      
      if (!isMatch) {
        req.flash('error_msg', 'Invalid CuePay credentials');
        return res.redirect('/cuepay/login');
      }
      
      req.session.cuepayUser = {
        id: user.id,
        email: user.email,
        name: user.full_name,
        business: user.business_name
      };
      
      res.redirect('/cuepay/dashboard');
    } catch (err) {
      console.error('CuePay login error:', err);
      req.flash('error_msg', 'Login failed');
      res.redirect('/cuepay/login');
    }
  }

  // Register device page
  static registerDevicePage(req, res) {
    res.render('cuepay/register-device', {
      title: 'Register CuePay Device - Ardthon Solutions'
    });
  }

  // Register device handler
  static async registerDevice(req, res) {
    try {
      const { device_id, device_name, location, game_price } = req.body;
      const ownerId = req.session.cuepayUser.id;
      
      // Check if device exists
      const [existing] = await req.db.query(
        'SELECT id FROM cuepay_devices WHERE device_id = ?',
        [device_id]
      );
      
      if (existing.length > 0) {
        req.flash('error_msg', 'Device ID already registered');
        return res.redirect('/cuepay/register-device');
      }
      
      // Generate API key
      const apiKey = crypto.randomBytes(32).toString('hex');
      
      // Insert device
      await req.db.query(
        `INSERT INTO cuepay_devices (device_id, device_name, api_key, owner_id, location_area, game_price, status)
         VALUES (?, ?, ?, ?, ?, ?, 'offline')`,
        [device_id, device_name, apiKey, ownerId, location, game_price]
      );
      
      // Store API key in session temporarily for display
      req.session.newDeviceApiKey = apiKey;
      req.session.newDeviceId = device_id;
      
      req.flash('success_msg', 'Device registered successfully!');
      res.redirect('/cuepay/device-credentials');
    } catch (err) {
      console.error('Device registration error:', err);
      req.flash('error_msg', 'Failed to register device');
      res.redirect('/cuepay/register-device');
    }
  }

  // Show device credentials
  static deviceCredentials(req, res) {
    const apiKey = req.session.newDeviceApiKey;
    const deviceId = req.session.newDeviceId;
    
    if (!apiKey || !deviceId) {
      return res.redirect('/cuepay/dashboard');
    }
    
    // Clear from session
    delete req.session.newDeviceApiKey;
    delete req.session.newDeviceId;
    
    res.render('cuepay/device-credentials', {
      title: 'Device Credentials - CuePay',
      apiKey,
      deviceId
    });
  }

  // CuePay Dashboard
  static async dashboard(req, res) {
    try {
      const userId = req.session.cuepayUser.id;
      
      // Get all devices for this user
      const [devices] = await req.db.query(
        `SELECT d.*, 
                l.games_available,
                l.battery_voltage,
                l.gsm_connected,
                l.total_revenue,
                l.today_revenue,
                l.today_games,
                l.updated_at as last_data
         FROM cuepay_devices d
         LEFT JOIN cuepay_live_data l ON d.device_id = l.device_id
         WHERE d.owner_id = ?
         ORDER BY d.created_at DESC`,
        [userId]
      );
      
      // Calculate battery percentage and format
      devices.forEach(device => {
        device.battery_percent = this.calculateBattery(device.battery_voltage);
        device.last_activity = this.timeAgo(device.last_sync);
        device.is_online = device.status === 'online';
      });
      
      res.render('cuepay/dashboard', {
        title: 'CuePay Dashboard - Ardthon Solutions',
        devices,
        user: req.session.cuepayUser
      });
    } catch (err) {
      console.error('CuePay dashboard error:', err);
      res.render('cuepay/dashboard', {
        title: 'CuePay Dashboard',
        devices: [],
        user: req.session.cuepayUser
      });
    }
  }

  // Device detail page
  static async deviceDetail(req, res) {
    try {
      const { deviceId } = req.params;
      const userId = req.session.cuepayUser.id;
      
      // Get device info
      const [devices] = await req.db.query(
        `SELECT d.*, l.*
         FROM cuepay_devices d
         LEFT JOIN cuepay_live_data l ON d.device_id = l.device_id
         WHERE d.device_id = ? AND d.owner_id = ?`,
        [deviceId, userId]
      );
      
      if (devices.length === 0) {
        req.flash('error_msg', 'Device not found');
        return res.redirect('/cuepay/dashboard');
      }
      
      // Get recent payments
      const [payments] = await req.db.query(
        `SELECT * FROM cuepay_payments 
         WHERE device_id = ? 
         ORDER BY payment_time DESC 
         LIMIT 50`,
        [deviceId]
      );
      
      // Get commands
      const [commands] = await req.db.query(
        `SELECT * FROM cuepay_commands 
         WHERE device_id = ? 
         ORDER BY created_at DESC 
         LIMIT 20`,
        [deviceId]
      );
      
      const device = devices[0];
      device.battery_percent = this.calculateBattery(device.battery_voltage);
      device.last_activity = this.timeAgo(device.last_sync);
      
      res.render('cuepay/device-detail', {
        title: `${device.device_name} - CuePay`,
        device,
        payments,
        commands
      });
    } catch (err) {
      console.error('Device detail error:', err);
      res.redirect('/cuepay/dashboard');
    }
  }

  // Send command to device
  static async sendCommand(req, res) {
    try {
      const { deviceId } = req.params;
      const { command_type, command_data } = req.body;
      
      await req.db.query(
        `INSERT INTO cuepay_commands (device_id, command_type, command_data, status)
         VALUES (?, ?, ?, 'pending')`,
        [deviceId, command_type, JSON.stringify(command_data)]
      );
      
      req.flash('success_msg', 'Command queued successfully');
      res.redirect(`/cuepay/device/${deviceId}`);
    } catch (err) {
      console.error('Send command error:', err);
      req.flash('error_msg', 'Failed to send command');
      res.redirect(`/cuepay/device/${req.params.deviceId}`);
    }
  }

  // CuePay logout
  static logout(req, res) {
    delete req.session.cuepayUser;
    res.redirect('/cuepay/login');
  }

  // ========== API ENDPOINTS ==========
  
  // Device sync API
  static async sync(req, res) {
    try {
      const device = req.cuepayDevice;
      const data = req.body;
      
      // Update device status
      await req.db.query(
        "UPDATE cuepay_devices SET status = 'online', last_sync = NOW() WHERE device_id = ?",
        [device.device_id]
      );
      
      // Update live data
      await req.db.query(
        `INSERT INTO cuepay_live_data 
         (device_id, games_available, battery_voltage, gsm_connected, total_revenue, today_revenue, today_games)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         games_available = VALUES(games_available),
         battery_voltage = VALUES(battery_voltage),
         gsm_connected = VALUES(gsm_connected),
         total_revenue = VALUES(total_revenue),
         today_revenue = VALUES(today_revenue),
         today_games = VALUES(today_games)`,
        [
          device.device_id,
          data.games_available || 0,
          data.battery_voltage || 0,
          data.gsm_connected || false,
          data.total_revenue || 0,
          data.today_revenue || 0,
          data.today_games || 0
        ]
      );
      
      // Save payments
      if (data.recent_payments && Array.isArray(data.recent_payments)) {
        for (const payment of data.recent_payments) {
          await req.db.query(
            `INSERT IGNORE INTO cuepay_payments 
             (device_id, transaction_id, amount, customer_number, games_earned)
             VALUES (?, ?, ?, ?, ?)`,
            [
              device.device_id,
              payment.transaction_id,
              payment.amount,
              payment.customer,
              payment.games
            ]
          );
        }
      }
      
      // Get pending commands
      const [commands] = await req.db.query(
        "SELECT * FROM cuepay_commands WHERE device_id = ? AND status = 'pending' LIMIT 5",
        [device.device_id]
      );
      
      // Mark commands as sent
      if (commands.length > 0) {
        const commandIds = commands.map(c => c.id);
        await req.db.query(
          "UPDATE cuepay_commands SET status = 'sent' WHERE id IN (?)",
          [commandIds]
        );
      }
      
      res.json({
        status: 'success',
        message: 'Sync complete',
        timestamp: new Date().toISOString(),
        commands: commands
      });
    } catch (err) {
      console.error('CuePay sync error:', err);
      res.status(500).json({ error: 'Sync failed' });
    }
  }

  // Get all tables (public API)
  static async getTables(req, res) {
    try {
      const [tables] = await req.db.query(`
        SELECT d.device_id, d.device_name as name, d.location_area, 
               d.game_price as price, d.status, d.last_sync,
               l.games_available, l.battery_voltage, l.today_revenue, l.today_games
        FROM cuepay_devices d
        LEFT JOIN cuepay_live_data l ON d.device_id = l.device_id
        WHERE d.status = 'online'
        ORDER BY d.device_name
      `);
      
      tables.forEach(t => {
        t.last_activity = CuePayController.timeAgo(t.last_sync);
        t.battery_percent = CuePayController.calculateBattery(t.battery_voltage);
      });
      
      res.json({ success: true, tables });
    } catch (err) {
      res.status(500).json({ error: 'Failed to get tables' });
    }
  }

  // ========== HELPER METHODS ==========
  
  static calculateBattery(voltage) {
    if (!voltage || voltage === 0) return 0;
    const percent = ((voltage - 10.5) / (12.6 - 10.5)) * 100;
    return Math.max(0, Math.min(100, Math.round(percent)));
  }

  static timeAgo(timestamp) {
    if (!timestamp) return 'Never';
    const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (diff < 10) return 'Just now';
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return new Date(timestamp).toLocaleDateString();
  }
}

module.exports = CuePayController;