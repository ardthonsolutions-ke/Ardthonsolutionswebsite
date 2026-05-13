const express = require('express');
const router = express.Router();
const ProductsController = require('./products.controller');

router.get('/', ProductsController.list);
router.get('/:slug', ProductsController.detail);
router.post('/add-to-cart/:id', ProductsController.addToCart);

module.exports = { path: '/products', router };