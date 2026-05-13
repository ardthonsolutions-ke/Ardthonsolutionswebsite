module.exports = {
  APP_NAME: 'Ardthon Solutions',
  SLOGAN: 'Connect with Ease',
  
  PRODUCT_CATEGORIES: [
    'Programmable Boards',
    'Sensors',
    'Arduino',
    'ESP32',
    'Accessories',
    'Kits'
  ],
  
  PROJECT_FIELDS: [
    'Medical Engineering',
    'Electrical',
    'Electronics',
    'Computer Science',
    'IoT',
    'Automation',
    'Robotics',
    'Other'
  ],
  
  BLOG_CATEGORIES: ['Tutorial', 'Project Showcase', 'News', 'Guide', 'Review'],
  
  ORDER_STATUS: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
  
  CUEPAY: {
    SYNC_INTERVAL: 300,
    BATTERY_FULL: 12.6,
    BATTERY_EMPTY: 10.5,
    STATUS: ['online', 'offline', 'maintenance']
  },
  
  UPLOAD: {
    MAX_SIZE: 5 * 1024 * 1024,
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    DESTINATION: 'public/uploads/'
  }
};