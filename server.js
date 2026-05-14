var express = require('express');
var path = require('path');
var app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', function(req, res) {
  res.send('<h1 style="text-align:center;margin-top:100px;font-family:Arial;">Ardthon Solutions</h1><p style="text-align:center;font-size:20px;">Connect with Ease</p><p style="text-align:center;"><a href="/test">Test Page</a></p>');
});

app.get('/test', function(req, res) {
  res.send('<h1>Test Page Works!</h1><a href="/">Back Home</a>');
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', function() {
  console.log('Server running on port ' + PORT);
});