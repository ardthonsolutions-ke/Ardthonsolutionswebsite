module.exports = {
  isAuth: (req, res, next) => {
    if (req.session.user) return next();
    req.flash('error_msg', 'Please log in first');
    res.redirect('/auth/login');
  },
  
  isGuest: (req, res, next) => {
    if (!req.session.user) return next();
    res.redirect('/dashboard');
  },
  
  isAdmin: (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') return next();
    req.flash('error_msg', 'Admin access required');
    res.redirect('/');
  }
};