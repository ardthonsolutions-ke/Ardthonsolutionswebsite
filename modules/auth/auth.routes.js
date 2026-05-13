const express = require('express');
const router = express.Router();
const AuthController = require('./auth.controller');
const { isAuth, isGuest } = require('./auth.middleware');

// Auth pages
router.get('/login', isGuest, AuthController.loginPage);
router.get('/register', isGuest, AuthController.registerPage);

// Auth actions
router.post('/login', isGuest, AuthController.login);
router.post('/register', isGuest, AuthController.register);
router.get('/logout', AuthController.logout);

// Dashboard (protected)
router.get('/dashboard', isAuth, AuthController.dashboard);

module.exports = { path: '/auth', router };

// Also export dashboard route separately
module.exports.dashboardRoute = {
  path: '/dashboard',
  router: (() => {
    const r = express.Router();
    r.get('/', isAuth, AuthController.dashboard);
    return r;
  })()
};