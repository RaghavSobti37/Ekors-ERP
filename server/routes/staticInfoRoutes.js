const express = require('express');
const router = express.Router();
const staticInfoController = require('../controllers/staticInfoController');
const auth = require('../middleware/auth');

// Public routes
router.get('/:key', staticInfoController.getStaticInfo);

// Protected routes (require authentication)
router.post('/', auth, staticInfoController.createStaticInfo);
router.put('/:id', auth, staticInfoController.updateStaticInfo);
router.delete('/:id', auth, staticInfoController.deleteStaticInfo);

// Admin-only routes
router.get('/', auth, staticInfoController.getAllStaticInfo);

module.exports = router;