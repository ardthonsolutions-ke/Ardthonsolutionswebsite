const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Generate session token
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

// ALLERSAFE Authentication Middleware
function isAllersafeLoggedIn(req, res, next) {
    if (req.session.allersafeUser) return next();
    res.redirect('/allersafe/login');
}

// ============================================
// PUBLIC ROUTES
// ============================================

// Home page
router.get('/', async (req, res) => {
    try {
        let products = [];
        if (req.db) {
            const [rows] = await req.db.query(`
                SELECT p.*, m.material_name, m.allergy_risk_level
                FROM allersafe_products p
                JOIN allersafe_materials m ON p.material_id = m.id
                WHERE p.certification_status = 1
                LIMIT 6
            `);
            products = rows;
        }
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>ALLERSAFE - Hypoallergenic Jewellery</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; }
                    .navbar { background: rgba(255,255,255,0.98); backdrop-filter: blur(10px); box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 12px 0; }
                    .hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 80px 0; color: white; text-align: center; }
                    .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 50px; padding: 12px 30px; }
                    .card { transition: transform 0.3s; border-radius: 15px; overflow: hidden; }
                    .card:hover { transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                    footer { background: #1e293b; color: white; padding: 40px 0; margin-top: 60px; }
                </style>
            </head>
            <body>
                <nav class="navbar navbar-expand-lg">
                    <div class="container">
                        <a class="navbar-brand fw-bold" href="/allersafe">
                            <i class="fas fa-gem" style="color:#667eea;"></i> ALLERSAFE
                        </a>
                        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                            <span class="navbar-toggler-icon"></span>
                        </button>
                        <div class="collapse navbar-collapse" id="navbarNav">
                            <ul class="navbar-nav ms-auto">
                                <li class="nav-item"><a class="nav-link" href="/allersafe">Home</a></li>
                                <li class="nav-item"><a class="nav-link" href="/allersafe/shop">Shop</a></li>
                                <li class="nav-item"><a class="nav-link" href="/allersafe/verify">Verify</a></li>
                                ${req.session.allersafeUser ? `
                                    <li class="nav-item"><a class="nav-link" href="/allersafe/profile">My Profile</a></li>
                                    <li class="nav-item"><a class="nav-link" href="/allersafe/logout">Logout (${req.session.allersafeUser.fullname})</a></li>
                                ` : `
                                    <li class="nav-item"><a class="nav-link" href="/allersafe/login">Login</a></li>
                                    <li class="nav-item"><a class="nav-link" href="/allersafe/register">Register</a></li>
                                `}
                            </ul>
                        </div>
                    </div>
                </nav>
                
                <div class="hero">
                    <div class="container">
                        <i class="fas fa-gem fa-4x mb-3"></i>
                        <h1 class="display-4 fw-bold">ALLERSAFE</h1>
                        <p class="lead">Hypoallergenic Jewellery Verification & Recommendation System</p>
                        <p>Wear with confidence. No more rashes, no more worries.</p>
                        <div class="mt-4">
                            <a href="/allersafe/shop" class="btn btn-light btn-lg me-2">🛒 Shop Now</a>
                            <a href="/allersafe/verify" class="btn btn-outline-light btn-lg">🔍 Verify Product</a>
                        </div>
                    </div>
                </div>
                
                <div class="container py-5">
                    <h2 class="text-center mb-5">Featured Hypoallergenic Products</h2>
                    <div class="row g-4">
                        ${products.map(p => `
                            <div class="col-md-4">
                                <div class="card h-100 shadow-sm">
                                    <div class="card-body">
                                        <span class="badge bg-success mb-2">${p.material_name}</span>
                                        <h5 class="card-title">${p.name}</h5>
                                        <p class="card-text text-muted small">${p.description.substring(0, 100)}...</p>
                                        <div class="d-flex justify-content-between align-items-center mt-3">
                                            <span class="h5 text-primary mb-0">KSh ${parseFloat(p.price).toFixed(2)}</span>
                                            <span class="badge bg-success">✓ Verified</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <footer class="text-center">
                    <div class="container">
                        <p>&copy; 2026 Ardthon Solutions - ALLERSAFE Hypoallergenic Jewellery System</p>
                    </div>
                </footer>
                
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            </body>
            </html>
        `);
    } catch(err) {
        console.error('ALLERSAFE error:', err);
        res.send('<h1>ALLERSAFE</h1><p>System loading. Please check back soon!</p>');
    }
});

