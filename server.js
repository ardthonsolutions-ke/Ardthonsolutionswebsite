var express = require('express');
var path = require('path');
var app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Home - using EJS
app.get('/', function(req, res) {
  res.render('index', { title: 'Ardthon Solutions' });
});

// Test page - raw HTML
app.get('/test', function(req, res) {
  res.send('<h1>Test Page Works!</h1><a href="/">Back Home</a>');
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', function() {
  console.log('Server running on port ' + PORT);
});