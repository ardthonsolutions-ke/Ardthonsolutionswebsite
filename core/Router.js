const fs = require('fs');
const path = require('path');

class Router {
  static loadRoutes(app) {
    const modulesPath = path.join(__dirname, '..', 'modules');
    
    // Auto-load all module routes
    const modules = fs.readdirSync(modulesPath);
    
    modules.forEach(module => {
      const routeFile = path.join(modulesPath, module, `${module}.routes.js`);
      
      if (fs.existsSync(routeFile)) {
        try {
          const routeModule = require(routeFile);
          
          // Each module exports its base path and router
          if (routeModule.path && routeModule.router) {
            app.use(routeModule.path, routeModule.router);
            console.log(`✅ Route loaded: ${routeModule.path}`);
          }
        } catch (err) {
          console.error(`❌ Failed to load module: ${module}`, err.message);
        }
      }
    });
    
    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error('Server Error:', err);
      res.status(err.status || 500);
      res.render('error', {
        title: 'Error',
        message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
        error: process.env.NODE_ENV === 'production' ? {} : err
      });
    });
    
    // 404 handler
    app.use((req, res) => {
      res.status(404).render('error', {
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist.',
        error: {}
      });
    });
  }
}

module.exports = Router;