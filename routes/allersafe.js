const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Middleware to check if user is logged in
function isLoggedIn(req, res, next) {
    if (req.session.user) return next();
    req.flash('error_msg', 'Please login to access ALLERSAFE features');
    res.redirect('/auth/login');
}

// Generate QR code for product
function generateQRCode(productId, productName) {
    return 'ALLERSAFE_' + productId + '_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Get user's allergy profile
async function getAllergyProfile(userId, db) {
    const [profile] = await db.query(
        'SELECT * FROM allersafe_allergy_profiles WHERE user_id = ?',
        [userId]
    );
    return profile[0] || null;
}

// Get recommended products based on allergy profile
async function getRecommendedProducts(userId, db, limit = 12) {
    const profile = await getAllergyProfile(userId, db);
    
    let query = `
        SELECT p.*, m.material_name, m.allergy_risk_level, m.is_hypoallergenic,
               (SELECT AVG(rating) FROM allersafe_reviews WHERE product_id = p.id) as avg_rating,
               (SELECT COUNT(*) FROM allersafe_reviews WHERE product_id = p.id) as review_count
        FROM allersafe_products p
        JOIN allersafe_materials m ON p.material_id = m.id
        WHERE p.stock_quantity > 0
    `;
    
    if (profile) {
        if (profile.severity_level === 'severe') {
            query += ` AND m.allergy_risk_level = 'safe'`;
        } else if (profile.severity_level === 'moderate') {
            query += ` AND m.allergy_risk_level IN ('safe', 'low')`;
        }
    }
    
    query += ` ORDER BY m.allergy_risk_level ASC, p.created_at DESC LIMIT ${limit}`;
    
    const [products] = await db.query(query);
    return products;
}

// ============================================
// ALLERSAFE ROUTES
// ============================================

// Landing page
router.get('/', async (req, res) => {
    try {
        const db = req.db;
        
        // Get featured products
        const [featuredProducts] = await db.query(`
            SELECT p.*, m.material_name, m.allergy_risk_level,
                   (SELECT AVG(rating) FROM allersafe_reviews WHERE product_id = p.id) as avg_rating
            FROM allersafe_products p
            JOIN allersafe_materials m ON p.material_id = m.id
            WHERE p.certification_status = 1
            ORDER BY p.created_at DESC LIMIT 8
        `);
        
        // Get materials for display
        const [materials] = await db.query(`
            SELECT * FROM allersafe_materials ORDER BY 
            CASE allergy_risk_level 
                WHEN 'safe' THEN 1 
                WHEN 'low' THEN 2 
                WHEN 'medium' THEN 3 
                WHEN 'high' THEN 4 
            END
        `);
        
        res.render('allersafe/index', {
            title: 'ALLERSAFE - Hypoallergenic Jewellery',
            featuredProducts,
            materials,
            user: req.session.user || null
        });
    } catch(err) {
        console.error('ALLERSAFE home error:', err);
        res.render('allersafe/index', {
            title: 'ALLERSAFE - Hypoallergenic Jewellery',
            featuredProducts: [],
            materials: [],
            user: req.session.user || null
        });
    }
});

// Shop page with filters
router.get('/shop', async (req, res) => {
    try {
        const db = req.db;
        const { category, material, search, sort, min_price, max_price } = req.query;
        
        let query = `
            SELECT p.*, m.material_name, m.allergy_risk_level, m.is_hypoallergenic,
                   (SELECT AVG(rating) FROM allersafe_reviews WHERE product_id = p.id) as avg_rating,
                   (SELECT COUNT(*) FROM allersafe_reviews WHERE product_id = p.id) as review_count
            FROM allersafe_products p
            JOIN allersafe_materials m ON p.material_id = m.id
            WHERE p.stock_quantity > 0
        `;
        let params = [];
        
        if (category && category !== 'all') {
            query += ` AND p.category = ?`;
            params.push(category);
        }
        
        if (material && material !== 'all') {
            query += ` AND m.material_name = ?`;
            params.push(material);
        }
        
        if (search) {
            query += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }
        
        if (min_price) {
            query += ` AND p.price >= ?`;
            params.push(parseFloat(min_price));
        }
        
        if (max_price) {
            query += ` AND p.price <= ?`;
            params.push(parseFloat(max_price));
        }
        
        // Sorting
        switch(sort) {
            case 'price_asc': query += ` ORDER BY p.price ASC`; break;
            case 'price_desc': query += ` ORDER BY p.price DESC`; break;
            case 'rating': query += ` ORDER BY avg_rating DESC NULLS LAST`; break;
            case 'newest': default: query += ` ORDER BY p.created_at DESC`; break;
        }
        
        const [products] = await db.query(query, params);
        
        // Get all categories and materials for filters
        const [categories] = await db.query('SELECT DISTINCT category FROM allersafe_products WHERE stock_quantity > 0');
        const [materials] = await db.query('SELECT material_name, allergy_risk_level FROM allersafe_materials');
        
        res.render('allersafe/shop', {
            title: 'ALLERSAFE Shop - Hypoallergenic Jewellery',
            products,
            categories,
            materials,
            filters: { category, material, search, sort, min_price, max_price },
            user: req.session.user || null
        });
    } catch(err) {
        console.error('ALLERSAFE shop error:', err);
        res.render('allersafe/shop', {
            title: 'ALLERSAFE Shop',
            products: [],
            categories: [],
            materials: [],
            filters: {},
            user: req.session.user || null
        });
    }
});

// Product detail page
router.get('/product/:slug', async (req, res) => {
    try {
        const db = req.db;
        const { slug } = req.params;
        
        const [products] = await db.query(`
            SELECT p.*, m.material_name, m.allergy_risk_level, m.description as material_description,
                   m.common_allergens, m.is_hypoallergenic
            FROM allersafe_products p
            JOIN allersafe_materials m ON p.material_id = m.id
            WHERE p.slug = ? AND p.stock_quantity > 0
        `, [slug]);
        
        if (products.length === 0) {
            req.flash('error_msg', 'Product not found');
            return res.redirect('/allersafe/shop');
        }
        
        const product = products[0];
        
        // Parse JSON fields
        product.images = product.images ? JSON.parse(product.images) : [];
        product.features = product.features ? JSON.parse(product.features) : [];
        
        // Get reviews
        const [reviews] = await db.query(`
            SELECT r.*, u.username, u.fullName
            FROM allersafe_reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.product_id = ?
            ORDER BY r.created_at DESC
        `, [product.id]);
        
        // Get average rating
        const [ratingStats] = await db.query(`
            SELECT AVG(rating) as avg, COUNT(*) as count
            FROM allersafe_reviews
            WHERE product_id = ?
        `, [product.id]);
        
        // Get related products (same category or material)
        const [related] = await db.query(`
            SELECT p.*, m.material_name, m.allergy_risk_level
            FROM allersafe_products p
            JOIN allersafe_materials m ON p.material_id = m.id
            WHERE (p.category = ? OR p.material_id = ?) AND p.id != ?
            LIMIT 4
        `, [product.category, product.material_id, product.id]);
        
        // Check if user has favorited
        let isFavorited = false;
        if (req.session.user) {
            const [fav] = await db.query(
                'SELECT id FROM allersafe_favorites WHERE user_id = ? AND product_id = ?',
                [req.session.user.id, product.id]
            );
            isFavorited = fav.length > 0;
        }
        
        res.render('allersafe/product-detail', {
            title: `${product.name} - ALLERSAFE`,
            product,
            reviews,
            ratingStats: ratingStats[0] || { avg: 0, count: 0 },
            related,
            isFavorited,
            user: req.session.user || null
        });
    } catch(err) {
        console.error('ALLERSAFE product detail error:', err);
        res.redirect('/allersafe/shop');
    }
});

// Allergy Profile page
router.get('/profile', isLoggedIn, async (req, res) => {
    try {
        const db = req.db;
        const profile = await getAllergyProfile(req.session.user.id, db);
        
        res.render('allersafe/allergy-profile', {
            title: 'Your Allergy Profile - ALLERSAFE',
            profile,
            user: req.session.user
        });
    } catch(err) {
        console.error('Allergy profile error:', err);
        res.render('allersafe/allergy-profile', {
            title: 'Allergy Profile',
            profile: null,
            user: req.session.user
        });
    }
});

// Save Allergy Profile
router.post('/profile', isLoggedIn, async (req, res) => {
    try {
        const db = req.db;
        const userId = req.session.user.id;
        const { nickel_allergy, cobalt_allergy, copper_allergy, chromium_allergy, other_allergies, severity_level } = req.body;
        
        const [existing] = await db.query(
            'SELECT id FROM allersafe_allergy_profiles WHERE user_id = ?',
            [userId]
        );
        
        if (existing.length > 0) {
            await db.query(`
                UPDATE allersafe_allergy_profiles 
                SET nickel_allergy = ?, cobalt_allergy = ?, copper_allergy = ?, 
                    chromium_allergy = ?, other_allergies = ?, severity_level = ?
                WHERE user_id = ?
            `, [nickel_allergy ? 1 : 0, cobalt_allergy ? 1 : 0, copper_allergy ? 1 : 0, 
                chromium_allergy ? 1 : 0, other_allergies || '', severity_level, userId]);
        } else {
            await db.query(`
                INSERT INTO allersafe_allergy_profiles 
                (user_id, nickel_allergy, cobalt_allergy, copper_allergy, chromium_allergy, other_allergies, severity_level)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [userId, nickel_allergy ? 1 : 0, cobalt_allergy ? 1 : 0, copper_allergy ? 1 : 0, 
                chromium_allergy ? 1 : 0, other_allergies || '', severity_level]);
        }
        
        req.flash('success_msg', 'Your allergy profile has been saved!');
        res.redirect('/allersafe/recommendations');
    } catch(err) {
        console.error('Save allergy profile error:', err);
        req.flash('error_msg', 'Failed to save allergy profile');
        res.redirect('/allersafe/profile');
    }
});

// Recommendations page
router.get('/recommendations', isLoggedIn, async (req, res) => {
    try {
        const db = req.db;
        const userId = req.session.user.id;
        const profile = await getAllergyProfile(userId, db);
        
        let recommendations = [];
        let safeMaterials = [];
        
        if (profile) {
            recommendations = await getRecommendedProducts(userId, db, 12);
            
            // Get safe materials based on severity
            let riskLevels = profile.severity_level === 'severe' ? ['safe'] : 
                            (profile.severity_level === 'moderate' ? ['safe', 'low'] : ['safe', 'low', 'medium']);
            
            const [materials] = await db.query(
                'SELECT * FROM allersafe_materials WHERE allergy_risk_level IN (?)',
                [riskLevels]
            );
            safeMaterials = materials;
        } else {
            // Show popular products if no profile
            const [popular] = await db.query(`
                SELECT p.*, m.material_name, m.allergy_risk_level,
                       (SELECT COUNT(*) FROM allersafe_reviews WHERE product_id = p.id) as review_count
                FROM allersafe_products p
                JOIN allersafe_materials m ON p.material_id = m.id
                ORDER BY p.created_at DESC LIMIT 12
            `);
            recommendations = popular;
        }
        
        res.render('allersafe/recommendations', {
            title: 'Personalized Recommendations - ALLERSAFE',
            recommendations,
            profile,
            safeMaterials,
            user: req.session.user
        });
    } catch(err) {
        console.error('Recommendations error:', err);
        res.render('allersafe/recommendations', {
            title: 'Recommendations',
            recommendations: [],
            profile: null,
            safeMaterials: [],
            user: req.session.user
        });
    }
});

// QR Code Verification
router.get('/verify', isLoggedIn, async (req, res) => {
    const { qr_code } = req.query;
    let verificationResult = null;
    
    if (qr_code) {
        try {
            const db = req.db;
            const [products] = await db.query(`
                SELECT p.*, m.material_name, m.allergy_risk_level, m.description as material_description,
                       m.common_allergens, m.is_hypoallergenic
                FROM allersafe_products p
                JOIN allersafe_materials m ON p.material_id = m.id
                WHERE p.qr_code = ? OR p.id = ?
            `, [qr_code, qr_code]);
            
            if (products.length > 0) {
                const product = products[0];
                product.images = product.images ? JSON.parse(product.images) : [];
                
                // Check if product is safe for current user
                let isSafeForUser = true;
                let warningMessage = null;
                
                if (req.session.user) {
                    const profile = await getAllergyProfile(req.session.user.id, db);
                    if (profile) {
                        const riskLevels = { 'safe': 1, 'low': 2, 'medium': 3, 'high': 4 };
                        const userMaxRisk = profile.severity_level === 'severe' ? 1 :
                                           (profile.severity_level === 'moderate' ? 2 : 3);
                        const productRisk = riskLevels[product.allergy_risk_level] || 3;
                        
                        if (productRisk > userMaxRisk) {
                            isSafeForUser = false;
                            warningMessage = `Warning: This product may not be suitable for your ${profile.severity_level} allergy sensitivity.`;
                        }
                    }
                }
                
                verificationResult = { product, isSafeForUser, warningMessage };
            } else {
                verificationResult = { error: 'Product not found or not verified' };
            }
        } catch(err) {
            console.error('Verification error:', err);
            verificationResult = { error: 'Verification failed. Please try again.' };
        }
    }
    
    res.render('allersafe/verify', {
        title: 'Verify Jewellery - ALLERSAFE',
        verificationResult,
        user: req.session.user || null
    });
});

// QR Scanner page
router.get('/scan', isLoggedIn, (req, res) => {
    res.render('allersafe/scan', {
        title: 'Scan QR Code - ALLERSAFE',
        user: req.session.user
    });
});

// Add review
router.post('/product/:productId/review', isLoggedIn, async (req, res) => {
    try {
        const db = req.db;
        const { productId } = req.params;
        const { rating, comment } = req.body;
        const userId = req.session.user.id;
        
        await db.query(
            'INSERT INTO allersafe_reviews (user_id, product_id, rating, comment) VALUES (?, ?, ?, ?)',
            [userId, productId, parseInt(rating), comment]
        );
        
        req.flash('success_msg', 'Review submitted! Thank you for your feedback.');
        res.redirect(`/allersafe/product/${productId}`);
    } catch(err) {
        console.error('Review error:', err);
        req.flash('error_msg', 'Failed to submit review');
        res.redirect('back');
    }
});

// Toggle favorite
router.post('/favorite/:productId/toggle', isLoggedIn, async (req, res) => {
    try {
        const db = req.db;
        const { productId } = req.params;
        const userId = req.session.user.id;
        
        const [existing] = await db.query(
            'SELECT id FROM allersafe_favorites WHERE user_id = ? AND product_id = ?',
            [userId, productId]
        );
        
        if (existing.length > 0) {
            await db.query(
                'DELETE FROM allersafe_favorites WHERE user_id = ? AND product_id = ?',
                [userId, productId]
            );
            req.flash('success_msg', 'Removed from favorites');
        } else {
            await db.query(
                'INSERT INTO allersafe_favorites (user_id, product_id) VALUES (?, ?)',
                [userId, productId]
            );
            req.flash('success_msg', 'Added to favorites');
        }
        
        res.redirect('back');
    } catch(err) {
        console.error('Favorite error:', err);
        req.flash('error_msg', 'Action failed');
        res.redirect('back');
    }
});

// Favorites page
router.get('/favorites', isLoggedIn, async (req, res) => {
    try {
        const db = req.db;
        const userId = req.session.user.id;
        
        const [favorites] = await db.query(`
            SELECT p.*, m.material_name, m.allergy_risk_level,
                   (SELECT AVG(rating) FROM allersafe_reviews WHERE product_id = p.id) as avg_rating
            FROM allersafe_favorites f
            JOIN allersafe_products p ON f.product_id = p.id
            JOIN allersafe_materials m ON p.material_id = m.id
            WHERE f.user_id = ?
            ORDER BY f.created_at DESC
        `, [userId]);
        
        res.render('allersafe/favorites', {
            title: 'My Favorites - ALLERSAFE',
            favorites,
            user: req.session.user
        });
    } catch(err) {
        console.error('Favorites error:', err);
        res.render('allersafe/favorites', {
            title: 'My Favorites',
            favorites: [],
            user: req.session.user
        });
    }
});

// Materials information page
router.get('/materials', async (req, res) => {
    try {
        const db = req.db;
        const [materials] = await db.query(`
            SELECT * FROM allersafe_materials 
            ORDER BY 
            CASE allergy_risk_level 
                WHEN 'safe' THEN 1 
                WHEN 'low' THEN 2 
                WHEN 'medium' THEN 3 
                WHEN 'high' THEN 4 
            END
        `);
        
        res.render('allersafe/materials', {
            title: 'Hypoallergenic Materials Guide - ALLERSAFE',
            materials,
            user: req.session.user || null
        });
    } catch(err) {
        console.error('Materials error:', err);
        res.render('allersafe/materials', {
            title: 'Materials Guide',
            materials: [],
            user: req.session.user || null
        });
    }
});

module.exports = router;