require('dotenv').config();
const App = require('./core/App');
const Router = require('./core/Router');

class Server {
  constructor() {
    this.appInstance = new App();
    this.app = this.appInstance.getApp();
    this.PORT = process.env.PORT || 3000;
    this.db = require('./config/database');
  }

  async initialize() {
    console.log('🚀 Initializing Ardthon Solutions Server...');
    console.log('==========================================');
    
    // Test database connection
    await this.testDatabase();
    
    // Load all module routes dynamically
    console.log('\n📦 Loading modules:');
    Router.loadRoutes(this.app);
    
    console.log('\n==========================================');
  }

  async testDatabase() {
    try {
      const [result] = await this.db.query('SELECT 1 as test');
      console.log('✅ Database connection verified');
      
      // Check tables exist
      const [tables] = await this.db.query('SHOW TABLES');
      console.log(`✅ Found ${tables.length} tables in database`);
    } catch (err) {
      console.error('❌ Database check failed:', err.message);
      console.log('⚠️  Server will start but database features may not work');
    }
  }

  start() {
    this.app.listen(this.PORT, '0.0.0.0', () => {
      console.log(`\n🌐 Server running on http://0.0.0.0:${this.PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Website: ${process.env.BASE_URL || 'http://localhost:' + this.PORT}`);
      console.log('==========================================\n');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  async shutdown() {
    console.log('\n🛑 Shutting down gracefully...');
    await this.db.end();
    console.log('✅ Database connections closed');
    process.exit(0);
  }
}

// Start server
const server = new Server();
server.initialize().then(() => server.start());