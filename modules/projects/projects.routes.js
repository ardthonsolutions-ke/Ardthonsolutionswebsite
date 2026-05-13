const express = require('express');
const router = express.Router();
const ProjectsController = require('./projects.controller');

router.get('/', ProjectsController.list);
router.get('/cuepay', (req, res) => res.redirect('/cuepay'));
router.get('/:slug', ProjectsController.detail);

module.exports = { path: '/projects', router };