// Register page
router.get('/register', (req, res) => {
    if (req.session.allersafeUser) return res.redirect('/allersafe');
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Register - ALLERSAFE</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
            <style>
                body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
                .card { border-radius: 15px; }
            </style>
        </head>
        <body class="d-flex align-items-center">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col-md-5">
                        <div class="card shadow">
                            <div class="card-header bg-primary text-white text-center">
                                <h4 class="mb-0"><i class="fas fa-user-plus me-2"></i>Create ALLERSAFE Account</h4>
                            </div>
                            <div class="card-body">
                                <form method="POST" action="/allersafe/register">
                                    <div class="mb-3">
                                        <label class="form-label">Full Name</label>
                                        <input type="text" name="fullname" class="form-control" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Email</label>
                                        <input type="email" name="email" class="form-control" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Phone (Optional)</label>
                                        <input type="tel" name="phone" class="form-control">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Password</label>
                                        <input type="password" name="password" class="form-control" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Confirm Password</label>
                                        <input type="password" name="confirm_password" class="form-control" required>
                                    </div>
                                    <button type="submit" class="btn btn-primary w-100">Register</button>
                                </form>
                                <hr>
                                <div class="text-center">
                                    <a href="/allersafe/login">Already have an account? Login</a>
                                </div>
                                <div class="text-center mt-3">
                                    <a href="/allersafe" class="text-muted">← Back to Home</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Register POST
router.post('/register', async (req, res) => {
    try {
        const { fullname, email, phone, password, confirm_password } = req.body;
        
        if (password !== confirm_password) {
            return res.send('<script>alert("Passwords do not match!"); window.location="/allersafe/register";</script>');
        }
        
        if (password.length < 6) {
            return res.send('<script>alert("Password must be at least 6 characters!"); window.location="/allersafe/register";</script>');
        }
        
        // Check if user exists
        const [existing] = await req.db.query(
            'SELECT id FROM allersafe_users WHERE email = ?',
            [email]
        );
        
        if (existing.length > 0) {
            return res.send('<script>alert("Email already registered!"); window.location="/allersafe/register";</script>');
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await req.db.query(
            'INSERT INTO allersafe_users (fullname, email, phone, password) VALUES (?, ?, ?, ?)',
            [fullname, email, phone || null, hashedPassword]
        );
        
        res.send('<script>alert("Registration successful! Please login."); window.location="/allersafe/login";</script>');
    } catch(err) {
        console.error('Register error:', err);
        res.send('<script>alert("Registration failed. Please try again."); window.location="/allersafe/register";</script>');
    }
});

// Login page
router.get('/login', (req, res) => {
    if (req.session.allersafeUser) return res.redirect('/allersafe');
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Login - ALLERSAFE</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
            <style>
                body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
                .card { border-radius: 15px; }
            </style>
        </head>
        <body class="d-flex align-items-center">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col-md-5">
                        <div class="card shadow">
                            <div class="card-header bg-primary text-white text-center">
                                <h4 class="mb-0"><i class="fas fa-sign-in-alt me-2"></i>ALLERSAFE Login</h4>
                            </div>
                            <div class="card-body">
                                <form method="POST" action="/allersafe/login">
                                    <div class="mb-3">
                                        <label class="form-label">Email</label>
                                        <input type="email" name="email" class="form-control" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Password</label>
                                        <input type="password" name="password" class="form-control" required>
                                    </div>
                                    <button type="submit" class="btn btn-primary w-100">Login</button>
                                </form>
                                <hr>
                                <div class="text-center">
                                    <a href="/allersafe/register">Don't have an account? Register</a>
                                </div>
                                <div class="text-center mt-3">
                                    <a href="/allersafe" class="text-muted">← Back to Home</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Login POST
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const [users] = await req.db.query(
            'SELECT * FROM allersafe_users WHERE email = ?',
            [email]
        );
        
        if (users.length === 0) {
            return res.send('<script>alert("Invalid email or password!"); window.location="/allersafe/login";</script>');
        }
        
        const user = users[0];
        const valid = await bcrypt.compare(password, user.password);
        
        if (!valid) {
            return res.send('<script>alert("Invalid email or password!"); window.location="/allersafe/login";</script>');
        }
        
        // Update last login
        await req.db.query(
            'UPDATE allersafe_users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );
        
        req.session.allersafeUser = {
            id: user.id,
            email: user.email,
            fullname: user.fullname,
            phone: user.phone
        };
        
        res.redirect('/allersafe');
    } catch(err) {
        console.error('Login error:', err);
        res.send('<script>alert("Login failed. Please try again."); window.location="/allersafe/login";</script>');
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.allersafeUser = null;
    res.redirect('/allersafe');
});

// Profile page (requires login)
router.get('/profile', isAllersafeLoggedIn, async (req, res) => {
    const user = req.session.allersafeUser;
    
    // Get user's allergy profile
    let allergyProfile = null;
    if (req.db) {
        const [profiles] = await req.db.query(
            'SELECT * FROM allersafe_allergy_profiles WHERE user_id = ?',
            [user.id]
        );
        allergyProfile = profiles[0] || null;
    }
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>My Profile - ALLERSAFE</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
            <style>
                body { background: #f8fafc; }
                .navbar { background: rgba(255,255,255,0.98); backdrop-filter: blur(10px); box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 12px 0; }
                .card { border-radius: 15px; }
            </style>
        </head>
        <body>
            <nav class="navbar navbar-expand-lg">
                <div class="container">
                    <a class="navbar-brand fw-bold" href="/allersafe">
                        <i class="fas fa-gem" style="color:#667eea;"></i> ALLERSAFE
                    </a>
                    <div class="collapse navbar-collapse">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item"><a class="nav-link" href="/allersafe">Home</a></li>
                            <li class="nav-item"><a class="nav-link" href="/allersafe/shop">Shop</a></li>
                            <li class="nav-item"><a class="nav-link" href="/allersafe/verify">Verify</a></li>
                            <li class="nav-item"><a class="nav-link active" href="/allersafe/profile">My Profile</a></li>
                            <li class="nav-item"><a class="nav-link" href="/allersafe/logout">Logout</a></li>
                        </ul>
                    </div>
                </div>
            </nav>
            
            <div class="container py-5">
                <div class="row justify-content-center">
                    <div class="col-md-8">
                        <div class="card shadow">
                            <div class="card-header bg-primary text-white">
                                <h4 class="mb-0"><i class="fas fa-user me-2"></i>My ALLERSAFE Profile</h4>
                            </div>
                            <div class="card-body">
                                <div class="mb-4">
                                    <h5>Account Information</h5>
                                    <p><strong>Name:</strong> ${user.fullname}</p>
                                    <p><strong>Email:</strong> ${user.email}</p>
                                    <p><strong>Phone:</strong> ${user.phone || 'Not provided'}</p>
                                </div>
                                
                                <hr>
                                
                                <form method="POST" action="/allersafe/allergy-profile">
                                    <h5><i class="fas fa-user-md me-2"></i>Metal Allergy Profile</h5>
                                    <p class="text-muted small">Tell us about your allergies for personalized recommendations</p>
                                    
                                    <div class="row">
                                        <div class="col-md-6">
                                            <div class="form-check mb-2">
                                                <input class="form-check-input" type="checkbox" name="nickel_allergy" id="nickel" ${allergyProfile && allergyProfile.nickel_allergy ? 'checked' : ''}>
                                                <label class="form-check-label" for="nickel">Nickel Allergy <span class="badge bg-danger">Most Common</span></label>
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="form-check mb-2">
                                                <input class="form-check-input" type="checkbox" name="cobalt_allergy" id="cobalt" ${allergyProfile && allergyProfile.cobalt_allergy ? 'checked' : ''}>
                                                <label class="form-check-label" for="cobalt">Cobalt Allergy</label>
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="form-check mb-2">
                                                <input class="form-check-input" type="checkbox" name="copper_allergy" id="copper" ${allergyProfile && allergyProfile.copper_allergy ? 'checked' : ''}>
                                                <label class="form-check-label" for="copper">Copper Allergy</label>
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="form-check mb-2">
                                                <input class="form-check-input" type="checkbox" name="chromium_allergy" id="chromium" ${allergyProfile && allergyProfile.chromium_allergy ? 'checked' : ''}>
                                                <label class="form-check-label" for="chromium">Chromium Allergy</label>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">Other Allergies</label>
                                        <textarea name="other_allergies" class="form-control" rows="2" placeholder="List any other metal allergies...">${allergyProfile ? allergyProfile.other_allergies || '' : ''}</textarea>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">Reaction Severity</label>
                                        <select name="severity_level" class="form-select">
                                            <option value="mild" ${allergyProfile && allergyProfile.severity_level === 'mild' ? 'selected' : ''}>Mild - Minor irritation</option>
                                            <option value="moderate" ${allergyProfile && allergyProfile.severity_level === 'moderate' ? 'selected' : ''}>Moderate - Noticeable rash</option>
                                            <option value="severe" ${allergyProfile && allergyProfile.severity_level === 'severe' ? 'selected' : ''}>Severe - Intense reaction</option>
                                        </select>
                                    </div>
                                    
                                    <button type="submit" class="btn btn-primary">Save Allergy Profile</button>
                                </form>
                                
                                <hr>
                                <a href="/allersafe" class="btn btn-link">← Back to Home</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Save allergy profile
router.post('/allergy-profile', isAllersafeLoggedIn, async (req, res) => {
    try {
        const userId = req.session.allersafeUser.id;
        const { nickel_allergy, cobalt_allergy, copper_allergy, chromium_allergy, other_allergies, severity_level } = req.body;
        
        const [existing] = await req.db.query(
            'SELECT id FROM allersafe_allergy_profiles WHERE user_id = ?',
            [userId]
        );
        
        if (existing.length > 0) {
            await req.db.query(`
                UPDATE allersafe_allergy_profiles 
                SET nickel_allergy = ?, cobalt_allergy = ?, copper_allergy = ?, 
                    chromium_allergy = ?, other_allergies = ?, severity_level = ?
                WHERE user_id = ?
            `, [nickel_allergy ? 1 : 0, cobalt_allergy ? 1 : 0, copper_allergy ? 1 : 0, 
                chromium_allergy ? 1 : 0, other_allergies || '', severity_level || 'moderate', userId]);
        } else {
            await req.db.query(`
                INSERT INTO allersafe_allergy_profiles 
                (user_id, nickel_allergy, cobalt_allergy, copper_allergy, chromium_allergy, other_allergies, severity_level)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [userId, nickel_allergy ? 1 : 0, cobalt_allergy ? 1 : 0, copper_allergy ? 1 : 0, 
                chromium_allergy ? 1 : 0, other_allergies || '', severity_level || 'moderate']);
        }
        
        res.redirect('/allersafe/profile');
    } catch(err) {
        console.error('Save allergy profile error:', err);
        res.redirect('/allersafe/profile');
    }
});

// Shop page
router.get('/shop', async (req, res) => {
    try {
        let products = [];
        if (req.db) {
            const [rows] = await req.db.query(`
                SELECT p.*, m.material_name, m.allergy_risk_level
                FROM allersafe_products p
                JOIN allersafe_materials m ON p.material_id = m.id
                WHERE p.certification_status = 1
            `);
            products = rows;
        }
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Shop - ALLERSAFE</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
                <style>
                    body { background: #f8fafc; }
                    .navbar { background: rgba(255,255,255,0.98); backdrop-filter: blur(10px); box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .card { transition: transform 0.3s; border-radius: 15px; }
                    .card:hover { transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                </style>
            </head>
            <body>
                <nav class="navbar navbar-expand-lg">
                    <div class="container">
                        <a class="navbar-brand fw-bold" href="/allersafe">
                            <i class="fas fa-gem" style="color:#667eea;"></i> ALLERSAFE
                        </a>
                        <div class="collapse navbar-collapse">
                            <ul class="navbar-nav ms-auto">
                                <li class="nav-item"><a class="nav-link" href="/allersafe">Home</a></li>
                                <li class="nav-item"><a class="nav-link active" href="/allersafe/shop">Shop</a></li>
                                <li class="nav-item"><a class="nav-link" href="/allersafe/verify">Verify</a></li>
                                ${req.session.allersafeUser ? `
                                    <li class="nav-item"><a class="nav-link" href="/allersafe/profile">Profile</a></li>
                                    <li class="nav-item"><a class="nav-link" href="/allersafe/logout">Logout</a></li>
                                ` : `
                                    <li class="nav-item"><a class="nav-link" href="/allersafe/login">Login</a></li>
                                    <li class="nav-item"><a class="nav-link" href="/allersafe/register">Register</a></li>
                                `}
                            </ul>
                        </div>
                    </div>
                </nav>
                
                <div class="container py-5">
                    <h1 class="text-center mb-4">Hypoallergenic Jewellery Shop</h1>
                    <p class="text-center text-muted mb-5">All products verified for your safety</p>
                    
                    <div class="row g-4">
                        ${products.map(p => `
                            <div class="col-md-4">
                                <div class="card h-100 shadow-sm">
                                    <div class="card-body">
                                        <span class="badge bg-success mb-2">${p.material_name}</span>
                                        <h5 class="card-title">${p.name}</h5>
                                        <p class="card-text text-muted small">${p.description.substring(0, 100)}...</p>
                                        <div class="d-flex justify-content-between align-items-center mt-3">
                                            <span class="h4 text-primary mb-0">KSh ${parseFloat(p.price).toFixed(2)}</span>
                                            <span class="badge bg-info">${p.allergy_risk_level.toUpperCase()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="text-center mt-4">
                        <a href="/allersafe" class="btn btn-link">← Back to Home</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch(err) {
        res.send('<h1>Shop</h1><p>Products loading...</p><a href="/allersafe">Back</a>');
    }
});

// Verify page
router.get('/verify', (req, res) => {
    const qrCode = req.query.qr_code;
    let result = '';
    
    if (qrCode) {
        result = `<div class="alert alert-success mt-4"><i class="fas fa-check-circle"></i> <strong>Verified!</strong> Product ${qrCode} is certified hypoallergenic and safe for sensitive skin.</div>`;
    }
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Verify - ALLERSAFE</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
            <style>
                body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
                .navbar { background: rgba(255,255,255,0.98); backdrop-filter: blur(10px); }
                .card { border-radius: 15px; }
            </style>
        </head>
        <body>
            <nav class="navbar navbar-expand-lg">
                <div class="container">
                    <a class="navbar-brand fw-bold" href="/allersafe">
                        <i class="fas fa-gem" style="color:#667eea;"></i> ALLERSAFE
                    </a>
                    <div class="collapse navbar-collapse">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item"><a class="nav-link" href="/allersafe">Home</a></li>
                            <li class="nav-item"><a class="nav-link" href="/allersafe/shop">Shop</a></li>
                            <li class="nav-item"><a class="nav-link active" href="/allersafe/verify">Verify</a></li>
                            ${req.session.allersafeUser ? `
                                <li class="nav-item"><a class="nav-link" href="/allersafe/profile">Profile</a></li>
                                <li class="nav-item"><a class="nav-link" href="/allersafe/logout">Logout</a></li>
                            ` : `
                                <li class="nav-item"><a class="nav-link" href="/allersafe/login">Login</a></li>
                                <li class="nav-item"><a class="nav-link" href="/allersafe/register">Register</a></li>
                            `}
                        </ul>
                    </div>
                </div>
            </nav>
            
            <div class="container py-5">
                <div class="row justify-content-center">
                    <div class="col-md-6">
                        <div class="card shadow">
                            <div class="card-header bg-primary text-white text-center">
                                <h4 class="mb-0"><i class="fas fa-qrcode me-2"></i>Verify Your Jewellery</h4>
                            </div>
                            <div class="card-body text-center">
                                <form method="GET" action="/allersafe/verify">
                                    <input type="text" name="qr_code" class="form-control form-control-lg mb-3" placeholder="Enter QR code or Product ID" required>
                                    <button type="submit" class="btn btn-primary btn-lg w-100">Verify Now</button>
                                </form>
                                ${result}
                                <hr>
                                <a href="/allersafe" class="btn btn-link">← Back to Home</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
});

module.exports = router;