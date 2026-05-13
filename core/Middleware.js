class Middleware {
  // Authentication middleware
  static isAuth(req, res, next) {
    if (req.session.user) return next();
    req.flash('error_msg', 'Please log in to access this page');
    res.redirect('/auth/login');
  }

  // Guest middleware (for login/register pages)
  static isGuest(req, res, next) {
    if (!req.session.user) return next();
    res.redirect('/dashboard');
  }

  // Admin middleware
  static isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') return next();
    req.flash('error_msg', 'Access denied. Admin only.');
    res.redirect('/');
  }

  // CuePay authentication
  static isCuePayAuth(req, res, next) {
    if (req.session.cuepayUser) return next();
    req.flash('error_msg', 'Please login to your CuePay account');
    res.redirect('/cuepay/login');
  }

  // API key validation for devices
  static async validateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    const deviceId = req.headers['x-device-id'] || req.query.device_id;
    
    if (!apiKey || !deviceId) {
      return res.status(401).json({ error: 'Missing API credentials' });
    }
    
    try {
      const [devices] = await req.db.query(
        'SELECT * FROM cuepay_devices WHERE device_id = ? AND api_key = ? AND status != ?',
        [deviceId, apiKey, 'blocked']
      );
      
      if (devices.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      req.cuepayDevice = devices[0];
      next();
    } catch (err) {
      res.status(500).json({ error: 'Authentication error' });
    }
  }
}

module.exports = Middleware;