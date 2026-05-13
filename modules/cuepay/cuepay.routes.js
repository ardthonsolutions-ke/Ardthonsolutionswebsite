const express = require('express');
const router = express.Router();
const CuePayController = require('./cuepay.controller');
const { isCuePayAuth, isCuePayGuest, validateApiKey } = require('./cuepay.middleware');

// ===== WEB PAGES (User-facing) =====

// Login
router.get('/login', isCuePayGuest, CuePayController.loginPage);
router.post('/login', isCuePayGuest, CuePayController.login);

// Logout
router.get('/logout', CuePayController.logout);

// Dashboard (requires CuePay login)
router.get('/dashboard', isCuePayAuth, CuePayController.dashboard);

// Register device
router.get('/register-device', isCuePayAuth, CuePayController.registerDevicePage);
router.post('/register-device', isCuePayAuth, CuePayController.registerDevice);

// Device credentials
router.get('/device-credentials', isCuePayAuth, CuePayController.deviceCredentials);

// Device detail
router.get('/device/:deviceId', isCuePayAuth, CuePayController.deviceDetail);

// Send command to device
router.post('/device/:deviceId/command', isCuePayAuth, CuePayController.sendCommand);

// ===== API ENDPOINTS (Device communication) =====

// Device sync (with API key validation)
router.post('/api/sync', validateApiKey, CuePayController.sync);

// Get tables (public)
router.get('/api/tables', CuePayController.getTables);

// CuePay main page
router.get('/', (req, res) => {
  res.render('cuepay/login', {
    title: 'CuePay - Pool Automation System'
  });
});

module.exports = { path: '/cuepay', router };