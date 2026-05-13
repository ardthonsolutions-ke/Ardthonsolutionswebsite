const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const flash = require('connect-flash');
const session = require('../config/session');

class App {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupViewEngine();
    this.setupGlobalVariables();
  }

  setupMiddleware() {
    // Security
    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));
    this.app.use(cors());
    
    // Performance
    this.app.use(compression());
    
    // Logging
    if (process.env.NODE_ENV === 'production') {
      this.app.use(morgan('combined'));
    } else {
      this.app.use(morgan('dev'));
    }
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      message: 'Too many requests, please try again later.'
    });
    this.app.use('/api/', limiter);
    this.app.use('/auth/', limiter);
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Static files
    this.app.use(express.static(path.join(__dirname, '..', 'public')));
    
    // Session & Flash
    this.app.use(session);
    this.app.use(flash());
    
    // Database middleware
    this.app.use((req, res, next) => {
      req.db = require('../config/database');
      next();
    });
  }

  setupViewEngine() {
    this.app.set('view engine', 'ejs');
    this.app.set('views', path.join(__dirname, '..', 'views'));
  }

  setupGlobalVariables() {
    this.app.use((req, res, next) => {
      res.locals.user = req.session.user || null;
      res.locals.success_msg = req.flash('success_msg');
      res.locals.error_msg = req.flash('error_msg');
      res.locals.cartCount = req.session.cart ? req.session.cart.length : 0;
      res.locals.currentUrl = req.originalUrl;
      res.locals.appName = 'Ardthon Solutions';
      res.locals.slogan = 'Connect with Ease';
      res.locals.year = new Date().getFullYear();
      next();
    });
  }

  getApp() {
    return this.app;
  }
}

module.exports = App;