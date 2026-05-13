module.exports = {
  isCuePayAuth: (req, res, next) => {
    if (req.session.cuepayUser) return next();
    req.flash('error_msg', 'Please login to your CuePay account');
    res.redirect('/cuepay/login');
  },

  isCuePayGuest: (req, res, next) => {
    if (!req.session.cuepayUser) return next();
    res.redirect('/cuepay/dashboard');
  },

  validateApiKey: async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const deviceId = req.headers['x-device-id'];
    
    if (!apiKey || !deviceId) {
      return res.status(401).json({ error: 'Missing credentials' });
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
      res.status(500).json({ error: 'Auth error' });
    }
  }
};