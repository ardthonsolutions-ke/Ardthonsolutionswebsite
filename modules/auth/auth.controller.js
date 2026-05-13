const bcrypt = require('bcryptjs');

class AuthController {
  // Show login page
  static loginPage(req, res) {
    res.render('auth/login', {
      title: 'Login - Ardthon Solutions'
    });
  }

  // Show register page
  static registerPage(req, res) {
    res.render('auth/register', {
      title: 'Create Account - Ardthon Solutions'
    });
  }

  // Handle registration
  static async register(req, res) {
    try {
      const { username, email, password, password2, fullName, phone, institution, field } = req.body;

      // Validation
      if (password !== password2) {
        req.flash('error_msg', 'Passwords do not match');
        return res.redirect('/auth/register');
      }

      if (password.length < 6) {
        req.flash('error_msg', 'Password must be at least 6 characters');
        return res.redirect('/auth/register');
      }

      // Check existing user
      const [existing] = await req.db.query(
        'SELECT id FROM users WHERE email = ? OR username = ?',
        [email, username]
      );

      if (existing.length > 0) {
        req.flash('error_msg', 'Email or username already registered');
        return res.redirect('/auth/register');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Insert user
      await req.db.query(
        `INSERT INTO users (username, email, password, fullName, phone, institution, field, role)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'customer')`,
        [username, email, hashedPassword, fullName, phone, institution, field || 'Other']
      );

      req.flash('success_msg', 'Registration successful! Please log in.');
      res.redirect('/auth/login');
    } catch (err) {
      console.error('Register error:', err);
      req.flash('error_msg', 'Registration failed. Please try again.');
      res.redirect('/auth/register');
    }
  }

  // Handle login
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      const [users] = await req.db.query(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );

      if (users.length === 0) {
        req.flash('error_msg', 'Invalid email or password');
        return res.redirect('/auth/login');
      }

      const user = users[0];
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        req.flash('error_msg', 'Invalid email or password');
        return res.redirect('/auth/login');
      }

      // Set session
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName
      };

      // Update last login
      await req.db.query(
        'UPDATE users SET lastLogin = NOW() WHERE id = ?',
        [user.id]
      );

      req.flash('success_msg', `Welcome back, ${user.fullName || user.username}!`);
      
      // Redirect based on role
      if (user.role === 'admin') {
        res.redirect('/admin');
      } else {
        res.redirect('/dashboard');
      }
    } catch (err) {
      console.error('Login error:', err);
      req.flash('error_msg', 'Login failed. Please try again.');
      res.redirect('/auth/login');
    }
  }

  // Handle logout
  static logout(req, res) {
    req.session.destroy((err) => {
      if (err) console.error('Logout error:', err);
      res.redirect('/');
    });
  }

  // Dashboard
  static async dashboard(req, res) {
    try {
      const userId = req.session.user.id;
      
      // Get user data
      const [users] = await req.db.query('SELECT * FROM users WHERE id = ?', [userId]);
      
      // Get orders
      const [orders] = await req.db.query(
        'SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC LIMIT 10',
        [userId]
      );
      
      // Get CuePay devices
      const [cuepayDevices] = await req.db.query(
        'SELECT * FROM cuepay_devices WHERE owner_id = ?',
        [userId]
      );
      
      res.render('dashboard/index', {
        title: 'Dashboard - Ardthon Solutions',
        userData: users[0],
        orders,
        cuepayDevices
      });
    } catch (err) {
      console.error('Dashboard error:', err);
      res.render('dashboard/index', {
        title: 'Dashboard',
        userData: req.session.user,
        orders: [],
        cuepayDevices: []
      });
    }
  }
}

module.exports = AuthController;